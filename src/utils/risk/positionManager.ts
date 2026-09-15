import { 
  OpenPosition, 
  TradeJournalEntry, 
  PortfolioRiskSummary, 
  TradingPlan, 
  TradeDirection,
  TradingMode,
  MarketPrice
} from '../../types';
import { db } from '../../db/journalDb';
import { cleanSymbol, parseSymbol, buildMarketContextKey } from '../../services/marketData/symbolNormalizer';

export type PositionStatus = 
  | 'OPEN'
  | 'PROFITABLE'
  | 'LOSING'
  | 'NEAR STOP'
  | 'NEAR TAKE PROFIT'
  | 'STOP HIT'
  | 'TAKE PROFIT HIT'
  | 'CLOSED';

export interface EnrichedPosition extends OpenPosition {
  status: PositionStatus;
  statusColor: string;
  statusBadge: string;
  grossPnl: number;
  totalFees: number;
  netPnl: number;
  netPnlPct: number;
  currentRMultiple: number;
  distanceToStopLossPct: number;
  distanceToStopLossAmount: number;
  distanceToTakeProfitPct?: number;
  distanceToTakeProfitAmount?: number;
  progressToTargetPct?: number; // 0 to 100% between entry and TP
  progressToStopPct?: number;   // 0 to 100% between entry and SL
  isStale: boolean;
  priceSource: string;
  isPriceLive: boolean;
  priceStatus?: 'LIVE' | 'REFERENCE' | 'MANUAL' | 'STALE' | 'UNAVAILABLE';
}

export interface ClosePositionParams {
  positionId: number;
  exitPrice: number;
  exitDate?: string;
  actualFees?: number;
  slippageCost?: number;
  exitReason: string;
  notes?: string;
  emotionAfter?: any;
  disciplineRating?: number;
  mistakes?: string[];
}

/**
 * Calculates real-time enriched metrics for an individual open position.
 * Optionally overlays live market price if provided.
 */
export function enrichOpenPosition(
  pos: OpenPosition,
  marketPrices?: Record<string, MarketPrice>
): EnrichedPosition {
  const rawPair = (pos.pair || '').trim();
  const clean = cleanSymbol(rawPair);
  const parsed = parseSymbol(rawPair);
  const mode = pos.tradeMode || (pos.leverage > 1 ? 'PERPETUAL' : 'SPOT');
  const isDex = pos.spotVenue === 'DEX' || mode === 'DEX';

  // Check if live or override price is available in marketPrices
  let liveData: MarketPrice | undefined;
  if (marketPrices && rawPair) {
    const contextKey = buildMarketContextKey(rawPair, { 
      mode: pos.tradeMode as any, 
      spotVenue: pos.spotVenue 
    });
    liveData = marketPrices[contextKey] ||
               marketPrices[clean] || 
               marketPrices[rawPair] || 
               marketPrices[parsed.normalized] ||
               marketPrices[parsed.displayPair] ||
               Object.values(marketPrices).find(m => cleanSymbol(m.symbol) === clean);
  }

  const currentPrice = (liveData && liveData.price > 0)
    ? liveData.price
    : (pos.currentPrice > 0 ? pos.currentPrice : pos.entryPrice);

  const isPriceLive = liveData ? liveData.isLive : (pos.isPriceLive ?? false);
  
  let defaultSource = isPriceLive ? 'Live Feed' : 'Manual Price';
  if (!isPriceLive && (!pos.currentPrice || pos.currentPrice === pos.entryPrice)) {
    if (isDex) {
      defaultSource = 'Live DEX Price Unavailable';
    } else if (mode === 'FOREX') {
      defaultSource = 'ECB Reference Rate';
    }
  }

  const priceSource = liveData 
    ? liveData.source 
    : (pos.priceSource || defaultSource);

  const latestPriceTimestamp = liveData ? liveData.timestamp : (pos.latestPriceTimestamp || null);
  const isStale = liveData 
    ? (liveData.isStale || (Date.now() - liveData.timestamp > 60000))
    : (pos.isPriceStale || (pos.latestPriceTimestamp ? (Date.now() - pos.latestPriceTimestamp > 60000) : !isPriceLive));

  // Determine normalized PriceStatusType
  let priceStatus: 'LIVE' | 'REFERENCE' | 'MANUAL' | 'STALE' | 'UNAVAILABLE' = 'MANUAL';
  if (liveData?.status) {
    priceStatus = liveData.status;
  } else if (isDex && !isPriceLive && (!pos.currentPrice || pos.currentPrice === pos.entryPrice)) {
    priceStatus = 'UNAVAILABLE';
  } else if (mode === 'FOREX' || priceSource.includes('Reference') || priceSource.includes('ECB')) {
    priceStatus = 'REFERENCE';
  } else if (isPriceLive && !isStale) {
    priceStatus = 'LIVE';
  } else if (isStale && (pos.latestPriceTimestamp || liveData)) {
    priceStatus = 'STALE';
  } else if (pos.currentPrice && pos.currentPrice !== pos.entryPrice) {
    priceStatus = 'MANUAL';
  } else if (isDex) {
    priceStatus = 'UNAVAILABLE';
  } else {
    priceStatus = 'MANUAL';
  }

  const entryPrice = pos.entryPrice;
  const isLong = pos.direction === 'LONG';
  const quantity = pos.quantity || (entryPrice > 0 ? (pos.positionSize / entryPrice) : 0);

  // 1. Gross P/L calculation based on market type
  let grossPnl = 0;
  if (mode === 'FOREX') {
    const pipSize = pos.pipSize || (pos.pair.includes('JPY') ? 0.01 : 0.0001);
    const pipValuePerLot = pos.pipValue || 10;
    const lotSize = pos.lotSize || (pos.positionSize / 100000);
    const pipsChange = isLong 
      ? (currentPrice - entryPrice) / pipSize 
      : (entryPrice - currentPrice) / pipSize;
    grossPnl = pipsChange * pipValuePerLot * lotSize;
  } else {
    // Perpetual, Spot CEX, or DEX
    if (isLong) {
      grossPnl = (currentPrice - entryPrice) * quantity;
    } else {
      grossPnl = (entryPrice - currentPrice) * quantity;
    }
  }

  // 2. Estimated fees
  let totalFees = pos.feesPaid || 0;
  if (totalFees === 0) {
    if (mode === 'DEX') {
      const gas = pos.dexGasFee || 5;
      const dexFee = (pos.positionSize * 0.003) * 2; // in & out ~0.3%
      totalFees = gas + dexFee;
    } else if (mode === 'FOREX') {
      const lotSize = pos.lotSize || 1;
      const commission = 7 * lotSize; // round turn ~$7/lot
      totalFees = commission;
    } else if (mode === 'PERPETUAL') {
      // 0.05% taker in and out
      totalFees = pos.positionSize * 0.0005 * 2;
    } else {
      // Spot 0.1% in and out
      totalFees = pos.positionSize * 0.001 * 2;
    }
  }

  const netPnl = grossPnl - totalFees;
  const capitalBase = pos.margin > 0 ? pos.margin : (pos.positionSize > 0 ? pos.positionSize : 1);
  const netPnlPct = (netPnl / capitalBase) * 100;
  const currentRMultiple = pos.riskAmount > 0 ? (netPnl / pos.riskAmount) : 0;

  // 3. Distance & Progress to SL / TP
  const stopLoss = pos.stopLoss;
  const takeProfit = pos.takeProfit;

  const distanceToStopLossAmount = Math.abs(currentPrice - stopLoss);
  const distanceToStopLossPct = currentPrice > 0 ? (distanceToStopLossAmount / currentPrice) * 100 : 0;

  let distanceToTakeProfitAmount = 0;
  let distanceToTakeProfitPct = 0;
  if (takeProfit && takeProfit > 0) {
    distanceToTakeProfitAmount = Math.abs(takeProfit - currentPrice);
    distanceToTakeProfitPct = currentPrice > 0 ? (distanceToTakeProfitAmount / currentPrice) * 100 : 0;
  }

  // Progress metrics (0 - 100%)
  let progressToTargetPct = 0;
  let progressToStopPct = 0;

  if (takeProfit && takeProfit > 0) {
    const totalTPDistance = Math.abs(takeProfit - entryPrice);
    if (totalTPDistance > 0) {
      const currentTPDistance = isLong ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
      progressToTargetPct = Math.min(100, Math.max(0, (currentTPDistance / totalTPDistance) * 100));
    }
  }

  if (stopLoss && stopLoss > 0) {
    const totalSLDistance = Math.abs(entryPrice - stopLoss);
    if (totalSLDistance > 0) {
      const currentSLLoss = isLong ? (entryPrice - currentPrice) : (currentPrice - entryPrice);
      progressToStopPct = Math.min(100, Math.max(0, (currentSLLoss / totalSLDistance) * 100));
    }
  }

  // 4. Status determination
  let status: PositionStatus = 'OPEN';
  let statusColor = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  let statusBadge = 'OPEN';

  // Check hits
  if (isLong) {
    if (currentPrice <= stopLoss) {
      status = 'STOP HIT';
      statusColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      statusBadge = 'STOP HIT';
    } else if (takeProfit && currentPrice >= takeProfit) {
      status = 'TAKE PROFIT HIT';
      statusColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      statusBadge = 'TP HIT';
    } else {
      const slGap = Math.abs(currentPrice - stopLoss);
      const totalSlSpan = Math.abs(entryPrice - stopLoss);
      const tpGap = takeProfit ? Math.abs(takeProfit - currentPrice) : Infinity;
      const totalTpSpan = takeProfit ? Math.abs(takeProfit - entryPrice) : Infinity;

      if (totalSlSpan > 0 && (slGap / totalSlSpan) <= 0.15) {
        status = 'NEAR STOP';
        statusColor = 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse';
        statusBadge = 'NEAR STOP';
      } else if (takeProfit && totalTpSpan > 0 && (tpGap / totalTpSpan) <= 0.15) {
        status = 'NEAR TAKE PROFIT';
        statusColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse';
        statusBadge = 'NEAR TP';
      } else if (netPnl > 0) {
        status = 'PROFITABLE';
        statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        statusBadge = 'IN PROFIT';
      } else if (netPnl < 0) {
        status = 'LOSING';
        statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        statusBadge = 'IN LOSS';
      }
    }
  } else {
    // Short
    if (currentPrice >= stopLoss) {
      status = 'STOP HIT';
      statusColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      statusBadge = 'STOP HIT';
    } else if (takeProfit && currentPrice <= takeProfit) {
      status = 'TAKE PROFIT HIT';
      statusColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      statusBadge = 'TP HIT';
    } else {
      const slGap = Math.abs(stopLoss - currentPrice);
      const totalSlSpan = Math.abs(stopLoss - entryPrice);
      const tpGap = takeProfit ? Math.abs(currentPrice - takeProfit) : Infinity;
      const totalTpSpan = takeProfit ? Math.abs(entryPrice - takeProfit) : Infinity;

      if (totalSlSpan > 0 && (slGap / totalSlSpan) <= 0.15) {
        status = 'NEAR STOP';
        statusColor = 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse';
        statusBadge = 'NEAR STOP';
      } else if (takeProfit && totalTpSpan > 0 && (tpGap / totalTpSpan) <= 0.15) {
        status = 'NEAR TAKE PROFIT';
        statusColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse';
        statusBadge = 'NEAR TP';
      } else if (netPnl > 0) {
        status = 'PROFITABLE';
        statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        statusBadge = 'IN PROFIT';
      } else if (netPnl < 0) {
        status = 'LOSING';
        statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        statusBadge = 'IN LOSS';
      }
    }
  }

  return {
    ...pos,
    currentPrice,
    status,
    statusColor,
    statusBadge,
    grossPnl,
    totalFees,
    netPnl,
    netPnlPct,
    currentRMultiple,
    distanceToStopLossPct,
    distanceToStopLossAmount,
    distanceToTakeProfitPct,
    distanceToTakeProfitAmount,
    progressToTargetPct,
    progressToStopPct,
    isStale,
    priceSource,
    isPriceLive,
    priceStatus,
    latestPriceTimestamp: latestPriceTimestamp || undefined,
  };
}

/**
 * Derives comprehensive Portfolio Risk Summary across all active positions.
 * Optionally accepts live marketPrices for real-time calculation.
 */
export function calculatePortfolioRiskMetrics(
  positions: OpenPosition[],
  totalEquity: number,
  plan?: TradingPlan,
  customMaxRiskPct?: number,
  marketPrices?: Record<string, MarketPrice>
): PortfolioRiskSummary {
  const maxRiskPct = customMaxRiskPct || plan?.maxWeeklyLossPercent || 6.0;
  const maxAllowedRisk = (totalEquity * maxRiskPct) / 100;

  const enriched = positions.map((p) => enrichOpenPosition(p, marketPrices));

  const totalCapitalAllocated = enriched.reduce((acc, p) => acc + (p.margin > 0 ? p.margin : p.positionSize), 0);
  const totalOpenRisk = enriched.reduce((acc, p) => acc + (p.riskAmount || 0), 0);
  const totalGrossPnl = enriched.reduce((acc, p) => acc + p.grossPnl, 0);
  const totalFees = enriched.reduce((acc, p) => acc + p.totalFees, 0);
  const totalNetPnl = totalGrossPnl - totalFees;

  const totalRiskPct = totalEquity > 0 ? (totalOpenRisk / totalEquity) * 100 : 0;
  const remainingRiskCapacity = Math.max(0, maxAllowedRisk - totalOpenRisk);
  const remainingRiskCapacityPct = totalEquity > 0 ? (remainingRiskCapacity / totalEquity) * 100 : 0;

  // Correlation Groups
  const groupMap: Record<string, { risk: number; count: number; pairs: string[] }> = {};
  for (const p of enriched) {
    const group = p.correlationGroup || (
      p.tradeMode === 'FOREX' ? 'Forex Majors' :
      p.pair.startsWith('BTC') ? 'BTC-Related' :
      p.pair.startsWith('ETH') ? 'Layer-1s' :
      p.spotVenue === 'DEX' ? 'Memes & High-Beta' : 'Altcoins'
    );
    if (!groupMap[group]) {
      groupMap[group] = { risk: 0, count: 0, pairs: [] };
    }
    groupMap[group].risk += (p.riskAmount || 0);
    groupMap[group].count += 1;
    if (!groupMap[group].pairs.includes(p.pair)) {
      groupMap[group].pairs.push(p.pair);
    }
  }

  const correlatedGroups = Object.entries(groupMap).map(([groupName, data]) => ({
    groupName,
    exposureRisk: data.risk,
    exposureRiskPct: totalEquity > 0 ? (data.risk / totalEquity) * 100 : 0,
    positionsCount: data.count,
    pairs: data.pairs,
    isOverConcentrated: totalEquity > 0 && (data.risk / totalEquity) > 0.04 && data.count >= 2,
  }));

  // Risk Warnings
  const riskWarnings: string[] = [];
  if (totalRiskPct > maxRiskPct) {
    riskWarnings.push(
      `Portfolio Risk Breached: Active open risk is ${totalRiskPct.toFixed(1)}% ($${totalOpenRisk.toFixed(0)}), exceeding your max portfolio limit of ${maxRiskPct}%.`
    );
  } else if (totalRiskPct > maxRiskPct * 0.8) {
    riskWarnings.push(
      `High Risk Utilization: You are using ${((totalRiskPct / maxRiskPct) * 100).toFixed(0)}% of your portfolio risk budget.`
    );
  }

  for (const cg of correlatedGroups) {
    if (cg.isOverConcentrated) {
      riskWarnings.push(
        `Correlated Exposure Alert: ${cg.positionsCount} positions in "${cg.groupName}" account for $${cg.exposureRisk.toFixed(0)} (${cg.exposureRiskPct.toFixed(1)}% of capital).`
      );
    }
  }

  // Margin Check
  if (totalCapitalAllocated > totalEquity && totalEquity > 0) {
    riskWarnings.push(
      `Margin Exhaustion: Total allocated capital ($${totalCapitalAllocated.toFixed(0)}) exceeds your total equity ($${totalEquity.toFixed(0)}).`
    );
  }

  // Risk Tier
  let portfolioRiskTier: PortfolioRiskSummary['portfolioRiskTier'] = 'CONSERVATIVE';
  if (totalRiskPct > maxRiskPct) {
    portfolioRiskTier = 'CRITICAL';
  } else if (totalRiskPct > 4.5) {
    portfolioRiskTier = 'AGGRESSIVE';
  } else if (totalRiskPct > 2.5) {
    portfolioRiskTier = 'MODERATE';
  }

  // Counts of position states
  const winningCount = enriched.filter((p) => p.netPnl > 0).length;
  const losingCount = enriched.filter((p) => p.netPnl < 0).length;
  const approachingSlCount = enriched.filter((p) => p.status === 'NEAR STOP').length;
  const approachingTpCount = enriched.filter((p) => p.status === 'NEAR TAKE PROFIT').length;
  const slHitCount = enriched.filter((p) => p.status === 'STOP HIT').length;
  const tpHitCount = enriched.filter((p) => p.status === 'TAKE PROFIT HIT').length;

  return {
    totalOpenPositions: positions.length,
    totalCapitalAllocated,
    totalOpenRisk,
    totalRiskPct,
    totalUnrealizedPnl: totalNetPnl,
    totalUnrealizedPnlPct: totalEquity > 0 ? (totalNetPnl / totalEquity) * 100 : 0,
    portfolioRiskTier,
    riskWarnings,
    correlatedGroups,
    totalPortfolioEquity: totalEquity,
    maxAllowedPortfolioRisk: maxAllowedRisk,
    maxAllowedPortfolioRiskPct: maxRiskPct,
    remainingRiskCapacity,
    remainingRiskCapacityPct,
    winningCount,
    losingCount,
    approachingSlCount,
    approachingTpCount,
    slHitCount,
    tpHitCount,
    totalGrossPnl,
    totalFees,
  };
}

/**
 * Market exposure breakdown (Spot, DEX, Perpetual, Forex) and Long/Short split.
 */
export function calculateMarketExposureBreakdown(positions: OpenPosition[]) {
  const breakdown = {
    spot: { notional: 0, margin: 0, count: 0, risk: 0 },
    dex: { notional: 0, margin: 0, count: 0, risk: 0 },
    perpetual: { notional: 0, margin: 0, count: 0, risk: 0 },
    forex: { notional: 0, margin: 0, count: 0, risk: 0 },
    longNotional: 0,
    shortNotional: 0,
    totalNotional: 0,
    netExposureNotional: 0, // Long - Short
    netDirectionBias: 'NEUTRAL' as 'LONG' | 'SHORT' | 'NEUTRAL',
  };

  for (const p of positions) {
    const notional = p.positionSize || 0;
    const margin = p.margin || notional;
    const risk = p.riskAmount || 0;
    const mode = p.tradeMode || (p.leverage > 1 ? 'PERPETUAL' : 'SPOT');
    const isDex = p.spotVenue === 'DEX' || mode === 'DEX';

    if (isDex) {
      breakdown.dex.notional += notional;
      breakdown.dex.margin += margin;
      breakdown.dex.count += 1;
      breakdown.dex.risk += risk;
    } else if (mode === 'SPOT') {
      breakdown.spot.notional += notional;
      breakdown.spot.margin += margin;
      breakdown.spot.count += 1;
      breakdown.spot.risk += risk;
    } else if (mode === 'FOREX') {
      breakdown.forex.notional += notional;
      breakdown.forex.margin += margin;
      breakdown.forex.count += 1;
      breakdown.forex.risk += risk;
    } else {
      breakdown.perpetual.notional += notional;
      breakdown.perpetual.margin += margin;
      breakdown.perpetual.count += 1;
      breakdown.perpetual.risk += risk;
    }

    if (p.direction === 'LONG') {
      breakdown.longNotional += notional;
    } else {
      breakdown.shortNotional += notional;
    }
    breakdown.totalNotional += notional;
  }

  breakdown.netExposureNotional = breakdown.longNotional - breakdown.shortNotional;
  if (breakdown.netExposureNotional > 0) {
    breakdown.netDirectionBias = 'LONG';
  } else if (breakdown.netExposureNotional < 0) {
    breakdown.netDirectionBias = 'SHORT';
  } else {
    breakdown.netDirectionBias = 'NEUTRAL';
  }

  return breakdown;
}

/**
 * Closes an active open position and archives it cleanly into the Trading Journal database.
 */
export async function closeAndArchiveOpenPosition(
  params: ClosePositionParams
): Promise<TradeJournalEntry> {
  const { 
    positionId, 
    exitPrice, 
    exitDate = new Date().toISOString().split('T')[0],
    actualFees,
    slippageCost = 0,
    exitReason,
    notes = '',
    emotionAfter = 'NEUTRAL',
    disciplineRating = 4,
    mistakes = []
  } = params;

  const openPos = await db.openPositions.get(positionId);
  if (!openPos) {
    throw new Error(`Open position #${positionId} not found.`);
  }

  const isLong = openPos.direction === 'LONG';
  const mode = openPos.tradeMode || (openPos.leverage > 1 ? 'PERPETUAL' : 'SPOT');
  const quantity = openPos.quantity || (openPos.entryPrice > 0 ? (openPos.positionSize / openPos.entryPrice) : 0);

  // 1. Calculate actual Gross P/L
  let grossPnl = 0;
  if (mode === 'FOREX') {
    const pipSize = openPos.pipSize || (openPos.pair.includes('JPY') ? 0.01 : 0.0001);
    const pipValue = openPos.pipValue || 10;
    const lotSize = openPos.lotSize || (openPos.positionSize / 100000);
    const pipsChange = isLong 
      ? (exitPrice - openPos.entryPrice) / pipSize 
      : (openPos.entryPrice - exitPrice) / pipSize;
    grossPnl = pipsChange * pipValue * lotSize;
  } else {
    if (isLong) {
      grossPnl = (exitPrice - openPos.entryPrice) * quantity;
    } else {
      grossPnl = (openPos.entryPrice - exitPrice) * quantity;
    }
  }

  // 2. Fees & Slippage
  const feeAmount = actualFees !== undefined ? actualFees : (openPos.feesPaid || (openPos.positionSize * 0.001));
  const netPnl = grossPnl - feeAmount - slippageCost;
  const capitalBase = openPos.margin > 0 ? openPos.margin : openPos.positionSize;
  const pnlPercentage = capitalBase > 0 ? (netPnl / capitalBase) * 100 : 0;
  const rMultiple = openPos.riskAmount > 0 ? Number((netPnl / openPos.riskAmount).toFixed(2)) : 0;

  const isWin = netPnl > 0;
  const isBreakeven = Math.abs(netPnl) < 1.0;

  // 3. Create TradeJournalEntry
  const journalEntry: TradeJournalEntry = {
    date: exitDate,
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date().toISOString(),
    pair: openPos.pair,
    tradeMode: mode as any,
    spotVenue: openPos.spotVenue,
    exchange: openPos.exchange || 'Binance',
    direction: openPos.direction,
    entryPrice: openPos.entryPrice,
    exitPrice: exitPrice,
    positionSize: openPos.positionSize,
    quantity: quantity,
    margin: openPos.margin,
    leverage: openPos.leverage || 1,
    tradingFee: feeAmount,
    slippageCost: slippageCost,
    grossPnl: grossPnl,
    pnl: netPnl,
    pnlPercentage: pnlPercentage,
    rMultiple: rMultiple,
    stopLoss: openPos.stopLoss,
    takeProfit: openPos.takeProfit,
    riskAmount: openPos.riskAmount,
    riskPercentage: openPos.riskPct,
    strategy: openPos.correlationGroup || 'Rule-Based Execution',
    setup: 'Pre-Trade Gate Validated',
    timeframe: '1h',
    confidence: 'Medium',
    setupQuality: 'Good',
    emotionBefore: 'Calm',
    emotionAfter: (emotionAfter === 'CALM' ? 'Calm' : emotionAfter === 'CONFIDENT' ? 'Confident' : emotionAfter === 'FRUSTRATED' ? 'Frustrated' : emotionAfter === 'REGRETFUL' ? 'Regretful' : 'Satisfied') as any,
    tradeRating: disciplineRating,
    tags: [mode, openPos.direction, isWin ? 'WIN' : 'LOSS', 'Risk-Managed'].filter(Boolean),
    entryReason: `Opened via Risk Calculator with $${openPos.riskAmount.toFixed(0)} risk target.`,
    exitReason: exitReason || (isWin ? 'Take Profit reached' : 'Stop Loss triggered'),
    mistakesMade: mistakes.join(', '),
    mistakes: mistakes,
    lessonsLearned: isWin 
      ? `Executed disciplined risk management with +${rMultiple}R realized return.` 
      : `Pre-set stop loss preserved capital according to risk budget (${rMultiple}R).`,
    notes: `${notes ? notes + ' | ' : ''}Archived from active open positions. Planned Risk: $${openPos.riskAmount.toFixed(0)}, Actual P/L: $${netPnl.toFixed(2)}.`,
    isWin: isWin,
    isBreakeven: isBreakeven,
    favorite: false,
    lotSize: openPos.lotSize,
    pipsRisk: openPos.pipSize ? (Math.abs(openPos.entryPrice - openPos.stopLoss) / openPos.pipSize) : undefined,
    dexChain: openPos.dexChain,
    dexProtocol: openPos.dexProtocol,
    dexToken: openPos.dexToken,
  };

  // 4. Save to IndexedDB trades
  await db.trades.add(journalEntry);

  // 5. Remove from openPositions
  await db.openPositions.delete(positionId);

  return journalEntry;
}
