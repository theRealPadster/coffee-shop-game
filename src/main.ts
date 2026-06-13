import './style.css';
import { GameState, initialState } from './state';
import { renderBuyPhase } from './scenes/buyPhase';
import { renderStreetPhase } from './scenes/streetPhase';
import { renderTitleScreen } from './scenes/titleScreen';
import { rollPrices, recordPrices } from './economy';
import { generateForecast } from './weather';
import { decayHype } from './hype';
import { loadAndApplyTheme } from './themes';
import { openPauseMenu } from './pauseMenu';
import { getMenuOpener } from './menuOpener';
import { initOrientationPrompt } from './orientationPrompt';

// Top-level screen routing. The title screen is OUTSIDE the game (no
// gameplay state matters there); 'game' delegates to the existing
// phase-based routing on state.phase.
type Screen = 'title' | 'game';

let screen: Screen = 'title';
let state: GameState = initialState();
const root = document.getElementById('app')!;
let activeTeardown: (() => void) | null = null;

function noop(): void { /* placeholder for state-change hook */ }

function quitToTitle(): void {
  screen = 'title';
  renderCurrent();
}

function onRestore(restored: GameState): void {
  state = restored;
  screen = 'game';
  renderCurrent();
}
function onReset(): void {
  state = initialState();
  screen = 'game';
  renderCurrent();
}

function renderCurrent(): void {
  if (activeTeardown) {
    activeTeardown();
    activeTeardown = null;
  }

  if (screen === 'title') {
    activeTeardown = renderTitleScreen(root, {
      onContinue: (restored) => {
        state = restored;
        screen = 'game';
        renderCurrent();
      },
      onNewGame: () => {
        state = initialState();
        screen = 'game';
        renderCurrent();
      },
    });
    return;
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
      onQuitToTitle: quitToTitle,
    });
  } else {
    activeTeardown = renderStreetPhase(root, state, {
      onStateChange: noop,
      onRestore,
      onReset,
      onQuitToTitle: quitToTitle,
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
  void openPauseMenu({ state, onRestore, onReset, onQuitToTitle: quitToTitle });
}

// Global Escape opens the pause menu — but only when we're actually in the
// game. On the title screen there's nothing to pause and the menu would have
// no useful state to act on, so Esc is a no-op there (modals on top of the
// title still own their own Esc handling).
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (screen !== 'game') return;
  if (document.querySelector('.modal-backdrop')) return;
  const opener = getMenuOpener() ?? defaultOpenMenu;
  opener();
});

loadAndApplyTheme();
initOrientationPrompt();
renderCurrent();
