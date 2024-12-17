import {BigNumber,ethers,Wallet} from 'ethers'
import TokenAbi from '../../src/abi/Token.json'
import {Profile} from '../profile'
import {Aggregator} from '../services/aggregator'
import {Resource} from '../services/resource'
import {Swap} from '../services/swap'
import {PoolType} from '../types'
import {IEngineConfig} from '../utils/configs'
import {NATIVE_ADDRESS,POOL_IDS} from '../utils/constant'
import {bn,numberToWei,packId} from '../utils/helper'

export class Pool {
  pool: PoolType
  enginConfigs: IEngineConfig
  profile: Profile
  SWAP: Swap
  AGGREGATOR: Aggregator
  RESOURCE: Resource

  constructor(pool: PoolType, enginConfigs: IEngineConfig, profile: Profile) {
    this.pool = pool
    this.enginConfigs = enginConfigs
    this.profile = profile
    this.AGGREGATOR = new Aggregator(this.enginConfigs, this.profile)
    this.RESOURCE = new Resource(this.enginConfigs, this.profile)
    this.SWAP = new Swap({ ...this.enginConfigs, RESOURCE: this.RESOURCE, AGGREGATOR: this.AGGREGATOR }, this.profile)
  }
  async swap({amountIn, tokenIn = NATIVE_ADDRESS, tokenInDecimals = 18, poolSide = POOL_IDS.C, signer}:{
    poolSide: number,
    amountIn: number,
    tokenIn: string,
    tokenInDecimals: number
    signer: string,
    // callStatic?: boolean,
  }): Promise<any> {
    const currentPool = this.pool
    const poolOut = currentPool.poolAddress
    const provider = this.RESOURCE.provider
    const tokenContract = new ethers.Contract(this.profile.configs.derivable.token, TokenAbi, provider)
    const currentBalanceOut = await tokenContract.balanceOf(signer, packId(poolSide.toString(), poolOut))
    const steps = [
      {
        amountIn: bn(numberToWei(amountIn, tokenInDecimals)),
        tokenIn,
        tokenOut: poolOut + '-' + POOL_IDS.C,
        amountOutMin: 0,
        currentBalanceOut,
        useSweep: true,
      },
    ]
  
    const fetcherV2 = await this.SWAP.needToSubmitFetcher(currentPool)
    const fetcherData = await this.SWAP.fetchPriceTx(currentPool)
    const res = await this.SWAP.multiSwap({
      fetcherData,
      submitFetcherV2: fetcherV2,
      steps,
      gasLimit: bn(1000000),
      gasPrice: bn(3e9),
      callStatic: true,
      poolOverride: this.pool
    })
    return res
  }
  async calcAmountOuts ({amountIn, sideOut, signer}:{
    amountIn: number | BigNumber,
    sideOut: number,
    signer: string
  }): Promise<[any[], BigNumber]> {
    const account = signer ?? this.enginConfigs.account ?? this.enginConfigs.signer?._address

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
  async loadState(derionPoolAddress: string, resource: Resource): Promise<PoolType> {
    const { pools } = await resource.loadInitPoolsData([], [derionPoolAddress], false)
    this.pool = pools[derionPoolAddress] as PoolType
    return this.pool
  }
}
