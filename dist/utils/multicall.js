"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multicall = void 0;
const ethereum_multicall_1 = require("ethereum-multicall");
const multicall = async (ethersProvider, contexts, tryAggregate = true) => {
    const callbacks = {};
    for (const context of contexts) {
        if (callbacks[context.reference]) {
            throw new Error(`dupplicated reference: ${context.reference}`);
        }
        callbacks[context.reference] = context.context;
        delete context.context;
    }
    const multicall = new ethereum_multicall_1.Multicall({ ethersProvider, tryAggregate });
    const { results } = await multicall.call(contexts);
    return Object.values(results).map(result => {
        const callback = callbacks[result.originalContractCallContext.reference];
        if (callback != null && typeof callback === 'function') {
            return callback(result.callsReturnContext);
        }
    });
};
exports.multicall = multicall;
//# sourceMappingURL=multicall.js.map