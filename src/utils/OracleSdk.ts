import { rlpEncode, rlpDecode } from '@zoltu/rlp-encoder'
import { ethers } from 'ethers'
const bn = ethers.BigNumber.from

const Q112 = bn(1).shl(112)
const M112 = Q112.sub(1)

export interface Proof {
  readonly block: Uint8Array
  readonly accountProofNodesRlp: Uint8Array
  readonly reserveAndTimestampProofNodesRlp: Uint8Array
  readonly priceAccumulatorProofNodesRlp: Uint8Array
}

export type ProofResult = {
  readonly accountProof: readonly Uint8Array[]
  readonly storageProof: readonly {
    readonly key: string
    readonly value: string
    readonly proof: readonly Uint8Array[]
  }[]
}

export type Block = {
  readonly parentHash: string
  readonly sha3Uncles: string
  readonly miner: string
  readonly stateRoot: string
  readonly transactionsRoot: string
  readonly receiptsRoot: string
  readonly logsBloom: string
  readonly difficulty: string
  readonly number: string
  readonly gasLimit: string
  readonly gasUsed: string
  readonly timestamp: string
  readonly extraData: Uint8Array
  readonly mixHash: string | undefined
  readonly nonce: string | null
  readonly baseFeePerGas: string | null
}

export type EthGetStorageAt = (address: string, position: number, block: number | 'latest') => Promise<string>
export type EthGetProof = (address: string, positions: readonly number[], block: number) => Promise<ProofResult>
export type EthGetBlockByNumber = (blockNumber: number | 'latest') => Promise<Block | null>

export async function getPrice(
  eth_getStorageAt: EthGetStorageAt,
  eth_getBlockByNumber: EthGetBlockByNumber,
  exchangeAddress: string,
  quoteTokenIndex: number,
  blockNumber: number,
): Promise<ethers.BigNumber> {
  async function getAccumulatorValue(innerBlockNumber: number | 'latest', timestamp: number) {
    const priceAccumulatorSlot = quoteTokenIndex == 0 ? 10 : 9
    const [reservesAndTimestamp, accumulator] = await Promise.all([
      eth_getStorageAt(exchangeAddress, 8, innerBlockNumber),
      eth_getStorageAt(exchangeAddress, priceAccumulatorSlot, innerBlockNumber),
    ])

    const blockTimestampLast = bn(reservesAndTimestamp).shr(224)
    const reserve1 = bn(reservesAndTimestamp).shr(112).and(M112)
    const reserve0 = bn(reservesAndTimestamp).and(M112)
    if (reserve0.eq(0)) throw new Error(`Exchange ${exchangeAddress} does not have any reserves for token0.`)
    if (reserve1.eq(0)) throw new Error(`Exchange ${exchangeAddress} does not have any reserves for token1.`)
    if (blockTimestampLast.eq(0))
      throw new Error(`Exchange ${exchangeAddress} has not had its first accumulator update (or it is year 2106).`)
    if (bn(accumulator).eq(0))
      throw new Error(`Exchange ${exchangeAddress} has not had its first accumulator update (or it is 136 years since launch).`)
    const numeratorReserve = quoteTokenIndex === 0 ? reserve0 : reserve1
    const denominatorReserve = quoteTokenIndex === 0 ? reserve1 : reserve0
    const timeElapsedSinceLastAccumulatorUpdate = bn(timestamp).sub(blockTimestampLast)
    const priceNow = numeratorReserve.shl(112).div(denominatorReserve)
    return timeElapsedSinceLastAccumulatorUpdate.mul(priceNow).add(accumulator)
  }

  const latestBlock = { timestamp: Math.floor(new Date().getTime() / 1000) }
  const historicBlock = await eth_getBlockByNumber(blockNumber)
  if (historicBlock === null) throw new Error(`Block ${blockNumber} does not exist.`)
  const [latestAccumulator, historicAccumulator] = await Promise.all([
    getAccumulatorValue('latest', latestBlock.timestamp),
    getAccumulatorValue(blockNumber, Number(historicBlock.timestamp)),
  ])

  const accumulatorDelta = latestAccumulator.sub(historicAccumulator)
  const timeDelta = bn(latestBlock.timestamp).sub(bn(historicBlock.timestamp))
  return timeDelta.eq(0) ? accumulatorDelta : accumulatorDelta.div(timeDelta)
}

export async function getAccumulatorPrice(
  eth_getStorageAt: EthGetStorageAt,
  exchangeAddress: string,
  quoteTokenIndex: number,
  blockNumber: number,
): Promise<{ price: ethers.BigNumber; timestamp: ethers.BigNumber }> {
  const priceAccumulatorSlot = quoteTokenIndex == 0 ? 10 : 9
  const [reservesAndTimestamp, accumulator] = await Promise.all([
    eth_getStorageAt(exchangeAddress, 8, blockNumber),
    eth_getStorageAt(exchangeAddress, priceAccumulatorSlot, blockNumber),
  ])
  const blockTimestampLast = bn(reservesAndTimestamp).shr(224)
  const reserve1 = bn(reservesAndTimestamp).shr(112).and(M112)
  const reserve0 = bn(reservesAndTimestamp).and(M112)
  if (reserve0.eq(0)) throw new Error(`Exchange ${exchangeAddress} does not have any reserves for token0.`)
  if (reserve1.eq(0)) throw new Error(`Exchange ${exchangeAddress} does not have any reserves for token1.`)
  if (blockTimestampLast.eq(0))
    throw new Error(`Exchange ${exchangeAddress} has not had its first accumulator update (or it is year 2106).`)
  if (bn(accumulator).eq(0))
    throw new Error(`Exchange ${exchangeAddress} has not had its first accumulator update (or it is 136 years since launch).`)
  return {
    price: bn(accumulator),
    timestamp: blockTimestampLast,
  }
}

export async function getProof(
  eth_getProof: EthGetProof,
  eth_getBlockByNumber: EthGetBlockByNumber,
  exchangeAddress: string,
  quoteTokenIndex: number,
  blockNumber: number,
): Promise<Proof> {
  const priceAccumulatorSlot = quoteTokenIndex == 0 ? 10 : 9
  const [block, proof] = await Promise.all([
    eth_getBlockByNumber(blockNumber),
    eth_getProof(exchangeAddress, [8, priceAccumulatorSlot], blockNumber),
  ])
  if (block === null) throw new Error(`Received null for block ${Number(blockNumber)}`)
  const blockRlp = rlpEncodeBlock(block)
  const accountProofNodesRlp = rlpEncode(proof.accountProof.map(rlpDecode))
  const reserveAndTimestampProofNodesRlp = rlpEncode(proof.storageProof[0].proof.map(rlpDecode))
  const priceAccumulatorProofNodesRlp = rlpEncode(proof.storageProof[1].proof.map(rlpDecode))
  return {
    block: blockRlp,
    accountProofNodesRlp,
    reserveAndTimestampProofNodesRlp,
    priceAccumulatorProofNodesRlp,
  }
}

function rlpEncodeBlock(block: Block) {
  return rlpEncode([
    hexStringToUint8Array(block.parentHash),
    hexStringToUint8Array(block.sha3Uncles),
    hexStringToUint8Array(block.miner),
    hexStringToUint8Array(block.stateRoot),
    hexStringToUint8Array(block.transactionsRoot),
    hexStringToUint8Array(block.receiptsRoot),
    hexStringToUint8Array(block.logsBloom),
    stripLeadingZeros(hexStringToUint8Array(block.difficulty)),
    stripLeadingZeros(hexStringToUint8Array(block.number)),
    stripLeadingZeros(hexStringToUint8Array(block.gasLimit)),
    stripLeadingZeros(hexStringToUint8Array(block.gasUsed)),
    stripLeadingZeros(hexStringToUint8Array(block.timestamp)),
    stripLeadingZeros(block.extraData),
    ...(block.mixHash != null ? [hexStringToUint8Array(block.mixHash)] : []),
    ...(block.nonce != null ? [hexStringToUint8Array(block.nonce)] : []),
    ...(block.baseFeePerGas != null ? [stripLeadingZeros(hexStringToUint8Array(block.baseFeePerGas))] : []),
  ])
}

export function stripLeadingZeros(byteArray: Uint8Array): Uint8Array {
  let i = 0
  for (; i < byteArray.length; ++i) {
    if (byteArray[i] !== 0) break
  }
  const result = new Uint8Array(byteArray.length - i)
  for (let j = 0; j < result.length; ++j) {
    result[j] = byteArray[i + j]
  }
  return result
}

export function hexStringToUint8Array(value: string) {
  value = value.substring(2)
  if (value.length % 2 != 0) {
    value = '0' + value
  }
  const result = Uint8Array.from(Buffer.from(value, 'hex'))
  return result
}
