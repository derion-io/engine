import { BigNumber } from "ethers"
import { NATIVE_ADDRESS, POOL_IDS } from "./constant"
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