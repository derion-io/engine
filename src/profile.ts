import Helper from './abi/Helper.json'
import View from './abi/View.json'
import UTROverride from './abi/UTROverride.json'
import fetch from 'node-fetch'
import { DerionConfigs, ProfileConfigs } from './type'

const abis: any = {
  Helper,
  View,
  UTROverride,
}

const CONFIGS_URL = {
  development: `https://raw.githubusercontent.com/derion-io/configs/dev/`,
  production: `https://raw.githubusercontent.com/derion-io/configs/main/`,
}

export class Profile {
  chainId: number
  env: 'development' | 'production'
  configs: DerionConfigs
  routes: {
    [key: string]: { type: string; address: string }[]
  }
  whitelistPools: string[]

  constructor(configs: ProfileConfigs) {
    this.chainId = configs.chainId
    this.env = configs.env || 'production'
  }

  async loadConfig() {
    const [networkConfig, uniV3Pools, whitelistPools] = await Promise.all([
      fetch(CONFIGS_URL[this.env] + this.chainId + '/network.json')
        .then((r) => r.json())
        .catch(() => []),
      fetch(CONFIGS_URL[this.env] + this.chainId + '/routes.json')
        .then((r) => r.json())
        .catch(() => []),
      fetch(CONFIGS_URL[this.env] + this.chainId + '/pools.json')
        .then((r) => r.json())
        .catch(() => []),
    ])
    this.configs = networkConfig
    this.routes = uniV3Pools
    this.whitelistPools = whitelistPools
  }

  getAbi(name: string) {
    return abis[name] ? abis[name] : abis[this.chainId][name] || []
  }
}
