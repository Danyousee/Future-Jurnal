import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  PieChart, 
  Layers, 
  Lightbulb, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Calendar,
  Compass,
  Tag,
  Settings2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  EyeOff,
  MoveUp,
  MoveDown,
  RotateCcw,
  Wallet,
  Zap,
  Percent,
  Flame,
  Award
} from 'lucide-react';
import { TradeJournalEntry, JournalStats, PairStat, MonthlyStat, SmartInsight } from '../types';
import { formatCurrency, formatNumber } from '../utils/calculator';
import { calculateTagStats, calculateJournalStats } from '../utils/analytics';
import { TagManager } from './TagManager';
import { 
  AnalyticsLayoutModal, 
  AnalyticsWidgetConfig, 
  DEFAULT_ANALYTICS_WIDGETS 
} from './AnalyticsLayoutModal';

const STORAGE_KEY = 'trading_journal_analytics_widgets_v2';

interface AnalyticsViewProps {
  trades: TradeJournalEntry[];
  stats: JournalStats;
  pairStats: PairStat[];
  monthlyStats: MonthlyStat[];
  insights: SmartInsight[];
  initialBalance?: number;
  onRefreshData?: () => Promise<void>;
  onEditTrade?: (trade: TradeJournalEntry) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  trades,
  stats,
  pairStats,
  monthlyStats,
  insights,
  initialBalance = 10000,
  onRefreshData,
  onEditTrade,
}) => {
  const [showFullTagManager, setShowFullTagManager] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);

  // Initialize widgets from localStorage
  const [widgets, setWidgets] = useState<AnalyticsWidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AnalyticsWidgetConfig[] = JSON.parse(saved);
        // Ensure all default widget IDs exist in loaded configuration
        const existingIds = new Set(parsed.map((w) => w.id));
        const missing = DEFAULT_ANALYTICS_WIDGETS.filter((d) => !existingIds.has(d.id));
        return [...parsed, ...missing];
      }
    } catch {
      // Fallback
    }
    return DEFAULT_ANALYTICS_WIDGETS;
  });

  const handleSaveWidgets = (newWidgets: AnalyticsWidgetConfig[]) => {
    setWidgets(newWidgets);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWidgets));
    } catch {
      // LocalStorage fallback
    }
  };

  const handleResetToDefault = () => {
    setWidgets(DEFAULT_ANALYTICS_WIDGETS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // LocalStorage fallback
    }
  };

  const handleQuickMove = (widgetId: string, direction: 'up' | 'down') => {
    const idx = widgets.findIndex((w) => w.id === widgetId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= widgets.length) return;

    const nextWidgets = [...widgets];
    const temp = nextWidgets[idx];
    nextWidgets[idx] = nextWidgets[targetIdx];
    nextWidgets[targetIdx] = temp;

    handleSaveWidgets(nextWidgets);
  };

  const handleQuickHide = (widgetId: string) => {
    const nextWidgets = widgets.map((w) => (w.id === widgetId ? { ...w, enabled: false } : w));
    handleSaveWidgets(nextWidgets);
  };

  // Market Mode Filter state
  const [analyticsModeFilter, setAnalyticsModeFilter] = useState<'ALL' | 'SPOT' | 'PERPETUAL' | 'FOREX'>('ALL');
  const [spotVenueFilter, setSpotVenueFilter] = useState<'ALL' | 'CEX' | 'DEX'>('ALL');

  // Trade counts across all modes
  const modeCounts = useMemo(() => {
    let spotCex = 0;
    let spotDex = 0;
    let perp = 0;
    let forex = 0;

    trades.forEach((t) => {
      const rawMode = (t.tradeMode || 'PERPETUAL').toUpperCase();
      const isDex = rawMode === 'DEX' || (rawMode === 'SPOT' && String(t.spotVenue).toUpperCase() === 'DEX');
      if (isDex) {
        spotDex++;
      } else if (rawMode === 'SPOT') {
        spotCex++;
      } else if (rawMode === 'FOREX') {
        forex++;
      } else {
        perp++;
      }
    });

    return {
      all: trades.length,
      spot: spotCex + spotDex,
      spotCex,
      spotDex,
      perp,
      forex,
    };
  }, [trades]);

  // Filtered trades based on chosen mode
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const rawMode = (trade.tradeMode || 'PERPETUAL').toUpperCase();
      if (analyticsModeFilter === 'ALL') return true;

      const isDex = rawMode === 'DEX' || (rawMode === 'SPOT' && String(trade.spotVenue).toUpperCase() === 'DEX');
      const isSpot = rawMode === 'SPOT' || isDex;

      if (analyticsModeFilter === 'SPOT') {
        if (!isSpot) return false;
        if (spotVenueFilter === 'CEX') return !isDex;
        if (spotVenueFilter === 'DEX') return isDex;
        return true;
      }

      if (analyticsModeFilter === 'FOREX') {
        return rawMode === 'FOREX';
      }

      if (analyticsModeFilter === 'PERPETUAL') {
        return rawMode === 'PERPETUAL' || (!isSpot && rawMode !== 'FOREX');
      }

      return true;
    });
  }, [trades, analyticsModeFilter, spotVenueFilter]);

  // Active dataset: falls back to raw props if ALL, otherwise recalculates via calculateJournalStats
  const activeData = useMemo(() => {
    if (analyticsModeFilter === 'ALL' && spotVenueFilter === 'ALL') {
      return {
        stats,
        pairStats,
        monthlyStats,
        insights,
      };
    }
    const computed = calculateJournalStats(filteredTrades, initialBalance);
    return {
      stats: computed.stats,
      pairStats: computed.pairStats,
      monthlyStats: computed.monthlyStats,
      insights: computed.insights,
    };
  }, [filteredTrades, analyticsModeFilter, spotVenueFilter, stats, pairStats, monthlyStats, insights, initialBalance]);

  const activeStats = activeData.stats;
  const activePairStats = activeData.pairStats;
  const activeMonthlyStats = activeData.monthlyStats;
  const activeInsights = activeData.insights;

  const tagStats = useMemo(() => calculateTagStats(filteredTrades), [filteredTrades]);

  // DEX Spot Execution Telemetry
  const dexTelemetry = useMemo(() => {
    const dexTrades = filteredTrades.filter((t) => {
      const m = (t.tradeMode || '').toUpperCase();
      return m === 'DEX' || (m === 'SPOT' && String(t.spotVenue).toUpperCase() === 'DEX');
    });

    const swapVolume = dexTrades.reduce((acc, t) => acc + (t.positionSize || 0), 0);
    const gasFees = dexTrades.reduce((acc, t) => acc + (t.dexGasFee || t.gasFee || 0), 0);
    const networkFees = dexTrades.reduce((acc, t) => acc + (t.dexNetworkFee || t.networkFee || 0), 0);
    const dexFees = dexTrades.reduce((acc, t) => acc + ((t.positionSize || 0) * ((t.dexTradingFeePct || t.dexFeePct || 0.3) / 100)), 0);
    const avgSlippage = dexTrades.length > 0 
      ? dexTrades.reduce((acc, t) => acc + (t.dexSlippagePct !== undefined ? t.dexSlippagePct : t.slippagePct !== undefined ? t.slippagePct : 0.5), 0) / dexTrades.length 
      : 0;
    const avgPriceImpact = dexTrades.length > 0
      ? dexTrades.reduce((acc, t) => acc + (t.dexPriceImpactPct !== undefined ? t.dexPriceImpactPct : 0), 0) / dexTrades.length
      : 0;

    return {
      count: dexTrades.length,
      swapVolume,
      gasFees,
      networkFees,
      dexFees,
      totalFees: gasFees + networkFees + dexFees,
      avgSlippage,
      avgPriceImpact,
    };
  }, [filteredTrades]);

  // Forex Telemetry (strictly separating lots from crypto sizes)
  const forexTelemetry = useMemo(() => {
    const fxTrades = filteredTrades.filter((t) => (t.tradeMode || '').toUpperCase() === 'FOREX');
    const lotsTraded = fxTrades.reduce((acc, t) => acc + (t.lotSize || 0), 0);
    const avgLotSize = fxTrades.length > 0 ? lotsTraded / fxTrades.length : 0;
    
    const tradesWithPipRisk = fxTrades.filter((t) => t.pipsRisk !== undefined && t.pipsRisk > 0);
    const avgPipRisk = tradesWithPipRisk.length > 0
      ? tradesWithPipRisk.reduce((acc, t) => acc + (t.pipsRisk || 0), 0) / tradesWithPipRisk.length
      : 0;

    const tradesWithPipGain = fxTrades.filter((t) => t.pipsGain !== undefined && t.pipsGain > 0);
    const avgPipGain = tradesWithPipGain.length > 0
      ? tradesWithPipGain.reduce((acc, t) => acc + (t.pipsGain || 0), 0) / tradesWithPipGain.length
      : 0;

    const commissionPaid = fxTrades.reduce((acc, t) => acc + ((t.lotSize || 0.1) * 7), 0);
    const spreadCost = lotsTraded * 10 * 1.2; // 1.2 pip avg spread ($10/pip standard lot)

    return {
      count: fxTrades.length,
      lotsTraded,
      avgLotSize,
      avgPipRisk,
      avgPipGain,
      commissionPaid,
      spreadCost,
    };
  }, [filteredTrades]);

  // Perpetual Telemetry
  const perpTelemetry = useMemo(() => {
    const perpTrades = filteredTrades.filter((t) => {
      const m = (t.tradeMode || 'PERPETUAL').toUpperCase();
      const isDex = m === 'DEX' || (m === 'SPOT' && String(t.spotVenue).toUpperCase() === 'DEX');
      return m === 'PERPETUAL' || (!isDex && m !== 'SPOT' && m !== 'FOREX');
    });
    const notionalVolume = perpTrades.reduce((acc, t) => acc + (t.positionSize || 0), 0);
    const avgLeverage = perpTrades.length > 0
      ? perpTrades.reduce((acc, t) => acc + (t.leverage || 10), 0) / perpTrades.length
      : 0;
    const totalMargin = perpTrades.reduce((acc, t) => acc + (t.margin || (t.positionSize / (t.leverage || 10))), 0);
    const totalFunding = perpTrades.reduce((acc, t) => acc + (t.fundingCost || 0), 0);

    return {
      count: perpTrades.length,
      notionalVolume,
      avgLeverage,
      totalMargin,
      totalFunding,
    };
  }, [filteredTrades]);

  // Mode Performance Comparison (all 11 metrics for all 4 execution venues)
  const modeComparisonData = useMemo(() => {
    const computeModeMetrics = (list: TradeJournalEntry[]) => {
      const st = calculateJournalStats(list, initialBalance).stats;
      return {
        totalTrades: st.totalTrades,
        winRate: st.winRate,
        totalPnl: st.totalPnl,
        avgPnl: st.avgPnl || (st.totalTrades > 0 ? st.totalPnl / st.totalTrades : 0),
        avgR: st.avgRMultiple,
        profitFactor: st.profitFactor,
        maxDrawdownPct: st.maxDrawdownPct,
        maxDrawdown: st.maxDrawdown,
        avgRisk: st.avgRisk || 0,
        totalFees: st.totalFeesPaid,
        largestWin: st.largestWin,
        largestLoss: st.largestLoss,
      };
    };

    const spotCexTrades = trades.filter((t) => {
      const m = (t.tradeMode || 'PERPETUAL').toUpperCase();
      return m === 'SPOT' && String(t.spotVenue).toUpperCase() !== 'DEX';
    });

    const spotDexTrades = trades.filter((t) => {
      const m = (t.tradeMode || '').toUpperCase();
      return m === 'DEX' || (m === 'SPOT' && String(t.spotVenue).toUpperCase() === 'DEX');
    });

    const perpTrades = trades.filter((t) => {
      const m = (t.tradeMode || 'PERPETUAL').toUpperCase();
      const isDex = m === 'DEX' || (m === 'SPOT' && String(t.spotVenue).toUpperCase() === 'DEX');
      return m === 'PERPETUAL' || (!isDex && m !== 'SPOT' && m !== 'FOREX');
    });

    const forexTrades = trades.filter((t) => (t.tradeMode || '').toUpperCase() === 'FOREX');

    return [
      { id: 'spot_cex', name: 'Spot CEX', venue: 'Cash Orderbook', color: 'emerald', metrics: computeModeMetrics(spotCexTrades) },
      { id: 'spot_dex', name: 'Spot DEX', venue: 'On-Chain AMM / Liquidity Pool', color: 'purple', metrics: computeModeMetrics(spotDexTrades) },
      { id: 'perp', name: 'Perpetual Futures', venue: 'Leveraged Margin Contracts', color: 'blue', metrics: computeModeMetrics(perpTrades) },
      { id: 'forex', name: 'Forex Currencies', venue: 'Broker Pairs & Lot Sizing', color: 'amber', metrics: computeModeMetrics(forexTrades) },
    ];
  }, [trades, initialBalance]);

  // Compute Cumulative Equity Progression for filtered dataset
  const equityPoints = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return [];
    
    // Sort chronologically
    const sorted = [...filteredTrades].sort(
      (a, b) => new Date(a.date + ' ' + (a.time || '00:00')).getTime() - new Date(b.date + ' ' + (b.time || '00:00')).getTime()
    );

    let runningBalance = initialBalance;
    const points: { index: number; label: string; date: string; pnl: number; balance: number; pair: string }[] = [
      { index: 0, label: 'Start', date: 'Start', pnl: 0, balance: initialBalance, pair: 'Initial' }
    ];

    sorted.forEach((t, idx) => {
      runningBalance += t.pnl || 0;
      points.push({
        index: idx + 1,
        label: `#${idx + 1}`,
        date: t.date,
        pnl: t.pnl || 0,
        balance: runningBalance,
        pair: t.pair,
      });
    });

    return points;
  }, [filteredTrades, initialBalance]);

  // Equity min & max for SVG coordinates
  const { minBalance, maxBalance } = useMemo(() => {
    if (equityPoints.length === 0) return { minBalance: initialBalance * 0.9, maxBalance: initialBalance * 1.1 };
    const balances = equityPoints.map((p) => p.balance);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const padding = Math.max(500, (max - min) * 0.1);
    return {
      minBalance: Math.max(0, min - padding),
      maxBalance: max + padding,
    };
  }, [equityPoints, initialBalance]);

  // Win/Loss Donut SVG calculation based on activeStats
  const winCount = activeStats.totalWins;
  const lossCount = activeStats.totalLosses;
  const beCount = activeStats.totalBreakeven;
  const totalCount = Math.max(1, activeStats.totalTrades);

  // Expectancy calculation
  const expectancy = useMemo(() => {
    if (activeStats.totalTrades === 0) return 0;
    const winPct = activeStats.winRate / 100;
    const lossPct = (100 - activeStats.winRate) / 100;
    return (winPct * activeStats.avgWin) - (lossPct * Math.abs(activeStats.avgLoss));
  }, [activeStats]);

  const enabledWidgets = useMemo(() => widgets.filter((w) => w.enabled), [widgets]);
  const hiddenCount = widgets.length - enabledWidgets.length;

  // Widget Header Action Buttons helper
  const renderWidgetHeaderControls = (widgetId: string) => {
    const index = widgets.findIndex((w) => w.id === widgetId);
    return (
      <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => handleQuickMove(widgetId, 'up')}
          title="Move Widget Up"
          className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer ${
            index <= 0 ? 'opacity-30 cursor-not-allowed' : ''
          }`}
        >
          <MoveUp className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          disabled={index >= widgets.length - 1}
          onClick={() => handleQuickMove(widgetId, 'down')}
          title="Move Widget Down"
          className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer ${
            index >= widgets.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
          }`}
        >
          <MoveDown className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => handleQuickHide(widgetId)}
          title="Hide this widget"
          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  // Individual Widget Renderers
  const renderWidget = (widget: AnalyticsWidgetConfig) => {
    switch (widget.id) {
      // 1. KPI SUMMARY STRIP
      case 'kpi_summary':
        return (
          <div key="kpi_summary" className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl border border-slate-200/90 shadow-md space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <BarChart3 className="w-4 h-4 text-[#1565ff]" />
                <h2 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Key Performance Metrics
                </h2>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs font-mono text-slate-500">{activeStats.totalTrades} Trades</span>
                {renderWidgetHeaderControls('kpi_summary')}
              </div>
            </div>

            {/* 11 Primary KPI Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 pt-0.5 sm:pt-1">
              {/* 1. Net P&L */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Net P&L</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className={`text-base sm:text-lg font-bold font-mono ${activeStats.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {activeStats.totalPnl >= 0 ? '+' : ''}{formatCurrency(activeStats.totalPnl)}
                  </span>
                </div>
              </div>

              {/* 2. Win Rate */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Win Rate</span>
                <div className="mt-0.5 sm:mt-1 flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
                  <span className={`text-base sm:text-lg font-bold font-mono ${activeStats.winRate >= 50 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {activeStats.winRate.toFixed(1)}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">({activeStats.totalWins}W/{activeStats.totalLosses}L)</span>
                </div>
              </div>

              {/* 3. Profit Factor */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Profit Factor</span>
                <div className="mt-0.5 sm:mt-1 flex items-baseline gap-1 sm:gap-1.5">
                  <span className={`text-base sm:text-lg font-bold font-mono ${activeStats.profitFactor >= 1.5 ? 'text-[#22a65e]' : activeStats.profitFactor >= 1 ? 'text-blue-600' : 'text-[#ff3b4a]'}`}>
                    {activeStats.profitFactor.toFixed(2)}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">ratio</span>
                </div>
              </div>

              {/* 4. Average P/L */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Average P&L</span>
                <div className="mt-0.5 sm:mt-1">
                  {(() => {
                    const avgPnlVal = activeStats.avgPnl !== undefined ? activeStats.avgPnl : (activeStats.totalTrades > 0 ? activeStats.totalPnl / activeStats.totalTrades : 0);
                    return (
                      <span className={`text-base sm:text-lg font-bold font-mono ${avgPnlVal >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                        {avgPnlVal >= 0 ? '+' : ''}{formatCurrency(avgPnlVal)}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* 5. Average R */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Average R</span>
                <div className="mt-0.5 sm:mt-1 flex items-baseline gap-1">
                  <span className={`text-base sm:text-lg font-bold font-mono ${activeStats.avgRMultiple >= 1 ? 'text-[#22a65e]' : activeStats.avgRMultiple >= 0 ? 'text-blue-600' : 'text-[#ff3b4a]'}`}>
                    {activeStats.avgRMultiple >= 0 ? '+' : ''}{activeStats.avgRMultiple.toFixed(2)}R
                  </span>
                </div>
              </div>

              {/* 6. Maximum Drawdown */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Max Drawdown</span>
                <div className="mt-0.5 sm:mt-1 flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-rose-600">
                    -{activeStats.maxDrawdownPct.toFixed(1)}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">({formatCurrency(activeStats.maxDrawdown)})</span>
                </div>
              </div>

              {/* 7. Average Risk */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Average Risk</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {formatCurrency(activeStats.avgRisk || 0)}
                  </span>
                </div>
              </div>

              {/* 8. Total Fees */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Fees</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {formatCurrency(activeStats.totalFeesPaid)}
                  </span>
                </div>
              </div>

              {/* 9. Largest Win */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Largest Win</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-[#22a65e]">
                    +{formatCurrency(activeStats.largestWin)}
                  </span>
                </div>
              </div>

              {/* 10. Largest Loss */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Largest Loss</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-[#ff3b4a]">
                    -{formatCurrency(Math.abs(activeStats.largestLoss))}
                  </span>
                </div>
              </div>

              {/* 11. Expectancy */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Expectancy</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className={`text-base sm:text-lg font-bold font-mono ${expectancy >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {expectancy >= 0 ? '+' : ''}{formatCurrency(expectancy)}
                  </span>
                </div>
              </div>

              {/* 12. Best Streaks */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Best Streaks</span>
                <div className="mt-0.5 sm:mt-1 flex items-baseline justify-between text-[11px] sm:text-xs font-mono">
                  <span className="font-bold text-[#22a65e]">{activeStats.winStreak}W</span>
                  <span className="font-bold text-[#ff3b4a]">{activeStats.loseStreak}L</span>
                </div>
              </div>
            </div>

            {/* Mode-Specific Execution Telemetry Panels */}
            {/* 1. DEX Spot Execution Telemetry */}
            {dexTelemetry.count > 0 && (analyticsModeFilter === 'SPOT' || analyticsModeFilter === 'ALL') && (
              <div className="p-3 sm:p-4 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-600 text-white tracking-wider">
                      DEX ON-CHAIN TELEMETRY
                    </span>
                    <span className="text-xs font-mono text-purple-900 font-semibold">{dexTelemetry.count} swaps executed</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-700">
                    Total Volume: {formatCurrency(dexTelemetry.swapVolume)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
                  <div className="bg-white/80 p-2 rounded-lg border border-purple-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Gas Fee Paid</span>
                    <span className="font-bold text-slate-800">{formatCurrency(dexTelemetry.gasFees)}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-purple-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Network Fee</span>
                    <span className="font-bold text-slate-800">{formatCurrency(dexTelemetry.networkFees)}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-purple-100">
                    <span className="text-[9px] text-slate-500 uppercase block">DEX Swap Fee</span>
                    <span className="font-bold text-slate-800">{formatCurrency(dexTelemetry.dexFees)}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-purple-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Total On-Chain Cost</span>
                    <span className="font-bold text-purple-600">{formatCurrency(dexTelemetry.totalFees)}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-purple-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Avg Slippage</span>
                    <span className="font-bold text-slate-800">{dexTelemetry.avgSlippage.toFixed(2)}%</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-purple-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Avg Pool Impact</span>
                    <span className="font-bold text-slate-800">{dexTelemetry.avgPriceImpact.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Forex Execution Telemetry */}
            {forexTelemetry.count > 0 && (analyticsModeFilter === 'FOREX' || analyticsModeFilter === 'ALL') && (
              <div className="p-3 sm:p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-600 text-white tracking-wider">
                      FOREX EXECUTION TELEMETRY
                    </span>
                    <span className="text-xs font-mono text-amber-900 font-semibold">{forexTelemetry.count} currency orders</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-700">
                    Total Traded: {forexTelemetry.lotsTraded.toFixed(2)} lots
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Avg Lot Size</span>
                    <span className="font-bold text-slate-800">{forexTelemetry.avgLotSize.toFixed(2)} lots</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Avg Pip Risk</span>
                    <span className="font-bold text-rose-600">{forexTelemetry.avgPipRisk.toFixed(1)} pips</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Avg Pip Gain</span>
                    <span className="font-bold text-emerald-600">+{forexTelemetry.avgPipGain.toFixed(1)} pips</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Broker Commission</span>
                    <span className="font-bold text-slate-800">{formatCurrency(forexTelemetry.commissionPaid)}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Est. Spread Cost</span>
                    <span className="font-bold text-slate-800">{formatCurrency(forexTelemetry.spreadCost)}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Pip Efficiency</span>
                    <span className="font-bold text-amber-700">
                      {forexTelemetry.avgPipRisk > 0 ? (forexTelemetry.avgPipGain / forexTelemetry.avgPipRisk).toFixed(2) : '1.00'}x R
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Perpetual Futures Execution Telemetry */}
            {perpTelemetry.count > 0 && (analyticsModeFilter === 'PERPETUAL' || analyticsModeFilter === 'ALL') && (
              <div className="p-3 sm:p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-600 text-white tracking-wider">
                      PERPETUAL FUTURES TELEMETRY
                    </span>
                    <span className="text-xs font-mono text-blue-900 font-semibold">{perpTelemetry.count} derivative positions</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-700">
                    Notional: {formatCurrency(perpTelemetry.notionalVolume)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Avg Leverage</span>
                    <span className="font-bold text-slate-800">{perpTelemetry.avgLeverage.toFixed(1)}x</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Total Margin Required</span>
                    <span className="font-bold text-slate-800">{formatCurrency(perpTelemetry.totalMargin)}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Net Funding Cost</span>
                    <span className={`font-bold ${perpTelemetry.totalFunding >= 0 ? 'text-[#ff3b4a]' : 'text-[#22a65e]'}`}>
                      {formatCurrency(perpTelemetry.totalFunding)}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-[9px] text-slate-500 uppercase block">Capital Efficiency</span>
                    <span className="font-bold text-blue-600">
                      {perpTelemetry.totalMargin > 0 ? (perpTelemetry.notionalVolume / perpTelemetry.totalMargin).toFixed(1) : '1.0'}x Capital Power
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Mode Distribution Mini-Bar (shown in ALL mode) */}
            {analyticsModeFilter === 'ALL' && (
              <div className="pt-2 sm:pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {modeComparisonData.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.id === 'spot_cex') {
                        setAnalyticsModeFilter('SPOT');
                        setSpotVenueFilter('CEX');
                      } else if (m.id === 'spot_dex') {
                        setAnalyticsModeFilter('SPOT');
                        setSpotVenueFilter('DEX');
                      } else if (m.id === 'perp') {
                        setAnalyticsModeFilter('PERPETUAL');
                      } else if (m.id === 'forex') {
                        setAnalyticsModeFilter('FOREX');
                      }
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all text-left cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider text-white ${
                        m.color === 'emerald' ? 'bg-emerald-600' :
                        m.color === 'purple' ? 'bg-purple-600' :
                        m.color === 'blue' ? 'bg-blue-600' : 'bg-amber-600'
                      }`}>
                        {m.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 block">{m.metrics.totalTrades} trades</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold font-mono ${m.metrics.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                        {m.metrics.totalPnl >= 0 ? '+' : ''}{formatCurrency(m.metrics.totalPnl)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">{m.metrics.winRate.toFixed(0)}% Win Rate</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      // 2. EQUITY CURVE
      case 'equity_curve':
        return (
          <div key="equity_curve" className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl border border-slate-200/90 shadow-md space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Activity className="w-4 h-4 text-[#1565ff]" />
                <h2 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Equity Curve (Balance Progression)
                </h2>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono">
                <span className="text-slate-500">Balance: <strong className="text-slate-900">{formatCurrency(initialBalance + activeStats.totalPnl)}</strong></span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Peak: <strong className="text-[#22a65e]">+{formatCurrency(activeStats.largestWin)}</strong></span>
                {renderWidgetHeaderControls('equity_curve')}
              </div>
            </div>

            {equityPoints.length <= 1 ? (
              <div className="p-6 sm:p-8 text-center text-slate-500 text-xs">
                Log at least 2 trades to visualize the full cumulative equity progression line.
              </div>
            ) : (
              <div className="w-full space-y-2">
                {/* SVG Chart */}
                <div className="h-52 sm:h-72 w-full bg-slate-50 rounded-lg p-2.5 sm:p-3 border border-slate-200 relative flex items-end">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 300">
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1565ff" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#1565ff" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal reference grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                      <line
                        key={i}
                        x1="0"
                        y1={300 * ratio}
                        x2="1000"
                        y2={300 * ratio}
                        stroke="#E2E8F0"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                    ))}

                    {/* Draw Area & Line */}
                    {(() => {
                      const pointsCount = equityPoints.length;
                      const range = maxBalance - minBalance || 1;

                      const coords = equityPoints.map((pt, idx) => {
                        const x = (idx / (pointsCount - 1)) * 1000;
                        const y = 300 - ((pt.balance - minBalance) / range) * 280 - 10;
                        return { x, y, pt };
                      });

                      const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                      const areaPath = `${linePath} L 1000 300 L 0 300 Z`;

                      return (
                        <>
                          <path d={areaPath} fill="url(#equityGradient)" />
                          <path
                            d={linePath}
                            fill="none"
                            stroke={activeStats.totalPnl >= 0 ? '#1565ff' : '#ff3b4a'}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {coords.map((c, i) => (
                            <circle
                              key={i}
                              cx={c.x}
                              cy={c.y}
                              r="4"
                              fill={c.pt.pnl >= 0 ? '#22a65e' : '#ff3b4a'}
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* Timeline X-Labels */}
                <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-500 font-mono px-1 sm:px-2">
                  <span>{equityPoints[0]?.date || 'Start'}</span>
                  <span>{equityPoints[Math.floor(equityPoints.length / 2)]?.date}</span>
                  <span>{equityPoints[equityPoints.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </div>
        );

      // 3. WIN / LOSS PIE DISTRIBUTION
      case 'win_loss_pie':
        return (
          <div key="win_loss_pie" className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200/90 shadow-md space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
              <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
                <PieChart className="w-4 h-4 text-[#22a65e]" />
                Win / Loss Distribution
              </h3>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs font-mono text-slate-500">{stats.totalTrades} Executions</span>
                {renderWidgetHeaderControls('win_loss_pie')}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-around gap-4 sm:gap-6 py-2">
              {/* SVG Donut */}
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#E2E8F0" strokeWidth="4" />
                  
                  {/* Wins Ring (Emerald) */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="transparent"
                    stroke="#22a65e"
                    strokeWidth="4.2"
                    strokeDasharray={`${(winCount / totalCount) * 100} ${100 - (winCount / totalCount) * 100}`}
                    strokeDashoffset="0"
                  />

                  {/* Losses Ring (Rose) */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="transparent"
                    stroke="#ff3b4a"
                    strokeWidth="4.2"
                    strokeDasharray={`${(lossCount / totalCount) * 100} ${100 - (lossCount / totalCount) * 100}`}
                    strokeDashoffset={`${-((winCount / totalCount) * 100)}`}
                  />
                </svg>

                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {activeStats.winRate.toFixed(0)}%
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Win Rate</span>
                </div>
              </div>

              {/* Metrics legend */}
              <div className="space-y-1.5 sm:space-y-2 text-xs font-mono w-full sm:w-auto">
                <div className="flex items-center justify-between gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#22a65e]"></span>
                    <span className="text-slate-600">Wins</span>
                  </div>
                  <span className="font-bold text-[#22a65e]">{winCount} ({((winCount / totalCount) * 100).toFixed(1)}%)</span>
                </div>

                <div className="flex items-center justify-between gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#ff3b4a]"></span>
                    <span className="text-slate-600">Losses</span>
                  </div>
                  <span className="font-bold text-[#ff3b4a]">{lossCount} ({((lossCount / totalCount) * 100).toFixed(1)}%)</span>
                </div>

                <div className="flex items-center justify-between gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span className="text-slate-600">Breakeven</span>
                  </div>
                  <span className="font-bold text-slate-600">{beCount} ({((beCount / totalCount) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>
        );

      // 4. MONTHLY P&L DISTRIBUTION
      case 'monthly_pnl':
        return (
          <div key="monthly_pnl" className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200/90 shadow-md space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
              <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
                <Calendar className="w-4 h-4 text-[#1565ff]" />
                Monthly P&L Distribution
              </h3>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs font-mono text-slate-500">{activeMonthlyStats.length} Months Tracked</span>
                {renderWidgetHeaderControls('monthly_pnl')}
              </div>
            </div>

            {activeMonthlyStats.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-slate-500 text-xs">
                No monthly trade data logged yet.
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
                {activeMonthlyStats.map((m) => {
                  const isProfitable = m.pnl >= 0;
                  const maxMonthlyAbs = Math.max(...activeMonthlyStats.map((item) => Math.abs(item.pnl)), 100);
                  const barWidth = Math.min(100, Math.max(10, (Math.abs(m.pnl) / maxMonthlyAbs) * 100));

                  return (
                    <div key={m.monthKey} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-slate-600">{m.label} ({m.trades} trades)</span>
                        <span className={`font-bold ${isProfitable ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                          {isProfitable ? '+' : ''}{formatCurrency(m.pnl)}
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex items-center p-0.5 border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isProfitable ? 'bg-[#22a65e]' : 'bg-[#ff3b4a]'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      // 5. PAIR PERFORMANCE
      case 'pair_performance':
        return (
          <div key="pair_performance" className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl border border-slate-200/90 shadow-md space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
              <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
                <Layers className="w-4 h-4 text-[#1565ff]" />
                Performance by Trading Pair
              </h3>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs font-mono text-slate-500">{activePairStats.length} Unique Assets</span>
                {renderWidgetHeaderControls('pair_performance')}
              </div>
            </div>

            {activePairStats.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">No pair data available.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-2.5 sm:pb-3 font-semibold text-[11px] sm:text-xs">Pair</th>
                      <th className="pb-2.5 sm:pb-3 font-semibold text-center text-[11px] sm:text-xs">Trades</th>
                      <th className="pb-2.5 sm:pb-3 font-semibold text-center text-[11px] sm:text-xs">Win Rate</th>
                      <th className="pb-2.5 sm:pb-3 font-semibold text-right text-[11px] sm:text-xs">Avg P&L</th>
                      <th className="pb-2.5 sm:pb-3 font-semibold text-right text-[11px] sm:text-xs">Total Net P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activePairStats.map((item) => {
                      const isPositive = item.totalPnl >= 0;
                      return (
                        <tr key={item.pair} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 sm:py-3 font-bold text-slate-900 text-xs">{item.pair}</td>
                          <td className="py-2.5 sm:py-3 text-center text-slate-500 text-[11px]">
                            {item.trades} <span className="text-[10px] text-slate-400">({item.wins}W / {item.losses}L)</span>
                          </td>
                          <td className="py-2.5 sm:py-3 text-center">
                            <span
                              className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.winRate >= 50 ? 'bg-[#22a65e]/15 text-[#22a65e]' : 'bg-[#ff3b4a]/15 text-[#ff3b4a]'
                              }`}
                            >
                              {item.winRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className={`py-2.5 sm:py-3 text-right text-xs ${item.avgPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                            {item.avgPnl >= 0 ? '+' : ''}{formatCurrency(item.avgPnl)}
                          </td>
                          <td className={`py-2.5 sm:py-3 text-right font-bold text-xs sm:text-sm ${isPositive ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                            {isPositive ? '+' : ''}{formatCurrency(item.totalPnl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      // 6. TAG PERFORMANCE & SETUP ANALYTICS
      case 'tag_performance':
        return (
          <div key="tag_performance" className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl border border-slate-200/90 shadow-md space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-100 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Tag className="w-4 h-4 text-[#1565ff]" />
                <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Tag Performance & Setup Analytics
                </h3>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs font-mono text-slate-500">{tagStats.length} Unique Tags</span>
                {onRefreshData && (
                  <button
                    onClick={() => setShowFullTagManager(!showFullTagManager)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-[#1565ff]" />
                    <span>{showFullTagManager ? 'Hide Manager' : 'Manage Tags'}</span>
                    {showFullTagManager ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
                {renderWidgetHeaderControls('tag_performance')}
              </div>
            </div>

            {/* Embedded Full Tag Manager when expanded */}
            {showFullTagManager && onRefreshData ? (
              <div className="p-1 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                <TagManager
                  trades={trades}
                  onRefreshData={onRefreshData}
                  onEditTrade={onEditTrade}
                />
              </div>
            ) : (
              /* Tag Stats Summary Table */
              tagStats.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No tags found. Add tags like <span className="font-mono font-bold text-slate-700">#Breakout</span>, <span className="font-mono font-bold text-slate-700">#HTFSupport</span>, or <span className="font-mono font-bold text-slate-700">#FOMO</span> to trades to evaluate setup edge.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2.5 sm:pb-3 font-semibold text-[11px] sm:text-xs">Tag</th>
                        <th className="pb-2.5 sm:pb-3 font-semibold text-center text-[11px] sm:text-xs">Trades</th>
                        <th className="pb-2.5 sm:pb-3 font-semibold text-center text-[11px] sm:text-xs">Win Rate</th>
                        <th className="pb-2.5 sm:pb-3 font-semibold text-center text-[11px] sm:text-xs">Ratio</th>
                        <th className="pb-2.5 sm:pb-3 font-semibold text-right text-[11px] sm:text-xs">Avg P&L</th>
                        <th className="pb-2.5 sm:pb-3 font-semibold text-right text-[11px] sm:text-xs">Total Net P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tagStats.slice(0, 8).map((item) => {
                        const isPositive = item.totalPnl >= 0;
                        return (
                          <tr key={item.tag} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 sm:py-3 font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                              <span className="w-2 h-2 rounded-full bg-[#1565ff]"></span>
                              #{item.tag}
                            </td>
                            <td className="py-2.5 sm:py-3 text-center text-slate-500 text-[11px]">
                              {item.count} <span className="text-[10px] text-slate-400">({item.wins}W / {item.losses}L)</span>
                            </td>
                            <td className="py-2.5 sm:py-3 text-center">
                              <span
                                className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.winRate >= 50 ? 'bg-[#22a65e]/15 text-[#22a65e]' : 'bg-[#ff3b4a]/15 text-[#ff3b4a]'
                                }`}
                              >
                                {item.winRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2.5 sm:py-3 text-center text-slate-500 text-[11px]">
                              {item.longs}L / {item.shorts}S
                            </td>
                            <td className={`py-2.5 sm:py-3 text-right text-xs ${item.avgPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                              {item.avgPnl >= 0 ? '+' : ''}{formatCurrency(item.avgPnl)}
                            </td>
                            <td className={`py-2.5 sm:py-3 text-right font-bold text-xs sm:text-sm ${isPositive ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                              {isPositive ? '+' : ''}{formatCurrency(item.totalPnl)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {tagStats.length > 8 && !showFullTagManager && onRefreshData && (
                    <div className="pt-3 text-center">
                      <button
                        onClick={() => setShowFullTagManager(true)}
                        className="text-xs font-bold text-[#1565ff] hover:underline cursor-pointer"
                      >
                        View & Manage all {tagStats.length} tags &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        );

      // 7. SMART INSIGHTS
      case 'smart_insights':
        return (
          <div key="smart_insights" className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl border border-slate-200/90 shadow-md space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Smart Algorithmic Insights & Rule Checks
                </h3>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs text-slate-500 font-mono">Discipline Audit</span>
                {renderWidgetHeaderControls('smart_insights')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {activeInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-3 sm:p-4 rounded-xl border transition-all ${
                    insight.type === 'positive'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : insight.type === 'danger'
                      ? 'bg-rose-50/70 border-rose-200'
                      : insight.type === 'warning'
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-blue-50/70 border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div
                      className={`p-1.5 rounded-lg text-white font-bold shrink-0 mt-0.5 ${
                        insight.type === 'positive'
                          ? 'bg-[#22a65e]'
                          : insight.type === 'danger'
                          ? 'bg-[#ff3b4a]'
                          : insight.type === 'warning'
                          ? 'bg-amber-500 text-white'
                          : 'bg-[#1565ff]'
                      }`}
                    >
                      {insight.type === 'positive' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      ) : insight.type === 'danger' ? (
                        <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      ) : insight.type === 'warning' ? (
                        <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      ) : (
                        <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      )}
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">{insight.title}</h4>
                        {insight.metric && (
                          <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200 shadow-2xs">
                            {insight.metric}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">{insight.description}</p>
                      {insight.actionAdvice && (
                        <div className="pt-1 text-[10px] sm:text-[11px] text-slate-700 font-mono">
                          <strong className="text-amber-600">Actionable Rule:</strong> {insight.actionAdvice}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      // 8. MARKET MODES PERFORMANCE & COMPARISON
      case 'market_modes':
        return (
          <div key="market_modes" className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl border border-slate-200/90 shadow-md space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <div>
                  <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Trading Mode Performance Breakdown (Spot, Perpetual, Forex)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Comparative execution diagnosis & telemetry across cash spot, on-chain DEX, leveraged derivatives & FX.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs text-slate-500 font-mono">4 Execution Venues</span>
                {renderWidgetHeaderControls('market_modes')}
              </div>
            </div>

            {/* Mode Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {modeComparisonData.map((m) => {
                const isPositive = m.metrics.totalPnl >= 0;
                return (
                  <div
                    key={m.id}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                      m.id === 'spot_cex' ? 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300' :
                      m.id === 'spot_dex' ? 'bg-purple-50/40 border-purple-200/80 hover:border-purple-300' :
                      m.id === 'perp' ? 'bg-blue-50/40 border-blue-200/80 hover:border-blue-300' :
                      'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider text-white ${
                        m.color === 'emerald' ? 'bg-emerald-600' :
                        m.color === 'purple' ? 'bg-purple-600' :
                        m.color === 'blue' ? 'bg-blue-600' : 'bg-amber-600'
                      }`}>
                        {m.name}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500">{m.metrics.totalTrades} trades</span>
                    </div>

                    <div className="mt-3 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Net P&L</span>
                      <div className="flex items-baseline justify-between">
                        <span className={`text-lg sm:text-xl font-bold font-mono ${isPositive ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                          {isPositive ? '+' : ''}{formatCurrency(m.metrics.totalPnl)}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-600">
                          {m.metrics.winRate.toFixed(1)}% WR
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-600">
                      <div>
                        <span className="text-[8px] uppercase text-slate-400 block">Avg R</span>
                        <span className="font-bold text-slate-800">{m.metrics.avgR.toFixed(2)}R</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase text-slate-400 block">Profit Factor</span>
                        <span className="font-bold text-slate-800">{m.metrics.profitFactor.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase text-slate-400 block">Max DD</span>
                        <span className="font-bold text-rose-600">-{m.metrics.maxDrawdownPct.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comprehensive 11-Metric Comparative Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600">
                    <th className="p-3 font-bold text-[11px]">Execution Mode</th>
                    <th className="p-3 font-bold text-center text-[11px]">Trades</th>
                    <th className="p-3 font-bold text-center text-[11px]">Win Rate</th>
                    <th className="p-3 font-bold text-right text-[11px]">Total Net P/L</th>
                    <th className="p-3 font-bold text-right text-[11px]">Avg P/L</th>
                    <th className="p-3 font-bold text-center text-[11px]">Avg R</th>
                    <th className="p-3 font-bold text-center text-[11px]">Profit Factor</th>
                    <th className="p-3 font-bold text-right text-[11px]">Max Drawdown</th>
                    <th className="p-3 font-bold text-right text-[11px]">Avg Risk</th>
                    <th className="p-3 font-bold text-right text-[11px]">Total Fees</th>
                    <th className="p-3 font-bold text-right text-[11px]">Largest Win/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white">
                  {modeComparisonData.map((m) => {
                    const isPositive = m.metrics.totalPnl >= 0;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold text-white ${
                              m.color === 'emerald' ? 'bg-emerald-600' :
                              m.color === 'purple' ? 'bg-purple-600' :
                              m.color === 'blue' ? 'bg-blue-600' : 'bg-amber-600'
                            }`}>
                              {m.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block">{m.venue}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {m.metrics.totalTrades}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-bold ${m.metrics.winRate >= 50 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                            {m.metrics.winRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold">
                          <span className={isPositive ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}>
                            {isPositive ? '+' : ''}{formatCurrency(m.metrics.totalPnl)}
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          <span className={m.metrics.avgPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}>
                            {m.metrics.avgPnl >= 0 ? '+' : ''}{formatCurrency(m.metrics.avgPnl)}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {m.metrics.avgR.toFixed(2)}R
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {m.metrics.profitFactor.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-rose-600 font-bold">
                          -{m.metrics.maxDrawdownPct.toFixed(1)}%
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          {formatCurrency(m.metrics.avgRisk)}
                        </td>
                        <td className="p-3 text-right text-slate-700 font-medium">
                          {formatCurrency(m.metrics.totalFees)}
                        </td>
                        <td className="p-3 text-right font-mono text-[11px]">
                          <span className="text-[#22a65e]">+{formatCurrency(m.metrics.largestWin)}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-[#ff3b4a]">-{formatCurrency(Math.abs(m.metrics.largestLoss))}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200/90 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#1565ff]/15 text-[#1565ff] border border-[#1565ff]/30">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900">
              Trading Analytics & Edge Diagnosis
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Algorithmic breakdown of your equity trajectory, hit rates, asset performance and risk metrics.
          </p>
        </div>

        {/* Action buttons & account growth pill */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            id="customize-analytics-layout-btn"
            onClick={() => setIsLayoutModalOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1565ff]" />
            <span>Customize Dashboard</span>
            {hiddenCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 text-[#1565ff] text-[10px]">
                {enabledWidgets.length}/{widgets.length}
              </span>
            )}
          </button>

          <div className="bg-slate-50 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg border border-slate-200 text-xs font-mono shadow-xs">
            <span className="text-slate-500 block text-[9px] uppercase">Account Growth</span>
            <span className={`font-bold text-xs sm:text-sm ${activeStats.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
              {activeStats.totalPnl >= 0 ? '+' : ''}{((activeStats.totalPnl / initialBalance) * 100).toFixed(2)}% ROI
            </span>
          </div>
        </div>
      </div>

      {/* Trading Mode Scope Filter Tabs */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
            Scope:
          </span>

          {/* ALL MODES */}
          <button
            type="button"
            onClick={() => {
              setAnalyticsModeFilter('ALL');
              setSpotVenueFilter('ALL');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              analyticsModeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>All Markets</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              analyticsModeFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {modeCounts.all}
            </span>
          </button>

          {/* SPOT */}
          <button
            type="button"
            onClick={() => {
              setAnalyticsModeFilter('SPOT');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              analyticsModeFilter === 'SPOT'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span>Spot</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              analyticsModeFilter === 'SPOT' ? 'bg-emerald-700 text-white' : 'bg-emerald-200/80 text-emerald-800'
            }`}>
              {modeCounts.spot}
            </span>
          </button>

          {/* PERPETUAL */}
          <button
            type="button"
            onClick={() => {
              setAnalyticsModeFilter('PERPETUAL');
              setSpotVenueFilter('ALL');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              analyticsModeFilter === 'PERPETUAL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <span>Perpetual</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              analyticsModeFilter === 'PERPETUAL' ? 'bg-blue-700 text-white' : 'bg-blue-200/80 text-blue-800'
            }`}>
              {modeCounts.perp}
            </span>
          </button>

          {/* FOREX */}
          <button
            type="button"
            onClick={() => {
              setAnalyticsModeFilter('FOREX');
              setSpotVenueFilter('ALL');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              analyticsModeFilter === 'FOREX'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <span>Forex</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              analyticsModeFilter === 'FOREX' ? 'bg-amber-700 text-white' : 'bg-amber-200/80 text-amber-800'
            }`}>
              {modeCounts.forex}
            </span>
          </button>
        </div>

        {/* Spot Sub-Venue Toggle (Only when SPOT is selected) */}
        {analyticsModeFilter === 'SPOT' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto border border-slate-200">
            <button
              type="button"
              onClick={() => setSpotVenueFilter('ALL')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                spotVenueFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Venues ({modeCounts.spot})
            </button>
            <button
              type="button"
              onClick={() => setSpotVenueFilter('CEX')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                spotVenueFilter === 'CEX'
                  ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              CEX Orderbook ({modeCounts.spotCex})
            </button>
            <button
              type="button"
              onClick={() => setSpotVenueFilter('DEX')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                spotVenueFilter === 'DEX'
                  ? 'bg-white text-purple-700 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              DEX AMM ({modeCounts.spotDex})
            </button>
          </div>
        )}
      </div>

      {/* Dynamic Widget Render Pipeline */}
      {enabledWidgets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
          <p className="text-sm font-bold text-slate-700">All widgets are currently hidden.</p>
          <button
            onClick={handleResetToDefault}
            className="px-4 py-2 bg-[#1565ff] text-white rounded-lg text-xs font-bold"
          >
            Restore Default Layout
          </button>
        </div>
      ) : (
        enabledWidgets.map((widget) => renderWidget(widget))
      )}

      {/* Layout Customizer Modal */}
      <AnalyticsLayoutModal
        isOpen={isLayoutModalOpen}
        onClose={() => setIsLayoutModalOpen(false)}
        widgets={widgets}
        onSaveWidgets={handleSaveWidgets}
        onResetToDefault={handleResetToDefault}
      />
    </div>
  );
};
