import { Resource } from './resource'
import { PoolType } from '../types'
import { IEngineConfig } from '../utils/configs'

export type PoolData = {
  baseToken: string
  quoteToken: string
  cToken: string
  dTokens: Array<string>
  cTokenPrice: number
  states: any
  powers: Array<number>
  basePrice: string
  poolAddress: string
  baseId: number
  quoteId: number
  logic: string
}

export class CurrentPool {
  resource: Resource
  pools: { [key: string]: PoolType }
  baseToken: string
  quoteToken: string
  TOKEN: string
  dTokens: Array<string>
  states: any
  powers: Array<number>
  basePrice: string
  poolAddress?: string
  chainId: number
  config: IEngineConfig
  constructor(config: IEngineConfig) {
    this.config = config
    this.chainId = config.chainId
  }

  initCurrentPoolData(poolData: PoolData) {
    for (const i in poolData) {
      // @ts-ignore
      // TODO: Logic checking & review
      this[i] = poolData[i]
    }
  }
}
