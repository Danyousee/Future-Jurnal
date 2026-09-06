import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  Percent, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  BarChart3,
  Edit3,
  Check,
  Plus,
  PlusCircle,
  Calculator,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ArrowRight,
  Info
} from 'lucide-react';
import { 
  JournalStats, 
  DrawdownMetrics, 
  PerformanceScore, 
  DailyRiskStatus, 
  TradingPlan, 
  SmartInsight,
  OpenPosition,
  TradeJournalEntry 
} from '../types';
import { formatCurrency, formatNumber, calculatePortfolioExposure } from '../utils/calculator';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface RiskDashboardProps {
  stats: JournalStats;
  trades?: TradeJournalEntry[];
  drawdownMetrics?: DrawdownMetrics;
  performanceScore?: PerformanceScore;
  dailyRiskStatus?: DailyRiskStatus;
  plan?: TradingPlan;
  openPositions?: OpenPosition[];
  insights?: SmartInsight[];
  onNavigateTab?: (tab: string) => void;
  onResetKillSwitch?: () => void;
  onUpdateStartingBalance?: (val: number) => void;
  onOpenTradeModal?: () => void;
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({
  stats,
  trades = [],
  drawdownMetrics,
  performanceScore,
  dailyRiskStatus,
  plan,
  openPositions = [],
  insights = [],
  onNavigateTab = (_tab: string) => {},
  onResetKillSwitch = () => {},
  onUpdateStartingBalance = (_val: number) => {},
  onOpenTradeModal,
}) => {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState<string>(String(stats?.startingBalance || plan?.startingCapital || 10000));
  const [isRecommendationsExpanded, setIsRecommendationsExpanded] = useState(false);

  const isPositivePnl = (stats?.totalPnl ?? 0) >= 0;
  const isPositiveToday = (stats?.todayPnl ?? 0) >= 0;
  const isNewUser = (stats?.totalTrades ?? 0) === 0;

  const handleSaveBalance = () => {
    const val = parseFloat(tempBalance);
    if (!isNaN(val) && val > 0) {
      onUpdateStartingBalance(val);
      setIsEditingBalance(false);
    }
  };

  const activeDailyRisk: DailyRiskStatus = dailyRiskStatus || {
    todayPnl: 0,
    todayGrossLoss: 0,
    dailyLossLimit: plan?.maxDailyLossAmount || 300,
    remainingLossAllowance: plan?.maxDailyLossAmount || 300,
    todayTradesCount: 0,
    consecutiveLosses: 0,
    isKillSwitchActive: false,
    killSwitchReasons: [],
    date: new Date().toISOString().split('T')[0],
    startingBalance: stats?.startingBalance || 10000,
    remainingTradesAllowance: plan?.maxTradesPerDay || 5,
  };

  const activeDrawdown: DrawdownMetrics = drawdownMetrics || {
    maxDrawdownPct: 0,
    maxDrawdown: 0,
    currentDrawdownPct: 0,
    currentDrawdown: 0,
    peakEquity: stats?.currentEquity || 10000,
    lowestEquity: stats?.currentEquity || 10000,
    recoveryAmountNeeded: 0,
    recoveryPctNeeded: 0,
    tradesInCurrentDrawdown: 0,
    largestDrawdown: {
      amount: 0,
      pct: 0,
      peakDate: '',
      troughDate: '',
      tradeCount: 0,
    },
    equityCurve: [],
  };

  // Calculate Real-time Portfolio Exposure & Aggregate Risk
  const portfolioExposure = useMemo(() => {
    return calculatePortfolioExposure(openPositions, stats.currentEquity || 10000, plan);
  }, [openPositions, stats.currentEquity, plan]);

  // Daily Risk Utilization %
  const dailyRiskLimit = Math.max(1, activeDailyRisk.dailyLossLimit || 300);
  const dailyRiskUsedAmount = Math.max(0, activeDailyRisk.todayGrossLoss || 0);
  const dailyRiskUsedPct = Math.min(100, (dailyRiskUsedAmount / dailyRiskLimit) * 100);

  // Risk Per Trade
  const riskPerTradePct = plan?.defaultRiskPerTrade ?? 1;
  const riskPerTradeAmount = ((stats?.currentEquity || 10000) * riskPerTradePct) / 100;

  // Risk Status Indicator
  const isCriticalRisk = activeDailyRisk.isKillSwitchActive || activeDailyRisk.remainingLossAllowance <= 0;
  const isElevatedRisk = !isCriticalRisk && (
    dailyRiskUsedPct >= 75 || 
    portfolioExposure.portfolioRiskTier === 'HIGH' || 
    portfolioExposure.portfolioRiskTier === 'EXTREME' ||
    activeDrawdown.currentDrawdownPct > 10 ||
    activeDailyRisk.consecutiveLosses >= 3
  );

  const riskStatusText = isCriticalRisk 
    ? 'Critical Risk' 
    : isElevatedRisk 
      ? 'Elevated Risk' 
      : 'Normal Risk';

  const riskStatusColor = isCriticalRisk
    ? 'text-red-700 bg-red-50 border-red-200'
    : isElevatedRisk
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  const riskStatusDot = isCriticalRisk ? '🔴' : isElevatedRisk ? '🟡' : '🟢';

  // Recent completed trades (latest 3-4 trades)
  const recentTrades = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    return [...trades].slice(-4).reverse();
  }, [trades]);

  // Equity Curve Data
  const equityChartData = useMemo(() => {
    if (!activeDrawdown.equityCurve || activeDrawdown.equityCurve.length === 0) {
      return [];
    }
    return activeDrawdown.equityCurve.map((point, index) => ({
      name: point.index === 0 ? 'Start' : `#${point.index}`,
      equity: point.equity,
      drawdown: point.drawdownPct,
      date: point.date,
    }));
  }, [activeDrawdown.equityCurve]);

  return (
    <div id="risk-dashboard-container" className="space-y-4 max-w-xl sm:max-w-2xl mx-auto pb-8">
      {/* 0. CRITICAL KILL SWITCH ALERT (if triggered) */}
      {activeDailyRisk.isKillSwitchActive && (
        <div id="kill-switch-banner" className="bg-red-50 border border-red-400 rounded-2xl p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-600 text-white rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-red-900 font-extrabold text-sm uppercase tracking-tight">
                  Kill Switch Active
                </h3>
                <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Trading Locked
                </span>
              </div>
              <p className="text-red-800 text-xs mt-1 leading-relaxed">
                {activeDailyRisk.killSwitchReasons?.[0] || 'Maximum daily risk reached. Protect capital and do not take additional trades today.'}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  id="reset-killswitch-btn"
                  onClick={onResetKillSwitch}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Limit
                </button>
                <button
                  type="button"
                  id="view-trading-plan-btn"
                  onClick={() => onNavigateTab('plan')}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer min-h-[40px]"
                >
                  Edit Risk Rules
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACCOUNT SUMMARY (Compact Primary Card) */}
      <section 
        id="account-summary-card" 
        className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs"
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Current Equity
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="bg-slate-100 px-2.5 py-0.5 rounded-full font-semibold">
              Open: {openPositions.length}
            </span>
            <span className="bg-slate-100 px-2.5 py-0.5 rounded-full font-semibold">
              Closed: {stats.totalTrades}
            </span>
          </div>
        </div>

        {/* Primary Equity Balance */}
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          {isEditingBalance ? (
            <div className="flex items-center gap-2 w-full my-1">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">$</span>
                <input
                  type="number"
                  value={tempBalance}
                  onChange={(e) => setTempBalance(e.target.value)}
                  className="w-full bg-slate-50 border border-blue-400 rounded-xl pl-7 pr-3 py-2 text-xl font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={handleSaveBalance}
                className="px-3.5 py-2 bg-[#1565ff] text-white text-xs font-bold rounded-xl hover:bg-[#0c53dc] transition-colors cursor-pointer min-h-[44px]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingBalance(false)}
                className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-[26px] sm:text-[30px] font-extrabold font-mono text-slate-900 tracking-tight">
                {formatCurrency(stats.currentEquity || 10000)}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setTempBalance(String(stats?.startingBalance || 10000));
                  setIsEditingBalance(true);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Edit Starting Balance"
                aria-label="Edit Starting Balance"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Small Secondary Information: Starting Capital & Peak Equity */}
        <div className="text-[11px] sm:text-xs text-slate-500 font-mono flex items-center gap-2 mb-4">
          <span>Start: {formatCurrency(stats.startingBalance || 10000)}</span>
          <span className="text-slate-300">•</span>
          <span>Peak: {formatCurrency(stats.peakEquity || stats.currentEquity || 10000)}</span>
        </div>

        {/* Prominent Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {onOpenTradeModal && (
            <button
              type="button"
              id="account-summary-log-trade-btn"
              onClick={onOpenTradeModal}
              className="w-full min-h-[44px] bg-[#1565ff] hover:bg-[#0c53dc] text-white font-bold text-xs sm:text-sm py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Log Trade</span>
            </button>
          )}
          <button
            type="button"
            id="account-summary-risk-calc-btn"
            onClick={() => onNavigateTab('calculator')}
            className={`w-full min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer ${
              !onOpenTradeModal ? 'col-span-2' : ''
            }`}
          >
            <Calculator className="w-4 h-4 text-[#1565ff]" />
            <span>Risk Calculator</span>
          </button>
        </div>
      </section>

      {/* 3. PERFORMANCE METRICS (Compact 2-Column Grid) */}
      <section id="performance-metrics-grid" className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Metric 1: Today's P&L */}
        <div 
          id="metric-today-pnl"
          className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between"
        >
          <span className="text-xs font-semibold text-slate-500">Today's P&L</span>
          <div className="my-1">
            <div className={`text-lg sm:text-xl font-extrabold font-mono tracking-tight ${
              isNewUser || stats.todayPnl === 0 
                ? 'text-slate-900' 
                : isPositiveToday 
                  ? 'text-emerald-600' 
                  : 'text-red-600'
            }`}>
              {isNewUser || stats.todayPnl === 0 ? '$0.00' : `${isPositiveToday ? '+' : ''}${formatCurrency(stats.todayPnl)}`}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {activeDailyRisk.todayTradesCount} {activeDailyRisk.todayTradesCount === 1 ? 'trade' : 'trades'}
            </div>
          </div>
        </div>

        {/* Metric 2: Total P&L */}
        <div 
          id="metric-total-pnl"
          className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between"
        >
          <span className="text-xs font-semibold text-slate-500">Total P&L</span>
          <div className="my-1">
            <div className={`text-lg sm:text-xl font-extrabold font-mono tracking-tight ${
              isNewUser || stats.totalPnl === 0 
                ? 'text-slate-900' 
                : isPositivePnl 
                  ? 'text-emerald-600' 
                  : 'text-red-600'
            }`}>
              {isNewUser || stats.totalPnl === 0 ? '$0.00' : `${isPositivePnl ? '+' : ''}${formatCurrency(stats.totalPnl)}`}
            </div>
            <div className={`text-[11px] font-mono font-semibold ${
              isNewUser || stats.totalPnl === 0 
                ? 'text-slate-500' 
                : isPositivePnl 
                  ? 'text-emerald-600' 
                  : 'text-red-600'
            }`}>
              {isNewUser || stats.totalPnl === 0 ? '0.00%' : `${isPositivePnl ? '+' : ''}${stats.totalReturnPct.toFixed(2)}%`}
            </div>
          </div>
        </div>

        {/* Metric 3: Win Rate */}
        <div 
          id="metric-win-rate"
          className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between"
        >
          <span className="text-xs font-semibold text-slate-500">Win Rate</span>
          <div className="my-1">
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 tracking-tight">
              {isNewUser ? '—' : `${stats.winRate.toFixed(1)}%`}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {stats.totalWins}W / {stats.totalLosses}L
            </div>
          </div>
        </div>

        {/* Metric 4: Drawdown */}
        <div 
          id="metric-drawdown"
          className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between"
        >
          <span className="text-xs font-semibold text-slate-500">Drawdown</span>
          <div className="my-1">
            <div className={`text-lg sm:text-xl font-extrabold font-mono tracking-tight ${
              activeDrawdown.currentDrawdownPct > 5 ? 'text-amber-600' : 'text-slate-900'
            }`}>
              {activeDrawdown.currentDrawdownPct === 0 ? '0.00%' : `-${activeDrawdown.currentDrawdownPct.toFixed(2)}%`}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {activeDrawdown.currentDrawdownPct === 0 ? 'Peak Equity' : `-${formatCurrency(activeDrawdown.currentDrawdown)}`}
            </div>
          </div>
        </div>
      </section>

      {/* 4. RISK STATUS (Consolidated Priority Card) */}
      <section 
        id="risk-status-card"
        className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5"
      >
        {/* Header with Status Indicator */}
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Risk Status
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${riskStatusColor}`}>
            <span>{riskStatusDot}</span>
            <span>{riskStatusText}</span>
          </span>
        </div>

        {/* Daily Risk Progress Section */}
        <div>
          <div className="flex items-baseline justify-between gap-2 text-xs mb-1.5">
            <span className="text-slate-600 font-medium">Daily Risk</span>
            <div className="text-right">
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(dailyRiskUsedAmount)} / {formatCurrency(dailyRiskLimit)}
              </span>
              <span className="ml-2 text-slate-500 font-semibold">
                {dailyRiskUsedPct.toFixed(0)}% Used
              </span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                isCriticalRisk 
                  ? 'bg-red-500' 
                  : isElevatedRisk 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, dailyRiskUsedPct))}%` }}
            />
          </div>
        </div>

        {/* Consolidated Risk Metrics (Risk Per Trade, Remaining Loss Limit, Trades Remaining) */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium">Risk Per Trade</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 mt-0.5">
              {riskPerTradePct}% / {formatCurrency(riskPerTradeAmount)}
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium">Remaining Loss Limit</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 mt-0.5">
              {formatCurrency(Math.max(0, activeDailyRisk.remainingLossAllowance))}
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium">Trades Remaining</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 mt-0.5">
              {activeDailyRisk.remainingTradesAllowance}
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium">Portfolio Risk</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 mt-0.5 truncate">
              {portfolioExposure.totalAccountRiskPct.toFixed(1)}% ({formatCurrency(portfolioExposure.totalAccountRisk)})
            </div>
          </div>
        </div>

        {/* Clear Action Button */}
        <button
          type="button"
          id="risk-status-open-calculator-btn"
          onClick={() => onNavigateTab('calculator')}
          className="w-full min-h-[44px] py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-[#1565ff] font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Open Risk Calculator</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* 5. EQUITY CURVE (Immediately after Risk Status) */}
      <section 
        id="equity-curve-card"
        className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div>
          <h3 className="text-sm font-bold text-slate-900">Equity Curve</h3>
          <p className="text-xs text-slate-500">Account performance over closed trades</p>
        </div>

        {/* Empty State when 0 trades */}
        {isNewUser || equityChartData.length <= 1 ? (
          <div className="py-6 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
              <BarChart3 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">No closed trades yet</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Your equity curve will appear after your first closed trade.
            </p>
          </div>
        ) : (
          <div className="w-full h-40 sm:h-44 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1565ff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1565ff" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `$${Math.round(val)}`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2 rounded-lg text-xs shadow-lg border border-slate-800">
                          <div className="font-bold">{data.name}</div>
                          <div className="text-blue-400 font-mono">{formatCurrency(data.equity)}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#1565ff" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#equityGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* 6. NEXT ACTION / AI RISK INTELLIGENCE (Compact Actionable Card) */}
      <section 
        id="next-action-card"
        className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600">
            NEXT STEP
          </span>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-900">
            Calculate position sizing before entry
          </h4>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Use your risk rules to determine contract quantity and required margin.
          </p>
        </div>

        <button
          type="button"
          id="next-action-calc-size-btn"
          onClick={() => onNavigateTab('calculator')}
          className="w-full min-h-[44px] py-2.5 px-4 bg-[#1565ff] hover:bg-[#0c53dc] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-98 cursor-pointer"
        >
          <span>Calculate Position Size</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Expandable Recommendations */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsRecommendationsExpanded(!isRecommendationsExpanded)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 py-1 cursor-pointer"
          >
            <span>Risk Rules & Recommendations</span>
            {isRecommendationsExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {isRecommendationsExpanded && (
            <div className="space-y-2 mt-2 pt-2 border-t border-slate-50 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <div>
                  <div className="font-semibold text-slate-800">Set Capital & Risk Rules</div>
                  <div className="text-[11px] text-slate-500">Configure max daily loss & position sizing limits</div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('plan')}
                  className="text-xs font-bold text-[#1565ff] hover:underline shrink-0 ml-2"
                >
                  Edit Plan →
                </button>
              </div>

              {insights && insights.length > 0 ? (
                insights.slice(0, 2).map((insight, idx) => (
                  <div key={idx} className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100/70">
                    <div className="font-semibold text-slate-800 text-[11px]">{insight.title}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{insight.description}</div>
                  </div>
                ))
              ) : (
                <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600">
                  Always set a hard stop-loss on your exchange before executing trades.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 7. TRADE HISTORY (Compact Recent Trades) */}
      <section 
        id="recent-trades-card"
        className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Trades</h3>
            <span className="text-[11px] text-slate-500">
              {trades.length} {trades.length === 1 ? 'trade' : 'trades'} recorded
            </span>
          </div>
          {trades.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('entries')}
              className="text-xs font-bold text-[#1565ff] hover:underline cursor-pointer"
            >
              View All →
            </button>
          )}
        </div>

        {/* Empty State */}
        {recentTrades.length === 0 ? (
          <div className="py-6 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">No trades recorded yet</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Your completed trades will appear here.
            </p>
            {onOpenTradeModal && (
              <button
                type="button"
                onClick={onOpenTradeModal}
                className="mt-3 px-3 py-1.5 bg-[#1565ff] hover:bg-[#0c53dc] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer min-h-[36px] flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Trade
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade, idx) => {
              const isWin = trade.pnl > 0;
              const isLoss = trade.pnl < 0;
              return (
                <div 
                  key={trade.id || idx}
                  className="p-3 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-100 rounded-xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 font-mono truncate">
                        {trade.pair}
                      </span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-sm ${
                        trade.direction === 'LONG' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {trade.direction}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                      Entry: ${formatNumber(trade.entryPrice)} • Exit: ${formatNumber(trade.exitPrice)}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-xs font-extrabold font-mono ${
                      isWin ? 'text-emerald-600' : isLoss ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {trade.pnl > 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </div>
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-sm mt-0.5 ${
                      isWin 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : isLoss 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {isWin ? 'WIN' : isLoss ? 'LOSS' : 'BE'}
                    </span>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => onNavigateTab('entries')}
              className="w-full min-h-[44px] py-2 text-center text-xs font-bold text-[#1565ff] hover:text-[#0c53dc] flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <span>View All Trades</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
