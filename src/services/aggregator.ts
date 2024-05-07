import { Profile } from './../profile'
import { BigNumber, ethers } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { IEngineConfig, INetworkConfig } from '../utils/configs'
import { constructFullSDK, constructEthersContractCaller, constructFetchFetcher, AllSDKMethods } from '@paraswap/sdk'
import { GetRateInput } from '@paraswap/sdk/dist/methods/swap/rates'

import crypto from 'crypto'

export class Aggregator {
  account?: string
  provider: ethers.providers.JsonRpcProvider
  overrideProvider: JsonRpcProvider
  signer?: ethers.providers.JsonRpcSigner
  paraSwap: AllSDKMethods<any>

  constructor(config: IEngineConfig, profile: Profile) {
    this.signer = config.signer

    this.account = config.account
    this.provider = new ethers.providers.JsonRpcProvider(profile.configs.rpc)
    this.overrideProvider = new JsonRpcProvider(profile.configs.rpc)

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
  async getRateAndBuildTxSwapApi(configs: IEngineConfig, getRateData: any): Promise<any> {
    try {
      const amount = getRateData?.srcAmount || getRateData.destAmount
    const rateData = await (await fetch(
      `https://api.paraswap.io/prices/?version=5&srcToken=${getRateData.srcToken}&srcDecimals=${getRateData.srcDecimals}&destToken=${getRateData.destToken}&destDecimals=${getRateData.destDecimals}&amount=${amount}&side=${getRateData.side}&excludeDirectContractMethods=false&network=${configs.chainId}&otherExchangePrices=true&partner=${getRateData.partner}&userAddress=${configs.account}`,
      {
      method: "GET",
      redirect: "follow"
    })).json()
    const myHeaders: any = new Headers();
    myHeaders.append("Content-Type", "application/json");
    if(rateData.error) throw 'Rate data: ' + rateData.error

    const swapData = await (await fetch(`https://api.paraswap.io/transactions/${configs.chainId}?ignoreGasEstimate=true&ignoreAllowance=false&gasPrice=${rateData.priceRoute.gasCost}`, {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify({
        ...getRateData,
        slippage: 2500, //25%
        partner: getRateData.partner,
        priceRoute: rateData.priceRoute,
        userAddress: configs.account
      })
    })).json()

    if(swapData.error) throw 'Swap data: ' + swapData.error

    return {
      rateData,
      swapData,
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
