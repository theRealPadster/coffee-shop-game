import { GameState, DrinkType } from './state';
import { weatherEffects } from './weather';
import { hypePriceTolerance, hypeStopMultiplier } from './hype';
import { maxCups } from './recipe';
import { randomPedestrianSprite, Sprite } from './render';

export type CustomerPhase = 'walking' | 'queuing' | 'considering' | 'buying' | 'leaving';

export interface Customer {
  id: number;
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  phase: CustomerPhase;
  // Preferences
  wants: DrinkType;
  budget: number; // cents
  sweetPref: number;
  strengthPref: number;
  milkPref: number;
  icePref: number;
  flexibility: number;
  willStop: boolean;
  // Queue
  queueSlot: number | null; // index into scene queue array, null if not queued
  // Animation state
  considerUntil: number; // ms timestamp when consideration ends
  thought: string | null;
  thoughtUntil: number;
  decided: boolean;
  hasBought: boolean;
}

let nextId = 1;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickWants(hotAppeal: number): DrinkType {
  // Map hotAppeal [-1, 1] → probability of wanting hot [0.1, 0.9]
  const pHot = 0.5 + hotAppeal * 0.4;
  return Math.random() < pHot ? 'hot' : 'iced';
}

export function spawnCustomer(state: GameState, _canvasWidth: number, canvasHeight: number): Customer {
  const eff = weatherEffects(state.weather);
  const wants = pickWants(eff.hotDrinkAppeal);
  const stopBase = Math.min(1, 0.65 * hypeStopMultiplier(state.hype));
  const baseBudget = eff.baseBudget + hypePriceTolerance(state.hype);
  return {
    id: nextId++,
    sprite: randomPedestrianSprite(),
    x: -40,
    y: canvasHeight * 0.72,
    vx: rand(90, 140),
    phase: 'walking',
    wants,
    budget: Math.round(baseBudget + rand(-80, 120)),
    sweetPref: Math.round(rand(1, 5)),
    strengthPref: Math.round(rand(2, 5)),
    milkPref: Math.round(rand(1, 4)),
    icePref: Math.round(rand(2, 5)),
    flexibility: rand(0.1, 0.7),
    willStop: Math.random() < stopBase,
    queueSlot: null,
    considerUntil: 0,
    thought: null,
    thoughtUntil: 0,
    decided: false,
    hasBought: false,
  };
}

export interface DecisionResult {
  buy: boolean;
  thought: string;
  hypeDelta: number;
  complaintKey: string; // for the report card
  isHappy: boolean;
}

export function decide(state: GameState, c: Customer): DecisionResult {
  const r = state.activeRecipe;
  const eff = weatherEffects(state.weather);
  const cupsLeft = maxCups(state.stock, r);

  if (cupsLeft <= 0) {
    return {
      buy: false,
      thought: 'Sold out 🚫',
      hypeDelta: -2,
      complaintKey: 'Sold out',
      isHappy: false,
    };
  }

  const priceFit = c.budget - state.cupPrice; // positive = affordable
  const sugarDose = r.doses.sugar ?? 0;
  const coffeeDose = r.doses.coffee ?? 0;
  const milkDose = r.doses.milk ?? 0;
  const iceDose = r.doses.ice ?? 0;

  const sugarMiss = Math.abs(sugarDose - c.sweetPref);
  const coffeeMiss = Math.abs(coffeeDose - c.strengthPref);
  const milkMiss = Math.abs(milkDose - c.milkPref);
  const iceMiss = r.type === 'iced' ? Math.abs(iceDose - c.icePref) : 0;

  const recipeFit = -(sugarMiss + coffeeMiss + milkMiss + iceMiss);

  let typeFit = 0;
  if (r.type !== c.wants) {
    typeFit = -4 * (1 - c.flexibility);
  }

  // Weather alignment with served drink (separate from typeFit)
  const wantsHot = c.wants === 'hot';
  const drinkIsHot = r.type === 'hot';
  let weatherFit = 0;
  if (drinkIsHot && eff.hotDrinkAppeal > 0.3) weatherFit = 1.5;
  if (!drinkIsHot && eff.hotDrinkAppeal < -0.3) weatherFit = 1.5;
  if (drinkIsHot && eff.hotDrinkAppeal < -0.3) weatherFit = -1.5;
  if (!drinkIsHot && eff.hotDrinkAppeal > 0.5 && wantsHot) weatherFit = -1;

  const priceFitScore = priceFit >= 0 ? Math.min(2, priceFit / 100) : Math.max(-6, priceFit / 50);
  // baseInterest: a customer who stopped is already curious — give them a nudge toward buying.
  const baseInterest = 1.5;
  const totalScore = baseInterest + priceFitScore + recipeFit * 0.5 + typeFit + weatherFit;

  const buy = totalScore > 0;

  // Determine dominant factor for thought
  const negatives: Array<[number, string, string, number]> = [];
  if (priceFit < 0) negatives.push([Math.abs(priceFitScore), 'Too expensive 💸', 'Too expensive', -1]);
  if (typeFit < -1) {
    const t = wantsHot ? 'Wanted a hot one ☕🙅' : 'Wanted an iced today 🧊🙅';
    negatives.push([Math.abs(typeFit), t, 'Wrong drink type', -1]);
  }
  if (coffeeMiss >= 2 && coffeeDose < c.strengthPref) {
    negatives.push([coffeeMiss, 'Watery ☕💧', 'Too watery', -1]);
  }
  if (coffeeMiss >= 2 && coffeeDose > c.strengthPref) {
    negatives.push([coffeeMiss, 'Way too strong 😵', 'Too strong', -1]);
  }
  if (sugarMiss >= 2 && sugarDose > c.sweetPref) {
    negatives.push([sugarMiss, 'Too sweet 😬', 'Too sweet', -1]);
  }
  if (sugarMiss >= 2 && sugarDose < c.sweetPref) {
    negatives.push([sugarMiss, 'Not sweet enough 😕', 'Not sweet enough', 0]);
  }
  if (milkMiss >= 2) {
    negatives.push([milkMiss, 'Milk balance is off 🥛', 'Milk balance', 0]);
  }
  if (r.type === 'iced' && iceMiss >= 2 && iceDose < c.icePref) {
    negatives.push([iceMiss, "Where's the ice? 🧊", 'Not enough ice', -1]);
  }
  if (r.type === 'iced' && iceMiss >= 2 && iceDose > c.icePref) {
    negatives.push([iceMiss, 'Too icy 🧊', 'Too icy', -1]);
  }
  if (weatherFit < -0.5) {
    negatives.push([Math.abs(weatherFit), drinkIsHot ? 'Too hot for hot coffee 🥵' : "Brrr, no iced today 🥶", 'Wrong for weather', 0]);
  }

  if (buy) {
    let thought = 'Good value! ✨';
    let hype = 1;
    if (weatherFit > 0.5) { thought = 'Hits the spot ☂️'; hype = 1; }
    if (totalScore > 4) { thought = 'Best coffee in town! 🤩'; hype = 2; }
    return { buy: true, thought, hypeDelta: hype, complaintKey: '', isHappy: true };
  }

  // Non-buyer: they haven't tasted the coffee, so they can only react to things
  // they can observe — price, drink type, and weather suitability.
  // Recipe quality ("watery", "too sweet", etc.) requires tasting; those only
  // belong to customers who actually bought. We still apply hype impact from the
  // strongest reason, but only log and show observable complaints.
  negatives.sort((a, b) => b[0] - a[0]);
  const hypeDelta = negatives[0]?.[3] ?? 0;

  const recipeQualityKeys = new Set(['Too watery', 'Too strong', 'Too sweet', 'Not sweet enough', 'Milk balance', 'Not enough ice', 'Too icy']);
  const bestObservable = negatives.find(n => !recipeQualityKeys.has(n[2]));

  const thought = bestObservable ? bestObservable[1]
    : negatives.length > 0 ? 'Hmm, not today 🤔'
    : 'Just browsing 🚶';

  // complaintKey drives the report card — only log observable reasons here too.
  const complaintKey = bestObservable?.[2] ?? '';

  return { buy: false, thought, hypeDelta, complaintKey, isHappy: false };
}

export function spawnRate(state: GameState): number {
  // Returns spawns per second
  const eff = weatherEffects(state.weather);
  return 0.6 * eff.demandMul * hypeStopMultiplier(state.hype);
}
