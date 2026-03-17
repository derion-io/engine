// Re-export from SDK
export {
  POOL_IDS,
  NATIVE_ADDRESS,
  EventDataAbis,
  Q128,
  M256,
  BIG_E18,
  BIG_0,
  SECONDS_PER_DAY,
  MINI_SECOND_PER_DAY,
  PARA_DATA_BASE_URL,
  PARA_VERSION,
  PARA_BUILD_TX_BASE_URL,
} from 'derion-sdk/utils/constant'

// Engine-only constants
export const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54'
export const LARGE_VALUE = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
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

export enum FeeAmount {
  LOWEST = 100,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000
}
