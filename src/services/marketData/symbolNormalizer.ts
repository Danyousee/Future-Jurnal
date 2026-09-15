import { TradingMode, SpotVenue } from '../../types';
import { MarketContext } from './types';

/**
 * Centralized Symbol Normalization & Classification
 * Standardizes crypto, forex, and DEX symbols across all trading modes.
 */

export interface ParsedSymbol {
  raw: string;
  normalized: string;        // e.g. 'BTCUSDT', 'EURUSD'
  displayPair: string;       // e.g. 'BTC/USDT', 'EUR/USD'
  baseAsset: string;         // e.g. 'BTC', 'EUR'
  quoteAsset: string;        // e.g. 'USDT', 'USD'
  marketType: 'CRYPTO' | 'FOREX' | 'DEX' | 'UNKNOWN';
  isCrypto: boolean;
  isForex: boolean;
}

// Major Forex currencies
export const FOREX_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 
  'SEK', 'NOK', 'SGD', 'HKD', 'ZAR', 'MXN', 'TRY', 'PLN', 'CNH', 'CNY'
]);

// Common Crypto quote assets
export const CRYPTO_QUOTES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'USD', 'EUR', 'BTC', 'ETH'];

/**
 * Strips formatting characters (slashes, dashes, underscores, spaces, dots)
 * and returns a clean uppercase alphanumeric string.
 * Also strips common futures/perp suffixes (.P, _PERP, :USDT) to reveal the base pair.
 */
export function cleanSymbol(symbol: string): string {
  if (!symbol) return '';
  let s = symbol.trim().toUpperCase();
  // Strip perpetual contract notations: e.g. BTCUSDT.P, BTCUSDT_PERP, BTC/USDT:USDT
  s = s.replace(/\.P$/i, '').replace(/_PERP$/i, '').replace(/:USDT$/i, '');
  return s.replace(/[\/\-_ \.]/g, '');
}

/**
 * Checks if a symbol represents a traditional Forex pair.
 */
export function isForexSymbol(symbol: string): boolean {
  if (!symbol) return false;
  const clean = cleanSymbol(symbol);
  
  // Standard 6-character forex pairs (e.g. EURUSD, GBPJPY, AUDUSD)
  if (clean.length === 6) {
    const base = clean.slice(0, 3);
    const quote = clean.slice(3, 6);
    if (FOREX_CURRENCIES.has(base) && FOREX_CURRENCIES.has(quote)) {
      return true;
    }
  }

  // Symbol containing delimiter with forex currencies (e.g. EUR/USD, GBP-JPY, EUR_USD)
  const parts = symbol.split(/[\/\-_ \.]/).map(p => p.trim().toUpperCase()).filter(Boolean);
  if (parts.length === 2 && FOREX_CURRENCIES.has(parts[0]) && FOREX_CURRENCIES.has(parts[1])) {
    return true;
  }

  return false;
}

/**
 * Parses any incoming symbol string into a standardized representation.
 * Handles:
 * - BTC/USDT, BTC-USDT, BTC_USDT, BTCUSDT -> normalized: BTCUSDT, display: BTC/USDT
 * - EUR/USD, EUR-USD, EUR_USD, EURUSD -> normalized: EURUSD, display: EUR/USD
 */
export function parseSymbol(raw: string): ParsedSymbol {
  if (!raw) {
    return {
      raw: '',
      normalized: '',
      displayPair: '',
      baseAsset: '',
      quoteAsset: '',
      marketType: 'UNKNOWN',
      isCrypto: false,
      isForex: false,
    };
  }

  const trimmed = raw.trim();
  const clean = cleanSymbol(trimmed);

  // 1. Check for Forex
  if (isForexSymbol(trimmed)) {
    let base = '';
    let quote = '';
    const parts = trimmed.split(/[\/\-_ \.]/).map(p => p.trim().toUpperCase()).filter(Boolean);
    if (parts.length === 2 && FOREX_CURRENCIES.has(parts[0]) && FOREX_CURRENCIES.has(parts[1])) {
      base = parts[0];
      quote = parts[1];
    } else if (clean.length === 6) {
      base = clean.slice(0, 3);
      quote = clean.slice(3, 6);
    }

    return {
      raw: trimmed,
      normalized: `${base}${quote}`,
      displayPair: `${base}/${quote}`,
      baseAsset: base,
      quoteAsset: quote,
      marketType: 'FOREX',
      isCrypto: false,
      isForex: true,
    };
  }

  // 2. Check for Crypto Pair with delimiters: '/', '-', '_', '.', ' ' (e.g. BTC/USDT, BTC-USDT, BTC_USDT)
  const delimiterMatch = trimmed.match(/[\/\-_ \.]/);
  if (delimiterMatch) {
    const parts = trimmed.split(/[\/\-_ \.]/).map(p => p.trim().toUpperCase()).filter(Boolean);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const base = parts[0];
      let quote = parts[1];
      // Strip trailing .P or PERP if attached
      quote = quote.replace(/PERP/i, '').replace(/P$/i, '').trim() || parts[1];
      return {
        raw: trimmed,
        normalized: `${base}${quote}`,
        displayPair: `${base}/${quote}`,
        baseAsset: base,
        quoteAsset: quote,
        marketType: 'CRYPTO',
        isCrypto: true,
        isForex: false,
      };
    }
  }

  // 3. Check for concatenated crypto pair (e.g. BTCUSDT, ETHUSDC, SOLFDUSD)
  for (const quote of CRYPTO_QUOTES) {
    if (clean.endsWith(quote) && clean.length > quote.length) {
      const base = clean.slice(0, -quote.length);
      return {
        raw: trimmed,
        normalized: clean,
        displayPair: `${base}/${quote}`,
        baseAsset: base,
        quoteAsset: quote,
        marketType: 'CRYPTO',
        isCrypto: true,
        isForex: false,
      };
    }
  }

  // 4. Standalone token or unknown format (e.g. 'BTC' or custom token)
  return {
    raw: trimmed,
    normalized: clean,
    displayPair: clean ? `${clean}/USDT` : '',
    baseAsset: clean,
    quoteAsset: 'USDT',
    marketType: 'CRYPTO',
    isCrypto: true,
    isForex: false,
  };
}

/**
 * Returns a standardized display pair string (e.g. 'BTC/USDT').
 */
export function formatDisplayPair(symbol: string): string {
  return parseSymbol(symbol).displayPair;
}

/**
 * Builds a strict context-aware cache key.
 *
 * Examples:
 * - SPOT + CEX: 'SPOT:CEX:BTCUSDT'
 * - SPOT + DEX: 'SPOT:DEX:BTCUSDT'
 * - PERPETUAL:   'PERPETUAL:BTCUSDT'
 * - FOREX:       'FOREX:EURUSD'
 *
 * Guarantees Spot prices never overwrite Perpetual prices or DEX prices.
 */
export function buildMarketContextKey(symbol: string, context?: MarketContext): string {
  const parsed = parseSymbol(symbol);
  const clean = parsed.normalized || cleanSymbol(symbol);

  // 1. Forex Mode
  if (context?.mode === 'FOREX' || parsed.isForex) {
    return `FOREX:${clean}`;
  }

  // 2. Perpetual / Futures Mode
  if (context?.mode === 'PERPETUAL') {
    return `PERPETUAL:${clean}`;
  }

  // 3. Spot DEX Mode
  if (context?.spotVenue === 'DEX') {
    return `SPOT:DEX:${clean}`;
  }

  // 4. Spot CEX Mode (Default)
  return `SPOT:CEX:${clean}`;
}
