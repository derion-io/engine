import { DerionSDK } from '../src/sdk'
import { packPosId, throwError } from '../src/utils'
import { Interceptor } from './shared/libs/interceptor'
import { JsonRpcProvider } from '@ethersproject/providers'
import { NATIVE_ADDRESS, POOL_IDS } from '../src/utils/constant'
import { numberToWei } from '../src/utils/helper'
import { VoidSigner } from 'ethers'
import { formatPositionView } from '../src/utils/positions'
import path from 'path'
import { LogType } from '../src/type'

const interceptor = new Interceptor()

const RPCs = {
  137: 'https://polygon.llamarpc.com',
  42161: 'https://arbitrum.llamarpc.com',
}

describe('SDK', () => {
  beforeEach(() => {
    interceptor.setContext(expect.getState().currentTestName)
  })

  test('logs', async () => {
    const chainId = 137
    const accountAddress = '0xE61383556642AF1Bd7c5756b13f19A63Dc8601df'

    const rpcUrl = RPCs[chainId] ?? throwError()

    const sdk = new DerionSDK({ chainId })
    await sdk.init()

    const txLogs = await loadAccountLogs(rpcUrl, chainId, accountAddress)
    const { poolAddresses } = sdk.extractLogs(txLogs)

    const stateLoader = sdk.getStateLoader(rpcUrl)

    const pools = await stateLoader.loadPools(poolAddresses)

    const account = sdk.createAccount(accountAddress)
    account.processLogs(txLogs)
    account.processLogs(txLogs) // the second call does nothing

    const posViews = Object.values(account.positions).map(pos => sdk.calcPositionState(pos, pools))

    console.log(...posViews.map(pv => formatPositionView(pv)))
  })

  test('native-open', async () => {
    const chainId = 42161
    const accountAddress = '0xD42d6d58F95A3DA9011EfEcA086200A64B266c10'
    const rpcUrl = RPCs[chainId] ?? throwError()
    const sdk = new DerionSDK({ chainId })
    await sdk.init()

    const signer = new VoidSigner(accountAddress, new JsonRpcProvider(rpcUrl));

    const txLogs = await loadAccountLogs(rpcUrl, chainId, accountAddress)
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

  test('R-open', async () => {
    const chainId = 42161
    const accountAddress = '0xE61383556642AF1Bd7c5756b13f19A63Dc8601df'
    const poolToSwap = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd'
    const rpcUrl = RPCs[chainId] ?? throwError()
    const sdk = new DerionSDK({ chainId })
    await sdk.init()

    const signer = new VoidSigner(accountAddress, new JsonRpcProvider(rpcUrl));

    const txLogs = await loadAccountLogs(rpcUrl, chainId, accountAddress)
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

  test('any-open', async () => {
    const chainId = 42161
    const accountAddress = '0xD42d6d58F95A3DA9011EfEcA086200A64B266c10'
    const poolToSwap = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd'
    const rpcUrl = RPCs[chainId] ?? throwError()
    const sdk = new DerionSDK({ chainId })
    await sdk.init()

    const signer = new VoidSigner(accountAddress, new JsonRpcProvider(rpcUrl));

    const txLogs = await loadAccountLogs(rpcUrl, chainId, accountAddress)
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

  test('positions-swap', async () => {
    const chainId = 42161
    const accountAddress = '0xD42d6d58F95A3DA9011EfEcA086200A64B266c10'
    const rpcUrl = RPCs[chainId] ?? throwError()
    const sdk = new DerionSDK({ chainId })
    await sdk.init()
    const signer = new VoidSigner(accountAddress, new JsonRpcProvider(rpcUrl));

    const txLogs = await loadAccountLogs(rpcUrl, chainId, accountAddress)
    const poolAdrs = sdk.extractLogs(txLogs)

    const stateLoader = sdk.getStateLoader(rpcUrl)
    const pools = await stateLoader.loadPools(poolAdrs.poolAddresses)
    const account = sdk.createAccount(accountAddress)
    account.processLogs(txLogs)
    const positionPoolARB = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd' // Derion pool ARB/ETH
    const positionPoolWBTC = '0x3ed9997b3039b4A000f1BAfF3F6104FB05F4e53B' // Derion pool WBTC/USDC
    const swapper = sdk.createSwapper(rpcUrl)
    const {amountOuts:amountOutsAC, gasUsed: gasUsedAC} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.A),
      tokenOut: packPosId(positionPoolWBTC, POOL_IDS.C),
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.A)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsAC)).toBeGreaterThan(0)
    expect(Number(gasUsedAC)).toBeGreaterThan(0)
    const {amountOuts:amountOutsAB, gasUsed: gasUsedAB} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.A),
      tokenOut: packPosId(positionPoolARB, POOL_IDS.B),
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.A)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsAB)).toBeGreaterThan(0)
    expect(Number(gasUsedAB)).toBeGreaterThan(0)
    const {amountOuts:amountOutsBC, gasUsed: gasUsedBC} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.B),
      tokenOut: packPosId(positionPoolWBTC, POOL_IDS.C),
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.B)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsBC)).toBeGreaterThan(0)
    expect(Number(gasUsedBC)).toBeGreaterThan(0)
  })

  test('positions-close', async () => {
    const chainId = 42161
    const accountAddress = '0xD42d6d58F95A3DA9011EfEcA086200A64B266c10'
    const rpcUrl = RPCs[chainId] ?? throwError()
    const sdk = new DerionSDK({ chainId })
    await sdk.init()
    const signer = new VoidSigner(accountAddress, new JsonRpcProvider(rpcUrl));

    const txLogs = await loadAccountLogs(rpcUrl, chainId, accountAddress)
    const poolAdrs = sdk.extractLogs(txLogs)

    const stateLoader = sdk.getStateLoader(rpcUrl)
    const pools = await stateLoader.loadPools(poolAdrs.poolAddresses)
    const account = sdk.createAccount(accountAddress)
    account.processLogs(txLogs)
    const positionPoolARB = '0xf3cE4cbfF83AE70e9F76b22cd9b683F167d396dd' // Derion pool ARB/ETH
    const positionPoolWBTC = '0x3ed9997b3039b4A000f1BAfF3F6104FB05F4e53B' // Derion pool WBTC/USDC
    const positionPoolWETH = '0xAaf8FAC8F5709B0c954c9Af1d369A9b157e31FfE' // Derion pool WBTC/USDC

    const swapper = sdk.createSwapper(rpcUrl)
    console.log('A -> NATIVE')
    const {amountOuts:amountOutsANative, gasUsed: gasUsedANative} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.A),
      tokenOut: pools[positionPoolARB].config?.TOKEN_R || "",
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.A)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsANative)).toBeGreaterThan(0)
    expect(Number(gasUsedANative)).toBeGreaterThan(0)
    console.log('B -> NATIVE')

    const {amountOuts:amountOutsBNative, gasUsed: gasUsedBNative} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.B),
      tokenOut: NATIVE_ADDRESS,
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.B)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })

    expect(Number(amountOutsBNative)).toBeGreaterThan(0)
    expect(Number(gasUsedBNative)).toBeGreaterThan(0)
    console.log('C -> NATIVE')

    const {amountOuts:amountOutsCNative, gasUsed: gasUsedCNative} = await swapper.simulate({
      tokenIn: packPosId(positionPoolWETH, POOL_IDS.C),
      tokenOut: NATIVE_ADDRESS,
      amount: account.positions[packPosId(positionPoolWETH, POOL_IDS.C)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsCNative)).toBeGreaterThan(0)
    expect(Number(gasUsedCNative)).toBeGreaterThan(0)


    console.log('A -> R')
    const {amountOuts:amountOutsAR, gasUsed: gasUsedAR} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.A),
      tokenOut: pools[positionPoolARB].config?.TOKEN_R || "",
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.A)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsAR)).toBeGreaterThan(0)
    expect(Number(gasUsedAR)).toBeGreaterThan(0)
    console.log('B -> R')

    const {amountOuts:amountOutsBR, gasUsed: gasUsedBR} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.B),
      tokenOut:  pools[positionPoolARB].config?.TOKEN_R || "",
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.B)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })

    expect(Number(amountOutsBR)).toBeGreaterThan(0)
    expect(Number(gasUsedBR)).toBeGreaterThan(0)
    console.log('C -> R')

    const {amountOuts:amountOutsCR, gasUsed: gasUsedCR} = await swapper.simulate({
      tokenIn: packPosId(positionPoolWETH, POOL_IDS.C),
      tokenOut:  pools[positionPoolWETH].config?.TOKEN_R || "",
      amount: account.positions[packPosId(positionPoolWETH, POOL_IDS.C)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsCR)).toBeGreaterThan(0)
    expect(Number(gasUsedCR)).toBeGreaterThan(0)


    console.log('A -> USDC')
    const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
    const {amountOuts:amountOutsAUSDC, gasUsed: gasUsedAUSDC} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.A),
      tokenOut: USDC,
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.A)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsAUSDC)).toBeGreaterThan(0)
    expect(Number(gasUsedAUSDC)).toBeGreaterThan(0)
    console.log('B -> USDC')

    const {amountOuts:amountOutsBUSDC, gasUsed: gasUsedBUSDC} = await swapper.simulate({
      tokenIn: packPosId(positionPoolARB, POOL_IDS.B),
      tokenOut: USDC,
      amount: account.positions[packPosId(positionPoolARB, POOL_IDS.B)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })

    expect(Number(amountOutsBUSDC)).toBeGreaterThan(0)
    expect(Number(gasUsedBUSDC)).toBeGreaterThan(0)
    console.log('C -> USDC')

    const {amountOuts:amountOutsCUSDC, gasUsed: gasUsedCUSDC} = await swapper.simulate({
      tokenIn: packPosId(positionPoolWETH, POOL_IDS.C),
      tokenOut: USDC,
      amount: account.positions[packPosId(positionPoolWETH, POOL_IDS.C)].balance.toString(),
      deps: {
        signer,
        pools
      }
    })
    expect(Number(amountOutsCUSDC)).toBeGreaterThan(0)
    expect(Number(gasUsedCUSDC)).toBeGreaterThan(0)

  })
})

async function loadAccountLogs(rpcUrl, chainId, accountAddress): Promise<LogType[][]> {
  const fp = path.join(__dirname, `logs/${chainId}-${accountAddress}.json`)
  return require(fp)
}
