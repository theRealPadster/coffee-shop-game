// The hype chip: collapsed it's the live buzz meter (label + value + bar);
// expanded (see expandableChip.ts) it grows into a card with a reputation band
// and a "drawing them in" hint.
//
// Unlike the weather chip, hype changes every frame during the street phase, so
// this splits into a one-time build (hypeChipHtml) and an in-place update
// (updateHypeChip) that touches only the dynamic bits — never re-rendering the
// whole element, which would wipe the expandable wiring and force it shut.
//
// Bands and the effect bucket are purely cosmetic labels (no gameplay effect),
// so their ranges are free to tune. The effect honours the shared insight tier:
// 'vibe' shows Strong/Steady/Weak, 'precise' (a future upgrade) shows the raw
// stop-rate multiplier.

import { hypeStopMultiplier } from '../../game/hype';

export type HypeChipVariant = 'buy' | 'street';
export type InsightTier = 'vibe' | 'precise';

function reputationBand(hype: number): string {
  if (hype >= 80) return 'Local legend ✨';
  if (hype >= 60) return 'Talk of the town';
  if (hype >= 30) return 'Building buzz';
  if (hype >= 10) return 'Catching on';
  if (hype >= -9) return 'Just another stand';
  if (hype >= -39) return "Reputation's slipping";
  if (hype >= -59) return 'Getting a bad name';
  if (hype >= -79) return 'Steer clear';
  return 'Run out of town';
}

function drawingThemIn(hype: number, tier: InsightTier): string {
  if (tier === 'precise') return `×${hypeStopMultiplier(hype).toFixed(2)}`;
  if (hype >= 25) return 'Strong';
  if (hype <= -25) return 'Weak';
  return 'Steady';
}

// Bar fill: grows from the centre — positive fills right (good), negative fills
// left (bad). Clamped to the [-100, 100] visual range.
function fillStyle(hype: number): string {
  const display = Math.max(-100, Math.min(100, hype));
  const half = Math.abs(display) / 2;
  return display >= 0
    ? `left:50%; width:${half}%; background:var(--good);`
    : `right:50%; width:${half}%; background:var(--bad);`;
}

export function hypeChipHtml(hype: number, variant: HypeChipVariant, tier: InsightTier = 'vibe'): string {
  const variantClass = variant === 'buy' ? ' hype-chip--buy' : '';
  return `
    <div class="hype-chip${variantClass}" data-hype="${hype}">
      <div class="hype-chip__head" data-expand-trigger title="Your shop's buzz">
        <div class="label"><span>Hype</span><span class="hype-value">${Math.round(hype)}</span></div>
        <div class="bar"><div class="fill" style="${fillStyle(hype)}"></div></div>
      </div>
      <div class="hype-chip__body">
        <div class="hype-chip__body-inner">
          <div class="hype-chip__band">${reputationBand(hype)}</div>
          <ul class="hype-fx">
            <li><span>Drawing them in</span><strong>${drawingThemIn(hype, tier)}</strong></li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Updates the dynamic bits in place. Cheap and a no-op when hype is unchanged,
// so it's safe to call every frame.
export function updateHypeChip(el: HTMLElement, hype: number, tier: InsightTier = 'vibe'): void {
  const prev = el.dataset.hype ? Number(el.dataset.hype) : null;
  if (prev === hype) return;
  el.dataset.hype = String(hype);

  const valueEl = el.querySelector<HTMLElement>('.hype-value');
  if (valueEl) valueEl.textContent = String(Math.round(hype));
  const fillEl = el.querySelector<HTMLElement>('.fill');
  if (fillEl) fillEl.style.cssText = fillStyle(hype);
  const bandEl = el.querySelector<HTMLElement>('.hype-chip__band');
  if (bandEl) bandEl.textContent = reputationBand(hype);
  const fxEl = el.querySelector<HTMLElement>('.hype-fx strong');
  if (fxEl) fxEl.textContent = drawingThemIn(hype, tier);

  // Re-trigger the pulse animation when the value actually moves.
  if (prev !== null && Math.abs(hype - prev) >= 1) {
    el.classList.remove('pulse');
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add('pulse');
  }
}
