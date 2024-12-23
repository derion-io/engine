import { BigNumber } from "ethers"

export interface ProfileConfigs {
  env?: 'development' | 'production'
  chainId: number
}

export interface DerionConfigs {
  chainId: number
  rpc: string
  rpcGetLog?: string
  rpcGetProof?: string
  scanApi?: string
  explorer?: string
  scanName?: string
  timePerBlock: number
  candleChartApi?: string
  useDexToolsChart?: boolean
  storage?: Storage
  gasLimitDefault: number
  gasForProof: number
  name: string
  gtID: string
  dextoolsID?: string // fallback to gtID
  nativeSymbol: string
  wrappedTokenAddress: string
  nativePriceUSD: number
  stablecoins: string[]
  tokens?: { [address: string]: { price?: number | string; symbol: string; name: string; decimals: number; logo: string } }
  helperContract: IHelperContract
  factory: { [factory: string]: { type: 'uniswap2' | 'uniswap3' | 'pancake3'; topic0: string; fetcher?: string; } }
  fetchers: { [fetcher: string]: { type: 'uniswap2' | 'uniswap3' | 'pancake3'; factory: string[] } }
  chartReplacements?: { [origin: string]: string }
  uniswap: IUniswapContractAddress
  derivable: IDerivableContractAddress
}

export interface IHelperContract {
  utr: string
  multiCall: string
}

export interface IUniswapContractAddress {
  v3Factory: string
}

export interface IDerivableContractAddress {
  feeRate?: number
  version: number
  startBlock: number
  poolFactory: string
  logic: string
  token: string
  playToken: string
  stateCalHelper: string
  feeReceiver: string
  tokenDescriptor: string
  compositeFetcher: string
  multiCall: string
  uniswapV2Fetcher?: string
  poolDeployer?: string
}

export type LogType = {
  contractAddress: string
  address: string
  timeStamp: number
  transactionHash: string
  blockNumber: number
  index: number
  logIndex: number
  name: string
  topics: string[]
  data: string
  args: any
}

export type SdkPool = {
  address: string
  config?: {
    FETCHER: string
    ORACLE: string
    TOKEN_R: string
    K: number
    MARK: BigNumber
    INTEREST_HL: number
    PREMIUM_HL: number
    MATURITY: number
    MATURITY_VEST: number
    MATURITY_RATE: BigNumber
    OPEN_RATE: BigNumber
  }
  state?: {
    R: BigNumber
    a: BigNumber
    b: BigNumber
  }
  view?: {
    sA: BigNumber
    sB: BigNumber
    sC: BigNumber
    rA: BigNumber
    rB: BigNumber
    rC: BigNumber
    twap: BigNumber
    spot: BigNumber
  }
}

export type SdkPools = {
  [address: string]: SdkPool
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
