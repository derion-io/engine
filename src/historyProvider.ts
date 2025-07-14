import { numberToWei, weiToNumber } from './utils/helper'
import { TokenType } from './types'
import fetch from 'node-fetch'

const history = {}

const CHART_API_ENDPOINT = 'https://api-chart-{chartId}.derivable.org/'

const convertResolution = (oldResolution: string) => {
  if (oldResolution.includes('D')) {
    return oldResolution
  } else {
    if (Number(oldResolution) < 60) {
      return oldResolution
    } else {
      return Number(oldResolution) / 60 + 'H'
    }
  }
}

export const resolutionToPeriod = {
  5: '5m',
  15: '15m',
  60: '1h',
  240: '4h',
  '1D': '1d',
}

export type CandleType = {
  low: number | string
  open: number | string
  time: number
  close: number | string
  high: number | string
  volume: number | string
}

export type CandleFromApiType = {
  s: string
  t: number[]
  o: string[]
  c: string[]
  l: string[]
  h: string[]
  v: string[]
}

type GetPricesType = {
  data: { [key: string]: string }
  code: number
}
export const INTERVAL_TO_GECKO: {[key:string]: {timeframe: string, aggregate: number}} = {
  '5m': { timeframe: 'minute', aggregate: 5 },
  '15m': { timeframe: 'minute', aggregate: 15 },
  '1H': { timeframe: 'hour', aggregate: 1 },
  '4H': { timeframe: 'hour', aggregate: 4 },
  '1D': { timeframe: 'day', aggregate: 1 },
};

export default {
  history: history,

  getBars: async function ({
    route,
    resolution,
    // inputToken,
    // outputToken,
    limit,
    chainId,
    gtId,
    // to,
    // barValueType,
  }: {
    inputToken?: TokenType
    outputToken?: TokenType
    route: string
    resolution: string
    limit: number
    chainId: string
    gtId?: string
    to: number
    barValueType?: 'string'
  }): Promise<CandleType[]> {
    const q = route.split('/').join(',')
    const intervalConf = INTERVAL_TO_GECKO[resolution];
    const url = `https://api.geckoterminal.com/api/v2/networks/${gtId || chainId}/pools/${route.split(',')[1]}/ohlcv/${intervalConf.timeframe}?aggregate=${intervalConf.aggregate}&include_empty_intervals=false&limit=${limit || 300}`;
    // const url = `${CHART_API_ENDPOINT.replaceAll('{chartId}', chainId)}candleline4?q=${q}&r=${convertResolution(
    //   resolution,
    // )}&l=${limit}&t=${to}`
    console.log(url)

    const response = await fetch(url).then((r: any) => r.json())
    // console.log(response, limit, chainId, to, barValueType)
    if (response && response?.data && response?.data?.attributes?.ohlcv_list?.length > 0 ) {
      const bars: CandleType[] = []
      const candles:number[][] = response?.data?.attributes?.ohlcv_list
      
      for (let i = 0; i < candles.length; i++) {
        bars.push({
          low: candles[i][3],
          // formatResult(weiToNumber(numberToWei(response.l[i]), decimals), barValueType),
          open: candles[i][1],
          // formatResult(weiToNumber(numberToWei(response.o[i]), decimals), barValueType),
          time: candles[i][1] * 1000,
          volume: candles[i][5],
          // formatResult(weiToNumber(response.v[i].split('.')[0], outputToken?.decimals), barValueType),
          close: candles[i][4],
          // formatResult(weiToNumber(numberToWei(response.c[i]), decimals), barValueType),
          high: candles[i][2],
          // formatResult(weiToNumber(numberToWei(response.h[i]), decimals), barValueType),
        })
      }
      return bars
    }
    return []
  },
}

const formatResult = (value: string, type: undefined | 'string' | 'number') => {
  if (type === 'string') {
    return value
  }
  return Number(value)
}
