import _ from "lodash";
import {getEngine} from "./logic/setupEngin";

import { Interceptor } from './shared/libs/interceptor'
const interceptor = new Interceptor()

describe('Price Service', () => {
  beforeEach(() => {
    interceptor.setContext(expect.getState().currentTestName)
  })

  test('get 24h Change', async () => {
    const chainId = 42161
    const engine = await getEngine(chainId)
    const baseTokenAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
    const quoteTokenAddress = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
    const cTokenAddress = '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443'
    const changedIn24h = await engine.PRICE.get24hChange({
      baseToken: {
        address: baseTokenAddress,
        decimals: 18,
        name: '',
        symbol: '',
      },
      quoteToken: {
        address: quoteTokenAddress,
        decimals: 6,
        name: '',
        symbol: '',
      },
      cToken: cTokenAddress,
      currentPrice: '1900',
      chainId: '42161',
      toTimeMs: 1800000000000,
    })
    expect(changedIn24h).toBeDefined()
  })

  test('get tokens price on router.json arb', async () => {
    const chainId = 42161
    const engine = await getEngine(chainId)
    await engine.RESOURCE.getWhiteListResource([])
    const prices = await engine.PRICE.getTokenPriceByRoutes()

    expect(prices['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1']).toEqual('2296.788233358644033792718165')
  })

  test('get tokens price on router.json opbnb', async () => {
    const chainId = 204
    const engine = await getEngine(chainId)
    await engine.RESOURCE.getWhiteListResource([])
    const prices = await engine.PRICE.getTokenPriceByRoutes()

    expect(prices['0x4200000000000000000000000000000000000006']).toEqual('397.350255852609982230506832479228433617')
  })

  test('get tokens price on router.json bsc', async () => {
    const chainId = 56
    const engine = await getEngine(chainId)
    await engine.RESOURCE.getWhiteListResource([])
    const prices = await engine.PRICE.getTokenPriceByRoutes()

    expect(prices['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c']).toEqual('299.580826636659236116343909233509775829')
  })

  test('get price of any token', async () => {
    const chainId = 42161
    const engine = await getEngine(chainId)
    await engine.RESOURCE.getWhiteListResource([])

    const price = await engine.PRICE.getTokenPrices([
      "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    ])
    expect(price['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1']).toBeDefined()
  })
})
