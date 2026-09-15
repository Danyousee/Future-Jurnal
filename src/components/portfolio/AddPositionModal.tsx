import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertTriangle,
  Plus
} from 'lucide-react';
import { 
  OpenPosition, 
  TradingMode, 
  TradeDirection, 
  SpotVenue, 
  Exchange 
} from '../../types';
import { formatCurrency, formatNumber } from '../../utils/calculator';

interface AddPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (position: OpenPosition) => Promise<void>;
  accountBalance: number;
}

const COMMON_PAIRS = {
  PERPETUAL: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT'],
  SPOT: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ADA/USDT', 'DOT/USDT'],
  FOREX: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'GBP/JPY'],
  DEX: ['PEPE', 'WIF', 'UNI', 'AAVE', 'PENDLE', 'JUP'],
};

const CORRELATION_GROUPS = [
  'BTC-Related',
  'Layer-1s',
  'Layer-2s / Rollups',
  'DeFi Bluechips',
  'Memes & High-Beta',
  'AI / DePIN',
  'Forex USD Majors',
  'Forex Crosses',
  'Commodities / Gold',
  'General Beta'
];

export const AddPositionModal: React.FC<AddPositionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  accountBalance,
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<TradingMode>('PERPETUAL');
  const [spotVenue, setSpotVenue] = useState<SpotVenue>('CEX');
  const [pair, setPair] = useState<string>('BTCUSDT');
  const [direction, setDirection] = useState<TradeDirection>('LONG');
  const [entryPrice, setEntryPrice] = useState<number>(65000);
  const [stopLoss, setStopLoss] = useState<number>(63500);
  const [takeProfit, setTakeProfit] = useState<number>(68000);
  const [leverage, setLeverage] = useState<number>(10);
  const [positionSize, setPositionSize] = useState<number>(10000);
  const [correlationGroup, setCorrelationGroup] = useState<string>('BTC-Related');
  const [exchange, setExchange] = useState<Exchange>('Binance');

  // Forex Specific
  const [lotSize, setLotSize] = useState<number>(1.0);

  // DEX Specific
  const [dexChain, setDexChain] = useState<string>('Ethereum');
  const [dexProtocol, setDexProtocol] = useState<string>('Uniswap');
  const [dexGasFee, setDexGasFee] = useState<number>(8.5);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-calculated values
  const effectiveLev = mode === 'SPOT' ? 1 : mode === 'FOREX' ? (leverage || 100) : leverage;
  const effectiveSize = mode === 'FOREX' ? lotSize * 100000 : positionSize;
  const margin = effectiveLev > 0 ? effectiveSize / effectiveLev : effectiveSize;
  const quantity = entryPrice > 0 ? effectiveSize / entryPrice : 0;

  let calculatedRiskAmount = 0;
  if (mode === 'FOREX') {
    const pipSize = pair.includes('JPY') ? 0.01 : 0.0001;
    const pipsRisk = Math.abs(entryPrice - stopLoss) / pipSize;
    calculatedRiskAmount = pipsRisk * 10 * lotSize;
  } else {
    calculatedRiskAmount = Math.abs(entryPrice - stopLoss) * quantity;
  }

  const calculatedRiskPct = accountBalance > 0 ? (calculatedRiskAmount / accountBalance) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const isDex = mode === 'SPOT' && spotVenue === 'DEX';

    const newPos: OpenPosition = {
      pair: pair.trim().toUpperCase(),
      tradeMode: mode,
      spotVenue: mode === 'SPOT' ? spotVenue : undefined,
      direction,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss,
      takeProfit: takeProfit > 0 ? takeProfit : undefined,
      quantity,
      positionSize: effectiveSize,
      margin,
      leverage: effectiveLev,
      riskAmount: calculatedRiskAmount,
      riskPct: calculatedRiskPct,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      correlationGroup,
      exchange: isDex ? 'Other' : exchange,
      createdAt: new Date().toISOString(),
      lotSize: mode === 'FOREX' ? lotSize : undefined,
      dexChain: isDex ? dexChain : undefined,
      dexProtocol: isDex ? dexProtocol : undefined,
      dexGasFee: isDex ? dexGasFee : undefined,
    };

    try {
      await onSave(newPos);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1565ff]/10 text-[#1565ff] rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Track Open Position
              </h3>
              <p className="text-xs text-slate-500">
                Add an existing active trade to portfolio risk monitoring
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Market Mode Tabs */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Market Type</label>
            <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('PERPETUAL');
                  setPair('BTCUSDT');
                  setEntryPrice(65000);
                  setStopLoss(63500);
                  setTakeProfit(68000);
                  setLeverage(10);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'PERPETUAL' ? 'bg-white text-[#1565ff] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Perpetual
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('SPOT');
                  setSpotVenue('CEX');
                  setPair('BTC/USDT');
                  setEntryPrice(65000);
                  setStopLoss(63500);
                  setTakeProfit(68000);
                  setLeverage(1);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'SPOT' && spotVenue === 'CEX' ? 'bg-white text-[#1565ff] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Spot (CEX)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('SPOT');
                  setSpotVenue('DEX');
                  setPair('PEPE');
                  setEntryPrice(0.000012);
                  setStopLoss(0.0000105);
                  setTakeProfit(0.000015);
                  setLeverage(1);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'SPOT' && spotVenue === 'DEX' ? 'bg-white text-[#1565ff] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                DEX Spot
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('FOREX');
                  setPair('EUR/USD');
                  setEntryPrice(1.0850);
                  setStopLoss(1.0825);
                  setTakeProfit(1.0900);
                  setLeverage(100);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'FOREX' ? 'bg-white text-[#1565ff] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Forex
              </button>
            </div>
          </div>

          {/* Symbol & Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Asset Pair / Symbol
              </label>
              <input
                type="text"
                value={pair}
                onChange={(e) => setPair(e.target.value.toUpperCase())}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Direction</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDirection('LONG')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    direction === 'LONG' ? 'bg-[#22a65e] text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SHORT')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    direction === 'SHORT' ? 'bg-[#ff3b4a] text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  SHORT
                </button>
              </div>
            </div>
          </div>

          {/* Price Levels */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Entry Price ($)</label>
              <input
                type="number"
                step="any"
                value={entryPrice || ''}
                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Stop-Loss ($)</label>
              <input
                type="number"
                step="any"
                value={stopLoss || ''}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-rose-700 focus:bg-white focus:border-[#1565ff] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Take-Profit ($)</label>
              <input
                type="number"
                step="any"
                value={takeProfit || ''}
                onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-700 focus:bg-white focus:border-[#1565ff] focus:outline-none"
              />
            </div>
          </div>

          {/* Sizing & Leverage */}
          <div className="grid grid-cols-2 gap-3">
            {mode === 'FOREX' ? (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Standard Lot Size</label>
                <input
                  type="number"
                  step="0.01"
                  value={lotSize || ''}
                  onChange={(e) => setLotSize(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Position Size ($ Notional)</label>
                <input
                  type="number"
                  step="any"
                  value={positionSize || ''}
                  onChange={(e) => setPositionSize(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
                />
              </div>
            )}

            {mode === 'PERPETUAL' ? (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Leverage (x)</label>
                <input
                  type="number"
                  min="1"
                  max="125"
                  value={leverage || ''}
                  onChange={(e) => setLeverage(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:border-[#1565ff] focus:outline-none"
                />
              </div>
            ) : mode === 'FOREX' ? (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Broker Leverage</label>
                <select
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                >
                  <option value="50">50:1 (US)</option>
                  <option value="100">100:1</option>
                  <option value="200">200:1</option>
                  <option value="500">500:1</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Exchange / Venue</label>
                <select
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value as Exchange)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                >
                  <option value="Binance">Binance</option>
                  <option value="Coinbase">Coinbase</option>
                  <option value="Bybit">Bybit</option>
                  <option value="OKX">OKX</option>
                  <option value="Kraken">Kraken</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}
          </div>

          {/* Correlation Group */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Correlation Risk Group</label>
            <select
              value={correlationGroup}
              onChange={(e) => setCorrelationGroup(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
            >
              {CORRELATION_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Live Risk Calculation Preview */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Margin Required</span>
              <span className="font-mono font-bold text-slate-800 text-xs">{formatCurrency(margin)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Stop Loss Risk</span>
              <span className="font-mono font-bold text-[#ff3b4a] text-xs">
                {formatCurrency(calculatedRiskAmount)} ({calculatedRiskPct.toFixed(1)}%)
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Account Equity</span>
              <span className="font-mono font-bold text-slate-700 text-xs">{formatCurrency(accountBalance)}</span>
            </div>
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
              className="px-5 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Add to Portfolio'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
