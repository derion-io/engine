import { BigNumber, Contract, Signer, VoidSigner, ethers } from 'ethers'
import { PoolType, SwapStepType, PendingSwapTransactionType } from '../types'
import { bn, isErc1155Address, packId } from '../utils/helper'
import { NATIVE_ADDRESS, POOL_IDS, ZERO_ADDRESS } from '../utils/constant'
import { JsonRpcProvider, Provider, TransactionReceipt } from '@ethersproject/providers'
import { Profile } from '../profile'
import { isAddress } from 'ethers/lib/utils'
import { IDerivableContractAddress, IEngineConfig } from '../utils/configs'
import { Q128, Resource } from './resource'
import * as OracleSdkAdapter from '../utils/OracleSdkAdapter'
import * as OracleSdk from '../utils/OracleSdk'
import {Aggregator} from './aggregator'

const PAYMENT = 0
const TRANSFER = 1
const CALL_VALUE = 2

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

export type PoolGroupReturnType = {
  pools: { [key: string]: PoolType }
  TOKEN_R: string
}

export type SwapCallDataParameterType = {
  step: SwapStepType
  poolGroup: PoolGroupReturnType
  poolIn: string
  poolOut: string
  idIn: BigNumber
  idOut: BigNumber
}
export type SwapCallDataInputType = {
  mode: number
  eip: number
  token: string
  id: number | BigNumber
  amountIn: BigNumber | undefined
  recipient: string
}

export type SwapCallDataReturnType = {
  inputs: Array<SwapCallDataInputType>
  populateTxData: Array<{ [key: string]: any }>
}

export class Swap {
  account?: string
  chainId: number
  scanApi?: string
  provider: Provider
  providerGetProof: JsonRpcProvider
  overrideProvider: JsonRpcProvider
  signer?: Signer
  RESOURCE: Resource
  AGGREGATOR: Aggregator
  config: IEngineConfig
  profile: Profile
  derivableAdr: IDerivableContractAddress
  pendingTxs: Array<PendingSwapTransactionType>

  constructor(config: IEngineConfig & { RESOURCE: Resource, AGGREGATOR: Aggregator }, profile: Profile) {
    this.RESOURCE = config.RESOURCE
    this.AGGREGATOR = config.AGGREGATOR
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

  async callStaticMultiSwap({ params, value, gasLimit }: any): Promise<any> {
    try {
      const contract = this.getRouterContract(this.signer)
      return await contract.callStatic.exec(...params, {
        value: value || bn(0),
        gasLimit: gasLimit || undefined,
      })
    } catch (error) {
      throw error
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
    // @ts-ignore
    // const stateCalHelper = this.getStateCalHelperContract()

    const outputs: {
      eip: number
      token: string
      id: string | BigNumber
      amountOutMin: string | number | BigNumber
      recipient: string | undefined
    }[] = []
    steps.forEach((step) => {
      const poolGroup = this.getPoolPoolGroup(step.tokenIn, step.tokenOut)

      outputs.push({
        recipient: this.account,
        eip: isErc1155Address(step.tokenOut) ? 1155 : step.tokenOut === NATIVE_ADDRESS ? 0 : 20,
        token: isErc1155Address(step.tokenOut) ? (this.derivableAdr.token as string) : step.tokenOut,
        id: isErc1155Address(step.tokenOut)
          ? packId(
              this.getIdByAddress(step.tokenOut, poolGroup.TOKEN_R).toString(),
              this.getAddressByErc1155Address(step.tokenOut, poolGroup.TOKEN_R),
            )
          : bn(0),
        amountOutMin: step.amountOutMin,
      })
    })
    let nativeAmountToWrap = bn(0)

    const metaDatas: any = []
    const promises: any = []
    steps.forEach((step) => {
      const poolGroup = this.getPoolPoolGroup(step.tokenIn, step.tokenOut)

      if (
        (step.tokenIn === NATIVE_ADDRESS || step.tokenOut === NATIVE_ADDRESS) &&
        poolGroup.TOKEN_R !== this.profile.configs.wrappedTokenAddress
      ) {
        throw 'This pool do not support swap by native Token'
      }

      const poolIn = this.getAddressByErc1155Address(step.tokenIn, poolGroup.TOKEN_R)
      const poolOut = this.getAddressByErc1155Address(step.tokenOut, poolGroup.TOKEN_R)

      const idIn = this.getIdByAddress(step.tokenIn, poolGroup.TOKEN_R)
      const idOut = this.getIdByAddress(step.tokenOut, poolGroup.TOKEN_R)
      if (step.tokenIn === NATIVE_ADDRESS) {
        nativeAmountToWrap = nativeAmountToWrap.add(step.amountIn)
      }

      if (step.useSweep && isErc1155Address(step.tokenOut)) {
        const { inputs, populateTxData } = this.getSweepCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut })

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
        const { inputs, populateTxData } = this.getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut })
        metaDatas.push({
          code: this.derivableAdr.stateCalHelper,
          inputs,
        })
        promises.push(...populateTxData)
      }

      if (submitFetcherV2 && !fetcherData) {
        const pool = isErc1155Address(step.tokenIn) ? this.RESOURCE.pools[poolIn] : this.RESOURCE.pools[poolOut]
        if (pool?.window) {
          promises.push(isCalculate ? this.fetchPriceMockTx(pool) : this.fetchPriceTx(pool))
        }
      }
    })
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

  getSweepCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut }: SwapCallDataParameterType): SwapCallDataReturnType {
    try {
      const stateCalHelper = this.getStateCalHelperContract()

      const swapCallData = this.getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut })

      const inputs = [
        {
          mode: TRANSFER,
          eip: 1155,
          token: this.derivableAdr.token,
          id: packId(idOut + '', poolOut),
          amountIn: step.currentBalanceOut,
          recipient: stateCalHelper.address,
        },
        ...swapCallData.inputs,
      ]

      const populateTxData = [
        ...swapCallData.populateTxData,
        stateCalHelper.populateTransaction.sweep(packId(idOut + '', poolOut), this.account),
      ]

      return {
        inputs,
        populateTxData,
      }
    } catch (error) {
      throw error
    }
  }

  getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut }: SwapCallDataParameterType): SwapCallDataReturnType {
    try {
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
                mode: PAYMENT,
                eip: isErc1155Address(step.tokenIn) ? 1155 : 20,
                token: isErc1155Address(step.tokenIn) ? this.derivableAdr.token : step.tokenIn,
                id: isErc1155Address(step.tokenIn) ? packId(idIn.toString(), poolIn) : 0,
                amountIn: step.amountIn,
                recipient:
                  isAddress(step.tokenIn) && this.wrapToken(step.tokenIn) !== poolGroup.TOKEN_R
                    ? this.getUniPool(step.tokenIn, poolGroup.TOKEN_R)
                    : isErc1155Address(step.tokenIn)
                    ? poolIn
                    : poolOut,
              },
            ]

      const populateTxData = []
      
      let amountIn = step.payloadAmountIn ? step.payloadAmountIn : step.amountIn
      const OPEN_RATE = this.RESOURCE.pools[poolOut]?.OPEN_RATE
      if (OPEN_RATE && [POOL_IDS.A, POOL_IDS.B].includes(idOut.toNumber())) {
        amountIn = amountIn.mul(OPEN_RATE).div(Q128)
      }

      if (isAddress(step.tokenIn) && this.wrapToken(step.tokenIn) !== poolGroup.TOKEN_R) {
        const getRateData = {
          userAddress: this.getStateCalHelperContract().address,
          ignoreChecks: true,
          srcToken: step.tokenIn,
          srcDecimals: 18, // need to import
          srcAmount: amountIn.toString(),
          destToken: poolGroup.TOKEN_R,
          destDecimals: 18,// need to import
          partner: 'derion.io',
          side: 'SELL',
        }
        const openData = {
          poolAddress: poolOut,
          poolId: idOut.toNumber()
        }
        this.AGGREGATOR.getRateAndBuildTxSwapApi(getRateData, openData, this.getStateCalHelperContract()).then(res => {
          const {openTx} = res
          populateTxData.push(openTx)
        })
        // populateTxData.push(
        //   this.generateSwapParams('swapAndOpen', {
        //     side: idOut,
        //     deriPool: poolOut,
        //     uniPool: this.getUniPool(step.tokenIn, poolGroup.TOKEN_R),
        //     token: step.tokenIn,
        //     amount: amountIn,
        //     payer: this.account,
        //     recipient: this.account,
        //     INDEX_R: this.getIndexR(poolGroup.TOKEN_R),
        //   }),
        // )
      } else if (isAddress(step.tokenOut) && this.wrapToken(step.tokenOut) !== poolGroup.TOKEN_R) {
        populateTxData.push(
          this.generateSwapParams('closeAndSwap', {
            side: idIn,
            deriPool: poolIn,
            uniPool: this.getUniPool(step.tokenOut, poolGroup.TOKEN_R),
            token: step.tokenOut,
            amount: step.payloadAmountIn ? step.payloadAmountIn : step.amountIn,
            payer: this.account,
            recipient: this.account,
            INDEX_R: this.getIndexR(poolGroup.TOKEN_R),
          }),
        )
      } else {
        populateTxData.push(
          this.generateSwapParams('swap', {
            sideIn: idIn,
            poolIn: isErc1155Address(step.tokenIn) ? poolIn : poolOut,
            sideOut: idOut,
            poolOut: isErc1155Address(step.tokenOut) ? poolOut : poolIn,
            amountIn,
            maturity: 0,
            payer: this.account,
            recipient: this.account,
            INDEX_R: this.getIndexR(poolGroup.TOKEN_R),
          }),
        )
      }
      return {
        inputs,
        populateTxData,
      }
    } catch (error) {
      throw error
    }
  }

  wrapToken(address: string): string {
    if (address === NATIVE_ADDRESS) {
      return this.profile.configs.wrappedTokenAddress
    }

    return address
  }

  generateSwapParams(method: string, params: any): { [key: string]: any } {
    try {
      const stateCalHelper = this.getStateCalHelperContract()
      const functionInterface = Object.values(stateCalHelper.interface.functions).find((f: any) => f.name === method)?.inputs[0].components
      const formattedParams: { [key: string]: any } = {}
      for (const name in params) {
        if (functionInterface?.find((c) => c.name === name)) {
          formattedParams[name] = params[name]
        }
      }

      return stateCalHelper.populateTransaction[method](formattedParams)
    } catch (error) {
      throw error
    }
  }

  getIdByAddress(address: string, TOKEN_R: string): BigNumber {
    try {
      if (isErc1155Address(address)) {
        return bn(address.split('-')[1])
      } else if (address === TOKEN_R) {
        return bn(POOL_IDS.R)
      } else if (address === NATIVE_ADDRESS && TOKEN_R === this.profile.configs.wrappedTokenAddress) {
        return bn(POOL_IDS.native)
      }
      return bn(0)
    } catch (e) {
      throw new Error('Token id not found')
    }
  }

  getPoolPoolGroup(addressIn: string, addressOut: string): PoolGroupReturnType {
    try {
      const poolIn = isErc1155Address(addressIn) ? this.RESOURCE.pools[addressIn.split('-')[0]] : null

      const poolOut = isErc1155Address(addressOut) ? this.RESOURCE.pools[addressOut.split('-')[0]] : null

      if (!poolIn && !poolOut) {
        throw 'Cannot detect pool to swap'
      }

      if (poolIn && poolOut && poolIn.TOKEN_R !== poolOut.TOKEN_R) {
        throw 'Cannot swap throw multi pool (need to same Token R)'
      }

      const result: { pools: { [key: string]: PoolType }; TOKEN_R: string } = { pools: {}, TOKEN_R: '' }
      if (poolIn) {
        result.pools[poolIn.poolAddress] = poolIn
        result.TOKEN_R = poolIn.TOKEN_R
      }
      if (poolOut) {
        result.pools[poolOut.poolAddress] = poolOut
        result.TOKEN_R = poolOut.TOKEN_R
      }

      return result
    } catch (error) {
      throw error
    }
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
    try {
      const { params, value } = await this.convertStepToActions({
        steps: [...steps],
        submitFetcherV2,
        fetcherData,
      })

      // await this.callStaticMultiSwap({
      //   params,
      //   value,
      //   gasLimit,
      //   gasPrice: gasPrice || undefined
      // })
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
    } catch (e) {
      throw e
    }
  }

  getAddressByErc1155Address(address: string, TOKEN_R: string): string {
    try {
      if (isErc1155Address(address)) {
        return address.split('-')[0]
      }
      if (address === NATIVE_ADDRESS && TOKEN_R === this.profile.configs.wrappedTokenAddress) {
        return this.profile.configs.wrappedTokenAddress
      }

      return address
    } catch (error) {
      throw error
    }
  }

  getRouterContract(provider: any): Contract {
    return new ethers.Contract(this.profile.configs.helperContract.utr as string, this.profile.getAbi('UTR'), provider)
  }

  getStateCalHelperContract(provider?: any): Contract {
    return new ethers.Contract(this.derivableAdr.stateCalHelper as string, this.profile.getAbi('Helper'), provider || this.provider)
  }

  getIndexR(tokenR: string): BigNumber {
    try {
      const { quoteTokenIndex, address } = this.RESOURCE.getSingleRouteToUSD(tokenR) ?? {}
      if (!address) {
        return bn(0)
      }
      return bn(ethers.utils.hexZeroPad(bn(quoteTokenIndex).shl(255).add(address).toHexString(), 32))
    } catch (error) {
      throw error
    }
  }

  getUniPool(tokenIn: string, tokenR: string): string {
    try {
      const routeKey = Object.keys(this.profile.routes).find((r) => {
        return r === `${tokenR}-${tokenIn}` || r === `${tokenIn}-${tokenR}`
      })
      if (!this.profile.routes[routeKey || ''] || !this.profile.routes[routeKey || ''][0].address) {
        console.error(`Can't find router, please select other token`)
        throw `Can't find router, please select other token`
      }
      return this.profile.routes[routeKey || ''][0].address
    } catch (error) {
      throw error
    }
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
    try {
      if (blockNumber == null) {
        blockNumber = await this.provider.getBlockNumber()
      }
      const getProof = OracleSdkAdapter.getProofFactory(this.providerGetProof)
      const getBlockByNumber = OracleSdkAdapter.getBlockByNumberFactory(this.overrideProvider)
      // get the proof from the SDK
      const proof = await OracleSdk.getProof(
        getProof,
        getBlockByNumber,
        pool.pair,
        pool.quoteTokenIndex,
        blockNumber - (pool.window.toNumber() >> 1),
      )
      // Connect to the network
      const contractWithSigner = new Contract(pool.FETCHER, this.profile.getAbi('FetcherV2'), this.signer)
      const data = await contractWithSigner.populateTransaction.submit(pool.ORACLE, proof)
      return {
        inputs: [],
        code: pool.FETCHER,
        data: data.data,
      }
    } catch (error) {
      throw error
    }
  }

  async fetchPriceMockTx(pool: PoolType, blockNumber?: number): Promise<PriceTxReturnType> {
    try {
      if (blockNumber == null) {
        blockNumber = await this.provider.getBlockNumber()
      }
      const targetBlock = blockNumber - (pool.window.toNumber() >> 1)
      const getStorageAt = OracleSdkAdapter.getStorageAtFactory(this.overrideProvider)
      const accumulator = await OracleSdk.getAccumulatorPrice(getStorageAt, pool.pair, pool.quoteTokenIndex, targetBlock)

      // Connect to the network
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
    } catch (error) {
      throw error
    }
  }

  getOverrideProvider(): JsonRpcProvider {
    try {
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
    } catch (error) {
      throw error
    }
  }
}
