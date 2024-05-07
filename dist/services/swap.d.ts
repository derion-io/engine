import { BigNumber, Contract, Signer } from 'ethers';
import { PoolType, SwapStepType, PendingSwapTransactionType } from '../types';
import { JsonRpcProvider, Provider, TransactionReceipt } from '@ethersproject/providers';
import { Profile } from '../profile';
import { IDerivableContractAddress, IEngineConfig } from '../utils/configs';
import { Resource } from './resource';
import { Aggregator } from './aggregator';
export type PriceTxReturnType = {
    inputs: Array<any>;
    code: string;
    data: string | undefined;
};
export type MultiSwapParameterType = {
    steps: Array<SwapStepType>;
    gasLimit?: BigNumber;
    gasPrice?: BigNumber;
    fetcherData?: any;
    onSubmitted?: (pendingTx: PendingSwapTransactionType) => void;
    submitFetcherV2?: boolean;
    callStatic?: boolean;
};
export type PoolGroupReturnType = {
    pools: {
        [key: string]: PoolType;
    };
    TOKEN_R: string;
};
export type SwapCallDataParameterType = {
    step: SwapStepType;
    poolGroup: PoolGroupReturnType;
    poolIn: string;
    poolOut: string;
    idIn: BigNumber;
    idOut: BigNumber;
};
export type SwapCallDataInputType = {
    mode: number;
    eip: number;
    token: string;
    id: number | BigNumber;
    amountIn: BigNumber | undefined;
    recipient: string;
};
export type SwapCallDataReturnType = {
    inputs: Array<SwapCallDataInputType>;
    populateTxData: Array<{
        [key: string]: any;
    }>;
};
export declare class Swap {
    account?: string;
    chainId: number;
    scanApi?: string;
    provider: Provider;
    providerGetProof: JsonRpcProvider;
    overrideProvider: JsonRpcProvider;
    signer?: Signer;
    RESOURCE: Resource;
    AGGREGATOR: Aggregator;
    config: IEngineConfig;
    profile: Profile;
    derivableAdr: IDerivableContractAddress;
    pendingTxs: Array<PendingSwapTransactionType>;
    constructor(config: IEngineConfig & {
        RESOURCE: Resource;
        AGGREGATOR: Aggregator;
    }, profile: Profile);
    calculateAmountOuts({ steps, fetcherV2, fetcherData, }: {
        steps: Array<SwapStepType>;
        fetcherV2?: boolean;
        fetcherData?: any;
    }): Promise<any>;
    callStaticMultiSwap({ params, value, gasLimit }: any): Promise<any>;
    convertStepToActions({ steps, submitFetcherV2, isCalculate, fetcherData, }: {
        steps: Array<SwapStepType>;
        submitFetcherV2: boolean;
        isCalculate?: boolean;
        fetcherData?: any;
    }): Promise<{
        params: any;
        value: BigNumber;
    }>;
    getSweepCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut }: SwapCallDataParameterType): SwapCallDataReturnType;
    getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut }: SwapCallDataParameterType): SwapCallDataReturnType;
    wrapToken(address: string): string;
    generateSwapParams(method: string, params: any): {
        [key: string]: any;
    };
    getIdByAddress(address: string, TOKEN_R: string): BigNumber;
    getPoolPoolGroup(addressIn: string, addressOut: string): PoolGroupReturnType;
    multiSwap({ steps, gasLimit, gasPrice, fetcherData, onSubmitted, submitFetcherV2, callStatic, }: MultiSwapParameterType): Promise<TransactionReceipt>;
    getAddressByErc1155Address(address: string, TOKEN_R: string): string;
    getRouterContract(provider: any): Contract;
    getStateCalHelperContract(provider?: any): Contract;
    getIndexR(tokenR: string): BigNumber;
    getUniPool(tokenIn: string, tokenR: string): string;
    needToSubmitFetcher(pool: PoolType): Promise<boolean>;
    fetchPriceTx(pool: PoolType, blockNumber?: number): Promise<PriceTxReturnType>;
    fetchPriceMockTx(pool: PoolType, blockNumber?: number): Promise<PriceTxReturnType>;
    getOverrideProvider(): JsonRpcProvider;
}
