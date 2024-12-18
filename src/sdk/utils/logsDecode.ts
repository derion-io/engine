// import { BigNumber, utils } from 'ethers'
// import { LogType } from '../../types'
// import {concat} from 'lodash'
// import {SDKResourceData} from '../type/type'
// import {getTopics, mergeTwoUniqSortedLogs} from '../../utils/helper'
// import {Profile} from '../../profile'
// const TOPICS = getTopics()

// const TOPICS_20 = [
//     ...TOPICS.Transfer,
//     ...TOPICS.Approval,
//   ]
  
//   const TOPICS_1155 = [
//     ...TOPICS.TransferSingle,
//     ...TOPICS.TransferBatch,
//     ...TOPICS.ApprovalForAll,
//   ]
// export const getResourceCached = ({account, logs, profile}:{account: string, logs: LogType[], profile: Profile}) => {
//   try {
//     const results: SDKResourceData = {
//       pools: {},
//       tokens: [],
//       swapLogs: [],
//       transferLogs: [],
//       bnaLogs: [],
//       poolGroups: {},
//     }
//     const eventAbi = profile.getAbi('Events')
//     const accountLogs = parseDdlLogs(
//       logs.filter((data: { topics: Array<string> }) => concat(...Object.values(TOPICS)).includes(data.topics[0])),
//       eventAbi
//     )

//     results.swapLogs = accountLogs.filter((log: any) => {
//       return log.address && TOPICS.Swap.includes(log.topics[0])
//     })
//     results.transferLogs = accountLogs.filter((log: any) => {
//       return log.address && TOPICS.Transfer.includes(log.topics[0])
//     })

//     results.bnaLogs = parseDdlLogs(
//       logs.filter((log: LogType) => {
//         const eventSig = log.topics[0]
//         if (TOPICS_20.includes(eventSig)) {
//           return true
//         }
//         if (log.address != profile.configs.derivable.token) {
//           return false
//         }
//         if (log.blockNumber < profile.configs.derivable.startBlock) {
//           return false
//         }
//         return TOPICS_1155.includes(eventSig)
//       }),
//       eventAbi
//     )

//     const ddlTokenTransferLogs = accountLogs.filter((log: any) => {
//       return (
//         log.address === profile.configs.derivable.token &&
//         log.blockNumber >= profile.configs.derivable.startBlock &&
//         (TOPICS.TransferSingle.includes(log.topics[0]) || TOPICS.TransferBatch.includes(log.topics[0]))
//       )
//     })

//     const poolAddresses = poolHasOpeningPosition(account, ddlTokenTransferLogs, profile)

//     // if (ddlLogsParsed && ddlLogsParsed.length > 0) {
//     //   const {tokens, pools, poolGroups} = await this.generatePoolData(ddlLogsParsed, transferLogsParsed, playMode)
//     //   results.tokens = [...tokens, ...results.tokens]
//     //   results.pools = pools
//     //   results.poolGroups = poolGroups
//     // }
//     // if (swapLogsParsed && swapLogsParsed.length > 0) {
//     //   results.swapLogs = swapLogsParsed
//     // }
//     // if (transferLogsParsed && transferLogsParsed.length > 0) {
//     //   results.transferLogs = transferLogsParsed
//     // }

//     // this.poolGroups = {...this.poolGroups, ...results.poolGroups}
//     // this.pools = {...this.pools, ...results.pools}
//     // this.tokens = [...this.tokens, ...results.tokens]
//     // this.swapLogs = [...this.swapLogs, ...results.swapLogs]
//     // this.transferLogs = [...this.transferLogs, ...results.transferLogs]

//     // return results

//     if (poolAddresses.length > 0) {
//       const { tokens, pools, poolGroups } = await this.generateData({
//         poolAddresses,
//         transferLogs: results.transferLogs,
//         playMode: false,
//       })
//       results.tokens = tokens
//       results.pools = pools
//       results.poolGroups = poolGroups
//     }

//     results.swapLogs = mergeTwoUniqSortedLogs(results.swapLogs, results.swapLogs)
//     results.transferLogs = mergeTwoUniqSortedLogs(results.transferLogs, results.transferLogs)
//     results.bnaLogs = mergeTwoUniqSortedLogs(results.bnaLogs, results.bnaLogs)

//     return results
//   } catch (error) {
//     throw error
//   }
// }


//  const poolHasOpeningPosition = (account: string, tokenTransferLogs: Array<LogType>, profile: Profile): Array<string> => {
//     const balances: { [id: string]: BigNumber } = {}
//     tokenTransferLogs.forEach((log) => {
//       if (log.blockNumber < profile.configs.derivable.startBlock) {
//         return
//       }
//       const { from, to } = log.args
//       const isBatch = !log.args.id
//       const ids = isBatch ? log.args.ids : [log.args.id]
//       // TODO: where is log.args.values?
//       const values = isBatch ? log.args['4'] : [log.args.value]
//       for (let i = 0; i < ids.length; ++i) {
//         const value = values[i]
//         const id = ids[i].toString()
//         if (from == account) {
//           balances[id] = balances[id] ? balances[id].sub(value) : bn(0).sub(value)
//           if (balances[id].isZero()) delete balances[id]
//         } else if (to == account) {
//           balances[id] = balances[id] ? balances[id].add(value) : value
//         }
//       }
//     })

//     // unpack id to get Pool address
//     return _.uniq(Object.keys(balances).map((id) => unpackId(bn(id)).p))
//   }

// const parseDdlLogs = (ddlLogs: any, abi: any): Array<LogType> => {
//   const eventInterface = new utils.Interface(abi)
//   return ddlLogs
//     .map((log: any) => {
//       try {
//         const parsedLog = eventInterface.parseLog(log)
//         return {
//           ...log,
//           ...parsedLog,
//         }
//       } catch (err) {
//         console.warn('Failed to parse log', err, log)
//       }
//       return undefined
//     })
//     .filter((log: any) => log != null)
// }
