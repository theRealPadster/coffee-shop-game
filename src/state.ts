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
  spoiled: Partial<Record<Ingredient, number>>; // perishables lost overnight, by ingredient
}

export interface GameState {
  day: number;
  cash: number; // cents
  hype: number; // 0 = neutral, positive = good buzz (capped at 100), negative = bad reputation (uncapped, meter bottoms out at -100)
  stock: Record<Ingredient, number>;
  recipes: { hot: Recipe; iced: Recipe };
  activeType: DrinkType;
  prices: Record<Ingredient, number>;
  priceHistory: Record<Ingredient, number[]>; // last few days of each ingredient's price (cents), oldest→newest
  cupPrices: { hot: number; iced: number }; // cents, per drink type
  weather: Weather;
  tomorrowWeather: Weather;
  phase: Phase;
  todayStats: TodayStats;
  muted: boolean;
}

export function activeRecipe(state: GameState): Recipe {
  return state.recipes[state.activeType];
}

export function activeCupPrice(state: GameState): number {
  return state.cupPrices[state.activeType];
}

function midpoint([min, max]: [number, number]): number {
  return Math.round((min + max) / 2);
}

export function defaultRecipes(): { hot: Recipe; iced: Recipe } {
  return {
    hot: { name: 'Classic Hot', type: 'hot', doses: { coffee: 3, sugar: 2, milk: 2, cups: 1 } },
    iced: { name: 'Classic Iced', type: 'iced', doses: { coffee: 3, sugar: 2, milk: 2, ice: 3, cups: 1 } },
  };
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
    spoiled: {},
  };
}

export function initialState(): GameState {
  const startWeather: Weather = { tempC: 18, condition: 'sunny' };
  const startTomorrow: Weather = { tempC: 17, condition: 'cloudy' };
  return {
    day: 1,
    cash: 5000, // $50.00
    hype: 0,
    stock: { coffee: 20, sugar: 20, milk: 20, ice: 20, cups: 20 },
    recipes: defaultRecipes(),
    activeType: 'hot',
    prices: {
      coffee: midpoint(PRICE_BANDS.coffee),
      sugar: midpoint(PRICE_BANDS.sugar),
      milk: midpoint(PRICE_BANDS.milk),
      ice: midpoint(PRICE_BANDS.ice),
      cups: midpoint(PRICE_BANDS.cups),
    },
    priceHistory: {
      coffee: [midpoint(PRICE_BANDS.coffee)],
      sugar: [midpoint(PRICE_BANDS.sugar)],
      milk: [midpoint(PRICE_BANDS.milk)],
      ice: [midpoint(PRICE_BANDS.ice)],
      cups: [midpoint(PRICE_BANDS.cups)],
    },
    cupPrices: { hot: 300, iced: 300 }, // $3.00 each
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
