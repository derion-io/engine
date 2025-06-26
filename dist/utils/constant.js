"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDataAbis = exports.POOL_IDS = exports.FeeAmount = exports.PARA_BUILD_TX_BASE_URL = exports.PARA_VERSION = exports.PARA_DATA_BASE_URL = exports.LOCALSTORAGE_KEY = exports.MINI_SECOND_PER_DAY = exports.NATIVE_ADDRESS = exports.ZERO_ADDRESS = exports.LARGE_VALUE = exports.POOL_INIT_CODE_HASH = exports.SECONDS_PER_DAY = void 0;
exports.SECONDS_PER_DAY = 86400;
exports.POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';
exports.LARGE_VALUE = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
exports.ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
exports.NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
exports.MINI_SECOND_PER_DAY = 86400000;
exports.LOCALSTORAGE_KEY = {
    DDL_LOGS: 'ddl-log-v1.2',
    LAST_BLOCK_DDL_LOGS: 'last-block-ddl-log-v1.2',
    SWAP_LOGS: 'swap-log-v1.2',
    SWAP_BLOCK_LOGS: 'last-block-swap-log-v1.2',
    TRANSFER_LOGS: 'transfer-log-v1.2',
    TRANSFER_BLOCK_LOGS: 'last-block-transfer-log-v1.2',
    ACCOUNT_LOGS: 'account-log-v1.2',
    ACCOUNT_BLOCK_LOGS: 'account-block-log-v1.2',
};
exports.PARA_DATA_BASE_URL = 'https://api.paraswap.io/prices';
exports.PARA_VERSION = "5";
exports.PARA_BUILD_TX_BASE_URL = 'https://api.paraswap.io/transactions';
var FeeAmount;
(function (FeeAmount) {
    FeeAmount[FeeAmount["LOWEST"] = 100] = "LOWEST";
    FeeAmount[FeeAmount["LOW"] = 500] = "LOW";
    FeeAmount[FeeAmount["MEDIUM"] = 3000] = "MEDIUM";
    FeeAmount[FeeAmount["HIGH"] = 10000] = "HIGH";
})(FeeAmount = exports.FeeAmount || (exports.FeeAmount = {}));
exports.POOL_IDS = {
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
};
exports.EventDataAbis = {
    PoolCreated: [
        'address FETCHER',
        'bytes32 ORACLE',
        'address TOKEN_R',
        'uint k',
        'uint MARK',
        'uint INTEREST_HL',
        'uint PREMIUM_HL',
        'uint MATURITY',
        'uint MATURITY_VEST',
        'uint MATURITY_RATE',
        'uint OPEN_RATE',
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
};
//# sourceMappingURL=constant.js.map