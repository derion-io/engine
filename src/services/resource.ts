import { BigNumber, Contract, ethers } from 'ethers'
import { LOCALSTORAGE_KEY, POOL_IDS, ZERO_ADDRESS } from '../utils/constant'
import { ContractCallContext, Multicall } from 'ethereum-multicall'
import { LogType, PoolGroupsType, PoolsType, PoolType, Storage, TokenType } from '../types'
import { bn, div, formatMultiCallBignumber, getNormalAddress, getTopics, kx, rateFromHL, parsePrice, mergeTwoUniqSortedLogs } from '../utils/helper'
import { JsonRpcProvider } from '@ethersproject/providers'
import _, { concat, uniqBy } from 'lodash'
import { IPairInfo, IPairsInfo, UniV3Pair } from './uniV3Pair'
import { IDerivableContractAddress, IEngineConfig } from '../utils/configs'
import { defaultAbiCoder, hexZeroPad } from 'ethers/lib/utils'
import { Profile } from '../profile'
import * as OracleSdk from '../utils/OracleSdk'
import * as OracleSdkAdapter from '../utils/OracleSdkAdapter'
import { unpackId } from '../utils/number'
import Events721Abi from '../abi/Events721.json'

const TOPICS = getTopics()
const TOPICS721 = getTopics(Events721Abi)
const TOPICS_20 = [
  ...TOPICS.Transfer,
  ...TOPICS.Approval,
]

const TOPICS_1155 = [
  ...TOPICS.TransferSingle,
  ...TOPICS.TransferBatch,
  ...TOPICS.ApprovalForAll,
]

const TOPICS_721 = [
  ...TOPICS721.Transfer,
  ...TOPICS721.Approval,
  ...TOPICS721.ApprovalForAll
]

export type GetPoolGroupIdParameterType = {
  pair: string
  quoteTokenIndex: 0 | 1
  tokenR: string
}

export type SingleRouteToUSDReturnType = {
  quoteTokenIndex: number
  stablecoin: string
  address: string
}

export type GetPriceReturnType = {
  poolAddress: string
  twap: BigNumber
  spot: BigNumber
}

export type GetRDCReturnType = {
  supplyDetails: any
  rDetails: any
  R: BigNumber
  rC: BigNumber
  rDcLong: BigNumber
  rDcShort: BigNumber
}

export type CalcPoolInfoReturnType = {
  sides: any
  riskFactor: string
  deleverageRiskA: number
  deleverageRiskB: number
  interestRate: number
  maxPremiumRate: number
}

export type ParseMultiCallResponseReturnType = {
  tokens: Array<any>
  pools: any
}

export type CacheDDLogParameterType = {
  logs: any
  headBlock: number
  account: string
}

export type GetRentRateParameterType = {
  R: BigNumber
  rDcLong: BigNumber
  rDcShort: BigNumber
}

export type GetRentRateReturnType = {
  rentRateLong: BigNumber
  rentRateShort: BigNumber
}

export type LoadInitPoolDataReturnType = {
  tokens: Array<TokenType>
  pools: any
  poolGroups: any
}

const { AssistedJsonRpcProvider } = require('assisted-json-rpc-provider')
const MAX_BLOCK = 4294967295
export const Q128 = bn(1).shl(128)
export const M256 = bn(1).shl(256).sub(1)

const { A, B, C } = POOL_IDS

function numDiv(b: BigNumber, unit: number = 1): number {
  try {
    return b.toNumber() / unit
  } catch (err) {
    if (err.reason == 'overflow') {
      return Infinity
    }
    throw err
  }
}

type ResourceData = {
  pools: PoolsType
  tokens: Array<TokenType>
  swapLogs: Array<LogType>
  transferLogs: Array<LogType>
  bnaLogs: Array<LogType>
  poolGroups: any
  allLogs: Array<LogType>
}

type IPriceInfo = {
  [pool: string]: {
    twap: BigNumber
    spot: BigNumber
  }
}
export type Assets = {
  20: {
    balance: {
      [token: string]: BigNumber
    }
    allowance: {
      [tokenSpender: string]: BigNumber // key: token-spender
    }
  };
  721: {
    balance: {
      [tokenId: string]: BigNumber // key: token - id
    }
    allowanceALl: {
      [tokenSpender: string]: BigNumber, // key: token - spender
    },
    allowance: {
      [tokenSpenderId : string]: BigNumber  // key: token-spender-id
    }
  };
  1155: {
    balance: {
      [tokenId: string]: BigNumber // key: token-id
    }
    allowance: {
      [tokenSpender:string]: BigNumber // key: token - spender
    }
  };
};

export class Resource {
  poolGroups: PoolGroupsType = {}
  pools: PoolsType = {}
  tokens: Array<TokenType> = []
  swapLogs: Array<LogType> = []
  transferLogs: Array<LogType> = []
  bnaLogs: Array<LogType> = []
  unit: number = 1000000
  chainId: number
  scanApi?: any
  scanApiKey?: string
  account?: string
  storage?: Storage
  provider: JsonRpcProvider
  providerToGetLog: JsonRpcProvider
  overrideProvider: JsonRpcProvider
  UNIV3PAIR: UniV3Pair
  derivableAddress: IDerivableContractAddress
  profile: Profile
  stableCoins: Array<string>
  assets: Assets
  constructor(engineConfigs: IEngineConfig, profile: Profile) {
    this.chainId = engineConfigs.chainId
    this.scanApi = profile.configs.scanApi
    this.scanApiKey = engineConfigs.scanApiKey
    this.account = engineConfigs.account
    this.storage = engineConfigs.storage
    this.account = engineConfigs.account
    this.providerToGetLog = new JsonRpcProvider(profile.configs.rpcGetLog || profile.configs.rpc)
    this.provider = new JsonRpcProvider(profile.configs.rpc)
    this.UNIV3PAIR = new UniV3Pair(engineConfigs, profile)
    this.overrideProvider = new JsonRpcProvider(profile.configs.rpc)
    this.derivableAddress = profile.configs.derivable
    this.profile = profile
    this.stableCoins = profile.configs.stablecoins
  }

  async fetchResourceData(poolAddresses: Array<string>, account: string, playMode?: boolean) {
    const result: any = {}
    if (!this.chainId) return result
    await Promise.all([
      this.getResourceCached(account, playMode),
      this.getNewResource(account, playMode),
      this.getWhiteListResource(poolAddresses, playMode),
    ])
    // this.poolGroups = {...resultCached.poolGroups, ...newResource.poolGroups}b.v
    // this.pools = {...resultCached.pools, ...newResource.pools}
    // this.tokens = [...resultCached.tokens, ...newResource.tokens]
    // this.swapLogs = [...resultCached.swapLogs, ...newResource.swapLogs]
    // this.transferLogs = [...resultCached.transferLogs, ...newResource.transferLogs]
  }
  updateAssets({ updateAssets, account, logs }: { updateAssets?: Assets, account: string, logs: LogType[] }): Assets {
    if (!account) {
      throw new Error("missing account");
    }
  
    try {
      const assets: Assets = updateAssets || {
        20: { balance: {}, allowance: {} },
        721: { balance: {}, allowanceALl: {}, allowance: {} },
        1155: { balance: {}, allowance: {} }
      };
  
      const eventInterface = new ethers.utils.Interface(this.profile.getAbi('Events'));
      const event721Interface = new ethers.utils.Interface(this.profile.getAbi('Events721'));
  
      const parsedLogs = logs.map((log: any) => {
        if (log.address.toLowerCase() === '0xc36442b4a4522e871399cd717abdd847ab11fe88')
          console.log(log.address);
        try {
          const parsedLog = eventInterface.parseLog(log);
          return {
            ...log,
            ...parsedLog,
          };
        } catch (err) {
          try {
            const parsedLog = event721Interface.parseLog(log);
            return { ...log, ...parsedLog };
          } catch {
            return null;
          }
        }
      }).filter((log: any) => log != null);
  
      console.log(parsedLogs.length);
      for (const log of parsedLogs) {
        if (!log.args) {
          console.error("Unparsed log", log);
          continue;
        }
  
        const token = log.address;
  
        // ERC-20
        if (TOPICS_20.includes(log.topics[0])) {
          if (TOPICS.Transfer.includes(log.topics[0])) {
            const { from, to, value } = log.args;
            if (value) {
              if (!assets[20].balance[token]) {
                assets[20].balance[token] = BigNumber.from(0);
              }
  
              if (to === account) {
                assets[20].balance[token] = assets[20].balance[token].add(value);
              }
              if (from === account) {
                assets[20].balance[token] = assets[20].balance[token].sub(value);
              }
            }
          }
  
          if (TOPICS.Approval.includes(log.topics[0])) {
            const { owner, spender, value } = log.args;
            if (owner === account) {
              const allowanceKey = `${token}-${spender}`;
              assets[20].allowance[allowanceKey] = value;
            }
          }
        }
  
        // ERC-1155
        if (TOPICS_1155.includes(log.topics[0])) {
          if (TOPICS.TransferSingle.includes(log.topics[0])) {
            const { from, to, id: _id, value } = log.args;
            const id = _id.toString();
            const balanceKey = `${token}-${id}`;
  
            if (!assets[1155].balance[balanceKey]) {
              assets[1155].balance[balanceKey] = BigNumber.from(0);
            }
  
            if (to === account) {
              assets[1155].balance[balanceKey] = assets[1155].balance[balanceKey].add(value);
            }
            if (from === account) {
              assets[1155].balance[balanceKey] = assets[1155].balance[balanceKey].sub(value);
            }
          }
  
          if (TOPICS.TransferBatch.includes(log.topics[0])) {
            const { from, to, ids, values } = log.args;
            for (let i = 0; i < ids.length; ++i) {
              const id = ids[i].toString();
              const value = values[i];
              const balanceKey = `${token}-${id}`;
  
              if (!assets[1155].balance[balanceKey]) {
                assets[1155].balance[balanceKey] = BigNumber.from(0);
              }
  
              if (to === account) {
                assets[1155].balance[balanceKey] = assets[1155].balance[balanceKey].add(value);
              }
              if (from === account) {
                assets[1155].balance[balanceKey] = assets[1155].balance[balanceKey].sub(value);
              }
            }
          }
  
          if (TOPICS.ApprovalForAll.includes(log.topics[0])) {
            const { owner, operator, approved } = log.args;
            if (owner === account) {
              const allowanceKey = `${token}-${operator}`;
              assets[1155].allowance[allowanceKey] = approved ? BigNumber.from(ethers.constants.MaxInt256) : BigNumber.from(0);
            }
          }
        }
  
        // ERC-721
        if (TOPICS_721.includes(log.topics[0])) {
          if (TOPICS.Transfer.includes(log.topics[0]) && log.args?.tokenId) {
            const { from, to, tokenId } = log.args;
            const balanceKey = `${token}-${tokenId}`;
  
            if (to === account) {
              assets[721].balance[balanceKey] = BigNumber.from(1);
            }
            if (from === account) {
              delete assets[721].balance[balanceKey];
            }
          }
  
          if (TOPICS.Approval.includes(log.topics[0]) && log.args?.tokenId) {
            const { owner, spender, tokenId } = log.args;
            if (owner === account) {
              const allowanceKey = `${token}-${spender}-${tokenId}`;
              assets[721].allowance[allowanceKey] = BigNumber.from(1);
            }
          }
  
          if (TOPICS.ApprovalForAll.includes(log.topics[0])) {
            const { owner, operator, approved } = log.args;
            if (owner === account) {
              const allowanceAllKey = `${token}-${operator}`;
              assets[721].allowanceALl[allowanceAllKey] = approved ? BigNumber.from(ethers.constants.MaxInt256) : BigNumber.from(0);
            }
          }
        }
      }
  
      return assets;
    } catch (error) {
      throw error;
    }
  }
  


  getLastBlockCached(account?: string): number {
    if (!this.storage || !this.storage.getItem || !account) return 0
    const lastBlockCached = this.storage.getItem(`${this.chainId}-${LOCALSTORAGE_KEY.ACCOUNT_BLOCK_LOGS}-${account}`)
    return Number(lastBlockCached) ?? 0
  }

  cacheDdlLog({ logs, headBlock, account }: CacheDDLogParameterType) {
    if (!this.storage || !this.storage.getItem || !this.storage.setItem || !account) return
    const key = `${this.chainId}-${LOCALSTORAGE_KEY.ACCOUNT_LOGS}-${account}`
    const blockKey = `${this.chainId}-${LOCALSTORAGE_KEY.ACCOUNT_BLOCK_LOGS}-${account}`

    const cachedogs = JSON.parse(this.storage.getItem(key) || '[]')
    const newCacheSwapLogs = mergeTwoUniqSortedLogs(cachedogs, logs)
    this.storage.setItem(blockKey, headBlock.toString())
    this.storage.setItem(key, JSON.stringify(newCacheSwapLogs))
  }

  getCachedLogs(account: string): Array<LogType> {
    if (!this.storage || !this.storage.getItem || !this.storage.setItem || !account) {
      return []
    }
    const key = `${this.chainId}-${LOCALSTORAGE_KEY.ACCOUNT_LOGS}-${account}`
    const data = this.storage.getItem(key) ?? '[]'
    return JSON.parse(data) as Array<LogType>
  }

  async getWhiteListResource(poolAddresses: Array<string>, playMode?: boolean): Promise<LoadInitPoolDataReturnType> {
    try {
      const results = await this.generateData({
        poolAddresses: [...poolAddresses, ...this.profile.whitelistPools],
        transferLogs: [],
        playMode,
      })
      this.tokens = uniqBy([...this.tokens, ...this._whitelistTokens()], 'address')
      return {
        ...results,
        tokens: [...results.tokens, ...this._whitelistTokens()],
      }
    } catch (error) {
      throw error
    }
  }

  async getResourceCached(account: string, playMode?: boolean): Promise<ResourceData> {
    try {
      const results: ResourceData = {
        pools: {},
        tokens: [],
        swapLogs: [],
        transferLogs: [],
        bnaLogs: [],
        poolGroups: {},
        allLogs: [],
      }

      if (!this.storage || !this.storage.getItem) return results
      const logs = this.getCachedLogs(account)
      const accountLogs = this.parseDdlLogs(
        logs.filter(
          (data: { topics: Array<string> }) => concat(...Object.values(TOPICS)).includes(data.topics[0]),
        ),
      )

      results.swapLogs = accountLogs.filter((log: any) => {
        return log.address && TOPICS.Swap.includes(log.topics[0])
      })
      results.transferLogs = accountLogs.filter((log: any) => {
        return log.address && TOPICS.Transfer.includes(log.topics[0])
      })

      results.bnaLogs = this.parseDdlLogs(
        logs.filter((log: LogType) => {
          const eventSig = log.topics[0]
          if (TOPICS_20.includes(eventSig)) {
            return true
          }
          if (log.address != this.profile.configs.derivable.token) {
            return false
          }
          if (log.blockNumber < this.profile.configs.derivable.startBlock) {
            return false
          }
          return TOPICS_1155.includes(eventSig)
        })
      )

      const ddlTokenTransferLogs = accountLogs.filter((log: any) => {
        return (
          log.address === this.profile.configs.derivable.token &&
          log.blockNumber >= this.profile.configs.derivable.startBlock &&
          (TOPICS.TransferSingle.includes(log.topics[0]) || TOPICS.TransferBatch.includes(log.topics[0]))
        )
      })

      const poolAddresses = this.poolHasOpeningPosition(ddlTokenTransferLogs)

      // if (ddlLogsParsed && ddlLogsParsed.length > 0) {
      //   const {tokens, pools, poolGroups} = await this.generatePoolData(ddlLogsParsed, transferLogsParsed, playMode)
      //   results.tokens = [...tokens, ...results.tokens]
      //   results.pools = pools
      //   results.poolGroups = poolGroups
      // }
      // if (swapLogsParsed && swapLogsParsed.length > 0) {
      //   results.swapLogs = swapLogsParsed
      // }
      // if (transferLogsParsed && transferLogsParsed.length > 0) {
      //   results.transferLogs = transferLogsParsed
      // }

      // this.poolGroups = {...this.poolGroups, ...results.poolGroups}
      // this.pools = {...this.pools, ...results.pools}
      // this.tokens = [...this.tokens, ...results.tokens]
      // this.swapLogs = [...this.swapLogs, ...results.swapLogs]
      // this.transferLogs = [...this.transferLogs, ...results.transferLogs]

      // return results

      if (poolAddresses.length > 0) {
        const { tokens, pools, poolGroups } = await this.generateData({
          poolAddresses,
          transferLogs: results.transferLogs,
          playMode,
        })
        results.tokens = tokens
        results.pools = pools
        results.poolGroups = poolGroups
      }

      this.swapLogs = mergeTwoUniqSortedLogs(this.swapLogs, results.swapLogs)
      this.transferLogs = mergeTwoUniqSortedLogs(this.transferLogs, results.transferLogs)
      this.bnaLogs = mergeTwoUniqSortedLogs(this.bnaLogs, results.bnaLogs)

      return results
    } catch (error) {
      throw error
    }
  }

  async getNewResource(account: string, playMode?: boolean): Promise<ResourceData> {
    try {
      // TODO: move this part to constructor
      const etherscanConfig =
        typeof this.scanApi === 'string'
          ? {
              url: this.scanApi,
              maxResults: 1000,
              rangeThreshold: 0,
              rateLimitCount: 1,
              rateLimitDuration: 5000,
              apiKeys: this.scanApiKey ? this.scanApiKey.split(',') : [],
            }
          : this.scanApi

      const provider = new AssistedJsonRpcProvider(this.providerToGetLog, etherscanConfig)
      const lastHeadBlockCached = this.getLastBlockCached(account) + 1
      const accTopic = account ? hexZeroPad(account, 32) : null

      const filterTopics = [
        [null, null, null, null],
        [null, accTopic, null, null],
        [null, null, accTopic, null],
        [null, null, null, accTopic],
      ]

      // TODO: await and then...catch review
      return await provider
        .getLogs({
          fromBlock: lastHeadBlockCached,
          toBlock: MAX_BLOCK, // ganache or hardhat network need this
          topics: filterTopics,
        })
        .then((logs: Array<LogType>) => {
          if (!logs?.length) {
            return [[], [], []]
          }
          const headBlock = logs[logs.length - 1]?.blockNumber
          const swapLogs = logs.filter((log: any) => {
            return log.address && TOPICS.Swap.includes(log.topics[0])
          })
          const transferLogs = logs.filter((log: any) => {
            return log.address && TOPICS.Transfer.includes(log.topics[0])
          })

          const ddlTokenTransferLogs = logs.filter((log: any) => {
            return (
              log.address === this.profile.configs.derivable.token &&
              log.blockNumber >= this.profile.configs.derivable.startBlock &&
              (TOPICS.TransferSingle.includes(log.topics[0]) || TOPICS.TransferBatch.includes(log.topics[0]))
            )
          })

          const bnaLogs = logs.filter((log: LogType) => {
            const eventSig = log.topics[0]
            if (TOPICS_20.includes(eventSig)) {
              return true
            }
            if (log.address != this.profile.configs.derivable.token) {
              return false
            }
            if (log.blockNumber < this.profile.configs.derivable.startBlock) {
              return false
            }
            return TOPICS_1155.includes(eventSig)
          })

          this.cacheDdlLog({
            logs,
            // transferLogs,
            headBlock,
            account,
          })
          return [
            this.parseDdlLogs(swapLogs),
            this.parseDdlLogs(ddlTokenTransferLogs),
            this.parseDdlLogs(transferLogs),
            this.parseDdlLogs(bnaLogs),
            logs,
          ]
        })
        .then(async ([swapLogs, ddlTokenTransferLogs, transferLogs, bnaLogs, allLogs]: Array<Array<LogType>>) => {
          const result: ResourceData = {
            pools: {},
            tokens: [],
            swapLogs: [],
            transferLogs: [],
            bnaLogs: [],
            poolGroups: {},
            allLogs,
          }

          if (swapLogs && swapLogs.length > 0) {
            result.swapLogs = swapLogs
          }
          if (transferLogs && transferLogs.length > 0) {
            result.transferLogs = transferLogs
          }
          if (bnaLogs?.length) {
            result.bnaLogs = bnaLogs
          }
          if(allLogs?.length){
            result.allLogs = allLogs
          }
          const poolAddresses = this.poolHasOpeningPosition(ddlTokenTransferLogs)

          if (poolAddresses && poolAddresses.length > 0) {
            const { tokens, pools, poolGroups } = await this.generateData({
              poolAddresses,
              transferLogs,
              playMode,
            })
            result.tokens = tokens
            result.pools = pools
            result.poolGroups = poolGroups
          }

          // this.pools = {...result.pools, ...this.pools}
          // this.poolGroups = {...this.poolGroups, ...result.poolGroups}
          // this.pools = {...this.pools, ...result.pools}
          // this.tokens = [...this.tokens, ...result.tokens]
          this.swapLogs = mergeTwoUniqSortedLogs(this.swapLogs, result.swapLogs)
          this.transferLogs = mergeTwoUniqSortedLogs(this.transferLogs, result.transferLogs)
          this.bnaLogs = mergeTwoUniqSortedLogs(this.bnaLogs, result.bnaLogs)

          return result
        })
        .catch((e: any) => {
          console.error(e)
          return { pools: {}, tokens: [], swapLogs: [], transferLogs: [], allLogs: [] }
        })
    } catch (error) {
      throw error
    }
  }

  /**
   * parse DDL logs
   * @param poolAddresses
   * @param transferLogs
   * @param playMode
   */
  generateData({
    poolAddresses,
    transferLogs,
    playMode,
  }: {
    poolAddresses: Array<string>
    transferLogs: Array<LogType>
    playMode?: boolean
  }): Promise<LoadInitPoolDataReturnType> {
    try {
      const allTokens: Array<string> = [...this._tokenInRoutes()]
      // logs.forEach((log) => {
      //   if (log.name === 'PoolCreated') {
      //     const data = log.args
      //     if (!!playMode != (data.TOKEN_R == this.profile.configs.derivable.playToken)) {
      //       return
      //     }
      //     const powers = [log.args.k.toNumber(), -log.args.k.toNumber()]
      //     const pair = ethers.utils.getAddress('0x' + data.ORACLE.slice(-40))
      //     const quoteTokenIndex = bn(data.ORACLE.slice(0, 3)).gt(0) ? 1 : 0
      //     const window = bn('0x' + data.ORACLE.substring(2 + 8, 2 + 8 + 8))
      //
      //     if (this.profile.configs.fetchers[data.FETCHER] == null) {
      //       return
      //     }
      //
      //     data.dTokens = powers.map((value, key) => {
      //       return {power: value, index: key}
      //     })
      //
      //     data.dTokens = (data.dTokens as {
      //       index: number;
      //       power: number
      //     }[]).map((data) => `${log.address}-${data.index}`)
      //
      //     poolData[log.address] = {
      //       ...data,
      //       poolAddress: log.address,
      //       powers,
      //       cToken: data.TOKEN_R,
      //       pair,
      //       window,
      //       quoteTokenIndex,
      //       exp: this.profile.getExp(data),
      //     }
      //
      //     allUniPools.push(pair)
      //     allTokens.push(data.TOKEN_R)
      //   }
      // })

      transferLogs.forEach((log) => {
        allTokens.push(log.address)
      })

      allTokens.push(...this.stableCoins)

      return this.loadInitPoolsData(allTokens, poolAddresses, playMode)
    } catch (error) {
      throw error
    }
  }

  /**
   * load Token detail, poolstate data and then dispatch to Store
   */
  async loadInitPoolsData(
    listTokens: Array<string>,
    poolAddresses?: Array<string>,
    playMode?: boolean,
  ): Promise<LoadInitPoolDataReturnType> {
    try {
      const multicall = new Multicall({
        multicallCustomContractAddress: this.profile.configs.helperContract.multiCall,
        ethersProvider: this.getPoolOverridedProvider(),
        tryAggregate: true,
      })
      const normalTokens = _.uniq(getNormalAddress(listTokens))

      const context: Array<ContractCallContext> = this.getMultiCallRequest(normalTokens, poolAddresses || [])
      const [{ results }] = await Promise.all([multicall.call(context)])

      const { tokens: tokensArr, pools } = this.parseMultiCallResponse(results, poolAddresses || [])

      for (const poolAddress in pools) {
        if (!!playMode != (pools[poolAddress].TOKEN_R == this.profile.configs.derivable.playToken)) {
          delete pools[poolAddress]
        }
      }

      const uniPools = Object.values(pools).map((p: { pair: string }) => p.pair)
      const pairsInfo = await this.UNIV3PAIR.getPairsInfo({
        pairAddresses: _.uniq(uniPools),
      })
      const tokens: Array<TokenType> = []
      for (let i = 0; i < tokensArr.length; i++) {
        // remove token has decimals = 0
        if (!tokensArr[i][2]) continue
        tokens.push({
          symbol: tokensArr[i][0],
          name: tokensArr[i][1],
          decimals: tokensArr[i][2],
          totalSupply: tokensArr[i][3],
          address: normalTokens[i],
        })
      }

      const poolGroups: any = {}

      for (const i in pools) {
        // if (!poolsState[i]) {
        //   delete pools[i]
        //   continue
        // }
        // pools[i].states = poolsState[i]
        pools[i] = {
          ...pools[i],
          ...this.calcPoolInfo(pools[i]),
        }

        const { MARK: _MARK, ORACLE, k: _k } = pools[i]

        const quoteTokenIndex = bn(ORACLE.slice(0, 3)).gt(0) ? 1 : 0
        const pair = ethers.utils.getAddress(`0x${ORACLE.slice(-40)}`)

        const baseToken = quoteTokenIndex === 0 ? pairsInfo[pair].token1 : pairsInfo[pair].token0
        const quoteToken = quoteTokenIndex === 0 ? pairsInfo[pair].token0 : pairsInfo[pair].token1

        const tokenR = tokens.find((t) => t.address === pools[i].TOKEN_R)

        pools[i].baseToken = baseToken.address
        pools[i].quoteToken = quoteToken.address

        const k = _k.toNumber()
        const id = this.getPoolGroupId({ pair, quoteTokenIndex, tokenR: pools[i].TOKEN_R })
        if (poolGroups[id]) {
          poolGroups[id].pools[i] = pools[i]
        } else {
          poolGroups[id] = { pools: { [i]: pools[i] } }
          // poolGroups[id].UTR = pools[i].UTR
          poolGroups[id].pair = pairsInfo[pair]
          poolGroups[id].quoteTokenIndex = quoteTokenIndex
          poolGroups[id].baseToken = pools[i].baseToken
          poolGroups[id].quoteToken = pools[i].quoteToken
          // poolGroups[id].TOKEN = pools[i].TOKEN
          // poolGroups[id].MARK = pools[i].MARK
          // poolGroups[id].INIT_TIME = pools[i].INIT_TIME
          // poolGroups[id].HALF_LIFE = pools[i].HALF_LIFE
          poolGroups[id].ORACLE = pools[i].ORACLE
          poolGroups[id].TOKEN_R = pools[i].TOKEN_R
          // poolGroups[id].states = {
          //   twapBase: poolsState[i].twap,
          //   spotBase: poolsState[i].spot,
          //   ...poolsState[i],
          // }
          poolGroups[id].basePrice = parsePrice(pools[i].states.spot, baseToken, quoteToken, pools[i])
        }

        const rdc = this.getRdc(Object.values(poolGroups[id].pools))
        poolGroups[id].states = {
          ...poolGroups[id].states,
          ...rdc,
        }

        if (poolGroups[id].powers) {
          poolGroups[id].k.push(pools[i].k.toNumber())
          poolGroups[id].powers.push(pools[i].powers[0], pools[i].powers[1])
        } else {
          poolGroups[id].k = [pools[i].k.toNumber()]
          poolGroups[id].powers = [...pools[i].powers]
        }
        if (poolGroups[id].dTokens) {
          poolGroups[id].dTokens.push(pools[i].poolAddress + '-' + POOL_IDS.A, pools[i].poolAddress + '-' + POOL_IDS.B)
        } else {
          poolGroups[id].dTokens = [pools[i].poolAddress + '-' + POOL_IDS.A, pools[i].poolAddress + '-' + POOL_IDS.B]
        }
        if (poolGroups[id].allTokens) {
          poolGroups[id].allTokens.push(
            pools[i].poolAddress + '-' + POOL_IDS.A,
            pools[i].poolAddress + '-' + POOL_IDS.B,
            pools[i].poolAddress + '-' + POOL_IDS.C,
          )
        } else {
          poolGroups[id].allTokens = [
            `${pools[i].poolAddress}-${POOL_IDS.A}`,
            `${pools[i].poolAddress}-${POOL_IDS.B}`,
            `${pools[i].poolAddress}-${POOL_IDS.C}`,
          ]
        }

        tokens.push(
          {
            symbol: `${baseToken.symbol}^${1 + k / 2}`,
            name: `${baseToken.symbol}^${1 + k / 2}`,
            decimals: tokenR?.decimals || 18,
            totalSupply: 0,
            address: `${pools[i].poolAddress}-${POOL_IDS.A}`,
          },
          {
            symbol: `${baseToken.symbol}^${1 - k / 2}`,
            name: `${baseToken.symbol}^${1 - k / 2}`,
            decimals: tokenR?.decimals || 18,
            totalSupply: 0,
            address: `${pools[i].poolAddress}-${POOL_IDS.B}`,
          },
          {
            symbol: `DLP-${baseToken.symbol}-${k / 2}`,
            name: `DLP-${baseToken.symbol}-${k / 2}`,
            decimals: tokenR?.decimals || 18,
            totalSupply: 0,
            address: `${pools[i].poolAddress}-${POOL_IDS.C}`,
          },
          baseToken,
          quoteToken,
        )
      }

      this.poolGroups = { ...this.poolGroups, ...poolGroups }
      this.pools = { ...this.pools, ...pools }
      this.tokens = _.uniqBy([...this.tokens, ...tokens], 'address')

      return {
        tokens: _.uniqBy(tokens, 'address'),
        pools,
        poolGroups,
      }
    } catch (error) {
      throw error
    }
  }

  async searchIndex(keyword: string): Promise<any> {
    try {
      const etherscanConfig =
        typeof this.scanApi === 'string'
          ? {
              url: this.scanApi,
              maxResults: 1000,
              rangeThreshold: 0,
              rateLimitCount: 1,
              rateLimitDuration: 5000,
              apiKeys: this.scanApiKey ? this.scanApiKey.split(',') : [],
            }
          : this.scanApi

      const provider = new AssistedJsonRpcProvider(this.providerToGetLog, etherscanConfig)
      const fromBlock = this.profile.configs.derivable.startBlock

      let topics
      if (keyword.length == 42 && keyword.startsWith('0x')) {
        const topic = ethers.utils.hexZeroPad(keyword, 32)
        topics = [topic]
      } else {
        const topic = ethers.utils.formatBytes32String(keyword?.toUpperCase() ?? '')
        topics = [
          [null, null, null, null],
          [null, topic, null, null],
          [null, null, topic, null],
          [null, null, null, topic],
        ]
      }
      // TODO: await and then...catch review
      const poolGroups = await provider
        .getLogs({
          fromBlock,
          toBlock: MAX_BLOCK,
          topics,
          address: this.profile.configs.derivable.poolDeployer,
        })
        .then((logs: Array<LogType>) => {
          const _poolGroups: any = {}
          logs.forEach((log) => {
            const decodedData = defaultAbiCoder.decode(this.profile.getEventDataAbi().PoolCreated, log.data)
            const pair = ethers.utils.getAddress(`0x${decodedData.ORACLE.slice(-40)}`)
            const quoteTokenIndex = bn(decodedData.ORACLE.slice(0, 3)).gt(0) ? 1 : 0
            const id = this.getPoolGroupId({ pair, quoteTokenIndex, tokenR: decodedData.TOKEN_R })
            const pool = {
              ...decodedData,
              exp: this.profile.getExp(decodedData.FETCHER),
              blockNumber: log.blockNumber,
              timeStamp: log.timeStamp,
            }
            if (_poolGroups[id]?.pools) {
              _poolGroups[id].pools.push(pool)
            } else {
              _poolGroups[id] = {
                pools: [pool],
                pairAddress: pair,
                exp: pool.exp,
              }
            }
          })
          return _poolGroups
        })
      const pairAddresses = Object.values(poolGroups).map((pg: { pairAddress: string }) => pg.pairAddress)
      const pairsInfo = await this.UNIV3PAIR.getPairsInfo({ pairAddresses: pairAddresses })
      for (const id in poolGroups) {
        poolGroups[id].pairInfo = pairsInfo[poolGroups[id].pairAddress]
      }
      return poolGroups
    } catch (error) {
      throw error
    }
  }

  async loadPoolStates(poolAddress: string): Promise<any> {
    try {
      const pool = this.pools[poolAddress]
      const pairsInfo = await this.UNIV3PAIR.getPairsInfo({
        pairAddresses: [pool.pair],
      })
      const pricesInfo = await this.getPrices({ [poolAddress]: pool }, pairsInfo)
      const contract = new Contract(poolAddress, this.profile.getAbi('View').abi, this.getPoolOverridedProvider())
      const states = await contract.callStatic.compute(
        this.derivableAddress.token,
        5,
        pricesInfo[poolAddress]?.twap || bn(0),
        pricesInfo[poolAddress]?.spot || bn(0),
      )
      this.pools[poolAddress].states = states
      const baseToken = this.tokens.find((token) => token.address === pool.baseToken)
      const quoteToken = this.tokens.find((token) => token.address === pool.quoteToken)
      this.poolGroups[pool.pair].basePrice = parsePrice(states.spot, baseToken, quoteToken, pool)
      this.poolGroups[pool.pair].pools = {
        ...this.poolGroups[pool.pair].pools,
        [poolAddress]: pool,
      }
      const rdc = this.getRdc(Object.values(this.poolGroups[pool.pair].pools))
      this.poolGroups[pool.pair].states = {
        ...states,
        ...rdc,
      }

      return [this.poolGroups, this.pools]
    } catch (error) {
      throw error
    }
  }

  getRentRate({ rDcLong, rDcShort, R }: GetRentRateParameterType, rentRate: BigNumber): GetRentRateReturnType {
    try {
      const diff = bn(rDcLong).sub(rDcShort).abs()
      const rate = R.isZero() ? bn(0) : diff.mul(rentRate).div(R)
      return {
        rentRateLong: rDcLong.add(rDcShort).isZero() ? bn(0) : rate.mul(rDcLong).div(rDcLong.add(rDcShort)),
        rentRateShort: rDcLong.add(rDcShort).isZero() ? bn(0) : rate.mul(rDcShort).div(rDcLong.add(rDcShort)),
      }
    } catch (error) {
      throw error
    }
  }

  getPoolOverridedProvider(): JsonRpcProvider {
    try {
      const stateOverride: any = {}
      // poolAddresses.forEach((address: string) => {
      stateOverride[this.derivableAddress.logic as string] = {
        code: this.profile.getAbi('View').deployedBytecode,
      }
      if (this.derivableAddress.uniswapV2Fetcher) {
        stateOverride[this.derivableAddress.uniswapV2Fetcher as string] = {
          code: this.profile.getAbi('FetcherV2Override').deployedBytecode,
        }
      }

      this.overrideProvider.setStateOverride({
        ...stateOverride,
        [`0x${this.profile.getAbi('TokensInfo').deployedBytecode.slice(-40)}` as string]: {
          code: this.profile.getAbi('TokensInfo').deployedBytecode,
        },
      })
      return this.overrideProvider
    } catch (error) {
      throw error
    }
  }

  /**
   * get Multicall Request to get List token and poolState data in 1 request to RPC
   */
  getMultiCallRequest(normalTokens: Array<string>, poolAddresses: Array<string>): Array<any> {
    try {
      const request: any = [
        {
          reference: 'tokens',
          contractAddress: `0x${this.profile.getAbi('TokensInfo').deployedBytecode.slice(-40)}`,
          abi: this.profile.getAbi('TokensInfo').abi,
          calls: [
            {
              reference: 'tokenInfos',
              methodName: 'getTokenInfo',
              methodParameters: [normalTokens],
            },
          ],
        },
      ]
      const poolOverrideAbi = this.profile.getAbi('View').abi
      poolAddresses.forEach((poolAddress) => {
        request.push({
          decoded: true,
          reference: `pools-${poolAddress}`,
          contractAddress: poolAddress,
          abi: poolOverrideAbi,
          calls: [
            {
              reference: 'loadConfig',
              methodName: 'loadConfig',
              methodParameters: [],
            },
            {
              reference: 'compute',
              methodName: 'compute',
              methodParameters: [
                this.derivableAddress.token,
                5,
                bn(0),
                bn(0),
                // pricesInfo[listPools[i].poolAddress]?.twap || bn(0),
                // pricesInfo[listPools[i].poolAddress]?.spot || bn(0),
              ],
            },
          ],
        })
      })

      return request
    } catch (error) {
      throw error
    }
  }

  parseMultiCallResponse(multiCallData: any, poolAddresses: Array<string>): ParseMultiCallResponseReturnType {
    try {
      const pools: any = {}
      const tokens = multiCallData.tokens.callsReturnContext[0].returnValues
      const poolOverrideAbi = this.profile.getAbi('View').abi
      poolAddresses.forEach((poolAddress) => {
        try {
          const abiInterface = new ethers.utils.Interface(poolOverrideAbi)
          const poolStateData = multiCallData['pools-' + poolAddress].callsReturnContext
          const configEncodeData = abiInterface.encodeFunctionResult('loadConfig', [
            formatMultiCallBignumber(poolStateData[0].returnValues),
          ])
          const stateEncodeData = abiInterface.encodeFunctionResult('compute', [formatMultiCallBignumber(poolStateData[1].returnValues)])
          const stateData = abiInterface.decodeFunctionResult('compute', stateEncodeData)
          const configData = abiInterface.decodeFunctionResult('loadConfig', configEncodeData)

          pools[poolAddress] = {
            ...configData.config,
            poolAddress,
            k: configData.config.K,
            powers: [configData.config.K.toNumber(), -configData.config.K.toNumber()],
            quoteTokenIndex: bn(configData.config.ORACLE.slice(0, 3)).gt(0) ? 1 : 0,
            window: bn('0x' + configData.config.ORACLE.substring(2 + 8, 2 + 8 + 8)),
            pair: ethers.utils.getAddress('0x' + configData.config.ORACLE.slice(-40)),
            exp: this.profile.getExp(configData.config.FETCHER),
            states: {
              ...stateData.stateView,
              ...stateData.stateView.state,
            },
          }
        } catch (e) {
          console.error('Cannot get states of: ', poolAddress)
          console.error(e)
        }
      })

      return { tokens, pools }
    } catch (error) {
      throw error
    }
  }

  calcPoolInfo(pool: PoolType): CalcPoolInfoReturnType {
    try {
      const { MARK, states, FETCHER } = pool
      const { R, rA, rB, rC, a, b, spot } = states
      const exp = this.profile.getExp(FETCHER)
      const riskFactor = rC.gt(0) ? div(rA.sub(rB), rC) : '0'
      const deleverageRiskA = R.isZero()
        ? 0
        : rA
            .mul(2 * this.unit)
            .div(R)
            .toNumber() / this.unit
      const deleverageRiskB = R.isZero()
        ? 0
        : rB
            .mul(2 * this.unit)
            .div(R)
            .toNumber() / this.unit
      const k = pool.k.toNumber()
      const power = k / exp
      const sides = {
        [A]: {} as any,
        [B]: {} as any,
        [C]: {} as any,
      }
      sides[A].k = Math.min(k, kx(k, R, a, spot, MARK))
      sides[B].k = Math.min(k, kx(-k, R, b, spot, MARK))
      sides[C].k = numDiv(
        rA
          .mul(Math.round(sides[A].k * this.unit))
          .add(rB.mul(Math.round(sides[B].k * this.unit)))
          .div(rA.add(rB)),
        this.unit,
      )

      const interestRate = rateFromHL(pool.INTEREST_HL.toNumber(), power)
      const maxPremiumRate = rateFromHL(pool.PREMIUM_HL.toNumber(), power)
      if (maxPremiumRate > 0) {
        if (rA.gt(rB)) {
          const rDiff = rA.sub(rB)
          const givingRate = rDiff.mul(Math.round(this.unit * maxPremiumRate)).mul(rA.add(rB)).div(R)
          sides[A].premium = numDiv(givingRate.div(rA), this.unit)
          sides[B].premium = -numDiv(givingRate.div(rB), this.unit)
          sides[C].premium = 0
        } else if (rB.gt(rA)) {
          const rDiff = rB.sub(rA)
          const givingRate = rDiff.mul(Math.round(this.unit * maxPremiumRate)).mul(rA.add(rB)).div(R)
          sides[B].premium = numDiv(givingRate.div(rB), this.unit)
          sides[A].premium = -numDiv(givingRate.div(rA), this.unit)
          sides[C].premium = 0
        } else {
          sides[A].premium = 0
          sides[B].premium = 0
          sides[C].premium = 0
        }
      }

      // decompound the interest
      for (const side of [A, B]) {
        sides[side].interest = (interestRate * k) / sides[side].k
      }
      sides[C].interest = numDiv(
        rA
          .add(rB)
          .mul(Math.round(this.unit * interestRate))
          .div(rC),
        this.unit,
      )

      return {
        sides,
        riskFactor,
        deleverageRiskA,
        deleverageRiskB,
        interestRate,
        maxPremiumRate,
      }
    } catch (error) {
      throw error
    }
  }

  getRdc(pools: any): GetRDCReturnType {
    try {
      let rC = bn(0)
      let rDcLong = bn(0)
      let rDcShort = bn(0)
      const supplyDetails: any = {}
      const rDetails: any = {}
      for (const pool of pools) {
        rC = pool.states.rC
        rDcLong = pool.states.rA
        rDcShort = pool.states.rB
        rDetails[pool.k.toNumber()] = pool.states.rA
        rDetails[-pool.k.toNumber()] = pool.states.rB

        supplyDetails[pool.k.toNumber()] = pool.states.sA
        supplyDetails[-pool.k.toNumber()] = pool.states.sB
      }
      return {
        supplyDetails,
        rDetails,
        R: rC.add(rDcLong).add(rDcShort),
        rC,
        rDcLong,
        rDcShort,
      }
    } catch (error) {
      throw error
    }
  }

  parseDdlLogs(ddlLogs: any): Array<LogType> {
    const eventInterface = new ethers.utils.Interface(this.profile.getAbi('Events'))
    return ddlLogs.map((log: any) => {
      try {
        const parsedLog = eventInterface.parseLog(log)
        return {
          ...log,
          ...parsedLog,
        }
      } catch (err) {
        console.warn('Failed to parse log', err, log)
      }
      return undefined
    }).filter((log: any) => log != null)
  }

  _tokenInRoutes(): Array<string> {
    try {
      return Object.keys(this.profile.routes).reduce((results, pair) => {
        return [...results, ...pair.split('-')]
      }, [] as Array<string>)
    } catch (error) {
      throw error
    }
  }

  _whitelistTokens(): Array<TokenType> {
    try {
      const result = []
      const tokens = this.profile.configs.tokens
      for (const address in tokens) {
        result.push({
          address,
          logo: tokens[address].logo,
          name: tokens[address].name,
          symbol: tokens[address].symbol,
          decimals: tokens[address].decimals,
        })
      }
      return result
    } catch (error) {
      throw error
    }
  }

  async getPrices(pools: { [key: string]: PoolType }, pairs: IPairsInfo): Promise<IPriceInfo> {
    try {
      const blockNumber = await this.overrideProvider.getBlockNumber()

      const result: any = {}
      const res = await Promise.all(
        Object.values(pools)
          .filter((pool) => pool.exp == 1)
          .map((pool) => {
            return this.getPrice(pool, blockNumber, pairs[pool.pair])
          }),
      )
      res.forEach((priceInfo) => {
        result[priceInfo.poolAddress] = { spot: priceInfo.spot, twap: priceInfo.twap }
      })
      return result
    } catch (error) {
      throw error
    }
  }

  async getPrice(pool: PoolType, blockNumber: number, pair: IPairInfo): Promise<GetPriceReturnType> {
    try {
      const getStorageAt = OracleSdkAdapter.getStorageAtFactory(this.overrideProvider)
      const getBlockByNumber = OracleSdkAdapter.getBlockByNumberFactory(this.overrideProvider)

      const twap = await OracleSdk.getPrice(
        getStorageAt,
        getBlockByNumber,
        pool.pair,
        pool.quoteTokenIndex,
        blockNumber - (pool.window.toNumber() >> 1),
      )

      let spot
      const [r0, r1] = [pair.token0.reserve, pair.token1.reserve]
      spot = pool.quoteTokenIndex == 0 ? r0.shl(128).div(r1) : r1.shl(128).div(r0)

      return {
        poolAddress: pool.poolAddress,
        twap: twap.shl(16),
        spot: twap.eq(0) ? bn(0) : spot,
      }
    } catch (error) {
      throw error
    }
  }

  getIndexR(tokenR: string): BigNumber {
    try {
      const { quoteTokenIndex, address } = this.getSingleRouteToUSD(tokenR) ?? {}
      if (!address) {
        return bn(0)
      }
      return bn(ethers.utils.hexZeroPad(bn(quoteTokenIndex).shl(255).add(address).toHexString(), 32))
    } catch (error) {
      throw error
    }
  }

  getSingleRouteToUSD(token: string, types: Array<string> = ['uniswap3']): SingleRouteToUSDReturnType | undefined {
    try {
      const {
        routes,
        configs: { stablecoins },
      } = this.profile
      for (const stablecoin of stablecoins) {
        for (const asSecond of [false, true]) {
          const key = asSecond ? `${stablecoin}-${token}` : `${token}-${stablecoin}`
          const route = routes[key]
          if (route?.length != 1) {
            continue
          }
          const { type, address } = route[0]
          if (!types.includes(type)) {
            continue
          }
          const quoteTokenIndex = token.localeCompare(stablecoin, undefined, { sensitivity: 'accent' }) < 0 ? 1 : 0
          return {
            quoteTokenIndex,
            stablecoin,
            address,
          }
        }
      }
      return undefined
    } catch (error) {
      throw error
    }
  }

  poolHasOpeningPosition(tokenTransferLogs: Array<LogType>): Array<string> {
    const balances: { [id: string]: BigNumber } = {}
    tokenTransferLogs.forEach((log) => {
      if (log.blockNumber < this.profile.configs.derivable.startBlock) {
        return
      }
      const { from, to } = log.args
      const isBatch = !log.args.id
      const ids = isBatch ? log.args.ids : [log.args.id]
      // TODO: where is log.args.values?
      const values = isBatch ? log.args['4'] : [log.args.value]
      for (let i = 0; i < ids.length; ++i) {
        const value = values[i]
        const id = ids[i].toString()
        if (from == this.account) {
          balances[id] = balances[id] ? balances[id].sub(value) : bn(0).sub(value)
          if (balances[id].isZero()) delete balances[id]
        } else if (to == this.account) {
          balances[id] = balances[id] ? balances[id].add(value) : value
        }
      }
    })

    // unpack id to get Pool address
    return _.uniq(Object.keys(balances).map((id) => unpackId(bn(id)).p))
  }

  getPoolGroupId({ pair, quoteTokenIndex, tokenR }: GetPoolGroupIdParameterType): string {
    try {
      return [pair, quoteTokenIndex, tokenR].join('-')
    } catch (error) {
      throw error
    }
  }
}
