import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileCode, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  HardDrive,
  Tag,
  Settings,
  Lock,
  Trash2,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { TradeJournalEntry, OpenPosition } from '../types';
import { db, clearAllOpenPositions } from '../db/journalDb';
import { getSampleTrades, getSampleOpenPositions } from '../utils/sampleData';
import { TagManager } from './TagManager';

interface DataManagementProps {
  trades: TradeJournalEntry[];
  onRefreshData: () => Promise<void>;
  onEditTrade?: (trade: TradeJournalEntry) => void;
  defaultSubTab?: 'tags' | 'data';
}

export const DataManagementModal: React.FC<DataManagementProps> = ({
  trades,
  onRefreshData,
  onEditTrade,
  defaultSubTab = 'tags',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tags' | 'data'>(defaultSubTab);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);

  // 1. Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trades, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `RiskCalc_Trades_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 2. Export CSV
  const handleExportCsv = () => {
    if (trades.length === 0) {
      setStatusType('error');
      setImportStatus('No trades available to export.');
      return;
    }

    const headers = [
      'ID',
      'Date',
      'Time',
      'Pair',
      'Exchange',
      'Direction',
      'Entry Price',
      'Exit Price',
      'Position Size',
      'Leverage',
      'P&L',
      'P&L (%)',
      'Is Win',
      'Strategy',
      'Timeframe',
      'Rating',
      'Tags',
      'Entry Reason',
      'Exit Reason',
      'Mistakes Made',
      'Lessons Learned',
      'Notes',
    ];

    const rows = trades.map((t) => [
      t.id || '',
      t.date || '',
      t.time || '',
      t.pair || '',
      t.exchange || '',
      t.direction || '',
      t.entryPrice || 0,
      t.exitPrice || 0,
      t.positionSize || 0,
      t.leverage || 1,
      t.pnl || 0,
      t.pnlPercentage || 0,
      t.isWin ? 'TRUE' : 'FALSE',
      `"${(t.strategy || '').replace(/"/g, '""')}"`,
      t.timeframe || '',
      t.tradeRating || '',
      `"${(t.tags || []).join('; ').replace(/"/g, '""')}"`,
      `"${(t.entryReason || '').replace(/"/g, '""')}"`,
      `"${(t.exitReason || '').replace(/"/g, '""')}"`,
      `"${(t.mistakesMade || '').replace(/"/g, '""')}"`,
      `"${(t.lessonsLearned || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RiskCalc_Trading_Journal_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // 3. Import JSON
  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (!Array.isArray(parsed)) {
          throw new Error('Invalid JSON format: expected an array of trade objects.');
        }

        // Clean and prepare entries
        const cleanTrades: Omit<TradeJournalEntry, 'id'>[] = parsed.map((item: any) => ({
          createdAt: item.createdAt || new Date().toISOString(),
          date: item.date || new Date().toISOString().split('T')[0],
          time: item.time || '12:00',
          pair: String(item.pair || 'BTC/USDT').toUpperCase(),
          exchange: item.exchange || 'Binance',
          entryPrice: Number(item.entryPrice) || 0,
          exitPrice: Number(item.exitPrice) || 0,
          positionSize: Number(item.positionSize) || 0,
          quantity: Number(item.quantity) || (Number(item.positionSize) / Math.max(1, Number(item.entryPrice))),
          direction: item.direction === 'SHORT' ? 'SHORT' : 'LONG',
          strategy: item.strategy || 'Imported Strategy',
          timeframe: item.timeframe || '1h',
          leverage: Number(item.leverage) || 10,
          tradingFee: Number(item.tradingFee) || 0.055,
          confidence: item.confidence || 'High',
          setupQuality: item.setupQuality || 'Good',
          emotionBefore: item.emotionBefore || 'Calm',
          emotionAfter: item.emotionAfter || 'Satisfied',
          tradeRating: Number(item.tradeRating) || 4,
          tags: Array.isArray(item.tags) ? item.tags : [],
          entryReason: item.entryReason || '',
          exitReason: item.exitReason || '',
          mistakesMade: item.mistakesMade || '',
          lessonsLearned: item.lessonsLearned || '',
          notes: item.notes || '',
          pnl: Number(item.pnl) || 0,
          pnlPercentage: Number(item.pnlPercentage) || 0,
          isWin: Boolean(item.isWin),
          isBreakeven: Boolean(item.isBreakeven),
          favorite: Boolean(item.favorite),
          stopLoss: item.stopLoss ? Number(item.stopLoss) : undefined,
          takeProfit: item.takeProfit ? Number(item.takeProfit) : undefined,
        }));

        await db.trades.bulkAdd(cleanTrades as TradeJournalEntry[]);
        await onRefreshData();

        setStatusType('success');
        setImportStatus(`Successfully imported ${cleanTrades.length} trades into IndexedDB!`);
      } catch (err: any) {
        console.error('Import error:', err);
        setStatusType('error');
        setImportStatus(`Import failed: ${err.message || 'Corrupted JSON file'}`);
      }
    };
    reader.readAsText(file);
  };

  // 4. Clear All Trade Records
  const handleClearAllTrades = async () => {
    setShowClearModal(false);
    await db.trades.clear();
    await clearAllOpenPositions();
    await onRefreshData();
    setStatusType('success');
    setImportStatus('All trade records cleared from IndexedDB successfully.');
  };

  // 5. Generate Sample / Demo Data
  const handleGenerateSampleData = async (mode: 'replace' | 'append' = 'replace') => {
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

      setStatusType('success');
      setImportStatus(`Successfully loaded ${sampleTrades.length} sample crypto trades and ${samplePositions.length} active positions!`);
    } catch (err: any) {
      console.error('Sample data error:', err);
      setStatusType('error');
      setImportStatus(`Failed to generate sample data: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Settings / Data Center Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200/90 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#1565ff]/15 text-[#1565ff] border border-[#1565ff]/30">
              <Settings className="w-4 h-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Settings & Data Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Audit and manage journal tags, export backups, restore data, and monitor local IndexedDB storage.
          </p>
        </div>

        {/* Sub-Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner shrink-0">
          <button
            id="settings-subtab-tags"
            onClick={() => setActiveSubTab('tags')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'tags'
                ? 'bg-white text-[#1565ff] shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Tag Manager</span>
          </button>
          <button
            id="settings-subtab-data"
            onClick={() => setActiveSubTab('data')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'data'
                ? 'bg-white text-[#1565ff] shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backups & Storage</span>
          </button>
        </div>
      </div>

      {/* Subtab 1: TAG MANAGER */}
      {activeSubTab === 'tags' && (
        <TagManager
          trades={trades}
          onRefreshData={onRefreshData}
          onEditTrade={onEditTrade}
        />
      )}

      {/* Subtab 2: BACKUPS & STORAGE */}
      {activeSubTab === 'data' && (
        <div className="space-y-5">
          {/* Storage Stat Pill */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <HardDrive className="w-4 h-4 text-[#22a65e]" />
              <span>Local IndexedDB Database Status: <strong>Operational & Synced</strong></span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {trades.length} Records Stored
            </span>
          </div>

          {/* Import / Export Notification */}
          {importStatus && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono shadow-xs ${
                statusType === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusType === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                <span>{importStatus}</span>
              </div>
              <button
                onClick={() => setImportStatus(null)}
                className="text-slate-500 hover:text-slate-900 text-xs underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* FEATURED: GENERATE SAMPLE / DEMO DATA */}
          <div className="bg-white rounded-xl border-2 border-[#1565ff]/30 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1565ff] text-white flex items-center justify-center font-bold shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Generate Sample / Demo Trading Data</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1565ff] border border-blue-200">
                      Tour Mode
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Populate the journal with 16 realistic crypto perpetual trades and 2 active portfolio positions to see how analytics and metrics work.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateSampleData('replace')}
                  className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Replace With Demo Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateSampleData('append')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Append Demo Trades</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Grid: Export, Import & Database Utilities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Card 1: Export Data */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-md space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-[#1565ff]/15 text-[#1565ff] flex items-center justify-center font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Export Journal Data</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Download your complete trading history for spreadsheet analysis in Excel, Google Sheets, or custom backtesting scripts.
                </p>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <button
                  onClick={handleExportCsv}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#22a65e]" />
                  Export as CSV (Spreadsheet)
                </button>
                <button
                  onClick={handleExportJson}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <FileCode className="w-4 h-4" />
                  Export as JSON (Backup File)
                </button>
              </div>
            </div>

            {/* Card 2: Import & Restore Data */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-md space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-[#1565ff]/15 text-[#1565ff] flex items-center justify-center font-bold">
                  <Upload className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Import / Restore Backup</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Restore previous backups or migrate journal entries from another device by uploading your JSON backup file.
                </p>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Select JSON Backup File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Card 3: Storage & Privacy */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-md space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Clear Trade History</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Permanently clear all journal trade records from your local browser storage if you want to start fresh.
                </p>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClearModal(true)}
                  disabled={trades.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 transition-all cursor-pointer shadow-2xs"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  Clear All Trades ({trades.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Clear All Trades?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently clear all trade records? This cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllTrades}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Clear Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
