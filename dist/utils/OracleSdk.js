"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexStringToUint8Array = exports.stripLeadingZeros = exports.getProof = exports.getAccumulatorPrice = exports.getPrice = void 0;
const rlp_encoder_1 = require("@zoltu/rlp-encoder");
const ethers_1 = require("ethers");
const bn = ethers_1.ethers.BigNumber.from;
const Q112 = bn(1).shl(112);
const M112 = Q112.sub(1);
async function getPrice(eth_getStorageAt, eth_getBlockByNumber, exchangeAddress, quoteTokenIndex, blockNumber) {
    async function getAccumulatorValue(innerBlockNumber, timestamp) {
        const priceAccumulatorSlot = quoteTokenIndex == 0 ? 10 : 9;
        const [reservesAndTimestamp, accumulator] = await Promise.all([
            eth_getStorageAt(exchangeAddress, 8, innerBlockNumber),
            eth_getStorageAt(exchangeAddress, priceAccumulatorSlot, innerBlockNumber),
        ]);
        const blockTimestampLast = bn(reservesAndTimestamp).shr(224);
        const reserve1 = bn(reservesAndTimestamp).shr(112).and(M112);
        const reserve0 = bn(reservesAndTimestamp).and(M112);
        if (reserve0.eq(0))
            throw new Error(`Exchange ${exchangeAddress} does not have any reserves for token0.`);
        if (reserve1.eq(0))
            throw new Error(`Exchange ${exchangeAddress} does not have any reserves for token1.`);
        if (blockTimestampLast.eq(0))
            throw new Error(`Exchange ${exchangeAddress} has not had its first accumulator update (or it is year 2106).`);
        if (bn(accumulator).eq(0))
            throw new Error(`Exchange ${exchangeAddress} has not had its first accumulator update (or it is 136 years since launch).`);
        const numeratorReserve = 0 === quoteTokenIndex ? reserve0 : reserve1;
        const denominatorReserve = 0 === quoteTokenIndex ? reserve1 : reserve0;
        const timeElapsedSinceLastAccumulatorUpdate = bn(timestamp).sub(blockTimestampLast);
        const priceNow = numeratorReserve.shl(112).div(denominatorReserve);
        return timeElapsedSinceLastAccumulatorUpdate.mul(priceNow).add(accumulator);
    }
    const latestBlock = { timestamp: Math.floor(new Date().getTime() / 1000) };
    const historicBlock = await eth_getBlockByNumber(blockNumber);
    if (historicBlock === null)
        throw new Error(`Block ${blockNumber} does not exist.`);
    const [latestAccumulator, historicAccumulator] = await Promise.all([
        getAccumulatorValue('latest', latestBlock.timestamp),
        getAccumulatorValue(blockNumber, Number(historicBlock.timestamp)),
    ]);
    const accumulatorDelta = latestAccumulator.sub(historicAccumulator);
    const timeDelta = bn(latestBlock.timestamp).sub(bn(historicBlock.timestamp));
    return timeDelta.eq(0) ? accumulatorDelta : accumulatorDelta.div(timeDelta);
}
exports.getPrice = getPrice;
async function getAccumulatorPrice(eth_getStorageAt, exchangeAddress, quoteTokenIndex, blockNumber) {
    const priceAccumulatorSlot = quoteTokenIndex == 0 ? 10 : 9;
    const [reservesAndTimestamp, accumulator] = await Promise.all([
        eth_getStorageAt(exchangeAddress, 8, blockNumber),
        eth_getStorageAt(exchangeAddress, priceAccumulatorSlot, blockNumber),
    ]);
    const blockTimestampLast = bn(reservesAndTimestamp).shr(224);
    const reserve1 = bn(reservesAndTimestamp).shr(112).and(M112);
    const reserve0 = bn(reservesAndTimestamp).and(M112);
    if (reserve0.eq(0))
        throw new Error(`Exchange ${exchangeAddress} does not have any reserves for token0.`);
    if (reserve1.eq(0))
        throw new Error(`Exchange ${exchangeAddress} does not have any reserves for token1.`);
    if (blockTimestampLast.eq(0))
        throw new Error(`Exchange ${exchangeAddress} has not had its first accumulator update (or it is year 2106).`);
    if (bn(accumulator).eq(0))
        throw new Error(`Exchange ${exchangeAddress} has not had its first accumulator update (or it is 136 years since launch).`);
    return {
        price: bn(accumulator),
        timestamp: blockTimestampLast,
    };
}
exports.getAccumulatorPrice = getAccumulatorPrice;
async function getProof(eth_getProof, eth_getBlockByNumber, exchangeAddress, quoteTokenIndex, blockNumber) {
    const priceAccumulatorSlot = quoteTokenIndex == 0 ? 10 : 9;
    const [block, proof] = await Promise.all([
        eth_getBlockByNumber(blockNumber),
        eth_getProof(exchangeAddress, [8, priceAccumulatorSlot], blockNumber),
    ]);
    if (block === null)
        throw new Error(`Received null for block ${Number(blockNumber)}`);
    const blockRlp = rlpEncodeBlock(block);
    const accountProofNodesRlp = (0, rlp_encoder_1.rlpEncode)(proof.accountProof.map(rlp_encoder_1.rlpDecode));
    const reserveAndTimestampProofNodesRlp = (0, rlp_encoder_1.rlpEncode)(proof.storageProof[0].proof.map(rlp_encoder_1.rlpDecode));
    const priceAccumulatorProofNodesRlp = (0, rlp_encoder_1.rlpEncode)(proof.storageProof[1].proof.map(rlp_encoder_1.rlpDecode));
    return {
        block: blockRlp,
        accountProofNodesRlp,
        reserveAndTimestampProofNodesRlp,
        priceAccumulatorProofNodesRlp,
    };
}
exports.getProof = getProof;
function rlpEncodeBlock(block) {
    return (0, rlp_encoder_1.rlpEncode)([
        hexStringToUint8Array(block.parentHash),
        hexStringToUint8Array(block.sha3Uncles),
        hexStringToUint8Array(block.miner),
        hexStringToUint8Array(block.stateRoot),
        hexStringToUint8Array(block.transactionsRoot),
        hexStringToUint8Array(block.receiptsRoot),
        hexStringToUint8Array(block.logsBloom),
        stripLeadingZeros(hexStringToUint8Array(block.difficulty)),
        stripLeadingZeros(hexStringToUint8Array(block.number)),
        stripLeadingZeros(hexStringToUint8Array(block.gasLimit)),
        stripLeadingZeros(hexStringToUint8Array(block.gasUsed)),
        stripLeadingZeros(hexStringToUint8Array(block.timestamp)),
        stripLeadingZeros(block.extraData),
        ...(block.mixHash != null ? [hexStringToUint8Array(block.mixHash)] : []),
        ...(block.nonce != null ? [hexStringToUint8Array(block.nonce)] : []),
        ...(block.baseFeePerGas != null ? [stripLeadingZeros(hexStringToUint8Array(block.baseFeePerGas))] : []),
    ]);
}
function stripLeadingZeros(byteArray) {
    let i = 0;
    for (; i < byteArray.length; ++i) {
        if (byteArray[i] !== 0)
            break;
    }
    const result = new Uint8Array(byteArray.length - i);
    for (let j = 0; j < result.length; ++j) {
        result[j] = byteArray[i + j];
    }
    return result;
}
exports.stripLeadingZeros = stripLeadingZeros;
function hexStringToUint8Array(value) {
    value = value.substring(2);
    if (value.length % 2 != 0) {
        value = '0' + value;
    }
    const result = Uint8Array.from(Buffer.from(value, 'hex'));
    return result;
}
exports.hexStringToUint8Array = hexStringToUint8Array;
//# sourceMappingURL=OracleSdk.js.map