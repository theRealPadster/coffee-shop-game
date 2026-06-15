import { GameState, DrinkType, activeRecipe, activeCupPrice } from './state';
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
  // Taste reaction (praise OR gripe) voiced only after buying, as they walk off —
  // you can't judge the recipe until you've sipped it. Both happy and unhappy
  // buyers defer to this beat so the two read consistently.
  postSaleReaction: string | null;
  postSaleHype: number; // taste-reaction hype delta, applied when postSaleReaction is voiced
  remarked: boolean; // whether this passerby has already had a chance to badmouth the shop
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
    y: canvasHeight * 0.68,
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
    postSaleReaction: null,
    postSaleHype: 0,
    remarked: false,
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
  const r = activeRecipe(state);
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

  const priceFit = c.budget - activeCupPrice(state); // positive = affordable
  const sugarDose = r.doses.sugar ?? 0;
  const coffeeDose = r.doses.coffee ?? 0;
  const milkDose = r.doses.milk ?? 0;
  const iceDose = r.doses.ice ?? 0;

  const sugarMiss = Math.abs(sugarDose - c.sweetPref);
  const coffeeMiss = Math.abs(coffeeDose - c.strengthPref);
  const milkMiss = Math.abs(milkDose - c.milkPref);
  const iceMiss = r.type === 'iced' ? Math.abs(iceDose - c.icePref) : 0;

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

  // The purchase decision is based ONLY on what a passerby can judge before buying:
  // the price, the drink type on offer, and how well it suits the weather. Recipe
  // quality (strength, sweetness, milk, ice) can't be known until they taste it, so
  // it does NOT affect whether they buy — only how they feel afterward.
  const buyScore = baseInterest + priceFitScore + typeFit + weatherFit;
  const buy = buyScore > 0;

  // Observable objections — the only reasons a non-buyer can cite. The fourth
  // tuple entry is the hype delta; the first is the priority used to pick the
  // dominant complaint when several apply.
  //
  // Hype rule: only complaints the player can act on cost hype.
  //  - "Too expensive" → player sets cup price, so −1.
  //  - "Wrong for weather" → player chose the wrong drink for the day, so −1.
  //  - "Wrong drink type" → just an individual coin-flip preference (some folks
  //    want hot, some want iced); the player can't influence that, so 0.
  //
  // When weather actively disagrees with the served drink the weather thought
  // wins the tie-break over the generic wrong-type thought — otherwise low
  // flexibility would let typeFit (magnitude up to 3.6) drown out weatherFit
  // (max 1.5), masking the only actionable signal.
  const observable: Array<[number, string, string, number]> = [];
  if (priceFit < 0) observable.push([Math.abs(priceFitScore), 'Too expensive 💸', 'Too expensive', -1]);
  if (typeFit < -1) {
    const t = wantsHot ? 'Wanted a hot one ☕🙅' : 'Wanted an iced today 🧊🙅';
    observable.push([Math.abs(typeFit), t, 'Wrong drink type', 0]);
  }
  if (weatherFit < -0.5) {
    observable.push([Math.abs(weatherFit) + 10, drinkIsHot ? 'Too hot for hot coffee 🥵' : "Brrr, no iced today 🥶", 'Wrong for weather', -1]);
  }

  if (!buy) {
    observable.sort((a, b) => b[0] - a[0]);
    const top = observable[0];
    return {
      buy: false,
      thought: top ? top[1] : 'Maybe another time 🚶',
      hypeDelta: top ? top[3] : 0,
      complaintKey: top ? top[2] : '',
      isHappy: false,
    };
  }

  // They bought — now they taste it. Recipe mismatches become specific complaints
  // and drag hype down; a well-matched drink earns praise and lifts hype.

  // An empty cup (nothing whatsoever in it) reads as a rip-off, not a taste miss.
  if (coffeeDose === 0 && sugarDose === 0 && milkDose === 0 && iceDose === 0) {
    return { buy: true, thought: 'This is just an empty cup?! 🤬', hypeDelta: -3, complaintKey: 'Empty cup (scam!)', isHappy: false };
  }

  const recipeComplaints: Array<[number, string, string]> = [];
  if (coffeeMiss >= 2 && coffeeDose < c.strengthPref) recipeComplaints.push([coffeeMiss, 'Too weak ☕😕', 'Too weak']);
  if (coffeeMiss >= 2 && coffeeDose > c.strengthPref) recipeComplaints.push([coffeeMiss, 'Way too strong 😵', 'Too strong']);
  if (sugarMiss >= 2 && sugarDose > c.sweetPref) recipeComplaints.push([sugarMiss, 'Too sweet 😬', 'Too sweet']);
  if (sugarMiss >= 2 && sugarDose < c.sweetPref) recipeComplaints.push([sugarMiss, 'Not sweet enough 😕', 'Not sweet enough']);
  if (milkMiss >= 2) recipeComplaints.push([milkMiss, 'Milk balance is off 🥛', 'Milk balance']);
  if (r.type === 'iced' && iceMiss >= 2 && iceDose < c.icePref) recipeComplaints.push([iceMiss, "Where's the ice? 🧊", 'Not enough ice']);
  if (r.type === 'iced' && iceMiss >= 2 && iceDose > c.icePref) recipeComplaints.push([iceMiss, 'Too icy 🧊', 'Too icy']);

  if (recipeComplaints.length > 0) {
    recipeComplaints.sort((a, b) => b[0] - a[0]);
    const [miss, thought, complaintKey] = recipeComplaints[0];
    // Bigger miss → unhappier customer → bigger hit to hype.
    const hypeDelta = miss >= 4 ? -2 : -1;
    return { buy: true, thought, hypeDelta, complaintKey, isHappy: false };
  }

  // Bought and satisfied — reaction scales with how well the drink landed. A
  // clean cup (no complaint at all) is worth +2 to hype, a dialed-in one ("best
  // in town") +3. These are a touch generous on purpose: a fixed recipe always
  // disappoints some slice of the preference spread, so the +2 floor lets a
  // genuinely good shop build a reputation at a satisfying pace instead of
  // crawling. The unhappy side stays −1/−2, which puts the break-even around a
  // third of buyers happy (vs half before).
  const totalMiss = sugarMiss + coffeeMiss + milkMiss + iceMiss;
  let thought = 'Good value! ✨';
  let hype = 2;
  if (weatherFit > 0.5) thought = 'Hits the spot ☂️';
  // A strong reputation is itself part of the draw — happy buyers often credit the buzz,
  // and the praise gets louder the better the reputation.
  const repRemark = goodRepRemark(state.hype);
  if (repRemark && Math.random() < 0.6) thought = repRemark;
  if (totalMiss <= 1 && buyScore > 3) { thought = 'Best coffee in town! 🤩'; hype = 3; }
  return { buy: true, thought, hypeDelta: hype, complaintKey: '', isHappy: true };
}

// Positive reputation remarks, tiered by how strong the buzz is (checked high→low).
const GOOD_REP_TIERS: Array<{ min: number; remarks: string[] }> = [
  { min: 90, remarks: ['Best in the whole city! 👑', 'A legend — had to come 🌟', 'The hype is 100% real! 🤩'] },
  { min: 80, remarks: ['Everyone raves about this spot 😍', 'Heard this place is incredible ✨', 'The buzz is unreal 🔥'] },
  { min: 40, remarks: ['Heard good things ✨', 'So glad I finally stopped by 💛', 'Worth checking out ⭐'] },
];

// Returns a praise line matching the reputation tier, or null below the lowest tier.
function goodRepRemark(hype: number): string | null {
  for (const tier of GOOD_REP_TIERS) {
    if (hype >= tier.min) return tier.remarks[Math.floor(Math.random() * tier.remarks.length)];
  }
  return null;
}

export function spawnRate(state: GameState): number {
  // Returns spawns per second
  const eff = weatherEffects(state.weather);
  return 0.6 * eff.demandMul * hypeStopMultiplier(state.hype);
}

// Negative reputation remarks, tiered by how bad it's gotten (checked worst→least-bad).
const BAD_REP_TIERS: Array<{ max: number; remarks: string[] }> = [
  { max: -90, remarks: ['Avoid this place at all costs ☠️', 'Worst dump in the city 🤮', 'Total scam, run! 💀'] },
  { max: -80, remarks: ['Heard this place is a scam 💀', 'Heard they serve empty cups 😤', "I'd steer way clear 🙅"] },
  { max: -40, remarks: ["Heard it's not great 😕", 'Eh, not worth it 🤷', 'Heard they water it down ☕💧'] },
];

// Returns the bad-rep remark pool for the current hype, or null above the lowest tier.
function badRepRemarks(hype: number): string[] | null {
  for (const tier of BAD_REP_TIERS) {
    if (hype <= tier.max) return tier.remarks;
  }
  return null;
}

// A passerby's snide comment about a shop with a bad reputation, or null if the
// reputation isn't bad enough (or they just don't bother). The worse the hype,
// the harsher the line and the more likely they are to say it.
export function walkByRemark(state: GameState): string | null {
  const remarks = badRepRemarks(state.hype);
  if (!remarks) return null;
  // -40 → ~36% chance, -80 → ~73%, -100 and below → capped at 90%.
  const chance = Math.min(0.9, -state.hype / 110);
  if (Math.random() >= chance) return null;
  return remarks[Math.floor(Math.random() * remarks.length)];
}
