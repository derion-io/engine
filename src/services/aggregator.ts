import { Profile } from './../profile'
import { BigNumber, ethers } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { IEngineConfig } from '../utils/configs'
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

  async getRateAndBuildTxSwap(getRateData: GetRateInput): Promise<any> {
    try {
      const priceRoute = await this.paraSwap.swap.getRate(getRateData)

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

  private generateSigner(): ethers.Wallet {
    const id = crypto.randomBytes(32).toString('hex')
    const privateKey = `0x${id}`
    return new ethers.Wallet(privateKey, this.overrideProvider)
  }
}
