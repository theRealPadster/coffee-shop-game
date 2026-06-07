// Builds the weather chip markup for both phases. Collapsed it's a small pill
// (emoji + temp, plus the condition name in the roomier buy phase); expanded
// (see expandableChip.ts) it grows into a card hinting at today's effects.
//
// The card deliberately shows loose qualitative "vibe" hints rather than the raw
// numbers from weatherEffects, so the player still discovers the price ceiling
// and demand by feel. Each insight is computed with BOTH a vibe and a precise
// string up front, and the chip renders one based on a detail `tier`. Today the
// tier is always 'vibe'; a future "weather analytics" upgrade (see TODO) flips
// it to 'precise' to reveal the hard numbers.

import { GameState, Weather } from '../state';
import { weatherEmoji, weatherEffects } from '../weather';

export type WeatherChipVariant = 'buy' | 'street';
export type InsightTier = 'vibe' | 'precise';

interface Insight {
  label: string;
  vibe: string;
  precise: string;
}

function weatherInsights(w: Weather): Insight[] {
  const fx = weatherEffects(w);

  // Foot traffic — how many pedestrians show up (demandMul).
  let trafficVibe: string;
  if (fx.demandMul >= 1.2) trafficVibe = 'Busy';
  else if (fx.demandMul <= 0.6) trafficVibe = 'Dead';
  else if (fx.demandMul < 1) trafficVibe = 'Quiet';
  else trafficVibe = 'Steady';
  const trafficPct = Math.round((fx.demandMul - 1) * 100);
  const trafficPrecise = trafficPct === 0 ? 'normal' : trafficPct > 0 ? `+${trafficPct}%` : `${trafficPct}%`;

  // Crowd preference — what drink the weather makes them crave (hotDrinkAppeal,
  // -1 cold .. +1 hot). Vibe collapses to 3 buckets; precise keeps the 5 levels.
  const a = fx.hotDrinkAppeal;
  let craveVibe: string;
  if (a >= 0.25) craveVibe = 'Hot ☕';
  else if (a <= -0.25) craveVibe = 'Iced 🧊';
  else craveVibe = 'Either';
  let cravePrecise: string;
  if (a >= 0.7) cravePrecise = 'Strongly hot';
  else if (a >= 0.25) cravePrecise = 'Hot';
  else if (a > -0.25) cravePrecise = 'Either';
  else if (a > -0.7) cravePrecise = 'Iced';
  else cravePrecise = 'Strongly iced';

  return [
    { label: 'Foot traffic', vibe: trafficVibe, precise: trafficPrecise },
    { label: 'Crowd wants', vibe: craveVibe, precise: cravePrecise },
  ];
}

export function weatherChipHtml(
  state: GameState,
  variant: WeatherChipVariant,
  tier: InsightTier = 'vibe',
): string {
  const w = state.weather;

  const variantClass = variant === 'buy' ? ' weather-chip--buy' : '';
  // Buy phase has room for the condition name in the collapsed pill; street keeps
  // the pill minimal (the body shows the condition once expanded either way).
  const headCond = variant === 'buy' ? `<span class="cond">${w.condition}</span>` : '';

  const rows = weatherInsights(w)
    .map((r) => `<li><span>${r.label}</span><strong>${tier === 'precise' ? r.precise : r.vibe}</strong></li>`)
    .join('');

  return `
    <div class="weather-chip${variantClass}">
      <div class="weather-chip__head" data-expand-trigger title="Today's weather">
        <span class="wx-emoji">${weatherEmoji(w.condition)}</span>
        <span class="temp">${w.tempC}°C</span>
        ${headCond}
      </div>
      <div class="weather-chip__body">
        <div class="weather-chip__body-inner">
          <div class="weather-chip__cond">${w.condition}</div>
          <ul class="weather-fx">${rows}</ul>
        </div>
      </div>
    </div>
  `;
}
