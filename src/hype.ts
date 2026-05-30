import { GameState } from './state';

export function clampHype(h: number): number {
  // Good buzz caps at 100; bad reputation is uncapped on the downside
  // (the meter just bottoms out visually at -100).
  return Math.min(100, h);
}

export function applyHype(state: GameState, delta: number): void {
  state.hype = clampHype(state.hype + delta);
}

export function decayHype(state: GameState): void {
  // Reputation drifts back toward neutral (0) over time, from either direction.
  if (state.hype > 0) state.hype = Math.max(0, state.hype - 2);
  else if (state.hype < 0) state.hype = Math.min(0, state.hype + 2);
}

export function hypeStopMultiplier(hype: number): number {
  // 1.0 at neutral (0), 1.5 at +100, 0.5 at -100. Floored so a terrible
  // reputation still leaves a trickle of curious passersby (and never zeroes
  // out the spawn rate).
  return Math.max(0.1, 1 + hype / 200);
}

export function hypePriceTolerance(hype: number): number {
  // Cents added to a customer's budget. 0 at neutral, +50 at +100, floored at
  // -50 so a deeply negative reputation can't drive budgets absurdly low.
  return Math.max(-50, Math.round(hype / 2));
}
