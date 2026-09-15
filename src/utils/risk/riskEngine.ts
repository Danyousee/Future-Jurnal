import { 
  CalculatorState, 
  CalculationResult, 
  TradingPlan, 
  SpotDirection, 
  SpotVenue, 
  TradeDirection 
} from '../../types';
import { calculatePerpetualRisk, PerpetualInputParams } from './perpetualCalculator';
import { calculateSpotRisk, SpotInputParams } from './spotCalculator';
import { calculateDexRisk, DexInputParams } from './dexCalculator';
import { calculateForexRisk, ForexInputParams } from './forexCalculator';

/**
 * Universal Core Risk Parameters interface for the universal risk flow:
 * Balance -> Risk% -> Risk Amount -> Entry+SL -> Stop Distance -> Sizing -> Value -> Fees -> PnL -> R:R
 */
export interface CoreRiskFlowParameters {
  accountBalance: number;
  riskPercentage: number;
  riskAmount: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  stopDistance: number;
  stopDistancePct: number;
  positionUnits: number;
  positionValue: number;
  riskRewardRatio: number;
}

/**
 * 1. Calculates Risk Amount from Account Balance and Risk Percentage.
 * Clamped so risk amount can never exceed the total account balance.
 */
export function calculateRiskAmountFromPct(balance: number, riskPct: number): number {
  if (balance <= 0 || riskPct <= 0) return 0;
  const clampedPct = Math.min(100, Math.max(0, riskPct));
  const amount = balance * (clampedPct / 100);
  return Math.min(balance, amount);
}

/**
 * 2. Calculates Risk Percentage from Account Balance and Risk Amount.
 * Clamped between 0% and 100%.
 */
export function calculateRiskPctFromAmount(balance: number, riskAmount: number): number {
  if (balance <= 0 || riskAmount <= 0) return 0;
  const clampedAmount = Math.min(balance, Math.max(0, riskAmount));
  return (clampedAmount / balance) * 100;
}

/**
 * 3. Calculates Stop Loss Distance (both absolute price difference and %).
 * Handles long/buy and short/sell directional validation.
 */
export function calculateStopDistance(
  entryPrice: number,
  stopLoss: number,
  direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL'
): { distance: number; distancePct: number; isValid: boolean; error?: string } {
  if (entryPrice <= 0 || stopLoss <= 0) {
    return { distance: 0, distancePct: 0, isValid: false, error: 'Entry Price and Stop Loss must be greater than zero.' };
  }

  const isLong = direction === 'LONG' || direction === 'BUY';
  if (isLong) {
    if (stopLoss >= entryPrice) {
      return { 
        distance: 0, 
        distancePct: 0, 
        isValid: false, 
        error: 'For Long/Buy positions, Stop Loss must be strictly below Entry Price.' 
      };
    }
    const distance = entryPrice - stopLoss;
    const distancePct = (distance / entryPrice) * 100;
    return { distance, distancePct, isValid: true };
  } else {
    if (stopLoss <= entryPrice) {
      return { 
        distance: 0, 
        distancePct: 0, 
        isValid: false, 
        error: 'For Short/Sell positions, Stop Loss must be strictly above Entry Price.' 
      };
    }
    const distance = stopLoss - entryPrice;
    const distancePct = (distance / entryPrice) * 100;
    return { distance, distancePct, isValid: true };
  }
}

/**
 * 4. Calculates Contract / Token Units from Risk Amount and Stop Distance.
 * Formula: Position Units = Risk Amount / Stop Loss Distance
 */
export function calculatePositionSizeFromRisk(riskAmount: number, stopDistance: number): number {
  if (riskAmount <= 0 || stopDistance <= 0) return 0;
  return riskAmount / stopDistance;
}

/**
 * 5. Calculates Notional Position Value from Units and Entry Price.
 * Formula: Position Value = Position Units * Entry Price
 * Clearly distinguishes Position Value (Total Exposure) from Risk Amount (Potential Loss).
 */
export function calculatePositionValue(positionUnits: number, entryPrice: number): number {
  if (positionUnits <= 0 || entryPrice <= 0) return 0;
  return positionUnits * entryPrice;
}

/**
 * 6. Calculates Take Profit price based on Entry, Stop Loss, Direction, and Target R:R.
 * Long / Buy:  Take Profit = Entry + (Stop Distance * RR)
 * Short / Sell: Take Profit = Entry - (Stop Distance * RR)
 */
export function calculateTakeProfitFromRR(
  entryPrice: number,
  stopLoss: number,
  direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL',
  rrRatio: number
): number {
  if (entryPrice <= 0 || stopLoss <= 0 || rrRatio <= 0) return 0;
  const isLong = direction === 'LONG' || direction === 'BUY';
  const stopDistance = Math.abs(entryPrice - stopLoss);
  if (isLong) {
    return entryPrice + (stopDistance * rrRatio);
  } else {
    return Math.max(0, entryPrice - (stopDistance * rrRatio));
  }
}

/**
 * 7. Calculates R Multiple.
 * 1R = Initial planned risk amount.
 * Example: if planned risk is $100 and actual profit is $250, R multiple is +2.50R.
 */
export function calculateRMultiple(pnl: number, initialRiskAmount: number): number {
  if (initialRiskAmount <= 0) return 0;
  return pnl / initialRiskAmount;
}

/**
 * 8. Comprehensive P&L and Friction Engine.
 */
export function calculateExpectedPnL(params: {
  positionUnits: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  totalFriction?: number;
}): {
  grossLoss: number;
  netLoss: number;
  grossProfit: number;
  netProfit: number;
  riskRewardRatio: number;
  rMultiple: number;
} {
  const {
    positionUnits = 0,
    entryPrice = 0,
    stopLoss = 0,
    takeProfit = 0,
    direction = 'LONG',
    totalFriction = 0,
  } = params;

  if (positionUnits <= 0 || entryPrice <= 0 || stopLoss <= 0) {
    return { grossLoss: 0, netLoss: 0, grossProfit: 0, netProfit: 0, riskRewardRatio: 0, rMultiple: 0 };
  }

  const isLong = direction === 'LONG' || direction === 'BUY';
  const stopDist = isLong ? Math.max(0, entryPrice - stopLoss) : Math.max(0, stopLoss - entryPrice);
  const grossLoss = positionUnits * stopDist;
  const netLoss = grossLoss + totalFriction;

  let grossProfit = 0;
  let netProfit = 0;
  let riskRewardRatio = 0;

  if (takeProfit > 0) {
    const tpDist = isLong ? Math.max(0, takeProfit - entryPrice) : Math.max(0, entryPrice - takeProfit);
    grossProfit = positionUnits * tpDist;
    netProfit = Math.max(0, grossProfit - totalFriction);
    if (grossLoss > 0) {
      riskRewardRatio = grossProfit / grossLoss;
    }
  }

  const rMultiple = grossLoss > 0 ? grossProfit / grossLoss : 0;

  return {
    grossLoss,
    netLoss,
    grossProfit,
    netProfit,
    riskRewardRatio,
    rMultiple,
  };
}

/**
 * 9. Re-evaluates risk metrics when a trader manually overrides the recommended position size.
 * Returns the actual risk at stop loss, actual risk percentage of balance, and warnings.
 */
export function recalculateWithCustomPositionSize(params: {
  accountBalance: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  customPositionValue: number;
  direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  maxAllowedRiskPct?: number;
}): {
  customUnits: number;
  actualRiskAmount: number;
  actualRiskPct: number;
  actualPotentialProfit: number;
  riskRewardRatio: number;
  exceedsPlanRisk: boolean;
  warningMessage?: string;
} {
  const {
    accountBalance = 10000,
    entryPrice = 0,
    stopLoss = 0,
    takeProfit = 0,
    customPositionValue = 0,
    direction = 'LONG',
    maxAllowedRiskPct = 2.0,
  } = params;

  if (entryPrice <= 0 || stopLoss <= 0 || customPositionValue <= 0) {
    return {
      customUnits: 0,
      actualRiskAmount: 0,
      actualRiskPct: 0,
      actualPotentialProfit: 0,
      riskRewardRatio: 0,
      exceedsPlanRisk: false,
    };
  }

  const customUnits = customPositionValue / entryPrice;
  const isLong = direction === 'LONG' || direction === 'BUY';
  const priceDistance = Math.abs(entryPrice - stopLoss);
  const actualRiskAmount = customUnits * priceDistance;
  const actualRiskPct = accountBalance > 0 ? (actualRiskAmount / accountBalance) * 100 : 0;

  let actualPotentialProfit = 0;
  let riskRewardRatio = 0;
  if (takeProfit > 0) {
    const tpDistance = isLong ? takeProfit - entryPrice : entryPrice - takeProfit;
    actualPotentialProfit = Math.max(0, customUnits * tpDistance);
    if (actualRiskAmount > 0) {
      riskRewardRatio = actualPotentialProfit / actualRiskAmount;
    }
  }

  const exceedsPlanRisk = actualRiskPct > maxAllowedRiskPct;
  const warningMessage = exceedsPlanRisk
    ? `Manual position size creates $${actualRiskAmount.toFixed(2)} risk (${actualRiskPct.toFixed(2)}%), exceeding your plan maximum of ${maxAllowedRiskPct}%.`
    : undefined;

  return {
    customUnits,
    actualRiskAmount,
    actualRiskPct,
    actualPotentialProfit,
    riskRewardRatio,
    exceedsPlanRisk,
    warningMessage,
  };
}

/**
 * 10. Universal Multi-Market Trade Risk Calculator.
 * Routes cleanly to Perpetual, Spot, Forex, or DEX calculation engine based on active tradingMode.
 */
export function calculateTradeRisk(
  state: CalculatorState,
  plan?: TradingPlan
): CalculationResult {
  const rawMode = (state.tradingMode || 'PERPETUAL').toUpperCase();

  // 1. DEX MODE
  if (rawMode === 'DEX' || (rawMode === 'SPOT' && String(state.spotVenue).toUpperCase() === 'DEX')) {
    const spotDirection: SpotDirection = (state.spotDirection as SpotDirection) || 
      (state.direction === 'LONG' ? 'BUY' : 'SELL');
    return calculateDexRisk({
      accountBalance: state.accountBalance,
      pair: state.pair || (state.dexToken ? `${state.dexToken}/WETH` : 'ETH/USDT'),
      token: state.dexToken || (state.pair ? state.pair.split('/')[0] : 'ETH'),
      chain: state.dexChain || 'Ethereum',
      dex: state.dexProtocol || 'Uniswap',
      direction: spotDirection,
      entryPrice: state.entryPrice,
      stopLoss: state.stopLoss,
      takeProfit: state.takeProfit,
      riskPercentage: state.riskPercentage,
      maxCapital: state.spotMaxCapital,
      gasFee: state.dexGasFee !== undefined ? state.dexGasFee : 5.0,
      networkFee: state.dexNetworkFee !== undefined ? state.dexNetworkFee : 0,
      dexFeePct: state.dexFeePct !== undefined ? state.dexFeePct : 0.30,
      priceImpactPct: state.dexPriceImpactPct !== undefined ? state.dexPriceImpactPct : 0.10,
      slippagePct: state.dexSlippagePct !== undefined ? state.dexSlippagePct : (state.slippagePct ?? 0.50),
      tokenLiquidity: state.dexTokenLiquidity !== undefined ? state.dexTokenLiquidity : state.tokenLiquidity,
      plan,
    });
  }

  // 2. SPOT MODE (CEX)
  if (rawMode === 'SPOT') {
    const spotDirection: SpotDirection = (state.spotDirection as SpotDirection) || 
      (state.direction === 'LONG' ? 'BUY' : 'SELL');
    return calculateSpotRisk({
      venue: 'CEX',
      accountBalance: state.accountBalance,
      pair: state.pair || 'BTC/USDT',
      direction: spotDirection,
      entryPrice: state.entryPrice,
      stopLoss: state.stopLoss,
      takeProfit: state.takeProfit,
      riskPercentage: state.riskPercentage,
      maxCapital: state.spotMaxCapital,
      sizingMethod: state.spotSizingMethod || 'RISK_BASED',
      feeRate: state.feeRate ?? 0.10,
      makerFeeRate: state.makerFeeRate,
      takerFeeRate: state.takerFeeRate,
      slippagePct: state.slippagePct ?? 0.05,
      plan,
    });
  }

  // 3. FOREX MODE
  if (rawMode === 'FOREX') {
    return calculateForexRisk({
      accountBalance: state.accountBalance,
      accountCurrency: state.forexAccountCurrency || 'USD',
      pair: state.pair || 'EUR/USD',
      direction: state.direction || 'LONG',
      entryPrice: state.entryPrice,
      stopLoss: state.stopLoss,
      takeProfit: state.takeProfit,
      riskPercentage: state.riskPercentage,
      leverage: state.forexLeverage || state.leverage || 100,
      pipSize: state.forexPipSize,
      pipValuePerLot: state.forexPipValue,
      standardLotUnits: state.forexStandardLotUnits,
      spreadPips: state.forexState?.spreadPips ?? (state as any).forexSpreadPips,
      commissionPerLot: state.forexState?.commissionPerLot ?? (state as any).forexCommissionPerLot,
      plan,
    });
  }

  // 4. PERPETUAL / FUTURES MODE (Default)
  return calculatePerpetualRisk(state, plan);
}
