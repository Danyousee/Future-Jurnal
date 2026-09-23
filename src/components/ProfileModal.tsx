import React from 'react';
import { 
  X, 
  User, 
  Award, 
  ShieldCheck, 
  BarChart2, 
  DollarSign, 
  Calendar 
} from 'lucide-react';
import { TradingPlan } from '../types';
import { formatCurrency } from '../utils/calculator';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: TradingPlan;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  plan,
  totalTrades,
  winRate,
  totalPnl,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1565ff] text-white flex items-center justify-center font-bold shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900">Perpetual Futures Trader</h3>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-blue-100 text-[#1565ff]">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">ID: RC-PRO-SECURE</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Stats */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                <DollarSign className="w-3.5 h-3.5 text-[#1565ff]" />
                Starting Capital
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                {formatCurrency(plan.startingCapital || 10000)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                Win Rate
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                {winRate.toFixed(1)}%
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                Trades Recorded
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                {totalTrades} Trades
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-0.5">
                <Award className="w-3.5 h-3.5 text-indigo-500" />
                Cumulative P&L
              </div>
              <div className={`text-base sm:text-lg font-black font-mono ${totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
              </div>
            </div>
          </div>

          {/* Risk Profile Card */}
          <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#1565ff]" />
                Enforced Trading Plan
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                Active & Monitored
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Max Risk Per Trade:</span>
                <span className="font-bold text-slate-900 font-mono">{plan.maxRiskPerTrade}%</span>
              </div>
              <div className="flex justify-between">
                <span>Max Leverage:</span>
                <span className="font-bold text-slate-900 font-mono">{plan.maxLeverage}x</span>
              </div>
              <div className="flex justify-between">
                <span>Max Daily Loss:</span>
                <span className="font-bold text-slate-900 font-mono">{plan.maxDailyLossPct || plan.maxDailyLossPercent || 3}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
