"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = void 0;
const price_1 = require("./services/price");
const resource_1 = require("./services/resource");
const balanceAndAllowance_1 = require("./services/balanceAndAllowance");
const uniV2Pair_1 = require("./services/uniV2Pair");
const history_1 = require("./services/history");
const swap_1 = require("./services/swap");
const currentPool_1 = require("./services/currentPool");
const createPool_1 = require("./services/createPool");
const uniV3Pair_1 = require("./services/uniV3Pair");
const profile_1 = require("./profile");
const aggregator_1 = require("./services/aggregator");
class Engine {
    constructor(enginConfigs, profile = profile_1.Profile) {
        this.enginConfigs = enginConfigs;
        this.account = enginConfigs.account;
        // this.providerToGetLog = this.config.providerToGetLog
        this.profile = new profile(enginConfigs);
    }
    async initServices() {
        await this.profile.loadConfig();
        this.UNIV2PAIR = new uniV2Pair_1.UniV2Pair(this.enginConfigs, this.profile);
        this.UNIV3PAIR = new uniV3Pair_1.UniV3Pair(this.enginConfigs, this.profile);
        this.RESOURCE = new resource_1.Resource(this.enginConfigs, this.profile);
        this.CURRENT_POOL = new currentPool_1.CurrentPool(this.enginConfigs);
        this.CREATE_POOL = new createPool_1.CreatePool(this.enginConfigs, this.profile);
        const configs = {
            ...this.enginConfigs,
            RESOURCE: this.RESOURCE,
        };
        this.BNA = new balanceAndAllowance_1.BnA(configs, this.profile);
        this.PRICE = new price_1.Price(configs, this.profile);
        this.HISTORY = new history_1.History(configs, this.profile);
        this.AGGREGATOR = new aggregator_1.Aggregator(this.enginConfigs, this.profile);
        this.SWAP = new swap_1.Swap({ ...configs, AGGREGATOR: this.AGGREGATOR }, this.profile);
    }
    setCurrentPool(poolData) {
        this.CURRENT_POOL.initCurrentPoolData(poolData);
    }
}
exports.Engine = Engine;
//# sourceMappingURL=engine.js.map