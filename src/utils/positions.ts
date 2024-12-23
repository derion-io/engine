import { getAddress, hexDataSlice } from "ethers/lib/utils"
import { BigNumber } from "ethers"
import { formatPercentage, formatQ128, IEW, kx, NUM, powX128, rateFromHL, SHL, thousandsInt, WEI, xr } from "./helper"
import { BIG_E18, POOL_IDS } from "./constant"
import { FungiblePosition, SdkPool, SdkPools } from "../type"

const { A, B, C } = POOL_IDS

export type PositionView = {
  poolAddress: string
  side: number
  balance: BigNumber
  entryValueR: BigNumber
  entryValueU: BigNumber
  entryPrice: BigNumber
  currentPrice: BigNumber
  valueRLinear?: BigNumber
  valueRCompound?: BigNumber
  valueU?: BigNumber
  valueR: BigNumber
  deleveragePriceA: BigNumber
  deleveragePriceB: BigNumber
  leverage: number
  effectiveLeverage: number
  funding: number
  netPnL?: BigNumber
  simPnL?: {
    linear: BigNumber
    power: BigNumber
    powerBenefit: BigNumber
    funding: BigNumber
  }
}

export function calcPoolInfo(pool: SdkPool): any {
  if (!pool?.config || !pool?.view || !pool?.state) {
    throw new Error('missing pool data')
  }
  const { MARK, K, INTEREST_HL, PREMIUM_HL } = pool.config
  const { R, a, b } = pool.state
  const { rA, rB, rC, spot } = pool.view

  const xA = xr(K, R.shr(1), a)
  const xB = xr(-K, R.shr(1), b)
  const dgA = MARK.mul(WEI(xA)).div(BIG_E18)
  const dgB = MARK.mul(WEI(xB)).div(BIG_E18)

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
    dgA,
    dgB,
  }
}

export function calcPoolSide(
  pool: SdkPool,
  side: number,
): any {
  if (!pool?.config || !pool?.view || !pool?.state) {
    throw new Error('missing pool data')
  }
  const { K } = pool.config

  const poolInfo = calcPoolInfo(pool)
  const { sides, dgA, dgB } = poolInfo

  const exp = 2 // always Uniswap v3
  const ek = sides[side].k
  const leverage = K / 2
  const effectiveLeverage = Math.min(ek, K) / exp

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
  currentPriceR?: BigNumber,
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

  const rX = side == A ? rA : side == B ? rB : rC
  const sX = side == A ? sA : side == B ? sB : sC

  const valueR = rX.mul(balance).div(sX)
  const valueU = currentPriceR ? valueR.mul(currentPriceR).shr(128) : undefined

  const { leverage, effectiveLeverage, dgA, dgB, funding } = calcPoolSide(pool, side)

  const L =
    side == A ? NUM(leverage) :
    side == B ? -NUM(leverage) : 0
  
  const result: PositionView = {
    poolAddress,
    side,
    balance,
    leverage,
    effectiveLeverage,
    deleveragePriceA: dgA,
    deleveragePriceB: dgB,
    funding,
    entryPrice,
    currentPrice,
    entryValueR,
    entryValueU,
    valueR,
    valueU,
  }

  if (L != 0) {
    const priceRate = currentPrice.shl(128).div(entryPrice)
    const linearPriceRate = SHL(currentPrice.sub(entryPrice).mul(L).add(entryPrice), 128).div(entryPrice)
    result.valueRLinear = SHL(entryValueR.mul(linearPriceRate), -128)
    const powerPriceRate = powX128(priceRate, L)
    result.valueRCompound = SHL(entryValueR.mul(powerPriceRate), -128)

    if (entryValueR.gt(0)) {
      result.netPnL = SHL(valueR.sub(entryValueR), 128).div(entryValueR)
      result.simPnL = {
        linear: SHL(result.valueRLinear.sub(entryValueR), 128).div(entryValueR),
        power: SHL(result.valueRCompound.sub(entryValueR), 128).div(entryValueR),
        powerBenefit: SHL(result.valueRCompound.sub(result.valueRLinear), 128).div(entryValueR),
        funding: SHL(valueR.sub(result.valueRCompound), 128).div(entryValueR),
      }
    }
  }

  return result
}

export function formatPositionView(
  pv: PositionView
): any {
  const res: any = {
    name: `${pv.side == A ? 'Long' : pv.side == B ? 'Short' : 'LP'} x${pv.leverage}`,
    pool: pv.poolAddress,
    balance: thousandsInt(pv.balance.toString(), 6),
    entryPrice: formatQ128(pv.entryPrice),
    currentPrice: formatQ128(pv.currentPrice),
    entryValueR: thousandsInt(pv.entryValueR.toString(), 6),
    valueR: thousandsInt(pv.valueR.toString(), 6),
    entryValueU: thousandsInt(pv.entryValueU.toString(), 6),
    valueU: pv.valueU ? thousandsInt(pv.valueU.toString(), 6) : 'missing reserve token price',
    range: [formatQ128(pv.deleveragePriceB), formatQ128(pv.deleveragePriceA)],
    fundingRate: formatPercentage(pv.funding),
  }
  if (pv.netPnL) {
    res.netPnL = formatPercentage(formatQ128(pv.netPnL))
  }
  if (pv.simPnL) {
    res.simPnL = {
      linear: formatPercentage(formatQ128(pv.simPnL.linear)),
      power: formatPercentage(formatQ128(pv.simPnL.power)),
      powerBenefit: formatPercentage(formatQ128(pv.simPnL.powerBenefit)),
      fundingPaid: formatPercentage(formatQ128(pv.simPnL.funding)),
    }
  }
  return res
}