"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePool = void 0;
const ethers_1 = require("ethers");
const helper_1 = require("../utils/helper");
const providers_1 = require("@ethersproject/providers");
class CreatePool {
    constructor(config, profile) {
        this.account = config.account;
        this.chainId = config.chainId;
        this.scanApi = profile.configs.scanApi;
        this.provider = new providers_1.JsonRpcProvider(profile.configs.rpc);
        this.overrideProvider = new providers_1.JsonRpcProvider(profile.configs.rpc);
        this.signer = config.signer;
        this.profile = profile;
    }
    async callStaticCreatePool({ params, value, gasLimit }) {
        const helper = this.getStateCalHelperContract(this.signer);
        return await helper.callStatic.createPool(params, this.contractAddresses.poolFactory, {
            value: value || (0, helper_1.bn)(0),
            gasLimit: gasLimit || undefined,
        });
    }
    async createPool(params, gasLimit) {
        try {
            const newPoolConfigs = this.generateConfig(params.k, params.a, params.b, params.mark, params.recipient, params.oracle, params.initTime, params.halfLife);
            await this.callStaticCreatePool({
                params: newPoolConfigs,
                value: params.amountInit,
                gasLimit,
            });
            const helper = this.getStateCalHelperContract(this.signer);
            const res = await helper.createPool(newPoolConfigs, this.contractAddresses.poolFactory, {
                value: params.amountInit,
                gasLimit: gasLimit || undefined,
            });
            const tx = await res.wait(1);
            // TODO: tx status checking before return
            console.log('tx', tx);
            return true;
        }
        catch (error) {
            throw error;
        }
    }
    generateConfig(k, a, b, mark, recipient, oracle, initTime, halfLife) {
        try {
            return {
                utr: this.profile.configs.helperContract.utr,
                token: this.contractAddresses.token,
                logic: this.contractAddresses.logic,
                oracle,
                reserveToken: this.profile.configs.wrappedTokenAddress,
                recipient,
                mark,
                k,
                a,
                b,
                initTime,
                halfLife,
            };
        }
        catch (error) {
            throw error;
        }
    }
    getStateCalHelperContract(provider) {
        try {
            return new ethers_1.ethers.Contract(this.contractAddresses.stateCalHelper, this.profile.getAbi('Helper'), provider || this.provider);
        }
        catch (error) {
            throw error;
        }
    }
}
exports.CreatePool = CreatePool;
//# sourceMappingURL=createPool.js.map