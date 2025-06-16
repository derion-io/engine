"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixed128ToFloat = exports.floatToFixed128 = exports.unpackId = exports.FixedPoint = void 0;
const ethers_1 = require("ethers");
const helper_1 = require("./helper");
exports.FixedPoint = {
    Q128: (0, helper_1.bn)('0x0100000000000000000000000000000000'), // 2**128
};
const packId = (kind, address) => {
    const k = (0, helper_1.bn)(kind);
    return k.shl(160).add(address);
};
const unpackId = (id) => {
    const k = ethers_1.ethers.utils.hexlify(id.shr(160));
    const p = ethers_1.ethers.utils.getAddress(ethers_1.ethers.utils.hexlify(id.mod((0, helper_1.bn)(1).shl(160))));
    return { k, p };
};
exports.unpackId = unpackId;
const encodeSqrtX96 = (reserve1, reserve0) => {
    return (0, helper_1.bn)((Math.sqrt(reserve1 / reserve0) * 10 ** 12).toFixed(0))
        .mul((0, helper_1.bn)(2).pow(96))
        .div(10 ** 12);
};
const FLOAT_UNIT = 100000;
const floatToFixed128 = (n) => {
    return (0, helper_1.bn)(n * FLOAT_UNIT)
        .shl(128)
        .div(FLOAT_UNIT);
};
exports.floatToFixed128 = floatToFixed128;
const fixed128ToFloat = (fixed128) => {
    return (0, helper_1.bn)(fixed128).mul(FLOAT_UNIT).shr(128).toNumber() / FLOAT_UNIT;
};
exports.fixed128ToFloat = fixed128ToFloat;
//
// export const formatFloat = (number: number | string, decimals = 4) => {
//   number = number.toString()
//   const arr = number.split('.')
//   if (arr.length > 1) {
//     arr[1] = arr[1].slice(0, decimals)
//   }
//   return arr.join('.')
// }
//# sourceMappingURL=number.js.map