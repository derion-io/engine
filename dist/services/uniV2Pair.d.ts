import { IEngineConfig } from '../utils/configs';
import { Profile } from '../profile';
import { JsonRpcProvider } from '@ethersproject/providers';
import { GetPairInfoParameterType, GetPairsInfoParameterType } from './uniV3Pair';
export declare class UniV2Pair {
    chainId: number;
    scanApi?: string;
    pairsInfoAddress: string;
    provider: JsonRpcProvider;
    constructor(config: IEngineConfig, profile: Profile);
    getPairInfo({ pairAddress, flag }: GetPairInfoParameterType): Promise<{
        [key: string]: any;
    }>;
    getPairsInfo({ pairAddresses, flag }: GetPairsInfoParameterType): Promise<{
        [key: string]: any;
    }>;
}
