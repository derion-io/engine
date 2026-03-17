import { Storage } from '../types'
import { ethers } from 'ethers'

// Re-export shared config types from SDK
export type { DerionConfigs, IHelperContract, IDerivableContractAddress } from '@derion/sdk/type'

// Engine uses DerionConfigs as INetworkConfig (with engine-specific additions)
import type { DerionConfigs } from '@derion/sdk/type'

export interface INetworkConfig extends DerionConfigs {
  // Engine-specific fields not in SDK's DerionConfigs
  chainlinkFetcher?: string
  uniswap: IUniswapContractAddress
}

export interface IUniswapContractAddress {
  v3Factory: string
  v3Pos: string
}

export interface IEngineConfig {
  env?: 'development' | 'production'
  account?: string
  signer?: ethers.providers.JsonRpcSigner
  scanApiKey?: string
  chainId: number
  storage: Storage
}

export const DEFAULT_CHAIN = 42161
