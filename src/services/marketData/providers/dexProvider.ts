import { MarketDataProvider, MarketPrice, MarketContext } from '../types';
import { parseSymbol, cleanSymbol, buildMarketContextKey } from '../symbolNormalizer';

/**
 * DEX Spot Venue Provider Abstraction
 * Handles Spot trades executed on Decentralized Exchanges (Uniswap, Raydium, PancakeSwap, etc.).
 * Designed so on-chain or DEX indexers can be connected without altering core trading modes.
 *
 * Never fabricates prices. If live on-chain price is not reachable, returns null
 * so the application displays "Live DEX Price Unavailable" and falls back to manual entry.
 */
export class DexMarketDataProvider implements MarketDataProvider {
  id = 'dex_market_data';
  name = 'DEX On-Chain Provider';

  canHandle(_symbol: string, context?: MarketContext): boolean {
    return context?.spotVenue === 'DEX';
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' && (navigator?.onLine ?? true);
  }

  async getPrice(symbol: string, context?: MarketContext): Promise<MarketPrice | null> {
    if (context?.spotVenue !== 'DEX') {
      return null;
    }

    const parsed = parseSymbol(symbol);
    const clean = parsed.normalized || cleanSymbol(symbol);
    const contextKey = `SPOT:DEX:${clean}`;

    // Try server-side DEX proxy if implemented
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const resp = await fetch(`/api/market-data/price?symbol=${encodeURIComponent(clean)}&mode=SPOT&venue=DEX`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        const price = Number(data?.price);
        if (!isNaN(price) && isFinite(price) && price > 0) {
          return {
            symbol: clean,
            displaySymbol: parsed.displayPair,
            price,
            timestamp: data.timestamp || Date.now(),
            source: data.source || 'DEX Pool',
            isLive: true,
            isStale: false,
            market: 'SPOT',
            spotVenue: 'DEX',
            status: 'LIVE',
            contextKey,
          };
        }
      }
    } catch {
      // Graceful return - never invent synthetic DEX prices
    }

    // Live DEX price unavailable - caller displays "Live DEX Price Unavailable" and manual pricing
    return null;
  }

  async getPrices(symbols: string[], context?: MarketContext): Promise<Record<string, MarketPrice>> {
    const res: Record<string, MarketPrice> = {};
    for (const s of symbols) {
      const p = await this.getPrice(s, context);
      if (p) {
        res[cleanSymbol(s)] = p;
      }
    }
    return res;
  }
}

export const dexMarketDataProvider = new DexMarketDataProvider();
