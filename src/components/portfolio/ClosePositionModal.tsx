import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Scale, 
  FileText, 
  Smile, 
  Star,
  Clock,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { OpenPosition, TradeJournalEntry } from '../../types';
import { EnrichedPosition, closeAndArchiveOpenPosition } from '../../utils/risk/positionManager';
import { formatCurrency, formatNumber } from '../../utils/calculator';

interface ClosePositionModalProps {
  position: EnrichedPosition;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (archivedTrade: TradeJournalEntry) => void;
}

const EXIT_REASONS = [
  'Take Profit Target Hit',
  'Stop Loss Hit',
  'Trailing Stop Triggered',
  'Discretionary Profit Taking',
  'Discretionary Loss Cut',
  'Technical Invalidation / Market Reversal',
  'Risk Management / Portfolio Rebalance',
  'Breakeven Protection Triggered',
  'Macro Event / High Volatility De-risking',
  'Time-based Exit / Weekend Close',
];

const EMOTIONS = [
  { value: 'CALM', label: '😌 Calm / Objective' },
  { value: 'CONFIDENT', label: '😎 Confident' },
  { value: 'ANXIOUS', label: '😰 Anxious / Relieved' },
  { value: 'FRUSTRATED', label: '😤 Frustrated' },
  { value: 'REGRETFUL', label: '😔 Regretful (Exited Early/Late)' },
  { value: 'NEUTRAL', label: '😐 Neutral' },
];

export const ClosePositionModal: React.FC<ClosePositionModalProps> = ({
  position,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const defaultExitPrice = position.currentPrice > 0 ? position.currentPrice : position.entryPrice;
  const [exitPrice, setExitPrice] = useState<number>(defaultExitPrice);
  const [exitDate, setExitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [actualFees, setActualFees] = useState<number>(position.totalFees || 0);
  const [slippageCost, setSlippageCost] = useState<number>(0);
  const [exitReason, setExitReason] = useState<string>(
    position.status === 'TAKE PROFIT HIT' 
      ? 'Take Profit Target Hit' 
      : position.status === 'STOP HIT' 
      ? 'Stop Loss Hit' 
      : 'Discretionary Profit Taking'
  );
  const [notes, setNotes] = useState<string>('');
  const [disciplineRating, setDisciplineRating] = useState<number>(5);
  const [emotionAfter, setEmotionAfter] = useState<string>('CALM');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real-time calculations based on chosen Exit Price
  const isLong = position.direction === 'LONG';
  const mode = position.tradeMode || (position.leverage > 1 ? 'PERPETUAL' : 'SPOT');
  const quantity = position.quantity || (position.entryPrice > 0 ? (position.positionSize / position.entryPrice) : 0);

  let grossPnl = 0;
  if (mode === 'FOREX') {
    const pipSize = position.pipSize || (position.pair.includes('JPY') ? 0.01 : 0.0001);
    const pipValue = position.pipValue || 10;
    const lotSize = position.lotSize || (position.positionSize / 100000);
    const pipsChange = isLong 
      ? (exitPrice - position.entryPrice) / pipSize 
      : (position.entryPrice - exitPrice) / pipSize;
    grossPnl = pipsChange * pipValue * lotSize;
  } else {
    if (isLong) {
      grossPnl = (exitPrice - position.entryPrice) * quantity;
    } else {
      grossPnl = (position.entryPrice - exitPrice) * quantity;
    }
  }

  const netPnl = grossPnl - actualFees - slippageCost;
  const capitalBase = position.margin > 0 ? position.margin : (position.positionSize || 1);
  const pnlPct = (netPnl / capitalBase) * 100;
  const actualR = position.riskAmount > 0 ? Number((netPnl / position.riskAmount).toFixed(2)) : 0;
  const isWin = netPnl > 0;

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position.id) {
      setErrorMsg('Position ID is missing.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const archivedTrade = await closeAndArchiveOpenPosition({
        positionId: position.id,
        exitPrice,
        exitDate,
        actualFees,
        slippageCost,
        exitReason,
        notes,
        emotionAfter,
        disciplineRating,
      });

      onSuccess(archivedTrade);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to archive and close position.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white ${
              position.direction === 'LONG' ? 'bg-[#22a65e]' : 'bg-[#ff3b4a]'
            }`}>
              {position.direction === 'LONG' ? 'L' : 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 font-mono">
                  Close & Journal {position.pair}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
                  {mode}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Entry: ${formatNumber(position.entryPrice)} • Planned Risk: {formatCurrency(position.riskAmount)} ({position.riskPct.toFixed(1)}%)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleConfirmClose} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Real-time Exit Performance Card */}
          <div className={`p-4 rounded-2xl border ${
            isWin ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-600">
                Realized Trade Outcome
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                isWin ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
              }`}>
                {isWin ? 'WINNING TRADE' : 'LOSING TRADE'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Net Realized P&L</span>
                <span className={`text-lg font-black font-mono block ${isWin ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                  {netPnl >= 0 ? '+' : ''}{formatCurrency(netPnl)}
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% on margin
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Realized R-Multiple</span>
                <span className={`text-lg font-black font-mono block ${actualR >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                  {actualR >= 0 ? '+' : ''}{actualR.toFixed(2)}R
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  vs Target: {position.takeProfit ? `${((position.takeProfit - position.entryPrice) / (position.entryPrice - position.stopLoss) * (isLong ? 1 : -1)).toFixed(1)}R` : 'Open'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Total Trade Fees</span>
                <span className="text-lg font-black font-mono text-slate-800 block">
                  {formatCurrency(actualFees + slippageCost)}
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  Gross: {formatCurrency(grossPnl)}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing & Execution Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Actual Exit Price ($) <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="any"
                  value={exitPrice || ''}
                  onChange={(e) => setExitPrice(parseFloat(e.target.value) || 0)}
                  required
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
                />
                {position.currentPrice > 0 && (
                  <button
                    type="button"
                    onClick={() => setExitPrice(position.currentPrice)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1565ff] border border-blue-200 rounded-xl font-bold text-[11px] cursor-pointer shrink-0"
                    title={`Fill current mark price ($${formatNumber(position.currentPrice)})`}
                  >
                    Mark
                  </button>
                )}
                {position.takeProfit && (
                  <button
                    type="button"
                    onClick={() => setExitPrice(position.takeProfit!)}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#22a65e] border border-emerald-200 rounded-xl font-bold text-[11px] cursor-pointer shrink-0"
                    title="Fill Take-Profit price"
                  >
                    TP
                  </button>
                )}
                {position.stopLoss && (
                  <button
                    type="button"
                    onClick={() => setExitPrice(position.stopLoss)}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#ff3b4a] border border-rose-200 rounded-xl font-bold text-[11px] cursor-pointer shrink-0"
                    title="Fill Stop-Loss price"
                  >
                    SL
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                <span>Mark Price: ${formatNumber(position.currentPrice || position.entryPrice)}</span>
                <span className={`font-semibold ${
                  position.priceStatus === 'REFERENCE'
                    ? 'text-sky-600'
                    : position.priceStatus === 'UNAVAILABLE'
                    ? 'text-rose-500'
                    : position.isPriceLive && !position.isStale
                    ? 'text-emerald-600'
                    : 'text-slate-500'
                }`}>
                  {position.priceStatus === 'REFERENCE'
                    ? 'ECB Reference Rate'
                    : position.priceStatus === 'UNAVAILABLE'
                    ? 'Live DEX Price Unavailable'
                    : position.isPriceLive
                    ? (position.isStale ? `${position.priceSource || 'Live Feed'} (Stale)` : (position.priceSource || 'Live Feed'))
                    : (position.priceSource || 'Manual Price')}
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Exit Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Total Fees Paid ($)
              </label>
              <input
                type="number"
                step="any"
                value={actualFees || ''}
                onChange={(e) => setActualFees(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Slippage / Spread Cost ($)
              </label>
              <input
                type="number"
                step="any"
                value={slippageCost || ''}
                onChange={(e) => setSlippageCost(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
              />
            </div>
          </div>

          {/* Exit Reason & Notes */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Primary Exit Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
            >
              {EXIT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Discipline & Emotion Evaluation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Discipline Rating: {disciplineRating} / 5 Stars
              </label>
              <div className="flex items-center gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-xl">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setDisciplineRating(star)}
                    className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      disciplineRating >= star ? 'text-amber-500 bg-amber-50' : 'text-slate-300'
                    }`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Post-Trade Emotion
              </label>
              <select
                value={emotionAfter}
                onChange={(e) => setEmotionAfter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
              >
                {EMOTIONS.map((emo) => (
                  <option key={emo.value} value={emo.value}>
                    {emo.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Closing Trade Notes & Lessons Learned
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What went well? Did you follow your risk rule? What can be improved next time?"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#1565ff] focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-sm flex items-center gap-2 cursor-pointer transition-all ${
                isWin 
                  ? 'bg-[#22a65e] hover:bg-[#1b854b]' 
                  : 'bg-[#ff3b4a] hover:bg-[#e02d3c]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Archiving...' : 'Confirm & Save to Journal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
