"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Swap = void 0;
const ethers_1 = require("ethers");
const helper_1 = require("../utils/helper");
const constant_1 = require("../utils/constant");
const providers_1 = require("@ethersproject/providers");
const utils_1 = require("ethers/lib/utils");
const resource_1 = require("./resource");
const OracleSdkAdapter = __importStar(require("../utils/OracleSdkAdapter"));
const OracleSdk = __importStar(require("../utils/OracleSdk"));
const PAYMENT = 0;
const TRANSFER = 1;
const CALL_VALUE = 2;
class Swap {
    constructor(config, profile) {
        this.RESOURCE = config.RESOURCE;
        this.AGGREGATOR = config.AGGREGATOR;
        this.config = config;
        this.account = config.account ?? config.signer?._address ?? constant_1.ZERO_ADDRESS;
        this.chainId = config.chainId;
        this.scanApi = profile.configs.scanApi;
        this.provider = config.RESOURCE.provider;
        this.overrideProvider = config.RESOURCE.overrideProvider;
        this.providerGetProof = new providers_1.JsonRpcProvider(profile.configs.rpcGetProof || profile.configs.rpc);
        this.signer = config.signer ?? new ethers_1.VoidSigner(this.account, this.provider);
        this.profile = profile;
        this.derivableAdr = profile.configs.derivable;
    }
    async calculateAmountOuts({ steps, fetcherV2 = false, fetcherData, }) {
        if (!this.signer)
            return [[(0, helper_1.bn)(0)], (0, helper_1.bn)(0)];
        try {
            const { helperContract, gasLimitDefault, gasForProof } = this.profile.configs;
            const stepsToSwap = [...steps].map((step) => {
                return { ...step, amountOutMin: 0 };
            });
            const { params, value } = await this.convertStepToActions({
                steps: stepsToSwap,
                submitFetcherV2: fetcherV2,
                isCalculate: true,
                fetcherData,
            });
            const router = helperContract.utr;
            const contract = new ethers_1.ethers.Contract(router, this.profile.getAbi('UTROverride').abi, this.getOverrideProvider());
            const res = await contract.callStatic.exec(...params, {
                from: this.account,
                value,
                gasLimit: gasLimitDefault,
            });
            const result = [];
            for (const i in steps) {
                result.push({ ...steps[i], amountOut: res[0][i] });
            }
            let gasUsed = gasLimitDefault - res.gasLeft.toNumber();
            if (fetcherV2) {
                gasUsed += gasForProof ?? 800000;
            }
            return [result, (0, helper_1.bn)(gasUsed)];
        }
        catch (e) {
            throw e;
        }
    }
    async callStaticMultiSwap({ params, value, gasLimit }) {
        try {
            const contract = this.getRouterContract(this.signer);
            return await contract.callStatic.exec(...params, {
                value: value || (0, helper_1.bn)(0),
                gasLimit: gasLimit || undefined,
            });
        }
        catch (error) {
            throw error;
        }
    }
    async convertStepToActions({ steps, submitFetcherV2, isCalculate = false, fetcherData, }) {
        // @ts-ignore
        // const stateCalHelper = this.getStateCalHelperContract()
        const outputs = [];
        steps.forEach((step) => {
            const poolGroup = this.getPoolPoolGroup(step.tokenIn, step.tokenOut);
            outputs.push({
                recipient: this.account,
                eip: (0, helper_1.isErc1155Address)(step.tokenOut) ? 1155 : step.tokenOut === constant_1.NATIVE_ADDRESS ? 0 : 20,
                token: (0, helper_1.isErc1155Address)(step.tokenOut) ? this.derivableAdr.token : step.tokenOut,
                id: (0, helper_1.isErc1155Address)(step.tokenOut)
                    ? (0, helper_1.packId)(this.getIdByAddress(step.tokenOut, poolGroup.TOKEN_R).toString(), this.getAddressByErc1155Address(step.tokenOut, poolGroup.TOKEN_R))
                    : (0, helper_1.bn)(0),
                amountOutMin: step.amountOutMin,
            });
        });
        let nativeAmountToWrap = (0, helper_1.bn)(0);
        const metaDatas = [];
        const promises = [];
        const fetchStepPromise = steps.map(async (step) => {
            const poolGroup = this.getPoolPoolGroup(step.tokenIn, step.tokenOut);
            if ((step.tokenIn === constant_1.NATIVE_ADDRESS || step.tokenOut === constant_1.NATIVE_ADDRESS) &&
                poolGroup.TOKEN_R !== this.profile.configs.wrappedTokenAddress) {
                throw 'This pool do not support swap by native Token';
            }
            const poolIn = this.getAddressByErc1155Address(step.tokenIn, poolGroup.TOKEN_R);
            const poolOut = this.getAddressByErc1155Address(step.tokenOut, poolGroup.TOKEN_R);
            const idIn = this.getIdByAddress(step.tokenIn, poolGroup.TOKEN_R);
            const idOut = this.getIdByAddress(step.tokenOut, poolGroup.TOKEN_R);
            if (step.tokenIn === constant_1.NATIVE_ADDRESS) {
                nativeAmountToWrap = nativeAmountToWrap.add(step.amountIn);
            }
            if (step.useSweep && (0, helper_1.isErc1155Address)(step.tokenOut)) {
                const { inputs, populateTxData } = await this.getSweepCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut });
                metaDatas.push({
                    code: this.derivableAdr.stateCalHelper,
                    inputs,
                }, {
                    code: this.derivableAdr.stateCalHelper,
                    inputs: [],
                });
                promises.push(...populateTxData);
            }
            else {
                const { inputs, populateTxData } = await this.getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut });
                metaDatas.push({
                    code: this.derivableAdr.stateCalHelper,
                    inputs,
                });
                promises.push(...populateTxData);
            }
            if (submitFetcherV2 && !fetcherData) {
                const pool = (0, helper_1.isErc1155Address)(step.tokenIn) ? this.RESOURCE.pools[poolIn] : this.RESOURCE.pools[poolOut];
                if (pool?.window) {
                    promises.push(isCalculate ? this.fetchPriceMockTx(pool) : this.fetchPriceTx(pool));
                }
            }
        });
        await Promise.all(fetchStepPromise);
        const datas = await Promise.all(promises);
        const actions = [];
        metaDatas.forEach((metaData, key) => {
            actions.push({ ...metaData, data: datas[key].data });
        });
        if (submitFetcherV2 && !fetcherData) {
            for (let i = metaDatas.length; i < datas.length; i++) {
                actions.unshift(datas[datas.length - 1]);
            }
        }
        else if (submitFetcherV2 && fetcherData) {
            actions.unshift(fetcherData);
        }
        return { params: [outputs, actions], value: nativeAmountToWrap };
    }
    async getSweepCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut }) {
        try {
            const stateCalHelper = this.getStateCalHelperContract();
            const swapCallData = await this.getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut });
            const inputs = [
                {
                    mode: TRANSFER,
                    eip: 1155,
                    token: this.derivableAdr.token,
                    id: (0, helper_1.packId)(idOut + '', poolOut),
                    amountIn: step.currentBalanceOut,
                    recipient: stateCalHelper.address,
                },
                ...swapCallData.inputs,
            ];
            const populateTxData = [
                ...swapCallData.populateTxData,
                stateCalHelper.populateTransaction.sweep((0, helper_1.packId)(idOut + '', poolOut), this.account),
            ];
            return {
                inputs,
                populateTxData,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut }) {
        try {
            const inputs = step.tokenIn === constant_1.NATIVE_ADDRESS
                ? [
                    {
                        mode: CALL_VALUE,
                        token: constant_1.ZERO_ADDRESS,
                        eip: 0,
                        id: 0,
                        amountIn: step.amountIn,
                        recipient: constant_1.ZERO_ADDRESS,
                    },
                ]
                : [
                    {
                        mode: (0, helper_1.isErc1155Address)(step.tokenIn) ? PAYMENT : TRANSFER,
                        eip: (0, helper_1.isErc1155Address)(step.tokenIn) ? 1155 : 20,
                        token: (0, helper_1.isErc1155Address)(step.tokenIn) ? this.derivableAdr.token : step.tokenIn,
                        id: (0, helper_1.isErc1155Address)(step.tokenIn) ? (0, helper_1.packId)(idIn.toString(), poolIn) : 0,
                        amountIn: step.amountIn,
                        recipient: (0, utils_1.isAddress)(step.tokenIn) && this.wrapToken(step.tokenIn) !== poolGroup.TOKEN_R
                            ? this.getStateCalHelperContract().address
                            // this.getUniPool(step.tokenIn, poolGroup.TOKEN_R)
                            : (0, helper_1.isErc1155Address)(step.tokenIn)
                                ? poolIn
                                : poolOut,
                    },
                ];
            const populateTxData = [];
            let amountIn = step.payloadAmountIn ? step.payloadAmountIn : step.amountIn;
            const OPEN_RATE = this.RESOURCE.pools[poolOut]?.OPEN_RATE;
            if (OPEN_RATE && [constant_1.POOL_IDS.A, constant_1.POOL_IDS.B].includes(idOut.toNumber())) {
                amountIn = amountIn.mul(OPEN_RATE).div(resource_1.Q128);
            }
            if ((0, utils_1.isAddress)(step.tokenIn) && this.wrapToken(step.tokenIn) !== poolGroup.TOKEN_R) {
                const srcDecimals = this.RESOURCE.tokens.find((t) => t.address === step.tokenIn)?.decimals || 18;
                const destDecimals = this.RESOURCE.tokens.find((t) => t.address === poolGroup.TOKEN_R)?.decimals || 18;
                const getRateData = {
                    userAddress: this.getStateCalHelperContract().address,
                    ignoreChecks: true,
                    srcToken: step.tokenIn,
                    srcDecimals,
                    srcAmount: amountIn.toString(),
                    destToken: poolGroup.TOKEN_R,
                    destDecimals,
                    partner: 'derion.io',
                    side: 'SELL',
                };
                // console.log(getRateData)
                const openData = {
                    poolAddress: poolOut,
                    poolId: idOut.toNumber()
                };
                const { openTx } = await this.AGGREGATOR.getRateAndBuildTxSwapApi(getRateData, openData, this.getStateCalHelperContract());
                // console.log(openTx)
                populateTxData.push(openTx);
                // populateTxData.push(
                //   this.generateSwapParams('swapAndOpen', {
                //     side: idOut,
                //     deriPool: poolOut,
                //     uniPool: this.getUniPool(step.tokenIn, poolGroup.TOKEN_R),
                //     token: step.tokenIn,
                //     amount: amountIn,
                //     payer: this.account,
                //     recipient: this.account,
                //     INDEX_R: this.getIndexR(poolGroup.TOKEN_R),
                //   }),
                // )
            }
            else if ((0, utils_1.isAddress)(step.tokenOut) && this.wrapToken(step.tokenOut) !== poolGroup.TOKEN_R) {
                populateTxData.push(this.generateSwapParams('closeAndSwap', {
                    side: idIn,
                    deriPool: poolIn,
                    uniPool: this.getUniPool(step.tokenOut, poolGroup.TOKEN_R),
                    token: step.tokenOut,
                    amount: step.payloadAmountIn ? step.payloadAmountIn : step.amountIn,
                    payer: this.account,
                    recipient: this.account,
                    INDEX_R: this.getIndexR(poolGroup.TOKEN_R),
                }));
            }
            else {
                populateTxData.push(this.generateSwapParams('swap', {
                    sideIn: idIn,
                    poolIn: (0, helper_1.isErc1155Address)(step.tokenIn) ? poolIn : poolOut,
                    sideOut: idOut,
                    poolOut: (0, helper_1.isErc1155Address)(step.tokenOut) ? poolOut : poolIn,
                    amountIn,
                    maturity: 0,
                    payer: this.account,
                    recipient: this.account,
                    INDEX_R: this.getIndexR(poolGroup.TOKEN_R),
                }));
            }
            return {
                inputs,
                populateTxData,
            };
        }
        catch (error) {
            throw error;
        }
    }
    wrapToken(address) {
        if (address === constant_1.NATIVE_ADDRESS) {
            return this.profile.configs.wrappedTokenAddress;
        }
        return address;
    }
    generateSwapParams(method, params) {
        try {
            const stateCalHelper = this.getStateCalHelperContract();
            const functionInterface = Object.values(stateCalHelper.interface.functions).find((f) => f.name === method)?.inputs[0].components;
            const formattedParams = {};
            for (const name in params) {
                if (functionInterface?.find((c) => c.name === name)) {
                    formattedParams[name] = params[name];
                }
            }
            return stateCalHelper.populateTransaction[method](formattedParams);
        }
        catch (error) {
            throw error;
        }
    }
    getIdByAddress(address, TOKEN_R) {
        try {
            if ((0, helper_1.isErc1155Address)(address)) {
                return (0, helper_1.bn)(address.split('-')[1]);
            }
            else if (address === TOKEN_R) {
                return (0, helper_1.bn)(constant_1.POOL_IDS.R);
            }
            else if (address === constant_1.NATIVE_ADDRESS && TOKEN_R === this.profile.configs.wrappedTokenAddress) {
                return (0, helper_1.bn)(constant_1.POOL_IDS.native);
            }
            return (0, helper_1.bn)(0);
        }
        catch (e) {
            throw new Error('Token id not found');
        }
    }
    getPoolPoolGroup(addressIn, addressOut) {
        try {
            const poolIn = (0, helper_1.isErc1155Address)(addressIn) ? this.RESOURCE.pools[addressIn.split('-')[0]] : null;
            const poolOut = (0, helper_1.isErc1155Address)(addressOut) ? this.RESOURCE.pools[addressOut.split('-')[0]] : null;
            if (!poolIn && !poolOut) {
                throw 'Cannot detect pool to swap';
            }
            if (poolIn && poolOut && poolIn.TOKEN_R !== poolOut.TOKEN_R) {
                throw 'Cannot swap throw multi pool (need to same Token R)';
            }
            const result = { pools: {}, TOKEN_R: '' };
            if (poolIn) {
                result.pools[poolIn.poolAddress] = poolIn;
                result.TOKEN_R = poolIn.TOKEN_R;
            }
            if (poolOut) {
                result.pools[poolOut.poolAddress] = poolOut;
                result.TOKEN_R = poolOut.TOKEN_R;
            }
            return result;
        }
        catch (error) {
            throw error;
        }
    }
    async multiSwap({ steps, gasLimit, gasPrice, fetcherData, onSubmitted, submitFetcherV2 = false, callStatic = false, }) {
        try {
            const { params, value } = await this.convertStepToActions({
                steps: [...steps],
                submitFetcherV2,
                fetcherData,
            });
            // await this.callStaticMultiSwap({
            //   params,
            //   value,
            //   gasLimit,
            //   gasPrice: gasPrice || undefined
            // })
            const utr = this.getRouterContract(this.signer);
            params.push({
                value,
                gasLimit: gasLimit || undefined,
                gasPrice: gasPrice || undefined,
            });
            if (callStatic) {
                return await utr.callStatic.exec(...params);
            }
            const res = await utr.exec(...params);
            if (onSubmitted) {
                onSubmitted({ hash: res.hash, steps });
            }
            const tx = await res.wait(1);
            console.log('tx', tx);
            return tx;
        }
        catch (e) {
            throw e;
        }
    }
    getAddressByErc1155Address(address, TOKEN_R) {
        try {
            if ((0, helper_1.isErc1155Address)(address)) {
                return address.split('-')[0];
            }
            if (address === constant_1.NATIVE_ADDRESS && TOKEN_R === this.profile.configs.wrappedTokenAddress) {
                return this.profile.configs.wrappedTokenAddress;
            }
            return address;
        }
        catch (error) {
            throw error;
        }
    }
    getRouterContract(provider) {
        return new ethers_1.ethers.Contract(this.profile.configs.helperContract.utr, this.profile.getAbi('UTR'), provider);
    }
    getStateCalHelperContract(provider) {
        return new ethers_1.ethers.Contract(this.derivableAdr.stateCalHelper, this.profile.getAbi('Helper'), provider || this.provider);
    }
    getIndexR(tokenR) {
        try {
            const { quoteTokenIndex, address } = this.RESOURCE.getSingleRouteToUSD(tokenR) ?? {};
            if (!address) {
                return (0, helper_1.bn)(0);
            }
            return (0, helper_1.bn)(ethers_1.ethers.utils.hexZeroPad((0, helper_1.bn)(quoteTokenIndex).shl(255).add(address).toHexString(), 32));
        }
        catch (error) {
            throw error;
        }
    }
    getUniPool(tokenIn, tokenR) {
        try {
            const routeKey = Object.keys(this.profile.routes).find((r) => {
                return r === `${tokenR}-${tokenIn}` || r === `${tokenIn}-${tokenR}`;
            });
            if (!this.profile.routes[routeKey || ''] || !this.profile.routes[routeKey || ''][0].address) {
                console.error(`Can't find router, please select other token`);
                throw `Can't find router, please select other token`;
            }
            return this.profile.routes[routeKey || ''][0].address;
        }
        catch (error) {
            throw error;
        }
    }
    async needToSubmitFetcher(pool) {
        try {
            const fetcherContract = new ethers_1.Contract(pool.FETCHER, this.profile.getAbi('FetcherV2'), this.signer);
            await fetcherContract.callStatic.fetch(pool.ORACLE);
        }
        catch (e) {
            if (e?.reason === 'OLD') {
                return true;
            }
        }
        return false;
    }
    async fetchPriceTx(pool, blockNumber) {
        try {
            if (blockNumber == null) {
                blockNumber = await this.provider.getBlockNumber();
            }
            const getProof = OracleSdkAdapter.getProofFactory(this.providerGetProof);
            const getBlockByNumber = OracleSdkAdapter.getBlockByNumberFactory(this.overrideProvider);
            // get the proof from the SDK
            const proof = await OracleSdk.getProof(getProof, getBlockByNumber, pool.pair, pool.quoteTokenIndex, blockNumber - (pool.window.toNumber() >> 1));
            // Connect to the network
            const contractWithSigner = new ethers_1.Contract(pool.FETCHER, this.profile.getAbi('FetcherV2'), this.signer);
            const data = await contractWithSigner.populateTransaction.submit(pool.ORACLE, proof);
            return {
                inputs: [],
                code: pool.FETCHER,
                data: data.data,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async fetchPriceMockTx(pool, blockNumber) {
        try {
            if (blockNumber == null) {
                blockNumber = await this.provider.getBlockNumber();
            }
            const targetBlock = blockNumber - (pool.window.toNumber() >> 1);
            const getStorageAt = OracleSdkAdapter.getStorageAtFactory(this.overrideProvider);
            const accumulator = await OracleSdk.getAccumulatorPrice(getStorageAt, pool.pair, pool.quoteTokenIndex, targetBlock);
            // Connect to the network
            const contractWithSigner = new ethers_1.Contract(pool.FETCHER, this.profile.getAbi('FetcherV2Mock').abi, this.signer);
            const data = await contractWithSigner.populateTransaction.submitPrice(pool.ORACLE, (0, helper_1.bn)(accumulator.price), targetBlock, accumulator.timestamp);
            return {
                inputs: [],
                code: pool.FETCHER,
                data: data.data,
            };
        }
        catch (error) {
            throw error;
        }
    }
    getOverrideProvider() {
        try {
            const router = this.profile.configs.helperContract.utr;
            const fetcherV2 = this.profile.configs.derivable.uniswapV2Fetcher;
            this.overrideProvider.setStateOverride({
                [router]: {
                    code: this.profile.getAbi('UTROverride').deployedBytecode,
                },
                ...(fetcherV2
                    ? {
                        [fetcherV2]: {
                            code: this.profile.getAbi('FetcherV2Mock').deployedBytecode,
                        },
                    }
                    : {}),
            });
            return this.overrideProvider;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.Swap = Swap;
//# sourceMappingURL=swap.js.map