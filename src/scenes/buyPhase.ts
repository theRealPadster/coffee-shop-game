import { GameState, INGREDIENTS, INGREDIENT_META, PRICE_BANDS, formatCents, Ingredient, DrinkType, activeRecipe, activeCupPrice } from '../state';
import { classifyPrice, PriceLevel } from '../economy';
import { weatherEmoji } from '../weather';
import { maxCups, bottleneck } from '../recipe';
import { play } from '../audio';
import { appHeaderHtml, renderHypeMeter, attachHeaderMenu } from '../header';
import { openPauseMenu } from '../pauseMenu';

export interface BuyPhaseCallbacks {
  onStartDay: () => void;
  onStateChange: () => void;
  onRestore: (state: GameState) => void;
  onReset: () => void;
}

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

export function renderBuyPhase(root: HTMLElement, state: GameState, cb: BuyPhaseCallbacks): void {
  const r = activeRecipe(state);
  const bn = bottleneck(state.stock, r);
  const cups = maxCups(state.stock, r);
  const typeIcon = r.type === 'hot' ? '☕' : '🧊';

  root.innerHTML = `
    ${appHeaderHtml(state, { variant: 'buy' })}
    <div class="buy-phase">
      <div class="weather-row">
        <div class="weather-chip weather-chip--buy">
          <span class="wx-emoji">${weatherEmoji(state.weather.condition)}</span>
          <span class="temp">${state.weather.tempC}°C</span>
          <span class="cond">${state.weather.condition}</span>
        </div>
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
          ${INGREDIENTS.map(ing => shopRow(state, ing, r, bn)).join('')}
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
    </div>
  `;

  const hypeHost = root.querySelector<HTMLElement>('#hype-meter-host');
  if (hypeHost) {
    renderHypeMeter(hypeHost, state.hype);
  }
  attachHeaderMenu(root, () => {
    void openPauseMenu({ state, onRestore: cb.onRestore, onReset: cb.onReset });
  });
  attachBuyPhaseEvents(root, state, cb);
}

function shopRow(state: GameState, ing: Ingredient, r: GameState['recipes']['hot'], bn: Ingredient | null): string {
  const meta = INGREDIENT_META[ing];
  const price = state.prices[ing];
  const level = classifyPrice(price, PRICE_BANDS[ing]);
  const stock = state.stock[ing];
  const isBn = bn === ing;
  const dose = r.doses[ing] ?? 0;

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
      </div>
      <div class="row-bottom">
        <div class="stock"><strong>${stock}</strong> <span class="stock-unit">in stock</span></div>
        <div class="price"><strong>${formatCents(price)}</strong> <span class="price-unit">each</span> ${priceChip(level)}${priceSparkline(state.priceHistory[ing], PRICE_BANDS[ing])}</div>
        <div class="controls">
          <button class="buy-btn" data-buy="${ing}" data-qty="5" ${state.cash < price * 5 ? 'disabled' : ''}>Buy 5</button>
          <button class="buy-btn" data-buy="${ing}" data-qty="10" ${state.cash < price * 10 ? 'disabled' : ''}>Buy 10</button>
          <button class="buy-btn" data-buy="${ing}" data-qty="20" ${state.cash < price * 20 ? 'disabled' : ''}>Buy 20</button>
          <span class="buy-cost">${formatCents(price * 5)}</span>
          <span class="buy-cost">${formatCents(price * 10)}</span>
          <span class="buy-cost">${formatCents(price * 20)}</span>
        </div>
      </div>
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
      attemptTrade(state, ing, qty);
      cb.onStateChange();
      rerender();
    });
  });

  // Start day
  root.querySelector('#start-day-btn')?.addEventListener('click', () => {
    if (maxCups(state.stock, activeRecipe(state)) <= 0) {
      if (!confirm("You can't brew any cups with your current recipe and stock. Start day anyway?")) return;
    }
    play('bell');
    cb.onStartDay();
  });
}

function attemptTrade(state: GameState, ing: Ingredient, qty: number): void {
  if (qty <= 0) return;
  const price = state.prices[ing];
  const cost = price * qty;
  if (state.cash < cost) {
    const affordable = Math.floor(state.cash / price);
    if (affordable <= 0) return;
    state.cash -= price * affordable;
    state.stock[ing] += affordable;
  } else {
    state.cash -= cost;
    state.stock[ing] += qty;
  }
  play('cashier');
}
