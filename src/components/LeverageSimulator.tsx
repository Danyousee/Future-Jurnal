import React, { useState, useMemo } from 'react';
import { 
  Sliders, 
  AlertTriangle, 
  ShieldAlert, 
  Info, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Flame, 
  Layers, 
  Activity,
  Zap,
  ArrowRight
} from 'lucide-react';
import { CalculatorState, TradeDirection } from '../types';
import { calculateFuturesRisk, formatCurrency, formatNumber, formatPrice } from '../utils/calculator';

interface LeverageSimulatorProps {
  initialState?: CalculatorState;
  accountBalance?: number;
  onApplyLeverage?: (leverage: number) => void;
}

export const LeverageSimulator: React.FC<LeverageSimulatorProps> = ({
  initialState,
  accountBalance = 10000,
  onApplyLeverage,
}) => {
  const [direction, setDirection] = useState<TradeDirection>(initialState?.direction || 'LONG');
  const [entryPrice, setEntryPrice] = useState<number>(initialState?.entryPrice || 60000);
  const [stopLoss, setStopLoss] = useState<number>(initialState?.stopLoss || (initialState?.direction === 'SHORT' ? 61200 : 58800));
  const [takeProfit, setTakeProfit] = useState<number>(initialState?.takeProfit || (initialState?.direction === 'SHORT' ? 57000 : 63000));
  const [simLeverage, setSimLeverage] = useState<number>(initialState?.leverage || 10);
  const [riskPercentage, setRiskPercentage] = useState<number>(initialState?.riskPercentage || 1.0);
  const [cryptoPair, setCryptoPair] = useState<string>(initialState?.pair || 'BTCUSDT');

  const presetLeverages = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125];

  const currentSimResult = useMemo(() => {
    return calculateFuturesRisk({
      accountBalance,
      riskPercentage,
      entryPrice: Math.max(0.000001, entryPrice),
      stopLoss: Math.max(0.000001, stopLoss),
      takeProfit: Math.max(0, takeProfit),
      leverage: simLeverage,
      direction,
      pair: cryptoPair,
      marginMode: 'CROSS',
      feeTier: 'taker',
      feeRate: 0.055,
      takerFeeRate: 0.055,
      makerFeeRate: 0.02,
      estimatedFundingRate: 0.01,
    });
  }, [accountBalance, riskPercentage, entryPrice, stopLoss, takeProfit, simLeverage, direction, cryptoPair]);

  // Proximity to liquidation status
  const liqDistance = currentSimResult.distanceToLiquidationPct;
  let liqDangerTier: 'SAFE' | 'ELEVATED' | 'DANGER' = 'SAFE';
  if (currentSimResult.isLiqBeforeSL || liqDistance < 3) {
    liqDangerTier = 'DANGER';
  } else if (liqDistance < 8) {
    liqDangerTier = 'ELEVATED';
  }

  return (
    <div id="leverage-simulator" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#1565ff]/10 text-[#1565ff] rounded-xl">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Crypto Perpetual Leverage Simulator</span>
              <span className="px-2 py-0.5 bg-blue-50 text-[#1565ff] text-[10px] font-extrabold uppercase rounded-full border border-blue-200">
                Interactive
              </span>
            </h2>
            <p className="text-xs text-slate-600">
              Simulate liquidation proximity, margin lock, fees, and risk changes across 1x to 100x leverage.
            </p>
          </div>
        </div>

        {onApplyLeverage && (
          <button
            type="button"
            onClick={() => onApplyLeverage(simLeverage)}
            className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <span>Apply {simLeverage}x to Calculator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Simulator Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setDirection('LONG')}
              className={`py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                direction === 'LONG'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              LONG
            </button>
            <button
              type="button"
              onClick={() => setDirection('SHORT')}
              className={`py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                direction === 'SHORT'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SHORT
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Risk Per Trade (%)
          </label>
          <input
            type="number"
            step="any"
            min="0.1"
            max="100"
            value={riskPercentage || ''}
            onChange={(e) => setRiskPercentage(parseFloat(e.target.value) || 1.0)}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1565ff]"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Entry Price ($)
          </label>
          <input
            type="number"
            value={entryPrice || ''}
            onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1565ff]"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Stop-Loss Price ($)
          </label>
          <input
            type="number"
            value={stopLoss || ''}
            onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1565ff]"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Take-Profit Price ($)
          </label>
          <input
            type="number"
            value={takeProfit || ''}
            onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1565ff]"
          />
        </div>
      </div>

      {/* LEVERAGE SLIDER & QUICK SELECT */}
      <div className="space-y-3 bg-blue-50/50 p-4 sm:p-5 rounded-2xl border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#1565ff]" />
            <span className="text-sm font-bold text-slate-900">Simulated Leverage:</span>
          </div>
          <span className="text-2xl font-black text-[#1565ff]">
            {simLeverage}x
          </span>
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min="1"
          max="125"
          step="1"
          value={simLeverage}
          onChange={(e) => setSimLeverage(parseInt(e.target.value, 10))}
          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1565ff]"
        />

        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presetLeverages.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSimLeverage(lvl)}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                simLeverage === lvl
                  ? 'bg-[#1565ff] text-white border-[#1565ff] shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#1565ff] hover:text-[#1565ff]'
              }`}
            >
              {lvl}x
            </button>
          ))}
        </div>
      </div>

      {/* LIQUIDATION WARNING ENGINE CARD */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
          liqDangerTier === 'DANGER'
            ? 'bg-rose-50 border-rose-400 text-rose-950'
            : liqDangerTier === 'ELEVATED'
            ? 'bg-amber-50 border-amber-400 text-amber-950'
            : 'bg-emerald-50 border-emerald-300 text-emerald-950'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-200/80 mb-3">
          <div className="flex items-center gap-2.5">
            {liqDangerTier === 'DANGER' ? (
              <ShieldAlert className="w-6 h-6 text-[#ff3b4a] shrink-0" />
            ) : liqDangerTier === 'ELEVATED' ? (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            ) : (
              <Activity className="w-6 h-6 text-[#22a65e] shrink-0" />
            )}
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                {liqDangerTier === 'DANGER'
                  ? '⚠️ CRITICAL LIQUIDATION RISK'
                  : liqDangerTier === 'ELEVATED'
                  ? '⚠️ ELEVATED LIQUIDATION PROXIMITY'
                  : '✓ SAFE LIQUIDATION DISTANCE'}
              </h3>
              <p className="text-xs text-slate-700">
                {liqDangerTier === 'DANGER'
                  ? 'Liquidation price is triggered before or near your Stop Loss level.'
                  : `Distance to liquidation: ${liqDistance.toFixed(2)}% from entry price.`}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Est. Liquidation Price</span>
            <span className="text-lg font-black font-mono text-slate-900">
              ${formatPrice(currentSimResult.liquidationPrice)}
            </span>
          </div>
        </div>

        {/* Liquidation vs SL Distance comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">Distance to Liquidation</span>
            <span className={`text-sm font-black mt-0.5 block ${
              liqDangerTier === 'DANGER' ? 'text-[#ff3b4a]' : liqDangerTier === 'ELEVATED' ? 'text-amber-600' : 'text-[#22a65e]'
            }`}>
              {liqDistance.toFixed(2)}%
            </span>
          </div>

          <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">Distance to Stop-Loss</span>
            <span className="text-sm font-black text-slate-900 mt-0.5 block">
              {currentSimResult.priceRiskPercentage.toFixed(2)}%
            </span>
          </div>

          <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">Required Margin</span>
            <span className="text-sm font-black text-[#1565ff] mt-0.5 block">
              {formatCurrency(currentSimResult.marginRequired)}
            </span>
          </div>
        </div>

        {/* Mandatory Disclaimer */}
        <p className="text-[11px] text-slate-600 mt-3 pt-2 border-t border-slate-200/60 leading-relaxed italic">
          * Disclaimer: Liquidation price is an estimate. Actual liquidation depends on the exchange's mark price, maintenance margin rate, trading fees, 8-hour funding rates, and exchange-specific liquidation engine rules.
        </p>
      </div>

      {/* SIMULATED METRICS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Position Notional</span>
          <span className="text-base font-black text-slate-900 mt-0.5 block">
            {formatCurrency(currentSimResult.positionSize)}
          </span>
          <span className="text-[10px] text-slate-500">
            Qty: {formatNumber(currentSimResult.quantity)} units
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Dollar Risk at SL</span>
          <span className="text-base font-black text-rose-600 mt-0.5 block">
            -{formatCurrency(currentSimResult.riskAmount)}
          </span>
          <span className="text-[10px] text-slate-500">
            {riskPercentage}% of ${formatNumber(accountBalance)}
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Potential Profit at TP</span>
          <span className="text-base font-black text-emerald-600 mt-0.5 block">
            +{formatCurrency(currentSimResult.reward)}
          </span>
          <span className="text-[10px] text-slate-500">
            R:R ratio: 1:{currentSimResult.riskRewardRatio.toFixed(2)}
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Estimated 8h Funding</span>
          <span className="text-base font-black text-slate-900 mt-0.5 block">
            {formatCurrency(currentSimResult.estimatedFundingCost)}
          </span>
          <span className="text-[10px] text-slate-500">
            Taker fee: {formatCurrency(currentSimResult.entryFee + currentSimResult.exitFee)}
          </span>
        </div>
      </div>

      {/* EDUCATIONAL LEVERAGE INSIGHT CALLOUT */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#1565ff] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
          <span className="font-bold text-slate-900 block">
            How Crypto Perpetual Leverage Works:
          </span>
          <p>
            Increasing leverage only decreases the collateral (margin) required to open a given position size. It <strong>does NOT</strong> decrease your dollar risk. Your true risk is always determined by your <strong>Stop-Loss price distance multiplied by position quantity</strong>.
          </p>
          <p className="text-slate-600">
            Using excessive leverage (e.g. 50x–100x) narrows your liquidation buffer to less than 1–2%, which often causes forced liquidation during normal crypto volatility before your stop loss is even touched.
          </p>
        </div>
      </div>
    </div>
  );
};
