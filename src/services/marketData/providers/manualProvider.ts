import { MarketDataProvider, MarketPrice, MarketContext } from '../types';
import { cleanSymbol, parseSymbol, buildMarketContextKey } from '../symbolNormalizer';

export class ManualPriceProvider implements MarketDataProvider {
  id = 'manual';
  name = 'Manual Price';
  // Map keyed by context key (e.g. 'SPOT:CEX:BTCUSDT', 'PERPETUAL:BTCUSDT')
  private manualPrices = new Map<string, MarketPrice>();

  canHandle(_symbol: string, _context?: MarketContext): boolean {
    return true;
  }

  isAvailable(): boolean {
    return true;
  }

  setPrice(symbol: string, price: number, context?: MarketContext): MarketPrice {
    const clean = cleanSymbol(symbol);
    const parsed = parseSymbol(symbol);
    const contextKey = buildMarketContextKey(symbol, context);

    const entry: MarketPrice = {
      symbol: clean,
      displaySymbol: parsed.displayPair || `${parsed.baseAsset}/${parsed.quoteAsset}`,
      price,
      timestamp: Date.now(),
      source: 'Manual Price',
      isLive: false,
      isStale: false,
      market: context?.mode,
      spotVenue: context?.spotVenue,
      status: 'MANUAL',
      contextKey,
    };

    // Store by both specific context key and generic clean symbol for reliable retrieval
    this.manualPrices.set(contextKey, entry);
    this.manualPrices.set(clean, entry);
    return entry;
  }

  async getPrice(symbol: string, context?: MarketContext): Promise<MarketPrice | null> {
    const contextKey = buildMarketContextKey(symbol, context);
    const clean = cleanSymbol(symbol);
    return this.manualPrices.get(contextKey) || this.manualPrices.get(clean) || null;
  }

  async getPrices(symbols: string[], context?: MarketContext): Promise<Record<string, MarketPrice>> {
    const result: Record<string, MarketPrice> = {};
    for (const sym of symbols) {
      const p = await this.getPrice(sym, context);
      if (p) {
        result[cleanSymbol(sym)] = p;
      }
    }
    return result;
  }
}

export const manualPriceProvider = new ManualPriceProvider();
