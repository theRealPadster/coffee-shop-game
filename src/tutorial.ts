// Guided buy-phase tour built on driver.js. Auto-runs on day 1 if the player
// hasn't seen it; replayable any time via the help-fab button.
//
// Persistence lives in localStorage (csg-tutorial-seen) rather than GameState —
// it's per-device UI state, not save-worthy. A save loaded from before this
// feature simply won't have the key and would trigger the tour on its next day
// 1, which never happens for an existing save; new games trigger normally.

import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const STORAGE_KEY = 'csg-tutorial-seen';

// Steps walk top-to-bottom through the buy panel — chips first (they sit above
// the panel), then the serving banner, then ingredients, then the bottleneck
// summary, then Start Day. Steps 2–3 explicitly mention the tap-to-expand chip
// behavior so players discover that pattern.
const STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Welcome!',
      description:
        "Each day you stock the stand, set prices, and sell to pedestrians. Let's walk through the basics.",
    },
  },
  {
    element: '.weather-chip',
    popover: {
      title: "Today's weather",
      description:
        "Sets foot traffic and what people order. Tap the chip for the breakdown.",
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '.hype-chip',
    popover: {
      title: 'Hype',
      description:
        "Your shop's reputation. Good sales lift it; sold-outs and unhappy tasters drag it down. Tap for your band.",
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: '.type-toggle',
    popover: {
      title: 'Hot or iced',
      description:
        "Hot and iced are separate recipes with separate prices. Switch which you're serving today.",
      side: 'bottom',
    },
  },
  {
    element: '.serving-price-row',
    popover: {
      title: 'Cup price',
      description:
        'Set what each cup costs. Higher hype and good weather let you charge more.',
      side: 'bottom',
    },
  },
  {
    element: '.ingredient-row[data-row="coffee"] input[type="range"]',
    popover: {
      title: 'Dose sliders',
      description:
        'Drag to set how much of each ingredient goes in a cup.',
      side: 'bottom',
    },
  },
  {
    element: '.ingredient-row[data-row="sugar"] .price',
    popover: {
      title: 'Market price',
      description:
        "Today's price plus a 5-day sparkline. Buy when it dips.",
      side: 'top',
    },
  },
  {
    element: '.cups-producible',
    popover: {
      title: 'Brewable cups',
      description:
        'How many cups you can brew today. The named bottleneck is what is capping you.',
      side: 'top',
    },
  },
  {
    element: '#start-day-btn',
    popover: {
      title: 'Ready?',
      description: 'Hit Start Day when you are ready. Good luck!',
      side: 'top',
    },
  },
];

export function startBuyPhaseTutorial(onDone?: () => void): void {
  const d = driver({
    showProgress: true,
    progressText: 'Step {{current}} of {{total}}',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Got it',
    allowClose: true,
    overlayOpacity: 0.6,
    // Tour is look-don't-touch: stops the player from clicking a highlighted
    // control mid-tour and triggering a buy-phase re-render that would tear
    // the elements driver.js is tracking out from under it.
    disableActiveInteraction: true,
    steps: STEPS,
    onDestroyed: () => {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // Private mode / storage disabled — tutorial will re-show next session
        // but that's better than crashing.
      }
      onDone?.();
    },
  });
  d.drive();
}

export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // No storage access — treat as seen so we don't loop the tour forever.
    return true;
  }
}
