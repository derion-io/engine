import { Engine } from '../src/engine'
import { getTestConfigs } from './shared/testConfigs'
import { bn } from '../src/utils/helper'

const test = async () => {
  const configs = getTestConfigs(42161)
  const engine = new Engine(configs)
  await engine.initServices()

  const pairAddress = await engine.UNIV3PAIR.getLargestPoolAddress({
    baseToken: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    quoteTokens: ['0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'],
  })

  console.log(pairAddress)
}

test()
