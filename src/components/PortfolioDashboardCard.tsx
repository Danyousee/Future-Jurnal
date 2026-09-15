import React from 'react';
import { 
  PieChart, 
  Layers, 
  TrendingUp, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  DollarSign, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  ExternalLink
} from 'lucide-react';
import { OpenPosition, PortfolioExposureMetrics } from '../types';
import { calculatePortfolioExposure, formatCurrency, formatNumber } from '../utils/calculator';

interface PortfolioDashboardCardProps {
  metrics?: PortfolioExposureMetrics;
  positions?: OpenPosition[];
  accountBalance: number;
  onViewDetails?: () => void;
}

export const PortfolioDashboardCard: React.FC<PortfolioDashboardCardProps> = ({
  metrics,
  positions = [],
  accountBalance,
  onViewDetails,
}) => {
  const safeMetrics: PortfolioExposureMetrics = 
    metrics || calculatePortfolioExposure(positions, accountBalance);

  const {
    totalPositions = 0,
    totalNotionalExposure = 0,
    totalMarginUsed = 0,
    totalAccountRisk = 0,
    totalAccountRiskPct = 0,
    totalUnrealizedPnl = 0,
    totalUnrealizedPnlPct = 0,
    longExposure = 0,
    shortExposure = 0,
    netExposure = 0,
    marginUtilizationPct = 0,
    portfolioRiskTier = 'NORMAL',
    riskWarnings = [],
  } = safeMetrics;

  return (
    <div id="portfolio-dashboard-summary" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Header & Risk Status Badge */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#1565ff]/10 text-[#1565ff] rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Live Portfolio Risk & Open Exposure
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              {totalPositions} Open Position{totalPositions !== 1 ? 's' : ''} Tracked
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border ${
              portfolioRiskTier === 'EXTREME'
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : portfolioRiskTier === 'HIGH'
                ? 'bg-orange-100 text-orange-800 border-orange-300'
                : portfolioRiskTier === 'ELEVATED'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
          >
            {portfolioRiskTier === 'EXTREME' || portfolioRiskTier === 'HIGH' ? (
              <ShieldAlert className="w-3.5 h-3.5" />
            ) : portfolioRiskTier === 'ELEVATED' ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{portfolioRiskTier} RISK</span>
          </span>

          {onViewDetails && (
            <button
              type="button"
              onClick={onViewDetails}
              className="text-xs font-bold text-[#1565ff] hover:text-[#0051e6] flex items-center gap-1 cursor-pointer pl-1"
            >
              <span>Manage</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Numbers Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Notional</span>
          <span className="text-base font-black text-slate-900 mt-0.5 block">
            {formatCurrency(totalNotionalExposure)}
          </span>
          <span className="text-[10px] text-slate-500">
            {accountBalance > 0 ? (totalNotionalExposure / accountBalance).toFixed(1) : 0}x of Equity
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Stop Risk</span>
          <span className="text-base font-black text-rose-600 mt-0.5 block">
            {formatCurrency(totalAccountRisk)}
          </span>
          <span className="text-[10px] text-slate-500 font-bold">
            {totalAccountRiskPct.toFixed(2)}% of Balance
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Unrealized P&L</span>
          <span className={`text-base font-black mt-0.5 block ${
            totalUnrealizedPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
          }`}>
            {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)}
          </span>
          <span className="text-[10px] text-slate-500">
            {totalUnrealizedPnlPct >= 0 ? '+' : ''}{totalUnrealizedPnlPct.toFixed(2)}%
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Margin Used</span>
          <span className="text-base font-black text-[#1565ff] mt-0.5 block">
            {formatCurrency(totalMarginUsed)}
          </span>
          <span className="text-[10px] text-slate-500">
            {marginUtilizationPct.toFixed(1)}% Utilization
          </span>
        </div>
      </div>

      {/* Long / Short Net Breakdown Bar */}
      {totalNotionalExposure > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Long: {formatCurrency(longExposure)} ({((longExposure / totalNotionalExposure) * 100).toFixed(0)}%)
            </span>
            <span className="text-slate-700 font-bold">
              Net Bias: {netExposure >= 0 ? 'Long' : 'Short'} ({formatCurrency(Math.abs(netExposure))})
            </span>
            <span className="text-rose-700 font-bold flex items-center gap-1">
              Short: {formatCurrency(shortExposure)} ({((shortExposure / totalNotionalExposure) * 100).toFixed(0)}%) <ArrowDownRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${(longExposure / totalNotionalExposure) * 100}%` }}
              className="bg-emerald-500 h-full transition-all"
            />
            <div
              style={{ width: `${(shortExposure / totalNotionalExposure) * 100}%` }}
              className="bg-rose-500 h-full transition-all"
            />
          </div>
        </div>
      )}

      {/* Warning banner if elevated */}
      {riskWarnings.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-snug">{riskWarnings[0]}</p>
        </div>
      )}
    </div>
  );
};
