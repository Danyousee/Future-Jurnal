import React, { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../utils/calculator';
import { TradeJournalEntry } from '../types';

interface BalanceSummaryCardProps {
  totalBalance: number;
  todayProfit: number;
  totalProfitLoss: number;
  trades?: TradeJournalEntry[];
}

function generateSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export const BalanceSummaryCard: React.FC<BalanceSummaryCardProps> = ({
  totalBalance,
  todayProfit,
  totalProfitLoss,
  trades = [],
}) => {
  const isPositiveToday = todayProfit > 0;
  const isNegativeToday = todayProfit < 0;

  const isPositiveTotal = totalProfitLoss > 0;
  const isNegativeTotal = totalProfitLoss < 0;

  // Process real trade history into dynamic Profit and Loss series
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        hasData: false,
        totalGrossProfit: 0,
        totalGrossLoss: 0,
        profitPath: '',
        lossPath: '',
        profitPoints: [] as { x: number; y: number }[],
        lossPoints: [] as { x: number; y: number }[],
      };
    }

    // Sort chronologically
    const sorted = [...trades].sort((a, b) => {
      const timeA = new Date(`${a.date}T${a.time || '00:00'}:00`).getTime();
      const timeB = new Date(`${b.date}T${b.time || '00:00'}:00`).getTime();
      return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
    });

    // Compute cumulative trajectory
    const steps: { profit: number; loss: number }[] = [{ profit: 0, loss: 0 }];
    let runningProfit = 0;
    let runningLoss = 0;

    sorted.forEach((t) => {
      if (t.pnl > 0) {
        runningProfit += t.pnl;
      } else if (t.pnl < 0) {
        runningLoss += Math.abs(t.pnl);
      }
      steps.push({ profit: runningProfit, loss: runningLoss });
    });

    const maxVal = Math.max(
      ...steps.map((s) => Math.max(s.profit, s.loss)),
      10 // ensure non-zero division
    );

    const padLeft = 10;
    const padRight = 10;
    const availW = 320 - padLeft - padRight;
    const availH = 26;
    const bottomY = 36;

    const denom = Math.max(steps.length - 1, 1);

    const profitPoints = steps.map((s, idx) => ({
      x: padLeft + (idx / denom) * availW,
      y: bottomY - (s.profit / maxVal) * availH,
    }));

    const lossPoints = steps.map((s, idx) => ({
      x: padLeft + (idx / denom) * availW,
      y: bottomY - (s.loss / maxVal) * availH,
    }));

    return {
      hasData: true,
      totalGrossProfit: runningProfit,
      totalGrossLoss: runningLoss,
      profitPath: generateSplinePath(profitPoints),
      lossPath: generateSplinePath(lossPoints),
      profitPoints,
      lossPoints,
    };
  }, [trades]);

  const lastProfitPoint = chartData.profitPoints[chartData.profitPoints.length - 1];
  const lastLossPoint = chartData.lossPoints[chartData.lossPoints.length - 1];

  return (
    <div 
      id="balance-summary-card"
      className="w-full max-w-md sm:max-w-lg mx-auto bg-white rounded-xl sm:rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-md shadow-blue-900/10 border border-white/70 space-y-2 transition-all"
    >
      {/* 💼 Total Balance: Largest Value with Wallet Icon */}
      <div className="flex items-center gap-2 pt-0">
        <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#1565ff] shrink-0">
          <Wallet className="w-4 h-4 stroke-[2.2]" />
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
            Total Balance
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight font-mono truncate leading-tight mt-0.5">
            {formatCurrency(totalBalance)}
          </div>
        </div>
      </div>

      {/* Dynamic Metric Rows: Today's Profit & Total Profit/Loss */}
      <div className="space-y-0.5 sm:space-y-1">
        
        {/* Today's Profit */}
        <div className="flex items-center justify-between text-xs leading-tight">
          <span className="text-slate-500 font-medium">Today's Profit</span>
          <div className="flex items-center gap-1.5 font-mono font-bold">
            {isPositiveToday ? (
              <TrendingUp className="w-3.5 h-3.5 text-[#22a65e] shrink-0" />
            ) : isNegativeToday ? (
              <TrendingDown className="w-3.5 h-3.5 text-[#ff3b4a] shrink-0" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className={
              isPositiveToday 
                ? 'text-[#22a65e]' 
                : isNegativeToday 
                  ? 'text-[#ff3b4a]' 
                  : 'text-slate-800'
            }>
              {isPositiveToday ? '+' : ''}{formatCurrency(todayProfit)}
            </span>
          </div>
        </div>

        {/* Total Profit/Loss */}
        <div className="flex items-center justify-between text-xs leading-tight">
          <span className="text-slate-500 font-medium">Total Profit/Loss</span>
          <div className="flex items-center gap-1.5 font-mono font-bold">
            {isPositiveTotal ? (
              <TrendingUp className="w-3.5 h-3.5 text-[#22a65e] shrink-0" />
            ) : isNegativeTotal ? (
              <TrendingDown className="w-3.5 h-3.5 text-[#ff3b4a] shrink-0" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className={
              isPositiveTotal 
                ? 'text-[#22a65e]' 
                : isNegativeTotal 
                  ? 'text-[#ff3b4a]' 
                  : 'text-slate-800'
            }>
              {isPositiveTotal ? '+' : ''}{formatCurrency(totalProfitLoss)}
            </span>
          </div>
        </div>
      </div>

      {/* Profit / Loss Line Chart (Integrated directly on white card surface) */}
      {chartData.hasData && (
        <div 
          id="balance-summary-chart-container"
          className="w-full pt-0.5 flex items-center justify-center"
        >
          <svg 
            className="w-full h-6 sm:h-7" 
            viewBox="0 0 320 44" 
            preserveAspectRatio="none"
            aria-label="Profit and Loss chart"
          >
            {/* Red Smooth Line: Loss */}
            <path
              d={chartData.lossPath}
              fill="none"
              stroke="#ff3b4a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Green Smooth Line: Profit */}
            <path
              d={chartData.profitPath}
              fill="none"
              stroke="#22a65e"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Terminal indicator dots on the lines */}
            {lastLossPoint && (
              <circle
                cx={lastLossPoint.x}
                cy={lastLossPoint.y}
                r="2.5"
                fill="#ff3b4a"
                stroke="#ffffff"
                strokeWidth="1.2"
              />
            )}
            {lastProfitPoint && (
              <circle
                cx={lastProfitPoint.x}
                cy={lastProfitPoint.y}
                r="2.5"
                fill="#22a65e"
                stroke="#ffffff"
                strokeWidth="1.2"
              />
            )}
          </svg>
        </div>
      )}
    </div>
  );
};

