# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # dev server at http://localhost:5173
npm run build     # tsc --noEmit then vite build → dist/index.html (single portable file)
npm run preview   # preview the production build locally
npx tsc --noEmit  # type-check only, no output
```

There are no tests. The build is the only verification step. `npm run build` runs `tsc --noEmit` first, so a clean build guarantees no type errors.

The production output is a single `dist/index.html` (via `vite-plugin-singlefile`) that runs directly from `file://` with no server.

## Preview URLs

CI deploys per-branch previews to GitHub Pages at:

```
https://therealpadster.github.io/coffee-shop-game/branches/<branch-name>/
```

Branch names are converted to lowercase and slashes are converted to dashes — e.g. `fix/Title-Github-Link` → `branches/fix-title-github-link/`.

## Architecture

### State is a single plain object

All game data lives in `GameState` (`src/state.ts`). It is passed by reference into every scene and module — there is no reactive framework, no store, and no event bus. Scenes mutate `state` directly, then call `onStateChange()` (currently a no-op) or re-render themselves. `main.ts` owns the single `state` variable and swaps it on restore/reset.

### Two phases, two scenes

`main.ts` calls `renderBuyPhase` or `renderStreetPhase` depending on `state.phase`. Each scene function takes `(root, state, callbacks)` and writes directly into the `#app` element:

- **Buy phase** (`src/scenes/buyPhase.ts`) — fully DOM-rendered. Re-renders itself on most interactions by calling its own `rerender()` closure. Sliders do a partial DOM update (doses + bottleneck only) on `input` for smoothness, then a full re-render on `change`.
- **Street phase** (`src/scenes/streetPhase.ts`) — returns a teardown function that `main.ts` holds in `streetTeardown`. The teardown cancels the `requestAnimationFrame` loop and disconnects the `ResizeObserver`. Thought bubbles are DOM elements overlaid on the canvas, positioned in `renderThoughtBubbles()` each frame by scaling from canvas coordinates to wrapper coordinates.

### Directory layout

`src/` is grouped into layers. `main.ts`, `state.ts`, `render.ts`, and `style.css` stay at the root (the shared spine everything imports). Everything else lives under:

- `game/` — pure, framework-free logic (see table below). Imports only from each other or `../state`.
- `platform/` — browser/system integration: `audio.ts`, `save.ts`, `fullscreen.ts`.
- `ui/` — DOM chrome: `ui.ts` (modal primitives), `header.ts`, `pauseMenu.ts`, `settingsRows.ts`, `howToPlay.ts`, `tutorial.ts`, `menuOpener.ts`, `orientationPrompt.ts`, plus `ui/chips/` (expandable header chips).
- `themes/` — the theming feature, both halves together: `themes.ts` (the `ThemeId` registry, localStorage persistence, and the `data-theme` attribute flip) and `themes.css` (the color variables — default palette + each `[data-theme]` override). `themes.ts` defines theme ids that must stay in sync with the selectors in `themes.css`. `style.css` (at the root) holds component/layout styling and reads those variables. `main.ts` imports `themes.css` before `style.css`.
- `scenes/` — `titleScreen.ts`, `buyPhase.ts`, `streetPhase.ts`.

### Pure logic modules

All game logic lives in framework-free modules under `src/game/` that only import from each other or `src/state.ts`:

| Module | Responsibility |
|---|---|
| `game/economy.ts` | Price random walk (`nextPrice`), 5-level chevron classification (`classifyPrice`), bulk-buy tiers |
| `game/weather.ts` | Markov-chain forecast generation (`generateForecast`), weather effect multipliers (`weatherEffects`) |
| `game/recipe.ts` | `maxCups` / `bottleneck` math, recipe library helpers (`cloneRecipe`, `isActiveRecipeDirty`, `setRecipeType`) |
| `game/customers.ts` | `spawnCustomer`, `decide` (scoring + thought selection), `spawnRate` |
| `game/hype.ts` | `applyHype`, `decayHype`, multiplier helpers |
| `game/spoilage.ts` | Overnight perishable decay driven by temperature (`spoilageFraction`) |
| `platform/save.ts` | `saveGame` / `loadGame` / `clearSave` via `localStorage` |

### Render abstraction

`src/render.ts` exports a `Sprite` interface (`draw(ctx, x, y, time)`). The current implementation wraps emoji glyphs. To swap to vector art, replace the `emojiSprite` implementations and the canvas draw calls in `drawShop` / `drawBackground` — scene code only calls `sprite.draw(...)`.

### Monetary values

All prices, cash, and `cupPrice` are stored as **integer cents** to avoid float drift. `formatCents()` converts for display. `PRICE_BANDS` in `state.ts` are also cents.

### Sizing

Canvas width/height attributes are set to the wrapper's `clientWidth/Height` via a `ResizeObserver`. Thought bubbles are positioned using a `scaleX = wrap.clientWidth / canvas.width` ratio (which is 1.0 when the canvas fills the wrapper, but explicit for correctness).

### Day lifecycle

```
buy phase → Start Day → street phase → Close Shop → report card modal
→ day++, rollPrices, advance weather, decayHype → buy phase
```

`tomorrowWeather` is pre-computed at the end of each day so the buy phase can show a forecast. `todayStats` is reset at the start of `renderStreetPhase` via `freshStats()`.
