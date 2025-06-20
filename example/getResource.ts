import { Engine } from '../src/engine'
import { getTestConfigs } from './shared/testConfigs'
import {LOCALSTORAGE_KEY} from "../src/utils/constant";

const chainId = 42161
const wallet = '0xE61383556642AF1Bd7c5756b13f19A63Dc8601df'
const pool = '0x3119808c056f2d4bd430046690b03a5ecf46d5cf'

const testLocal = async () => {
  const configs = getTestConfigs(chainId)
  const engine = new Engine(configs)
  await engine.initServices()

  // await engine.RESOURCE.fetchResourceData([pool], wallet)
  // console.log("pool", engine.RESOURCE.pools[pool])

  // const searchResult = await engine.RESOURCE.searchIndex('PENDLE')
  // console.log(searchResult)
  const newResource = await engine.RESOURCE.getNewResource(wallet)
  console.log(newResource.swapLogs)
  // const cached = configs.storage.getItem(chainId + '-' + LOCALSTORAGE_KEY.ACCOUNT_LOGS + '-' + wallet)
  // const cachedResource = await engine.RESOURCE.getResourceCached(wallet)
  // console.log(cachedResource.swapLogs)

  console.log(
    await engine?.HISTORY.formatSwapHistory({
      tokens: Object.values(newResource.tokens),
      transferLogs: newResource.transferLogs,
      swapLogs: newResource.swapLogs,
    }),
  )
  // console.log(whitelistResource)
  // await engine.RESOURCE.loadPoolStates('0xBb8b02f3a4C3598e6830FC6740F57af3a03e2c96')
  // await engine.RESOURCE.searchIndex("PENDLE")

  // console.log({
  //   poolGroups: engine.RESOURCE.poolGroups,
  //   pools: engine.RESOURCE.pools,
  //   tokens: engine.RESOURCE.tokens,
  //   swapLogs: engine.RESOURCE.swapLogs,
  // })
}

testLocal()
