// Re-export from SDK utils
export { bn, isPosId, packPosId, unpackPosId, sideFromToken, addressFromToken } from '@derion/sdk'

// Re-export from SDK helper
export {
  weiToNumber,
  numberToWei,
  decodePowers,
  formatMultiCallBignumber,
  getNormalAddress,
  formatFloat,
  formatPercent,
  mul,
  sub,
  div,
  max,
  add,
  detectDecimalFromPrice,
  parseUq128x128,
  mergeDeep,
  rateToHL,
  rateFromHL,
  kx,
  STR,
  NUM,
  BIG,
  truncate,
  round,
  IEW,
  WEI,
  DIV,
  compareLog,
  mergeTwoUniqSortedLogs,
} from '@derion/sdk/dist/utils/helper'

// Engine-only utilities
import { BigNumber, ethers } from 'ethers'
import { weiToNumber, numberToWei, formatFloat } from '@derion/sdk/dist/utils/helper'
import { LogType, PoolType, TokenType } from '../types'
import EventsAbi from '../abi/Events.json'
import { FeeAmount, POOL_INIT_CODE_HASH, ZERO_ADDRESS } from './constant'

import { defaultAbiCoder, Interface, LogDescription } from '@ethersproject/abi'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256 } from '@ethersproject/solidity'

// TODO: Move RPC Url to config or env
export const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/')

export const parsePrice = (value: BigNumber, baseToken?: TokenType, quoteToken?: TokenType, pool?: PoolType): string => {
  const exp = pool?.exp ?? 2
  if (exp == 2) {
    value = value.mul(value)
  }
  const price = weiToNumber(value.mul(numberToWei(1, baseToken?.decimals || 18)).shr(128 * exp), quoteToken?.decimals || 18)
  return formatFloat(price, 18)
}

export const parseSqrtX96 = (price: BigNumber, baseToken: TokenType, quoteToken: TokenType): string => {
  return weiToNumber(
    price
      .mul(price)
      .mul(numberToWei(1, baseToken.decimals + 18))
      .shr(192),
    quoteToken.decimals + 18,
  )
}

export const getTopics = (overrideEventsAbi?: any): { [key: string]: string[] } => {
  const eventInterface = new ethers.utils.Interface(overrideEventsAbi || EventsAbi)
  const events = eventInterface.events
  const topics: { [key: string]: string[] } = {}
  for (const i in events) {
    if (topics[events[i].name]) {
      topics[events[i].name].push(ethers.utils.id(i))
    } else {
      topics[events[i].name] = [ethers.utils.id(i)]
    }
  }
  return topics
}

export function sortsBefore(tokenA: string, tokenB: string): boolean {
  if (tokenA === tokenB) {
    throw new Error("The tokens have the same address.");
  }
  return tokenA.toLowerCase() < tokenB.toLowerCase();
}

export function computePoolAddress({
  factoryAddress,
  tokenA,
  tokenB,
  fee,
  initCodeHashManualOverride
}: {
  factoryAddress: string
  tokenA: TokenType
  tokenB: TokenType
  fee: FeeAmount
  initCodeHashManualOverride?: string
}): string {
  const [token0, token1] = sortsBefore(tokenA.address, tokenB.address) ? [tokenA, tokenB] : [tokenB, tokenA]
  return getCreate2Address(
    factoryAddress,
    keccak256(
      ['bytes'],
      [defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0.address, token1.address, fee])]
    ),
    initCodeHashManualOverride ?? POOL_INIT_CODE_HASH
  )
}

export function tryParseLog(log: LogType, ifaces: Interface[]): LogDescription | undefined {
  for (let i = 0; i < ifaces.length; ++i) {
    const iface = ifaces[i]
    try {
      return iface.parseLog(log)
    } catch (err) {
      if (i >= ifaces.length - 1) {
        break
      }
    }
  }
  return undefined
}

export function isUniv3(pool: PoolType): boolean {
  return pool?.FETCHER === ZERO_ADDRESS && !isChainlink(pool)
}

export function isUniv2(pool: PoolType): boolean {
  return !isChainlink(pool) && pool?.FETCHER !== ZERO_ADDRESS
}

export function isChainlink(pool: PoolType): boolean {
  return chainlinkDecimals(pool?.ORACLE) > 0
}

export function chainlinkDecimals(ORACLE: string): number {
  return parseInt(ORACLE.substring(18, 26), 16)
}

export function oracleWindow(ORACLE: string): number {
  return parseInt(ORACLE.substring(10, 18), 16)
}

// Re-export route utilities from SDK
export { getSingleRouteToUSD, getIndexR } from '@derion/sdk/dist/utils/routes'
