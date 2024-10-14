import {Contract} from 'ethers'
import { Engine } from '../../src/engine'
import {keyFromTokenId} from '../../src/services/balanceAndAllowance'
import { IEngineConfig } from '../../src/utils/configs'
import {POOL_IDS} from '../../src/utils/constant'
import {bn, getTopics, packId} from '../../src/utils/helper'
import TokenAbi from '../../src/abi/Token.json'

export const historyTransfer = async (
  configs: IEngineConfig,
  poolAddresses: Array<string>,
  poolAddress: string,
): Promise<any> => {
  const engine = new Engine(configs)
  await engine.initServices()
  const POS_IDS = [POOL_IDS.A, POOL_IDS.B, POOL_IDS.C]
  const TOPICS = getTopics()
  await engine.RESOURCE.fetchResourceData(poolAddresses, configs.account!)

  const currentPool = engine.RESOURCE.poolGroups[poolAddress]
  engine.setCurrentPool({
    ...currentPool,
  })

  const swapTxs = engine?.HISTORY.formatSwapHistory({
    tokens: engine.RESOURCE.tokens,
    transferLogs: JSON.parse(JSON.stringify(engine.RESOURCE.transferLogs)),
    swapLogs: JSON.parse(JSON.stringify(engine.RESOURCE.swapLogs)),
  })
  const positionsTransfer = {}
  engine.RESOURCE.bnaLogs.map(tranferLog => {
    
    if (TOPICS.TransferSingle.includes(tranferLog.topics[0])) {
      const { from, to, id, value, operator } = tranferLog.args
      const key = keyFromTokenId(id)
      if(!positionsTransfer[key]) positionsTransfer[key] = {
        balance: bn(0)
      }
      if (to == configs.account) {
        positionsTransfer[key].balance = positionsTransfer[key]?.balance.add(value)
      }
      if (from == configs.account) {
        positionsTransfer[key].balance = positionsTransfer[key]?.balance.sub(value)
      }
    }
    if (TOPICS.TransferBatch.includes(tranferLog.topics[0])) {
      const { from, to, ids, operators } = tranferLog.args
      const values = tranferLog.args['4']
      for (let i = 0; i < ids.length; ++i) {
        const value = values[i]
        const key = keyFromTokenId(ids[i])
        if(!positionsTransfer[key]) positionsTransfer[key] = {
          balance: bn(0)
        }
        if (to == configs.account) {
          positionsTransfer[key].balance = positionsTransfer[key]?.balance.add(value)
        }
        if (from == configs.account) {
          positionsTransfer[key].balance = positionsTransfer[key]?.balance.sub(value)
        }
      }
    }
  })
  const positions = engine?.HISTORY.generatePositions({
    tokens: engine.RESOURCE.tokens,
    logs: JSON.parse(JSON.stringify(engine.RESOURCE.swapLogs)),
  })
  Object.keys(positions).map(posKey => {
    const posSwap = positions[posKey]
    const posTransfer = positionsTransfer[posKey]
    expect(posSwap.balanceForPrice.toString()).toEqual(posTransfer.balance.toString())
  })
  return {
    swapTxs,
    positions,
  }
}
