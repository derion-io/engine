import { JsonRpcProvider, Networkish, TransactionReceipt } from '@ethersproject/providers'
import { BigNumber, Contract, ethers, Signer, utils, VoidSigner } from 'ethers'
import { ConnectionInfo, isAddress } from 'ethers/lib/utils'
import { Profile } from './profile'
import { NATIVE_ADDRESS, POOL_IDS, Q128 } from './utils/constant'
const { AddressZero } = ethers.constants

import { addressFromToken, sideFromToken, isPosId, packPosId, throwError, unpackPosId, bn } from './utils'
import { ProfileConfigs, SdkPools } from './type'
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
  srcDecimals?: number
  srcAmount?: string
  destAmount?: string
  destToken: string
  destDecimals?: number
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

export type MultiSwapParameterType = {
  steps: Array<SwapStepType>
  gasLimit?: BigNumber
  gasPrice?: BigNumber
  onSubmitted?: (pendingTx: PendingSwapTransactionType) => void
  callStatic?: boolean
  deps: {
    signer: Signer
    pools: SdkPools
    decimals?: { [token: string]: number }
  }
}

export type SwapCallDataParameterType = {
  step: SwapStepType
  TOKEN_R: string
  poolIn: string
  poolOut: string
  sideIn: number
  sideOut: number
  deps: {
    signer: Signer
    pools: SdkPools
    decimals?: {
      [token: string]: number
    }
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
  pool: string
  side: number
}

export type PendingSwapTransactionType = {
  hash: string
  steps: SwapStepType[]
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
    const utr = this.profile.configs.helperContract.utr
    this.overrideProvider.setStateOverride({
      [utr]: {
        code: this.profile.getAbi('UTROverride').deployedBytecode,
      },
    })

    return this.overrideProvider
  }

  wrapToken(address: string): string {
    if (address === NATIVE_ADDRESS) {
      return this.profile.configs.wrappedTokenAddress
    }

    return address
  }
  generateSwapParams(method: string, params: any): { [key: string]: any } {
    const functionInterface = Object.values(this.helperContract.interface.functions).find((f: any) => f.name === method)?.inputs[0]
      .components
    const formattedParams: { [key: string]: any } = {}
    for (const name in params) {
      if (functionInterface?.find((c) => c.name === name)) {
        formattedParams[name] = params[name]
      }
    }

    return this.helperContract.populateTransaction[method](formattedParams)
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
  }
  getIndexR(tokenR: string): BigNumber {
    const { quoteTokenIndex, address } = this.getSingleRouteToUSD(tokenR) ?? {}
    if (!address) {
      return bn(0)
    }
    return bn(utils.hexZeroPad(bn(quoteTokenIndex).shl(255).add(address).toHexString(), 32))
  }

  getUniPool(tokenIn: string, tokenR: string): string {
    const routeKey = Object.keys(this.profile.routes).find((r) => {
      return r === `${tokenR}-${tokenIn}` || r === `${tokenIn}-${tokenR}`
    })
    if (!this.profile.routes[routeKey || ''] || !this.profile.routes[routeKey || ''][0].address) {
      console.error(`Can't find router, please select other token`)
      throw `Can't find router, please select other token`
    }
    return this.profile.routes[routeKey || ''][0].address
  }
  async getSwapCallData({
    step,
    TOKEN_R,
    poolIn,
    poolOut,
    sideIn,
    sideOut,
    deps: { signer, pools, decimals },
  }: SwapCallDataParameterType): Promise<SwapCallDataReturnType> {
      const needAggregator = isAddress(step.tokenIn) && this.wrapToken(step.tokenIn) !== TOKEN_R
      const inputs =
        step.tokenIn === NATIVE_ADDRESS
          ? [
            {
              mode: CALL_VALUE,
              token: AddressZero,
              eip: 0,
              id: 0,
              amountIn: step.amountIn,
              recipient: AddressZero,
            },
          ]
          : [
            {
              mode: !needAggregator ? PAYMENT : TRANSFER,
              eip: isPosId(step.tokenIn) ? 1155 : 20,
              token: isPosId(step.tokenIn) ? this.profile.configs.derivable.token : step.tokenIn,
              id: isPosId(step.tokenIn) ? bn(packPosId(poolIn, sideIn)) : 0,
              amountIn: step.amountIn,
              recipient:
                isAddress(step.tokenIn) && this.wrapToken(step.tokenIn) !== TOKEN_R
                  ? this.helperContract.address
                  : // this.getUniPool(step.tokenIn, poolGroup.TOKEN_R)
                  isPosId(step.tokenIn)
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
          srcDecimals: decimals?.[step.tokenIn] || 18,
          destDecimals: decimals?.[step.tokenOut] || 18,
          srcAmount: amountIn.toString(),
          destToken: TOKEN_R,
          partner: 'derion.io',
          side: 'SELL',
        }
        // console.log(getRateData)
        const openData = {
          pool: poolOut,
          side: sideOut,
        }
        // const helper = new Contract(this.helperContract.address as string, this.profile.getAbi('Helper'), this.provider)
        const { openTx, swapData, rateData } = await this.getAggRateAndBuildTxSwapApi(getRateData, openData, signer)
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
      } else if (isAddress(step.tokenOut) && this.wrapToken(step.tokenOut) !== TOKEN_R) {
        populateTxData.push(
          this.generateSwapParams('closeAndSwap', {
            side: sideIn,
            deriPool: poolIn,
            uniPool: this.getUniPool(step.tokenOut, TOKEN_R),
            token: step.tokenOut,
            amount: amountIn,
            payer: account,
            recipient: account,
            INDEX_R: this.getIndexR(TOKEN_R),
          }),
        )
      } else {
        const OPEN_RATE = pools[poolOut]?.config?.OPEN_RATE
        if (OPEN_RATE && [POOL_IDS.A, POOL_IDS.B].includes(sideOut)) {
          amountIn = amountIn.mul(OPEN_RATE).div(Q128)
        }

        populateTxData.push(
          this.generateSwapParams('swap', {
            sideIn: sideIn,
            poolIn: isPosId(step.tokenIn) ? poolIn : poolOut,
            sideOut: sideOut,
            poolOut: isPosId(step.tokenOut) ? poolOut : poolIn,
            amountIn,
            maturity: 0,
            payer: account,
            recipient: account,
            INDEX_R: this.getIndexR(TOKEN_R),
          }),
        )
      }
      return {
        inputs,
        populateTxData,
      }
  }
  async getSweepCallData({
    step,
    TOKEN_R,
    poolIn,
    poolOut,
    sideIn,
    sideOut,
    deps: { signer, pools },
  }: SwapCallDataParameterType): Promise<SwapCallDataReturnType> {
    const swapCallData = await this.getSwapCallData({ step, TOKEN_R, poolIn, poolOut, sideIn, sideOut, deps: { signer, pools } })
    const inputs = [
      {
        mode: TRANSFER,
        eip: 1155,
        token: this.profile.configs.derivable.token,
        id: bn(packPosId(poolOut, sideOut)),
        amountIn: step.currentBalanceOut,
        recipient: this.helperContract.address,
      },
      ...swapCallData.inputs,
    ]

    const populateTxData = [
      ...swapCallData.populateTxData,
      this.helperContract.populateTransaction.sweep(packPosId(poolOut, sideOut), signer),
    ]

    return {
      inputs,
      populateTxData,
    }
  }
  async convertStepToActions({
    steps,
    deps: { signer, pools, decimals },
  }: {
    steps: Array<SwapStepType>
    deps: {
      signer: Signer
      pools: SdkPools
      decimals?: { [token: string]: number }
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
      const firstPosId = isPosId(step.tokenIn) ? step.tokenIn : step.tokenOut
      const firstPoolAddress = unpackPosId(firstPosId)[0]
      const TOKEN_R = pools[firstPoolAddress].config?.TOKEN_R ?? throwError('!TOKEN_R')

      outputs.push({
        recipient,
        eip: isPosId(step.tokenOut) ? 1155 : step.tokenOut === NATIVE_ADDRESS ? 0 : 20,
        token: isPosId(step.tokenOut) ? this.profile.configs.derivable.token : step.tokenOut,
        id: isPosId(step.tokenOut)
          ? packPosId(
            addressFromToken(step.tokenOut, TOKEN_R, this.profile.configs.wrappedTokenAddress),
            sideFromToken(step.tokenOut, TOKEN_R, this.profile.configs.wrappedTokenAddress),
          )
          : bn(0),
        amountOutMin: step.amountOutMin,
      })
    })
    let nativeAmountToWrap = bn(0)

    const metaDatas: any = []
    const promises: any = []
    const fetchStepPromise = steps.map(async (step) => {
      const firstPosId = isPosId(step.tokenIn) ? step.tokenIn : step.tokenOut
      const firstPoolAddress = unpackPosId(firstPosId)[0]
      const TOKEN_R = pools[firstPoolAddress].config?.TOKEN_R ?? throwError('!TOKEN_R')

      const poolIn = addressFromToken(step.tokenIn, TOKEN_R, this.profile.configs.wrappedTokenAddress)
      const poolOut = addressFromToken(step.tokenOut, TOKEN_R, this.profile.configs.wrappedTokenAddress)

      const sideIn = sideFromToken(step.tokenIn, TOKEN_R, this.profile.configs.wrappedTokenAddress)
      const sideOut = sideFromToken(step.tokenOut, TOKEN_R, this.profile.configs.wrappedTokenAddress)
      if (step.tokenIn === NATIVE_ADDRESS) {
        nativeAmountToWrap = nativeAmountToWrap.add(step.amountIn)
      }

      if (step.useSweep && isPosId(step.tokenOut)) {
        const { inputs, populateTxData } = await this.getSweepCallData({
          step,
          TOKEN_R,
          poolIn,
          poolOut,
          sideIn,
          sideOut,
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
        // console.log('SwapCall')
        const { inputs, populateTxData } = await this.getSwapCallData({
          step,
          TOKEN_R,
          poolIn,
          poolOut,
          sideIn: sideIn,
          sideOut: sideOut,
          deps: { signer, pools, decimals },
        })
        metaDatas.push({
          code: this.helperContract.address,
          inputs,
        })
        promises.push(...populateTxData)
      }
    })
    await Promise.all(fetchStepPromise)
    const datas: Array<any> = await Promise.all(promises)
    const actions: Array<any> = []

    metaDatas.forEach((metaData: any, key: any) => {
      actions.push({ ...metaData, data: datas[key]?.data })
    })

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
    const rateData = await this.getAggRate(getRateData, signer)
    if (rateData.error) {
      throw new Error(rateData.error)
    }
    const swapData = await this.buildAggTx(getRateData, rateData, slippage)
    if (swapData.error) {
      throw new Error(swapData.error)
    }
    const helper = helperOverride ?? this.helperContract
    const openTx = await helper.populateTransaction.aggregateAndOpen({
      token: getRateData.srcToken,
      tokenOperator: rateData.priceRoute.tokenTransferProxy,
      aggregator: swapData.to,
      aggregatorData: swapData.data,
      pool: openData?.pool,
      side: openData?.side,
      payer: address, // for event Swap.payer
      recipient: address,
      INDEX_R: this.getIndexR(getRateData.destToken), // TOKEN_R
    })
    return {
      rateData,
      swapData,
      openTx,
    }
  }

  async getAggRate(getRateData: rateDataAggregatorType, signer: Signer) {
    const address = await signer.getAddress()
    const amount = getRateData?.srcAmount || getRateData.destAmount
    const rateData = await (
      await fetch(
        `${this.paraDataBaseURL}/?version=${this.paraDataBaseVersion}&srcToken=${getRateData.srcToken}&srcDecimals=${getRateData?.srcDecimals || 18}&destToken=${getRateData.destToken
        }&destDecimals=${getRateData?.destDecimals || 18}&amount=${amount}&side=${getRateData.side}&excludeDirectContractMethods=${getRateData.excludeDirectContractMethods || false
        }&otherExchangePrices=${getRateData.otherExchangePrices || true}&partner=${getRateData.partner}&network=${this.configs.chainId
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
        `${this.paraBuildTxBaseURL}/${this.configs.chainId}?ignoreGasEstimate=${getRateData.ignoreGasEstimate || true}&ignoreAllowance=${getRateData.ignoreAllowance || true
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

  async multiSwap({
    steps,
    gasLimit,
    gasPrice,
    onSubmitted,
    callStatic = false,
    deps,
  }: MultiSwapParameterType): Promise<TransactionReceipt> {
    const { params, value } = await this.convertStepToActions({
      steps,
      deps,
    })

    if (callStatic) {
      const address = await deps.signer.getAddress()
      deps.signer = new VoidSigner(address, this.overrideProvider);
    }
    const utr = new Contract(
      this.profile.configs.helperContract.utr,
      this.profile.getAbi('UTROverride').abi,
      deps.signer,
    )
    params.push({
      value,
      gasLimit,
      gasPrice,
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
      decimals?: { [token: string]: number }
    }
    callStatic?: boolean
    gasLimit?: BigNumber
  }): Promise<any> => {
    const _gasLimit = gasLimit ?? bn(1000000)
    const tx: any = await this.multiSwap({
      steps: [
        {
          tokenIn,
          tokenOut,
          amountIn: bn(amount),
          amountOutMin: 0,
          useSweep: false
        },
      ],
      gasLimit: gasLimit ?? bn(1000000),
      callStatic,
      deps,
    })
    if(callStatic) {
      const gasLeft = tx.gasLeft
      const gasUsed = (_gasLimit as BigNumber).sub(gasLeft)
      return {
        ...tx,
        gasUsed,
      }
    }
    return tx
  }
  simulate = async (params: {
    tokenIn: string
    tokenOut: string
    amount: string
    deps: {
      pools: SdkPools
      signer: Signer
      decimals?: { [token: string]: number }
    }
    gasLimit?: BigNumber
  }): Promise<any> => {
    return await this.swap({ ...params, callStatic: true })
  }
}
