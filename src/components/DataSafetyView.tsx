import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Upload, 
  Trash2, 
  Database, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  FileSpreadsheet, 
  HardDrive,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
  BookOpen,
  BarChart3,
  Layers,
  Calculator,
  RefreshCw,
  Info
} from 'lucide-react';
import { TradeJournalEntry, TradingPlan, OpenPosition } from '../types';
import { NavTabType } from './BottomNav';
import { db, saveTradingPlan, clearAllOpenPositions } from '../db/journalDb';
import { getSampleTrades, getSampleOpenPositions } from '../utils/sampleData';

interface DataSafetyViewProps {
  trades: TradeJournalEntry[];
  plan: TradingPlan;
  onRefreshData: () => Promise<void>;
  onNavigateTab?: (tab: NavTabType) => void;
}

export const DataSafetyView: React.FC<DataSafetyViewProps> = ({
  trades,
  plan,
  onRefreshData,
  onNavigateTab,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [showSampleConfirmModal, setShowSampleConfirmModal] = useState(false);
  const [sampleMode, setSampleMode] = useState<'replace' | 'append'>('replace');
  const [sampleSuccessBanner, setSampleSuccessBanner] = useState(false);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setStatusMessage(null);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // 1. Export JSON Backup
  const handleExportJson = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      version: 2,
      app: 'CryptoPerpRiskJournal',
      trades,
      plan,
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(backupData, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `crypto_perp_journal_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showStatus('Backup exported successfully as JSON!');
  };

  // 2. Export CSV
  const handleExportCsv = () => {
    if (trades.length === 0) {
      showError('No trades available to export.');
      return;
    }

    const headers = [
      'ID',
      'Date',
      'Time',
      'Pair',
      'Direction',
      'Leverage',
      'EntryPrice',
      'ExitPrice',
      'StopLoss',
      'TakeProfit',
      'PositionSize',
      'NetPnL',
      'PnLPct',
      'RMultiple',
      'Strategy',
      'Setup',
      'Exchange',
      'IsWin',
      'Tags',
      'Notes',
    ];

    const rows = trades.map((t) => [
      t.id,
      t.date,
      t.time || '',
      t.pair,
      t.direction,
      t.leverage,
      t.entryPrice,
      t.exitPrice,
      t.stopLoss || '',
      t.takeProfit || '',
      t.positionSize,
      t.pnl.toFixed(2),
      t.pnlPercentage.toFixed(2),
      t.rMultiple ? t.rMultiple.toFixed(2) : '',
      `"${t.strategy || ''}"`,
      `"${t.setup || ''}"`,
      t.exchange,
      t.isWin ? 'TRUE' : 'FALSE',
      `"${t.tags ? t.tags.join(';') : ''}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crypto_perp_trades_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    showStatus('Trades exported as CSV spreadsheet!');
  };

  // 3. Import JSON Backup
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      try {
        setIsProcessing(true);
        const content = uploadEvent.target?.result as string;
        const parsed = JSON.parse(content);

        if (parsed.trades && Array.isArray(parsed.trades)) {
          // Clear current and bulk insert
          await db.trades.clear();
          // Remove auto-increment IDs for clean import if necessary
          const cleanTrades = parsed.trades.map((t: any) => {
            const { id, ...rest } = t;
            return rest;
          });
          await db.trades.bulkAdd(cleanTrades);

          if (parsed.plan) {
            await saveTradingPlan(parsed.plan);
          }

          await onRefreshData();
          showStatus(`Successfully imported ${parsed.trades.length} trades!`);
        } else {
          showError('Invalid backup format: missing trades array in JSON file.');
        }
      } catch (err) {
        console.error('Import error:', err);
        showError('Failed to parse backup JSON file. Please verify file integrity.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  // 4. Clear All Data
  const handleClearAllData = async () => {
    setShowWipeModal(false);
    setIsProcessing(true);
    try {
      await db.trades.clear();
      await clearAllOpenPositions();
      await onRefreshData();
      setSampleSuccessBanner(false);
      showStatus('All trade records and open positions cleared successfully.');
    } catch (err) {
      console.error(err);
      showError('Failed to clear trade records.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Generate Sample / Demo Data
  const executeGenerateSampleData = async (mode: 'replace' | 'append') => {
    setIsProcessing(true);
    setShowSampleConfirmModal(false);
    try {
      const sampleTrades = getSampleTrades();
      const samplePositions = getSampleOpenPositions();

      if (mode === 'replace') {
        await db.trades.clear();
        await clearAllOpenPositions();
      }

      await db.trades.bulkAdd(sampleTrades as TradeJournalEntry[]);
      await db.openPositions.bulkAdd(samplePositions as OpenPosition[]);

      await onRefreshData();
      setSampleSuccessBanner(true);
      showStatus(
        mode === 'replace'
          ? `Successfully replaced with ${sampleTrades.length} sample trades and ${samplePositions.length} active portfolio positions!`
          : `Successfully added ${sampleTrades.length} sample trades and ${samplePositions.length} active portfolio positions!`
      );
    } catch (err: any) {
      console.error('Failed to generate sample data:', err);
      showError(`Failed to generate sample data: ${err.message || 'Database error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartSampleGeneration = () => {
    if (sampleMode === 'replace' && trades.length > 0) {
      setShowSampleConfirmModal(true);
    } else {
      executeGenerateSampleData(sampleMode);
    }
  };

  return (
    <div id="data-safety-view" className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* HEADER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#22a65e]" />
            <h2 className="text-xl font-bold text-slate-900 tracking-wide uppercase">
              Settings & Data Management
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate sample demo trades, export backups, restore records, and manage local IndexedDB browser storage.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <Database className="w-4 h-4 text-[#1565ff]" />
          <span className="text-slate-500">Stored Trades:</span>{' '}
          <span className="font-bold text-slate-900 ml-1">{trades.length} Records</span>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#22a65e] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#22a65e] shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* FEATURED: GENERATE SAMPLE / DEMO TRADING DATA */}
      <div 
        id="card-sample-data-generator"
        className="relative overflow-hidden bg-white border-2 border-[#1565ff]/30 rounded-2xl p-5 sm:p-6 shadow-md"
      >
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1565ff] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Generate Sample / Demo Trading Data
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1565ff] border border-blue-200">
                    Tour Mode
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Populate the website with realistic crypto perpetual trades and live portfolio positions to explore all features.
                </p>
              </div>
            </div>

            {/* Quick Record Counter */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                Current: {trades.length} Trades
              </span>
            </div>
          </div>

          {/* Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Closed Trades</span>
              <span className="text-sm font-extrabold text-slate-900 font-mono">16 Orders</span>
              <span className="text-[10px] text-emerald-600 font-medium block">68.8% Win Rate</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Top Crypto Pairs</span>
              <span className="text-sm font-extrabold text-[#1565ff] font-mono">BTC • ETH • SOL</span>
              <span className="text-[10px] text-slate-500 font-medium block">+ SUI & DOGE</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Live Portfolio</span>
              <span className="text-sm font-extrabold text-emerald-600 font-mono">2 Positions</span>
              <span className="text-[10px] text-slate-500 font-medium block">BTC & SOL Active</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Analytics Ready</span>
              <span className="text-sm font-extrabold text-indigo-600 font-mono">14 Days Data</span>
              <span className="text-[10px] text-slate-500 font-medium block">Calendar & Reports</span>
            </div>
          </div>

          {/* Controls: Mode Selector & Primary Action Button */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Mode selection radio / pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                id="sample-mode-replace-btn"
                onClick={() => setSampleMode('replace')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  sampleMode === 'replace'
                    ? 'bg-white text-[#1565ff] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Replace Existing
              </button>
              <button
                type="button"
                id="sample-mode-append-btn"
                onClick={() => setSampleMode('append')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  sampleMode === 'append'
                    ? 'bg-white text-[#1565ff] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Append to Existing
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                id="btn-generate-sample-data"
                type="button"
                onClick={handleStartSampleGeneration}
                disabled={isProcessing}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Trades...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Sample Data</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Success / Tour Navigation Banner */}
          {sampleSuccessBanner && (
            <div className="mt-3 p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1565ff]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#22a65e]" />
                  <span>Sample Data Ready! Explore what just updated:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSampleSuccessBanner(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {onNavigateTab && (
                  <>
                    <button
                      type="button"
                      id="tour-go-journal-btn"
                      onClick={() => onNavigateTab('journal')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#1565ff]" />
                      <span>View Journal</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      id="tour-go-analytics-btn"
                      onClick={() => onNavigateTab('analytics')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer transition-colors"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>View Analysis & Charts</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      id="tour-go-portfolio-btn"
                      onClick={() => onNavigateTab('portfolio')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      <span>View Open Positions</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      id="tour-go-calculator-btn"
                      onClick={() => onNavigateTab('calculator')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Calculator className="w-3.5 h-3.5 text-[#1565ff]" />
                      <span>Risk Calculator</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BACKUP & EXPORT ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export JSON */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-[#1565ff]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Export Full JSON Backup
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Downloads your entire trading history, trading plan, screenshot metadata, and psychology notes in structured JSON.
          </p>
          <button
            id="export-json-backup-btn"
            onClick={handleExportJson}
            disabled={trades.length === 0}
            className="w-full py-2.5 bg-[#1565ff] hover:bg-[#0051e6] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download Backup (.json)
          </button>
        </div>

        {/* Export CSV */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#22a65e]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Export CSV Spreadsheet
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Exports all perpetual trades formatted for Excel, Google Sheets, or custom quantitative Python backtesting scripts.
          </p>
          <button
            id="export-csv-btn"
            onClick={handleExportCsv}
            disabled={trades.length === 0}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Download Spreadsheet (.csv)
          </button>
        </div>

        {/* Restore Backup */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Restore From Backup
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Select a previous `.json` backup file to restore your entire trading journal history and risk configurations.
          </p>
          <label className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Select JSON File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
        </div>

        {/* Local Storage Privacy & Security */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              100% Private Local Storage
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            All positions, risk configurations, and custom notes are stored in your browser's IndexedDB sandbox. No third-party servers receive your trading data.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Offline-first & encrypted browser sandbox active</span>
          </div>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-[#ff3b4a]">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Danger Zone</h3>
        </div>
        <p className="text-xs text-slate-600">
          Wiping your data will clear all IndexedDB trade records and cannot be undone. Please make sure you have exported a backup first.
        </p>
        <button
          id="wipe-all-trades-btn"
          type="button"
          onClick={() => setShowWipeModal(true)}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-[#ff3b4a] font-bold text-xs rounded-xl border border-red-300 transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" /> Wipe All Journal Records
        </button>
      </div>

      {/* WIPE ALL DATA CONFIRMATION MODAL */}
      {showWipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-[#ff3b4a] rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Wipe All Trade Records?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently clear all trade records from your local database? This cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Clear Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAMPLE DATA CONFIRMATION MODAL */}
      {showSampleConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-50 text-[#1565ff] rounded-2xl flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Replace Existing Trades?</h3>
              <p className="text-xs text-slate-500">
                You currently have <strong>{trades.length} trade records</strong> in your journal. Replacing will reset and load 16 curated demo trades and 2 active portfolio positions.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSampleConfirmModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeGenerateSampleData('replace')}
                className="flex-1 px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Yes, Load Sample Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
