import { Profile } from './../profile';
import { Contract, ethers } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { IEngineConfig } from '../utils/configs';
import { SwapAndOpenAggregatorType, rateDataAggregatorType } from '../types';
import { Resource } from './resource';
export declare class Aggregator {
    account?: string;
    provider: ethers.providers.JsonRpcProvider;
    overrideProvider: JsonRpcProvider;
    signer?: ethers.providers.JsonRpcSigner;
    config: IEngineConfig & {
        RESOURCE: Resource;
    };
    paraDataBaseURL: string;
    paraBuildTxBaseURL: string;
    paraDataBaseVersion: string;
    constructor(config: IEngineConfig & {
        RESOURCE: Resource;
    }, profile: Profile, paraDataBaseURL?: string, paraBuildTxBaseURL?: string, paraVersion?: string);
    getRateAndBuildTxSwapApi(getRateData: rateDataAggregatorType, openData: SwapAndOpenAggregatorType, helperOverride?: Contract, slippage?: number): Promise<{
        rateData: any;
        swapData: any;
        openTx: any;
    }>;
    getRate(getRateData: rateDataAggregatorType): Promise<any>;
    buildTx(getRateData: rateDataAggregatorType, rateData: any, slippage?: number): Promise<any>;
    private generateSigner;
}
