import { bn, computePoolAddress, getTopics, isErc1155Address } from '../utils/helper'
import { BigNumber } from 'ethers'
import { LARGE_VALUE, NATIVE_ADDRESS } from '../utils/constant'
import BnAAbi from '../abi/BnA.json'
import { AllowancesType, BalancesType, MaturitiesType, TokenType } from '../types'
import { IEngineConfig } from '../utils/configs'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Profile } from '../profile'
import { Assets, Resource } from './resource'
import _ from 'lodash'
import { getAddress } from 'ethers/lib/utils'
import {multicall} from '../utils/multicall'
import {CallReturnContext} from 'ethereum-multicall'
import INONFUNGIBLE_POSITION_MANAGER from '../abi/NonfungiblePositionManager.json'
const TOPICS = getTopics()

export function keyFromTokenId(id: BigNumber): string {
  const s = id.toHexString()
  const side = Number.parseInt(s.substring(2, 4), 16)
  const pool = getAddress('0x' + s.substring(4))
  return pool + '-' + side
}

export type BnAReturnType = {
  chainId: number
  account: string
  balances: BalancesType
  allowances: AllowancesType
  maturities: MaturitiesType
}

export interface IUniPosV3 {
  tickLower: number,
  tickUpper: number,
  liquidity: string,
  feeGrowthInside0LastX128: string,
  feeGrowthInside1LastX128: string,
  fee: string,
  tokensOwed0: string,
  tokensOwed1: string,
  token0: string,
  token1: string,
  token0Data:TokenType,
  token1Data: TokenType,
  poolAddress: string,
}
export class BnA {
  provider: JsonRpcProvider
  rpcUrl: string
  bnAAddress: string
  profile: Profile
  RESOURCE: Resource
  constructor(config: IEngineConfig  & { RESOURCE: Resource }, profile: Profile) {
    this.provider = new JsonRpcProvider(profile.configs.rpc)
    this.bnAAddress = `0x${BnAAbi.deployedBytecode.slice(-40)}`
    this.profile = profile
    this.RESOURCE = config.RESOURCE
  }

  // TODO: change tokens to a bool flag for native balance
  async getBalanceAndAllowance(account: string, withNative: boolean = false): Promise<BnAReturnType> {
    if (!account) {
      throw new Error('missing account')
    }
    try {
      // get native balance
      let nativeBalancePromise: Promise<BigNumber> | undefined
      if (withNative) {
        nativeBalancePromise = this.provider.getBalance((account) || '')
      }

      const balances: { [token: string]: BigNumber } = {}
      const allowances: AllowancesType = {}
      const maturities: MaturitiesType = {}

      const logs = this.RESOURCE.bnaLogs
      for (const log of logs) {
        if (!log.args) {
          console.error('Unparsed log', log)
          continue
        }
        const token = log.address
        if (TOPICS.Transfer.includes(log.topics[0])) {
          const { from, to, value } = log.args
          if (to == account) {
            balances[token] = (balances[token] ?? bn(0)).add(value)
          }
          if (from == account) {
            balances[token] = (balances[token] ?? bn(0)).sub(value)
          }
          if (!balances[token] || balances[token].isZero()) {
            delete balances[token]
          }
        }
        if (TOPICS.Approval.includes(log.topics[0])) {
          const { owner, spender, value } = log.args
          if (owner == account && spender == this.profile.configs.helperContract.utr) {
            if (value.isZero()) {
              delete allowances[token]
            } else {
              allowances[token] = value
            }
          }
        }
        if (token != this.profile.configs.derivable.token) {
          // not our 1155 token, don't care
          continue
        }
        if (TOPICS.TransferSingle.includes(log.topics[0])) {
          const { from, to, id, value } = log.args
          const key = keyFromTokenId(id)
          allowances[key] = bn(LARGE_VALUE)
          if (to == account) {
            balances[key] = (balances[key] ?? bn(0)).add(value)
            maturities[key] = bn(log.timeStamp)
          }
          if (from == account) {
            balances[key] = (balances[key] ?? bn(0)).sub(value)
            if (balances[key].isZero()) {
              delete balances[key]
            }
          }
        }
        if (TOPICS.TransferBatch.includes(log.topics[0])) {
          const { from, to, ids, } = log.args
          // TODO: where is log.args.values?
          const values = log.args['4']
          for (let i = 0; i < ids.length; ++i) {
            const value = values[i]
            const key = keyFromTokenId(ids[i])
            allowances[key] = bn(LARGE_VALUE)
            if (to == account) {
              balances[key] = (balances[key] ?? bn(0)).add(value)
              maturities[key] = bn(log.timeStamp)
            }
            if (from == account) {
              balances[key] = (balances[key] ?? bn(0)).sub(value)
              if (balances[key].isZero()) {
                delete balances[key]
              }
            }
          }
        }
        if (TOPICS.ApprovalForAll.includes(log.topics[0])) {
          // TODO: handle 1155 Approval events
        }
      }
      // calculate the MATURITY assume that each 
      for (const key of Object.keys(balances)) {
        if (!isErc1155Address(key)) {
          continue
        }
        const [poolAddress] = key.split('-')
        const MATURIY = this.RESOURCE.pools[poolAddress]?.MATURITY
        if (MATURIY) {
          maturities[key] = MATURIY.add(maturities[key] ?? 0)
        }
      }
      // await the native balance response
      if (nativeBalancePromise) {
        balances[NATIVE_ADDRESS] = await nativeBalancePromise
      }
      return {
        chainId: this.profile.chainId,
        account,
        balances,
        allowances,
        maturities,
      }
    } catch (error) {
      throw error
    }
  }
  async loadUniswapV3Position({assetsOverride, tokensOverride, uniswapV3FactoryOverride}: {assetsOverride?: Assets, tokensOverride?: TokenType[], uniswapV3FactoryOverride?: string}) {
    const assets = assetsOverride || this.RESOURCE.assets
    const tokens = tokensOverride || this.RESOURCE.tokens
    const factoryAddress = uniswapV3FactoryOverride || Object.keys(this.profile.configs.factory).filter(
      (facAddress) => this.profile.configs.factory[facAddress].type === 'uniswap3'
    )?.[0]
    const uniPosV3 = Object.keys(assets[721].balance).map(key721 => key721.split('-')).filter(keyWithId => keyWithId[0] === this.profile.configs.uniswap.v3Pos)
    const uniPosV3Data: {[posKey: string]: IUniPosV3} = {}

    await multicall(
      this.RESOURCE.provider,
      [
        ...uniPosV3.map(([uni3PosAddress, uni3PosId]) => ({
          reference: `position-${uni3PosId}`,
          contractAddress: uni3PosAddress,
          abi: INONFUNGIBLE_POSITION_MANAGER.abi,
          calls: [
            {
              reference: uni3PosId,
              methodName: 'positions',
              methodParameters: [uni3PosId],
            },
          ], context: (callsReturnContext: CallReturnContext[]) => {
            for (const ret of callsReturnContext) {
              const values = ret.returnValues;
              const token0Data = tokens.filter(t => t.address.toLowerCase() === values[2]?.toLowerCase())[0]
              const token1Data = tokens.filter(t => t.address.toLowerCase() === values[3]?.toLowerCase())[0]
              const poolAddress = computePoolAddress({factoryAddress, tokenA: token0Data, tokenB: token1Data, fee: Number(values[4])})
              uniPosV3Data[[uni3PosAddress, uni3PosId].join('-')] = {
                tickLower: parseInt(values[5].toString(), 10),
                tickUpper: parseInt(values[6].toString(), 10),
                liquidity: BigNumber.from(values[7].hex).toString(),
                feeGrowthInside0LastX128: BigNumber.from(values[8].hex).toString(),
                feeGrowthInside1LastX128: BigNumber.from(values[9].hex).toString(),
                fee: values[4].toString(),
                tokensOwed0: BigNumber.from(values[10].hex).toString(),
                tokensOwed1: BigNumber.from(values[11].hex).toString(),
                token0: values[2],
                token1: values[3],
                token0Data,
                token1Data,
                poolAddress,
              };
            }
          },
    }))])
    
    return uniPosV3Data
  }
}
