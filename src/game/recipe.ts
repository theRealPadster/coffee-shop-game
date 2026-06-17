import { Recipe, Ingredient, GameState, activeRecipe } from '../state';

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
  const r = activeRecipe(state);
  if (maxCups(state.stock, r) <= 0) return false;
  for (const ing of recipeIngredients(r)) {
    state.stock[ing] -= r.doses[ing] ?? 0;
  }
  return true;
}
