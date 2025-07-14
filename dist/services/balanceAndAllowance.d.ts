import { BigNumber } from 'ethers';
import { AllowancesType, BalancesType, LogType, MaturitiesType, TokenType } from '../types';
import { IEngineConfig } from '../utils/configs';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Profile } from '../profile';
import { Assets, Resource } from './resource';
export declare function keyFromTokenId(id: BigNumber): string;
export type BnAReturnType = {
    chainId: number;
    account: string;
    balances: BalancesType;
    allowances: AllowancesType;
    maturities: MaturitiesType;
};
export interface IUniPosV3 {
    tickLower: number;
    tickUpper: number;
    liquidity: string;
    feeGrowthInside0LastX128: string;
    feeGrowthInside1LastX128: string;
    fee: string;
    tokensOwed0: string;
    tokensOwed1: string;
    token0: string;
    token1: string;
    token0Data: TokenType;
    token1Data: TokenType;
    poolAddress: string;
    poolState?: IUniPoolV3;
}
export interface IUniPoolV3 {
    poolLiquidity?: BigNumber;
    slot0?: {
        sqrtPriceX96: BigNumber;
        tick: number;
        observationIndex: number;
        observationCardinality: number;
        observationCardinalityNext: number;
        feeProtocol: number;
        unlocked: boolean;
    };
}
export declare class BnA {
    provider: JsonRpcProvider;
    rpcUrl: string;
    bnAAddress: string;
    profile: Profile;
    RESOURCE: Resource;
    constructor(config: IEngineConfig & {
        RESOURCE: Resource;
    }, profile: Profile);
    getBalanceAndAllowance(account: string, withNative?: boolean): Promise<BnAReturnType>;
    loadUniswapV3Position({ assetsOverride, tokensOverride, uniswapV3FactoryOverride, allLogsOverride }: {
        assetsOverride?: Assets;
        tokensOverride?: TokenType[];
        uniswapV3FactoryOverride?: string;
        allLogsOverride?: LogType[];
    }): Promise<{
        [posKey: string]: IUniPosV3;
    }>;
}
