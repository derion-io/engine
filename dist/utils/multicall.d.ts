import { JsonRpcProvider } from "@ethersproject/providers";
import { ContractCallContext } from "ethereum-multicall";
export declare const multicall: (ethersProvider: JsonRpcProvider, contexts: ContractCallContext[], tryAggregate?: boolean) => Promise<any[]>;
