import { 
  CalculationResult, 
  RiskStatus, 
  RiskTier, 
  TradeDirection 
} from '../types';

export const COMMON_FOREX_PAIRS = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CHF',
  'AUD/USD',
  'USD/CAD',
  'NZD/USD',
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY',
  'XAU/USD', // Gold
];

export const FOREX_LEVERAGE_PRESETS = [30, 50, 100, 200, 500];

export function getStandardPipSize(pair: string): number {
  const clean = pair.toUpperCase().replace(/\s+/g, '');
  if (clean.includes('JPY')) return 0.01;
  if (clean.includes('XAU') || clean.includes('GOLD')) return 0.10;
  return 0.0001;
}

export function getStandardLotUnits(pair: string): number {
  const clean = pair.toUpperCase().replace(/\s+/g, '');
  if (clean.includes('XAU') || clean.includes('GOLD')) return 100; // 100 oz of gold
  return 100000; // 100,000 currency units
}

export function getDefaultPipValue(pair: string, accountCurrency: string = 'USD'): number {
  // Standard 1.00 lot pip value
  const clean = pair.toUpperCase().replace(/\s+/g, '');
  if (clean.includes('XAU')) return 10; // $0.10 * 100 oz = $10 per pip
  // Standard USD-quote pairs (EUR/USD, GBP/USD, AUD/USD, NZD/USD) = $10/pip
  return 10;
}

export interface ForexInputParams {
  accountBalance: number;
  accountCurrency?: string;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPercentage: number;
  leverage?: number;
  pipSize?: number;
  pipValuePerLot?: number;
  standardLotUnits?: number;
  spreadPips?: number;
  commissionPerLot?: number;
}

/**
 * Calculates Forex Risk, Lot Sizing, Pips, and Margin Requirement.
 * Models standard/mini/micro lot breakdown, pip value scaling, spread impact,
 * and broker margin requirements without inappropriate crypto liquidation equations.
 */
export function calculateForexRisk(params: ForexInputParams): CalculationResult {
  const {
    accountBalance = 10000,
    accountCurrency = 'USD',
    pair = 'EUR/USD',
    direction = 'LONG',
    entryPrice = 0,
    stopLoss = 0,
    takeProfit = 0,
    riskPercentage = 1.0,
    leverage = 100,
    pipSize = getStandardPipSize(pair),
    pipValuePerLot = getDefaultPipValue(pair, accountCurrency),
    standardLotUnits = getStandardLotUnits(pair),
    spreadPips = 1.0,
    commissionPerLot = 0,
  } = params;

  const effectiveBalance = Math.max(0, accountBalance);
  const effectiveLeverage = Math.max(1, leverage || 100);
  const effectivePipSize = pipSize > 0 ? pipSize : getStandardPipSize(pair);
  const effectivePipValue = pipValuePerLot > 0 ? pipValuePerLot : 10;

  const warnings: string[] = [];
  let isApproved = true;

  if (effectiveBalance <= 0) {
    warnings.push('Account balance must be greater than zero.');
    isApproved = false;
  }
  if (entryPrice <= 0) {
    warnings.push('Entry price must be greater than zero.');
    isApproved = false;
  }

  // Directional & Stop Loss Checks
  let stopLossDistance = 0;
  let stopLossPips = 0;
  let priceRiskPercentage = 0;

  if (entryPrice > 0 && stopLoss > 0) {
    if (direction === 'LONG') {
      if (stopLoss >= entryPrice) {
        warnings.push('For LONG positions, Stop Loss must be placed below the Entry Price.');
        isApproved = false;
      } else {
        stopLossDistance = entryPrice - stopLoss;
        stopLossPips = effectivePipSize > 0 ? stopLossDistance / effectivePipSize : 0;
        priceRiskPercentage = (stopLossDistance / entryPrice) * 100;
      }
    } else {
      if (stopLoss <= entryPrice) {
        warnings.push('For SHORT positions, Stop Loss must be placed above the Entry Price.');
        isApproved = false;
      } else {
        stopLossDistance = stopLoss - entryPrice;
        stopLossPips = effectivePipSize > 0 ? stopLossDistance / effectivePipSize : 0;
        priceRiskPercentage = (stopLossDistance / entryPrice) * 100;
      }
    }
  } else if (stopLoss <= 0) {
    warnings.push('Stop Loss is required to calculate Forex lot size and risk.');
    isApproved = false;
  }

  // Take Profit Checks
  let takeProfitDistance = 0;
  let takeProfitPips = 0;
  let priceRewardPercentage = 0;

  if (entryPrice > 0 && takeProfit > 0) {
    if (direction === 'LONG') {
      if (takeProfit > entryPrice) {
        takeProfitDistance = takeProfit - entryPrice;
        takeProfitPips = effectivePipSize > 0 ? takeProfitDistance / effectivePipSize : 0;
        priceRewardPercentage = (takeProfitDistance / entryPrice) * 100;
      } else {
        warnings.push('For LONG positions, Take Profit must be above the Entry Price.');
      }
    } else {
      if (takeProfit < entryPrice) {
        takeProfitDistance = entryPrice - takeProfit;
        takeProfitPips = effectivePipSize > 0 ? takeProfitDistance / effectivePipSize : 0;
        priceRewardPercentage = (takeProfitDistance / entryPrice) * 100;
      } else {
        warnings.push('For SHORT positions, Take Profit must be below the Entry Price.');
      }
    }
  }

  // Target Risk Amount
  const riskAmount = (effectiveBalance * Math.max(0, riskPercentage)) / 100;

  // Lot Size Calculation
  // Formula: Lot Size = Risk Amount / (Stop Loss Pips * Pip Value per Standard Lot)
  let rawLotSize = 0;
  if (stopLossPips > 0 && effectivePipValue > 0) {
    rawLotSize = riskAmount / (stopLossPips * effectivePipValue);
  }

  // Professional Forex lot sizing with micro-lot precision (0.01)
  const lotSize = Math.max(0, Number(rawLotSize.toFixed(2)));
  const units = lotSize * standardLotUnits;

  // Total Notional Position Value
  const notionalValue = units * (entryPrice > 0 ? entryPrice : 1);

  // Required Margin (Notional / Leverage)
  const marginRequired = effectiveLeverage > 0 ? notionalValue / effectiveLeverage : notionalValue;

  // Margin Check vs Balance
  if (marginRequired > effectiveBalance && effectiveBalance > 0) {
    warnings.push(
      `Margin requirement ($${marginRequired.toFixed(2)}) exceeds account balance ($${effectiveBalance.toFixed(2)}). Reduce risk % or increase leverage.`
    );
    isApproved = false;
  }

  // Potential Loss & Profit
  const potentialLoss = lotSize * stopLossPips * effectivePipValue;
  const potentialProfit = lotSize * takeProfitPips * effectivePipValue;
  const riskRewardRatio = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;

  // Spread & Commission Friction
  const estimatedSpreadCost = (spreadPips || 0) * lotSize * effectivePipValue;
  const commissionCost = (commissionPerLot || 0) * lotSize;
  const totalFriction = estimatedSpreadCost + commissionCost;

  const netProfit = Math.max(0, potentialProfit - totalFriction);
  const netLoss = potentialLoss + totalFriction;

  // Break-even Price (accounts for spread in pips)
  let breakevenPrice = entryPrice;
  if (entryPrice > 0) {
    const spreadDistance = (spreadPips || 0) * effectivePipSize;
    if (direction === 'LONG') {
      breakevenPrice = entryPrice + spreadDistance;
    } else {
      breakevenPrice = entryPrice - spreadDistance;
    }
  }

  // Risk Tier & Status
  let riskTier: RiskTier = 'Conservative';
  if (riskPercentage > 5.0 || effectiveLeverage > 200) riskTier = 'Extreme';
  else if (riskPercentage > 2.0 || effectiveLeverage > 100) riskTier = 'High';
  else if (riskPercentage > 1.0 || effectiveLeverage > 50) riskTier = 'Elevated';

  let riskStatus: RiskStatus = 'Safe';
  if (riskPercentage > 5.0 || marginRequired > effectiveBalance || warnings.length > 2) {
    riskStatus = 'Danger';
  } else if (riskPercentage > 2.0 || marginRequired > effectiveBalance * 0.7) {
    riskStatus = 'High';
  }

  const riskStatusDetails: string[] = [...warnings];
  if (effectiveLeverage >= 200) {
    riskStatusDetails.push(`High leverage (${effectiveLeverage}:1): sharp margin calls can occur rapidly if volatility expands.`);
  }
  if (riskRewardRatio > 0 && riskRewardRatio < 1.0) {
    riskStatusDetails.push('Risk/Reward is below 1:1. Minimum 1:1.5 recommended.');
  }

  return {
    tradingMode: 'FOREX',
    marginRequired,
    positionSize: notionalValue,
    quantity: units,
    riskAmount: potentialLoss > 0 ? potentialLoss : riskAmount,
    reward: potentialProfit,
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
    feeImpact: totalFriction,
    entryFee: estimatedSpreadCost,
    exitFee: commissionCost,
    estimatedFundingCost: 0,
    estimatedSlippageCost: 0,
    netProfit,
    netLoss,
    liquidationPrice: 0, // In Forex, margin call/stop out is broker-specific
    distanceToLiquidationPct: 0,
    breakevenPrice: Number(breakevenPrice.toFixed(5)),
    priceRiskPercentage: Number(priceRiskPercentage.toFixed(2)),
    priceRewardPercentage: Number(priceRewardPercentage.toFixed(2)),
    riskStatus,
    riskTier,
    riskStatusDetails,
    isLiqBeforeSL: false,
    maxAllowedPosition: effectiveBalance * effectiveLeverage,
    leverageAdjustedPosition: notionalValue,
    stopLossDistance,
    takeProfitDistance,
    forex: {
      stopLossPips: Number(stopLossPips.toFixed(1)),
      takeProfitPips: Number(takeProfitPips.toFixed(1)),
      lotSize,
      standardLots: lotSize,
      miniLots: Number((lotSize * 10).toFixed(1)),
      microLots: Number((lotSize * 100).toFixed(0)),
      units,
      pipValuePerLot: effectivePipValue,
      pipSize: effectivePipSize,
      marginRequired,
      leverage: effectiveLeverage,
      potentialLoss,
      potentialProfit,
      breakEvenPrice: Number(breakevenPrice.toFixed(5)),
      brokerStopOutNote: 'Broker stop-out rules are broker-specific (typically 20% to 50% margin level). Liquidation formula is not identical to crypto perpetuals.',
    },
  };
}
