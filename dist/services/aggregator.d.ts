import { Profile } from './../profile';
import { Contract, ethers } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { IEngineConfig } from '../utils/configs';
import { SwapAndOpenAggregatorType, rateDataAggregatorType } from '../types';
export declare class Aggregator {
    account?: string;
    provider: ethers.providers.JsonRpcProvider;
    overrideProvider: JsonRpcProvider;
    signer?: ethers.providers.JsonRpcSigner;
    config: IEngineConfig;
    paraDataBaseURL: string;
    paraBuildTxBaseURL: string;
    paraDataBaseVersion: string;
    constructor(config: IEngineConfig, profile: Profile, paraDataBaseURL?: string, paraBuildTxBaseURL?: string, paraVersion?: string);
    getRateAndBuildTxSwapApi(getRateData: rateDataAggregatorType, openData: SwapAndOpenAggregatorType, helperOverride?: Contract): Promise<{
        rateData: any;
        swapData: any;
        openTx: any;
    }>;
    private generateSigner;
}
