import React from 'react';
import { 
  AlertOctagon, 
  Flame, 
  TrendingDown, 
  TrendingUp, 
  ShieldAlert, 
  DollarSign, 
  Percent, 
  Activity, 
  BarChart3,
  Award,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { TradeJournalEntry, STANDARD_MISTAKES, MistakeStat } from '../types';
import { calculateMistakeStats, formatCurrency, formatNumber } from '../utils/calculator';

interface MistakeAnalyticsViewProps {
  trades: TradeJournalEntry[];
}

export const MistakeAnalyticsView: React.FC<MistakeAnalyticsViewProps> = ({ trades }) => {
  const { mistakeStats, mostFrequent, mostExpensive, totalMistakesLogged } = calculateMistakeStats(trades);

  const cleanTradesCount = trades.filter((t) => (!t.mistakes || t.mistakes.length === 0) && (!t.mistakesMade || t.mistakesMade.trim() === '')).length;
  const mistakeTradesCount = trades.length - cleanTradesCount;
  const disciplineRate = trades.length > 0 ? (cleanTradesCount / trades.length) * 100 : 100;

  return (
    <div id="mistake-analytics-dashboard" className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Trade Mistake Analytics & Cost Engine
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Quantify the financial penalty of psychological and technical trading errors across your crypto perpetual journal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Discipline Score</span>
            <span className={`text-xl font-black ${
              disciplineRate >= 80 ? 'text-[#22a65e]' : disciplineRate >= 60 ? 'text-amber-600' : 'text-[#ff3b4a]'
            }`}>
              {disciplineRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Mistakes</span>
            <span className="text-xl font-black text-slate-900">
              {totalMistakesLogged}
            </span>
          </div>
        </div>
      </div>

      {/* HIGHLIGHT HERO CARDS: MOST FREQUENT & MOST EXPENSIVE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Frequent */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> Most Frequent Mistake
            </span>
            <span className="text-xs font-bold text-slate-500">
              {mostFrequent ? `${mostFrequent.count} trade${mostFrequent.count !== 1 ? 's' : ''}` : 'None logged'}
            </span>
          </div>

          {mostFrequent ? (
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900">
                {mostFrequent.mistake}
              </h2>
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-medium block">Total Impact</span>
                  <span className={`font-black ${mostFrequent.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {mostFrequent.totalPnl >= 0 ? '+' : ''}{formatCurrency(mostFrequent.totalPnl)}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-medium block">Avg Outcome</span>
                  <span className="font-bold text-slate-800">
                    {mostFrequent.avgR >= 0 ? '+' : ''}{mostFrequent.avgR.toFixed(2)}R
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-medium block">Win Rate</span>
                  <span className="font-bold text-slate-800">
                    {mostFrequent.winRate.toFixed(0)}% ({mostFrequent.wins}W / {mostFrequent.losses}L)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-2">
              No mistakes recorded in your journal yet. Tag mistakes during trade reviews to see frequency trends.
            </p>
          )}
        </div>

        {/* Most Expensive */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> Most Expensive Mistake
            </span>
            <span className="text-xs font-bold text-slate-500">
              {mostExpensive ? `${mostExpensive.count} occurrence${mostExpensive.count !== 1 ? 's' : ''}` : 'None logged'}
            </span>
          </div>

          {mostExpensive ? (
            <div className="space-y-2">
              <h2 className="text-xl font-black text-rose-950">
                {mostExpensive.mistake}
              </h2>
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="bg-rose-50/60 p-2 rounded-xl border border-rose-200">
                  <span className="text-[10px] text-rose-700 font-medium block">Total P&L Drain</span>
                  <span className="font-black text-rose-700">
                    {formatCurrency(mostExpensive.totalPnl)}
                  </span>
                </div>
                <div className="bg-rose-50/60 p-2 rounded-xl border border-rose-200">
                  <span className="text-[10px] text-rose-700 font-medium block">Avg P&L Drain</span>
                  <span className="font-bold text-rose-800">
                    {formatCurrency(mostExpensive.avgPnl)}
                  </span>
                </div>
                <div className="bg-rose-50/60 p-2 rounded-xl border border-rose-200">
                  <span className="text-[10px] text-rose-700 font-medium block">Single Worst Loss</span>
                  <span className="font-bold text-rose-800">
                    -{formatCurrency(mostExpensive.largestLoss)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-2">
              No negative mistake impact logged yet. Keep executing disciplined risk parameters.
            </p>
          )}
        </div>
      </div>

      {/* MISTAKE BREAKDOWN TABLE & FREQUENCY */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#1565ff]" />
            <h2 className="text-base font-bold text-slate-900">
              Categorized Mistake Cost & Frequency Breakdown
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {mistakeStats.length} Unique Mistake Type{mistakeStats.length !== 1 ? 's' : ''}
          </span>
        </div>

        {mistakeStats.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">Pristine Execution Record</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No mistakes have been logged across your {trades.length} trade journal entries.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Mistake Category</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Total P&L Impact</th>
                  <th className="py-3 px-4">Avg P&L / Trade</th>
                  <th className="py-3 px-4">Avg R-Multiple</th>
                  <th className="py-3 px-4">Win Rate</th>
                  <th className="py-3 px-4 text-right">Max Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mistakeStats.map((item) => (
                  <tr key={item.mistake} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 text-xs block">
                        {item.mistake}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          {item.count}
                        </span>
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            style={{
                              width: `${Math.min(100, (item.count / (mostFrequent?.count || 1)) * 100)}%`,
                            }}
                            className="bg-[#1565ff] h-full"
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`font-black font-mono ${
                          item.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
                        }`}
                      >
                        {item.totalPnl >= 0 ? '+' : ''}{formatCurrency(item.totalPnl)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`font-semibold font-mono ${
                          item.avgPnl >= 0 ? 'text-[#22a65e]' : 'text-slate-800'
                        }`}
                      >
                        {item.avgPnl >= 0 ? '+' : ''}{formatCurrency(item.avgPnl)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`font-bold font-mono ${
                          item.avgR >= 0 ? 'text-[#22a65e]' : 'text-rose-600'
                        }`}
                      >
                        {item.avgR >= 0 ? '+' : ''}{item.avgR.toFixed(2)}R
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-700">
                        {item.winRate.toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {item.wins}W / {item.losses}L
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="font-bold text-rose-700 font-mono">
                        {item.largestLoss > 0 ? `-${formatCurrency(item.largestLoss)}` : '$0.00'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI & RULE-BASED BEHAVIORAL OBSERVATIONS */}
      <div className="bg-blue-50/60 rounded-2xl border border-blue-200 p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1565ff]">
          <Sparkles className="w-4 h-4" />
          <span>Data-Driven Discipline Observations</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 leading-relaxed">
          <div className="bg-white p-3.5 rounded-xl border border-blue-100 space-y-1">
            <span className="font-bold text-slate-900 block">Stop-Loss Discipline:</span>
            <p>
              Moving or removing a stop loss is typically the single highest-variance error in crypto futures trading. Eliminating this one mistake preserves trading capital through market cascades.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-blue-100 space-y-1">
            <span className="font-bold text-slate-900 block">Revenge & FOMO Trading:</span>
            <p>
              Revenge trades typically have an R-multiple penalty of -1.5R or worse compared to structured setups. Pre-trade gate validation enforces mandatory cooldowns when consecutive losses occur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
