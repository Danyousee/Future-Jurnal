import React, { useState, useEffect, useRef } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Check, 
  RotateCcw, 
  Save, 
  Sliders, 
  Zap, 
  Flame, 
  Scale, 
  Wallet, 
  Clock,
  Lock,
  Wrench,
  Sparkles
} from 'lucide-react';
import { 
  CalculatorState, 
  CalculationResult, 
  FeeTier, 
  MarginMode, 
  TradingPlan,
  TradeJournalEntry,
  OpenPosition,
  TradeApprovalRecord,
  JournalStats
} from '../types';
import { 
  calculateFuturesRisk, 
  validatePreTradeRiskGate,
  formatCurrency, 
  formatNumber, 
  FEE_PRESETS, 
  COMMON_CRYPTO_PAIRS,
  getBaseAsset
} from '../utils/calculator';
import { calculateJournalStats } from '../utils/analytics';
import { saveCalculatorSettings, loadCalculatorSettings, DEFAULT_TRADING_PLAN } from '../db/journalDb';
import { 
  TradeStatusCard, 
  PreTradeChecklistCard, 
  RiskBudgetCard 
} from './PreTradeRiskGateCard';
import { LeverageSimulator } from './LeverageSimulator';

interface RiskCalculatorProps {
  onSaveToJournal: (state: CalculatorState, result: CalculationResult, approvalRecord?: TradeApprovalRecord) => void;
  plan?: TradingPlan;
  killSwitchActive?: boolean;
  trades?: TradeJournalEntry[];
  openPositions?: OpenPosition[];
  stats?: JournalStats;
}

const DEFAULT_STATE: CalculatorState = {
  accountBalance: 10000,
  pair: 'BTCUSDT',
  direction: 'LONG',
  entryPrice: 65000,
  stopLoss: 63500,
  takeProfit: 68000,
  riskPercentage: 1.0,
  leverage: 10,
  marginMode: 'ISOLATED',
  feeTier: 'taker',
  feeRate: 0.00055,
  estimatedFundingRate: 0.0001,
  slippagePct: 0.05,
  maintenanceMarginPct: 0.5,
};

export const RiskCalculator: React.FC<RiskCalculatorProps> = ({
  onSaveToJournal,
  plan = DEFAULT_TRADING_PLAN,
  killSwitchActive = false,
  trades = [],
  openPositions = [],
  stats,
}) => {
  const initialBalance = stats?.currentEquity || plan?.startingCapital || 10000;
  const initialRisk = plan?.defaultRiskPerTrade || plan?.riskPerTradePct || 1.0;
  const initialLev = Math.min(10, plan?.maxLeverage || 10);

  const [calcState, setCalcState] = useState<CalculatorState>(() => ({
    ...DEFAULT_STATE,
    accountBalance: initialBalance,
    riskPercentage: initialRisk,
    leverage: initialLev,
  }));
  const [rawInputs, setRawInputs] = useState(() => ({
    balance: initialBalance.toString(),
    entry: '65000',
    stopLoss: '63500',
    takeProfit: '68000',
    riskPct: initialRisk.toString(),
    leverage: initialLev.toString(),
    slippage: '0.05',
    mmr: '0.5',
  }));

  const [copied, setCopied] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const [resetFeedbackText, setResetFeedbackText] = useState<string | null>(null);
  const [showAdvancedFees, setShowAdvancedFees] = useState(false);
  const [showLeverageSimulator, setShowLeverageSimulator] = useState(false);
  const [isGateOverridden, setIsGateOverridden] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Manual trader discretion override');

  // Input element refs for smooth scrolling and focusing
  const balanceInputRef = useRef<HTMLInputElement>(null);
  const entryInputRef = useRef<HTMLInputElement>(null);
  const stopLossInputRef = useRef<HTMLInputElement>(null);
  const takeProfitInputRef = useRef<HTMLInputElement>(null);
  const riskInputRef = useRef<HTMLInputElement>(null);
  const leverageInputRef = useRef<HTMLInputElement>(null);
  const simulatorRef = useRef<HTMLDivElement>(null);

  // Load saved calculator preferences
  useEffect(() => {
    loadCalculatorSettings().then((saved) => {
      if (saved) {
        setCalcState((prev) => ({
          ...prev,
          accountBalance: saved.accountBalance ?? prev.accountBalance,
          riskPercentage: saved.riskPercentage ?? prev.riskPercentage,
          leverage: saved.leverage ?? prev.leverage,
          marginMode: saved.marginMode ?? prev.marginMode,
          feeTier: saved.feeTier ?? prev.feeTier,
        }));
        setRawInputs((prev) => ({
          ...prev,
          balance: saved.accountBalance ? saved.accountBalance.toString() : prev.balance,
          riskPct: saved.riskPercentage ? saved.riskPercentage.toString() : prev.riskPct,
          leverage: saved.leverage ? saved.leverage.toString() : prev.leverage,
        }));
      }
    });
  }, []);

  // Save settings on changes
  useEffect(() => {
    saveCalculatorSettings(calcState);
  }, [calcState.accountBalance, calcState.riskPercentage, calcState.leverage, calcState.marginMode, calcState.feeTier, calcState.pair]);

  // Compute Active Stats
  const activeStats = stats || calculateJournalStats(trades, calcState.accountBalance);
  const isPositiveToday = activeStats.todayPnl >= 0;
  const isNegativeToday = activeStats.todayPnl < 0;
  const isPositiveTotal = activeStats.totalPnl >= 0;
  const isNegativeTotal = activeStats.totalPnl < 0;

  // Run Financial Calculations
  const result: CalculationResult = calculateFuturesRisk(calcState, plan);

  // Run Pre-Trade Risk Gate Validation
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter((t) => t.date && t.date.startsWith(todayStr));
  const todayCount = todayTrades.length;

  let consLosses = 0;
  const sortedTrades = [...trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const t of sortedTrades) {
    if (t.status === 'CLOSED') {
      if ((t.pnl || 0) < 0) consLosses++;
      else break;
    }
  }

  const riskGateValidation = validatePreTradeRiskGate({
    state: calcState,
    result,
    plan,
    todayTradesCount: todayCount,
    currentConsecutiveLosses: consLosses,
  });

  // Reset override if inputs change
  useEffect(() => {
    setIsGateOverridden(false);
  }, [calcState.entryPrice, calcState.stopLoss, calcState.riskPercentage, calcState.leverage, calcState.pair]);

  // Fix button behavior with smooth scrolling and focus
  const handleFixField = (field: string, suggestedValue?: string | number) => {
    if (field === 'balance') {
      if (suggestedValue) {
        const num = typeof suggestedValue === 'number' ? suggestedValue : parseFloat(suggestedValue);
        if (!isNaN(num) && num > 0) {
          setCalcState((prev) => ({ ...prev, accountBalance: num }));
          setRawInputs((prev) => ({ ...prev, balance: num.toString() }));
        }
      }
      balanceInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => balanceInputRef.current?.focus(), 150);
    } else if (field === 'riskPct') {
      const val = typeof suggestedValue === 'number' ? suggestedValue : parseFloat(suggestedValue as string) || plan.maxRiskPerTrade || 1.5;
      setCalcState((prev) => ({ ...prev, riskPercentage: val }));
      setRawInputs((prev) => ({ ...prev, riskPct: val.toString() }));
      riskInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => riskInputRef.current?.focus(), 150);
    } else if (field === 'leverage') {
      const val = typeof suggestedValue === 'number' ? suggestedValue : parseInt(suggestedValue as string) || plan.maxLeverage || 10;
      setCalcState((prev) => ({ ...prev, leverage: val }));
      setRawInputs((prev) => ({ ...prev, leverage: val.toString() }));
      leverageInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => leverageInputRef.current?.focus(), 150);
    } else if (field === 'stopLoss') {
      if (suggestedValue) {
        const num = typeof suggestedValue === 'number' ? suggestedValue : parseFloat(suggestedValue);
        if (!isNaN(num)) {
          setCalcState((prev) => ({ ...prev, stopLoss: num }));
          setRawInputs((prev) => ({ ...prev, stopLoss: num.toString() }));
        }
      }
      stopLossInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => stopLossInputRef.current?.focus(), 150);
    } else if (field === 'takeProfit') {
      if (suggestedValue) {
        const num = typeof suggestedValue === 'number' ? suggestedValue : parseFloat(suggestedValue);
        if (!isNaN(num)) {
          setCalcState((prev) => ({ ...prev, takeProfit: num }));
          setRawInputs((prev) => ({ ...prev, takeProfit: num.toString() }));
        }
      }
      takeProfitInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => takeProfitInputRef.current?.focus(), 150);
    } else if (field === 'entryPrice' || field === 'entry') {
      entryInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => entryInputRef.current?.focus(), 150);
    }
  };

  const handleSaveTradeWithGate = () => {
    const isApproved = riskGateValidation.isApproved || riskGateValidation.passed;
    let approvalStatus: 'APPROVED' | 'BLOCKED' | 'OVERRIDDEN' = 'APPROVED';
    if (!isApproved) {
      if (isGateOverridden) {
        approvalStatus = 'OVERRIDDEN';
      } else {
        approvalStatus = 'BLOCKED';
      }
    }

    const passedChecklist = riskGateValidation.checklist.filter((c) => c.passed).map((c) => c.title);
    const blockedReasons = riskGateValidation.blockedReasons.map((b) => b.reason);
    const checklistForRecord = riskGateValidation.checklist.map((c) => ({
      ruleName: c.title,
      status: (c.passed ? 'PASS' : 'FAIL') as 'PASS' | 'WARN' | 'FAIL',
      actualValue: c.detail,
    }));

    const approvalRecord: TradeApprovalRecord = {
      status: approvalStatus,
      score: riskGateValidation.score ?? Math.round((passedChecklist.length / Math.max(1, riskGateValidation.checklist.length)) * 100),
      riskPercentage: calcState.riskPercentage,
      riskAmount: result.riskAmount,
      leverage: calcState.leverage,
      riskRewardRatio: result.riskRewardRatio,
      dailyRiskRemaining: riskGateValidation.metrics?.remainingDailyRisk ?? 0,
      planComplianceStatus: isApproved,
      validationWarnings: riskGateValidation.warnings,
      passedChecklist,
      blockedReasons,
      overrideReason: isGateOverridden ? overrideReason : undefined,
      checklist: checklistForRecord,
      approvedAt: new Date().toISOString(),
    };

    onSaveToJournal(calcState, result, approvalRecord);
  };

  const handleBalanceChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, balance: val }));
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, accountBalance: isNaN(parsed) ? 0 : parsed }));
  };

  const handleEntryChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, entry: val }));
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, entryPrice: isNaN(parsed) ? 0 : parsed }));
  };

  const handleStopLossChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, stopLoss: val }));
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, stopLoss: isNaN(parsed) ? 0 : parsed }));
  };

  const handleTakeProfitChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, takeProfit: val }));
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, takeProfit: isNaN(parsed) ? 0 : parsed }));
  };

  const handleRiskPctChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, riskPct: val }));
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, riskPercentage: isNaN(parsed) ? 1.0 : parsed }));
  };

  const handleLeverageChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, leverage: val }));
    const parsed = parseInt(val);
    setCalcState((prev) => ({ ...prev, leverage: isNaN(parsed) ? 1 : parsed }));
  };

  const handleFeeTierChange = (tier: FeeTier) => {
    const rate = FEE_PRESETS[tier].rate;
    setCalcState((prev) => ({
      ...prev,
      feeTier: tier,
      feeRate: rate,
    }));
  };

  const handleReset = () => {
    const activeBalance = stats?.currentEquity || plan?.startingCapital || 10000;
    const defaultRisk = plan?.defaultRiskPerTrade || plan?.riskPerTradePct || 1.0;
    const defaultLev = Math.min(10, plan?.maxLeverage || 10);
    const defaultPair = plan?.preferredCryptos?.[0] || 'BTCUSDT';

    const nextState: CalculatorState = {
      accountBalance: activeBalance,
      pair: defaultPair,
      direction: 'LONG',
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      riskPercentage: defaultRisk,
      leverage: defaultLev,
      marginMode: 'ISOLATED',
      feeTier: 'taker',
      feeRate: FEE_PRESETS.taker.rate,
      estimatedFundingRate: 0.0001,
      slippagePct: 0.05,
      maintenanceMarginPct: 0.5,
    };

    setCalcState(nextState);
    setRawInputs({
      balance: activeBalance.toString(),
      entry: '',
      stopLoss: '',
      takeProfit: '',
      riskPct: defaultRisk.toString(),
      leverage: defaultLev.toString(),
      slippage: '0.05',
      mmr: '0.5',
    });

    setIsGateOverridden(false);
    setOverrideReason('Manual trader discretion override');
    setShowAdvancedFees(false);
    setShowLeverageSimulator(false);
    setJustReset(true);
    setResetFeedbackText(
      `Calculator reset to plan defaults ($${formatNumber(activeBalance)} equity, ${defaultRisk}% risk). Price levels cleared for fresh calculation.`
    );

    saveCalculatorSettings(nextState);

    setTimeout(() => {
      setJustReset(false);
    }, 1800);

    setTimeout(() => {
      setResetFeedbackText(null);
    }, 4500);

    // Smoothly focus the entry price input so the trader can immediately type
    setTimeout(() => {
      entryInputRef.current?.focus();
    }, 120);
  };

  const handleLoadSample = () => {
    const activeBalance = stats?.currentEquity || plan?.startingCapital || 10000;
    const defaultRisk = plan?.defaultRiskPerTrade || plan?.riskPerTradePct || 1.0;
    const defaultLev = Math.min(10, plan?.maxLeverage || 10);

    const sampleState: CalculatorState = {
      accountBalance: activeBalance,
      pair: 'BTCUSDT',
      direction: 'LONG',
      entryPrice: 65000,
      stopLoss: 63500,
      takeProfit: 68000,
      riskPercentage: defaultRisk,
      leverage: defaultLev,
      marginMode: 'ISOLATED',
      feeTier: 'taker',
      feeRate: FEE_PRESETS.taker.rate,
      estimatedFundingRate: 0.0001,
      slippagePct: 0.05,
      maintenanceMarginPct: 0.5,
    };

    setCalcState(sampleState);
    setRawInputs({
      balance: activeBalance.toString(),
      entry: '65000',
      stopLoss: '63500',
      takeProfit: '68000',
      riskPct: defaultRisk.toString(),
      leverage: defaultLev.toString(),
      slippage: '0.05',
      mmr: '0.5',
    });

    setIsGateOverridden(false);
    setResetFeedbackText('Loaded sample BTC/USDT setup (Entry: $65,000 | SL: $63,500 | TP: $68,000).');
    setTimeout(() => {
      setResetFeedbackText(null);
    }, 3500);
  };

  const handleCopySummary = () => {
    const baseAsset = getBaseAsset(calcState.pair);
    const summaryText = `CRYPTO PERPETUAL TRADE PLAN
Pair: ${calcState.pair} (${calcState.direction})
Entry: $${formatNumber(calcState.entryPrice)}
Stop Loss: $${formatNumber(calcState.stopLoss)} (${result.priceRiskPercentage.toFixed(2)}%)
Take Profit: ${calcState.takeProfit > 0 ? '$' + formatNumber(calcState.takeProfit) : 'None'}
Position Size (Notional): ${formatCurrency(result.positionSize)}
Position Quantity: ${formatNumber(result.quantity, 2, 6)} ${baseAsset}
Leverage: ${calcState.leverage}x (${calcState.marginMode})
Required Margin: ${formatCurrency(result.marginRequired)}
Risk Amount: ${formatCurrency(result.riskAmount)} (${calcState.riskPercentage}%)
Estimated Liquidation: $${formatNumber(result.liquidationPrice)} (${result.distanceToLiquidationPct.toFixed(2)}% away)
R:R Ratio: 1:${result.riskRewardRatio.toFixed(2)}
Net Profit: +${formatCurrency(result.netProfit)} | Net Loss: -${formatCurrency(result.netLoss)}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleSimulator = () => {
    const nextState = !showLeverageSimulator;
    setShowLeverageSimulator(nextState);
    if (nextState) {
      setTimeout(() => {
        simulatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const isSaveApproved = (riskGateValidation.isApproved || riskGateValidation.passed) || isGateOverridden;

  return (
    <div id="risk-calculator-view" className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12 sm:pb-16 w-full max-w-full overflow-x-hidden">
      
      {/* KILL SWITCH WARNING */}
      {killSwitchActive && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 text-red-900 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Flame className="w-5 h-5 text-red-600 shrink-0 animate-pulse" />
            <span className="text-xs font-bold truncate">
              KILL SWITCH ACTIVE: Daily risk limit reached. New trade execution is locked.
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] px-2.5 py-1 bg-red-600 text-white rounded-lg font-bold uppercase shrink-0">
            Halted
          </span>
        </div>
      )}

      {/* TWO COLUMN GRID ON DESKTOP, LINEAR STACK ON MOBILE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* 3. POSITION PARAMETERS COLUMN (5 COLS ON DESKTOP) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Calculator className="w-3.5 h-3.5 text-[#1565ff] shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 truncate">
                  Position Parameters
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id="load-sample-btn"
                  type="button"
                  onClick={handleLoadSample}
                  title="Load sample BTC/USDT trade"
                  className="px-2 py-1 min-h-[32px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] sm:text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="hidden xs:inline sm:inline">Sample</span>
                </button>

                <button
                  id="reset-calculator-btn"
                  type="button"
                  onClick={handleReset}
                  title="Clear prices and reset all fields to trading plan rules"
                  className={`px-2.5 py-1 min-h-[32px] text-[11px] sm:text-xs font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${
                    justReset
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-200'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {justReset ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Reset!</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Reset</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RESET / SAMPLE NOTIFICATION BANNER */}
            {resetFeedbackText && (
              <div 
                id="calc-feedback-banner"
                className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-start sm:items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-150"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="leading-snug">{resetFeedbackText}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setResetFeedbackText(null)}
                  className="text-emerald-700 hover:text-emerald-950 font-bold text-xs px-1 shrink-0 cursor-pointer"
                  aria-label="Dismiss message"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Account Balance Field */}
            <div>
              <label htmlFor="calc-balance-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                Account Balance ($ USDT)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 inset-y-0 flex items-center text-slate-400 font-mono text-xs sm:text-sm pointer-events-none">$</span>
                <input
                  ref={balanceInputRef}
                  id="calc-balance-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="e.g. 10000"
                  value={rawInputs.balance}
                  onChange={(e) => handleBalanceChange(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg pl-7 pr-3 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Crypto Pair & Direction */}
            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2 items-start">
              <div>
                <label htmlFor="calc-pair-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-0.5 truncate">
                  Crypto Pair
                </label>
                <input
                  id="calc-pair-input"
                  type="text"
                  list="calc-crypto-pairs"
                  value={calcState.pair}
                  onChange={(e) => setCalcState({ ...calcState, pair: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                  placeholder="e.g. BTCUSDT"
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white uppercase transition-colors"
                />
                <datalist id="calc-crypto-pairs">
                  {COMMON_CRYPTO_PAIRS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 h-9 box-border">
                  <button
                    id="calc-direction-long"
                    type="button"
                    onClick={() => setCalcState({ ...calcState, direction: 'LONG' })}
                    className={`h-full rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                      calcState.direction === 'LONG'
                        ? 'bg-[#22a65e] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>LONG</span>
                  </button>
                  <button
                    id="calc-direction-short"
                    type="button"
                    onClick={() => setCalcState({ ...calcState, direction: 'SHORT' })}
                    className={`h-full rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                      calcState.direction === 'SHORT'
                        ? 'bg-[#ff3b4a] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingDown className="w-3 h-3 shrink-0" />
                    <span>SHORT</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Asset Selector (Horizontal Scrolling Only inside selector) */}
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block leading-none">
                Quick Assets:
              </span>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar w-full">
                {['BTC', 'ETH', 'SOL', 'SUI', 'DOGE', 'XRP', 'PEPE', 'KAS'].map((sym) => {
                  const pairVal = `${sym}USDT`;
                  const isSelected = calcState.pair === pairVal || calcState.pair === sym;
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setCalcState({ ...calcState, pair: pairVal })}
                      className={`h-7 min-w-[42px] px-2 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center active:scale-95 ${
                        isSelected
                          ? 'bg-[#1565ff] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Entry Price */}
            <div>
              <label htmlFor="calc-entry-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                Entry Price ($)
              </label>
              <input
                ref={entryInputRef}
                id="calc-entry-input"
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="e.g. 65000"
                value={rawInputs.entry}
                onChange={(e) => handleEntryChange(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
              />
            </div>

            {/* Stop Loss & Take Profit (Side-by-side, stacks if narrow) */}
            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
              <div>
                <label htmlFor="calc-sl-input" className="text-[10px] sm:text-[11px] font-bold text-[#ff3b4a] uppercase tracking-wider block mb-0.5">
                  Stop Loss ($)
                </label>
                <input
                  ref={stopLossInputRef}
                  id="calc-sl-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="Stop Loss"
                  value={rawInputs.stopLoss}
                  onChange={(e) => handleStopLossChange(e.target.value)}
                  className="w-full h-9 bg-red-50/50 border border-red-200 rounded-lg px-2.5 text-xs sm:text-sm font-mono text-[#ff3b4a] font-bold focus:outline-none focus:border-[#ff3b4a] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label htmlFor="calc-tp-input" className="text-[10px] sm:text-[11px] font-bold text-[#22a65e] uppercase tracking-wider block mb-0.5">
                  Take Profit ($)
                </label>
                <input
                  ref={takeProfitInputRef}
                  id="calc-tp-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="Take Profit"
                  value={rawInputs.takeProfit}
                  onChange={(e) => handleTakeProfitChange(e.target.value)}
                  className="w-full h-9 bg-emerald-50/50 border border-emerald-200 rounded-lg px-2.5 text-xs sm:text-sm font-mono text-[#22a65e] font-bold focus:outline-none focus:border-[#22a65e] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Risk Percentage & Leverage (Side-by-side) */}
            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2 items-start pt-0.5">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label htmlFor="calc-risk-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate block">
                    Risk Per Trade
                  </label>
                </div>
                <div className="relative">
                  <input
                    ref={riskInputRef}
                    id="calc-risk-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.01"
                    max="100"
                    value={rawInputs.riskPct}
                    onChange={(e) => handleRiskPctChange(e.target.value)}
                    placeholder="1.0"
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg pl-2.5 pr-6 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
                  />
                  <span className="absolute right-2.5 inset-y-0 flex items-center text-slate-400 font-mono text-xs pointer-events-none">%</span>
                </div>
                {/* Risk Presets */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar mt-1">
                  {[0.5, 1.0, 2.0, 5.0, 10, 25].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRiskPctChange(String(r))}
                      className={`h-6.5 px-1.5 min-w-[32px] rounded-md text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center justify-center active:scale-95 ${
                        parseFloat(rawInputs.riskPct) === r
                          ? 'bg-[#1565ff] text-white shadow-2xs font-bold'
                          : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label htmlFor="calc-leverage-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate block">
                    Leverage ({calcState.leverage}x)
                  </label>
                </div>
                <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 focus-within:border-[#1565ff] focus-within:bg-white transition-colors">
                  <input
                    id="calc-leverage-slider"
                    type="range"
                    min="1"
                    max="100"
                    value={calcState.leverage > 100 ? 100 : calcState.leverage}
                    onChange={(e) => handleLeverageChange(e.target.value)}
                    className="w-full min-w-0 accent-[#1565ff] cursor-pointer h-3"
                  />
                  <div className="relative w-11 shrink-0 flex items-center">
                    <input
                      ref={leverageInputRef}
                      id="calc-leverage-input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="125"
                      value={calcState.leverage}
                      onChange={(e) => handleLeverageChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md py-0.5 pl-0.5 pr-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] text-center"
                    />
                    <span className="absolute right-1 text-slate-400 font-mono text-[10px] pointer-events-none">x</span>
                  </div>
                </div>
                {/* Leverage Presets */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar mt-1">
                  {[1, 5, 10, 20, 30, 50].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => handleLeverageChange(String(lev))}
                      className={`h-6.5 px-1.5 min-w-[32px] rounded-md text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center justify-center active:scale-95 ${
                        calcState.leverage === lev
                          ? 'bg-[#1565ff] text-white shadow-2xs font-bold'
                          : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Margin Mode & Fee Tier (Side-by-side) */}
            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                  Margin Mode
                </label>
                <select
                  value={calcState.marginMode}
                  onChange={(e) => setCalcState({ ...calcState, marginMode: e.target.value as MarginMode })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                >
                  <option value="ISOLATED">Isolated Margin</option>
                  <option value="CROSS">Cross Margin</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                  Fee Tier
                </label>
                <select
                  value={calcState.feeTier}
                  onChange={(e) => handleFeeTierChange(e.target.value as FeeTier)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                >
                  <option value="taker">Taker (0.055%)</option>
                  <option value="maker">Maker (0.02%)</option>
                  <option value="high">High Fee (0.075%)</option>
                </select>
              </div>
            </div>

            {/* Advanced MMR & Slippage Collapsible Accordion */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowAdvancedFees(!showAdvancedFees)}
                className="text-[11px] sm:text-xs text-[#1565ff] hover:underline font-semibold flex items-center gap-1 cursor-pointer py-0.5"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvancedFees ? 'Hide Advanced Parameters ▲' : 'Custom Slippage & MMR / MMP ▼'}</span>
              </button>

              {showAdvancedFees && (
                <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2 mt-1.5 p-2 sm:p-2.5 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in duration-150">
                  <div>
                    <label className="text-[9px] sm:text-[10px] text-slate-600 font-bold block mb-0.5">Slippage (%)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={calcState.slippagePct}
                      onChange={(e) => setCalcState({ ...calcState, slippagePct: parseFloat(e.target.value) || 0.05 })}
                      className="w-full h-8 bg-white border border-slate-300 rounded-md px-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] sm:text-[10px] text-slate-600 font-bold block mb-0.5">Maint. Margin MMR (%)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={calcState.maintenanceMarginPct}
                      onChange={(e) => setCalcState({ ...calcState, maintenanceMarginPct: parseFloat(e.target.value) || 0.5 })}
                      className="w-full h-8 bg-white border border-slate-300 rounded-md px-2 text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4–8. CALCULATED RESULTS, STATUS, CHECKLIST & BUDGET (7 COLS ON DESKTOP) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* 4. KEY CALCULATED RESULT: POSITION SIZE FOCAL POINT */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="bg-gradient-to-b from-slate-50 to-blue-50/30 p-4 rounded-xl border border-blue-100/80">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Target Position Size
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs ${
                  result.riskTier === 'Conservative' ? 'bg-emerald-50 text-[#22a65e] border-emerald-200' :
                  result.riskTier === 'Elevated' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                  result.riskTier === 'High' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                  'bg-red-50 text-[#ff3b4a] border-red-200'
                }`}>
                  {result.riskTier} Risk
                </span>
              </div>

              {/* Major Focal Point: Position Size Number */}
              <div className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                {formatCurrency(result.positionSize)}
              </div>
              <div className="text-xs sm:text-sm text-[#1565ff] font-mono font-bold mt-0.5">
                ≈ {formatNumber(result.quantity, 2, 6)} {getBaseAsset(calcState.pair)}
              </div>
            </div>

            {/* Core Secondary Metrics (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold block truncate">
                  Required Margin
                </span>
                <div className="text-sm sm:text-lg font-black text-[#1565ff] font-mono mt-0.5 truncate">
                  {formatCurrency(result.marginRequired)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">At {calcState.leverage}x leverage</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] text-[#ff3b4a] uppercase font-bold block truncate">
                  Risk Amount
                </span>
                <div className="text-sm sm:text-lg font-black text-[#ff3b4a] font-mono mt-0.5 truncate">
                  {formatCurrency(result.riskAmount)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{calcState.riskPercentage}% of account</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] text-[#22a65e] uppercase font-bold block truncate">
                  Risk : Reward
                </span>
                <div className="text-sm sm:text-lg font-black text-[#22a65e] font-mono mt-0.5 truncate">
                  1 : {result.riskRewardRatio.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Asymmetric ratio</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold block truncate">
                  Fees & Slippage
                </span>
                <div className="text-sm sm:text-lg font-black text-slate-900 font-mono mt-0.5 truncate">
                  {formatCurrency(result.feeImpact + result.estimatedSlippageCost)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Round-trip estimate</span>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS: COPY PLAN & SIMULATE (SIDE-BY-SIDE) + SAVE TRADE (FULL WIDTH) */}
          <div id="calculator-action-buttons" className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                id="calc-copy-plan-btn"
                type="button"
                onClick={handleCopySummary}
                className="h-11 px-3 sm:px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#22a65e] shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{copied ? 'Copied Parameters!' : 'Copy Plan'}</span>
              </button>

              <button
                id="calc-simulate-btn"
                type="button"
                onClick={handleToggleSimulator}
                className={`h-11 px-3 sm:px-3.5 font-bold text-xs sm:text-sm rounded-xl border transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${
                  showLeverageSimulator 
                    ? 'bg-blue-50 border-blue-300 text-[#1565ff]' 
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-[#1565ff] shrink-0" />
                <span className="truncate">{showLeverageSimulator ? 'Hide Simulator' : 'Simulate Leverage'}</span>
              </button>
            </div>

            <button
              id="calc-save-trade-btn"
              type="button"
              onClick={handleSaveTradeWithGate}
              disabled={killSwitchActive || result.positionSize <= 0}
              className={`w-full h-11 sm:h-12 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 ${
                isSaveApproved
                  ? 'bg-[#1565ff] hover:bg-[#0051e6] text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {isSaveApproved ? <Save className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
              <span className="truncate">
                {isSaveApproved 
                  ? 'Save Trade' 
                  : 'Save Trade (Gate Blocked)'}
              </span>
            </button>
          </div>

          {/* 5. COMPACT TRADE STATUS CARD (WITH EXPANDABLE VIOLATIONS & FIX BUTTONS) */}
          <TradeStatusCard
            validation={riskGateValidation}
            result={result}
            onFixField={handleFixField}
            onSaveToJournal={handleSaveTradeWithGate}
            killSwitchActive={killSwitchActive}
            defaultExpanded={false}
          />

          {/* 6. COMPACT PRE-TRADE CHECKLIST (WITH EXPANDABLE VERIFICATION LIST) */}
          <PreTradeChecklistCard
            checklist={riskGateValidation.checklist}
            onFixField={handleFixField}
            defaultExpanded={false}
          />

          {/* 7. COMPACT RISK BUDGET CARD (WITH EXPANDABLE RISK DETAILS) */}
          <RiskBudgetCard
            metrics={riskGateValidation.metrics}
            result={result}
            plan={plan}
            defaultExpanded={false}
          />

          {/* 8. PROFIT / LOSS DETAILS (2 COLUMNS MAX ON MOBILE, STACKABLE ON NARROW) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Profit / Loss Breakdown
            </h4>

            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-[#22a65e] block">
                  Net Profit (If TP Hit)
                </span>
                <div className="text-base sm:text-lg font-black text-[#22a65e] mt-0.5 font-mono truncate">
                  +{formatCurrency(result.netProfit)}
                </div>
                <span className="text-[10px] text-slate-500">After all fees & slippage</span>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-[#ff3b4a] block">
                  Net Loss (If SL Hit)
                </span>
                <div className="text-base sm:text-lg font-black text-[#ff3b4a] mt-0.5 font-mono truncate">
                  -{formatCurrency(result.netLoss)}
                </div>
                <span className="text-[10px] text-slate-500">Total maximum risk</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                  Estimated Liquidation
                </span>
                <div className="text-sm sm:text-base font-bold text-amber-600 mt-0.5 font-mono truncate">
                  ${formatNumber(result.liquidationPrice)}
                </div>
                <span className="text-[10px] text-slate-500">
                  {result.distanceToLiquidationPct.toFixed(2)}% from entry
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                  Stop-Loss Distance
                </span>
                <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 font-mono truncate">
                  ${formatNumber(result.stopLossDistance)}
                </div>
                <span className="text-[10px] text-[#ff3b4a] font-bold">
                  ({result.priceRiskPercentage.toFixed(2)}% price move)
                </span>
              </div>
            </div>
          </div>

          {/* LEVERAGE SIMULATOR SECTION */}
          {showLeverageSimulator && (
            <div ref={simulatorRef} className="pt-1 animate-in fade-in duration-200">
              <LeverageSimulator
                accountBalance={calcState.accountBalance}
                riskAmount={result.riskAmount}
                entryPrice={calcState.entryPrice}
                stopLossPrice={calcState.stopLoss}
                direction={calcState.direction}
                currentLeverage={calcState.leverage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
