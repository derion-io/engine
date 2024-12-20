import { JsonRpcProvider, Networkish, TransactionReceipt } from '@ethersproject/providers'
import { BigNumber, Contract, Signer, utils } from 'ethers'
import { ConnectionInfo, isAddress } from 'ethers/lib/utils'
import { Profile } from '../profile'
import { Q128 } from '../services/resource'
import { PendingSwapTransactionType, SdkPool, SdkPools } from '../types'
import { ProfileConfigs } from '../utils/configs'
import { NATIVE_ADDRESS, POOL_IDS, ZERO_ADDRESS } from '../utils/constant'
import { bn, packId } from '../utils/helper'
import * as OracleSdk from '../utils/OracleSdk'
import * as OracleSdkAdapter from '../utils/OracleSdkAdapter'
import { decodeErc1155Address, getAddressByErc1155Address, getIdByAddress, isErc1155Address } from './utils'
const PAYMENT = 0
const TRANSFER = 1
const CALL_VALUE = 2
const PARA_DATA_BASE_URL = 'https://api.paraswap.io/prices'
const PARA_VERSION = '5'
const PARA_BUILD_TX_BASE_URL = 'https://api.paraswap.io/transactions'

export type rateDataAggregatorType = {
  userAddress: string
  ignoreChecks: boolean
  srcToken: string
  //   srcDecimals: number
  srcAmount?: string
  destAmount?: string
  destToken: string
  //   destDecimals: number
  partner: string
  side: string
  excludeDirectContractMethods?: boolean
  otherExchangePrices?: boolean
  ignoreGasEstimate?: boolean
  ignoreAllowance?: boolean
}
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
  tokenDecimals?: {
    srcDecimals: number
    destDecimals: number
  }
  deps: {
    signer: Signer
    pools: SdkPools
  }
}

export type PoolGroupReturnType = {
  pools: SdkPools
  TOKEN_R: string
}

export type SwapCallDataParameterType = {
  step: SwapStepType
  poolGroup: PoolGroupReturnType
  poolIn: string
  poolOut: string
  idIn: BigNumber
  idOut: BigNumber
  deps: {
    signer: Signer
    pools: SdkPools
  }
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
export type SwapAndOpenAggregatorType = {
  poolAddress: string
  poolId: number
}
export class Swapper {
  configs: ProfileConfigs
  profile: Profile
  provider: JsonRpcProvider
  overrideProvider: JsonRpcProvider
  helperContract: Contract
  paraDataBaseURL: string
  paraBuildTxBaseURL: string
  paraDataBaseVersion: string
  constructor(configs: ProfileConfigs, profile: Profile, url?: ConnectionInfo | string, network?: Networkish) {
    this.profile = profile
    this.configs = configs
    this.provider = new JsonRpcProvider(url, network)
    this.overrideProvider = new JsonRpcProvider(url, network)
    this.overridedProvider()
    this.helperContract = new Contract(
      this.profile.configs.derivable.stateCalHelper as string,
      this.profile.getAbi('Helper'),
      this.provider,
    )
    this.paraDataBaseURL = PARA_DATA_BASE_URL
    this.paraBuildTxBaseURL = PARA_BUILD_TX_BASE_URL
    this.paraDataBaseVersion = PARA_VERSION
  }

  overridedProvider(): JsonRpcProvider {
    try {
      const stateOverride: any = {}
      // poolAddresses.forEach((address: string) => {
      stateOverride[this.profile.configs.derivable.logic as string] = {
        code: this.profile.getAbi('View').deployedBytecode,
      }
      if (this.profile.configs.derivable.uniswapV2Fetcher) {
        stateOverride[this.profile.configs.derivable.uniswapV2Fetcher as string] = {
          code: this.profile.getAbi('FetcherV2Override').deployedBytecode,
        }
      }

      this.overrideProvider.setStateOverride({
        ...stateOverride,
        [`0x${this.profile.getAbi('TokensInfo').deployedBytecode.slice(-40)}` as string]: {
          code: this.profile.getAbi('TokensInfo').deployedBytecode,
        },
      })
      return this.overrideProvider
    } catch (error) {
      throw error
    }
  }

  getPoolPoolGroup(addressIn: string, addressOut: string, pools: SdkPools): PoolGroupReturnType {
    try {
      const poolIn = isErc1155Address(addressIn) ? pools[addressIn.split('-')[0]] : null

      const poolOut = isErc1155Address(addressOut) ? pools[addressOut.split('-')[0]] : null

      if (!poolIn && !poolOut) {
        throw 'Cannot detect pool to swap'
      }

      if (poolIn && poolOut && poolIn?.config?.TOKEN_R !== poolOut?.config?.TOKEN_R) {
        throw 'Cannot swap throw multi pool (need to same Token R)'
      }

      const result: { pools: { [key: string]: SdkPool }; TOKEN_R: string } = { pools: {}, TOKEN_R: '' }
      if (poolIn) {
        result.pools[poolIn.address] = poolIn
        result.TOKEN_R = poolIn.config?.TOKEN_R || ''
      }
      if (poolOut) {
        result.pools[poolOut.address] = poolOut
        result.TOKEN_R = poolOut.config?.TOKEN_R || ''
      }

      return result
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
      const functionInterface = Object.values(this.helperContract.interface.functions).find((f: any) => f.name === method)?.inputs[0]
        .components
      const formattedParams: { [key: string]: any } = {}
      for (const name in params) {
        if (functionInterface?.find((c) => c.name === name)) {
          formattedParams[name] = params[name]
        }
      }

      return this.helperContract.populateTransaction[method](formattedParams)
    } catch (error) {
      throw error
    }
  }
  getSingleRouteToUSD(
    token: string,
    types: Array<string> = ['uniswap3'],
  ):
    | {
        quoteTokenIndex: number
        stablecoin: string
        address: string
      }
    | undefined {
    try {
      const {
        routes,
        configs: { stablecoins },
      } = this.profile
      for (const stablecoin of stablecoins) {
        for (const asSecond of [false, true]) {
          const key = asSecond ? `${stablecoin}-${token}` : `${token}-${stablecoin}`
          const route = routes[key]
          if (route?.length != 1) {
            continue
          }
          const { type, address } = route[0]
          if (!types.includes(type)) {
            continue
          }
          const quoteTokenIndex = token.localeCompare(stablecoin, undefined, { sensitivity: 'accent' }) < 0 ? 1 : 0
          return {
            quoteTokenIndex,
            stablecoin,
            address,
          }
        }
      }
      return undefined
    } catch (error) {
      throw error
    }
  }
  getIndexR(tokenR: string): BigNumber {
    try {
      const { quoteTokenIndex, address } = this.getSingleRouteToUSD(tokenR) ?? {}
      if (!address) {
        return bn(0)
      }
      return bn(utils.hexZeroPad(bn(quoteTokenIndex).shl(255).add(address).toHexString(), 32))
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
  async getSwapCallData({
    step,
    poolGroup,
    poolIn,
    poolOut,
    idIn,
    idOut,
    deps: { signer, pools },
  }: SwapCallDataParameterType): Promise<SwapCallDataReturnType> {
    try {
      const needAggregator = isAddress(step.tokenIn) && this.wrapToken(step.tokenIn) !== poolGroup.TOKEN_R
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
                eip: isErc1155Address(step.tokenIn) ? 1155 : 20,
                token: isErc1155Address(step.tokenIn) ? this.profile.configs.derivable.token : step.tokenIn,
                id: isErc1155Address(step.tokenIn) ? packId(idIn.toString(), poolIn) : 0,
                amountIn: step.amountIn,
                recipient:
                  isAddress(step.tokenIn) && this.wrapToken(step.tokenIn) !== poolGroup.TOKEN_R
                    ? this.helperContract.address
                    : // this.getUniPool(step.tokenIn, poolGroup.TOKEN_R)
                    isErc1155Address(step.tokenIn)
                    ? poolIn
                    : poolOut,
              },
            ]

      const populateTxData = []

      let amountIn = step.payloadAmountIn ? step.payloadAmountIn : step.amountIn
      const account = await signer.getAddress()

      if (needAggregator) {
        // TODO: handle payloadAmountIn or inputTolerance for aggreateAndOpen
        const getRateData = {
          userAddress: this.helperContract.address,
          ignoreChecks: true,
          srcToken: step.tokenIn,
          srcAmount: amountIn.toString(),
          destToken: poolGroup.TOKEN_R,
          partner: 'derion.io',
          side: 'SELL',
        }
        // console.log(getRateData)
        const openData = {
          poolAddress: poolOut,
          poolId: idOut.toNumber(),
        }
        // const helper = new Contract(this.helperContract.address as string, this.profile.getAbi('Helper'), this.provider)
        const { openTx } = await this.getAggRateAndBuildTxSwapApi(getRateData, openData, signer)
        // console.log(openTx)
        populateTxData.push(openTx)

        // populateTxData.push(
        //   this.generateSwapParams('swapAndOpen', {
        //     side: idOut,
        //     deriPool: poolOut,
        //     uniPool: this.getUniPool(step.tokenIn, poolGroup.TOKEN_R),
        //     token: step.tokenIn,
        //     amount: amountIn,
        //     payer: this.account,
        //     recipient: this.account,
        //     INDEX_R: this.RESOURCE.getIndexR(poolGroup.TOKEN_R),
        //   }),
        // )
      } else if (isAddress(step.tokenOut) && this.wrapToken(step.tokenOut) !== poolGroup.TOKEN_R) {
        populateTxData.push(
          this.generateSwapParams('closeAndSwap', {
            side: idIn,
            deriPool: poolIn,
            uniPool: this.getUniPool(step.tokenOut, poolGroup.TOKEN_R),
            token: step.tokenOut,
            amount: amountIn,
            payer: account,
            recipient: account,
            INDEX_R: this.getIndexR(poolGroup.TOKEN_R),
          }),
        )
      } else {
        const OPEN_RATE = pools[poolOut]?.config?.OPEN_RATE
        if (OPEN_RATE && [POOL_IDS.A, POOL_IDS.B].includes(idOut.toNumber())) {
          amountIn = amountIn.mul(OPEN_RATE).div(Q128)
        }

        populateTxData.push(
          this.generateSwapParams('swap', {
            sideIn: idIn,
            poolIn: isErc1155Address(step.tokenIn) ? poolIn : poolOut,
            sideOut: idOut,
            poolOut: isErc1155Address(step.tokenOut) ? poolOut : poolIn,
            amountIn,
            maturity: 0,
            payer: account,
            recipient: account,
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
  async getSweepCallData({
    step,
    poolGroup,
    poolIn,
    poolOut,
    idIn,
    idOut,
    deps: { signer, pools },
  }: SwapCallDataParameterType): Promise<SwapCallDataReturnType> {
    try {
      const swapCallData = await this.getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut, deps: { signer, pools } })

      const inputs = [
        {
          mode: TRANSFER,
          eip: 1155,
          token: this.profile.configs.derivable.token,
          id: packId(idOut + '', poolOut),
          amountIn: step.currentBalanceOut,
          recipient: this.helperContract.address,
        },
        ...swapCallData.inputs,
      ]

      const populateTxData = [
        ...swapCallData.populateTxData,
        this.helperContract.populateTransaction.sweep(packId(idOut + '', poolOut), signer),
      ]

      return {
        inputs,
        populateTxData,
      }
    } catch (error) {
      throw error
    }
  }
  async convertStepToActions({
    steps,
    submitFetcherV2,
    isCalculate = false,
    fetcherData,
    deps: { signer, pools },
  }: {
    steps: Array<SwapStepType>
    submitFetcherV2: boolean
    isCalculate?: boolean
    fetcherData?: any
    deps: {
      signer: Signer
      pools: SdkPools
    }
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
    const recipient = await signer.getAddress()
    steps.forEach((step) => {
      const poolGroup = this.getPoolPoolGroup(step.tokenIn, step.tokenOut, pools)

      outputs.push({
        recipient,
        eip: isErc1155Address(step.tokenOut) ? 1155 : step.tokenOut === NATIVE_ADDRESS ? 0 : 20,
        token: isErc1155Address(step.tokenOut) ? (this.profile.configs.derivable.token as string) : step.tokenOut,
        id: isErc1155Address(step.tokenOut)
          ? packId(
              getIdByAddress(step.tokenOut, poolGroup.TOKEN_R, this.profile.configs.wrappedTokenAddress).toString(),
              getAddressByErc1155Address(step.tokenOut, poolGroup.TOKEN_R, this.profile.configs.wrappedTokenAddress),
            )
          : bn(0),
        amountOutMin: step.amountOutMin,
      })
    })
    let nativeAmountToWrap = bn(0)

    const metaDatas: any = []
    const promises: any = []
    const fetchStepPromise = steps.map(async (step) => {
      const poolGroup = this.getPoolPoolGroup(step.tokenIn, step.tokenOut, pools)

      // if (
      //   (step.tokenIn === NATIVE_ADDRESS || step.tokenOut === NATIVE_ADDRESS) &&
      //   poolGroup.TOKEN_R !== this.profile.configs.wrappedTokenAddress
      // ) {
      //   throw 'This pool do not support swap by native Token'
      // }

      const poolIn = getAddressByErc1155Address(step.tokenIn, poolGroup.TOKEN_R, this.profile.configs.wrappedTokenAddress)
      const poolOut = getAddressByErc1155Address(step.tokenOut, poolGroup.TOKEN_R, this.profile.configs.wrappedTokenAddress)

      const idIn = getIdByAddress(step.tokenIn, poolGroup.TOKEN_R, this.profile.configs.wrappedTokenAddress)
      const idOut = getIdByAddress(step.tokenOut, poolGroup.TOKEN_R, this.profile.configs.wrappedTokenAddress)
      if (step.tokenIn === NATIVE_ADDRESS) {
        nativeAmountToWrap = nativeAmountToWrap.add(step.amountIn)
      }

      if (step.useSweep && isErc1155Address(step.tokenOut)) {
        const { inputs, populateTxData } = await this.getSweepCallData({
          step,
          poolGroup,
          poolIn,
          poolOut,
          idIn,
          idOut,
          deps: { signer, pools },
        })

        metaDatas.push(
          {
            code: this.helperContract.address,
            inputs,
          },
          {
            code: this.helperContract.address,
            inputs: [],
          },
        )

        promises.push(...populateTxData)
      } else {
        const { inputs, populateTxData } = await this.getSwapCallData({
          step,
          poolGroup,
          poolIn,
          poolOut,
          idIn,
          idOut,
          deps: { signer, pools },
        })
        metaDatas.push({
          code: this.helperContract.address,
          inputs,
        })
        promises.push(...populateTxData)
      }

      if (submitFetcherV2 && !fetcherData) {
        const pool = isErc1155Address(step.tokenIn) ? pools[poolIn] : pools[poolOut]
        if ((pool as any)?.window) {
          promises.push(isCalculate ? this.fetchPriceMockTx({ pool, signer }) : this.fetchPriceTx({ pool, signer }))
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
  async getAggRateAndBuildTxSwapApi(
    getRateData: rateDataAggregatorType,
    openData: SwapAndOpenAggregatorType,
    signer: Signer,
    helperOverride?: Contract,
    slippage?: number,
  ): Promise<{
    rateData: any
    swapData: any
    openTx: any
  }> {
    const address = await signer.getAddress()
    try {
      const rateData = await this.getAggRate(getRateData, signer)
      if (rateData.error) {
        throw new Error(rateData.error)
      }
      const swapData = await this.buildAggTx(getRateData, rateData, slippage)
      if (swapData.error) {
        throw new Error(swapData.error)
      }
      let openTx = null
      if (helperOverride) {
        openTx = await helperOverride.populateTransaction.aggregateAndOpen({
          token: getRateData.srcToken,
          tokenOperator: rateData.priceRoute.tokenTransferProxy,
          aggregator: swapData.to,
          aggregatorData: swapData.data,
          pool: openData?.poolAddress,
          side: openData?.poolId,
          payer: address, // for event Swap.payer
          recipient: address,
          INDEX_R: this.getIndexR(getRateData.destToken), // TOKEN_R
        })
      }
      return {
        rateData,
        swapData,
        openTx,
      }
    } catch (error) {
      throw error
    }
  }

  async getAggRate(getRateData: rateDataAggregatorType, signer: Signer) {
    const address = await signer.getAddress()
    const amount = getRateData?.srcAmount || getRateData.destAmount
    const rateData = await (
      await fetch(
        `${this.paraDataBaseURL}/?version=${this.paraDataBaseVersion}&srcToken=${getRateData.srcToken}&srcDecimals=${18}&destToken=${
          getRateData.destToken
        }&destDecimals=${18}&amount=${amount}&side=${getRateData.side}&excludeDirectContractMethods=${
          getRateData.excludeDirectContractMethods || false
        }&otherExchangePrices=${getRateData.otherExchangePrices || true}&partner=${getRateData.partner}&network=${
          this.configs.chainId
        }&userAddress=${address}`,
        {
          method: 'GET',
          redirect: 'follow',
        },
      )
    ).json()
    return rateData
  }
  async buildAggTx(getRateData: rateDataAggregatorType, rateData: any, slippage?: number) {
    const myHeaders: any = new Headers()
    myHeaders.append('Content-Type', 'application/json')
    const swapData = await (
      await fetch(
        `${this.paraBuildTxBaseURL}/${this.configs.chainId}?ignoreGasEstimate=${getRateData.ignoreGasEstimate || true}&ignoreAllowance=${
          getRateData.ignoreAllowance || true
        }&gasPrice=${rateData.priceRoute.gasCost}`,
        {
          method: 'POST',
          headers: myHeaders,
          body: JSON.stringify({
            ...getRateData,
            slippage: slippage || 500, // 5%
            partner: getRateData.partner,
            priceRoute: rateData.priceRoute,
          }),
        },
      )
    ).json()
    return swapData
  }
  async fetchPriceTx({ pool, blockNumber, signer }: { pool: SdkPool; blockNumber?: number; signer: Signer }): Promise<PriceTxReturnType> {
    try {
      if (blockNumber == null) {
        blockNumber = await this.provider.getBlockNumber()
      }
      // const getProof = OracleSdkAdapter.getProofFactory(this.provider)
      // const getBlockByNumber = OracleSdkAdapter.getBlockByNumberFactory(this.overrideProvider)
      // // get the proof from the SDK
      // const proof = await OracleSdk.getProof(
      //   getProof,
      //   getBlockByNumber,
      //   pool.pair,
      //   pool.quoteTokenIndex,
      //   blockNumber - (pool.window.toNumber() >> 1),
      // )
      // // Connect to the network
      // const contractWithSigner = new Contract(pool.FETCHER, this.profile.getAbi('FetcherV2'), signer)
      // const data = await contractWithSigner.populateTransaction.submit(pool.ORACLE, proof)
      return {
        inputs: [],
        code: '',
        // pool.FETCHER,
        data: '',
        // data.data,
      }
    } catch (error) {
      throw error
    }
  }
  async needToSubmitFetcher(pool: SdkPool, signer: Signer): Promise<boolean> {
    try {
      const fetcherContract = new Contract(pool.config?.FETCHER || '', this.profile.getAbi('FetcherV2'), signer)
      await fetcherContract.callStatic.fetch(pool?.config?.ORACLE || '')
    } catch (e) {
      if (e?.reason === 'OLD') {
        return true
      }
    }
    return false
  }
  async fetchPriceMockTx({
    pool,
    blockNumber,
    signer,
  }: {
    pool: SdkPool
    blockNumber?: number
    signer: Signer
  }): Promise<PriceTxReturnType> {
    try {
      if (blockNumber == null) {
        blockNumber = await this.provider.getBlockNumber()
      }
      // const targetBlock = blockNumber - (pool.window.toNumber() >> 1)
      // const getStorageAt = OracleSdkAdapter.getStorageAtFactory(this.overrideProvider)
      // const accumulator = await OracleSdk.getAccumulatorPrice(getStorageAt, pool.pair, pool.quoteTokenIndex, targetBlock)

      // // Connect to the network
      // const contractWithSigner = new Contract(pool?.config?.FETCHER || '', this.profile.getAbi('FetcherV2Mock').abi, signer)
      // const data = await contractWithSigner.populateTransaction.submitPrice(
      //   pool?.config?.ORACLE,
      //   bn(accumulator.price),
      //   targetBlock,
      //   accumulator.timestamp,
      // )
      return {
        inputs: [],
        code: pool?.config?.FETCHER || '',
        data: '',
      }
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
    deps,
  }: MultiSwapParameterType): Promise<TransactionReceipt> {
    try {
      const { params, value } = await this.convertStepToActions({
        steps: [...steps],
        submitFetcherV2,
        fetcherData,
        deps,
      })

      // await this.callStaticMultiSwap({
      //   params,
      //   value,
      //   gasLimit,
      //   gasPrice: gasPrice || undefined
      // })
      const utr = new Contract(this.profile.configs.helperContract.utr as string, this.profile.getAbi('UTR'), deps.signer)
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
  swap = async ({
    tokenIn,
    amount,
    tokenOut,
    deps,
    gasLimit,
    callStatic,
  }: {
    tokenIn: string
    tokenOut: string
    amount: string
    deps: {
      pools: SdkPools
      signer: Signer
    }
    callStatic?: boolean
    gasLimit?: BigNumber
  }): Promise<any> => {
    const pools = deps.pools
    const isOpenPos = isErc1155Address(tokenOut) ? tokenOut : tokenIn
    const poolSwapAddress = isOpenPos ? tokenOut : tokenIn
    const poolSwap = pools[decodeErc1155Address(poolSwapAddress).address]
    if (!poolSwap) throw 'invalid pool'
    const fetcherV2 = await this.needToSubmitFetcher(poolSwap, deps.signer)
    const fetcherData = await this.fetchPriceTx({ pool: poolSwap, signer: deps.signer })

    // const tokenContract = new Contract(this.profile.configs.derivable.token, TokenAbi, this.provider)
    // const currentBalanceOut = await tokenContract.balanceOf(deps.signer, packId(poolSide.toString(), poolOut))
    const tx: any = await this.multiSwap({
      steps: [
        {
          tokenIn,
          tokenOut,
          amountIn: bn(amount),
          amountOutMin: 0,
          useSweep: !!(
            (isErc1155Address(tokenOut) && (pools?.[decodeErc1155Address(tokenOut)?.address]?.config?.MATURITY || 0) > 0)
            // && tokenOutMaturity?.gt(0)
            // && balances[tokenOut]?.gt(0)
          ),
          //   currentBalanceOut: balances[tokenOut]
        },
      ],
      onSubmitted: (pendingTx: PendingSwapTransactionType) => {},
      gasLimit: gasLimit ?? bn(1000000),
      callStatic,
      deps,
      fetcherData: fetcherData,
      submitFetcherV2: fetcherV2,
    })
    return tx
  }
  simulate = async (params: {
    tokenIn: string
    tokenOut: string
    amount: string
    deps: {
      pools: SdkPools
      signer: Signer
    }
    gasLimit?: BigNumber
  }): Promise<any> => {
    return await this.swap({...params, callStatic: true})
  }
  //   swap = async ({
  //     tokenIn,
  //     tokenOut,
  //     deps,
  //   }: {
  //     tokenIn: string
  //     tokenOut: string
  //     amount: string
  //     deps: {
  //       pools: SdkPools
  //       signer: Signer
  //     }
  //   }): Promise<any> => {
  //     return {
  //       tokenIn,
  //       tokenOut,
  //       deps,
  //     }
  //     // const currentPool = this.pool
  //     // const poolOut = currentPool.poolAddress
  //     // const provider = this.RESOURCE.provider
  //     // const tokenContract = new Contract(this.profile.configs.derivable.token, TokenAbi, provider)
  //     // const currentBalanceOut = await tokenContract.balanceOf(signer, packId(poolSide.toString(), poolOut))
  //     // const steps = [
  //     //   {
  //     //     amountIn: bn(numberToWei(amountIn, tokenInDecimals)),
  //     //     tokenIn,
  //     //     tokenOut: poolOut + '-' + POOL_IDS.C,
  //     //     amountOutMin: 0,
  //     //     currentBalanceOut,
  //     //     useSweep: true,
  //     //   },
  //     // ]

  //     // const fetcherV2 = await this.SWAP.needToSubmitFetcher(currentPool)
  //     // const fetcherData = await this.SWAP.fetchPriceTx(currentPool)
  //     // const res = await this.SWAP.multiSwap({
  //     //   fetcherData,
  //     //   submitFetcherV2: fetcherV2,
  //     //   steps,
  //     //   gasLimit: bn(1000000),
  //     //   gasPrice: bn(3e9),
  //     //   callStatic: true,
  //     //   poolOverride: this.pool,
  //     // })
  //     // return res
  //   }
}
