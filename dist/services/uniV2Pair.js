"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniV2Pair = void 0;
const ethers_1 = require("ethers");
const PairDetail_json_1 = __importDefault(require("../abi/PairDetail.json"));
const providers_1 = require("@ethersproject/providers");
const FLAG = '0x0000110000000000000000000000000000000000000000000000000000000111';
// type ConfigType = {
//   chainId: number
//   scanApi: string
//   provider: ethers.providers.Provider
// }
class UniV2Pair {
    constructor(config, profile) {
        this.pairsInfoAddress = `0x${PairDetail_json_1.default.deployedBytecode.slice(-40)}`;
        this.chainId = config.chainId;
        this.scanApi = profile.configs.scanApi;
        const provider = new providers_1.JsonRpcProvider(profile.configs.rpc);
        provider.setStateOverride({
            [this.pairsInfoAddress]: {
                code: PairDetail_json_1.default.deployedBytecode,
            },
        });
        this.provider = new providers_1.JsonRpcProvider(profile.configs.rpc);
    }
    async getPairInfo({ pairAddress, flag = FLAG }) {
        try {
            const pairDetailContract = new ethers_1.ethers.Contract(this.pairsInfoAddress, PairDetail_json_1.default.abi, this.provider);
            const res = await pairDetailContract.functions.query([pairAddress], flag);
            return res.details[0];
        }
        catch (e) {
            throw e;
        }
    }
    async getPairsInfo({ pairAddresses, flag = FLAG }) {
        try {
            const pairDetailContract = new ethers_1.ethers.Contract(this.pairsInfoAddress, PairDetail_json_1.default.abi, this.provider);
            const { details } = await pairDetailContract.functions.query(pairAddresses, flag);
            const result = {};
            for (let i = 0; i < pairAddresses.length; i++) {
                result[pairAddresses[i]] = details[i];
            }
            return result;
        }
        catch (e) {
            throw e;
        }
    }
}
exports.UniV2Pair = UniV2Pair;
//# sourceMappingURL=uniV2Pair.js.map