import React from 'react';
import { 
  X, 
  Bell, 
  ShieldCheck, 
  Wifi, 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { TradingPlan } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  killSwitchActive: boolean;
  isOnline: boolean;
  plan: TradingPlan;
  totalTrades: number;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  killSwitchActive,
  isOnline,
  plan,
  totalTrades,
}) => {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 'gate-status',
      title: 'Pre-Trade Risk Gate Armed',
      desc: `Enforcing max ${plan.maxRiskPerTrade}% risk per trade and max ${plan.maxLeverage}x leverage.`,
      time: 'Real-time',
      type: 'info',
      icon: ShieldCheck,
      color: 'text-[#1565ff] bg-blue-50 border-blue-200',
    },
    {
      id: 'storage-sync',
      title: isOnline ? 'Cloud / Local Storage Synced' : 'Offline Mode Active',
      desc: isOnline 
        ? 'All trades, plan updates, and open positions are persistently saved to IndexedDB.' 
        : 'Network offline. All changes are queued and stored locally.',
      time: 'Live',
      type: isOnline ? 'success' : 'warning',
      icon: isOnline ? Wifi : AlertTriangle,
      color: isOnline ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      id: 'killswitch-status',
      title: killSwitchActive ? 'Kill Switch Active' : 'Daily Risk Limits Monitored',
      desc: killSwitchActive 
        ? `Daily loss threshold (${plan.maxDailyLossPct || plan.maxDailyLossPercent || 3}%) reached. Trade execution locked.` 
        : `Kill switch armed for max ${plan.maxDailyLossPct || plan.maxDailyLossPercent || 3}% daily loss allowance.`,
      time: 'Today',
      type: killSwitchActive ? 'danger' : 'info',
      icon: Flame,
      color: killSwitchActive ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'journal-status',
      title: 'Trading Journal Activity',
      desc: `${totalTrades} total trade records logged in persistent history.`,
      time: 'Recorded',
      type: 'info',
      icon: CheckCircle2,
      color: 'text-slate-600 bg-slate-50 border-slate-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1565ff] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Notifications & Alerts</h3>
              <p className="text-[10px] text-slate-500 font-medium">Risk rules and application telemetry</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {notifications.map((n) => {
            const Icon = n.icon;
            return (
              <div 
                key={n.id}
                className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors ${n.color}`}
              >
                <div className="p-1.5 rounded-xl bg-white/80 shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-xs font-bold truncate text-slate-900">{n.title}</span>
                    <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {n.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{n.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Close Notifications
          </button>
        </div>
      </div>
    </div>
  );
};
