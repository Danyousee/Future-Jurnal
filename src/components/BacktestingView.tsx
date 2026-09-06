import React, { useState, useEffect } from 'react';
import { 
  History, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  RotateCcw, 
  Layers, 
  BarChart3, 
  Check, 
  DollarSign, 
  ShieldAlert, 
  Activity,
  ArrowRight,
  FolderPlus,
  Play,
  AlertTriangle
} from 'lucide-react';
import { BacktestSession, BacktestTrade, BacktestStats } from '../types';
import { db } from '../db/journalDb';
import { formatCurrency, formatNumber, COMMON_CRYPTO_PAIRS, COMMON_SETUPS } from '../utils/calculator';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const BacktestingView: React.FC = () => {
  const [sessions, setSessions] = useState<BacktestSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionStrategy, setNewSessionStrategy] = useState('Liquidity Sweep');
  const [newSessionPair, setNewSessionPair] = useState('BTCUSDT');
  const [newSessionBalance, setNewSessionBalance] = useState('10000');

  // Trade form state
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0]);
  const [tradeDirection, setTradeDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [riskPct, setRiskPct] = useState('1.0');
  const [leverage, setLeverage] = useState('10');
  const [tradeNotes, setTradeNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion Modals
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const [tradeToDeleteId, setTradeToDeleteId] = useState<number | null>(null);

  // Load backtest sessions from IndexedDB on mount
  useEffect(() => {
    async function loadSessions() {
      try {
        const allSessions = await db.backtestSessions.toArray();
        setSessions(allSessions);
        if (allSessions.length > 0 && !activeSessionId) {
          setActiveSessionId(allSessions[0].id);
        }
      } catch (err) {
        console.warn('Error loading backtest sessions:', err);
      }
    }
    loadSessions();
  }, []);

  // Load trades for active session
  useEffect(() => {
    async function loadSessionTrades() {
      if (!activeSessionId) {
        setTrades([]);
        return;
      }
      try {
        const sessionTrades = await db.backtestTrades
          .where('sessionId')
          .equals(activeSessionId)
          .toArray();
        setTrades(sessionTrades);
      } catch (err) {
        console.warn('Error loading backtest trades:', err);
      }
    }
    loadSessionTrades();
  }, [activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // Create new session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `bts_${Date.now()}`;
    const startingBalance = parseFloat(newSessionBalance) || 10000;

    const sessionObj: BacktestSession = {
      id,
      name: newSessionName || `${newSessionPair} ${newSessionStrategy}`,
      strategy: newSessionStrategy,
      cryptoPair: newSessionPair,
      initialBalance: startingBalance,
      currentBalance: startingBalance,
      createdAt: new Date().toISOString(),
      trades: [],
    };

    await db.backtestSessions.add(sessionObj);
    setSessions((prev) => [...prev, sessionObj]);
    setActiveSessionId(id);
    setIsCreatingSession(false);
    setNewSessionName('');
  };

  // Delete session
  const handleDeleteSession = async (idToDelete: string) => {
    setSessionToDeleteId(null);
    await db.backtestSessions.delete(idToDelete);
    await db.backtestTrades.where('sessionId').equals(idToDelete).delete();

    const updated = sessions.filter((s) => s.id !== idToDelete);
    setSessions(updated);
    setActiveSessionId(updated[0]?.id || null);
  };

  // Add backtest trade
  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const numEntry = parseFloat(entryPrice) || 0;
    const numSL = parseFloat(stopLoss) || 0;
    const numTP = parseFloat(takeProfit) || 0;
    const numExit = parseFloat(exitPrice) || 0;
    const numRiskPct = parseFloat(riskPct) || 1.0;
    const numLev = parseInt(leverage) || 10;

    if (numEntry <= 0 || numSL <= 0 || numExit <= 0) {
      setFormError('Please enter valid Entry Price, Stop Loss, and Exit Price.');
      return;
    }
    setFormError(null);

    const currentBal = activeSession.currentBalance || activeSession.initialBalance;
    const riskAmount = (currentBal * numRiskPct) / 100;
    const slDist = Math.abs(numEntry - numSL);
    const slPct = (slDist / numEntry) * 100;
    const posSize = slPct > 0 ? riskAmount / (slPct / 100) : 0;
    const quantity = numEntry > 0 ? posSize / numEntry : 0;

    let pnl = 0;
    if (tradeDirection === 'LONG') {
      pnl = quantity * (numExit - numEntry);
    } else {
      pnl = quantity * (numEntry - numExit);
    }

    const feeCost = posSize * 0.00055 * 2; // approximate standard taker fees
    const netPnl = pnl - feeCost;
    const rMultiple = riskAmount > 0 ? netPnl / riskAmount : 0;
    const pnlPercentage = currentBal > 0 ? (netPnl / currentBal) * 100 : 0;
    const isWin = netPnl > 0.001;

    const newTrade: BacktestTrade = {
      sessionId: activeSession.id,
      date: tradeDate,
      pair: activeSession.cryptoPair,
      direction: tradeDirection,
      entryPrice: numEntry,
      stopLoss: numSL,
      takeProfit: numTP,
      exitPrice: numExit,
      positionSize: posSize,
      leverage: numLev,
      riskPercentage: numRiskPct,
      riskAmount,
      pnl: netPnl,
      pnlPercentage,
      rMultiple,
      isWin,
      fees: feeCost,
      notes: tradeNotes,
    };

    const id = await db.backtestTrades.add(newTrade);
    newTrade.id = id as number;

    const updatedTrades = [...trades, newTrade];
    setTrades(updatedTrades);

    // Update session current balance
    const updatedBalance = currentBal + netPnl;
    await db.backtestSessions.update(activeSession.id, { currentBalance: updatedBalance });
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? { ...s, currentBalance: updatedBalance } : s))
    );

    // Reset inputs
    setEntryPrice('');
    setStopLoss('');
    setTakeProfit('');
    setExitPrice('');
    setTradeNotes('');
    setFormError(null);
  };

  // Delete individual backtest trade
  const handleDeleteTrade = async (tradeId?: number) => {
    if (!tradeId || !activeSession) return;
    setTradeToDeleteId(null);
    const tradeToRemove = trades.find((t) => t.id === tradeId);
    await db.backtestTrades.delete(tradeId);

    const updatedTrades = trades.filter((t) => t.id !== tradeId);
    setTrades(updatedTrades);

    if (tradeToRemove) {
      const updatedBalance = activeSession.currentBalance - tradeToRemove.pnl;
      await db.backtestSessions.update(activeSession.id, { currentBalance: updatedBalance });
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, currentBalance: updatedBalance } : s))
      );
    }
  };

  // Calculate Backtest Statistics
  const calculateBacktestStats = (): { stats: BacktestStats; equityCurve: any[] } => {
    const initBal = activeSession?.initialBalance || 10000;
    if (trades.length === 0) {
      return {
        stats: {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          profitFactor: 0,
          expectancy: 0,
          averageR: 0,
          maxDrawdown: 0,
          maxDrawdownPct: 0,
          totalReturn: 0,
          totalReturnPct: 0,
          winningStreak: 0,
          losingStreak: 0,
          avgWin: 0,
          avgLoss: 0,
        },
        equityCurve: [{ index: 0, date: 'Start', equity: initBal, pnl: 0 }],
      };
    }

    let wins = 0;
    let losses = 0;
    let grossWin = 0;
    let grossLoss = 0;
    let totalPnl = 0;
    let totalR = 0;
    let curBal = initBal;
    let peakBal = initBal;
    let maxDd = 0;
    let maxDdPct = 0;

    let curWinStreak = 0;
    let curLoseStreak = 0;
    let maxWinStreak = 0;
    let maxLoseStreak = 0;

    const equityCurve = [{ index: 0, date: 'Start', equity: initBal, pnl: 0 }];

    trades.forEach((t, i) => {
      totalPnl += t.pnl;
      curBal += t.pnl;
      totalR += t.rMultiple;

      if (curBal > peakBal) {
        peakBal = curBal;
      } else {
        const dd = peakBal - curBal;
        const ddPct = peakBal > 0 ? (dd / peakBal) * 100 : 0;
        if (dd > maxDd) maxDd = dd;
        if (ddPct > maxDdPct) maxDdPct = ddPct;
      }

      if (t.pnl > 0.001) {
        wins++;
        grossWin += t.pnl;
        curWinStreak++;
        curLoseStreak = 0;
        if (curWinStreak > maxWinStreak) maxWinStreak = curWinStreak;
      } else if (t.pnl < -0.001) {
        losses++;
        grossLoss += Math.abs(t.pnl);
        curLoseStreak++;
        curWinStreak = 0;
        if (curLoseStreak > maxLoseStreak) maxLoseStreak = curLoseStreak;
      }

      equityCurve.push({
        index: i + 1,
        date: t.date,
        equity: curBal,
        pnl: t.pnl,
      });
    });

    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99.9 : 0;
    const averageR = totalTrades > 0 ? totalR / totalTrades : 0;
    const avgWin = wins > 0 ? grossWin / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const expectancy = (winRate / 100 * avgWin) - ((losses / totalTrades) * avgLoss);
    const totalReturnPct = initBal > 0 ? (totalPnl / initBal) * 100 : 0;

    return {
      stats: {
        totalTrades,
        wins,
        losses,
        winRate,
        profitFactor,
        expectancy,
        averageR,
        maxDrawdown: maxDd,
        maxDrawdownPct: maxDdPct,
        totalReturn: totalPnl,
        totalReturnPct,
        winningStreak: maxWinStreak,
        losingStreak: maxLoseStreak,
        avgWin,
        avgLoss,
      },
      equityCurve,
    };
  };

  const { stats, equityCurve } = calculateBacktestStats();

  return (
    <div id="backtesting-module-container" className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER & SESSION SELECTOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[#1565ff]" />
            <h2 className="text-xl font-bold text-slate-900 tracking-wide uppercase">
              Manual Backtesting Sandbox
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Test historical crypto perpetual strategies in a sandboxed simulator without skewing your live trading journal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="new-backtest-session-btn"
            onClick={() => setIsCreatingSession(true)}
            className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" /> New Session
          </button>
        </div>
      </div>

      {/* SESSION TABS */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 border ${
                activeSessionId === s.id
                  ? 'bg-blue-50 text-[#1565ff] border-blue-300 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              <span>{s.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                {s.cryptoPair}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSessionToDeleteId(s.id);
                }}
                className="text-slate-400 hover:text-[#ff3b4a] transition-colors cursor-pointer"
                title="Delete Session"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CREATE SESSION MODAL */}
      {isCreatingSession && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl space-y-4 max-w-lg mx-auto">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#1565ff]" />
            Create Backtest Strategy Session
          </h3>
          <form onSubmit={handleCreateSession} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Session Name</label>
              <input
                type="text"
                placeholder="e.g. BTC 15m Liquidity Sweep 2024"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Crypto Asset / Pair</label>
                <input
                  type="text"
                  list="backtest-crypto-pairs-list"
                  value={newSessionPair}
                  onChange={(e) => setNewSessionPair(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  placeholder="e.g. BTCUSDT, SOL, KAS..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] uppercase"
                />
                <datalist id="backtest-crypto-pairs-list">
                  {COMMON_CRYPTO_PAIRS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Strategy / Setup</label>
                <select
                  value={newSessionStrategy}
                  onChange={(e) => setNewSessionStrategy(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                >
                  {COMMON_SETUPS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Starting Test Balance ($)</label>
              <input
                type="number"
                value={newSessionBalance}
                onChange={(e) => setNewSessionBalance(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingSession(false)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Create Sandbox
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSession ? (
        <>
          {/* STATS OVERVIEW */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Win Rate</span>
              <div className="text-lg font-bold text-[#1565ff] mt-0.5">
                {stats.winRate.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400">{stats.wins}W / {stats.losses}L ({stats.totalTrades} Trades)</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Profit Factor</span>
              <div className={`text-lg font-bold mt-0.5 ${stats.profitFactor >= 1.5 ? 'text-[#22a65e]' : 'text-slate-900'}`}>
                {stats.profitFactor.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400">Gross W / Gross L</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Average R</span>
              <div className={`text-lg font-bold mt-0.5 ${stats.averageR >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                {stats.averageR >= 0 ? '+' : ''}{stats.averageR.toFixed(2)}R
              </div>
              <span className="text-[10px] text-slate-400">Per trade payout</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Total Return</span>
              <div className={`text-lg font-bold mt-0.5 ${stats.totalReturn >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                {stats.totalReturn >= 0 ? '+' : ''}{formatCurrency(stats.totalReturn)}
              </div>
              <span className="text-[10px] text-slate-400">+{stats.totalReturnPct.toFixed(1)}% Return</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Max Drawdown</span>
              <div className="text-lg font-bold text-[#ff3b4a] mt-0.5">
                -{stats.maxDrawdownPct.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400">-{formatCurrency(stats.maxDrawdown)}</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Expectancy</span>
              <div className={`text-lg font-bold mt-0.5 ${stats.expectancy >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                {stats.expectancy >= 0 ? '+' : ''}{formatCurrency(stats.expectancy)}
              </div>
              <span className="text-[10px] text-slate-400">EV per setup</span>
            </div>
          </div>

          {/* BACKTEST EQUITY CURVE */}
          {trades.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-xs uppercase font-bold tracking-wider text-[#1565ff] mb-3">
                Backtest Strategy Equity Growth
              </h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="backtestGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1565ff" stopOpacity="0.25" />
                        <stop offset="95%" stopColor="#1565ff" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs shadow-lg">
                              <div className="font-bold text-slate-900">Trade #{data.index} ({data.date})</div>
                              <div className="text-[#1565ff] font-semibold">Equity: {formatCurrency(data.equity)}</div>
                              {data.pnl !== 0 && (
                                <div className={data.pnl > 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}>
                                  P&L: {data.pnl > 0 ? '+' : ''}{formatCurrency(data.pnl)}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#1565ff" strokeWidth={2.5} fillOpacity={1} fill="url(#backtestGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* LOG HISTORICAL TEST TRADE FORM */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#1565ff]" />
              Log Historical Backtest Trade
            </h3>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddTrade} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Date</label>
                  <input
                    type="date"
                    value={tradeDate}
                    onChange={(e) => setTradeDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Direction</label>
                  <select
                    value={tradeDirection}
                    onChange={(e) => setTradeDirection(e.target.value as 'LONG' | 'SHORT')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1565ff]"
                  >
                    <option value="LONG">🟢 LONG</option>
                    <option value="SHORT">🔴 SHORT</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Entry Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Entry"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Stop Loss ($)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Stop Loss"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Take Profit ($)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Take Profit"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exit Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Exit Price"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Risk Per Trade (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={riskPct}
                    onChange={(e) => setRiskPct(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Leverage (x)</label>
                  <input
                    type="number"
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Notes / Context</label>
                  <input
                    type="text"
                    placeholder="e.g. 4H FVG tap with sweep"
                    value={tradeNotes}
                    onChange={(e) => setTradeNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Record Backtest Trade
                </button>
              </div>
            </form>
          </div>

          {/* BACKTEST TRADES TABLE */}
          {trades.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-xs uppercase font-bold tracking-wider text-slate-700 mb-3">
                Logged Backtest Records ({trades.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Entry</th>
                      <th className="py-2.5 px-3">Exit</th>
                      <th className="py-2.5 px-3">SL</th>
                      <th className="py-2.5 px-3">R:R</th>
                      <th className="py-2.5 px-3">P&L ($)</th>
                      <th className="py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trades.map((t, idx) => (
                      <tr key={t.id || idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-700">{t.date}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.direction === 'LONG' ? 'bg-emerald-50 text-[#22a65e]' : 'bg-red-50 text-[#ff3b4a]'
                          }`}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 font-mono">${formatNumber(t.entryPrice)}</td>
                        <td className="py-2.5 px-3 text-slate-900 font-mono">${formatNumber(t.exitPrice)}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">${formatNumber(t.stopLoss)}</td>
                        <td className="py-2.5 px-3 font-bold font-mono text-[#1565ff]">
                          {t.rMultiple >= 0 ? '+' : ''}{t.rMultiple.toFixed(2)}R
                        </td>
                        <td className={`py-2.5 px-3 font-bold font-mono ${t.pnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                          {t.pnl >= 0 ? '+' : ''}{formatCurrency(t.pnl)}
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => t.id && setTradeToDeleteId(t.id)}
                            className="text-slate-400 hover:text-[#ff3b4a] transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <History className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Backtest Sessions Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create your first crypto strategy backtesting session to log historical entries and evaluate win rates.
          </p>
          <button
            onClick={() => setIsCreatingSession(true)}
            className="px-5 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            Create First Sandbox Session
          </button>
        </div>
      )}

      {/* DELETE SESSION CONFIRMATION MODAL */}
      {sessionToDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-[#ff3b4a] rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Backtest Session?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete this session and all its associated test trade records?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDeleteId(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSession(sessionToDeleteId)}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE TRADE CONFIRMATION MODAL */}
      {tradeToDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-[#ff3b4a] rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Backtest Trade?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove this backtest trade record from this session?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTradeToDeleteId(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTrade(tradeToDeleteId)}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Delete Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
