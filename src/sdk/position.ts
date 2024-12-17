import { PoolsType, Storage, SwapLog, TokenType } from '../types'
import { ethers } from 'ethers'
import { Price } from '../services/price'
import { Resource } from '../services/resource'
import { BnA } from '../services/balanceAndAllowance'
import { UniV2Pair } from '../services/uniV2Pair'
import { History } from '../services/history'
import { Swap } from '../services/swap'
import { CurrentPool } from '../services/currentPool'
import { CreatePool } from '../services/createPool'
import { UniV3Pair } from '../services/uniV3Pair'
import { IEngineConfig } from '../utils/configs'
import { Profile } from '../profile'
import { Aggregator } from '../services/aggregator'

export class Position {
  data: any
  constructor(data: any) {
    this.data = data
  }

  async loadState (){

  }
}
