import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav, NavTabType } from './components/BottomNav';
import { RiskCalculator } from './components/RiskCalculator';
import { RiskDashboard } from './components/RiskDashboard';
import { TradingJournal } from './components/TradingJournal';
import { TradingPlanView } from './components/TradingPlanView';
import { AiCoachView } from './components/AiCoachView';
import { DrawdownView } from './components/DrawdownView';
import { PlaybookView } from './components/PlaybookView';
import { BacktestingView } from './components/BacktestingView';
import { AnalyticsView } from './components/AnalyticsView';
import { PdfReportGenerator } from './components/PdfReportGenerator';
import { DataSafetyView } from './components/DataSafetyView';
import { TradeFormModal } from './components/TradeFormModal';
import { ScreenshotLightbox } from './components/ScreenshotLightbox';
import { PortfolioRiskView } from './components/PortfolioRiskView';
import { MistakeAnalyticsView } from './components/MistakeAnalyticsView';
import { HamburgerMenu } from './components/HamburgerMenu';
import { NotificationModal } from './components/NotificationModal';
import { ProfileModal } from './components/ProfileModal';
import { HelpAboutModal } from './components/HelpAboutModal';
import { QuickRiskRulesModal, QuickRuleModalType } from './components/QuickRiskRulesModal';
import { LandingPage } from './components/LandingPage';
import { 
  TradeJournalEntry, 
  CalculatorState, 
  CalculationResult, 
  TradingPlan,
  OpenPosition,
  TradeApprovalRecord 
} from './types';
import { 
  calculateJournalStats, 
  calculateDrawdownMetrics, 
  calculateStrategyStats,
  DEFAULT_TRADING_PLAN 
} from './utils/analytics';
import { getSampleTrades, getSampleOpenPositions } from './utils/sampleData';
import { 
  db, 
  initializeDatabase, 
  loadTradingPlan, 
  saveTradingPlan,
  loadOpenPositions,
  saveOpenPosition,
  deleteOpenPosition,
  loadCalculatorSettings,
  saveCalculatorSettings
} from './db/journalDb';
import { 
  WifiOff, 
  ShieldCheck, 
  LayoutDashboard, 
  BookOpen, 
  Compass, 
  Bot, 
  TrendingDown, 
  History, 
  ShieldAlert,
  Flame,
  FileText,
  AlertOctagon,
  Layers
} from 'lucide-react';

export type JournalSubTab = 
  | 'dashboard'
  | 'entries'
  | 'mistakes'
  | 'coach'
  | 'drawdown'
  | 'plan'
  | 'playbook'
  | 'backtest';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabType>('calculator');
  const [journalSubTab, setJournalSubTab] = useState<JournalSubTab>('dashboard');
  const [trades, setTrades] = useState<TradeJournalEntry[]>([]);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [plan, setPlan] = useState<TradingPlan>(DEFAULT_TRADING_PLAN);
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Trade Modal & Lightbox State
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<TradeJournalEntry | null>(null);
  const [calculatorDraft, setCalculatorDraft] = useState<Partial<TradeJournalEntry> | null>(null);
  const [lightboxTrade, setLightboxTrade] = useState<TradeJournalEntry | null>(null);

  // Secondary Features & Modals (Hamburger, Notifications, Profile)
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpAboutOpen, setIsHelpAboutOpen] = useState(false);
  const [quickRulesType, setQuickRulesType] = useState<QuickRuleModalType | null>(null);
  const [calcSettings, setCalcSettings] = useState<CalculatorState | null>(null);
  const [isLandingPageOpen, setIsLandingPageOpen] = useState<boolean>(true);

  // Default to clean light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load database & trades & open positions
  const refreshTrades = useCallback(async () => {
    try {
      await initializeDatabase();
      const allTrades = await db.trades.toArray();
      setTrades(allTrades);

      const positions = await loadOpenPositions();
      setOpenPositions(positions);

      const savedPlan = await loadTradingPlan();
      if (savedPlan) {
        setPlan(savedPlan);
      }

      const savedCalc = await loadCalculatorSettings();
      if (savedCalc) {
        setCalcSettings(savedCalc);
      }
    } catch (err) {
      console.warn('Error loading database in App:', err);
    }
  }, []);

  useEffect(() => {
    refreshTrades();
  }, [refreshTrades]);

  // Derived Analytics
  const { 
    stats, 
    pairStats, 
    monthlyStats, 
    drawdownMetrics, 
    performanceScore, 
    dailyRiskStatus, 
    insights 
  } = calculateJournalStats(trades, plan.startingCapital || 10000, plan);
  const strategyStats = calculateStrategyStats(trades);

  // Check Daily Loss Kill Switch
  useEffect(() => {
    if (plan.enforceKillSwitch) {
      const today = new Date().toISOString().split('T')[0];
      const todayTrades = trades.filter((t) => t.date === today);
      const todayLoss = todayTrades.reduce((acc, t) => acc + (t.pnl < 0 ? Math.abs(t.pnl) : 0), 0);
      const startingCap = plan.startingCapital || 10000;
      const maxDailyLossAmount = (startingCap * (plan.maxDailyLossPct || plan.maxDailyLossPercent || 3)) / 100;

      if (todayLoss >= maxDailyLossAmount && todayTrades.length > 0) {
        setKillSwitchActive(true);
      } else {
        setKillSwitchActive(false);
      }
    } else {
      setKillSwitchActive(false);
    }
  }, [trades, plan]);

  // Handlers for Trades
  const handleSaveTrade = async (entry: Omit<TradeJournalEntry, 'id'>, idToUpdate?: number) => {
    if (idToUpdate) {
      await db.trades.update(idToUpdate, entry);
    } else {
      await db.trades.add(entry as TradeJournalEntry);
    }
    await refreshTrades();
    setEditingTrade(null);
    setCalculatorDraft(null);
  };

  const handleDeleteTrade = async (id: number) => {
    await db.trades.delete(id);
    await refreshTrades();
  };

  const handleDuplicateTrade = async (trade: TradeJournalEntry) => {
    const copy: Omit<TradeJournalEntry, 'id'> = {
      ...trade,
      createdAt: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
    };
    await db.trades.add(copy as TradeJournalEntry);
    await refreshTrades();
  };

  const handleToggleFavorite = async (id: number, currentFav: boolean) => {
    await db.trades.update(id, { favorite: !currentFav });
    await refreshTrades();
  };

  const handleClearAllTrades = async () => {
    await db.trades.clear();
    await refreshTrades();
  };

  const handleSavePlan = async (updatedPlan: TradingPlan) => {
    setPlan(updatedPlan);
    await saveTradingPlan(updatedPlan);
  };

  const handleSaveCalcSettings = async (updatedCalc: CalculatorState) => {
    setCalcSettings(updatedCalc);
    await saveCalculatorSettings(updatedCalc);
  };

  // Open Positions Handlers
  const handleSaveOpenPosition = async (pos: OpenPosition) => {
    await saveOpenPosition(pos);
    const updated = await loadOpenPositions();
    setOpenPositions(updated);
  };

  const handleDeleteOpenPosition = async (id: number) => {
    await deleteOpenPosition(id);
    const updated = await loadOpenPositions();
    setOpenPositions(updated);
  };

  const handleLoadSamplePositionsOnly = async () => {
    const samplePositions = getSampleOpenPositions();
    for (const p of samplePositions) {
      await db.openPositions.add(p as OpenPosition);
    }
    const updated = await loadOpenPositions();
    setOpenPositions(updated);
  };

  const handleLoadSampleTradesOnly = async () => {
    const sampleTrades = getSampleTrades();
    for (const t of sampleTrades) {
      await db.trades.add(t as TradeJournalEntry);
    }
    await refreshTrades();
  };

  const handleClosePositionToJournal = (pos: OpenPosition) => {
    setCalculatorDraft({
      pair: pos.pair,
      direction: pos.direction,
      entryPrice: pos.entryPrice,
      exitPrice: pos.markPrice || pos.entryPrice,
      positionSize: pos.positionSize,
      leverage: pos.leverage,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      notes: `Closed from Open Positions tracker. Initial unrealized P&L: $${pos.unrealizedPnl.toFixed(2)}`,
    });
    setIsTradeModalOpen(true);
  };

  const handleSaveToJournalFromCalculator = (
    calcState: CalculatorState, 
    result: CalculationResult,
    approvalRecord?: TradeApprovalRecord
  ) => {
    const suggestedExit = calcState.takeProfit > 0 ? calcState.takeProfit : calcState.entryPrice;

    setCalculatorDraft({
      pair: calcState.pair,
      direction: calcState.direction,
      entryPrice: calcState.entryPrice,
      exitPrice: suggestedExit,
      positionSize: Number(result.positionSize.toFixed(2)),
      leverage: calcState.leverage,
      stopLoss: calcState.stopLoss,
      takeProfit: calcState.takeProfit > 0 ? calcState.takeProfit : undefined,
      tradingFee: calcState.feeRate,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      strategy: 'Perpetual Futures Setup',
      approvalRecord: approvalRecord,
      notes: `Captured from Risk Calculator. Risk target: ${calcState.riskPercentage}% (${result.riskAmount.toFixed(2)} USDT). Est. Liq: $${result.liquidationPrice.toFixed(2)}.${approvalRecord ? ` Gate Status: ${approvalRecord.status} (Score: ${approvalRecord.score}%)` : ''}`,
    });
    setEditingTrade(null);
    setIsTradeModalOpen(true);
  };

  const handleOpenNewTrade = () => {
    setEditingTrade(null);
    setCalculatorDraft(null);
    setIsTradeModalOpen(true);
  };

  const handleOpenNewTradeWithDate = (dateStr: string) => {
    setEditingTrade(null);
    setCalculatorDraft({
      date: dateStr,
      time: new Date().toTimeString().slice(0, 5),
    });
    setIsTradeModalOpen(true);
  };

  const handleOpenEditTrade = (trade: TradeJournalEntry) => {
    setCalculatorDraft(null);
    setEditingTrade(trade);
    setIsTradeModalOpen(true);
  };

  if (isLandingPageOpen) {
    return (
      <div className="min-h-screen w-full bg-white text-slate-900 font-sans antialiased selection:bg-[#1565ff] selection:text-white">
        {!isOnline && (
          <div className="bg-amber-500 text-white px-3 sm:px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md w-full">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Offline Mode Active • Saved locally to IndexedDB</span>
          </div>
        )}
        <LandingPage
          onLaunchApp={(targetTab = 'calculator') => {
            setIsLandingPageOpen(false);
            setActiveTab(targetTab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenCalculator={() => {
            setIsLandingPageOpen(false);
            setActiveTab('calculator');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenJournal={() => {
            setIsLandingPageOpen(false);
            setActiveTab('journal');
            setJournalSubTab('entries');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenDashboard={() => {
            setIsLandingPageOpen(false);
            setActiveTab('journal');
            setJournalSubTab('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 text-slate-900 font-sans transition-colors flex flex-col antialiased selection:bg-[#1565ff] selection:text-white">
      
      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-3 sm:px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md w-full max-w-full">
          <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
          <span className="truncate">Offline Mode Active • Saved locally to IndexedDB</span>
        </div>
      )}

      {/* Top Header & Continuous Blue Background */}
      <Navbar
        onOpenHamburger={() => setIsHamburgerOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenLandingPage={() => setIsLandingPageOpen(true)}
        showBalanceSummary={activeTab === 'calculator'}
        totalBalance={stats.currentEquity}
        todayProfit={stats.todayPnl}
        totalProfitLoss={stats.totalPnl}
        trades={trades}
        pageTitle={activeTab === 'journal' ? 'Journal' : activeTab === 'calculator' ? '' : activeTab === 'portfolio' ? 'Portfolio' : activeTab === 'analytics' ? 'Analysis' : ''}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-36 sm:pb-32 overflow-x-hidden">
        
        {/* TAB 1: RISK CALCULATOR */}
        {activeTab === 'calculator' && (
          <RiskCalculator 
            onSaveToJournal={handleSaveToJournalFromCalculator} 
            plan={plan}
            killSwitchActive={killSwitchActive || dailyRiskStatus.isKillSwitchActive}
            trades={trades}
            openPositions={openPositions}
            stats={stats}
          />
        )}

        {/* TAB 2: PORTFOLIO RISK SYSTEM */}
        {activeTab === 'portfolio' && (
          <PortfolioRiskView
            accountBalance={plan.startingCapital || 10000}
            openPositions={openPositions}
            plan={plan}
            onSavePosition={handleSaveOpenPosition}
            onDeletePosition={handleDeleteOpenPosition}
            onClosePositionToJournal={handleClosePositionToJournal}
            onNavigateToCalculator={() => setActiveTab('calculator')}
            onLoadSampleData={handleLoadSamplePositionsOnly}
          />
        )}

        {/* TAB 3: JOURNAL HUB */}
        {activeTab === 'journal' && (
          <div className="space-y-6">
            {/* Secondary Sub-Navigation Toolbar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none scroll-smooth">
              <button
                id="subtab-dashboard"
                onClick={() => setJournalSubTab('dashboard')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  journalSubTab === 'dashboard'
                    ? 'bg-[#1565ff] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 ${journalSubTab === 'dashboard' ? 'text-white' : 'text-emerald-600'}`} />
                <span>Risk Dashboard</span>
              </button>

              <button
                id="subtab-entries"
                onClick={() => setJournalSubTab('entries')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  journalSubTab === 'entries'
                    ? 'bg-[#1565ff] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className={`w-3.5 h-3.5 ${journalSubTab === 'entries' ? 'text-white' : 'text-[#1565ff]'}`} />
                <span>Journal Entries & Log</span>
              </button>

              <button
                id="subtab-mistakes"
                onClick={() => setJournalSubTab('mistakes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  journalSubTab === 'mistakes'
                    ? 'bg-[#1565ff] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <AlertOctagon className={`w-3.5 h-3.5 ${journalSubTab === 'mistakes' ? 'text-white' : 'text-rose-600'}`} />
                <span>Mistake Tracker & Cost Engine</span>
              </button>

              <button
                id="subtab-coach"
                onClick={() => setJournalSubTab('coach')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  journalSubTab === 'coach'
                    ? 'bg-[#1565ff] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Bot className={`w-3.5 h-3.5 ${journalSubTab === 'coach' ? 'text-white' : 'text-amber-500'}`} />
                <span>AI Trading Coach</span>
              </button>

              <button
                id="subtab-drawdown"
                onClick={() => setJournalSubTab('drawdown')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  journalSubTab === 'drawdown'
                    ? 'bg-[#1565ff] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <TrendingDown className={`w-3.5 h-3.5 ${journalSubTab === 'drawdown' ? 'text-white' : 'text-rose-500'}`} />
                <span>Drawdown & Underwater</span>
              </button>

              <button
                id="subtab-plan"
                onClick={() => setJournalSubTab('plan')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  journalSubTab === 'plan'
                    ? 'bg-[#1565ff] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShieldAlert className={`w-3.5 h-3.5 ${journalSubTab === 'plan' ? 'text-white' : 'text-blue-600'}`} />
                <span>Trading Plan & Kill Switch</span>
              </button>

              <button
                id="subtab-playbook"
                onClick={() => setJournalSubTab('playbook')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  journalSubTab === 'playbook'
                    ? 'bg-[#1565ff] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Compass className={`w-3.5 h-3.5 ${journalSubTab === 'playbook' ? 'text-white' : 'text-teal-600'}`} />
                <span>Strategy Playbook</span>
              </button>

              <button
                id="subtab-backtest"
                onClick={() => setJournalSubTab('backtest')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  journalSubTab === 'backtest'
                    ? 'bg-[#1565ff] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <History className={`w-3.5 h-3.5 ${journalSubTab === 'backtest' ? 'text-white' : 'text-indigo-600'}`} />
                <span>Backtesting</span>
              </button>
            </div>

            {/* SubTab Views */}
            {journalSubTab === 'dashboard' && (
              <RiskDashboard
                stats={stats}
                trades={trades}
                drawdownMetrics={drawdownMetrics}
                performanceScore={performanceScore}
                dailyRiskStatus={dailyRiskStatus}
                plan={plan}
                openPositions={openPositions}
                insights={insights}
                onNavigateTab={(tab) => {
                  if (tab === 'plan') setJournalSubTab('plan');
                  else if (tab === 'entries') setJournalSubTab('entries');
                  else if (tab === 'coach') setJournalSubTab('coach');
                  else if (tab === 'drawdown') setJournalSubTab('drawdown');
                  else if (tab === 'calculator') setActiveTab('calculator');
                  else if (tab === 'portfolio') setActiveTab('portfolio');
                  else if (tab === 'analytics') setActiveTab('analytics');
                }}
                onResetKillSwitch={async () => {
                  const updated = { ...plan, killSwitchActive: false, lastResetDate: new Date().toISOString() };
                  await handleSavePlan(updated);
                  setKillSwitchActive(false);
                }}
                onUpdateStartingBalance={async (val) => {
                  const updated = { ...plan, startingCapital: val };
                  await handleSavePlan(updated);
                }}
                onOpenTradeModal={handleOpenNewTrade}
              />
            )}

            {journalSubTab === 'entries' && (
              <TradingJournal
                trades={trades}
                stats={stats}
                onAddNew={handleOpenNewTrade}
                onAddNewWithDate={handleOpenNewTradeWithDate}
                onEdit={handleOpenEditTrade}
                onDelete={handleDeleteTrade}
                onDuplicate={handleDuplicateTrade}
                onToggleFavorite={handleToggleFavorite}
                onClearAll={handleClearAllTrades}
                onLoadSampleData={handleLoadSampleTradesOnly}
              />
            )}

            {journalSubTab === 'mistakes' && (
              <MistakeAnalyticsView trades={trades} />
            )}

            {journalSubTab === 'coach' && (
              <AiCoachView
                trades={trades}
                startingBalance={plan.startingCapital || 10000}
                plan={plan}
              />
            )}

            {journalSubTab === 'drawdown' && (
              <DrawdownView
                drawdownMetrics={drawdownMetrics}
                stats={stats}
              />
            )}

            {journalSubTab === 'plan' && (
              <TradingPlanView
                plan={plan}
                dailyRiskStatus={dailyRiskStatus}
                onSavePlan={handleSavePlan}
                onResetKillSwitch={async () => {
                  const updated = { ...plan, killSwitchActive: false, lastResetDate: new Date().toISOString() };
                  await handleSavePlan(updated);
                  setKillSwitchActive(false);
                }}
              />
            )}

            {journalSubTab === 'playbook' && (
              <PlaybookView
                strategyStats={strategyStats}
                trades={trades}
              />
            )}

            {journalSubTab === 'backtest' && (
              <BacktestingView />
            )}
          </div>
        )}

        {/* TAB 4: ANALYSIS */}
        {activeTab === 'analytics' && (
          <AnalyticsView
            trades={trades}
            stats={stats}
            pairStats={pairStats}
            monthlyStats={monthlyStats}
            insights={insights}
            initialBalance={plan.startingCapital || 10000}
            onRefreshData={refreshTrades}
            onEditTrade={handleOpenEditTrade}
          />
        )}

        {/* TAB 5: PDF */}
        {activeTab === 'pdf' && (
          <PdfReportGenerator
            trades={trades}
            stats={stats}
            pairStats={pairStats}
            insights={insights}
          />
        )}

        {/* TAB 6: SETTING / DATA SAFETY */}
        {activeTab === 'data' && (
          <DataSafetyView
            trades={trades}
            plan={plan}
            onRefreshData={refreshTrades}
            onNavigateTab={setActiveTab}
          />
        )}
      </main>

      {/* Trade Form Modal (Add / Edit) */}
      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => {
          setIsTradeModalOpen(false);
          setEditingTrade(null);
          setCalculatorDraft(null);
        }}
        onSave={handleSaveTrade}
        editingTrade={editingTrade}
        initialDraft={calculatorDraft}
        plan={plan}
      />

      {/* Screenshot Lightbox Modal */}
      {lightboxTrade && (
        <ScreenshotLightbox
          trade={lightboxTrade}
          onClose={() => setLightboxTrade(null)}
        />
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalTrades={trades.length}
        openPositionsCount={openPositions.length}
        onOpenNewTrade={handleOpenNewTrade}
      />

      {/* Hamburger Slide-over Menu */}
      <HamburgerMenu
        isOpen={isHamburgerOpen}
        onClose={() => setIsHamburgerOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsHamburgerOpen(false);
        }}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenHelpAbout={() => setIsHelpAboutOpen(true)}
        onOpenRiskRules={() => setQuickRulesType('rules')}
        onOpenRiskBudget={() => setQuickRulesType('budget')}
        onOpenFeeSettings={() => setQuickRulesType('fees')}
        onOpenSlippageSettings={() => setQuickRulesType('slippage')}
        onOpenAdvancedCalcSettings={() => setQuickRulesType('advancedCalc')}
        onOpenLandingPage={() => {
          setIsHamburgerOpen(false);
          setIsLandingPageOpen(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        killSwitchActive={killSwitchActive || dailyRiskStatus.isKillSwitchActive}
        totalTrades={trades.length}
      />

      {/* Notifications Modal */}
      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        killSwitchActive={killSwitchActive || dailyRiskStatus.isKillSwitchActive}
        isOnline={isOnline}
        plan={plan}
        totalTrades={trades.length}
      />

      {/* Trader Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        plan={plan}
        totalTrades={trades.length}
        winRate={stats.winRate}
        totalPnl={stats.totalPnl}
      />

      {/* Help / About Modal */}
      <HelpAboutModal
        isOpen={isHelpAboutOpen}
        onClose={() => setIsHelpAboutOpen(false)}
      />

      {/* Quick Risk Rules / Parameters Modal */}
      {quickRulesType && (
        <QuickRiskRulesModal
          isOpen={true}
          onClose={() => setQuickRulesType(null)}
          type={quickRulesType}
          plan={plan}
          onSavePlan={handleSavePlan}
          calcState={calcSettings || undefined}
          onSaveCalcState={handleSaveCalcSettings}
          killSwitchActive={killSwitchActive || dailyRiskStatus.isKillSwitchActive}
          onToggleKillSwitch={() => setKillSwitchActive((prev) => !prev)}
          dailyRiskStatus={dailyRiskStatus}
          currentEquity={stats.currentEquity}
        />
      )}
    </div>
  );
}
