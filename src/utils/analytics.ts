import { 
  TradeJournalEntry, 
  JournalStats, 
  PairStat, 
  MonthlyStat, 
  SmartInsight, 
  TagStat,
  StrategyStat,
  LeverageStat,
  DirectionStat,
  DrawdownMetrics,
  PerformanceScore,
  DailyRiskStatus,
  TradingPlan,
  AiCoachReport
} from '../types';

export function calculateJournalStats(
  trades: TradeJournalEntry[], 
  startingBalanceInput: number = 10000,
  plan?: TradingPlan
): {
  stats: JournalStats;
  pairStats: PairStat[];
  strategyStats: StrategyStat[];
  leverageStats: LeverageStat[];
  directionStats: DirectionStat[];
  monthlyStats: MonthlyStat[];
  drawdownMetrics: DrawdownMetrics;
  performanceScore: PerformanceScore;
  dailyRiskStatus: DailyRiskStatus;
  insights: SmartInsight[];
} {
  const initialBalance = Math.max(100, startingBalanceInput || 10000);

  if (!trades || trades.length === 0) {
    const emptyStats: JournalStats = {
      totalTrades: 0,
      winRate: 0,
      totalPnl: 0,
      totalWins: 0,
      totalLosses: 0,
      totalBreakeven: 0,
      avgRiskReward: 0,
      avgRMultiple: 0,
      profitFactor: 0,
      expectancy: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      winStreak: 0,
      loseStreak: 0,
      currentStreak: { type: 'none', count: 0 },
      bestPair: { pair: 'N/A', pnl: 0, trades: 0 },
      worstPair: { pair: 'N/A', pnl: 0, trades: 0 },
      totalVolume: 0,
      totalFeesPaid: 0,
      totalFundingNet: 0,
      todayPnl: 0,
      weeklyPnl: 0,
      monthlyPnl: 0,
      startingBalance: initialBalance,
      currentEquity: initialBalance,
      totalReturnPct: 0,
      peakEquity: initialBalance,
      currentDrawdown: 0,
      currentDrawdownPct: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
    };

    const emptyDrawdown: DrawdownMetrics = {
      currentDrawdown: 0,
      currentDrawdownPct: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      peakEquity: initialBalance,
      lowestEquity: initialBalance,
      recoveryAmountNeeded: 0,
      recoveryPctNeeded: 0,
      tradesInCurrentDrawdown: 0,
      largestDrawdown: {
        amount: 0,
        pct: 0,
        peakDate: '',
        troughDate: '',
        tradeCount: 0,
      },
      equityCurve: [{ index: 0, date: 'Start', pnl: 0, equity: initialBalance, peak: initialBalance, drawdown: 0, drawdownPct: 0 }],
    };

    const dailyLimit = plan?.maxDailyLossAmount || ((initialBalance * (plan?.maxDailyLossPercent || plan?.maxDailyLossPct || 3)) / 100);

    const emptyScore: PerformanceScore = {
      overall: 0,
      riskManagement: 0,
      drawdownControl: 0,
      consistency: 0,
      planCompliance: 0,
      rrDiscipline: 0,
      stopLossUsage: 0,
      leverageDiscipline: 0,
      overtradingControl: 0,
      grade: 'C',
      summary: 'No trade records found. Start by entering your account balance and risk settings, then log your first trade.',
      strengths: ['Account initialized with clean slate.'],
      weaknesses: ['Awaiting your first trade entry.'],
      recommendations: ['Configure your capital and risk % in Trading Plan, then use the Risk Calculator.'],
    };

    const emptyDaily: DailyRiskStatus = {
      date: new Date().toISOString().split('T')[0],
      startingBalance: initialBalance,
      todayPnl: 0,
      todayGrossLoss: 0,
      todayTradesCount: 0,
      consecutiveLosses: 0,
      dailyLossLimit: dailyLimit,
      remainingLossAllowance: dailyLimit,
      remainingTradesAllowance: plan?.maxTradesPerDay || 5,
      isKillSwitchActive: false,
      killSwitchReasons: [],
    };

    return {
      stats: emptyStats,
      pairStats: [],
      strategyStats: [],
      leverageStats: [],
      directionStats: [],
      monthlyStats: [],
      drawdownMetrics: emptyDrawdown,
      performanceScore: emptyScore,
      dailyRiskStatus: emptyDaily,
      insights: [
        {
          id: 'welcome-capital',
          type: 'info',
          title: 'Step 1: Set Capital & Risk Rules',
          description: `Your starting capital is currently $${initialBalance.toLocaleString()}. Set your risk percentage (1-2% recommended) and daily loss limit in the Trading Plan.`,
          actionAdvice: 'Customize Account Capital & Risk',
        },
        {
          id: 'welcome-sizing',
          type: 'positive',
          title: 'Step 2: Calculate Exact Position Sizing',
          description: 'Use the Risk Calculator before every order to calculate contract quantity, margin required, and liquidation distance with zero guesswork.',
          actionAdvice: 'Open Risk Calculator',
        },
        {
          id: 'welcome-journal',
          type: 'info',
          title: 'Step 3: Log & Audit Every Position',
          description: 'Record entries with tags, emotions, and setup quality. The AI Coach will analyze your edge, win rate, and discipline automatically.',
          actionAdvice: 'Log New Trade',
        },
      ],
    };
  }

  // Sort trades chronologically
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime()
  );

  let totalWins = 0;
  let totalLosses = 0;
  let totalBreakeven = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalPnl = 0;
  let largestWin = 0;
  let largestLoss = 0;
  let totalVolume = 0;
  let totalFeesPaid = 0;
  let totalFundingNet = 0;
  let totalRrRatioSum = 0;
  let tradesWithRrCount = 0;
  let totalRMultipleSum = 0;
  let tradesWithRMultipleCount = 0;

  let maxWinStreak = 0;
  let maxLoseStreak = 0;
  let currentWinStreak = 0;
  let currentLoseStreak = 0;

  // Time boundaries for Today / Week / Month
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayPnl = 0;
  let todayGrossLoss = 0;
  let todayTradesCount = 0;
  let weeklyPnl = 0;
  let monthlyPnl = 0;

  // Categorical Maps
  const pairMap: Record<string, { trades: number; wins: number; losses: number; totalPnl: number; rMultiples: number[]; grossWin: number; grossLoss: number }> = {};
  const strategyMap: Record<string, { trades: number; wins: number; losses: number; totalPnl: number; rMultiples: number[]; grossWin: number; grossLoss: number; maxDd: number }> = {};
  const leverageMap: Record<string, { trades: number; wins: number; losses: number; totalPnl: number; rMultiples: number[]; grossWin: number; grossLoss: number }> = {
    '1-5x': { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0 },
    '5-10x': { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0 },
    '10-20x': { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0 },
    '20-50x': { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0 },
    '50x+': { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0 },
  };
  const directionMap: Record<'LONG' | 'SHORT', { trades: number; wins: number; losses: number; totalPnl: number; rMultiples: number[]; grossWin: number; grossLoss: number }> = {
    LONG: { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0 },
    SHORT: { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0 },
  };
  const monthMap: Record<string, { label: string; pnl: number; trades: number; wins: number; losses: number }> = {};

  // Equity Curve & Drawdown tracking
  let runningEquity = initialBalance;
  let peakEquity = initialBalance;
  let maxDrawdownAmount = 0;
  let maxDrawdownPct = 0;
  let lowestEquity = initialBalance;
  let currentDrawdownTradesCount = 0;

  interface DrawdownPeriodTracker {
    peakDate: string;
    troughDate: string;
    peakVal: number;
    troughVal: number;
    amount: number;
    pct: number;
    tradeCount: number;
  }
  let currentDdPeriod: DrawdownPeriodTracker | null = null;
  let largestHistoricalDdPeriod: DrawdownPeriodTracker = {
    peakDate: '',
    troughDate: '',
    peakVal: initialBalance,
    troughVal: initialBalance,
    amount: 0,
    pct: 0,
    tradeCount: 0,
  };

  const equityCurve: DrawdownMetrics['equityCurve'] = [
    { index: 0, date: sortedTrades[0]?.date || 'Start', pnl: 0, equity: initialBalance, peak: initialBalance, drawdown: 0, drawdownPct: 0 }
  ];

  // Plan compliance counters
  let compliantTradesCount = 0;
  let tradesWithStopLossCount = 0;
  let excessiveLeverageTradesCount = 0;
  let excessiveRiskTradesCount = 0;

  sortedTrades.forEach((trade, idx) => {
    const pnl = trade.pnl || 0;
    totalPnl += pnl;
    runningEquity += pnl;
    if (runningEquity < lowestEquity) lowestEquity = runningEquity;

    // Volume & fees
    const size = trade.positionSize || 0;
    totalVolume += size;
    const feeRate = (trade.tradingFee || 0.055) / 100;
    const feeVal = (trade.makerFee || 0) + (trade.takerFee || 0) || (size * feeRate * 2);
    totalFeesPaid += feeVal;
    totalFundingNet += trade.fundingCost || 0;

    // Time buckets
    const tradeDateObj = new Date(`${trade.date}T${trade.time || '12:00'}`);
    if (trade.date === todayStr) {
      todayPnl += pnl;
      todayTradesCount++;
      if (pnl < -0.001) todayGrossLoss += Math.abs(pnl);
    }
    if (tradeDateObj >= oneWeekAgo) {
      weeklyPnl += pnl;
    }
    if (tradeDateObj >= startOfMonth) {
      monthlyPnl += pnl;
    }

    // R:R & R-Multiple
    let tradeRMultiple = trade.rMultiple;
    if (tradeRMultiple === undefined) {
      if (trade.riskAmount && trade.riskAmount > 0) {
        tradeRMultiple = pnl / trade.riskAmount;
      } else if (trade.stopLoss && trade.entryPrice) {
        const dist = Math.abs(trade.entryPrice - trade.stopLoss);
        if (dist > 0 && trade.quantity) {
          const calculatedRisk = dist * trade.quantity;
          tradeRMultiple = calculatedRisk > 0 ? pnl / calculatedRisk : 0;
        }
      }
    }
    if (tradeRMultiple !== undefined) {
      totalRMultipleSum += tradeRMultiple;
      tradesWithRMultipleCount++;
    }

    if (trade.stopLoss && trade.takeProfit && trade.entryPrice) {
      const riskDistance = Math.abs(trade.entryPrice - trade.stopLoss);
      const rewardDistance = Math.abs(trade.takeProfit - trade.entryPrice);
      if (riskDistance > 0) {
        totalRrRatioSum += rewardDistance / riskDistance;
        tradesWithRrCount++;
      }
    }

    // Plan compliance checks
    if (trade.stopLoss && trade.stopLoss > 0) tradesWithStopLossCount++;
    if (trade.leverage > 25) excessiveLeverageTradesCount++;
    if (trade.riskPercentage && trade.riskPercentage > 3.0) excessiveRiskTradesCount++;
    if (trade.planCompliance !== false) compliantTradesCount++;

    // Win / Loss classification
    if (pnl > 0.001) {
      totalWins++;
      grossProfit += pnl;
      if (pnl > largestWin) largestWin = pnl;

      currentWinStreak++;
      currentLoseStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (pnl < -0.001) {
      totalLosses++;
      grossLoss += Math.abs(pnl);
      if (pnl < largestLoss) largestLoss = pnl;

      currentLoseStreak++;
      currentWinStreak = 0;
      if (currentLoseStreak > maxLoseStreak) maxLoseStreak = currentLoseStreak;
    } else {
      totalBreakeven++;
    }

    // Equity Curve & Drawdown calculation
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
      currentDrawdownTradesCount = 0;
      currentDdPeriod = null;
    } else {
      currentDrawdownTradesCount++;
      const currentDdAmount = peakEquity - runningEquity;
      const currentDdPct = peakEquity > 0 ? (currentDdAmount / peakEquity) * 100 : 0;

      if (!currentDdPeriod) {
        currentDdPeriod = {
          peakDate: sortedTrades[idx - 1]?.date || trade.date,
          troughDate: trade.date,
          peakVal: peakEquity,
          troughVal: runningEquity,
          amount: currentDdAmount,
          pct: currentDdPct,
          tradeCount: 1,
        };
      } else {
        currentDdPeriod.troughDate = trade.date;
        currentDdPeriod.troughVal = Math.min(currentDdPeriod.troughVal, runningEquity);
        currentDdPeriod.amount = Math.max(currentDdPeriod.amount, currentDdAmount);
        currentDdPeriod.pct = Math.max(currentDdPeriod.pct, currentDdPct);
        currentDdPeriod.tradeCount++;
      }

      if (currentDdPeriod.amount > largestHistoricalDdPeriod.amount) {
        largestHistoricalDdPeriod = { ...currentDdPeriod };
      }
    }

    const curDd = peakEquity - runningEquity;
    const curDdPct = peakEquity > 0 ? (curDd / peakEquity) * 100 : 0;
    if (curDd > maxDrawdownAmount) maxDrawdownAmount = curDd;
    if (curDdPct > maxDrawdownPct) maxDrawdownPct = curDdPct;

    equityCurve.push({
      index: idx + 1,
      date: trade.date,
      tradeId: trade.id,
      pair: trade.pair,
      pnl,
      equity: runningEquity,
      peak: peakEquity,
      drawdown: curDd,
      drawdownPct: curDdPct,
    });

    // Pair breakdown
    const cleanPair = (trade.pair || 'UNKNOWN').toUpperCase().replace('/', '').trim();
    if (!pairMap[cleanPair]) {
      pairMap[cleanPair] = { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0 };
    }
    pairMap[cleanPair].trades++;
    pairMap[cleanPair].totalPnl += pnl;
    if (tradeRMultiple !== undefined) pairMap[cleanPair].rMultiples.push(tradeRMultiple);
    if (pnl > 0.001) {
      pairMap[cleanPair].wins++;
      pairMap[cleanPair].grossWin += pnl;
    } else if (pnl < -0.001) {
      pairMap[cleanPair].losses++;
      pairMap[cleanPair].grossLoss += Math.abs(pnl);
    }

    // Strategy & Setup breakdown
    const strategyName = trade.setup || trade.strategy || 'Discretionary';
    if (!strategyMap[strategyName]) {
      strategyMap[strategyName] = { trades: 0, wins: 0, losses: 0, totalPnl: 0, rMultiples: [], grossWin: 0, grossLoss: 0, maxDd: 0 };
    }
    strategyMap[strategyName].trades++;
    strategyMap[strategyName].totalPnl += pnl;
    if (tradeRMultiple !== undefined) strategyMap[strategyName].rMultiples.push(tradeRMultiple);
    if (pnl > 0.001) {
      strategyMap[strategyName].wins++;
      strategyMap[strategyName].grossWin += pnl;
    } else if (pnl < -0.001) {
      strategyMap[strategyName].losses++;
      strategyMap[strategyName].grossLoss += Math.abs(pnl);
    }

    // Direction breakdown
    const dir: 'LONG' | 'SHORT' = trade.direction === 'SHORT' ? 'SHORT' : 'LONG';
    directionMap[dir].trades++;
    directionMap[dir].totalPnl += pnl;
    if (tradeRMultiple !== undefined) directionMap[dir].rMultiples.push(tradeRMultiple);
    if (pnl > 0.001) {
      directionMap[dir].wins++;
      directionMap[dir].grossWin += pnl;
    } else if (pnl < -0.001) {
      directionMap[dir].losses++;
      directionMap[dir].grossLoss += Math.abs(pnl);
    }

    // Leverage range breakdown
    const lev = trade.leverage || 1;
    let levKey: LeverageStat['range'] = '1-5x';
    if (lev > 50) levKey = '50x+';
    else if (lev > 20) levKey = '20-50x';
    else if (lev > 10) levKey = '10-20x';
    else if (lev > 5) levKey = '5-10x';

    leverageMap[levKey].trades++;
    leverageMap[levKey].totalPnl += pnl;
    if (tradeRMultiple !== undefined) leverageMap[levKey].rMultiples.push(tradeRMultiple);
    if (pnl > 0.001) {
      leverageMap[levKey].wins++;
      leverageMap[levKey].grossWin += pnl;
    } else if (pnl < -0.001) {
      leverageMap[levKey].losses++;
      leverageMap[levKey].grossLoss += Math.abs(pnl);
    }

    // Monthly breakdown
    const dateObj = new Date(trade.date);
    const monthKey = !isNaN(dateObj.getTime())
      ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
      : 'Unknown';
    const monthLabel = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' })
      : 'Unknown';

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { label: monthLabel, pnl: 0, trades: 0, wins: 0, losses: 0 };
    }
    monthMap[monthKey].pnl += pnl;
    monthMap[monthKey].trades++;
    if (pnl > 0.001) monthMap[monthKey].wins++;
    else if (pnl < -0.001) monthMap[monthKey].losses++;
  });

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
  const avgWin = totalWins > 0 ? grossProfit / totalWins : 0;
  const avgLoss = totalLosses > 0 ? grossLoss / totalLosses : 0;
  const avgRiskReward = tradesWithRrCount > 0 ? totalRrRatioSum / tradesWithRrCount : 0;
  const avgRMultiple = tradesWithRMultipleCount > 0 ? totalRMultipleSum / tradesWithRMultipleCount : 0;
  const lossRate = totalTrades > 0 ? totalLosses / totalTrades : 0;
  const winRateFrac = totalTrades > 0 ? totalWins / totalTrades : 0;
  const expectancy = (winRateFrac * avgWin) - (lossRate * avgLoss);
  const totalReturnPct = initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;
  const currentDrawdownAmount = Math.max(0, peakEquity - runningEquity);
  const currentDrawdownPct = peakEquity > 0 ? (currentDrawdownAmount / peakEquity) * 100 : 0;
  const recoveryAmountNeeded = currentDrawdownAmount;
  const recoveryPctNeeded = runningEquity > 0 ? (recoveryAmountNeeded / runningEquity) * 100 : 0;

  // Pair stats array
  const pairStats: PairStat[] = Object.entries(pairMap).map(([pair, data]) => {
    const avgR = data.rMultiples.length > 0
      ? data.rMultiples.reduce((acc, v) => acc + v, 0) / data.rMultiples.length
      : 0;
    const pf = data.grossLoss > 0 ? data.grossWin / data.grossLoss : data.grossWin > 0 ? 99.9 : 0;
    return {
      pair,
      trades: data.trades,
      wins: data.wins,
      losses: data.losses,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      totalPnl: data.totalPnl,
      avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
      avgR,
      profitFactor: pf,
    };
  }).sort((a, b) => b.totalPnl - a.totalPnl);

  const bestPair = pairStats.length > 0
    ? { pair: pairStats[0].pair, pnl: pairStats[0].totalPnl, trades: pairStats[0].trades }
    : { pair: 'N/A', pnl: 0, trades: 0 };

  const worstPair = pairStats.length > 0
    ? { pair: pairStats[pairStats.length - 1].pair, pnl: pairStats[pairStats.length - 1].totalPnl, trades: pairStats[pairStats.length - 1].trades }
    : { pair: 'N/A', pnl: 0, trades: 0 };

  // Strategy stats array
  const strategyStats: StrategyStat[] = Object.entries(strategyMap).map(([strategy, data]) => {
    const avgR = data.rMultiples.length > 0
      ? data.rMultiples.reduce((acc, v) => acc + v, 0) / data.rMultiples.length
      : 0;
    const pf = data.grossLoss > 0 ? data.grossWin / data.grossLoss : data.grossWin > 0 ? 99.9 : 0;
    const avgW = data.wins > 0 ? data.grossWin / data.wins : 0;
    const avgL = data.losses > 0 ? data.grossLoss / data.losses : 0;
    return {
      strategy,
      trades: data.trades,
      wins: data.wins,
      losses: data.losses,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      totalPnl: data.totalPnl,
      avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
      avgR,
      profitFactor: pf,
      avgWin: avgW,
      avgLoss: avgL,
      maxDrawdown: data.maxDd,
    };
  }).sort((a, b) => b.totalPnl - a.totalPnl);

  // Leverage stats array
  const leverageStats: LeverageStat[] = (['1-5x', '5-10x', '10-20x', '20-50x', '50x+'] as LeverageStat['range'][]).map((range) => {
    const data = leverageMap[range];
    const avgR = data.rMultiples.length > 0
      ? data.rMultiples.reduce((acc, v) => acc + v, 0) / data.rMultiples.length
      : 0;
    const pf = data.grossLoss > 0 ? data.grossWin / data.grossLoss : data.grossWin > 0 ? 99.9 : 0;
    return {
      range,
      trades: data.trades,
      wins: data.wins,
      losses: data.losses,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      totalPnl: data.totalPnl,
      avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
      avgR,
      profitFactor: pf,
    };
  });

  // Direction stats array
  const directionStats: DirectionStat[] = (['LONG', 'SHORT'] as const).map((direction) => {
    const data = directionMap[direction];
    const avgR = data.rMultiples.length > 0
      ? data.rMultiples.reduce((acc, v) => acc + v, 0) / data.rMultiples.length
      : 0;
    const pf = data.grossLoss > 0 ? data.grossWin / data.grossLoss : data.grossWin > 0 ? 99.9 : 0;
    return {
      direction,
      trades: data.trades,
      wins: data.wins,
      losses: data.losses,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      totalPnl: data.totalPnl,
      avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
      avgR,
      profitFactor: pf,
      avgTrade: data.trades > 0 ? data.totalPnl / data.trades : 0,
    };
  });

  // Monthly stats
  const monthlyStats: MonthlyStat[] = Object.entries(monthMap).map(([monthKey, data]) => ({
    monthKey,
    label: data.label,
    pnl: data.pnl,
    trades: data.trades,
    wins: data.wins,
    losses: data.losses,
    winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  // Current streak
  let currentStreak: { type: 'win' | 'loss' | 'none'; count: number } = { type: 'none', count: 0 };
  if (currentWinStreak > 0) {
    currentStreak = { type: 'win', count: currentWinStreak };
  } else if (currentLoseStreak > 0) {
    currentStreak = { type: 'loss', count: currentLoseStreak };
  }

  const stats: JournalStats = {
    totalTrades,
    winRate,
    totalPnl,
    totalWins,
    totalLosses,
    totalBreakeven,
    avgRiskReward,
    avgRMultiple,
    profitFactor,
    expectancy,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    winStreak: maxWinStreak,
    loseStreak: maxLoseStreak,
    currentStreak,
    bestPair,
    worstPair,
    totalVolume,
    totalFeesPaid,
    totalFundingNet,
    todayPnl,
    weeklyPnl,
    monthlyPnl,
    startingBalance: initialBalance,
    currentEquity: runningEquity,
    totalReturnPct,
    peakEquity,
    currentDrawdown: currentDrawdownAmount,
    currentDrawdownPct,
    maxDrawdown: maxDrawdownAmount,
    maxDrawdownPct,
  };

  const drawdownMetrics: DrawdownMetrics = {
    currentDrawdown: currentDrawdownAmount,
    currentDrawdownPct,
    maxDrawdown: maxDrawdownAmount,
    maxDrawdownPct,
    peakEquity,
    lowestEquity,
    recoveryAmountNeeded,
    recoveryPctNeeded,
    tradesInCurrentDrawdown: currentDrawdownTradesCount,
    largestDrawdown: {
      amount: largestHistoricalDdPeriod.amount,
      pct: largestHistoricalDdPeriod.pct,
      peakDate: largestHistoricalDdPeriod.peakDate,
      troughDate: largestHistoricalDdPeriod.troughDate,
      tradeCount: largestHistoricalDdPeriod.tradeCount,
    },
    equityCurve,
  };

  // Performance Score Engine
  const performanceScore = computePerformanceScore({
    totalTrades,
    winRate,
    profitFactor,
    avgRiskReward,
    avgRMultiple,
    maxDrawdownPct,
    currentDrawdownPct,
    tradesWithStopLossCount,
    compliantTradesCount,
    excessiveLeverageTradesCount,
    excessiveRiskTradesCount,
    maxLoseStreak,
    expectancy,
  });

  // Daily Risk Status & Kill Switch
  const maxDailyLossAllowed = plan?.maxDailyLossAmount || (initialBalance * (plan?.maxDailyLossPercent || 3) / 100);
  const remainingLossAllowance = Math.max(0, maxDailyLossAllowed - todayGrossLoss);
  const maxTradesAllowed = plan?.maxTradesPerDay || 5;
  const remainingTradesAllowance = Math.max(0, maxTradesAllowed - todayTradesCount);

  const killSwitchReasons: string[] = [];
  if (todayGrossLoss >= maxDailyLossAllowed) {
    killSwitchReasons.push(`Daily loss limit reached ($${todayGrossLoss.toFixed(2)} / $${maxDailyLossAllowed.toFixed(2)}).`);
  }
  if (todayTradesCount >= maxTradesAllowed) {
    killSwitchReasons.push(`Daily trade volume ceiling reached (${todayTradesCount} / ${maxTradesAllowed} trades).`);
  }
  if (currentLoseStreak >= (plan?.maxConsecutiveLosses || 3)) {
    killSwitchReasons.push(`Consecutive losses ceiling reached (${currentLoseStreak} in a row). Tilt prevention active.`);
  }

  const isKillSwitchActive = plan?.killSwitchActive || killSwitchReasons.length > 0;

  const dailyRiskStatus: DailyRiskStatus = {
    date: todayStr,
    startingBalance: initialBalance,
    todayPnl,
    todayGrossLoss,
    todayTradesCount,
    consecutiveLosses: currentLoseStreak,
    dailyLossLimit: maxDailyLossAllowed,
    remainingLossAllowance,
    remainingTradesAllowance,
    isKillSwitchActive,
    killSwitchReasons,
  };

  // Smart Insights Generation
  const insights = generateSmartInsights({
    stats,
    pairStats,
    strategyStats,
    leverageStats,
    directionStats,
    performanceScore,
    dailyRiskStatus,
  });

  return {
    stats,
    pairStats,
    strategyStats,
    leverageStats,
    directionStats,
    monthlyStats,
    drawdownMetrics,
    performanceScore,
    dailyRiskStatus,
    insights,
  };
}

export function computePerformanceScore(params: {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgRiskReward: number;
  avgRMultiple: number;
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  tradesWithStopLossCount: number;
  compliantTradesCount: number;
  excessiveLeverageTradesCount: number;
  excessiveRiskTradesCount: number;
  maxLoseStreak: number;
  expectancy: number;
}): PerformanceScore {
  const {
    totalTrades,
    winRate,
    profitFactor,
    avgRiskReward,
    avgRMultiple,
    maxDrawdownPct,
    currentDrawdownPct,
    tradesWithStopLossCount,
    compliantTradesCount,
    excessiveLeverageTradesCount,
    excessiveRiskTradesCount,
    maxLoseStreak,
    expectancy,
  } = params;

  if (totalTrades === 0) {
    return {
      overall: 50,
      riskManagement: 50,
      drawdownControl: 50,
      consistency: 50,
      planCompliance: 50,
      rrDiscipline: 50,
      stopLossUsage: 50,
      leverageDiscipline: 50,
      overtradingControl: 50,
      grade: 'C',
      summary: 'Log initial trades to calculate your performance score.',
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };
  }

  // 1. Risk Management (0-100)
  const excessiveRiskRatio = excessiveRiskTradesCount / totalTrades;
  let riskMgmt = Math.round(100 - (excessiveRiskRatio * 70));
  if (excessiveRiskTradesCount === 0) riskMgmt = 96;

  // 2. Drawdown Control (0-100)
  let ddScore = 100;
  if (maxDrawdownPct > 30) ddScore = 35;
  else if (maxDrawdownPct > 20) ddScore = 55;
  else if (maxDrawdownPct > 12) ddScore = 72;
  else if (maxDrawdownPct > 6) ddScore = 88;
  else ddScore = 98;
  if (currentDrawdownPct > 10) ddScore = Math.max(20, ddScore - 20);

  // 3. Consistency (0-100)
  let consistencyScore = 50;
  if (profitFactor >= 2.0 && winRate >= 50) consistencyScore = 94;
  else if (profitFactor >= 1.5 && winRate >= 45) consistencyScore = 84;
  else if (profitFactor >= 1.1) consistencyScore = 70;
  else if (profitFactor >= 0.8) consistencyScore = 50;
  else consistencyScore = 32;

  // 4. Plan Compliance (0-100)
  const complianceRatio = compliantTradesCount / totalTrades;
  const planScore = Math.round(complianceRatio * 100);

  // 5. R:R Discipline (0-100)
  let rrScore = 50;
  if (avgRiskReward >= 2.5 || avgRMultiple >= 1.5) rrScore = 95;
  else if (avgRiskReward >= 1.8 || avgRMultiple >= 0.8) rrScore = 82;
  else if (avgRiskReward >= 1.2 || avgRMultiple >= 0.2) rrScore = 68;
  else rrScore = 40;

  // 6. Stop Loss Usage (0-100)
  const slRatio = tradesWithStopLossCount / totalTrades;
  const slScore = Math.round(slRatio * 100);

  // 7. Leverage Discipline (0-100)
  const levRatio = excessiveLeverageTradesCount / totalTrades;
  let levScore = Math.round(100 - (levRatio * 80));
  if (excessiveLeverageTradesCount === 0) levScore = 98;

  // 8. Overtrading Control (0-100)
  let overtradingScore = 85;
  if (maxLoseStreak >= 5) overtradingScore = 45;
  else if (maxLoseStreak >= 3) overtradingScore = 68;
  else overtradingScore = 92;

  // Overall Weighted Score
  const overall = Math.round(
    (riskMgmt * 0.18) +
    (ddScore * 0.16) +
    (consistencyScore * 0.14) +
    (planScore * 0.14) +
    (rrScore * 0.12) +
    (slScore * 0.10) +
    (levScore * 0.10) +
    (overtradingScore * 0.06)
  );

  let grade: PerformanceScore['grade'] = 'C';
  if (overall >= 92) grade = 'A+';
  else if (overall >= 84) grade = 'A';
  else if (overall >= 72) grade = 'B';
  else if (overall >= 60) grade = 'C';
  else if (overall >= 45) grade = 'D';
  else grade = 'F';

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (slScore >= 90) strengths.push('Excellent Stop-Loss discipline; rarely enters unhedged positions.');
  else weaknesses.push(`Stop-Loss skipped on ${(100 - slScore).toFixed(0)}% of trades, exposing capital to liquidation.`);

  if (levScore >= 90) strengths.push('Healthy leverage distribution without revenge over-leveraging.');
  else weaknesses.push('Frequent use of high leverage (>25x) increases volatility sensitivity.');

  if (planScore >= 85) strengths.push('Strong plan compliance; respects predefined risk criteria.');
  else weaknesses.push(`Plan violations noted on ${(100 - planScore).toFixed(0)}% of logged trades.`);

  if (ddScore >= 85) strengths.push('Controlled equity drawdown; capital preservation is active.');
  else weaknesses.push(`Historical max drawdown reached ${maxDrawdownPct.toFixed(1)}%.`);

  if (rrScore >= 80) strengths.push(`Strong asymmetric payouts with average ${avgRiskReward.toFixed(2)} R:R.`);
  else recommendations.push('Filter for higher quality setups with at least 1:2.0 projected R:R.');

  if (expectancy > 0) strengths.push(`Positive mathematical expectancy of +$${expectancy.toFixed(2)} per trade.`);
  else recommendations.push('Address negative expectancy by cutting losing trades faster.');

  return {
    overall,
    riskManagement: riskMgmt,
    drawdownControl: ddScore,
    consistency: consistencyScore,
    planCompliance: planScore,
    rrDiscipline: rrScore,
    stopLossUsage: slScore,
    leverageDiscipline: levScore,
    overtradingControl: overtradingScore,
    grade,
    summary: `Your Crypto Perpetual Performance Score is ${overall}/100 (Grade ${grade}). ${
      overall >= 80
        ? 'Your risk framework and discipline reflect institutional standards.'
        : 'Key opportunities exist in tightening risk parameters and maintaining strict stop-loss adherence.'
    }`,
    strengths,
    weaknesses,
    recommendations,
  };
}

export function generateSmartInsights(data: {
  stats: JournalStats;
  pairStats: PairStat[];
  strategyStats: StrategyStat[];
  leverageStats: LeverageStat[];
  directionStats: DirectionStat[];
  performanceScore: PerformanceScore;
  dailyRiskStatus: DailyRiskStatus;
}): SmartInsight[] {
  const { stats, pairStats, strategyStats, leverageStats, directionStats, dailyRiskStatus } = data;
  const insights: SmartInsight[] = [];

  // Kill Switch Notice
  if (dailyRiskStatus.isKillSwitchActive) {
    insights.push({
      id: 'kill-switch-active',
      type: 'danger',
      title: '🛑 KILL SWITCH ACTIVE: Cease Trading',
      description: dailyRiskStatus.killSwitchReasons.join(' '),
      category: 'risk',
      actionAdvice: 'Close charts, step away from the desk, and resume only on the next trading day after a planned reset.',
    });
  }

  // Edge & Profit Factor
  if (stats.profitFactor >= 2.0) {
    insights.push({
      id: 'pf-high',
      type: 'positive',
      title: 'Systematic Trading Advantage',
      description: `Profit factor is ${stats.profitFactor.toFixed(2)}. Gross winnings generate more than 2x gross losses.`,
      metric: `Profit Factor: ${stats.profitFactor.toFixed(2)}`,
      category: 'strategy',
      actionAdvice: 'Protect your psychological edge by not increasing size precipitously during win streaks.',
    });
  } else if (stats.profitFactor > 0 && stats.profitFactor < 1.0) {
    insights.push({
      id: 'pf-low',
      type: 'danger',
      title: 'Negative Expectancy Warning',
      description: `Profit factor is ${stats.profitFactor.toFixed(2)} (< 1.0). Total losses currently exceed gross gains.`,
      metric: `PF: ${stats.profitFactor.toFixed(2)}`,
      category: 'risk',
      actionAdvice: 'Enforce strict 1:2+ R:R rules and review stop loss positioning.',
    });
  }

  // Best Asset
  if (pairStats.length > 0 && pairStats[0].totalPnl > 0) {
    const best = pairStats[0];
    insights.push({
      id: 'best-asset',
      type: 'positive',
      title: `Top Performer: ${best.pair}`,
      description: `${best.pair} has yielded +$${best.totalPnl.toFixed(2)} with a ${best.winRate.toFixed(1)}% win rate across ${best.trades} trades.`,
      metric: `+$${best.totalPnl.toFixed(2)} Net`,
      category: 'asset',
      actionAdvice: `Prioritize ${best.pair} setups where your chart analysis produces the highest R multiple.`,
    });
  }

  // Worst Asset Warning
  if (pairStats.length > 1 && pairStats[pairStats.length - 1].totalPnl < 0) {
    const worst = pairStats[pairStats.length - 1];
    insights.push({
      id: 'worst-asset',
      type: 'warning',
      title: `Underperforming Asset: ${worst.pair}`,
      description: `${worst.pair} has accumulated -$${Math.abs(worst.totalPnl).toFixed(2)} in net losses (${worst.trades} trades).`,
      metric: `-$${Math.abs(worst.totalPnl).toFixed(2)} Net`,
      category: 'asset',
      actionAdvice: `Pause trading ${worst.pair} or trade with half-size until market regime clarity improves.`,
    });
  }

  // Leverage Trap Detection
  const highLev = leverageStats.find((l) => l.range === '20-50x' || l.range === '50x+');
  const lowLev = leverageStats.find((l) => l.range === '1-5x' || l.range === '5-10x');
  if (highLev && highLev.trades >= 3 && highLev.totalPnl < 0 && lowLev && lowLev.totalPnl > 0) {
    insights.push({
      id: 'leverage-trap',
      type: 'danger',
      title: 'High Leverage Asymmetry Detected',
      description: `Trades above 20x leverage have yielded -$${Math.abs(highLev.totalPnl).toFixed(2)}, whereas disciplined leverage (<10x) has produced +$${lowLev.totalPnl.toFixed(2)}.`,
      metric: `>20x P&L: -$${Math.abs(highLev.totalPnl).toFixed(2)}`,
      category: 'leverage',
      actionAdvice: 'Cap maximum account leverage at 10x to prevent volatility liquidation wick outs.',
    });
  }

  // Long vs Short Balance
  const longStat = directionStats.find((d) => d.direction === 'LONG');
  const shortStat = directionStats.find((d) => d.direction === 'SHORT');
  if (longStat && shortStat && longStat.trades >= 3 && shortStat.trades >= 3) {
    if (longStat.totalPnl > 0 && shortStat.totalPnl < 0) {
      insights.push({
        id: 'long-bias',
        type: 'info',
        title: 'Long Side Dominance',
        description: `Long trades are producing +$${longStat.totalPnl.toFixed(2)} (${longStat.winRate.toFixed(1)}% win rate) while Short trades are net negative (-$${Math.abs(shortStat.totalPnl).toFixed(2)}).`,
        metric: `Longs: +$${longStat.totalPnl.toFixed(2)}`,
        category: 'strategy',
        actionAdvice: 'Ensure you are not shorting strong HTF crypto momentum trends against the structural market flow.',
      });
    }
  }

  // Tilt & Streak Detection
  if (stats.currentStreak.type === 'loss' && stats.currentStreak.count >= 3) {
    insights.push({
      id: 'tilt-warning',
      type: 'danger',
      title: `Drawdown Tilt Alert: ${stats.currentStreak.count} Consecutive Losses`,
      description: 'Consecutive losses increase susceptibility to emotional revenge trading and oversized positioning.',
      metric: `${stats.currentStreak.count} Losses in a row`,
      category: 'psychology',
      actionAdvice: 'Mandatory 2-hour break or reduce position risk to 0.5% on the next 2 trades.',
    });
  }

  return insights;
}

export function generateAlgorithmicCoachReport(
  trades: TradeJournalEntry[],
  startingBalance: number = 10000,
  plan?: TradingPlan
): AiCoachReport {
  if (!trades || trades.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      isAiGenerated: false,
      executiveSummary: `Your trading journal currently contains 0 trades. Enter your starting capital and risk parameters in the Trading Plan, calculate your position size before entering orders, and log your executions. The AI Coach will deliver deep quantitative edge analysis, mistake diagnostics, and behavioral coaching as you record trades.`,
      strengths: [
        'Clean slate initialized with zero inherited drawdowns or biases.',
        `Starting account capital established at $${startingBalance.toLocaleString()}.`,
        'Position Sizing and Pre-Trade Risk Gate ready to protect capital on trade #1.',
      ],
      criticalRisks: [
        'Unplanned position sizing: Always calculate position size from stop-loss distance, never guess contract quantities.',
        'High leverage temptation: Keep leverage under 10x-15x until your edge and win rate are statistically confirmed.',
        'Overtrading: Define your daily trade limit (e.g. 3-5 trades) in the Trading Plan.',
      ],
      keyBehavioralPatterns: [
        {
          title: 'Pre-Trade Risk Protocol',
          observation: 'No trades recorded yet. First trades set the psychological baseline for disciplined execution.',
          impact: 'positive',
          recommendation: 'Use the Risk Calculator to determine exact margin and liquidation price before pressing submit on your exchange.',
        },
        {
          title: 'Emotion & Mistake Tagging',
          observation: 'Journaling emotional states (FOMO, Greed, Fear) helps uncover psychological leaks early.',
          impact: 'positive',
          recommendation: 'Tag every trade with your setup quality and emotional state when opening and closing positions.',
        },
      ],
      bestPerformingCrypto: {
        pair: 'Awaiting Trades',
        winRate: 0,
        avgR: 0,
        pnl: 0,
        insight: 'Log positions across BTC, ETH, or altcoins to determine your highest expected value pair.',
      },
      worstPerformingCrypto: {
        pair: 'Awaiting Trades',
        winRate: 0,
        avgR: 0,
        pnl: 0,
        insight: 'Underperforming pairs will be flagged automatically to protect capital.',
      },
      bestStrategy: {
        name: 'Awaiting Trades',
        winRate: 0,
        avgR: 0,
        pnl: 0,
      },
      worstStrategy: {
        name: 'Awaiting Trades',
        winRate: 0,
        avgR: 0,
        pnl: 0,
      },
      longVsShortInsight: 'Long and Short performance diagnostics will calculate once trade records exist.',
      leverageDisciplineInsight: 'Leverage impact and liquidation risk will evaluate as positions are logged.',
      stopLossDisciplineInsight: 'Stop-loss discipline tracking will activate once trades are entered.',
      revengeTradingDetected: false,
      overtradingDetected: false,
      actionPlan: [
        '1. Configure your account starting balance and default risk % (1-2%) in the Trading Plan.',
        '2. Use the Risk Calculator to calculate exact contract size and margin for your first trade.',
        '3. Log your entry with screenshots, strategy tag, and emotional state in the Trading Journal.',
        '4. Revisit the AI Coach after logging 5-10 trades for personalized statistical edge diagnostics.',
      ],
    };
  }

  const analytics = calculateJournalStats(trades, startingBalance, plan);
  const { stats, pairStats, strategyStats, leverageStats, directionStats, drawdownMetrics } = analytics;

  const bestCrypto = pairStats[0] || { pair: 'BTCUSDT', winRate: 0, avgR: 0, totalPnl: 0, trades: 0 };
  const worstCrypto = pairStats.length > 1 ? pairStats[pairStats.length - 1] : { pair: 'N/A', winRate: 0, avgR: 0, totalPnl: 0, trades: 0 };

  const bestStrat = strategyStats[0] || { strategy: 'Breakout', winRate: 0, avgR: 0, totalPnl: 0 };
  const worstStrat = strategyStats.length > 1 ? strategyStats[strategyStats.length - 1] : { strategy: 'N/A', winRate: 0, avgR: 0, totalPnl: 0 };

  const longStat = directionStats.find((d) => d.direction === 'LONG');
  const shortStat = directionStats.find((d) => d.direction === 'SHORT');

  const highLevStats = leverageStats.filter((l) => l.range === '20-50x' || l.range === '50x+');
  const totalHighLevTrades = highLevStats.reduce((acc, l) => acc + l.trades, 0);
  const totalHighLevPnl = highLevStats.reduce((acc, l) => acc + l.totalPnl, 0);

  const revengeTradingDetected = stats.loseStreak >= 3 && stats.totalLosses > 0;
  const overtradingDetected = stats.totalTrades > 20 && stats.winRate < 45;

  const actionPlan: string[] = [];
  if (stats.winRate < 45) {
    actionPlan.push('Require at least 1:2.5 projected Risk:Reward before taking any entry.');
  }
  if (totalHighLevPnl < 0 && totalHighLevTrades > 0) {
    actionPlan.push('Hard-cap leverage at 10x in your Trading Plan settings.');
  }
  if (worstCrypto.totalPnl < 0) {
    actionPlan.push(`Temporarily remove ${worstCrypto.pair} from your active daily watchlist.`);
  }
  if (drawdownMetrics.currentDrawdownPct > 10) {
    actionPlan.push('Reduce risk per trade to 0.50% until equity recovers 50% of the current drawdown.');
  }
  actionPlan.push('Always log entry screenshots and review emotional state before execution.');

  return {
    generatedAt: new Date().toISOString(),
    isAiGenerated: false,
    executiveSummary: `Based on your journal of ${stats.totalTrades} cryptocurrency perpetual trades, your net P&L is ${
      stats.totalPnl >= 0 ? '+' : ''
    }$${stats.totalPnl.toFixed(2)} with a ${stats.winRate.toFixed(1)}% win rate and a Profit Factor of ${stats.profitFactor.toFixed(
      2
    )}. Your average trade payout is ${stats.avgRMultiple >= 0 ? '+' : ''}${stats.avgRMultiple.toFixed(2)}R.`,
    strengths: [
      `Strongest performance on ${bestCrypto.pair} (+$${bestCrypto.totalPnl.toFixed(2)} net).`,
      `Best strategy setup is "${bestStrat.strategy}" with ${bestStrat.winRate.toFixed(1)}% win rate.`,
      `Average winning trade generates +$${stats.avgWin.toFixed(2)}.`,
    ],
    criticalRisks: [
      drawdownMetrics.maxDrawdownPct > 15
        ? `Maximum historical drawdown reached ${drawdownMetrics.maxDrawdownPct.toFixed(1)}%.`
        : 'Maintain strict stop-loss adherence across volatile market conditions.',
      worstCrypto.totalPnl < 0
        ? `${worstCrypto.pair} accounts for -$${Math.abs(worstCrypto.totalPnl).toFixed(2)} in losses.`
        : 'Ensure position size remains strictly calculated per account risk %.',
      totalHighLevTrades > 0 && totalHighLevPnl < 0
        ? `High leverage trades (>20x) are causing disproportionate drawdowns (-$${Math.abs(totalHighLevPnl).toFixed(2)}).`
        : 'Keep leverage aligned with volatility and stop distance.',
    ],
    keyBehavioralPatterns: [
      {
        title: 'Cryptocurrency Instrument Selectivity',
        observation: `Your ${bestCrypto.pair} trades produce your highest average R, while ${worstCrypto.pair} trades represent your largest drag on account equity.`,
        impact: bestCrypto.totalPnl > 0 ? 'positive' : 'negative',
        recommendation: `Focus liquidity on your top 2 proven assets (${bestCrypto.pair}) and eliminate low-edge tokens.`,
      },
      {
        title: 'Leverage & Volatility Sizing',
        observation:
          totalHighLevPnl < 0
            ? 'Higher leverage trades correlate with quick stop-outs due to normal crypto wick volatility.'
            : 'Leverage discipline is healthy across low-to-moderate tiers.',
        impact: totalHighLevPnl < 0 ? 'negative' : 'positive',
        recommendation: 'Position size via dollar risk rather than maximizing exchange leverage sliders.',
      },
      {
        title: 'Long vs. Short Market Alignment',
        observation: `Longs: $${longStat?.totalPnl.toFixed(2) || '0.00'} (${longStat?.winRate.toFixed(0) || '0'}% WR) vs Shorts: $${
          shortStat?.totalPnl.toFixed(2) || '0.00'
        } (${shortStat?.winRate.toFixed(0) || '0'}% WR).`,
        impact: 'neutral',
        recommendation: 'Trade in direction of the 4H/1D higher timeframe market structure.',
      },
    ],
    bestPerformingCrypto: {
      pair: bestCrypto.pair,
      winRate: bestCrypto.winRate,
      avgR: bestCrypto.avgR,
      pnl: bestCrypto.totalPnl,
      insight: `${bestCrypto.pair} has been your most consistent alpha source with positive expectation.`,
    },
    worstPerformingCrypto: {
      pair: worstCrypto.pair,
      winRate: worstCrypto.winRate,
      avgR: worstCrypto.avgR,
      pnl: worstCrypto.totalPnl,
      insight: worstCrypto.totalPnl < 0 ? `${worstCrypto.pair} setups require stricter entry filters or removal.` : 'No underperforming pairs noted.',
    },
    bestStrategy: {
      name: bestStrat.strategy,
      winRate: bestStrat.winRate,
      avgR: bestStrat.avgR,
      pnl: bestStrat.totalPnl,
    },
    worstStrategy: {
      name: worstStrat.strategy,
      winRate: worstStrat.winRate,
      avgR: worstStrat.avgR,
      pnl: worstStrat.totalPnl,
    },
    longVsShortInsight: `Your Long positions have generated ${
      (longStat?.totalPnl || 0) >= 0 ? '+' : ''
    }$${(longStat?.totalPnl || 0).toFixed(2)} (${longStat?.winRate.toFixed(1)}% win rate) while Shorts have generated ${
      (shortStat?.totalPnl || 0) >= 0 ? '+' : ''
    }$${(shortStat?.totalPnl || 0).toFixed(2)} (${shortStat?.winRate.toFixed(1)}% win rate).`,
    leverageDisciplineInsight:
      totalHighLevPnl < 0
        ? `Trades using leverage above 20x have resulted in -$${Math.abs(totalHighLevPnl).toFixed(2)} in losses.`
        : 'Your leverage distribution remains conservative with low liquidation sensitivity.',
    stopLossDisciplineInsight: `${stats.totalTrades} logged trades evaluated. Ensure every single order is submitted with a predefined stop loss.`,
    revengeTradingDetected,
    revengeTradingInsight: revengeTradingDetected
      ? 'Clusters of losing trades in quick succession detected. Enforce the Kill Switch to prevent revenge sizing.'
      : undefined,
    overtradingDetected,
    overtradingInsight: overtradingDetected
      ? 'High trade volume with sub-50% win rate suggests overtrading lower timeframe noise.'
      : undefined,
    actionPlan,
  };
}

export const DEFAULT_TRADING_PLAN: TradingPlan = {
  startingCapital: 10000,
  defaultRiskPerTrade: 1.0,
  riskPerTradePct: 1.0,
  maxRiskPerTrade: 2.0,
  maxRiskPerTradePct: 2.0,
  maxDailyLossPercent: 3.0,
  maxDailyLossPct: 3.0,
  maxDailyLossAmount: 300,
  maxWeeklyLossPercent: 6.0,
  maxWeeklyLossAmount: 600,
  maxTradesPerDay: 5,
  maxConsecutiveLosses: 3,
  minRiskRewardRatio: 1.5,
  maxLeverage: 20,
  preferredCryptos: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT', 'NEARUSDT'],
  allowedPairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT', 'NEARUSDT'],
  allowedSetups: ['Breakout', 'Support/Resistance', 'Liquidity Sweep', 'Trend Following', 'Mean Reversion', 'Market Structure Shift (MSS)', 'Fair Value Gap (FVG) Tap'],
  requireConfirmation: true,
  requireStopLoss: true,
  requireTakeProfit: false,
  enforceKillSwitch: true,
  cooldownPeriodMinutes: 60,
  notes: 'Trade only high-probability A+ crypto setups with disciplined risk management.'
};


export function calculateDrawdownMetrics(trades: TradeJournalEntry[], startingBalance: number = 10000): DrawdownMetrics {
  const res = calculateJournalStats(trades, startingBalance);
  return res.drawdownMetrics;
}

export function calculateStrategyStats(trades: TradeJournalEntry[]): StrategyStat[] {
  const res = calculateJournalStats(trades, 10000);
  return res.strategyStats;
}

export function calculateTagStats(trades: TradeJournalEntry[]): TagStat[] {
  const tagMap = new Map<string, {
    count: number;
    wins: number;
    losses: number;
    breakeven: number;
    totalPnl: number;
    bestPnl: number;
    worstPnl: number;
    longs: number;
    shorts: number;
    tradeIds: number[];
  }>();

  trades.forEach((trade) => {
    const tags = trade.tags || [];
    tags.forEach((tag) => {
      const cleanTag = tag.trim().toLowerCase();
      if (!cleanTag) return;

      const current = tagMap.get(cleanTag) || {
        count: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        totalPnl: 0,
        bestPnl: -Infinity,
        worstPnl: Infinity,
        longs: 0,
        shorts: 0,
        tradeIds: [],
      };

      current.count += 1;
      current.totalPnl += trade.pnl || 0;
      if (trade.pnl > current.bestPnl) current.bestPnl = trade.pnl;
      if (trade.pnl < current.worstPnl) current.worstPnl = trade.pnl;

      if (trade.isWin) current.wins += 1;
      else if (trade.isBreakeven) current.breakeven += 1;
      else current.losses += 1;

      if (trade.direction === 'LONG') current.longs += 1;
      else if (trade.direction === 'SHORT') current.shorts += 1;

      if (trade.id) current.tradeIds.push(trade.id);

      tagMap.set(cleanTag, current);
    });
  });

  const result: TagStat[] = [];
  tagMap.forEach((val, tag) => {
    result.push({
      tag,
      count: val.count,
      wins: val.wins,
      losses: val.losses,
      breakeven: val.breakeven,
      winRate: val.count > 0 ? (val.wins / val.count) * 100 : 0,
      totalPnl: val.totalPnl,
      avgPnl: val.count > 0 ? val.totalPnl / val.count : 0,
      bestPnl: val.bestPnl === -Infinity ? 0 : val.bestPnl,
      worstPnl: val.worstPnl === Infinity ? 0 : val.worstPnl,
      longs: val.longs,
      shorts: val.shorts,
      tradeIds: val.tradeIds,
    });
  });

  return result.sort((a, b) => b.count - a.count);
}

