/**
 * Precision formatting utilities for currency, crypto micro-tokens, pips, and metrics.
 */

export function formatPrice(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '0.00';
  const abs = Math.abs(value);

  if (abs >= 1000) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (abs >= 1) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  }
  if (abs >= 0.01) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  }

  // Micro-value crypto / DEX memecoins (e.g. 0.000012345)
  const fixedStr = value.toFixed(10);
  const trimmed = fixedStr.replace(/(\.\d{4,}?[1-9])0+$/, '$1');
  return trimmed;
}

export function formatCurrency(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '$0.00';
  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
    return '$' + formatPrice(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(value: number, minDecimals: number = 2, maxDecimals: number = 4): string {
  if (isNaN(value)) return '0.00';
  if (value === 0) return '0.00';
  const abs = Math.abs(value);
  if (abs < 0.01) {
    return formatPrice(value);
  }
  if (abs < 1) {
    return value.toFixed(4);
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function formatPercent(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0.00%';
  return `${value >= 0 ? '' : ''}${value.toFixed(decimals)}%`;
}

export function formatRMultiple(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) return '0.00R';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}R`;
}

export function formatPips(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null || isNaN(value)) return '0.0';
  return `${value.toFixed(decimals)} pips`;
}
