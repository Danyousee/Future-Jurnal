import { TradingMode, SpotVenue, TradeJournalEntry, OpenPosition, CalculatorState } from '../../types';

export interface NormalizedTradingModeResult {
  tradingMode: TradingMode;
  spotVenue?: SpotVenue;
}

/**
 * Universal normalization function for legacy and incoming trade records.
 *
 * Guarantees:
 * - Legacy `tradingMode = 'DEX'` or `tradeMode = 'DEX'` is cleanly mapped to `tradingMode = 'SPOT'` with `spotVenue = 'DEX'`.
 * - Validates that the primary trading mode is strictly one of SPOT | PERPETUAL | FOREX.
 * - Non-destructive: preserves existing fields while ensuring canonical mode and venue representation.
 */
export function normalizeTradingMode(record: {
  tradeMode?: string;
  tradingMode?: string;
  spotVenue?: SpotVenue | string;
  dexChain?: string;
  dexProtocol?: string;
  dexGasFee?: number;
  lotSize?: number;
  pipSize?: number;
  pipsRisk?: number;
  leverage?: number;
  [key: string]: any;
}): NormalizedTradingModeResult {
  const rawMode = ((record.tradingMode || record.tradeMode || '') as string).toUpperCase().trim();
  const rawVenue = ((record.spotVenue || '') as string).toUpperCase().trim();

  // 1. Check for explicit DEX mode or DEX signals
  const isDex =
    rawMode === 'DEX' ||
    rawVenue === 'DEX' ||
    Boolean(record.dexChain || record.dexProtocol || (record.dexGasFee !== undefined && record.dexGasFee > 0));

  if (isDex) {
    return {
      tradingMode: 'SPOT',
      spotVenue: 'DEX',
    };
  }

  // 2. Check for Forex
  const isForex =
    rawMode === 'FOREX' ||
    Boolean(record.lotSize || record.pipSize || record.pipsRisk);

  if (isForex) {
    return {
      tradingMode: 'FOREX',
      spotVenue: undefined,
    };
  }

  // 3. Check for Spot CEX
  if (rawMode === 'SPOT') {
    return {
      tradingMode: 'SPOT',
      spotVenue: (rawVenue === 'DEX' ? 'DEX' : 'CEX') as SpotVenue,
    };
  }

  // 4. Check for Perpetual (Default)
  return {
    tradingMode: 'PERPETUAL',
    spotVenue: undefined,
  };
}

/**
 * Normalizes a TradeJournalEntry object so that legacy records stored in IndexedDB
 * have canonical `tradeMode: 'SPOT'` and `spotVenue: 'DEX'`.
 */
export function normalizeJournalTrade(trade: TradeJournalEntry): TradeJournalEntry {
  const normalized = normalizeTradingMode(trade);
  return {
    ...trade,
    tradeMode: normalized.tradingMode,
    spotVenue: normalized.spotVenue,
  };
}

/**
 * Normalizes an OpenPosition object so that legacy positions
 * have canonical `tradeMode: 'SPOT'` and `spotVenue: 'DEX'`.
 */
export function normalizeOpenPosition(position: OpenPosition): OpenPosition {
  const normalized = normalizeTradingMode(position);
  return {
    ...position,
    tradeMode: normalized.tradingMode,
    spotVenue: normalized.spotVenue,
  };
}

/**
 * Normalizes a CalculatorState object so that any legacy state
 * has canonical `tradingMode: 'SPOT'` and `spotVenue: 'DEX'`.
 */
export function normalizeCalculatorState(state: CalculatorState): CalculatorState {
  const normalized = normalizeTradingMode(state);
  return {
    ...state,
    tradingMode: normalized.tradingMode,
    spotVenue: normalized.spotVenue,
  };
}
