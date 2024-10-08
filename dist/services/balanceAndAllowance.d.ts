import { AllowancesType, BalancesType, MaturitiesType } from '../types';
import { IEngineConfig } from '../utils/configs';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Profile } from '../profile';
import { Resource } from './resource';
export type BnAReturnType = {
    chainId: number;
    account: string;
    balances: BalancesType;
    allowances: AllowancesType;
    maturities: MaturitiesType;
};
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
}
