import { Engine } from '../../src/engine'
import { IEngineConfig } from '../../src/utils/configs'
import { SwapAndOpenAggregatorType, rateDataAggregatorType } from '../../src/types'

export const aggregator = async (configs: IEngineConfig, getRateData: rateDataAggregatorType, openData: SwapAndOpenAggregatorType): Promise<any> => {
  const engine = new Engine(configs)
  await engine.initServices()
  const response = await engine.AGGREGATOR.getRateAndBuildTxSwapApi(getRateData, openData)
  return response
}
