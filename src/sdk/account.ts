import {BigNumber,Signer} from 'ethers'
import _ from 'lodash'
import {Profile} from '../profile'
import {Aggregator} from '../services/aggregator'
import {History,HistoryEntry} from '../services/history'
import {Resource} from '../services/resource'
import {Swap} from '../services/swap'
import {LogType} from '../types'
import {ProfileConfigs} from '../utils/configs'
import {Position} from './position'

export type AccountState = {
  positions: { [id: string]: Position }
  histories: HistoryEntry[]
  balances: { [key: string]: BigNumber }
  allowance: any
}
export class Account {
  account: string | Signer
  accountState: AccountState
  configs: ProfileConfigs
  profile: Profile
  SWAP: Swap
  AGGREGATOR: Aggregator
  RESOURCE: Resource
  HISTORY: History

  constructor(account: string | Signer, accountState: AccountState, configs: ProfileConfigs) {
    this.accountState = accountState
    this.account = account
    this.profile = new Profile(configs)
    const _configs = {
      ...configs,
      RESOURCE: this.RESOURCE,
    }
    this.AGGREGATOR = new Aggregator(_configs, this.profile)
    this.RESOURCE = new Resource(this.configs, this.profile)
    this.HISTORY = new History(_configs, this.profile)

    this.SWAP = new Swap({ ...this.configs, RESOURCE: this.RESOURCE, AGGREGATOR: this.AGGREGATOR }, this.profile)
  }
  processLogs = async (logs: LogType[]) => {
    const { pools, poolGroups } = await this.RESOURCE.getResourceFromOverrideLogs(logs)
    const txs = _.groupBy(logs, (log) => log.transactionHash)
    const txLogs: LogType[][] = []
    for (const tx in txs) {
      txLogs.push(txs[tx])
    }
    const { positions: _positions, histories } = this.HISTORY.process(txLogs)
    for (const id in _positions) {
      const positionState = this.RESOURCE.getPositionState({ id, ..._positions[id] }, _positions[id].balance, pools, poolGroups)
      const positionObject = new Position({
        positionState,
        positionId: id,
        positionWithEntry: _positions[id],
        profile: this.profile,
        enginConfigs: this.configs,
      })
      this.accountState.positions[id] = positionObject
    }
    this.accountState.histories = histories
    return { positions: this.accountState.positions, histories: this.accountState.histories }
  }
  importPositions = async (ids: string[]) => {}
}
