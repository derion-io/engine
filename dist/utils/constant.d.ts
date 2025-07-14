export declare const SECONDS_PER_DAY = 86400;
export declare const POOL_INIT_CODE_HASH = "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54";
export declare const LARGE_VALUE = "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
export declare const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export declare const NATIVE_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export declare const MINI_SECOND_PER_DAY = 86400000;
export declare const LOCALSTORAGE_KEY: {
    DDL_LOGS: string;
    LAST_BLOCK_DDL_LOGS: string;
    SWAP_LOGS: string;
    SWAP_BLOCK_LOGS: string;
    TRANSFER_LOGS: string;
    TRANSFER_BLOCK_LOGS: string;
    ACCOUNT_LOGS: string;
    ACCOUNT_BLOCK_LOGS: string;
};
export declare const PARA_DATA_BASE_URL = "https://api.paraswap.io/prices";
export declare const PARA_VERSION = "5";
export declare const PARA_BUILD_TX_BASE_URL = "https://api.paraswap.io/transactions";
export declare enum FeeAmount {
    LOWEST = 100,
    LOW = 500,
    MEDIUM = 3000,
    HIGH = 10000
}
export declare const POOL_IDS: {
    cToken: number;
    cp: number;
    cw: number;
    quote: number;
    base: number;
    token0: number;
    token1: number;
    native: number;
    R: number;
    A: number;
    B: number;
    C: number;
};
export declare const EventDataAbis: {
    PoolCreated: string[];
    Swap: string[];
    Swap1: string[];
    Swap2: string[];
};
