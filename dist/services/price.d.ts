import { BigNumber } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { TokenType } from '../types';
import { IEngineConfig } from '../utils/configs';
import { Profile } from '../profile';
import { Resource } from './resource';
type IFetchTokenPriceParam = {
    tokenBase: string;
    tokenQuote: string;
    routes: Array<{
        uniPool: string;
        version: number;
    }>;
};
export type GetTokenPriceReturnType = {
    [key: string]: BigNumber;
};
export type GetTokenPriceByRouterReturnType = {
    [key: string]: number | string;
};
export type Get24hChangeParameterType = {
    baseToken: TokenType;
    cToken: string;
    chainId: string;
    quoteToken: TokenType;
    currentPrice: string;
    toTimeMs?: number;
};
export declare class Price {
    chainId: number;
    scanApi?: string;
    provider: JsonRpcProvider;
    rpcUrl: string;
    reserveTokenPrice: string;
    tokenPriceByRoute: string;
    config: IEngineConfig;
    profile: Profile;
    RESOURCE: Resource;
    constructor(config: IEngineConfig & {
        RESOURCE: Resource;
    }, profile: Profile);
    get24hChange({ baseToken, cToken, quoteToken, chainId, currentPrice, toTimeMs }: Get24hChangeParameterType): Promise<string>;
    getTokenPriceByRoutes(): Promise<GetTokenPriceByRouterReturnType>;
    _genFetchTokenParams(): Array<IFetchTokenPriceParam>;
    getTokenPrices(tokens: Array<string>): Promise<GetTokenPriceReturnType>;
}
export {};
