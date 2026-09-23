import React from 'react';
import { TradeJournalEntry, JournalStats, PairStat, SmartInsight, PdfReportOptions } from '../types';
import { formatCurrency, formatNumber } from '../utils/calculator';
import { AlertCircle } from 'lucide-react';

export interface ReportDocumentViewProps {
  options: PdfReportOptions;
  filteredTrades: TradeJournalEntry[];
  periodPnl: number;
  periodWins: number;
  periodLosses: number;
  periodWinRate: number;
  stats: JournalStats;
  pairStats: PairStat[];
  insights: SmartInsight[];
  innerRef?: React.Ref<HTMLDivElement>;
  id?: string;
  className?: string;
  isPrintView?: boolean;
}

export const ReportDocumentView: React.FC<ReportDocumentViewProps> = ({
  options,
  filteredTrades,
  periodPnl,
  periodWins,
  periodLosses,
  periodWinRate,
  stats,
  pairStats,
  insights,
  innerRef,
  id = 'executive-report-printable',
  className = '',
}) => {
  const isDark = options.theme === 'dark';
  const hasAnySection = 
    options.sections.executiveSummary ||
    options.sections.performanceOverview ||
    options.sections.pairPerformance ||
    options.sections.tradeHistory ||
    options.sections.smartInsights;

  return (
    <div
      id={id}
      ref={innerRef}
      className={`p-6 sm:p-10 rounded-xl shadow-md transition-all print:p-0 print:m-0 print:border-none print:shadow-none print:bg-white print:text-slate-900 ${
        isDark
          ? 'bg-[#0B0E11] text-[#EAECEF] border border-[#2B2F36]'
          : 'bg-white text-slate-900 border border-slate-200'
      } ${className}`}
      style={{ minHeight: '800px' }}
    >
      {/* COVER HEADER WITH ACCENT */}
      <div className={`border-b pb-6 mb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1565ff] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                PERPETUAL FUTURES TRADING AUDIT
              </h1>
            </div>
            <p className={`text-xs font-medium mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Risk Assessment & Portfolio Performance Dossier
            </p>
          </div>

          <div className="sm:text-right text-xs font-mono">
            <div className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Trader: {options.traderName || 'Anonymous'}
            </div>
            <div className={`mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Period: {options.period} ({new Date().toISOString().split('T')[0]})
            </div>
            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Format: {options.paperSize.toUpperCase()} {options.orientation || 'Portrait'}
            </div>
          </div>
        </div>
      </div>

      {!hasAnySection && (
        <div className={`my-12 p-8 text-center rounded-xl border border-dashed ${
          isDark ? 'border-slate-800 bg-slate-900/50 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-500'
        }`}>
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[#1565ff]" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Report Sections Selected</h4>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            Please enable one or more report sections using the toggles to view and print your performance audit.
          </p>
        </div>
      )}

      {/* 1. EXECUTIVE SUMMARY */}
      {options.sections.executiveSummary && (
        <div className="mb-6 space-y-3">
          <h3 className={`text-xs font-bold uppercase tracking-wider text-[#1565ff] border-b pb-1 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            1. Executive Performance Summary
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-3 rounded-lg border ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-[10px] font-semibold block uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Net P&L</span>
              <span className={`text-lg font-bold font-mono ${periodPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                {periodPnl >= 0 ? '+' : ''}{formatCurrency(periodPnl)}
              </span>
            </div>

            <div className={`p-3 rounded-lg border ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-[10px] font-semibold block uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Win Rate</span>
              <span className={`text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {periodWinRate.toFixed(1)}%
              </span>
              <span className={`text-[9px] block font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {periodWins}W / {periodLosses}L
              </span>
            </div>

            <div className={`p-3 rounded-lg border ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-[10px] font-semibold block uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Profit Factor</span>
              <span className="text-lg font-bold font-mono text-amber-500">
                {stats.profitFactor.toFixed(2)}
              </span>
            </div>

            <div className={`p-3 rounded-lg border ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-[10px] font-semibold block uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Trades</span>
              <span className={`text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {filteredTrades.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. PERFORMANCE METRICS OVERVIEW */}
      {options.sections.performanceOverview && (
        <div className="mb-6 space-y-3">
          <h3 className={`text-xs font-bold uppercase tracking-wider text-[#1565ff] border-b pb-1 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            2. Detailed Metrics & Ratios
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="border-l-2 border-[#22a65e] pl-2">
              <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Average Win</span>
              <strong className="text-[#22a65e]">+{formatCurrency(stats.avgWin)}</strong>
            </div>
            <div className="border-l-2 border-[#ff3b4a] pl-2">
              <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Average Loss</span>
              <strong className="text-[#ff3b4a]">-{formatCurrency(stats.avgLoss)}</strong>
            </div>
            <div className="border-l-2 border-[#1565ff] pl-2">
              <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Max Win Streak</span>
              <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{stats.winStreak} Trades</strong>
            </div>
            <div className="border-l-2 border-[#1565ff] pl-2">
              <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Avg Risk:Reward</span>
              <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>1 : {stats.avgRiskReward.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 3. PAIR PERFORMANCE TABLE */}
      {options.sections.pairPerformance && pairStats.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className={`text-xs font-bold uppercase tracking-wider text-[#1565ff] border-b pb-1 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            3. Instrument Breakdown
          </h3>

          <div className="overflow-x-auto">
            <table className={`w-full text-left text-[11px] font-mono border rounded-lg overflow-hidden ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <thead className={`border-b ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <tr>
                  <th className="p-2 font-semibold">Asset</th>
                  <th className="p-2 font-semibold text-center">Trades</th>
                  <th className="p-2 font-semibold text-center">Win Rate</th>
                  <th className="p-2 font-semibold text-right">Net P&L</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {pairStats.slice(0, 6).map((p) => (
                  <tr key={p.pair} className={isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50/50'}>
                    <td className="p-2 font-bold">{p.pair}</td>
                    <td className="p-2 text-center">{p.trades}</td>
                    <td className="p-2 text-center">{p.winRate.toFixed(0)}%</td>
                    <td className={`p-2 text-right font-bold ${p.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                      {p.totalPnl >= 0 ? '+' : ''}{formatCurrency(p.totalPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. COMPLETE TRADE HISTORY TABLE */}
      {options.sections.tradeHistory && filteredTrades.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className={`text-xs font-bold uppercase tracking-wider text-[#1565ff] border-b pb-1 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            4. Execution Log History
          </h3>

          <div className="overflow-x-auto">
            <table className={`w-full text-left text-[10px] font-mono border rounded-lg overflow-hidden ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <thead className={`border-b ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <tr>
                  <th className="p-1.5 font-semibold">Date</th>
                  <th className="p-1.5 font-semibold">Pair</th>
                  <th className="p-1.5 font-semibold">Dir</th>
                  <th className="p-1.5 font-semibold">Entry</th>
                  <th className="p-1.5 font-semibold">Exit</th>
                  <th className="p-1.5 font-semibold text-right">Size</th>
                  <th className="p-1.5 font-semibold text-right">P&L ($)</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {filteredTrades.slice(0, 15).map((t, idx) => (
                  <tr key={idx} className={isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50/50'}>
                    <td className="p-1.5">{t.date}</td>
                    <td className="p-1.5 font-bold">{t.pair}</td>
                    <td className={`p-1.5 font-bold ${t.direction === 'LONG' ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                      {t.direction} {t.leverage}x
                    </td>
                    <td className="p-1.5">${formatNumber(t.entryPrice)}</td>
                    <td className="p-1.5">${formatNumber(t.exitPrice)}</td>
                    <td className="p-1.5 text-right">{formatCurrency(t.positionSize)}</td>
                    <td className={`p-1.5 text-right font-bold ${t.pnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                      {t.pnl >= 0 ? '+' : ''}{formatCurrency(t.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTrades.length > 15 && (
            <p className={`text-[9px] italic text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Showing top 15 of {filteredTrades.length} trades in summary view
            </p>
          )}
        </div>
      )}

      {/* 5. SMART INSIGHTS AUDIT */}
      {options.sections.smartInsights && insights.length > 0 && (
        <div className="space-y-2">
          <h3 className={`text-xs font-bold uppercase tracking-wider text-[#1565ff] border-b pb-1 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            5. Automated Discipline Audit & Insights
          </h3>

          <div className="space-y-2 text-xs">
            {insights.slice(0, 3).map((ins) => (
              <div
                key={ins.id}
                className={`p-2.5 rounded-lg border ${
                  isDark ? 'bg-slate-900/70 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>{ins.title}</span>
                  {ins.priority && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold bg-[#1565ff]/10 text-[#1565ff]">
                      {ins.priority}
                    </span>
                  )}
                </div>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{ins.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER & PAGE NUMBERING */}
      <div className={`mt-8 pt-4 border-t flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono gap-2 ${
        isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'
      }`}>
        <span>RiskCalc PRO • Automated Perpetual Risk & Journal</span>
        <span>Generated on {new Date().toUTCString()}</span>
      </div>
    </div>
  );
};
