import {LogType, PoolsType, PoolType, TokenType} from "../../types"

export type SDKResourceData = {
  pools: PoolsType
  tokens: Array<TokenType>
  swapLogs: Array<LogType>
  transferLogs: Array<LogType>
  bnaLogs: Array<LogType>
  poolGroups: any
}
