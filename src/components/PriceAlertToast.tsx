import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Target, 
  Volume2, 
  VolumeX,
  Clock,
  ArrowRight
} from 'lucide-react';
import { priceAlertService, AlertTriggerEvent } from '../services/priceAlertService';

interface PriceAlertToastProps {
  onNavigateToCalculator?: (pair?: string) => void;
}

export const PriceAlertToast: React.FC<PriceAlertToastProps> = ({ onNavigateToCalculator }) => {
  const [activeAlerts, setActiveAlerts] = useState<AlertTriggerEvent[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const unsubscribe = priceAlertService.onTrigger((event) => {
      setActiveAlerts((prev) => [event, ...prev.slice(0, 3)]); // Keep up to 4 most recent

      // Auto dismiss after 14 seconds
      const timer = setTimeout(() => {
        setActiveAlerts((current) => current.filter((item) => item.alert.id !== event.alert.id));
      }, 14000);

      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (activeAlerts.length === 0) return null;

  const handleDismiss = (id: string) => {
    setActiveAlerts((prev) => prev.filter((item) => item.alert.id !== id));
  };

  const handleSnooze = (id: string) => {
    priceAlertService.toggleAlert(id, false);
    handleDismiss(id);
    // Re-arm in 5 minutes
    setTimeout(() => {
      priceAlertService.rearmAlert(id);
    }, 5 * 60 * 1000);
  };

  return (
    <div className="fixed top-4 right-3 sm:right-5 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none">
      {activeAlerts.map((event) => {
        const { alert, currentPrice, distancePct } = event;
        const isStopLoss = alert.targetType === 'STOP_LOSS';
        const isTakeProfit = alert.targetType === 'TAKE_PROFIT';
        const isEntry = alert.targetType === 'ENTRY';

        const borderColor = isStopLoss 
          ? 'border-red-500/80 bg-slate-900/95 shadow-red-500/20' 
          : isTakeProfit 
          ? 'border-emerald-500/80 bg-slate-900/95 shadow-emerald-500/20' 
          : 'border-blue-500/80 bg-slate-900/95 shadow-blue-500/20';

        const badgeColor = isStopLoss
          ? 'bg-red-500/20 text-red-300 border-red-500/30'
          : isTakeProfit
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

        const Icon = isStopLoss ? ShieldAlert : isTakeProfit ? Target : Bell;

        return (
          <div
            key={`${alert.id}-${event.timestamp}`}
            className={`pointer-events-auto rounded-2xl border p-4 shadow-xl backdrop-blur-md text-white transition-all transform animate-in slide-in-from-top-4 fade-in duration-300 ${borderColor}`}
            role="alert"
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${badgeColor}`}>
                  <Icon className="w-4 h-4 animate-bounce" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm tracking-wide text-white">{alert.pair}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badgeColor}`}>
                      {priceAlertService.formatTargetLabel(alert.targetType)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Just now • {alert.tradeMode}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? 'Alert sounds muted' : 'Alert sound active'}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-blue-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(alert.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Dismiss alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Price Distance & Status */}
            <div className="bg-slate-800/80 rounded-xl p-2.5 mb-2.5 border border-slate-700/60 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Current Price</span>
                <span className="font-mono font-bold text-sm text-white">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Target Price</span>
                <span className="font-mono font-bold text-sm text-amber-300">
                  ${alert.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </span>
              </div>
              <div className="text-right pl-2 border-l border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Distance</span>
                <span className="font-mono font-extrabold text-xs text-blue-400">
                  {distancePct.toFixed(2)}%
                </span>
              </div>
            </div>

            {alert.note && (
              <p className="text-[11px] text-slate-300 italic mb-2 px-1">
                "{alert.note}"
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => handleSnooze(alert.id)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Snooze 5m
              </button>
              {onNavigateToCalculator && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToCalculator(alert.pair);
                    handleDismiss(alert.id);
                  }}
                  className="px-3 py-1 bg-[#1565ff] hover:bg-[#0051e6] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <span>Open Calculator</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
