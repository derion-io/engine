"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.overrideBnA = exports.getStorageSlotsForBnA = exports.getAllowanceSlot = exports.getBalanceSlot = void 0;
const ethers_1 = require("ethers");
const ERC20_json_1 = __importDefault(require("../abi/ERC20.json"));
const ethereum_multicall_1 = require("ethereum-multicall");
const bn = (number) => ethers_1.ethers.BigNumber.from(number.toString());
const encode = (types, values) => ethers_1.ethers.utils.defaultAbiCoder.encode(types, values);
const DEFAULT_ACCOUNT = '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa';
const DEFAULT_SPENDER = '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB';
function getBalanceSlot(account, i) {
    return ethers_1.ethers.utils.keccak256(encode(['address', 'uint'], [account, i]));
}
exports.getBalanceSlot = getBalanceSlot;
function getAllowanceSlot(account, spender, i) {
    const firstLevelEncoded = encode(['address', 'uint'], [account, i]);
    const secondLevelEncoded = encode(['address'], [spender]);
    const slot = ethers_1.ethers.utils.keccak256(ethers_1.ethers.utils.concat([secondLevelEncoded, ethers_1.ethers.utils.keccak256(firstLevelEncoded)]));
    return slot;
}
exports.getAllowanceSlot = getAllowanceSlot;
const getStorageSlotsForBnA = async (provider, contractAddress, account = DEFAULT_ACCOUNT, spender = DEFAULT_SPENDER, slots = 100) => {
    const stateDiff = {};
    for (let i = 0; i < slots; i++) {
        stateDiff[getBalanceSlot(account, i)] = ethers_1.ethers.utils.hexZeroPad(ethers_1.ethers.utils.hexlify(i + 1), 32);
        stateDiff[getAllowanceSlot(account, spender, i)] = ethers_1.ethers.utils.hexZeroPad(ethers_1.ethers.utils.hexlify(i + 1), 32);
    }
    // store the original override state
    const original = provider.getStateOverride();
    provider.setStateOverride({
        [contractAddress]: {
            stateDiff,
        },
    });
    const multicall = new ethereum_multicall_1.Multicall({
        ethersProvider: provider,
        tryAggregate: true,
        multicallCustomContractAddress: '0x3bc605DBD3f9d8e9B6FACdfc6548f8BD3b0f0Af5',
    });
    const contractCallContext = {
        reference: 'StorageSlot',
        contractAddress: contractAddress,
        abi: ERC20_json_1.default,
        calls: [
            {
                reference: 'getBalance',
                methodName: 'balanceOf',
                methodParameters: [account],
            },
            {
                reference: 'getAllowance',
                methodName: 'allowance',
                methodParameters: [account, spender],
            },
        ],
    };
    const results = await multicall.call(contractCallContext);
    provider.setStateOverride(original);
    let data = results.results[contractCallContext.reference].callsReturnContext;
    if (data[0].decoded == false ||
        data[1].decoded == false ||
        data[0].returnValues[0].hex == '0x00' ||
        data[1].returnValues[0].hex == '0x00')
        throw new Error(`unable to find the balance slot for the first ${slots} slots`);
    let balance = bn(data[0].returnValues[0].hex).toNumber();
    let allowance = bn(data[1].returnValues[0].hex).toNumber();
    return {
        balance: {
            index: balance - 1,
            slot: getBalanceSlot(account, balance - 1),
        },
        allowance: {
            index: allowance - 1,
            slot: getAllowanceSlot(account, spender, allowance - 1),
        },
    };
};
exports.getStorageSlotsForBnA = getStorageSlotsForBnA;
const overrideBnA = async (override) => {
    let state = {};
    let result = await (0, exports.getStorageSlotsForBnA)(override.provider, override.token, override.account);
    let balance;
    balance = ethers_1.ethers.BigNumber.from(override.balance.toString());
    balance = ethers_1.ethers.utils.hexZeroPad(balance.toHexString(), 32);
    if (override.balance) {
        // @ts-ignore
        state[result.balance.slot] = balance;
    }
    if (override.allowances) {
        for (const spender of Object.keys(override.allowances)) {
            let allowance = override.allowances[spender];
            allowance = ethers_1.ethers.BigNumber.from(allowance.toString());
            allowance = ethers_1.ethers.utils.hexZeroPad(allowance.toHexString(), 32);
            let slot = getAllowanceSlot(override.account, spender, result.allowance.index);
            // @ts-ignore
            state[slot] = allowance;
        }
    }
    return state;
};
exports.overrideBnA = overrideBnA;
//# sourceMappingURL=storageSlotSearch.js.map