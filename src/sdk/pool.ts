import {BigNumber,ethers,Wallet} from 'ethers'
import TokenAbi from '../../src/abi/Token.json'
import {Profile} from '../profile'
import {Aggregator} from '../services/aggregator'
import {Resource} from '../services/resource'
import {Swap} from '../services/swap'
import {PoolType} from '../types'
import {IEngineConfig, ProfileConfigs} from '../utils/configs'
import {NATIVE_ADDRESS,POOL_IDS} from '../utils/constant'
import {bn,numberToWei,packId} from '../utils/helper'

export class Pool {
  pool: PoolType
  configs: ProfileConfigs
  profile: Profile
  SWAP: Swap
  AGGREGATOR: Aggregator
  RESOURCE: Resource

  constructor(pool: PoolType, configs: ProfileConfigs, profile: Profile) {
    this.pool = pool
    this.configs = configs
    this.profile = profile
    const _configs = {
      ...this.configs,
      RESOURCE: this.RESOURCE,
    }
    this.AGGREGATOR = new Aggregator(_configs, this.profile)
    this.RESOURCE = new Resource(this.configs, this.profile)
    this.SWAP = new Swap({ ...this.configs, RESOURCE: this.RESOURCE, AGGREGATOR: this.AGGREGATOR }, this.profile)
  }
  async calcAmountOuts ({amountIn, sideOut, signer}:{
    amountIn: number | BigNumber,
    sideOut: number,
    signer: string
  }): Promise<[any[], BigNumber]> {
    const account = signer

    const poolOut = this.pool.poolAddress
    const provider = this.RESOURCE.provider

    const tokenContract = new ethers.Contract(this.profile.configs.derivable.token, TokenAbi, provider)
    const currentBalanceOut = await tokenContract.balanceOf(account, packId(sideOut.toString(), poolOut))
    const steps = [
      {
        amountIn: BigNumber.isBigNumber(amountIn) ? amountIn : bn(numberToWei(amountIn, 6)),
        tokenIn: NATIVE_ADDRESS,
        tokenOut: poolOut + '-' + sideOut,
        amountOutMin: 0,
        currentBalanceOut,
        useSweep: false,
      },
    ]

    const fetcherV2 = await this.SWAP.needToSubmitFetcher(this.pool)
    const params: any = {
      steps,
      fetcherV2,
      poolOverride: this.pool
    }
    if (fetcherV2) {
      params.fetcherData = await this.SWAP.fetchPriceMockTx(this.pool)
    }
    return await this.SWAP.calculateAmountOuts(params)
  }
  updateState = (poolState: PoolType) => {
    this.pool = poolState
  }
}
