import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Award,
  Zap,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Tag,
  Star,
  Edit3,
  Copy,
  Trash2,
  Filter,
  CheckCircle2,
  XCircle,
  BarChart2
} from 'lucide-react';
import { TradeJournalEntry, TradeDirection } from '../types';
import { formatCurrency, formatNumber } from '../utils/calculator';

interface TradingCalendarProps {
  trades: TradeJournalEntry[];
  onAddNewWithDate?: (dateStr: string) => void;
  onEditTrade?: (trade: TradeJournalEntry) => void;
  onDuplicateTrade?: (trade: TradeJournalEntry) => Promise<void>;
  onToggleFavorite?: (id: number, currentFav: boolean) => Promise<void>;
  onDeleteTrade?: (id: number) => Promise<void>;
  onSelectDateForListFilter?: (dateStr: string) => void;
}

interface DayStats {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  trades: TradeJournalEntry[];
  netPnl: number;
  totalVolume: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  winRate: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export const TradingCalendar: React.FC<TradingCalendarProps> = ({
  trades,
  onAddNewWithDate,
  onEditTrade,
  onDuplicateTrade,
  onToggleFavorite,
  onDeleteTrade,
  onSelectDateForListFilter,
}) => {
  // Find initial month/year based on latest trade or current date
  const initialDate = useMemo(() => {
    if (trades.length > 0) {
      // Find latest trade date
      const sortedTrades = [...trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latest = new Date(sortedTrades[0].date);
      if (!isNaN(latest.getTime())) {
        return { year: latest.getFullYear(), month: latest.getMonth() };
      }
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [trades]);

  const [currentYear, setCurrentYear] = useState<number>(initialDate.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.month); // 0-indexed (0 = Jan, 11 = Dec)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Today's date string for comparison
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Map trades by date "YYYY-MM-DD"
  const tradesByDate = useMemo(() => {
    const map = new Map<string, TradeJournalEntry[]>();
    trades.forEach((trade) => {
      if (!trade.date) return;
      const normalizedDate = trade.date.split('T')[0];
      const existing = map.get(normalizedDate) || [];
      existing.push(trade);
      map.set(normalizedDate, existing);
    });
    return map;
  }, [trades]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleTodayJump = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(todayStr);
  };

  // Month Names & Day Headers
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate calendar grid days for currentMonth & currentYear
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: DayStats[] = [];

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const dateStr = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayTrades = tradesByDate.get(dateStr) || [];
      
      let netPnl = 0;
      let totalVolume = 0;
      let winCount = 0;
      let lossCount = 0;
      let beCount = 0;

      dayTrades.forEach((t) => {
        netPnl += t.pnl || 0;
        totalVolume += t.positionSize || 0;
        if (t.isWin) winCount++;
        else if (t.isBreakeven) beCount++;
        else lossCount++;
      });

      const totalCount = winCount + lossCount + beCount;
      const winRate = totalCount > 0 ? (winCount / (winCount + lossCount || 1)) * 100 : 0;

      days.push({
        dateStr,
        dayNum,
        trades: dayTrades,
        netPnl,
        totalVolume,
        winCount,
        lossCount,
        beCount,
        winRate,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // 2. Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTrades = tradesByDate.get(dateStr) || [];

      let netPnl = 0;
      let totalVolume = 0;
      let winCount = 0;
      let lossCount = 0;
      let beCount = 0;

      dayTrades.forEach((t) => {
        netPnl += t.pnl || 0;
        totalVolume += t.positionSize || 0;
        if (t.isWin) winCount++;
        else if (t.isBreakeven) beCount++;
        else lossCount++;
      });

      const totalCount = winCount + lossCount + beCount;
      const winRate = totalCount > 0 ? (winCount / (winCount + lossCount || 1)) * 100 : 0;

      days.push({
        dateStr,
        dayNum: d,
        trades: dayTrades,
        netPnl,
        totalVolume,
        winCount,
        lossCount,
        beCount,
        winRate,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // 3. Next month leading days to round out the 35 or 42 grid cells
    const totalCells = days.length <= 35 ? 35 : 42;
    const remainingDays = totalCells - days.length;
    for (let d = 1; d <= remainingDays; d++) {
      const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const dateStr = `${nextMonthYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTrades = tradesByDate.get(dateStr) || [];

      let netPnl = 0;
      let totalVolume = 0;
      let winCount = 0;
      let lossCount = 0;
      let beCount = 0;

      dayTrades.forEach((t) => {
        netPnl += t.pnl || 0;
        totalVolume += t.positionSize || 0;
        if (t.isWin) winCount++;
        else if (t.isBreakeven) beCount++;
        else lossCount++;
      });

      const totalCount = winCount + lossCount + beCount;
      const winRate = totalCount > 0 ? (winCount / (winCount + lossCount || 1)) * 100 : 0;

      days.push({
        dateStr,
        dayNum: d,
        trades: dayTrades,
        netPnl,
        totalVolume,
        winCount,
        lossCount,
        beCount,
        winRate,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [currentYear, currentMonth, tradesByDate, todayStr]);

  // Aggregate monthly stats for the current visible month
  const monthlyMetrics = useMemo(() => {
    const currentMonthDays = calendarDays.filter((d) => d.isCurrentMonth);
    
    let totalPnl = 0;
    let totalTrades = 0;
    let winTrades = 0;
    let lossTrades = 0;
    let beTrades = 0;
    let activeDaysCount = 0;
    let greenDaysCount = 0;
    let redDaysCount = 0;
    let beDaysCount = 0;
    let bestDay = { dateStr: '', pnl: -Infinity };
    let worstDay = { dateStr: '', pnl: Infinity };

    currentMonthDays.forEach((day) => {
      if (day.trades.length > 0) {
        activeDaysCount++;
        totalPnl += day.netPnl;
        totalTrades += day.trades.length;
        winTrades += day.winCount;
        lossTrades += day.lossCount;
        beTrades += day.beCount;

        if (day.netPnl > 0) {
          greenDaysCount++;
        } else if (day.netPnl < 0) {
          redDaysCount++;
        } else {
          beDaysCount++;
        }

        if (day.netPnl > bestDay.pnl) {
          bestDay = { dateStr: day.dateStr, pnl: day.netPnl };
        }
        if (day.netPnl < worstDay.pnl) {
          worstDay = { dateStr: day.dateStr, pnl: day.netPnl };
        }
      }
    });

    const winRate = totalTrades > 0 ? (winTrades / (winTrades + lossTrades || 1)) * 100 : 0;
    const greenDayRate = activeDaysCount > 0 ? (greenDaysCount / activeDaysCount) * 100 : 0;

    return {
      totalPnl,
      totalTrades,
      winTrades,
      lossTrades,
      beTrades,
      activeDaysCount,
      greenDaysCount,
      redDaysCount,
      beDaysCount,
      winRate,
      greenDayRate,
      bestDay: bestDay.pnl !== -Infinity ? bestDay : null,
      worstDay: worstDay.pnl !== Infinity ? worstDay : null,
    };
  }, [calendarDays]);

  // Selected Day data
  const selectedDayData = useMemo(() => {
    if (!selectedDateStr) return null;
    const day = calendarDays.find((d) => d.dateStr === selectedDateStr);
    if (day) return day;

    // Fallback if not found in current grid
    const dayTrades = tradesByDate.get(selectedDateStr) || [];
    let netPnl = 0;
    let totalVolume = 0;
    let winCount = 0;
    let lossCount = 0;
    let beCount = 0;

    dayTrades.forEach((t) => {
      netPnl += t.pnl || 0;
      totalVolume += t.positionSize || 0;
      if (t.isWin) winCount++;
      else if (t.isBreakeven) beCount++;
      else lossCount++;
    });

    return {
      dateStr: selectedDateStr,
      dayNum: parseInt(selectedDateStr.split('-')[2], 10),
      trades: dayTrades,
      netPnl,
      totalVolume,
      winCount,
      lossCount,
      beCount,
      winRate: (winCount / (winCount + lossCount || 1)) * 100,
      isCurrentMonth: true,
      isToday: selectedDateStr === todayStr,
    };
  }, [selectedDateStr, calendarDays, tradesByDate, todayStr]);

  return (
    <div className="space-y-5">
      
      {/* 1. CALENDAR HEADER & MONTH NAVIGATOR */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-md space-y-3.5 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* Month & Year Title with Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-50 text-[#1565ff] border border-blue-100 shadow-xs">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                  {monthNames[currentMonth]} {currentYear}
                </h2>
                <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  {monthlyMetrics.activeDaysCount} Active Days
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Visual trading activity heatmap & daily PnL distribution
              </p>
            </div>
          </div>

          {/* Controls: Prev, Today, Next, Month Select */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            <button
              onClick={handleTodayJump}
              className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer text-center"
            >
              Today
            </button>
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-200"></div>
              <button
                onClick={handleNextMonth}
                title="Next Month"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. MONTH PERFORMANCE METRICS SUMMARY BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 pt-3 border-t border-slate-100 text-xs">
          
          {/* Monthly Net PnL */}
          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[9px] sm:text-[10px] font-semibold block uppercase">Month Net P&L</span>
            <div
              className={`text-sm sm:text-lg font-bold font-mono mt-0.5 ${
                monthlyMetrics.totalPnl >= 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
              }`}
            >
              {monthlyMetrics.totalPnl >= 0 ? '+' : ''}
              {formatCurrency(monthlyMetrics.totalPnl)}
            </div>
          </div>

          {/* Green vs Red Days */}
          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[9px] sm:text-[10px] font-semibold block uppercase">Day Win Rate</span>
            <div className="text-sm sm:text-lg font-bold font-mono text-slate-900 mt-0.5">
              {monthlyMetrics.greenDayRate.toFixed(0)}%
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
              <span className="text-[#22a65e]">{monthlyMetrics.greenDaysCount}G</span> / <span className="text-[#ff3b4a]">{monthlyMetrics.redDaysCount}R</span> / {monthlyMetrics.beDaysCount}BE
            </div>
          </div>

          {/* Trade Win Rate */}
          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[9px] sm:text-[10px] font-semibold block uppercase">Trade Win Rate</span>
            <div className="text-sm sm:text-lg font-bold font-mono text-slate-900 mt-0.5">
              {monthlyMetrics.winRate.toFixed(1)}%
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
              {monthlyMetrics.winTrades}W / {monthlyMetrics.lossTrades}L
            </div>
          </div>

          {/* Best Day */}
          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[9px] sm:text-[10px] font-semibold block uppercase">Best Day</span>
            <div className="text-xs sm:text-sm font-bold font-mono text-[#22a65e] mt-0.5">
              {monthlyMetrics.bestDay ? `+${formatCurrency(monthlyMetrics.bestDay.pnl)}` : 'N/A'}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono truncate">
              {monthlyMetrics.bestDay?.dateStr || 'No trades'}
            </div>
          </div>

          {/* Worst Day */}
          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[9px] sm:text-[10px] font-semibold block uppercase">Worst Day</span>
            <div className="text-xs sm:text-sm font-bold font-mono text-[#ff3b4a] mt-0.5">
              {monthlyMetrics.worstDay ? formatCurrency(monthlyMetrics.worstDay.pnl) : 'N/A'}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono truncate">
              {monthlyMetrics.worstDay?.dateStr || 'No trades'}
            </div>
          </div>

          {/* Total Executed Trades */}
          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[9px] sm:text-[10px] font-semibold block uppercase">Month Trades</span>
            <div className="text-sm sm:text-lg font-bold font-mono text-[#1565ff] mt-0.5">
              {monthlyMetrics.totalTrades}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
              Avg {(monthlyMetrics.totalTrades / (monthlyMetrics.activeDaysCount || 1)).toFixed(1)}/day
            </div>
          </div>
        </div>
      </div>

      {/* 3. CALENDAR GRID CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        
        {/* Day Header Row */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center">
          {dayNames.map((d, idx) => (
            <div
              key={d}
              className={`py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase ${
                idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Cells Grid (7 columns x 5 or 6 rows) */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 bg-slate-100">
          {calendarDays.map((day, idx) => {
            const hasTrades = day.trades.length > 0;
            const isGreen = hasTrades && day.netPnl > 0;
            const isRed = hasTrades && day.netPnl < 0;
            const isBE = hasTrades && day.netPnl === 0;
            const isSelected = selectedDateStr === day.dateStr;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDateStr(day.dateStr)}
                className={`min-h-[72px] sm:min-h-[105px] p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer relative select-none ${
                  !day.isCurrentMonth
                    ? 'opacity-40 bg-slate-50'
                    : hasTrades
                    ? isGreen
                      ? 'bg-emerald-50 hover:bg-emerald-100/70'
                      : isRed
                      ? 'bg-rose-50 hover:bg-rose-100/70'
                      : 'bg-blue-50 hover:bg-blue-100/70'
                    : 'bg-white hover:bg-slate-50'
                } ${
                  isSelected ? 'ring-2 ring-[#1565ff] z-10 shadow-md' : ''
                }`}
              >
                {/* Top Row inside Day Cell: Day Number & Today indicator */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] sm:text-xs font-mono font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${
                      day.isToday
                        ? 'bg-[#1565ff] text-white shadow-sm'
                        : isSelected
                        ? 'text-[#1565ff]'
                        : day.isCurrentMonth
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {day.dayNum}
                  </span>

                  {/* Trades Count Pill */}
                  {hasTrades && (
                    <span
                      className={`text-[8px] sm:text-[9px] font-mono font-bold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded ${
                        isGreen
                          ? 'bg-[#22a65e]/20 text-[#22a65e] border border-[#22a65e]/30'
                          : isRed
                          ? 'bg-[#ff3b4a]/20 text-[#ff3b4a] border border-[#ff3b4a]/30'
                          : 'bg-[#1565ff]/20 text-[#1565ff] border border-[#1565ff]/30'
                      }`}
                    >
                      {day.trades.length}<span className="hidden sm:inline"> {day.trades.length === 1 ? 'trade' : 'trades'}</span>
                    </span>
                  )}
                </div>

                {/* Middle / Bottom Content: Daily PnL & Stats */}
                {hasTrades ? (
                  <div className="mt-1 sm:mt-2 space-y-0.5 text-right">
                    {/* Daily Net PnL */}
                    <div
                      className={`text-[10px] sm:text-sm font-bold font-mono tracking-tight ${
                        isGreen ? 'text-[#22a65e]' : isRed ? 'text-[#ff3b4a]' : 'text-slate-600'
                      }`}
                    >
                      {day.netPnl >= 0 ? '+' : ''}
                      {formatCurrency(day.netPnl)}
                    </div>

                    {/* Win/Loss small breakdown */}
                    <div className="text-[8px] sm:text-[9px] text-slate-500 font-mono hidden sm:flex items-center justify-end gap-1">
                      {day.winCount > 0 && <span className="text-[#22a65e] font-bold">{day.winCount}W</span>}
                      {day.lossCount > 0 && <span className="text-[#ff3b4a] font-bold">{day.lossCount}L</span>}
                      {day.beCount > 0 && <span>{day.beCount}BE</span>}
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto text-right">
                    {day.isCurrentMonth && (
                      <span className="text-[9px] sm:text-[10px] text-slate-300">
                        —
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SELECTED DAY DETAIL INSPECTOR DRAWER / PANEL */}
      {selectedDayData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-md space-y-3.5 sm:space-y-4">
          
          {/* Day Detail Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs shrink-0 ${
                  selectedDayData.trades.length === 0
                    ? 'bg-slate-100 text-slate-500 border border-slate-200'
                    : selectedDayData.netPnl >= 0
                    ? 'bg-[#22a65e]/15 border border-[#22a65e]/30 text-[#22a65e]'
                    : 'bg-[#ff3b4a]/15 border border-[#ff3b4a]/30 text-[#ff3b4a]'
                }`}
              >
                {selectedDayData.dayNum}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {selectedDayData.dateStr}
                  </h3>
                  {selectedDayData.isToday && (
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#1565ff] text-white">
                      Today
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  {selectedDayData.trades.length === 0
                    ? 'No trading activity logged on this date.'
                    : `${selectedDayData.trades.length} recorded executions with net P&L of ${
                        selectedDayData.netPnl >= 0 ? '+' : ''
                      }${formatCurrency(selectedDayData.netPnl)}`}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons for the Selected Date */}
            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
              {selectedDayData.trades.length > 0 && onSelectDateForListFilter && (
                <button
                  onClick={() => onSelectDateForListFilter(selectedDayData.dateStr)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  title="Filter journal cards list for this date"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filter in List
                </button>
              )}
              {onAddNewWithDate && (
                <button
                  onClick={() => onAddNewWithDate(selectedDayData.dateStr)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1565ff] hover:bg-[#0051e6] rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Log Trade on {selectedDayData.dateStr}
                </button>
              )}
            </div>
          </div>

          {/* Day Trades List */}
          {selectedDayData.trades.length === 0 ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center space-y-2">
              <CalendarIcon className="w-6 h-6 text-slate-400 mx-auto opacity-70" />
              <p className="text-xs text-slate-500">
                No trades logged for {selectedDayData.dateStr}. Click "Log Trade on {selectedDayData.dateStr}" to record an execution.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedDayData.trades.map((trade) => {
                const isWin = trade.isWin;
                const isBE = trade.isBreakeven;

                return (
                  <div
                    key={trade.id}
                    className="bg-white rounded-xl border border-slate-200 p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-300 shadow-xs transition-all"
                  >
                    {/* Left: Direction, Pair, Time, Strategy */}
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          trade.direction === 'LONG'
                            ? 'bg-[#22a65e]/15 border border-[#22a65e]/30 text-[#22a65e]'
                            : 'bg-[#ff3b4a]/15 border border-[#ff3b4a]/30 text-[#ff3b4a]'
                        }`}
                      >
                        {trade.direction === 'LONG' ? (
                          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 font-mono">
                            {trade.pair}
                          </span>
                          <span
                            className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              trade.direction === 'LONG'
                                ? 'bg-[#22a65e]/15 text-[#22a65e]'
                                : 'bg-[#ff3b4a]/15 text-[#ff3b4a]'
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
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">
                          {trade.time && (
                            <span className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px]">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {trade.time}
                            </span>
                          )}
                          {trade.strategy && (
                            <>
                              <span>•</span>
                              <span className="text-[#1565ff] font-medium text-[10px] sm:text-[11px]">{trade.strategy}</span>
                            </>
                          )}
                          {trade.entryReason && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 text-[10px] sm:text-[11px] truncate max-w-[150px] sm:max-w-[200px]">
                                {trade.entryReason}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Prices, PnL & Action Icons */}
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      
                      <div className="text-left sm:text-right text-xs font-mono">
                        <div className="text-slate-600 text-[11px] sm:text-xs">
                          ${formatNumber(trade.entryPrice)} → ${formatNumber(trade.exitPrice)}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-slate-400">
                          Size: {formatCurrency(trade.positionSize)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-xs sm:text-base font-bold font-mono ${
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
                          {trade.pnlPercentage.toFixed(2)}%
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        {onToggleFavorite && trade.id && (
                          <button
                            onClick={() => onToggleFavorite(trade.id!, trade.favorite)}
                            title={trade.favorite ? 'Unfavorite' : 'Favorite'}
                            className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
                              trade.favorite
                                ? 'text-amber-500 bg-amber-50'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${trade.favorite ? 'fill-amber-500' : ''}`} />
                          </button>
                        )}
                        {onEditTrade && (
                          <button
                            onClick={() => onEditTrade(trade)}
                            title="Edit trade"
                            className="p-1 sm:p-1.5 text-slate-400 hover:text-[#1565ff] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDuplicateTrade && (
                          <button
                            onClick={() => onDuplicateTrade(trade)}
                            title="Duplicate setup"
                            className="p-1 sm:p-1.5 text-slate-400 hover:text-[#1565ff] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteTrade && trade.id && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(trade.id!)}
                            title="Delete trade"
                            className="p-1 sm:p-1.5 text-slate-400 hover:text-[#ff3b4a] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SAFE DELETE MODAL */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-[#ff3b4a] rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete this trade record?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete this trade from your journal?
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
                  if (deleteConfirmId && onDeleteTrade) {
                    await onDeleteTrade(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                className="flex-1 px-4 py-2 bg-[#ff3b4a] hover:bg-[#e02d3c] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Delete Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
