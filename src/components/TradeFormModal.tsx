import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Star, 
  Calendar, 
  Clock, 
  DollarSign, 
  Layers, 
  AlertCircle,
  HelpCircle,
  Tag,
  Image as ImageIcon,
  Check,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Smile,
  Frown,
  Scale
} from 'lucide-react';
import { 
  TradeJournalEntry, 
  TradeDirection, 
  Exchange, 
  Timeframe, 
  ConfidenceLevel, 
  SetupQuality, 
  EmotionBefore, 
  EmotionAfter,
  TradingPlan,
  STANDARD_MISTAKES,
  TradeApprovalRecord,
  TradingMode,
  SpotVenue,
  DexChain
} from '../types';
import { 
  DEX_CHAINS, 
  COMMON_DEX_PROTOCOLS, 
  COMMON_DEX_WALLETS 
} from '../utils/spotCalculator';
import { formatCurrency, formatNumber, COMMON_CRYPTO_PAIRS, COMMON_SETUPS, validateTradeAgainstPlan } from '../utils/calculator';
import { validateTradeEntry, TradeValidationResult, RiskWarningItem } from '../utils/risk/validation';
import confetti from 'canvas-confetti';

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<TradeJournalEntry, 'id'>, idToUpdate?: number) => Promise<void>;
  editingTrade?: TradeJournalEntry | null;
  initialDraft?: Partial<TradeJournalEntry> | null;
  plan?: TradingPlan;
}

const EXCHANGES: Exchange[] = ['Binance', 'Bybit', 'OKX', 'Kucoin', 'Bitget', 'Coinbase', 'Other'];
const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['Low', 'Medium', 'High'];
const SETUP_QUALITIES: SetupQuality[] = ['Poor', 'Good', 'Excellent'];
const EMOTIONS_BEFORE: EmotionBefore[] = ['Calm', 'Confident', 'Anxious', 'Excited', 'Fearful', 'Greedy'];
const EMOTIONS_AFTER: EmotionAfter[] = ['Calm', 'Confident', 'Relieved', 'Frustrated', 'Regretful', 'Satisfied'];

export const TradeFormModal: React.FC<TradeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTrade,
  initialDraft,
  plan,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'review' | 'screenshots' | 'fees'>('details');

  // Core Form Fields
  const [tradeMode, setTradeMode] = useState<TradingMode>('PERPETUAL');
  const [spotVenue, setSpotVenue] = useState<SpotVenue>('CEX');
  const [lotSize, setLotSize] = useState<string | number>('');
  const [pipsRisk, setPipsRisk] = useState<string | number>('');
  const [pipsGain, setPipsGain] = useState<string | number>('');
  const [pair, setPair] = useState('BTCUSDT');
  // DEX specific state
  const [dexChain, setDexChain] = useState<DexChain>('Ethereum');
  const [dexProtocol, setDexProtocol] = useState<string>('Uniswap');
  const [dexToken, setDexToken] = useState<string>('');
  const [dexWallet, setDexWallet] = useState<string>('MetaMask');
  const [dexGasFee, setDexGasFee] = useState<string | number>(8.5);
  const [dexTradingFeePct, setDexTradingFeePct] = useState<number>(0.3);
  const [dexPriceImpactPct, setDexPriceImpactPct] = useState<string | number>(0.15);
  const [dexSlippagePct, setDexSlippagePct] = useState<string | number>(0.5);
  const [exchange, setExchange] = useState<Exchange>('Binance');
  const [entryPrice, setEntryPrice] = useState<string | number>('');
  const [exitPrice, setExitPrice] = useState<string | number>('');
  const [positionSize, setPositionSize] = useState<string | number>('');
  const [direction, setDirection] = useState<TradeDirection>('LONG');
  const [strategy, setStrategy] = useState('Trend Following');
  const [setup, setSetup] = useState('Breakout');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [leverage, setLeverage] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<string | number>('');
  const [takeProfit, setTakeProfit] = useState<string | number>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [favorite, setFavorite] = useState(false);
  const [manualPnl, setManualPnl] = useState<number | null>(null);

  // Psychology & Classification
  const [confidence, setConfidence] = useState<ConfidenceLevel>('High');
  const [setupQuality, setSetupQuality] = useState<SetupQuality>('Good');
  const [emotionBefore, setEmotionBefore] = useState<EmotionBefore>('Calm');
  const [emotionAfter, setEmotionAfter] = useState<EmotionAfter>('Satisfied');
  const [tradeRating, setTradeRating] = useState<number>(4);
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');

  // Screenshots
  const [beforeScreenshot, setBeforeScreenshot] = useState<string>('');
  const [entryScreenshot, setEntryScreenshot] = useState<string>('');
  const [afterScreenshot, setAfterScreenshot] = useState<string>('');
  const [chartScreenshot, setChartScreenshot] = useState<string>('');

  // Post-Trade Review Checklist
  const [whyEntered, setWhyEntered] = useState('');
  const [setupSeen, setSetupSeen] = useState('');
  const [followedPlan, setFollowedPlan] = useState(true);
  const [followedStopLoss, setFollowedStopLoss] = useState(true);
  const [movedStopLoss, setMovedStopLoss] = useState(false);
  const [movedTakeProfit, setMovedTakeProfit] = useState(false);
  const [exitedEarly, setExitedEarly] = useState(false);
  const [wasEmotional, setWasEmotional] = useState(false);
  const [overLeveraged, setOverLeveraged] = useState(false);
  const [disciplineRating, setDisciplineRating] = useState(5);
  const [confidenceRating, setConfidenceRating] = useState(4);
  const [executionRating, setExecutionRating] = useState(4);
  const [entryReason, setEntryReason] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [mistakesMade, setMistakesMade] = useState('');
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([]);
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [approvalRecord, setApprovalRecord] = useState<TradeApprovalRecord | undefined>(undefined);

  // Fees & Funding
  const [tradingFee, setTradingFee] = useState<number>(0.055);
  const [makerFee, setMakerFee] = useState<number>(0);
  const [takerFee, setTakerFee] = useState<number>(0);
  const [fundingCost, setFundingCost] = useState<number>(0);
  const [slippageCost, setSlippageCost] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Sync state when editing or drafting
  useEffect(() => {
    if (editingTrade) {
      const resolvedMode: TradingMode = (editingTrade.tradeMode as any) === 'DEX' ? 'SPOT' : (editingTrade.tradeMode || 'PERPETUAL');
      const resolvedVenue: SpotVenue = (editingTrade.tradeMode as any) === 'DEX' ? 'DEX' : (editingTrade.spotVenue || 'CEX');
      setTradeMode(resolvedMode);
      setSpotVenue(resolvedVenue);
      setLotSize(editingTrade.lotSize || '');
      setPipsRisk(editingTrade.pipsRisk || '');
      setPipsGain(editingTrade.pipsGain || '');
      setPair(editingTrade.pair);
      if (editingTrade.dexChain) setDexChain(editingTrade.dexChain);
      if (editingTrade.dexProtocol) setDexProtocol(editingTrade.dexProtocol);
      if (editingTrade.dexToken) setDexToken(editingTrade.dexToken);
      if (editingTrade.dexWallet) setDexWallet(editingTrade.dexWallet);
      if (editingTrade.dexGasFee !== undefined) setDexGasFee(editingTrade.dexGasFee);
      if (editingTrade.dexTradingFeePct !== undefined) setDexTradingFeePct(editingTrade.dexTradingFeePct);
      if (editingTrade.dexPriceImpactPct !== undefined) setDexPriceImpactPct(editingTrade.dexPriceImpactPct);
      if (editingTrade.dexSlippagePct !== undefined) setDexSlippagePct(editingTrade.dexSlippagePct);
      setExchange(editingTrade.exchange);
      setEntryPrice(editingTrade.entryPrice);
      setExitPrice(editingTrade.exitPrice);
      setPositionSize(editingTrade.positionSize);
      setDirection(editingTrade.direction);
      setStrategy(editingTrade.strategy);
      setSetup(editingTrade.setup || editingTrade.strategy || 'Breakout');
      setTimeframe(editingTrade.timeframe);
      setLeverage(editingTrade.leverage);
      setTradingFee(editingTrade.tradingFee);
      setMakerFee(editingTrade.makerFee || 0);
      setTakerFee(editingTrade.takerFee || 0);
      setFundingCost(editingTrade.fundingCost || 0);
      setSlippageCost(editingTrade.slippageCost || 0);
      setConfidence(editingTrade.confidence);
      setSetupQuality(editingTrade.setupQuality);
      setEmotionBefore(editingTrade.emotionBefore);
      setEmotionAfter(editingTrade.emotionAfter);
      setTradeRating(editingTrade.tradeRating);
      setTagsInput(editingTrade.tags ? editingTrade.tags.join(', ') : '');
      setEntryReason(editingTrade.entryReason || '');
      setExitReason(editingTrade.exitReason || '');
      setMistakesMade(editingTrade.mistakesMade || '');
      setSelectedMistakes(editingTrade.mistakes || (editingTrade.mistakesMade ? editingTrade.mistakesMade.split(',').map(s => s.trim()).filter(Boolean) : []));
      setLessonsLearned(editingTrade.lessonsLearned || '');
      setNotes(editingTrade.notes || '');
      setStopLoss(editingTrade.stopLoss || '');
      setTakeProfit(editingTrade.takeProfit || '');
      setDate(editingTrade.date);
      setTime(editingTrade.time || '12:00');
      setFavorite(editingTrade.favorite || false);
      setManualPnl(editingTrade.pnl);
      setApprovalRecord(editingTrade.approvalRecord);
      setBeforeScreenshot(editingTrade.beforeScreenshot || '');
      setEntryScreenshot(editingTrade.entryScreenshot || '');
      setAfterScreenshot(editingTrade.afterScreenshot || '');
      setChartScreenshot(editingTrade.chartScreenshot || '');

      if (editingTrade.review) {
        setWhyEntered(editingTrade.review.whyEntered || '');
        setSetupSeen(editingTrade.review.setupSeen || '');
        setFollowedPlan(editingTrade.review.followedPlan ?? true);
        setFollowedStopLoss(editingTrade.review.followedStopLoss ?? true);
        setMovedStopLoss(editingTrade.review.movedStopLoss ?? false);
        setMovedTakeProfit(editingTrade.review.movedTakeProfit ?? false);
        setExitedEarly(editingTrade.review.exitedEarly ?? false);
        setWasEmotional(editingTrade.review.wasEmotional ?? false);
        setOverLeveraged(editingTrade.review.overLeveraged ?? false);
        setDisciplineRating(editingTrade.review.disciplineRating || 5);
        setConfidenceRating(editingTrade.review.confidenceRating || 4);
        setExecutionRating(editingTrade.review.executionRating || 4);
      }
    } else if (initialDraft) {
      const resolvedMode: TradingMode = (initialDraft.tradeMode as any) === 'DEX' ? 'SPOT' : (initialDraft.tradeMode || 'PERPETUAL');
      const resolvedVenue: SpotVenue = (initialDraft.tradeMode as any) === 'DEX' ? 'DEX' : (initialDraft.spotVenue || 'CEX');
      setTradeMode(resolvedMode);
      setSpotVenue(resolvedVenue);
      if (initialDraft.lotSize) setLotSize(initialDraft.lotSize);
      if (initialDraft.pipsRisk) setPipsRisk(initialDraft.pipsRisk);
      if (initialDraft.pipsGain) setPipsGain(initialDraft.pipsGain);
      if (initialDraft.pair) setPair(initialDraft.pair);
      if (initialDraft.dexChain) setDexChain(initialDraft.dexChain);
      if (initialDraft.dexProtocol) setDexProtocol(initialDraft.dexProtocol);
      if (initialDraft.dexToken) setDexToken(initialDraft.dexToken);
      if (initialDraft.dexWallet) setDexWallet(initialDraft.dexWallet);
      if (initialDraft.dexGasFee !== undefined) setDexGasFee(initialDraft.dexGasFee);
      if (initialDraft.dexTradingFeePct !== undefined) setDexTradingFeePct(initialDraft.dexTradingFeePct);
      if (initialDraft.dexPriceImpactPct !== undefined) setDexPriceImpactPct(initialDraft.dexPriceImpactPct);
      if (initialDraft.dexSlippagePct !== undefined) setDexSlippagePct(initialDraft.dexSlippagePct);
      if (initialDraft.entryPrice) setEntryPrice(initialDraft.entryPrice);
      if (initialDraft.exitPrice) setExitPrice(initialDraft.exitPrice);
      if (initialDraft.positionSize) setPositionSize(initialDraft.positionSize);
      if (initialDraft.direction) setDirection(initialDraft.direction);
      if (initialDraft.leverage) setLeverage(initialDraft.leverage);
      if (initialDraft.stopLoss) setStopLoss(initialDraft.stopLoss);
      if (initialDraft.takeProfit) setTakeProfit(initialDraft.takeProfit);
      if (initialDraft.tradingFee) setTradingFee(initialDraft.tradingFee);
      if (initialDraft.date) setDate(initialDraft.date);
      if (initialDraft.time) setTime(initialDraft.time);
      if (initialDraft.strategy) setStrategy(initialDraft.strategy);
      if (initialDraft.setup) setSetup(initialDraft.setup);
      if (initialDraft.notes) setNotes(initialDraft.notes);
      if (initialDraft.approvalRecord) setApprovalRecord(initialDraft.approvalRecord);
      if (initialDraft.mistakes) setSelectedMistakes(initialDraft.mistakes);
      setManualPnl(null);
    }
  }, [editingTrade, initialDraft, isOpen]);

  // Real-time calculation
  const numEntry = typeof entryPrice === 'number' ? entryPrice : parseFloat(entryPrice) || 0;
  const numExit = typeof exitPrice === 'number' ? exitPrice : parseFloat(exitPrice) || 0;
  const numSize = typeof positionSize === 'number' ? positionSize : parseFloat(positionSize) || 0;
  const numSL = typeof stopLoss === 'number' ? stopLoss : parseFloat(stopLoss as string) || 0;
  const numTP = typeof takeProfit === 'number' ? takeProfit : parseFloat(takeProfit as string) || 0;

  const quantity = numEntry > 0 ? numSize / numEntry : 0;
  let grossPnl = 0;
  if (numEntry > 0 && numExit > 0 && numSize > 0) {
    if (direction === 'LONG') {
      grossPnl = quantity * (numExit - numEntry);
    } else {
      grossPnl = quantity * (numEntry - numExit);
    }
  }

  const numDexGas = typeof dexGasFee === 'number' ? dexGasFee : parseFloat(dexGasFee as string) || 0;
  const isDex = (tradeMode as string) === 'DEX' || (tradeMode === 'SPOT' && spotVenue === 'DEX');
  const estimatedFees = isDex
    ? (numDexGas + (numSize * ((dexTradingFeePct || 0.3) / 100) * 2))
    : ((numSize * (tradingFee / 100) * 2) + makerFee + takerFee);
  const netPnl = manualPnl !== null ? manualPnl : (grossPnl - estimatedFees - (fundingCost || 0) - (slippageCost || 0));
  const pnlPercentage = numSize > 0 ? (netPnl / numSize) * 100 * leverage : 0;
  const isWin = netPnl > 0.001;
  const isBreakeven = Math.abs(netPnl) <= 0.001;

  // R Multiple calculation
  let rMultiple = 0;
  if (numSL > 0 && numEntry > 0) {
    const riskDistance = Math.abs(numEntry - numSL);
    const calculatedRiskAmount = quantity * riskDistance;
    if (calculatedRiskAmount > 0) {
      rMultiple = netPnl / calculatedRiskAmount;
    }
  }

  // Plan Check
  const planCheck = plan ? validateTradeAgainstPlan({
    pair,
    direction,
    leverage,
    setup,
    hasStopLoss: numSL > 0,
    hasTakeProfit: numTP > 0,
  }, plan) : { isCompliant: true, violations: [], warnings: [] };

  // Integrated Pre-Trade Risk & Integrity Validation Engine
  const tradeValidation = React.useMemo(() => {
    return validateTradeEntry({
      tradeMode,
      spotVenue,
      pair,
      entryPrice: numEntry,
      exitPrice: numExit,
      positionSize: numSize,
      direction,
      stopLoss: numSL,
      takeProfit: numTP,
      leverage,
      dexChain,
      dexProtocol,
      dexGasFee: typeof dexGasFee === 'number' ? dexGasFee : parseFloat(dexGasFee as string) || 0,
      dexTradingFeePct,
      dexPriceImpactPct: typeof dexPriceImpactPct === 'number' ? dexPriceImpactPct : parseFloat(dexPriceImpactPct as string) || 0,
      dexSlippagePct: typeof dexSlippagePct === 'number' ? dexSlippagePct : parseFloat(dexSlippagePct as string) || 0,
      lotSize: typeof lotSize === 'number' ? lotSize : parseFloat(lotSize as string) || undefined,
      pipsRisk: typeof pipsRisk === 'number' ? pipsRisk : parseFloat(pipsRisk as string) || undefined,
      pipsGain: typeof pipsGain === 'number' ? pipsGain : parseFloat(pipsGain as string) || undefined,
      plan,
    });
  }, [
    tradeMode,
    spotVenue,
    pair,
    numEntry,
    numExit,
    numSize,
    direction,
    numSL,
    numTP,
    leverage,
    dexChain,
    dexProtocol,
    dexGasFee,
    dexTradingFeePct,
    dexPriceImpactPct,
    dexSlippagePct,
    lotSize,
    pipsRisk,
    pipsGain,
    plan,
  ]);

  // Image Upload helper (base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'before' | 'entry' | 'after' | 'chart') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const resultStr = uploadEvent.target?.result as string;
      if (target === 'before') setBeforeScreenshot(resultStr);
      if (target === 'entry') setEntryScreenshot(resultStr);
      if (target === 'after') setAfterScreenshot(resultStr);
      if (target === 'chart') setChartScreenshot(resultStr);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (!tradeValidation.isValid) {
      setActiveTab('details');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const isDexSpot = tradeMode === 'SPOT' && spotVenue === 'DEX';
      const entryPayload: Omit<TradeJournalEntry, 'id'> = {
        createdAt: editingTrade?.createdAt || new Date().toISOString(),
        tradeMode,
        spotVenue: tradeMode === 'SPOT' ? spotVenue : undefined,
        date,
        time,
        pair: tradeMode === 'FOREX' ? pair.toUpperCase().trim() : pair.toUpperCase().replace(/\s+/g, ''),
        exchange,
        entryPrice: numEntry,
        exitPrice: numExit,
        positionSize: numSize,
        quantity,
        margin: tradeMode === 'SPOT' ? numSize : numSize / (leverage || 1),
        direction,
        strategy,
        setup,
        timeframe,
        leverage: tradeMode === 'SPOT' ? 1 : leverage,
        dexChain: isDexSpot ? dexChain : undefined,
        dexProtocol: isDexSpot ? dexProtocol : undefined,
        dexToken: isDexSpot ? (dexToken || pair) : undefined,
        dexWallet: isDexSpot ? dexWallet : undefined,
        dexGasFee: isDexSpot ? (typeof dexGasFee === 'number' ? dexGasFee : parseFloat(dexGasFee as string) || 0) : undefined,
        dexTradingFeePct: isDexSpot ? dexTradingFeePct : undefined,
        dexPriceImpactPct: isDexSpot ? (typeof dexPriceImpactPct === 'number' ? dexPriceImpactPct : parseFloat(dexPriceImpactPct as string) || 0) : undefined,
        dexSlippagePct: isDexSpot ? (typeof dexSlippagePct === 'number' ? dexSlippagePct : parseFloat(dexSlippagePct as string) || 0) : undefined,
        lotSize: typeof lotSize === 'number' ? lotSize : parseFloat(lotSize as string) || undefined,
        pipsRisk: typeof pipsRisk === 'number' ? pipsRisk : parseFloat(pipsRisk as string) || undefined,
        pipsGain: typeof pipsGain === 'number' ? pipsGain : parseFloat(pipsGain as string) || undefined,
        tradingFee,
        makerFee,
        takerFee,
        fundingCost,
        slippageCost,
        grossPnl,
        pnl: netPnl,
        pnlPercentage,
        rMultiple,
        confidence,
        setupQuality,
        emotionBefore,
        emotionAfter,
        tradeRating,
        tags: parsedTags,
        entryReason,
        exitReason,
        mistakesMade: selectedMistakes.length > 0 ? selectedMistakes.join(', ') + (mistakesMade ? ` - ${mistakesMade}` : '') : mistakesMade,
        mistakes: selectedMistakes,
        lessonsLearned,
        notes,
        isWin,
        isBreakeven,
        favorite,
        stopLoss: numSL > 0 ? numSL : undefined,
        takeProfit: numTP > 0 ? numTP : undefined,
        riskAmount: numSL > 0 ? quantity * Math.abs(numEntry - numSL) : undefined,
        planCompliance: planCheck.isCompliant,
        planViolations: planCheck.violations,
        approvalRecord,
        beforeScreenshot: beforeScreenshot || undefined,
        entryScreenshot: entryScreenshot || undefined,
        afterScreenshot: afterScreenshot || undefined,
        chartScreenshot: chartScreenshot || undefined,
        review: {
          whyEntered,
          setupSeen,
          followedPlan,
          followedStopLoss,
          movedStopLoss,
          movedTakeProfit,
          exitedEarly,
          wasEmotional,
          overLeveraged,
          disciplineRating,
          confidenceRating,
          executionRating,
        },
      };

      if (isWin && !editingTrade) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      }

      await onSave(entryPayload, editingTrade?.id);
      onClose();
    } catch (err) {
      console.error('Error saving trade:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl text-white ${direction === 'LONG' ? 'bg-[#22a65e]' : 'bg-[#ff3b4a]'}`}>
              {direction === 'LONG' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                {editingTrade ? `Edit Trade #${editingTrade.id}` : 'Log Crypto Perpetual Trade'}
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {pair} • {direction} • {leverage}x Leverage
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL NAVIGATION TABS */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 bg-slate-50/50 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'details'
                ? 'border-[#1565ff] text-[#1565ff]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" /> Core Parameters
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'review'
                ? 'border-[#1565ff] text-[#1565ff]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Star className="w-3.5 h-3.5" /> Post-Trade Review & Psychology
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('screenshots')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'screenshots'
                ? 'border-[#1565ff] text-[#1565ff]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Screenshots (Before / After)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fees')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'fees'
                ? 'border-[#1565ff] text-[#1565ff]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5" /> Fees & Funding
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Validation Errors Banner */}
          {hasAttemptedSubmit && !tradeValidation.isValid && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Trade Entry Requirements Not Met ({tradeValidation.errors.length}):</span>
              </div>
              <ul className="list-disc list-inside text-xs text-rose-700 space-y-0.5 pl-1 font-medium">
                {tradeValidation.errors.map((err, idx) => (
                  <li key={idx}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Risk Warnings Banner */}
          {tradeValidation.warnings.length > 0 && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px] uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Execution Risk Advisory ({tradeValidation.warnings.length})</span>
              </div>
              <div className="space-y-1">
                {tradeValidation.warnings.map((w) => (
                  <div key={w.id} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                    <span>
                      {w.message} {w.suggestedAction && <span className="text-amber-950 font-semibold">— {w.suggestedAction}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: CORE PARAMETERS */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Market Mode Switcher - 3 Primary Modes */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(['SPOT', 'PERPETUAL', 'FOREX'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setTradeMode(m);
                      if (m === 'SPOT') setLeverage(1);
                      if (m === 'FOREX' && leverage < 10) setLeverage(100);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      tradeMode === m
                        ? 'bg-[#1565ff] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Spot Venue Switcher (When Spot is selected) */}
              {tradeMode === 'SPOT' && (
                <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Spot Venue:</span>
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      {spotVenue === 'CEX' ? 'Centralized Order Book' : 'On-Chain AMM'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSpotVenue('CEX')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        spotVenue === 'CEX'
                          ? 'bg-[#1565ff] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      CEX
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpotVenue('DEX')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        spotVenue === 'DEX'
                          ? 'bg-[#1565ff] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      DEX
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      {tradeMode === 'SPOT' ? (spotVenue === 'DEX' ? 'Token / Pair' : 'Spot Asset') : tradeMode === 'FOREX' ? 'Forex Pair' : 'Perpetual Pair'}
                    </label>
                    <span className="text-[9px] text-slate-400 font-medium">Type any</span>
                  </div>
                  <input
                    type="text"
                    list="trade-crypto-pairs-list"
                    value={pair}
                    onChange={(e) => setPair(e.target.value.toUpperCase())}
                    placeholder={tradeMode === 'FOREX' ? 'e.g. EUR/USD' : (tradeMode === 'SPOT' && spotVenue === 'DEX') ? 'e.g. PEPE' : 'e.g. BTCUSDT'}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white uppercase"
                  />
                  <datalist id="trade-crypto-pairs-list">
                    {COMMON_CRYPTO_PAIRS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Side</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as TradeDirection)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white cursor-pointer"
                  >
                    <option value="LONG">🟢 {tradeMode === 'SPOT' ? 'BUY' : 'LONG'}</option>
                    <option value="SHORT">🔴 {tradeMode === 'SPOT' ? 'SELL' : 'SHORT'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                    {tradeMode === 'SPOT' ? 'Type' : tradeMode === 'FOREX' ? 'Broker Leverage' : 'Leverage'}
                  </label>
                  {tradeMode === 'SPOT' ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 flex items-center justify-center">
                      1x Non-Leveraged
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      max={tradeMode === 'FOREX' ? 1000 : 125}
                      value={leverage}
                      onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    />
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Exchange / Broker</label>
                  <select
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value as Exchange)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white cursor-pointer"
                  >
                    {EXCHANGES.map((ex) => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DEX specific parameters if Spot DEX */}
              {tradeMode === 'SPOT' && spotVenue === 'DEX' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Network / Chain</label>
                    <select
                      value={dexChain}
                      onChange={(e) => setDexChain(e.target.value as DexChain)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    >
                      {Object.keys(DEX_CHAINS).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">DEX Protocol</label>
                    <input
                      type="text"
                      list="modal-dex-protocols"
                      value={dexProtocol}
                      onChange={(e) => setDexProtocol(e.target.value)}
                      placeholder="Uniswap"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    />
                    <datalist id="modal-dex-protocols">
                      {COMMON_DEX_PROTOCOLS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Gas Cost ($)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={dexGasFee}
                      onChange={(e) => setDexGasFee(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Price Impact (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={dexPriceImpactPct}
                      onChange={(e) => setDexPriceImpactPct(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>
                </div>
              )}

              {/* Forex specific lot size row if FOREX */}
              {tradeMode === 'FOREX' && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-amber-50/50 border border-amber-200/80 rounded-xl">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Standard Lots</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0.45"
                      value={lotSize}
                      onChange={(e) => setLotSize(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Stop Loss Pips</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 25.0"
                      value={pipsRisk}
                      onChange={(e) => setPipsRisk(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Take Profit Pips</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 50.0"
                      value={pipsGain}
                      onChange={(e) => setPipsGain(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1565ff]"
                    />
                  </div>
                </div>
              )}

              {/* Price Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Entry Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Entry"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Exit Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Exit"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#ff3b4a] uppercase block mb-1">Stop Loss ($)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Stop Loss"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="w-full bg-red-50/50 border border-red-200 rounded-xl px-3 py-2 text-xs font-mono text-[#ff3b4a] font-bold focus:outline-none focus:border-[#ff3b4a] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#22a65e] uppercase block mb-1">Take Profit ($)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Take Profit"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono text-[#22a65e] font-bold focus:outline-none focus:border-[#22a65e] focus:bg-white"
                  />
                </div>
              </div>

              {/* Sizing & PnL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                    Position Size ($ Notional USDT)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Position Size"
                    value={positionSize}
                    onChange={(e) => setPositionSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Playbook Setup</label>
                  <select
                    value={setup}
                    onChange={(e) => setSetup(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white cursor-pointer"
                  >
                    {COMMON_SETUPS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">Timeframe</label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white cursor-pointer"
                  >
                    {TIMEFRAMES.map((tf) => (
                      <option key={tf} value={tf}>{tf}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* LIVE OUTCOME PREVIEW */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Net P&L</span>
                  <div className={`text-base font-black ${isWin ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {netPnl >= 0 ? '+' : ''}{formatCurrency(netPnl)}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Return on Margin</span>
                  <div className={`text-base font-black ${isWin ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">R Multiple</span>
                  <div className="text-base font-black text-[#1565ff]">
                    {rMultiple !== 0 ? `${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R` : 'N/A'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Plan Status</span>
                  <div className={`text-xs font-bold mt-1 ${planCheck.isCompliant ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
                    {planCheck.isCompliant ? '🟢 Compliant' : '🔴 Violation'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POST-TRADE REVIEW & PSYCHOLOGY */}
          {activeTab === 'review' && (
            <div className="space-y-4">
              {/* Star Ratings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Discipline Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setDisciplineRating(star)}
                        className={`p-1 text-sm ${disciplineRating >= star ? 'text-amber-500' : 'text-slate-300'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Confidence Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setConfidenceRating(star)}
                        className={`p-1 text-sm ${confidenceRating >= star ? 'text-amber-500' : 'text-slate-300'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Execution Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setExecutionRating(star)}
                        className={`p-1 text-sm ${executionRating >= star ? 'text-amber-500' : 'text-slate-300'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Psychological Checklist Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followedPlan}
                    onChange={(e) => setFollowedPlan(e.target.checked)}
                    className="rounded text-[#1565ff]"
                  />
                  <span className="text-slate-800 font-medium">Followed Predefined Plan</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followedStopLoss}
                    onChange={(e) => setFollowedStopLoss(e.target.checked)}
                    className="rounded text-[#1565ff]"
                  />
                  <span className="text-slate-800 font-medium">Respected Stop-Loss Without Moving</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movedStopLoss}
                    onChange={(e) => setMovedStopLoss(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span className="text-slate-800 font-medium">Moved Stop-Loss During Trade</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exitedEarly}
                    onChange={(e) => setExitedEarly(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span className="text-slate-800 font-medium">Exited Early Out of Fear/Impatience</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wasEmotional}
                    onChange={(e) => setWasEmotional(e.target.checked)}
                    className="rounded text-[#ff3b4a]"
                  />
                  <span className="text-slate-800 font-medium">Felt Emotional / FOMO / Revenge Bias</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overLeveraged}
                    onChange={(e) => setOverLeveraged(e.target.checked)}
                    className="rounded text-[#ff3b4a]"
                  />
                  <span className="text-slate-800 font-medium">Over-Leveraged Beyond Normal Sizing</span>
                </label>
              </div>

              {/* STANDARD MISTAKE SELECTOR (12 CATEGORIES) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Tag Trade Mistakes (Mistake Tracker & Analytics)
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {selectedMistakes.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STANDARD_MISTAKES.map((m) => {
                    const isSelected = selectedMistakes.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMistakes(selectedMistakes.filter((x) => x !== m));
                          } else {
                            setSelectedMistakes([...selectedMistakes, m]);
                          }
                        }}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'border-slate-300 bg-slate-50'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <span className="truncate">{m}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Qualitative Review Questions */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Why did I enter this trade? What setup did I see?
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. 15m liquidity sweep followed by a strong Market Structure Shift (MSS)..."
                    value={entryReason}
                    onChange={(e) => setEntryReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Additional Notes on Mistakes & Lessons Learned
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Hesitated on take profit target; next time trail stop to breakeven after 2R..."
                    value={lessonsLearned}
                    onChange={(e) => setLessonsLearned(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SCREENSHOTS */}
          {activeTab === 'screenshots' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Attach charts to compare setup formation vs actual trade execution.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Before Trade Screenshot */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">1. Before-Trade Setup Screenshot</span>
                  {beforeScreenshot ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-300 max-h-40">
                      <img src={beforeScreenshot} alt="Before trade" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setBeforeScreenshot('')}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 text-white rounded-md cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'before')}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-200 file:text-slate-700 file:font-semibold cursor-pointer"
                    />
                  )}
                </div>

                {/* 2. After Trade Screenshot */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">2. After-Trade Outcome Screenshot</span>
                  {afterScreenshot ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-300 max-h-40">
                      <img src={afterScreenshot} alt="After trade" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAfterScreenshot('')}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 text-white rounded-md cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'after')}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-200 file:text-slate-700 file:font-semibold cursor-pointer"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FEES & FUNDING */}
          {activeTab === 'fees' && (
            <div className="space-y-4">
              {(tradeMode as string) === 'DEX' || (tradeMode === 'SPOT' && spotVenue === 'DEX') ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Network Gas Fee ($)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={dexGasFee}
                      onChange={(e) => setDexGasFee(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">Estimated round-trip gas</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">DEX Swap Fee Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dexTradingFeePct}
                      onChange={(e) => setDexTradingFeePct(parseFloat(e.target.value) || 0.3)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">Pool fee (e.g. 0.3% Uniswap v2)</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Slippage Tolerance (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={dexSlippagePct}
                      onChange={(e) => setDexSlippagePct(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">Max acceptable slippage</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Trading Fee Rate (%)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={tradingFee}
                      onChange={(e) => setTradingFee(parseFloat(e.target.value) || 0.055)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Net Funding Payment ($)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="+ earned, - paid"
                      value={fundingCost}
                      onChange={(e) => setFundingCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">+ for funding received, - for funding paid</p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Slippage Cost ($)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Slippage"
                      value={slippageCost}
                      onChange={(e) => setSlippageCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1565ff] focus:bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-600 font-semibold">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="rounded text-amber-500"
              />
              <span>Mark as Playbook Favorite ⭐</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#1565ff] hover:bg-[#0051e6] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {editingTrade ? 'Update Trade' : 'Save To Journal'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
