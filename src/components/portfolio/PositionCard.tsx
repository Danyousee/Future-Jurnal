import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  ShieldAlert, 
  Trash2, 
  CheckCircle, 
  Edit3, 
  ChevronRight, 
  Zap,
  Globe,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { EnrichedPosition } from '../../utils/risk/positionManager';
import { formatCurrency, formatNumber } from '../../utils/calculator';

interface PositionCardProps {
  position: EnrichedPosition;
  onUpdatePrice: (posId: number, newPrice: number) => void;
  onClosePosition: (pos: EnrichedPosition) => void;
  onDeletePosition: (posId: number) => void;
}

// Helper for human-readable price freshness
function formatSecondsAgo(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Manual';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `Updated ${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onUpdatePrice,
  onClosePosition,
  onDeletePosition,
}) => {
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [inputPrice, setInputPrice] = useState(String(position.currentPrice || position.entryPrice));

  const isLong = position.direction === 'LONG';
  const mode = position.tradeMode || (position.leverage > 1 ? 'PERPETUAL' : 'SPOT');
  const isDex = position.spotVenue === 'DEX' || mode === 'DEX';
  const isForex = mode === 'FOREX';
  const isProfitable = position.netPnl >= 0;

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(inputPrice);
    if (!isNaN(parsed) && parsed > 0 && position.id) {
      onUpdatePrice(position.id, parsed);
      setIsEditingPrice(false);
    }
  };

  const handleBumpPrice = (deltaPct: number) => {
    const current = position.currentPrice || position.entryPrice;
    const bumped = current * (1 + deltaPct / 100);
    setInputPrice(String(Number(bumped.toFixed(bumped < 1 ? 6 : 2))));
    if (position.id) {
      onUpdatePrice(position.id, bumped);
    }
  };

  return (
    <div 
      className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs hover:shadow-sm ${
        position.status === 'NEAR STOP' 
          ? 'border-rose-400 ring-2 ring-rose-400/20' 
          : position.status === 'NEAR TAKE PROFIT'
          ? 'border-emerald-400 ring-2 ring-emerald-400/20'
          : position.status === 'STOP HIT'
          ? 'border-rose-500 bg-rose-50/20'
          : position.status === 'TAKE PROFIT HIT'
          ? 'border-emerald-500 bg-emerald-50/20'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Header Row */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Direction Pill */}
          <span 
            className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider shrink-0 text-white ${
              isLong ? 'bg-[#22a65e]' : 'bg-[#ff3b4a]'
            }`}
          >
            {isLong ? 'LONG' : 'SHORT'}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 font-mono truncate">
                {position.pair}
              </h4>
              {/* Market Tag */}
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200/80 text-slate-700">
                {isDex ? 'SPOT · DEX' : isForex ? 'FOREX' : mode === 'SPOT' ? 'SPOT · CEX' : `${position.leverage}x PERP`}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {position.correlationGroup || 'General Beta'} • {position.exchange || (isDex ? position.dexProtocol || 'DEX' : 'CEX')}
            </div>
          </div>
        </div>

        {/* Status Badge & Price Source */}
        <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
          {/* Live / Reference / Manual price badge */}
          <span 
            className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1 border ${
              position.priceStatus === 'REFERENCE'
                ? 'bg-sky-50 text-sky-800 border-sky-300'
                : position.priceStatus === 'UNAVAILABLE'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : position.priceStatus === 'LIVE' && !position.isStale
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : position.isStale || position.priceStatus === 'STALE'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              position.priceStatus === 'REFERENCE'
                ? 'bg-sky-500'
                : position.priceStatus === 'UNAVAILABLE'
                ? 'bg-rose-400'
                : position.priceStatus === 'LIVE' && !position.isStale
                ? 'bg-[#22a65e] animate-ping'
                : position.isStale || position.priceStatus === 'STALE'
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`} />
            <span>
              {position.priceStatus === 'REFERENCE'
                ? 'Reference Rate'
                : position.priceStatus === 'UNAVAILABLE'
                ? 'Price Unavailable'
                : position.priceStatus === 'LIVE' && !position.isStale
                ? 'Live'
                : (position.isStale || position.priceStatus === 'STALE')
                ? 'Stale Feed'
                : 'Manual'}
            </span>
          </span>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
              position.status === 'STOP HIT'
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : position.status === 'TAKE PROFIT HIT'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : position.status === 'NEAR STOP'
                ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                : position.status === 'NEAR TAKE PROFIT'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'
                : position.status === 'PROFITABLE'
                ? 'bg-emerald-50 text-[#22a65e] border-emerald-200'
                : position.status === 'LOSING'
                ? 'bg-rose-50 text-[#ff3b4a] border-rose-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {position.statusBadge}
          </span>
        </div>
      </div>

      {/* Critical Alert Banners */}
      {position.status === 'STOP HIT' && (
        <div className="px-4 py-2 bg-rose-500 text-white flex items-center justify-between text-xs font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>STOP LOSS TRIGGERED: Current price crossed SL (${formatNumber(position.stopLoss)}). Close to lock loss limit.</span>
          </div>
          <button
            type="button"
            onClick={() => onClosePosition(position)}
            className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-extrabold cursor-pointer shrink-0 ml-2"
          >
            Close Now
          </button>
        </div>
      )}

      {position.status === 'TAKE PROFIT HIT' && (
        <div className="px-4 py-2 bg-[#22a65e] text-white flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>TAKE PROFIT HIT: Target reached (${formatNumber(position.takeProfit || 0)})! Harvest realized profits.</span>
          </div>
          <button
            type="button"
            onClick={() => onClosePosition(position)}
            className="px-2.5 py-1 bg-white text-emerald-800 hover:bg-emerald-50 rounded-lg text-[11px] font-extrabold cursor-pointer shrink-0 ml-2"
          >
            Lock Gains
          </button>
        </div>
      )}

      {/* Main Stats Body */}
      <div className="p-4 space-y-3.5 text-xs">
        {/* PnL & R-Multiple Highlight */}
        <div className="flex items-baseline justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">
              Net P/L (after fees)
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-lg font-black font-mono tracking-tight ${
                isProfitable ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
              }`}>
                {isProfitable ? '+' : ''}{formatCurrency(position.netPnl)}
              </span>
              <span className={`text-xs font-bold ${
                isProfitable ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
              }`}>
                ({isProfitable ? '+' : ''}{position.netPnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">
              Current R-Multiple
            </span>
            <div className={`text-lg font-black font-mono mt-0.5 ${
              position.currentRMultiple >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
            }`}>
              {position.currentRMultiple >= 0 ? '+' : ''}{position.currentRMultiple.toFixed(2)}R
            </div>
          </div>
        </div>

        {/* Key Price Levels & Mark Price Editor */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {/* Entry Price */}
          <div className="bg-slate-50/60 p-2 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-medium block">Entry Price</span>
            <span className="font-mono font-bold text-slate-800 text-xs">
              ${formatNumber(position.entryPrice)}
            </span>
          </div>

          {/* Current / Mark Price with Inline Edit */}
          <div className="bg-blue-50/40 p-2 rounded-xl border border-blue-200/70 col-span-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#1565ff] font-bold block">Current Mark Price</span>
              {!isEditingPrice && (
                <button
                  type="button"
                  onClick={() => {
                    setInputPrice(String(position.currentPrice || position.entryPrice));
                    setIsEditingPrice(true);
                  }}
                  className="text-[10px] text-[#1565ff] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Update</span>
                </button>
              )}
            </div>

            {isEditingPrice ? (
              <form onSubmit={handlePriceSubmit} className="flex items-center gap-1.5 mt-1">
                <input
                  type="number"
                  step="any"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-blue-400 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-[#1565ff] text-white text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingPrice(false)}
                  className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </form>
            ) : (
              <div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono font-extrabold text-[#1565ff] text-xs">
                    ${formatNumber(position.currentPrice || position.entryPrice)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleBumpPrice(-0.5)}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] font-bold cursor-pointer"
                      title="Lower mark price by 0.5%"
                    >
                      -0.5%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBumpPrice(0.5)}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] font-bold cursor-pointer"
                      title="Raise mark price by 0.5%"
                    >
                      +0.5%
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 border-t border-blue-100/80 pt-1">
                  <span className="truncate max-w-[130px] font-medium" title={position.priceSource || ''}>
                    {position.priceSource || (position.isPriceLive ? 'Live Feed' : 'Manual Price')}
                  </span>
                  <span className="font-mono text-slate-600">
                    {formatSecondsAgo(position.latestPriceTimestamp)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stop Loss & Take Profit Cards */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-200/80">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-rose-900">Stop-Loss</span>
              <span className="text-rose-700 font-mono">
                {position.distanceToStopLossPct.toFixed(1)}% away
              </span>
            </div>
            <div className="font-mono font-bold text-rose-950 mt-0.5">
              ${formatNumber(position.stopLoss)}
            </div>
            <div className="text-[10px] text-rose-700 font-medium mt-0.5">
              Risk: {formatCurrency(position.riskAmount)} ({position.riskPct.toFixed(1)}%)
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-emerald-900">Take-Profit</span>
              <span className="text-emerald-700 font-mono">
                {position.distanceToTakeProfitPct ? `${position.distanceToTakeProfitPct.toFixed(1)}% away` : 'Open'}
              </span>
            </div>
            <div className="font-mono font-bold text-emerald-950 mt-0.5">
              {position.takeProfit ? `$${formatNumber(position.takeProfit)}` : 'Discretionary'}
            </div>
            <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
              Target: {position.takeProfit ? formatCurrency(Math.abs(position.takeProfit - position.entryPrice) * (position.quantity || 1)) : 'Trailing'}
            </div>
          </div>
        </div>

        {/* Target Progress Bar */}
        {position.takeProfit && position.takeProfit > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>Progress to Take-Profit</span>
              <span className="font-mono font-bold text-slate-700">
                {(position.progressToTargetPct || 0).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#22a65e] rounded-full transition-all duration-300"
                style={{ width: `${position.progressToTargetPct || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Market-Specific Details */}
        <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div>
            Size: <span className="font-mono font-bold text-slate-800">{formatCurrency(position.positionSize)}</span>
            <span className="mx-1">•</span>
            Margin: <span className="font-mono font-bold text-slate-800">{formatCurrency(position.margin || position.positionSize)}</span>
          </div>

          {/* Perpetual Liquidation Buffer */}
          {position.liquidationPrice && position.liquidationPrice > 0 && (
            <div className="flex items-center gap-1 font-mono">
              <span>Liq: ${formatNumber(position.liquidationPrice)}</span>
              <span className={`font-bold ${
                (position.distanceToLiquidationPct || 10) < 5 ? 'text-[#ff3b4a]' : 'text-slate-600'
              }`}>
                ({(position.distanceToLiquidationPct || 0).toFixed(1)}% buffer)
              </span>
            </div>
          )}

          {/* Forex Lots */}
          {isForex && position.lotSize && (
            <div className="font-mono font-medium text-slate-600">
              {position.lotSize.toFixed(2)} Standard Lots
            </div>
          )}

          {/* DEX Gas & Protocol */}
          {isDex && (
            <div className="flex items-center gap-1 text-slate-600">
              <span>{position.dexChain || 'EVM'}</span>
              <span>•</span>
              <span>Gas: ${position.dexGasFee || 5}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => position.id && onDeletePosition(position.id)}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
          title="Remove from portfolio tracking"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onClosePosition(position)}
          className="flex-1 max-w-[200px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Close & Journal</span>
        </button>
      </div>
    </div>
  );
};
