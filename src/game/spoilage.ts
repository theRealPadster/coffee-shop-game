import { GameState, Ingredient, Weather } from '../state';
import { hasUpgrade } from './upgrades';

interface SpoilConfig {
  /** Above this temperature (°C) the perishable starts to degrade overnight. */
  temp: number;
  /** Fraction of leftover stock lost per °C above the threshold (clamped to 1). */
  ratePerDeg: number;
  /** Verb for UI copy ("milk spoils", "ice melts"). */
  verb: string;
}

// Ice melts at a much lower threshold than milk spoils — a cool day already
// costs you ice, while milk only turns when it's genuinely hot. The Refrigerator
// upgrade negates these entirely (see applySpoilage / the buy-phase + weather
// chip warnings, all gated on hasUpgrade(state, 'refrigerator')).
export const SPOILAGE: Partial<Record<Ingredient, SpoilConfig>> = {
  milk: { temp: 24, ratePerDeg: 0.1, verb: 'spoils' },
  ice: { temp: 4, ratePerDeg: 0.05, verb: 'melts' },
};

/** Fraction (0–1) of a leftover ingredient lost overnight given the day's weather. */
export function spoilageFraction(ingredient: Ingredient, weather: Weather): number {
  const cfg = SPOILAGE[ingredient];
  if (!cfg) return 0;
  const over = weather.tempC - cfg.temp;
  return over <= 0 ? 0 : Math.min(1, over * cfg.ratePerDeg);
}

/**
 * Apply overnight spoilage to leftover perishables, keyed off the day that just
 * ended (`state.weather`). Mutates `state.stock` and returns the per-ingredient
 * amounts lost so the report card can surface them.
 */
export function applySpoilage(state: GameState): Partial<Record<Ingredient, number>> {
  // Refrigerator keeps everything fresh overnight — nothing is lost.
  if (hasUpgrade(state, 'refrigerator')) return {};
  const lost: Partial<Record<Ingredient, number>> = {};
  for (const ingredient of Object.keys(SPOILAGE) as Ingredient[]) {
    const frac = spoilageFraction(ingredient, state.weather);
    if (frac <= 0) continue;
    const n = Math.round(state.stock[ingredient] * frac);
    if (n <= 0) continue;
    state.stock[ingredient] -= n;
    lost[ingredient] = n;
  }
  return lost;
}
