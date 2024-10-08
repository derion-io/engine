"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeTwoUniqSortedLogs = exports.compareLog = exports.DIV = exports.WEI = exports.IEW = exports.round = exports.truncate = exports.BIG = exports.NUM = exports.STR = exports.kx = exports.rateFromHL = exports.rateToHL = exports.getTopics = exports.mergeDeep = exports.parseSqrtX96 = exports.parsePrice = exports.parseUq128x128 = exports.packId = exports.detectDecimalFromPrice = exports.add = exports.max = exports.div = exports.sub = exports.mul = exports.formatPercent = exports.formatFloat = exports.getNormalAddress = exports.isErc1155Address = exports.getErc1155Token = exports.formatMultiCallBignumber = exports.decodePowers = exports.numberToWei = exports.weiToNumber = exports.bn = exports.provider = void 0;
const ethers_1 = require("ethers");
const Events_json_1 = __importDefault(require("../abi/Events.json"));
const constant_1 = require("./constant");
// TODO: Change name a some function
// TODO: Convert require to import
const mdp = require('move-decimal-point');
// TODO: Move RPC Url to config or env
exports.provider = new ethers_1.ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
exports.bn = ethers_1.BigNumber.from;
const weiToNumber = (wei, decimals = 18, decimalToDisplay) => {
    if (!wei || !Number(wei))
        return '0';
    wei = wei.toString();
    const num = mdp(wei, -decimals);
    if (decimalToDisplay != null) {
        if (decimalToDisplay > 0) {
            return num.slice(0, num.indexOf('.') + decimalToDisplay + 1);
        }
        return num.slice(0, num.indexOf('.'));
    }
    return num;
};
exports.weiToNumber = weiToNumber;
const numberToWei = (number, decimals = 18) => {
    if (!number)
        return '0';
    number = number.toString();
    if (Number.isFinite(number)) {
        number = number.toLocaleString('en-US', { useGrouping: false });
    }
    return mdp(number, decimals).split(number.indexOf('.') === -1 ? ',' : '.')[0];
};
exports.numberToWei = numberToWei;
const decodePowers = (powersBytes) => {
    powersBytes = powersBytes.slice(6);
    const raws = powersBytes.match(/.{1,4}/g);
    const powers = [];
    for (let i = raws.length - 1; i >= 0; --i) {
        let power = Number(`0x${raws[i]}`);
        if (power > 0x8000) {
            power = 0x8000 - power;
        }
        if (power !== 0) {
            powers.push(power);
        }
    }
    return powers;
};
exports.decodePowers = decodePowers;
const formatMultiCallBignumber = (data) => {
    return data.map((item) => {
        if (item.type === 'BigNumber') {
            item = (0, exports.bn)(item.hex);
        }
        if (Array.isArray(item)) {
            item = (0, exports.formatMultiCallBignumber)(item);
        }
        return item;
    });
};
exports.formatMultiCallBignumber = formatMultiCallBignumber;
const getErc1155Token = (addresses) => {
    const erc1155Addresses = addresses.filter(exports.isErc1155Address);
    const result = {};
    for (let i = 0; i < erc1155Addresses.length; i++) {
        const address = erc1155Addresses[i].split('-')[0];
        const id = erc1155Addresses[i].split('-')[1];
        if (!result[address]) {
            result[address] = [(0, exports.bn)(id)];
        }
        else {
            result[address].push((0, exports.bn)(id));
        }
    }
    return result;
};
exports.getErc1155Token = getErc1155Token;
/**
 * format of erc1155 = 0xabc...abc-id
 * @param address
 */
const isErc1155Address = (address) => {
    return /^0x[0-9,a-f,A-Z]{40}-[0-9]{1,}$/g.test(address);
};
exports.isErc1155Address = isErc1155Address;
const getNormalAddress = (addresses) => {
    return addresses.filter((adr) => /^0x[0-9,a-f,A-Z]{40}$/g.test(adr));
};
exports.getNormalAddress = getNormalAddress;
const formatFloat = (number, decimals = 4) => {
    number = number.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    const arr = number.split('.');
    if (arr.length > 1) {
        arr[1] = arr[1].slice(0, decimals);
    }
    return arr.join('.');
};
exports.formatFloat = formatFloat;
const formatPercent = (floatNumber, decimals = 2) => {
    floatNumber = floatNumber.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    return (0, exports.formatFloat)((0, exports.weiToNumber)((0, exports.numberToWei)(floatNumber), 16), decimals);
};
exports.formatPercent = formatPercent;
const mul = (a, b, useFullwide = true) => {
    if (useFullwide) {
        a = a.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
        b = b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    }
    const result = (0, exports.weiToNumber)(ethers_1.BigNumber.from((0, exports.numberToWei)(a)).mul((0, exports.numberToWei)(b)), 36);
    const arr = result.split('.');
    arr[1] = arr[1]?.slice(0, 18);
    return arr[1] ? arr.join('.') : arr.join('');
};
exports.mul = mul;
const sub = (a, b) => {
    a = a.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    b = b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    return (0, exports.weiToNumber)(ethers_1.BigNumber.from((0, exports.numberToWei)(a)).sub((0, exports.numberToWei)(b)));
};
exports.sub = sub;
const div = (a, b) => {
    if (b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false }) == '0') {
        return (0, exports.weiToNumber)(ethers_1.BigNumber.from((0, exports.numberToWei)((Number(a) / Number(b)).toLocaleString(['en-US', 'fullwide'], { useGrouping: false }))));
    }
    a = a.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    b = b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    return (0, exports.weiToNumber)(ethers_1.BigNumber.from((0, exports.numberToWei)(a, 36)).div((0, exports.numberToWei)(b)));
};
exports.div = div;
const max = (a, b) => ((0, exports.bn)((0, exports.numberToWei)(a)).gt((0, exports.numberToWei)(b)) ? a : b);
exports.max = max;
const add = (a, b) => {
    a = a.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    b = b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
    return (0, exports.weiToNumber)(ethers_1.BigNumber.from((0, exports.numberToWei)(a)).add((0, exports.numberToWei)(b)));
};
exports.add = add;
const detectDecimalFromPrice = (price) => {
    if (Number(price || 0) === 0 || Number(price || 0) >= 1) {
        return 4;
    }
    else {
        price = price.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
        const rate = !(0, exports.bn)((0, exports.numberToWei)(price)).isZero() ? (0, exports.weiToNumber)(ethers_1.BigNumber.from((0, exports.numberToWei)(1, 36)).div((0, exports.numberToWei)(price)).toString()) : '0';
        return rate.split('.')[0].length + 3;
    }
};
exports.detectDecimalFromPrice = detectDecimalFromPrice;
const packId = (kind, address) => {
    const k = (0, exports.bn)(kind);
    return k.shl(160).add(address);
};
exports.packId = packId;
const parseUq128x128 = (value, unit = 1000) => {
    return value.mul(unit).shr(112).toNumber() / unit;
};
exports.parseUq128x128 = parseUq128x128;
const parsePrice = (value, baseToken, quoteToken, pool) => {
    const exp = pool?.exp ?? 2;
    if (exp == 2) {
        value = value.mul(value);
    }
    const price = (0, exports.weiToNumber)(value.mul((0, exports.numberToWei)(1, baseToken?.decimals || 18)).shr(128 * exp), quoteToken?.decimals || 18);
    return (0, exports.formatFloat)(price, 18);
};
exports.parsePrice = parsePrice;
const parseSqrtX96 = (price, baseToken, quoteToken) => {
    return (0, exports.weiToNumber)(price
        .mul(price)
        .mul((0, exports.numberToWei)(1, baseToken.decimals + 18))
        .shr(192), quoteToken.decimals + 18);
};
exports.parseSqrtX96 = parseSqrtX96;
const isObject = (item) => {
    return item && typeof item === 'object' && !Array.isArray(item);
};
const mergeDeep = (target, ...sources) => {
    if (!sources.length)
        return target;
    const source = sources.shift();
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key])
                    Object.assign(target, { [key]: {} });
                (0, exports.mergeDeep)(target[key], source[key]);
            }
            else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return (0, exports.mergeDeep)(target, ...sources);
};
exports.mergeDeep = mergeDeep;
const getTopics = () => {
    const eventInterface = new ethers_1.ethers.utils.Interface(Events_json_1.default);
    const events = eventInterface.events;
    const topics = {};
    for (const i in events) {
        if (topics[events[i].name]) {
            topics[events[i].name].push(ethers_1.ethers.utils.id(i));
        }
        else {
            topics[events[i].name] = [ethers_1.ethers.utils.id(i)];
        }
    }
    return topics;
};
exports.getTopics = getTopics;
const rateToHL = (r, k, DURATION = constant_1.SECONDS_PER_DAY) => {
    return Math.ceil((DURATION * Math.LN2) / r / k / k);
};
exports.rateToHL = rateToHL;
const rateFromHL = (HL, k, DURATION = constant_1.SECONDS_PER_DAY) => {
    return (DURATION * Math.LN2) / HL / k / k;
};
exports.rateFromHL = rateFromHL;
const kx = (k, R, v, spot, MARK) => {
    try {
        const xk = k > 0 ? spot.pow(k).div(MARK.pow(k)) : MARK.pow(-k).div(spot.pow(-k));
        const vxk4 = v.mul(xk).shl(2);
        const denom = vxk4.gt(R) ? vxk4.sub(R) : R.sub(vxk4);
        const num = R.mul(Math.abs(k));
        return (0, exports.NUM)((0, exports.DIV)(num, denom));
    }
    catch (err) {
        console.warn(err);
        return 0;
    }
};
exports.kx = kx;
const STR = (num) => {
    if (!num) {
        return '0';
    }
    switch (typeof num) {
        case 'string':
            if (!num?.includes('e')) {
                return num;
            }
            num = Number(num);
        case 'number':
            if (!isFinite(num)) {
                return num > 0 ? '∞' : '-∞';
            }
            return num.toLocaleString(['en-US', 'fullwide'], { useGrouping: false });
        default:
            return String(num);
    }
};
exports.STR = STR;
const NUM = (num) => {
    if (!num) {
        return 0;
    }
    switch (typeof num) {
        case 'number':
            return num;
        case 'string':
            if (num == '∞') {
                return Number.POSITIVE_INFINITY;
            }
            if (num == '-∞') {
                return Number.NEGATIVE_INFINITY;
            }
            return Number.parseFloat(num);
        default:
            return num.toNumber();
    }
};
exports.NUM = NUM;
const BIG = (num) => {
    if (!num) {
        return ethers_1.BigNumber.from(0);
    }
    switch (typeof num) {
        case 'string':
            if (num?.includes('e')) {
                num = Number(num);
            }
        case 'number':
            return ethers_1.BigNumber.from(num || 0);
        default:
            return num;
    }
};
exports.BIG = BIG;
const truncate = (num, decimals = 0, rounding = false) => {
    let index = Math.max(num.lastIndexOf('.'), num.lastIndexOf(','));
    if (index < 0) {
        index = num.length;
    }
    index += decimals + (decimals > 0 ? 1 : 0);
    if (rounding) {
        let shouldRoundUp = false;
        for (let i = index; i < num.length; ++i) {
            if (num.charAt(i) == '.') {
                continue;
            }
            if (Number(num.charAt(i)) >= 5) {
                shouldRoundUp = true;
                break;
            }
        }
        for (let i = index - 1; shouldRoundUp && i >= 0; --i) {
            let char = num.charAt(i);
            if (char == '.') {
                continue;
            }
            if (char == '9') {
                char = '0';
            }
            else {
                char = (Number(char) + 1).toString();
                shouldRoundUp = false;
            }
            num = _replaceAt(num, i, char);
        }
    }
    return num.substring(0, index);
};
exports.truncate = truncate;
const round = (num, decimals = 0) => {
    return (0, exports.truncate)(num, decimals, true);
};
exports.round = round;
const _replaceAt = (str, index, replacement) => {
    return str.substring(0, index) + replacement + str.substring(index + replacement.length);
};
/// revert of WEI: weiToNumber
const IEW = (wei, decimals = 18, decimalsToDisplay) => {
    let num = mdp((0, exports.STR)(wei), -decimals);
    if (decimalsToDisplay != null) {
        num = (0, exports.truncate)(num, decimalsToDisplay);
    }
    return num;
};
exports.IEW = IEW;
/// numberToWei
const WEI = (num, decimals = 18) => {
    return (0, exports.truncate)(mdp((0, exports.STR)(num), decimals));
};
exports.WEI = WEI;
const DIV = (a, b, precision = 4) => {
    const al = a.toString().length;
    const bl = b.toString().length;
    const d = al - bl;
    if (d > 0) {
        b = b.mul((0, exports.WEI)(1, d));
    }
    else if (d < 0) {
        a = a.mul((0, exports.WEI)(1, -d));
    }
    a = a.mul((0, exports.WEI)(1, precision));
    const c = (0, exports.truncate)(a.div(b).toString(), 0, true);
    return mdp(c, d - precision);
};
exports.DIV = DIV;
function compareLog(a, b) {
    if (a.blockNumber < b.blockNumber) {
        return -2;
    }
    else if (a.blockNumber > b.blockNumber) {
        return 2;
    }
    if (a.logIndex < b.logIndex) {
        return -1;
    }
    else if (a.logIndex > b.logIndex) {
        return 1;
    }
    return 0;
}
exports.compareLog = compareLog;
function mergeTwoUniqSortedLogs(a, b) {
    if (!a?.length) {
        return b ?? [];
    }
    if (!b?.length) {
        return a ?? [];
    }
    const r = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
        if (a[i] == null) {
            r.push(b[j++]);
            continue;
        }
        if (b[j] == null) {
            r.push(a[i++]);
            continue;
        }
        const c = compareLog(a[i], b[j]);
        if (c < 0) {
            r.push(a[i++]);
            continue;
        }
        if (c == 0) {
            i++;
        }
        r.push(b[j++]);
    }
    return r;
}
exports.mergeTwoUniqSortedLogs = mergeTwoUniqSortedLogs;
//# sourceMappingURL=helper.js.map