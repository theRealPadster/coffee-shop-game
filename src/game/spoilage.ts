import { GameState, Ingredient, Weather } from '../state';
import { hasUpgrade } from './upgrades';

// Spoilage is tiered by what cooling equipment the player owns. Each tier sets
// its own temperature threshold and per-degree loss rate; the refrigerator tier
// uses ratePerDeg: 0 so nothing is ever lost (kept temp value just for the UI's
// "spoils above N°C" tooltip — even though it's never reached). This keeps the
// config uniform and data-driven, so tuning a tier is a number change.
export type SpoilageTier = 'none' | 'cooler' | 'refrigerator';

interface TierConfig {
  /** Above this temperature (°C) the perishable starts to degrade overnight. */
  temp: number;
  /** Fraction of leftover stock lost per °C above the threshold (clamped to 1). */
  ratePerDeg: number;
}

interface SpoilConfig {
  tiers: Record<SpoilageTier, TierConfig>;
  /** Verb for UI copy ("milk spoils", "ice melts"). */
  verb: string;
}

// Ice melts at a much lower threshold than milk spoils — a cool day already
// costs you ice without upgrades, while milk only turns when it's warmer. The
// 'cooler' tier matches the values that originally shipped before the tiered
// model; 'none' is harsher to make the cooler a meaningful purchase, and
// 'refrigerator' negates spoilage via ratePerDeg: 0.
export const SPOILAGE: Partial<Record<Ingredient, SpoilConfig>> = {
  milk: {
    tiers: {
      none:         { temp: 18, ratePerDeg: 0.20 },
      cooler:       { temp: 24, ratePerDeg: 0.10 },
      refrigerator: { temp: 24, ratePerDeg: 0    },
    },
    verb: 'spoils',
  },
  ice: {
    tiers: {
      none:         { temp: 0, ratePerDeg: 0.10 },
      cooler:       { temp: 4, ratePerDeg: 0.05 },
      refrigerator: { temp: 4, ratePerDeg: 0    },
    },
    verb: 'melts',
  },
};

/** Which spoilage tier is currently active for this save's owned upgrades. */
export function currentSpoilageTier(state: GameState): SpoilageTier {
  if (hasUpgrade(state, 'refrigerator')) return 'refrigerator';
  if (hasUpgrade(state, 'cooler')) return 'cooler';
  return 'none';
}

/** Fraction (0–1) of a leftover ingredient lost overnight given the day's weather and tier. */
export function spoilageFraction(ingredient: Ingredient, weather: Weather, tier: SpoilageTier): number {
  const cfg = SPOILAGE[ingredient]?.tiers[tier];
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
  const tier = currentSpoilageTier(state);
  const lost: Partial<Record<Ingredient, number>> = {};
  for (const ingredient of Object.keys(SPOILAGE) as Ingredient[]) {
    const frac = spoilageFraction(ingredient, state.weather, tier);
    if (frac <= 0) continue;
    const n = Math.round(state.stock[ingredient] * frac);
    if (n <= 0) continue;
    state.stock[ingredient] -= n;
    lost[ingredient] = n;
  }
  return lost;
}
