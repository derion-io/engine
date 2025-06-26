import { JsonRpcProvider } from '@ethersproject/providers';
export declare function getBalanceSlot(account: string, i: number): string;
export declare function getAllowanceSlot(account: string, spender: string, i: number): string;
export declare const getStorageSlotsForBnA: (provider: JsonRpcProvider, contractAddress: string, account?: string, spender?: string, slots?: number) => Promise<{
    balance: {
        index: number;
        slot: string;
    };
    allowance: {
        index: number;
        slot: string;
    };
}>;
export declare const overrideBnA: (override: {
    token: string;
    account: string;
    provider: JsonRpcProvider;
    allowances?: {
        [spender: string]: any;
    } | undefined;
    balance?: any;
}) => Promise<{}>;
