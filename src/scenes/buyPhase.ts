import { GameState, INGREDIENTS, INGREDIENT_META, PRICE_BANDS, formatCents, Ingredient, DrinkType, newId } from '../state';
import { classifyPrice, PriceLevel } from '../economy';
import { weatherEmoji } from '../weather';
import { maxCups, bottleneck, cloneRecipe, isActiveRecipeDirty, setRecipeType } from '../recipe';
import { saveGame, loadGame, clearSave } from '../save';
import { play } from '../audio';
import { appHeaderHtml, renderHypeMeter, attachHeaderMute } from '../header';

export interface BuyPhaseCallbacks {
  onStartDay: () => void;
  onStateChange: () => void;
  onRestore: (state: GameState) => void;
  onReset: () => void;
}

const CHEVRON_FOR_LEVEL: Record<PriceLevel, string> = {
  'very-high': '▲▲',
  'high': '▲',
  'mid': '▬',
  'low': '▼',
  'very-low': '▼▼',
};

function chevronEl(level: PriceLevel): string {
  const chars = CHEVRON_FOR_LEVEL[level];
  if (chars.length === 2) {
    return `<span class="chevron ${level}"><span>${chars[0]}</span><span>${chars[1]}</span></span>`;
  }
  return `<span class="chevron ${level}"><span>${chars}</span></span>`;
}

export function renderBuyPhase(root: HTMLElement, state: GameState, cb: BuyPhaseCallbacks): void {
  const dirty = isActiveRecipeDirty(state);
  const bn = bottleneck(state.stock, state.activeRecipe);
  const cups = maxCups(state.stock, state.activeRecipe);
  const r = state.activeRecipe;

  root.innerHTML = `
    ${appHeaderHtml(state)}
    <div class="buy-phase">
      <div class="panel shop-panel">
        <div class="recipe-header">
          <div class="recipe-name">
            <input id="recipe-name-input" type="text" value="${escapeAttr(r.name)}" />
          </div>
          ${dirty ? '<span class="dirty-indicator">unsaved</span>' : ''}
          <div class="type-toggle" role="group">
            <button data-type="hot" class="${r.type === 'hot' ? 'active' : ''}">Hot ☕</button>
            <button data-type="iced" class="${r.type === 'iced' ? 'active' : ''}">Iced 🧊</button>
          </div>
        </div>
        <div class="library-controls">
          <select id="library-select">
            <option value="">— Saved recipes —</option>
            ${state.savedRecipes.map(sr =>
              `<option value="${sr.id}" ${sr.id === state.activeRecipeSourceId ? 'selected' : ''}>${escapeAttr(sr.name)} (${sr.type})</option>`
            ).join('')}
          </select>
          <button id="new-recipe-btn" class="secondary">New</button>
          <button id="load-btn" class="secondary" ${state.savedRecipes.length === 0 ? 'disabled' : ''}>Load</button>
          <button id="save-recipe-btn" class="secondary" ${state.activeRecipeSourceId === null ? 'disabled' : ''}>Save</button>
          <button id="save-as-btn" class="secondary">Save As…</button>
          <button id="delete-btn" class="danger" ${state.activeRecipeSourceId === null ? 'disabled' : ''}>Delete</button>
        </div>

        <div class="shop-rows">
          ${INGREDIENTS.map(ing => shopRow(state, ing, r, bn)).join('')}
        </div>

        <div class="cup-price-row">
          <label>Cup price</label>
          <div class="cup-price-input-wrap"><span>$</span><input id="cup-price-input" type="number" min="0" step="0.25" value="${(state.cupPrice / 100).toFixed(2)}" /></div>
        </div>
        <div class="cups-producible">
          Cups producible today: <strong>${cups}</strong>
          ${bn ? `<div style="font-size:12px;font-weight:normal;margin-top:4px;">Bottleneck: ${INGREDIENT_META[bn].emoji} ${INGREDIENT_META[bn].label}</div>` : ''}
        </div>
      </div>

      <div class="panel today-panel">
        <h2>Today</h2>
        <div class="weather-widget ${state.weather.condition}">
          <span class="icon">${weatherEmoji(state.weather.condition)}</span>
          <div>
            <div class="temp">${state.weather.tempC}°C</div>
            <div class="cond">${state.weather.condition}</div>
          </div>
        </div>
        <div class="day-footer">
          <div class="save-controls">
            <button id="save-game-btn" class="secondary" title="Save game">💾 Save</button>
            <button id="restore-game-btn" class="secondary" title="Restore saved game">↩ Restore</button>
            <button id="reset-game-btn" class="danger" title="Reset to a new game">⟲ Reset</button>
          </div>
          <button id="start-day-btn">Start Day ▶</button>
        </div>
      </div>
    </div>
  `;

  const hypeHost = root.querySelector<HTMLElement>('#hype-meter-host');
  if (hypeHost) {
    renderHypeMeter(hypeHost, state.hype);
  }
  attachHeaderMute(root, state);
  attachBuyPhaseEvents(root, state, cb);
}

function shopRow(state: GameState, ing: Ingredient, r: GameState['activeRecipe'], bn: Ingredient | null): string {
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
        <div class="controls">
          <button class="secondary sell-btn" data-buy="${ing}" data-qty="-10">Sell 10</button>
          <button class="secondary sell-btn" data-buy="${ing}" data-qty="-1">Sell 1</button>
          <button class="buy-btn" data-buy="${ing}" data-qty="1">Buy 1</button>
          <button class="buy-btn" data-buy="${ing}" data-qty="10">Buy 10</button>
        </div>
        <div class="price"><strong>${formatCents(price)}</strong> <span class="price-unit">each</span> ${chevronEl(level)}</div>
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

  // Recipe name
  const nameInput = root.querySelector<HTMLInputElement>('#recipe-name-input');
  nameInput?.addEventListener('change', () => {
    state.activeRecipe = { ...state.activeRecipe, name: nameInput.value.trim() || 'Untitled' };
    cb.onStateChange();
    rerender();
  });

  // Type toggle
  root.querySelectorAll<HTMLButtonElement>('.type-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.type as DrinkType;
      state.activeRecipe = setRecipeType(state.activeRecipe, t);
      cb.onStateChange();
      rerender();
    });
  });

  // Sliders
  root.querySelectorAll<HTMLInputElement>('input[type="range"][data-ing]').forEach(slider => {
    slider.addEventListener('input', () => {
      const ing = slider.dataset.ing as Ingredient;
      const v = parseInt(slider.value, 10);
      state.activeRecipe = { ...state.activeRecipe, doses: { ...state.activeRecipe.doses, [ing]: v } };
      const span = root.querySelector(`[data-dose-val="${ing}"]`);
      if (span) span.textContent = String(v);
      cb.onStateChange();
      // Update only cups-producible + bottleneck without full re-render for slider smoothness
      const c = maxCups(state.stock, state.activeRecipe);
      const bn = bottleneck(state.stock, state.activeRecipe);
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

  // Library load
  const select = root.querySelector<HTMLSelectElement>('#library-select');
  root.querySelector('#load-btn')?.addEventListener('click', () => {
    const id = select?.value;
    if (!id) return;
    const src = state.savedRecipes.find(s => s.id === id);
    if (!src) return;
    state.activeRecipe = { ...src, id: newId(), doses: { ...src.doses } };
    state.activeRecipeSourceId = src.id;
    cb.onStateChange();
    rerender();
  });

  root.querySelector('#save-recipe-btn')?.addEventListener('click', () => {
    if (state.activeRecipeSourceId === null) return;
    const idx = state.savedRecipes.findIndex(s => s.id === state.activeRecipeSourceId);
    if (idx < 0) return;
    const updated = { ...state.activeRecipe, id: state.activeRecipeSourceId };
    state.savedRecipes = [...state.savedRecipes];
    state.savedRecipes[idx] = updated;
    cb.onStateChange();
    rerender();
  });

  root.querySelector('#save-as-btn')?.addEventListener('click', () => {
    const name = prompt('Name this recipe:', state.activeRecipe.name) || state.activeRecipe.name;
    const newSaved = cloneRecipe({ ...state.activeRecipe, name });
    state.savedRecipes = [...state.savedRecipes, newSaved];
    state.activeRecipeSourceId = newSaved.id;
    // Keep editing the active copy (different id), but match content
    state.activeRecipe = { ...state.activeRecipe, name };
    cb.onStateChange();
    rerender();
  });

  root.querySelector('#delete-btn')?.addEventListener('click', () => {
    if (state.activeRecipeSourceId === null) return;
    if (!confirm('Delete this saved recipe?')) return;
    state.savedRecipes = state.savedRecipes.filter(s => s.id !== state.activeRecipeSourceId);
    state.activeRecipeSourceId = null;
    cb.onStateChange();
    rerender();
  });

  root.querySelector('#new-recipe-btn')?.addEventListener('click', () => {
    state.activeRecipe = {
      id: newId(),
      name: 'Untitled',
      type: 'hot',
      doses: { coffee: 3, sugar: 2, milk: 2, cups: 1 },
    };
    state.activeRecipeSourceId = null;
    cb.onStateChange();
    rerender();
  });

  // Cup price
  const cpInput = root.querySelector<HTMLInputElement>('#cup-price-input');
  cpInput?.addEventListener('change', () => {
    const dollars = parseFloat(cpInput.value);
    if (!isNaN(dollars) && dollars >= 0) {
      state.cupPrice = Math.round(dollars * 100);
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

  // Save/Restore/Reset
  root.querySelector('#save-game-btn')?.addEventListener('click', () => {
    const ok = saveGame(state);
    play('cashier');
    alert(ok ? 'Game saved.' : 'Save failed.');
  });
  root.querySelector('#restore-game-btn')?.addEventListener('click', () => {
    const restored = loadGame();
    if (!restored) {
      alert('No saved game found.');
      return;
    }
    cb.onRestore(restored);
  });
  root.querySelector('#reset-game-btn')?.addEventListener('click', () => {
    if (!confirm('Reset your game? This cannot be undone.')) return;
    clearSave();
    cb.onReset();
  });

  // Start day
  root.querySelector('#start-day-btn')?.addEventListener('click', () => {
    if (maxCups(state.stock, state.activeRecipe) <= 0) {
      if (!confirm("You can't brew any cups with your current recipe and stock. Start day anyway?")) return;
    }
    play('bell');
    cb.onStartDay();
  });
}

function attemptTrade(state: GameState, ing: Ingredient, qty: number): void {
  if (qty === 0) return;
  const price = state.prices[ing];
  if (qty > 0) {
    const cost = price * qty;
    if (state.cash < cost) {
      const affordable = Math.floor(state.cash / price);
      if (affordable <= 0) return;
      state.cash -= price * affordable;
      state.stock[ing] += affordable;
      play('cashier');
    } else {
      state.cash -= cost;
      state.stock[ing] += qty;
      play('cashier');
    }
  } else {
    const sell = Math.min(-qty, state.stock[ing]);
    if (sell <= 0) return;
    // Sell back at 70% of current market price
    state.cash += Math.floor(price * sell * 0.7);
    state.stock[ing] -= sell;
    play('cashier');
  }
}
