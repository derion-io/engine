import { BigNumber, Contract, Signer, VoidSigner, ethers } from 'ethers'
import { PoolType } from '../types'
import { bn, isPosId, packPosId, unpackPosId, sideFromToken, addressFromToken } from '../utils/helper'
import { NATIVE_ADDRESS, POOL_IDS, ZERO_ADDRESS, Q128 } from '../utils/constant'
import { JsonRpcProvider, Provider, TransactionReceipt } from '@ethersproject/providers'
import { Profile } from '../profile'
import { isAddress } from 'ethers/lib/utils'
import { IDerivableContractAddress, IEngineConfig } from '../utils/configs'
import { Resource } from './resource'
import * as OracleSdkAdapter from '../utils/OracleSdkAdapter'
import * as OracleSdk from '../utils/OracleSdk'
import { Swapper, type rateDataAggregatorType, type SwapAndOpenAggregatorType } from 'derion-sdk/swapper'
import { ParaswapClient } from 'derion-sdk'

export type SwapStepType = {
  tokenIn: string
  tokenOut: string
  amountIn: BigNumber
  payloadAmountIn?: BigNumber
  amountOutMin: BigNumber | string | number
  useSweep?: boolean
  currentBalanceOut?: BigNumber
  uniPool?: string
}

export type PriceTxReturnType = {
  inputs: Array<any>
  code: string
  data: string | undefined
}

export type MultiSwapParameterType = {
  steps: Array<SwapStepType>
  gasLimit?: BigNumber
  gasPrice?: BigNumber
  fetcherData?: any
  onSubmitted?: (pendingTx: PendingSwapTransactionType) => void
  submitFetcherV2?: boolean
  callStatic?: boolean
}

export type PendingSwapTransactionType = {
  hash: string
  steps: SwapStepType[]
}

export type PoolGroupReturnType = {
  pools: { [key: string]: PoolType }
  TOKEN_R: string
}

export type SwapCallDataParameterType = {
  step: SwapStepType
  poolGroup: PoolGroupReturnType
  poolIn: string
  poolOut: string
  sideIn: number
  sideOut: number
}
export type SwapCallDataInputType = {
  mode: number
  eip: number
  token: string
  id: number | BigNumber | string
  amountIn: BigNumber | undefined
  recipient: string
}

export type SwapCallDataReturnType = {
  inputs: Array<SwapCallDataInputType>
  populateTxData: Array<{ [key: string]: any }>
}

const PAYMENT = 0
const TRANSFER = 1
const CALL_VALUE = 2

export class Swap {
  account?: string
  chainId: number
  scanApi?: string
  provider: Provider
  providerGetProof: JsonRpcProvider
  overrideProvider: JsonRpcProvider
  signer?: Signer
  RESOURCE: Resource
  config: IEngineConfig
  profile: Profile
  derivableAdr: IDerivableContractAddress
  pendingTxs: Array<PendingSwapTransactionType>
  private sdkSwapper: Swapper

  constructor(config: IEngineConfig & { RESOURCE: Resource }, profile: Profile) {
    this.RESOURCE = config.RESOURCE
    this.config = config
    this.account = config.account ?? config.signer?._address ?? ZERO_ADDRESS
    this.chainId = config.chainId
    this.scanApi = profile.configs.scanApi
    this.provider = config.RESOURCE.provider
    this.overrideProvider = config.RESOURCE.overrideProvider
    this.providerGetProof = new JsonRpcProvider(profile.configs.rpcGetProof || profile.configs.rpc)
    this.signer = config.signer ?? new VoidSigner(this.account, this.provider)
    this.profile = profile
    this.derivableAdr = profile.configs.derivable

    this.sdkSwapper = new Swapper(
      profile,
      new JsonRpcProvider(profile.configs.rpc),
      this.overrideProvider,
      new ParaswapClient(config.chainId),
    )
  }

  private get wrappedTokenAddress(): string {
    return this.profile.configs.wrappedTokenAddress
  }

  async calculateAmountOuts({
    steps,
    fetcherV2 = false,
    fetcherData,
  }: {
    steps: Array<SwapStepType>
    fetcherV2?: boolean
    fetcherData?: any
  }): Promise<any> {
    if (!this.signer) return [[bn(0)], bn(0)]
    try {
      const { helperContract, gasLimitDefault, gasForProof } = this.profile.configs
      const stepsToSwap: Array<SwapStepType> = [...steps].map((step) => {
        return { ...step, amountOutMin: 0 }
      })
      const { params, value } = await this.convertStepToActions({
        steps: stepsToSwap,
        submitFetcherV2: fetcherV2,
        isCalculate: true,
        fetcherData,
      })

      const router = helperContract.utr as string
      const contract = new ethers.Contract(router, this.profile.getAbi('UTROverride').abi, this.getOverrideProvider())
      const res = await contract.callStatic.exec(...params, {
        from: this.account,
        value,
        gasLimit: gasLimitDefault,
      })
      const result = []
      for (const i in steps) {
        result.push({ ...steps[i], amountOut: res[0][i] })
      }
      let gasUsed = gasLimitDefault - res.gasLeft.toNumber()
      if (fetcherV2) {
        gasUsed += gasForProof ?? 800000
      }
      return [result, bn(gasUsed)]
    } catch (e) {
      throw e
    }
  }

  async convertStepToActions({
    steps,
    submitFetcherV2,
    isCalculate = false,
    fetcherData,
  }: {
    steps: Array<SwapStepType>
    submitFetcherV2: boolean
    isCalculate?: boolean
    fetcherData?: any
  }): Promise<{
    params: any
    value: BigNumber
  }> {
    const outputs: {
      eip: number
      token: string
      id: string | BigNumber
      amountOutMin: string | number | BigNumber
      recipient: string | undefined
    }[] = []
    steps.forEach((step) => {
      const poolGroup = this.getPoolPoolGroup(step.tokenIn, step.tokenOut)
      const poolOut = addressFromToken(step.tokenOut, poolGroup.TOKEN_R, this.wrappedTokenAddress)
      const sideOut = sideFromToken(step.tokenOut, poolGroup.TOKEN_R, this.wrappedTokenAddress)

      outputs.push({
        recipient: this.account,
        eip: isPosId(step.tokenOut) ? 1155 : step.tokenOut === NATIVE_ADDRESS ? 0 : 20,
        token: isPosId(step.tokenOut) ? (this.derivableAdr.token as string) : step.tokenOut,
        id: isPosId(step.tokenOut) ? packPosId(poolOut, sideOut) : bn(0),
        amountOutMin: step.amountOutMin,
      })
    })
    let nativeAmountToWrap = bn(0)

    const metaDatas: any = []
    const promises: any = []
    const fetchStepPromise = steps.map(async(step) => {
      const poolGroup = this.getPoolPoolGroup(step.tokenIn, step.tokenOut)

      const poolIn = addressFromToken(step.tokenIn, poolGroup.TOKEN_R, this.wrappedTokenAddress)
      const poolOut = addressFromToken(step.tokenOut, poolGroup.TOKEN_R, this.wrappedTokenAddress)
      const sideIn = sideFromToken(step.tokenIn, poolGroup.TOKEN_R, this.wrappedTokenAddress)
      const sideOut = sideFromToken(step.tokenOut, poolGroup.TOKEN_R, this.wrappedTokenAddress)

      if (step.tokenIn === NATIVE_ADDRESS) {
        nativeAmountToWrap = nativeAmountToWrap.add(step.amountIn)
      }

      if (step.useSweep && isPosId(step.tokenOut)) {
        const { inputs, populateTxData } = await this.getSweepCallData({ step, poolGroup, poolIn, poolOut, sideIn, sideOut })

        metaDatas.push(
          {
            code: this.derivableAdr.stateCalHelper,
            inputs,
          },
          {
            code: this.derivableAdr.stateCalHelper,
            inputs: [],
          },
        )

        promises.push(...populateTxData)
      } else {
        const { inputs, populateTxData } = await this.getSwapCallData({ step, poolGroup, poolIn, poolOut, sideIn, sideOut })
        metaDatas.push({
          code: this.derivableAdr.stateCalHelper,
          inputs,
        })
        promises.push(...populateTxData)
      }

      if (submitFetcherV2 && !fetcherData) {
        const pool = isPosId(step.tokenIn) ? this.RESOURCE.pools[poolIn] : this.RESOURCE.pools[poolOut]
        if (pool?.window) {
          promises.push(isCalculate ? this.fetchPriceMockTx(pool) : this.fetchPriceTx(pool))
        }
      }
    })
    await Promise.all(fetchStepPromise)
    const datas: Array<any> = await Promise.all(promises)

    const actions: Array<any> = []

    metaDatas.forEach((metaData: any, key: any) => {
      actions.push({ ...metaData, data: datas[key].data })
    })

    if (submitFetcherV2 && !fetcherData) {
      for (let i = metaDatas.length; i < datas.length; i++) {
        actions.unshift(datas[datas.length - 1])
      }
    } else if (submitFetcherV2 && fetcherData) {
      actions.unshift(fetcherData)
    }

    return { params: [outputs, actions], value: nativeAmountToWrap }
  }

  async getSweepCallData({ step, poolGroup, poolIn, poolOut, sideIn, sideOut }: SwapCallDataParameterType): Promise<SwapCallDataReturnType> {
    const stateCalHelper = this.getStateCalHelperContract()
    const swapCallData = await this.getSwapCallData({ step, poolGroup, poolIn, poolOut, sideIn, sideOut })
    const posIdOut = packPosId(poolOut, sideOut)

    const inputs = [
      {
        mode: TRANSFER,
        eip: 1155,
        token: this.derivableAdr.token,
        id: posIdOut,
        amountIn: step.currentBalanceOut,
        recipient: stateCalHelper.address,
      },
      ...swapCallData.inputs,
    ]

    const populateTxData = [
      ...swapCallData.populateTxData,
      stateCalHelper.populateTransaction.sweep(posIdOut, this.account),
    ]

    return { inputs, populateTxData }
  }

  async getSwapCallData({ step, poolGroup, poolIn, poolOut, sideIn, sideOut }: SwapCallDataParameterType): Promise<SwapCallDataReturnType> {
    const needAggregator = isAddress(step.tokenIn) && this.sdkSwapper.wrapToken(step.tokenIn) !== poolGroup.TOKEN_R
    const inputs =
      step.tokenIn === NATIVE_ADDRESS
        ? [
            {
              mode: CALL_VALUE,
              token: ZERO_ADDRESS,
              eip: 0,
              id: 0,
              amountIn: step.amountIn,
              recipient: ZERO_ADDRESS,
            },
          ]
        : [
            {
              mode: !needAggregator ? PAYMENT : TRANSFER,
              eip: isPosId(step.tokenIn) ? 1155 : 20,
              token: isPosId(step.tokenIn) ? this.derivableAdr.token : step.tokenIn,
              id: isPosId(step.tokenIn) ? packPosId(poolIn, sideIn) : 0,
              amountIn: step.amountIn,
              recipient:
                needAggregator
                  ? this.getStateCalHelperContract().address
                  : isPosId(step.tokenIn)
                  ? poolIn
                  : poolOut,
            },
          ]

    const populateTxData = []

    let amountIn = step.payloadAmountIn ? step.payloadAmountIn : step.amountIn

    if (needAggregator) {
      const srcDecimals = this.RESOURCE.tokens.find((t) => t.address === step.tokenIn)?.decimals || 18
      const destDecimals = this.RESOURCE.tokens.find((t) => t.address === poolGroup.TOKEN_R)?.decimals || 18

      const getRateData: rateDataAggregatorType = {
        userAddress: this.getStateCalHelperContract().address,
        ignoreChecks: true,
        srcToken: step.tokenIn,
        srcDecimals,
        srcAmount: amountIn.toString(),
        destToken: poolGroup.TOKEN_R,
        destDecimals,
        partner: 'derion.io',
        side: 'SELL',
      }
      const openData: SwapAndOpenAggregatorType = {
        pool: poolOut,
        side: sideOut,
      }
      const { openTx } = await this.sdkSwapper.getAggRateAndBuildTxSwapApi(
        getRateData,
        openData,
        this.signer!,
        this.getStateCalHelperContract(),
      )
      populateTxData.push(openTx)
    } else if (isAddress(step.tokenOut) && this.sdkSwapper.wrapToken(step.tokenOut) !== poolGroup.TOKEN_R) {
      populateTxData.push(
        this.sdkSwapper.generateSwapParams('closeAndSwap', {
          side: sideIn,
          deriPool: poolIn,
          uniPool: this.sdkSwapper.getUniPool(step.tokenOut, poolGroup.TOKEN_R),
          token: step.tokenOut,
          amount: amountIn,
          payer: this.account,
          recipient: this.account,
          INDEX_R: this.sdkSwapper.getIndexR(poolGroup.TOKEN_R),
        }),
      )
    } else {
      const OPEN_RATE = this.RESOURCE.pools[poolOut]?.OPEN_RATE
      if (OPEN_RATE && [POOL_IDS.A, POOL_IDS.B].includes(sideOut)) {
        amountIn = amountIn.mul(OPEN_RATE).div(Q128)
      }

      populateTxData.push(
        this.sdkSwapper.generateSwapParams('swap', {
          sideIn,
          poolIn: isPosId(step.tokenIn) ? poolIn : poolOut,
          sideOut,
          poolOut: isPosId(step.tokenOut) ? poolOut : poolIn,
          amountIn,
          payer: this.account,
          recipient: this.account,
          INDEX_R: this.sdkSwapper.getIndexR(poolGroup.TOKEN_R),
        }),
      )
    }
    return { inputs, populateTxData }
  }

  getPoolPoolGroup(addressIn: string, addressOut: string): PoolGroupReturnType {
    const poolIn = isPosId(addressIn) ? this.RESOURCE.pools[unpackPosId(addressIn)[0]] : null
    const poolOut = isPosId(addressOut) ? this.RESOURCE.pools[unpackPosId(addressOut)[0]] : null

    if (!poolIn && !poolOut) {
      throw 'Cannot detect pool to swap'
    }

    if (poolIn && poolOut && poolIn.TOKEN_R !== poolOut.TOKEN_R) {
      throw 'Cannot swap throw multi pool (need to same Token R)'
    }

    const result: PoolGroupReturnType = { pools: {}, TOKEN_R: '' }
    if (poolIn) {
      result.pools[poolIn.poolAddress] = poolIn
      result.TOKEN_R = poolIn.TOKEN_R
    }
    if (poolOut) {
      result.pools[poolOut.poolAddress] = poolOut
      result.TOKEN_R = poolOut.TOKEN_R
    }

    return result
  }

  async multiSwap({
    steps,
    gasLimit,
    gasPrice,
    fetcherData,
    onSubmitted,
    submitFetcherV2 = false,
    callStatic = false,
  }: MultiSwapParameterType): Promise<TransactionReceipt> {
    const { params, value } = await this.convertStepToActions({
      steps: [...steps],
      submitFetcherV2,
      fetcherData,
    })

    const utr = this.getRouterContract(this.signer)
    params.push({
      value,
      gasLimit: gasLimit || undefined,
      gasPrice: gasPrice || undefined,
    })
    if (callStatic) {
      return await utr.callStatic.exec(...params)
    }
    const res = await utr.exec(...params)
    if (onSubmitted) {
      onSubmitted({ hash: res.hash, steps })
    }
    const tx = await res.wait(1)
    console.log('tx', tx)
    return tx
  }

  getRouterContract(provider: any): Contract {
    return new ethers.Contract(this.profile.configs.helperContract.utr as string, this.profile.getAbi('UTR'), provider)
  }

  getStateCalHelperContract(provider?: any): Contract {
    return new ethers.Contract(this.derivableAdr.stateCalHelper as string, this.profile.getAbi('Helper'), provider || this.provider)
  }

  async needToSubmitFetcher(pool: PoolType): Promise<boolean> {
    try {
      const fetcherContract = new Contract(pool.FETCHER, this.profile.getAbi('FetcherV2'), this.signer)
      await fetcherContract.callStatic.fetch(pool.ORACLE)
    } catch (e) {
      if (e?.reason === 'OLD') {
        return true
      }
    }
    return false
  }

  async fetchPriceTx(pool: PoolType, blockNumber?: number): Promise<PriceTxReturnType> {
    if (blockNumber == null) {
      blockNumber = await this.provider.getBlockNumber()
    }
    const getProof = OracleSdkAdapter.getProofFactory(this.providerGetProof)
    const getBlockByNumber = OracleSdkAdapter.getBlockByNumberFactory(this.overrideProvider)
    const proof = await OracleSdk.getProof(
      getProof,
      getBlockByNumber,
      pool.pair,
      pool.quoteTokenIndex,
      blockNumber - (pool.window.toNumber() >> 1),
    )
    const contractWithSigner = new Contract(pool.FETCHER, this.profile.getAbi('FetcherV2'), this.signer)
    const data = await contractWithSigner.populateTransaction.submit(pool.ORACLE, proof)
    return {
      inputs: [],
      code: pool.FETCHER,
      data: data.data,
    }
  }

  async fetchPriceMockTx(pool: PoolType, blockNumber?: number): Promise<PriceTxReturnType> {
    if (blockNumber == null) {
      blockNumber = await this.provider.getBlockNumber()
    }
    const targetBlock = blockNumber - (pool.window.toNumber() >> 1)
    const getStorageAt = OracleSdkAdapter.getStorageAtFactory(this.overrideProvider)
    const accumulator = await OracleSdk.getAccumulatorPrice(getStorageAt, pool.pair, pool.quoteTokenIndex, targetBlock)

    const contractWithSigner = new Contract(pool.FETCHER, this.profile.getAbi('FetcherV2Mock').abi, this.signer)
    const data = await contractWithSigner.populateTransaction.submitPrice(
      pool.ORACLE,
      bn(accumulator.price),
      targetBlock,
      accumulator.timestamp,
    )
    return {
      inputs: [],
      code: pool.FETCHER,
      data: data.data,
    }
  }

  getOverrideProvider(): JsonRpcProvider {
    const router = this.profile.configs.helperContract.utr as string
    const fetcherV2 = this.profile.configs.derivable.uniswapV2Fetcher as string
    this.overrideProvider.setStateOverride({
      [router]: {
        code: this.profile.getAbi('UTROverride').deployedBytecode,
      },
      ...(fetcherV2
        ? {
            [fetcherV2]: {
              code: this.profile.getAbi('FetcherV2Mock').deployedBytecode,
            },
          }
        : {}),
    })
    return this.overrideProvider
  }
}
