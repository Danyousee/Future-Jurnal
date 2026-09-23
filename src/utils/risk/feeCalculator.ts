/**
 * Unified Fee & Friction Calculator across Perpetual, Spot, Forex, and DEX markets.
 */

export interface FeeCalculationParams {
  positionValue: number;
  feeRate?: number; // percentage e.g. 0.055
  makerFeeRate?: number;
  takerFeeRate?: number;
  fundingRate?: number; // 8-hour rate e.g. 0.0001
  slippagePct?: number; // percentage e.g. 0.05
  gasFee?: number; // $ e.g. 8.50 for ETH
  networkFee?: number; // $ e.g. 0.50
  dexFeePct?: number; // % e.g. 0.30%
  priceImpactPct?: number; // % e.g. 0.10%
  spreadPips?: number;
  pipValuePerLot?: number;
  pipValue?: number;
  lots?: number;
  lotSize?: number;
  commissionPerLot?: number;
}

export interface FeeBreakdown {
  entryFee: number;
  exitFee: number;
  totalTradingFees: number;
  estimatedFundingCost: number;
  estimatedSlippageCost: number;
  gasCost: number;
  networkCost: number;
  totalOnChainFees: number;
  priceImpactCost: number;
  totalDEXCost: number;
  spreadCost: number;
  commissionCost: number;
  totalForexFriction: number;
  totalFriction: number;
}

export function calculateTradeFees(params: FeeCalculationParams): FeeBreakdown {
  const {
    positionValue = 0,
    feeRate = 0.055,
    makerFeeRate,
    takerFeeRate,
    fundingRate = 0,
    slippagePct = 0,
    gasFee = 0,
    networkFee = 0,
    dexFeePct,
    priceImpactPct = 0,
    spreadPips = 0,
    pipValuePerLot = 10,
    pipValue,
    lots = 0,
    lotSize,
    commissionPerLot = 0,
  } = params;

  const effectiveLots = lotSize !== undefined ? lotSize : lots;
  const effectivePipValue = pipValue !== undefined ? pipValue : pipValuePerLot;

  // 1. CEX / Perpetual Fees
  const effectiveFeeRate = dexFeePct !== undefined ? dexFeePct : feeRate;
  const rate = effectiveFeeRate / 100;
  const entryFee = positionValue * (takerFeeRate !== undefined ? takerFeeRate / 100 : rate);
  const exitFee = positionValue * (makerFeeRate !== undefined ? makerFeeRate / 100 : rate);
  const totalTradingFees = entryFee + exitFee;

  // 2. Slippage & Funding
  const estimatedSlippageCost = positionValue * (slippagePct / 100);
  const estimatedFundingCost = positionValue * Math.abs(fundingRate);

  // 3. DEX On-Chain Fees (round-trip gas & network priority fee)
  const gasCost = Math.max(0, gasFee) * 2; // round-trip entry + exit
  const networkCost = Math.max(0, networkFee) * 2;
  const totalOnChainFees = gasCost + networkCost;
  const priceImpactCost = positionValue * ((priceImpactPct || 0) / 100);
  const totalDEXCost = totalTradingFees + totalOnChainFees + priceImpactCost + estimatedSlippageCost;

  // 4. Forex Friction
  const spreadCost = spreadPips > 0 && effectiveLots > 0 ? spreadPips * effectivePipValue * effectiveLots : 0;
  const commissionCost = (commissionPerLot || 0) * effectiveLots * 2; // round-trip commission
  const totalForexFriction = spreadCost + commissionCost;

  // 5. Total Combined Friction
  const totalFriction = totalTradingFees + estimatedSlippageCost + estimatedFundingCost + totalOnChainFees + priceImpactCost + totalForexFriction;

  return {
    entryFee,
    exitFee,
    totalTradingFees,
    estimatedFundingCost,
    estimatedSlippageCost,
    gasCost,
    networkCost,
    totalOnChainFees,
    priceImpactCost,
    totalDEXCost,
    spreadCost,
    commissionCost,
    totalForexFriction,
    totalFriction,
  };
}
