import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Trash2, 
  Edit3, 
  Copy, 
  Star, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Tag, 
  Clock, 
  Calendar as CalendarIcon, 
  Smile, 
  Sparkles,
  AlertTriangle,
  Award,
  Zap,
  BarChart,
  ShieldCheck,
  BookOpen,
  LayoutList,
  CalendarCheck,
  RefreshCw
} from 'lucide-react';
import { TradeJournalEntry, JournalStats, TradeDirection, Timeframe } from '../types';
import { formatCurrency, formatNumber } from '../utils/calculator';
import { TradingCalendar } from './TradingCalendar';

interface TradingJournalProps {
  trades: TradeJournalEntry[];
  stats: JournalStats;
  onAddNew: () => void;
  onAddNewWithDate?: (dateStr: string) => void;
  onEdit: (trade: TradeJournalEntry) => void;
  onDelete: (id: number) => Promise<void>;
  onDuplicate: (trade: TradeJournalEntry) => Promise<void>;
  onToggleFavorite: (id: number, currentFav: boolean) => Promise<void>;
  onClearAll: () => Promise<void>;
  onLoadSampleData?: () => Promise<void>;
}

export const TradingJournal: React.FC<TradingJournalProps> = ({
  trades,
  stats,
  onAddNew,
  onAddNewWithDate,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  onClearAll,
  onLoadSampleData,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [resultFilter, setResultFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'BE'>('ALL');
  const [strategyFilter, setStrategyFilter] = useState('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest_pnl' | 'lowest_pnl'>('newest');
  
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Extract unique strategies and months for filter dropdowns
  const uniqueStrategies = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.strategy) set.add(t.strategy);
    });
    return Array.from(set);
  }, [trades]);

  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          set.add(key);
        }
      }
    });
    return Array.from(set).sort().reverse();
  }, [trades]);

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    return trades
      .filter((trade) => {
        // Search filter
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchPair = trade.pair.toLowerCase().includes(term);
          const matchStrategy = trade.strategy?.toLowerCase().includes(term);
          const matchTags = trade.tags?.some((t) => t.toLowerCase().includes(term));
          const matchNotes = trade.notes?.toLowerCase().includes(term);
          if (!matchPair && !matchStrategy && !matchTags && !matchNotes) return false;
        }

        // Direction filter
        if (directionFilter !== 'ALL' && trade.direction !== directionFilter) return false;

        // Result filter
        if (resultFilter === 'WIN' && !trade.isWin) return false;
        if (resultFilter === 'LOSS' && (trade.isWin || trade.isBreakeven)) return false;
        if (resultFilter === 'BE' && !trade.isBreakeven) return false;

        // Strategy filter
        if (strategyFilter !== 'ALL' && trade.strategy !== strategyFilter) return false;

        // Timeframe filter
        if (timeframeFilter !== 'ALL' && trade.timeframe !== timeframeFilter) return false;

        // Month filter
        if (monthFilter !== 'ALL') {
          const d = new Date(trade.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (key !== monthFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.date + ' ' + (b.time || '00:00')).getTime() - new Date(a.date + ' ' + (a.time || '00:00')).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.date + ' ' + (a.time || '00:00')).getTime() - new Date(b.date + ' ' + (b.time || '00:00')).getTime();
        }
        if (sortBy === 'highest_pnl') {
          return (b.pnl || 0) - (a.pnl || 0);
        }
        if (sortBy === 'lowest_pnl') {
          return (a.pnl || 0) - (b.pnl || 0);
        }
        return 0;
      });
  }, [trades, searchTerm, directionFilter, resultFilter, strategyFilter, timeframeFilter, monthFilter, sortBy]);

  const toggleExpand = (id: number) => {
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      
      {/* 1. PRIMARY STATISTICS DASHBOARD */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        
        {/* Total Trades & Win Rate */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Win Rate (%)</span>
            <Award className="w-3.5 h-3.5 text-[#1565ff]" />
          </div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 font-mono mt-0.5 sm:mt-1">
            {stats.winRate.toFixed(1)}%
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-0.5">
            {stats.totalWins}W / {stats.totalLosses}L / {stats.totalBreakeven}BE ({stats.totalTrades} Total)
          </div>
        </div>

        {/* Total P&L */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Total Net P&L</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#22a65e]" />
          </div>
          <div
            className={`text-lg sm:text-2xl font-bold font-mono mt-0.5 sm:mt-1 ${
              stats.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
            }`}
          >
            {stats.totalPnl >= 0 ? '+' : ''}
            {formatCurrency(stats.totalPnl)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-0.5">
            Volume: {formatCurrency(stats.totalVolume, 0)}
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Profit Factor</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg sm:text-2xl font-bold text-amber-600 font-mono mt-0.5 sm:mt-1">
            {stats.profitFactor.toFixed(2)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-0.5">
            {stats.profitFactor >= 2 ? 'Strong Edge' : stats.profitFactor >= 1 ? 'Profitable' : 'Drawdown'}
          </div>
        </div>

        {/* Avg Win vs Avg Loss */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Avg Win / Loss</span>
            <BarChart className="w-3.5 h-3.5 text-[#1565ff]" />
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono mt-0.5 sm:mt-1 flex items-center justify-between">
            <span className="text-[#22a65e]">+{formatCurrency(stats.avgWin)}</span>
            <span className="text-slate-400">/</span>
            <span className="text-[#ff3b4a]">-{formatCurrency(stats.avgLoss)}</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-0.5">
            Win/Loss Ratio: {stats.avgLoss > 0 ? (stats.avgWin / stats.avgLoss).toFixed(2) : 'N/A'}x
          </div>
        </div>

        {/* Avg Risk:Reward */}
        <div className="col-span-2 sm:col-span-1 bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Avg R:R Ratio</span>
            <Sparkles className="w-3.5 h-3.5 text-[#1565ff]" />
          </div>
          <div className="text-lg sm:text-2xl font-bold text-slate-900 font-mono mt-0.5 sm:mt-1">
            {stats.avgRiskReward > 0 ? `1 : ${stats.avgRiskReward.toFixed(2)}` : 'N/A'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-0.5">
            Target Execution
          </div>
        </div>
      </div>

      {/* 2. EXTENDED STATS BAR */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-md">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 text-xs">
          
          <div className="space-y-0.5">
            <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium">Largest Win</span>
            <p className="text-[#22a65e] text-xs sm:text-sm font-bold font-mono">+{formatCurrency(stats.largestWin)}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium">Largest Loss</span>
            <p className="text-[#ff3b4a] text-xs sm:text-sm font-bold font-mono">{formatCurrency(stats.largestLoss)}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium">Win Streak</span>
            <p className="text-[#22a65e] text-xs sm:text-sm font-bold font-mono">{stats.winStreak} trades</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium">Lose Streak</span>
            <p className="text-[#ff3b4a] text-xs sm:text-sm font-bold font-mono">{stats.loseStreak} trades</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium">Best Pair</span>
            <p className="text-[#1565ff] text-xs sm:text-sm font-bold font-mono truncate">{stats.bestPair.pair} (+{formatCurrency(stats.bestPair.pnl)})</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium">Worst Pair</span>
            <p className="text-[#ff3b4a] text-xs sm:text-sm font-bold font-mono truncate">{stats.worstPair.pair} ({formatCurrency(stats.worstPair.pnl)})</p>
          </div>
        </div>
      </div>

      {/* 3. VIEW MODE TOGGLE & QUICK ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#1565ff] text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Trades List</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                viewMode === 'list' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {filteredTrades.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-[#1565ff] text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Calendar View</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Reset Search ({searchTerm})
            </button>
          )}
          <button
            onClick={onAddNew}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#1565ff] hover:bg-[#0051e6] rounded-lg shadow-sm transition-all cursor-pointer ml-auto sm:ml-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Trade</span>
          </button>
        </div>
      </div>

      {/* CALENDAR VIEW MODE */}
      {viewMode === 'calendar' ? (
        <TradingCalendar
          trades={trades}
          onAddNewWithDate={onAddNewWithDate || onAddNew}
          onEditTrade={onEdit}
          onDuplicateTrade={onDuplicate}
          onToggleFavorite={onToggleFavorite}
          onDeleteTrade={onDelete}
          onSelectDateForListFilter={(dateStr) => {
            setSearchTerm(dateStr);
            setViewMode('list');
          }}
        />
      ) : (
        /* LIST VIEW MODE: Filters & Cards */
        <>
          {/* 4. SEARCH & FILTERS TOOLBAR */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-md space-y-2.5 sm:space-y-3">
            
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
              
              {/* Search Box */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search pair, date, tag, notes..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                />
              </div>

              {/* Quick Filter Buttons & Clear */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-between md:justify-end">
                
                {/* Direction Filter */}
                <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200 text-[11px] sm:text-xs font-semibold">
                  {(['ALL', 'LONG', 'SHORT'] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setDirectionFilter(dir)}
                      className={`px-2 sm:px-2.5 py-1 rounded transition-all cursor-pointer ${
                        directionFilter === dir
                          ? 'bg-[#1565ff] text-white shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {dir}
                    </button>
                  ))}
                </div>

                {/* Result Filter */}
                <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200 text-[11px] sm:text-xs font-semibold">
                  {(['ALL', 'WIN', 'LOSS', 'BE'] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setResultFilter(res)}
                      className={`px-2 sm:px-2.5 py-1 rounded transition-all cursor-pointer ${
                        resultFilter === res
                          ? 'bg-[#1565ff] text-white shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>

                {/* Clear All Trades Button */}
                {trades.length > 0 && (
                  <button
                    onClick={() => setShowClearModal(true)}
                    className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-[#ff3b4a] hover:text-white hover:bg-[#ff3b4a] rounded-lg border border-[#ff3b4a]/30 transition-all flex items-center gap-1 cursor-pointer"
                    title="Clear all trade records"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline sm:inline">Clear All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Secondary Filters: Strategy, Timeframe, Month & Sort */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 border-t border-slate-100 text-[11px] sm:text-xs">
              
              {/* Strategy dropdown */}
              {uniqueStrategies.length > 0 && (
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="text-slate-500 font-medium">Strategy:</span>
                  <select
                    value={strategyFilter}
                    onChange={(e) => setStrategyFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 text-[11px] sm:text-xs focus:outline-none focus:border-[#1565ff]"
                  >
                    <option value="ALL">All</option>
                    {uniqueStrategies.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Timeframe dropdown */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-slate-500 font-medium">TF:</span>
                <select
                  value={timeframeFilter}
                  onChange={(e) => setTimeframeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 text-[11px] sm:text-xs focus:outline-none focus:border-[#1565ff]"
                >
                  <option value="ALL">All</option>
                  {['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].map((tf) => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </div>

              {/* Month dropdown */}
              {uniqueMonths.length > 0 && (
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="text-slate-500 font-medium">Month:</span>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 text-[11px] sm:text-xs focus:outline-none focus:border-[#1565ff]"
                  >
                    <option value="ALL">All</option>
                    {uniqueMonths.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort By */}
              <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 text-[11px] sm:text-xs focus:outline-none focus:border-[#1565ff]"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest_pnl">Highest Profit</option>
                  <option value="lowest_pnl">Largest Loss</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. QUICK SORT BUTTONS BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200/90 shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#1565ff]" />
                Sort:
              </span>

              {/* Newest Button */}
              <button
                id="sort-btn-newest"
                type="button"
                onClick={() => setSortBy('newest')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer border ${
                  sortBy === 'newest'
                    ? 'bg-[#1565ff] text-white border-[#1565ff] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Newest</span>
              </button>

              {/* Oldest Button */}
              <button
                id="sort-btn-oldest"
                type="button"
                onClick={() => setSortBy('oldest')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer border ${
                  sortBy === 'oldest'
                    ? 'bg-[#1565ff] text-white border-[#1565ff] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <CalendarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Oldest</span>
              </button>

              {/* Best Profit Button */}
              <button
                id="sort-btn-best-profit"
                type="button"
                onClick={() => setSortBy('highest_pnl')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer border ${
                  sortBy === 'highest_pnl'
                    ? 'bg-[#22a65e] text-white border-[#22a65e] shadow-xs'
                    : 'bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 border-emerald-200'
                }`}
              >
                <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Best Profit</span>
              </button>

              {/* Largest Loss Button */}
              <button
                id="sort-btn-largest-loss"
                type="button"
                onClick={() => setSortBy('lowest_pnl')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer border ${
                  sortBy === 'lowest_pnl'
                    ? 'bg-[#ff3b4a] text-white border-[#ff3b4a] shadow-xs'
                    : 'bg-rose-50/60 hover:bg-rose-100/80 text-rose-800 border-rose-200'
                }`}
              >
                <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Largest Loss</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 font-mono self-end sm:self-center">
              <span>
                Showing <strong className="text-slate-900">{filteredTrades.length}</strong> of {trades.length} trades
              </span>
            </div>
          </div>

          {/* 6. TRADE CARDS LIST */}
          <div className="space-y-2.5 sm:space-y-3">
            {filteredTrades.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-xl p-8 sm:p-12 text-center space-y-3 shadow-md">
                <div className="w-12 h-12 rounded-xl bg-[#1565ff]/15 text-[#1565ff] flex items-center justify-center mx-auto text-xl">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Trades Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {trades.length === 0
                    ? 'Your trading journal is currently empty. Add your first trade using the button below or transfer parameters from the Risk Calculator.'
                    : 'No trades matched your current search filters. Try adjusting or resetting your filter criteria.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onAddNew}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Log First Trade
                  </button>

                  {trades.length === 0 && onLoadSampleData && (
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
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#1565ff] ${isLoadingSample ? 'animate-spin' : ''}`} />
                      <span>{isLoadingSample ? 'Loading Demo...' : 'Load Sample Demo Trades'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredTrades.map((trade) => {
                const isExpanded = expandedCardId === trade.id;
                const isWin = trade.isWin;
                const isBE = trade.isBreakeven;

                return (
                  <div
                    key={trade.id}
                    className={`bg-white rounded-xl border transition-all shadow-md overflow-hidden ${
                      isExpanded ? 'border-[#1565ff]/60 ring-1 ring-[#1565ff]/30' : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Main Card Header Bar */}
                    <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                      
                      {/* Left: Direction, Pair, Exchange, Rating, Tags */}
                      <div className="flex items-center gap-2.5 sm:gap-3.5 w-full sm:w-auto">
                        
                        {/* Direction Badge */}
                        <div
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                            trade.direction === 'LONG'
                              ? 'bg-[#22a65e]/15 border border-[#22a65e]/30 text-[#22a65e]'
                              : 'bg-[#ff3b4a]/15 border border-[#ff3b4a]/30 text-[#ff3b4a]'
                          }`}
                        >
                          {trade.direction === 'LONG' ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-base text-slate-900 font-mono">
                              {trade.pair}
                            </span>
                            <span
                              className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                trade.direction === 'LONG'
                                  ? 'bg-[#22a65e]/15 text-[#22a65e] border border-[#22a65e]/30'
                                  : 'bg-[#ff3b4a]/15 text-[#ff3b4a] border border-[#ff3b4a]/30'
                              }`}
                            >
                              {trade.direction} {trade.leverage}x
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                              {trade.exchange}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                              {trade.timeframe}
                            </span>

                            {/* Risk Gate Status Badge */}
                            {trade.approvalRecord && (
                              <span 
                                title={`Risk Gate Score: ${trade.approvalRecord.score}%${trade.approvalRecord.overrideReason ? ` | Overridden: ${trade.approvalRecord.overrideReason}` : ''}`}
                                className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                  trade.approvalRecord.status === 'PASSED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : trade.approvalRecord.status === 'OVERRIDDEN'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                <ShieldCheck className="w-3 h-3" />
                                Gate: {trade.approvalRecord.status}
                              </span>
                            )}
                          </div>

                          {/* Date, Strategy & Mistakes */}
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px]">
                              <CalendarIcon className="w-3 h-3 text-slate-400" />
                              {trade.date} {trade.time || ''}
                            </span>
                            {trade.strategy && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-[#1565ff] font-medium text-[10px] sm:text-[11px] truncate max-w-[120px] sm:max-w-none">{trade.strategy}</span>
                              </>
                            )}

                            {/* Categorized Mistakes Tags */}
                            {trade.selectedMistakes && trade.selectedMistakes.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {trade.selectedMistakes.slice(0, 2).map((mId) => (
                                  <span
                                    key={mId}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 border border-rose-200 text-rose-600"
                                  >
                                    ⚠ {mId.replace(/_/g, ' ')}
                                  </span>
                                ))}
                                {trade.selectedMistakes.length > 2 && (
                                  <span className="text-[9px] text-rose-500 font-bold">
                                    +{trade.selectedMistakes.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Rating Stars */}
                            <div className="hidden sm:flex items-center gap-0.5 ml-1">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3 h-3 ${
                                    s <= (trade.tradeRating || 0)
                                      ? 'text-amber-500 fill-amber-500'
                                      : 'text-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle / Right: Execution Details & P&L */}
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        
                        {/* Prices Breakdown */}
                        <div className="text-left sm:text-right text-[11px] sm:text-xs font-mono">
                          <div className="text-slate-500">
                            In: <strong className="text-slate-900">${formatNumber(trade.entryPrice)}</strong> → Out: <strong className="text-slate-900">${formatNumber(trade.exitPrice)}</strong>
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                            Size: {formatCurrency(trade.positionSize)}
                          </div>
                        </div>

                        {/* Result Badge / P&L */}
                        <div className="text-right">
                          <div
                            className={`text-sm sm:text-lg font-bold font-mono ${
                              isWin ? 'text-[#22a65e]' : isBE ? 'text-slate-500' : 'text-[#ff3b4a]'
                            }`}
                          >
                            {trade.pnl >= 0 ? '+' : ''}
                            {formatCurrency(trade.pnl)}
                          </div>
                          <div
                            className={`text-[9px] sm:text-[10px] font-bold font-mono ${
                              isWin ? 'text-[#22a65e]' : isBE ? 'text-slate-500' : 'text-[#ff3b4a]'
                            }`}
                          >
                            {trade.pnlPercentage >= 0 ? '+' : ''}
                            {trade.pnlPercentage.toFixed(2)}% ROI
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          
                          {/* Favorite Button */}
                          <button
                            onClick={() => trade.id && onToggleFavorite(trade.id, trade.favorite)}
                            title={trade.favorite ? 'Unfavorite' : 'Favorite trade'}
                            className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
                              trade.favorite
                                ? 'text-amber-500 bg-amber-50'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${trade.favorite ? 'fill-amber-500' : ''}`} />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => onEdit(trade)}
                            title="Edit trade record"
                            className="p-1 sm:p-1.5 text-slate-400 hover:text-[#1565ff] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>

                          {/* Duplicate Button */}
                          <button
                            onClick={() => onDuplicate(trade)}
                            title="Duplicate trade setup"
                            className="p-1 sm:p-1.5 text-slate-400 hover:text-[#1565ff] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => trade.id && setDeleteConfirmId(trade.id)}
                            title="Delete trade"
                            className="p-1 sm:p-1.5 text-slate-400 hover:text-[#ff3b4a] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>

                          {/* Expand / Details Toggle */}
                          <button
                            onClick={() => trade.id && toggleExpand(trade.id)}
                            title={isExpanded ? 'Collapse details' : 'Expand full details'}
                            className={`p-1 sm:p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isExpanded
                                ? 'bg-[#1565ff]/10 text-[#1565ff] border-[#1565ff]/30'
                                : 'text-slate-400 hover:text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detailed Section */}
                    {isExpanded && (
                      <div className="px-3.5 sm:px-5 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/70 space-y-3 sm:space-y-4 text-xs">
                        
                        {/* Tags, Psychology & Confidence Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-lg border border-slate-200 shadow-xs">
                          <div>
                            <span className="text-slate-500 font-semibold block text-[9px] sm:text-[10px] uppercase">Confidence</span>
                            <span className="text-slate-900 font-bold text-xs sm:text-sm">{trade.confidence}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-semibold block text-[9px] sm:text-[10px] uppercase">Setup Quality</span>
                            <span className="text-slate-900 font-bold text-xs sm:text-sm">{trade.setupQuality}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-semibold block text-[9px] sm:text-[10px] uppercase">Emotion (Pre / Post)</span>
                            <span className="text-slate-900 font-bold text-xs sm:text-sm">{trade.emotionBefore} → {trade.emotionAfter}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-semibold block text-[9px] sm:text-[10px] uppercase">Planned Levels</span>
                            <span className="text-slate-900 font-mono text-[11px] sm:text-xs">
                              SL: {trade.stopLoss ? `$${formatNumber(trade.stopLoss)}` : 'None'} | TP: {trade.takeProfit ? `$${formatNumber(trade.takeProfit)}` : 'None'}
                            </span>
                          </div>
                        </div>

                        {/* Tags list */}
                        {trade.tags && trade.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            {trade.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-[#1565ff]/10 border border-[#1565ff]/20 text-[#1565ff] text-[10px] sm:text-[11px] font-medium"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Reasons & Post-Trade Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                          {trade.entryReason && (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-1">
                              <span className="text-[#1565ff] font-bold text-[10px] sm:text-[11px]">Entry Reason & Triggers:</span>
                              <p className="text-slate-800 leading-relaxed text-xs">{trade.entryReason}</p>
                            </div>
                          )}
                          {trade.exitReason && (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-1">
                              <span className="text-[#1565ff] font-bold text-[10px] sm:text-[11px]">Exit Reason:</span>
                              <p className="text-slate-800 leading-relaxed text-xs">{trade.exitReason}</p>
                            </div>
                          )}
                          {trade.mistakesMade && (
                            <div className="bg-white p-3 rounded-lg border border-[#ff3b4a]/30 shadow-xs space-y-1">
                              <span className="text-[#ff3b4a] font-bold text-[10px] sm:text-[11px]">Mistakes Made:</span>
                              <p className="text-slate-800 leading-relaxed text-xs">{trade.mistakesMade}</p>
                            </div>
                          )}
                          {trade.lessonsLearned && (
                            <div className="bg-white p-3 rounded-lg border border-[#22a65e]/30 shadow-xs space-y-1">
                              <span className="text-[#22a65e] font-bold text-[10px] sm:text-[11px]">Lessons Learned:</span>
                              <p className="text-slate-800 leading-relaxed text-xs">{trade.lessonsLearned}</p>
                            </div>
                          )}
                        </div>

                        {/* Risk Gate Validation Record if present */}
                        {trade.approvalRecord && (
                          <div className="bg-white p-3 sm:p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-[#1565ff]" />
                                Pre-Trade Risk Gate Execution Record
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                trade.approvalRecord.status === 'PASSED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : trade.approvalRecord.status === 'OVERRIDDEN'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                Status: {trade.approvalRecord.status} ({trade.approvalRecord.score}% Score)
                              </span>
                            </div>
                            {trade.approvalRecord.overrideReason && (
                              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                                <strong>Override Reason:</strong> {trade.approvalRecord.overrideReason}
                              </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                              {trade.approvalRecord.checklist.map((c, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${
                                    c.status === 'PASS' ? 'bg-emerald-500' : c.status === 'WARN' ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}>
                                    {c.status === 'PASS' ? '✓' : c.status === 'WARN' ? '!' : '✕'}
                                  </span>
                                  <span className="text-slate-600 truncate">{c.ruleName}: <strong className="text-slate-900">{c.actualValue}</strong></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Selected Mistakes Catalog */}
                        {trade.selectedMistakes && trade.selectedMistakes.length > 0 && (
                          <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-200 shadow-xs space-y-1.5">
                            <span className="text-rose-700 font-bold text-[11px] flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Tagged Execution / Discipline Mistakes:
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {trade.selectedMistakes.map((mId) => (
                                <span
                                  key={mId}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-rose-300 text-rose-700 shadow-xs"
                                >
                                  {mId.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {trade.notes && (
                          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-1">
                            <span className="text-slate-500 font-bold text-[10px] sm:text-[11px]">Additional Journal Notes:</span>
                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">{trade.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Floating Add Button */}
      <button
        id="fab-add-trade"
        onClick={onAddNew}
        className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-xl bg-[#1565ff] hover:bg-[#0051e6] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
        title="Log New Trade"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Clear All Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-lg bg-[#ff3b4a]/15 border border-[#ff3b4a]/30 text-[#ff3b4a] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Clear All Journal Records?</h3>
              <p className="text-xs text-slate-500">
                This will delete all {trades.length} trade logs from your local database. This action cannot be undone unless you have an exported backup.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onClearAll();
                  setShowClearModal(false);
                }}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Trade Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <Trash2 className="w-8 h-8 text-[#ff3b4a] mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Delete this trade record?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete this trade from your journal?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
