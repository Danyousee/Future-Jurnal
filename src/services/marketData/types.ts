import { TradingMode, SpotVenue } from '../../types';

export type PriceStatusType = 'LIVE' | 'REFERENCE' | 'MANUAL' | 'STALE' | 'UNAVAILABLE';

export interface MarketPrice {
  symbol: string;         // Clean normalized symbol, e.g. 'BTCUSDT' or 'EURUSD'
  displaySymbol?: string;  // Formatted for UI, e.g. 'BTC/USDT' or 'EUR/USD'
  price: number;
  timestamp: number;
  source: string;          // e.g. 'Binance Spot', 'Binance Futures', 'ECB Reference Rate', 'Manual Price'
  isLive: boolean;         // true ONLY if fetched from actual continuous market provider
  isStale?: boolean;       // true if older than stale threshold (default 60s) or if network fetch failed
  market?: TradingMode;    // 'SPOT' | 'PERPETUAL' | 'FOREX'
  spotVenue?: SpotVenue;   // 'CEX' | 'DEX'
  status?: PriceStatusType;
  contextKey?: string;     // Unique context key e.g. 'SPOT:CEX:BTCUSDT'
  change24h?: number;
  high24h?: number;
  low24h?: number;
}

export interface MarketContext {
  mode?: TradingMode;
  spotVenue?: SpotVenue;
}

export interface MarketDataProvider {
  id: string;
  name: string;
  canHandle(symbol: string, context?: MarketContext): boolean;
  getPrice(symbol: string, context?: MarketContext): Promise<MarketPrice | null>;
  getPrices(symbols: string[], context?: MarketContext): Promise<Record<string, MarketPrice>>;
  isAvailable(): boolean;
  subscribeToPrice?(symbol: string, callback: (price: MarketPrice) => void, context?: MarketContext): () => void;
}

export type AutoRefreshInterval = 0 | 5 | 10 | 30 | 60; // 0 = off, seconds

export interface MarketPriceStatus {
  lastRefreshedAt: number | null;
  activeProviderName: string;
  isRefreshing: boolean;
  error: string | null;
  autoRefreshInterval: AutoRefreshInterval;
}
