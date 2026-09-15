import { MarketDataProvider, MarketPrice, MarketContext } from '../types';
import { parseSymbol, cleanSymbol, isForexSymbol } from '../symbolNormalizer';

export class ForexMarketDataProvider implements MarketDataProvider {
  id = 'forex_market_data';
  name = 'ECB Foreign Exchange Feed';

  canHandle(symbol: string, context?: MarketContext): boolean {
    if (context?.mode === 'SPOT' || context?.mode === 'PERPETUAL') return false;
    if (context?.mode === 'FOREX') return true;
    return isForexSymbol(symbol);
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' && (navigator?.onLine ?? true);
  }

  /**
   * Fetches institutional reference rate for a Forex currency pair.
   * European Central Bank reference rates are officially labeled as REFERENCE RATE.
   */
  async getPrice(symbol: string, _context?: MarketContext): Promise<MarketPrice | null> {
    const parsed = parseSymbol(symbol);
    const base = parsed.baseAsset.toUpperCase();
    const quote = parsed.quoteAsset.toUpperCase();

    if (!base || !quote || base === quote) {
      return null;
    }

    const cleanPair = `${base}${quote}`;
    const displayPair = `${base}/${quote}`;
    const contextKey = `FOREX:${cleanPair}`;

    // 1. Try server proxy first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(`/api/market-data/price?symbol=${encodeURIComponent(cleanPair)}&mode=FOREX`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        const price = Number(json?.price);
        if (!isNaN(price) && isFinite(price) && price > 0) {
          return {
            symbol: cleanPair,
            displaySymbol: displayPair,
            price,
            timestamp: json.timestamp || Date.now(),
            source: 'ECB Reference Rate',
            isLive: false,
            isStale: false,
            market: 'FOREX',
            status: 'REFERENCE',
            contextKey,
          };
        }
      }
    } catch {
      // Fall through to direct fetch
    }

    // 2. Direct browser fetch to ECB / Frankfurter public rates
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return null;
      }

      const data = await resp.json();
      const rate = data?.rates?.[quote];
      if (typeof rate === 'number' && !isNaN(rate) && isFinite(rate) && rate > 0) {
        return {
          symbol: cleanPair,
          displaySymbol: displayPair,
          price: rate,
          timestamp: Date.now(),
          source: 'ECB Reference Rate',
          isLive: false,
          isStale: false,
          market: 'FOREX',
          status: 'REFERENCE',
          contextKey,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async getPrices(symbols: string[], context?: MarketContext): Promise<Record<string, MarketPrice>> {
    const results: Record<string, MarketPrice> = {};
    for (const sym of symbols) {
      const price = await this.getPrice(sym, context);
      if (price) {
        results[price.symbol] = price;
        results[cleanSymbol(sym)] = price;
      }
    }
    return results;
  }
}

export const forexMarketDataProvider = new ForexMarketDataProvider();
