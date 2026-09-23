import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketPrice, AutoRefreshInterval, MarketContext } from './types';
import { marketDataService } from './marketDataService';
import { cleanSymbol } from './symbolNormalizer';

export interface UseMarketPricesResult {
  prices: Record<string, MarketPrice>;
  isRefreshing: boolean;
  lastRefreshedAt: number | null;
  refreshPrices: () => Promise<void>;
  setManualPrice: (symbol: string, price: number, context?: MarketContext) => void;
  autoRefreshInterval: AutoRefreshInterval;
  setAutoRefreshInterval: (interval: AutoRefreshInterval) => void;
  statusMessage: string;
  liveCount: number;
  manualCount: number;
}

export function useMarketPrices(
  symbols: string[],
  initialInterval: AutoRefreshInterval = 10,
  context?: MarketContext
): UseMarketPricesResult {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>(() => marketDataService.getAllCachedPrices());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<AutoRefreshInterval>(initialInterval);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const symbolsRef = useRef<string[]>(symbols);
  symbolsRef.current = symbols;

  const contextRef = useRef<MarketContext | undefined>(context);
  contextRef.current = context;

  // Listen for global market data updates
  useEffect(() => {
    const unsubscribe = marketDataService.subscribeAll((updated) => {
      setPrices(updated);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const refreshPrices = useCallback(async () => {
    const syms = symbolsRef.current;
    if (!syms || syms.length === 0) return;

    setIsRefreshing(true);
    try {
      const fetched = await marketDataService.getPrices(syms, {
        allowCache: false,
        context: contextRef.current,
      });

      setPrices(marketDataService.getAllCachedPrices());
      setLastRefreshedAt(Date.now());

      const fetchedValues = Object.values(fetched);
      const live = fetchedValues.filter(p => p.isLive && p.status !== 'REFERENCE').length;
      const reference = fetchedValues.filter(p => p.status === 'REFERENCE').length;
      const manual = fetchedValues.filter(p => !p.isLive && p.status !== 'REFERENCE').length;

      if (live > 0 && reference > 0) {
        setStatusMessage(`Updated ${live} live price${live > 1 ? 's' : ''}, ${reference} ECB reference rate${reference > 1 ? 's' : ''}`);
      } else if (live > 0) {
        setStatusMessage(`Updated ${live} live market price${live > 1 ? 's' : ''}`);
      } else if (reference > 0) {
        setStatusMessage(`Updated ${reference} institutional reference rate${reference > 1 ? 's' : ''}`);
      } else if (manual > 0) {
        setStatusMessage('Manual prices active — live feed unavailable for selected symbols');
      } else {
        setStatusMessage('Prices updated');
      }
    } catch {
      setStatusMessage('Network interruption — utilizing cached & manual prices');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch when symbol set changes
  const serializedSymbols = symbols.map(s => cleanSymbol(s)).sort().join(',');
  useEffect(() => {
    if (serializedSymbols.length > 0) {
      refreshPrices();
    }
  }, [serializedSymbols, refreshPrices]);

  // Auto-refresh timer with proper cleanup
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const timer = window.setInterval(() => {
      refreshPrices();
    }, autoRefreshInterval * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefreshInterval, refreshPrices]);

  const setManualPrice = useCallback((symbol: string, price: number, ctx?: MarketContext) => {
    marketDataService.setManualPrice(symbol, price, ctx || contextRef.current);
    setPrices(marketDataService.getAllCachedPrices());
    setLastRefreshedAt(Date.now());
  }, []);

  const priceValues: MarketPrice[] = Object.values(prices);
  const liveCount = priceValues.filter(p => p.isLive && !p.isStale).length;
  const manualCount = priceValues.filter(p => !p.isLive).length;

  return {
    prices,
    isRefreshing,
    lastRefreshedAt,
    refreshPrices,
    setManualPrice,
    autoRefreshInterval,
    setAutoRefreshInterval,
    statusMessage,
    liveCount,
    manualCount,
  };
}
