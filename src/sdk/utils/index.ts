import {BigNumber} from "ethers"
import {bn} from "../../utils/helper"
import {NATIVE_ADDRESS, POOL_IDS} from "../../utils/constant"

export const isErc1155Address = (address: string) => {
  return /^0x[0-9,a-f,A-Z]{40}-[0-9]{1,}$/g.test(address)
}

export const decodeErc1155Address = (address: string) => {
  if (!address) return { address: '', id: '' }
  return {
    address: address.split('-')[0],
    id: address.split('-')[1]
  }
}

export const encodeErc1155Address = (token: string, side: number): string => {
  return token + '-' + side
}

export const groupBy = (xs: any[], key: string | number): any[][]  => {
  return xs.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x)
    return rv
  }, {})
}

export const throwError = (reason: string = 'MISSING DATA'): any => {
  throw new Error(reason)
}

  export const getIdByAddress = (address: string, TOKEN_R: string, wrappedTokenAddress: string): BigNumber => {
    try {
      if (isErc1155Address(address)) {
        return bn(address.split('-')[1])
      } else if (address === TOKEN_R) {
        return bn(POOL_IDS.R)
      } else if (address === NATIVE_ADDRESS && TOKEN_R === wrappedTokenAddress) {
        return bn(POOL_IDS.native)
      }
      return bn(0)
    } catch (e) {
      throw new Error('Token id not found')
    }
  }
  export const getAddressByErc1155Address = (address: string, TOKEN_R: string, wrappedTokenAddress: string): string => {
    try {
      if (isErc1155Address(address)) {
        return address.split('-')[0]
      }
      if (address === NATIVE_ADDRESS && TOKEN_R === wrappedTokenAddress) {
        return wrappedTokenAddress
      }

      return address
    } catch (error) {
      throw error
    }
  }

  export const errorEncode = (err: any):any => {
    return err?.response?.data || `${err?.code}: ${err?.reason || err?.msg || err?.message}`
  }