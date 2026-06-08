import './style.css';
import { GameState, initialState } from './state';
import { renderBuyPhase } from './scenes/buyPhase';
import { renderStreetPhase } from './scenes/streetPhase';
import { rollPrices, recordPrices } from './economy';
import { generateForecast } from './weather';
import { decayHype } from './hype';
import { loadAndApplyTheme } from './themes';
import { openPauseMenu } from './pauseMenu';
import { getMenuOpener } from './menuOpener';
import { initOrientationPrompt } from './orientationPrompt';

let state: GameState = initialState();
const root = document.getElementById('app')!;
let streetTeardown: (() => void) | null = null;

function noop(): void { /* placeholder for state-change hook */ }

function onRestore(restored: GameState): void {
  state = restored;
  renderCurrent();
}
function onReset(): void {
  state = initialState();
  renderCurrent();
}

function renderCurrent(): void {
  if (streetTeardown) {
    streetTeardown();
    streetTeardown = null;
  }
  if (state.phase === 'buy') {
    renderBuyPhase(root, state, {
      onStartDay: () => {
        state.phase = 'street';
        renderCurrent();
      },
      onStateChange: noop,
      onRestore,
      onReset,
    });
  } else {
    streetTeardown = renderStreetPhase(root, state, {
      onStateChange: noop,
      onRestore,
      onReset,
      onCloseShop: () => {
        // Advance to next day: new prices, new weather, hype decay
        state.day += 1;
        state.prices = rollPrices(state.prices);
        state.priceHistory = recordPrices(state.priceHistory, state.prices);
        state.weather = state.tomorrowWeather;
        state.tomorrowWeather = generateForecast(state.weather);
        decayHype(state);
        state.phase = 'buy';
        renderCurrent();
      },
    });
  }
}

function defaultOpenMenu(): void {
  void openPauseMenu({ state, onRestore, onReset });
}

// Global Escape opens the pause menu. If a modal is already on screen it owns
// the Esc key itself (closes itself), so the guard prevents stacking menus.
// Scenes can register their own opener (e.g. the street phase wraps it with
// clock pause/resume) via setMenuOpener.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.querySelector('.modal-backdrop')) return;
  const opener = getMenuOpener() ?? defaultOpenMenu;
  opener();
});

loadAndApplyTheme();
initOrientationPrompt();
renderCurrent();
