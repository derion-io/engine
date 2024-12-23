import { BigNumber } from "ethers"
import { NATIVE_ADDRESS, POOL_IDS, Q128 } from "./constant"
import { getAddress, hexDataSlice, hexlify, hexZeroPad } from "ethers/lib/utils"

export const bn = BigNumber.from

export const isPosId = (address: string): boolean => {
  return address.length == 66
}

export const unpackPosId = (address: string): [string, number] => {
  return [
    getAddress(hexDataSlice(address, 12)),
    BigNumber.from(hexDataSlice(address, 0, 12)).toNumber(),
  ]
}

export const packPosId = (address: string, side: number): string => {
  return hexZeroPad(hexlify(side) + address.substring(2).toLowerCase(), 32)
}

export const groupBy = (xs: any[], key: string | number): any[][] => {
  return xs.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x)
    return rv
  }, {})
}

export const throwError = (reason: string = 'MISSING DATA'): any => {
  throw new Error(reason)
}

export const sideFromToken = (address: string, TOKEN_R: string, wrappedTokenAddress: string): number => {
  try {
    if (isPosId(address)) {
      return unpackPosId(address)[1]
    } else if (address === TOKEN_R) {
      return POOL_IDS.R
    } else if (address === NATIVE_ADDRESS && TOKEN_R === wrappedTokenAddress) {
      return POOL_IDS.native
    }
    return 0
  } catch (e) {
    throw new Error('Token id not found')
  }
}

export const addressFromToken = (address: string, TOKEN_R: string, wrappedTokenAddress: string): string => {
  if (isPosId(address)) {
    return unpackPosId(address)[0]
  }
  if (address === NATIVE_ADDRESS && TOKEN_R === wrappedTokenAddress) {
    return wrappedTokenAddress
  }

  return address
}

export const errorEncode = (err: any): any => {
  return err?.response?.data || `${err?.code}: ${err?.reason || err?.msg || err?.message}`
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
    return Q256M.div(y)
  }
  return y
}
