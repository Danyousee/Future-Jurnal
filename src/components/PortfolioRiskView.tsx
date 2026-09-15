import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  X, 
  Info, 
  DollarSign, 
  Percent, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  ExternalLink,
  BookOpen,
  RefreshCw,
  Sliders,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  Table as TableIcon,
  Search,
  Zap,
  Globe,
  Compass
} from 'lucide-react';
import { 
  OpenPosition, 
  PortfolioExposureMetrics, 
  TradingPlan, 
  TradeDirection, 
  TradingMode,
  Exchange,
  TradeJournalEntry
} from '../types';
import { 
  formatCurrency, 
  formatNumber, 
  formatPrice, 
} from '../utils/calculator';
import { 
  enrichOpenPosition, 
  calculatePortfolioRiskMetrics, 
  calculateMarketExposureBreakdown,
  EnrichedPosition 
} from '../utils/risk/positionManager';
import { db, saveOpenPosition } from '../db/journalDb';
import { PositionCard } from './portfolio/PositionCard';
import { ClosePositionModal } from './portfolio/ClosePositionModal';
import { AddPositionModal } from './portfolio/AddPositionModal';
import { useMarketPrices } from '../services/marketData/useMarketPrices';
import { AutoRefreshInterval } from '../services/marketData/types';

interface PortfolioRiskViewProps {
  positions?: OpenPosition[];
  openPositions?: OpenPosition[];
  metrics?: PortfolioExposureMetrics;
  accountBalance: number;
  realizedPnl?: number;
  plan: TradingPlan;
  onAddPosition?: (pos: Omit<OpenPosition, 'id'>) => Promise<void>;
  onSavePosition?: (pos: OpenPosition) => Promise<void>;
  onUpdatePosition?: (id: number, pos: Partial<OpenPosition>) => Promise<void>;
  onDeletePosition: (id: number) => Promise<void>;
  onCloseToJournal?: (pos: OpenPosition) => void;
  onClosePositionToJournal?: (pos: OpenPosition) => void;
  onNavigateToCalculator?: () => void;
  onLoadSampleData?: () => Promise<void>;
}

export const PortfolioRiskView: React.FC<PortfolioRiskViewProps> = ({
  positions,
  openPositions,
  accountBalance,
  realizedPnl = 0,
  plan,
  onSavePosition,
  onDeletePosition,
  onCloseToJournal,
  onClosePositionToJournal,
  onNavigateToCalculator,
  onLoadSampleData,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [closingPosition, setClosingPosition] = useState<EnrichedPosition | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMarket, setFilterMarket] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('DATE_DESC');

  // Interactive Max Portfolio Risk Limit State
  const [customMaxRiskPct, setCustomMaxRiskPct] = useState<number>(
    plan?.maxWeeklyLossPercent || 6.0
  );
  const [showRiskConfig, setShowRiskConfig] = useState(false);

  // Success Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeRawPositions = positions || openPositions || [];

  // Extract all unique pair symbols from active positions for market data service
  const symbols = useMemo(() => {
    return Array.from(new Set(activeRawPositions.map(p => p.pair).filter(Boolean)));
  }, [activeRawPositions]);

  // Real-time market prices hook with provider fallback & auto-refresh
  const {
    prices: marketPrices,
    isRefreshing,
    lastRefreshedAt,
    refreshPrices,
    setManualPrice,
    autoRefreshInterval,
    setAutoRefreshInterval,
    statusMessage
  } = useMarketPrices(symbols, 10);

  // Enriched positions with real-time analytics and live market prices
  const enrichedPositions: EnrichedPosition[] = useMemo(() => {
    return activeRawPositions.map((p) => enrichOpenPosition(p, marketPrices));
  }, [activeRawPositions, marketPrices]);

  // Aggregated Portfolio Metrics incorporating live market prices
  const portfolioSummary = useMemo(() => {
    return calculatePortfolioRiskMetrics(
      activeRawPositions,
      accountBalance,
      plan,
      customMaxRiskPct,
      marketPrices
    );
  }, [activeRawPositions, accountBalance, plan, customMaxRiskPct, marketPrices]);

  // Market & Long/Short Exposure Breakdown
  const exposureBreakdown = useMemo(() => {
    return calculateMarketExposureBreakdown(activeRawPositions);
  }, [activeRawPositions]);

  // Live Equity Calculations
  const startingEquity = accountBalance || 10000;
  const closedRealizedPnl = realizedPnl || 0;
  const openUnrealizedPnl = portfolioSummary.totalUnrealizedPnl || 0;
  const totalCombinedPnl = closedRealizedPnl + openUnrealizedPnl;
  const currentNetEquity = startingEquity + totalCombinedPnl;
  const netEquityReturnPct = startingEquity > 0 ? (totalCombinedPnl / startingEquity) * 100 : 0;

  // Freshness & provider checks
  const hasLivePrices = useMemo(() => {
    return enrichedPositions.some(p => p.isPriceLive && !p.isStale);
  }, [enrichedPositions]);

  const hasStalePrices = useMemo(() => {
    return enrichedPositions.some(p => p.isStale);
  }, [enrichedPositions]);

  // Handle Mark Price Updates
  const handleUpdatePrice = async (posId: number, newPrice: number) => {
    const target = activeRawPositions.find(p => p.id === posId);
    if (!target) return;

    // Register manual price override in marketDataService so it updates globally
    setManualPrice(target.pair, newPrice, {
      mode: target.tradeMode,
      spotVenue: target.spotVenue,
    });

    const isLong = target.direction === 'LONG';
    const quantity = target.quantity || (target.entryPrice > 0 ? target.positionSize / target.entryPrice : 0);
    const unrealized = isLong 
      ? (newPrice - target.entryPrice) * quantity 
      : (target.entryPrice - newPrice) * quantity;
    const capital = target.margin > 0 ? target.margin : target.positionSize;
    const unrealizedPct = capital > 0 ? (unrealized / capital) * 100 : 0;

    const updatedPos: OpenPosition = {
      ...target,
      currentPrice: newPrice,
      unrealizedPnl: unrealized,
      unrealizedPnlPct: unrealizedPct,
      latestPriceTimestamp: Date.now(),
      priceSource: 'Manual Override',
      isPriceLive: false,
      isPriceStale: false,
    };

    if (onSavePosition) {
      await onSavePosition(updatedPos);
    } else {
      const { id: _, ...changes } = updatedPos;
      await db.openPositions.update(posId, changes as any);
    }
  };

  // Close Position Success Handler
  const handleCloseSuccess = (archivedTrade: TradeJournalEntry) => {
    setClosingPosition(null);
    setToastMessage(`Closed & archived ${archivedTrade.pair} (${archivedTrade.pnl >= 0 ? '+' : ''}${formatCurrency(archivedTrade.pnl)}) to Trading Journal!`);
    setTimeout(() => setToastMessage(null), 4000);
    // Trigger external refresh if provided
    if (onClosePositionToJournal) {
      // already archived to db by modal, just let parent know if needed
    }
  };

  // Filtered & Sorted Positions
  const filteredPositions = useMemo(() => {
    let list = [...enrichedPositions];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.pair.toLowerCase().includes(q) || 
        (p.correlationGroup && p.correlationGroup.toLowerCase().includes(q)) ||
        (p.exchange && p.exchange.toLowerCase().includes(q))
      );
    }

    // Market filter
    if (filterMarket !== 'ALL') {
      list = list.filter(p => {
        const mode = p.tradeMode || (p.leverage > 1 ? 'PERPETUAL' : 'SPOT');
        if (filterMarket === 'DEX') return p.spotVenue === 'DEX' || mode === 'DEX';
        if (filterMarket === 'SPOT_CEX') return mode === 'SPOT' && p.spotVenue !== 'DEX';
        return mode === filterMarket;
      });
    }

    // Direction filter
    if (filterDirection !== 'ALL') {
      list = list.filter(p => p.direction === filterDirection);
    }

    // Status filter
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'PROFIT') list = list.filter(p => p.netPnl > 0);
      else if (filterStatus === 'LOSS') list = list.filter(p => p.netPnl < 0);
      else if (filterStatus === 'NEAR_STOP') list = list.filter(p => p.status === 'NEAR STOP');
      else if (filterStatus === 'NEAR_TP') list = list.filter(p => p.status === 'NEAR TAKE PROFIT');
      else if (filterStatus === 'HIT') list = list.filter(p => p.status === 'STOP HIT' || p.status === 'TAKE PROFIT HIT');
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'DATE_DESC') return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
      if (sortBy === 'DATE_ASC') return (new Date(a.createdAt || 0).getTime()) - (new Date(b.createdAt || 0).getTime());
      if (sortBy === 'PNL_DESC') return b.netPnl - a.netPnl;
      if (sortBy === 'PNL_ASC') return a.netPnl - b.netPnl;
      if (sortBy === 'RISK_DESC') return (b.riskAmount || 0) - (a.riskAmount || 0);
      if (sortBy === 'CAPITAL_DESC') return (b.margin || b.positionSize) - (a.margin || a.positionSize);
      if (sortBy === 'PAIR_ASC') return a.pair.localeCompare(b.pair);
      return 0;
    });

    return list;
  }, [enrichedPositions, searchQuery, filterMarket, filterDirection, filterStatus, sortBy]);

  return (
    <div id="portfolio-risk-system" className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-[#22a65e]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1565ff]/10 text-[#1565ff] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Active Positions & Portfolio Risk
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-[#1565ff] uppercase">
                Live Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuously monitor real-time open risk, correlations, margin utilization, and stop boundaries
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowRiskConfig(!showRiskConfig)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showRiskConfig 
                ? 'bg-blue-50 border-blue-300 text-[#1565ff]' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
            title="Configure Max Portfolio Risk %"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Risk Cap: {customMaxRiskPct.toFixed(1)}%</span>
          </button>

          {onNavigateToCalculator && (
            <button
              type="button"
              onClick={onNavigateToCalculator}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Risk Calculator</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Track Position</span>
          </button>
        </div>
      </div>

      {/* QUICK RISK CONFIG DRAWER */}
      {showRiskConfig && (
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl animate-in fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Portfolio Risk Threshold Configuration
              </h4>
              <p className="text-[11px] text-slate-600">
                Define the maximum cumulative stop-loss risk permitted across all simultaneous open trades.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRiskConfig(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Max Portfolio Risk:</span>
              <input
                type="range"
                min="2.0"
                max="15.0"
                step="0.5"
                value={customMaxRiskPct}
                onChange={(e) => setCustomMaxRiskPct(parseFloat(e.target.value))}
                className="w-32 accent-[#1565ff]"
              />
              <span className="font-mono font-bold text-[#1565ff] text-sm">
                {customMaxRiskPct.toFixed(1)}%
              </span>
              <span className="text-slate-500">
                ({formatCurrency((accountBalance * customMaxRiskPct) / 100)})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {[4.0, 6.0, 8.0, 10.0].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setCustomMaxRiskPct(pct)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    customMaxRiskPct === pct
                      ? 'bg-[#1565ff] text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {pct.toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LIVE MARKET PRICE & MONITORING CONTROL BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Feed Status & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Indicator */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
            hasLivePrices
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700'
              : hasStalePrices
              ? 'bg-amber-50/80 border-amber-200 text-amber-700'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              hasLivePrices
                ? 'bg-emerald-500 animate-pulse'
                : hasStalePrices
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`} />
            <span>
              {hasLivePrices 
                ? 'Real Market Feeds Active (Binance & ECB)' 
                : hasStalePrices 
                ? 'Stale Prices Detected (>60s)' 
                : 'Manual Price Mode Active'}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refreshPrices()}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Force refresh live market prices"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshing ? 'animate-spin text-[#1565ff]' : ''}`} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh Prices'}</span>
          </button>

          {/* Auto-Refresh Select */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
            <span className="font-semibold text-slate-500 text-[11px]">Auto:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value) as AutoRefreshInterval)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
            >
              <option value={0}>Off</option>
              <option value={5}>Every 5s</option>
              <option value={10}>Every 10s</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 60s</option>
            </select>
          </div>

          {/* Last Updated Timestamp & Status */}
          {lastRefreshedAt && (
            <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
              Updated: {new Date(lastRefreshedAt).toLocaleTimeString()}
            </span>
          )}
          {statusMessage && (
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md hidden lg:inline-block">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Right: Real-time Health Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700">
            {portfolioSummary.winningCount} Winning
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200/80 text-[#ff3b4a]">
            {portfolioSummary.losingCount} Losing
          </span>
          {portfolioSummary.approachingSlCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>{portfolioSummary.approachingSlCount} Near Stop</span>
            </span>
          )}
          {portfolioSummary.slHitCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 flex items-center gap-1 font-black animate-pulse">
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              <span>{portfolioSummary.slHitCount} Stop Hit</span>
            </span>
          )}
          {portfolioSummary.approachingTpCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center gap-1">
              <span>🎯 {portfolioSummary.approachingTpCount} Near Target</span>
            </span>
          )}
          {portfolioSummary.tpHitCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white flex items-center gap-1">
              <span>🏆 {portfolioSummary.tpHitCount} Target Hit</span>
            </span>
          )}
        </div>
      </div>

      {/* LIVE EQUITY & CAPITAL HEALTH DASHBOARD CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          <div className="space-y-1 sm:pr-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Starting Capital
            </span>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-white">
              {formatCurrency(startingEquity)}
            </div>
            <span className="text-[10px] text-slate-400">Baseline balance</span>
          </div>

          <div className="space-y-1 sm:px-4 pt-3 sm:pt-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Journal Realized P/L
            </span>
            <div className={`text-lg sm:text-xl font-extrabold font-mono ${
              closedRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {closedRealizedPnl >= 0 ? '+' : ''}{formatCurrency(closedRealizedPnl)}
            </div>
            <span className="text-[10px] text-slate-400">Closed journal trades</span>
          </div>

          <div className="space-y-1 sm:px-4 pt-3 sm:pt-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Open Unrealized P/L
            </span>
            <div className={`text-lg sm:text-xl font-extrabold font-mono ${
              openUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {openUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(openUnrealizedPnl)}
            </div>
            <span className="text-[10px] text-slate-400">Live mark-to-market</span>
          </div>

          <div className="space-y-1 sm:px-4 pt-3 sm:pt-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Combined P/L
            </span>
            <div className={`text-lg sm:text-xl font-extrabold font-mono ${
              totalCombinedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {totalCombinedPnl >= 0 ? '+' : ''}{formatCurrency(totalCombinedPnl)}
            </div>
            <span className="text-[10px] text-slate-400">Realized + Unrealized</span>
          </div>

          <div className="space-y-1 sm:pl-4 pt-3 sm:pt-0 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider block">
              Current Net Equity
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-white flex items-center gap-2">
              <span>{formatCurrency(currentNetEquity)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                netEquityReturnPct >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {netEquityReturnPct >= 0 ? '+' : ''}{netEquityReturnPct.toFixed(2)}%
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Real-time portfolio value</span>
          </div>
        </div>
      </div>

      {/* TOP METRICS BAR (6 PRIMARY CARDS) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Total Open Positions */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Open Positions
          </span>
          <div className="text-xl font-extrabold font-mono text-slate-900 tracking-tight">
            {portfolioSummary.totalOpenPositions}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {exposureBreakdown.perpetual.count} Perp • {exposureBreakdown.spot.count + exposureBreakdown.dex.count} Spot • {exposureBreakdown.forex.count} FX
          </div>
        </div>

        {/* Metric 2: Capital Allocated */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Capital Allocated
          </span>
          <div className="text-xl font-extrabold font-mono text-slate-900 tracking-tight">
            {formatCurrency(portfolioSummary.totalCapitalAllocated)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {accountBalance > 0 ? `${((portfolioSummary.totalCapitalAllocated / accountBalance) * 100).toFixed(1)}% of equity` : '0%'}
          </div>
        </div>

        {/* Metric 3: Total Open Risk */}
        <div className={`rounded-2xl p-4 border shadow-2xs space-y-1 ${
          portfolioSummary.totalRiskPct > portfolioSummary.maxAllowedPortfolioRiskPct
            ? 'bg-rose-50/60 border-rose-300'
            : 'bg-white border-slate-200/90'
        }`}>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Open Risk
          </span>
          <div className={`text-xl font-extrabold font-mono tracking-tight ${
            portfolioSummary.totalRiskPct > portfolioSummary.maxAllowedPortfolioRiskPct
              ? 'text-[#ff3b4a]'
              : 'text-slate-900'
          }`}>
            {formatCurrency(portfolioSummary.totalOpenRisk)}
          </div>
          <div className={`text-[10px] font-bold ${
            portfolioSummary.totalRiskPct > portfolioSummary.maxAllowedPortfolioRiskPct
              ? 'text-[#ff3b4a]'
              : 'text-slate-600'
          }`}>
            {portfolioSummary.totalRiskPct.toFixed(2)}% of equity
          </div>
        </div>

        {/* Metric 4: Total Current P/L */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Unrealized P/L
          </span>
          <div className={`text-xl font-extrabold font-mono tracking-tight ${
            portfolioSummary.totalUnrealizedPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
          }`}>
            {portfolioSummary.totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(portfolioSummary.totalUnrealizedPnl)}
          </div>
          <div className={`text-[10px] font-bold ${
            portfolioSummary.totalUnrealizedPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
          }`}>
            {portfolioSummary.totalUnrealizedPnl >= 0 ? '+' : ''}{portfolioSummary.totalUnrealizedPnlPct.toFixed(2)}% net
          </div>
        </div>

        {/* Metric 5: Portfolio Risk Tier & Limit */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Portfolio Risk Cap
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
              portfolioSummary.portfolioRiskTier === 'CRITICAL'
                ? 'bg-rose-100 text-rose-800'
                : portfolioSummary.portfolioRiskTier === 'AGGRESSIVE'
                ? 'bg-amber-100 text-amber-800'
                : portfolioSummary.portfolioRiskTier === 'MODERATE'
                ? 'bg-blue-100 text-[#1565ff]'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {portfolioSummary.portfolioRiskTier}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            Max Limit: {portfolioSummary.maxAllowedPortfolioRiskPct.toFixed(1)}% ({formatCurrency(portfolioSummary.maxAllowedPortfolioRisk)})
          </div>
        </div>

        {/* Metric 6: Remaining Risk Capacity */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Risk Capacity
            </span>
            <span className={`text-[10px] font-mono font-bold ${
              portfolioSummary.remainingRiskCapacity > 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
            }`}>
              {portfolioSummary.remainingRiskCapacityPct.toFixed(1)}% Left
            </span>
          </div>
          <div className={`text-lg font-extrabold font-mono tracking-tight ${
            portfolioSummary.remainingRiskCapacity > 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
          }`}>
            {formatCurrency(portfolioSummary.remainingRiskCapacity)}
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                portfolioSummary.totalRiskPct > portfolioSummary.maxAllowedPortfolioRiskPct
                  ? 'bg-rose-500'
                  : portfolioSummary.totalRiskPct > portfolioSummary.maxAllowedPortfolioRiskPct * 0.8
                  ? 'bg-amber-500'
                  : 'bg-[#22a65e]'
              }`}
              style={{
                width: `${Math.min(100, Math.max(0, (portfolioSummary.totalOpenRisk / (portfolioSummary.maxAllowedPortfolioRisk || 1)) * 100))}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* RISK WARNINGS (IF ANY) */}
      {portfolioSummary.riskWarnings.length > 0 && (
        <div className="space-y-2">
          {portfolioSummary.riskWarnings.map((warn, i) => (
            <div 
              key={i} 
              className="p-3 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800"
            >
              <AlertTriangle className="w-4 h-4 text-[#ff3b4a] shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* MARKET EXPOSURE & DIRECTIONAL BIAS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Markets Breakdown Card (2 cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-[#1565ff]" />
              Market Mode Exposure Breakdown
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Total Notional: {formatCurrency(exposureBreakdown.totalNotional)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Perpetual */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">Perpetual</span>
                <span className="text-[10px] font-bold bg-blue-100 text-[#1565ff] px-1.5 py-0.5 rounded">
                  {exposureBreakdown.perpetual.count}
                </span>
              </div>
              <div className="font-mono font-black text-slate-900 text-sm">
                {formatCurrency(exposureBreakdown.perpetual.notional)}
              </div>
              <div className="text-[10px] text-slate-500">
                Margin: {formatCurrency(exposureBreakdown.perpetual.margin)} • Risk: {formatCurrency(exposureBreakdown.perpetual.risk)}
              </div>
            </div>

            {/* Spot CEX */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">Spot (CEX)</span>
                <span className="text-[10px] font-bold bg-emerald-100 text-[#22a65e] px-1.5 py-0.5 rounded">
                  {exposureBreakdown.spot.count}
                </span>
              </div>
              <div className="font-mono font-black text-slate-900 text-sm">
                {formatCurrency(exposureBreakdown.spot.notional)}
              </div>
              <div className="text-[10px] text-slate-500">
                Invested: {formatCurrency(exposureBreakdown.spot.margin)} • Risk: {formatCurrency(exposureBreakdown.spot.risk)}
              </div>
            </div>

            {/* Spot DEX */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">DEX Spot</span>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                  {exposureBreakdown.dex.count}
                </span>
              </div>
              <div className="font-mono font-black text-slate-900 text-sm">
                {formatCurrency(exposureBreakdown.dex.notional)}
              </div>
              <div className="text-[10px] text-slate-500">
                Invested: {formatCurrency(exposureBreakdown.dex.margin)} • Risk: {formatCurrency(exposureBreakdown.dex.risk)}
              </div>
            </div>

            {/* Forex */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">Forex</span>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  {exposureBreakdown.forex.count}
                </span>
              </div>
              <div className="font-mono font-black text-slate-900 text-sm">
                {formatCurrency(exposureBreakdown.forex.notional)}
              </div>
              <div className="text-[10px] text-slate-500">
                Margin: {formatCurrency(exposureBreakdown.forex.margin)} • Risk: {formatCurrency(exposureBreakdown.forex.risk)}
              </div>
            </div>
          </div>
        </div>

        {/* Directional Balance & Correlation Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#1565ff]" />
              Directional Bias
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              exposureBreakdown.netDirectionBias === 'LONG'
                ? 'bg-emerald-100 text-[#22a65e]'
                : exposureBreakdown.netDirectionBias === 'SHORT'
                ? 'bg-rose-100 text-[#ff3b4a]'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {exposureBreakdown.netDirectionBias} BIAS
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-600">Long Notional:</span>
              <span className="font-bold text-[#22a65e]">
                {formatCurrency(exposureBreakdown.longNotional)}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-600">Short Notional:</span>
              <span className="font-bold text-[#ff3b4a]">
                {formatCurrency(exposureBreakdown.shortNotional)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-mono font-bold">
              <span className="text-slate-800">Net Exposure:</span>
              <span className={exposureBreakdown.netExposureNotional >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}>
                {exposureBreakdown.netExposureNotional >= 0 ? '+' : ''}{formatCurrency(exposureBreakdown.netExposureNotional)}
              </span>
            </div>

            {/* Split Bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-[#22a65e]"
                style={{
                  width: `${exposureBreakdown.totalNotional > 0 ? (exposureBreakdown.longNotional / exposureBreakdown.totalNotional) * 100 : 50}%`
                }}
              />
              <div 
                className="h-full bg-[#ff3b4a]"
                style={{
                  width: `${exposureBreakdown.totalNotional > 0 ? (exposureBreakdown.shortNotional / exposureBreakdown.totalNotional) * 100 : 50}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CORRELATION GROUPS PILLS */}
      {portfolioSummary.correlatedGroups.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Active Correlation Risk Clusters:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {portfolioSummary.correlatedGroups.map((cg) => (
              <div 
                key={cg.groupName}
                className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${
                  cg.isOverConcentrated
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <span className="font-bold">{cg.groupName}</span>
                <span className="font-mono text-[11px] text-slate-500">
                  ({cg.positionsCount} pos • {formatCurrency(cg.exposureRisk)} / {cg.exposureRiskPct.toFixed(1)}%)
                </span>
                {cg.isOverConcentrated && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-200 text-rose-800">
                    High Risk
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTER, SEARCH & VIEW TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search pair, group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#1565ff] focus:outline-none"
            />
          </div>

          {/* Market Filter */}
          <select
            value={filterMarket}
            onChange={(e) => setFilterMarket(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Markets</option>
            <option value="PERPETUAL">Perpetual</option>
            <option value="SPOT_CEX">Spot (CEX)</option>
            <option value="DEX">DEX Spot</option>
            <option value="FOREX">Forex</option>
          </select>

          {/* Direction Filter */}
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Directions</option>
            <option value="LONG">Long / Buy</option>
            <option value="SHORT">Short / Sell</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PROFIT">In Profit</option>
            <option value="LOSS">In Loss</option>
            <option value="NEAR_STOP">Near Stop</option>
            <option value="NEAR_TP">Near Take Profit</option>
            <option value="HIT">Stop/TP Hit</option>
          </select>
        </div>

        {/* Sort & Layout Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="DATE_DESC">Newest First</option>
            <option value="DATE_ASC">Oldest First</option>
            <option value="PNL_DESC">Highest P/L</option>
            <option value="PNL_ASC">Lowest P/L</option>
            <option value="RISK_DESC">Highest Risk</option>
            <option value="CAPITAL_DESC">Largest Size</option>
            <option value="PAIR_ASC">Symbol (A-Z)</option>
          </select>

          {/* Cards / Table Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-[#1565ff] shadow-xs' : 'text-slate-500'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-[#1565ff] shadow-xs' : 'text-slate-500'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* POSITIONS LISTING */}
      {filteredPositions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1565ff] flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">
              {activeRawPositions.length === 0 ? 'No Open Positions Tracked' : 'No Positions Match Filters'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {activeRawPositions.length === 0 
                ? 'Track your active trades here to manage real-time risk capacity, monitor stop loss boundaries, and close directly to your trading journal.'
                : 'Try adjusting your search query or clearing the selected market/status filters.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Track First Position</span>
            </button>

            {activeRawPositions.length === 0 && onLoadSampleData && (
              <button
                type="button"
                onClick={async () => {
                  setIsLoadingSample(true);
                  try {
                    await onLoadSampleData();
                  } finally {
                    setIsLoadingSample(false);
                  }
                }}
                disabled={isLoadingSample}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSample ? 'animate-spin' : ''}`} />
                <span>Load Sample Positions</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPositions.map((pos) => (
            <PositionCard
              key={pos.id || `${pos.pair}-${pos.entryPrice}`}
              position={pos}
              onUpdatePrice={handleUpdatePrice}
              onClosePosition={(p) => setClosingPosition(p)}
              onDeletePosition={(id) => setDeleteConfirmId(id)}
            />
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Market / Pair</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Entry / Current</th>
                  <th className="py-3 px-4">Stop / Target</th>
                  <th className="py-3 px-4">Size / Margin</th>
                  <th className="py-3 px-4">Stop Risk</th>
                  <th className="py-3 px-4">Net P/L</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPositions.map((pos) => {
                  const isLong = pos.direction === 'LONG';
                  const isProfitable = pos.netPnl >= 0;
                  const mode = pos.tradeMode || (pos.leverage > 1 ? 'PERPETUAL' : 'SPOT');

                  return (
                    <tr key={pos.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Pair */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded flex items-center justify-center font-black text-[10px] text-white ${
                            isLong ? 'bg-[#22a65e]' : 'bg-[#ff3b4a]'
                          }`}>
                            {isLong ? 'L' : 'S'}
                          </span>
                          <div>
                            <span className="font-extrabold font-mono text-slate-900 block">
                              {pos.pair}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {mode} • {pos.exchange || 'CEX'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          pos.status === 'STOP HIT' ? 'bg-rose-100 text-rose-800' :
                          pos.status === 'TAKE PROFIT HIT' ? 'bg-emerald-100 text-emerald-800' :
                          pos.status === 'NEAR STOP' ? 'bg-rose-100 text-rose-800 animate-pulse' :
                          pos.status === 'NEAR TAKE PROFIT' ? 'bg-emerald-100 text-emerald-800 animate-pulse' :
                          pos.status === 'PROFITABLE' ? 'bg-emerald-50 text-[#22a65e]' :
                          pos.status === 'LOSING' ? 'bg-rose-50 text-[#ff3b4a]' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {pos.statusBadge}
                        </span>
                      </td>

                      {/* Entry & Current */}
                      <td className="py-3 px-4 font-mono">
                        <span className="text-slate-500 block text-[11px]">
                          Entry: ${formatNumber(pos.entryPrice)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-bold text-[#1565ff] text-xs">
                            ${formatNumber(pos.currentPrice || pos.entryPrice)}
                          </span>
                          <span className={`text-[9px] font-sans px-1.5 py-0.5 rounded font-bold uppercase tracking-tight ${
                            pos.isPriceLive && !pos.isStale
                              ? 'bg-emerald-100 text-emerald-800'
                              : pos.isStale
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {pos.isPriceLive ? (pos.isStale ? 'Stale' : 'Live') : 'Manual'}
                          </span>
                        </div>
                      </td>

                      {/* Stop / Target */}
                      <td className="py-3 px-4 font-mono">
                        <span className="text-rose-700 block text-[11px]">
                          SL: ${formatNumber(pos.stopLoss)}
                        </span>
                        <span className="text-emerald-700 block text-[11px]">
                          TP: {pos.takeProfit ? `$${formatNumber(pos.takeProfit)}` : 'Open'}
                        </span>
                      </td>

                      {/* Size / Margin */}
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-800 block text-xs">
                          {formatCurrency(pos.positionSize)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Margin: {formatCurrency(pos.margin || pos.positionSize)}
                        </span>
                      </td>

                      {/* Stop Risk */}
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-[#ff3b4a] block text-xs">
                          {formatCurrency(pos.riskAmount)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {pos.riskPct.toFixed(1)}% of capital
                        </span>
                      </td>

                      {/* Net P/L */}
                      <td className="py-3 px-4 font-mono">
                        <span className={`font-bold block text-xs ${
                          isProfitable ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
                        }`}>
                          {isProfitable ? '+' : ''}{formatCurrency(pos.netPnl)}
                        </span>
                        <span className={`text-[10px] ${
                          isProfitable ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
                        }`}>
                          {pos.currentRMultiple >= 0 ? '+' : ''}{pos.currentRMultiple.toFixed(2)}R
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setClosingPosition(pos)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#22a65e] border border-emerald-200 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                          >
                            Close & Journal
                          </button>
                          <button
                            type="button"
                            onClick={() => pos.id && setDeleteConfirmId(pos.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SAFE DELETE CONFIRMATION MODAL */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-[#ff3b4a] rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Remove Open Position?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove this position from active portfolio tracking?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deleteConfirmId) {
                    await onDeletePosition(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRACK NEW POSITION MODAL */}
      {showAddModal && (
        <AddPositionModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={async (newPos) => {
            if (onSavePosition) {
              await onSavePosition(newPos);
            } else {
              await saveOpenPosition(newPos);
            }
            setShowAddModal(false);
          }}
          accountBalance={accountBalance}
        />
      )}

      {/* CLOSE POSITION MODAL */}
      {closingPosition && (
        <ClosePositionModal
          position={closingPosition}
          isOpen={true}
          onClose={() => setClosingPosition(null)}
          onSuccess={handleCloseSuccess}
        />
      )}
    </div>
  );
};
