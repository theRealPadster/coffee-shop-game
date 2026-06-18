// Persistent between-days upgrades. Each upgrade is a one-time purchase made
// from the buy phase that flips a single lever elsewhere in the game logic.
//
// This module is the catalog + ownership/purchase helpers — the single source
// of truth for what exists and what it costs. The *effect* of each upgrade
// lives wherever that lever is (e.g. the Refrigerator is honoured in
// game/spoilage.ts), gated by hasUpgrade(). Adding an upgrade = add its id to
// UpgradeId (state.ts), an entry here, and the effect at its lever.

import { GameState, UpgradeId } from '../state';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  emoji: string;
  cost: number; // cents
  blurb: string; // one-line description of the effect
}

// Order here is the display order in the buy phase.
export const UPGRADES: Record<UpgradeId, Upgrade> = {
  refrigerator: {
    id: 'refrigerator',
    name: 'Refrigerator',
    emoji: '❄️',
    cost: 4000, // $40.00 — a few good days' profit; not affordable on day 1
    blurb: 'Keeps milk and ice fresh overnight — no spoilage, even on hot days.',
  },
};

export const UPGRADE_LIST: Upgrade[] = Object.values(UPGRADES);

export function hasUpgrade(state: GameState, id: UpgradeId): boolean {
  return !!state.upgrades?.[id];
}

export function canAffordUpgrade(state: GameState, id: UpgradeId): boolean {
  return state.cash >= UPGRADES[id].cost;
}

/**
 * Purchase an upgrade: deduct the cost and mark it owned. No-op (returns false)
 * if already owned or unaffordable — callers can rely on the buttons being
 * disabled, so this is also a guard.
 */
export function buyUpgrade(state: GameState, id: UpgradeId): boolean {
  if (hasUpgrade(state, id)) return false;
  const up = UPGRADES[id];
  if (state.cash < up.cost) return false;
  state.cash -= up.cost;
  if (!state.upgrades) state.upgrades = {};
  state.upgrades[id] = true;
  return true;
}
