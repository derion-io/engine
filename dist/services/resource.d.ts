import { BigNumber } from 'ethers';
import { LogType, PoolGroupsType, PoolsType, PoolType, Storage, TokenType } from '../types';
import { JsonRpcProvider } from '@ethersproject/providers';
import { IPairInfo, IPairsInfo, UniV3Pair } from './uniV3Pair';
import { IDerivableContractAddress, IEngineConfig } from '../utils/configs';
import { Profile } from '../profile';
export type GetPoolGroupIdParameterType = {
    pair: string;
    quoteTokenIndex: 0 | 1;
    tokenR: string;
};
export type SingleRouteToUSDReturnType = {
    quoteTokenIndex: number;
    stablecoin: string;
    address: string;
};
export type GetPriceReturnType = {
    poolAddress: string;
    twap: BigNumber;
    spot: BigNumber;
};
export type GetRDCReturnType = {
    supplyDetails: any;
    rDetails: any;
    R: BigNumber;
    rC: BigNumber;
    rDcLong: BigNumber;
    rDcShort: BigNumber;
};
export type CalcPoolInfoReturnType = {
    sides: any;
    riskFactor: string;
    deleverageRiskA: number;
    deleverageRiskB: number;
    interestRate: number;
    maxPremiumRate: number;
};
export type ParseMultiCallResponseReturnType = {
    tokens: Array<any>;
    pools: any;
};
export type CacheDDLogParameterType = {
    logs: any;
    headBlock: number;
    account: string;
};
export type GetRentRateParameterType = {
    R: BigNumber;
    rDcLong: BigNumber;
    rDcShort: BigNumber;
};
export type GetRentRateReturnType = {
    rentRateLong: BigNumber;
    rentRateShort: BigNumber;
};
export type LoadInitPoolDataReturnType = {
    tokens: Array<TokenType>;
    pools: any;
    poolGroups: any;
};
export declare const Q128: BigNumber;
export declare const M256: BigNumber;
type ResourceData = {
    pools: PoolsType;
    tokens: Array<TokenType>;
    swapLogs: Array<LogType>;
    transferLogs: Array<LogType>;
    bnaLogs: Array<LogType>;
    poolGroups: any;
};
type IPriceInfo = {
    [pool: string]: {
        twap: BigNumber;
        spot: BigNumber;
    };
};
export declare class Resource {
    poolGroups: PoolGroupsType;
    pools: PoolsType;
    tokens: Array<TokenType>;
    swapLogs: Array<LogType>;
    transferLogs: Array<LogType>;
    bnaLogs: Array<LogType>;
    unit: number;
    chainId: number;
    scanApi?: any;
    scanApiKey?: string;
    account?: string;
    storage?: Storage;
    provider: JsonRpcProvider;
    providerToGetLog: JsonRpcProvider;
    overrideProvider: JsonRpcProvider;
    UNIV3PAIR: UniV3Pair;
    derivableAddress: IDerivableContractAddress;
    profile: Profile;
    stableCoins: Array<string>;
    constructor(engineConfigs: IEngineConfig, profile: Profile);
    fetchResourceData(poolAddresses: Array<string>, account: string, playMode?: boolean): Promise<any>;
    getLastBlockCached(account?: string): number;
    cacheDdlLog({ logs, headBlock, account }: CacheDDLogParameterType): void;
    getCachedLogs(account: string): Array<LogType>;
    getWhiteListResource(poolAddresses: Array<string>, playMode?: boolean): Promise<LoadInitPoolDataReturnType>;
    getResourceCached(account: string, playMode?: boolean): Promise<ResourceData>;
    getNewResource(account: string, playMode?: boolean): Promise<ResourceData>;
    /**
     * parse DDL logs
     * @param poolAddresses
     * @param transferLogs
     * @param playMode
     */
    generateData({ poolAddresses, transferLogs, playMode, }: {
        poolAddresses: Array<string>;
        transferLogs: Array<LogType>;
        playMode?: boolean;
    }): Promise<LoadInitPoolDataReturnType>;
    /**
     * load Token detail, poolstate data and then dispatch to Store
     */
    loadInitPoolsData(listTokens: Array<string>, poolAddresses?: Array<string>, playMode?: boolean): Promise<LoadInitPoolDataReturnType>;
    searchIndex(keyword: string): Promise<any>;
    loadPoolStates(poolAddress: string): Promise<any>;
    getRentRate({ rDcLong, rDcShort, R }: GetRentRateParameterType, rentRate: BigNumber): GetRentRateReturnType;
    getPoolOverridedProvider(): JsonRpcProvider;
    /**
     * get Multicall Request to get List token and poolState data in 1 request to RPC
     */
    getMultiCallRequest(normalTokens: Array<string>, poolAddresses: Array<string>): Array<any>;
    parseMultiCallResponse(multiCallData: any, poolAddresses: Array<string>): ParseMultiCallResponseReturnType;
    calcPoolInfo(pool: PoolType): CalcPoolInfoReturnType;
    getRdc(pools: any): GetRDCReturnType;
    parseDdlLogs(ddlLogs: any): Array<LogType>;
    _tokenInRoutes(): Array<string>;
    _whitelistTokens(): Array<TokenType>;
    getPrices(pools: {
        [key: string]: PoolType;
    }, pairs: IPairsInfo): Promise<IPriceInfo>;
    getPrice(pool: PoolType, blockNumber: number, pair: IPairInfo): Promise<GetPriceReturnType>;
    getIndexR(tokenR: string): BigNumber;
    getSingleRouteToUSD(token: string, types?: Array<string>): SingleRouteToUSDReturnType | undefined;
    poolHasOpeningPosition(tokenTransferLogs: Array<LogType>): Array<string>;
    getPoolGroupId({ pair, quoteTokenIndex, tokenR }: GetPoolGroupIdParameterType): string;
}
export {};
