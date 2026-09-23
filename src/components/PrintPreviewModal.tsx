import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  FileText,
  Sliders,
  Sparkles,
  Download,
  CheckSquare,
  Square,
  Maximize2,
  ExternalLink,
  Info,
  Layers,
  Palette
} from 'lucide-react';
import { PdfReportOptions, TradeJournalEntry, JournalStats, PairStat, SmartInsight } from '../types';
import { ReportDocumentView } from './ReportDocumentView';

export interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: PdfReportOptions;
  onOptionsChange: (newOptions: PdfReportOptions) => void;
  filteredTrades: TradeJournalEntry[];
  periodPnl: number;
  periodWins: number;
  periodLosses: number;
  periodWinRate: number;
  stats: JournalStats;
  pairStats: PairStat[];
  insights: SmartInsight[];
  onPrint: () => void;
  onDownloadPdf?: () => void;
  isGeneratingPdf?: boolean;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  options,
  onOptionsChange,
  filteredTrades,
  periodPnl,
  periodWins,
  periodLosses,
  periodWinRate,
  stats,
  pairStats,
  insights,
  onPrint,
  onDownloadPdf,
  isGeneratingPdf = false,
}) => {
  const [zoom, setZoom] = useState<number>(0.9);
  const [activeTab, setActiveTab] = useState<'sections' | 'layout'>('sections');
  const previewRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut to close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSection = (sectionKey: keyof PdfReportOptions['sections']) => {
    onOptionsChange({
      ...options,
      sections: {
        ...options.sections,
        [sectionKey]: !options.sections[sectionKey],
      },
    });
  };

  const setAllSections = (enable: boolean) => {
    onOptionsChange({
      ...options,
      sections: {
        executiveSummary: enable,
        performanceOverview: enable,
        charts: enable,
        pairPerformance: enable,
        tradeHistory: enable,
        smartInsights: enable,
      },
    });
  };

  const activeSectionCount = [
    options.sections.executiveSummary,
    options.sections.performanceOverview,
    options.sections.pairPerformance,
    options.sections.tradeHistory,
    options.sections.smartInsights,
  ].filter(Boolean).length;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 1.4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(0.9);

  return (
    <div 
      id="print-preview-modal-layer"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-md overflow-hidden text-slate-100 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-preview-title"
    >
      {/* Top Controls Header */}
      <header className="shrink-0 h-16 border-b border-slate-800 bg-slate-900/90 px-4 sm:px-6 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#1565ff] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Printer className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="print-preview-title" className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                Print Preview & Layout Proofing
              </h2>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1565ff]/20 text-[#1565ff] border border-[#1565ff]/30">
                {activeSectionCount} / 5 Sections
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate">
              Review layout formatting, toggle included sections, and verify margins before physical or PDF printing.
            </p>
          </div>
        </div>

        {/* Center Zoom Controls (Desktop) */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 border border-slate-700/80 rounded-lg">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            disabled={zoom <= 0.5}
            className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700/50 cursor-pointer transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-semibold px-2 min-w-[50px] text-center text-slate-200">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            disabled={zoom >= 1.4}
            className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700/50 cursor-pointer transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset to 90%"
            className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white rounded hover:bg-slate-700/50 cursor-pointer transition-colors"
          >
            Fit
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isGeneratingPdf || filteredTrades.length === 0}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>Save PDF</span>
            </button>
          )}

          <button
            type="button"
            id="modal-btn-print-now"
            onClick={() => {
              onPrint();
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1565ff] hover:bg-[#0051e6] active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Now</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Print Preview"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace: Sidebar + Virtual Canvas */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* Left Interactive Control Drawer / Sidebar */}
        <aside className="w-full md:w-80 lg:w-96 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900 flex flex-col max-h-[35vh] md:max-h-full overflow-y-auto">
          
          {/* Sub-navigation tabs on mobile */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1565ff]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Report Composition
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAllSections(true)}
                className="text-[10px] text-[#1565ff] hover:underline font-semibold px-1.5 py-0.5 cursor-pointer"
              >
                All
              </button>
              <span className="text-slate-600 text-xs">/</span>
              <button
                type="button"
                onClick={() => setAllSections(false)}
                className="text-[10px] text-slate-400 hover:underline font-semibold px-1.5 py-0.5 cursor-pointer"
              >
                None
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Section Toggles with rich indicators */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Toggle Report Sections</span>
                <span className="text-slate-500 font-normal">Live Re-flow</span>
              </div>

              {/* 1. Executive Summary */}
              <label 
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  options.sections.executiveSummary
                    ? 'bg-[#1565ff]/10 border-[#1565ff]/40 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.sections.executiveSummary}
                  onChange={() => toggleSection('executiveSummary')}
                  className="mt-0.5 rounded bg-slate-800 border-slate-700 text-[#1565ff] focus:ring-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">1. Executive Summary</span>
                    <span className="text-[10px] font-mono text-[#22a65e]">P&L • Win Rate</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Total net profit, win/loss count, profit factor, and total trade volume.
                  </p>
                </div>
              </label>

              {/* 2. Performance Metrics */}
              <label 
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  options.sections.performanceOverview
                    ? 'bg-[#1565ff]/10 border-[#1565ff]/40 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.sections.performanceOverview}
                  onChange={() => toggleSection('performanceOverview')}
                  className="mt-0.5 rounded bg-slate-800 border-slate-700 text-[#1565ff] focus:ring-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">2. Performance Metrics & Ratios</span>
                    <span className="text-[10px] font-mono text-amber-400">R:R • Streaks</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Average win vs loss magnitude, max win streak, and realized risk-to-reward ratio.
                  </p>
                </div>
              </label>

              {/* 3. Instrument Breakdown */}
              <label 
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  options.sections.pairPerformance
                    ? 'bg-[#1565ff]/10 border-[#1565ff]/40 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.sections.pairPerformance}
                  onChange={() => toggleSection('pairPerformance')}
                  className="mt-0.5 rounded bg-slate-800 border-slate-700 text-[#1565ff] focus:ring-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">3. Instrument Breakdown</span>
                    <span className="text-[10px] font-mono text-slate-300">{pairStats.length} Assets</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Cryptocurrency pair ranking table showing trades count, win rate, and total return.
                  </p>
                </div>
              </label>

              {/* 4. Complete Trade History */}
              <label 
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  options.sections.tradeHistory
                    ? 'bg-[#1565ff]/10 border-[#1565ff]/40 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.sections.tradeHistory}
                  onChange={() => toggleSection('tradeHistory')}
                  className="mt-0.5 rounded bg-slate-800 border-slate-700 text-[#1565ff] focus:ring-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">4. Execution Log History</span>
                    <span className="text-[10px] font-mono text-slate-300">{filteredTrades.length} Trades</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Audit ledger of chronological entry/exit prices, position size, and realized P&L.
                  </p>
                </div>
              </label>

              {/* 5. Smart Insights Audit */}
              <label 
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  options.sections.smartInsights
                    ? 'bg-[#1565ff]/10 border-[#1565ff]/40 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.sections.smartInsights}
                  onChange={() => toggleSection('smartInsights')}
                  className="mt-0.5 rounded bg-slate-800 border-slate-700 text-[#1565ff] focus:ring-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">5. Discipline & Smart Audit</span>
                    <span className="text-[10px] font-mono text-[#1565ff]">AI Insights</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Over-leverage warnings, stop-loss adherence checks, and personalized feedback.
                  </p>
                </div>
              </label>
            </div>

            {/* Quick Layout & Theme Preset Adjustments */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Paper & Theme Format
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Paper Size */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">Paper Standard</span>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-800/80 rounded-md border border-slate-700">
                    <button
                      type="button"
                      onClick={() => onOptionsChange({ ...options, paperSize: 'a4' })}
                      className={`py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                        options.paperSize === 'a4' ? 'bg-[#1565ff] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      A4
                    </button>
                    <button
                      type="button"
                      onClick={() => onOptionsChange({ ...options, paperSize: 'letter' })}
                      className={`py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                        options.paperSize === 'letter' ? 'bg-[#1565ff] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Letter
                    </button>
                  </div>
                </div>

                {/* Theme Style */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">Print Canvas</span>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-800/80 rounded-md border border-slate-700">
                    <button
                      type="button"
                      onClick={() => onOptionsChange({ ...options, theme: 'light' })}
                      className={`py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                        options.theme === 'light' ? 'bg-[#1565ff] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      White
                    </button>
                    <button
                      type="button"
                      onClick={() => onOptionsChange({ ...options, theme: 'dark' })}
                      className={`py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                        options.theme === 'dark' ? 'bg-[#1565ff] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </div>

              {/* Printing Tips Card */}
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-[#1565ff]" />
                  <span>Physical Print Advice</span>
                </div>
                <p className="leading-relaxed">
                  For optimal readability on standard desktop printers, we recommend the <strong>White</strong> canvas and <strong>A4 Portrait</strong> setting with margins set to "Default" or "None".
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Virtual Paper Proofing Canvas */}
        <main className="flex-1 bg-slate-950/90 overflow-auto p-4 sm:p-8 flex flex-col items-center justify-start relative">
          
          {/* Zoom Toolbar for Mobile / Compact view */}
          <div className="lg:hidden sticky top-0 mb-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-lg">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 text-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 1.4}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="text-[10px] text-[#1565ff] font-semibold ml-1 cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Virtual Sheet Wrapper with Paper Drop-shadow */}
          <div
            className="transition-transform duration-150 origin-top flex justify-center w-full max-w-[850px] pb-16"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            <div 
              className={`w-full rounded-sm shadow-2xl transition-all duration-200 ${
                options.theme === 'dark'
                  ? 'ring-1 ring-slate-800 shadow-black/80'
                  : 'ring-1 ring-slate-300 shadow-slate-950/40'
              }`}
            >
              <ReportDocumentView
                id="preview-modal-report-document"
                options={options}
                filteredTrades={filteredTrades}
                periodPnl={periodPnl}
                periodWins={periodWins}
                periodLosses={periodLosses}
                periodWinRate={periodWinRate}
                stats={stats}
                pairStats={pairStats}
                insights={insights}
                isPrintView={true}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Bottom Sticky Status / Quick Action Footer */}
      <footer className="shrink-0 h-12 border-t border-slate-800 bg-slate-900/90 px-4 sm:px-6 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-mono text-slate-300">
            Page Size: {options.paperSize.toUpperCase()} ({options.paperSize === 'a4' ? '210 × 297 mm' : '8.5 × 11 in'})
          </span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">
            Status: {activeSectionCount > 0 ? 'Ready for printing' : 'Warning: 0 sections active'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onPrint();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-md text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Proceed to Print</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
