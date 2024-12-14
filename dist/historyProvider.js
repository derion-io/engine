"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolutionToPeriod = void 0;
const helper_1 = require("./utils/helper");
const node_fetch_1 = __importDefault(require("node-fetch"));
const history = {};
const CHART_API_ENDPOINT = 'https://api-chart-{chartId}.derivable.org/';
const convertResolution = (oldResolution) => {
    if (oldResolution.includes('D')) {
        return oldResolution;
    }
    else {
        if (Number(oldResolution) < 60) {
            return oldResolution;
        }
        else {
            return Number(oldResolution) / 60 + 'H';
        }
    }
};
exports.resolutionToPeriod = {
    5: '5m',
    15: '15m',
    60: '1h',
    240: '4h',
    '1D': '1d',
};
exports.default = {
    history: history,
    getBars: async function ({ route, resolution, inputToken, outputToken, limit, chainId, to, barValueType, }) {
        const q = route.split('/').join(',');
        const url = `${CHART_API_ENDPOINT.replaceAll('{chartId}', chainId)}candleline4?q=${q}&r=${convertResolution(resolution)}&l=${limit}&t=${to}`;
        const response = await (0, node_fetch_1.default)(url).then((r) => r.json());
        if (response && response.s === 'ok' && response.t && response.t.length > 0) {
            const bars = [];
            const decimals = 18 + (outputToken?.decimals || 18) - (inputToken?.decimals || 18);
            for (let i = 0; i < response.t.length; i++) {
                bars.push({
                    low: formatResult((0, helper_1.weiToNumber)((0, helper_1.numberToWei)(response.l[i]), decimals), barValueType),
                    open: formatResult((0, helper_1.weiToNumber)((0, helper_1.numberToWei)(response.o[i]), decimals), barValueType),
                    time: response.t[i] * 1000,
                    volume: formatResult((0, helper_1.weiToNumber)(response.v[i].split('.')[0], outputToken?.decimals), barValueType),
                    close: formatResult((0, helper_1.weiToNumber)((0, helper_1.numberToWei)(response.c[i]), decimals), barValueType),
                    high: formatResult((0, helper_1.weiToNumber)((0, helper_1.numberToWei)(response.h[i]), decimals), barValueType),
                });
            }
            return bars;
        }
        return [];
    },
};
const formatResult = (value, type) => {
    if (type === 'string') {
        return value;
    }
    return Number(value);
};
//# sourceMappingURL=historyProvider.js.map