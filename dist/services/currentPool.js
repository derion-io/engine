"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentPool = void 0;
class CurrentPool {
    constructor(config) {
        this.config = config;
        this.chainId = config.chainId;
    }
    initCurrentPoolData(poolData) {
        for (let i in poolData) {
            // @ts-ignore
            // TODO: Logic checking & review
            this[i] = poolData[i];
        }
    }
}
exports.CurrentPool = CurrentPool;
//# sourceMappingURL=currentPool.js.map