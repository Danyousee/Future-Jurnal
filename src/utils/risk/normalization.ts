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

  // 1. Explicit mode handling (Authoritative user selection)
  if (rawMode === 'SPOT') {
    const isDexVenue = rawVenue === 'DEX' || Boolean(record.dexChain || record.dexProtocol);
    return {
      tradingMode: 'SPOT',
      spotVenue: isDexVenue ? 'DEX' : 'CEX',
    };
  }

  if (rawMode === 'PERPETUAL') {
    return {
      tradingMode: 'PERPETUAL',
      spotVenue: undefined,
    };
  }

  if (rawMode === 'FOREX') {
    return {
      tradingMode: 'FOREX',
      spotVenue: undefined,
    };
  }

  if (rawMode === 'DEX') {
    return {
      tradingMode: 'SPOT',
      spotVenue: 'DEX',
    };
  }

  // 2. Legacy fallback heuristics ONLY when rawMode is empty or not specified
  const isDex =
    rawVenue === 'DEX' ||
    Boolean(record.dexChain || record.dexProtocol);

  if (isDex) {
    return {
      tradingMode: 'SPOT',
      spotVenue: 'DEX',
    };
  }

  const isForex = Boolean(
    (record.lotSize !== undefined && record.lotSize > 0) ||
    (record.pipsRisk !== undefined && record.pipsRisk > 0)
  );

  if (isForex) {
    return {
      tradingMode: 'FOREX',
      spotVenue: undefined,
    };
  }

  if (record.leverage === 1) {
    return {
      tradingMode: 'SPOT',
      spotVenue: 'CEX',
    };
  }

  // Default fallback for legacy futures records
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
