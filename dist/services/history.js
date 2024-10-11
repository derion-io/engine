"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.History = void 0;
const ethers_1 = require("ethers");
const constant_1 = require("../utils/constant");
const helper_1 = require("../utils/helper");
const resource_1 = require("./resource");
const ERC20_json_1 = __importDefault(require("../abi/ERC20.json"));
const balanceAndAllowance_1 = require("./balanceAndAllowance");
const POS_IDS = [constant_1.POOL_IDS.A, constant_1.POOL_IDS.B, constant_1.POOL_IDS.C];
const TOPICS = (0, helper_1.getTopics)();
class History {
    constructor(config, profile) {
        this.config = config;
        this.account = config.account;
        this.RESOURCE = config.RESOURCE;
        this.profile = profile;
    }
    // TODO: refactor position type
    generatePositions({ tokens, logs, transferLogs }) {
        try {
            if (!logs || logs.length === 0) {
                return [];
            }
            let positions = {};
            logs.forEach((log) => {
                positions = this.generatePositionBySwapLog(positions, tokens, log);
            });
            if (transferLogs?.length && transferLogs?.length > 0) {
                transferLogs.forEach((log) => {
                    positions = this.generatePositionByTransferLog(positions, log);
                });
            }
            return positions;
        }
        catch (e) {
            throw e;
        }
    }
    generatePositionByTransferLog(positions, tranferLog) {
        if (TOPICS.TransferSingle.includes(tranferLog.topics[0])) {
            const { from, to, id, value } = tranferLog.args;
            const key = (0, balanceAndAllowance_1.keyFromTokenId)(id);
            console.log({ from, to, key, value: value.toString() }, this.account);
            if (to == this.account) {
                positions[key].balanceForPrice = positions[key]?.balanceForPrice.add(value);
                positions[key].balanceForPriceR = positions[key]?.balanceForPriceR.add(value);
            }
            if (from == this.account) {
                positions[key].balanceForPrice = positions[key]?.balanceForPrice.sub(value);
                positions[key].balanceForPriceR = positions[key]?.balanceForPriceR.sub(value);
            }
        }
        if (TOPICS.TransferBatch.includes(tranferLog.topics[0])) {
            const { from, to, ids, } = tranferLog.args;
            // TODO: where is log.args.values?
            const values = tranferLog.args['4'];
            for (let i = 0; i < ids.length; ++i) {
                const value = values[i];
                const key = (0, balanceAndAllowance_1.keyFromTokenId)(ids[i]);
                if (to == this.account) {
                    positions[key].balanceForPrice = positions[key]?.balanceForPrice.add(value);
                    positions[key].balanceForPriceR = positions[key]?.balanceForPriceR.add(value);
                }
                if (from == this.account) {
                    positions[key].balanceForPrice = positions[key]?.balanceForPrice.sub(value);
                    positions[key].balanceForPriceR = positions[key]?.balanceForPriceR.sub(value);
                }
            }
        }
        console.log(positions);
        return positions;
    }
    // TODO: refactor position type
    generatePositionBySwapLog(positions, tokens, log) {
        try {
            const { derivable: { playToken }, tokens: whiteListToken, } = this.profile.configs;
            const pools = this.RESOURCE.pools;
            const poolAddresses = Object.keys(this.RESOURCE.pools);
            const abi = this.getSwapAbi(log.topics[0]);
            const encodeData = ethers_1.ethers.utils.defaultAbiCoder.encode(abi, log.args);
            const formatedData = ethers_1.ethers.utils.defaultAbiCoder.decode(abi, encodeData);
            const { poolIn, poolOut, sideIn, sideOut, amountOut, amountIn, priceR, price } = formatedData;
            let { amountR } = formatedData;
            if (!poolAddresses.includes(poolIn) || !poolAddresses.includes(poolOut)) {
                return positions;
            }
            const tokenInAddress = this.getTokenAddressByPoolAndSide(poolIn, formatedData.sideIn);
            const tokenOutAddress = this.getTokenAddressByPoolAndSide(poolOut, formatedData.sideOut);
            // if (POS_IDS.includes(sideOut.toNumber())) {
            if (!positions[tokenOutAddress]) {
                positions[tokenOutAddress] = {
                    avgPriceR: 0,
                    avgPrice: 0,
                    balanceForPriceR: (0, helper_1.bn)(0),
                    balanceForPrice: (0, helper_1.bn)(0),
                    amountR: (0, helper_1.bn)(0),
                };
            }
            const pool = pools[poolOut];
            if (POS_IDS.includes(sideIn.toNumber())) {
                const pool = pools[poolIn];
                const posIn = positions[tokenInAddress];
                if (posIn) {
                    if (!amountR?.gt(0) && posIn?.balanceForPrice?.gt(0)) {
                        amountR = posIn.amountR.mul(amountIn).div(posIn.balanceForPrice);
                    }
                    posIn.amountR = posIn.amountR.sub(amountR);
                    if (priceR?.gt(0) || pool.TOKEN_R == playToken) {
                        if (posIn.balanceForPriceR.lt(amountIn)) {
                            console.warn(`missing value of balanceForPriceR: ${posIn.balanceForPriceR.toString()} < ${amountIn.toString()}`);
                            posIn.balanceForPriceR = (0, helper_1.bn)(0);
                        }
                        else {
                            posIn.balanceForPriceR = posIn.balanceForPriceR.sub(amountIn);
                        }
                    }
                    if (price) {
                        if (posIn.balanceForPrice.lt(amountIn)) {
                            console.warn(`missing value of balanceForPrice: ${posIn.balanceForPrice.toString()} < ${amountIn.toString()}`);
                            posIn.balanceForPriceR = (0, helper_1.bn)(0);
                        }
                        else {
                            posIn.balanceForPrice = posIn.balanceForPrice.sub(amountIn);
                        }
                    }
                }
                else {
                    console.warn(`missing input position: ${poolIn}-${sideIn.toNumber()}`);
                }
            }
            const posOut = positions[tokenOutAddress];
            if (POS_IDS.includes(sideOut.toNumber())) {
                posOut.amountR = posOut.amountR.add(amountR);
                if (priceR?.gt(0) || pool.TOKEN_R == playToken) {
                    const tokenR = tokens.find((t) => t.address === pool.TOKEN_R);
                    if (tokenR) {
                        let playTokenPrice = whiteListToken?.[playToken]?.price ?? 1;
                        if (typeof playTokenPrice === 'string' && playTokenPrice?.startsWith('0x')) {
                            // ignore the x96 price here
                            playTokenPrice = 1;
                        }
                        const priceRFormated = pool.TOKEN_R == playToken ? playTokenPrice : this.extractPriceR(tokenR, tokens, priceR, log);
                        if (priceRFormated) {
                            posOut.avgPriceR = (0, helper_1.IEW)((0, helper_1.BIG)((0, helper_1.WEI)(posOut.avgPriceR))
                                .mul(posOut.balanceForPriceR)
                                .add((0, helper_1.BIG)((0, helper_1.WEI)(priceRFormated)).mul(amountOut))
                                .div(posOut.balanceForPriceR.add(amountOut)));
                            posOut.balanceForPriceR = posOut.balanceForPriceR.add(amountOut);
                        }
                        else {
                            console.warn('unable to extract priceR');
                        }
                    }
                    else {
                        console.warn('missing token info for TOKEN_R', tokenR);
                    }
                }
            }
            if (price) {
                const { baseToken, quoteToken } = pool;
                const indexPrice = (0, helper_1.parsePrice)(price, tokens.find((t) => t?.address === baseToken), tokens.find((t) => t?.address === quoteToken), pool);
                posOut.avgPrice = (0, helper_1.IEW)((0, helper_1.BIG)((0, helper_1.WEI)(posOut.avgPrice))
                    .mul(posOut.balanceForPrice)
                    .add((0, helper_1.BIG)((0, helper_1.WEI)(indexPrice)).mul(amountOut))
                    .div(posOut.balanceForPrice.add(amountOut)));
                posOut.balanceForPrice = posOut.balanceForPrice.add(amountOut);
                // }
            }
            Object.keys(positions).map(posKey => {
                if (positions[posKey].balanceForPrice.eq(0) || positions[posKey].balanceForPriceR.eq(0)) {
                    delete positions[posKey];
                }
            });
            return positions;
        }
        catch (error) {
            throw error;
        }
    }
    formatSwapHistory({ transferLogs, swapLogs, tokens }) {
        try {
            if (!swapLogs || swapLogs.length === 0) {
                return [];
            }
            const pools = this.RESOURCE.pools;
            const poolAddresses = Object.keys(this.RESOURCE.pools);
            const _swapLogs = swapLogs.map((log) => {
                const abi = this.getSwapAbi(log.topics[0]);
                const formatedData = this.decodeSwapLog(abi, log.args);
                const { poolIn, poolOut, sideIn, sideOut, amountIn, amountOut, price, priceR } = formatedData;
                if (!poolAddresses.includes(poolIn) || !poolAddresses.includes(poolOut)) {
                    return null;
                }
                const tokenInAddress = this.getTokenAddressByPoolAndSide(poolIn, formatedData.sideIn);
                const tokenOutAddress = this.getTokenAddressByPoolAndSide(poolOut, formatedData.sideOut);
                const tokenIn = tokens.find((t) => t.address === tokenInAddress);
                let entryValue;
                let entryPrice;
                const pool = [constant_1.POOL_IDS.R, constant_1.POOL_IDS.native].includes(sideIn.toNumber()) ? pools[poolIn] : pools[poolOut];
                const { TOKEN_R, baseToken, quoteToken } = pool;
                const { derivable: { playToken }, tokens: whiteListToken, } = this.profile.configs;
                if (([constant_1.POOL_IDS.R, constant_1.POOL_IDS.native].includes(sideIn.toNumber()) || [constant_1.POOL_IDS.R, constant_1.POOL_IDS.native].includes(sideOut.toNumber())) &&
                    (priceR?.gt(0) || TOKEN_R == playToken)) {
                    const amount = [constant_1.POOL_IDS.R, constant_1.POOL_IDS.native].includes(sideIn.toNumber()) ? amountIn : amountOut;
                    const tokenR = tokens.find((t) => t.address === TOKEN_R);
                    if (tokenR) {
                        let playTokenPrice = whiteListToken?.[playToken]?.price ?? 1;
                        if (typeof playTokenPrice === 'string' && playTokenPrice?.startsWith('0x')) {
                            // ignore the x96 price here
                            playTokenPrice = 1;
                        }
                        const priceRFormated = pool.TOKEN_R == playToken ? playTokenPrice : this.extractPriceR(tokenR, tokens, priceR, log);
                        if (priceRFormated) {
                            entryValue = (0, helper_1.weiToNumber)(amount.mul((0, helper_1.numberToWei)(priceRFormated) || 0), 18 + (tokenIn?.decimals || 18));
                            // console.log(tokenR.symbol, tokenRQuote.symbol, _priceR.toString(), priceRFormated, entryValue)
                        }
                        else {
                            console.warn('unable to extract priceR');
                        }
                    }
                    else {
                        console.warn('missing token info for TOKEN_R', tokenR);
                    }
                }
                if (price) {
                    entryPrice = (0, helper_1.parsePrice)(price, tokens.find((t) => t?.address === baseToken), tokens.find((t) => t?.address === quoteToken), pool);
                }
                const _transferLog = transferLogs.find((l) => l.transactionHash === log.transactionHash);
                const anyTokenHistoryData = {};
                if (_transferLog) {
                    const _transferData = this.decodeTransferLog(_transferLog.data, _transferLog.topics);
                    if (this.account === _transferData.from) {
                        anyTokenHistoryData.tokenIn = _transferLog.contractAddress;
                        anyTokenHistoryData.amountIn = _transferData.value;
                    }
                    else if (this.account === _transferData.to) {
                        anyTokenHistoryData.tokenOut = _transferLog.contractAddress;
                        anyTokenHistoryData.amountOut = _transferData.value;
                    }
                }
                return {
                    transactionHash: log.transactionHash,
                    timeStamp: log.timeStamp,
                    blockNumber: log.blockNumber,
                    logIndex: log.logIndex,
                    poolIn,
                    poolOut,
                    tokenIn: tokenInAddress,
                    tokenOut: tokenOutAddress,
                    entryValue,
                    entryPrice,
                    ...formatedData,
                    ...anyTokenHistoryData,
                };
            });
            return _swapLogs.filter((l) => l !== null);
        }
        catch (e) {
            throw e;
        }
    }
    extractPriceR(tokenR, tokens, priceR, log) {
        try {
            const { address, stablecoin } = this.RESOURCE.getSingleRouteToUSD(tokenR.address) ?? {};
            if (!address) {
                console.warn('missing route to USD', tokenR);
                return undefined;
            }
            const tokenRQuote = tokens.find((t) => t.address == stablecoin);
            if (!tokenRQuote) {
                console.warn('missing token info for TOKEN_R quote', stablecoin);
                return undefined;
            }
            let _priceR = priceR;
            // fix a historical bug in BSC
            if (this.config.chainId == 56 && log.blockNumber < 33077333) {
                if (tokenR.address.localeCompare(tokenRQuote.address, undefined, { sensitivity: 'accent' }) > 0) {
                    _priceR = resource_1.M256.div(_priceR);
                }
            }
            // priceR is independent to the pool index, so no pool is passed in here
            return (0, helper_1.parsePrice)(_priceR, tokenR, tokenRQuote);
        }
        catch (error) {
            throw error;
        }
    }
    getTokenAddressByPoolAndSide(poolAddress, side) {
        try {
            const pool = this.RESOURCE.pools[poolAddress];
            if (side.eq(constant_1.POOL_IDS.native)) {
                return constant_1.NATIVE_ADDRESS;
            }
            if (side.eq(constant_1.POOL_IDS.R)) {
                return pool?.TOKEN_R || constant_1.NATIVE_ADDRESS;
            }
            return `${poolAddress}-${side.toString()}`;
        }
        catch (error) {
            throw error;
        }
    }
    getSwapAbi(topic0) {
        try {
            const topics = (0, helper_1.getTopics)();
            if (topic0 === topics.Swap[0]) {
                return this.profile.getEventDataAbi().Swap;
            }
            else if (topic0 === topics.Swap[1]) {
                return this.profile.getEventDataAbi().Swap1;
            }
            else {
                return this.profile.getEventDataAbi().Swap2;
            }
        }
        catch (error) {
            throw error;
        }
    }
    decodeTransferLog(data, topics) {
        try {
            const abiInterface = new ethers_1.ethers.utils.Interface(ERC20_json_1.default);
            return abiInterface.decodeEventLog('Transfer', data, topics);
        }
        catch (error) {
            throw error;
        }
    }
    decodeSwapLog(abi, args) {
        try {
            const encodeData = ethers_1.ethers.utils.defaultAbiCoder.encode(abi, args);
            return ethers_1.ethers.utils.defaultAbiCoder.decode(abi, encodeData);
        }
        catch (error) {
            throw error;
        }
    }
}
exports.History = History;
//# sourceMappingURL=history.js.map