import { Engine } from '../src/engine'
import { bn, numberToWei, packId } from '../src/utils/helper'
import { getTestConfigs } from './shared/testConfigs'
import { NATIVE_ADDRESS, POOL_IDS } from '../src/utils/constant'
import TokenAbi from '../src/abi/Token.json'
import { ethers } from 'ethers'

const testLocal = async () => {
  const configs = getTestConfigs(56)
  const engine = new Engine(configs)
  await engine.initServices()
  await engine.RESOURCE.fetchResourceData(configs.account)

  const currentPool = engine.RESOURCE.pools['0x3Db6cB9E2F52673C978AdF99477C73eC0d5b5712']
  engine.setCurrentPool({
    ...currentPool,
  })

  const poolOut = currentPool.poolAddress
  const provider = new ethers.providers.JsonRpcProvider(engine.profile.configs.rpc)
  // @ts-ignore
  const tokenContract = new ethers.Contract(engine.profile.configs.derivable.token, TokenAbi, provider)
  const currentBalanceOut = await tokenContract.balanceOf(configs.account, packId(POOL_IDS.C.toString(), poolOut))
  const steps = [
    {
      amountIn: bn(numberToWei(1, 6)),
      tokenIn: NATIVE_ADDRESS,
      tokenOut: poolOut + '-' + POOL_IDS.C,
      amountOutMin: 0,
      currentBalanceOut,
      useSweep: true,
    },
  ]

  try {
    const fetcherV2 = await engine.SWAP.needToSubmitFetcher(currentPool)
    const fetcherData = await engine.SWAP.fetchPriceTx(currentPool)
    const res = await engine.SWAP.multiSwap({
      fetcherData,
      submitFetcherV2: fetcherV2,
      steps,
      gasLimit: bn(2000000),
      gasPrice: bn(3e9),
    })
    console.log(res)
  } catch (e) {
    console.log(e)
  }
}

testLocal()
