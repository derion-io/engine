import { BigNumber, ethers } from 'ethers'
import ReserveTokenPrice from '../abi/ReserveTokenPrice.json'
import TokenPriceByRoute from '../abi/TokenPriceByRoute.json'
import { JsonRpcProvider } from '@ethersproject/providers'
import { bn, div, formatPercent, numberToWei, parseSqrtX96, sub } from '../utils/helper'
import { TokenType } from '../types'
import { MINI_SECOND_PER_DAY } from '../utils/constant'
import historyProvider from '../historyProvider'
import { IEngineConfig } from '../utils/configs'
import { Profile } from '../sdk/profile'
import { isAddress } from 'ethers/lib/utils'
import _ from 'lodash'
import { Resource } from './resource'

type IFetchTokenPriceParam = {
  tokenBase: string
  tokenQuote: string
  routes: Array<{ uniPool: string; version: number }>
}

export type GetTokenPriceReturnType = {
  [key: string]: BigNumber
}

export type GetTokenPriceByRouterReturnType = {
  [key: string]: number | string
}

export type Get24hChangeParameterType = {
  baseToken: TokenType
  cToken: string
  chainId: string
  quoteToken: TokenType
  currentPrice: string
  toTimeMs?: number
}

export class Price {
  chainId: number
  scanApi?: string
  provider: JsonRpcProvider
  rpcUrl: string
  reserveTokenPrice: string
  tokenPriceByRoute: string
  config: IEngineConfig
  profile: Profile
  RESOURCE: Resource

  constructor(config: IEngineConfig & { RESOURCE: Resource }, profile: Profile) {
    this.reserveTokenPrice = `0x${ReserveTokenPrice.deployedBytecode.slice(-40)}`
    this.tokenPriceByRoute = `0x${TokenPriceByRoute.deployedBytecode.slice(-40)}`
    this.chainId = config.chainId
    this.scanApi = profile.configs.scanApi
    this.provider = new JsonRpcProvider(profile.configs.rpc)
    this.rpcUrl = profile.configs.rpc
    this.profile = profile
    this.RESOURCE = config.RESOURCE
  }

  async get24hChange({ baseToken, cToken, quoteToken, chainId, currentPrice, toTimeMs }: Get24hChangeParameterType): Promise<string> {
    try {
      toTimeMs = toTimeMs ?? new Date().getTime()
      const toTime = Math.floor((toTimeMs - MINI_SECOND_PER_DAY) / 1000)
      const result = await historyProvider.getBars({
        to: toTime,
        limit: 1,
        chainId,
        resolution: '1',
        route: `${baseToken.address}/${cToken}/${quoteToken.address}`,
        outputToken: quoteToken,
        inputToken: baseToken,
        barValueType: 'string',
      })
      const beforePrice = result[0].open
      return formatPercent(div(sub(currentPrice, beforePrice), beforePrice))
    } catch (e) {
      throw e
    }
  }

  async getTokenPriceByRoutes(): Promise<GetTokenPriceByRouterReturnType> {
    try {
      const results: GetTokenPriceByRouterReturnType = {}
      const tokens = this.RESOURCE.tokens
      const params = this._genFetchTokenParams()
      const provider = new JsonRpcProvider(this.rpcUrl)
      provider.setStateOverride({
        [this.tokenPriceByRoute]: {
          code: TokenPriceByRoute.deployedBytecode,
        },
      })
      const contract = new ethers.Contract(this.tokenPriceByRoute, TokenPriceByRoute.abi, provider)
      const prices = await contract.functions.fetchPrices(params)
      if (prices?.[0]) {
        params.forEach(({ tokenQuote, tokenBase }, key) => {
          const tokenBaseObject = tokens.find((t) => t.address === tokenBase)
          const tokenQuoteObject = tokens.find((t) => t.address === tokenQuote)
          if (!tokenBaseObject || !tokenQuoteObject) return
          results[tokenBase] = parseSqrtX96(prices[0][key], tokenBaseObject, tokenQuoteObject)
        })
      }
      const whiteListToken = this.profile.configs.tokens
      for (const address in whiteListToken) {
        if (whiteListToken[address].price) {
          results[address] = whiteListToken[address].price ?? 1
        }
      }
      return results
    } catch (error) {
      throw error
    }
  }

  _genFetchTokenParams(): Array<IFetchTokenPriceParam> {
    try {
      return _.uniqBy(
        Object.keys(this.profile.routes)
          .filter((pair) => {
            const [token0, token1] = pair.split('-')
            return this.profile.configs.stablecoins.includes(token0) || this.profile.configs.stablecoins.includes(token1)
          })
          .map((pairs) => {
            let routes = this.profile.routes[pairs].map((route) => {
              return {
                version: route.type === 'uniswap3' ? 3 : 2,
                uniPool: route.address,
              }
            })
            let [tokenBase, tokenQuote] = pairs.split('-')
            if (this.profile.configs.stablecoins.includes(tokenBase)) {
              ;[tokenBase, tokenQuote] = [tokenQuote, tokenBase]
              routes = routes.reverse()
            }
            return { tokenBase, tokenQuote, routes: routes }
          }),
        'tokenBase',
      )
    } catch (error) {
      throw error
    }
  }

  async getTokenPrices(tokens: Array<string>): Promise<GetTokenPriceReturnType> {
    try {
      const provider = new JsonRpcProvider(this.rpcUrl)
      provider.setStateOverride({
        [this.reserveTokenPrice]: {
          code: ReserveTokenPrice.deployedBytecode,
        },
      })

      const pairDetailContract = new ethers.Contract(this.reserveTokenPrice, ReserveTokenPrice.abi, provider)

      const whiteListToken = this.profile.configs.tokens
      const _tokensToFetch = tokens.filter((t) => {
        return !whiteListToken?.[t]?.price && isAddress(t)
      })

      const res = await pairDetailContract.functions.fetchMarketBatch(
        _tokensToFetch,
        this.profile.configs.uniswap.v3Factory,
        this.profile.configs.stablecoins,
        this.profile.configs.wrappedTokenAddress,
        this.profile.configs.stablecoins[0],
      )

      const result: GetTokenPriceReturnType = {}
      for (const i in _tokensToFetch) {
        result[_tokensToFetch[i]] = res.sqrtPriceX96[i]
      }

      if (whiteListToken) {
        for (const address in whiteListToken) {
          if (whiteListToken[address].price) {
            result[address] = bn(whiteListToken[address].price ?? '0x01000000000000000000000000')
          }
        }
      }

      return result
    } catch (e) {
      throw e
    }
  }
}
