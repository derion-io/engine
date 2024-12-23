import { BigNumber, Contract, ethers } from 'ethers'
import { bn } from '../utils/helper'
import { JsonRpcProvider } from '@ethersproject/providers'
import { PoolConfig } from '../types'
import { IDerivableContractAddress, IEngineConfig } from '../utils/configs'
import { Profile } from '../sdk/profile'

export type ConfigGenerateType = {
  utr: string
  token: string | undefined
  logic: string | undefined
  oracle: string
  reserveToken: string
  recipient: string
  mark: BigNumber
  k: number
  a: BigNumber
  b: BigNumber
  initTime: number
  halfLife: number
}

export type CreatePoolParameterType = {
  params: any
  value: any
  gasLimit: any
}

export class CreatePool {
  account?: string
  chainId: number
  scanApi?: string
  provider: ethers.providers.Provider
  overrideProvider: JsonRpcProvider
  signer?: ethers.providers.JsonRpcSigner
  contractAddresses: Partial<IDerivableContractAddress>
  profile: Profile

  constructor(config: IEngineConfig, profile: Profile) {
    this.account = config.account
    this.chainId = config.chainId
    this.scanApi = profile.configs.scanApi
    this.provider = new JsonRpcProvider(profile.configs.rpc)
    this.overrideProvider = new JsonRpcProvider(profile.configs.rpc)
    this.signer = config.signer
    this.profile = profile
  }

  async callStaticCreatePool({ params, value, gasLimit }: CreatePoolParameterType) {
    const helper = this.getStateCalHelperContract(this.signer)
    return await helper.callStatic.createPool(params, this.contractAddresses.poolFactory, {
      value: value || bn(0),
      gasLimit: gasLimit || undefined,
    })
  }

  async createPool(params: PoolConfig, gasLimit?: BigNumber): Promise<boolean> {
    try {
      const newPoolConfigs: ConfigGenerateType = this.generateConfig(
        params.k,
        params.a,
        params.b,
        params.mark,
        params.recipient,
        params.oracle,
        params.initTime,
        params.halfLife,
      )
      await this.callStaticCreatePool({
        params: newPoolConfigs,
        value: params.amountInit,
        gasLimit,
      })
      const helper: Contract = this.getStateCalHelperContract(this.signer)
      const res = await helper.createPool(newPoolConfigs, this.contractAddresses.poolFactory, {
        value: params.amountInit,
        gasLimit: gasLimit || undefined,
      })
      const tx = await res.wait(1)
      // TODO: tx status checking before return
      console.log('tx', tx)
      return true
    } catch (error) {
      throw error
    }
  }

  generateConfig(
    k: number,
    a: BigNumber,
    b: BigNumber,
    mark: BigNumber,
    recipient: string,
    oracle: string,
    initTime: number,
    halfLife: number,
  ): ConfigGenerateType {
    try {
      return {
        utr: this.profile.configs.helperContract.utr,
        token: this.contractAddresses.token,
        logic: this.contractAddresses.logic,
        oracle,
        reserveToken: this.profile.configs.wrappedTokenAddress,
        recipient,
        mark,
        k,
        a,
        b,
        initTime,
        halfLife,
      }
    } catch (error) {
      throw error
    }
  }

  getStateCalHelperContract(provider?: any): Contract {
    try {
      return new ethers.Contract(this.contractAddresses.stateCalHelper as string, this.profile.getAbi('Helper'), provider || this.provider)
    } catch (error) {
      throw error
    }
  }
}
