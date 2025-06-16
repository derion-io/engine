import { IEngineConfig, INetworkConfig } from './utils/configs';
export declare class Profile {
    chainId: number;
    env: 'development' | 'production';
    configs: INetworkConfig;
    routes: {
        [key: string]: {
            type: string;
            address: string;
        }[];
    };
    whitelistPools: string[];
    constructor(engineConfig: IEngineConfig);
    loadConfig(): Promise<void>;
    getAbi(name: string): any;
    getEventDataAbi(): {
        PoolCreated: string[];
        Swap: string[];
        Swap1: string[];
        Swap2: string[];
    };
    getExp(fetcher: string): number;
}
