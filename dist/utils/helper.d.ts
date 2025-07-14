import { BigNumber, ethers } from 'ethers';
import { LogType, PoolType, TokenType } from '../types';
import { FeeAmount } from './constant';
import { Interface, LogDescription } from '@ethersproject/abi';
export declare const provider: ethers.providers.JsonRpcProvider;
export declare const bn: typeof BigNumber.from;
export declare const weiToNumber: (wei: any, decimals?: number, decimalToDisplay?: number) => string;
export declare const numberToWei: (number: any, decimals?: number) => string;
export declare const decodePowers: (powersBytes: string) => Array<number>;
export declare const formatMultiCallBignumber: (data: any) => Array<any>;
export declare const getErc1155Token: (addresses: string[]) => {
    [key: string]: BigNumber[];
};
/**
 * format of erc1155 = 0xabc...abc-id
 * @param address
 */
export declare const isErc1155Address: (address: string) => boolean;
export declare const getNormalAddress: (addresses: string[]) => Array<string>;
export declare const formatFloat: (number: number | string, decimals?: number) => string;
export declare const formatPercent: (floatNumber: any, decimals?: number) => string;
export declare const mul: (a: any, b: any, useFullwide?: boolean) => string;
export declare const sub: (a: any, b: any) => string;
export declare const div: (a: any, b: any) => string;
export declare const max: (a: any, b: any) => string;
export declare const add: (a: any, b: any) => string;
export declare const detectDecimalFromPrice: (price: number | string) => number;
export declare const packId: (kind: string | BigNumber, address: string) => BigNumber;
export declare const parseUq128x128: (value: BigNumber, unit?: number) => number;
export declare const parsePrice: (value: BigNumber, baseToken?: TokenType, quoteToken?: TokenType, pool?: PoolType) => string;
export declare const parseSqrtX96: (price: BigNumber, baseToken: TokenType, quoteToken: TokenType) => string;
export declare const mergeDeep: (target: any, ...sources: any) => any;
export declare const getTopics: (overrideEventsAbi?: any) => {
    [key: string]: string[];
};
export declare const rateToHL: (r: number, DURATION?: number) => number;
export declare const rateFromHL: (HL: number, DURATION?: number) => number;
export declare const kx: (k: number, R: BigNumber, v: BigNumber, spot: BigNumber, MARK: BigNumber) => number;
export declare const STR: (num: number | string | BigNumber) => string;
export declare const NUM: (num: number | string | BigNumber) => number;
export declare const BIG: (num: number | string | BigNumber) => BigNumber;
export declare const truncate: (num: string, decimals?: number, rounding?: boolean) => string;
export declare const round: (num: string, decimals?: number) => string;
export declare const IEW: (wei: BigNumber | string, decimals?: number, decimalsToDisplay?: number) => string;
export declare const WEI: (num: number | string, decimals?: number) => string;
export declare const DIV: (a: BigNumber, b: BigNumber, precision?: number) => string;
export declare function compareLog(a: LogType, b: LogType): number;
export declare function mergeTwoUniqSortedLogs(a: LogType[], b: LogType[]): LogType[];
export declare function sortsBefore(tokenA: string, tokenB: string): boolean;
export declare function computePoolAddress({ factoryAddress, tokenA, tokenB, fee, initCodeHashManualOverride }: {
    factoryAddress: string;
    tokenA: TokenType;
    tokenB: TokenType;
    fee: FeeAmount;
    initCodeHashManualOverride?: string;
}): string;
export declare function tryParseLog(log: LogType, ifaces: Interface[]): LogDescription | undefined;
export declare function isUniv3(pool: PoolType): boolean;
export declare function isUniv2(pool: PoolType): boolean;
export declare function isChainlink(pool: PoolType): boolean;
export declare function chainlinkDecimals(ORACLE: string): number;
export declare function oracleWindow(ORACLE: string): number;
