import { Profile } from './../profile'
import { BigNumber, Contract, ethers } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { IEngineConfig, INetworkConfig } from '../utils/configs'
import { constructFullSDK, constructEthersContractCaller, constructFetchFetcher, AllSDKMethods } from '@paraswap/sdk'
import { GetRateInput } from '@paraswap/sdk/dist/methods/swap/rates'

import crypto from 'crypto'
import {PARA_BUILD_TX_BASE_URL, PARA_DATA_BASE_URL, PARA_VERSION, ZERO_ADDRESS} from '../utils/constant'
import {SwapAndOpenAggregatorType, rateDataAggregatorType} from '../types'

export class Aggregator {
  account?: string
  provider: ethers.providers.JsonRpcProvider
  overrideProvider: JsonRpcProvider
  signer?: ethers.providers.JsonRpcSigner
  config: IEngineConfig
  paraSwap: AllSDKMethods<any>
  paraDataBaseURL: string
  paraBuildTxBaseURL:string
  paraDataBaseVersion: string

  constructor(config: IEngineConfig, profile: Profile, paraDataBaseURL?: string, paraBuildTxBaseURL?:string, paraVersion?: string ) {
    this.signer = config.signer
    this.account = config.account
    this.config = config
    this.provider = new ethers.providers.JsonRpcProvider(profile.configs.rpc)
    this.overrideProvider = new JsonRpcProvider(profile.configs.rpc)
    this.paraDataBaseURL = paraDataBaseURL || PARA_DATA_BASE_URL
    this.paraBuildTxBaseURL = paraBuildTxBaseURL || PARA_BUILD_TX_BASE_URL
    this.paraDataBaseVersion = paraVersion || PARA_VERSION
    this.paraSwap = constructFullSDK({
      chainId: config.chainId,
      fetcher: constructFetchFetcher(fetch),
      contractCaller: constructEthersContractCaller(
        {
          ethersProviderOrSigner: this.signer ?? this.generateSigner(),
          EthersContract: ethers.Contract,
        },
        this.account,
      ),
    })
  }

  async getRateAndBuildTxSwap(getRateData: any): Promise<any> {
    try {
      const priceRoute = await this.paraSwap.swap.getRate(getRateData)
      console.log(priceRoute)
      const txParams = await this.paraSwap.swap.buildTx({
        srcToken: getRateData.srcToken,
        destToken: getRateData.destToken,
        srcAmount: getRateData.amount,
        destAmount: priceRoute.destAmount,
        priceRoute,
        userAddress: this.account ?? '',
      })

      return {
        ...txParams,
        gasPrice: BigNumber.from(txParams.gasPrice).toString(),
        gasLimit: BigNumber.from(5000000).toString(),
        value: BigNumber.from(txParams.value).toString(),
      }
    } catch (error) {
      throw error
    }
  }
  async getRateAndBuildTxSwapApi(getRateData: rateDataAggregatorType, openData: SwapAndOpenAggregatorType, helperOverride?: Contract): Promise<{
    rateData: any,
    swapData: any,
    openTx: any
  }> {
    try {
      const amount = getRateData?.srcAmount || getRateData.destAmount

    const rateData = await (await fetch(
      `${this.paraDataBaseURL}/?version=${this.paraDataBaseVersion}&srcToken=${getRateData.srcToken}&srcDecimals=${getRateData.srcDecimals}&destToken=${getRateData.destToken}&destDecimals=${getRateData.destDecimals}&amount=${amount}&side=${getRateData.side}&excludeDirectContractMethods=${getRateData.excludeDirectContractMethods || false}&otherExchangePrices=${getRateData.otherExchangePrices || true}&partner=${getRateData.partner}&network=${this.config.chainId}&userAddress=${this.config.account}`,
      {
      method: "GET",
      redirect: "follow"
    })).json()
   
    const myHeaders: any = new Headers();
    myHeaders.append("Content-Type", "application/json");
    if(rateData.error) throw 'Rate data: ' + rateData.error
    const swapData = await (await fetch(
      `${this.paraBuildTxBaseURL}/${this.config.chainId}?ignoreGasEstimate=${getRateData.ignoreGasEstimate || true}&ignoreAllowance=${getRateData.ignoreAllowance || true}&gasPrice=${rateData.priceRoute.gasCost}`,
       {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify({
        ...getRateData,
        slippage: 2500, //25%
        partner: getRateData.partner,
        priceRoute: rateData.priceRoute,
      })
    })).json()

    if(swapData.error) throw 'Swap data: ' + swapData.error
    let openTx = null
    if(helperOverride) {
      openTx = await helperOverride.populateTransaction.aggregateAndOpen({
        tokenIn: getRateData.srcToken,
        tokenOperator: rateData.priceRoute.tokenTransferProxy,
        aggregator: swapData.to,
        aggregatorData: swapData.data,
        pool: openData?.poolAddress,
        side: openData?.poolId,
        payer: ZERO_ADDRESS,
        recipient: this.config.account,
        INDEX_R: 0,
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
  private generateSigner(): ethers.Wallet {
    const id = crypto.randomBytes(32).toString('hex')
    const privateKey = `0x${id}`
    return new ethers.Wallet(privateKey, this.overrideProvider)
  }
}
