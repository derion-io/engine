"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Price = void 0;
const ethers_1 = require("ethers");
const ReserveTokenPrice_json_1 = __importDefault(require("../abi/ReserveTokenPrice.json"));
const TokenPriceByRoute_json_1 = __importDefault(require("../abi/TokenPriceByRoute.json"));
const providers_1 = require("@ethersproject/providers");
const helper_1 = require("../utils/helper");
const constant_1 = require("../utils/constant");
const historyProvider_1 = __importDefault(require("../historyProvider"));
const utils_1 = require("ethers/lib/utils");
const lodash_1 = __importDefault(require("lodash"));
class Price {
    constructor(config, profile) {
        this.reserveTokenPrice = `0x${ReserveTokenPrice_json_1.default.deployedBytecode.slice(-40)}`;
        this.tokenPriceByRoute = `0x${TokenPriceByRoute_json_1.default.deployedBytecode.slice(-40)}`;
        this.chainId = config.chainId;
        this.scanApi = profile.configs.scanApi;
        this.provider = new providers_1.JsonRpcProvider(profile.configs.rpc);
        this.rpcUrl = profile.configs.rpc;
        this.profile = profile;
        this.RESOURCE = config.RESOURCE;
    }
    async get24hChange({ baseToken, cToken, quoteToken, chainId, currentPrice, toTimeMs }) {
        try {
            toTimeMs = toTimeMs ?? new Date().getTime();
            const toTime = Math.floor((toTimeMs - constant_1.MINI_SECOND_PER_DAY) / 1000);
            const result = await historyProvider_1.default.getBars({
                to: toTime,
                limit: 1,
                chainId,
                resolution: '1',
                route: `${baseToken.address}/${cToken}/${quoteToken.address}`,
                outputToken: quoteToken,
                inputToken: baseToken,
                barValueType: 'string',
            });
            const beforePrice = result[0].open;
            return (0, helper_1.formatPercent)((0, helper_1.div)((0, helper_1.sub)(currentPrice, beforePrice), beforePrice));
        }
        catch (e) {
            throw e;
        }
    }
    async getTokenPriceByRoutes() {
        try {
            const results = {};
            const tokens = this.RESOURCE.tokens;
            const params = this._genFetchTokenParams();
            const provider = new providers_1.JsonRpcProvider(this.rpcUrl);
            provider.setStateOverride({
                [this.tokenPriceByRoute]: {
                    code: TokenPriceByRoute_json_1.default.deployedBytecode,
                },
            });
            const contract = new ethers_1.ethers.Contract(this.tokenPriceByRoute, TokenPriceByRoute_json_1.default.abi, provider);
            const prices = await contract.functions.fetchPrices(params);
            if (prices?.[0]) {
                params.forEach(({ tokenQuote, tokenBase }, key) => {
                    const tokenBaseObject = tokens.find((t) => t.address === tokenBase);
                    const tokenQuoteObject = tokens.find((t) => t.address === tokenQuote);
                    if (!tokenBaseObject || !tokenQuoteObject)
                        return;
                    results[tokenBase] = (0, helper_1.parseSqrtX96)(prices[0][key], tokenBaseObject, tokenQuoteObject);
                });
            }
            const whiteListToken = this.profile.configs.tokens;
            for (const address in whiteListToken) {
                if (whiteListToken[address].price) {
                    results[address] = whiteListToken[address].price ?? 1;
                }
            }
            return results;
        }
        catch (error) {
            throw error;
        }
    }
    _genFetchTokenParams() {
        try {
            return lodash_1.default.uniqBy(Object.keys(this.profile.routes)
                .filter((pair) => {
                const [token0, token1] = pair.split('-');
                return this.profile.configs.stablecoins.includes(token0) || this.profile.configs.stablecoins.includes(token1);
            })
                .map((pairs) => {
                let routes = this.profile.routes[pairs].map((route) => {
                    return {
                        version: route.type === 'uniswap3' ? 3 : 2,
                        uniPool: route.address,
                    };
                });
                let [tokenBase, tokenQuote] = pairs.split('-');
                if (this.profile.configs.stablecoins.includes(tokenBase)) {
                    ;
                    [tokenBase, tokenQuote] = [tokenQuote, tokenBase];
                    routes = routes.reverse();
                }
                return { tokenBase, tokenQuote, routes: routes };
            }), 'tokenBase');
        }
        catch (error) {
            throw error;
        }
    }
    async getTokenPrices(tokens) {
        try {
            const provider = new providers_1.JsonRpcProvider(this.rpcUrl);
            provider.setStateOverride({
                [this.reserveTokenPrice]: {
                    code: ReserveTokenPrice_json_1.default.deployedBytecode,
                },
            });
            const pairDetailContract = new ethers_1.ethers.Contract(this.reserveTokenPrice, ReserveTokenPrice_json_1.default.abi, provider);
            const whiteListToken = this.profile.configs.tokens;
            const _tokensToFetch = tokens.filter((t) => {
                return !whiteListToken?.[t]?.price && (0, utils_1.isAddress)(t);
            });
            const res = await pairDetailContract.functions.fetchMarketBatch(_tokensToFetch, this.profile.configs.uniswap.v3Factory, this.profile.configs.stablecoins, this.profile.configs.wrappedTokenAddress, this.profile.configs.stablecoins[0]);
            const result = {};
            for (const i in _tokensToFetch) {
                result[_tokensToFetch[i]] = res.sqrtPriceX96[i];
            }
            if (whiteListToken) {
                for (const address in whiteListToken) {
                    if (whiteListToken[address].price) {
                        result[address] = (0, helper_1.bn)(whiteListToken[address].price ?? '0x01000000000000000000000000');
                    }
                }
            }
            return result;
        }
        catch (e) {
            throw e;
        }
    }
}
exports.Price = Price;
//# sourceMappingURL=price.js.map