"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Profile = void 0;
const constant_1 = require("./utils/constant");
const BnA_json_1 = __importDefault(require("./abi/BnA.json"));
const ERC20_json_1 = __importDefault(require("./abi/ERC20.json"));
const TokensInfo_json_1 = __importDefault(require("./abi/TokensInfo.json"));
const Events_json_1 = __importDefault(require("./abi/Events.json"));
const PairDetail_json_1 = __importDefault(require("./abi/PairDetail.json"));
const PairV3Detail_json_1 = __importDefault(require("./abi/PairV3Detail.json"));
const FetcherV2Mock_json_1 = __importDefault(require("./abi/FetcherV2Mock.json"));
const Pool_json_1 = __importDefault(require("./abi/Pool.json"));
const ReserveTokenPrice_json_1 = __importDefault(require("./abi/ReserveTokenPrice.json"));
const Token_json_1 = __importDefault(require("./abi/Token.json"));
const Helper_json_1 = __importDefault(require("./abi/Helper.json"));
const View_json_1 = __importDefault(require("./abi/View.json"));
const UTR_json_1 = __importDefault(require("./abi/UTR.json"));
const FetcherV2_json_1 = __importDefault(require("./abi/FetcherV2.json"));
const UTROverride_json_1 = __importDefault(require("./abi/UTROverride.json"));
const FetcherV2Override_json_1 = __importDefault(require("./abi/FetcherV2Override.json"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const abis = {
    BnA: BnA_json_1.default,
    FetcherV2: FetcherV2_json_1.default,
    ERC20: ERC20_json_1.default,
    Events: Events_json_1.default,
    PairDetail: PairDetail_json_1.default,
    PairV3Detail: PairV3Detail_json_1.default,
    Pool: Pool_json_1.default,
    ReserveTokenPrice: ReserveTokenPrice_json_1.default,
    Token: Token_json_1.default,
    TokensInfo: TokensInfo_json_1.default,
    Helper: Helper_json_1.default,
    View: View_json_1.default,
    UTR: UTR_json_1.default,
    UTROverride: UTROverride_json_1.default,
    FetcherV2Mock: FetcherV2Mock_json_1.default,
    FetcherV2Override: FetcherV2Override_json_1.default,
};
const DDL_CONFIGS_URL = {
    development: `https://raw.githubusercontent.com/derion-io/configs/dev/`,
    production: `https://raw.githubusercontent.com/derion-io/configs/main/`,
};
// TODO: Change name from profile to ...
class Profile {
    constructor(engineConfig) {
        this.chainId = engineConfig.chainId;
        this.env = engineConfig.env || 'production';
    }
    async loadConfig() {
        const [networkConfig, uniV3Pools, whitelistPools] = await Promise.all([
            (0, node_fetch_1.default)(DDL_CONFIGS_URL[this.env] + this.chainId + '/network.json')
                .then((r) => r.json())
                .catch(() => []),
            (0, node_fetch_1.default)(DDL_CONFIGS_URL[this.env] + this.chainId + '/routes.json')
                .then((r) => r.json())
                .catch(() => []),
            (0, node_fetch_1.default)(DDL_CONFIGS_URL[this.env] + this.chainId + '/pools.json')
                .then((r) => r.json())
                .catch(() => []),
        ]);
        this.configs = networkConfig;
        this.routes = uniV3Pools;
        this.whitelistPools = whitelistPools;
        // this.configs.helperContract.utr = '0x2222C5F0999E74D8D88F7bbfE300147d34c22222'
    }
    getAbi(name) {
        //@ts-ignore
        return abis[name] ? abis[name] : abis[this.chainId][name] || [];
    }
    getEventDataAbi() {
        return constant_1.EventDataAbis;
    }
    getExp(fetcher) {
        return this.configs?.fetchers?.[fetcher]?.type?.endsWith('3') ? 2 : 1;
    }
}
exports.Profile = Profile;
//# sourceMappingURL=profile.js.map