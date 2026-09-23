import { 
  CalculationResult, 
  RiskStatus, 
  RiskTier, 
  TradeDirection,
  TradingPlan 
} from '../../types';
import { formatCurrency, formatNumber } from './formatting';
import { calculateTradeFees } from './feeCalculator';

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
  const clean = pair.toUpperCase().replace(/\s+/g, '');
  if (clean.includes('XAU') || clean.includes('GOLD')) return 10; // $0.10 * 100 oz = $10 per pip
  // Standard USD-quote pairs (EUR/USD, GBP/USD, AUD/USD, NZD/USD) = $10/pip per standard lot
  return 10;
}

export interface ForexInputParams {
  accountBalance: number;
  accountCurrency?: string;
  pair?: string;
  direction?: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  riskPercentage: number;
  leverage?: number;
  pipSize?: number;
  pipValuePerLot?: number;
  standardLotUnits?: number;
  spreadPips?: number;
  commissionPerLot?: number;
  plan?: TradingPlan;
}

/**
 * Professional Forex Position Sizing & Risk Management Engine.
 * 
 * Core Formula:
 * Lot Size = Risk Amount / (Stop Loss Pips × Pip Value Per Standard Lot)
 * 
 * Sizing Breakdowns:
 * - Standard Lots (1.00 = 100,000 units)
 * - Mini Lots (0.10 = 10,000 units)
 * - Micro Lots (0.01 = 1,000 units)
 * 
 * Margin Calculation:
 * Margin Required = Notional Position Value / Leverage
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
    plan,
  } = params;

  const effectiveBalance = Math.max(0, accountBalance || 0);
  const effectiveLeverage = Math.max(1, leverage || 100);
  const effectivePipSize = pipSize > 0 ? pipSize : getStandardPipSize(pair);
  const effectivePipValue = pipValuePerLot > 0 ? pipValuePerLot : 10;
  const validEntry = Math.max(0, entryPrice || 0);
  const validSL = Math.max(0, stopLoss || 0);
  const validTP = Math.max(0, takeProfit || 0);
  const validRiskPct = Math.max(0.01, Math.min(100, riskPercentage || 1));

  const warnings: string[] = [];
  let isApproved = true;

  if (effectiveBalance <= 0 || validEntry <= 0 || validSL <= 0) {
    return {
      tradingMode: 'FOREX',
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
      riskStatusDetails: ['Enter balance, entry price, and stop loss to calculate Forex lot size.'],
      isLiqBeforeSL: false,
      maxAllowedPosition: effectiveBalance * effectiveLeverage,
      leverageAdjustedPosition: 0,
      stopLossDistance: 0,
      takeProfitDistance: 0,
      forex: {
        stopLossPips: 0,
        takeProfitPips: 0,
        lotSize: 0,
        standardLots: 0,
        miniLots: 0,
        microLots: 0,
        units: 0,
        pipValuePerLot: effectivePipValue,
        pipValue: effectivePipValue,
        spreadCost: 0,
        spreadPips: spreadPips || 0,
        pipSize: effectivePipSize,
        marginRequired: 0,
        leverage: effectiveLeverage,
        potentialLoss: 0,
        potentialProfit: 0,
        breakEvenPrice: validEntry,
        brokerStopOutNote: 'Broker stop-out rules are broker-specific (typically 20% to 50% margin level). Liquidation formula is not identical to crypto perpetuals.',
      }
    };
  }

  // 1. Directional & Stop Loss Checks
  let stopLossDistance = 0;
  let stopLossPips = 0;
  let priceRiskPercentage = 0;

  if (direction === 'LONG') {
    if (validSL >= validEntry) {
      warnings.push('For LONG positions, Stop Loss must be placed below Entry Price.');
      isApproved = false;
      stopLossDistance = Math.max(Number.MIN_VALUE, validEntry - validSL);
    } else {
      stopLossDistance = validEntry - validSL;
    }
  } else {
    if (validSL <= validEntry) {
      warnings.push('For SHORT positions, Stop Loss must be placed above Entry Price.');
      isApproved = false;
      stopLossDistance = Math.max(Number.MIN_VALUE, validSL - validEntry);
    } else {
      stopLossDistance = validSL - validEntry;
    }
  }

  stopLossPips = effectivePipSize > 0 ? stopLossDistance / effectivePipSize : 0;
  priceRiskPercentage = (stopLossDistance / validEntry) * 100;

  // 2. Take Profit Checks
  let takeProfitDistance = 0;
  let takeProfitPips = 0;
  let priceRewardPercentage = 0;

  if (validTP > 0) {
    if (direction === 'LONG') {
      if (validTP > validEntry) {
        takeProfitDistance = validTP - validEntry;
        takeProfitPips = effectivePipSize > 0 ? takeProfitDistance / effectivePipSize : 0;
        priceRewardPercentage = (takeProfitDistance / validEntry) * 100;
      } else {
        warnings.push('For LONG positions, Take Profit must be above Entry Price.');
      }
    } else {
      if (validTP < validEntry) {
        takeProfitDistance = validEntry - validTP;
        takeProfitPips = effectivePipSize > 0 ? takeProfitDistance / effectivePipSize : 0;
        priceRewardPercentage = (takeProfitDistance / validEntry) * 100;
      } else {
        warnings.push('For SHORT positions, Take Profit must be below Entry Price.');
      }
    }
  }

  // 3. Target Risk Amount
  const riskAmount = (effectiveBalance * validRiskPct) / 100;

  // 4. Lot Size Calculation
  // Formula: Lot Size = Risk Amount / (Stop Loss Pips * Pip Value per Standard Lot)
  let rawLotSize = 0;
  if (stopLossPips > 0 && effectivePipValue > 0) {
    rawLotSize = riskAmount / (stopLossPips * effectivePipValue);
  }

  // Precision rounded to micro lots (0.01)
  const lotSize = Math.max(0.01, Number(rawLotSize.toFixed(2)));
  const units = lotSize * standardLotUnits;

  // 5. Total Notional Position Value & Margin
  const notionalValue = units * (validEntry > 0 ? validEntry : 1);
  const marginRequired = effectiveLeverage > 0 ? notionalValue / effectiveLeverage : notionalValue;

  // Margin Check vs Balance
  if (marginRequired > effectiveBalance && effectiveBalance > 0) {
    warnings.push(
      `Margin requirement ($${formatCurrency(marginRequired)}) exceeds account balance ($${formatCurrency(effectiveBalance)}). Reduce risk % or increase broker leverage.`
    );
    isApproved = false;
  }

  // 6. Potential Loss & Profit
  const potentialLoss = lotSize * stopLossPips * effectivePipValue;
  const potentialProfit = lotSize * takeProfitPips * effectivePipValue;
  const riskRewardRatio = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;

  // 7. Spread & Commission Friction
  const fees = calculateTradeFees({
    positionValue: notionalValue,
    spreadPips,
    lotSize,
    pipValue: effectivePipValue,
    commissionPerLot,
  });

  const estimatedSpreadCost = fees.spreadCost;
  const commissionCost = fees.commissionCost;
  const totalFriction = fees.totalForexFriction;

  const netProfit = Math.max(0, potentialProfit - totalFriction);
  const netLoss = potentialLoss + totalFriction;

  // 8. Break-even Price (incorporates spread)
  let breakevenPrice = validEntry;
  const spreadDistance = (spreadPips || 0) * effectivePipSize;
  if (direction === 'LONG') {
    breakevenPrice = validEntry + spreadDistance;
  } else {
    breakevenPrice = validEntry - spreadDistance;
  }

  // Risk Tier & Status
  let riskTier: RiskTier = 'Conservative';
  if (validRiskPct > 5.0 || effectiveLeverage > 200) riskTier = 'Extreme';
  else if (validRiskPct > 2.0 || effectiveLeverage > 100) riskTier = 'High';
  else if (validRiskPct > 1.0 || effectiveLeverage > 50) riskTier = 'Elevated';

  let riskStatus: RiskStatus = 'Safe';
  if (!isApproved || validRiskPct > 5.0 || marginRequired > effectiveBalance) {
    riskStatus = 'Danger';
  } else if (validRiskPct > 2.0 || marginRequired > effectiveBalance * 0.7) {
    riskStatus = 'High';
  }

  const riskStatusDetails: string[] = [...warnings];
  if (effectiveLeverage >= 200) {
    riskStatusDetails.push(`High broker leverage (${effectiveLeverage}:1): Rapid margin calls can occur during macroeconomic releases.`);
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
    liquidationPrice: 0,
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
      pipValue: effectivePipValue,
      spreadCost: estimatedSpreadCost,
      spreadPips: spreadPips || 0,
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
