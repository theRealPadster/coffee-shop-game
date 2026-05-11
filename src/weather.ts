import { Weather, WeatherCondition } from './state';

const CONDITION_EMOJI: Record<WeatherCondition, string> = {
  sunny: '🌞',
  cloudy: '☁️',
  rainy: '🌧️',
  snowy: '❄️',
};

export function weatherEmoji(c: WeatherCondition): string {
  return CONDITION_EMOJI[c];
}

const TRANSITIONS: Record<WeatherCondition, Array<[WeatherCondition, number]>> = {
  sunny:  [['sunny', 0.55], ['cloudy', 0.35], ['rainy', 0.08], ['snowy', 0.02]],
  cloudy: [['cloudy', 0.4], ['sunny', 0.3], ['rainy', 0.25], ['snowy', 0.05]],
  rainy:  [['rainy', 0.4], ['cloudy', 0.45], ['sunny', 0.1], ['snowy', 0.05]],
  snowy:  [['snowy', 0.5], ['cloudy', 0.35], ['rainy', 0.1], ['sunny', 0.05]],
};

function pickFrom<T>(weighted: Array<[T, number]>): T {
  const r = Math.random();
  let acc = 0;
  for (const [v, w] of weighted) {
    acc += w;
    if (r < acc) return v;
  }
  return weighted[weighted.length - 1][0];
}

export function generateForecast(prev: Weather): Weather {
  const condition = pickFrom(TRANSITIONS[prev.condition]);
  // Temperature random walks ±3, bounded by condition typical range
  const step = Math.round((Math.random() - 0.5) * 6);
  let tempC = prev.tempC + step;
  // Condition pulls temperature toward its typical range
  const typical: Record<WeatherCondition, [number, number]> = {
    sunny: [18, 32],
    cloudy: [10, 22],
    rainy: [5, 18],
    snowy: [-8, 2],
  };
  const [lo, hi] = typical[condition];
  if (tempC < lo) tempC = lo + Math.floor(Math.random() * 3);
  if (tempC > hi) tempC = hi - Math.floor(Math.random() * 3);
  return { condition, tempC };
}

export interface WeatherEffects {
  demandMul: number; // pedestrian spawn rate multiplier
  hotDrinkAppeal: number; // -1 (cold drink demand) ... +1 (hot drink demand)
  baseBudget: number; // base cents customers are willing to spend
}

export function weatherEffects(w: Weather): WeatherEffects {
  // Hot weather: more cold-drink craving, hot coffee penalized.
  // Cold/rainy: hot drinks shine.
  const t = w.tempC;
  let hotDrinkAppeal: number;
  if (t >= 25) hotDrinkAppeal = -0.8;
  else if (t >= 18) hotDrinkAppeal = -0.2;
  else if (t >= 10) hotDrinkAppeal = 0.3;
  else if (t >= 0) hotDrinkAppeal = 0.7;
  else hotDrinkAppeal = 1.0;

  // Rainy adds to "want a hot drink"
  if (w.condition === 'rainy') hotDrinkAppeal = Math.min(1, hotDrinkAppeal + 0.3);
  if (w.condition === 'snowy') hotDrinkAppeal = 1;
  if (w.condition === 'sunny' && t >= 22) hotDrinkAppeal = Math.max(-1, hotDrinkAppeal - 0.2);

  // Demand: nice weather → more foot traffic, snowy → less
  let demandMul = 1;
  if (w.condition === 'sunny') demandMul *= 1.2;
  if (w.condition === 'rainy') demandMul *= 0.8;
  if (w.condition === 'snowy') demandMul *= 0.6;

  // Budget loosely scales with comfort and condition
  let baseBudget = 350; // cents
  if (w.condition === 'rainy') baseBudget += 30;
  if (w.condition === 'snowy') baseBudget -= 40;

  return { demandMul, hotDrinkAppeal, baseBudget };
}
