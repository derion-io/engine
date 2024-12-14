"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonRpcError = exports.getProofFactory = exports.getStorageAtFactory = exports.getBlockByNumberFactory = void 0;
function getBlockByNumberFactory(provider) {
    const requestProvider = normalizeProvider(provider);
    return async (blockNumber) => {
        const stringifiedBlockNumber = typeof blockNumber === 'number' ? numberToHexQuantity(blockNumber) : blockNumber;
        const block = await requestProvider.request({ method: 'eth_getBlockByNumber', params: [stringifiedBlockNumber, false] });
        assertPlainObject(block);
        assertProperty(block, 'parentHash', 'string');
        assertProperty(block, 'sha3Uncles', 'string');
        assertProperty(block, 'miner', 'string');
        assertProperty(block, 'stateRoot', 'string');
        assertProperty(block, 'transactionsRoot', 'string');
        assertProperty(block, 'receiptsRoot', 'string');
        assertProperty(block, 'logsBloom', 'string');
        assertProperty(block, 'difficulty', 'string');
        assertProperty(block, 'number', 'string');
        assertProperty(block, 'gasLimit', 'string');
        assertProperty(block, 'gasUsed', 'string');
        assertProperty(block, 'timestamp', 'string');
        assertProperty(block, 'extraData', 'string');
        assertProperty(block, 'mixHash', 'string');
        assertProperty(block, 'nonce', 'string');
        assertProperty(block, 'baseFeePerGas', 'string');
        return {
            parentHash: block.parentHash,
            sha3Uncles: block.sha3Uncles,
            miner: block.miner,
            stateRoot: block.stateRoot,
            transactionsRoot: block.transactionsRoot,
            receiptsRoot: block.receiptsRoot,
            logsBloom: block.logsBloom,
            difficulty: block.difficulty,
            number: block.number,
            gasLimit: block.gasLimit,
            gasUsed: block.gasUsed,
            timestamp: block.timestamp,
            extraData: stringToByteArray(block.extraData),
            mixHash: block.mixHash,
            nonce: block.nonce,
            baseFeePerGas: block.baseFeePerGas,
        };
    };
}
exports.getBlockByNumberFactory = getBlockByNumberFactory;
function getStorageAtFactory(provider) {
    const requestProvider = normalizeProvider(provider);
    return async (address, position, block) => {
        const encodedAddress = address;
        const encodedPosition = numberToHexQuantity(position);
        const encodedBlockTag = block === 'latest' ? 'latest' : `0x${block.toString(16)}`;
        const result = await requestProvider.request({ method: 'eth_getStorageAt', params: [encodedAddress, encodedPosition, encodedBlockTag] });
        if (typeof result !== 'string')
            throw new Error(`Expected eth_getStorageAt to return a string but instead returned a ${typeof result}`);
        return result;
    };
}
exports.getStorageAtFactory = getStorageAtFactory;
function getProofFactory(provider) {
    const requestProvider = normalizeProvider(provider);
    return async (address, positions, block) => {
        const encodedPositions = positions.map(numberToHexQuantity);
        const encodedBlockTag = numberToHexQuantity(block);
        const result = await requestProvider.request({ method: 'eth_getProof', params: [address, encodedPositions, encodedBlockTag] });
        assertPlainObject(result);
        assertProperty(result, 'accountProof', 'array');
        assertProperty(result, 'storageProof', 'array');
        const accountProof = result.accountProof.map((entry) => {
            assertType(entry, 'string');
            return stringToByteArray(entry);
        });
        const storageProof = result.storageProof.map((entry) => {
            assertPlainObject(entry);
            assertProperty(entry, 'key', 'string');
            assertProperty(entry, 'value', 'string');
            assertProperty(entry, 'proof', 'array');
            return {
                key: entry.key,
                value: entry.key,
                proof: entry.proof.map((proofEntry) => {
                    assertType(proofEntry, 'string');
                    return stringToByteArray(proofEntry);
                }),
            };
        });
        return { accountProof, storageProof };
    };
}
exports.getProofFactory = getProofFactory;
function normalizeProvider(provider) {
    if ('send' in provider) {
        return {
            request: async ({ method, params }) => provider.send(method, params),
        };
    }
    else {
        throw new Error(`expected an object with a 'request', 'sendAsync' or 'send' method on it but received ${JSON.stringify(provider)}`);
    }
}
class JsonRpcError extends Error {
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
        // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, JsonRpcError.prototype);
    }
}
exports.JsonRpcError = JsonRpcError;
function assertPlainObject(maybe) {
    if (typeof maybe !== 'object')
        throw new Error(`Expected an object but received a ${typeof maybe}`);
    if (maybe === null)
        throw new Error(`Expected an object but received null.`);
    if (Array.isArray(maybe))
        throw new Error(`Expected an object but received an array.`);
    if (Object.getPrototypeOf(maybe) !== Object.prototype)
        throw new Error(`Expected a plain object, but received a class instance.`);
}
function assertType(maybe, expectedPropertyType) {
    if (expectedPropertyType === 'string' && typeof maybe === 'string')
        return;
    if (expectedPropertyType === 'array' && Array.isArray(maybe))
        return;
    if (expectedPropertyType === 'object' && typeof maybe === 'object' && maybe !== null && !Array.isArray(maybe))
        return;
    throw new Error(`Value is of type ${typeof maybe} instead of expected type ${expectedPropertyType}`);
}
function assertProperty(maybe, propertyName, expectedPropertyType) {
    if (!(propertyName in maybe))
        throw new Error(`Object does not contain a ${propertyName} property.`);
    const propertyValue = maybe[propertyName];
    // CONSIDER: DRY with `assertType`
    if (expectedPropertyType === 'string' && typeof propertyValue === 'string')
        return;
    if (expectedPropertyType === 'array' && Array.isArray(propertyValue))
        return;
    if (expectedPropertyType === 'object' && typeof propertyValue === 'object' && propertyValue !== null && !Array.isArray(propertyValue))
        return;
    throw new Error(`Object.${propertyName} is of type ${typeof propertyValue} instead of expected type ${expectedPropertyType}`);
}
function stringToByteArray(hex) {
    const match = /^(?:0x)?([a-fA-F0-9]*)$/.exec(hex);
    if (match === null)
        throw new Error(`Expected a hex string encoded byte array with an optional '0x' prefix but received ${hex}`);
    const normalized = match[1];
    if (normalized.length % 2)
        throw new Error(`Hex string encoded byte array must be an even number of charcaters long.`);
    const bytes = [];
    for (let i = 0; i < normalized.length; i += 2) {
        bytes.push(Number.parseInt(`${normalized[i]}${normalized[i + 1]}`, 16));
    }
    return new Uint8Array(bytes);
}
function numberToHexQuantity(value) {
    return `0x${value.toString(16)}`;
}
//# sourceMappingURL=OracleSdkAdapter.js.map