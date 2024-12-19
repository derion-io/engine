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
  simulate = async({
    tokenIn,
    tokenOut
  }: {
    tokenIn: {
      position?: Position
      amount: number
      address?: string
      decimals?: number
    }
    tokenOut: {
      position?: Position
      address?: string
      decimals?: number
    }
  }): Promise<any> => {
    // const currentPool = this.pool
    // const poolOut = currentPool.poolAddress
    // const provider = this.RESOURCE.provider
    // const tokenContract = new Contract(this.profile.configs.derivable.token, TokenAbi, provider)
    // const currentBalanceOut = await tokenContract.balanceOf(signer, packId(poolSide.toString(), poolOut))
    // const steps = [
    //   {
    //     amountIn: bn(numberToWei(amountIn, tokenInDecimals)),
    //     tokenIn,
    //     tokenOut: poolOut + '-' + POOL_IDS.C,
    //     amountOutMin: 0,
    //     currentBalanceOut,
    //     useSweep: true,
    //   },
    // ]

    // const fetcherV2 = await this.SWAP.needToSubmitFetcher(currentPool)
    // const fetcherData = await this.SWAP.fetchPriceTx(currentPool)
    // const res = await this.SWAP.multiSwap({
    //   fetcherData,
    //   submitFetcherV2: fetcherV2,
    //   steps,
    //   gasLimit: bn(1000000),
    //   gasPrice: bn(3e9),
    //   callStatic: true,
    //   poolOverride: this.pool,
    // })
    // return res
  }
  swap = async ({
    tokenIn,
    tokenOut
  }: {
    tokenIn: {
      position?: Position
      amount: number
      address?: string
      decimals?: number
    }
    tokenOut: {
      position?: Position
      address?: string
      decimals?: number
    }
  }): Promise<any> => {
    // const currentPool = this.pool
    // const poolOut = currentPool.poolAddress
    // const provider = this.RESOURCE.provider
    // const tokenContract = new Contract(this.profile.configs.derivable.token, TokenAbi, provider)
    // const currentBalanceOut = await tokenContract.balanceOf(signer, packId(poolSide.toString(), poolOut))
    // const steps = [
    //   {
    //     amountIn: bn(numberToWei(amountIn, tokenInDecimals)),
    //     tokenIn,
    //     tokenOut: poolOut + '-' + POOL_IDS.C,
    //     amountOutMin: 0,
    //     currentBalanceOut,
    //     useSweep: true,
    //   },
    // ]

    // const fetcherV2 = await this.SWAP.needToSubmitFetcher(currentPool)
    // const fetcherData = await this.SWAP.fetchPriceTx(currentPool)
    // const res = await this.SWAP.multiSwap({
    //   fetcherData,
    //   submitFetcherV2: fetcherV2,
    //   steps,
    //   gasLimit: bn(1000000),
    //   gasPrice: bn(3e9),
    //   callStatic: true,
    //   poolOverride: this.pool,
    // })
    // return res
  }
}
