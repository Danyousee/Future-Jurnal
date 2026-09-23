import { 
  CalculationResult, 
  RiskStatus, 
  RiskTier, 
  SpotDirection,
  SpotSizingMethod,
  SpotVenue,
  TradingPlan
} from '../../types';
import { formatCurrency, formatNumber } from './formatting';
import { calculateTradeFees } from './feeCalculator';

export interface SpotInputParams {
  accountBalance: number;
  venue?: SpotVenue; // 'CEX' | 'DEX'
  pair?: string;
  direction?: SpotDirection | 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  riskPercentage: number;
  maxCapital?: number;
  sizingMethod?: SpotSizingMethod;
  feeRate?: number; // % e.g. 0.055 or 0.10
  makerFeeRate?: number;
  takerFeeRate?: number;
  slippagePct?: number;
  plan?: TradingPlan;
}

/**
 * Spot Risk & Position Sizing Engine.
 * 
 * Core Design Principles:
 * 1. Zero Leverage / No Liquidation: Position value is capped by allocated capital or account balance.
 * 2. Strict Risk Sizing: Position Size ($) = Risk Amount / Stop Loss Distance %.
 * 3. Clear Separation: Capital Allocated vs. Maximum Risk are distinct.
 */
export function calculateSpotRisk(params: SpotInputParams): CalculationResult {
  const {
    accountBalance = 10000,
    venue = 'CEX',
    pair = 'BTC/USDT',
    direction: rawDirection = 'BUY',
    entryPrice = 0,
    stopLoss = 0,
    takeProfit = 0,
    riskPercentage = 1.0,
    maxCapital,
    sizingMethod = 'RISK_BASED',
    feeRate = 0.10,
    makerFeeRate,
    takerFeeRate,
    slippagePct = 0.05,
    plan,
  } = params;

  const direction: SpotDirection = (rawDirection === 'SHORT' || rawDirection === 'SELL') ? 'SELL' : 'BUY';
  const isBuy = direction === 'BUY';

  const effectiveBalance = Math.max(0, accountBalance || 0);
  const effectiveMaxCapital = (maxCapital !== undefined && maxCapital > 0)
    ? Math.min(maxCapital, effectiveBalance || maxCapital)
    : effectiveBalance;

  const validEntry = Math.max(0, entryPrice || 0);
  const validSL = Math.max(0, stopLoss || 0);
  const validTP = Math.max(0, takeProfit || 0);
  const validRiskPct = Math.max(0.01, Math.min(100, riskPercentage || 1));

  const warnings: string[] = [];
  let isApproved = true;

  if (effectiveBalance <= 0 || validEntry <= 0 || validSL <= 0) {
    return {
      tradingMode: 'SPOT',
      spotVenue: venue,
      marginRequired: 0,
      positionSize: 0,
      quantity: 0,
      riskAmount: 0,
      reward: 0,
      riskRewardRatio: 0,
      feeImpact: 0,
      entryFee: 0,
      exitFee: 0,
      estimatedFundingCost: 0,
      estimatedSlippageCost: 0,
      netProfit: 0,
      netLoss: 0,
      liquidationPrice: 0,
      distanceToLiquidationPct: 0,
      breakevenPrice: validEntry,
      priceRiskPercentage: 0,
      priceRewardPercentage: 0,
      riskStatus: 'Safe',
      riskTier: 'Conservative',
      riskStatusDetails: ['Enter balance, entry price, and stop loss to calculate spot position size.'],
      isLiqBeforeSL: false,
      maxAllowedPosition: effectiveMaxCapital,
      leverageAdjustedPosition: 0,
      stopLossDistance: 0,
      takeProfitDistance: 0,
      spot: {
        venue,
        capitalRequired: 0,
        capitalLimitReached: false,
        sizingMethod,
        maxCapital: effectiveMaxCapital,
        riskPerUnit: 0,
        potentialLoss: 0,
        potentialProfit: 0,
        breakEvenPrice: validEntry,
        breakEvenDistance: 0,
        tradingFees: 0,
        gasFee: 0,
        networkFee: 0,
        priceImpactCost: 0,
        slippageCost: 0,
        totalExecutionFees: 0,
      },
    };
  }

  // 1. Directional Stop Loss Checks
  let stopLossDistance = 0;
  let priceRiskPercentage = 0;

  if (isBuy) {
    if (validSL >= validEntry) {
      warnings.push('For BUY (Long), Stop Loss must be placed below Entry Price.');
      isApproved = false;
      stopLossDistance = Math.max(Number.MIN_VALUE, validEntry - validSL);
      priceRiskPercentage = (stopLossDistance / validEntry) * 100;
    } else {
      stopLossDistance = validEntry - validSL;
      priceRiskPercentage = (stopLossDistance / validEntry) * 100;
    }
  } else {
    // SELL / Short liquidation of spot asset
    if (validSL <= validEntry) {
      warnings.push('For SELL, Stop Loss must be placed above Entry Price.');
      isApproved = false;
      stopLossDistance = Math.max(Number.MIN_VALUE, validSL - validEntry);
      priceRiskPercentage = (stopLossDistance / validEntry) * 100;
    } else {
      stopLossDistance = validSL - validEntry;
      priceRiskPercentage = (stopLossDistance / validEntry) * 100;
    }
  }

  // 2. Take Profit Distance & Reward
  let takeProfitDistance = 0;
  let priceRewardPercentage = 0;
  if (validTP > 0) {
    if (isBuy) {
      if (validTP > validEntry) {
        takeProfitDistance = validTP - validEntry;
        priceRewardPercentage = (takeProfitDistance / validEntry) * 100;
      } else {
        warnings.push('For BUY, Take Profit must be above Entry Price.');
      }
    } else {
      if (validTP < validEntry) {
        takeProfitDistance = validEntry - validTP;
        priceRewardPercentage = (takeProfitDistance / validEntry) * 100;
      } else {
        warnings.push('For SELL, Take Profit must be below Entry Price.');
      }
    }
  }

  // 3. Position Sizing
  // Target risk is strictly determined by Balance × Risk %
  const targetRiskAmount = (effectiveBalance * validRiskPct) / 100;
  let quantity = 0;
  let positionValue = 0;
  let unconstrainedPositionSize = 0;
  let capitalLimitReached = false;

  if (validEntry > 0 && stopLossDistance > 0) {
    if (sizingMethod === 'RISK_BASED') {
      const unconstrainedQty = targetRiskAmount / stopLossDistance;
      unconstrainedPositionSize = unconstrainedQty * validEntry;

      if (effectiveMaxCapital > 0 && unconstrainedPositionSize > effectiveMaxCapital) {
        capitalLimitReached = true;
        quantity = effectiveMaxCapital / validEntry;
        positionValue = effectiveMaxCapital;
        warnings.push(
          `Capital limit reached: Position was capped to your available capital ($${formatCurrency(effectiveMaxCapital)}). Actual risk is reduced accordingly.`
        );
      } else {
        quantity = unconstrainedQty;
        positionValue = unconstrainedPositionSize;
      }
    } else {
      // CAPITAL_BASED sizing
      positionValue = effectiveMaxCapital;
      quantity = effectiveMaxCapital / validEntry;
      unconstrainedPositionSize = effectiveMaxCapital;
    }
  }

  // 4. Actual Risk & Potential Gross Loss/Reward
  const potentialLoss = stopLossDistance > 0 ? quantity * stopLossDistance : 0;
  const actualRiskAmount = potentialLoss > 0 ? potentialLoss : targetRiskAmount;
  const potentialProfit = takeProfitDistance > 0 ? quantity * takeProfitDistance : 0;
  const riskRewardRatio = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;

  // 5. Exchange Fees & Slippage
  const fees = calculateTradeFees({
    positionValue,
    feeRate,
    makerFeeRate,
    takerFeeRate,
    slippagePct,
  });

  const entryFee = fees.entryFee;
  const exitFee = fees.exitFee;
  const feeImpact = fees.totalTradingFees;
  const estimatedSlippageCost = fees.estimatedSlippageCost;

  const totalFriction = feeImpact + estimatedSlippageCost;
  const netProfit = Math.max(0, potentialProfit - totalFriction);
  const netLoss = potentialLoss + totalFriction;

  // Breakeven price calculation
  const feePctPerLeg = feeRate / 100;
  const slippageFactor = (slippagePct || 0) / 100;
  const totalCostFactor = feePctPerLeg * 2 + slippageFactor * 2;
  const breakevenPrice = isBuy
    ? validEntry * (1 + totalCostFactor)
    : validEntry * (1 - totalCostFactor);

  // Capital utilization & metrics
  const capitalAllocated = positionValue;
  const capitalUtilizationPct = effectiveBalance > 0 ? (capitalAllocated / effectiveBalance) * 100 : 0;
  const feeAsPctOfRisk = actualRiskAmount > 0 ? (feeImpact / actualRiskAmount) * 100 : 0;

  // Risk Tier & Status
  let riskTier: RiskTier = 'Conservative';
  if (validRiskPct > 5.0 || capitalUtilizationPct > 90) riskTier = 'Extreme';
  else if (validRiskPct > 2.0 || capitalUtilizationPct > 65) riskTier = 'High';
  else if (validRiskPct > 1.0 || capitalUtilizationPct > 40) riskTier = 'Elevated';

  let riskStatus: RiskStatus = 'Safe';
  if (!isApproved || validRiskPct > 5.0 || capitalUtilizationPct > 100) {
    riskStatus = 'Danger';
  } else if (validRiskPct > 2.0 || capitalUtilizationPct > 80 || feeAsPctOfRisk > 25) {
    riskStatus = 'High';
  }

  const riskStatusDetails: string[] = [...warnings];
  if (feeAsPctOfRisk > 20) {
    riskStatusDetails.push(`Fee drag is high (${feeAsPctOfRisk.toFixed(1)}% of planned risk). Tighten stops or use limit orders.`);
  }
  if (riskRewardRatio > 0 && riskRewardRatio < 1.0) {
    riskStatusDetails.push('Risk/Reward is below 1:1. Minimum 1:1.5 recommended.');
  }

  return {
    tradingMode: 'SPOT',
    spotVenue: venue,
    marginRequired: positionValue, // In spot, position value is 100% equity backed
    positionSize: positionValue,
    quantity,
    riskAmount: actualRiskAmount,
    reward: potentialProfit,
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
    feeImpact,
    entryFee,
    exitFee,
    estimatedFundingCost: 0,
    estimatedSlippageCost,
    netProfit,
    netLoss,
    liquidationPrice: 0, // Spot has no margin liquidation
    distanceToLiquidationPct: 100,
    breakevenPrice: Number(breakevenPrice.toFixed(4)),
    priceRiskPercentage: Number(priceRiskPercentage.toFixed(2)),
    priceRewardPercentage: Number(priceRewardPercentage.toFixed(2)),
    riskStatus,
    riskTier,
    riskStatusDetails,
    isLiqBeforeSL: false,
    maxAllowedPosition: effectiveMaxCapital,
    leverageAdjustedPosition: positionValue,
    stopLossDistance,
    takeProfitDistance,
    spot: {
      venue,
      capitalRequired: positionValue,
      capitalLimitReached,
      sizingMethod,
      maxCapital: effectiveMaxCapital,
      riskPerUnit: stopLossDistance,
      potentialLoss,
      potentialProfit,
      breakEvenPrice: Number(breakevenPrice.toFixed(4)),
      breakEvenDistance: Math.abs(breakevenPrice - validEntry),
      tradingFees: feeImpact,
      gasFee: 0,
      networkFee: 0,
      priceImpactCost: 0,
      slippageCost: estimatedSlippageCost,
      totalExecutionFees: totalFriction,
    },
  };
}
