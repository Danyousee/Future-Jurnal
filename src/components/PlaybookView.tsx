import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Award, 
  Flame, 
  Layers, 
  Sparkles,
  BarChart2,
  Check
} from 'lucide-react';
import { PlaybookStrategy, StrategyPerformance, TradeJournalEntry } from '../types';
import { formatCurrency, COMMON_SETUPS } from '../utils/calculator';

interface PlaybookViewProps {
  strategyStats: StrategyPerformance[];
  trades: TradeJournalEntry[];
}

const DEFAULT_STRATEGIES: PlaybookStrategy[] = [
  {
    id: 'strat_1',
    name: 'Liquidity Sweep + MSS',
    description: 'Price sweeps key session high/low liquidity pool, followed by an aggressive Market Structure Shift (MSS) on lower timeframes (1m-5m).',
    timeframes: ['5m', '15m', '1h'],
    rules: [
      'Identify clear equal highs or PDH/PDL liquidity level',
      'Wait for sweep wick into liquidity without candle close beyond',
      'Confirm lower-timeframe MSS with displacement',
      'Enter on return to Fair Value Gap or breaker block',
      'Invalidation: Stop-loss placed beyond the sweep wick'
    ],
    idealRiskReward: '1:3.0+',
    winRate: 0,
    tradeCount: 0,
    profitFactor: 0,
  },
  {
    id: 'strat_2',
    name: 'Breakout + Retest',
    description: 'High-momentum breakout from consolidation range or multi-touch trendline, confirmed by successful retest of broken level with decreasing sell volume.',
    timeframes: ['15m', '1h', '4h'],
    rules: [
      'Range consolidation with at least 3 touches on support/resistance',
      'Aggressive breakout candle with surge in volume and open interest',
      'Wait for clean pullback and retest of previous resistance as support',
      'Bullish/bearish confirmation candle at retest level',
      'Stop-loss placed safely inside previous range boundary'
    ],
    idealRiskReward: '1:2.5',
    winRate: 0,
    tradeCount: 0,
    profitFactor: 0,
  },
  {
    id: 'strat_3',
    name: 'Fair Value Gap (FVG) Tap',
    description: 'Trading the mitigation of 3-candle imbalance (Fair Value Gap) aligned with higher timeframe market order flow.',
    timeframes: ['15m', '1h', '4h'],
    rules: [
      'Higher timeframe trend in alignment (4H or 1D directional bias)',
      'Clean 3-candle imbalance leaving an unfilled price gap',
      'Limit order placed at the Consequent Encroachment (50% midpoint of FVG)',
      'Stop-loss strictly beyond the candle 1 extreme',
      'Target: Opposing resting liquidity pool'
    ],
    idealRiskReward: '1:2.5+',
    winRate: 0,
    tradeCount: 0,
    profitFactor: 0,
  },
  {
    id: 'strat_4',
    name: 'Range Bound (Sweep Range High to Low)',
    description: 'Fading deviations above range highs or below range lows back into equilibrium (EQ) and opposing range extreme.',
    timeframes: ['15m', '1h'],
    rules: [
      'Clearly defined trading range with established Range High (RH) & Range Low (RL)',
      'False breakout / deviation above RH or below RL',
      'Re-acceptance back into value range',
      'TP 1: Range Equilibrium (0.5 Midpoint)',
      'TP 2: Opposing Range Boundary'
    ],
    idealRiskReward: '1:2.0',
    winRate: 0,
    tradeCount: 0,
    profitFactor: 0,
  },
];

export const PlaybookView: React.FC<PlaybookViewProps> = ({ strategyStats, trades }) => {
  const [strategies, setStrategies] = useState<PlaybookStrategy[]>(() => {
    try {
      const saved = localStorage.getItem('crypto_playbook_strategies');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return DEFAULT_STRATEGIES;
  });
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTf, setNewTf] = useState('15m, 1h');
  const [newRules, setNewRules] = useState('');
  const [newRR, setNewRR] = useState('1:2.5');

  const saveStrategies = (updated: PlaybookStrategy[]) => {
    setStrategies(updated);
    try {
      localStorage.setItem('crypto_playbook_strategies', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save playbook strategies:', e);
    }
  };

  // Match live journal stats to strategies
  const enrichedStrategies = strategies.map((strat) => {
    const matchedStat = strategyStats.find(
      (s) => s.strategy.toLowerCase().trim() === strat.name.toLowerCase().trim()
    );

    return {
      ...strat,
      winRate: matchedStat ? matchedStat.winRate : 0,
      tradeCount: matchedStat ? matchedStat.totalTrades : 0,
      profitFactor: matchedStat ? matchedStat.profitFactor : 0,
      pnl: matchedStat ? matchedStat.pnl : 0,
      avgR: matchedStat ? matchedStat.avgR : 0,
    };
  });

  const handleAddStrategy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newStrat: PlaybookStrategy = {
      id: `strat_${Date.now()}`,
      name: newTitle.trim(),
      description: newDesc.trim(),
      timeframes: newTf.split(',').map((t) => t.trim()),
      rules: newRules.split('\n').filter((r) => r.trim().length > 0),
      idealRiskReward: newRR,
      winRate: 0,
      tradeCount: 0,
      profitFactor: 0,
    };

    saveStrategies([...strategies, newStrat]);
    setIsAdding(false);
    setNewTitle('');
    setNewDesc('');
    setNewRules('');
  };

  const handleDeleteStrategy = (id: string) => {
    const updated = strategies.filter((s) => s.id !== id);
    saveStrategies(updated);
    setDeleteConfirmId(null);
  };

  return (
    <div id="playbook-view-container" className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#1565ff]" />
            <h2 className="text-xl font-bold text-slate-900 tracking-wide uppercase">
              Crypto Strategy Playbook Library
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standardized execution playbooks. The journal automatically correlates every setup to your real live win rate and profit factor.
          </p>
        </div>

        <button
          id="add-playbook-strategy-btn"
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Custom Playbook Setup
        </button>
      </div>

      {/* CREATE STRATEGY FORM */}
      {isAdding && (
        <form onSubmit={handleAddStrategy} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg space-y-4 max-w-2xl mx-auto">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#1565ff]" />
            Define New Strategy Playbook
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Setup Name</label>
              <input
                type="text"
                placeholder="e.g. 1H Golden Pocket Retest"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Ideal R:R</label>
              <input
                type="text"
                placeholder="e.g. 1:3.0"
                value={newRR}
                onChange={(e) => setNewRR(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Timeframes (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. 5m, 15m, 1h"
              value={newTf}
              onChange={(e) => setNewTf(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Strategy Description</label>
            <textarea
              rows={2}
              placeholder="Brief summary of setup theory..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Checklist Rules (one per line)</label>
            <textarea
              rows={3}
              placeholder="Rule 1&#10;Rule 2&#10;Rule 3..."
              value={newRules}
              onChange={(e) => setNewRules(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              Save Strategy
            </button>
          </div>
        </form>
      )}

      {/* STRATEGIES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {enrichedStrategies.map((strat) => (
          <div
            key={strat.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{strat.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    {strat.timeframes.map((tf) => (
                      <span key={tf} className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-[10px] font-mono text-[#1565ff] font-semibold">
                        {tf}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-[10px] font-mono text-[#22a65e] font-bold">
                      Target R:R {strat.idealRiskReward}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(strat.id)}
                  className="text-slate-400 hover:text-[#ff3b4a] p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Delete strategy"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {strat.description}
              </p>

              {/* Checklist Rules */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Execution Checklist:
                </span>
                <ul className="space-y-1 text-xs">
                  {strat.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1565ff] shrink-0 mt-0.5" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Live Journal Performance Bar */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Logged Win Rate</span>
                <div className="text-sm font-bold text-[#22a65e] mt-0.5">
                  {strat.tradeCount > 0 ? `${strat.winRate.toFixed(1)}%` : 'No Trades'}
                </div>
                <span className="text-[10px] text-slate-400">{strat.tradeCount} trades logged</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Profit Factor</span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {strat.tradeCount > 0 ? (strat.profitFactor || 0).toFixed(2) : 'N/A'}
                </div>
                <span className="text-[10px] text-slate-400">Gross W / Gross L</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total P&L</span>
                <div className={`text-sm font-bold mt-0.5 ${(strat.pnl || 0) >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                  {(strat.pnl || 0) >= 0 ? '+' : ''}{formatCurrency(strat.pnl || 0)}
                </div>
                <span className="text-[10px] text-slate-400">Cumulative return</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SAFE DELETE STRATEGY MODAL */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-[#ff3b4a] rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Strategy Playbook?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete this playbook strategy? Historical trades linked to this strategy will remain safe in your journal.
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
                onClick={() => deleteConfirmId && handleDeleteStrategy(deleteConfirmId)}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Delete Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
