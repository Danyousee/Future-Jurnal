import { 
  CalculatorState, 
  CalculationResult, 
  RiskStatus, 
  RiskTier, 
  TradingPlan, 
  TradePlanCheckResult,
  DailyRiskStatus,
  PreTradeValidationResult,
  OpenPosition,
  PortfolioExposureMetrics,
  PortfolioRiskTier,
  TradeJournalEntry,
  MistakeStat,
  STANDARD_MISTAKES
} from '../types';

export const FEE_PRESETS = {
  maker: { name: 'Maker (0.02%)', rate: 0.02 },
  taker: { name: 'Taker (0.055%)', rate: 0.055 },
  high: { name: 'High Fee (0.075%)', rate: 0.075 },
  custom: { name: 'Custom Fee', rate: 0.1 },
};

export const COMMON_CRYPTO_PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'SUIUSDT',
  'LINKUSDT',
  'PEPEUSDT',
  'NEARUSDT',
  'APTUSDT',
  'RENDERUSDT',
  'TAOUSDT',
  'SHIBUSDT',
  'WIFUSDT',
  'FETUSDT',
  'LTCUSDT',
  'DOTUSDT',
  'INJUSDT',
  'TIAUSDT',
  'SEIUSDT',
  'ARBUSDT',
  'OPUSDT',
  'KASUSDT',
  'HYPEUSDT',
  'FTMUSDT',
  'TONUSDT',
  'ONDOUSDT',
  'AAVEUSDT',
  'POLUSDT'
];

/**
 * Extracts base asset ticker symbol from pair name (e.g. "BTCUSDT" -> "BTC", "SOL/USDT" -> "SOL", "KAS" -> "KAS")
 */
export function getBaseAsset(pairName?: string): string {
  if (!pairName) return 'COIN';
  const clean = pairName.toUpperCase().trim();
  if (clean.includes('/')) return clean.split('/')[0].trim();
  if (clean.endsWith('USDT')) return clean.slice(0, -4);
  if (clean.endsWith('USDC')) return clean.slice(0, -4);
  if (clean.endsWith('BUSD')) return clean.slice(0, -4);
  if (clean.endsWith('USD')) return clean.slice(0, -3);
  if (clean.endsWith('PERP')) return clean.slice(0, -4);
  return clean;
}

export const COMMON_SETUPS = [
  'Breakout',
  'Support / Resistance',
  'Liquidity Sweep',
  'Trend Following',
  'Mean Reversion',
  'Market Structure Shift (MSS)',
  'Order Block Retest',
  'Fair Value Gap (FVG)',
  'Range Deviation / Fakeout',
  'Funding Arbitrage / Mean Reversion'
];

export function calculateFuturesRisk(
  state: CalculatorState, 
  plan?: TradingPlan
): CalculationResult {
  const {
    accountBalance,
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    riskPercentage,
    feeRate,
    leverage,
    marginMode,
    slippagePct = 0.05,
    maintenanceMarginPct = 0.5,
    estimatedFundingRate = 0.01,
  } = state;

  const validBalance = Math.max(0, accountBalance || 0);
  const validEntry = Math.max(0, entryPrice || 0);
  const validSL = Math.max(0, stopLoss || 0);
  const validTP = Math.max(0, takeProfit || 0);
  const validLeverage = Math.max(1, leverage || 1);
  const validRiskPct = Math.max(0.01, riskPercentage || 1);
  const validFeeRate = Math.max(0, feeRate || 0.055) / 100; // decimal form
  const validSlippageRate = Math.max(0, slippagePct || 0) / 100;
  const validFundingRate = (estimatedFundingRate || 0) / 100;
  const mmr = Math.max(0.001, (maintenanceMarginPct || 0.5) / 100);

  // Default fallback calculation when inputs are missing
  if (validBalance <= 0 || validEntry <= 0 || validSL <= 0) {
    return {
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
      riskStatusDetails: ['Enter balance, entry price, and stop loss to calculate position parameters.'],
      isLiqBeforeSL: false,
      maxAllowedPosition: validBalance * validLeverage,
      leverageAdjustedPosition: 0,
      stopLossDistance: 0,
      takeProfitDistance: 0,
    };
  }

  // Calculate Price Risk & Distances
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

  // Dollar Risk Amount targeted based on account balance %
  const riskAmount = (validBalance * validRiskPct) / 100;

  // Theoretical Position Size ($ Notional USDT) based on Risk
  // Risk = Position Size * (PriceRisk% / 100) => Position Size = Risk / (PriceRisk% / 100)
  const positionSize = priceRiskPct > 0 ? (riskAmount / (priceRiskPct / 100)) : 0;
  const quantity = validEntry > 0 ? positionSize / validEntry : 0;
  const marginRequired = positionSize / validLeverage;
  const leverageAdjustedPosition = marginRequired * validLeverage;
  const maxAllowedPosition = validBalance * validLeverage;

  // Take Profit & Reward Calculation
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

  // Fee & Slippage calculations
  const entryFee = positionSize * validFeeRate;
  const exitFee = (positionSize + (reward > 0 ? reward : 0)) * validFeeRate;
  const feeImpact = entryFee + exitFee;
  const estimatedSlippageCost = positionSize * validSlippageRate * 2;
  const estimatedFundingCost = positionSize * validFundingRate;

  // Net Profit & Net Loss
  const netProfit = Math.max(0, reward - feeImpact - estimatedSlippageCost - estimatedFundingCost);
  const netLoss = riskAmount + entryFee + (positionSize * validFeeRate) + estimatedSlippageCost;

  // Breakeven price calculation (including fees + slippage)
  let breakevenPrice = validEntry;
  const roundTripCostFactor = (validFeeRate * 2) + (validSlippageRate * 2);
  if (direction === 'LONG') {
    breakevenPrice = validEntry * (1 + roundTripCostFactor);
  } else {
    breakevenPrice = validEntry * (1 - roundTripCostFactor);
  }

  // Liquidation Price Estimation
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
    // CROSS Margin mode uses available account balance
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

  // Check if liquidation triggers before Stop Loss
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

  // Risk Tier Evaluation
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

  // Risk Status & Detailed Explanations
  const riskStatusDetails: string[] = [];
  let riskStatus: RiskStatus = 'Safe';

  if (isInvalidDirection) {
    riskStatus = 'Danger';
    riskStatusDetails.push(
      direction === 'LONG'
        ? 'Stop Loss must be placed strictly below Entry Price for a Long trade.'
        : 'Stop Loss must be placed strictly above Entry Price for a Short trade.'
    );
  }

  if (isLiqBeforeSL) {
    riskStatus = 'Danger';
    riskStatusDetails.push(
      `LIQUIDATION HAZARD: Estimated liquidation price ($${formatNumber(liquidationPrice)}) is reached BEFORE your Stop Loss ($${formatNumber(validSL)}). Lower leverage or increase allocated margin to prevent exchange liquidation.`
    );
  }

  if (marginRequired > validBalance) {
    riskStatus = 'Danger';
    riskStatusDetails.push(
      `Insufficient Balance: Required margin ($${formatCurrency(marginRequired)}) exceeds total account balance ($${formatCurrency(validBalance)}).`
    );
  } else if (marginUsagePct > 70) {
    if (riskStatus !== 'Danger') riskStatus = 'High';
    riskStatusDetails.push(
      `High Margin Exposure: Using ${marginUsagePct.toFixed(1)}% of your wallet balance on a single position.`
    );
  }

  if (validRiskPct > 5) {
    riskStatus = 'Danger';
    riskStatusDetails.push(`Excessive Risk: Risking ${validRiskPct}% of account equity per trade creates extreme risk of catastrophic drawdown.`);
  } else if (validRiskPct > 2.5) {
    if (riskStatus !== 'Danger') riskStatus = 'High';
    riskStatusDetails.push(`Above Benchmark Risk: ${validRiskPct}% risk per trade exceeds the 1–2% institutional standard.`);
  }

  if (validLeverage >= 50) {
    if (riskStatus !== 'Danger') riskStatus = 'High';
    riskStatusDetails.push(`Ultra-High Leverage: ${validLeverage}x leverage increases liquidation sensitivity during sudden crypto volatility wicks.`);
  }

  if (validTP > 0 && riskRewardRatio > 0 && riskRewardRatio < 1.5) {
    riskStatusDetails.push(`Sub-optimal R:R: 1:${riskRewardRatio.toFixed(2)} is below recommended 1:1.5+ risk-reward standard.`);
  }

  if (riskStatusDetails.length === 0) {
    riskStatus = 'Safe';
    riskStatusDetails.push('Healthy position parameters aligned with disciplined crypto risk management.');
  }

  // Validate against trading plan if provided
  let planValidation: TradePlanCheckResult | undefined;
  if (plan) {
    planValidation = validateTradeAgainstPlan(
      {
        pair: state.pair,
        direction: state.direction,
        leverage: validLeverage,
        riskPercentage: validRiskPct,
        riskRewardRatio,
        hasStopLoss: validSL > 0,
        hasTakeProfit: validTP > 0,
      },
      plan
    );
  }

  return {
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

export function validateTradeAgainstPlan(
  trade: {
    pair?: string;
    direction?: 'LONG' | 'SHORT';
    leverage?: number;
    riskPercentage?: number;
    riskRewardRatio?: number;
    setup?: string;
    hasStopLoss?: boolean;
    hasTakeProfit?: boolean;
  },
  plan: TradingPlan
): TradePlanCheckResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const passedRules: string[] = [];

  // 1. Max Risk Per Trade
  if (trade.riskPercentage !== undefined && trade.riskPercentage > plan.maxRiskPerTrade) {
    violations.push(`Risk per trade (${trade.riskPercentage}%) exceeds plan maximum of ${plan.maxRiskPerTrade}%.`);
  } else if (trade.riskPercentage !== undefined) {
    passedRules.push(`Risk per trade (${trade.riskPercentage}%) <= ${plan.maxRiskPerTrade}% limit.`);
  }

  // 2. Max Leverage
  if (trade.leverage !== undefined && trade.leverage > plan.maxLeverage) {
    violations.push(`Leverage (${trade.leverage}x) exceeds plan maximum of ${plan.maxLeverage}x.`);
  } else if (trade.leverage !== undefined) {
    passedRules.push(`Leverage (${trade.leverage}x) within ${plan.maxLeverage}x ceiling.`);
  }

  // 3. Stop Loss Enforcement
  if (plan.requireStopLoss) {
    if (!trade.hasStopLoss) {
      violations.push('Stop-Loss is mandatory according to your Trading Plan.');
    } else {
      passedRules.push('Mandatory Stop-Loss defined.');
    }
  }

  // 4. Take Profit Enforcement
  if (plan.requireTakeProfit) {
    if (!trade.hasTakeProfit) {
      violations.push('Take-Profit target is required by your Trading Plan.');
    } else {
      passedRules.push('Take-Profit target defined.');
    }
  }

  // 5. Minimum R:R Ratio
  if (trade.riskRewardRatio !== undefined && trade.riskRewardRatio > 0) {
    if (trade.riskRewardRatio < plan.minRiskRewardRatio) {
      violations.push(
        `Risk:Reward (1:${trade.riskRewardRatio.toFixed(2)}) is below plan minimum of 1:${plan.minRiskRewardRatio}.`
      );
    } else {
      passedRules.push(`R:R (1:${trade.riskRewardRatio.toFixed(2)}) meets minimum 1:${plan.minRiskRewardRatio}.`);
    }
  }

  // 6. Preferred Crypto Pairs Check
  if (trade.pair && plan.preferredCryptos && plan.preferredCryptos.length > 0) {
    const cleanPair = trade.pair.replace('/', '').toUpperCase().trim();
    const isPreferred = plan.preferredCryptos.some((p) => p.replace('/', '').toUpperCase().trim() === cleanPair);
    if (!isPreferred && cleanPair !== '') {
      warnings.push(`Pair ${cleanPair} is not listed in your approved preferred cryptos.`);
    } else if (isPreferred) {
      passedRules.push(`Pair ${cleanPair} is in approved watchlist.`);
    }
  }

  // 7. Allowed Setups Check
  if (trade.setup && plan.allowedSetups && plan.allowedSetups.length > 0) {
    const isAllowed = plan.allowedSetups.some((s) => s.toLowerCase() === trade.setup?.toLowerCase());
    if (!isAllowed && trade.setup.trim() !== '') {
      warnings.push(`Setup "${trade.setup}" is outside your defined playbook setups.`);
    } else if (isAllowed) {
      passedRules.push(`Setup "${trade.setup}" is in approved playbook.`);
    }
  }

  // 8. Kill Switch Check
  if (plan.killSwitchActive) {
    violations.push('KILL SWITCH ACTIVE: Daily risk limit has been hit. No new trades permitted today.');
  }

  const isCompliant = violations.length === 0;

  return {
    isCompliant,
    violations,
    warnings,
    passedRules,
  };
}

export function estimatePositionLiquidation(
  entryPrice: number,
  direction: 'LONG' | 'SHORT',
  leverage: number,
  maintenanceMarginPct: number = 0.5
): { liquidationPrice: number; distancePct: number } {
  const mmr = (maintenanceMarginPct || 0.5) / 100;
  const lev = Math.max(1, leverage);
  let liq = 0;
  if (direction === 'LONG') {
    liq = entryPrice * (1 - (1 / lev) + mmr);
    liq = Math.max(0, liq);
  } else {
    liq = entryPrice * (1 + (1 / lev) - mmr);
  }
  const distancePct = entryPrice > 0 ? (Math.abs(entryPrice - liq) / entryPrice) * 100 : 0;
  return { liquidationPrice: liq, distancePct };
}

export function validatePreTradeRiskGate(params: {
  state: CalculatorState;
  result: CalculationResult;
  plan: TradingPlan;
  dailyStatus?: DailyRiskStatus;
  todayTradesCount?: number;
  currentConsecutiveLosses?: number;
  selectedSetup?: string;
}): PreTradeValidationResult {
  const { 
    state, 
    result, 
    plan, 
    dailyStatus, 
    todayTradesCount = 0, 
    currentConsecutiveLosses = 0,
    selectedSetup = 'Breakout'
  } = params;

  const startingCap = plan.startingCapital || 10000;
  const maxRiskPct = plan.maxRiskPerTrade || 2.0;
  const maxRiskAmount = (startingCap * maxRiskPct) / 100;
  const maxLev = plan.maxLeverage || 20;
  const minRR = plan.minRiskRewardRatio || 1.5;
  const maxDailyLoss = plan.maxDailyLossAmount || (startingCap * (plan.maxDailyLossPercent || 3.0)) / 100;
  const maxTradesDay = plan.maxTradesPerDay || 5;
  const maxConsecLosses = plan.maxConsecutiveLosses || 3;

  const remainingDailyRisk = dailyStatus 
    ? Math.max(0, dailyStatus.remainingLossAllowance) 
    : maxDailyLoss;

  const checklist: PreTradeValidationResult['checklist'] = [];
  const blockedReasons: PreTradeValidationResult['blockedReasons'] = [];
  const warnings: string[] = [];

  // 1. Balance check
  const hasBalance = state.accountBalance > 0;
  checklist.push({
    id: 'balance',
    title: 'Account balance funded',
    passed: hasBalance,
    detail: hasBalance ? `$${formatNumber(state.accountBalance)} USDT available` : 'Account balance must be greater than $0',
    fieldKey: 'balance',
    suggestedFix: hasBalance ? undefined : 'Enter your current trading account balance',
  });
  if (!hasBalance) {
    blockedReasons.push({
      id: 'balance-zero',
      reason: 'Account balance is $0 or unspecified.',
      fieldKey: 'balance',
      actionText: 'Enter a valid account balance to size positions correctly.',
      suggestedFix: '10000',
    });
  }

  // 2. Risk % limit check
  const riskPctPass = state.riskPercentage <= maxRiskPct && state.riskPercentage > 0;
  checklist.push({
    id: 'risk-pct',
    title: 'Risk within limit',
    passed: riskPctPass,
    detail: `${state.riskPercentage}% risk per trade (Plan max: ${maxRiskPct}%)`,
    fieldKey: 'riskPct',
    suggestedFix: riskPctPass ? undefined : `Reduce risk percentage to ${maxRiskPct}% or lower`,
  });
  if (!riskPctPass) {
    blockedReasons.push({
      id: 'risk-pct-exceeded',
      reason: `Risk is ${state.riskPercentage}%, maximum allowed is ${maxRiskPct}%.`,
      fieldKey: 'riskPct',
      actionText: `Reduce risk percentage to ${maxRiskPct}% or lower.`,
      suggestedFix: String(maxRiskPct),
    });
  }

  // 3. Leverage limit check
  const leveragePass = state.leverage <= maxLev && state.leverage >= 1;
  checklist.push({
    id: 'leverage',
    title: 'Leverage within limit',
    passed: leveragePass,
    detail: `${state.leverage}x leverage (Plan ceiling: ${maxLev}x)`,
    fieldKey: 'leverage',
    suggestedFix: leveragePass ? undefined : `Reduce leverage to ${maxLev}x or lower`,
  });
  if (!leveragePass) {
    blockedReasons.push({
      id: 'leverage-exceeded',
      reason: `Leverage is ${state.leverage}x, maximum allowed is ${maxLev}x.`,
      fieldKey: 'leverage',
      actionText: `Reduce leverage to ${maxLev}x or lower.`,
      suggestedFix: String(maxLev),
    });
  }

  // 4. Directional Stop Loss Logic
  let directionLogicPass = false;
  if (state.entryPrice > 0 && state.stopLoss > 0) {
    if (state.direction === 'LONG') {
      directionLogicPass = state.stopLoss < state.entryPrice;
    } else {
      directionLogicPass = state.stopLoss > state.entryPrice;
    }
  }

  if (state.entryPrice > 0 && state.stopLoss > 0 && !directionLogicPass) {
    blockedReasons.push({
      id: 'sl-invalid-direction',
      reason: state.direction === 'LONG'
        ? `Stop-Loss ($${formatNumber(state.stopLoss)}) must be below Entry Price ($${formatNumber(state.entryPrice)}) for LONG.`
        : `Stop-Loss ($${formatNumber(state.stopLoss)}) must be above Entry Price ($${formatNumber(state.entryPrice)}) for SHORT.`,
      fieldKey: 'stopLoss',
      actionText: state.direction === 'LONG'
        ? `Set Stop-Loss below $${formatNumber(state.entryPrice)}.`
        : `Set Stop-Loss above $${formatNumber(state.entryPrice)}.`,
    });
  }

  // 5. Stop Loss defined check
  const hasSL = state.stopLoss > 0 && directionLogicPass;
  const slRequired = plan.requireStopLoss !== false;
  const slPass = slRequired ? hasSL : true;
  checklist.push({
    id: 'stop-loss',
    title: 'Stop-loss defined & valid',
    passed: slPass,
    detail: hasSL 
      ? `SL at $${formatNumber(state.stopLoss)} (${result.priceRiskPercentage.toFixed(2)}% distance)` 
      : 'Stop-Loss is missing or violates trade direction',
    fieldKey: 'stopLoss',
    suggestedFix: slPass ? undefined : 'Specify a valid Stop-Loss price level',
  });
  if (!slPass) {
    blockedReasons.push({
      id: 'sl-missing',
      reason: 'Stop-loss is required by your trading plan.',
      fieldKey: 'stopLoss',
      actionText: 'Specify a valid Stop-Loss price to control downside risk.',
    });
  }

  // 6. Take Profit defined check
  const hasTP = state.takeProfit > 0;
  const tpRequired = plan.requireTakeProfit === true;
  const tpPass = tpRequired ? hasTP : true;
  checklist.push({
    id: 'take-profit',
    title: 'Take-profit defined',
    passed: tpPass,
    detail: hasTP 
      ? `TP at $${formatNumber(state.takeProfit)} (${result.priceRewardPercentage.toFixed(2)}% gain)` 
      : (tpRequired ? 'Mandatory Take-Profit missing' : 'Optional (Trailing / Discretionary TP)'),
    fieldKey: 'takeProfit',
    suggestedFix: tpPass ? undefined : 'Set a Take-Profit target level',
  });
  if (!tpPass) {
    blockedReasons.push({
      id: 'tp-missing',
      reason: 'Take-profit target is required by your trading plan.',
      fieldKey: 'takeProfit',
      actionText: 'Set a designated Take-Profit target price.',
    });
  }

  // 7. Risk:Reward Ratio check
  let rrPass = true;
  if (state.takeProfit > 0 && result.riskRewardRatio > 0) {
    rrPass = result.riskRewardRatio >= minRR;
    checklist.push({
      id: 'risk-reward',
      title: 'R:R acceptable',
      passed: rrPass,
      detail: `1:${result.riskRewardRatio.toFixed(2)} R:R (Plan minimum: 1:${minRR})`,
      fieldKey: 'takeProfit',
      suggestedFix: rrPass ? undefined : `Increase take-profit target to achieve at least 1:${minRR} R:R`,
    });
    if (!rrPass) {
      blockedReasons.push({
        id: 'rr-too-low',
        reason: `R:R is 1:${result.riskRewardRatio.toFixed(2)}, minimum required is 1:${minRR}.`,
        fieldKey: 'takeProfit',
        actionText: `Increase take-profit target or tighten stop-loss to reach 1:${minRR} R:R.`,
      });
    }
  } else if (tpRequired) {
    checklist.push({
      id: 'risk-reward',
      title: 'R:R acceptable',
      passed: false,
      detail: `Minimum 1:${minRR} R:R required`,
      fieldKey: 'takeProfit',
      suggestedFix: 'Set Take-Profit to calculate R:R ratio',
    });
  } else {
    checklist.push({
      id: 'risk-reward',
      title: 'R:R acceptable',
      passed: true,
      detail: 'No fixed TP target — open target execution',
    });
  }

  // 8. Daily Loss Limit & Kill Switch check
  const killSwitchTriggered = plan.killSwitchActive || (dailyStatus?.isKillSwitchActive ?? false);
  const dailyLossPass = !killSwitchTriggered && remainingDailyRisk > 0;
  checklist.push({
    id: 'daily-risk',
    title: 'Daily loss limit available',
    passed: dailyLossPass,
    detail: dailyLossPass 
      ? `$${formatNumber(remainingDailyRisk)} daily risk buffer remaining` 
      : 'Daily loss limit exhausted or kill switch active',
    suggestedFix: dailyLossPass ? undefined : 'Trading halted today to prevent account drawdown',
  });
  if (!dailyLossPass) {
    blockedReasons.push({
      id: 'daily-limit-hit',
      reason: `Daily loss limit reached ($${formatNumber(maxDailyLoss)}). Trading is halted for today.`,
      actionText: 'Step away from the screen until the next trading day.',
    });
  }

  // 9. Daily trade frequency & Consecutive losses
  if (todayTradesCount >= maxTradesDay) {
    blockedReasons.push({
      id: 'max-trades-hit',
      reason: `Today's trade count (${todayTradesCount}) reached the daily limit of ${maxTradesDay}.`,
      actionText: 'Avoid overtrading. Wait for tomorrow to execute fresh setups.',
    });
  }

  if (currentConsecutiveLosses >= maxConsecLosses) {
    blockedReasons.push({
      id: 'max-consecutive-losses',
      reason: `Current consecutive losses (${currentConsecutiveLosses}) reached maximum allowance (${maxConsecLosses}).`,
      actionText: 'Take a mandatory cooldown to reset emotional state.',
    });
  }

  // 10. Liquidation safety buffer check
  if (result.isLiqBeforeSL && state.stopLoss > 0) {
    blockedReasons.push({
      id: 'liq-before-sl',
      reason: `Estimated liquidation ($${formatNumber(result.liquidationPrice)}) is hit BEFORE your Stop-Loss ($${formatNumber(state.stopLoss)})!`,
      fieldKey: 'leverage',
      actionText: `Reduce leverage (currently ${state.leverage}x) so liquidation occurs well beyond your Stop-Loss.`,
    });
  } else if (result.distanceToLiquidationPct < (result.priceRiskPercentage + 0.5) && state.stopLoss > 0) {
    warnings.push(
      `Warning: Liquidation price ($${formatNumber(result.liquidationPrice)}) is very close to your Stop-Loss distance.`
    );
  }

  // 11. Preferred crypto check
  if (state.pair && plan.preferredCryptos && plan.preferredCryptos.length > 0) {
    const cleanPair = state.pair.replace('/', '').toUpperCase().trim();
    const isPreferred = plan.preferredCryptos.some((p) => p.replace('/', '').toUpperCase().trim() === cleanPair);
    if (!isPreferred && cleanPair !== '') {
      warnings.push(`Crypto pair ${cleanPair} is not in your allowed trading plan watchlist.`);
    }
  }

  // 12. Allowed setup check
  if (selectedSetup && plan.allowedSetups && plan.allowedSetups.length > 0) {
    const isAllowedSetup = plan.allowedSetups.some((s) => s.toLowerCase() === selectedSetup.toLowerCase());
    if (!isAllowedSetup && selectedSetup.trim() !== '') {
      warnings.push(`Setup "${selectedSetup}" is not in your documented playbook.`);
    }
  }

  // 13. Trading Plan Compliance summary check
  const isApproved = blockedReasons.length === 0;
  checklist.push({
    id: 'plan-compliant',
    title: 'Trading plan compliant',
    passed: isApproved,
    detail: isApproved 
      ? 'All risk boundaries, sizing rules, and parameters verified' 
      : `${blockedReasons.length} critical rule violation(s) detected`,
  });

  return {
    isApproved,
    status: isApproved ? 'APPROVED' : 'BLOCKED',
    checklist,
    blockedReasons,
    warnings,
    metrics: {
      accountBalance: state.accountBalance,
      riskPercentage: state.riskPercentage,
      riskAmount: result.riskAmount,
      maxRiskAllowedPct: maxRiskPct,
      maxRiskAllowedAmount: maxRiskAmount,
      leverage: state.leverage,
      maxLeverageAllowed: maxLev,
      riskRewardRatio: result.riskRewardRatio,
      minRiskRewardAllowed: minRR,
      dailyLossLimit: maxDailyLoss,
      remainingDailyRisk,
      todayTradesCount,
      maxTradesPerDay: maxTradesDay,
      currentConsecutiveLosses,
      maxConsecutiveLosses: maxConsecLosses,
      isLiqBeforeSL: result.isLiqBeforeSL,
      distanceToLiqPct: result.distanceToLiquidationPct,
      preferredCryptos: plan.preferredCryptos || [],
      allowedSetups: plan.allowedSetups || [],
    },
  };
}

export function calculatePortfolioExposure(
  positions: OpenPosition[],
  accountBalance: number = 10000,
  plan?: TradingPlan
): PortfolioExposureMetrics {
  const validBalance = Math.max(1, accountBalance);
  let totalNotional = 0;
  let totalMargin = 0;
  let totalRisk = 0;
  let totalUnrealizedPnl = 0;
  let longNotional = 0;
  let shortNotional = 0;
  let leverageSum = 0;

  const groupMap: Record<string, {
    notional: number;
    risk: number;
    count: number;
    pairs: Set<string>;
    longs: number;
    shorts: number;
  }> = {};

  for (const pos of positions) {
    const notional = pos.positionSize || (pos.quantity * (pos.currentPrice || pos.entryPrice));
    const margin = pos.margin || (pos.leverage > 0 ? notional / pos.leverage : notional);
    
    // Risk amount = dollar loss if Stop Loss is hit
    let risk = pos.riskAmount;
    if ((risk === undefined || risk <= 0) && pos.stopLoss > 0 && pos.quantity > 0) {
      risk = pos.quantity * Math.abs(pos.entryPrice - pos.stopLoss);
    }
    risk = Math.max(0, risk || 0);

    // Unrealized PnL
    let pnl = pos.unrealizedPnl;
    if (pnl === undefined && pos.currentPrice > 0 && pos.quantity > 0) {
      if (pos.direction === 'LONG') {
        pnl = pos.quantity * (pos.currentPrice - pos.entryPrice);
      } else {
        pnl = pos.quantity * (pos.entryPrice - pos.currentPrice);
      }
    }
    pnl = pnl || 0;

    totalNotional += notional;
    totalMargin += margin;
    totalRisk += risk;
    totalUnrealizedPnl += pnl;
    leverageSum += (pos.leverage || 10) * notional;

    if (pos.direction === 'LONG') {
      longNotional += notional;
    } else {
      shortNotional += notional;
    }

    // Correlated Group aggregation
    const grp = (pos.correlationGroup || (pos.pair.startsWith('BTC') ? 'BTC-Related' : 'Altcoins')).trim();
    if (!groupMap[grp]) {
      groupMap[grp] = { notional: 0, risk: 0, count: 0, pairs: new Set(), longs: 0, shorts: 0 };
    }
    groupMap[grp].notional += notional;
    groupMap[grp].risk += risk;
    groupMap[grp].count += 1;
    groupMap[grp].pairs.add(pos.pair);
    if (pos.direction === 'LONG') groupMap[grp].longs += 1;
    else groupMap[grp].shorts += 1;
  }

  const netExposure = longNotional - shortNotional;
  const netExposurePct = totalNotional > 0 ? (netExposure / totalNotional) * 100 : 0;
  const marginUtilizationPct = (totalMargin / validBalance) * 100;
  const totalAccountRiskPct = (totalRisk / validBalance) * 100;
  const totalUnrealizedPnlPct = validBalance > 0 ? (totalUnrealizedPnl / validBalance) * 100 : 0;
  const avgLeverage = totalNotional > 0 ? leverageSum / totalNotional : 0;

  // Multi-factor Portfolio Risk Status
  let portfolioRiskTier: PortfolioRiskTier = 'NORMAL';
  const riskWarnings: string[] = [];

  if (totalAccountRiskPct > 8 || marginUtilizationPct > 80 || (totalNotional / validBalance) > 10) {
    portfolioRiskTier = 'EXTREME';
    riskWarnings.push('CRITICAL: Extreme aggregate risk. Total stop-loss loss exceeds 8% of equity or margin utilization exceeds 80%.');
  } else if (totalAccountRiskPct > 5 || marginUtilizationPct > 60 || (totalNotional / validBalance) > 6) {
    portfolioRiskTier = 'HIGH';
    riskWarnings.push('HIGH RISK: Account exposure or cumulative stop-loss risk is elevated. Consider taking partial profits or de-leveraging.');
  } else if (totalAccountRiskPct > 3 || marginUtilizationPct > 40 || (totalNotional / validBalance) > 3) {
    portfolioRiskTier = 'ELEVATED';
    riskWarnings.push('ELEVATED RISK: Active positions represent moderate risk. Monitor correlated crypto moves closely.');
  } else {
    portfolioRiskTier = 'NORMAL';
  }

  if (positions.length >= 3 && Math.abs(netExposurePct) > 80) {
    riskWarnings.push(`Heavy directional skew: ${netExposurePct > 0 ? 'Long' : 'Short'} bias is ${Math.abs(netExposurePct).toFixed(0)}% of open notional.`);
  }

  const correlatedGroups = Object.entries(groupMap).map(([groupName, data]) => ({
    groupName,
    positionsCount: data.count,
    notionalExposure: data.notional,
    totalRiskAmount: data.risk,
    riskPctOfAccount: (data.risk / validBalance) * 100,
    pairs: Array.from(data.pairs),
    directionSummary: `${data.longs} Long${data.longs !== 1 ? 's' : ''}, ${data.shorts} Short${data.shorts !== 1 ? 's' : ''}`,
  })).sort((a, b) => b.notionalExposure - a.notionalExposure);

  return {
    totalPositions: positions.length,
    totalNotionalExposure: totalNotional,
    totalMarginUsed: totalMargin,
    totalAccountRisk: totalRisk,
    totalAccountRiskPct,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct,
    longExposure: longNotional,
    shortExposure: shortNotional,
    netExposure,
    netExposurePct,
    marginUtilizationPct,
    avgLeverage,
    portfolioRiskTier,
    riskWarnings,
    correlatedGroups,
  };
}

export function calculateMistakeStats(trades: TradeJournalEntry[]): {
  mistakeStats: MistakeStat[];
  mostFrequent: MistakeStat | null;
  mostExpensive: MistakeStat | null;
  totalMistakesLogged: number;
} {
  const map: Record<string, {
    count: number;
    totalPnl: number;
    rSum: number;
    rCount: number;
    wins: number;
    losses: number;
    largestLoss: number;
  }> = {};

  for (const m of STANDARD_MISTAKES) {
    map[m] = { count: 0, totalPnl: 0, rSum: 0, rCount: 0, wins: 0, losses: 0, largestLoss: 0 };
  }

  let totalMistakesLogged = 0;

  for (const trade of trades) {
    const list: string[] = [];
    if (Array.isArray(trade.mistakes) && trade.mistakes.length > 0) {
      list.push(...trade.mistakes);
    }
    if (trade.mistakesMade && trade.mistakesMade.trim().length > 0) {
      // split by commas or newlines if string
      const tokens = trade.mistakesMade.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      for (const t of tokens) {
        if (!list.includes(t)) list.push(t);
      }
    }

    if (list.length > 0) {
      totalMistakesLogged += list.length;
      for (const rawM of list) {
        // match standard mistake or custom
        const matched = STANDARD_MISTAKES.find((sm) => sm.toLowerCase() === rawM.toLowerCase()) || rawM;
        if (!map[matched]) {
          map[matched] = { count: 0, totalPnl: 0, rSum: 0, rCount: 0, wins: 0, losses: 0, largestLoss: 0 };
        }
        map[matched].count += 1;
        map[matched].totalPnl += trade.pnl;
        if (trade.rMultiple !== undefined) {
          map[matched].rSum += trade.rMultiple;
          map[matched].rCount += 1;
        }
        if (trade.isWin) map[matched].wins += 1;
        else map[matched].losses += 1;

        if (trade.pnl < 0 && Math.abs(trade.pnl) > map[matched].largestLoss) {
          map[matched].largestLoss = Math.abs(trade.pnl);
        }
      }
    }
  }

  const mistakeStats: MistakeStat[] = Object.entries(map)
    .filter(([_, data]) => data.count > 0)
    .map(([mistake, data]) => ({
      mistake,
      count: data.count,
      totalPnl: data.totalPnl,
      avgPnl: data.count > 0 ? data.totalPnl / data.count : 0,
      avgR: data.rCount > 0 ? data.rSum / data.rCount : 0,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      wins: data.wins,
      losses: data.losses,
      largestLoss: data.largestLoss,
    }))
    .sort((a, b) => b.count - a.count);

  let mostFrequent: MistakeStat | null = null;
  let mostExpensive: MistakeStat | null = null;

  if (mistakeStats.length > 0) {
    mostFrequent = mistakeStats[0]; // sorted by count
    const sortedByLoss = [...mistakeStats].sort((a, b) => a.totalPnl - b.totalPnl);
    if (sortedByLoss[0].totalPnl < 0) {
      mostExpensive = sortedByLoss[0];
    }
  }

  return {
    mistakeStats,
    mostFrequent,
    mostExpensive,
    totalMistakesLogged,
  };
}

export function formatCurrency(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '$0.00';
  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
    return '$' + formatPrice(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPrice(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '0.00';
  const abs = Math.abs(value);
  
  if (abs >= 1000) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (abs >= 1) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  }
  if (abs >= 0.01) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  }
  
  // For micro-value crypto assets (e.g. 0.00001234)
  const fixedStr = value.toFixed(10);
  const trimmed = fixedStr.replace(/(\.\d{4,}?[1-9])0+$/, '$1');
  return trimmed;
}

export function formatNumber(value: number, minDecimals: number = 2, maxDecimals: number = 4): string {
  if (isNaN(value)) return '0.00';
  if (value === 0) return '0.00';
  const abs = Math.abs(value);
  if (abs < 0.01) {
    return formatPrice(value);
  }
  if (abs < 1) {
    return value.toFixed(4);
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}
