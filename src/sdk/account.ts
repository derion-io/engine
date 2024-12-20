import { Signer } from 'ethers'
import { Profile } from '../profile'
import { Transition, PositionEntry } from '../services/history'
import { LogType } from '../types'
import { processLogs } from './utils/logs'

export class Account {
  profile: Profile
  address: string
  signer?: Signer
  blockNumber: number = 0
  logIndex: number = 0
  positions: { [id: string]: PositionEntry } = {}
  transitions: Transition[] = []

  constructor(profile: Profile, address: string, signer?: Signer) {
    this.profile = profile
    this.address = address
    this.signer = signer
  }

  processLogs = async (txLogs: LogType[][]) => {
    txLogs = txLogs.filter(logs => logs.some(log =>
      log.blockNumber > this.blockNumber ||
      (log.blockNumber == this.blockNumber && log.logIndex > this.logIndex)
    ))
    if (!txLogs.length) {
      return
    }
    
    processLogs(
      this.positions,
      this.transitions,
      txLogs,
      this.profile.configs.derivable.token,
      this.address,
    )
    const lastTx = txLogs[txLogs.length-1]
    const lastLog = lastTx[lastTx.length-1]
    this.blockNumber = lastLog.blockNumber
    this.logIndex = lastLog.logIndex
  }

  // importPositions = async (ids: string[]) => {}
}
