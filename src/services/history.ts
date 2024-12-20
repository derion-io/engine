import { BigNumber, ethers } from 'ethers'
import { LogType, TokenType } from '../types'
import { NATIVE_ADDRESS, POOL_IDS } from '../utils/constant'
import { BIG, IEW, WEI, bn, getTopics, numberToWei, parsePrice, weiToNumber } from '../utils/helper'
import { Profile } from '../profile'
import { IEngineConfig } from '../utils/configs'
import { M256, Resource } from './resource'
import Erc20 from '../abi/ERC20.json'
import { defaultAbiCoder, getAddress, hexDataSlice, Result } from 'ethers/lib/utils'

const POS_IDS = [POOL_IDS.A, POOL_IDS.B, POOL_IDS.C]

const TOPICS: { [topic0: string]: string } = {
  ['0xba5c330f8eb505cee9b4eb08fecf34234a327cfb6f9e480f9d3b4dfae5b23e4d']: 'Position',       // Derion Pool
  ['0xf7462f2a86b97b14a4669ae97bf107eb47f1574e511038ba3bb2c0cace5bb227']: 'Swap',           // Derion Helper
  ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']: 'Transfer',       // 20, 721
  ['0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62']: 'TransferSingle', // 1155
  ['0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb']: 'TransferBatch',  // 1155
  ['0x4dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63']: 'LogFeeTransfer', // Polygon Native POL
}

export type FormatSwapHistoryParameterType = {
  transferLogs: Array<LogType>
  swapLogs: Array<LogType>
  tokens: Array<TokenType>
}

export type PositionGenerateParameterType = {
  tokens: Array<TokenType>
  logs: Array<LogType>
}

export type FungiblePosition = {
  id: string,
  balance: BigNumber,
  priceR: BigNumber,
  price: BigNumber,
  rPerBalance: BigNumber,
  maturity: number,
}

export type Transition = {
  txHash: string,
  blockNumber: number,
  timestamp?: number,
  netTransfers: { [token: string]: BigNumber }
  price?: BigNumber,
  priceR?: BigNumber,
  rPerAmount?: BigNumber,
  maturity?: number,
}

export class History {
  account?: string
  RESOURCE: Resource
  config: IEngineConfig
  profile: Profile

  constructor(config: IEngineConfig & { RESOURCE: Resource }, profile: Profile) {
    this.config = config
    this.account = config.account
    this.RESOURCE = config.RESOURCE
    this.profile = profile
  }

  extractPoolAddresses(txLogs: LogType[][]): string[] {
    const poolAddresses: { [key: string]: boolean } = {}
    for (const logs of txLogs) {
      for (const log of logs) {
        if (log.address != this.profile.configs.derivable.token) {
          continue
        }
        const topic0 = log.topics?.[0]
        const type = TOPICS[topic0]
        if (type == 'TransferSingle') {
          const [id] = defaultAbiCoder.decode(["bytes32", "uint"], log.data)
          const poolAddress = getAddress(hexDataSlice(id, 12))
          poolAddresses[poolAddress] = true
        } else if (type == 'TransferBatch') {
          const [ids] = defaultAbiCoder.decode(["bytes32[]", "uint256[]"], log.data)
          for (let i = 0; i < ids.length; ++i) {
            const poolAddress = getAddress(hexDataSlice(ids[i], 12))
            poolAddresses[poolAddress] = true
          }
        }
      }
    }
    return Object.keys(poolAddresses)
  }

  process(logs: LogType[][]): {
    positions: { [id: string]: FungiblePosition },
    histories: Transition[],
  } {
    const positions: { [id: string]: FungiblePosition } = {}
    const histories: Transition[] = []
    for (const txLogs of logs) {
      if (!txLogs.length) {
        continue
      }
      const history: Transition = {
        txHash: txLogs[0].transactionHash,
        blockNumber: txLogs[0].blockNumber,
        timestamp: txLogs[0].timeStamp ? BigNumber.from(txLogs[0].timeStamp).toNumber() : undefined,
        netTransfers: {},
      }
      const _applyTransfer = (token: string, from: string, to: string, amount: BigNumber) => {
        if (from == this.account) {
          history.netTransfers[token] = (history.netTransfers[token] ?? bn(0)).sub(amount)
        }
        if (to == this.account) {
          history.netTransfers[token] = (history.netTransfers[token] ?? bn(0)).add(amount)
        }
        if (history.netTransfers[token].isZero()) {
          delete history.netTransfers[token]
        }
      }
      for (const log of txLogs) {
        const topic0 = log.topics?.[0]
        const type = TOPICS[topic0]
        if (type == 'Transfer' && log.topics?.length == 3) {
          // ERC20
          const token = getAddress(log.address)
          const from = getAddress(hexDataSlice(log.topics[1], 12))
          const to = getAddress(hexDataSlice(log.topics[2], 12))
          const amount = BigNumber.from(log.data)
          _applyTransfer(token, from, to, amount)
        } else if (type == 'TransferSingle') {
          // ERC1155
          if (log.address != this.profile.configs.derivable.token) {
            continue
          }
          const from = getAddress(hexDataSlice(log.topics[2], 12))
          const to = getAddress(hexDataSlice(log.topics[3], 12))
          const [id, amount] = defaultAbiCoder.decode(["bytes32", "uint"], log.data)
          _applyTransfer(id, from, to, amount)
        } else if (type == 'TransferBatch') {
          // ERC1155
          if (log.address != this.profile.configs.derivable.token) {
            continue
          }
          const from = getAddress(hexDataSlice(log.topics[2], 12))
          const to = getAddress(hexDataSlice(log.topics[3], 12))
          const [ids, amounts] = defaultAbiCoder.decode(["bytes32[]", "uint256[]"], log.data)
          for (let i = 0; i < ids.length; ++i) {
            _applyTransfer(ids[i], from, to, amounts[i])
          }
        }
      }
      for (const log of txLogs) {
        if (log.address != this.profile.configs.derivable.token) {
          continue
        }
        const topic0 = log.topics?.[0]
        const type = TOPICS[topic0]
        if (type != 'TransferSingle') {
          // Derion does not use batch transfer
          continue
        }
        // const operator = getAddress(hexDataSlice(log.topics[1], 12))
        const from = getAddress(hexDataSlice(log.topics[2], 12))
        const to = getAddress(hexDataSlice(log.topics[3], 12))
        const [id, amount] = defaultAbiCoder.decode(["bytes32", "uint"], log.data)
        const poolAddress = getAddress(hexDataSlice(id, 12))
        // const side = BigNumber.from(hexDataSlice(id, 0, 12)).toNumber()
        // const posId = pool + '-' + side
        // console.log({from, to, id, amount})
        const pos = positions[id] = positions[id] ?? {
          balance: bn(0),
          priceR: bn(0),
          price: bn(0),
          rPerBalance: bn(0),
        }
        if (to == this.account) {
          let priceR = bn(0)
          txLogs.some(log => {
            const topic0 = log.topics?.[0]
            const type = TOPICS[topic0]
            if (type != 'Swap') {
              return false
            }
            // const payer = getAddress(hexDataSlice(log.topics[1], 12))
            // const recipient = getAddress(hexDataSlice(log.topics[2], 12))
            // const index = getAddress(hexDataSlice(log.topics[3], 12))
            const datas = defaultAbiCoder.decode(["address", "uint", "uint", "uint", "uint", "uint", "uint"], log.data)
            const sqrtPriceR = datas[6]
            priceR = sqrtPriceR.mul(sqrtPriceR).shr(128)
            return true
          })
          txLogs.some(log => {
            const topic0 = log.topics?.[0] ?? 'NOTHING'
            const type = TOPICS[topic0]
            if (type != 'Position') {
              return false
            }
            // const payer = getAddress(hexDataSlice(log.topics[1], 12))
            // const recipient = getAddress(hexDataSlice(log.topics[2], 12))
            // const index = getAddress(hexDataSlice(log.topics[3], 12))
            const [posId, amount, maturity, sqrtPrice, valueR] = defaultAbiCoder.decode(["bytes32", "uint", "uint", "uint", "uint"], log.data)
            if (posId != id) {
              return false
            }
            history.maturity = maturity.toNumber()
            pos.maturity = maturity.toNumber()
            const newBalance = pos.balance.add(amount)
            if (sqrtPrice.gt(0)) {
              const price = sqrtPrice.mul(sqrtPrice).shr(128)
              history.price = price
              pos.price = pos.price.mul(pos.balance).add(amount.mul(price)).div(newBalance)
              if (!priceR.gt(0)) {
                const pool = this.RESOURCE.pools[poolAddress]
                // special case for INDEX = TOKEN_R / STABLECOIN
                if (pool.TOKEN_R == pool.baseToken && this.profile.configs.stablecoins.includes(pool.quoteToken)) {
                  priceR = price
                }
              }
            }
            const posValueR = pos.rPerBalance.mul(pos.balance)
            if (valueR.gt(0)) {
              history.rPerAmount = valueR.shl(128).div(amount)
              pos.rPerBalance = posValueR.add(valueR).shl(128).div(newBalance)
            }
            if (priceR.gt(0)) {
              history.priceR = priceR
              if (valueR.gt(0)) {
                pos.priceR = posValueR.mul(pos.priceR).shr(128).add(priceR.mul(valueR)).div(posValueR.add(valueR))
              }
            }
            return true
          })
        }
        if (to == this.account) {
          pos.balance = pos.balance.add(amount)
        }
        if (from == this.account) {
          pos.balance = pos.balance.sub(amount)
          if (!pos.balance.gt(0)) {
            delete positions[id]
          }
        }
      }
      if (Object.keys(history.netTransfers).length) {
        histories.push(history)
      }
    }
    return {
      positions,
      histories,
    }
  }
  // TODO: refactor position type
  generatePositions({ tokens, logs }: PositionGenerateParameterType): any {
    try {
      if (!logs || logs.length === 0) {
        return []
      }

      let positions = {}
      logs.forEach((log: LogType) => {
        positions = this.generatePositionBySwapLog(positions, tokens, log)
      })

      return positions
    } catch (e) {
      throw e
    }
  }

  // TODO: refactor position type
  generatePositionBySwapLog(positions: any, tokens: Array<TokenType>, log: LogType): any {
    try {
      const {
        derivable: { playToken },
        tokens: whiteListToken,
      } = this.profile.configs

      const pools = this.RESOURCE.pools
      const poolAddresses = Object.keys(this.RESOURCE.pools)

      const abi = this.getSwapAbi(log.topics[0])
      const encodeData = ethers.utils.defaultAbiCoder.encode(abi, log.args)
      const formatedData = ethers.utils.defaultAbiCoder.decode(abi, encodeData)

      const { poolIn, poolOut, sideIn, sideOut, amountOut, amountIn, price } = formatedData
      let { amountR, priceR } = formatedData

      if (!poolAddresses.includes(poolIn) && !poolAddresses.includes(poolOut)) {
        return positions
      }

      const tokenInAddress = this.getTokenAddressByPoolAndSide(poolIn, formatedData.sideIn)
      const tokenOutAddress = this.getTokenAddressByPoolAndSide(poolOut, formatedData.sideOut)

      if (POS_IDS.includes(sideOut.toNumber())) {
        if (!positions[tokenOutAddress]) {
          positions[tokenOutAddress] = {
            avgPriceR: 0,
            avgPrice: 0,
            balanceForPriceR: bn(0),
            balanceForPrice: bn(0),
            amountR: bn(0),
          }
        }
      }

      if (POS_IDS.includes(sideIn.toNumber())) {
        const posIn = positions[tokenInAddress]
        const pool = pools[poolIn]
        if (price) {
          // special case for INDEX = TOKEN_R / STABLECOIN
          if (!priceR?.gt(0) && pool.TOKEN_R == pool.baseToken && this.profile.configs.stablecoins.includes(pool.quoteToken)) {
            priceR = price
          }
        }
        if (posIn) {
          if (!amountR?.gt(0) && posIn?.balanceForPrice?.gt(0)) {
            amountR = posIn.amountR.mul(amountIn).div(posIn.balanceForPrice)
          }
          posIn.amountR = posIn.amountR.sub(amountR)
          if (priceR?.gt(0) || pool.TOKEN_R == playToken) {
            if (posIn.balanceForPriceR.lt(amountIn)) {
              console.warn(`missing value of balanceForPriceR: ${posIn.balanceForPriceR.toString()} < ${amountIn.toString()}`)
              posIn.balanceForPriceR = bn(0)
            } else {
              posIn.balanceForPriceR = posIn.balanceForPriceR.sub(amountIn)
            }
          }
          if (price) {
            if (posIn.balanceForPrice.lt(amountIn)) {
              console.warn(`missing value of balanceForPrice: ${posIn.balanceForPrice.toString()} < ${amountIn.toString()}`)
              posIn.balanceForPrice = bn(0)
            } else {
              posIn.balanceForPrice = posIn.balanceForPrice.sub(amountIn)
            }
          }
        } else {
          console.warn(`missing input position: ${poolIn}-${sideIn.toNumber()}`)
        }
      }

      if (POS_IDS.includes(sideOut.toNumber())) {
        const pool = pools[poolOut]
        const posOut = positions[tokenOutAddress]

        let priceRFormated

        if (price) {
          const { baseToken, quoteToken } = pool
          const indexPrice = parsePrice(
            price,
            tokens.find((t) => t?.address === baseToken) as TokenType,
            tokens.find((t) => t?.address === quoteToken) as TokenType,
            pool,
          )
          posOut.avgPrice = IEW(
            BIG(WEI(posOut.avgPrice))
              .mul(posOut.balanceForPrice)
              .add(BIG(WEI(indexPrice)).mul(amountOut))
              .div(posOut.balanceForPrice.add(amountOut)),
          )
          posOut.balanceForPrice = posOut.balanceForPrice.add(amountOut)

          // special case for INDEX = TOKEN_R / STABLECOIN
          if (!priceR?.gt(0) && pool.TOKEN_R == pool.baseToken && this.profile.configs.stablecoins.includes(pool.quoteToken)) {
            priceR = price
            priceRFormated = indexPrice
          }
        }

        posOut.amountR = posOut.amountR.add(amountR)
        if (priceR?.gt(0) || pool.TOKEN_R == playToken || priceRFormated) {
          const tokenR = tokens.find((t) => t.address === pool.TOKEN_R)
          if (tokenR) {
            let playTokenPrice: any = whiteListToken?.[playToken]?.price ?? 1
            if (typeof playTokenPrice === 'string' && playTokenPrice?.startsWith('0x')) {
              // ignore the x96 price here
              playTokenPrice = 1
            }
            if (!priceRFormated) {
              priceRFormated = pool.TOKEN_R == playToken ? playTokenPrice : this.extractPriceR(tokenR, tokens, priceR, log)
            }
            if (priceRFormated) {
              posOut.avgPriceR = IEW(
                BIG(WEI(posOut.avgPriceR))
                  .mul(posOut.balanceForPriceR)
                  .add(BIG(WEI(priceRFormated)).mul(amountOut))
                  .div(posOut.balanceForPriceR.add(amountOut)),
              )
              posOut.balanceForPriceR = posOut.balanceForPriceR.add(amountOut)
            } else {
              console.warn('unable to extract priceR')
            }
          } else {
            console.warn('missing token info for TOKEN_R', tokenR)
          }
        }
      }

      Object.keys(positions).map(posKey => {
        if (positions[posKey].balanceForPrice.lte(0) || positions[posKey].balanceForPriceR.lte(0)) {
          delete positions[posKey]
        }
      })
      return positions
    } catch (error) {
      throw error
    }
  }

  formatSwapHistory({ transferLogs, swapLogs, tokens }: FormatSwapHistoryParameterType): Array<number> {
    try {
      if (!swapLogs || swapLogs.length === 0) {
        return []
      }
      const pools = this.RESOURCE.pools

      const poolAddresses = Object.keys(this.RESOURCE.pools)
      const _swapLogs = swapLogs.map((log) => {
        const abi = this.getSwapAbi(log.topics[0])
        const formatedData = this.decodeSwapLog(abi, log.args)

        const { poolIn, poolOut, sideIn, sideOut, amountIn, amountOut, price, priceR } = formatedData

        if (!poolAddresses.includes(poolIn) && !poolAddresses.includes(poolOut)) {
          return null
        }

        const tokenInAddress = this.getTokenAddressByPoolAndSide(poolIn, formatedData.sideIn)
        const tokenOutAddress = this.getTokenAddressByPoolAndSide(poolOut, formatedData.sideOut)
        const tokenIn = tokens.find((t) => t.address === tokenInAddress)

        let entryValue
        let entryPrice
        // Note: aggregator's poolIn can be a different token (not native nor TOKEN_R)
        const pool = [POOL_IDS.R, POOL_IDS.native].includes(sideIn.toNumber()) ? (pools[poolIn] ?? pools[poolOut]) : pools[poolOut]
        const { TOKEN_R, baseToken, quoteToken } = pool
        const {
          derivable: { playToken },
          tokens: whiteListToken,
        } = this.profile.configs
        if (
          ([POOL_IDS.R, POOL_IDS.native].includes(sideIn.toNumber()) || [POOL_IDS.R, POOL_IDS.native].includes(sideOut.toNumber())) &&
          (priceR?.gt(0) || TOKEN_R == playToken)
        ) {
          const amount = [POOL_IDS.R, POOL_IDS.native].includes(sideIn.toNumber()) ? amountIn : amountOut
          const tokenR = tokens.find((t) => t.address === TOKEN_R)
          if (tokenR) {
            let playTokenPrice: any = whiteListToken?.[playToken]?.price ?? 1
            if (typeof playTokenPrice === 'string' && playTokenPrice?.startsWith('0x')) {
              // ignore the x96 price here
              playTokenPrice = 1
            }
            const priceRFormated = pool.TOKEN_R == playToken ? playTokenPrice : this.extractPriceR(tokenR, tokens, priceR, log)
            if (priceRFormated) {
              entryValue = weiToNumber(amount.mul(numberToWei(priceRFormated) || 0), 18 + (tokenIn?.decimals || 18))
              // console.log(tokenR.symbol, tokenRQuote.symbol, _priceR.toString(), priceRFormated, entryValue)
            } else {
              console.warn('unable to extract priceR')
            }
          } else {
            console.warn('missing token info for TOKEN_R', tokenR)
          }
        }

        if (price) {
          entryPrice = parsePrice(
            price,
            tokens.find((t) => t?.address === baseToken) as TokenType,
            tokens.find((t) => t?.address === quoteToken) as TokenType,
            pool,
          )
        }

        const _transferLog = transferLogs.find((l) => l.transactionHash === log.transactionHash)
        const anyTokenHistoryData: any = {}
        if (_transferLog) {
          const _transferData = this.decodeTransferLog(_transferLog.data, _transferLog.topics)
          if (this.account === _transferData.from) {
            anyTokenHistoryData.tokenIn = _transferLog.contractAddress
            anyTokenHistoryData.amountIn = _transferData.value
          } else if (this.account === _transferData.to) {
            anyTokenHistoryData.tokenOut = _transferLog.contractAddress
            anyTokenHistoryData.amountOut = _transferData.value
          }
        }

        return {
          transactionHash: log.transactionHash,
          timeStamp: log.timeStamp,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          poolIn,
          poolOut,
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          entryValue,
          entryPrice,
          ...formatedData,
          ...anyTokenHistoryData,
        }
      })

      return _swapLogs.filter((l) => l !== null)
    } catch (e) {
      throw e
    }
  }

  extractPriceR(tokenR: TokenType, tokens: Array<TokenType>, priceR: any, log: LogType): string | undefined {
    try {
      const { address, stablecoin } = this.RESOURCE.getSingleRouteToUSD(tokenR.address) ?? {}
      if (!address) {
        console.warn('missing route to USD', tokenR)
        return undefined
      }
      const tokenRQuote = tokens.find((t) => t.address == stablecoin)
      if (!tokenRQuote) {
        console.warn('missing token info for TOKEN_R quote', stablecoin)
        return undefined
      }
      let _priceR = priceR
      // fix a historical bug in BSC
      if (this.config.chainId == 56 && log.blockNumber < 33077333) {
        if (tokenR.address.localeCompare(tokenRQuote.address, undefined, { sensitivity: 'accent' }) > 0) {
          _priceR = M256.div(_priceR)
        }
      }
      // priceR is independent to the pool index, so no pool is passed in here
      return parsePrice(_priceR, tokenR, tokenRQuote)
    } catch (error) {
      throw error
    }
  }

  getTokenAddressByPoolAndSide(poolAddress: string, side: BigNumber): string {
    try {
      const pool = this.RESOURCE.pools[poolAddress]
      if (side.eq(POOL_IDS.native)) {
        return NATIVE_ADDRESS
      }
      if (side.eq(POOL_IDS.R)) {
        return pool?.TOKEN_R || NATIVE_ADDRESS
      }
      return `${poolAddress}-${side.toString()}`
    } catch (error) {
      throw error
    }
  }

  getSwapAbi(topic0: string): any {
    try {
      const topics = getTopics()
      if (topic0 === topics.Swap[0]) {
        return this.profile.getEventDataAbi().Swap
      } else if (topic0 === topics.Swap[1]) {
        return this.profile.getEventDataAbi().Swap1
      } else {
        return this.profile.getEventDataAbi().Swap2
      }
    } catch (error) {
      throw error
    }
  }

  decodeTransferLog(data: string, topics: Array<string>): Result {
    try {
      const abiInterface = new ethers.utils.Interface(Erc20)
      return abiInterface.decodeEventLog('Transfer', data, topics)
    } catch (error) {
      throw error
    }
  }

  decodeSwapLog(abi: any, args: any): Result {
    try {
      const encodeData = ethers.utils.defaultAbiCoder.encode(abi, args)
      return ethers.utils.defaultAbiCoder.decode(abi, encodeData)
    } catch (error) {
      throw error
    }
  }
}
