import { BigNumber, Contract, Signer } from 'ethers'
import { Profile } from '../profile'
import { Aggregator } from '../services/aggregator'
import { History, HistoryEntry } from '../services/history'
import { Resource } from '../services/resource'
import { Swap } from '../services/swap'
import { PendingSwapTransactionType, PoolsType } from '../types'
import { ProfileConfigs } from '../utils/configs'
import { Position } from './position'
import { bn, packId } from '../utils/helper'
import { decodeErc1155Address, isErc1155Address } from './utils'

export class Swapper {
  configs: ProfileConfigs
  profile: Profile
  SWAP: Swap
  AGGREGATOR: Aggregator
  RESOURCE: Resource
  HISTORY: History

  constructor(configs: ProfileConfigs) {
    this.profile = new Profile(configs)
    this.configs = configs
    const _configs = {
      ...configs,
      RESOURCE: this.RESOURCE,
    }
    this.AGGREGATOR = new Aggregator(_configs, this.profile)
    this.RESOURCE = new Resource(this.configs, this.profile)
    this.HISTORY = new History(_configs, this.profile)

    this.SWAP = new Swap({ ...this.configs, RESOURCE: this.RESOURCE, AGGREGATOR: this.AGGREGATOR }, this.profile)
  }

  simulate = async ({
    tokenIn,
    amount,
    tokenOut,
    deps,
    gasLimit,
  }: {
    tokenIn: string
    tokenOut: string
    amount: string
    deps: {
      pools: PoolsType
      signer: string | Signer
    }
    gasLimit?: BigNumber
  }): Promise<any> => {
    const pools = deps.pools
    const isOpenPos = isErc1155Address(tokenOut) ? tokenOut : tokenIn
    const poolSwapAddress = isOpenPos ? tokenOut : tokenIn
    const poolSwap = pools[poolSwapAddress]
    if (!poolSwap) throw 'invalid pool'
    const fetcherV2 = await this.SWAP.needToSubmitFetcher(poolSwap)
    const fetcherData = await this.SWAP.fetchPriceTx(poolSwap)
    // const tokenContract = new Contract(this.profile.configs.derivable.token, TokenAbi, this.RESOURCE.provider)
    // const currentBalanceOut = await tokenContract.balanceOf(deps.signer, packId(poolSide.toString(), poolOut))
    const tx: any = await this.SWAP.multiSwap({
      steps: [
        {
          tokenIn,
          tokenOut,
          amountIn: bn(amount),
          amountOutMin: 0,
          useSweep: !!(
            (isErc1155Address(tokenOut) && pools?.[decodeErc1155Address(tokenOut)?.address]?.MATURITY?.gt(0))
            // && tokenOutMaturity?.gt(0)
            // && balances[tokenOut]?.gt(0)
          ),
          //   currentBalanceOut: balances[tokenOut]
        },
      ],
      onSubmitted: (pendingTx: PendingSwapTransactionType) => {},
      gasLimit: gasLimit ?? bn(1000000),
      callStatic: true,
      signerOverride: deps.signer,
      fetcherData: fetcherData,
      submitFetcherV2: fetcherV2,
    })
    return tx
  }
  swap = async ({
    tokenIn,
    tokenOut,
    deps,
  }: {
    tokenIn: string
    tokenOut: string
    amount: string
    deps: {
      pools: PoolsType
      signer: Signer
    }
  }): Promise<any> => {
    return {
      tokenIn,
      tokenOut,
      deps,
    }
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
