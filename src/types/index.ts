import {SwapSide} from '@paraswap/sdk'
import { BigNumber } from 'ethers'

export type Storage = {
  setItem?: (itemName: string, value: string) => void
  getItem?: (itemName: string) => string
}

// export type ParseLogType = {
//   address: string
//   contractAddress: string
//   name: string
//   topic: string
//   args: any
//   topics: string[]
// }

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

export type StatesType = {
  R: BigNumber
  a: BigNumber
  b: BigNumber
  rA: BigNumber
  rB: BigNumber
  rC: BigNumber
  sA: BigNumber
  sB: BigNumber
  sC: BigNumber
  twap: BigNumber
  spot: BigNumber
  state: {
    R: BigNumber
    a: BigNumber
    b: BigNumber
  }
  config: any
}

export type PoolConfig = {
  amountInit: BigNumber
  recipient: string
  k: number
  a: BigNumber
  b: BigNumber
  halfLife: number
  mark: BigNumber
  oracle: string
  initTime: number
}

export type PoolGroupType = {
  UTR: string
  TOKEN: string
  pools: { [key: string]: PoolType }
  ORACLE: string
  basePrice: string
  k: number[]
  states: {
    twapBase: BigNumber
    spotBase: BigNumber
    supplyDetails: { [key: number]: BigNumber }
    rDetails: { [key: number]: BigNumber }
    R: BigNumber
    rC: BigNumber
    rDcLong: BigNumber
    rDcShort: BigNumber
  }
}

export type PoolType = {
  UTR: string
  TOKEN: string
  MARK: BigNumber
  INIT_TIME: BigNumber
  INTEREST_HL: BigNumber
  HALF_LIFE: BigNumber
  PREMIUM_HL: BigNumber
  ORACLE: string
  TOKEN_R: string
  FETCHER: string
  MATURITY: BigNumber
  OPEN_RATE: BigNumber
  pool: string
  logic: string
  k: BigNumber
  cTokenPrice: number
  baseSymbol: string
  states: StatesType
  baseToken: string
  quoteToken: string
  cToken: string
  powers: number[]
  dTokens: string[]
  priceToleranceRatio: BigNumber
  quoteSymbol: string
  rentRate: BigNumber
  deleverageRate: BigNumber
  poolAddress: string
  quoteId: number
  baseId: number
  basePrice: string
  cPrice: number
  pair: string
  quoteTokenIndex: number
  window: BigNumber
  exp: number
}

export type SwapLog = {
  address: string
  args: any[]
  name: string
  // ...
}

export type PoolsType = { [key: string]: PoolType }
export type PoolGroupsType = { [key: string]: PoolGroupType }
export type TokenType = {
  address: string
  decimals: number
  name: string
  symbol: string
  totalSupply?:any
  icon?: string
}

export type MaturitiesType = { [key: string]: BigNumber }
export type BalancesType = { [key: string]: BigNumber }
export type AllowancesType = { [key: string]: BigNumber }

export type PoolErc1155StepType = {
  idIn: BigNumber | string
  idOut: BigNumber | string
  amountIn: BigNumber
  amountOutMin: BigNumber | string | number
}

export type StepType = {
  tokenIn: string
  tokenOut: string
  amountIn: BigNumber
  useSweep?: boolean
  amountOutMin?: number
  currentBalanceOut?: BigNumber
}

export type SwapStepType = {
  tokenIn: string
  tokenOut: string
  amountIn: BigNumber
  payloadAmountIn?: BigNumber
  amountOutMin: BigNumber | string | number
  useSweep?: boolean
  currentBalanceOut?: BigNumber
  uniPool?: string
}

export type rateDataAggregatorType = { 
   userAddress: string
   ignoreChecks: boolean
   srcToken: string
   srcDecimals: number
   srcAmount?: string,
   destAmount?: string,
   destToken: string,
   destDecimals: number,
   partner: string,
   side: SwapSide,
   excludeDirectContractMethods?:boolean,
   otherExchangePrices?: boolean,
   ignoreGasEstimate?: boolean
   ignoreAllowance?: boolean 
}

export type SwapAndOpenAggregatorType = { 
  poolAddress: string,
  poolId: number
}

export type PendingSwapTransactionType = {
  hash: string
  steps: SwapStepType[]
}
