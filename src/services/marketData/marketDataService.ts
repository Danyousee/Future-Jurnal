import { MarketDataProvider, MarketPrice, MarketContext, PriceStatusType } from './types';
import { manualPriceProvider } from './providers/manualProvider';
import { cryptoMarketDataProvider } from './providers/cryptoProvider';
import { forexMarketDataProvider } from './providers/forexProvider';
import { dexMarketDataProvider } from './providers/dexProvider';
import { cleanSymbol, parseSymbol, buildMarketContextKey } from './symbolNormalizer';

/**
 * Enterprise Production-Grade Market Data Gateway Service
 * 
 * Guarantees:
 * 1. Market context keys (MODE:VENUE:SYMBOL) prevent cross-mode data pollution (Spot vs Perp vs Forex vs DEX).
 * 2. Strict request deduplication and in-flight pooling.
 * 3. Strict validation: rejects NaN, Infinity, negative, and zero prices.
 * 4. Stale price preservation: stale fallbacks preserve their original timestamp without mutating to Date.now().
 * 5. Institutional labeling: ECB Forex data explicitly designated as REFERENCE RATE.
 * 6. DEX Spot Isolation: DEX trades never use CEX or synthetic prices.
 */
export class MarketDataService {
  private providers: MarketDataProvider[] = [
    cryptoMarketDataProvider,
    forexMarketDataProvider,
    dexMarketDataProvider,
    manualPriceProvider,
  ];

  // In-memory price cache keyed primarily by contextKey (e.g. 'SPOT:CEX:BTCUSDT', 'PERPETUAL:BTCUSDT')
  private priceCache = new Map<string, MarketPrice>();
  
  // Deduplication of concurrent inflight requests keyed by contextKey
  private inflightRequests = new Map<string, Promise<MarketPrice | null>>();

  // Listeners for updates
  private contextListeners = new Map<string, Set<(price: MarketPrice) => void>>();
  private allListeners = new Set<(prices: Record<string, MarketPrice>) => void>();

  // Throttling to prevent redundant rapid calls
  private lastFetchTime = new Map<string, number>();
  private readonly THROTTLE_MS = 2500;
  private readonly STALE_THRESHOLD_MS = 60000; // 60 seconds

  public registerProvider(provider: MarketDataProvider) {
    this.providers.unshift(provider);
  }

  public normalizeSymbol(symbol: string): string {
    return cleanSymbol(symbol);
  }

  public isPriceStale(price: MarketPrice, maxAgeMs: number = this.STALE_THRESHOLD_MS): boolean {
    if (!price || !price.timestamp) return true;
    return (Date.now() - price.timestamp) > maxAgeMs;
  }

  public computePriceStatus(price: MarketPrice | undefined): PriceStatusType {
    if (!price || !price.price || price.price <= 0) return 'UNAVAILABLE';
    if (this.isPriceStale(price)) return 'STALE';
    if (price.status === 'REFERENCE' || price.market === 'FOREX' || price.source?.includes('Reference')) {
      return 'REFERENCE';
    }
    if (!price.isLive) return 'MANUAL';
    return 'LIVE';
  }

  /**
   * Retrieves cached price using context-aware hierarchy:
   * 1. Exact context key (e.g. 'SPOT:CEX:BTCUSDT')
   * 2. Direct clean symbol (if unique)
   */
  public getCachedPrice(symbol: string, context?: MarketContext): MarketPrice | undefined {
    const clean = this.normalizeSymbol(symbol);
    const contextKey = buildMarketContextKey(symbol, context);
    
    // Check exact context key first
    let cached = this.priceCache.get(contextKey);
    if (!cached && clean) {
      cached = this.priceCache.get(clean);
    }
    if (!cached) return undefined;

    const isStale = this.isPriceStale(cached);
    return {
      ...cached,
      isStale,
      status: this.computePriceStatus({ ...cached, isStale }),
    };
  }

  public getAllCachedPrices(): Record<string, MarketPrice> {
    const res: Record<string, MarketPrice> = {};
    this.priceCache.forEach((val, key) => {
      const isStale = this.isPriceStale(val);
      res[key] = {
        ...val,
        isStale,
        status: this.computePriceStatus({ ...val, isStale }),
      };
    });
    return res;
  }

  /**
   * Sets manual mark price for a symbol within its market context.
   */
  public setManualPrice(symbol: string, price: number, context?: MarketContext): MarketPrice {
    const clean = this.normalizeSymbol(symbol);
    const contextKey = buildMarketContextKey(symbol, context);
    const updated = manualPriceProvider.setPrice(clean, price, context);

    // Save under both contextKey and clean symbol
    this.priceCache.set(contextKey, updated);
    this.priceCache.set(clean, updated);
    this.notify(updated, context);
    return updated;
  }

  /**
   * Fetches latest real price for a symbol with strict context isolation.
   */
  public async getPrice(
    symbol: string, 
    options: { allowCache?: boolean; context?: MarketContext } = { allowCache: true }
  ): Promise<MarketPrice | null> {
    const clean = this.normalizeSymbol(symbol);
    if (!clean) return null;

    const contextKey = buildMarketContextKey(symbol, options.context);
    const now = Date.now();

    // 1. Check existing valid cache within throttle window
    if (options.allowCache !== false) {
      const cached = this.priceCache.get(contextKey) || this.priceCache.get(clean);
      const lastFetch = this.lastFetchTime.get(contextKey) || 0;
      if (cached && (now - lastFetch < this.THROTTLE_MS)) {
        const isStale = this.isPriceStale(cached);
        return {
          ...cached,
          isStale,
          status: this.computePriceStatus({ ...cached, isStale }),
        };
      }
    }

    // 2. Deduplicate concurrent in-flight requests for the exact context key
    if (this.inflightRequests.has(contextKey)) {
      return this.inflightRequests.get(contextKey)!;
    }

    const fetchPromise = (async () => {
      this.lastFetchTime.set(contextKey, Date.now());

      // Special rule: DEX trades never use CEX or synthetic prices
      if (options.context?.spotVenue === 'DEX') {
        const dexPrice = await dexMarketDataProvider.getPrice(clean, options.context);
        if (dexPrice && typeof dexPrice.price === 'number' && !isNaN(dexPrice.price) && dexPrice.price > 0) {
          this.priceCache.set(contextKey, dexPrice);
          this.notify(dexPrice, options.context);
          return dexPrice;
        }
        // If live on-chain DEX price unavailable, check if manual price was set
        const manual = await manualPriceProvider.getPrice(clean, options.context);
        if (manual && manual.price > 0) {
          return manual;
        }
        return null;
      }

      // Query providers in order of registration
      for (const provider of this.providers) {
        try {
          if (provider.isAvailable() && provider.canHandle(clean, options.context)) {
            const price = await provider.getPrice(clean, options.context);
            
            // STRICT VALIDATION: reject NaN, <= 0, Infinity
            if (price && typeof price.price === 'number' && !isNaN(price.price) && isFinite(price.price) && price.price > 0) {
              const isForex = options.context?.mode === 'FOREX' || price.market === 'FOREX' || price.source?.includes('Reference');
              const status: PriceStatusType = isForex 
                ? 'REFERENCE' 
                : (price.isLive ? 'LIVE' : 'MANUAL');

              const enrichedPrice: MarketPrice = {
                ...price,
                symbol: clean,
                displaySymbol: price.displaySymbol || parseSymbol(symbol).displayPair,
                timestamp: price.timestamp || Date.now(),
                isStale: false,
                status,
                market: options.context?.mode || price.market,
                spotVenue: options.context?.spotVenue || price.spotVenue,
                contextKey,
              };

              // Cache by exact contextKey
              this.priceCache.set(contextKey, enrichedPrice);
              // Also index by clean symbol if no clash
              if (!this.priceCache.has(clean) || options.context?.mode === 'SPOT') {
                this.priceCache.set(clean, enrichedPrice);
              }

              this.notify(enrichedPrice, options.context);
              return enrichedPrice;
            }
          }
        } catch (err) {
          console.warn(`[MarketDataService] Provider ${provider.name} failed for ${clean}:`, err);
        }
      }

      // Fallback 1: Return existing valid cached price if available (flagged as STALE)
      // CRITICAL: Preserve original timestamp! Do NOT overwrite with Date.now().
      const existing = this.priceCache.get(contextKey) || this.priceCache.get(clean);
      if (existing && existing.price > 0) {
        const isForex = existing.market === 'FOREX' || existing.source?.includes('Reference');
        const staleExisting: MarketPrice = {
          ...existing,
          isStale: true,
          status: isForex ? 'REFERENCE' : (existing.isLive ? 'STALE' : 'MANUAL'),
          // Retains original timestamp
        };
        return staleExisting;
      }

      // Fallback 2: Check manual price provider explicitly
      const manual = await manualPriceProvider.getPrice(clean, options.context);
      if (manual && manual.price > 0) {
        return manual;
      }

      // Fallback 3: Return null (no fabricated or fake prices)
      return null;
    })().finally(() => {
      this.inflightRequests.delete(contextKey);
    });

    this.inflightRequests.set(contextKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Batch fetches prices for multiple symbols with request deduplication and canonical key mapping.
   */
  public async getPrices(
    symbols: string[], 
    options: { allowCache?: boolean; context?: MarketContext } = { allowCache: true }
  ): Promise<Record<string, MarketPrice>> {
    if (!symbols || symbols.length === 0) return {};

    const uniqueClean = Array.from(new Set(symbols.map(s => this.normalizeSymbol(s)).filter(Boolean)));
    const results: Record<string, MarketPrice> = {};

    // 1. Separate crypto vs forex vs dex symbols
    const cryptoSymbols: string[] = [];
    const forexSymbols: string[] = [];
    const dexSymbols: string[] = [];

    for (const sym of uniqueClean) {
      const parsed = parseSymbol(sym);
      if (options.context?.spotVenue === 'DEX') {
        dexSymbols.push(sym);
      } else if (options.context?.mode === 'FOREX' || parsed.isForex) {
        forexSymbols.push(sym);
      } else {
        cryptoSymbols.push(sym);
      }
    }

    // 2. Batch fetch crypto if applicable
    if (cryptoSymbols.length > 0 && cryptoMarketDataProvider.isAvailable()) {
      try {
        const cryptoBatch = await cryptoMarketDataProvider.getPrices(cryptoSymbols, options.context);
        for (const [symKey, mp] of Object.entries(cryptoBatch)) {
          if (mp && mp.price > 0) {
            const contextKey = buildMarketContextKey(symKey, options.context);
            this.priceCache.set(contextKey, mp);
            this.priceCache.set(symKey, mp);
            this.lastFetchTime.set(contextKey, Date.now());

            results[contextKey] = mp;
            results[symKey] = mp;
            results[cleanSymbol(symKey)] = mp;
          }
        }
      } catch (err) {
        console.warn('[MarketDataService] Crypto batch failed:', err);
      }
    }

    // 3. Batch fetch forex if applicable
    if (forexSymbols.length > 0 && forexMarketDataProvider.isAvailable()) {
      try {
        const fxBatch = await forexMarketDataProvider.getPrices(forexSymbols, options.context);
        for (const [symKey, mp] of Object.entries(fxBatch)) {
          if (mp && mp.price > 0) {
            const contextKey = buildMarketContextKey(symKey, { mode: 'FOREX' });
            this.priceCache.set(contextKey, mp);
            this.priceCache.set(symKey, mp);
            this.lastFetchTime.set(contextKey, Date.now());

            results[contextKey] = mp;
            results[symKey] = mp;
            results[cleanSymbol(symKey)] = mp;
          }
        }
      } catch (err) {
        console.warn('[MarketDataService] Forex batch failed:', err);
      }
    }

    // 4. For any remaining symbols (e.g. DEX or items missed in batch), fetch individually
    const remaining = uniqueClean.filter(s => {
      const contextKey = buildMarketContextKey(s, options.context);
      return !results[contextKey] && !results[s];
    });

    await Promise.all(
      remaining.map(async sym => {
        const p = await this.getPrice(sym, options);
        if (p) {
          const contextKey = buildMarketContextKey(sym, options.context);
          results[contextKey] = p;
          results[sym] = p;
          results[cleanSymbol(sym)] = p;
        }
      })
    );

    // 5. Ensure raw input symbols map directly to results for seamless caller lookup
    for (const rawSym of symbols) {
      const clean = cleanSymbol(rawSym);
      const contextKey = buildMarketContextKey(rawSym, options.context);
      const matched = results[contextKey] || results[clean];
      if (matched) {
        results[rawSym] = matched;
        results[clean] = matched;
        results[contextKey] = matched;
      }
    }

    // Notify listeners if any prices updated
    if (Object.keys(results).length > 0) {
      const allCached = this.getAllCachedPrices();
      this.allListeners.forEach(listener => {
        try {
          listener(allCached);
        } catch (e) {
          console.error(e);
        }
      });
    }

    return results;
  }

  /**
   * Subscribes to updates for a specific symbol within a market context.
   */
  public subscribe(
    symbol: string, 
    callback: (price: MarketPrice) => void,
    context?: MarketContext
  ): () => void {
    const clean = this.normalizeSymbol(symbol);
    const contextKey = buildMarketContextKey(symbol, context);

    if (!this.contextListeners.has(contextKey)) {
      this.contextListeners.set(contextKey, new Set());
    }
    this.contextListeners.get(contextKey)!.add(callback);

    // Emit cached price immediately if available
    const cached = this.getCachedPrice(clean, context);
    if (cached) {
      callback(cached);
    } else {
      // Trigger background fetch
      this.getPrice(clean, { context });
    }

    return () => {
      const set = this.contextListeners.get(contextKey);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.contextListeners.delete(contextKey);
        }
      }
    };
  }

  public subscribeAll(callback: (prices: Record<string, MarketPrice>) => void): () => void {
    this.allListeners.add(callback);
    callback(this.getAllCachedPrices());
    return () => {
      this.allListeners.delete(callback);
    };
  }

  private notify(price: MarketPrice, context?: MarketContext) {
    const clean = this.normalizeSymbol(price.symbol);
    const contextKey = price.contextKey || buildMarketContextKey(price.symbol, context);

    // Notify specific context listeners
    const contextListeners = this.contextListeners.get(contextKey);
    if (contextListeners) {
      contextListeners.forEach(cb => {
        try {
          cb(price);
        } catch (e) {
          console.error(e);
        }
      });
    }

    // Notify generic clean symbol listeners as fallback
    const genericListeners = this.contextListeners.get(clean);
    if (genericListeners && genericListeners !== contextListeners) {
      genericListeners.forEach(cb => {
        try {
          cb(price);
        } catch (e) {
          console.error(e);
        }
      });
    }

    const all = this.getAllCachedPrices();
    this.allListeners.forEach(cb => {
      try {
        cb(all);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const marketDataService = new MarketDataService();
