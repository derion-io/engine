import { ethers } from 'ethers';
export interface Proof {
    readonly block: Uint8Array;
    readonly accountProofNodesRlp: Uint8Array;
    readonly reserveAndTimestampProofNodesRlp: Uint8Array;
    readonly priceAccumulatorProofNodesRlp: Uint8Array;
}
export type ProofResult = {
    readonly accountProof: readonly Uint8Array[];
    readonly storageProof: readonly {
        readonly key: string;
        readonly value: string;
        readonly proof: readonly Uint8Array[];
    }[];
};
export type Block = {
    readonly parentHash: string;
    readonly sha3Uncles: string;
    readonly miner: string;
    readonly stateRoot: string;
    readonly transactionsRoot: string;
    readonly receiptsRoot: string;
    readonly logsBloom: string;
    readonly difficulty: string;
    readonly number: string;
    readonly gasLimit: string;
    readonly gasUsed: string;
    readonly timestamp: string;
    readonly extraData: Uint8Array;
    readonly mixHash: string | undefined;
    readonly nonce: string | null;
    readonly baseFeePerGas: string | null;
};
export type EthGetStorageAt = (address: string, position: number, block: number | 'latest') => Promise<string>;
export type EthGetProof = (address: string, positions: readonly number[], block: number) => Promise<ProofResult>;
export type EthGetBlockByNumber = (blockNumber: number | 'latest') => Promise<Block | null>;
export declare function getPrice(eth_getStorageAt: EthGetStorageAt, eth_getBlockByNumber: EthGetBlockByNumber, exchangeAddress: string, quoteTokenIndex: number, blockNumber: number): Promise<ethers.BigNumber>;
export declare function getAccumulatorPrice(eth_getStorageAt: EthGetStorageAt, exchangeAddress: string, quoteTokenIndex: number, blockNumber: number): Promise<{
    price: ethers.BigNumber;
    timestamp: ethers.BigNumber;
}>;
export declare function getProof(eth_getProof: EthGetProof, eth_getBlockByNumber: EthGetBlockByNumber, exchangeAddress: string, quoteTokenIndex: number, blockNumber: number): Promise<Proof>;
export declare function stripLeadingZeros(byteArray: Uint8Array): Uint8Array;
export declare function hexStringToUint8Array(value: string): Uint8Array;
