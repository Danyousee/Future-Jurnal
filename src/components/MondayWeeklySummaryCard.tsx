import React, { useState } from 'react';
import { 
  Bell, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  DollarSign, 
  Activity, 
  ShieldCheck, 
  ArrowRight, 
  X, 
  Layers, 
  Zap, 
  Clock, 
  RotateCcw,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { WeeklyPerformanceSummary } from '../utils/weeklyNotificationTrigger';
import { formatCurrency } from '../utils/calculator';

interface MondayWeeklySummaryCardProps {
  summary: WeeklyPerformanceSummary;
  onDismiss: () => void;
  onNavigateTab: (tab: string) => void;
  onToggleSimulation?: () => void;
}

export const MondayWeeklySummaryCard: React.FC<MondayWeeklySummaryCardProps> = ({
  summary,
  onDismiss,
  onNavigateTab,
  onToggleSimulation,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const isPositivePnl = summary.totalPnl >= 0;
  const isPositiveUnrealized = summary.activeTradesUnrealizedPnl >= 0;

  return (
    <section 
      id="monday-performance-summary-banner"
      aria-label="Monday Morning Performance Briefing"
      className="bg-white border-2 border-blue-500/30 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden transition-all animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {/* Subtle top indicator stripe */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1565ff] via-indigo-500 to-emerald-500" />

      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1565ff] border border-blue-200/70 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Monday Morning Performance Briefing
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#1565ff] uppercase tracking-wider">
                <Bell className="w-2.5 h-2.5" />
                Weekly Trigger
              </span>
              {summary.isSimulated && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Simulation Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Weekly recap for active position holders • {summary.timeframeLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleSimulation && (
            <button
              type="button"
              id="toggle-monday-sim-btn"
              onClick={onToggleSimulation}
              title={summary.isSimulated ? 'Disable Monday Simulation' : 'Enable Monday Simulation'}
              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
            >
              {summary.isSimulated ? 'Exit Sim' : 'Test Sim'}
            </button>
          )}
          <button
            type="button"
            id="dismiss-monday-summary-btn"
            onClick={onDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Dismiss summary for today"
            aria-label="Dismiss summary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary KPI Grid: Win Rate, Total PnL, Active Positions Alert */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
        {/* Metric 1: Win Rate */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Week's Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
              {summary.totalTrades > 0 ? `${summary.winRate}%` : 'N/A'}
            </div>
            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-600 mt-1">
              <span>{summary.wins}W / {summary.losses}L {summary.breakevens > 0 ? `/ ${summary.breakevens}BE` : ''}</span>
              <span className="text-slate-400 font-medium">({summary.totalTrades} closed)</span>
            </div>
            {summary.totalTrades > 0 && (
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2 flex">
                <div 
                  className="bg-emerald-500 h-full transition-all" 
                  style={{ width: `${summary.winRate}%` }} 
                />
                <div 
                  className="bg-rose-500 h-full transition-all" 
                  style={{ width: `${100 - summary.winRate}%` }} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Total Week PnL */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Week's Total P&L</span>
            {isPositivePnl ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            )}
          </div>
          <div>
            <div className={`text-2xl font-extrabold font-mono tracking-tight ${
              isPositivePnl ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {summary.totalTrades === 0 
                ? '$0.00' 
                : `${isPositivePnl ? '+' : ''}${formatCurrency(summary.totalPnl)}`}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
              <span className={isPositivePnl ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                {summary.totalPnlPct >= 0 ? '+' : ''}{summary.totalPnlPct}% account
              </span>
              <span className="text-slate-400">
                PF: {summary.profitFactor > 900 ? '∞' : summary.profitFactor}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-2 truncate">
              {summary.bestTrade ? `Top: +$${formatCurrency(summary.bestTrade.pnl)} (${summary.bestTrade.pair})` : 'No closed trades'}
            </div>
          </div>
        </div>

        {/* Metric 3: Active Trades Trigger Status */}
        <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#1565ff] font-bold mb-1">
            <span>Active Positions</span>
            <Layers className="w-3.5 h-3.5 text-[#1565ff]" />
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>{summary.activeTradesCount}</span>
              <span className="text-xs font-sans font-semibold text-slate-500">
                {summary.activeTradesCount === 1 ? 'open trade' : 'open trades'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-700 mt-1">
              <span>Unrealized:</span>
              <span className={`font-mono font-bold ${
                summary.activeTradesUnrealizedPnl === 0 
                  ? 'text-slate-700' 
                  : isPositiveUnrealized 
                    ? 'text-emerald-600' 
                    : 'text-rose-600'
              }`}>
                {summary.activeTradesUnrealizedPnl > 0 ? '+' : ''}${formatCurrency(summary.activeTradesUnrealizedPnl)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2 truncate font-mono">
              {summary.activePairs.length > 0 
                ? summary.activePairs.slice(0, 3).join(', ') + (summary.activePairs.length > 3 ? ` +${summary.activePairs.length - 3}` : '')
                : 'No open pairs'}
            </div>
          </div>
        </div>
      </div>

      {/* Monday Risk Advisory Note */}
      <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-200/70 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <ShieldCheck className="w-4 h-4 text-[#1565ff] shrink-0" />
          <span className="leading-snug">
            <strong>Monday Action:</strong> You are carrying {summary.activeTradesCount} active {summary.activeTradesCount === 1 ? 'position' : 'positions'} into the new market week. Verify stop losses before taking new setups.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="monday-view-positions-btn"
            onClick={() => onNavigateTab('portfolio')}
            className="px-3 py-1.5 bg-[#1565ff] hover:bg-[#0c53dc] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer min-h-[36px]"
          >
            <span>Manage Open Positions</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            id="monday-view-journal-btn"
            onClick={() => onNavigateTab('entries')}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer min-h-[36px]"
          >
            Journal
          </button>
        </div>
      </div>
    </section>
  );
};
