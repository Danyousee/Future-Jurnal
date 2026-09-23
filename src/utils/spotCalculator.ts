import { 
  CalculationResult, 
  RiskStatus, 
  RiskTier, 
  SpotDirection,
  SpotSizingMethod,
  SpotVenue
} from '../types';

export const COMMON_SPOT_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'BNB/USDT',
  'ADA/USDT',
  'AVAX/USDT',
  'LINK/USDT',
  'DOGE/USDT',
  'SUI/USDT',
  'NEAR/USDT',
  'PEPE/USDT'
];

export interface DexChainConfig {
  name: string;
  defaultGasFee: number;
  nativeCurrency: string;
  popularDexes: string[];
}

export const DEX_CHAINS: Record<string, DexChainConfig> = {
  Ethereum: {
    name: 'Ethereum',
    defaultGasFee: 8.50,
    nativeCurrency: 'ETH',
    popularDexes: ['Uniswap', 'Curve', 'SushiSwap', 'Balancer'],
  },
  'BNB Chain': {
    name: 'BNB Chain',
    defaultGasFee: 0.15,
    nativeCurrency: 'BNB',
    popularDexes: ['PancakeSwap', 'BiSwap', 'THENA'],
  },
  Solana: {
    name: 'Solana',
    defaultGasFee: 0.01,
    nativeCurrency: 'SOL',
    popularDexes: ['Raydium', 'Orca', 'Jupiter', 'Meteora'],
  },
  Arbitrum: {
    name: 'Arbitrum',
    defaultGasFee: 0.10,
    nativeCurrency: 'ETH',
    popularDexes: ['Uniswap', 'Camelot', 'Trader Joe', 'Curve'],
  },
  Base: {
    name: 'Base',
    defaultGasFee: 0.05,
    nativeCurrency: 'ETH',
    popularDexes: ['Aerodrome', 'Uniswap', 'BaseSwap'],
  },
  Polygon: {
    name: 'Polygon',
    defaultGasFee: 0.02,
    nativeCurrency: 'POL',
    popularDexes: ['QuickSwap', 'Uniswap', 'Curve'],
  },
};

export const DEX_CHAIN_NAMES = Object.keys(DEX_CHAINS);

export const COMMON_DEX_TOKENS = [
  'PEPE',
  'UNI',
  'AERO',
  'RAY',
  'CAKE',
  'WETH',
  'SOL',
  'PENDLE',
  'ARB',
  'LINK',
  'BONK',
  'WIF',
];

export const COMMON_DEX_WALLETS = [
  'MetaMask',
  'Phantom',
  'Rabby',
  'Coinbase Wallet',
  'Trust Wallet',
  'Backpack',
  'Other',
];

export const COMMON_DEX_PROTOCOLS = [
  'Uniswap',
  'Raydium',
  'PancakeSwap',
  'Aerodrome',
  'Curve',
  'Camelot',
  'Orca',
  'Trader Joe',
  'Jupiter',
  'Other',
];

export const DEX_SLIPPAGE_PRESETS = [0.1, 0.5, 1.0, 2.0, 3.0];
export const DEX_FEE_PRESETS = [0.05, 0.25, 0.30, 1.00];

export interface SpotInputParams {
  accountBalance: number;
  venue?: SpotVenue; // 'CEX' | 'DEX' - default 'CEX'
  pair?: string;
  direction?: SpotDirection | 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPercentage: number;
  maxCapital?: number;
  sizingMethod?: SpotSizingMethod;
  feeRate?: number; // CEX percentage, e.g. 0.055 or 0.10
  slippagePct?: number; // percentage, e.g. 0.05 for CEX, 0.5 for DEX
  // DEX-specific execution parameters (added on top of standard Spot calculations when venue === 'DEX')
  chain?: string;
  dex?: string;
  token?: string;
  tokenLiquidity?: number;
  gasFee?: number; // $ manual gas fee per swap
  networkFee?: number; // $ manual network / priority fee
  dexFeePct?: number; // % fee (e.g. 0.30%)
  priceImpactPct?: number; // % estimated price impact
}

/**
 * Unified Spot Risk & Position Sizing Engine.
 * Serves BOTH CEX Spot and DEX Spot venues without duplicating position sizing logic.
 * 
 * Flow:
 * Balance -> Risk % -> Risk Amount -> Entry + SL -> Quantity & Position Value
 * Then applies execution-related parameters:
 * - For CEX: Standard exchange trading fees + minor execution slippage.
 * - For DEX: DEX swap fee %, on-chain gas/network fees (round-trip), price impact %, and slippage %.
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
    feeRate = 0.055,
    slippagePct,
    chain = 'Ethereum',
    dex = 'Uniswap',
    token,
    tokenLiquidity,
    gasFee = 5.0,
    networkFee = 0,
    dexFeePct = 0.30,
    priceImpactPct = 0,
  } = params;

  const direction: SpotDirection = (rawDirection === 'SHORT' || rawDirection === 'SELL') ? 'SELL' : 'BUY';
  const isBuy = direction === 'BUY';
  const isDex = venue === 'DEX';

  const effectiveBalance = Math.max(0, accountBalance);
  const effectiveMaxCapital = (maxCapital !== undefined && maxCapital > 0) 
    ? Math.min(maxCapital, effectiveBalance || maxCapital)
    : effectiveBalance;

  const warnings: string[] = [];
  let isApproved = true;

  // Basic validation
  if (effectiveBalance <= 0) {
    warnings.push('Account balance must be greater than zero.');
    isApproved = false;
  }
  if (entryPrice <= 0) {
    warnings.push('Entry price must be greater than zero.');
    isApproved = false;
  }

  // Directional checks
  let stopLossDistance = 0;
  let priceRiskPercentage = 0;

  if (entryPrice > 0 && stopLoss > 0) {
    if (isBuy) {
      if (stopLoss >= entryPrice) {
        warnings.push('For BUY (Long), Stop Loss must be placed below the Entry Price.');
        isApproved = false;
      } else {
        stopLossDistance = entryPrice - stopLoss;
        priceRiskPercentage = (stopLossDistance / entryPrice) * 100;
      }
    } else {
      // SELL / Short liquidation of spot asset
      if (stopLoss <= entryPrice) {
        warnings.push('For SELL, Stop Loss must be placed above the Entry Price.');
        isApproved = false;
      } else {
        stopLossDistance = stopLoss - entryPrice;
        priceRiskPercentage = (stopLossDistance / entryPrice) * 100;
      }
    }
  } else if (stopLoss <= 0) {
    warnings.push('Stop Loss is required for strict risk calculation.');
    isApproved = false;
  }

  // Take Profit checks
  let takeProfitDistance = 0;
  let priceRewardPercentage = 0;
  if (entryPrice > 0 && takeProfit > 0) {
    if (isBuy) {
      if (takeProfit > entryPrice) {
        takeProfitDistance = takeProfit - entryPrice;
        priceRewardPercentage = (takeProfitDistance / entryPrice) * 100;
      } else {
        warnings.push('For BUY, Take Profit must be above the Entry Price.');
      }
    } else {
      if (takeProfit < entryPrice) {
        takeProfitDistance = entryPrice - takeProfit;
        priceRewardPercentage = (takeProfitDistance / entryPrice) * 100;
      } else {
        warnings.push('For SELL, Take Profit must be below the Entry Price.');
      }
    }
  }

  // Position Sizing (Shared between CEX and DEX)
  const targetRiskAmount = (effectiveBalance * Math.max(0, riskPercentage)) / 100;
  let quantity = 0;
  let positionValue = 0;
  let capitalLimitReached = false;

  if (entryPrice > 0 && stopLossDistance > 0) {
    if (sizingMethod === 'RISK_BASED') {
      // Target sizing from risk per unit
      const unconstrainedQty = targetRiskAmount / stopLossDistance;
      const unconstrainedValue = unconstrainedQty * entryPrice;

      if (effectiveMaxCapital > 0 && unconstrainedValue > effectiveMaxCapital) {
        // Capped by maximum capital
        capitalLimitReached = true;
        quantity = effectiveMaxCapital / entryPrice;
        positionValue = effectiveMaxCapital;
        warnings.push(
          `Capital limit reached: Position was capped to your maximum available capital ($${effectiveMaxCapital.toLocaleString()}).`
        );
      } else {
        quantity = unconstrainedQty;
        positionValue = unconstrainedValue;
      }
    } else {
      // Capital-Based sizing
      positionValue = effectiveMaxCapital;
      quantity = effectiveMaxCapital / entryPrice;
    }
  } else if (entryPrice > 0 && sizingMethod === 'CAPITAL_BASED') {
    positionValue = effectiveMaxCapital;
    quantity = effectiveMaxCapital / entryPrice;
  }

  // Actual Risk & Potential Gross Loss
  const potentialLoss = stopLossDistance > 0 ? quantity * stopLossDistance : 0;
  const actualRiskAmount = potentialLoss > 0 ? potentialLoss : targetRiskAmount;

  // Potential Gross Profit
  const potentialProfit = takeProfitDistance > 0 ? quantity * takeProfitDistance : 0;

  // Execution Parameters & Costs (CEX vs DEX)
  let entryFee = 0;
  let exitFee = 0;
  let tradingFees = 0;
  let estimatedSlippageCost = 0;
  let effectiveSlippagePct = 0;
  let priceImpactCost = 0;
  let totalGasAndNetwork = 0;
  let totalExecutionFees = 0;

  if (isDex) {
    // Spot DEX Execution
    const effectiveFeeRate = dexFeePct !== undefined ? Math.max(0, dexFeePct) : 0.30;
    effectiveSlippagePct = slippagePct !== undefined ? Math.max(0, slippagePct) : 0.50;
    const effectivePriceImpact = Math.max(0, priceImpactPct || 0);

    // Swap fees (entry + exit)
    entryFee = positionValue * (effectiveFeeRate / 100);
    const projectedExitValue = takeProfit > 0 ? quantity * takeProfit : positionValue;
    exitFee = projectedExitValue * (effectiveFeeRate / 100);
    tradingFees = entryFee + exitFee;

    // Slippage (estimated 2-way entry and exit swap slippage)
    estimatedSlippageCost = positionValue * (effectiveSlippagePct / 100) * 2;

    // Price Impact cost
    priceImpactCost = positionValue * (effectivePriceImpact / 100);

    // Gas & Network Fees (entry swap + exit swap = 2 transactions)
    const singleTxGas = Math.max(0, gasFee) + Math.max(0, networkFee);
    totalGasAndNetwork = singleTxGas * 2;

    // Total Execution Friction
    totalExecutionFees = tradingFees + estimatedSlippageCost + priceImpactCost + totalGasAndNetwork;

    // DEX Warnings
    if (effectivePriceImpact >= 1.0) {
      warnings.push(`High price impact (${effectivePriceImpact.toFixed(2)}%): Token pool depth may be thin, leading to execution losses.`);
    }
    if (effectiveSlippagePct >= 2.0) {
      warnings.push(`High slippage tolerance (${effectiveSlippagePct.toFixed(2)}%): Exposes your transaction to MEV sandwich bots.`);
    }
    if (tokenLiquidity && tokenLiquidity > 0 && positionValue > tokenLiquidity * 0.02) {
      warnings.push(`Position size ($${positionValue.toLocaleString()}) exceeds 2% of pool liquidity ($${tokenLiquidity.toLocaleString()}). Expect high slippage and adverse price impact.`);
    }
    if (potentialProfit > 0 && totalGasAndNetwork > 0) {
      const gasRatio = (totalGasAndNetwork / potentialProfit) * 100;
      if (gasRatio > 15) {
        warnings.push(`Gas & network fees ($${totalGasAndNetwork.toFixed(2)}) consume ${gasRatio.toFixed(1)}% of your gross profit.`);
      }
    }
  } else {
    // Spot CEX Execution
    const effectiveFeeRate = feeRate !== undefined ? Math.max(0, feeRate) : 0.055;
    effectiveSlippagePct = slippagePct !== undefined ? Math.max(0, slippagePct) : 0.05;

    entryFee = positionValue * (effectiveFeeRate / 100);
    const projectedExitValue = takeProfit > 0 ? quantity * takeProfit : positionValue;
    exitFee = projectedExitValue * (effectiveFeeRate / 100);
    tradingFees = entryFee + exitFee;

    estimatedSlippageCost = positionValue * (effectiveSlippagePct / 100) * 2;
    priceImpactCost = 0;
    totalGasAndNetwork = 0;
    totalExecutionFees = tradingFees + estimatedSlippageCost;
  }

  // Net Profit & Net Loss
  const netProfit = Math.max(0, potentialProfit - totalExecutionFees);
  const netLoss = potentialLoss + totalExecutionFees;

  // Risk / Reward Ratio (based on net outcome)
  const riskRewardRatio = netLoss > 0 ? netProfit / netLoss : (potentialLoss > 0 ? potentialProfit / potentialLoss : 0);

  // Break-even Price (including all execution friction)
  let breakevenPrice = entryPrice;
  if (quantity > 0 && entryPrice > 0) {
    if (isBuy) {
      breakevenPrice = (positionValue + totalExecutionFees) / quantity;
    } else {
      breakevenPrice = Math.max(0, (positionValue - totalExecutionFees) / quantity);
    }
  }

  // Risk Tier & Status
  let riskTier: RiskTier = 'Conservative';
  if (riskPercentage > 5.0) riskTier = 'Extreme';
  else if (riskPercentage > 2.0) riskTier = 'High';
  else if (riskPercentage > 1.0) riskTier = 'Elevated';

  let riskStatus: RiskStatus = 'Safe';
  if (riskPercentage > 5.0 || warnings.length > 2) {
    riskStatus = 'Danger';
  } else if (riskPercentage > 2.0 || capitalLimitReached) {
    riskStatus = 'High';
  }

  const riskStatusDetails: string[] = [...warnings];
  if (capitalLimitReached) {
    riskStatusDetails.push('Capital constrained: recommended position size adjusted to stay within Max Capital.');
  }
  if (riskRewardRatio > 0 && riskRewardRatio < 1.0) {
    riskStatusDetails.push('Risk/Reward is below 1:1. Trade setup has negative asymmetry.');
  }

  return {
    tradingMode: 'SPOT',
    spotVenue: venue,
    marginRequired: positionValue, // In Spot, 100% of capital is required (no leverage)
    positionSize: positionValue,
    quantity: Number(quantity.toFixed(8)),
    riskAmount: actualRiskAmount,
    reward: potentialProfit,
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
    feeImpact: tradingFees + totalGasAndNetwork + priceImpactCost,
    entryFee,
    exitFee,
    estimatedFundingCost: 0, // Spot has NO perpetual funding
    estimatedSlippageCost,
    netProfit,
    netLoss,
    liquidationPrice: 0, // Spot has NO liquidation
    distanceToLiquidationPct: 0,
    breakevenPrice: Number(breakevenPrice.toFixed(6)),
    priceRiskPercentage: Number(priceRiskPercentage.toFixed(2)),
    priceRewardPercentage: Number(priceRewardPercentage.toFixed(2)),
    riskStatus,
    riskTier,
    riskStatusDetails,
    isLiqBeforeSL: false, // Not applicable in Spot
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
      breakEvenPrice: Number(breakevenPrice.toFixed(6)),
      breakEvenDistance: Math.abs(breakevenPrice - entryPrice),
      tradingFees,
      gasFee: isDex ? gasFee : 0,
      networkFee: isDex ? networkFee : 0,
      priceImpactCost,
      slippageCost: estimatedSlippageCost,
      totalExecutionFees,
      tokenLiquidity,
      chain: isDex ? chain : undefined,
      dex: isDex ? dex : undefined,
    },
    // Populate dex field if DEX venue is selected so existing components stay 100% compatible
    ...(isDex ? {
      dex: {
        chain,
        dex,
        token: token || pair || 'TOKEN',
        grossProfit: potentialProfit,
        grossLoss: potentialLoss,
        tradingFee: tradingFees,
        gasFee,
        networkFee,
        otherCosts: estimatedSlippageCost + priceImpactCost,
        totalFees: totalExecutionFees,
        netProfit,
        netLoss,
        priceImpactPct,
        slippagePct: effectiveSlippagePct,
        slippageCost: estimatedSlippageCost,
        breakEvenPrice: Number(breakevenPrice.toFixed(6)),
        rMultiple: Number(riskRewardRatio.toFixed(2)),
        warnings,
      }
    } : {})
  };
}
