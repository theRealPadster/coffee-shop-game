# Coffee Shop Game

[![Play now](https://img.shields.io/badge/▶_Play_now-coffee--shop--game-6f4e37?style=for-the-badge)](https://therealpadster.github.io/coffee-shop-game/)

A lemonade-stand-style coffee shop game where you run a sidewalk coffee stand. Each day has a **buy phase** (market prices, ingredient stocking, recipe tuning) and a **street phase** (pedestrians walk by, some stop, some buy).

**▶ [Play it in your browser](https://therealpadster.github.io/coffee-shop-game/)** — no install required. The live site auto-deploys from `main` via GitHub Actions.

## Run it

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # produces dist/index.html (single self-contained file)
```

The production build is a single `index.html` you can open directly in a browser — no server needed.

## How to play

- **Buy phase:** Watch the price chevrons (⏬ ▼ ▬ ▲ ⏫) — stock up when prices are low. Tune your recipe sliders. The 🔻 badge marks your current bottleneck. Set your cup price.
- **Recipe library:** Save named recipes (e.g. "Classic Hot", "Sweet Iced") and load them later. Hot vs Iced is a recipe-type toggle — switching means swapping recipes, not running both at once.
- **Start day** to open the shop. Pedestrians walk by; some stop, look, and react with thought bubbles. Watch the **Hype meter** rise/fall.
- **Close Shop** when you want to end the day. You'll get a report card and tomorrow's forecast.
- **Save / Restore / Reset** in the buy phase footer (manual saves; localStorage).

## Project structure

```
src/
  main.ts                # bootstrap + scene switching
  state.ts               # game state types + initial state
  economy.ts             # price random walk + chevron classification
  weather.ts             # forecast generation + weather effects
  recipe.ts              # cups-producible/bottleneck math, library helpers
  customers.ts           # spawn + decision logic + thought picking
  hype.ts                # hype math
  audio.ts               # WebAudio-synthesized sound effects
  render.ts              # canvas drawing primitives (Sprite abstraction)
  save.ts                # localStorage save/restore
  style.css
  scenes/
    buyPhase.ts          # DOM-rendered prep screen
    streetPhase.ts       # canvas + HUD scene + report card modal
```

The `Sprite`/`render` abstraction is designed to be swapped from emoji to vector art later without changing scene code.
