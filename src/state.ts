export type Ingredient = 'coffee' | 'sugar' | 'milk' | 'ice' | 'cups';
export type DrinkType = 'hot' | 'iced';
export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy';
export type Phase = 'buy' | 'street';

export const INGREDIENTS: Ingredient[] = ['coffee', 'sugar', 'milk', 'ice', 'cups'];

export const INGREDIENT_META: Record<Ingredient, { emoji: string; label: string }> = {
  coffee: { emoji: '☕', label: 'Coffee' },
  sugar: { emoji: '🍬', label: 'Sugar' },
  milk: { emoji: '🥛', label: 'Milk' },
  ice: { emoji: '🧊', label: 'Ice' },
  cups: { emoji: '🥤', label: 'Cups' },
};

// Price bands in cents (min, max)
export const PRICE_BANDS: Record<Ingredient, [number, number]> = {
  coffee: [30, 90],
  sugar: [5, 20],
  milk: [20, 60],
  ice: [3, 10],
  cups: [5, 15],
};

export interface Weather {
  tempC: number;
  condition: WeatherCondition;
}

export interface Recipe {
  id: string;
  name: string;
  type: DrinkType;
  doses: Partial<Record<Ingredient, number>>;
}

export interface TodayStats {
  sold: number;
  revenue: number;
  walkedBy: number;
  happyCount: number;
  grumpyCount: number;
  complaints: Record<string, number>;
  hypeStart: number;
}

export interface GameState {
  day: number;
  cash: number; // cents
  hype: number; // 0-100
  stock: Record<Ingredient, number>;
  activeRecipe: Recipe;
  activeRecipeSourceId: string | null; // library entry the active recipe was loaded from
  savedRecipes: Recipe[];
  prices: Record<Ingredient, number>;
  cupPrice: number; // cents
  weather: Weather;
  tomorrowWeather: Weather;
  phase: Phase;
  todayStats: TodayStats;
  muted: boolean;
}

let _idCounter = 0;
export function newId(): string {
  _idCounter++;
  return `r${Date.now().toString(36)}${_idCounter}`;
}

function midpoint([min, max]: [number, number]): number {
  return Math.round((min + max) / 2);
}

export function defaultRecipe(type: DrinkType = 'hot'): Recipe {
  const doses: Partial<Record<Ingredient, number>> = {
    coffee: 3,
    sugar: 2,
    milk: 2,
    cups: 1,
  };
  if (type === 'iced') doses.ice = 3;
  return { id: newId(), name: type === 'hot' ? 'Classic Hot' : 'Classic Iced', type, doses };
}

export function freshStats(hypeStart: number): TodayStats {
  return {
    sold: 0,
    revenue: 0,
    walkedBy: 0,
    happyCount: 0,
    grumpyCount: 0,
    complaints: {},
    hypeStart,
  };
}

export function initialState(): GameState {
  const startWeather: Weather = { tempC: 18, condition: 'sunny' };
  const startTomorrow: Weather = { tempC: 17, condition: 'cloudy' };
  const startRecipe = defaultRecipe('hot');
  return {
    day: 1,
    cash: 5000, // $50.00
    hype: 50,
    stock: { coffee: 20, sugar: 20, milk: 20, ice: 20, cups: 20 },
    activeRecipe: startRecipe,
    activeRecipeSourceId: null,
    savedRecipes: [],
    prices: {
      coffee: midpoint(PRICE_BANDS.coffee),
      sugar: midpoint(PRICE_BANDS.sugar),
      milk: midpoint(PRICE_BANDS.milk),
      ice: midpoint(PRICE_BANDS.ice),
      cups: midpoint(PRICE_BANDS.cups),
    },
    cupPrice: 300, // $3.00
    weather: startWeather,
    tomorrowWeather: startTomorrow,
    phase: 'buy',
    todayStats: freshStats(50),
    muted: false,
  };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const v = Math.abs(cents);
  return `${sign}$${(v / 100).toFixed(2)}`;
}
