import {BigNumber, ethers} from 'ethers'
import { Engine } from '../src/engine'
import { getTestConfigs } from './shared/testConfigs'
import {bn, getTopics, IEW} from '../src/utils/helper'
import {keyFromTokenId} from '../src/services/balanceAndAllowance'
import {LogType} from '../src/types'
import {POOL_IDS} from '../src/utils/constant'

const chainId = Number(process.env.CHAIN ?? 42161)
const wallet = process.env.WALLET ?? '0xD42d6d58F95A3DA9011EfEcA086200A64B266c10'


const testLocal = async () => {
  const configs = getTestConfigs(chainId)
  configs.scanApiKey = process.env['SCAN_API_KEY_' + chainId]
  const engine = new Engine(configs)
  await engine.initServices()

  await engine.RESOURCE.fetchResourceData(
    [],
    wallet,
  )

  // console.log({
  //   pools: engine.RESOURCE.pools,
  //   tokens: engine.RESOURCE.tokens,
  //   swapLogs: engine.RESOURCE.swapLogs,
  // })

  const currentPool = engine.RESOURCE.poolGroups['0x9E37cb775a047Ae99FC5A24dDED834127c4180cD']
  engine.setCurrentPool({
    ...currentPool,
  })

  const swapTxs = engine?.HISTORY.formatSwapHistory({
    tokens: engine.RESOURCE.tokens,
    transferLogs: JSON.parse(JSON.stringify(engine.RESOURCE.transferLogs)),
    swapLogs: JSON.parse(JSON.stringify(engine.RESOURCE.swapLogs)),
  })
  const TOPICS = getTopics()
  const transferLogs = engine.RESOURCE.bnaLogs.filter(log => TOPICS.TransferBatch.includes(log.topics[0]) || TOPICS.TransferSingle.includes(log.topics[0]))
  const swapLogs = engine.RESOURCE.swapLogs
  const mergeLogs: {[hash: string]:LogType[]} ={}
   // Add transfer logs to the map
  transferLogs.forEach(log => {
    if (!mergeLogs[log.transactionHash]) {
      mergeLogs[log.transactionHash] = [];
    }
    mergeLogs[log.transactionHash].push(log);
  });

  swapLogs.forEach(log => {
    if (!mergeLogs[log.transactionHash]) {
      mergeLogs[log.transactionHash] = [];
    }
    mergeLogs[log.transactionHash].push(log);
  });
  const POS_IDS = [POOL_IDS.A, POOL_IDS.B, POOL_IDS.C]
  Object.keys(mergeLogs).map(key => {
    const logs = mergeLogs[key]
    let transferAmount:{[key: string]: number} = {}
    let swapAmount: {[key: string]: number} = {}
    logs.map(log => {
      if(log.args.operator) {
        const values = log.args['4'];
        const key = keyFromTokenId(log.args.id)
        if(!transferAmount[key]) transferAmount[key] = 0
        if (log.args.to == wallet) {
          // console.log('[TRANFER] +', values?.toString())
          transferAmount[key] = transferAmount[key] + Number(values)
        } 
        if (log.args.from == wallet) {
          // console.log('[TRANFER] -', values?.toString())
          transferAmount[key] = transferAmount[key] - Number(values)
        }
      } else {
        const abi = engine.HISTORY.getSwapAbi(log.topics[0])
        const encodeData = ethers.utils.defaultAbiCoder.encode(abi, log.args)
        const formatedData = ethers.utils.defaultAbiCoder.decode(abi, encodeData)
  
        const { poolIn, poolOut, sideIn, sideOut, amountR, amountOut, amountIn, priceR, price } = formatedData
        
        const tokenInAddress = engine.HISTORY.getTokenAddressByPoolAndSide(poolIn, formatedData.sideIn)
        const tokenOutAddress = engine.HISTORY.getTokenAddressByPoolAndSide(poolOut, formatedData.sideOut)
      
        if (POS_IDS.includes(sideIn.toNumber())){
          // console.log('[SWAP] -', amountIn?.toString())
          if(!swapAmount[tokenInAddress]) swapAmount[tokenInAddress] = 0
          swapAmount[tokenInAddress] =  swapAmount[tokenInAddress] -  Number(amountIn)
        }
        if (POS_IDS.includes(sideOut.toNumber())){
          if(!swapAmount[tokenOutAddress]) swapAmount[tokenOutAddress] = 0

          // console.log('[SWAP] +', amountOut?.toString())
          swapAmount[tokenOutAddress] = swapAmount[tokenOutAddress] +  Number(amountOut)
        }
      }
    })
    const keys = Object.keys(swapAmount).filter(key => {return swapAmount[key] !== transferAmount[key]})
    if(keys.length > 0) {
        logs.map(log => {
          if(log.args.operator) return;
          const abi = engine.HISTORY.getSwapAbi(log.topics[0])
          const encodeData = ethers.utils.defaultAbiCoder.encode(abi, log.args)
          const formatedData = ethers.utils.defaultAbiCoder.decode(abi, encodeData)
          const { poolIn, poolOut, sideIn, sideOut,amountR, amountOut, amountIn, priceR, price } = formatedData
          console.log({
            ...formatedData,
            amountOut: amountOut.toString(),
            amountIn: amountIn.toString(),
            amountR: amountR.toString(),
            price: price.toString(),
            priceR: priceR.toString()
          })
        })
  
        console.log('------------------------------------------------')
        console.log('[HASH]', key)
        console.log('[SWAP]', swapAmount)
        console.log('[TRANFER]', transferAmount)
        console.log('------------------------------------------------')
    }
  })
  // const positions = engine?.HISTORY.generatePositions({
  //   tokens: engine.RESOURCE.tokens,
  //   logs: JSON.parse(JSON.stringify(engine.RESOURCE.swapLogs)),
  //   transferLogs
  // })

// const posMap = Object.keys(positions).map(poskey => {
//   const pos = positions[poskey]
//   return {
//     ...pos,
//     balanceForPriceR: IEW(pos.balanceForPriceR, 18),
//     balanceForPrice: IEW(pos.balanceForPrice, 18),
//     amountR: pos.amountR?.toString?.()

//   }
// })
//   console.table(posMap)
}

testLocal()
