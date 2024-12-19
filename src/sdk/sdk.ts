import { LogType, Storage } from '../types'
import { ethers, Signer, Wallet } from 'ethers'
import { Price } from '../services/price'
import { Resource } from '../services/resource'
import { BnA } from '../services/balanceAndAllowance'
import { UniV2Pair } from '../services/uniV2Pair'
import { History } from '../services/history'
import { Swap } from '../services/swap'
import { CurrentPool } from '../services/currentPool'
import { CreatePool } from '../services/createPool'
import { UniV3Pair } from '../services/uniV3Pair'
import { ProfileConfigs } from '../utils/configs'
import { Profile } from '../profile'
import { Aggregator } from '../services/aggregator'
import {Pool} from './pool'
import {Account} from './account'
import { StateLoader } from './stateLoader'
import { Networkish } from '@ethersproject/providers'
import { ConnectionInfo } from 'ethers/lib/utils'

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
  configs: ProfileConfigs

  constructor(configs: ProfileConfigs) {
    this.configs = configs
    this.profile = new Profile(configs)
  }

  profile: Profile
  stateLoader: StateLoader

  async init() {
    await this.profile.loadConfig()
    this.UNIV2PAIR = new UniV2Pair(this.configs, this.profile)
    this.UNIV3PAIR = new UniV3Pair(this.configs, this.profile)
    this.RESOURCE = new Resource(this.configs, this.profile)
    this.CURRENT_POOL = new CurrentPool(this.configs)
    this.CREATE_POOL = new CreatePool(this.configs, this.profile)

    const configs = {
      ...this.configs,
      RESOURCE: this.RESOURCE,
    }
    this.BNA = new BnA(configs, this.profile)
    this.PRICE = new Price(configs, this.profile)
    this.HISTORY = new History(configs, this.profile)
    this.AGGREGATOR = new Aggregator(configs, this.profile)
    this.SWAP = new Swap({ ...configs, AGGREGATOR: this.AGGREGATOR }, this.profile)
  }

  getStateLoader(url?: ConnectionInfo | string, network?: Networkish) {
    return this.stateLoader = this.stateLoader ?? new StateLoader(this.profile, url, network)
  }

  extractPoolAddresses = (txLogs: LogType[][]): string[] => {
    return this.HISTORY.extractPoolAddresses(txLogs)
  }

  createAccount = (address: string | Signer) => {
    const account = new Account(address, {
      positions: {},
      histories: [],
      balances: {},
      allowance: {}
    }, this.configs)
    return account
  }
  createPools = async (poolsAddress: string[]):Promise<{[key:string]: Pool}> => {
    const {pools} = await this.RESOURCE.loadInitPoolsData([], poolsAddress, false)
    const derionPoolsSdk: {[key: string]: Pool} = {}
    Object.keys(pools).map(key => {
      derionPoolsSdk[key] = new Pool(pools[key],this.configs, this.profile)
    })
    return derionPoolsSdk
  }
  createPoolsFromLogs = async (logs: LogType[]):Promise<{[key:string]: Pool}> => {
    const { pools } = await this.RESOURCE.getResourceFromOverrideLogs(logs)
    const poolsObjects: {[key:string]: Pool} = {}
    Object.keys(pools).map(k => {
      poolsObjects[k] = new Pool(pools[k], this.configs, this.profile)
    })
    return poolsObjects
  }
}
