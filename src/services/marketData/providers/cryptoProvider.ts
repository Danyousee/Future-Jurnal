import { MarketDataProvider, MarketPrice, MarketContext } from '../types';
import { parseSymbol, cleanSymbol, buildMarketContextKey } from '../symbolNormalizer';

/**
 * Canonical Single Source of Truth for Crypto Market Data
 * 
 * Supports:
 * - SPOT CEX (Binance Spot)
 * - PERPETUAL / FUTURES (Binance Futures)
 * 
 * Excludes:
 * - DEX (DEX is a Spot venue handled by DexMarketDataProvider)
 * - FOREX (handled by ForexMarketDataProvider)
 */
export class CryptoMarketDataProvider implements MarketDataProvider {
  id = 'crypto_market_data';
  name = 'Binance Crypto Public Feed';

  private activeSubscriptions = new Map<string, Set<(price: MarketPrice) => void>>();
  private subscriptionIntervals = new Map<string, number>();

  canHandle(symbol: string, context?: MarketContext): boolean {
    if (context?.mode === 'FOREX') return false;
    if (context?.spotVenue === 'DEX') return false;

    const parsed = parseSymbol(symbol);
    return parsed.isCrypto && !parsed.isForex;
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' && (navigator?.onLine ?? true);
  }

  /**
   * Fetches real price for a single crypto symbol.
   * Differentiates between SPOT and PERPETUAL / FUTURES markets.
   */
  async getPrice(symbol: string, context?: MarketContext): Promise<MarketPrice | null> {
    const parsed = parseSymbol(symbol);
    let pairCode = parsed.normalized;

    // Default quote to USDT if user entered only token symbol like 'BTC'
    if (!pairCode.endsWith('USDT') && !pairCode.endsWith('USDC') && !pairCode.endsWith('FDUSD') && !pairCode.endsWith('BUSD') && !pairCode.endsWith('USD') && !pairCode.endsWith('EUR') && !pairCode.endsWith('BTC') && !pairCode.endsWith('ETH')) {
      pairCode = `${pairCode}USDT`;
    }

    const isPerp = context?.mode === 'PERPETUAL';
    const contextKey = isPerp ? `PERPETUAL:${pairCode}` : `SPOT:CEX:${pairCode}`;

    // 1. Try server proxy first (avoids CORS restrictions and rate limits)
    try {
      const modeParam = isPerp ? 'PERPETUAL' : 'SPOT';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(`/api/market-data/price?symbol=${encodeURIComponent(pairCode)}&mode=${modeParam}&venue=CEX`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        const price = Number(json?.price);
        if (!isNaN(price) && isFinite(price) && price > 0) {
          return {
            symbol: pairCode,
            displaySymbol: parsed.displayPair || `${parsed.baseAsset}/${parsed.quoteAsset}`,
            price,
            timestamp: json.timestamp || Date.now(),
            source: isPerp ? 'Binance Futures' : 'Binance Spot',
            isLive: true,
            isStale: false,
            market: isPerp ? 'PERPETUAL' : 'SPOT',
            spotVenue: 'CEX',
            status: 'LIVE',
            contextKey,
            high24h: json.high24h ? Number(json.high24h) : undefined,
            low24h: json.low24h ? Number(json.low24h) : undefined,
            change24h: json.change24h ? Number(json.change24h) : undefined,
          };
        }
      }
    } catch {
      // Server proxy not available or timed out, fallback to direct API
    }

    // 2. Direct browser REST API fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const apiUrl = isPerp
        ? `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${pairCode}`
        : `https://api.binance.com/api/v3/ticker/price?symbol=${pairCode}`;

      const resp = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return null;
      }

      const data = await resp.json();
      const price = parseFloat(data.price);
      if (isNaN(price) || !isFinite(price) || price <= 0) {
        return null;
      }

      return {
        symbol: pairCode,
        displaySymbol: parsed.displayPair || `${parsed.baseAsset}/${parsed.quoteAsset}`,
        price,
        timestamp: Date.now(),
        source: isPerp ? 'Binance Futures' : 'Binance Spot',
        isLive: true,
        isStale: false,
        market: isPerp ? 'PERPETUAL' : 'SPOT',
        spotVenue: 'CEX',
        status: 'LIVE',
        contextKey,
      };
    } catch {
      return null;
    }
  }

  /**
   * Batch fetches real prices for multiple crypto symbols.
   */
  async getPrices(symbols: string[], context?: MarketContext): Promise<Record<string, MarketPrice>> {
    const isPerp = context?.mode === 'PERPETUAL';
    const cleanSymbols = symbols.map(s => {
      const p = parseSymbol(s);
      let sym = p.normalized;
      if (!sym.endsWith('USDT') && !sym.endsWith('USDC') && !sym.endsWith('FDUSD') && !sym.endsWith('BUSD') && !sym.endsWith('USD')) {
        sym = `${sym}USDT`;
      }
      return { raw: s, clean: sym, display: p.displayPair };
    });

    if (cleanSymbols.length === 0) return {};

    // 1. Try server proxy batch
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const resp = await fetch('/api/market-data/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: cleanSymbols.map(s => s.clean),
          mode: isPerp ? 'PERPETUAL' : 'SPOT',
          venue: 'CEX',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        if (json && typeof json === 'object' && Object.keys(json).length > 0) {
          const results: Record<string, MarketPrice> = {};
          for (const item of cleanSymbols) {
            const data = json[item.clean] || json[cleanSymbol(item.raw)];
            const price = Number(data?.price);
            if (!isNaN(price) && isFinite(price) && price > 0) {
              const contextKey = isPerp ? `PERPETUAL:${item.clean}` : `SPOT:CEX:${item.clean}`;
              const mp: MarketPrice = {
                symbol: item.clean,
                displaySymbol: item.display,
                price,
                timestamp: data.timestamp || Date.now(),
                source: isPerp ? 'Binance Futures' : 'Binance Spot',
                isLive: true,
                isStale: false,
                market: isPerp ? 'PERPETUAL' : 'SPOT',
                spotVenue: 'CEX',
                status: 'LIVE',
                contextKey,
              };
              results[item.clean] = mp;
              results[cleanSymbol(item.raw)] = mp;
            }
          }
          if (Object.keys(results).length > 0) {
            return results;
          }
        }
      }
    } catch {
      // Fallback to direct client fetch
    }

    // 2. Direct browser REST API batch fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const apiUrl = isPerp
        ? 'https://fapi.binance.com/fapi/v1/ticker/price'
        : 'https://api.binance.com/api/v3/ticker/price';

      const resp = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return {};
      }

      const allTickers: Array<{ symbol: string; price: string }> = await resp.json();
      const tickerMap = new Map<string, number>();
      for (const t of allTickers) {
        const p = parseFloat(t.price);
        if (!isNaN(p) && isFinite(p) && p > 0) {
          tickerMap.set(t.symbol, p);
        }
      }

      const results: Record<string, MarketPrice> = {};
      for (const item of cleanSymbols) {
        const price = tickerMap.get(item.clean);
        if (price !== undefined && price > 0) {
          const contextKey = isPerp ? `PERPETUAL:${item.clean}` : `SPOT:CEX:${item.clean}`;
          const mp: MarketPrice = {
            symbol: item.clean,
            displaySymbol: item.display,
            price,
            timestamp: Date.now(),
            source: isPerp ? 'Binance Futures' : 'Binance Spot',
            isLive: true,
            isStale: false,
            market: isPerp ? 'PERPETUAL' : 'SPOT',
            spotVenue: 'CEX',
            status: 'LIVE',
            contextKey,
          };
          results[item.clean] = mp;
          results[cleanSymbol(item.raw)] = mp;
        }
      }

      return results;
    } catch {
      return {};
    }
  }

  /**
   * Subscriptions with proper context-key isolation and cleanup.
   */
  subscribeToPrice(
    symbol: string, 
    callback: (price: MarketPrice) => void, 
    context?: MarketContext
  ): () => void {
    const key = buildMarketContextKey(symbol, context);

    if (!this.activeSubscriptions.has(key)) {
      this.activeSubscriptions.set(key, new Set());
    }
    this.activeSubscriptions.get(key)!.add(callback);

    // Initial fetch
    this.getPrice(symbol, context).then(p => {
      if (p) callback(p);
    });

    // Start timer for this specific context-key if not already polling
    if (!this.subscriptionIntervals.has(key)) {
      const intervalId = window.setInterval(async () => {
        const price = await this.getPrice(symbol, context);
        if (price) {
          const listeners = this.activeSubscriptions.get(key);
          listeners?.forEach(cb => {
            try {
              cb(price);
            } catch (err) {
              console.error(err);
            }
          });
        }
      }, 5000);
      this.subscriptionIntervals.set(key, intervalId);
    }

    return () => {
      const set = this.activeSubscriptions.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.activeSubscriptions.delete(key);
          const intervalId = this.subscriptionIntervals.get(key);
          if (intervalId) {
            clearInterval(intervalId);
            this.subscriptionIntervals.delete(key);
          }
        }
      }
    };
  }
}

export const cryptoMarketDataProvider = new CryptoMarketDataProvider();
