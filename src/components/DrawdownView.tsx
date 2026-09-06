import React from 'react';
import { 
  TrendingDown, 
  Activity, 
  ShieldAlert, 
  RotateCcw, 
  ArrowUpRight, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Zap,
  Clock,
  Compass
} from 'lucide-react';
import { DrawdownMetrics, JournalStats } from '../types';
import { formatCurrency, formatNumber } from '../utils/calculator';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

interface DrawdownViewProps {
  drawdownMetrics: DrawdownMetrics;
  stats: JournalStats;
}

export const DrawdownView: React.FC<DrawdownViewProps> = ({
  drawdownMetrics,
  stats,
}) => {
  // Transform underwater data (negative values for underwater chart)
  const underwaterData = drawdownMetrics.equityCurve.map((pt) => ({
    ...pt,
    underwaterPct: pt.drawdownPct > 0 ? -pt.drawdownPct : 0,
    underwaterAmount: pt.drawdown > 0 ? -pt.drawdown : 0,
  }));

  return (
    <div id="drawdown-view-container" className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER CARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-[#1565ff]" />
            <h2 className="text-xl font-bold text-slate-900 tracking-wide uppercase">
              Advanced Drawdown & Equity Preservation
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quantitative analysis of peak-to-trough capital contractions, recovery requirements, and underwater duration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-500">Peak Equity:</span>{' '}
            <span className="font-bold text-slate-900 ml-1">{formatCurrency(drawdownMetrics.peakEquity)}</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-500">Current Equity:</span>{' '}
            <span className="font-bold text-[#22a65e] ml-1">{formatCurrency(stats.currentEquity)}</span>
          </div>
        </div>
      </div>

      {/* CORE DRAWDOWN TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Current Drawdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
            Current Drawdown
          </span>
          <div className={`text-2xl font-black ${drawdownMetrics.currentDrawdownPct > 10 ? 'text-[#ff3b4a]' : 'text-amber-500'}`}>
            -{drawdownMetrics.currentDrawdownPct.toFixed(2)}%
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Amount: <span className="font-semibold text-slate-900">-{formatCurrency(drawdownMetrics.currentDrawdown)}</span>
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">
            {drawdownMetrics.tradesInCurrentDrawdown} trades in current contraction
          </span>
        </div>

        {/* 2. Maximum Historical Drawdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
            Maximum Drawdown (ATH to Trough)
          </span>
          <div className="text-2xl font-black text-[#1565ff]">
            -{drawdownMetrics.maxDrawdownPct.toFixed(2)}%
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Max Drop: <span className="font-semibold text-slate-900">-{formatCurrency(drawdownMetrics.maxDrawdown)}</span>
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">
            Lowest Point: {formatCurrency(drawdownMetrics.lowestEquity)}
          </span>
        </div>

        {/* 3. Recovery Capital Needed */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
            Recovery Capital Needed
          </span>
          <div className="text-2xl font-black text-[#22a65e]">
            +{formatCurrency(drawdownMetrics.recoveryAmountNeeded)}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Gain Required: <span className="font-bold text-[#22a65e]">+{drawdownMetrics.recoveryPctNeeded.toFixed(2)}%</span>
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">
            To surpass prior All-Time High
          </span>
        </div>

        {/* 4. Largest Drawdown Duration */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
            Deepest Drawdown Episode
          </span>
          <div className="text-lg font-bold text-slate-900">
            {drawdownMetrics.largestDrawdown.tradeCount > 0
              ? `${drawdownMetrics.largestDrawdown.tradeCount} Trades`
              : 'None'}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Peak: <span className="text-slate-500">{drawdownMetrics.largestDrawdown.peakDate || 'N/A'}</span>
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">
            Trough: {drawdownMetrics.largestDrawdown.troughDate || 'N/A'}
          </span>
        </div>
      </div>

      {/* UNDERWATER DRAWDOWN CHART */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#ff3b4a] flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Underwater Drawdown Chart (% Below Peak)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks portfolio dips below previous all-time highs. Flat at 0% indicates new account equity peaks.
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={underwaterData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="underwaterGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff3b4a" stopOpacity={0.05} />
                  <stop offset="95%" stopColor="#ff3b4a" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                stroke="#94a3b8" 
                fontSize={11} 
                tickLine={false} 
                tickFormatter={(val, i) => (i === 0 ? 'Start' : val.slice(5))}
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={11} 
                tickLine={false} 
                tickFormatter={(val) => `${val}%`}
              />
              <ReferenceLine y={0} stroke="#22a65e" strokeDasharray="3 3" />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xl text-xs space-y-1">
                        <div className="font-bold text-slate-900">{data.date} {data.pair ? `(${data.pair})` : ''}</div>
                        <div className="text-[#ff3b4a] font-semibold">Drawdown: -{data.drawdownPct.toFixed(2)}%</div>
                        <div className="text-slate-600">Contraction: -{formatCurrency(data.drawdown)}</div>
                        <div className="text-slate-500">Equity: {formatCurrency(data.equity)}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="underwaterPct" 
                stroke="#ff3b4a" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#underwaterGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DRAWDOWN RECOVERY MATHEMATICS & PLAYBOOK */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Compass className="w-4 h-4 text-[#22a65e]" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Asymmetric Drawdown Recovery Math
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Due to compounding mathematics, losses require exponentially larger gains to recover:
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600">5% Loss</span>
              <span className="font-semibold text-[#22a65e]">Requires +5.3% Gain</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600">10% Loss</span>
              <span className="font-semibold text-[#22a65e]">Requires +11.1% Gain</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600">20% Loss</span>
              <span className="font-semibold text-amber-600">Requires +25.0% Gain</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600">30% Loss</span>
              <span className="font-semibold text-amber-600">Requires +42.9% Gain</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600">50% Loss</span>
              <span className="font-semibold text-[#ff3b4a]">Requires +100.0% Gain</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert className="w-4 h-4 text-[#1565ff]" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Drawdown Protocol & Action Rules
            </h3>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="font-bold text-slate-900 mb-0.5">1. Half-Size Rule in &gt;10% Drawdown</div>
              <p className="text-slate-500">When account equity drops &gt;10% from peak, automatically reduce risk per trade from 1.0% to 0.5%.</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="font-bold text-slate-900 mb-0.5">2. No Leverage Escalation</div>
              <p className="text-slate-500">Never increase leverage or position size to "make back" a loss quickly. This is the primary cause of account blow-ups.</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="font-bold text-slate-900 mb-0.5">3. Strict 1:2+ R:R Filtering</div>
              <p className="text-slate-500">Take only A+ setups with clear market structure and at least 1:2.0 projected risk:reward.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
