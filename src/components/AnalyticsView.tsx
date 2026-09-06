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
import { calculateTagStats } from '../utils/analytics';
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

  const tagStats = useMemo(() => calculateTagStats(trades), [trades]);

  const handleSaveWidgets = (updated: AnalyticsWidgetConfig[]) => {
    setWidgets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save widget layout to localStorage:', e);
    }
  };

  const handleResetToDefault = () => {
    setWidgets(DEFAULT_ANALYTICS_WIDGETS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ANALYTICS_WIDGETS));
    } catch (e) {
      console.error('Failed to reset widget layout:', e);
    }
  };

  // Move single widget up/down directly from widget header
  const handleQuickMove = (widgetId: string, direction: 'up' | 'down') => {
    const currentIndex = widgets.findIndex((w) => w.id === widgetId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    const updated = [...widgets];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);

    handleSaveWidgets(updated);
  };

  // Hide single widget directly from header
  const handleQuickHide = (widgetId: string) => {
    const activeCount = widgets.filter((w) => w.enabled).length;
    if (activeCount <= 1) {
      alert('At least one widget must remain visible.');
      return;
    }
    const updated = widgets.map((w) => (w.id === widgetId ? { ...w, enabled: false } : w));
    handleSaveWidgets(updated);
  };

  // Compute Cumulative Equity Progression
  const equityPoints = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    // Sort chronologically
    const sorted = [...trades].sort(
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
  }, [trades, initialBalance]);

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

  // Win/Loss Donut SVG calculation
  const winCount = stats.totalWins;
  const lossCount = stats.totalLosses;
  const beCount = stats.totalBreakeven;
  const totalCount = Math.max(1, stats.totalTrades);

  // Expectancy calculation
  const expectancy = useMemo(() => {
    if (stats.totalTrades === 0) return 0;
    const winPct = stats.winRate / 100;
    const lossPct = (100 - stats.winRate) / 100;
    return (winPct * stats.avgWin) - (lossPct * Math.abs(stats.avgLoss));
  }, [stats]);

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
                <span className="text-[10px] sm:text-xs font-mono text-slate-500">{stats.totalTrades} Trades</span>
                {renderWidgetHeaderControls('kpi_summary')}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 pt-0.5 sm:pt-1">
              {/* Card 1: Net P&L */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Net P&L</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className={`text-base sm:text-lg font-bold font-mono ${stats.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {stats.totalPnl >= 0 ? '+' : ''}{formatCurrency(stats.totalPnl)}
                  </span>
                </div>
              </div>

              {/* Card 2: Win Rate */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Win Rate</span>
                <div className="mt-0.5 sm:mt-1 flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
                  <span className={`text-base sm:text-lg font-bold font-mono ${stats.winRate >= 50 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {stats.winRate.toFixed(1)}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">({stats.totalWins}W/{stats.totalLosses}L)</span>
                </div>
              </div>

              {/* Card 3: Profit Factor */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Profit Factor</span>
                <div className="mt-0.5 sm:mt-1 flex items-baseline gap-1 sm:gap-1.5">
                  <span className={`text-base sm:text-lg font-bold font-mono ${stats.profitFactor >= 1.5 ? 'text-[#22a65e]' : stats.profitFactor >= 1 ? 'text-blue-600' : 'text-[#ff3b4a]'}`}>
                    {stats.profitFactor.toFixed(2)}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">ratio</span>
                </div>
              </div>

              {/* Card 4: Expectancy */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Expectancy</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className={`text-base sm:text-lg font-bold font-mono ${expectancy >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {expectancy >= 0 ? '+' : ''}{formatCurrency(expectancy)}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 block">/trade</span>
                </div>
              </div>

              {/* Card 5: Win & Loss Streaks */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Best Streaks</span>
                <div className="mt-0.5 sm:mt-1 flex items-baseline justify-between text-[11px] sm:text-xs font-mono">
                  <span className="font-bold text-[#22a65e]">{stats.winStreak}W</span>
                  <span className="font-bold text-[#ff3b4a]">{stats.loseStreak}L</span>
                </div>
              </div>

              {/* Card 6: Trading Volume & Fees */}
              <div className="bg-slate-50/90 p-2.5 sm:p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Fees Paid</span>
                <div className="mt-0.5 sm:mt-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {formatCurrency(stats.totalFeesPaid)}
                  </span>
                </div>
              </div>
            </div>
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
                <span className="text-slate-500">Balance: <strong className="text-slate-900">{formatCurrency(initialBalance + stats.totalPnl)}</strong></span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Peak: <strong className="text-[#22a65e]">+{formatCurrency(stats.largestWin)}</strong></span>
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
                            stroke={stats.totalPnl >= 0 ? '#1565ff' : '#ff3b4a'}
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
                    {stats.winRate.toFixed(0)}%
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
                <span className="text-[10px] sm:text-xs font-mono text-slate-500">{monthlyStats.length} Months Tracked</span>
                {renderWidgetHeaderControls('monthly_pnl')}
              </div>
            </div>

            {monthlyStats.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-slate-500 text-xs">
                No monthly trade data logged yet.
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
                {monthlyStats.map((m) => {
                  const isProfitable = m.pnl >= 0;
                  const maxMonthlyAbs = Math.max(...monthlyStats.map((item) => Math.abs(item.pnl)), 100);
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
                <span className="text-[10px] sm:text-xs font-mono text-slate-500">{pairStats.length} Unique Assets</span>
                {renderWidgetHeaderControls('pair_performance')}
              </div>
            </div>

            {pairStats.length === 0 ? (
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
                    {pairStats.map((item) => {
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
              {insights.map((insight) => (
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
            <span className={`font-bold text-xs sm:text-sm ${stats.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}{((stats.totalPnl / initialBalance) * 100).toFixed(2)}% ROI
            </span>
          </div>
        </div>
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
