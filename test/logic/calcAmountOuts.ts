import { BigNumber, ethers } from 'ethers'
import { Engine } from '../../src/engine'
import { bn, numberToWei, packId } from '../../src/utils/helper'
import { NATIVE_ADDRESS, POOL_IDS } from '../../src/utils/constant'
import TokenAbi from '../../src/abi/Token.json'
import { IEngineConfig } from '../../src/utils/configs'

export const calcAmountOuts = async (
  configs: IEngineConfig,
  poolAddresses: Array<string>,
  amountIn: number
): Promise<[any[], BigNumber]> => {
  const account = configs.account ?? configs.signer?._address
  const engine = new Engine(configs)
  await engine.initServices()
  await engine.RESOURCE.fetchResourceData(poolAddresses, account!)

  const currentPool = engine.RESOURCE.pools[poolAddresses[0]]
  engine.setCurrentPool({
    ...currentPool,
  })

  const poolOut = currentPool.poolAddress
  const provider = engine.RESOURCE.provider

  const tokenContract = new ethers.Contract(engine.profile.configs.derivable.token, TokenAbi, provider)
  const currentBalanceOut = await tokenContract.balanceOf(account, packId(POOL_IDS.C.toString(), poolOut))
  const steps = [
    {
      amountIn: bn(numberToWei(amountIn, 6)),
      tokenIn: NATIVE_ADDRESS,
      tokenOut: poolOut + '-' + POOL_IDS.A,
      amountOutMin: 0,
      currentBalanceOut,
      useSweep: true,
    },
  ]

  const fetcherV2 = await engine.SWAP.needToSubmitFetcher(currentPool)
  const params: any = {
    steps,
    fetcherV2,
  }
  if (fetcherV2) {
    params.fetcherData = await engine.SWAP.fetchPriceMockTx(currentPool)
  }
  return await engine.SWAP.calculateAmountOuts(params)
}
