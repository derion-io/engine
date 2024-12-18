import {BigNumber,Contract,ethers,Wallet} from 'ethers'
import TokenAbi from '../../src/abi/Token.json'
import {Profile} from '../profile'
import {Aggregator} from '../services/aggregator'
import {Resource} from '../services/resource'
import {Swap} from '../services/swap'
import {LogType, PoolType, PositionState} from '../types'
import {IEngineConfig} from '../utils/configs'
import {NATIVE_ADDRESS,POOL_IDS} from '../utils/constant'
import {bn,numberToWei,packId} from '../utils/helper'
import {PositionEntry} from '../services/history'

export class Position {
  positionWithEntry: PositionEntry
  positionState: PositionState
  positionId: string
  enginConfigs: IEngineConfig
  profile: Profile
  SWAP: Swap
  AGGREGATOR: Aggregator
  RESOURCE: Resource

  constructor({positionState, positionWithEntry, enginConfigs, profile}:{positionWithEntry: any, positionId: string,  positionState: PositionState | null, enginConfigs: IEngineConfig, profile: Profile}) {
    this.positionWithEntry = positionWithEntry
    this.positionId = this.positionId
    if(positionState) this.positionState = positionState
    this.enginConfigs = enginConfigs
    this.profile = profile
    const configs = {
      ...this.enginConfigs,
      RESOURCE: this.RESOURCE,
    }
    this.AGGREGATOR = new Aggregator(configs, this.profile)
    this.RESOURCE = new Resource(this.enginConfigs, this.profile)
    this.SWAP = new Swap({ ...this.enginConfigs, RESOURCE: this.RESOURCE, AGGREGATOR: this.AGGREGATOR }, this.profile)
  }
  loadPositionState = async () => {

  }
  positionData = () => {
    return {
      ...this.positionState,
      ...this.positionWithEntry,
      positionId: this.positionId
    }
  }
}
