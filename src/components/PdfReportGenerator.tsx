import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Share2, 
  Eye, 
  Settings2, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Calendar,
  Layers,
  Award,
  TrendingUp,
  TrendingDown,
  X,
  ExternalLink,
  Maximize2
} from 'lucide-react';
import { TradeJournalEntry, JournalStats, PairStat, SmartInsight, PdfReportOptions } from '../types';
import { formatCurrency, formatNumber } from '../utils/calculator';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { ReportDocumentView } from './ReportDocumentView';
import { PrintPreviewModal } from './PrintPreviewModal';

const STORAGE_KEY_PDF_OPTIONS = 'trader_pdf_report_options';

const DEFAULT_OPTIONS: PdfReportOptions = {
  traderName: 'Pro Trader',
  period: 'All',
  customStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  customEndDate: new Date().toISOString().split('T')[0],
  theme: 'light',
  paperSize: 'a4',
  orientation: 'portrait',
  sections: {
    executiveSummary: true,
    performanceOverview: true,
    charts: true,
    pairPerformance: true,
    tradeHistory: true,
    smartInsights: true,
  },
};

interface PdfReportGeneratorProps {
  trades: TradeJournalEntry[];
  stats: JournalStats;
  pairStats: PairStat[];
  insights: SmartInsight[];
}

export const PdfReportGenerator: React.FC<PdfReportGeneratorProps> = ({
  trades,
  stats,
  pairStats,
  insights,
}) => {
  const [options, setOptions] = useState<PdfReportOptions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PDF_OPTIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_OPTIONS,
          ...parsed,
          sections: {
            ...DEFAULT_OPTIONS.sections,
            ...(parsed.sections || {}),
          },
        };
      }
    } catch (e) {
      console.error('Failed to load saved PDF report options from localStorage:', e);
    }
    return DEFAULT_OPTIONS;
  });

  // Persist report options to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PDF_OPTIONS, JSON.stringify(options));
    } catch (e) {
      console.error('Failed to save PDF report options to localStorage:', e);
    }
  }, [options]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedPdfBlobUrl, setGeneratedPdfBlobUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);
  const [printBlobUrl, setPrintBlobUrl] = useState<string | null>(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  const reportPreviewRef = useRef<HTMLDivElement>(null);

  // Filter trades based on selected report period
  const filteredTrades = useMemo(() => {
    const now = new Date();
    return trades.filter((t) => {
      if (!t.date) return true;
      const tradeDate = new Date(t.date);

      if (options.period === 'Today') {
        const todayStr = now.toISOString().split('T')[0];
        return t.date === todayStr;
      }
      if (options.period === 'Week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return tradeDate >= weekAgo;
      }
      if (options.period === 'Month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return tradeDate >= monthAgo;
      }
      if (options.period === 'Year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return tradeDate >= yearAgo;
      }
      if (options.period === 'Custom' && options.customStartDate && options.customEndDate) {
        return t.date >= options.customStartDate && t.date <= options.customEndDate;
      }
      return true; // 'All'
    });
  }, [trades, options.period, options.customStartDate, options.customEndDate]);

  // Compute period specific stats
  const periodPnl = useMemo(() => {
    return filteredTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  }, [filteredTrades]);

  const periodWins = useMemo(() => filteredTrades.filter((t) => t.isWin).length, [filteredTrades]);
  const periodLosses = useMemo(() => filteredTrades.filter((t) => !t.isWin && !t.isBreakeven).length, [filteredTrades]);
  const periodWinRate = filteredTrades.length > 0 ? (periodWins / filteredTrades.length) * 100 : 0;

  const handleGeneratePdf = async () => {
    if (!reportPreviewRef.current) return;

    setErrorMessage(null);
    try {
      setIsGenerating(true);
      setGenerationStep('Capturing high-resolution report elements...');
      setGenerationProgress(25);

      const element = reportPreviewRef.current;
      
      // Render canvas with html2canvas-pro at high DPI (full support for oklch, modern colors & shadows)
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: options.theme === 'dark' ? '#0b0f19' : '#ffffff',
      });

      setGenerationStep('Assembling multi-page PDF document...');
      setGenerationProgress(65);

      const imgData = canvas.toDataURL('image/png');
      const orientation = options.orientation;
      const format = options.paperSize;

      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Handle multi-page overflow
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      setGenerationStep('Finalizing document payload...');
      setGenerationProgress(90);

      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setGeneratedPdfBlobUrl(blobUrl);

      // Trigger automatic download
      const filename = `Trading_Journal_Report_${options.traderName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);

      setGenerationProgress(100);
      setGenerationStep('Report successfully exported!');
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      const msg = error?.message || 'An error occurred while generating the PDF document. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const preparePrintDossierHtml = () => {
    if (!reportPreviewRef.current) return '';
    const reportHtml = reportPreviewRef.current.innerHTML;

    // Collect all computed stylesheets and font links
    let styleTags = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      styleTags += node.outerHTML;
    });

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Trading Report - ${options.traderName || 'Executive Dossier'}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    ${styleTags}
    <style>
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 16px !important;
        background: white !important;
        color: #0F172A !important;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
      .print-page-wrapper {
        max-width: 900px;
        margin: 0 auto;
        background: white;
        padding: 24px;
        border-radius: 12px;
      }
      .print-action-bar {
        position: sticky;
        top: 0;
        z-index: 1000;
        background: #0F172A;
        color: white;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .print-action-btn {
        background: #1565FF;
        color: white;
        border: none;
        padding: 8px 18px;
        font-weight: 700;
        font-size: 13px;
        border-radius: 8px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .print-action-btn:hover {
        background: #0051E6;
      }
      @media print {
        .print-action-bar {
          display: none !important;
        }
        body {
          padding: 0 !important;
        }
        .print-page-wrapper {
          padding: 0 !important;
          max-width: 100% !important;
          border-radius: 0 !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-action-bar">
      <div>
        <strong style="font-size: 14px; letter-spacing: -0.01em;">RiskCalc PRO • Executive Trading Dossier</strong>
        <div style="font-size: 11px; opacity: 0.75; margin-top: 2px;">Document formatted for physical printing and A4 / Letter PDF export</div>
      </div>
      <button class="print-action-btn" onclick="window.print()">
        <span>Print Document</span>
      </button>
    </div>
    <div class="print-page-wrapper">
      ${reportHtml}
    </div>
    <script>
      // Prompt print dialog when document finishes loading
      window.addEventListener('load', function() {
        setTimeout(function() {
          window.print();
        }, 400);
      });
    </script>
  </body>
</html>`;
  };

  const handlePrint = () => {
    if (!reportPreviewRef.current) return;

    setIsPreparingPrint(true);
    const isInIframe = window.self !== window.top;

    try {
      const printDocHtml = preparePrintDossierHtml();
      const blob = new Blob([printDocHtml], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      setPrintBlobUrl(blobUrl);

      // If running in top-level browser tab (not inside an iframe)
      if (!isInIframe) {
        try {
          window.print();
          setIsPreparingPrint(false);
          return;
        } catch (err) {
          console.warn('Native window.print failed, attempting printable window fallback:', err);
        }
      }

      // If in iframe (e.g. AI Studio preview) or as fallback:
      // Open standalone printable tab or present the dedicated Print dialog
      const printWin = window.open(blobUrl, '_blank');
      setShowPrintModal(true);
    } catch (error: any) {
      console.error('Error preparing print dossier:', error);
      setErrorMessage(error?.message || 'Failed to initialize printable document.');
    } finally {
      setIsPreparingPrint(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trading Report - ${options.traderName}`,
          text: `Trading Journal Executive Report for ${options.period} period. Total P&L: ${formatCurrency(periodPnl)}.`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      setShareNotice('Native sharing is not supported on this browser. Please use the Download button.');
      setTimeout(() => setShareNotice(null), 4000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-5">
      
      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold block">PDF Generation Notice</span>
              <p className="text-rose-700 truncate">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 cursor-pointer shrink-0"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Share Toast Notice */}
      {shareNotice && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#1565ff] shrink-0" />
            <span>{shareNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setShareNotice(null)}
            className="p-1 rounded hover:bg-blue-100 text-blue-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#1565ff]/15 text-[#1565ff] border border-[#1565ff]/30">
              <FileText className="w-4 h-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Executive PDF Report Generator
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Generate clean, professional trading performance dossiers for investors, reviews, or tax records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            id="btn-print-preview"
            onClick={() => setShowPrintPreviewModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 hover:border-slate-400 transition-all cursor-pointer shadow-2xs"
          >
            <Eye className="w-4 h-4 text-[#1565ff]" />
            <span>Print Preview</span>
          </button>
          <button
            id="btn-print-report"
            onClick={handlePrint}
            disabled={isPreparingPrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {isPreparingPrint ? <Loader2 className="w-4 h-4 animate-spin text-[#1565ff]" /> : <Printer className="w-4 h-4 text-[#1565ff]" />}
            <span>{isPreparingPrint ? 'Preparing...' : 'Print'}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            id="btn-generate-pdf"
            onClick={handleGeneratePdf}
            disabled={isGenerating || filteredTrades.length === 0}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 text-xs font-bold text-white bg-[#1565ff] hover:bg-[#0051e6] rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isGenerating ? 'Generating...' : 'Download PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Controls (4 Cols), Right Live Document Preview (8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Controls Configuration Panel */}
        <div className="no-print lg:col-span-4 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-md space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#1565ff]" />
                Report Configurations
              </h2>
            </div>

            {/* Trader Name */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-semibold">Trader / Entity Name</label>
              <input
                type="text"
                value={options.traderName}
                onChange={(e) => setOptions({ ...options, traderName: e.target.value })}
                placeholder="e.g. Satoshi Nakamoto"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
              />
            </div>

            {/* Report Period */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-semibold">Report Period</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-50 rounded-lg border border-slate-200">
                {(['Today', 'Week', 'Month', 'Year', 'All', 'Custom'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setOptions({ ...options, period: p })}
                    className={`py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${
                      options.period === p
                        ? 'bg-[#1565ff] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            {options.period === 'Custom' && (
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="space-y-1">
                  <label className="text-slate-500 text-[10px]">Start Date</label>
                  <input
                    type="date"
                    value={options.customStartDate}
                    onChange={(e) => setOptions({ ...options, customStartDate: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 text-[10px]">End Date</label>
                  <input
                    type="date"
                    value={options.customEndDate}
                    onChange={(e) => setOptions({ ...options, customEndDate: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Document Formatting Options */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              
              {/* Theme */}
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">PDF Theme</label>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-50 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setOptions({ ...options, theme: 'light' })}
                    className={`py-1 rounded text-xs font-bold cursor-pointer ${
                      options.theme === 'light' ? 'bg-[#1565ff] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptions({ ...options, theme: 'dark' })}
                    className={`py-1 rounded text-xs font-bold cursor-pointer ${
                      options.theme === 'dark' ? 'bg-[#1565ff] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>

              {/* Paper Size */}
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">Format</label>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-50 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setOptions({ ...options, paperSize: 'a4' })}
                    className={`py-1 rounded text-xs font-bold cursor-pointer ${
                      options.paperSize === 'a4' ? 'bg-[#1565ff] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptions({ ...options, paperSize: 'letter' })}
                    className={`py-1 rounded text-xs font-bold cursor-pointer ${
                      options.paperSize === 'letter' ? 'bg-[#1565ff] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Letter
                  </button>
                </div>
              </div>
            </div>

            {/* Section Toggles */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="text-slate-600 font-semibold block">Included Sections</label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.sections.executiveSummary}
                  onChange={(e) => setOptions({ ...options, sections: { ...options.sections, executiveSummary: e.target.checked } })}
                  className="rounded bg-slate-50 border-slate-300 text-[#1565ff] focus:ring-0"
                />
                <span className="text-slate-800">Executive Summary</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.sections.performanceOverview}
                  onChange={(e) => setOptions({ ...options, sections: { ...options.sections, performanceOverview: e.target.checked } })}
                  className="rounded bg-slate-50 border-slate-300 text-[#1565ff] focus:ring-0"
                />
                <span className="text-slate-800">Performance Metrics Overview</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.sections.pairPerformance}
                  onChange={(e) => setOptions({ ...options, sections: { ...options.sections, pairPerformance: e.target.checked } })}
                  className="rounded bg-slate-50 border-slate-300 text-[#1565ff] focus:ring-0"
                />
                <span className="text-slate-800">Asset & Pair Breakdown Table</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.sections.tradeHistory}
                  onChange={(e) => setOptions({ ...options, sections: { ...options.sections, tradeHistory: e.target.checked } })}
                  className="rounded bg-slate-50 border-slate-300 text-[#1565ff] focus:ring-0"
                />
                <span className="text-slate-800">Complete Trade History Table</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.sections.smartInsights}
                  onChange={(e) => setOptions({ ...options, sections: { ...options.sections, smartInsights: e.target.checked } })}
                  className="rounded bg-slate-50 border-slate-300 text-[#1565ff] focus:ring-0"
                />
                <span className="text-slate-800">Discipline Audit & Smart Insights</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Report Preview Container (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="no-print flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#1565ff]" />
              Live Document Layout Preview
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono">
                {filteredTrades.length} Trades included
              </span>
              <button
                type="button"
                id="btn-open-print-preview-pane"
                onClick={() => setShowPrintPreviewModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#1565ff] hover:text-[#0051e6] bg-[#1565ff]/10 hover:bg-[#1565ff]/15 rounded-md transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Full Proofing View</span>
              </button>
            </div>
          </div>

          {/* Printable / Renderable Container */}
          <ReportDocumentView
            id="executive-report-printable"
            innerRef={reportPreviewRef}
            options={options}
            filteredTrades={filteredTrades}
            periodPnl={periodPnl}
            periodWins={periodWins}
            periodLosses={periodLosses}
            periodWinRate={periodWinRate}
            stats={stats}
            pairStats={pairStats}
            insights={insights}
          />
        </div>
      </div>

      {/* Generation Progress Modal */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-[#1565ff]/15 text-[#1565ff] border border-[#1565ff]/30 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Generating PDF Dossier</h3>
              <p className="text-xs text-slate-500">{generationStep}</p>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-[#1565ff] h-full rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">PDF Successfully Created!</h3>
              <p className="text-xs text-slate-500">
                Your report has been downloaded. You can also preview or share it directly.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              {generatedPdfBlobUrl && (
                <a
                  href={generatedPdfBlobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  View Tab
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Options & Standalone Dossier Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1565ff] border border-blue-200 flex items-center justify-center mx-auto">
              <Printer className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Print Executive Report</h3>
              <p className="text-xs text-slate-500">
                Your report has been prepared for printing with vector typography and clean A4 pagination.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1565ff]" />
                <span>Printer Instructions</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Click <strong>Open Print View</strong> below to open the dedicated print document. The browser print dialog will appear automatically so you can print to your printer or choose <em>Save as PDF</em>.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="w-full sm:w-auto flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              {printBlobUrl && (
                <a
                  href={printBlobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setTimeout(() => setShowPrintModal(false), 800);
                  }}
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Print View</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Print Preview & Layout Proofing Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreviewModal}
        onClose={() => setShowPrintPreviewModal(false)}
        options={options}
        onOptionsChange={setOptions}
        filteredTrades={filteredTrades}
        periodPnl={periodPnl}
        periodWins={periodWins}
        periodLosses={periodLosses}
        periodWinRate={periodWinRate}
        stats={stats}
        pairStats={pairStats}
        insights={insights}
        onPrint={handlePrint}
        onDownloadPdf={handleGeneratePdf}
        isGeneratingPdf={isGenerating}
      />
    </div>
  );
};
