import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  Percent, 
  Activity, 
  Sliders, 
  PieChart, 
  Check, 
  RotateCcw, 
  Flame, 
  Lock, 
  Unlock, 
  Info, 
  Layers, 
  Scale, 
  DollarSign, 
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Clock
} from 'lucide-react';
import { TradingPlan, CalculatorState, DailyRiskStatus, MarginMode } from '../types';
import { formatCurrency } from '../utils/calculator';

export type QuickRuleModalType = 'rules' | 'fees' | 'slippage' | 'budget' | 'advancedCalc';

interface QuickRiskRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: QuickRuleModalType;
  plan: TradingPlan;
  onSavePlan: (updatedPlan: TradingPlan) => void;
  calcState?: CalculatorState;
  onSaveCalcState?: (updatedState: CalculatorState) => void;
  killSwitchActive?: boolean;
  onToggleKillSwitch?: () => void;
  dailyRiskStatus?: DailyRiskStatus;
  currentEquity?: number;
}

export const QuickRiskRulesModal: React.FC<QuickRiskRulesModalProps> = ({
  isOpen,
  onClose,
  type: initialType,
  plan,
  onSavePlan,
  calcState,
  onSaveCalcState,
  killSwitchActive = false,
  onToggleKillSwitch,
  dailyRiskStatus,
  currentEquity = 10000,
}) => {
  const [activeTab, setActiveTab] = useState<QuickRuleModalType>(initialType);
  const [saved, setSaved] = useState(false);

  // Sync initial tab when modal re-opens with different type
  useEffect(() => {
    setActiveTab(initialType);
  }, [initialType]);

  // --- 1. Risk Rules & Kill Switch State ---
  const [maxRisk, setMaxRisk] = useState<number>(plan.maxRiskPerTrade || 2);
  const [maxLeverage, setMaxLeverage] = useState<number>(plan.maxLeverage || 20);
  const [minRR, setMinRR] = useState<number>(plan.minRiskRewardRatio || 1.5);
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(plan.maxDailyLossPercent || plan.maxDailyLossPct || 3);
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState<number>(plan.maxConsecutiveLosses || 3);
  const [enforceKillSwitch, setEnforceKillSwitch] = useState<boolean>(plan.enforceKillSwitch !== false);
  const [requireStopLoss, setRequireStopLoss] = useState<boolean>(plan.requireStopLoss !== false);
  const [requireConfirmation, setRequireConfirmation] = useState<boolean>(plan.requireConfirmation !== false);

  // --- 2. Risk Budget & Daily Cap State ---
  const [startingCapital, setStartingCapital] = useState<number>(plan.startingCapital || 10000);
  const [maxDailyLossAmount, setMaxDailyLossAmount] = useState<number>(
    plan.maxDailyLossAmount || ((plan.startingCapital || 10000) * (plan.maxDailyLossPercent || 3)) / 100
  );
  const [maxWeeklyLossPercent, setMaxWeeklyLossPercent] = useState<number>(plan.maxWeeklyLossPercent || 6);
  const [maxWeeklyLossAmount, setMaxWeeklyLossAmount] = useState<number>(plan.maxWeeklyLossAmount || 600);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number>(plan.maxTradesPerDay || 5);
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(plan.cooldownPeriodMinutes || 30);

  // --- 3. Fee Settings (Taker/Maker) State ---
  const [selectedExchangePreset, setSelectedExchangePreset] = useState<string>('bybit');
  const [takerFeeRate, setTakerFeeRate] = useState<number>(
    calcState?.takerFeeRate !== undefined ? calcState.takerFeeRate * 100 : (calcState?.feeRate ? calcState.feeRate * 100 : 0.055)
  );
  const [makerFeeRate, setMakerFeeRate] = useState<number>(
    calcState?.makerFeeRate !== undefined ? calcState.makerFeeRate * 100 : 0.020
  );
  const [fundingRate, setFundingRate] = useState<number>(
    calcState?.estimatedFundingRate !== undefined ? calcState.estimatedFundingRate * 100 : 0.010
  );
  const [feeDiscountTier, setFeeDiscountTier] = useState<string>('standard');
  const [autoDeductFees, setAutoDeductFees] = useState<boolean>(true);

  // --- 4. Custom Slippage & MMR State ---
  const [selectedMmrPreset, setSelectedMmrPreset] = useState<string>('btc_eth');
  const [slippagePct, setSlippagePct] = useState<number>(calcState?.slippagePct !== undefined ? calcState.slippagePct : 0.05);
  const [maintenanceMarginPct, setMaintenanceMarginPct] = useState<number>(
    calcState?.maintenanceMarginPct !== undefined ? calcState.maintenanceMarginPct : 0.50
  );
  const [liqBufferPct, setLiqBufferPct] = useState<number>(10.0);

  // --- 5. Advanced Calculator Settings State ---
  const [marginMode, setMarginMode] = useState<MarginMode>(calcState?.marginMode || 'ISOLATED');
  const [defaultLevPreset, setDefaultLevPreset] = useState<number>(calcState?.leverage || 10);
  const [contractType, setContractType] = useState<'linear' | 'inverse'>('linear');
  const [balanceSyncMode, setBalanceSyncMode] = useState<'auto' | 'manual'>('auto');
  const [compoundingMode, setCompoundingMode] = useState<'compounding' | 'fixed'>('compounding');
  const [roundingDecimals, setRoundingDecimals] = useState<number>(3);
  const [autoCalcLiq, setAutoCalcLiq] = useState<boolean>(true);

  if (!isOpen) return null;

  // Handle Exchange Presets
  const applyExchangePreset = (preset: string) => {
    setSelectedExchangePreset(preset);
    switch (preset) {
      case 'binance':
        setTakerFeeRate(0.050);
        setMakerFeeRate(0.020);
        break;
      case 'bybit':
        setTakerFeeRate(0.055);
        setMakerFeeRate(0.020);
        break;
      case 'okx':
        setTakerFeeRate(0.050);
        setMakerFeeRate(0.020);
        break;
      case 'bitget':
        setTakerFeeRate(0.060);
        setMakerFeeRate(0.020);
        break;
      case 'deribit':
        setTakerFeeRate(0.050);
        setMakerFeeRate(0.010);
        break;
      default:
        break;
    }
  };

  // Handle MMR Presets
  const applyMmrPreset = (preset: string) => {
    setSelectedMmrPreset(preset);
    switch (preset) {
      case 'btc_eth':
        setMaintenanceMarginPct(0.40);
        setSlippagePct(0.05);
        break;
      case 'major_alts':
        setMaintenanceMarginPct(1.00);
        setSlippagePct(0.10);
        break;
      case 'high_beta':
        setMaintenanceMarginPct(2.50);
        setSlippagePct(0.25);
        break;
      default:
        break;
    }
  };

  // Handle Save
  const handleSave = () => {
    // 1. Update Trading Plan
    const updatedPlan: TradingPlan = {
      ...plan,
      startingCapital: Number(startingCapital),
      maxRiskPerTrade: Number(maxRisk),
      maxRiskPerTradePct: Number(maxRisk),
      maxLeverage: Number(maxLeverage),
      minRiskRewardRatio: Number(minRR),
      maxDailyLossPercent: Number(maxDailyLoss),
      maxDailyLossPct: Number(maxDailyLoss),
      maxDailyLossAmount: Number(maxDailyLossAmount),
      maxWeeklyLossPercent: Number(maxWeeklyLossPercent),
      maxWeeklyLossAmount: Number(maxWeeklyLossAmount),
      maxTradesPerDay: Number(maxTradesPerDay),
      maxConsecutiveLosses: Number(maxConsecutiveLosses),
      enforceKillSwitch,
      requireStopLoss,
      requireConfirmation,
      cooldownPeriodMinutes: Number(cooldownMinutes),
    };
    onSavePlan(updatedPlan);

    // 2. Update Calculator State if available
    if (calcState && onSaveCalcState) {
      const updatedCalc: CalculatorState = {
        ...calcState,
        feeRate: Number(takerFeeRate) / 100,
        takerFeeRate: Number(takerFeeRate) / 100,
        makerFeeRate: Number(makerFeeRate) / 100,
        estimatedFundingRate: Number(fundingRate) / 100,
        slippagePct: Number(slippagePct),
        maintenanceMarginPct: Number(maintenanceMarginPct),
        marginMode,
        leverage: Number(defaultLevPreset),
      };
      onSaveCalcState(updatedCalc);
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  const tabs: { id: QuickRuleModalType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'rules', label: 'Risk Rules & Kill Switch', icon: ShieldAlert },
    { id: 'budget', label: 'Risk Budget & Daily Cap', icon: PieChart },
    { id: 'fees', label: 'Fee Settings (Taker/Maker)', icon: Percent },
    { id: 'slippage', label: 'Custom Slippage & MMR', icon: Activity },
    { id: 'advancedCalc', label: 'Advanced Settings', icon: Sliders },
  ];

  return (
    <div 
      id="quick-risk-rules-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        id="quick-risk-rules-modal-container"
        className="w-full max-w-2xl max-h-[92vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-xs ${
              activeTab === 'rules' ? 'bg-rose-50 text-rose-600' :
              activeTab === 'budget' ? 'bg-blue-50 text-[#1565ff]' :
              activeTab === 'fees' ? 'bg-emerald-50 text-emerald-600' :
              activeTab === 'slippage' ? 'bg-indigo-50 text-indigo-600' :
              'bg-amber-50 text-amber-600'
            }`}>
              {activeTab === 'rules' && <ShieldAlert className="w-5 h-5" />}
              {activeTab === 'budget' && <PieChart className="w-5 h-5" />}
              {activeTab === 'fees' && <Percent className="w-5 h-5" />}
              {activeTab === 'slippage' && <Activity className="w-5 h-5" />}
              {activeTab === 'advancedCalc' && <Sliders className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                {activeTab === 'rules' && 'Risk Rules & Kill Switch'}
                {activeTab === 'budget' && 'Risk Budget & Daily Cap'}
                {activeTab === 'fees' && 'Fee Settings (Taker/Maker)'}
                {activeTab === 'slippage' && 'Custom Slippage & MMR'}
                {activeTab === 'advancedCalc' && 'Advanced Calculator Settings'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {activeTab === 'rules' && 'Enforce automated capital protection & circuit breakers'}
                {activeTab === 'budget' && 'Manage maximum daily drawdown and trade frequency limits'}
                {activeTab === 'fees' && 'Configure exchange taker/maker fee schedules and drag deduction'}
                {activeTab === 'slippage' && 'Fine-tune slippage tolerance and maintenance margin requirements'}
                {activeTab === 'advancedCalc' && 'Customize margin modes, leverage presets and sizing precision'}
              </p>
            </div>
          </div>

          <button 
            type="button"
            id="modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="px-3 sm:px-5 pt-2 pb-1.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive 
                    ? 'bg-[#1565ff] text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800">
          
          {/* ========================================================= */}
          {/* TAB 1: RISK RULES & KILL SWITCH */}
          {/* ========================================================= */}
          {activeTab === 'rules' && (
            <div className="space-y-5">
              {/* Master Kill Switch Banner */}
              <div className={`p-4 rounded-2xl border transition-all ${
                killSwitchActive 
                  ? 'bg-rose-50 border-rose-200 text-rose-900' 
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                      killSwitchActive ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {killSwitchActive ? <Flame className="w-5 h-5 animate-pulse" /> : <ShieldCheck className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">
                          {killSwitchActive ? '🚨 KILL SWITCH IS ACTIVE' : '🛡️ KILL SWITCH STANDING GUARD'}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          killSwitchActive ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          {killSwitchActive ? 'LOCKED' : 'ARMED'}
                        </span>
                      </div>
                      <p className="text-xs mt-1 text-slate-600 leading-relaxed">
                        {killSwitchActive 
                          ? 'All new trade entries are locked to prevent tilt and catastrophic revenge drawdown.' 
                          : 'Automated circuit breaker monitors consecutive losses and daily max loss in real-time.'}
                      </p>
                    </div>
                  </div>

                  {onToggleKillSwitch && (
                    <button
                      type="button"
                      id="toggle-kill-switch-btn"
                      onClick={onToggleKillSwitch}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
                        killSwitchActive 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {killSwitchActive ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{killSwitchActive ? 'Unlock Trading' : 'Emergency Lock'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Automated Kill Switch Settings */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Automated Circuit Breakers</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-semibold text-slate-600">Auto-Trip</span>
                    <input 
                      type="checkbox" 
                      checked={enforceKillSwitch}
                      onChange={(e) => setEnforceKillSwitch(e.target.checked)}
                      className="w-4 h-4 rounded text-[#1565ff] accent-[#1565ff] cursor-pointer"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Consecutive Loss Tripwire (Trades)
                    </label>
                    <input 
                      type="number"
                      min="1"
                      max="10"
                      value={maxConsecutiveLosses}
                      onChange={(e) => setMaxConsecutiveLosses(parseInt(e.target.value, 10) || 1)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Locks trade execution immediately if {maxConsecutiveLosses} losing trades occur in a row.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Daily Max Loss Circuit Breaker (%)
                    </label>
                    <input 
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="20"
                      value={maxDailyLoss}
                      onChange={(e) => setMaxDailyLoss(parseFloat(e.target.value) || 1)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Locks terminal if daily loss reaches -{maxDailyLoss}% of account capital.
                    </p>
                  </div>
                </div>
              </div>

              {/* Per-Trade Risk Tolerances */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block pb-2 border-b border-slate-200">
                  Per-Trade Risk Tolerances
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Max Risk Per Trade (%)
                    </label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={maxRisk}
                      onChange={(e) => setMaxRisk(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <div className="flex gap-1 mt-1.5">
                      {[0.5, 1.0, 2.0, 3.0].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setMaxRisk(v)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          {v}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Max Allowed Leverage (x)
                    </label>
                    <input 
                      type="number" 
                      step="1" 
                      value={maxLeverage}
                      onChange={(e) => setMaxLeverage(parseInt(e.target.value, 10) || 1)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <div className="flex gap-1 mt-1.5">
                      {[5, 10, 20, 50].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setMaxLeverage(v)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          {v}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Min Risk:Reward (1:X)
                    </label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={minRR}
                      onChange={(e) => setMinRR(parseFloat(e.target.value) || 1)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <div className="flex gap-1 mt-1.5">
                      {[1.2, 1.5, 2.0, 3.0].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setMinRR(v)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          {v}R
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Checklist Requirements */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={requireStopLoss}
                      onChange={(e) => setRequireStopLoss(e.target.checked)}
                      className="w-4 h-4 rounded text-[#1565ff] accent-[#1565ff] cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Require mandatory Stop-Loss on every position (Reject trades without SL)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={requireConfirmation}
                      onChange={(e) => setRequireConfirmation(e.target.checked)}
                      className="w-4 h-4 rounded text-[#1565ff] accent-[#1565ff] cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Require pre-trade validation gate review before recording trade
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: RISK BUDGET & DAILY CAP */}
          {/* ========================================================= */}
          {activeTab === 'budget' && (
            <div className="space-y-5">
              {/* Daily Risk Budget Overview Card */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-950">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#1565ff]" />
                    <span className="text-xs font-bold uppercase tracking-wider">Today's Risk Budget Status</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#1565ff]">
                    {dailyRiskStatus?.isKillSwitchActive ? 'LIMIT REACHED' : 'BUDGET AVAILABLE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-blue-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">Capital Base</span>
                    <span className="text-sm font-bold font-mono text-slate-900">{formatCurrency(startingCapital)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-blue-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">Daily Cap ({maxDailyLoss}%)</span>
                    <span className="text-sm font-bold font-mono text-rose-600">-${maxDailyLossAmount.toFixed(0)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-blue-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">Today's Loss</span>
                    <span className="text-sm font-bold font-mono text-slate-800">
                      -${(dailyRiskStatus?.todayGrossLoss || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-blue-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">Remaining Allowance</span>
                    <span className="text-sm font-bold font-mono text-emerald-600">
                      ${Math.max(0, maxDailyLossAmount - (dailyRiskStatus?.todayGrossLoss || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Capital & Loss Caps */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block pb-2 border-b border-slate-200">
                  Drawdown Caps & Baseline
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Starting Capital Baseline ($)
                    </label>
                    <input 
                      type="number"
                      step="500"
                      value={startingCapital}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setStartingCapital(val);
                        setMaxDailyLossAmount((val * maxDailyLoss) / 100);
                      }}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Foundation for sizing and drawdown calculations.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Daily Max Loss Cap ($)
                    </label>
                    <input 
                      type="number"
                      step="10"
                      value={maxDailyLossAmount}
                      onChange={(e) => setMaxDailyLossAmount(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Fixed dollar loss allowance per trading day.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Weekly Max Loss Cap (%)
                    </label>
                    <input 
                      type="number"
                      step="0.5"
                      value={maxWeeklyLossPercent}
                      onChange={(e) => setMaxWeeklyLossPercent(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Multi-day preservation shield ({maxWeeklyLossPercent}% = ${(startingCapital * maxWeeklyLossPercent / 100).toFixed(0)}).</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Max Trades Per Day (Overtrading Cap)
                    </label>
                    <input 
                      type="number"
                      min="1"
                      max="50"
                      value={maxTradesPerDay}
                      onChange={(e) => setMaxTradesPerDay(parseInt(e.target.value, 10) || 1)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Prevents impulsive overtrading and broker fee churn.</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mandatory Cooldown After Stop-Loss (Minutes)
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number"
                      min="0"
                      max="240"
                      step="5"
                      value={cooldownMinutes}
                      onChange={(e) => setCooldownMinutes(parseInt(e.target.value, 10) || 0)}
                      className="w-32 h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <span className="text-xs text-slate-500">
                      Recommended: 30 minutes to regain emotional equilibrium before re-entering markets.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: FEE SETTINGS (TAKER/MAKER) */}
          {/* ========================================================= */}
          {activeTab === 'fees' && (
            <div className="space-y-5">
              {/* Exchange Presets */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Exchange Fee Presets
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'binance', name: 'Binance Futures', taker: '0.050%', maker: '0.020%' },
                    { id: 'bybit', name: 'Bybit Derivatives', taker: '0.055%', maker: '0.020%' },
                    { id: 'okx', name: 'OKX Futures', taker: '0.050%', maker: '0.020%' },
                    { id: 'bitget', name: 'Bitget Futures', taker: '0.060%', maker: '0.020%' },
                    { id: 'deribit', name: 'Deribit Crypto', taker: '0.050%', maker: '0.010%' },
                    { id: 'custom', name: 'Custom Rates', taker: 'Custom', maker: 'Custom' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyExchangePreset(preset.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedExchangePreset === preset.id
                          ? 'bg-blue-50/80 border-[#1565ff] text-[#1565ff] shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight truncate">{preset.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        T: {preset.taker} | M: {preset.maker}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Exact Rate Inputs */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block pb-2 border-b border-slate-200">
                  Fee Schedule Parameters
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Taker Fee Rate (%)
                    </label>
                    <input 
                      type="number"
                      step="0.005"
                      value={takerFeeRate}
                      onChange={(e) => setTakerFeeRate(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Market orders & Stop-Loss executions.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Maker Fee Rate (%)
                    </label>
                    <input 
                      type="number"
                      step="0.005"
                      value={makerFeeRate}
                      onChange={(e) => setMakerFeeRate(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Limit orders & Take-Profit limit exits.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Est. 8h Funding Rate (%)
                    </label>
                    <input 
                      type="number"
                      step="0.001"
                      value={fundingRate}
                      onChange={(e) => setFundingRate(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Perpetual funding rate per 8-hour period.</p>
                  </div>
                </div>

                {/* Tier Discount */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Exchange VIP / Native Token Discount Tier
                  </label>
                  <select
                    value={feeDiscountTier}
                    onChange={(e) => setFeeDiscountTier(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-[#1565ff] outline-none cursor-pointer"
                  >
                    <option value="standard">Standard Tier (0% fee discount)</option>
                    <option value="token_10">BNB / MNT / Platform Token Deduction (10% discount)</option>
                    <option value="vip1">VIP 1 / Pro Trader (20% fee discount)</option>
                    <option value="vip2">VIP 2 / Institutional (35% fee discount)</option>
                  </select>
                </div>

                {/* Sizing Integration Toggle */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={autoDeductFees}
                      onChange={(e) => setAutoDeductFees(e.target.checked)}
                      className="w-4 h-4 rounded text-[#1565ff] accent-[#1565ff] cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Auto-deduct fee drag from position size (Guarantees net loss + fees never exceeds your dollar risk budget)
                    </span>
                  </label>
                </div>
              </div>

              {/* Sample Fee Impact Preview */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs">
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>Fee Drag Preview ($10,000 Notional Position)</span>
                  <span className="font-mono">Total Drag: ~${((10000 * (takerFeeRate / 100)) + (10000 * (makerFeeRate / 100))).toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Entry Taker ({takerFeeRate}%): ${(10000 * (takerFeeRate / 100)).toFixed(2)} • 
                  Exit Maker ({makerFeeRate}%): ${(10000 * (makerFeeRate / 100)).toFixed(2)} • 
                  Est. 8h Funding: ${(10000 * (fundingRate / 100)).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: CUSTOM SLIPPAGE & MMR */}
          {/* ========================================================= */}
          {activeTab === 'slippage' && (
            <div className="space-y-5">
              {/* MMR Asset Class Presets */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Asset Maintenance Margin Rate (MMR) Presets
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'btc_eth', name: 'Tier 1: BTC & ETH', mmr: '0.40%', slip: '0.05%', desc: 'Ultra-high liquidity' },
                    { id: 'major_alts', name: 'Tier 2: SOL, BNB, XRP', mmr: '1.00%', slip: '0.10%', desc: 'Standard altcoins' },
                    { id: 'high_beta', name: 'Tier 3: Memes & Microcaps', mmr: '2.50%', slip: '0.25%', desc: 'High liquidation risk' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyMmrPreset(preset.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedMmrPreset === preset.id
                          ? 'bg-blue-50/80 border-[#1565ff] text-[#1565ff] shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{preset.name}</div>
                      <div className="text-[11px] font-mono font-semibold text-slate-900 mt-1">
                        MMR: {preset.mmr} • Slip: {preset.slip}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Exact Slippage and MMR inputs */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block pb-2 border-b border-slate-200">
                  Execution Safety Tolerances
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Expected Market Slippage (%)
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      max="5"
                      value={slippagePct}
                      onChange={(e) => setSlippagePct(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Execution price difference on market stop-loss triggers during fast candles.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Maintenance Margin Rate (MMR %)
                    </label>
                    <input 
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="10"
                      value={maintenanceMarginPct}
                      onChange={(e) => setMaintenanceMarginPct(parseFloat(e.target.value) || 0.1)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Minimum equity ratio required by the exchange before liquidation occurs.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pre-Trade Liquidation Safety Buffer (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number"
                      step="1"
                      min="1"
                      max="50"
                      value={liqBufferPct}
                      onChange={(e) => setLiqBufferPct(parseFloat(e.target.value) || 1)}
                      className="w-32 h-10 px-3 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-[#1565ff] outline-none"
                    />
                    <span className="text-xs text-slate-500">
                      Warns if Liquidation Price is closer than {liqBufferPct}% beyond your Stop Loss.
                    </span>
                  </div>
                </div>
              </div>

              {/* Educational Notice */}
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-xs">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Why MMR Matters for Stop-Loss Safety</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  The higher the MMR, the closer the exchange moves your Liquidation Price to your entry. If your stop loss is placed beyond the liquidation price, you will get liquidated and lose your entire margin before your stop loss ever executes.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: ADVANCED CALCULATOR SETTINGS */}
          {/* ========================================================= */}
          {activeTab === 'advancedCalc' && (
            <div className="space-y-5">
              {/* Margin Mode & Contract Style */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block pb-2 border-b border-slate-200">
                  Margin Mode & Sizing Defaults
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Default Margin Isolation
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMarginMode('ISOLATED')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          marginMode === 'ISOLATED'
                            ? 'bg-blue-50 border-[#1565ff] text-[#1565ff] shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Isolated Margin
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarginMode('CROSS')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          marginMode === 'CROSS'
                            ? 'bg-blue-50 border-[#1565ff] text-[#1565ff] shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Cross Margin
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Contract Settlement Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setContractType('linear')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          contractType === 'linear'
                            ? 'bg-blue-50 border-[#1565ff] text-[#1565ff] shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        USDT-Margined
                      </button>
                      <button
                        type="button"
                        onClick={() => setContractType('inverse')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          contractType === 'inverse'
                            ? 'bg-blue-50 border-[#1565ff] text-[#1565ff] shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Coin-Margined
                      </button>
                    </div>
                  </div>
                </div>

                {/* Default Leverage Preset */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Default Initial Leverage
                  </label>
                  <div className="flex gap-2">
                    {[1, 5, 10, 20, 50, 100].map((lev) => (
                      <button
                        key={lev}
                        type="button"
                        onClick={() => setDefaultLevPreset(lev)}
                        className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          defaultLevPreset === lev
                            ? 'bg-[#1565ff] text-white border-[#1565ff] shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calculation Precision & Compounding */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block pb-2 border-b border-slate-200">
                  Precision & Capital Model
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Capital Sizing Method
                    </label>
                    <select
                      value={compoundingMode}
                      onChange={(e) => setCompoundingMode(e.target.value as 'compounding' | 'fixed')}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-[#1565ff] outline-none cursor-pointer"
                    >
                      <option value="compounding">Compounding (% of current balance: {formatCurrency(currentEquity)})</option>
                      <option value="fixed">Fixed Baseline (% of starting capital: {formatCurrency(startingCapital)})</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quantity Decimal Rounding
                    </label>
                    <select
                      value={roundingDecimals}
                      onChange={(e) => setRoundingDecimals(parseInt(e.target.value, 10))}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-[#1565ff] outline-none cursor-pointer font-mono"
                    >
                      <option value={0}>0 Decimals (1 BTC, 50 SOL)</option>
                      <option value={1}>1 Decimal (0.1 BTC)</option>
                      <option value={2}>2 Decimals (0.01 BTC)</option>
                      <option value={3}>3 Decimals (0.001 BTC - Default)</option>
                      <option value={4}>4 Decimals (0.0001 BTC)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={autoCalcLiq}
                      onChange={(e) => setAutoCalcLiq(e.target.checked)}
                      className="w-4 h-4 rounded text-[#1565ff] accent-[#1565ff] cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Auto-calculate liquidation price dynamically on every price keystroke
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            id="modal-cancel-btn"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 hover:bg-slate-200/60 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="modal-save-btn"
              onClick={handleSave}
              className="px-5 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {saved ? <Check className="w-4 h-4 text-white" /> : null}
              <span>{saved ? 'Saved Successfully!' : 'Save Parameters'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
