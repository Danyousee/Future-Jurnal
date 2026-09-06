export type TradeDirection = 'LONG' | 'SHORT';
export type MarginMode = 'CROSS' | 'ISOLATED';
export type FeeTier = 'maker' | 'taker' | 'high' | 'custom';
export type ConfidenceLevel = 'Low' | 'Medium' | 'High';
export type SetupQuality = 'Poor' | 'Good' | 'Excellent';
export type EmotionBefore = 'Calm' | 'Confident' | 'Anxious' | 'Excited' | 'Fearful' | 'Greedy';
export type EmotionAfter = 'Calm' | 'Confident' | 'Relieved' | 'Frustrated' | 'Regretful' | 'Satisfied';
export type Exchange = 'Binance' | 'Bybit' | 'OKX' | 'Kucoin' | 'Bitget' | 'Coinbase' | 'Other';
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
export type RiskStatus = 'Safe' | 'High' | 'Danger';
export type RiskTier = 'Conservative' | 'Elevated' | 'High' | 'Extreme';
export type PortfolioRiskTier = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'EXTREME';

export const STANDARD_MISTAKES = [
  'FOMO',
  'Revenge trade',
  'Over-leveraged',
  'Entered late',
  'Moved stop-loss',
  'Removed stop-loss',
  'Exited early',
  'Overtraded',
  'Broke strategy',
  'Broke risk rules',
  'No clear setup',
  'Emotional decision',
] as const;

export type StandardTradeMistake = typeof STANDARD_MISTAKES[number];

export interface CalculatorState {
  accountBalance: number;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPercentage: number;
  marginMode: MarginMode;
  feeRate: number; // percentage (e.g. 0.055)
  feeTier: FeeTier;
  leverage: number;
  slippagePct?: number; // percentage, e.g. 0.05%
  maintenanceMarginPct?: number; // percentage, e.g. 0.5% (MMR)
  makerFeeRate?: number; // percentage, e.g. 0.02%
  takerFeeRate?: number; // percentage, e.g. 0.055%
  estimatedFundingRate?: number; // 8h funding rate, e.g. 0.01%
}

export interface CalculationResult {
  marginRequired: number;
  positionSize: number; // Notional USDT
  quantity: number; // Base crypto asset amount
  riskAmount: number;
  reward: number;
  riskRewardRatio: number;
  feeImpact: number;
  entryFee: number;
  exitFee: number;
  estimatedFundingCost: number;
  estimatedSlippageCost: number;
  netProfit: number;
  netLoss: number;
  liquidationPrice: number;
  distanceToLiquidationPct: number;
  breakevenPrice: number;
  priceRiskPercentage: number;
  priceRewardPercentage: number;
  riskStatus: RiskStatus;
  riskTier: RiskTier;
  riskStatusDetails: string[];
  isLiqBeforeSL: boolean;
  maxAllowedPosition: number;
  leverageAdjustedPosition: number;
  stopLossDistance: number;
  takeProfitDistance: number;
  planValidation?: TradePlanCheckResult;
}

export interface TradeReviewData {
  whyEntered?: string;
  setupSeen?: string;
  followedPlan?: boolean;
  followedStopLoss?: boolean;
  movedStopLoss?: boolean;
  movedTakeProfit?: boolean;
  exitedEarly?: boolean;
  wasEmotional?: boolean;
  overLeveraged?: boolean;
  keyTakeaway?: string;
  disciplineRating?: number; // 1 to 5
  confidenceRating?: number; // 1 to 5
  executionRating?: number; // 1 to 5
}

export interface TradeJournalEntry {
  id?: number;
  createdAt: string; // ISO String
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  pair: string; // e.g. BTCUSDT, ETHUSDT
  exchange: Exchange;
  entryPrice: number;
  exitPrice: number;
  positionSize: number; // Notional USDT
  quantity?: number; // Contracts / Coins
  margin?: number; // Margin used
  direction: TradeDirection;
  strategy: string;
  setup?: string; // e.g. Breakout, Support/Resistance, Liquidity Sweep
  timeframe: Timeframe;
  leverage: number;
  tradingFee: number; // percentage or $
  makerFee?: number;
  takerFee?: number;
  fundingRate?: number;
  fundingCost?: number; // net funding cost or payment (+ received, - paid)
  slippageCost?: number;
  grossPnl?: number;
  pnl: number; // Net PnL (Gross - Fees - Funding - Slippage)
  pnlPercentage: number;
  rMultiple?: number; // e.g. +2.5R, -1.0R
  confidence: ConfidenceLevel;
  setupQuality: SetupQuality;
  emotionBefore: EmotionBefore;
  emotionAfter: EmotionAfter;
  tradeRating: number; // 1 to 5
  tags: string[];
  entryReason: string;
  exitReason: string;
  mistakesMade: string;
  mistakes?: string[];
  lessonsLearned: string;
  notes: string;
  isWin: boolean;
  isBreakeven: boolean;
  favorite: boolean;
  stopLoss?: number;
  takeProfit?: number;
  riskAmount?: number;
  riskPercentage?: number;
  // Plan compliance & Gate Record
  planCompliance?: boolean;
  planViolations?: string[];
  approvalRecord?: TradeApprovalRecord;
  // Screenshots
  beforeScreenshot?: string;
  entryScreenshot?: string;
  afterScreenshot?: string;
  chartScreenshot?: string;
  // Review Checklist
  review?: TradeReviewData;
}

export interface TradeApprovalRecord {
  status: 'APPROVED' | 'BLOCKED' | 'OVERRIDDEN' | 'PASSED';
  score?: number; // 0-100% compliance
  riskPercentage: number;
  riskAmount: number;
  leverage: number;
  riskRewardRatio: number;
  dailyRiskRemaining: number;
  planComplianceStatus: boolean;
  validationWarnings: string[];
  passedChecklist: string[];
  blockedReasons: string[];
  overrideReason?: string;
  checklist?: { ruleName: string; status: 'PASS' | 'WARN' | 'FAIL'; actualValue: string }[];
  timestamp?: string;
  approvedAt: string; // ISO date/time
}

export interface PreTradeValidationResult {
  isApproved: boolean;
  passed?: boolean; // alias for isApproved
  score?: number;
  status: 'APPROVED' | 'BLOCKED';
  checklist: {
    id: string;
    title: string;
    passed: boolean;
    detail: string;
    fieldKey?: 'balance' | 'entry' | 'stopLoss' | 'takeProfit' | 'riskPct' | 'leverage' | 'pair' | 'setup';
    suggestedFix?: string;
  }[];
  blockedReasons: {
    id: string;
    reason: string;
    fieldKey?: 'balance' | 'entry' | 'stopLoss' | 'takeProfit' | 'riskPct' | 'leverage' | 'pair' | 'setup';
    actionText: string;
    suggestedFix?: string;
  }[];
  warnings: string[];
  metrics: {
    accountBalance: number;
    riskPercentage: number;
    riskAmount: number;
    maxRiskAllowedPct: number;
    maxRiskAllowedAmount: number;
    leverage: number;
    maxLeverageAllowed: number;
    riskRewardRatio: number;
    minRiskRewardAllowed: number;
    dailyLossLimit: number;
    remainingDailyRisk: number;
    todayTradesCount: number;
    maxTradesPerDay: number;
    currentConsecutiveLosses: number;
    maxConsecutiveLosses: number;
    isLiqBeforeSL: boolean;
    distanceToLiqPct: number;
    preferredCryptos: string[];
    allowedSetups: string[];
  };
}

export interface OpenPosition {
  id?: number;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  currentPrice: number;
  markPrice?: number;
  stopLoss: number;
  takeProfit?: number;
  quantity: number; // Base crypto asset count
  positionSize: number; // Notional USDT
  margin: number; // Margin locked
  leverage: number;
  riskAmount: number; // $ loss if SL hit
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  liquidationPrice: number;
  distanceToLiquidationPct: number;
  correlationGroup?: string; // e.g. 'BTC-Related', 'Layer-1s', 'High-Beta DeFi', 'Memes', 'Custom'
  exchange?: Exchange;
  createdAt: string;
  notes?: string;
}

export interface CorrelatedGroupExposure {
  groupName: string;
  positionsCount: number;
  notionalExposure: number;
  totalRiskAmount: number;
  riskPctOfAccount: number;
  pairs: string[];
  directionSummary: string;
}

export interface PortfolioExposureMetrics {
  totalPositions: number;
  totalNotionalExposure: number;
  totalMarginUsed: number;
  totalAccountRisk: number; // $ risk if all SLs hit
  totalAccountRiskPct: number; // % of balance
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  longExposure: number;
  shortExposure: number;
  netExposure: number; // Long - Short
  netExposurePct: number;
  marginUtilizationPct: number; // (Total Margin / Account Balance) * 100
  avgLeverage: number;
  portfolioRiskTier: PortfolioRiskTier;
  riskWarnings: string[];
  correlatedGroups: CorrelatedGroupExposure[];
}

export interface MistakeStat {
  mistake: string;
  count: number;
  totalPnl: number;
  avgPnl: number;
  avgR: number;
  winRate: number;
  wins: number;
  losses: number;
  largestLoss: number;
}

export interface TradingPlan {
  startingCapital?: number;
  defaultRiskPerTrade: number; // default % e.g. 1.0
  riskPerTradePct?: number;
  maxRiskPerTrade: number; // max % e.g. 2.0
  maxRiskPerTradePct?: number;
  maxDailyLossPercent: number; // % e.g. 3.0
  maxDailyLossPct?: number;
  maxDailyLossAmount: number; // $ e.g. 300
  maxWeeklyLossPercent: number; // % e.g. 6.0
  maxWeeklyLossAmount: number; // $ e.g. 600
  maxTradesPerDay: number; // e.g. 5
  maxConsecutiveLosses: number; // e.g. 3
  minRiskRewardRatio: number; // e.g. 1.5
  maxLeverage: number; // e.g. 20
  preferredCryptos: string[]; // e.g. ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
  allowedPairs?: string[];
  allowedSetups: string[]; // e.g. ['Breakout', 'Support/Resistance', 'Liquidity Sweep', 'Trend Following', 'Mean Reversion', 'Market Structure']
  requireConfirmation: boolean;
  requireStopLoss: boolean;
  requireTakeProfit: boolean;
  killSwitchActive?: boolean;
  enforceKillSwitch?: boolean;
  cooldownPeriodMinutes?: number;
  notes?: string;
  lastResetDate?: string;
}

export interface TradePlanCheckResult {
  isCompliant: boolean;
  violations: string[];
  warnings: string[];
  passedRules: string[];
}

export interface DailyRiskStatus {
  date: string;
  startingBalance: number;
  todayPnl: number;
  todayGrossLoss: number;
  todayTradesCount: number;
  consecutiveLosses: number;
  dailyLossLimit: number;
  remainingLossAllowance: number;
  remainingTradesAllowance: number;
  isKillSwitchActive: boolean;
  killSwitchReasons: string[];
}

export interface PerformanceScore {
  overall: number; // 0-100
  riskManagement: number;
  drawdownControl: number;
  consistency: number;
  planCompliance: number;
  rrDiscipline: number;
  stopLossUsage: number;
  leverageDiscipline: number;
  overtradingControl: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface DrawdownMetrics {
  currentDrawdown: number;
  currentDrawdownPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  peakEquity: number;
  lowestEquity: number;
  recoveryAmountNeeded: number;
  recoveryPctNeeded: number;
  tradesInCurrentDrawdown: number;
  largestDrawdown: {
    amount: number;
    pct: number;
    peakDate: string;
    troughDate: string;
    tradeCount: number;
  };
  equityCurve: {
    index: number;
    date: string;
    tradeId?: number;
    pair?: string;
    pnl: number;
    equity: number;
    peak: number;
    drawdown: number;
    drawdownPct: number;
  }[];
}

export interface BacktestTrade {
  id?: number;
  sessionId: string;
  date: string;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number;
  positionSize: number;
  leverage: number;
  riskPercentage: number;
  riskAmount: number;
  pnl: number;
  pnlPercentage: number;
  rMultiple: number;
  isWin: boolean;
  fees: number;
  notes?: string;
}

export interface BacktestSession {
  id: string;
  name: string;
  strategy: string;
  cryptoPair: string;
  initialBalance: number;
  currentBalance: number;
  createdAt: string;
  description?: string;
  trades: BacktestTrade[];
}

export interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  averageR: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  totalReturn: number;
  totalReturnPct: number;
  winningStreak: number;
  losingStreak: number;
  avgWin: number;
  avgLoss: number;
}

export interface JournalStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  totalWins: number;
  totalLosses: number;
  totalBreakeven: number;
  avgRiskReward: number;
  avgRMultiple: number;
  profitFactor: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  winStreak: number;
  loseStreak: number;
  currentStreak: { type: 'win' | 'loss' | 'none'; count: number };
  bestPair: { pair: string; pnl: number; trades: number };
  worstPair: { pair: string; pnl: number; trades: number };
  totalVolume: number;
  totalFeesPaid: number;
  totalFundingNet: number;
  todayPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  startingBalance: number;
  currentEquity: number;
  totalReturnPct: number;
  peakEquity: number;
  currentDrawdown: number;
  currentDrawdownPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
}

export interface PairStat {
  pair: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgR: number;
  profitFactor: number;
}

export interface StrategyStat {
  strategy: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgR: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
}

export type StrategyPerformance = StrategyStat;


export interface PlaybookStrategy {
  id: string;
  name: string;
  description: string;
  timeframes: string[];
  rules: string[];
  idealRiskReward: string;
  winRate: number;
  tradeCount: number;
  profitFactor: number;
  pnl?: number;
  avgR?: number;
}


export interface LeverageStat {
  range: '1-5x' | '5-10x' | '10-20x' | '20-50x' | '50x+';
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgR: number;
  profitFactor: number;
}

export interface DirectionStat {
  direction: 'LONG' | 'SHORT';
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgR: number;
  profitFactor: number;
  avgTrade: number;
}

export interface MonthlyStat {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Aug 2026"
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface TagStat {
  tag: string;
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  bestPnl: number;
  worstPnl: number;
  longs: number;
  shorts: number;
  tradeIds: number[];
}

export interface SmartInsight {
  id: string;
  type: 'positive' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  metric?: string;
  actionAdvice?: string;
  category?: 'risk' | 'asset' | 'strategy' | 'psychology' | 'leverage';
}

export interface AiCoachReport {
  generatedAt: string;
  isAiGenerated: boolean;
  executiveSummary: string;
  strengths: string[];
  criticalRisks: string[];
  keyBehavioralPatterns: {
    title: string;
    observation: string;
    impact: 'positive' | 'negative' | 'neutral';
    recommendation: string;
  }[];
  bestPerformingCrypto: { pair: string; winRate: number; avgR: number; pnl: number; insight: string };
  worstPerformingCrypto: { pair: string; winRate: number; avgR: number; pnl: number; insight: string };
  bestStrategy: { name: string; winRate: number; avgR: number; pnl: number };
  worstStrategy: { name: string; winRate: number; avgR: number; pnl: number };
  longVsShortInsight: string;
  leverageDisciplineInsight: string;
  stopLossDisciplineInsight: string;
  revengeTradingDetected: boolean;
  revengeTradingInsight?: string;
  overtradingDetected: boolean;
  overtradingInsight?: string;
  actionPlan: string[];
}

export interface PdfReportOptions {
  traderName: string;
  period: 'Today' | 'Week' | 'Month' | 'Year' | 'All' | 'Custom';
  customStartDate?: string;
  customEndDate?: string;
  theme: 'light' | 'dark';
  paperSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  sections: {
    executiveSummary: boolean;
    performanceOverview: boolean;
    charts: boolean;
    pairPerformance: boolean;
    tradeHistory: boolean;
    smartInsights: boolean;
    drawdownAnalysis?: boolean;
    aiCoachSummary?: boolean;
  };
}
