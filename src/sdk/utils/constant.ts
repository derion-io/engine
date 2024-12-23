import { bn } from "."

export const SECONDS_PER_DAY = 86400

export const Q128 = bn(1).shl(128)
export const M256 = bn(1).shl(256).sub(1)
export const BIG_E18 = bn(10).pow(18)
export const BIG_0 = bn(0)
export const BIG_M1 = bn(-1)

export const LARGE_VALUE = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
export const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
export const MINI_SECOND_PER_DAY = 86400000

export const PARA_DATA_BASE_URL = 'https://api.paraswap.io/prices'
export const PARA_VERSION = "5"
export const PARA_BUILD_TX_BASE_URL = 'https://api.paraswap.io/transactions'

export const POOL_IDS = {
  cToken: 0x20000,
  cp: 0x10000,
  cw: 0x10001,
  quote: 0x20001,
  base: 0x20002,
  token0: 262144,
  token1: 262145,
  native: 0x01,
  R: 0x00,
  A: 0x10,
  B: 0x20,
  C: 0x30,
}

export const EventDataAbis = {
  PoolCreated: [
    'address FETCHER', // config.FETCHER,
    'bytes32 ORACLE', // config.ORACLE,
    'address TOKEN_R',
    'uint k', // config.K,
    'uint MARK', // config.MARK,
    'uint INTEREST_HL', // config.INTEREST_HL,
    'uint PREMIUM_HL', // config.PREMIUM_HL,
    'uint MATURITY', // config.MATURITY,
    'uint MATURITY_VEST', // config.MATURITY_VEST,
    'uint MATURITY_RATE', // config.MATURITY_RATE,
    'uint OPEN_RATE', // config.OPEN_RATE,
    'address poolAddress', // uint(uint160(pool))
  ],
  Swap: [
    'address payer',
    'address poolIn',
    'address poolOut',
    'address recipient',
    'uint sideIn',
    'uint sideOut',
    'uint amountIn',
    'uint amountOut',
  ],
  Swap1: [
    'address payer',
    'address poolIn',
    'address poolOut',
    'address recipient',
    'uint sideIn',
    'uint sideOut',
    'uint amountIn',
    'uint amountOut',
    'uint price',
  ],
  Swap2: [
    'address payer',
    'address poolIn',
    'address poolOut',
    'address recipient',
    'uint sideIn',
    'uint sideOut',
    'uint amountIn',
    'uint amountOut',
    'uint price',
    'uint priceR',
    'uint amountR',
  ],
}
