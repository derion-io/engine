import { LogType } from '../types'
import { Signer } from 'ethers'
import { ProfileConfigs } from '../utils/configs'
import { Profile } from '../profile'
import { Account } from './account'
import { StateLoader } from './stateLoader'
import { Networkish } from '@ethersproject/providers'
import { ConnectionInfo } from 'ethers/lib/utils'
import { extractPoolAddresses } from './utils/logs'

export class DerionSDK {
  configs: ProfileConfigs

  constructor(configs: ProfileConfigs) {
    this.configs = configs
    this.profile = new Profile(configs)
  }

  profile: Profile
  stateLoader: StateLoader

  async init() {
    await this.profile.loadConfig()
  }

  getStateLoader(url?: ConnectionInfo | string, network?: Networkish) {
    return this.stateLoader = this.stateLoader ?? new StateLoader(this.profile, url, network)
  }

  extractPoolAddresses = (txLogs: LogType[][]): string[] => {
    return extractPoolAddresses(txLogs, this.profile.configs.derivable.token)
  }

  createAccount = (address: string, signer?: Signer) => {
    return new Account(this.profile, address, signer)
  }

  // createPools = async (poolsAddress: string[]):Promise<{[key:string]: Pool}> => {
  //   const {pools} = await this.RESOURCE.loadInitPoolsData([], poolsAddress, false)
  //   const derionPoolsSdk: {[key: string]: Pool} = {}
  //   Object.keys(pools).map(key => {
  //     derionPoolsSdk[key] = new Pool(pools[key],this.configs, this.profile)
  //   })
  //   return derionPoolsSdk
  // }

  // createPoolsFromLogs = async (logs: LogType[]):Promise<{[key:string]: Pool}> => {
  //   const { pools } = await this.RESOURCE.getResourceFromOverrideLogs(logs)
  //   const poolsObjects: {[key:string]: Pool} = {}
  //   Object.keys(pools).map(k => {
  //     poolsObjects[k] = new Pool(pools[k], this.configs, this.profile)
  //   })
  //   return poolsObjects
  // }
}
