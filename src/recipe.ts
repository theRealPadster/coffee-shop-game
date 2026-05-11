import { Recipe, Ingredient, GameState, newId } from './state';

export function recipeIngredients(r: Recipe): Ingredient[] {
  return Object.keys(r.doses) as Ingredient[];
}

export function maxCups(stock: Record<Ingredient, number>, r: Recipe): number {
  let min = Infinity;
  for (const ing of recipeIngredients(r)) {
    const dose = r.doses[ing] ?? 0;
    if (dose <= 0) continue;
    const possible = Math.floor(stock[ing] / dose);
    if (possible < min) min = possible;
  }
  return min === Infinity ? 0 : min;
}

export function bottleneck(stock: Record<Ingredient, number>, r: Recipe): Ingredient | null {
  let min = Infinity;
  let result: Ingredient | null = null;
  for (const ing of recipeIngredients(r)) {
    const dose = r.doses[ing] ?? 0;
    if (dose <= 0) continue;
    const possible = stock[ing] / dose;
    if (possible < min) {
      min = possible;
      result = ing;
    }
  }
  return result;
}

export function consumeRecipe(state: GameState): boolean {
  const r = state.activeRecipe;
  if (maxCups(state.stock, r) <= 0) return false;
  for (const ing of recipeIngredients(r)) {
    state.stock[ing] -= r.doses[ing] ?? 0;
  }
  return true;
}

export function cloneRecipe(r: Recipe): Recipe {
  return { ...r, id: newId(), doses: { ...r.doses } };
}

export function recipesEqual(a: Recipe, b: Recipe): boolean {
  if (a.name !== b.name) return false;
  if (a.type !== b.type) return false;
  const ka = Object.keys(a.doses).sort();
  const kb = Object.keys(b.doses).sort();
  if (ka.join(',') !== kb.join(',')) return false;
  for (const k of ka) {
    if ((a.doses as any)[k] !== (b.doses as any)[k]) return false;
  }
  return true;
}

export function isActiveRecipeDirty(state: GameState): boolean {
  if (state.activeRecipeSourceId === null) return true;
  const src = state.savedRecipes.find((r) => r.id === state.activeRecipeSourceId);
  if (!src) return true;
  return !recipesEqual(state.activeRecipe, src);
}

export function setRecipeType(r: Recipe, type: Recipe['type']): Recipe {
  if (r.type === type) return r;
  const doses = { ...r.doses };
  if (type === 'hot') {
    delete doses.ice;
  } else {
    if (doses.ice === undefined) doses.ice = 5;
  }
  return { ...r, type, doses };
}
