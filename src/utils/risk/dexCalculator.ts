import { 
  CalculationResult, 
  RiskStatus, 
  RiskTier, 
  SpotDirection,
  TradingPlan
} from '../../types';
import { formatCurrency, formatNumber } from './formatting';
import { calculateTradeFees } from './feeCalculator';

export interface DexInputParams {
  accountBalance: number;
  pair?: string;
  token?: string;
  chain?: string;
  dex?: string;
  direction?: SpotDirection | 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  riskPercentage: number;
  maxCapital?: number;
  gasFee?: number; // $ manual gas fee per swap
  networkFee?: number; // $ manual network / priority fee
  dexFeePct?: number; // % swap fee (e.g. 0.30%)
  priceImpactPct?: number; // % estimated price impact
  slippagePct?: number; // % slippage tolerance (e.g. 0.5%)
  tokenLiquidity?: number; // $ total pool liquidity
  plan?: TradingPlan;
}

/**
 * On-Chain DEX Risk & Swap Sizing Engine.
 * 
 * Accounts for on-chain mechanics:
 * 1. AMM Swap Fees (e.g. 0.30% Uniswap / PancakeSwap)
 * 2. Gas & Network Priority Fees (e.g. Ethereum L1 vs Solana vs L2s)
 * 3. AMM Bonding Curve Price Impact %
 * 4. Frontrunning & Slippage Tolerance %
 * 5. Pool Liquidity Drain Warnings
 */
export function calculateDexRisk(params: DexInputParams): CalculationResult {
  const {
    accountBalance = 10000,
    pair = 'ETH/USDT',
    token = 'ETH',
    chain = 'Ethereum',
    dex = 'Uniswap',
    direction: rawDirection = 'BUY',
    entryPrice = 0,
    stopLoss = 0,
    takeProfit = 0,
    riskPercentage = 1.0,
    maxCapital,
    gasFee = 5.0,
    networkFee = 0,
    dexFeePct = 0.30,
    priceImpactPct = 0,
    slippagePct = 0.50,
    tokenLiquidity = 0,
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
      spotVenue: 'DEX',
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
      distanceToLiquidationPct: 100,
      breakevenPrice: validEntry,
      priceRiskPercentage: 0,
      priceRewardPercentage: 0,
      riskStatus: 'Safe',
      riskTier: 'Conservative',
      riskStatusDetails: ['Enter wallet balance, token entry price, and stop loss to calculate DEX swap size.'],
      isLiqBeforeSL: false,
      maxAllowedPosition: effectiveMaxCapital,
      leverageAdjustedPosition: 0,
      stopLossDistance: 0,
      takeProfitDistance: 0,
      dex: {
        chain,
        dex,
        token,
        grossProfit: 0,
        grossLoss: 0,
        tradingFee: 0,
        gasFee: gasFee * 2,
        networkFee: networkFee * 2,
        otherCosts: 0,
        totalFees: (gasFee + networkFee) * 2,
        netProfit: 0,
        netLoss: 0,
        priceImpactPct: priceImpactPct || 0,
        slippagePct: slippagePct || 0.5,
        slippageCost: 0,
        breakEvenPrice: validEntry,
        rMultiple: 0,
        warnings: ['Enter valid parameters to compute DEX execution.'],
      },
      spot: {
        venue: 'DEX',
        capitalRequired: 0,
        capitalLimitReached: false,
        sizingMethod: 'RISK_BASED',
        maxCapital: effectiveMaxCapital,
        riskPerUnit: 0,
        potentialLoss: 0,
        potentialProfit: 0,
        breakEvenPrice: validEntry,
        breakEvenDistance: 0,
        tradingFees: 0,
        gasFee: gasFee * 2,
        networkFee: networkFee * 2,
        priceImpactCost: 0,
        slippageCost: 0,
        totalExecutionFees: (gasFee + networkFee) * 2,
        tokenLiquidity,
        chain,
        dex,
      },
    };
  }

  // 1. Directional Stop Loss Checks
  let stopLossDistance = 0;
  let priceRiskPercentage = 0;

  if (isBuy) {
    if (validSL >= validEntry) {
      warnings.push('For BUY swaps, Stop Loss must be placed below the Entry Price.');
      isApproved = false;
      stopLossDistance = Math.max(Number.MIN_VALUE, validEntry - validSL);
      priceRiskPercentage = (stopLossDistance / validEntry) * 100;
    } else {
      stopLossDistance = validEntry - validSL;
      priceRiskPercentage = (stopLossDistance / validEntry) * 100;
    }
  } else {
    if (validSL <= validEntry) {
      warnings.push('For SELL swaps, Stop Loss must be placed above the Entry Price.');
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
  const targetRiskAmount = (effectiveBalance * validRiskPct) / 100;
  let quantity = 0;
  let positionValue = 0;
  let capitalLimitReached = false;

  if (validEntry > 0 && stopLossDistance > 0) {
    const unconstrainedQty = targetRiskAmount / stopLossDistance;
    const unconstrainedValue = unconstrainedQty * validEntry;

    if (effectiveMaxCapital > 0 && unconstrainedValue > effectiveMaxCapital) {
      capitalLimitReached = true;
      quantity = effectiveMaxCapital / validEntry;
      positionValue = effectiveMaxCapital;
      warnings.push(
        `Capital limit reached: Position was capped to your wallet balance ($${formatCurrency(effectiveMaxCapital)}).`
      );
    } else {
      quantity = unconstrainedQty;
      positionValue = unconstrainedValue;
    }
  }

  // 4. Actual Risk & Potential Gross Loss/Reward
  const potentialLoss = stopLossDistance > 0 ? quantity * stopLossDistance : 0;
  const actualRiskAmount = potentialLoss > 0 ? potentialLoss : targetRiskAmount;
  const potentialProfit = takeProfitDistance > 0 ? quantity * takeProfitDistance : 0;
  const riskRewardRatio = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;

  // 5. On-Chain Fees, Gas & Friction
  const fees = calculateTradeFees({
    positionValue,
    gasFee,
    networkFee,
    dexFeePct,
    priceImpactPct,
    slippagePct,
  });

  const entryFee = fees.entryFee;
  const exitFee = fees.exitFee;
  const dexTradingFeeUSD = fees.totalTradingFees;
  const totalOnChainFees = fees.totalOnChainFees;
  const priceImpactUSD = fees.priceImpactCost;
  const slippageToleranceUSD = fees.estimatedSlippageCost;
  const totalDEXCost = fees.totalDEXCost;

  // Net Profit & Net Loss
  const netProfit = Math.max(0, potentialProfit - totalDEXCost);
  const netLoss = potentialLoss + totalDEXCost;

  // Breakeven price calculation
  const fixedFeePerUnit = quantity > 0 ? totalOnChainFees / quantity : 0;
  const variableCostRate = ((dexFeePct || 0.3) / 100) * 2 + ((slippagePct || 0.5) / 100) * 2 + ((priceImpactPct || 0) / 100);
  const breakevenPrice = isBuy
    ? (validEntry * (1 + variableCostRate)) + fixedFeePerUnit
    : (validEntry * (1 - variableCostRate)) - fixedFeePerUnit;

  // 6. DEX Safeguard Checks & Warnings
  let highImpactWarning = false;
  let liquidityWarning = false;

  if (priceImpactPct > 2.0) {
    highImpactWarning = true;
    warnings.push(`High AMM Price Impact (${priceImpactPct.toFixed(2)}%): Swap will move pool price significantly.`);
  }

  if (slippagePct > 2.0) {
    warnings.push(`Elevated Slippage Tolerance (${slippagePct.toFixed(2)}%): Vulnerable to MEV front-running.`);
  }

  const feeDragPct = potentialProfit > 0 ? (totalDEXCost / potentialProfit) * 100 : 0;
  if (potentialProfit > 0 && feeDragPct > 50) {
    warnings.push(`Severe fee drag: On-chain gas & DEX fees consume ${feeDragPct.toFixed(1)}% of your gross target profit!`);
  } else if (potentialProfit > 0 && feeDragPct > 25) {
    warnings.push(`Moderate fee drag: Fees consume ${feeDragPct.toFixed(1)}% of gross profit.`);
  }

  if (positionValue > 0 && (totalOnChainFees / positionValue) > 0.05) {
    warnings.push(`Gas fees ($${totalOnChainFees.toFixed(2)}) exceed 5% of swap volume. Consider an L2 or larger size.`);
  }

  if (tokenLiquidity > 0 && positionValue > 0) {
    const liquidityRatio = (positionValue / tokenLiquidity) * 100;
    if (liquidityRatio > 5.0) {
      liquidityWarning = true;
      warnings.push(`Low Liquidity Warning: Swap represents ${liquidityRatio.toFixed(1)}% of total pool liquidity!`);
    }
  }

  // Risk Tier & Status
  let riskTier: RiskTier = 'Conservative';
  if (validRiskPct > 5.0 || highImpactWarning || liquidityWarning) riskTier = 'Extreme';
  else if (validRiskPct > 2.0 || priceImpactPct > 1.0 || feeDragPct > 35) riskTier = 'High';
  else if (validRiskPct > 1.0 || (slippagePct || 0) > 1.0) riskTier = 'Elevated';

  let riskStatus: RiskStatus = 'Safe';
  if (!isApproved || validRiskPct > 5.0 || liquidityWarning || priceImpactPct > 10.0) {
    riskStatus = 'Danger';
  } else if (validRiskPct > 2.0 || highImpactWarning || feeDragPct > 30) {
    riskStatus = 'High';
  }

  const riskStatusDetails: string[] = [...warnings];
  riskStatusDetails.push(
    'DEX execution warning: On-chain swaps are executed via AMM pools. Final fill price may deviate due to block latency, slippage, and price impact.'
  );

  const rMultiple = actualRiskAmount > 0 ? potentialProfit / actualRiskAmount : 0;

  return {
    tradingMode: 'SPOT',
    spotVenue: 'DEX',
    marginRequired: positionValue,
    positionSize: positionValue,
    quantity,
    riskAmount: actualRiskAmount,
    reward: potentialProfit,
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
    feeImpact: totalDEXCost,
    entryFee: entryFee + (fees.gasCost + fees.networkCost) / 2,
    exitFee: exitFee + (fees.gasCost + fees.networkCost) / 2,
    estimatedFundingCost: 0,
    estimatedSlippageCost: slippageToleranceUSD,
    netProfit,
    netLoss,
    liquidationPrice: 0,
    distanceToLiquidationPct: 100,
    breakevenPrice: Number(breakevenPrice.toFixed(6)),
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
    dex: {
      chain,
      dex,
      token,
      grossProfit: potentialProfit,
      grossLoss: potentialLoss,
      tradingFee: dexTradingFeeUSD,
      gasFee: fees.gasCost,
      networkFee: fees.networkCost,
      otherCosts: priceImpactUSD,
      totalFees: totalDEXCost,
      netProfit,
      netLoss,
      priceImpactPct,
      slippagePct,
      slippageCost: slippageToleranceUSD,
      breakEvenPrice: Number(breakevenPrice.toFixed(6)),
      rMultiple: Number(rMultiple.toFixed(2)),
      warnings,
    },
    spot: {
      venue: 'DEX',
      capitalRequired: positionValue,
      capitalLimitReached,
      sizingMethod: 'RISK_BASED',
      maxCapital: effectiveMaxCapital,
      riskPerUnit: stopLossDistance,
      potentialLoss,
      potentialProfit,
      breakEvenPrice: Number(breakevenPrice.toFixed(6)),
      breakEvenDistance: Math.abs(breakevenPrice - validEntry),
      tradingFees: dexTradingFeeUSD,
      gasFee: fees.gasCost,
      networkFee: fees.networkCost,
      priceImpactCost: priceImpactUSD,
      slippageCost: slippageToleranceUSD,
      totalExecutionFees: totalDEXCost,
      tokenLiquidity,
      chain,
      dex,
    }
  };
}
