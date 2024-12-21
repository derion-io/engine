import { DerionSDK } from '../src/sdk/sdk'
import { groupBy, throwError } from '../src/sdk/utils'
import { Interceptor } from './shared/libs/interceptor'
import { AssistedJsonRpcProvider } from 'assisted-json-rpc-provider'
import { hexZeroPad } from 'ethers/lib/utils'
import { JsonRpcProvider } from '@ethersproject/providers'
import { NATIVE_ADDRESS, POOL_IDS } from '../src/utils/constant'
import { numberToWei } from '../src/utils/helper'
import { VoidSigner } from 'ethers'
import { formatPositionView } from '../src/sdk/utils/positions'

const interceptor = new Interceptor()

describe('Derion SDK', () => {
  beforeEach(() => {
    interceptor.setContext(expect.getState().currentTestName)
  })

  test('sdk-flow', async () => {
    const chainId = 137
    const accountAddress = '0xE61383556642AF1Bd7c5756b13f19A63Dc8601df'

    const rpcUrl = process.env['RPC_' + chainId] ?? throwError()
    const scanApi = process.env['SCAN_API_' + chainId] ?? throwError()

    const sdk = new DerionSDK({ chainId })
    await sdk.init()

    const provider = new AssistedJsonRpcProvider(
      new JsonRpcProvider(rpcUrl), {
      url: scanApi,
      apiKeys: process.env['SCAN_API_KEY_' + chainId]?.split(',') ?? throwError(),
    }
    )
    const accTopic = hexZeroPad(accountAddress, 32)
    const logs = await provider.getLogs({
      fromBlock: 0,
      toBlock: Number.MAX_SAFE_INTEGER,
      topics: [
        [],
        [null, accTopic],
        [null, null, accTopic],
        [null, null, null, accTopic],
      ],
    })

    const txLogs = Object.values(groupBy(logs, 'transactionHash'))
    const { poolAddresses } = sdk.extractLogs(txLogs)

    const stateLoader = sdk.getStateLoader(rpcUrl)

    const pools = await stateLoader.loadPools(poolAddresses)

    const account = sdk.createAccount(accountAddress)
    account.processLogs(txLogs)
    account.processLogs(txLogs) // the second call does nothing

    const posViews = Object.values(account.positions).map(pos => sdk.calcPositionState(pos, pools))

    console.log(...posViews.map(pv => formatPositionView(pv)))
  })
  test('derion-sdk-swap', async () => {
    const chainId = 42161
    const accountAddress = '0xD42d6d58F95A3DA9011EfEcA086200A64B266c10'
    const rpcUrl = process.env['RPC_' + chainId] ?? throwError()
    const scanApi = process.env['SCAN_API_' + chainId] ?? throwError()
    const sdk = new DerionSDK({ chainId })
    await sdk.init()

    const provider = new AssistedJsonRpcProvider(
      new JsonRpcProvider(rpcUrl), {
      url: scanApi,
      apiKeys: process.env['SCAN_API_KEY_' + chainId]?.split(',') ?? throwError(),
    }
    )
    const signer = new VoidSigner(accountAddress, new JsonRpcProvider(rpcUrl));

    const accTopic = hexZeroPad(accountAddress, 32)
    const logs = await provider.getLogs({
      fromBlock: 0,
      toBlock: Number.MAX_SAFE_INTEGER,
      topics: [
        [],
        [null, accTopic],
        [null, null, accTopic],
        [null, null, null, accTopic],
      ],
    })
    const txLogs = Object.values(groupBy(logs, 'transactionHash'))
    const poolAdrs = sdk.extractLogs(txLogs)

    const stateLoader = sdk.getStateLoader(rpcUrl)
    const pools = await stateLoader.loadPools(poolAdrs.poolAddresses)
    const account = sdk.createAccount(accountAddress)
    account.processLogs(txLogs)
    const swapper = sdk.createSwapper(rpcUrl)
    // console.log(account.positions, pools)
    try {
      const swapResult = await swapper.simulate({
        tokenIn: NATIVE_ADDRESS,
        tokenOut: `0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd-${POOL_IDS.A}`,
        amount: numberToWei(0.0001, 18),
        deps: {
          signer,
          pools
        }
      })
      console.log(swapResult)
      expect(swapResult.length).toEqual(0)
    } catch (error) {
      console.log(error)
    }
  })
  test('derion-sdk-agg', async () => {
    const chainId = 42161
    const accountAddress = '0xD42d6d58F95A3DA9011EfEcA086200A64B266c10'
    const rpcUrl = process.env['RPC_' + chainId] ?? throwError()
    const scanApi = process.env['SCAN_API_' + chainId] ?? throwError()
    const sdk = new DerionSDK({ chainId })
    await sdk.init()

    const provider = new AssistedJsonRpcProvider(
      new JsonRpcProvider(rpcUrl), {
      url: scanApi,
      apiKeys: process.env['SCAN_API_KEY_' + chainId]?.split(',') ?? throwError(),
    }
    )
    const signer = new VoidSigner(accountAddress, new JsonRpcProvider(rpcUrl));

    const accTopic = hexZeroPad(accountAddress, 32)
    const logs = await provider.getLogs({
      fromBlock: 0,
      toBlock: Number.MAX_SAFE_INTEGER,
      topics: [
        [],
        [null, accTopic],
        [null, null, accTopic],
        [null, null, null, accTopic],
      ],
    })
    const txLogs = Object.values(groupBy(logs, 'transactionHash'))
    const poolAdrs = sdk.extractLogs(txLogs)

    const stateLoader = sdk.getStateLoader(rpcUrl)
    const pools = await stateLoader.loadPools(poolAdrs.poolAddresses)
    const account = sdk.createAccount(accountAddress)
    account.processLogs(txLogs)
    const swapper = sdk.createSwapper(rpcUrl)
    // console.log(account.positions, pools)
    try {
      const swapResult = await swapper.simulate({
        tokenIn: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDC
        tokenOut: `0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd-${POOL_IDS.A}`,
        amount: "100000",
        deps: {
          signer,
          pools
        }
      })
      expect(swapResult.length).toEqual(0)
    } catch (error) {
      console.log(error)
    }
  })
})
