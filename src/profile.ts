import { IEngineConfig, INetworkConfig } from './utils/configs'
import { EventDataAbis } from './utils/constant'
import BnA from './abi/BnA.json'
import ERC20 from './abi/ERC20.json'
import TokensInfo from './abi/TokensInfo.json'
import Events from './abi/Events.json'
import Events721 from './abi/Events721.json'
import PairDetail from './abi/PairDetail.json'
import PairV3Detail from './abi/PairV3Detail.json'
import FetcherV2Mock from './abi/FetcherV2Mock.json'
import Pool from './abi/Pool.json'
import ReserveTokenPrice from './abi/ReserveTokenPrice.json'
import Token from './abi/Token.json'
import Helper from './abi/Helper.json'
import View from './abi/View.json'
import UTR from './abi/UTR.json'
import FetcherV2 from './abi/FetcherV2.json'
import UTROverride from './abi/UTROverride.json'
import FetcherV2Override from './abi/FetcherV2Override.json'
import Chainlink from "./abi/ChainLinkPriceFeed.json"
import fetch from 'node-fetch'
import { PoolType } from './types'

const abis = {
  BnA,
  FetcherV2,
  ERC20,
  Events,
  Events721,
  PairDetail,
  PairV3Detail,
  Pool,
  ReserveTokenPrice,
  Token,
  TokensInfo,
  Helper,
  View,
  UTR,
  UTROverride,
  FetcherV2Mock,
  FetcherV2Override,
  Chainlink
}

const DDL_CONFIGS_URL = {
  development: `https://raw.githubusercontent.com/derion-io/configs/v2-dev/`,
  production: `https://raw.githubusercontent.com/derion-io/configs/v2/`,
}

// TODO: Change name from profile to ...
export class Profile {
  chainId: number
  env: 'development' | 'production'
  configs: INetworkConfig
  routes: {
    [key: string]: { type: string; address: string }[]
  }
  whitelistPools: string[]

  constructor(engineConfig: IEngineConfig) {
    this.chainId = engineConfig.chainId
    this.env = engineConfig.env || 'production'
  }

  async loadConfig() {
    const [networkConfig, uniV3Pools, whitelistPools] = await Promise.all([
      fetch(DDL_CONFIGS_URL[this.env] + this.chainId + '/network.json')
        .then((r) => r.json())
        .catch(() => []),
      fetch(DDL_CONFIGS_URL[this.env] + this.chainId + '/routes.json')
        .then((r) => r.json())
        .catch(() => []),
      fetch(DDL_CONFIGS_URL[this.env] + this.chainId + '/pools.json')
        .then((r) => r.json())
        .catch(() => []),
    ])
    this.configs = networkConfig
    this.routes = uniV3Pools
    this.whitelistPools = whitelistPools
    // this.configs.helperContract.utr = '0x2222C5F0999E74D8D88F7bbfE300147d34c22222'
  }

  getAbi(name: string) {
    //@ts-ignore
    return abis[name] ? abis[name] : abis[this.chainId][name] || []
  }

  getEventDataAbi() {
    return EventDataAbis
  }

  getExp(fetcher: string): number {
    return this.configs?.fetchers?.[fetcher]?.type?.endsWith('3') ? 2 : 1
  }
}
