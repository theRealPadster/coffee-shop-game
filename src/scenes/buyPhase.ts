import { computePosition, autoUpdate, offset, flip, shift, arrow, type VirtualElement } from '@floating-ui/dom';
import { GameState, INGREDIENTS, INGREDIENT_META, PRICE_BANDS, formatCents, Ingredient, DrinkType, activeRecipe, activeCupPrice } from '../state';
import { classifyPrice, PriceLevel, BULK_TIERS, bulkCost } from '../economy';
import { spoilageFraction, SPOILAGE } from '../spoilage';
import { maxCups, bottleneck } from '../recipe';
import { play } from '../audio';
import { appHeaderHtml, attachHeaderMenu } from '../header';
import { openPauseMenu } from '../pauseMenu';
import { weatherChipHtml } from '../chips/weatherChip';
import { hypeChipHtml } from '../chips/hypeChip';
import { makeExpandableChip } from '../chips/expandableChip';

export interface BuyPhaseCallbacks {
  onStartDay: () => void;
  onStateChange: () => void;
  onRestore: (state: GameState) => void;
  onQuitToTitle: () => void;
}

// Module-local UI state for the day-1 help tips. Kept out of GameState because
// it's transient screen state, not save-worthy:
//   - replayHints lets the floating "?" button reshow tips on a later day; it
//     resets when the player starts a day, so a replay is good for one buy phase.
//   - dismissedTips tracks which tip ids the player closed via the × button;
//     cleared at the same time so a fresh day-1 / replay starts clean.
let replayHints = false;
const dismissedTips = new Set<string>();
// Floating-UI autoUpdate cleanups for the currently-mounted tips. Cleared and
// rebuilt on every buy-phase render so detached anchors stop being watched.
let tipCleanups: Array<() => void> = [];

const LEVEL_LABEL: Record<PriceLevel, string> = {
  'very-low': 'bargain',
  'low': 'cheap',
  'mid': 'avg price',
  'high': 'pricey',
  'very-high': 'expensive',
};

const LEVEL_ARROW: Record<PriceLevel, string> = {
  'very-low': '▼▼',
  'low': '▼',
  'mid': '',
  'high': '▲',
  'very-high': '▲▲',
};

function priceChip(level: PriceLevel): string {
  const arrow = LEVEL_ARROW[level];
  const arrowHtml = arrow ? ` <span class="price-chip-arrow">${arrow}</span>` : '';
  return `<span class="price-chip ${level}">${LEVEL_LABEL[level]}${arrowHtml}</span>`;
}

/**
 * Small inline sparkline of the last few days of an ingredient's price,
 * normalized to its band. Stroke color reflects the most recent day's direction.
 */
function priceSparkline(history: number[], band: [number, number]): string {
  if (!history || history.length < 2) return '';
  const w = 52;
  const h = 16;
  const pad = 2;
  const [min, max] = band;
  const span = max - min || 1;
  const n = history.length;
  const points = history
    .map((v, i) => {
      const x = pad + (i / (n - 1)) * (w - pad * 2);
      const t = Math.max(0, Math.min(1, (v - min) / span));
      const y = h - pad - t * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const delta = history[n - 1] - history[n - 2];
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const title = `Last ${n} days: ${history.map(formatCents).join(' → ')}`;
  return `<svg class="price-spark ${dir}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><title>${title}</title><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" /></svg>`;
}

// Render a single help tip if hints are showing for this phase and the tip
// hasn't been dismissed. Returns an empty string otherwise so callers can
// unconditionally interpolate it into a template. Positioning (and the arrow)
// is handled by Floating UI after mount — see positionHelpTips().
function helpTip(id: string, text: string, showHints: boolean): string {
  if (!showHints || dismissedTips.has(id)) return '';
  return `<div class="help-tip" data-tip-id="${id}" role="note">${text}<button class="help-tip__close" aria-label="Dismiss tip" data-dismiss-tip="${id}">×</button><span class="help-tip__arrow"></span></div>`;
}

// Anchor each mounted tip to its target with Floating UI: the tip floats just
// below the control with the arrow pointing at it, flips/shifts to stay on
// screen, and repositions on resize/scroll/orientation via autoUpdate. The
// slider tip uses a virtual element pinned to the thumb's computed position so
// the arrow tracks the current dose value rather than the track center.
function positionHelpTips(root: HTMLElement): void {
  for (const fn of tipCleanups) fn();
  tipCleanups = [];

  const place = (tip: HTMLElement, reference: Element | VirtualElement): void => {
    const arrowEl = tip.querySelector<HTMLElement>('.help-tip__arrow');
    const cleanup = autoUpdate(reference, tip, () => {
      computePosition(reference, tip, {
        placement: 'bottom',
        middleware: [
          offset(8),
          flip({ fallbackPlacements: ['top'] }),
          shift({ padding: 8 }),
          ...(arrowEl ? [arrow({ element: arrowEl, padding: 8 })] : []),
        ],
      }).then(({ x, y, placement, middlewareData }) => {
        Object.assign(tip.style, { left: `${x}px`, top: `${y}px` });
        if (arrowEl && middlewareData.arrow) {
          const { x: ax } = middlewareData.arrow;
          // Arrow sits on whichever edge faces the reference.
          const onTop = placement.startsWith('bottom');
          Object.assign(arrowEl.style, {
            left: ax != null ? `${ax}px` : '',
            top: onTop ? '-5px' : '',
            bottom: onTop ? '' : '-5px',
          });
          arrowEl.classList.toggle('help-tip__arrow--down', !onTop);
        }
      });
    });
    tipCleanups.push(cleanup);
  };

  // tip-type → the Hot/Iced toggle.
  const typeTip = root.querySelector<HTMLElement>('[data-tip-id="tip-type"]');
  const toggle = root.querySelector<HTMLElement>('.type-toggle');
  if (typeTip && toggle) place(typeTip, toggle);

  // tip-dose → a virtual element at the thumb position of the slider in the
  // tip's own row (coffee), so the caret tracks the current dose.
  const doseTip = root.querySelector<HTMLElement>('[data-tip-id="tip-dose"]');
  const slider = doseTip?.closest('.ingredient-row')?.querySelector<HTMLInputElement>('input[type="range"][data-ing]');
  if (doseTip && slider) {
    const thumbRef: VirtualElement = {
      getBoundingClientRect() {
        const r = slider.getBoundingClientRect();
        const min = Number(slider.min) || 0;
        const max = Number(slider.max) || 100;
        const val = Number(slider.value) || 0;
        const pct = max > min ? (val - min) / (max - min) : 0;
        // Inset by ~half a thumb so the extremes don't overhang the track.
        const inset = 9;
        const cx = r.left + inset + pct * (r.width - inset * 2);
        return { width: 0, height: r.height, x: cx, y: r.top, left: cx, right: cx, top: r.top, bottom: r.bottom };
      },
    };
    place(doseTip, thumbRef);
  }

  // tip-price → the price cell in the tip's own row (sugar, so it doesn't
  // collide with the dose tip on the coffee row above).
  const priceTip = root.querySelector<HTMLElement>('[data-tip-id="tip-price"]');
  const priceCell = priceTip?.closest('.ingredient-row')?.querySelector<HTMLElement>('.price');
  if (priceTip && priceCell) place(priceTip, priceCell);
}

export function renderBuyPhase(root: HTMLElement, state: GameState, cb: BuyPhaseCallbacks): void {
  const r = activeRecipe(state);
  const bn = bottleneck(state.stock, r);
  const cups = maxCups(state.stock, r);
  const typeIcon = r.type === 'hot' ? '☕' : '🧊';
  // Hints auto-show on day 1; the floating "?" button flips replayHints to
  // bring them back on any later day for the current buy phase.
  const showHints = state.day === 1 || replayHints;

  root.innerHTML = `
    ${appHeaderHtml(state, { variant: 'buy' })}
    <div class="buy-phase">
      <div class="status-row status-row--buy">
        ${weatherChipHtml(state, 'buy')}
        ${hypeChipHtml(state.hype, 'buy')}
      </div>
      <div class="buy-content">
      <div class="panel shop-panel">
        <div class="serving-banner ${r.type}">
          <div class="serving-top">
            <div class="serving-label">Serving Today</div>
            <div class="type-toggle" role="group">
              <button data-type="hot" class="${r.type === 'hot' ? 'active' : ''}">Hot ☕</button>
              <button data-type="iced" class="${r.type === 'iced' ? 'active' : ''}">Iced 🧊</button>
            </div>
            ${helpTip('tip-type', "Hot and iced are separate recipes with separate prices — switch which you're serving today.", showHints)}
          </div>
          <div class="serving-main">
            <span class="serving-icon">${typeIcon}</span>
            <input id="recipe-name-input" type="text" value="${escapeAttr(r.name)}" />
          </div>
          <div class="serving-price-row">
            <label for="cup-price-input">Selling for</label>
            <div class="cup-price-input-wrap"><span>$</span><input id="cup-price-input" type="number" min="0" step="0.25" value="${(activeCupPrice(state) / 100).toFixed(2)}" /></div>
            <span class="serving-per-cup">per cup</span>
          </div>
        </div>

        <div class="shop-rows">
          ${INGREDIENTS.map((ing, idx) => shopRow(state, ing, r, bn, showHints && idx === 0, showHints && idx === 1)).join('')}
        </div>

        <div class="cups-producible">
          Cups producible today: <strong>${cups}</strong>
          ${bn ? `<div style="font-size:12px;font-weight:normal;margin-top:4px;">Bottleneck: ${INGREDIENT_META[bn].emoji} ${INGREDIENT_META[bn].label}</div>` : ''}
        </div>
      </div>

      <div class="day-footer">
        <button id="start-day-btn">Start Day ▶</button>
      </div>
      </div>
      <button class="help-fab" id="help-fab-btn" aria-label="Show tutorial hints" title="Show tutorial hints">?</button>
    </div>
  `;

  const weatherChip = root.querySelector<HTMLElement>('.weather-chip');
  if (weatherChip) makeExpandableChip(weatherChip);
  const hypeChip = root.querySelector<HTMLElement>('.hype-chip');
  if (hypeChip) makeExpandableChip(hypeChip);
  attachHeaderMenu(root, () => {
    void openPauseMenu({ state, onRestore: cb.onRestore, onQuitToTitle: cb.onQuitToTitle });
  });
  attachBuyPhaseEvents(root, state, cb);
  positionHelpTips(root);
}

function shopRow(state: GameState, ing: Ingredient, r: GameState['recipes']['hot'], bn: Ingredient | null, showDoseTip: boolean, showPriceTip: boolean): string {
  const meta = INGREDIENT_META[ing];
  const price = state.prices[ing];
  const level = classifyPrice(price, PRICE_BANDS[ing]);
  const stock = state.stock[ing];
  const isBn = bn === ing;
  const dose = r.doses[ing] ?? 0;

  // Perishables left over after today spoil/melt overnight at today's temperature.
  const spoilFrac = spoilageFraction(ing, state.weather);
  let spoilWarn = '';
  if (spoilFrac > 0) {
    const cfg = SPOILAGE[ing]!;
    const bare = cfg.verb.slice(0, -1); // "spoils" → "spoil", "melts" → "melt"
    const verbCap = cfg.verb.charAt(0).toUpperCase() + cfg.verb.slice(1); // "melts" → "Melts"
    const tooltip = `${meta.label} ${cfg.verb} above ${cfg.temp}°C. Today is ${state.weather.tempC}°C, so some of any unsold ${meta.label.toLowerCase()} will ${bare} overnight.`;
    spoilWarn = `<div class="spoil-warn" title="${escapeAttr(tooltip)}">⚠ ${verbCap} overnight</div>`;
  }

  let doseCell: string;
  if (ing === 'cups') {
    doseCell = `<span class="dose-static">1 per drink</span>`;
  } else {
    const applicable = ing !== 'ice' || r.type === 'iced';
    doseCell = `
      <input type="range" min="0" max="5" step="1" value="${dose}" data-ing="${ing}" ${applicable ? '' : 'disabled'} />
      <span class="dose-val" data-dose-val="${ing}">${dose}</span>
    `;
  }

  return `
    <div class="ingredient-row ${isBn ? 'bottleneck' : ''}" data-row="${ing}">
      <div class="row-top">
        <div class="name">${meta.emoji} ${meta.label}</div>
        ${doseCell}
        ${helpTip('tip-dose', 'Drag to set how much of this ingredient goes in each cup.', showDoseTip)}
      </div>
      <div class="row-bottom">
        <div class="stock"><strong>${stock}</strong> <span class="stock-unit">in stock</span></div>
        <div class="price"><strong>${formatCents(price)}</strong> <span class="price-unit">each</span> ${priceChip(level)}${priceSparkline(state.priceHistory[ing], PRICE_BANDS[ing])}</div>
        <div class="controls">
          ${BULK_TIERS.map(({ qty }) => `<button class="buy-btn" data-buy="${ing}" data-qty="${qty}" ${state.cash < bulkCost(price, qty) ? 'disabled' : ''}>Buy ${qty}</button>`).join('')}
          ${BULK_TIERS.map(({ qty }) => `<span class="buy-cost">${formatCents(bulkCost(price, qty))}</span>`).join('')}
        </div>
        ${helpTip('tip-price', "Today's market price plus the last few days — buy when it dips.", showPriceTip)}
      </div>
      ${spoilWarn}
    </div>
  `;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attachBuyPhaseEvents(root: HTMLElement, state: GameState, cb: BuyPhaseCallbacks): void {
  const rerender = () => {
    renderBuyPhase(root, state, cb);
  };

  // Recipe name — edits the currently active recipe
  const nameInput = root.querySelector<HTMLInputElement>('#recipe-name-input');
  nameInput?.addEventListener('change', () => {
    const cur = activeRecipe(state);
    state.recipes[state.activeType] = { ...cur, name: nameInput.value.trim() || 'Untitled' };
    cb.onStateChange();
    rerender();
  });

  // Type toggle — switches which recipe is being served / edited today
  root.querySelectorAll<HTMLButtonElement>('.type-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.type as DrinkType;
      if (state.activeType === t) return;
      state.activeType = t;
      cb.onStateChange();
      rerender();
    });
  });

  // Sliders — edit the currently active recipe's doses
  root.querySelectorAll<HTMLInputElement>('input[type="range"][data-ing]').forEach(slider => {
    slider.addEventListener('input', () => {
      const ing = slider.dataset.ing as Ingredient;
      const v = parseInt(slider.value, 10);
      const cur = activeRecipe(state);
      state.recipes[state.activeType] = { ...cur, doses: { ...cur.doses, [ing]: v } };
      const span = root.querySelector(`[data-dose-val="${ing}"]`);
      if (span) span.textContent = String(v);
      cb.onStateChange();
      // Update only cups-producible + bottleneck without full re-render for slider smoothness
      const updated = activeRecipe(state);
      const c = maxCups(state.stock, updated);
      const bn = bottleneck(state.stock, updated);
      const cupsDiv = root.querySelector('.cups-producible');
      if (cupsDiv) {
        cupsDiv.innerHTML = `
          Cups producible today: <strong>${c}</strong>
          ${bn ? `<div style="font-size:12px;font-weight:normal;margin-top:4px;">Bottleneck: ${INGREDIENT_META[bn].emoji} ${INGREDIENT_META[bn].label}</div>` : ''}
        `;
      }
      root.querySelectorAll('.ingredient-row').forEach(row => {
        const rIng = (row as HTMLElement).dataset.row as Ingredient;
        row.classList.toggle('bottleneck', bn === rIng);
      });
    });
    slider.addEventListener('change', () => rerender());
  });

  // Cup price
  const cpInput = root.querySelector<HTMLInputElement>('#cup-price-input');
  cpInput?.addEventListener('change', () => {
    const dollars = parseFloat(cpInput.value);
    if (!isNaN(dollars) && dollars >= 0) {
      state.cupPrices[state.activeType] = Math.round(dollars * 100);
      cb.onStateChange();
    }
  });

  // Buy/sell ingredient buttons
  root.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ing = btn.dataset.buy as Ingredient;
      const qty = parseInt(btn.dataset.qty || '0', 10);
      if (!attemptTrade(state, ing, qty)) return;
      cb.onStateChange();
      rerender();
      flashBuyFeedback(root, ing);
    });
  });

  // Start day
  root.querySelector('#start-day-btn')?.addEventListener('click', () => {
    if (maxCups(state.stock, activeRecipe(state)) <= 0) {
      if (!confirm("You can't brew any cups with your current recipe and stock. Start day anyway?")) return;
    }
    // Reset hint UI state so a fresh day-1 (new game) or a "?" replay later
    // starts with all tips visible again.
    replayHints = false;
    dismissedTips.clear();
    play('bell');
    cb.onStartDay();
  });

  // Help "?" floating button — bring all hint tips back for the current buy
  // phase, regardless of day. Cleared by Start Day so it's per-buy-phase only.
  root.querySelector<HTMLButtonElement>('#help-fab-btn')?.addEventListener('click', () => {
    replayHints = true;
    dismissedTips.clear();
    rerender();
  });

  // × on each tip — dismiss in place without a full rerender (so the surrounding
  // controls aren't reflowed). Remember the id so subsequent rerenders skip it.
  root.querySelectorAll<HTMLButtonElement>('[data-dismiss-tip]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.dismissTip;
      if (!id) return;
      dismissedTips.add(id);
      btn.closest('.help-tip')?.remove();
    });
  });
}

function attemptTrade(state: GameState, ing: Ingredient, qty: number): boolean {
  if (qty <= 0) return false;
  const price = state.prices[ing];
  const cost = bulkCost(price, qty);
  // No partial buys — you either afford the whole bundle or nothing happens
  // (the Buy buttons are disabled in this case, so this is also a guard).
  if (state.cash < cost) return false;
  state.cash -= cost;
  state.stock[ing] += qty;
  play('cashier');
  return true;
}

// Re-trigger the buy-flash animation on the row's stock count and the header
// cash counter. Called after a full rerender, so we're attaching the class to
// fresh DOM nodes. The reflow restart lets rapid clicks on the same row pulse
// each time instead of locking the animation mid-frame.
function flashBuyFeedback(root: HTMLElement, ing: Ingredient): void {
  const flash = (el: HTMLElement | null): void => {
    if (!el) return;
    el.classList.remove('buy-flash');
    void el.offsetWidth;
    el.classList.add('buy-flash');
  };
  flash(root.querySelector<HTMLElement>(`.ingredient-row[data-row="${ing}"] .stock`));
  flash(root.querySelector<HTMLElement>('#header-cash'));
}
