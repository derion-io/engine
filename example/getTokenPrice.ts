import { Engine } from '../src/engine'
import { getTestConfigs } from './shared/testConfigs'

const test = async () => {
  const configs = getTestConfigs(8453)
  const engine = new Engine(configs)
  await engine.initServices()
  await engine.RESOURCE.fetchResourceData(['0xE3C75f8963E4CA02ea9a281c32b41FdfC248e07f'], '')

  const changedIn24h = await engine.PRICE.get24hChange({
    baseToken: {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
      name: '',
      symbol: '',
    },
    quoteToken: {
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      decimals: 6,
      name: '',
      symbol: '',
    },
    cToken: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
    currentPrice: '1900',
    chainId: '42161',
  })

  const prices = await engine.PRICE.getTokenPriceByRoutes()

  const res = await engine.PRICE.getTokenPrices(['0x4200000000000000000000000000000000000006'])

  console.log(res)
}

test()
