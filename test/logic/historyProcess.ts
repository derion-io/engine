import _ from 'lodash'
import { Engine } from '../../src/engine'
import { IEngineConfig } from '../../src/utils/configs'
import { LogType } from '../../src/types'

export const historyProcess = async (
  configs: IEngineConfig,
  poolAddresses: Array<string>,
  poolAddress: string,
): Promise<any> => {
  const engine = new Engine(configs)
  await engine.initServices()

  await engine.RESOURCE.fetchResourceData(poolAddresses, configs.account!)

  const currentPool = engine.RESOURCE.poolGroups[poolAddress]
  engine.setCurrentPool({
    ...currentPool,
  })

  const txs = _.groupBy(engine.RESOURCE.logs, log => log.transactionHash)
  const txLogs: LogType[][] = []
  for (const tx in txs) {
    txLogs.push(txs[tx])
  }

  const { positions, histories } = engine?.HISTORY.process(txLogs)

  for (const id in positions) {
    console.log(engine.RESOURCE.getPositionState({ id, ...positions[id]}))
  }

  return {
    positions,
    histories,
  }
}
