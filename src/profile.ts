import { Profile as SdkProfile } from '@derion/sdk'
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

// Engine-specific ABIs (superset of SDK's 3 ABIs)
const engineAbis: any = {
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

export class Profile extends SdkProfile {
  // Override configs type to include engine-specific fields (v3Pos, etc.)
  declare configs: INetworkConfig

  constructor(engineConfig: IEngineConfig) {
    super({
      chainId: engineConfig.chainId,
      env: engineConfig.env || 'production',
    })
  }

  // Override to include engine-specific ABIs alongside SDK ABIs
  getAbi(name: string) {
    // Check engine ABIs first (superset)
    if (engineAbis[name]) {
      return engineAbis[name]
    }
    // Fall back to SDK ABIs (Helper, View, UTROverride)
    return super.getAbi(name)
  }

  getEventDataAbi() {
    return EventDataAbis
  }
}
