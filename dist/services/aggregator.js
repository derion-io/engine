"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Aggregator = void 0;
const ethers_1 = require("ethers");
const providers_1 = require("@ethersproject/providers");
const crypto_1 = __importDefault(require("crypto"));
const constant_1 = require("../utils/constant");
class Aggregator {
    constructor(config, profile, paraDataBaseURL, paraBuildTxBaseURL, paraVersion) {
        this.signer = config.signer;
        this.account = config.account;
        this.config = config;
        this.provider = new ethers_1.ethers.providers.JsonRpcProvider(profile.configs.rpc);
        this.overrideProvider = new providers_1.JsonRpcProvider(profile.configs.rpc);
        this.paraDataBaseURL = paraDataBaseURL || constant_1.PARA_DATA_BASE_URL;
        this.paraBuildTxBaseURL = paraBuildTxBaseURL || constant_1.PARA_BUILD_TX_BASE_URL;
        this.paraDataBaseVersion = paraVersion || constant_1.PARA_VERSION;
    }
    async getRateAndBuildTxSwapApi(getRateData, openData, helperOverride, slippage) {
        try {
            const rateData = await this.getRate(getRateData);
            if (rateData.error) {
                throw new Error(rateData.error);
            }
            const swapData = await this.buildTx(getRateData, rateData, slippage);
            if (swapData.error) {
                throw new Error(swapData.error);
            }
            let openTx = null;
            if (helperOverride) {
                openTx = await helperOverride.populateTransaction.aggregateAndOpen({
                    token: getRateData.srcToken,
                    tokenOperator: rateData.priceRoute.tokenTransferProxy,
                    aggregator: swapData.to,
                    aggregatorData: swapData.data,
                    pool: openData?.poolAddress,
                    side: openData?.poolId,
                    payer: constant_1.ZERO_ADDRESS,
                    recipient: this.config.account,
                    INDEX_R: 0,
                });
            }
            return {
                rateData,
                swapData,
                openTx,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async getRate(getRateData) {
        const amount = getRateData?.srcAmount || getRateData.destAmount;
        const rateData = await (await fetch(`${this.paraDataBaseURL}/?version=${this.paraDataBaseVersion}&srcToken=${getRateData.srcToken}&srcDecimals=${getRateData.srcDecimals}&destToken=${getRateData.destToken}&destDecimals=${getRateData.destDecimals}&amount=${amount}&side=${getRateData.side}&excludeDirectContractMethods=${getRateData.excludeDirectContractMethods || false}&otherExchangePrices=${getRateData.otherExchangePrices || true}&partner=${getRateData.partner}&network=${this.config.chainId}&userAddress=${this.config.account}`, {
            method: "GET",
            redirect: "follow"
        })).json();
        return rateData;
    }
    async buildTx(getRateData, rateData, slippage) {
        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
        const swapData = await (await fetch(`${this.paraBuildTxBaseURL}/${this.config.chainId}?ignoreGasEstimate=${getRateData.ignoreGasEstimate || true}&ignoreAllowance=${getRateData.ignoreAllowance || true}&gasPrice=${rateData.priceRoute.gasCost}`, {
            method: "POST",
            headers: myHeaders,
            body: JSON.stringify({
                ...getRateData,
                slippage: slippage || 500,
                partner: getRateData.partner,
                priceRoute: rateData.priceRoute,
            })
        })).json();
        return swapData;
    }
    generateSigner() {
        const id = crypto_1.default.randomBytes(32).toString('hex');
        const privateKey = `0x${id}`;
        return new ethers_1.ethers.Wallet(privateKey, this.overrideProvider);
    }
}
exports.Aggregator = Aggregator;
//# sourceMappingURL=aggregator.js.map