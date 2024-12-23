import { DerionSDK } from '../src/sdk/sdk'
import { groupBy, packPosId, throwError, unpackPosId } from '../src/sdk/utils'
import { Interceptor } from './shared/libs/interceptor'
import { AssistedJsonRpcProvider } from 'assisted-json-rpc-provider'
import { hexZeroPad } from 'ethers/lib/utils'
import { JsonRpcProvider } from '@ethersproject/providers'
import { NATIVE_ADDRESS, POOL_IDS } from '../src/utils/constant'
import { numberToWei, packId, thousandsInt } from '../src/utils/helper'
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
  test('derion-sdk-native-open', async () => {
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
    // 53501226
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
    const poolToSwap = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd'
    account.processLogs(txLogs)
    const swapper = sdk.createSwapper(rpcUrl)
    // NATIVE - A
    const { amountOuts: amountOutsA, gasUsed: gasUsedA  } = await swapper.simulate({
      tokenIn: NATIVE_ADDRESS,
      tokenOut: packPosId(poolToSwap, POOL_IDS.A),
      amount: numberToWei(0.0001, 18),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsA)).toBeGreaterThan(0)
    expect(Number(gasUsedA)).toBeGreaterThan(0)
    const { amountOuts: amountOutsB, gasUsed: gasUsedB} = await swapper.simulate({
      tokenIn: NATIVE_ADDRESS,
      tokenOut: packPosId(poolToSwap, POOL_IDS.B),
      amount: numberToWei(0.0001, 18),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsB)).toBeGreaterThan(0)
    expect(Number(gasUsedB)).toBeGreaterThan(0)
    const { amountOuts: amountOutsC, gasUsed: gasUsedC} = await swapper.simulate({
      tokenIn: NATIVE_ADDRESS,
      tokenOut: packPosId(poolToSwap, POOL_IDS.C),
      amount: numberToWei(0.0001, 18),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsC)).toBeGreaterThan(0)
    expect(Number(gasUsedC)).toBeGreaterThan(0)
  })
  test('derion-sdk-R-open', async () => {
    const chainId = 42161
    const accountAddress = '0xE61383556642AF1Bd7c5756b13f19A63Dc8601df'
    const poolToSwap = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd'
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
    // 53501226
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
    // Token R -> A
    const poolToSwapR = pools[poolToSwap].config?.TOKEN_R 
    expect(poolToSwapR?.length).toBeGreaterThanOrEqual(42)
    const { amountOuts: amountROutsA, gasUsed: gasUsedRA} = await swapper.simulate({
      tokenIn: poolToSwapR || '',
      tokenOut: packPosId(poolToSwap, POOL_IDS.A),
      amount: numberToWei(0.0001, 18),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountROutsA)).toBeGreaterThan(0)
    expect(Number(gasUsedRA)).toBeGreaterThan(0)
    // Token R -> B
    const { amountOuts: amountROutsB, gasUsed: gasUsedRB} = await swapper.simulate({
      tokenIn: poolToSwapR || '',
      tokenOut: packPosId(poolToSwap, POOL_IDS.B),
      amount: numberToWei(0.0001, 18),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountROutsB)).toBeGreaterThan(0)
    expect(Number(gasUsedRB)).toBeGreaterThan(0)
    // Token R -> C
    const { amountOuts: amountROutsC, gasUsed: gasUsedRC} = await swapper.simulate({
      tokenIn: poolToSwapR || '',
      tokenOut: packPosId(poolToSwap, POOL_IDS.C),
      amount: numberToWei(0.0001, 18),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountROutsC)).toBeGreaterThan(0)
    expect(Number(gasUsedRC)).toBeGreaterThan(0)
  })
  test('derion-sdk-any-open', async () => {
    const chainId = 42161
    const accountAddress = '0xD42d6d58F95A3DA9011EfEcA086200A64B266c10'
    const poolToSwap = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd'
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
    const { amountOuts:amountOutsUSDCA, gasUsed: gasUsedUSDCA  } = await swapper.simulate({
      tokenIn: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      tokenOut: packPosId(poolToSwap, POOL_IDS.A),
      amount: "100000",
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsUSDCA)).toBeGreaterThan(0)
    expect(Number(gasUsedUSDCA)).toBeGreaterThan(0)
    const { amountOuts:amountOutsUSDCB, gasUsed: gasUsedUSDCB  } = await swapper.simulate({
      tokenIn: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      tokenOut: packPosId(poolToSwap, POOL_IDS.B),
      amount: "100000",
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsUSDCB)).toBeGreaterThan(0)
    expect(Number(gasUsedUSDCB)).toBeGreaterThan(0)
    const { amountOuts:amountOutsUSDCC, gasUsed:gasUsedUSDCC  } = await swapper.simulate({
      tokenIn: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      tokenOut: packPosId(poolToSwap, POOL_IDS.C),
      amount: "100000",
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsUSDCC)).toBeGreaterThan(0)
    expect(Number(gasUsedUSDCC)).toBeGreaterThan(0)
  })
  test('derion-sdk-positions-swap', async () => {
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
    const positionPoolFrom = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd' // Derion pool ARB/ETH
    const positionPoolTo = '0x3ed9997b3039b4A000f1BAfF3F6104FB05F4e53B' // Derion pool WBTC/USDC
    const swapper = sdk.createSwapper(rpcUrl)
    console.log(account.positions[packPosId(positionPoolFrom, POOL_IDS.A)], account.positions[packPosId(positionPoolFrom, POOL_IDS.B)])
    const {amountOuts:amountOutsAC, gasUsed: gasUsedAC} = await swapper.simulate({
      tokenIn: packPosId(positionPoolFrom, POOL_IDS.A),
      tokenOut: packPosId(positionPoolTo, POOL_IDS.C),
      amount: '1000',
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsAC)).toBeGreaterThan(0)
    expect(Number(gasUsedAC)).toBeGreaterThan(0)
    const {amountOuts:amountOutsAB, gasUsed: gasUsedAB} = await swapper.simulate({
      tokenIn: packPosId(positionPoolFrom, POOL_IDS.A),
      tokenOut: packPosId(positionPoolTo, POOL_IDS.B),
      amount: '1000',
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsAB)).toBeGreaterThan(0)
    expect(Number(gasUsedAB)).toBeGreaterThan(0)

    const {amountOuts:amountOutsBC, gasUsed: gasUsedBC} = await swapper.simulate({
      tokenIn: packPosId(positionPoolFrom, POOL_IDS.B),
      tokenOut: packPosId(positionPoolTo, POOL_IDS.C),
      amount: '1000',
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsBC)).toBeGreaterThan(0)
    expect(Number(gasUsedBC)).toBeGreaterThan(0)
  
  })
  test('derion-sdk-close', async () => {
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
    const posKey = Object.keys(account.positions).filter(pos => {
      return account.positions[pos].balance.gt(0)
    })
    const positionPoolAddress = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd'
    const positionSide = POOL_IDS.A
    const position = account.positions[Object.keys(account.positions).filter(key => key.includes(positionPoolAddress.toLowerCase().slice(2, 100)))[0]]
    const swapper = sdk.createSwapper(rpcUrl)
    const { amountOuts } = await swapper.simulate({
      tokenIn: packPosId(positionPoolAddress, positionSide),
      tokenOut: NATIVE_ADDRESS,
      amount: position.balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    const amountOut = amountOuts[amountOuts.length-1]
    console.log(thousandsInt(amountOut.toString(), 6))
  })
})
