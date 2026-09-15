import React, { useState } from 'react';
import { 
  Sparkles, 
  Bot, 
  Send, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Zap, 
  Award,
  Layers,
  Coins,
  Compass,
  Flame,
  Info
} from 'lucide-react';
import { 
  TradeJournalEntry, 
  TradingPlan, 
  AiCoachReport 
} from '../types';
import { generateAlgorithmicCoachReport } from '../utils/analytics';
import { formatCurrency } from '../utils/calculator';

interface AiCoachViewProps {
  trades: TradeJournalEntry[];
  startingBalance: number;
  plan: TradingPlan;
}

export const AiCoachView: React.FC<AiCoachViewProps> = ({
  trades,
  startingBalance,
  plan,
}) => {
  const [report, setReport] = useState<AiCoachReport>(() =>
    generateAlgorithmicCoachReport(trades, startingBalance, plan)
  );
  const [customQuestion, setCustomQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleRunAiAudit = async (customPrompt?: string) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trades,
          startingBalance,
          plan,
          prompt: customPrompt || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.fallback || !data.report) {
        // Fallback to algorithmic engine
        const algoReport = generateAlgorithmicCoachReport(trades, startingBalance, plan);
        setReport(algoReport);
      } else {
        setReport(data.report);
      }
    } catch (err: any) {
      console.warn('AI Coach network/API request notice:', err);
      // Seamlessly fall back to algorithmic engine
      const algoReport = generateAlgorithmicCoachReport(trades, startingBalance, plan);
      setReport(algoReport);
      setApiError('Connected to offline algorithmic risk engine.');
    } finally {
      setIsLoading(false);
      setCustomQuestion('');
    }
  };

  return (
    <div id="ai-coach-view-container" className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* HERO HEADER */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50/50 border border-blue-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#1565ff] text-white rounded-2xl shadow-md shadow-blue-500/20">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-wide uppercase">
                  AI Crypto Trading Coach
                </h2>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  report.isAiGenerated 
                    ? 'bg-blue-100 text-[#1565ff] border border-blue-200'
                    : 'bg-emerald-100 text-[#22a65e] border border-emerald-200'
                }`}>
                  {report.isAiGenerated ? 'Gemini AI Powered' : 'Algorithmic Engine'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Personalized risk diagnostics, behavioral pattern recognition, and quantitative execution coaching trained exclusively on crypto perpetual futures data.
              </p>
            </div>
          </div>

          <button
            id="refresh-ai-audit-btn"
            onClick={() => handleRunAiAudit()}
            disabled={isLoading || trades.length === 0}
            className="px-5 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer self-end sm:self-center"
          >
            {isLoading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Analyzing Journal...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Deep Audit
              </>
            )}
          </button>
        </div>

        {/* Ask AI Coach Prompt Input */}
        <div className="mt-5 pt-4 border-t border-blue-100">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask AI Coach a question (e.g., 'Why am I losing on ETH?', 'How can I fix my risk management?')..."
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customQuestion.trim()) {
                  e.preventDefault();
                  handleRunAiAudit(customQuestion.trim());
                }
              }}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-[#1565ff] focus:outline-none"
            />
            <button
              onClick={() => customQuestion.trim() && handleRunAiAudit(customQuestion.trim())}
              disabled={isLoading || !customQuestion.trim()}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Ask Coach
            </button>
          </div>
          {apiError && <span className="text-[11px] text-slate-500 block mt-1.5">{apiError}</span>}
        </div>
      </div>

      {/* EXECUTIVE SUMMARY */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
        <h3 className="text-xs uppercase font-bold tracking-wider text-[#1565ff] flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Executive Performance Diagnosis
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          {report.executiveSummary}
        </p>
      </div>

      {/* STRENGTHS & CRITICAL RISKS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#22a65e] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Verified Edge & Strengths
          </h4>
          <ul className="space-y-2 text-xs">
            {report.strengths.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700">
                <span className="text-[#22a65e] font-bold">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Critical Risks */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#ff3b4a] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Vulnerabilities & Risk Warnings
          </h4>
          <ul className="space-y-2 text-xs">
            {report.criticalRisks.map((r, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700">
                <span className="text-[#ff3b4a] font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* BEST VS WORST ASSET & SETUP BREAKDOWN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Best Crypto */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase font-semibold text-slate-500 block mb-1">
            Top Crypto Asset
          </span>
          <div className="text-lg font-bold text-[#22a65e]">
            {report.bestPerformingCrypto.pair}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Win Rate: <span className="font-bold text-slate-900">{report.bestPerformingCrypto.winRate.toFixed(1)}%</span>
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            P&L: +{formatCurrency(report.bestPerformingCrypto.pnl)}
          </span>
        </div>

        {/* Worst Crypto */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase font-semibold text-slate-500 block mb-1">
            Underperforming Crypto
          </span>
          <div className="text-lg font-bold text-[#ff3b4a]">
            {report.worstPerformingCrypto.pair}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Win Rate: <span className="font-bold text-slate-900">{report.worstPerformingCrypto.winRate.toFixed(1)}%</span>
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            P&L: {formatCurrency(report.worstPerformingCrypto.pnl)}
          </span>
        </div>

        {/* Best Strategy */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase font-semibold text-slate-500 block mb-1">
            Best Playbook Setup
          </span>
          <div className="text-lg font-bold text-[#22a65e] truncate">
            {report.bestStrategy.name}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Win Rate: <span className="font-bold text-slate-900">{report.bestStrategy.winRate.toFixed(1)}%</span>
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Avg R: {report.bestStrategy.avgR.toFixed(2)}R
          </span>
        </div>

        {/* Worst Strategy */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase font-semibold text-slate-500 block mb-1">
            Underperforming Setup
          </span>
          <div className="text-lg font-bold text-amber-500 truncate">
            {report.worstStrategy.name}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Win Rate: <span className="font-bold text-slate-900">{report.worstStrategy.winRate.toFixed(1)}%</span>
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Avg R: {report.worstStrategy.avgR.toFixed(2)}R
          </span>
        </div>
      </div>

      {/* BEHAVIORAL PATTERNS & TILT DETECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <h4 className="text-xs uppercase font-bold tracking-wider text-[#1565ff] flex items-center gap-2">
          <Compass className="w-4 h-4" />
          Behavioral Patterns & Execution Diagnostics
        </h4>

        <div className="space-y-3">
          {report.keyBehavioralPatterns.map((pat, idx) => (
            <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">{pat.title}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  pat.impact === 'positive' ? 'text-[#22a65e] bg-emerald-50' :
                  pat.impact === 'negative' ? 'text-[#ff3b4a] bg-red-50' : 'text-slate-600 bg-slate-200'
                }`}>
                  {pat.impact} impact
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{pat.observation}</p>
              <p className="text-[11px] text-amber-700 font-medium pt-1">
                Recommendation: {pat.recommendation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ACTION PLAN */}
      <div className="bg-gradient-to-r from-blue-50 to-white border border-blue-200 rounded-2xl p-6 shadow-xs space-y-3">
        <h4 className="text-xs uppercase font-bold tracking-wider text-[#1565ff] flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Recommended 3-Step Action Plan
        </h4>
        <div className="space-y-2">
          {report.actionPlan.map((action, idx) => (
            <div key={idx} className="flex items-start gap-3 text-xs text-slate-800">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-[#1565ff] font-bold flex items-center justify-center shrink-0 text-[11px]">
                {idx + 1}
              </div>
              <span className="pt-0.5 leading-relaxed font-medium">{action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DISCLAIMER */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Disclaimer: The AI Trading Coach generates quantitative risk assessments and behavioral audits based on your logged crypto perpetual futures data. It does not provide financial advice, price predictions, or guaranteed outcomes. Always maintain disciplined personal risk management.
        </p>
      </div>
    </div>
  );
};
