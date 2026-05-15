import { GameState, Ingredient, Recipe, initialState } from './state';

const KEY = 'coffee-shop-save';
const MAX_DOSE = 5;

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function clampDoses(r: Recipe): Recipe {
  const doses = { ...r.doses };
  for (const k of Object.keys(doses) as Ingredient[]) {
    if (k === 'cups') continue;
    const v = doses[k];
    if (typeof v === 'number' && v > MAX_DOSE) doses[k] = MAX_DOSE;
  }
  return { ...r, doses };
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    // Light validation: must have day and stock
    if (typeof parsed.day !== 'number' || !parsed.stock) return null;
    const merged = { ...initialState(), ...parsed } as GameState;
    merged.activeRecipe = clampDoses(merged.activeRecipe);
    merged.savedRecipes = merged.savedRecipes.map(clampDoses);
    return merged;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

const MUTE_KEY = 'coffee-shop-muted';

export function loadMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMute(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
}
