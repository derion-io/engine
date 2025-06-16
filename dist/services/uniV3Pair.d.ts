import { BigNumber } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { IDerivableContractAddress, IEngineConfig } from '../utils/configs';
import { CallReturnContext } from 'ethereum-multicall/dist/esm/models/call-return-context';
import { Profile } from '../profile';
import { TokenType } from '../types';
export type IPairInfo = {
    token0: TokenType & {
        reserve: BigNumber;
    };
    token1: TokenType & {
        reserve: BigNumber;
    };
};
export type IPairsInfo = {
    [pair: string]: IPairInfo;
};
export type GetPairInfoParameterType = {
    flag?: string;
    pairAddress: string;
};
export type GetPairsInfoParameterType = {
    flag?: string;
    pairAddresses: Array<string>;
};
export type GetPairAddressParameterType = {
    baseToken: string;
    quoteTokens: Array<string>;
};
export declare class UniV3Pair {
    chainId: number;
    scanApi?: string;
    provider: JsonRpcProvider;
    rpcUrl: string;
    pairsV3Info: string;
    addresses: Partial<IDerivableContractAddress>;
    profile: Profile;
    constructor(config: IEngineConfig, profile: Profile);
    getLargestPoolAddress({ baseToken, quoteTokens }: GetPairAddressParameterType): Promise<string>;
    /**
     *
     * @param baseToken
     * @param pools
     * poolsType: {
     *   [`${baseAddress-quoteAddress-fee}`]: poolAddress
     * }
     */
    _getLargestPoolByPools(baseToken: string, pools: {
        [key: string]: string;
    }): Promise<string>;
    _parsePoolBalanceReturnContext(returnContexts: Array<CallReturnContext>): string;
    _generatePoolBalanceContext(baseToken: string, pools: {
        [key: string]: string;
    }): Array<ContractCallContext>;
    getPairAddress({ baseToken, quoteTokens }: GetPairAddressParameterType): Promise<{
        [key: string]: string;
    }>;
    _parsePoolAddressReturnContext(returnContexts: Array<CallReturnContext>): {
        [key: string]: string;
    };
    _generatePoolAddressContext(baseToken: string, quoteTokens: Array<string>): Array<ContractCallContext>;
    getPairInfo({ pairAddress, flag }: GetPairInfoParameterType): Promise<IPairInfo>;
    getPairsInfo({ pairAddresses, flag }: GetPairsInfoParameterType): Promise<IPairsInfo>;
    _getMulticall(): Multicall;
}
