import { GameState } from './state';

export function clampHype(h: number): number {
  return Math.max(0, Math.min(100, h));
}

export function applyHype(state: GameState, delta: number): void {
  state.hype = clampHype(state.hype + delta);
}

export function decayHype(state: GameState): void {
  state.hype = clampHype(state.hype - 2);
}

export function hypeStopMultiplier(hype: number): number {
  return 0.5 + hype / 100; // range [0.5, 1.5]
}

export function hypePriceTolerance(hype: number): number {
  // Cents added to a customer's budget. -50 at hype 0, +50 at hype 100.
  return Math.round((hype - 50));
}
