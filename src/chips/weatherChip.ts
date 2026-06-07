// Builds the weather chip markup for both phases. Collapsed it's a small pill
// (emoji + temp, plus the condition name in the roomier buy phase); expanded
// (see expandableChip.ts) it grows into a card explaining today's effects,
// derived from weatherEffects().

import { GameState, formatCents } from '../state';
import { weatherEmoji, weatherEffects } from '../weather';

export type WeatherChipVariant = 'buy' | 'street';

export function weatherChipHtml(state: GameState, variant: WeatherChipVariant): string {
  const w = state.weather;
  const fx = weatherEffects(w);

  const trafficPct = Math.round((fx.demandMul - 1) * 100);
  const traffic = trafficPct > 0 ? `+${trafficPct}%` : trafficPct < 0 ? `${trafficPct}%` : 'normal';

  let crowdWants: string;
  if (fx.hotDrinkAppeal >= 0.25) crowdWants = '☕ Hot';
  else if (fx.hotDrinkAppeal <= -0.25) crowdWants = '🧊 Iced';
  else crowdWants = 'Either';

  const variantClass = variant === 'buy' ? ' weather-chip--buy' : '';
  // Buy phase has room for the condition name in the collapsed pill; street keeps
  // the pill minimal (the body shows the condition once expanded either way).
  const headCond = variant === 'buy' ? `<span class="cond">${w.condition}</span>` : '';

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
          <ul class="weather-fx">
            <li><span>Foot traffic</span><strong>${traffic}</strong></li>
            <li><span>Crowd wants</span><strong>${crowdWants}</strong></li>
            <li><span>Spending</span><strong>${formatCents(fx.baseBudget)}</strong></li>
          </ul>
        </div>
      </div>
    </div>
  `;
}
