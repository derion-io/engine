import { Profile } from './../profile'
import { Contract, ethers } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { IEngineConfig } from '../utils/configs'

import crypto from 'crypto'
import { PARA_BUILD_TX_BASE_URL, PARA_DATA_BASE_URL, PARA_VERSION, ZERO_ADDRESS } from '../utils/constant'
import { SwapAndOpenAggregatorType, rateDataAggregatorType } from '../types'
import { Resource } from './resource'

export class Aggregator {
  account?: string
  provider: ethers.providers.JsonRpcProvider
  overrideProvider: JsonRpcProvider
  signer?: ethers.providers.JsonRpcSigner
  config: IEngineConfig & { RESOURCE: Resource }
  paraDataBaseURL: string
  paraBuildTxBaseURL: string
  paraDataBaseVersion: string

  constructor(
    config: IEngineConfig & { RESOURCE: Resource },
    profile: Profile,
    paraDataBaseURL?: string,
    paraBuildTxBaseURL?: string,
    paraVersion?: string,
  ) {
    this.signer = config.signer
    this.account = config.account
    this.config = config
    this.provider = new ethers.providers.JsonRpcProvider(profile.configs.rpc)
    this.overrideProvider = new JsonRpcProvider(profile.configs.rpc)
    this.paraDataBaseURL = paraDataBaseURL || PARA_DATA_BASE_URL
    this.paraBuildTxBaseURL = paraBuildTxBaseURL || PARA_BUILD_TX_BASE_URL
    this.paraDataBaseVersion = paraVersion || PARA_VERSION
  }

  async getRateAndBuildTxSwapApi(
    getRateData: rateDataAggregatorType,
    openData: SwapAndOpenAggregatorType,
    helperOverride?: Contract,
    slippage?: number,
  ): Promise<{
    rateData: any
    swapData: any
    openTx: any
  }> {
    try {
      const rateData = await this.getRate(getRateData)
      if (rateData.error) {
        throw new Error(rateData.error)
      }
      const swapData = await this.buildTx(getRateData, rateData, slippage)
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
          payer: this.config.account, // for event Swap.payer
          recipient: this.config.account,
          INDEX_R: this.config.RESOURCE.getIndexR(getRateData.destToken), // TOKEN_R
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

  async getRate(getRateData: rateDataAggregatorType) {
    const amount = getRateData?.srcAmount || getRateData.destAmount
    const rateData = await (
      await fetch(
        `${this.paraDataBaseURL}/?version=${this.paraDataBaseVersion}&srcToken=${getRateData.srcToken}&srcDecimals=${
          getRateData.srcDecimals
        }&destToken=${getRateData.destToken}&destDecimals=${getRateData.destDecimals}&amount=${amount}&side=${
          getRateData.side
        }&excludeDirectContractMethods=${getRateData.excludeDirectContractMethods || false}&otherExchangePrices=${
          getRateData.otherExchangePrices || true
        }&partner=${getRateData.partner}&network=${this.config.chainId}&userAddress=${this.config.account}`,
        {
          method: 'GET',
          redirect: 'follow',
        },
      )
    ).json()
    return rateData
  }

  async buildTx(getRateData: rateDataAggregatorType, rateData: any, slippage?: number) {
    const myHeaders: any = new Headers()
    myHeaders.append('Content-Type', 'application/json')
    const swapData = await (
      await fetch(
        `${this.paraBuildTxBaseURL}/${this.config.chainId}?ignoreGasEstimate=${getRateData.ignoreGasEstimate || true}&ignoreAllowance=${
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

  private generateSigner(): ethers.Wallet {
    const id = crypto.randomBytes(32).toString('hex')
    const privateKey = `0x${id}`
    return new ethers.Wallet(privateKey, this.overrideProvider)
  }
}
