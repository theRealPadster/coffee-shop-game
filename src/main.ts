import './style.css';
import { GameState, initialState } from './state';
import { renderBuyPhase } from './scenes/buyPhase';
import { renderStreetPhase } from './scenes/streetPhase';
import { rollPrices } from './economy';
import { generateForecast } from './weather';
import { decayHype } from './hype';

let state: GameState = initialState();
const root = document.getElementById('app')!;
let streetTeardown: (() => void) | null = null;

function noop(): void { /* placeholder for state-change hook */ }

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
      onRestore: (restored) => {
        state = restored;
        renderCurrent();
      },
      onReset: () => {
        state = initialState();
        renderCurrent();
      },
    });
  } else {
    streetTeardown = renderStreetPhase(root, state, {
      onStateChange: noop,
      onCloseShop: () => {
        // Advance to next day: new prices, new weather, hype decay
        state.day += 1;
        state.prices = rollPrices(state.prices);
        state.weather = state.tomorrowWeather;
        state.tomorrowWeather = generateForecast(state.weather);
        decayHype(state);
        state.phase = 'buy';
        renderCurrent();
      },
    });
  }
}

// Pre-roll one day of forecast so day 1 already has a "tomorrow" set in initialState.
// Initial state already provides one; no extra work needed.
renderCurrent();
