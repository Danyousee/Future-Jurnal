import React, { useState } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  X, 
  Info, 
  DollarSign, 
  Percent, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  ExternalLink,
  BookOpen,
  RefreshCw,
  Sliders
} from 'lucide-react';
import { 
  OpenPosition, 
  PortfolioExposureMetrics, 
  TradingPlan, 
  TradeDirection, 
  Exchange,
  PortfolioRiskTier
} from '../types';
import { 
  formatCurrency, 
  formatNumber, 
  formatPrice, 
  estimatePositionLiquidation,
  calculatePortfolioExposure 
} from '../utils/calculator';

interface PortfolioRiskViewProps {
  positions?: OpenPosition[];
  openPositions?: OpenPosition[];
  metrics?: PortfolioExposureMetrics;
  accountBalance: number;
  plan: TradingPlan;
  onAddPosition?: (pos: Omit<OpenPosition, 'id'>) => Promise<void>;
  onSavePosition?: (pos: OpenPosition) => Promise<void>;
  onUpdatePosition?: (id: number, pos: Partial<OpenPosition>) => Promise<void>;
  onDeletePosition: (id: number) => Promise<void>;
  onCloseToJournal?: (pos: OpenPosition) => void;
  onClosePositionToJournal?: (pos: OpenPosition) => void;
  onNavigateToCalculator?: () => void;
  onLoadSampleData?: () => Promise<void>;
}

export const PortfolioRiskView: React.FC<PortfolioRiskViewProps> = ({
  positions,
  openPositions,
  metrics,
  accountBalance,
  plan,
  onAddPosition,
  onSavePosition,
  onUpdatePosition,
  onDeletePosition,
  onCloseToJournal,
  onClosePositionToJournal,
  onNavigateToCalculator,
  onLoadSampleData,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const activePositions = positions || openPositions || [];
  const computedMetrics: PortfolioExposureMetrics = 
    metrics || calculatePortfolioExposure(activePositions, accountBalance, plan);

  // New Position Form State
  const [pair, setPair] = useState('BTCUSDT');
  const [direction, setDirection] = useState<TradeDirection>('LONG');
  const [entryPrice, setEntryPrice] = useState<number>(65000);
  const [currentPrice, setCurrentPrice] = useState<number>(65000);
  const [stopLoss, setStopLoss] = useState<number>(63700);
  const [takeProfit, setTakeProfit] = useState<number>(68000);
  const [quantity, setQuantity] = useState<number>(0.1);
  const [leverage, setLeverage] = useState<number>(10);
  const [correlationGroup, setCorrelationGroup] = useState('BTC-Related');
  const [exchange, setExchange] = useState<Exchange>('Binance');
  const [notes, setNotes] = useState('');

  const groupOptions = [
    'BTC-Related',
    'Layer-1 Infrastructure',
    'High-Beta DeFi',
    'Meme / Speculative',
    'AI & DePIN',
    'Gaming / Metaverse',
    'Custom Group',
  ];

  const handleCreatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const notional = quantity * entryPrice;
    const margin = leverage > 0 ? notional / leverage : notional;
    const riskAmt = quantity * Math.abs(entryPrice - stopLoss);
    
    let unrealized = 0;
    if (direction === 'LONG') {
      unrealized = quantity * (currentPrice - entryPrice);
    } else {
      unrealized = quantity * (entryPrice - currentPrice);
    }
    const unrealizedPct = margin > 0 ? (unrealized / margin) * 100 : 0;

    const { liquidationPrice, distancePct } = estimatePositionLiquidation(
      entryPrice,
      direction,
      leverage,
      0.5
    );

    const newPos: Omit<OpenPosition, 'id'> = {
      pair: pair.toUpperCase().trim(),
      direction,
      entryPrice,
      currentPrice: currentPrice || entryPrice,
      stopLoss,
      takeProfit: takeProfit > 0 ? takeProfit : undefined,
      quantity,
      positionSize: notional,
      margin,
      leverage,
      riskAmount: riskAmt,
      unrealizedPnl: unrealized,
      unrealizedPnlPct: unrealizedPct,
      liquidationPrice,
      distanceToLiquidationPct: distancePct,
      correlationGroup: correlationGroup.trim() || 'General Alts',
      exchange,
      notes,
      createdAt: new Date().toISOString(),
    };

    if (onSavePosition) {
      await onSavePosition(newPos);
    } else if (onAddPosition) {
      await onAddPosition(newPos);
    }
    setShowAddModal(false);
    // reset form
    setNotes('');
  };

  const handleUpdateMarkPrice = (id: number, newPrice: number, pos: OpenPosition) => {
    let pnl = 0;
    if (pos.direction === 'LONG') {
      pnl = pos.quantity * (newPrice - pos.entryPrice);
    } else {
      pnl = pos.quantity * (pos.entryPrice - newPrice);
    }
    const pnlPct = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;

    if (onUpdatePosition) {
      onUpdatePosition(id, {
        currentPrice: newPrice,
        unrealizedPnl: pnl,
        unrealizedPnlPct: pnlPct,
      });
    } else if (onSavePosition) {
      onSavePosition({
        ...pos,
        id,
        currentPrice: newPrice,
        unrealizedPnl: pnl,
        unrealizedPnlPct: pnlPct,
      });
    }
  };

  const {
    totalPositions,
    totalNotionalExposure,
    totalMarginUsed,
    totalAccountRisk,
    totalAccountRiskPct,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct,
    longExposure,
    shortExposure,
    netExposure,
    netExposurePct,
    marginUtilizationPct,
    portfolioRiskTier,
    riskWarnings,
    correlatedGroups,
  } = computedMetrics;

  return (
    <div id="portfolio-risk-system" className="space-y-6">
      {/* HEADER WITH RISK STATUS BADGE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#1565ff]/10 text-[#1565ff] rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Portfolio Risk & Open Positions
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                Track aggregate leverage, total liquidation distance, combined stop risk, and correlated exposures.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Risk Tier Badge */}
          <div
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border shadow-2xs ${
              portfolioRiskTier === 'EXTREME'
                ? 'bg-rose-100 text-rose-900 border-rose-300'
                : portfolioRiskTier === 'HIGH'
                ? 'bg-orange-100 text-orange-900 border-orange-300'
                : portfolioRiskTier === 'ELEVATED'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
            }`}
          >
            {portfolioRiskTier === 'EXTREME' || portfolioRiskTier === 'HIGH' ? (
              <ShieldAlert className="w-4 h-4 text-[#ff3b4a]" />
            ) : portfolioRiskTier === 'ELEVATED' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-[#22a65e]" />
            )}
            <span>{portfolioRiskTier} RISK</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Track Open Position</span>
          </button>
        </div>
      </div>

      {/* TOTAL EXPOSURE METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Notional</span>
          <span className="text-base sm:text-lg font-black text-slate-900 mt-1 block">
            {formatCurrency(totalNotionalExposure)}
          </span>
          <span className="text-[10px] text-slate-500">
            {accountBalance > 0 ? (totalNotionalExposure / accountBalance).toFixed(1) : 0}x Account Equity
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Margin Used</span>
          <span className="text-base sm:text-lg font-black text-[#1565ff] mt-1 block">
            {formatCurrency(totalMarginUsed)}
          </span>
          <span className="text-[10px] text-slate-500">
            {marginUtilizationPct.toFixed(1)}% of Capital
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Stop Risk</span>
          <span className="text-base sm:text-lg font-black text-rose-600 mt-1 block">
            {formatCurrency(totalAccountRisk)}
          </span>
          <span className="text-[10px] font-bold text-rose-700">
            {totalAccountRiskPct.toFixed(2)}% of Account
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Unrealized P&L</span>
          <span className={`text-base sm:text-lg font-black mt-1 block ${
            totalUnrealizedPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
          }`}>
            {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)}
          </span>
          <span className="text-[10px] text-slate-500">
            {totalUnrealizedPnlPct >= 0 ? '+' : ''}{totalUnrealizedPnlPct.toFixed(2)}%
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Long Exposure</span>
          <span className="text-base sm:text-lg font-black text-emerald-600 mt-1 block">
            {formatCurrency(longExposure)}
          </span>
          <span className="text-[10px] text-slate-500">
            {totalNotionalExposure > 0 ? ((longExposure / totalNotionalExposure) * 100).toFixed(0) : 0}% of notional
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Short Exposure</span>
          <span className="text-base sm:text-lg font-black text-rose-600 mt-1 block">
            {formatCurrency(shortExposure)}
          </span>
          <span className="text-[10px] text-slate-500">
            {totalNotionalExposure > 0 ? ((shortExposure / totalNotionalExposure) * 100).toFixed(0) : 0}% of notional
          </span>
        </div>
      </div>

      {/* WARNINGS BANNER */}
      {riskWarnings.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 space-y-2 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Portfolio Risk Alerts:</span>
          </div>
          <ul className="space-y-1 pl-5 list-disc text-[11px] text-amber-800">
            {riskWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* CORRELATED CRYPTO EXPOSURE SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#1565ff]" />
            <h2 className="text-base font-bold text-slate-900">
              Correlated Crypto Exposure Groups
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Risk grouping for co-moving crypto assets
          </span>
        </div>

        {correlatedGroups.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No active positions tracked. Add open positions above to view correlated group exposure.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {correlatedGroups.map((grp) => (
              <div
                key={grp.groupName}
                className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    {grp.groupName}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-[#1565ff] rounded-md">
                    {grp.positionsCount} pos ({grp.directionSummary})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-medium block">Notional Size</span>
                    <span className="text-xs font-black text-slate-900">
                      {formatCurrency(grp.notionalExposure)}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-medium block">Combined Risk</span>
                    <span className="text-xs font-black text-rose-600">
                      {formatCurrency(grp.totalRiskAmount)} ({grp.riskPctOfAccount.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 flex flex-wrap gap-1 items-center">
                  <span className="font-semibold text-slate-500 text-[10px] uppercase">Pairs:</span>
                  {grp.pairs.map((p) => (
                    <span key={p} className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px] font-mono font-bold text-slate-700">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mandatory Correlation Disclaimer */}
        <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 italic leading-relaxed">
          * Notice: Manual portfolio grouping tool for risk management. Does not imply statistical co-integration or price prediction.
        </p>
      </div>

      {/* OPEN POSITIONS TABLE / CARDS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Active Open Perpetual Positions ({activePositions.length})
            </h2>
          </div>
          {onNavigateToCalculator && (
            <button
              type="button"
              onClick={onNavigateToCalculator}
              className="text-xs font-bold text-[#1565ff] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Calculate New Trade in Risk Calculator</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activePositions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-[#1565ff] rounded-2xl flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Open Positions Tracked</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Add your open crypto futures positions to monitor aggregate liquidation risk, margin usage, and overall portfolio health in real time.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Position</span>
              </button>

              {onLoadSampleData && (
                <button
                  type="button"
                  disabled={isLoadingSample}
                  onClick={async () => {
                    setIsLoadingSample(true);
                    try {
                      await onLoadSampleData();
                    } finally {
                      setIsLoadingSample(false);
                    }
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#1565ff] ${isLoadingSample ? 'animate-spin' : ''}`} />
                  <span>{isLoadingSample ? 'Loading...' : 'Load Demo Positions'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Asset / Side</th>
                  <th className="py-3 px-4">Entry / Mark</th>
                  <th className="py-3 px-4">Size & Margin</th>
                  <th className="py-3 px-4">Stop Loss & Risk</th>
                  <th className="py-3 px-4">Est. Liquidation</th>
                  <th className="py-3 px-4">Unrealized P&L</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activePositions.map((pos) => {
                  const isLong = pos.direction === 'LONG';
                  const pnl = pos.unrealizedPnl || 0;
                  const pnlPct = pos.unrealizedPnlPct || 0;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              isLong ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {pos.direction}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 font-mono block">
                              {pos.pair}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {pos.leverage}x • {pos.correlationGroup || 'Alts'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-semibold text-slate-900 font-mono block">
                            Entry: ${formatPrice(pos.entryPrice)}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-0.5">
                            <span>Mark: ${formatPrice(pos.currentPrice)}</span>
                            <input
                              type="number"
                              defaultValue={pos.currentPrice}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (val > 0 && pos.id) {
                                  handleUpdateMarkPrice(pos.id, val, pos);
                                }
                              }}
                              className="w-16 px-1 py-0.5 text-[10px] bg-slate-100 border border-slate-300 rounded font-mono"
                              title="Update current mark price"
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block font-mono">
                          {formatCurrency(pos.positionSize)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Margin: {formatCurrency(pos.margin)} ({formatNumber(pos.quantity)} units)
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 font-mono block">
                          SL: ${formatPrice(pos.stopLoss)}
                        </span>
                        <span className="text-[10px] font-bold text-rose-600">
                          Risk: -{formatCurrency(pos.riskAmount)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 font-mono block">
                          ${formatPrice(pos.liquidationPrice)}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            pos.distanceToLiquidationPct < 4
                              ? 'text-[#ff3b4a]'
                              : pos.distanceToLiquidationPct < 8
                              ? 'text-amber-600'
                              : 'text-[#22a65e]'
                          }`}
                        >
                          {pos.distanceToLiquidationPct.toFixed(2)}% buffer
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`font-black font-mono block text-xs ${
                            pnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
                          }`}
                        >
                          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            pnlPct >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
                          }`}
                        >
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (onClosePositionToJournal) {
                                onClosePositionToJournal(pos);
                              } else if (onCloseToJournal) {
                                onCloseToJournal(pos);
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#22a65e] border border-emerald-200 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                            title="Close position and record into Journal"
                          >
                            Close & Journal
                          </button>
                          <button
                            type="button"
                            onClick={() => pos.id && setDeleteConfirmId(pos.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove position"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SAFE DELETE POSITION MODAL */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-[#ff3b4a] rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Remove Open Position?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove this position from your portfolio risk tracking?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deleteConfirmId) {
                    await onDeletePosition(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Remove Position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD POSITION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Track Open Crypto Futures Position
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePosition} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contract Pair</label>
                  <input
                    type="text"
                    value={pair}
                    onChange={(e) => setPair(e.target.value.toUpperCase())}
                    placeholder="e.g. BTCUSDT"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Direction</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDirection('LONG')}
                      className={`py-1.5 text-xs font-bold rounded-lg ${
                        direction === 'LONG' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      LONG
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('SHORT')}
                      className={`py-1.5 text-xs font-bold rounded-lg ${
                        direction === 'SHORT' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      SHORT
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Entry Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={entryPrice || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEntryPrice(val);
                      setCurrentPrice(val);
                    }}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mark Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={currentPrice || ''}
                    onChange={(e) => setCurrentPrice(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantity (Units)</label>
                  <input
                    type="number"
                    step="any"
                    value={quantity || ''}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stop-Loss ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={stopLoss || ''}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Take-Profit ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={takeProfit || ''}
                    onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Leverage</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={leverage || ''}
                    onChange={(e) => setLeverage(parseInt(e.target.value, 10) || 1)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Correlation Group</label>
                  <select
                    value={correlationGroup}
                    onChange={(e) => setCorrelationGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                  >
                    {groupOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Exchange</label>
                  <select
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value as Exchange)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                  >
                    <option value="Binance">Binance</option>
                    <option value="Bybit">Bybit</option>
                    <option value="OKX">OKX</option>
                    <option value="Kucoin">Kucoin</option>
                    <option value="Bitget">Bitget</option>
                    <option value="Coinbase">Coinbase</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-xl font-bold shadow-xs"
                >
                  Save to Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
