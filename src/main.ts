// driver.css must load before style.css so our tutorial theme overrides in
// style.css win on source order (driver.js ships hard-coded colors via the
// same single-class selectors we use to retheme it).
import 'driver.js/dist/driver.css';
import './themes/themes.css';
import './style.css';
import { GameState, initialState } from './state';
import { renderBuyPhase } from './scenes/buyPhase';
import { renderStreetPhase } from './scenes/streetPhase';
import { renderTitleScreen } from './scenes/titleScreen';
import { rollPrices, recordPrices } from './game/economy';
import { generateForecast } from './game/weather';
import { decayHype } from './game/hype';
import { loadAndApplyTheme } from './themes/themes';
import { clearSave } from './platform/save';
import { openPauseMenu } from './ui/pauseMenu';
import { getMenuOpener } from './ui/menuOpener';
import { initOrientationPrompt } from './ui/orientationPrompt';

// Top-level screen routing. The title screen is OUTSIDE the game (no
// gameplay state matters there); 'game' delegates to the existing
// phase-based routing on state.phase.
type Screen = 'title' | 'game';

let screen: Screen = 'title';
let state: GameState = initialState();
const root = document.getElementById('app')!;
let activeTeardown: (() => void) | null = null;

// Android back-gesture handling. While 'game' is on screen we keep one
// sentinel history entry on the stack. A back press pops it; the popstate
// handler immediately re-pushes it and either dismisses the topmost modal
// (via a synthetic Esc, which all modals already handle) or opens the pause
// menu. popInternal lets quitToTitle() pop the sentinel without re-entering
// the handler.
let popInternal = false;

function pushGameSentinel(): void {
  history.pushState({ gameSentinel: true }, '');
}

function popGameSentinel(): void {
  popInternal = true;
  history.back();
}

function noop(): void { /* placeholder for state-change hook */ }

function enterGame(): void {
  screen = 'game';
  pushGameSentinel();
  renderCurrent();
}

function quitToTitle(): void {
  screen = 'title';
  popGameSentinel();
  renderCurrent();
}

function onRestore(restored: GameState): void {
  // Restore is only invoked from the in-game pause menu, so the sentinel
  // is already on the stack — no history change needed.
  state = restored;
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
        enterGame();
      },
      onNewGame: () => {
        // Wipe the saved game too — title-screen "New Game" is now a true
        // reset (the confirm wording says so). This keeps the model simple:
        // Continue = old save, New Game = fresh start, with no orphan save
        // sitting around to confuse Restore in the middle of the new game.
        clearSave();
        state = initialState();
        enterGame();
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
      onQuitToTitle: quitToTitle,
    });
  } else {
    activeTeardown = renderStreetPhase(root, state, {
      onStateChange: noop,
      onRestore,
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
  void openPauseMenu({ state, onRestore, onQuitToTitle: quitToTitle });
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

// Android back gesture / browser back button. Mirrors the Esc behavior:
// in-game with no modal → open pause menu; in-game with a modal → close
// the modal; on title → don't intercept (browser handles it, typically
// exiting the tab/PWA). See the popInternal comment near pushGameSentinel
// for the quit-to-title flow.
window.addEventListener('popstate', () => {
  if (popInternal) {
    popInternal = false;
    return;
  }
  if (screen !== 'game') return;

  // The back press just consumed the sentinel; re-arm it so the *next*
  // back press still routes through us.
  pushGameSentinel();

  if (document.querySelector('.modal-backdrop')) {
    // Reuse each modal's existing Esc handler so close logic stays in one
    // place (the pause menu's quit/save flows, confirmModal cancellation,
    // etc. all happen as if the user hit Esc).
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return;
  }

  const opener = getMenuOpener() ?? defaultOpenMenu;
  opener();
});

loadAndApplyTheme();
initOrientationPrompt();
renderCurrent();
