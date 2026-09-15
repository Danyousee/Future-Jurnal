/**
 * Canonical Forwarding Layer
 * Consolidates into the single source of truth in cryptoProvider.ts
 * Preserves full backward compatibility without duplicate network calls.
 */
export {
  CryptoMarketDataProvider,
  CryptoMarketDataProvider as PublicCryptoProvider,
  cryptoMarketDataProvider,
  cryptoMarketDataProvider as publicCryptoProvider
} from './cryptoProvider';
