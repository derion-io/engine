import { ethers } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import abi from '../abi/ERC20.json'
import { Multicall, ContractCallResults, ContractCallContext } from 'ethereum-multicall'

const bn = (number: any) => ethers.BigNumber.from(number.toString())
const encode = (types: string[], values: any) => ethers.utils.defaultAbiCoder.encode(types, values)

const DEFAULT_ACCOUNT = '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa'
const DEFAULT_SPENDER = '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'

export function getBalanceSlot(account: string, i: number): string {
  return ethers.utils.keccak256(encode(['address', 'uint'], [account, i]))
}

export function getAllowanceSlot(account: string, spender: string, i: number): string {
  const firstLevelEncoded = encode(['address', 'uint'], [account, i])
  const secondLevelEncoded = encode(['address'], [spender])
  const slot = ethers.utils.keccak256(ethers.utils.concat([secondLevelEncoded, ethers.utils.keccak256(firstLevelEncoded)]))
  return slot
}

export const getStorageSlotsForBnA = async (
  provider: JsonRpcProvider,
  contractAddress: string,
  account: string = DEFAULT_ACCOUNT,
  spender: string = DEFAULT_SPENDER,
  slots: number = 100,
) => {
  const stateDiff: any = {}
  for (let i = 0; i < slots; i++) {
    stateDiff[getBalanceSlot(account, i)] = ethers.utils.hexZeroPad(ethers.utils.hexlify(i + 1), 32)
    stateDiff[getAllowanceSlot(account, spender, i)] = ethers.utils.hexZeroPad(ethers.utils.hexlify(i + 1), 32)
  }

  // store the original override state
  const original = provider.getStateOverride()
  provider.setStateOverride({
    [contractAddress]: {
      stateDiff,
    },
  })

  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: '0x3bc605DBD3f9d8e9B6FACdfc6548f8BD3b0f0Af5',
  })

  const contractCallContext: ContractCallContext = {
    reference: 'StorageSlot',
    contractAddress: contractAddress,
    abi,
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
  }
  const results: ContractCallResults = await multicall.call(contractCallContext)

  provider.setStateOverride(original)
  const data = results.results[contractCallContext.reference].callsReturnContext

  if (
    data[0].decoded == false ||
    data[1].decoded == false ||
    data[0].returnValues[0].hex == '0x00' ||
    data[1].returnValues[0].hex == '0x00'
  )
    throw new Error(`unable to find the balance slot for the first ${slots} slots`)

  const balance = bn(data[0].returnValues[0].hex).toNumber()
  const allowance = bn(data[1].returnValues[0].hex).toNumber()

  return {
    balance: {
      index: balance - 1,
      slot: getBalanceSlot(account, balance - 1),
    },
    allowance: {
      index: allowance - 1,
      slot: getAllowanceSlot(account, spender, allowance - 1),
    },
  }
}

export const overrideBnA = async (override: {
  token: string
  account: string
  provider: JsonRpcProvider
  allowances?: { [spender: string]: any }
  balance?: any
}) => {
  const state = {}
  const result = await getStorageSlotsForBnA(override.provider, override.token, override.account)
  let balance

  balance = ethers.BigNumber.from(override.balance.toString())
  balance = ethers.utils.hexZeroPad(balance.toHexString(), 32)

  if (override.balance) {
    // @ts-ignore
    state[result.balance.slot] = balance
  }

  if (override.allowances) {
    for (const spender of Object.keys(override.allowances)) {
      let allowance = override.allowances[spender]
      allowance = ethers.BigNumber.from(allowance.toString())
      allowance = ethers.utils.hexZeroPad(allowance.toHexString(), 32)
      const slot = getAllowanceSlot(override.account, spender, result.allowance.index)
      // @ts-ignore
      state[slot] = allowance
    }
  }
  return state
}
