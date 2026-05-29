import { Ingredient, PRICE_BANDS } from './state';

export type PriceLevel = 'very-low' | 'low' | 'mid' | 'high' | 'very-high';

export function nextPrice(prev: number, band: [number, number]): number {
  const [min, max] = band;
  const range = max - min;
  // Random walk: step is up to ~30% of range, biased toward mean reversion
  const mean = (min + max) / 2;
  const reversion = (mean - prev) * 0.1;
  const step = (Math.random() - 0.5) * range * 0.6 + reversion;
  return Math.max(min, Math.min(max, Math.round(prev + step)));
}

export function classifyPrice(price: number, band: [number, number]): PriceLevel {
  const [min, max] = band;
  const t = (price - min) / (max - min);
  if (t < 0.1) return 'very-low';
  if (t < 0.35) return 'low';
  if (t < 0.65) return 'mid';
  if (t < 0.9) return 'high';
  return 'very-high';
}

export function rollPrices(prev: Record<Ingredient, number>): Record<Ingredient, number> {
  const next: Record<Ingredient, number> = { ...prev };
  for (const k of Object.keys(PRICE_BANDS) as Ingredient[]) {
    next[k] = nextPrice(prev[k], PRICE_BANDS[k]);
  }
  return next;
}

// How many days of price history to keep for the sparkline.
export const PRICE_HISTORY_LEN = 5;

export function recordPrices(
  history: Record<Ingredient, number[]>,
  prices: Record<Ingredient, number>,
): Record<Ingredient, number[]> {
  const next = {} as Record<Ingredient, number[]>;
  for (const k of Object.keys(PRICE_BANDS) as Ingredient[]) {
    next[k] = [...(history[k] ?? []), prices[k]].slice(-PRICE_HISTORY_LEN);
  }
  return next;
}
