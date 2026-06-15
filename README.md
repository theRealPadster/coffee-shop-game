# Coffee Shop Game

[![Play now](https://img.shields.io/badge/▶_Play_now-coffee--shop--game-6f4e37?style=for-the-badge)](https://therealpadster.github.io/coffee-shop-game/)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

A lemonade-stand-style coffee shop game where you run a sidewalk coffee stand. Each day has a **buy phase** (market prices, ingredient stocking, recipe tuning) and a **street phase** (pedestrians walk by, some stop, some buy).

**▶ [Play it in your browser](https://therealpadster.github.io/coffee-shop-game/)** — no install required. The live site auto-deploys from `main` via GitHub Actions.

**Branch previews:** any non-`main` branch builds to `https://therealpadster.github.io/coffee-shop-game/branches/<branch-name>/` (slashes flatten to dashes, e.g. `feat/pause-menu` → `branches/feat-pause-menu/`). Open PRs get the preview URL posted as a sticky comment. Previews are removed when the branch is deleted.

## Run it

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # type-checks, then produces dist/index.html (single self-contained file)
npm run preview      # serve the production build for a final check
```

The production build's `dist/index.html` is a single self-contained file you can open directly in a browser — no server needed. PWA install (manifest + icons) ships as a few small sibling files in `dist/`; they're optional, but the deployed site uses them to enable "Add to Home Screen".

## Install it (mobile)

On a phone the game can be installed to the home screen and launched without browser chrome — same idea as a native app, no app-store install:

- **iPhone Safari:** open the share menu → **Add to Home Screen**. Required because iPhone Safari doesn't expose the Fullscreen API; this is the Apple-blessed path to a fullscreen experience.
- **Android Chrome:** open the menu → **Add to Home Screen** (or **Install app** if the prompt offers it).

The home-screen icon launches the game in `display: fullscreen` mode and persists across sessions.

## How to play

- **Buy phase:** Watch each ingredient's price chip (▼▼ bargain → ▲▲ expensive) and 5-day sparkline — stock up when prices are low, and buy in bulk (Buy 10/20) for a per-unit discount. Tune your recipe sliders. The 🔻 badge marks your current bottleneck. Set your cup price.
- **Hot vs Iced toggle:** Each side has its own recipe and cup price (`state.recipes.hot`, `state.recipes.iced`). The Hot/Iced toggle in the "Serving Today" banner swaps between them — plan based on the forecast, not on the fly.
- **Start Day** to open the shop. Pedestrians walk by; some stop, look, and react with thought bubbles. Watch the **Hype meter** rise/fall. Adjust the cup price mid-day if it's too high or too low. Tap the weather chip to expand it for a deeper read on the day.
- **Close Shop** when you want to end the day. You'll get a report card with revenue, walk-bys, top complaint, hype delta, and tomorrow's forecast.
- **Pause menu** (Esc, or the ⏸ button in the header): theme picker, sound toggle, fullscreen (where supported), and Save / Restore / Reset. The street-phase game loop pauses while it's open.

## Project structure

```
src/
  main.ts                # bootstrap + scene switching + global Esc handler
  state.ts               # game state types + initial state
  economy.ts             # price random walk + chevron classification + bulk-buy tiers
  weather.ts             # forecast generation + weather effects
  recipe.ts              # cups-producible/bottleneck math
  customers.ts           # spawn + decision logic + thought picking
  hype.ts                # hype math
  audio.ts               # WebAudio-synthesized sound effects
  render.ts              # canvas drawing primitives (Sprite abstraction)
  save.ts                # localStorage save/restore
  themes.ts              # theme registry + apply/persist
  ui.ts                  # modal + paneModal primitives (confirmModal, alertModal)
  header.ts              # shared app-header HTML + hype meter renderer
  pauseMenu.ts           # pause-menu pane (Theme / Sound / Fullscreen / Save / Restore / Reset)
  menuOpener.ts          # scene-aware menu opener registration (street phase wraps it
                         # with clock pause/resume)
  fullscreen.ts          # Fullscreen API wrapper with feature detection
  orientationPrompt.ts   # landscape-rotate "Tap for fullscreen" pill (mobile)
  style.css
  chips/
    weatherChip.ts       # expandable weather chip with vibe-tier insights
    expandableChip.ts    # generic expand/collapse behavior for header chips
  scenes/
    buyPhase.ts          # DOM-rendered prep screen
    streetPhase.ts       # canvas + HUD scene + report card modal
public/
  manifest.webmanifest   # PWA install metadata (name, icons, display mode)
  icon-192.png           # Android/Chrome PWA icon
  icon-512.png           # Android/Chrome PWA icon + splash
  apple-touch-icon.png   # iOS home-screen icon (180×180)
assets/
  icon.svg               # source SVG for the home-screen icons (outside public/
                         # so it doesn't ship; regenerate PNGs with
                         # `node scripts/render-icons.mjs` after editing)
scripts/
  render-icons.mjs       # one-off SVG → PNG renderer (uses @resvg/resvg-js
                         # via `npm install --no-save`)
```

The `Sprite`/`render` abstraction is designed to be swapped from emoji to vector art later without changing scene code.

## License

Released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). In plain language: you can use, modify, and redistribute the code, but if you run a modified version publicly (e.g. host it on a website) you must publish your source under the same license. See [`LICENSE`](LICENSE) for the full text and [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.
