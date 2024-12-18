import { LogType, PoolsType, PoolType, Storage, SwapLog, TokenType } from '../types'
import { ethers } from 'ethers'
import { Price } from '../services/price'
import { Resource } from '../services/resource'
import { BnA } from '../services/balanceAndAllowance'
import { UniV2Pair } from '../services/uniV2Pair'
import { History } from '../services/history'
import { Swap } from '../services/swap'
import { CurrentPool } from '../services/currentPool'
import { CreatePool } from '../services/createPool'
import { UniV3Pair } from '../services/uniV3Pair'
import { IEngineConfig } from '../utils/configs'
import { Profile } from '../profile'
import { Aggregator } from '../services/aggregator'
import {Pool} from './pool'

export class DerionSDK {
  chainId: number
  scanApi?: string
  rpcUrl: string
  account?: string
  signer?: ethers.providers.JsonRpcSigner
  provider: ethers.providers.Provider
  storage?: Storage
  PRICE: Price
  RESOURCE: Resource
  BNA: BnA
  UNIV2PAIR: UniV2Pair
  UNIV3PAIR: UniV3Pair
  HISTORY: History
  SWAP: Swap
  CURRENT_POOL: CurrentPool
  CREATE_POOL: CreatePool
  AGGREGATOR: Aggregator
  enginConfigs: IEngineConfig

  constructor(enginConfigs: IEngineConfig, profile = Profile) {
    this.enginConfigs = enginConfigs
    this.account = enginConfigs.account
    // this.providerToGetLog = this.config.providerToGetLog
    this.profile = new profile(enginConfigs)
  }

  profile: Profile

  async initServices() {
    await this.profile.loadConfig()
    this.UNIV2PAIR = new UniV2Pair(this.enginConfigs, this.profile)
    this.UNIV3PAIR = new UniV3Pair(this.enginConfigs, this.profile)
    this.RESOURCE = new Resource(this.enginConfigs, this.profile)
    this.CURRENT_POOL = new CurrentPool(this.enginConfigs)
    this.CREATE_POOL = new CreatePool(this.enginConfigs, this.profile)

    const configs = {
      ...this.enginConfigs,
      RESOURCE: this.RESOURCE,
    }
    this.BNA = new BnA(configs, this.profile)
    this.PRICE = new Price(configs, this.profile)
    this.HISTORY = new History(configs, this.profile)
    this.AGGREGATOR = new Aggregator(configs, this.profile)
    this.SWAP = new Swap({ ...configs, AGGREGATOR: this.AGGREGATOR }, this.profile)
  }

  async loadPools(derionPoolsAddress: string[]): Promise<{[key: string]: Pool}> {
    const {pools} = await this.RESOURCE.loadInitPoolsData([], derionPoolsAddress, false)
    const derionPoolsSdk: {[key: string]: Pool} = {}
    Object.keys(pools).map(key => {
      derionPoolsSdk[key] = new Pool(pools[key],this.enginConfigs, this.profile)
    })
    return derionPoolsSdk
  }
  async loadPool(derionPoolAddress: string): Promise<Pool> {
    const {pools} = await this.RESOURCE.loadInitPoolsData([], [derionPoolAddress], false)
    const derionPoolSdk = new Pool(pools[derionPoolAddress], this.enginConfigs, this.profile)
    return derionPoolSdk
  }
  async loadPosition(id: string) {
  }
  async loadAccountPositions({address, logs}:{address?: string,logs: LogType[]}) {
    const sdkResourceData = await this.RESOURCE.getResourceCached(address || this.account || '', false, logs)
    return sdkResourceData
  }
}
