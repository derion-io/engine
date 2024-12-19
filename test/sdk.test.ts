import { DerionSDK } from '../src/sdk/sdk'
import { groupBy, throwError } from '../src/sdk/utils'
import { Interceptor } from './shared/libs/interceptor'
import { AssistedJsonRpcProvider } from 'assisted-json-rpc-provider'
import { hexZeroPad } from 'ethers/lib/utils'
import { JsonRpcProvider } from '@ethersproject/providers'

const interceptor = new Interceptor()

describe('Derion SDK', () => {
  beforeEach(() => {
    interceptor.setContext(expect.getState().currentTestName)
  })

  test('sdk-flow', async () => {
    const chainId = 137
    const account = '0xE61383556642AF1Bd7c5756b13f19A63Dc8601df'

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
    const accTopic = hexZeroPad(account, 32)
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
    const poolAdrs = sdk.extractPoolAddresses(txLogs)

    const stateLoader = sdk.getStateLoader(rpcUrl)

    const pools = await stateLoader.loadPools(poolAdrs)

    console.log(pools)
  })
})
