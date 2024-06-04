export const SECONDS_PER_DAY = 86400

export const LARGE_VALUE = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
export const MINI_SECOND_PER_DAY = 86400000
export const LOCALSTORAGE_KEY = {
  DDL_LOGS: 'ddl-log-v1.2',
  LAST_BLOCK_DDL_LOGS: 'last-block-ddl-log-v1.2',
  SWAP_LOGS: 'swap-log-v1.2',
  SWAP_BLOCK_LOGS: 'last-block-swap-log-v1.2',
  TRANSFER_LOGS: 'transfer-log-v1.2',
  TRANSFER_BLOCK_LOGS: 'last-block-transfer-log-v1.2',
  ACCOUNT_LOGS: 'account-log-v1.2',
  ACCOUNT_BLOCK_LOGS: 'account-block-log-v1.2',
}
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
