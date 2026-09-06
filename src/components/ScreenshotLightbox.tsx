import React, { useState } from 'react';
import { X, Image as ImageIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { TradeJournalEntry } from '../types';
import { formatCurrency, formatNumber } from '../utils/calculator';

interface ScreenshotLightboxProps {
  trade: TradeJournalEntry | null;
  onClose: () => void;
}

export const ScreenshotLightbox: React.FC<ScreenshotLightboxProps> = ({ trade, onClose }) => {
  const [viewMode, setViewMode] = useState<'split' | 'before' | 'after'>('split');

  if (!trade) return null;

  const hasBefore = Boolean(trade.beforeScreenshot);
  const hasAfter = Boolean(trade.afterScreenshot);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl text-white ${trade.direction === 'LONG' ? 'bg-[#22a65e]' : 'bg-[#ff3b4a]'}`}>
              {trade.direction === 'LONG' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{trade.pair} Execution Review</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  trade.pnl >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)} ({trade.rMultiple ? `${trade.rMultiple.toFixed(2)}R` : ''})
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Setup: {trade.setup || trade.strategy} • Entry: ${formatNumber(trade.entryPrice)} • Exit: ${formatNumber(trade.exitPrice)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'split' ? 'bg-[#1565ff] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('before')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'before' ? 'bg-[#1565ff] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Before
              </button>
              <button
                onClick={() => setViewMode('after')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'after' ? 'bg-[#1565ff] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                After
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* IMAGE CONTAINER */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50">
          {viewMode === 'split' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before */}
              <div className="space-y-2">
                <span className="text-xs uppercase font-bold text-slate-700 block">
                  1. Setup Before Entry
                </span>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center min-h-[300px]">
                  {hasBefore ? (
                    <img src={trade.beforeScreenshot} alt="Before trade setup" className="w-full h-auto object-contain max-h-[500px]" />
                  ) : (
                    <div className="text-center p-8 text-slate-400 space-y-2">
                      <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs">No 'Before' screenshot recorded for this trade.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* After */}
              <div className="space-y-2">
                <span className="text-xs uppercase font-bold text-slate-700 block">
                  2. Execution & Outcome After Exit
                </span>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center min-h-[300px]">
                  {hasAfter ? (
                    <img src={trade.afterScreenshot} alt="After trade outcome" className="w-full h-auto object-contain max-h-[500px]" />
                  ) : (
                    <div className="text-center p-8 text-slate-400 space-y-2">
                      <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs">No 'After' screenshot recorded for this trade.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'before' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center min-h-[400px]">
              {hasBefore ? (
                <img src={trade.beforeScreenshot} alt="Before trade setup" className="w-full h-auto object-contain max-h-[600px]" />
              ) : (
                <p className="text-xs text-slate-400">No 'Before' screenshot recorded.</p>
              )}
            </div>
          )}

          {viewMode === 'after' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center min-h-[400px]">
              {hasAfter ? (
                <img src={trade.afterScreenshot} alt="After trade outcome" className="w-full h-auto object-contain max-h-[600px]" />
              ) : (
                <p className="text-xs text-slate-400">No 'After' screenshot recorded.</p>
              )}
            </div>
          )}

          {/* Trade Notes & Psychology Context */}
          {(trade.entryReason || trade.lessonsLearned || trade.notes) && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs space-y-2">
              {trade.entryReason && (
                <div>
                  <span className="font-bold text-slate-700">Why Entered: </span>
                  <span className="text-slate-600">{trade.entryReason}</span>
                </div>
              )}
              {trade.lessonsLearned && (
                <div>
                  <span className="font-bold text-amber-700">Lessons Learned: </span>
                  <span className="text-slate-700">{trade.lessonsLearned}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
