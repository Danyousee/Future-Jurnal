import { 
  CalculatorState, 
  CalculationResult, 
  RiskStatus, 
  RiskTier, 
  TradingPlan, 
  TradePlanCheckResult 
} from '../../types';
import { formatCurrency, formatNumber } from './formatting';
import { calculateTradeFees } from './feeCalculator';

export interface PerpetualInputParams {
  accountBalance: number;
  pair?: string;
  direction?: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  riskPercentage: number;
  leverage?: number;
  marginMode?: 'ISOLATED' | 'CROSS';
  feeRate?: number; // % e.g. 0.055
  makerFeeRate?: number; // % e.g. 0.02
  takerFeeRate?: number; // % e.g. 0.055
  slippagePct?: number; // % e.g. 0.05
  maintenanceMarginPct?: number; // % e.g. 0.5 MMR
  estimatedFundingRate?: number; // % e.g. 0.01 per 8h
  plan?: TradingPlan;
}

/**
 * Perpetual / Futures Risk & Position Sizing Engine.
 * 
 * Mathematical Invariant:
 * Risk is strictly determined by: Account Balance × Risk %.
 * Leverage does NOT increase allowed risk—it strictly affects margin requirement,
 * borrowing exposure, and liquidation distance.
 * 
 * Sizing Formula:
 * Position Size ($ Notional) = Risk Amount / Stop Loss Distance %
 * Contract Quantity = Position Size / Entry Price
 * Margin Required = Position Size / Leverage
 */
export function calculatePerpetualRisk(
  state: CalculatorState | PerpetualInputParams,
  plan?: TradingPlan
): CalculationResult {
  const {
    accountBalance = 10000,
    direction = 'LONG',
    entryPrice = 0,
    stopLoss = 0,
    takeProfit = 0,
    riskPercentage = 1.0,
    feeRate = 0.055,
    makerFeeRate,
    takerFeeRate,
    leverage = 10,
    marginMode = 'ISOLATED',
    slippagePct = 0.05,
    maintenanceMarginPct = 0.5,
    estimatedFundingRate = 0.01,
  } = state;

  const validBalance = Math.max(0, accountBalance || 0);
  const validEntry = Math.max(0, entryPrice || 0);
  const validSL = Math.max(0, stopLoss || 0);
  const validTP = Math.max(0, takeProfit || 0);
  const validLeverage = Math.max(1, leverage || 1);
  const validRiskPct = Math.max(0.01, Math.min(100, riskPercentage || 1));
  const mmr = Math.max(0.001, (maintenanceMarginPct || 0.5) / 100);

  // Fallback when required inputs are not yet set
  if (validBalance <= 0 || validEntry <= 0 || validSL <= 0) {
    return {
      tradingMode: 'PERPETUAL',
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
      riskStatusDetails: ['Enter balance, entry price, and stop loss to calculate perpetual position size.'],
      isLiqBeforeSL: false,
      maxAllowedPosition: validBalance * validLeverage,
      leverageAdjustedPosition: 0,
      stopLossDistance: 0,
      takeProfitDistance: 0,
    };
  }

  // 1. Calculate Stop Loss Distance
  let priceDistance = 0;
  let priceRiskPct = 0;
  const isInvalidDirection =
    (direction === 'LONG' && validSL >= validEntry) ||
    (direction === 'SHORT' && validSL <= validEntry);

  if (direction === 'LONG') {
    priceDistance = Math.max(Number.MIN_VALUE, validEntry - validSL);
    priceRiskPct = (priceDistance / validEntry) * 100;
  } else {
    priceDistance = Math.max(Number.MIN_VALUE, validSL - validEntry);
    priceRiskPct = (priceDistance / validEntry) * 100;
  }

  // 2. Risk Amount = Account Balance × Risk % (capped at Account Balance)
  const riskAmount = Math.min(validBalance, (validBalance * validRiskPct) / 100);

  // 3. Position Size ($ Notional USDT) = Risk Amount / Price Distance %
  const positionSize = priceRiskPct > 0 ? riskAmount / (priceRiskPct / 100) : 0;
  const quantity = validEntry > 0 ? positionSize / validEntry : 0;

  // 4. Margin Required = Position Value / Leverage
  const marginRequired = positionSize / validLeverage;
  const leverageAdjustedPosition = marginRequired * validLeverage;
  const maxAllowedPosition = validBalance * validLeverage;

  // 5. Take Profit & Potential Gross Reward
  let reward = 0;
  let priceRewardPct = 0;
  let tpDistance = 0;
  if (validTP > 0) {
    if (direction === 'LONG' && validTP > validEntry) {
      tpDistance = validTP - validEntry;
      priceRewardPct = (tpDistance / validEntry) * 100;
      reward = quantity * tpDistance;
    } else if (direction === 'SHORT' && validTP < validEntry) {
      tpDistance = validEntry - validTP;
      priceRewardPct = (tpDistance / validEntry) * 100;
      reward = quantity * tpDistance;
    }
  }

  const riskRewardRatio = riskAmount > 0 && reward > 0 ? reward / riskAmount : 0;

  // 6. Fees, Slippage & Funding Friction
  const fees = calculateTradeFees({
    positionValue: positionSize,
    feeRate,
    makerFeeRate,
    takerFeeRate,
    fundingRate: (estimatedFundingRate || 0) / 100,
    slippagePct,
  });

  const entryFee = fees.entryFee;
  const exitFee = fees.exitFee;
  const feeImpact = fees.totalTradingFees;
  const estimatedSlippageCost = fees.estimatedSlippageCost;
  const estimatedFundingCost = fees.estimatedFundingCost;

  // Net Profit & Net Loss
  const netProfit = Math.max(0, reward - feeImpact - estimatedSlippageCost - estimatedFundingCost);
  const netLoss = riskAmount + entryFee + exitFee + estimatedSlippageCost;

  // Breakeven price calculation
  const roundTripCostFactor = (feeRate / 100) * 2 + ((slippagePct || 0) / 100) * 2;
  const breakevenPrice = direction === 'LONG' 
    ? validEntry * (1 + roundTripCostFactor)
    : validEntry * (1 - roundTripCostFactor);

  // 7. Estimated Liquidation Price Calculation
  let liquidationPrice = 0;
  let distanceToLiquidationPct = 0;

  if (marginMode === 'ISOLATED') {
    if (direction === 'LONG') {
      liquidationPrice = validEntry * (1 - (1 / validLeverage) + mmr);
      if (liquidationPrice < 0) liquidationPrice = 0;
      distanceToLiquidationPct = validEntry > 0 ? ((validEntry - liquidationPrice) / validEntry) * 100 : 0;
    } else {
      liquidationPrice = validEntry * (1 + (1 / validLeverage) - mmr);
      distanceToLiquidationPct = validEntry > 0 ? ((liquidationPrice - validEntry) / validEntry) * 100 : 0;
    }
  } else {
    // Cross Margin
    if (quantity > 0) {
      if (direction === 'LONG') {
        liquidationPrice = (validEntry * quantity - validBalance) / (quantity * (1 - mmr));
        if (liquidationPrice < 0) liquidationPrice = 0;
        distanceToLiquidationPct = validEntry > 0 ? ((validEntry - liquidationPrice) / validEntry) * 100 : 0;
      } else {
        liquidationPrice = (validEntry * quantity + validBalance) / (quantity * (1 + mmr));
        distanceToLiquidationPct = validEntry > 0 ? ((liquidationPrice - validEntry) / validEntry) * 100 : 0;
      }
    }
  }

  // Check if liquidation occurs before stop loss
  let isLiqBeforeSL = false;
  if (direction === 'LONG') {
    if (liquidationPrice > 0 && liquidationPrice >= validSL) {
      isLiqBeforeSL = true;
    }
  } else {
    if (liquidationPrice > 0 && liquidationPrice <= validSL) {
      isLiqBeforeSL = true;
    }
  }

  // Risk Tier & Status
  let riskTier: RiskTier = 'Conservative';
  const marginUsagePct = validBalance > 0 ? (marginRequired / validBalance) * 100 : 0;

  if (isLiqBeforeSL || validLeverage > 30 || marginUsagePct > 75 || validRiskPct > 5 || distanceToLiquidationPct < 4) {
    riskTier = 'Extreme';
  } else if (validLeverage > 15 || marginUsagePct > 50 || validRiskPct > 3 || distanceToLiquidationPct < 8) {
    riskTier = 'High';
  } else if (validLeverage > 5 || marginUsagePct > 25 || validRiskPct > 1.5 || distanceToLiquidationPct < 15) {
    riskTier = 'Elevated';
  } else {
    riskTier = 'Conservative';
  }

  const riskStatusDetails: string[] = [];
  let riskStatus: RiskStatus = 'Safe';

  if (isInvalidDirection) {
    riskStatus = 'Danger';
    riskStatusDetails.push(
      direction === 'LONG'
        ? 'Stop Loss must be placed strictly below Entry Price for a Long position.'
        : 'Stop Loss must be placed strictly above Entry Price for a Short position.'
    );
  }

  if (isLiqBeforeSL) {
    riskStatus = 'Danger';
    riskStatusDetails.push(
      `LIQUIDATION HAZARD: Estimated liquidation price ($${formatNumber(liquidationPrice)}) is reached BEFORE your Stop Loss ($${formatNumber(validSL)}). Lower leverage or allocate more margin.`
    );
  }

  if (marginRequired > validBalance) {
    riskStatus = 'Danger';
    riskStatusDetails.push(
      `Insufficient Margin: Required margin ($${formatCurrency(marginRequired)}) exceeds total account balance ($${formatCurrency(validBalance)}).`
    );
  } else if (marginUsagePct > 70) {
    if (riskStatus !== 'Danger') riskStatus = 'High';
    riskStatusDetails.push(`High Margin Exposure: Using ${marginUsagePct.toFixed(1)}% of account balance.`);
  }

  if (validRiskPct > 5) {
    riskStatus = 'Danger';
    riskStatusDetails.push(`Excessive Risk: Risking ${validRiskPct}% of account equity per trade.`);
  } else if (validRiskPct > 2.5) {
    if (riskStatus !== 'Danger') riskStatus = 'High';
    riskStatusDetails.push(`Above Benchmark Risk: ${validRiskPct}% exceeds recommended 1–2% standard.`);
  }

  if (validLeverage >= 50) {
    if (riskStatus !== 'Danger') riskStatus = 'High';
    riskStatusDetails.push(`Ultra-High Leverage: ${validLeverage}x increases sensitivity to market wicks.`);
  }

  if (validTP > 0 && riskRewardRatio > 0 && riskRewardRatio < 1.5) {
    riskStatusDetails.push(`Sub-optimal R:R: 1:${riskRewardRatio.toFixed(2)} is below recommended 1:1.5+ standard.`);
  }

  if (riskStatusDetails.length === 0) {
    riskStatus = 'Safe';
    riskStatusDetails.push('Healthy position parameters aligned with disciplined perpetual risk management.');
  }

  // Plan validation
  let planValidation: TradePlanCheckResult | undefined;
  if (plan) {
    const violations: string[] = [];
    const warnings: string[] = [];
    const passedRules: string[] = [];

    if (validRiskPct > plan.maxRiskPerTrade) {
      violations.push(`Risk per trade (${validRiskPct}%) exceeds plan maximum of ${plan.maxRiskPerTrade}%.`);
    } else {
      passedRules.push(`Risk per trade (${validRiskPct}%) within ${plan.maxRiskPerTrade}% limit.`);
    }

    if (validLeverage > plan.maxLeverage) {
      violations.push(`Leverage (${validLeverage}x) exceeds plan maximum of ${plan.maxLeverage}x.`);
    } else {
      passedRules.push(`Leverage (${validLeverage}x) within ${plan.maxLeverage}x ceiling.`);
    }

    if (plan.requireStopLoss && validSL <= 0) {
      violations.push('Stop-Loss is mandatory according to your Trading Plan.');
    }

    if (plan.requireTakeProfit && validTP <= 0) {
      violations.push('Take-Profit target is required by your Trading Plan.');
    }

    if (riskRewardRatio > 0 && riskRewardRatio < plan.minRiskRewardRatio) {
      violations.push(`R:R (1:${riskRewardRatio.toFixed(2)}) is below plan minimum of 1:${plan.minRiskRewardRatio}.`);
    }

    planValidation = {
      isCompliant: violations.length === 0,
      violations,
      warnings,
      passedRules,
    };
  }

  return {
    tradingMode: 'PERPETUAL',
    marginRequired,
    positionSize,
    quantity,
    riskAmount,
    reward,
    riskRewardRatio,
    feeImpact,
    entryFee,
    exitFee,
    estimatedFundingCost,
    estimatedSlippageCost,
    netProfit,
    netLoss,
    liquidationPrice,
    distanceToLiquidationPct,
    breakevenPrice,
    priceRiskPercentage: priceRiskPct,
    priceRewardPercentage: priceRewardPct,
    riskStatus,
    riskTier,
    riskStatusDetails,
    isLiqBeforeSL,
    maxAllowedPosition,
    leverageAdjustedPosition,
    stopLossDistance: priceDistance,
    takeProfitDistance: tpDistance,
    planValidation,
  };
}
