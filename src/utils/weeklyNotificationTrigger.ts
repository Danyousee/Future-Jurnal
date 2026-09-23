import { TradeJournalEntry, OpenPosition } from '../types';

export interface WeeklyPerformanceSummary {
  startDate: string;
  endDate: string;
  timeframeLabel: string;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number; // 0 to 100 percentage
  totalPnl: number; // Net $ profit or loss
  totalPnlPct: number; // Percentage gain/loss of account
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: { pair: string; pnl: number; rMultiple?: number } | null;
  worstTrade: { pair: string; pnl: number } | null;
  activeTradesCount: number;
  activeTradesUnrealizedPnl: number;
  activeTradesMargin: number;
  activePairs: string[];
  hasActiveTrades: boolean;
  isRealMondayMorning: boolean;
  isSimulated: boolean;
  isTriggered: boolean;
  isDismissed: boolean;
  triggerReason: string;
}

const STORAGE_KEY_SIMULATE = 'riskcalc_trigger_simulate_monday_v1';
const STORAGE_KEY_DISMISSED = 'riskcalc_trigger_monday_dismissed_date_v1';

/**
 * Checks if the current local time is Monday morning (00:00 - 11:59 AM).
 */
export function isMondayMorning(date: Date = new Date()): boolean {
  const day = date.getDay(); // 0 = Sunday, 1 = Monday
  const hours = date.getHours();
  return day === 1 && hours < 12;
}

/**
 * Checks if the user or tester has enabled Monday Morning Simulation mode.
 */
export function getIsMondaySimulationActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_SIMULATE) === 'true';
  } catch {
    return false;
  }
}

/**
 * Sets Monday Morning Simulation mode.
 */
export function setMondaySimulationActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      localStorage.setItem(STORAGE_KEY_SIMULATE, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_SIMULATE);
    }
  } catch {
    // ignore
  }
}

/**
 * Checks if the Monday summary was dismissed for the current date.
 */
export function isMondaySummaryDismissed(currentDateStr?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const today = currentDateStr || new Date().toISOString().split('T')[0];
    const dismissedDate = localStorage.getItem(STORAGE_KEY_DISMISSED);
    return dismissedDate === today;
  } catch {
    return false;
  }
}

/**
 * Dismisses the Monday summary for today.
 */
export function dismissMondaySummary(currentDateStr?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const today = currentDateStr || new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY_DISMISSED, today);
  } catch {
    // ignore
  }
}

/**
 * Resets the dismissal so the user can re-open or test the card.
 */
export function resetMondaySummaryDismissal(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_DISMISSED);
  } catch {
    // ignore
  }
}

/**
 * Calculates weekly performance summary (Win Rate, Total PnL, etc.)
 * and evaluates the Monday morning active-trades notification trigger.
 */
export function calculateWeeklyPerformanceSummary(
  trades: TradeJournalEntry[],
  openPositions: OpenPosition[],
  options?: {
    now?: Date;
    startingCapital?: number;
    forceSimulateMonday?: boolean;
    overrideDismissed?: boolean;
  }
): WeeklyPerformanceSummary {
  const now = options?.now || new Date();
  const startingCapital = options?.startingCapital || 10000;
  const isRealMon = isMondayMorning(now);
  const isSimulated = options?.forceSimulateMonday ?? getIsMondaySimulationActive();

  // Active trades check
  const activePositionsCount = openPositions.length;
  const tradesWithOpenStatus = trades.filter((t) => (t as any).status === 'OPEN').length;
  const totalActiveCount = Math.max(activePositionsCount, tradesWithOpenStatus);
  const hasActiveTrades = totalActiveCount > 0;

  const activeUnrealizedPnl = openPositions.reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  const activeMargin = openPositions.reduce((acc, p) => acc + (p.margin || 0), 0);
  const activePairs = Array.from(new Set(openPositions.map((p) => p.pair).filter(Boolean)));

  // Date range for past week
  // A standard week is 7 days prior to today
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // Filter trades from the last 7 days
  let weekTrades = trades.filter((t) => {
    if (!t.date) return false;
    return t.date >= sevenDaysAgoStr && t.date <= todayStr;
  });

  let timeframeLabel = `Past 7 Days (${formatDate(sevenDaysAgoStr)} – ${formatDate(todayStr)})`;

  // Fallback: If no trades in the last 7 days but user has recorded trades,
  // evaluate the most recent active 7-day trade block so statistics are meaningful
  if (weekTrades.length === 0 && trades.length > 0) {
    const sortedTrades = [...trades].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestTradeDateStr = sortedTrades[0].date;
    if (latestTradeDateStr) {
      const latestDate = new Date(`${latestTradeDateStr}T12:00:00`);
      const blockStart = new Date(latestDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const blockStartStr = blockStart.toISOString().split('T')[0];

      weekTrades = trades.filter((t) => {
        if (!t.date) return false;
        return t.date >= blockStartStr && t.date <= latestTradeDateStr;
      });

      timeframeLabel = `Last Active Week (${formatDate(blockStartStr)} – ${formatDate(latestTradeDateStr)})`;
    }
  }

  // Calculate stats for the week's closed trades
  const totalTrades = weekTrades.length;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let totalPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let bestTrade: { pair: string; pnl: number; rMultiple?: number } | null = null;
  let worstTrade: { pair: string; pnl: number } | null = null;

  for (const t of weekTrades) {
    const pnl = Number(t.pnl) || 0;
    totalPnl += pnl;

    if (t.isWin || pnl > 0.001) {
      wins++;
      grossProfit += pnl;
      if (!bestTrade || pnl > bestTrade.pnl) {
        bestTrade = { pair: t.pair, pnl, rMultiple: t.rMultiple };
      }
    } else if (t.isBreakeven || Math.abs(pnl) <= 0.001) {
      breakevens++;
    } else {
      losses++;
      grossLoss += Math.abs(pnl);
      if (!worstTrade || pnl < worstTrade.pnl) {
        worstTrade = { pair: t.pair, pnl };
      }
    }
  }

  const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
  const totalPnlPct = startingCapital > 0 ? Number(((totalPnl / startingCapital) * 100).toFixed(2)) : 0;
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 999 : 0;
  const avgWin = wins > 0 ? Number((grossProfit / wins).toFixed(2)) : 0;
  const avgLoss = losses > 0 ? Number((grossLoss / losses).toFixed(2)) : 0;

  const isDismissed = options?.overrideDismissed ? false : isMondaySummaryDismissed(todayStr);

  // Trigger Condition:
  // "displays a summary of the week's performance on the dashboard every Monday morning if the user has active trades"
  const isTriggerConditionMet = (isRealMon || isSimulated) && hasActiveTrades;
  const isTriggered = isTriggerConditionMet && !isDismissed;

  let triggerReason = '';
  if (isRealMon && hasActiveTrades) {
    triggerReason = 'Triggered automatically: Monday Morning with active trades';
  } else if (isSimulated && hasActiveTrades) {
    triggerReason = 'Simulated Monday Morning trigger with active trades';
  } else if (!hasActiveTrades) {
    triggerReason = 'Trigger standby: Monday Morning requires active open trades';
  } else {
    triggerReason = 'Trigger scheduled: Fires every Monday 00:00–12:00 AM when active trades exist';
  }

  return {
    startDate: sevenDaysAgoStr,
    endDate: todayStr,
    timeframeLabel,
    totalTrades,
    wins,
    losses,
    breakevens,
    winRate,
    totalPnl: Number(totalPnl.toFixed(2)),
    totalPnlPct,
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    profitFactor,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    activeTradesCount: totalActiveCount,
    activeTradesUnrealizedPnl: Number(activeUnrealizedPnl.toFixed(2)),
    activeTradesMargin: Number(activeMargin.toFixed(2)),
    activePairs,
    hasActiveTrades,
    isRealMondayMorning: isRealMon,
    isSimulated,
    isTriggered,
    isDismissed,
    triggerReason,
  };
}

function formatDate(isoStr: string): string {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length < 3) return isoStr;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
