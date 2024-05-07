import { GetRateInput } from '@paraswap/sdk/dist/methods/swap/rates'
import { Engine } from '../../src/engine'
import { IEngineConfig } from '../../src/utils/configs'

export const aggregator = async (configs: IEngineConfig, getRateData: GetRateInput): Promise<any> => {
  const engine = new Engine(configs)
  await engine.initServices()
  const response = await engine.AGGREGATOR.getRateAndBuildTxSwap(getRateData)

  console.log(response)
  return response
}
