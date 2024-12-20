import { getAddress, hexDataSlice } from "ethers/lib/utils"
import { PositionState, SdkPool, SdkPools } from "../../types"
import { BigNumber } from "ethers"
import { BIG_0, BIG_E18, formatQ128, IEW, kx, NUM, powX128, rateFromHL, SHL, WEI, xr } from "../../utils/helper"
import { POOL_IDS } from "../../utils/constant"
import { FungiblePosition } from "../../services/history"

const { A, B, C } = POOL_IDS

export type PositionView = {
  poolAddress: string
  pool: SdkPool
  side: number
  balance: BigNumber
  entryValueR: BigNumber
  entryValueU: BigNumber
  entryPrice: BigNumber
  valueRLinear?: BigNumber
  valueRCompound?: BigNumber
  valueU: BigNumber
  valueR: BigNumber
  currentPrice: BigNumber
  dgA: BigNumber
  dgB: BigNumber
  leverage: number
  effectiveLeverage: number
  funding: number
}

export function calcPoolInfo(pool: SdkPool): any {
  if (!pool?.config || !pool?.view || !pool?.state) {
    throw new Error('missing pool data')
  }
  const { MARK, K, INTEREST_HL, PREMIUM_HL } = pool.config
  const { R, a, b } = pool.state
  const { rA, rB, rC, spot } = pool.view
  const exp = 2 // only Uniswap v3
  const sides = {
    [A]: {} as any,
    [B]: {} as any,
    [C]: {} as any,
  }
  sides[A].k = Math.min(K, kx(K, R, a, spot, MARK))
  sides[B].k = Math.min(K, kx(-K, R, b, spot, MARK))
  sides[C].k = Number(
    IEW(rA.mul(WEI(sides[A].k))
      .add(rB.mul(WEI(sides[B].k)))
      .div(rA.add(rB)))
  )

  const interestRate = rateFromHL(INTEREST_HL, K)
  const maxPremiumRate = rateFromHL(PREMIUM_HL, K)
  if (maxPremiumRate > 0) {
    if (rA.gt(rB)) {
      const rDiff = rA.sub(rB)
      const givingRate = rDiff.mul(WEI(maxPremiumRate)).mul(rA.add(rB)).div(R)
      sides[A].premium = Number(IEW(givingRate.div(rA)))
      sides[B].premium = -Number(IEW(givingRate.div(rB)))
      sides[C].premium = 0
    } else if (rB.gt(rA)) {
      const rDiff = rB.sub(rA)
      const givingRate = rDiff.mul(WEI(maxPremiumRate)).mul(rA.add(rB)).div(R)
      sides[B].premium = Number(IEW(givingRate.div(rB)))
      sides[A].premium = -Number(IEW(givingRate.div(rA)))
      sides[C].premium = 0
    } else {
      sides[A].premium = 0
      sides[B].premium = 0
      sides[C].premium = 0
    }
  }

  // decompound the interest
  for (const side of [A, B]) {
    sides[side].interest = (interestRate * K) / sides[side].k
  }
  sides[C].interest = Number(IEW(rA.add(rB).mul(WEI(interestRate)).div(rC)))

  return {
    sides,
    interestRate,
    maxPremiumRate,
  }
}

export function calcPoolSide(
  pool: SdkPool,
  side: number,
): any {
  if (!pool?.config || !pool?.view || !pool?.state) {
    throw new Error('missing pool data')
  }
  const { MARK, K } = pool.config
  const { a, b, R } = pool.state

  const poolInfo = calcPoolInfo(pool)
  const { sides } = poolInfo

  const exp = 2 // always Uniswap v3
  const leverage = K / exp
  const ek = sides[side].k
  const effectiveLeverage = Math.min(ek, K) / exp

  const xA = xr(K, R.shr(1), a)
  const xB = xr(-K, R.shr(1), b)
  const dgA = MARK.mul(WEI(xA)).div(BIG_E18)
  const dgB = MARK.mul(WEI(xB)).div(BIG_E18)

  const interest = sides[side].interest
  const premium = sides[side].premium
  const funding = interest + premium

  return {
    leverage,
    effectiveLeverage,
    dgA,
    dgB,
    interest,
    premium,
    funding,
  }
}

export function calcPositionState(
  position: FungiblePosition,
  pools: SdkPools,
  currentPriceR: BigNumber,
  balance = position.balance,
): PositionView {
  const { id, price, priceR, rPerBalance, maturity } = position
  const poolAddress = getAddress(hexDataSlice(id, 12))
  const side = BigNumber.from(hexDataSlice(id, 0, 12)).toNumber()
  // check for position with entry
  const pool = pools[poolAddress]
  if (!pool?.view || !pool?.state) {
    throw new Error('missing pool state')
  }
  const { spot, rA, rB, rC, sA, sB, sC } = pool.view
  // TODO: OPEN_RATE?

  const currentPrice = spot.mul(spot).shr(128)
  const entryPrice = price
  const entryValueR = balance.mul(rPerBalance).shr(128)
  const entryValueU = entryValueR.mul(priceR).shr(128)

  const rX = side == POOL_IDS.A ? rA : side == POOL_IDS.B ? rB : rC
  const sX = side == POOL_IDS.A ? sA : side == POOL_IDS.B ? sB : sC

  const valueR = rX.mul(balance).div(sX)
  const valueU = valueR.mul(currentPriceR).shr(128)

  const { leverage, effectiveLeverage, dgA, dgB, funding } = calcPoolSide(pool, side)

  const L =
    side == POOL_IDS.A ? NUM(leverage) :
    side == POOL_IDS.B ? -NUM(leverage) : 0

  let valueRLinear
  let valueRCompound
  if (L != 0) {
    const priceRate = currentPrice.shl(128).div(entryPrice)
    const linearPriceRate = SHL(currentPrice.sub(entryPrice).mul(L).add(entryPrice), 128).div(entryPrice)
    valueRLinear = SHL(entryValueR.mul(linearPriceRate), -128)
    const powerPriceRate = powX128(priceRate, L)
    valueRCompound = SHL(entryValueR.mul(powerPriceRate), -128)

    if (entryValueR.gt(0)) {
      const pnl = SHL(valueR.sub(entryValueR), 128).div(entryValueR)
      const simulatedPnL = {
        linear: SHL(valueRLinear.sub(entryValueR), 128).div(entryValueR),
        power: SHL(valueRCompound.sub(entryValueR), 128).div(entryValueR),
        powerToLinear: SHL(valueRCompound.sub(valueRLinear), 128).div(entryValueR),
        funding: SHL(valueR.sub(valueRCompound), 128).div(entryValueR),
      }
    }
  }

  return {
    poolAddress,
    side,
    pool,
    balance,
    leverage,
    effectiveLeverage,
    dgA,
    dgB,
    funding,
    entryPrice,
    currentPrice,
    entryValueR,
    entryValueU,
    valueRLinear,
    valueRCompound,
    valueR,
    valueU,
  }
}

export function formatPositionView(
  pv: PositionView
): any {
  return {
    entryPrice: formatQ128(pv.entryPrice),
    currentPrice: formatQ128(pv.currentPrice),
    range: formatQ128(pv.dgB) + '-' + formatQ128(pv.dgA),
  }
}