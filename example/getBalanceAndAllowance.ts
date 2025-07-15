import { Engine } from '../src/engine'
import { getTestConfigs } from './shared/testConfigs'
import { weiToNumber } from '../src/utils/helper'

const test = async () => {
  const configs = getTestConfigs(8453)
  const engine = new Engine(configs)
  await engine.initServices()
  await engine.RESOURCE.fetchResourceData('0xE3C75f8963E4CA02ea9a281c32b41FdfC248e07f')
  const tokens = engine.RESOURCE.tokens
  const tokenArr = tokens.map((t) => t.address)

  const res = await engine.BNA.getBalanceAndAllowance({
    tokens: tokenArr,
  })

  console.log(weiToNumber(res.balances['0xD9de0da3adE2a8b2FB27C453c065D46aa01574BA']))

  console.log(res)
}

test()
