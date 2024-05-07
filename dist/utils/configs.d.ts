import { Storage } from '../types';
import { ethers } from 'ethers';
export interface IEngineConfig {
    env?: 'development' | 'production';
    account?: string;
    signer?: ethers.providers.JsonRpcSigner;
    scanApiKey?: string;
    chainId: number;
    storage: Storage;
}
export interface INetworkConfig {
    chainId: number;
    rpc: string;
    rpcGetLog?: string;
    rpcGetProof?: string;
    scanApi?: string;
    explorer?: string;
    scanName?: string;
    timePerBlock: number;
    candleChartApi?: string;
    useDexToolsChart?: boolean;
    storage?: Storage;
    gasLimitDefault: number;
    gasForProof: number;
    name: string;
    gtID: string;
    dextoolsID?: string;
    nativeSymbol: string;
    wrappedTokenAddress: string;
    nativePriceUSD: number;
    stablecoins: string[];
    tokens?: {
        [address: string]: {
            price?: number | string;
            symbol: string;
            name: string;
            decimals: number;
            logo: string;
        };
    };
    helperContract: IHelperContract;
    factory: {
        [factory: string]: {
            type: 'uniswap2' | 'uniswap3' | 'pancake3';
            topic0: string;
            fetcher?: string;
        };
    };
    fetchers: {
        [fetcher: string]: {
            type: 'uniswap2' | 'uniswap3' | 'pancake3';
            factory: string[];
        };
    };
    chartReplacements?: {
        [origin: string]: string;
    };
    uniswap: IUniswapContractAddress;
    derivable: IDerivableContractAddress;
}
export interface IHelperContract {
    utr: string;
    multiCall: string;
}
export interface IUniswapContractAddress {
    v3Factory: string;
}
export interface IDerivableContractAddress {
    version: number;
    startBlock: number;
    poolFactory: string;
    logic: string;
    token: string;
    playToken: string;
    stateCalHelper: string;
    feeReceiver: string;
    tokenDescriptor: string;
    compositeFetcher: string;
    multiCall: string;
    uniswapV2Fetcher?: string;
    poolDeployer?: string;
}
export declare const DEFAULT_CHAIN = 42161;
