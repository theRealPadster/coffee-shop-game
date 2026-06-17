import { GameState, Ingredient, Recipe, initialState, defaultRecipes } from '../state';

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
    const parsed = JSON.parse(raw) as Partial<GameState> & {
      activeRecipe?: Recipe;
      savedRecipes?: Recipe[];
      activeRecipeSourceId?: string | null;
    };
    if (typeof parsed.day !== 'number' || !parsed.stock) return null;

    const base = initialState();
    const merged = { ...base, ...parsed } as GameState;

    // Migrate from the old single-activeRecipe + library shape if present.
    if (!merged.recipes || !merged.activeType) {
      const fallback = defaultRecipes();
      const old = parsed.activeRecipe;
      if (old && (old.type === 'hot' || old.type === 'iced')) {
        merged.recipes = {
          hot: old.type === 'hot' ? old : fallback.hot,
          iced: old.type === 'iced' ? old : fallback.iced,
        };
        merged.activeType = old.type;
      } else {
        merged.recipes = fallback;
        merged.activeType = 'hot';
      }
    }

    merged.recipes = {
      hot: clampDoses(merged.recipes.hot),
      iced: clampDoses(merged.recipes.iced),
    };

    // Strip orphan fields from the old shape so they don't linger on resave.
    delete (merged as Partial<GameState> & { activeRecipe?: unknown }).activeRecipe;
    delete (merged as Partial<GameState> & { activeRecipeSourceId?: unknown }).activeRecipeSourceId;
    delete (merged as Partial<GameState> & { savedRecipes?: unknown }).savedRecipes;

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
