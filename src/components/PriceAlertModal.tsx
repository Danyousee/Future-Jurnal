import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  BellRing, 
  ShieldAlert, 
  Target, 
  Plus, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Check, 
  AlertCircle, 
  Zap, 
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { 
  PriceAlert, 
  PriceAlertTargetType, 
  PriceAlertCondition, 
  TradingMode, 
  SpotVenue 
} from '../types';
import { 
  priceAlertService, 
  requestBrowserNotificationPermission, 
  getBrowserNotificationPermission,
  NotificationPermissionState
} from '../services/priceAlertService';
import { formatNumber } from '../utils/calculator';

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPair: string;
  tradingMode: TradingMode;
  spotVenue?: SpotVenue;
  entryPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  currentLivePrice?: number;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  isOpen,
  onClose,
  currentPair,
  tradingMode,
  spotVenue,
  entryPrice = 0,
  stopLossPrice = 0,
  takeProfitPrice = 0,
  currentLivePrice = 0,
}) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [permission, setPermission] = useState<NotificationPermissionState>(getBrowserNotificationPermission());
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);

  // New alert form state
  const [selectedTarget, setSelectedTarget] = useState<PriceAlertTargetType>('ENTRY');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [proximityPct, setProximityPct] = useState<number>(0.5);
  const [condition, setCondition] = useState<PriceAlertCondition>('APPROACHING');
  const [note, setNote] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [filterPairOnly, setFilterPairOnly] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load and subscribe to alerts
  useEffect(() => {
    const unsubscribe = priceAlertService.subscribe((updated) => {
      setAlerts(updated);
    });
    setPermission(getBrowserNotificationPermission());
    return () => {
      unsubscribe();
    };
  }, []);

  // Update permission on open
  useEffect(() => {
    if (isOpen) {
      setPermission(getBrowserNotificationPermission());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    setIsRequestingPerm(true);
    try {
      const res = await requestBrowserNotificationPermission();
      setPermission(res);
      if (res === 'granted') {
        priceAlertService.testNotification();
        setSuccessToast('Browser notifications enabled successfully!');
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } finally {
      setIsRequestingPerm(false);
    }
  };

  const handleTestAlert = () => {
    priceAlertService.testNotification();
    setSuccessToast('Test notification sent with audio chime!');
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Determine target price based on selected target type
  const resolvedTargetPrice = 
    selectedTarget === 'ENTRY' ? entryPrice :
    selectedTarget === 'STOP_LOSS' ? stopLossPrice :
    selectedTarget === 'TAKE_PROFIT' ? takeProfitPrice :
    parseFloat(customPrice) || 0;

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolvedTargetPrice <= 0) {
      alert('Please enter or select a valid target price greater than 0.');
      return;
    }

    priceAlertService.addAlert({
      pair: currentPair,
      tradeMode: tradingMode,
      spotVenue,
      targetType: selectedTarget,
      targetPrice: resolvedTargetPrice,
      proximityPct,
      condition,
      note: note.trim() || undefined,
      initialPrice: currentLivePrice > 0 ? currentLivePrice : resolvedTargetPrice,
      soundEnabled,
    });

    setSuccessToast(`Price alert armed for ${currentPair} at $${formatNumber(resolvedTargetPrice)}!`);
    setTimeout(() => setSuccessToast(null), 3500);

    // Reset optional note
    setNote('');
  };

  const displayedAlerts = filterPairOnly 
    ? alerts.filter(a => a.pair.toUpperCase() === currentPair.toUpperCase()) 
    : alerts;

  const activeCount = alerts.filter(a => a.isActive && !a.isTriggered).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1565ff] flex items-center justify-center shadow-xs">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Price Alerts & Notification Engine</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1565ff]/10 text-[#1565ff]">
                  {activeCount} Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Monitor entry & exit triggers with Web Browser Notifications and audio chimes
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSuccessToast(null)} 
              className="text-emerald-100 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Permission Status Banner */}
          <div className="p-3.5 rounded-2xl border bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-slate-200">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                permission === 'granted' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : permission === 'denied' 
                  ? 'bg-rose-100 text-rose-700' 
                  : 'bg-blue-100 text-[#1565ff]'
              }`}>
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Browser Notifications: 
                  </span>
                  <span className={`text-[11px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    permission === 'granted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : permission === 'denied'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Action Required'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {permission === 'granted' 
                    ? 'Operating in background. You will receive native OS notifications when prices approach.'
                    : permission === 'denied'
                    ? 'Notifications are blocked in your browser settings. In-app floating alerts & audio chimes remain active.'
                    : 'Grant browser notification permission to get alerted when looking at other tabs.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {permission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  disabled={isRequestingPerm}
                  className="px-3 py-1.5 bg-[#1565ff] hover:bg-[#0c53dc] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isRequestingPerm ? 'Requesting...' : 'Allow Notifications'}
                </button>
              )}
              <button
                type="button"
                onClick={handleTestAlert}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                Test Sound & Alert
              </button>
            </div>
          </div>

          {/* Quick Arm Form for Current Pair */}
          <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Arm Alert for {currentPair}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {tradingMode}
                </span>
              </div>
              {currentLivePrice > 0 && (
                <span className="text-xs font-mono font-bold text-slate-600">
                  Live: ${formatNumber(currentLivePrice)}
                </span>
              )}
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-4">
              {/* Target Type Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Select Target Trigger
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTarget('ENTRY')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTarget === 'ENTRY'
                        ? 'bg-blue-50 border-[#1565ff] ring-1 ring-[#1565ff] text-[#1565ff]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Entry Price</span>
                      <Target className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-mono font-bold text-xs block text-slate-900 truncate">
                      {entryPrice > 0 ? `$${formatNumber(entryPrice)}` : 'Not Set'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTarget('STOP_LOSS')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTarget === 'STOP_LOSS'
                        ? 'bg-red-50 border-red-500 ring-1 ring-red-500 text-red-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Stop Loss</span>
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-mono font-bold text-xs block text-slate-900 truncate">
                      {stopLossPrice > 0 ? `$${formatNumber(stopLossPrice)}` : 'Not Set'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTarget('TAKE_PROFIT')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTarget === 'TAKE_PROFIT'
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 text-emerald-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Take Profit</span>
                      <Target className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-mono font-bold text-xs block text-slate-900 truncate">
                      {takeProfitPrice > 0 ? `$${formatNumber(takeProfitPrice)}` : 'Not Set'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTarget('CUSTOM')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTarget === 'CUSTOM'
                        ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500 text-purple-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Custom Target</span>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-mono font-bold text-xs block text-slate-900 truncate">
                      {customPrice ? `$${customPrice}` : 'Manual Price'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Custom Price Input if CUSTOM is active */}
              {selectedTarget === 'CUSTOM' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Custom Target Price ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Enter exact target price..."
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1565ff]"
                  />
                </div>
              )}

              {/* Proximity Tolerance & Trigger Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Proximity Notification Trigger
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: '0.25%', val: 0.25 },
                      { label: '0.5%', val: 0.5 },
                      { label: '1.0%', val: 1.0 },
                      { label: '2.0%', val: 2.0 },
                      { label: 'Exact (0.05%)', val: 0.05 },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setProximityPct(item.val)}
                        className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          proximityPct === item.val
                            ? 'bg-[#1565ff] text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Notifies when live price is within {proximityPct}% of target
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Alert Condition Rule
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as PriceAlertCondition)}
                    className="w-full h-8 bg-white border border-slate-200 rounded-xl px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                  >
                    <option value="APPROACHING">Approaching Target (Within Tolerance)</option>
                    <option value="AT_OR_ABOVE">Touches or Crosses Above Target (≥)</option>
                    <option value="AT_OR_BELOW">Touches or Drops Below Target (≤)</option>
                  </select>
                </div>
              </div>

              {/* Optional Note & Audio Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Alert Tag / Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ready to enter swing long, lock profits..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full h-8 bg-white border border-slate-200 rounded-xl px-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1565ff]"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 h-8">
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {soundEnabled ? (
                      <>
                        <Volume2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Audio On</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-400">Audio Muted</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={resolvedTargetPrice <= 0}
                    className="px-4 h-8 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Arm Alert</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Active Alerts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Active Price Watchers ({displayedAlerts.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setFilterPairOnly(!filterPairOnly)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    filterPairOnly
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filterPairOnly ? `Showing ${currentPair} only` : 'Show All Pairs'}
                </button>
              </div>

              {displayedAlerts.some(a => a.isTriggered) && (
                <button
                  type="button"
                  onClick={() => priceAlertService.clearAllTriggered()}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors"
                >
                  Clear Triggered
                </button>
              )}
            </div>

            {displayedAlerts.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No price alerts armed for this pair</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use the quick targets above to arm instant entry, stop loss, or take profit watchers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedAlerts.map((alert) => {
                  const isStopLoss = alert.targetType === 'STOP_LOSS';
                  const isTakeProfit = alert.targetType === 'TAKE_PROFIT';
                  const isEntry = alert.targetType === 'ENTRY';

                  const badgeClass = isStopLoss
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : isTakeProfit
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200';

                  const distance = alert.lastCheckedPrice && alert.lastCheckedPrice > 0
                    ? ((Math.abs(alert.lastCheckedPrice - alert.targetPrice) / alert.targetPrice) * 100).toFixed(2)
                    : null;

                  return (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        alert.isTriggered
                          ? 'bg-amber-50/70 border-amber-200 ring-1 ring-amber-300'
                          : alert.isActive
                          ? 'bg-white border-slate-200 hover:border-slate-300'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border shrink-0 ${badgeClass}`}>
                          {isStopLoss ? <ShieldAlert className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-slate-900 font-mono">
                              {alert.pair}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${badgeClass}`}>
                              {priceAlertService.formatTargetLabel(alert.targetType)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {alert.tradeMode}
                            </span>
                            {alert.isTriggered && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 uppercase">
                                Triggered
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                            <span>Target: <strong className="text-slate-900">${formatNumber(alert.targetPrice)}</strong></span>
                            {alert.lastCheckedPrice && alert.lastCheckedPrice > 0 && (
                              <>
                                <span>•</span>
                                <span>Live: ${formatNumber(alert.lastCheckedPrice)}</span>
                                {distance && (
                                  <span className="font-bold text-[#1565ff]">({distance}% away)</span>
                                )}
                              </>
                            )}
                          </div>

                          {alert.note && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">
                              "{alert.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Row actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {alert.isTriggered ? (
                          <button
                            type="button"
                            onClick={() => priceAlertService.rearmAlert(alert.id)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Re-arm</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => priceAlertService.toggleAlert(alert.id)}
                            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                              alert.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {alert.isActive ? 'Active' : 'Paused'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => priceAlertService.deleteAlert(alert.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete alert"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            Alerts evaluate in real-time across crypto & forex feeds.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
