import React from 'react';
import { X, HelpCircle, Shield, Calculator, Lock, CheckCircle2 } from 'lucide-react';

interface HelpAboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpAboutModal: React.FC<HelpAboutModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1565ff] flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">About RiskCalc PRO</h3>
              <p className="text-[10px] text-slate-500 font-medium">Institutional Risk Engine v2.4</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs text-slate-600 max-h-[65vh] overflow-y-auto leading-relaxed">
          <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Calculator className="w-3.5 h-3.5 text-[#1565ff]" />
              Exact Futures Position Sizing
            </h4>
            <p className="text-[11px] text-slate-600">
              Position size is calculated strictly from account balance, risk tolerance percentage, and stop-loss distance, accounting for round-trip taker fees and slippage impact.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Rule Gate & Kill Switch
            </h4>
            <p className="text-[11px] text-slate-600">
              Protects capital from emotional revenge trading by validating maximum allowable risk, maximum leverage, minimum R:R ratio, and automated daily loss circuit breakers.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              100% Local & Private Persistence
            </h4>
            <p className="text-[11px] text-slate-600">
              All trades, journal logs, and custom rules are saved securely in your browser's IndexedDB. Your trading data never leaves your device.
            </p>
          </div>

          <div className="pt-2 text-center text-[10px] text-slate-400">
            RiskCalc PRO • Crypto Perpetual Futures Position Sizer
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
