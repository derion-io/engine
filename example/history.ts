import { Engine } from '../src/engine'
import { getTestConfigs } from './shared/testConfigs'

const chainId = Number(process.env.CHAIN ?? 42161)
const wallet = process.env.WALLET ?? '0xE61383556642AF1Bd7c5756b13f19A63Dc8601df'

const testLocal = async () => {
  const configs = getTestConfigs(chainId)
  configs.scanApiKey = process.env['SCAN_API_KEY_' + chainId]
  const engine = new Engine(configs)
  await engine.initServices()

  await engine.RESOURCE.fetchResourceData([], wallet)

  console.log({
    pools: engine.RESOURCE.pools,
    tokens: engine.RESOURCE.tokens,
    swapLogs: engine.RESOURCE.swapLogs,
  })

  const currentPool = engine.RESOURCE.poolGroups['0x9E37cb775a047Ae99FC5A24dDED834127c4180cD']
  engine.setCurrentPool({
    ...currentPool,
  })

  const swapTxs = engine?.HISTORY.formatSwapHistory({
    tokens: engine.RESOURCE.tokens,
    transferLogs: JSON.parse(JSON.stringify(engine.RESOURCE.transferLogs)),
    swapLogs: JSON.parse(JSON.stringify(engine.RESOURCE.swapLogs)),
  })
  console.log(swapTxs)

  const positions = engine?.HISTORY.generatePositions({
    tokens: engine.RESOURCE.tokens,
    logs: JSON.parse(JSON.stringify(engine.RESOURCE.swapLogs)),
  })

  console.log(positions)
}

testLocal()
