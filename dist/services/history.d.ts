import { BigNumber } from 'ethers';
import { LogType, TokenType } from '../types';
import { Profile } from '../profile';
import { IEngineConfig } from '../utils/configs';
import { Resource } from './resource';
import { Result } from 'ethers/lib/utils';
export type FormatSwapHistoryParameterType = {
    transferLogs: Array<LogType>;
    swapLogs: Array<LogType>;
    tokens: Array<TokenType>;
};
export type PositionGenerateParameterType = {
    tokens: Array<TokenType>;
    logs: Array<LogType>;
};
export declare class History {
    account?: string;
    RESOURCE: Resource;
    config: IEngineConfig;
    profile: Profile;
    constructor(config: IEngineConfig & {
        RESOURCE: Resource;
    }, profile: Profile);
    generatePositions({ tokens, logs }: PositionGenerateParameterType): any;
    generatePositionBySwapLog(positions: any, tokens: Array<TokenType>, log: LogType): any;
    formatSwapHistory({ transferLogs, swapLogs, tokens }: FormatSwapHistoryParameterType): Array<number>;
    extractPriceR(tokenR: TokenType, tokens: Array<TokenType>, priceR: any, log: LogType): string | undefined;
    getTokenAddressByPoolAndSide(poolAddress: string, side: BigNumber): string;
    getSwapAbi(topic0: string): any;
    decodeTransferLog(data: string, topics: Array<string>): Result;
    decodeSwapLog(abi: any, args: any): Result;
}
