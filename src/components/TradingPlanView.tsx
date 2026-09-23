import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Save, 
  RotateCcw, 
  Plus, 
  X, 
  Check, 
  Flame, 
  Layers, 
  Sliders, 
  Coins, 
  ListChecks, 
  Zap,
  Info
} from 'lucide-react';
import { TradingPlan, DailyRiskStatus } from '../types';
import { formatCurrency } from '../utils/calculator';

interface TradingPlanViewProps {
  plan: TradingPlan;
  dailyRiskStatus?: DailyRiskStatus;
  onSavePlan: (updatedPlan: TradingPlan) => Promise<void>;
  onResetKillSwitch?: () => void;
  stats?: any;
  todayLoss?: number;
}

export const TradingPlanView: React.FC<TradingPlanViewProps> = ({
  plan,
  dailyRiskStatus,
  onSavePlan,
  onResetKillSwitch = () => {},
}) => {
  const [formData, setFormData] = useState<TradingPlan>({ ...plan });
  const [newCryptoInput, setNewCryptoInput] = useState('');
  const [newSetupInput, setNewSetupInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const activeDailyRisk: DailyRiskStatus = dailyRiskStatus || {
    todayLoss: 0,
    todayGrossLoss: 0,
    todayLossPct: 0,
    dailyLossLimit: plan?.maxDailyLossAmount || 300,
    remainingLossAllowance: plan?.maxDailyLossAmount || 300,
    todayTradesCount: 0,
    consecutiveLosses: 0,
    isKillSwitchActive: false,
    killSwitchReasons: [],
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSavePlan(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleAddCrypto = () => {
    const clean = newCryptoInput.trim().toUpperCase().replace('/', '');
    if (clean && !formData.preferredCryptos.includes(clean)) {
      setFormData((prev) => ({
        ...prev,
        preferredCryptos: [...prev.preferredCryptos, clean],
      }));
      setNewCryptoInput('');
    }
  };

  const handleRemoveCrypto = (cryptoToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredCryptos: prev.preferredCryptos.filter((c) => c !== cryptoToRemove),
    }));
  };

  const handleAddSetup = () => {
    const clean = newSetupInput.trim();
    if (clean && !formData.allowedSetups.includes(clean)) {
      setFormData((prev) => ({
        ...prev,
        allowedSetups: [...prev.allowedSetups, clean],
      }));
      setNewSetupInput('');
    }
  };

  const handleRemoveSetup = (setupToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedSetups: prev.allowedSetups.filter((s) => s !== setupToRemove),
    }));
  };

  return (
    <div id="trading-plan-view" className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* HEADER & STATUS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#1565ff]" />
            <h2 className="text-xl font-bold text-slate-900 tracking-wide uppercase">
              Crypto Trading Plan & Risk Rules
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Institutional risk ceilings, asset watchlists, and algorithmic kill switch parameters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeDailyRisk.isKillSwitchActive ? (
            <div className="px-3.5 py-1.5 bg-red-50 border border-red-200 text-[#ff3b4a] rounded-xl text-xs font-bold flex items-center gap-2">
              <Flame className="w-4 h-4 animate-bounce" />
              Kill Switch: ACTIVE
            </div>
          ) : (
            <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 text-[#22a65e] rounded-xl text-xs font-bold flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              Risk Status: Normal
            </div>
          )}
        </div>
      </div>

      {/* KILL SWITCH CONTROL PANEL */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 border border-red-100 text-[#ff3b4a] rounded-xl">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Daily Loss Limit & Kill Switch
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically halts trading calculations and alerts you when your daily loss, trade count, or loss streak is triggered.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              id="plan-reset-killswitch"
              type="button"
              onClick={onResetKillSwitch}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Daily Limits
            </button>
          </div>
        </div>

        {/* Live Day Monitor */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Today's Loss</span>
            <div className="text-base font-bold text-[#ff3b4a] mt-0.5">
              {formatCurrency(activeDailyRisk.todayGrossLoss)}
            </div>
            <span className="text-[10px] text-slate-400">Limit: {formatCurrency(activeDailyRisk.dailyLossLimit)}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Remaining Risk Room</span>
            <div className={`text-base font-bold mt-0.5 ${activeDailyRisk.remainingLossAllowance > 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
              {formatCurrency(activeDailyRisk.remainingLossAllowance)}
            </div>
            <span className="text-[10px] text-slate-400">Allowed before stop</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Trades Executed Today</span>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {activeDailyRisk.todayTradesCount} / {formData.maxTradesPerDay}
            </div>
            <span className="text-[10px] text-slate-400">Max {formData.maxTradesPerDay} trades/day</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Loss Streak Tilt Monitor</span>
            <div className="text-base font-bold text-amber-600 mt-0.5">
              {activeDailyRisk.consecutiveLosses} / {formData.maxConsecutiveLosses}
            </div>
            <span className="text-[10px] text-slate-400">Max consecutive losses</span>
          </div>
        </div>
      </div>

      {/* CONFIGURATION FORM */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. RISK LIMITS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-[#1565ff]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              1. Position & Portfolio Risk Thresholds
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Default Risk Per Trade (%)
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                max="100"
                value={formData.defaultRiskPerTrade}
                onChange={(e) => setFormData({ ...formData, defaultRiskPerTrade: parseFloat(e.target.value) || 1.0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Configurable up to 100% per trade</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Max Risk Per Trade (%)
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                max="100"
                value={formData.maxRiskPerTrade}
                onChange={(e) => setFormData({ ...formData, maxRiskPerTrade: parseFloat(e.target.value) || 2.0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Hard violation ceiling (up to 100%)</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Max Account Leverage (x)
              </label>
              <input
                type="number"
                min="1"
                max="125"
                value={formData.maxLeverage}
                onChange={(e) => setFormData({ ...formData, maxLeverage: parseInt(e.target.value) || 20 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Allowed range: 1x to 125x</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Max Daily Loss Amount ($)
              </label>
              <input
                type="number"
                step="10"
                min="10"
                value={formData.maxDailyLossAmount}
                onChange={(e) => setFormData({ ...formData, maxDailyLossAmount: parseFloat(e.target.value) || 300 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Triggers Kill Switch instantly</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Max Trades Per Day
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.maxTradesPerDay}
                onChange={(e) => setFormData({ ...formData, maxTradesPerDay: parseInt(e.target.value) || 5 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Prevents overtrading low-TF noise</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Max Consecutive Losses
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.maxConsecutiveLosses}
                onChange={(e) => setFormData({ ...formData, maxConsecutiveLosses: parseInt(e.target.value) || 3 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Tilt & revenge trading halt</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Minimum Risk : Reward Ratio
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="10.0"
                value={formData.minRiskRewardRatio}
                onChange={(e) => setFormData({ ...formData, minRiskRewardRatio: parseFloat(e.target.value) || 1.5 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">e.g. 1.5 = minimum 1:1.5 R:R</p>
            </div>
          </div>
        </div>

        {/* 2. MANDATORY EXECUTION RULES */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ListChecks className="w-4 h-4 text-[#1565ff]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              2. Trade Execution Prerequisites
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-[#1565ff]/40 transition-colors">
              <input
                type="checkbox"
                checked={formData.requireStopLoss}
                onChange={(e) => setFormData({ ...formData, requireStopLoss: e.target.checked })}
                className="mt-0.5 rounded text-[#1565ff] focus:ring-0 focus:ring-offset-0 bg-white border-slate-300"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Mandatory Stop-Loss</span>
                <span className="text-[11px] text-slate-500">Prohibit saving trades without a predefined stop loss price.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-[#1565ff]/40 transition-colors">
              <input
                type="checkbox"
                checked={formData.requireTakeProfit}
                onChange={(e) => setFormData({ ...formData, requireTakeProfit: e.target.checked })}
                className="mt-0.5 rounded text-[#1565ff] focus:ring-0 focus:ring-offset-0 bg-white border-slate-300"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Mandatory Take-Profit</span>
                <span className="text-[11px] text-slate-500">Require an explicit profit target to calculate mathematical R:R.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-[#1565ff]/40 transition-colors">
              <input
                type="checkbox"
                checked={formData.requireConfirmation}
                onChange={(e) => setFormData({ ...formData, requireConfirmation: e.target.checked })}
                className="mt-0.5 rounded text-[#1565ff] focus:ring-0 focus:ring-offset-0 bg-white border-slate-300"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Require Setup Confirmation</span>
                <span className="text-[11px] text-slate-500">Enforce recording trade setup reason before entering.</span>
              </div>
            </label>
          </div>
        </div>

        {/* 3. APPROVED CRYPTOCURRENCY WATCHLIST */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                3. Approved Crypto Watchlist
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {formData.preferredCryptos.length} Pairs Allowed
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {formData.preferredCryptos.map((pair) => (
              <span
                key={pair}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 flex items-center gap-2"
              >
                {pair}
                <button
                  type="button"
                  onClick={() => handleRemoveCrypto(pair)}
                  className="text-slate-400 hover:text-[#ff3b4a] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 max-w-sm">
            <input
              type="text"
              placeholder="Add Pair e.g. SOLUSDT"
              value={newCryptoInput}
              onChange={(e) => setNewCryptoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCrypto();
                }
              }}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none uppercase"
            />
            <button
              type="button"
              onClick={handleAddCrypto}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* 4. APPROVED SETUPS / PLAYBOOK */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                4. Playbook Strategies & Setups
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {formData.allowedSetups.length} Setups
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {formData.allowedSetups.map((setup) => (
              <span
                key={setup}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center gap-2"
              >
                {setup}
                <button
                  type="button"
                  onClick={() => handleRemoveSetup(setup)}
                  className="text-slate-400 hover:text-[#ff3b4a] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 max-w-sm">
            <input
              type="text"
              placeholder="Add Setup e.g. Liquidity Sweep"
              value={newSetupInput}
              onChange={(e) => setNewSetupInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSetup();
                }
              }}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#1565ff] focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddSetup}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isSaved && (
            <span className="text-xs text-[#22a65e] font-bold flex items-center gap-1 animate-fadeIn">
              <Check className="w-4 h-4" /> Trading Plan Saved!
            </span>
          )}
          <button
            id="save-trading-plan-btn"
            type="submit"
            className="px-6 py-3 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Trading Plan
          </button>
        </div>
      </form>
    </div>
  );
};
