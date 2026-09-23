import React, { useState, useEffect, useRef } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Check, 
  RotateCcw, 
  Save, 
  Sliders, 
  Zap, 
  Flame, 
  Scale, 
  Wallet, 
  Clock,
  Lock,
  Wrench,
  Sparkles,
  Coins,
  Globe,
  DollarSign,
  Layers,
  Info,
  Repeat,
  Fuel,
  ArrowLeftRight,
  Bell,
  BellRing,
  Target
} from 'lucide-react';
import { 
  CalculatorState, 
  CalculationResult, 
  FeeTier, 
  MarginMode, 
  TradingPlan,
  TradeJournalEntry,
  OpenPosition,
  TradeApprovalRecord,
  JournalStats,
  TradingMode,
  SpotDirection,
  SpotSizingMethod,
  SpotVenue,
  TradeDirection,
  PriceAlertTargetType
} from '../types';
import { 
  calculateTradeRisk,
  calculateFuturesRisk, 
  validatePreTradeRiskGate,
  formatCurrency, 
  formatNumber, 
  formatPrice,
  FEE_PRESETS, 
  COMMON_CRYPTO_PAIRS,
  getBaseAsset,
  recalculateWithCustomPositionSize
} from '../utils/calculator';
import { 
  COMMON_SPOT_PAIRS,
  DEX_CHAINS,
  COMMON_DEX_TOKENS,
  COMMON_DEX_WALLETS,
  COMMON_DEX_PROTOCOLS,
  DEX_SLIPPAGE_PRESETS,
  DEX_FEE_PRESETS
} from '../utils/spotCalculator';
import { 
  COMMON_FOREX_PAIRS, 
  FOREX_LEVERAGE_PRESETS, 
  getStandardPipSize, 
  getDefaultPipValue,
  getStandardLotUnits
} from '../utils/forexCalculator';
import { calculateJournalStats } from '../utils/analytics';
import { saveCalculatorSettings, loadCalculatorSettings, DEFAULT_TRADING_PLAN } from '../db/journalDb';
import { 
  TradeStatusCard, 
  PreTradeChecklistCard, 
  RiskBudgetCard 
} from './PreTradeRiskGateCard';
import { LeverageSimulator } from './LeverageSimulator';
import { PriceAlertModal } from './PriceAlertModal';
import { priceAlertService } from '../services/priceAlertService';
import { useMarketPrice } from '../services/marketData/useMarketPrice';

interface RiskCalculatorProps {
  onSaveToJournal: (state: CalculatorState, result: CalculationResult, approvalRecord?: TradeApprovalRecord) => void;
  onOpenPosition?: (position: OpenPosition) => void | Promise<void>;
  onNavigateToPortfolio?: () => void;
  plan?: TradingPlan;
  killSwitchActive?: boolean;
  trades?: TradeJournalEntry[];
  openPositions?: OpenPosition[];
  stats?: JournalStats;
}

// Mode-specific memory interfaces so user doesn't lose inputs when toggling
interface ModeCache {
  pair: string;
  direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPercentage: number;
  leverage: number;
  rawEntry: string;
  rawStopLoss: string;
  rawTakeProfit: string;
  rawRiskPct: string;
  rawLeverage: string;
  // Spot
  spotVenue?: SpotVenue;
  spotSizingMethod?: SpotSizingMethod;
  spotMaxCapital?: number;
  rawMaxCapital?: string;
  tokenLiquidity?: number;
  rawTokenLiquidity?: string;
  // Forex
  forexAccountCurrency?: string;
  forexPipSize?: number;
  forexPipValue?: number;
  forexStandardLotUnits?: number;
  forexSpreadPips?: number;
  // DEX Execution (used when Spot Venue is DEX)
  dexChain?: string;
  dexProtocol?: string;
  dexToken?: string;
  dexWallet?: string;
  dexGasFee?: number;
  dexNetworkFee?: number;
  dexTradingFeePct?: number;
  dexPriceImpactPct?: number;
  dexSlippagePct?: number;
  rawGasFee?: string;
  rawPriceImpact?: string;
  rawSlippage?: string;
}

const DEFAULT_SPOT_CEX_CACHE: ModeCache = {
  pair: 'BTC/USDT',
  direction: 'BUY',
  entryPrice: 65000,
  stopLoss: 63500,
  takeProfit: 68000,
  riskPercentage: 1.0,
  leverage: 1,
  rawEntry: '65000',
  rawStopLoss: '63500',
  rawTakeProfit: '68000',
  rawRiskPct: '1.0',
  rawLeverage: '1',
  spotVenue: 'CEX',
  spotSizingMethod: 'RISK_BASED',
  spotMaxCapital: 10000,
  rawMaxCapital: '10000',
};

const DEFAULT_SPOT_CACHE = DEFAULT_SPOT_CEX_CACHE;

const DEFAULT_SPOT_DEX_CACHE: ModeCache = {
  pair: 'PEPE',
  direction: 'BUY',
  entryPrice: 0.000012,
  stopLoss: 0.0000105,
  takeProfit: 0.000015,
  riskPercentage: 1.0,
  leverage: 1,
  rawEntry: '0.000012',
  rawStopLoss: '0.0000105',
  rawTakeProfit: '0.000015',
  rawRiskPct: '1.0',
  rawLeverage: '1',
  spotVenue: 'DEX',
  spotSizingMethod: 'RISK_BASED',
  spotMaxCapital: 10000,
  rawMaxCapital: '10000',
  dexChain: 'Ethereum',
  dexProtocol: 'Uniswap',
  dexToken: 'PEPE',
  dexWallet: 'MetaMask',
  dexGasFee: 8.50,
  dexNetworkFee: 0,
  dexTradingFeePct: 0.30,
  dexPriceImpactPct: 0.15,
  dexSlippagePct: 0.50,
  rawGasFee: '8.50',
  rawPriceImpact: '0.15',
  rawSlippage: '0.5',
  tokenLiquidity: 250000,
  rawTokenLiquidity: '250000',
};

const DEFAULT_DEX_CACHE = DEFAULT_SPOT_DEX_CACHE;

const DEFAULT_PERPETUAL_CACHE: ModeCache = {
  pair: 'BTCUSDT',
  direction: 'LONG',
  entryPrice: 65000,
  stopLoss: 63500,
  takeProfit: 68000,
  riskPercentage: 1.0,
  leverage: 10,
  rawEntry: '65000',
  rawStopLoss: '63500',
  rawTakeProfit: '68000',
  rawRiskPct: '1.0',
  rawLeverage: '10',
};

const DEFAULT_FOREX_CACHE: ModeCache = {
  pair: 'EUR/USD',
  direction: 'LONG',
  entryPrice: 1.08500,
  stopLoss: 1.08250,
  takeProfit: 1.09000,
  riskPercentage: 1.0,
  leverage: 100,
  rawEntry: '1.08500',
  rawStopLoss: '1.08250',
  rawTakeProfit: '1.09000',
  rawRiskPct: '1.0',
  rawLeverage: '100',
  forexAccountCurrency: 'USD',
  forexPipSize: 0.0001,
  forexPipValue: 10,
  forexStandardLotUnits: 100000,
  forexSpreadPips: 1.0,
};

export const RiskCalculator: React.FC<RiskCalculatorProps> = ({
  onSaveToJournal,
  onOpenPosition,
  onNavigateToPortfolio,
  plan = DEFAULT_TRADING_PLAN,
  killSwitchActive = false,
  trades = [],
  openPositions = [],
  stats,
}) => {
  const [positionTrackedSuccess, setPositionTrackedSuccess] = useState(false);
  const initialBalance = stats?.currentEquity || plan?.startingCapital || 10000;
  const initialRisk = plan?.defaultRiskPerTrade || plan?.riskPerTradePct || 1.0;
  const initialLev = Math.min(10, plan?.maxLeverage || 10);

  // Active Trading Mode (Strictly 3 Modes: SPOT, PERPETUAL, FOREX)
  const [tradingMode, setTradingMode] = useState<TradingMode>('PERPETUAL');
  const [spotVenue, setSpotVenue] = useState<SpotVenue>('CEX');

  // Mode Memory Stores to prevent wiping values on mode switch
  const [spotCexMemory, setSpotCexMemory] = useState<ModeCache>(DEFAULT_SPOT_CEX_CACHE);
  const [spotDexMemory, setSpotDexMemory] = useState<ModeCache>(DEFAULT_SPOT_DEX_CACHE);
  const [perpetualMemory, setPerpetualMemory] = useState<ModeCache>(DEFAULT_PERPETUAL_CACHE);
  const [forexMemory, setForexMemory] = useState<ModeCache>(DEFAULT_FOREX_CACHE);

  const [calcState, setCalcState] = useState<CalculatorState>(() => ({
    tradingMode: 'PERPETUAL',
    spotVenue: 'CEX',
    accountBalance: initialBalance,
    pair: 'BTCUSDT',
    direction: 'LONG',
    entryPrice: 65000,
    stopLoss: 63500,
    takeProfit: 68000,
    riskPercentage: initialRisk,
    leverage: initialLev,
    marginMode: 'ISOLATED',
    feeTier: 'taker',
    feeRate: 0.00055,
    estimatedFundingRate: 0.0001,
    slippagePct: 0.05,
    maintenanceMarginPct: 0.5,
  }));

  const [rawInputs, setRawInputs] = useState(() => ({
    balance: initialBalance.toString(),
    entry: '65000',
    stopLoss: '63500',
    takeProfit: '68000',
    riskPct: initialRisk.toString(),
    riskAmount: ((initialBalance * initialRisk) / 100).toFixed(2),
    leverage: initialLev.toString(),
    slippage: '0.05',
    mmr: '0.5',
    maxCapital: '10000',
    dexGasFee: '8.50',
    dexPriceImpact: '0.15',
    dexSlippage: '0.5',
    tokenLiquidity: '250000',
  }));

  const [copied, setCopied] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const [resetFeedbackText, setResetFeedbackText] = useState<string | null>(null);
  const [showAdvancedFees, setShowAdvancedFees] = useState(false);
  const [showLeverageSimulator, setShowLeverageSimulator] = useState(false);
  const [isGateOverridden, setIsGateOverridden] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Manual trader discretion override');
  const [riskInputMode, setRiskInputMode] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [showManualSizeAdjuster, setShowManualSizeAdjuster] = useState(false);
  const [manualMultiplier, setManualMultiplier] = useState(100);
  const [manualCustomValue, setManualCustomValue] = useState<string>('');

  // Price Alert Integration State
  const [isPriceAlertModalOpen, setIsPriceAlertModalOpen] = useState(false);
  const [alertModalDefaultTarget, setAlertModalDefaultTarget] = useState<PriceAlertTargetType>('ENTRY');
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);

  // Live market price feed for active instrument
  const { currentPrice: liveMarketPrice } = useMarketPrice(calcState.pair, {
    mode: tradingMode,
    spotVenue: tradingMode === 'SPOT' ? spotVenue : undefined,
  });

  // Keep alert count synchronized with priceAlertService
  useEffect(() => {
    const unsub = priceAlertService.subscribe((alerts) => {
      setActiveAlertsCount(alerts.filter((a) => a.isActive && !a.isTriggered).length);
    });
    return () => unsub();
  }, []);

  // Whenever live market price updates, evaluate against active alerts
  useEffect(() => {
    if (liveMarketPrice && liveMarketPrice > 0) {
      priceAlertService.evaluatePrice(
        calcState.pair,
        liveMarketPrice,
        tradingMode,
        tradingMode === 'SPOT' ? spotVenue : undefined
      );
    }
  }, [liveMarketPrice, calcState.pair, tradingMode, spotVenue]);

  const handleOpenAlertModal = (target: PriceAlertTargetType = 'ENTRY') => {
    setAlertModalDefaultTarget(target);
    setIsPriceAlertModalOpen(true);
  };

  // Input element refs for smooth scrolling and focusing
  const balanceInputRef = useRef<HTMLInputElement>(null);
  const entryInputRef = useRef<HTMLInputElement>(null);
  const stopLossInputRef = useRef<HTMLInputElement>(null);
  const takeProfitInputRef = useRef<HTMLInputElement>(null);
  const riskInputRef = useRef<HTMLInputElement>(null);
  const leverageInputRef = useRef<HTMLInputElement>(null);
  const simulatorRef = useRef<HTMLDivElement>(null);

  // Load saved calculator preferences
  useEffect(() => {
    loadCalculatorSettings().then((saved) => {
      if (saved) {
        let loadedMode: TradingMode = saved.tradingMode || 'PERPETUAL';
        let loadedVenue: SpotVenue = saved.spotVenue || 'CEX';
        // Map legacy DEX mode to SPOT mode with DEX venue
        if ((saved.tradingMode as string) === 'DEX') {
          loadedMode = 'SPOT';
          loadedVenue = 'DEX';
        }
        setTradingMode(loadedMode);
        setSpotVenue(loadedVenue);
        setCalcState((prev) => ({
          ...prev,
          ...saved,
          tradingMode: loadedMode,
          spotVenue: loadedVenue,
          accountBalance: saved.accountBalance ?? prev.accountBalance,
          riskPercentage: saved.riskPercentage ?? prev.riskPercentage,
          leverage: saved.leverage ?? prev.leverage,
          marginMode: saved.marginMode ?? prev.marginMode,
          feeTier: saved.feeTier ?? prev.feeTier,
        }));
        setRawInputs((prev) => ({
          ...prev,
          balance: saved.accountBalance ? saved.accountBalance.toString() : prev.balance,
          entry: saved.entryPrice ? saved.entryPrice.toString() : prev.entry,
          stopLoss: saved.stopLoss ? saved.stopLoss.toString() : prev.stopLoss,
          takeProfit: saved.takeProfit ? saved.takeProfit.toString() : prev.takeProfit,
          riskPct: saved.riskPercentage ? saved.riskPercentage.toString() : prev.riskPct,
          leverage: saved.leverage ? saved.leverage.toString() : prev.leverage,
          dexGasFee: saved.dexGasFee ? saved.dexGasFee.toString() : prev.dexGasFee,
          dexPriceImpact: saved.dexPriceImpactPct ? saved.dexPriceImpactPct.toString() : prev.dexPriceImpact,
          dexSlippage: saved.dexSlippagePct ? saved.dexSlippagePct.toString() : prev.dexSlippage,
          tokenLiquidity: saved.tokenLiquidity ? saved.tokenLiquidity.toString() : prev.tokenLiquidity,
        }));
      }
    });
  }, []);

  // Save settings on changes
  useEffect(() => {
    saveCalculatorSettings(calcState);
  }, [
    calcState.tradingMode,
    calcState.spotVenue,
    calcState.accountBalance, 
    calcState.riskPercentage, 
    calcState.leverage, 
    calcState.marginMode, 
    calcState.feeTier, 
    calcState.pair,
    calcState.entryPrice,
    calcState.stopLoss,
    calcState.takeProfit,
    calcState.dexGasFee,
    calcState.dexTradingFeePct,
    calcState.dexPriceImpactPct,
    calcState.dexSlippagePct,
    calcState.tokenLiquidity
  ]);

  // Handle Switching Spot Venues (CEX vs DEX)
  const handleSelectSpotVenue = (newVenue: SpotVenue) => {
    if (newVenue === spotVenue) return;

    // 1. Snapshot current active spot venue
    if (spotVenue === 'CEX') {
      setSpotCexMemory({
        pair: calcState.pair,
        direction: (calcState.spotDirection as any) || (calcState.direction === 'LONG' ? 'BUY' : 'SELL'),
        entryPrice: calcState.entryPrice,
        stopLoss: calcState.stopLoss,
        takeProfit: calcState.takeProfit,
        riskPercentage: calcState.riskPercentage,
        leverage: 1,
        rawEntry: rawInputs.entry,
        rawStopLoss: rawInputs.stopLoss,
        rawTakeProfit: rawInputs.takeProfit,
        rawRiskPct: rawInputs.riskPct,
        rawLeverage: '1',
        spotVenue: 'CEX',
        spotSizingMethod: calcState.spotSizingMethod,
        spotMaxCapital: calcState.spotMaxCapital,
        rawMaxCapital: rawInputs.maxCapital,
      });
    } else {
      setSpotDexMemory({
        pair: calcState.pair,
        direction: (calcState.spotDirection as any) || (calcState.direction === 'LONG' ? 'BUY' : 'SELL'),
        entryPrice: calcState.entryPrice,
        stopLoss: calcState.stopLoss,
        takeProfit: calcState.takeProfit,
        riskPercentage: calcState.riskPercentage,
        leverage: 1,
        rawEntry: rawInputs.entry,
        rawStopLoss: rawInputs.stopLoss,
        rawTakeProfit: rawInputs.takeProfit,
        rawRiskPct: rawInputs.riskPct,
        rawLeverage: '1',
        spotVenue: 'DEX',
        spotSizingMethod: calcState.spotSizingMethod,
        spotMaxCapital: calcState.spotMaxCapital,
        rawMaxCapital: rawInputs.maxCapital,
        dexChain: calcState.dexChain,
        dexProtocol: calcState.dexProtocol,
        dexToken: calcState.dexToken,
        dexWallet: calcState.dexWallet,
        dexGasFee: calcState.dexGasFee,
        dexNetworkFee: calcState.dexNetworkFee,
        dexTradingFeePct: calcState.dexTradingFeePct,
        dexPriceImpactPct: calcState.dexPriceImpactPct,
        dexSlippagePct: calcState.dexSlippagePct,
        rawGasFee: rawInputs.dexGasFee,
        rawPriceImpact: rawInputs.dexPriceImpact,
        rawSlippage: rawInputs.dexSlippage,
        tokenLiquidity: calcState.tokenLiquidity,
        rawTokenLiquidity: rawInputs.tokenLiquidity,
      });
    }

    // 2. Restore targeted spot venue
    const targetMem = newVenue === 'CEX' ? spotCexMemory : spotDexMemory;
    setSpotVenue(newVenue);

    setCalcState((prev) => ({
      ...prev,
      tradingMode: 'SPOT',
      spotVenue: newVenue,
      pair: targetMem.pair,
      direction: targetMem.direction === 'BUY' || targetMem.direction === 'LONG' ? 'LONG' : 'SHORT',
      spotDirection: targetMem.direction === 'BUY' || targetMem.direction === 'LONG' ? 'BUY' : 'SELL',
      entryPrice: targetMem.entryPrice,
      stopLoss: targetMem.stopLoss,
      takeProfit: targetMem.takeProfit,
      riskPercentage: targetMem.riskPercentage,
      leverage: 1,
      spotSizingMethod: targetMem.spotSizingMethod || 'RISK_BASED',
      spotMaxCapital: targetMem.spotMaxCapital || prev.accountBalance,
      dexChain: targetMem.dexChain || 'Ethereum',
      dexProtocol: targetMem.dexProtocol || 'Uniswap',
      dexToken: targetMem.dexToken || (targetMem.pair ? targetMem.pair.split('/')[0] : 'PEPE'),
      dexWallet: targetMem.dexWallet || 'MetaMask',
      dexGasFee: targetMem.dexGasFee ?? (newVenue === 'DEX' ? 8.50 : undefined),
      dexNetworkFee: targetMem.dexNetworkFee ?? 0,
      dexTradingFeePct: targetMem.dexTradingFeePct ?? (newVenue === 'DEX' ? 0.30 : undefined),
      dexPriceImpactPct: targetMem.dexPriceImpactPct ?? (newVenue === 'DEX' ? 0.15 : undefined),
      dexSlippagePct: targetMem.dexSlippagePct ?? (newVenue === 'DEX' ? 0.50 : undefined),
      tokenLiquidity: targetMem.tokenLiquidity,
    }));

    setRawInputs((prev) => ({
      ...prev,
      entry: targetMem.rawEntry,
      stopLoss: targetMem.rawStopLoss,
      takeProfit: targetMem.rawTakeProfit,
      riskPct: targetMem.rawRiskPct,
      leverage: '1',
      maxCapital: targetMem.rawMaxCapital || prev.balance,
      dexGasFee: targetMem.rawGasFee || (targetMem.dexGasFee?.toString() ?? '8.50'),
      dexPriceImpact: targetMem.rawPriceImpact || (targetMem.dexPriceImpactPct?.toString() ?? '0.15'),
      dexSlippage: targetMem.rawSlippage || (targetMem.dexSlippagePct?.toString() ?? '0.5'),
      tokenLiquidity: targetMem.rawTokenLiquidity || (targetMem.tokenLiquidity?.toString() ?? '250000'),
    }));
  };

  // Handle Switching Trading Modes without losing parameters
  const handleSelectTradingMode = (rawNewMode: TradingMode) => {
    const newMode: TradingMode = (rawNewMode as string) === 'DEX' ? 'SPOT' : rawNewMode;
    const targetVenue: SpotVenue = (rawNewMode as string) === 'DEX' ? 'DEX' : spotVenue;

    if (newMode === tradingMode && targetVenue === spotVenue) return;

    // 1. Snapshot current active mode state
    if (tradingMode === 'SPOT') {
      if (spotVenue === 'CEX') {
        setSpotCexMemory({
          pair: calcState.pair,
          direction: (calcState.spotDirection as any) || (calcState.direction === 'LONG' ? 'BUY' : 'SELL'),
          entryPrice: calcState.entryPrice,
          stopLoss: calcState.stopLoss,
          takeProfit: calcState.takeProfit,
          riskPercentage: calcState.riskPercentage,
          leverage: 1,
          rawEntry: rawInputs.entry,
          rawStopLoss: rawInputs.stopLoss,
          rawTakeProfit: rawInputs.takeProfit,
          rawRiskPct: rawInputs.riskPct,
          rawLeverage: '1',
          spotVenue: 'CEX',
          spotSizingMethod: calcState.spotSizingMethod,
          spotMaxCapital: calcState.spotMaxCapital,
          rawMaxCapital: rawInputs.maxCapital,
        });
      } else {
        setSpotDexMemory({
          pair: calcState.pair,
          direction: (calcState.spotDirection as any) || (calcState.direction === 'LONG' ? 'BUY' : 'SELL'),
          entryPrice: calcState.entryPrice,
          stopLoss: calcState.stopLoss,
          takeProfit: calcState.takeProfit,
          riskPercentage: calcState.riskPercentage,
          leverage: 1,
          rawEntry: rawInputs.entry,
          rawStopLoss: rawInputs.stopLoss,
          rawTakeProfit: rawInputs.takeProfit,
          rawRiskPct: rawInputs.riskPct,
          rawLeverage: '1',
          spotVenue: 'DEX',
          spotSizingMethod: calcState.spotSizingMethod,
          spotMaxCapital: calcState.spotMaxCapital,
          rawMaxCapital: rawInputs.maxCapital,
          dexChain: calcState.dexChain,
          dexProtocol: calcState.dexProtocol,
          dexToken: calcState.dexToken,
          dexWallet: calcState.dexWallet,
          dexGasFee: calcState.dexGasFee,
          dexNetworkFee: calcState.dexNetworkFee,
          dexTradingFeePct: calcState.dexTradingFeePct,
          dexPriceImpactPct: calcState.dexPriceImpactPct,
          dexSlippagePct: calcState.dexSlippagePct,
          rawGasFee: rawInputs.dexGasFee,
          rawPriceImpact: rawInputs.dexPriceImpact,
          rawSlippage: rawInputs.dexSlippage,
          tokenLiquidity: calcState.tokenLiquidity,
          rawTokenLiquidity: rawInputs.tokenLiquidity,
        });
      }
    } else if (tradingMode === 'PERPETUAL') {
      setPerpetualMemory({
        pair: calcState.pair,
        direction: calcState.direction,
        entryPrice: calcState.entryPrice,
        stopLoss: calcState.stopLoss,
        takeProfit: calcState.takeProfit,
        riskPercentage: calcState.riskPercentage,
        leverage: calcState.leverage,
        rawEntry: rawInputs.entry,
        rawStopLoss: rawInputs.stopLoss,
        rawTakeProfit: rawInputs.takeProfit,
        rawRiskPct: rawInputs.riskPct,
        rawLeverage: rawInputs.leverage,
      });
    } else if (tradingMode === 'FOREX') {
      setForexMemory({
        pair: calcState.pair,
        direction: calcState.direction,
        entryPrice: calcState.entryPrice,
        stopLoss: calcState.stopLoss,
        takeProfit: calcState.takeProfit,
        riskPercentage: calcState.riskPercentage,
        leverage: calcState.forexLeverage || calcState.leverage || 100,
        rawEntry: rawInputs.entry,
        rawStopLoss: rawInputs.stopLoss,
        rawTakeProfit: rawInputs.takeProfit,
        rawRiskPct: rawInputs.riskPct,
        rawLeverage: (calcState.forexLeverage || 100).toString(),
        forexAccountCurrency: calcState.forexAccountCurrency,
        forexPipSize: calcState.forexPipSize,
        forexPipValue: calcState.forexPipValue,
        forexStandardLotUnits: calcState.forexStandardLotUnits,
      });
    }

    // 2. Restore targeted mode state
    let targetMem = perpetualMemory;
    if (newMode === 'SPOT') {
      targetMem = targetVenue === 'DEX' ? spotDexMemory : spotCexMemory;
      setSpotVenue(targetVenue);
    } else if (newMode === 'FOREX') {
      targetMem = forexMemory;
    }

    setTradingMode(newMode);
    setCalcState((prev) => ({
      ...prev,
      tradingMode: newMode,
      spotVenue: newMode === 'SPOT' ? targetVenue : prev.spotVenue,
      pair: targetMem.pair,
      direction: targetMem.direction === 'BUY' || targetMem.direction === 'LONG' ? 'LONG' : 'SHORT',
      spotDirection: targetMem.direction === 'BUY' || targetMem.direction === 'LONG' ? 'BUY' : 'SELL',
      entryPrice: targetMem.entryPrice,
      stopLoss: targetMem.stopLoss,
      takeProfit: targetMem.takeProfit,
      riskPercentage: targetMem.riskPercentage,
      leverage: newMode === 'SPOT' ? 1 : targetMem.leverage,
      forexLeverage: newMode === 'FOREX' ? targetMem.leverage : undefined,
      spotSizingMethod: targetMem.spotSizingMethod || 'RISK_BASED',
      spotMaxCapital: targetMem.spotMaxCapital || prev.accountBalance,
      forexAccountCurrency: targetMem.forexAccountCurrency || 'USD',
      forexPipSize: targetMem.forexPipSize || getStandardPipSize(targetMem.pair),
      forexPipValue: targetMem.forexPipValue || getDefaultPipValue(targetMem.pair),
      forexStandardLotUnits: targetMem.forexStandardLotUnits || getStandardLotUnits(targetMem.pair),
      dexChain: targetMem.dexChain || 'Ethereum',
      dexProtocol: targetMem.dexProtocol || 'Uniswap',
      dexToken: targetMem.dexToken || (targetMem.pair ? targetMem.pair.split('/')[0] : 'PEPE'),
      dexWallet: targetMem.dexWallet || 'MetaMask',
      dexGasFee: targetMem.dexGasFee ?? 8.50,
      dexNetworkFee: targetMem.dexNetworkFee ?? 0,
      dexTradingFeePct: targetMem.dexTradingFeePct ?? 0.30,
      dexPriceImpactPct: targetMem.dexPriceImpactPct ?? 0.15,
      dexSlippagePct: targetMem.dexSlippagePct ?? 0.50,
      tokenLiquidity: targetMem.tokenLiquidity,
    }));

    setRawInputs((prev) => ({
      ...prev,
      entry: targetMem.rawEntry,
      stopLoss: targetMem.rawStopLoss,
      takeProfit: targetMem.rawTakeProfit,
      riskPct: targetMem.rawRiskPct,
      leverage: newMode === 'SPOT' ? '1' : targetMem.rawLeverage,
      maxCapital: targetMem.rawMaxCapital || prev.balance,
      dexGasFee: targetMem.rawGasFee || (targetMem.dexGasFee?.toString() ?? '8.50'),
      dexPriceImpact: targetMem.rawPriceImpact || (targetMem.dexPriceImpactPct?.toString() ?? '0.15'),
      dexSlippage: targetMem.rawSlippage || (targetMem.dexSlippagePct?.toString() ?? '0.5'),
      tokenLiquidity: targetMem.rawTokenLiquidity || (targetMem.tokenLiquidity?.toString() ?? '250000'),
    }));

    setIsGateOverridden(false);
    setShowLeverageSimulator(false);
  };

  // Run Multi-Market Financial Calculations
  const result: CalculationResult = calculateTradeRisk(calcState, plan);

  // Run Pre-Trade Risk Gate Validation
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter((t) => t.date && t.date.startsWith(todayStr));
  const todayCount = todayTrades.length;

  let consLosses = 0;
  const sortedTrades = [...trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const t of sortedTrades) {
    if (t.status === 'CLOSED') {
      if ((t.pnl || 0) < 0) consLosses++;
      else break;
    }
  }

  const riskGateValidation = validatePreTradeRiskGate({
    state: calcState,
    result,
    plan,
    todayTradesCount: todayCount,
    currentConsecutiveLosses: consLosses,
  });

  // Reset override if inputs change
  useEffect(() => {
    setIsGateOverridden(false);
  }, [calcState.entryPrice, calcState.stopLoss, calcState.riskPercentage, calcState.leverage, calcState.pair, tradingMode]);

  // Fix button behavior with smooth scrolling and focus
  const handleFixField = (field: string, suggestedValue?: string | number) => {
    if (field === 'balance') {
      if (suggestedValue) {
        const num = typeof suggestedValue === 'number' ? suggestedValue : parseFloat(suggestedValue);
        if (!isNaN(num) && num > 0) {
          setCalcState((prev) => ({ ...prev, accountBalance: num }));
          setRawInputs((prev) => ({ ...prev, balance: num.toString() }));
        }
      }
      balanceInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => balanceInputRef.current?.focus(), 150);
    } else if (field === 'riskPct') {
      const val = typeof suggestedValue === 'number' ? suggestedValue : parseFloat(suggestedValue as string) || plan.maxRiskPerTrade || 1.5;
      setCalcState((prev) => ({ ...prev, riskPercentage: val }));
      setRawInputs((prev) => ({ ...prev, riskPct: val.toString() }));
      riskInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => riskInputRef.current?.focus(), 150);
    } else if (field === 'leverage') {
      const val = typeof suggestedValue === 'number' ? suggestedValue : parseInt(suggestedValue as string) || plan.maxLeverage || 10;
      setCalcState((prev) => ({ ...prev, leverage: val, forexLeverage: val }));
      setRawInputs((prev) => ({ ...prev, leverage: val.toString() }));
      leverageInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => leverageInputRef.current?.focus(), 150);
    } else if (field === 'stopLoss') {
      if (suggestedValue) {
        const num = typeof suggestedValue === 'number' ? suggestedValue : parseFloat(suggestedValue);
        if (!isNaN(num)) {
          setCalcState((prev) => ({ ...prev, stopLoss: num }));
          setRawInputs((prev) => ({ ...prev, stopLoss: num.toString() }));
        }
      }
      stopLossInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => stopLossInputRef.current?.focus(), 150);
    } else if (field === 'takeProfit') {
      if (suggestedValue) {
        const num = typeof suggestedValue === 'number' ? suggestedValue : parseFloat(suggestedValue);
        if (!isNaN(num)) {
          setCalcState((prev) => ({ ...prev, takeProfit: num }));
          setRawInputs((prev) => ({ ...prev, takeProfit: num.toString() }));
        }
      }
      takeProfitInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => takeProfitInputRef.current?.focus(), 150);
    } else if (field === 'entryPrice' || field === 'entry') {
      entryInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => entryInputRef.current?.focus(), 150);
    }
  };

  const handleSaveTradeWithGate = () => {
    const isApproved = riskGateValidation.isApproved || riskGateValidation.passed;
    let approvalStatus: 'APPROVED' | 'BLOCKED' | 'OVERRIDDEN' = 'APPROVED';
    if (!isApproved) {
      if (isGateOverridden) {
        approvalStatus = 'OVERRIDDEN';
      } else {
        approvalStatus = 'BLOCKED';
      }
    }

    const passedChecklist = riskGateValidation.checklist.filter((c) => c.passed).map((c) => c.title);
    const blockedReasons = riskGateValidation.blockedReasons.map((b) => b.reason);
    const checklistForRecord = riskGateValidation.checklist.map((c) => ({
      ruleName: c.title,
      status: (c.passed ? 'PASS' : 'FAIL') as 'PASS' | 'WARN' | 'FAIL',
      actualValue: c.detail,
    }));

    const effectiveLeverage = tradingMode === 'SPOT' ? 1 : (tradingMode === 'FOREX' ? (calcState.forexLeverage || 100) : calcState.leverage);

    const approvalRecord: TradeApprovalRecord = {
      status: approvalStatus,
      score: riskGateValidation.score ?? Math.round((passedChecklist.length / Math.max(1, riskGateValidation.checklist.length)) * 100),
      riskPercentage: calcState.riskPercentage,
      riskAmount: result.riskAmount,
      leverage: effectiveLeverage,
      riskRewardRatio: result.riskRewardRatio,
      dailyRiskRemaining: riskGateValidation.metrics?.remainingDailyRisk ?? 0,
      planComplianceStatus: isApproved,
      validationWarnings: riskGateValidation.warnings,
      passedChecklist,
      blockedReasons,
      overrideReason: isGateOverridden ? overrideReason : undefined,
      checklist: checklistForRecord,
      approvedAt: new Date().toISOString(),
    };

    onSaveToJournal(calcState, result, approvalRecord);
  };

  const handleBalanceChange = (val: string) => {
    setRawInputs((prev) => {
      const parsed = parseFloat(val);
      const safeBal = isNaN(parsed) ? 0 : parsed;
      const currentPct = calcState.riskPercentage || 1.0;
      const updatedAmount = safeBal > 0 ? ((safeBal * currentPct) / 100).toFixed(2) : '0.00';
      return { ...prev, balance: val, riskAmount: updatedAmount };
    });
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, accountBalance: isNaN(parsed) ? 0 : parsed }));
  };

  const handleEntryChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, entry: val }));
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, entryPrice: isNaN(parsed) ? 0 : parsed }));
  };

  const handleStopLossChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, stopLoss: val }));
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, stopLoss: isNaN(parsed) ? 0 : parsed }));
  };

  const handleTakeProfitChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, takeProfit: val }));
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, takeProfit: isNaN(parsed) ? 0 : parsed }));
  };

  const handleRiskPctChange = (val: string) => {
    setRawInputs((prev) => {
      const parsed = parseFloat(val);
      const safePct = isNaN(parsed) ? 0 : parsed;
      const amount = calcState.accountBalance > 0 ? ((calcState.accountBalance * safePct) / 100).toFixed(2) : '0.00';
      return { ...prev, riskPct: val, riskAmount: amount };
    });
    const parsed = parseFloat(val);
    setCalcState((prev) => ({ ...prev, riskPercentage: isNaN(parsed) ? 0 : parsed }));
  };

  const handleRiskAmountChange = (val: string) => {
    setRawInputs((prev) => {
      const parsed = parseFloat(val);
      const safeAmount = isNaN(parsed) ? 0 : Math.max(0, parsed);
      const clampedAmount = calcState.accountBalance > 0 ? Math.min(calcState.accountBalance, safeAmount) : safeAmount;
      const calcPct = calcState.accountBalance > 0 ? (clampedAmount / calcState.accountBalance) * 100 : 0;
      return { ...prev, riskAmount: val, riskPct: calcPct.toFixed(2) };
    });
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && calcState.accountBalance > 0) {
      const clampedAmount = Math.min(calcState.accountBalance, Math.max(0, parsed));
      const calcPct = (clampedAmount / calcState.accountBalance) * 100;
      setCalcState((prev) => ({ ...prev, riskPercentage: calcPct }));
    }
  };

  const handleLeverageChange = (val: string) => {
    setRawInputs((prev) => ({ ...prev, leverage: val }));
    const parsed = parseInt(val, 10);
    const safeLev = isNaN(parsed) ? 1 : Math.max(1, parsed);
    setCalcState((prev) => ({ 
      ...prev, 
      leverage: safeLev,
      forexLeverage: safeLev 
    }));
  };

  const handleFeeTierChange = (tier: FeeTier) => {
    const feeRate = FEE_PRESETS[tier]?.rate ?? 0.00055;
    setCalcState((prev) => ({ ...prev, feeTier: tier, feeRate }));
  };

  // Reset to default settings for active mode
  const handleReset = () => {
    const activeBalance = stats?.currentEquity || plan?.startingCapital || 10000;
    const defaultRisk = plan?.defaultRiskPerTrade || plan?.riskPerTradePct || 1.0;
    const defaultLev = Math.min(10, plan?.maxLeverage || 10);

    let nextPair = 'BTCUSDT';
    let nextEntry = 0;
    let nextSL = 0;
    let nextTP = 0;
    let nextLev = defaultLev;

    if (tradingMode === 'SPOT') {
      nextPair = spotVenue === 'DEX' ? 'PEPE' : 'BTC/USDT';
      nextLev = 1;
    } else if (tradingMode === 'FOREX') {
      nextPair = 'EUR/USD';
      nextLev = 100;
    }

    const nextState: CalculatorState = {
      ...calcState,
      tradingMode,
      spotVenue: tradingMode === 'SPOT' ? spotVenue : calcState.spotVenue,
      accountBalance: activeBalance,
      pair: nextPair,
      direction: 'LONG',
      spotDirection: 'BUY',
      entryPrice: nextEntry,
      stopLoss: nextSL,
      takeProfit: nextTP,
      riskPercentage: defaultRisk,
      leverage: nextLev,
      forexLeverage: tradingMode === 'FOREX' ? 100 : undefined,
      dexChain: spotVenue === 'DEX' ? 'Ethereum' : calcState.dexChain,
      dexProtocol: spotVenue === 'DEX' ? 'Uniswap' : calcState.dexProtocol,
      dexToken: spotVenue === 'DEX' ? 'PEPE' : calcState.dexToken,
      dexWallet: spotVenue === 'DEX' ? 'MetaMask' : calcState.dexWallet,
      dexGasFee: spotVenue === 'DEX' ? 8.50 : calcState.dexGasFee,
      dexNetworkFee: 0,
      dexTradingFeePct: spotVenue === 'DEX' ? 0.30 : calcState.dexTradingFeePct,
      dexPriceImpactPct: spotVenue === 'DEX' ? 0.15 : calcState.dexPriceImpactPct,
      dexSlippagePct: spotVenue === 'DEX' ? 0.50 : calcState.dexSlippagePct,
      tokenLiquidity: spotVenue === 'DEX' ? 250000 : undefined,
      marginMode: 'ISOLATED',
      feeTier: 'taker',
      feeRate: FEE_PRESETS.taker.rate,
      estimatedFundingRate: 0.0001,
      slippagePct: 0.05,
      maintenanceMarginPct: 0.5,
    };

    setCalcState(nextState);
    setRawInputs({
      balance: activeBalance.toString(),
      entry: '',
      stopLoss: '',
      takeProfit: '',
      riskPct: defaultRisk.toString(),
      leverage: nextLev.toString(),
      slippage: '0.05',
      mmr: '0.5',
      maxCapital: activeBalance.toString(),
      dexGasFee: '8.50',
      dexPriceImpact: '0.15',
      dexSlippage: '0.5',
      tokenLiquidity: '250000',
    });

    setIsGateOverridden(false);
    setShowAdvancedFees(false);
    setShowLeverageSimulator(false);
    setJustReset(true);
    setResetFeedbackText(
      `Calculator reset to plan defaults ($${formatNumber(activeBalance)} equity, ${defaultRisk}% risk). Price levels cleared.`
    );

    saveCalculatorSettings(nextState);

    setTimeout(() => {
      setJustReset(false);
    }, 1800);

    setTimeout(() => {
      setResetFeedbackText(null);
    }, 4500);

    setTimeout(() => {
      entryInputRef.current?.focus();
    }, 120);
  };

  // Load realistic sample trade for active mode
  const handleLoadSample = () => {
    const activeBalance = stats?.currentEquity || plan?.startingCapital || 10000;
    const defaultRisk = plan?.defaultRiskPerTrade || plan?.riskPerTradePct || 1.0;

    if (tradingMode === 'SPOT') {
      if (spotVenue === 'CEX') {
        const sampleState: CalculatorState = {
          ...calcState,
          tradingMode: 'SPOT',
          spotVenue: 'CEX',
          accountBalance: activeBalance,
          pair: 'BTC/USDT',
          direction: 'LONG',
          spotDirection: 'BUY',
          entryPrice: 65000,
          stopLoss: 63500,
          takeProfit: 68000,
          riskPercentage: defaultRisk,
          leverage: 1,
          spotSizingMethod: 'RISK_BASED',
          spotMaxCapital: activeBalance,
        };
        setCalcState(sampleState);
        setRawInputs((prev) => ({
          ...prev,
          balance: activeBalance.toString(),
          entry: '65000',
          stopLoss: '63500',
          takeProfit: '68000',
          riskPct: defaultRisk.toString(),
          leverage: '1',
          maxCapital: activeBalance.toString(),
        }));
      } else {
        const sampleState: CalculatorState = {
          ...calcState,
          tradingMode: 'SPOT',
          spotVenue: 'DEX',
          accountBalance: activeBalance,
          pair: 'PEPE',
          dexToken: 'PEPE',
          dexChain: 'Ethereum',
          dexProtocol: 'Uniswap',
          dexWallet: 'MetaMask',
          dexGasFee: 8.50,
          dexNetworkFee: 0,
          dexTradingFeePct: 0.30,
          dexPriceImpactPct: 0.15,
          dexSlippagePct: 0.50,
          tokenLiquidity: 250000,
          direction: 'LONG',
          spotDirection: 'BUY',
          entryPrice: 0.000012,
          stopLoss: 0.0000105,
          takeProfit: 0.000015,
          riskPercentage: defaultRisk,
          leverage: 1,
          spotSizingMethod: 'RISK_BASED',
          spotMaxCapital: activeBalance,
        };
        setCalcState(sampleState);
        setRawInputs((prev) => ({
          ...prev,
          balance: activeBalance.toString(),
          entry: '0.000012',
          stopLoss: '0.0000105',
          takeProfit: '0.000015',
          riskPct: defaultRisk.toString(),
          leverage: '1',
          dexGasFee: '8.50',
          dexPriceImpact: '0.15',
          dexSlippage: '0.5',
          tokenLiquidity: '250000',
        }));
      }
    } else if (tradingMode === 'FOREX') {
      const sampleState: CalculatorState = {
        ...calcState,
        tradingMode: 'FOREX',
        accountBalance: activeBalance,
        pair: 'EUR/USD',
        direction: 'LONG',
        entryPrice: 1.08500,
        stopLoss: 1.08250,
        takeProfit: 1.09000,
        riskPercentage: defaultRisk,
        leverage: 100,
        forexLeverage: 100,
        forexPipSize: 0.0001,
        forexPipValue: 10,
        forexStandardLotUnits: 100000,
      };
      setCalcState(sampleState);
      setRawInputs((prev) => ({
        ...prev,
        balance: activeBalance.toString(),
        entry: '1.08500',
        stopLoss: '1.08250',
        takeProfit: '1.09000',
        riskPct: defaultRisk.toString(),
        leverage: '100',
      }));
    } else {
      // Perpetual
      const defaultLev = Math.min(10, plan?.maxLeverage || 10);
      const sampleState: CalculatorState = {
        ...calcState,
        tradingMode: 'PERPETUAL',
        accountBalance: activeBalance,
        pair: 'BTCUSDT',
        direction: 'LONG',
        entryPrice: 65000,
        stopLoss: 63500,
        takeProfit: 68000,
        riskPercentage: defaultRisk,
        leverage: defaultLev,
        marginMode: 'ISOLATED',
        feeTier: 'taker',
        feeRate: FEE_PRESETS.taker.rate,
        estimatedFundingRate: 0.0001,
        slippagePct: 0.05,
        maintenanceMarginPct: 0.5,
      };
      setCalcState(sampleState);
      setRawInputs((prev) => ({
        ...prev,
        balance: activeBalance.toString(),
        entry: '65000',
        stopLoss: '63500',
        takeProfit: '68000',
        riskPct: defaultRisk.toString(),
        leverage: defaultLev.toString(),
      }));
    }
  };

  // Copy trade summary tailored to active mode and venue
  const handleCopySummary = () => {
    let summaryText = '';

    if (tradingMode === 'SPOT') {
      if (spotVenue === 'CEX') {
        summaryText = `SPOT CEX TRADE PLAN
Pair: ${calcState.pair}
Direction: ${calcState.spotDirection || (calcState.direction === 'LONG' ? 'BUY' : 'SELL')}
Entry Price: $${formatNumber(calcState.entryPrice)}
Stop Loss: $${formatNumber(calcState.stopLoss)} (${result.priceRiskPercentage.toFixed(2)}%)
Take Profit: $${formatNumber(calcState.takeProfit)}
Quantity: ${formatNumber(result.quantity, 4, 6)} ${getBaseAsset(calcState.pair)}
Total Capital: $${formatNumber(result.positionSize)}
Risk: $${formatNumber(result.riskAmount)} (${calcState.riskPercentage}% of $${formatNumber(calcState.accountBalance)})
Reward: $${formatNumber(result.netProfit)} (1:${result.riskRewardRatio.toFixed(2)} R:R)
Break-Even: $${formatNumber(result.breakevenPrice)}
Liquidation: None (100% Cash-Settled Spot)`;
      } else {
        summaryText = `SPOT DEX ON-CHAIN SWAP PLAN
Network: ${calcState.dexChain || 'Ethereum'} (${calcState.dexProtocol || 'Uniswap'})
Token: ${calcState.dexToken || calcState.pair}
Wallet: ${calcState.dexWallet || 'MetaMask'}
Direction: ${calcState.spotDirection || (calcState.direction === 'LONG' ? 'BUY' : 'SELL')}
Entry Price: $${formatNumber(calcState.entryPrice, 4, 8)}
Stop Loss: $${formatNumber(calcState.stopLoss, 4, 8)} (${result.priceRiskPercentage.toFixed(2)}%)
Take Profit: $${formatNumber(calcState.takeProfit, 4, 8)}
Token Quantity: ${formatNumber(result.quantity, 2, 8)} ${calcState.dexToken || calcState.pair}
Total Swap Capital: $${formatNumber(result.positionSize)}
Estimated Gas: $${formatNumber(calcState.dexGasFee || 0)}
Price Impact: ${(calcState.dexPriceImpactPct || 0).toFixed(2)}% | Slippage: ${(calcState.dexSlippagePct || 0.5).toFixed(2)}%
Estimated Total Fees: $${formatNumber(result.feeImpact || 0)}
Risk: $${formatNumber(result.riskAmount)} (${calcState.riskPercentage}% of $${formatNumber(calcState.accountBalance)})
Reward: $${formatNumber(result.netProfit)} (1:${result.riskRewardRatio.toFixed(2)} R:R)
Break-Even: $${formatNumber(result.breakevenPrice, 4, 8)}
Liquidation: None (100% On-Chain Spot Swap)`;
      }
    } else if (tradingMode === 'FOREX') {
      summaryText = `FOREX TRADE PLAN
Currency Pair: ${calcState.pair}
Direction: ${calcState.direction === 'LONG' ? 'BUY' : 'SELL'}
Entry Price: ${formatNumber(calcState.entryPrice, 4, 5)}
Stop Loss: ${formatNumber(calcState.stopLoss, 4, 5)} (${result.forex?.stopLossPips || 0} pips)
Take Profit: ${formatNumber(calcState.takeProfit, 4, 5)} (${result.forex?.takeProfitPips || 0} pips)
Lot Size: ${result.forex?.lotSize || 0} Lots (${result.forex?.miniLots} Mini / ${result.forex?.microLots} Micro)
Contract Units: ${(result.forex?.units || 0).toLocaleString()}
Leverage: ${calcState.forexLeverage || calcState.leverage || 100}:1
Required Margin: $${formatNumber(result.marginRequired)}
Risk: $${formatNumber(result.riskAmount)} (${calcState.riskPercentage}% of $${formatNumber(calcState.accountBalance)})
Reward: $${formatNumber(result.netProfit)} (1:${result.riskRewardRatio.toFixed(2)} R:R)
Break-Even: ${formatNumber(result.breakevenPrice, 4, 5)}`;
    } else {
      summaryText = `CRYPTO PERPETUAL TRADE PLAN
Pair: ${calcState.pair}
Direction: ${calcState.direction}
Entry: $${formatNumber(calcState.entryPrice)}
Stop Loss: $${formatNumber(calcState.stopLoss)} (${result.priceRiskPercentage.toFixed(2)}%)
Take Profit: $${formatNumber(calcState.takeProfit)}
Leverage: ${calcState.leverage}x (${calcState.marginMode})
Position Size: $${formatNumber(result.positionSize)} (${formatNumber(result.quantity, 4, 6)} ${getBaseAsset(calcState.pair)})
Margin Required: $${formatNumber(result.marginRequired)}
Risk: $${formatNumber(result.riskAmount)} (${calcState.riskPercentage}% of $${formatNumber(calcState.accountBalance)})
Reward: $${formatNumber(result.netProfit)} (1:${result.riskRewardRatio.toFixed(2)} R:R)
Est. Liquidation: $${formatNumber(result.liquidationPrice)} (${result.distanceToLiquidationPct.toFixed(2)}% distance)`;
    }

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleSimulator = () => {
    const nextState = !showLeverageSimulator;
    setShowLeverageSimulator(nextState);
    if (nextState) {
      setTimeout(() => {
        simulatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleTrackInPortfolio = async () => {
    if (result.positionSize <= 0) return;

    // Strict mode determination based on active calculator trading mode
    const isSpot = tradingMode === 'SPOT';
    const isPerp = tradingMode === 'PERPETUAL';
    const isForex = tradingMode === 'FOREX';
    const isDex = isSpot && spotVenue === 'DEX';

    const effectiveLev = isSpot 
      ? 1 
      : isForex 
      ? (calcState.forexLeverage || 100) 
      : (calcState.leverage || 1);

    const quantity = calcState.entryPrice > 0 ? (result.positionSize / calcState.entryPrice) : 0;
    const dir = (calcState.direction === 'BUY' ? 'LONG' : calcState.direction === 'SELL' ? 'SHORT' : calcState.direction) as TradeDirection;

    // Margin: Spot is 100% cash size; Perpetual / Forex uses leverage-adjusted margin
    const margin = isSpot
      ? result.positionSize
      : (result.marginRequired || (effectiveLev > 0 ? result.positionSize / effectiveLev : result.positionSize));

    const newPos: OpenPosition = {
      pair: calcState.pair.trim().toUpperCase(),
      tradeMode: tradingMode, // Strictly SPOT, PERPETUAL, or FOREX
      spotVenue: isSpot ? spotVenue : undefined,
      direction: dir,
      entryPrice: calcState.entryPrice,
      currentPrice: calcState.entryPrice,
      stopLoss: calcState.stopLoss,
      takeProfit: calcState.takeProfit > 0 ? calcState.takeProfit : undefined,
      quantity,
      positionSize: result.positionSize,
      margin,
      leverage: effectiveLev,
      riskAmount: result.riskAmount,
      riskPct: calcState.riskPercentage,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      liquidationPrice: isPerp ? (result.liquidationPrice || 0) : 0,
      distanceToLiquidationPct: isPerp ? (result.distanceToLiquidationPct || 0) : 0,
      correlationGroup: 
        isForex ? 'Forex Majors' :
        calcState.pair.startsWith('BTC') ? 'BTC-Related' :
        calcState.pair.startsWith('ETH') ? 'Layer-1s' :
        isDex ? 'Memes & High-Beta' : 'Altcoins',
      exchange: isDex ? 'Other' : ((calcState.exchange as any) || (isForex ? 'Forex Broker' : 'Binance')),
      createdAt: new Date().toISOString(),
      // Forex-specific fields ONLY populated when trading Forex
      lotSize: isForex ? (result.forex?.lotSize || (result.positionSize / 100000)) : undefined,
      pipSize: isForex ? (calcState.forexPipSize || (calcState.pair.includes('JPY') ? 0.01 : 0.0001)) : undefined,
      pipValue: isForex ? (calcState.forexPipValue || 10) : undefined,
      // DEX-specific fields ONLY populated when trading Spot on DEX
      dexChain: isDex ? (calcState.chain || calcState.dexChain || 'Ethereum') : undefined,
      dexProtocol: isDex ? (calcState.dex || calcState.dexProtocol || 'Uniswap') : undefined,
      dexToken: isDex ? (calcState.token || calcState.dexToken || calcState.pair) : undefined,
      dexGasFee: isDex ? (calcState.dexGasFee || 8.5) : undefined,
    };

    if (onOpenPosition) {
      await onOpenPosition(newPos);
    }
    setPositionTrackedSuccess(true);
    setTimeout(() => setPositionTrackedSuccess(false), 5000);
  };

  const isSaveApproved = (riskGateValidation.isApproved || riskGateValidation.passed) || isGateOverridden;

  return (
    <div id="risk-calculator-view" className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12 sm:pb-16 w-full max-w-full overflow-x-hidden">
      
      {/* 1. TRADING MODE SWITCHER: ONLY 3 PRIMARY MODES [ SPOT ] [ PERPETUAL ] [ FOREX ] */}
      <div 
        id="trading-mode-selector-container"
        className="bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-2xs flex items-center gap-1.5 sm:gap-2"
      >
        <button
          id="mode-btn-spot"
          type="button"
          onClick={() => handleSelectTradingMode('SPOT')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            tradingMode === 'SPOT'
              ? 'bg-[#1565ff] text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>SPOT</span>
        </button>

        <button
          id="mode-btn-perpetual"
          type="button"
          onClick={() => handleSelectTradingMode('PERPETUAL')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            tradingMode === 'PERPETUAL'
              ? 'bg-[#1565ff] text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>PERPETUAL</span>
        </button>

        <button
          id="mode-btn-forex"
          type="button"
          onClick={() => handleSelectTradingMode('FOREX')}
          className={`flex-1 py-2.5 px-2 sm:px-3 rounded-xl font-black text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            tradingMode === 'FOREX'
              ? 'bg-[#1565ff] text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>FOREX</span>
        </button>
      </div>

      {/* SPOT VENUE TOGGLE: [ CEX ] [ DEX ] (Shown when Spot Mode is active) */}
      {tradingMode === 'SPOT' && (
        <div 
          id="spot-venue-selector-container"
          className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 transition-all"
        >
          <div className="flex items-center gap-2 pl-1">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Spot Venue:</span>
            <span className="text-xs text-slate-500">
              {spotVenue === 'CEX' ? 'Centralized Order Book (Binance, Bybit, Coinbase)' : 'On-Chain AMM Swaps (Uniswap, Raydium, PancakeSwap)'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0 self-start sm:self-auto">
            <button
              id="venue-btn-cex"
              type="button"
              onClick={() => handleSelectSpotVenue('CEX')}
              className={`py-1.5 px-4 rounded-lg font-bold text-xs tracking-wide transition-all cursor-pointer ${
                spotVenue === 'CEX'
                  ? 'bg-[#1565ff] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CEX
            </button>
            <button
              id="venue-btn-dex"
              type="button"
              onClick={() => handleSelectSpotVenue('DEX')}
              className={`py-1.5 px-4 rounded-lg font-bold text-xs tracking-wide transition-all cursor-pointer ${
                spotVenue === 'DEX'
                  ? 'bg-[#1565ff] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              DEX
            </button>
          </div>
        </div>
      )}

      {/* KILL SWITCH WARNING */}
      {killSwitchActive && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 text-red-900 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Flame className="w-5 h-5 text-red-600 shrink-0 animate-pulse" />
            <span className="text-xs font-bold truncate">
              KILL SWITCH ACTIVE: Daily risk limit reached. New trade execution is locked.
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] px-2.5 py-1 bg-red-600 text-white rounded-lg font-bold uppercase shrink-0">
            Halted
          </span>
        </div>
      )}

      {/* TWO COLUMN GRID ON DESKTOP, LINEAR STACK ON MOBILE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* 2. POSITION PARAMETERS COLUMN (5 COLS ON DESKTOP) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Calculator className="w-3.5 h-3.5 text-[#1565ff] shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 truncate">
                  {tradingMode === 'SPOT' ? (spotVenue === 'DEX' ? 'Spot DEX Parameters' : 'Spot CEX Parameters') : tradingMode === 'FOREX' ? 'Forex Parameters' : 'Perpetual Parameters'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id="calc-price-alerts-btn"
                  type="button"
                  onClick={() => handleOpenAlertModal(alertModalDefaultTarget)}
                  title="Set price alerts with browser notifications"
                  className={`px-2.5 py-1 min-h-[32px] text-[11px] sm:text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs ${
                    activeAlertsCount > 0
                      ? 'bg-blue-50 border-blue-300 text-[#1565ff] ring-1 ring-blue-200'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Bell className={`w-3.5 h-3.5 shrink-0 ${activeAlertsCount > 0 ? 'text-[#1565ff] animate-pulse' : 'text-slate-500'}`} />
                  <span>Alerts</span>
                  {activeAlertsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#1565ff] text-white text-[9px] font-black leading-tight">
                      {activeAlertsCount}
                    </span>
                  )}
                </button>

                <button
                  id="load-sample-btn"
                  type="button"
                  onClick={handleLoadSample}
                  title={`Load sample ${tradingMode === 'SPOT' ? `Spot ${spotVenue}` : tradingMode} trade`}
                  className="px-2 py-1 min-h-[32px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] sm:text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="hidden xs:inline sm:inline">Sample</span>
                </button>

                <button
                  id="reset-calculator-btn"
                  type="button"
                  onClick={handleReset}
                  title="Clear prices and reset all fields to trading plan rules"
                  className={`px-2.5 py-1 min-h-[32px] text-[11px] sm:text-xs font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${
                    justReset
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-200'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {justReset ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Reset!</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Reset</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RESET / SAMPLE NOTIFICATION BANNER */}
            {resetFeedbackText && (
              <div 
                id="calc-feedback-banner"
                className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-start sm:items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-150"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="leading-snug">{resetFeedbackText}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setResetFeedbackText(null)}
                  className="text-emerald-700 hover:text-emerald-950 font-bold text-xs px-1 shrink-0 cursor-pointer"
                  aria-label="Dismiss message"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Account Balance Field */}
            <div>
              <label htmlFor="calc-balance-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                {tradingMode === 'SPOT' && spotVenue === 'DEX' ? 'Wallet Balance ($ USD)' : `Account Balance (${tradingMode === 'FOREX' ? calcState.forexAccountCurrency || 'USD' : '$ USDT'})`}
              </label>
              <div className="relative">
                <span className="absolute left-2.5 inset-y-0 flex items-center text-slate-400 font-mono text-xs sm:text-sm pointer-events-none">$</span>
                <input
                  ref={balanceInputRef}
                  id="calc-balance-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="e.g. 10000"
                  value={rawInputs.balance}
                  onChange={(e) => handleBalanceChange(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg pl-7 pr-3 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Instrument Pair & Direction */}
            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2 items-start">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label htmlFor="calc-pair-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider block truncate">
                    {tradingMode === 'SPOT' ? (spotVenue === 'DEX' ? 'Token / Pair' : 'Spot Coin / Pair') : tradingMode === 'FOREX' ? 'Currency Pair' : 'Perpetual Contract'}
                  </label>
                  {liveMarketPrice && liveMarketPrice > 0 ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        ${formatNumber(liveMarketPrice)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEntryChange(liveMarketPrice.toString())}
                        title="Fill Entry Price with live market quote"
                        className="text-[9px] font-bold text-[#1565ff] hover:underline cursor-pointer"
                      >
                        Use
                      </button>
                    </div>
                  ) : null}
                </div>
                <input
                  id="calc-pair-input"
                  type="text"
                  list="calc-pairs-datalist"
                  value={calcState.pair}
                  onChange={(e) => {
                    const clean = e.target.value.toUpperCase().replace(/\s+/g, '');
                    setCalcState((prev) => ({ 
                      ...prev, 
                      pair: clean,
                      dexToken: (tradingMode === 'SPOT' && spotVenue === 'DEX') ? clean : prev.dexToken,
                      forexPipSize: tradingMode === 'FOREX' ? getStandardPipSize(clean) : prev.forexPipSize,
                      forexPipValue: tradingMode === 'FOREX' ? getDefaultPipValue(clean) : prev.forexPipValue,
                    }));
                  }}
                  placeholder={tradingMode === 'SPOT' ? (spotVenue === 'DEX' ? 'e.g. PEPE' : 'e.g. BTC/USDT') : tradingMode === 'FOREX' ? 'e.g. EUR/USD' : 'e.g. BTCUSDT'}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white uppercase transition-colors"
                />
                <datalist id="calc-pairs-datalist">
                  {tradingMode === 'SPOT' && spotVenue === 'CEX' && COMMON_SPOT_PAIRS.map((p) => <option key={p} value={p} />)}
                  {tradingMode === 'SPOT' && spotVenue === 'DEX' && COMMON_DEX_TOKENS.map((t) => <option key={t} value={t} />)}
                  {tradingMode === 'PERPETUAL' && COMMON_CRYPTO_PAIRS.map((p) => <option key={p} value={p} />)}
                  {tradingMode === 'FOREX' && COMMON_FOREX_PAIRS.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>

              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 h-9 box-border">
                  <button
                    id="calc-direction-long"
                    type="button"
                    onClick={() => setCalcState({ ...calcState, direction: 'LONG', spotDirection: 'BUY' })}
                    className={`h-full rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                      calcState.direction === 'LONG' || calcState.spotDirection === 'BUY'
                        ? 'bg-[#22a65e] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>{tradingMode === 'SPOT' ? 'BUY' : 'LONG'}</span>
                  </button>
                  <button
                    id="calc-direction-short"
                    type="button"
                    onClick={() => setCalcState({ ...calcState, direction: 'SHORT', spotDirection: 'SELL' })}
                    className={`h-full rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                      calcState.direction === 'SHORT' || calcState.spotDirection === 'SELL'
                        ? 'bg-[#ff3b4a] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingDown className="w-3 h-3 shrink-0" />
                    <span>{tradingMode === 'SPOT' ? 'SELL' : 'SHORT'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Instrument Chips */}
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block leading-none">
                Quick Instruments:
              </span>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar w-full">
                {tradingMode === 'SPOT' && spotVenue === 'CEX' && ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT', 'DOGE/USDT', 'SUI/USDT', 'PEPE/USDT'].map((p) => {
                  const isSelected = calcState.pair === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCalcState({ ...calcState, pair: p })}
                      className={`h-7 px-2 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center active:scale-95 ${
                        isSelected
                          ? 'bg-[#1565ff] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p.replace('/USDT', '')}
                    </button>
                  );
                })}

                {tradingMode === 'SPOT' && spotVenue === 'DEX' && ['PEPE', 'UNI', 'AERO', 'RAY', 'CAKE', 'SOL', 'PENDLE', 'WIF'].map((token) => {
                  const isSelected = calcState.pair === token;
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => {
                        setCalcState((prev) => ({
                          ...prev,
                          pair: token,
                          dexToken: token,
                        }));
                      }}
                      className={`h-7 min-w-[42px] px-2 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center active:scale-95 ${
                        isSelected
                          ? 'bg-[#1565ff] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {token}
                    </button>
                  );
                })}

                {tradingMode === 'PERPETUAL' && ['BTC', 'ETH', 'SOL', 'SUI', 'DOGE', 'XRP', 'PEPE', 'KAS'].map((sym) => {
                  const pairVal = `${sym}USDT`;
                  const isSelected = calcState.pair === pairVal || calcState.pair === sym;
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setCalcState({ ...calcState, pair: pairVal })}
                      className={`h-7 min-w-[42px] px-2 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center active:scale-95 ${
                        isSelected
                          ? 'bg-[#1565ff] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}

                {tradingMode === 'FOREX' && ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'XAU/USD'].map((p) => {
                  const isSelected = calcState.pair === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setCalcState((prev) => ({
                          ...prev,
                          pair: p,
                          forexPipSize: getStandardPipSize(p),
                          forexPipValue: getDefaultPipValue(p),
                          forexStandardLotUnits: getStandardLotUnits(p),
                        }));
                      }}
                      className={`h-7 px-2 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center active:scale-95 ${
                        isSelected
                          ? 'bg-[#1565ff] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Entry Price */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label htmlFor="calc-entry-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Entry Price {tradingMode === 'FOREX' ? '(Exchange Rate)' : '($)'}
                </label>
                <button
                  type="button"
                  onClick={() => handleOpenAlertModal('ENTRY')}
                  title="Set browser notification price alert for Entry Price"
                  className="text-[10px] font-bold text-[#1565ff] hover:text-[#0c53dc] flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Bell className="w-2.5 h-2.5" />
                  <span>Set Alert</span>
                </button>
              </div>
              <input
                ref={entryInputRef}
                id="calc-entry-input"
                type="number"
                inputMode="decimal"
                step="any"
                placeholder={tradingMode === 'FOREX' ? 'e.g. 1.08500' : 'e.g. 65000'}
                value={rawInputs.entry}
                onChange={(e) => handleEntryChange(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
              />
            </div>

            {/* Stop Loss & Take Profit (Side-by-side) */}
            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
              <div>
                <div className="h-5 flex items-center justify-between mb-0.5">
                  <label htmlFor="calc-sl-input" className="text-[10px] sm:text-[11px] font-bold text-[#ff3b4a] uppercase tracking-wider block leading-none">
                    Stop Loss {tradingMode === 'FOREX' ? '(Price / Rate)' : '($)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenAlertModal('STOP_LOSS')}
                    title="Set browser notification price alert for Stop Loss"
                    className="text-[10px] font-bold text-[#ff3b4a] hover:text-red-700 flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Bell className="w-2.5 h-2.5" />
                    <span>Alert</span>
                  </button>
                </div>
                <input
                  ref={stopLossInputRef}
                  id="calc-sl-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="Stop Loss"
                  value={rawInputs.stopLoss}
                  onChange={(e) => handleStopLossChange(e.target.value)}
                  className="w-full h-9 bg-red-50/50 border border-red-200 rounded-lg px-2.5 text-xs sm:text-sm font-mono text-[#ff3b4a] font-bold focus:outline-none focus:border-[#ff3b4a] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <div className="h-5 flex items-center justify-between mb-0.5">
                  <label htmlFor="calc-tp-input" className="text-[10px] sm:text-[11px] font-bold text-[#22a65e] uppercase tracking-wider block leading-none">
                    Take Profit {tradingMode === 'FOREX' ? '(Price / Rate)' : '($)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenAlertModal('TAKE_PROFIT')}
                    title="Set browser notification price alert for Take Profit"
                    className="text-[10px] font-bold text-[#22a65e] hover:text-emerald-700 flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Bell className="w-2.5 h-2.5" />
                    <span>Alert</span>
                  </button>
                </div>
                <input
                  ref={takeProfitInputRef}
                  id="calc-tp-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="Take Profit"
                  value={rawInputs.takeProfit}
                  onChange={(e) => handleTakeProfitChange(e.target.value)}
                  className="w-full h-9 bg-emerald-50/50 border border-emerald-200 rounded-lg px-2.5 text-xs sm:text-sm font-mono text-[#22a65e] font-bold focus:outline-none focus:border-[#22a65e] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Risk Percentage & Sizing / Leverage */}
            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
              {/* Risk Per Trade */}
              <div>
                <div className="h-5 flex items-center justify-between mb-0.5">
                  <label htmlFor="calc-risk-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate block leading-none">
                    Risk {riskInputMode === 'PERCENT' ? '(%)' : '($)'}
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRiskInputMode('PERCENT')}
                      className={`h-4.5 px-1.5 flex items-center justify-center rounded text-[10px] font-bold transition-colors cursor-pointer leading-none ${
                        riskInputMode === 'PERCENT'
                          ? 'bg-[#1565ff] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setRiskInputMode('AMOUNT')}
                      className={`h-4.5 px-1.5 flex items-center justify-center rounded text-[10px] font-bold transition-colors cursor-pointer leading-none ${
                        riskInputMode === 'AMOUNT'
                          ? 'bg-[#1565ff] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      $
                    </button>
                  </div>
                </div>

                {riskInputMode === 'PERCENT' ? (
                  <div className="relative">
                    <input
                      ref={riskInputRef}
                      id="calc-risk-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0.01"
                      max="100"
                      value={rawInputs.riskPct}
                      onChange={(e) => handleRiskPctChange(e.target.value)}
                      placeholder="1.0"
                      className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg pl-2.5 pr-6 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
                    />
                    <span className="absolute right-2.5 inset-y-0 flex items-center text-slate-400 font-mono text-xs pointer-events-none">%</span>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-2.5 inset-y-0 flex items-center text-slate-400 font-mono text-xs pointer-events-none">$</span>
                    <input
                      ref={riskInputRef}
                      id="calc-risk-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="1"
                      value={rawInputs.riskAmount}
                      onChange={(e) => handleRiskAmountChange(e.target.value)}
                      placeholder="100"
                      className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg pl-6 pr-2 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
                    />
                  </div>
                )}

                {/* Risk Presets */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar mt-1">
                  {riskInputMode === 'PERCENT' ? (
                    [0.5, 1.0, 2.0, 3.0, 5.0].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRiskPctChange(String(r))}
                        className={`h-6.5 px-1.5 min-w-[30px] rounded-md text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center justify-center active:scale-95 ${
                          parseFloat(rawInputs.riskPct) === r
                            ? 'bg-[#1565ff] text-white shadow-2xs font-bold'
                            : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {r}%
                      </button>
                    ))
                  ) : (
                    [25, 50, 100, 250, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleRiskAmountChange(String(amt))}
                        className={`h-6.5 px-1.5 min-w-[32px] rounded-md text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center justify-center active:scale-95 ${
                          parseFloat(rawInputs.riskAmount) === amt
                            ? 'bg-[#1565ff] text-white shadow-2xs font-bold'
                            : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Mode-specific Right Column Input: */}
              {/* SPOT: Sizing Method & Max Capital */}
              {tradingMode === 'SPOT' && (
                <div>
                  <div className="h-5 flex items-center justify-between mb-0.5">
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate block leading-none">
                      {spotVenue === 'DEX' ? 'Max Swap Capital ($)' : 'Max Available Capital ($)'}
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 inset-y-0 flex items-center text-slate-400 font-mono text-xs pointer-events-none">$</span>
                    <input
                      id="calc-spot-capital-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder={spotVenue === 'DEX' ? 'e.g. 5000' : 'e.g. 10000'}
                      value={rawInputs.maxCapital}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRawInputs((prev) => ({ ...prev, maxCapital: val }));
                        const parsed = parseFloat(val);
                        setCalcState((prev) => ({ ...prev, spotMaxCapital: isNaN(parsed) ? 0 : parsed }));
                      }}
                      className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg pl-6 pr-2.5 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 h-6.5">
                    <span>{spotVenue === 'DEX' ? 'Non-Leveraged (1x)' : '100% Cash Settled'}</span>
                    <span className="font-bold text-emerald-600">{spotVenue === 'DEX' ? 'Direct Swap' : 'Zero Liq Risk'}</span>
                  </div>
                </div>
              )}

              {/* PERPETUAL: Leverage Slider & Input */}
              {tradingMode === 'PERPETUAL' && (
                <div>
                  <div className="h-5 flex items-center justify-between mb-0.5">
                    <label htmlFor="calc-leverage-input" className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate block leading-none">
                      Leverage ({calcState.leverage}x)
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 focus-within:border-[#1565ff] focus-within:bg-white transition-colors">
                    <input
                      id="calc-leverage-slider"
                      type="range"
                      min="1"
                      max="100"
                      value={calcState.leverage > 100 ? 100 : calcState.leverage}
                      onChange={(e) => handleLeverageChange(e.target.value)}
                      className="w-full min-w-0 accent-[#1565ff] cursor-pointer h-3"
                    />
                    <div className="relative w-11 shrink-0 flex items-center">
                      <input
                        ref={leverageInputRef}
                        id="calc-leverage-input"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="125"
                        value={calcState.leverage}
                        onChange={(e) => handleLeverageChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-md py-0.5 pl-0.5 pr-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] text-center"
                      />
                      <span className="absolute right-1 text-slate-400 font-mono text-[10px] pointer-events-none">x</span>
                    </div>
                  </div>
                  {/* Leverage Presets */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar mt-1">
                    {[1, 5, 10, 20, 30, 50].map((lev) => (
                      <button
                        key={lev}
                        type="button"
                        onClick={() => handleLeverageChange(String(lev))}
                        className={`h-6.5 px-1.5 min-w-[30px] rounded-md text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center justify-center active:scale-95 ${
                          calcState.leverage === lev
                            ? 'bg-[#1565ff] text-white shadow-2xs font-bold'
                            : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* FOREX: Broker Leverage Presets */}
              {tradingMode === 'FOREX' && (
                <div>
                  <div className="h-5 flex items-center justify-between mb-0.5">
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate block leading-none">
                      Broker Leverage ({calcState.forexLeverage || calcState.leverage || 100}:1)
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 focus-within:border-[#1565ff] focus-within:bg-white transition-colors">
                    <input
                      id="calc-forex-leverage-slider"
                      type="range"
                      min="10"
                      max="500"
                      step="10"
                      value={calcState.forexLeverage || calcState.leverage || 100}
                      onChange={(e) => handleLeverageChange(e.target.value)}
                      className="w-full min-w-0 accent-[#1565ff] cursor-pointer h-3"
                    />
                    <div className="relative w-14 shrink-0 flex items-center">
                      <input
                        ref={leverageInputRef}
                        id="calc-forex-leverage-input"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="1000"
                        value={calcState.forexLeverage || calcState.leverage || 100}
                        onChange={(e) => handleLeverageChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-md py-0.5 pl-0.5 pr-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] text-center"
                      />
                      <span className="absolute right-0.5 text-slate-400 font-mono text-[9px] pointer-events-none">:1</span>
                    </div>
                  </div>
                  {/* Forex Leverage Presets */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar mt-1">
                    {FOREX_LEVERAGE_PRESETS.map((lev) => (
                      <button
                        key={lev}
                        type="button"
                        onClick={() => handleLeverageChange(String(lev))}
                        className={`h-6.5 px-1.5 min-w-[34px] rounded-md text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center justify-center active:scale-95 ${
                          (calcState.forexLeverage || calcState.leverage || 100) === lev
                            ? 'bg-[#1565ff] text-white shadow-2xs font-bold'
                            : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {lev}:1
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mode-specific secondary settings */}
            {tradingMode === 'PERPETUAL' && (
              <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                    Margin Mode
                  </label>
                  <select
                    value={calcState.marginMode}
                    onChange={(e) => setCalcState({ ...calcState, marginMode: e.target.value as MarginMode })}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                  >
                    <option value="ISOLATED">Isolated Margin</option>
                    <option value="CROSS">Cross Margin</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                    Fee Tier
                  </label>
                  <select
                    value={calcState.feeTier}
                    onChange={(e) => handleFeeTierChange(e.target.value as FeeTier)}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                  >
                    <option value="taker">Taker (0.055%)</option>
                    <option value="maker">Maker (0.02%)</option>
                    <option value="high">High Fee (0.075%)</option>
                  </select>
                </div>
              </div>
            )}

            {tradingMode === 'SPOT' && spotVenue === 'CEX' && (
              <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                    Sizing Method
                  </label>
                  <select
                    value={calcState.spotSizingMethod || 'RISK_BASED'}
                    onChange={(e) => setCalcState({ ...calcState, spotSizingMethod: e.target.value as SpotSizingMethod })}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                  >
                    <option value="RISK_BASED">Risk % of Balance</option>
                    <option value="CAPITAL_BASED">Fixed Available Capital</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                    Exchange Fee
                  </label>
                  <select
                    value={calcState.feeTier}
                    onChange={(e) => handleFeeTierChange(e.target.value as FeeTier)}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                  >
                    <option value="taker">Standard (0.10%)</option>
                    <option value="maker">Maker (0.02%)</option>
                    <option value="high">Zero Fee Tier</option>
                  </select>
                </div>
              </div>
            )}

            {tradingMode === 'SPOT' && spotVenue === 'DEX' && (
              <div className="space-y-2.5 pt-1 border-t border-slate-100">
                {/* Sizing Method & Token Liquidity */}
                <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                      Sizing Method
                    </label>
                    <select
                      value={calcState.spotSizingMethod || 'RISK_BASED'}
                      onChange={(e) => setCalcState({ ...calcState, spotSizingMethod: e.target.value as SpotSizingMethod })}
                      className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                    >
                      <option value="RISK_BASED">Risk % of Balance</option>
                      <option value="CAPITAL_BASED">Fixed Available Capital</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                      Token Liquidity (Pool TVL)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="e.g. 500000 (Optional)"
                      value={calcState.dexLiquidity ?? ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCalcState((prev) => ({ ...prev, dexLiquidity: isNaN(val) ? undefined : val }));
                      }}
                      className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>
                </div>

                {/* Network & Protocol Row */}
                <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                      Blockchain / Network
                    </label>
                    <select
                      value={calcState.dexChain || 'Ethereum'}
                      onChange={(e) => {
                        const newChain = e.target.value;
                        const defaultGas = DEX_CHAINS[newChain]?.defaultGasFee ?? 5.0;
                        setCalcState((prev) => ({
                          ...prev,
                          dexChain: newChain,
                          dexGasFee: defaultGas,
                        }));
                        setRawInputs((prev) => ({
                          ...prev,
                          dexGasFee: defaultGas.toString(),
                        }));
                      }}
                      className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                    >
                      {Object.keys(DEX_CHAINS).map((chain) => (
                        <option key={chain} value={chain}>
                          {chain}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                      DEX / AMM Protocol
                    </label>
                    <input
                      type="text"
                      list="dex-protocols-datalist"
                      value={calcState.dexProtocol || 'Uniswap'}
                      onChange={(e) => setCalcState({ ...calcState, dexProtocol: e.target.value })}
                      placeholder="e.g. Uniswap"
                      className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                    />
                    <datalist id="dex-protocols-datalist">
                      {COMMON_DEX_PROTOCOLS.map((proto) => (
                        <option key={proto} value={proto} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Gas & Fee Row */}
                <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5 truncate">
                      Gas / Network Fee ($)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={rawInputs.dexGasFee}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRawInputs((prev) => ({ ...prev, dexGasFee: val }));
                        const parsed = parseFloat(val);
                        setCalcState((prev) => ({ ...prev, dexGasFee: isNaN(parsed) ? 0 : parsed }));
                      }}
                      className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5 truncate">
                      DEX Trading Fee (%)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.05"
                      min="0"
                      value={calcState.dexTradingFeePct ?? 0.30}
                      onChange={(e) => setCalcState({ ...calcState, dexTradingFeePct: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5 truncate">
                      Slippage (%)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0.05"
                      value={rawInputs.dexSlippage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRawInputs((prev) => ({ ...prev, dexSlippage: val }));
                        const parsed = parseFloat(val);
                        setCalcState((prev) => ({ ...prev, dexSlippagePct: isNaN(parsed) ? 0.5 : parsed }));
                      }}
                      className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5 truncate">
                      Price Impact (%)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.05"
                      min="0"
                      value={rawInputs.dexPriceImpact}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRawInputs((prev) => ({ ...prev, dexPriceImpact: val }));
                        const parsed = parseFloat(val);
                        setCalcState((prev) => ({ ...prev, dexPriceImpactPct: isNaN(parsed) ? 0 : parsed }));
                      }}
                      className={`w-full h-8 border rounded-lg px-2 text-xs font-mono font-bold focus:outline-none ${
                        (calcState.dexPriceImpactPct ?? 0) >= 1.0
                          ? 'bg-amber-50 border-amber-300 text-amber-900 focus:border-amber-500'
                          : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#1565ff]'
                      }`}
                    />
                  </div>
                </div>

                {/* Estimated Total Fees summary */}
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Estimated Total Fees:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(result.feeImpact + result.estimatedSlippageCost)}
                    <span className="text-[10px] text-slate-500 ml-1 font-normal">
                      (Gas: ${formatNumber(calcState.dexGasFee || 0)} + Swap: ${formatNumber(result.feeImpact - (calcState.dexGasFee || 0))} + Slippage/Impact: ${formatNumber(result.estimatedSlippageCost)})
                    </span>
                  </span>
                </div>

                {/* Price Impact or Gas Warning Banner */}
                {(calcState.dexPriceImpactPct ?? 0) >= 1.0 && (
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      High Price Impact ({(calcState.dexPriceImpactPct ?? 0).toFixed(2)}%)! Expect severe execution slippage on low-liquidity pool.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Advanced MMR & Slippage Collapsible Accordion (Perpetual only) */}
            {tradingMode === 'PERPETUAL' && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFees(!showAdvancedFees)}
                  className="text-[11px] sm:text-xs text-[#1565ff] hover:underline font-semibold flex items-center gap-1 cursor-pointer py-0.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{showAdvancedFees ? 'Hide Advanced Parameters ▲' : 'Custom Slippage & MMR / MMP ▼'}</span>
                </button>

                {showAdvancedFees && (
                  <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2 mt-1.5 p-2 sm:p-2.5 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in duration-150">
                    <div>
                      <label className="text-[9px] sm:text-[10px] text-slate-600 font-bold block mb-0.5">Slippage (%)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={calcState.slippagePct}
                        onChange={(e) => setCalcState({ ...calcState, slippagePct: parseFloat(e.target.value) || 0.05 })}
                        className="w-full h-8 bg-white border border-slate-300 rounded-md px-2 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] sm:text-[10px] text-slate-600 font-bold block mb-0.5">Maint. Margin MMR (%)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={calcState.maintenanceMarginPct}
                        onChange={(e) => setCalcState({ ...calcState, maintenanceMarginPct: parseFloat(e.target.value) || 0.5 })}
                        className="w-full h-8 bg-white border border-slate-300 rounded-md px-2 text-xs text-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. CALCULATED RESULTS, STATUS, CHECKLIST & BUDGET (7 COLS ON DESKTOP) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* FOCAL POINT RESULT CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="bg-gradient-to-b from-slate-50 to-blue-50/30 p-4 rounded-xl border border-blue-100/80">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {tradingMode === 'SPOT' ? (spotVenue === 'DEX' ? 'Token Swap Output' : 'Spot Position Size') : tradingMode === 'FOREX' ? 'Forex Lot Sizing' : 'Target Position Size'}
                </span>
                
                {tradingMode === 'SPOT' ? (
                  spotVenue === 'DEX' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs bg-purple-50 text-purple-700 border-purple-200">
                      100% On-Chain • {calcState.dexChain || 'Ethereum'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs bg-emerald-50 text-emerald-700 border-emerald-200">
                      100% Cash • 0x Liq
                    </span>
                  )
                ) : tradingMode === 'FOREX' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs bg-blue-50 text-[#1565ff] border-blue-200">
                    {result.forex?.lotSize || 0} Standard Lots
                  </span>
                ) : (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs ${
                    result.riskTier === 'Conservative' ? 'bg-emerald-50 text-[#22a65e] border-emerald-200' :
                    result.riskTier === 'Elevated' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                    result.riskTier === 'High' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                    'bg-red-50 text-[#ff3b4a] border-red-200'
                  }`}>
                    {result.riskTier} Risk
                  </span>
                )}
              </div>

              {/* Major Focal Point: Primary Sizing Number */}
              {tradingMode === 'SPOT' && (
                spotVenue === 'DEX' ? (
                  <>
                    <div className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                      {formatNumber(result.quantity, 2, 6)} {calcState.dexToken || calcState.pair}
                    </div>
                    <div className="text-xs sm:text-sm text-[#1565ff] font-mono font-bold mt-0.5">
                      Swap Allocation: {formatCurrency(result.positionSize)} • Est. Gas: ${formatNumber(calcState.dexGasFee || 0)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                      {formatNumber(result.quantity, 4, 6)} {getBaseAsset(calcState.pair)}
                    </div>
                    <div className="text-xs sm:text-sm text-[#1565ff] font-mono font-bold mt-0.5">
                      Total Value: {formatCurrency(result.positionSize)}
                    </div>
                  </>
                )
              )}

              {tradingMode === 'PERPETUAL' && (
                <>
                  <div className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                    {formatCurrency(result.positionSize)}
                  </div>
                  <div className="text-xs sm:text-sm text-[#1565ff] font-mono font-bold mt-0.5">
                    ≈ {formatNumber(result.quantity, 2, 6)} {getBaseAsset(calcState.pair)}
                  </div>
                </>
              )}

              {tradingMode === 'FOREX' && (
                <>
                  <div className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                    {result.forex?.lotSize || 0} <span className="text-lg sm:text-2xl font-bold text-slate-600">Lots</span>
                  </div>
                  <div className="text-xs sm:text-sm text-[#1565ff] font-mono font-bold mt-0.5">
                    {result.forex?.miniLots || 0} Mini • {result.forex?.microLots || 0} Micro Lots ({(result.forex?.units || 0).toLocaleString()} Units)
                  </div>
                </>
              )}
            </div>

            {/* Core Secondary Metrics (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold block truncate">
                  {tradingMode === 'SPOT' ? 'Capital Required' : 'Required Margin'}
                </span>
                <div className="text-sm sm:text-lg font-black text-[#1565ff] font-mono mt-0.5 truncate">
                  {formatCurrency(result.marginRequired || result.positionSize)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium truncate block">
                  {tradingMode === 'SPOT' ? (spotVenue === 'DEX' ? `100% On-Chain (${calcState.dexChain || 'Ethereum'})` : '100% Cash Settled') : tradingMode === 'FOREX' ? `At ${calcState.forexLeverage || 100}:1 leverage` : `At ${calcState.leverage}x leverage`}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] text-[#ff3b4a] uppercase font-bold block truncate">
                  Risk Amount
                </span>
                <div className="text-sm sm:text-lg font-black text-[#ff3b4a] font-mono mt-0.5 truncate">
                  {formatCurrency(result.riskAmount)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{calcState.riskPercentage}% of account</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] text-[#22a65e] uppercase font-bold block truncate">
                  Risk : Reward
                </span>
                <div className="text-sm sm:text-lg font-black text-[#22a65e] font-mono mt-0.5 truncate">
                  1 : {result.riskRewardRatio.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Asymmetric ratio</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold block truncate">
                  {tradingMode === 'FOREX' ? 'Spread & Slippage' : (tradingMode === 'SPOT' && spotVenue === 'DEX') ? 'Gas & Protocol Fee' : 'Fees & Slippage'}
                </span>
                <div className="text-sm sm:text-lg font-black text-slate-900 font-mono mt-0.5 truncate">
                  {formatCurrency((result.forex?.spreadCost || 0) + result.feeImpact + result.estimatedSlippageCost)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium truncate block">
                  {tradingMode === 'FOREX' ? `~${result.forex?.spreadPips || 1} pip spread` : (tradingMode === 'SPOT' && spotVenue === 'DEX') ? `Gas ($${formatNumber(calcState.dexGasFee || 0)}) + ${(calcState.dexTradingFeePct ?? 0.3)}% fee` : 'Round-trip estimate'}
                </span>
              </div>
            </div>

            {/* MANUAL POSITION SIZE ADJUSTMENT (Requirement 19) */}
            <div className="pt-2 border-t border-slate-100">
              <button
                id="calc-toggle-manual-size-btn"
                type="button"
                onClick={() => setShowManualSizeAdjuster(!showManualSizeAdjuster)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-[#1565ff] py-1 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#1565ff]" />
                  Position Size Adjustment (Manual vs Recommended)
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {showManualSizeAdjuster ? 'Hide Adjustment' : 'Adjust Size'}
                </span>
              </button>

              {showManualSizeAdjuster && (
                <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">
                      Sizing Multiplier: {manualMultiplier}% of Plan Recommended
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Rec: {formatCurrency(result.positionSize)}
                    </span>
                  </div>

                  {/* Slider */}
                  <div className="flex items-center gap-2">
                    <input
                      id="calc-manual-size-slider"
                      type="range"
                      min="25"
                      max="250"
                      step="5"
                      value={manualMultiplier}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setManualMultiplier(val);
                        setManualCustomValue('');
                      }}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1565ff]"
                    />
                    <span className="text-xs font-mono font-bold text-slate-800 w-12 text-right">
                      {manualMultiplier}%
                    </span>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                    {[50, 75, 100, 125, 150, 200].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setManualMultiplier(pct);
                          setManualCustomValue('');
                        }}
                        className={`h-6 px-2 rounded-md text-[10px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center justify-center active:scale-95 ${
                          manualMultiplier === pct && manualCustomValue === ''
                            ? 'bg-[#1565ff] text-white font-bold'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  {/* Comparison cards */}
                  {(() => {
                    const currentEffectiveCustomSize = manualCustomValue !== '' 
                      ? (parseFloat(manualCustomValue) || 0)
                      : (result.positionSize * (manualMultiplier / 100));

                    const manualRecalc = currentEffectiveCustomSize > 0
                      ? recalculateWithCustomPositionSize({
                          accountBalance: calcState.accountBalance,
                          entryPrice: calcState.entryPrice,
                          stopLoss: calcState.stopLoss,
                          takeProfit: calcState.takeProfit,
                          customPositionValue: currentEffectiveCustomSize,
                          direction: tradingMode === 'SPOT'
                            ? (calcState.spotDirection || (calcState.direction === 'LONG' ? 'BUY' : 'SELL'))
                            : calcState.direction,
                          maxAllowedRiskPct: plan?.maxRiskPerTrade || 2.0,
                        })
                      : null;

                    if (!manualRecalc) return null;

                    return (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Recommended</span>
                            <div className="font-mono font-bold text-slate-900 mt-0.5">{formatCurrency(result.positionSize)}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Risk: {formatCurrency(result.riskAmount)} ({calcState.riskPercentage.toFixed(1)}%)</div>
                          </div>

                          <div className={`bg-white p-2.5 rounded-lg border ${manualRecalc.exceedsPlanRisk ? 'border-rose-300 bg-rose-50/20' : 'border-blue-200'}`}>
                            <span className="text-[10px] uppercase font-bold text-slate-700 block">Custom Manual</span>
                            <div className="font-mono font-bold text-[#1565ff] mt-0.5">{formatCurrency(currentEffectiveCustomSize)}</div>
                            <div className={`text-[10px] font-bold mt-0.5 ${manualRecalc.exceedsPlanRisk ? 'text-rose-600' : 'text-slate-600'}`}>
                              Actual Risk: {formatCurrency(manualRecalc.actualRiskAmount)} ({manualRecalc.actualRiskPct.toFixed(2)}%)
                            </div>
                          </div>
                        </div>

                        {manualRecalc.exceedsPlanRisk && (
                          <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-1.5 text-xs text-rose-700">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                            <div className="text-[11px] leading-tight">
                              <strong>Plan Limit Exceeded:</strong> Custom position size creates ${formatNumber(manualRecalc.actualRiskAmount)} risk ({manualRecalc.actualRiskPct.toFixed(2)}%), exceeding your plan maximum of {plan?.maxRiskPerTrade ?? 2.0}%.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ACTION BUTTONS: COPY PLAN & SIMULATE + SAVE TRADE */}
          <div id="calculator-action-buttons" className="space-y-2">
            <div className={`grid ${tradingMode === 'PERPETUAL' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 sm:gap-3`}>
              <button
                id="calc-copy-plan-btn"
                type="button"
                onClick={handleCopySummary}
                className="h-11 px-3 sm:px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#22a65e] shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{copied ? 'Copied Parameters!' : `Copy ${tradingMode} Plan`}</span>
              </button>

              {tradingMode === 'PERPETUAL' && (
                <button
                  id="calc-simulate-btn"
                  type="button"
                  onClick={handleToggleSimulator}
                  className={`h-11 px-3 sm:px-3.5 font-bold text-xs sm:text-sm rounded-xl border transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${
                    showLeverageSimulator 
                      ? 'bg-blue-50 border-blue-300 text-[#1565ff]' 
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-[#1565ff] shrink-0" />
                  <span className="truncate">{showLeverageSimulator ? 'Hide Simulator' : 'Simulate Leverage'}</span>
                </button>
              )}
            </div>

            <button
              id="calc-save-trade-btn"
              type="button"
              onClick={handleSaveTradeWithGate}
              disabled={killSwitchActive || result.positionSize <= 0}
              className={`w-full h-11 sm:h-12 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 ${
                isSaveApproved
                  ? 'bg-[#1565ff] hover:bg-[#0051e6] text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {isSaveApproved ? <Save className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
              <span className="truncate">
                {isSaveApproved 
                  ? `Save ${tradingMode} Trade to Journal` 
                  : 'Save Trade (Gate Blocked)'}
              </span>
            </button>

            {onOpenPosition && (
              <button
                id="calc-track-portfolio-btn"
                type="button"
                onClick={handleTrackInPortfolio}
                disabled={killSwitchActive || result.positionSize <= 0}
                className="w-full h-11 sm:h-12 font-bold text-xs sm:text-sm rounded-xl bg-[#22a65e] hover:bg-[#1b854b] text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span className="truncate">Open & Track in Portfolio Risk</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-black/20 text-white shrink-0 tracking-wider">
                  {tradingMode === 'SPOT' ? `Spot · ${spotVenue}` : tradingMode === 'FOREX' ? 'Forex' : `${calcState.leverage}x Perp`}
                </span>
              </button>
            )}

            <button
              id="calc-arm-price-alerts-btn"
              type="button"
              onClick={() => handleOpenAlertModal(alertModalDefaultTarget)}
              className="w-full h-10 font-bold text-xs rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-2xs"
            >
              <Bell className="w-3.5 h-3.5 text-[#1565ff] shrink-0" />
              <span>Set Entry / Exit Price Alerts</span>
              {activeAlertsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#1565ff] text-white text-[9px] font-black">
                  {activeAlertsCount}
                </span>
              )}
            </button>

            {positionTrackedSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
                <span className="font-semibold">
                  ✓ {tradingMode === 'SPOT' ? `Spot (${spotVenue})` : tradingMode === 'FOREX' ? 'Forex' : 'Perpetual'} position for {calcState.pair} added to active portfolio risk monitor!
                </span>
                {onNavigateToPortfolio && (
                  <button
                    type="button"
                    onClick={onNavigateToPortfolio}
                    className="font-bold underline text-emerald-900 cursor-pointer ml-2 shrink-0"
                  >
                    View Portfolio →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 4. COMPACT TRADE STATUS CARD */}
          <TradeStatusCard
            validation={riskGateValidation}
            result={result}
            onFixField={handleFixField}
            onSaveToJournal={handleSaveTradeWithGate}
            killSwitchActive={killSwitchActive}
            defaultExpanded={false}
          />

          {/* 5. COMPACT PRE-TRADE CHECKLIST */}
          <PreTradeChecklistCard
            checklist={riskGateValidation.checklist}
            onFixField={handleFixField}
            defaultExpanded={false}
          />

          {/* 6. COMPACT RISK BUDGET CARD */}
          <RiskBudgetCard
            metrics={riskGateValidation.metrics}
            result={result}
            plan={plan}
            defaultExpanded={false}
          />

          {/* 7. PROFIT / LOSS BREAKDOWN */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {tradingMode === 'SPOT' ? `Spot ${spotVenue}` : tradingMode} Trade Breakdown
            </h4>

            <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-[#22a65e] block">
                  Net Profit (If TP Hit)
                </span>
                <div className="text-base sm:text-lg font-black text-[#22a65e] mt-0.5 font-mono truncate">
                  +{formatCurrency(result.netProfit)}
                </div>
                <span className="text-[10px] text-slate-500">
                  {tradingMode === 'FOREX' ? `+${result.forex?.takeProfitPips || 0} pips target` : 'After all estimated fees'}
                </span>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-[#ff3b4a] block">
                  Net Loss (If SL Hit)
                </span>
                <div className="text-base sm:text-lg font-black text-[#ff3b4a] mt-0.5 font-mono truncate">
                  -{formatCurrency(result.netLoss)}
                </div>
                <span className="text-[10px] text-slate-500">
                  {tradingMode === 'FOREX' ? `-${result.forex?.stopLossPips || 0} pips risk` : 'Total defined downside'}
                </span>
              </div>

              {/* Mode-specific third card */}
              {tradingMode === 'SPOT' && (
                spotVenue === 'DEX' ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                      Break-Even Price
                    </span>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 font-mono truncate">
                      ${formatNumber(result.breakevenPrice, 4, 8)}
                    </div>
                    <span className="text-[10px] text-slate-500">Includes Gas, Slippage & Swap fee</span>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                      Break-Even Price
                    </span>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 font-mono truncate">
                      ${formatNumber(result.breakevenPrice)}
                    </div>
                    <span className="text-[10px] text-slate-500">Covering buy & sell fees</span>
                  </div>
                )
              )}

              {tradingMode === 'PERPETUAL' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                    Estimated Liquidation
                  </span>
                  <div className="text-sm sm:text-base font-bold text-amber-600 mt-0.5 font-mono truncate">
                    ${formatNumber(result.liquidationPrice)}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {result.distanceToLiquidationPct.toFixed(2)}% from entry
                  </span>
                </div>
              )}

              {tradingMode === 'FOREX' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                    Stop-Loss in Pips
                  </span>
                  <div className="text-sm sm:text-base font-bold text-rose-600 mt-0.5 font-mono truncate">
                    {result.forex?.stopLossPips || 0} Pips
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Pip value: ${(result.forex?.pipValue || result.forex?.pipValuePerLot || 10).toFixed(2)}/lot
                  </span>
                </div>
              )}

              {/* Mode-specific fourth card */}
              {tradingMode === 'FOREX' ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                    Take-Profit in Pips
                  </span>
                  <div className="text-sm sm:text-base font-bold text-emerald-600 mt-0.5 font-mono truncate">
                    {result.forex?.takeProfitPips || 0} Pips
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Break-even rate: {formatNumber(result.breakevenPrice, 4, 5)}
                  </span>
                </div>
              ) : (tradingMode === 'SPOT' && spotVenue === 'DEX') ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                    Gas & Friction Cost
                  </span>
                  <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 font-mono truncate">
                    {formatCurrency(result.feeImpact)}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Gas (${formatNumber(calcState.dexGasFee || 0)}) + {(calcState.dexPriceImpactPct || 0).toFixed(2)}% Impact
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-600 block">
                    Stop-Loss Distance
                  </span>
                  <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 font-mono truncate">
                    ${formatNumber(result.stopLossDistance)}
                  </div>
                  <span className="text-[10px] text-[#ff3b4a] font-bold">
                    ({result.priceRiskPercentage.toFixed(2)}% price move)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* LEVERAGE SIMULATOR SECTION (PERPETUAL ONLY) */}
          {tradingMode === 'PERPETUAL' && showLeverageSimulator && (
            <div ref={simulatorRef} className="pt-1 animate-in fade-in duration-200">
              <LeverageSimulator
                accountBalance={calcState.accountBalance}
                riskAmount={result.riskAmount}
                entryPrice={calcState.entryPrice}
                stopLossPrice={calcState.stopLoss}
                direction={calcState.direction}
                currentLeverage={calcState.leverage}
              />
            </div>
          )}
        </div>
      </div>

      {/* PRICE ALERTS & BROWSER NOTIFICATIONS MODAL */}
      <PriceAlertModal
        isOpen={isPriceAlertModalOpen}
        onClose={() => setIsPriceAlertModalOpen(false)}
        currentPair={calcState.pair}
        tradingMode={tradingMode}
        spotVenue={tradingMode === 'SPOT' ? spotVenue : undefined}
        entryPrice={calcState.entryPrice}
        stopLossPrice={calcState.stopLoss}
        takeProfitPrice={calcState.takeProfit}
        currentLivePrice={liveMarketPrice && liveMarketPrice > 0 ? liveMarketPrice : calcState.entryPrice}
      />
    </div>
  );
};
