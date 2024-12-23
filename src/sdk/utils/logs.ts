import { BigNumber } from 'ethers'
import { defaultAbiCoder, getAddress, hexDataSlice } from 'ethers/lib/utils'
import { FungiblePosition, LogType, Transition } from '../type'
import { BIG_0 } from './constant'

export const TOPICS: { [topic0: string]: string } = {
  ['0xba5c330f8eb505cee9b4eb08fecf34234a327cfb6f9e480f9d3b4dfae5b23e4d']: 'Position',       // Derion Pool
  ['0xf7462f2a86b97b14a4669ae97bf107eb47f1574e511038ba3bb2c0cace5bb227']: 'Swap',           // Derion Helper
  ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']: 'Transfer',       // 20, 721
  ['0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62']: 'TransferSingle', // 1155
  ['0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb']: 'TransferBatch',  // 1155
  ['0x4dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63']: 'LogFeeTransfer', // Polygon Native POL
}

export function extractPoolAddresses(txLogs: LogType[][], tokenDerion: string): string[] {
  const poolAddresses: { [key: string]: boolean } = {}
  for (const logs of txLogs) {
    for (const log of logs) {
      if (log.address != tokenDerion) {
        continue
      }
      const topic0 = log.topics?.[0]
      const type = TOPICS[topic0]
      if (type == 'TransferSingle') {
        const [id] = defaultAbiCoder.decode(["bytes32", "uint"], log.data)
        const poolAddress = getAddress(hexDataSlice(id, 12))
        poolAddresses[poolAddress] = true
      } else if (type == 'TransferBatch') {
        const [ids] = defaultAbiCoder.decode(["bytes32[]", "uint256[]"], log.data)
        for (let i = 0; i < ids.length; ++i) {
          const poolAddress = getAddress(hexDataSlice(ids[i], 12))
          poolAddresses[poolAddress] = true
        }
      }
    }
  }
  return Object.keys(poolAddresses)
}

export function processLogs(
  positions: { [id: string]: FungiblePosition },
  transitions: Transition[],
  balances: { [token: string]: BigNumber },
  txLogs: LogType[][],
  tokenDerion: string,
  account: string,
) {
  for (const logs of txLogs) {
    if (!logs.length) {
      continue
    }
    const transition: Transition = {
      txHash: logs[0].transactionHash,
      blockNumber: logs[0].blockNumber,
      timestamp: logs[0].timeStamp ? BigNumber.from(logs[0].timeStamp).toNumber() : undefined,
      netTransfers: {},
    }
    const bingo = logs.some(log => {
      if (log.address != tokenDerion) return false
      const topic0 = log.topics?.[0]
      const type = TOPICS[topic0]
      if (type != 'TransferSingle') return false
      const to = getAddress(hexDataSlice(log.topics[3], 12))
      if (account != to) return false
      return true
    })
    if (bingo) {
      for (const log of logs) {
        if (log.address != tokenDerion) {
          continue
        }
        const topic0 = log.topics?.[0]
        const type = TOPICS[topic0]
        if (type != 'TransferSingle') {
          // Derion does not use batch transfer
          continue
        }
        // const operator = getAddress(hexDataSlice(log.topics[1], 12))
        const from = getAddress(hexDataSlice(log.topics[2], 12))
        const to = getAddress(hexDataSlice(log.topics[3], 12))
        const [id, amount] = defaultAbiCoder.decode(["bytes32", "uint"], log.data)
        const poolAddress = getAddress(hexDataSlice(id, 12))
        // const side = BigNumber.from(hexDataSlice(id, 0, 12)).toNumber()
        // const posId = pool + '-' + side
        // console.log({from, to, id, amount})
        const pos = positions[id] = positions[id] ?? {
          id,
          balance: balances[id] ?? BIG_0,
          priceR: BIG_0,
          price: BIG_0,
          rPerBalance: BIG_0,
        }
        if (to == account) {
          let priceR = BIG_0
          logs.some(log => {
            const topic0 = log.topics?.[0]
            const type = TOPICS[topic0]
            if (type != 'Swap') {
              return false
            }
            // const payer = getAddress(hexDataSlice(log.topics[1], 12))
            // const recipient = getAddress(hexDataSlice(log.topics[2], 12))
            // const index = getAddress(hexDataSlice(log.topics[3], 12))
            const datas = defaultAbiCoder.decode(["address", "uint", "uint", "uint", "uint", "uint", "uint"], log.data)
            const sqrtPriceR = datas[6]
            priceR = sqrtPriceR.mul(sqrtPriceR).shr(128)
            return true
          })
          logs.some(log => {
            const topic0 = log.topics?.[0] ?? 'NOTHING'
            const type = TOPICS[topic0]
            if (type != 'Position') {
              return false
            }
            // const payer = getAddress(hexDataSlice(log.topics[1], 12))
            // const recipient = getAddress(hexDataSlice(log.topics[2], 12))
            // const index = getAddress(hexDataSlice(log.topics[3], 12))
            const [posId, amount, maturity, sqrtPrice, valueR] = defaultAbiCoder.decode(["bytes32", "uint", "uint", "uint", "uint"], log.data)
            if (posId != id) {
              return false
            }
            transition.maturity = maturity.toNumber()
            pos.maturity = maturity.toNumber()
            const newBalance = pos.balance.add(amount)
            if (sqrtPrice.gt(0)) {
              const price = sqrtPrice.mul(sqrtPrice).shr(128)
              transition.price = price
              if (pos.price.gt(0)) {
                pos.price = pos.price.mul(pos.balance).add(amount.mul(price)).div(newBalance)
              } else {
                pos.price = price
              }
              // if (!priceR.gt(0)) {
              //   const pool = pools[poolAddress]
              //   // special case for INDEX = TOKEN_R / STABLECOIN
              //   if (pool.config.TOKEN_R == pool.baseToken && stablecoins.includes(pool.quoteToken)) {
              //     priceR = price
              //   }
              // }
            }
            const posValueR = pos.rPerBalance.mul(pos.balance).shr(128)
            if (valueR.gt(0)) {
              transition.rPerAmount = valueR.shl(128).div(amount)
              pos.rPerBalance = posValueR.add(valueR).shl(128).div(newBalance)
            }
            if (priceR.gt(0)) {
              transition.priceR = priceR
              if (valueR.gt(0)) {
                if (posValueR.gt(0)) {
                  pos.priceR = pos.priceR.mul(posValueR).add(priceR.mul(valueR)).div(posValueR.add(valueR))
                } else {
                  pos.priceR = priceR
                }
              }
            }
            return true
          })
        }
      }
    }
    const _applyTransfer = (token: string, from: string, to: string, amount: BigNumber) => {
      if (!amount?.gt(0)) {
        return
      }
      if (bingo) {
        if (from == account) {
          transition.netTransfers[token] = (transition.netTransfers[token] ?? BIG_0).sub(amount)
        }
        if (to == account) {
          transition.netTransfers[token] = (transition.netTransfers[token] ?? BIG_0).add(amount)
        }
        if (transition.netTransfers[token].isZero()) {
          delete transition.netTransfers[token]
        }
      }
      if (to == account) {
        balances[token] = (balances[token] ?? BIG_0).add(amount)
      }
      if (from == account) {
        balances[token] = (balances[token] ?? BIG_0).sub(amount)
      }
      if ([from, to].includes(account) && positions[token]) {
        positions[token].balance = balances[token]
      }
    }
    for (const log of logs) {
      const topic0 = log.topics?.[0]
      const type = TOPICS[topic0]
      if (type == 'Transfer' && log.topics?.length == 3) {
        // ERC20
        const token = getAddress(log.address)
        const from = getAddress(hexDataSlice(log.topics[1], 12))
        const to = getAddress(hexDataSlice(log.topics[2], 12))
        const amount = BigNumber.from(log.data)
        _applyTransfer(token, from, to, amount)
      } else if (type == 'TransferSingle') {
        // ERC1155
        const from = getAddress(hexDataSlice(log.topics[2], 12))
        const to = getAddress(hexDataSlice(log.topics[3], 12))
        const [id, amount] = defaultAbiCoder.decode(["bytes32", "uint"], log.data)
        _applyTransfer(id, from, to, amount)
      } else if (type == 'TransferBatch') {
        // ERC1155
        const from = getAddress(hexDataSlice(log.topics[2], 12))
        const to = getAddress(hexDataSlice(log.topics[3], 12))
        const [ids, amounts] = defaultAbiCoder.decode(["bytes32[]", "uint256[]"], log.data)
        for (let i = 0; i < ids.length; ++i) {
          _applyTransfer(ids[i], from, to, amounts[i])
        }
      }
    }
    if (Object.keys(transition.netTransfers).length) {
      transitions.push(transition)
    }
  }
}
