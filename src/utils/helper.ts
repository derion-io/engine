import { BigNumber } from 'ethers'
import { bn } from '.'
import { BIG_0, M256, Q128, SECONDS_PER_DAY } from './constant'
import { LogType } from '../type'

// TODO: Change name a some function
// TODO: Convert require to import
const mdp = require('move-decimal-point')

export const weiToNumber = (wei: any, decimals: number = 18, decimalToDisplay?: number): string => {
  if (!wei || !Number(wei)) return '0'
  wei = wei.toString()
  const num = mdp(wei, -decimals)
  if (decimalToDisplay != null) {
    if (decimalToDisplay > 0) {
      return num.slice(0, num.indexOf('.') + decimalToDisplay + 1)
    }
    return num.slice(0, num.indexOf('.'))
  }
  return num
}

export const numberToWei = (number: any, decimals: number = 18): string => {
  if (!number) return '0'
  number = number.toString()
  if (Number.isFinite(number)) {
    number = number.toLocaleString('en-US', { useGrouping: false })
  }
  return mdp(number, decimals).split(number.indexOf('.') === -1 ? ',' : '.')[0]
}

export const decodePowers = (powersBytes: string): Array<number> => {
  powersBytes = powersBytes.slice(6)
  const raws: any = powersBytes.match(/.{1,4}/g)
  const powers = []
  for (let i = raws.length - 1; i >= 0; --i) {
    let power = Number(`0x${raws[i]}`)
    if (power > 0x8000) {
      power = 0x8000 - power
    }
    if (power !== 0) {
      powers.push(power)
    }
  }
  return powers
}

export const formatMultiCallBignumber = (data: any): Array<any> => {
  return data.map((item: any) => {
    if (item.type === 'BigNumber') {
      item = bn(item.hex)
    }

    if (Array.isArray(item)) {
      item = formatMultiCallBignumber(item)
    }
    return item
  })
}

export const getNormalAddress = (addresses: string[]): Array<string> => {
  return addresses.filter((adr: string) => /^0x[0-9,a-f,A-Z]{40}$/g.test(adr))
}

export const formatFloat = (number: number | string, decimals = 4): string => {
  number = number.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  const arr = number.split('.')
  if (arr.length > 1) {
    arr[1] = arr[1].slice(0, decimals)
  }
  return arr.join('.')
}

export const formatPercent = (floatNumber: any, decimals: number = 2): string => {
  floatNumber = floatNumber.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  return formatFloat(weiToNumber(numberToWei(floatNumber), 16), decimals)
}

export const mul = (a: any, b: any, useFullwide = true): string => {
  if (useFullwide) {
    a = a.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
    b = b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  }
  const result = weiToNumber(BigNumber.from(numberToWei(a)).mul(numberToWei(b)), 36)
  const arr = result.split('.')
  arr[1] = arr[1]?.slice(0, 18)
  return arr[1] ? arr.join('.') : arr.join('')
}

export const sub = (a: any, b: any): string => {
  a = a.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  b = b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  return weiToNumber(BigNumber.from(numberToWei(a)).sub(numberToWei(b)))
}

export const div = (a: any, b: any): string => {
  if (b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false }) == '0') {
    return weiToNumber(BigNumber.from(numberToWei((Number(a) / Number(b)).toLocaleString(['en-US', 'fullwide'], { useGrouping: false }))))
  }
  a = a.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  b = b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  return weiToNumber(BigNumber.from(numberToWei(a, 36)).div(numberToWei(b)))
}

export const max = (a: any, b: any): string => (bn(numberToWei(a)).gt(numberToWei(b)) ? a : b)

export const add = (a: any, b: any): string => {
  a = a.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  b = b.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
  return weiToNumber(BigNumber.from(numberToWei(a)).add(numberToWei(b)))
}

export const detectDecimalFromPrice = (price: number | string): number => {
  if (Number(price || 0) === 0 || Number(price || 0) >= 1) {
    return 4
  } else {
    price = price.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
    const rate = !bn(numberToWei(price)).isZero() ? weiToNumber(BigNumber.from(numberToWei(1, 36)).div(numberToWei(price)).toString()) : '0'
    return rate.split('.')[0].length + 3
  }
}

export const parseUq128x128 = (value: BigNumber, unit = 1000): number => {
  return value.mul(unit).shr(112).toNumber() / unit
}

const isObject = (item: any): boolean => {
  return item && typeof item === 'object' && !Array.isArray(item)
}

export const mergeDeep = (target: any, ...sources: any): any => {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

export const rateToHL = (r: number, power: number, DURATION = SECONDS_PER_DAY): number => {
  return Math.ceil((DURATION * Math.LN2) / power / r)
}

export const rateFromHL = (HL: number, power: number, DURATION = SECONDS_PER_DAY): number => {
  return (DURATION * Math.LN2) / power / HL
}

export const kx = (k: number, R: BigNumber, v: BigNumber, spot: BigNumber, MARK: BigNumber): number => {
  try {
    const xk = k > 0 ? spot.pow(k).div(MARK.pow(k)) : MARK.pow(-k).div(spot.pow(-k))
    const vxk4 = v.mul(xk).shl(2)
    const denom = vxk4.gt(R) ? vxk4.sub(R) : R.sub(vxk4)
    const num = R.mul(Math.abs(k))
    return NUM(DIV(num, denom))
  } catch (err) {
    console.warn(err)
    return 0
  }
}

export const STR = (num: number | string | BigNumber): string => {
  if (!num) {
    return '0'
  }
  switch (typeof num) {
    case 'string':
      if (!num?.includes('e')) {
        return num
      }
      num = Number(num)
    case 'number':
      if (!isFinite(num)) {
        return num > 0 ? '∞' : '-∞'
      }
      return num.toLocaleString(['en-US', 'fullwide'], { useGrouping: false })
    default:
      return String(num)
  }
}

export const NUM = (num: number | string | BigNumber): number => {
  if (!num) {
    return 0
  }
  switch (typeof num) {
    case 'number':
      return num
    case 'string':
      if (num == '∞') {
        return Number.POSITIVE_INFINITY
      }
      if (num == '-∞') {
        return Number.NEGATIVE_INFINITY
      }
      return Number.parseFloat(num)
    default:
      return num.toNumber()
  }
}

export const BIG = (num: number | string | BigNumber): BigNumber => {
  if (!num) {
    return BigNumber.from(0)
  }
  switch (typeof num) {
    case 'string':
      if (num?.includes('e')) {
        num = Number(num)
      }
    case 'number':
      return BigNumber.from(num || 0)
    default:
      return num
  }
}

export const truncate = (num: string, decimals: number = 0, rounding: boolean = false): string => {
  let index = Math.max(num.lastIndexOf('.'), num.lastIndexOf(','))
  if (index < 0) {
    index = num.length
  }
  index += decimals + (decimals > 0 ? 1 : 0)
  if (rounding) {
    let shouldRoundUp = false
    for (let i = index; i < num.length; ++i) {
      if (num.charAt(i) == '.') {
        continue
      }
      if (Number(num.charAt(i)) >= 5) {
        shouldRoundUp = true
        break
      }
    }
    for (let i = index - 1; shouldRoundUp && i >= 0; --i) {
      let char = num.charAt(i)
      if (char == '.') {
        continue
      }
      if (char == '9') {
        char = '0'
      } else {
        char = (Number(char) + 1).toString()
        shouldRoundUp = false
      }
      num = _replaceAt(num, i, char)
    }
  }
  return num.substring(0, index)
}

export const round = (num: string, decimals: number = 0): string => {
  return truncate(num, decimals, true)
}

const _replaceAt = (str: string, index: number, replacement: string) => {
  return str.substring(0, index) + replacement + str.substring(index + replacement.length)
}

/// revert of WEI: weiToNumber
export const IEW = (wei: BigNumber | string, decimals: number = 18, decimalsToDisplay?: number): string => {
  let num = mdp(STR(wei), -decimals)
  if (decimalsToDisplay != null) {
    num = truncate(num, decimalsToDisplay)
  }
  return num
}

/// numberToWei
export const WEI = (num: number | string, decimals: number = 18): string => {
  return truncate(mdp(STR(num), decimals))
}

export const DIV = (a: BigNumber, b: BigNumber, precision = 4): string => {
  const al = a.toString().length
  const bl = b.toString().length
  const d = al - bl
  if (d > 0) {
    b = b.mul(WEI(1, d))
  } else if (d < 0) {
    a = a.mul(WEI(1, -d))
  }
  a = a.mul(WEI(1, precision))
  const c = truncate(a.div(b).toString(), 0, true)
  return mdp(c, d - precision)
}

export const SHL = (a: BigNumber, b: number): BigNumber => {
  const neg = a.isNegative()
  if (neg) {
    a = BIG_0.sub(a)
  }
  a = b > 0 ? a.shl(b) : a.shr(-b)
  if (neg) {
    a = BIG_0.sub(a)
  }
  return a
}

export function compareLog(a: LogType, b: LogType): number {
  if (a.blockNumber < b.blockNumber) {
    return -2
  } else if (a.blockNumber > b.blockNumber) {
    return 2
  }
  if (a.logIndex < b.logIndex) {
    return -1
  } else if (a.logIndex > b.logIndex) {
    return 1
  }
  return 0
}

export function mergeTwoUniqSortedLogs(a: LogType[], b: LogType[]): LogType[] {
  if (!a?.length) {
    return b ?? []
  }
  if (!b?.length) {
    return a ?? []
  }
  const r: LogType[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (a[i] == null) {
      r.push(b[j++])
      continue
    }
    if (b[j] == null) {
      r.push(a[i++])
      continue
    }
    const c = compareLog(a[i], b[j])
    if (c < 0) {
      r.push(a[i++])
      continue
    }
    if (c == 0) {
      i++
    }
    r.push(b[j++])
  }
  return r;
}

export function formatQ128(n: BigNumber, PRECISION = 10000): number {
  if (n.isNegative()) {
    return -formatQ128(bn(0).sub(n))
  }
  return n.mul(PRECISION).shr(128).toNumber()/PRECISION
}

export function formatPercentage(n: number, precision = 2): string {
  return (n * 100).toFixed(precision) + '%'
}

export const thousandsInt = (int: string, count = 3): string => {
  const regExp = new RegExp(String.raw`(\d+)(\d{${count}})`)
  while (regExp.test(int)) {
    int = int.replace(regExp, '$1' + ',' + '$2')
  }
  return int
}

export function xr(k: number, r: BigNumber, v: BigNumber): number {
  try {
    const x = NUM(DIV(r, v))
    return Math.pow(x, 1 / k)
  } catch (err) {
    console.warn(err)
    return 0
  }
}

export const powX128 = (x: BigNumber, k: number): BigNumber => {
  let y = Q128
  const neg = k < 0
  if (neg) {
    k = -k;
  }
  for (let i = 0; i < k; ++i) {
    y = y.mul(x).shr(128)
  }
  if (neg) {
    return M256.div(y)
  }
  return y
}
