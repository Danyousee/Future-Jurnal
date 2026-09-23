import { TradingPlan, TradePlanCheckResult } from '../../types';

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskWarningItem {
  id: string;
  severity: RiskSeverity;
  message: string;
  fieldKey?: string;
  suggestedAction?: string;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export interface TradeValidationResult {
  isValid: boolean;
  errors: ValidationErrorItem[];
  warnings: RiskWarningItem[];
}

export interface TradeEntryValidationParams {
  tradeMode?: string;
  spotVenue?: string;
  pair: string;
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  direction?: 'LONG' | 'SHORT';
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  // DEX specific
  dexChain?: string;
  dexProtocol?: string;
  dexGasFee?: number;
  dexTradingFeePct?: number;
  dexPriceImpactPct?: number;
  dexSlippagePct?: number;
  // Forex specific
  lotSize?: number;
  pipsRisk?: number;
  pipsGain?: number;
  // Optional plan
  plan?: TradingPlan;
}

/**
 * Validates trade entry parameters across SPOT (CEX & DEX), PERPETUAL, and FOREX execution regimes.
 * Performs rigorous data integrity checks and returns user-friendly errors and risk warnings.
 */
export function validateTradeEntry(params: TradeEntryValidationParams): TradeValidationResult {
  const errors: ValidationErrorItem[] = [];
  const warnings: RiskWarningItem[] = [];

  const {
    tradeMode = 'PERPETUAL',
    spotVenue = 'CEX',
    pair,
    entryPrice,
    exitPrice,
    positionSize,
    direction = 'LONG',
    stopLoss = 0,
    takeProfit = 0,
    leverage = 1,
    dexGasFee = 0,
    dexTradingFeePct = 0.3,
    dexPriceImpactPct = 0,
    dexSlippagePct = 0.5,
    lotSize,
    pipsRisk,
    pipsGain,
    plan,
  } = params;

  // 1. Core Universal Field Checks
  if (!pair || pair.trim().length === 0) {
    errors.push({ field: 'pair', message: 'Trading pair or asset symbol is required.' });
  }

  if (!entryPrice || isNaN(entryPrice) || entryPrice <= 0) {
    errors.push({ field: 'entryPrice', message: 'Entry Price must be a positive number greater than 0.' });
  }

  if (!exitPrice || isNaN(exitPrice) || exitPrice <= 0) {
    errors.push({ field: 'exitPrice', message: 'Exit Price must be a positive number greater than 0.' });
  }

  if (!positionSize || isNaN(positionSize) || positionSize <= 0) {
    errors.push({ field: 'positionSize', message: 'Position Size (volume) must be greater than 0.' });
  }

  // 2. Price Boundary & Logical Direction Checks
  if (entryPrice > 0 && stopLoss > 0) {
    if (direction === 'LONG' && stopLoss >= entryPrice) {
      warnings.push({
        id: 'long-sl-above-entry',
        severity: 'MEDIUM',
        message: 'For a LONG trade, Stop Loss is set at or above Entry Price.',
        fieldKey: 'stopLoss',
        suggestedAction: 'Ensure this is intentional (e.g. trailing stop in profit).',
      });
    } else if (direction === 'SHORT' && stopLoss <= entryPrice) {
      warnings.push({
        id: 'short-sl-below-entry',
        severity: 'MEDIUM',
        message: 'For a SHORT trade, Stop Loss is set at or below Entry Price.',
        fieldKey: 'stopLoss',
        suggestedAction: 'Ensure this is intentional (e.g. trailing stop in profit).',
      });
    }
  }

  if (entryPrice > 0 && takeProfit > 0) {
    if (direction === 'LONG' && takeProfit <= entryPrice) {
      warnings.push({
        id: 'long-tp-below-entry',
        severity: 'LOW',
        message: 'For a LONG trade, Take Profit is below or equal to Entry Price.',
        fieldKey: 'takeProfit',
      });
    } else if (direction === 'SHORT' && takeProfit >= entryPrice) {
      warnings.push({
        id: 'short-tp-above-entry',
        severity: 'LOW',
        message: 'For a SHORT trade, Take Profit is above or equal to Entry Price.',
        fieldKey: 'takeProfit',
      });
    }
  }

  // 3. Mode-Specific Validation
  const rawMode = tradeMode.toUpperCase();
  const isDex = rawMode === 'DEX' || (rawMode === 'SPOT' && String(spotVenue).toUpperCase() === 'DEX');

  // 3a. DEX Parameters Validation
  if (isDex) {
    if (dexGasFee !== undefined && dexGasFee < 0) {
      errors.push({ field: 'dexGasFee', message: 'Estimated gas fee cannot be negative.' });
    } else if (dexGasFee > 100) {
      warnings.push({
        id: 'high-gas-fee',
        severity: 'MEDIUM',
        message: `High gas fee ($${dexGasFee.toFixed(2)}). Ensure position size justifies on-chain transaction cost.`,
        fieldKey: 'dexGasFee',
      });
    }

    if (dexTradingFeePct !== undefined && dexTradingFeePct < 0) {
      errors.push({ field: 'dexTradingFeePct', message: 'DEX pool swap fee percentage cannot be negative.' });
    }

    if (dexPriceImpactPct !== undefined) {
      if (dexPriceImpactPct < 0) {
        errors.push({ field: 'dexPriceImpactPct', message: 'DEX price impact cannot be negative.' });
      } else if (dexPriceImpactPct > 15) {
        errors.push({ field: 'dexPriceImpactPct', message: 'Price impact exceeds 15%. Trade rejected due to extreme liquidity drain.' });
      } else if (dexPriceImpactPct > 2) {
        warnings.push({
          id: 'high-price-impact',
          severity: 'HIGH',
          message: `Price impact is high (${dexPriceImpactPct.toFixed(2)}%). Expect significant execution loss against AMM pool.`,
          fieldKey: 'dexPriceImpactPct',
        });
      }
    }

    if (dexSlippagePct !== undefined) {
      if (dexSlippagePct < 0) {
        errors.push({ field: 'dexSlippagePct', message: 'Slippage tolerance cannot be negative.' });
      } else if (dexSlippagePct > 10) {
        errors.push({ field: 'dexSlippagePct', message: 'Slippage tolerance exceeds 10%. Highly vulnerable to MEV sandwich bots.' });
      } else if (dexSlippagePct > 2) {
        warnings.push({
          id: 'elevated-slippage',
          severity: 'MEDIUM',
          message: `Slippage tolerance (${dexSlippagePct.toFixed(2)}%) is elevated. Consider setting a tighter tolerance to avoid front-running.`,
          fieldKey: 'dexSlippagePct',
        });
      }
    }
  }

  // 3b. Forex Parameters Validation
  if (rawMode === 'FOREX') {
    if (lotSize !== undefined && lotSize <= 0) {
      errors.push({ field: 'lotSize', message: 'Forex position lot size must be greater than 0.' });
    }
    if (pipsRisk !== undefined && pipsRisk < 0) {
      errors.push({ field: 'pipsRisk', message: 'Pips at risk cannot be negative.' });
    }
    if (pipsGain !== undefined && pipsGain < 0) {
      errors.push({ field: 'pipsGain', message: 'Pips target cannot be negative.' });
    }
    if (pipsRisk !== undefined && pipsRisk > 0 && pipsGain !== undefined && pipsGain > 0) {
      const pipRR = pipsGain / pipsRisk;
      if (pipRR < 1.0) {
        warnings.push({
          id: 'forex-negative-rr',
          severity: 'MEDIUM',
          message: `Forex Risk/Reward is 1:${pipRR.toFixed(2)}. Target pip gain is smaller than pip risk.`,
          fieldKey: 'pipsGain',
        });
      }
    }
  }

  // 3c. Perpetual Leverage Validation
  if (rawMode === 'PERPETUAL') {
    if (leverage < 1) {
      errors.push({ field: 'leverage', message: 'Perpetual leverage must be at least 1x.' });
    } else if (leverage > 50) {
      warnings.push({
        id: 'ultra-high-leverage',
        severity: 'HIGH',
        message: `High leverage (${leverage}x) significantly increases liquidation probability.`,
        fieldKey: 'leverage',
      });
    } else if (leverage > 20) {
      warnings.push({
        id: 'elevated-leverage',
        severity: 'MEDIUM',
        message: `Leverage is ${leverage}x. Tight risk control and guaranteed stops advised.`,
        fieldKey: 'leverage',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates trade parameters against safety limits and trading plan rules.
 * Generates categorized LOW, MEDIUM, HIGH severity warnings.
 */
export function evaluateRiskWarnings(params: {
  riskPercentage: number;
  leverage: number;
  riskRewardRatio: number;
  isLiqBeforeSL?: boolean;
  distanceToLiqPct?: number;
  stopDistancePct?: number;
  plan?: TradingPlan;
  consecutiveLosses?: number;
}): RiskWarningItem[] {
  const warnings: RiskWarningItem[] = [];
  const {
    riskPercentage = 1.0,
    leverage = 1,
    riskRewardRatio = 0,
    isLiqBeforeSL = false,
    distanceToLiqPct = 100,
    stopDistancePct = 0,
    plan,
    consecutiveLosses = 0,
  } = params;

  // 1. High Severity: Liquidation before SL
  if (isLiqBeforeSL) {
    warnings.push({
      id: 'liq-before-sl',
      severity: 'HIGH',
      message: 'CRITICAL: Estimated liquidation price is triggered BEFORE your Stop Loss.',
      fieldKey: 'leverage',
      suggestedAction: 'Reduce leverage or tighten Stop Loss to ensure capital protection.',
    });
  }

  // 2. High Severity: Risk > 5% or exceeding Plan Max
  const maxRisk = plan?.maxRiskPerTrade ?? 2.0;
  if (riskPercentage > maxRisk) {
    warnings.push({
      id: 'risk-exceeds-plan',
      severity: riskPercentage > 5 ? 'HIGH' : 'MEDIUM',
      message: `Risk per trade (${riskPercentage}%) exceeds your trading plan limit (${maxRisk}%).`,
      fieldKey: 'riskPct',
      suggestedAction: `Lower risk percentage to ${maxRisk}% or below.`,
    });
  }

  // 3. Medium Severity: Sub-optimal R:R
  const minRR = plan?.minRiskRewardRatio ?? 1.5;
  if (riskRewardRatio > 0 && riskRewardRatio < minRR) {
    warnings.push({
      id: 'suboptimal-rr',
      severity: 'MEDIUM',
      message: `Risk/Reward ratio 1:${riskRewardRatio.toFixed(2)} is below the target 1:${minRR.toFixed(1)}.`,
      fieldKey: 'takeProfit',
      suggestedAction: 'Consider adjusting Take Profit to achieve at least 1:1.5+ R:R.',
    });
  }

  // 4. Consecutive Losses Protection
  const maxConsecutive = plan?.maxConsecutiveLosses ?? 3;
  if (consecutiveLosses >= maxConsecutive) {
    warnings.push({
      id: 'consecutive-losses-warning',
      severity: 'HIGH',
      message: `Consecutive losses reached (${consecutiveLosses} losses). Cooling-off period recommended.`,
      suggestedAction: 'Step away from charts or reduce position size by 50% to prevent tilt.',
    });
  } else if (consecutiveLosses >= 2) {
    warnings.push({
      id: 'consecutive-losses-caution',
      severity: 'LOW',
      message: `${consecutiveLosses} consecutive losses logged today. Exercise caution.`,
      suggestedAction: 'Stick strictly to A+ high conviction setups.',
    });
  }

  // 5. Very tight stop loss (< 0.3% price distance in crypto)
  if (stopDistancePct > 0 && stopDistancePct < 0.3) {
    warnings.push({
      id: 'tight-stop-loss',
      severity: 'LOW',
      message: `Stop distance is only ${stopDistancePct.toFixed(2)}%. High likelihood of market noise liquidation.`,
      fieldKey: 'stopLoss',
      suggestedAction: 'Give trade sufficient room beyond swing levels or key structure.',
    });
  }

  return warnings;
}
