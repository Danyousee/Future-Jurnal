import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketPrice, MarketContext, PriceStatusType } from './types';
import { marketDataService } from './marketDataService';
import { cleanSymbol } from './symbolNormalizer';

export interface UseMarketPriceResult {
  price: MarketPrice | null;
  currentPrice: number;
  isLive: boolean;
  isStale: boolean;
  status: PriceStatusType;
  source: string;
  timestamp: number | null;
  isRefreshing: boolean;
  refresh: () => Promise<MarketPrice | null>;
  setManualPrice: (price: number) => void;
}

/**
 * Hook to retrieve and subscribe to live market price for an individual symbol.
 * Automatically manages listener subscriptions and cleans up on unmount.
 */
export function useMarketPrice(
  symbol: string,
  context?: MarketContext
): UseMarketPriceResult {
  const clean = cleanSymbol(symbol);
  const contextRef = useRef(context);
  contextRef.current = context;

  const [price, setPrice] = useState<MarketPrice | null>(() => {
    return clean ? marketDataService.getCachedPrice(clean, context) || null : null;
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (!clean) {
      setPrice(null);
      return;
    }

    // Subscribe to updates for this symbol
    const unsubscribe = marketDataService.subscribe(clean, (updated) => {
      setPrice(updated);
    }, contextRef.current);

    return () => {
      unsubscribe();
    };
  }, [clean, context?.mode, context?.spotVenue]);

  const refresh = useCallback(async (): Promise<MarketPrice | null> => {
    if (!clean) return null;
    setIsRefreshing(true);
    try {
      const fetched = await marketDataService.getPrice(clean, { 
        allowCache: false, 
        context: contextRef.current 
      });
      if (fetched) {
        setPrice(fetched);
      }
      return fetched;
    } finally {
      setIsRefreshing(false);
    }
  }, [clean]);

  const setManualPrice = useCallback((newPrice: number) => {
    if (!clean) return;
    const updated = marketDataService.setManualPrice(clean, newPrice, contextRef.current);
    setPrice(updated);
  }, [clean]);

  const currentPrice = price?.price && price.price > 0 ? price.price : 0;
  const isLive = price?.isLive ?? false;
  const isStale = price?.isStale ?? false;
  const status: PriceStatusType = price 
    ? (price.status || (isLive ? (isStale ? 'STALE' : 'LIVE') : 'MANUAL'))
    : 'UNAVAILABLE';
  const source = price?.source || (isLive ? 'Live Feed' : 'Manual');
  const timestamp = price?.timestamp || null;

  return {
    price,
    currentPrice,
    isLive,
    isStale,
    status,
    source,
    timestamp,
    isRefreshing,
    refresh,
    setManualPrice,
  };
}
