# Ideas / TODO

Loose backlog. No commitments, no order — just stuff to consider next.

## Gameplay

- **Multi-recipe menu.** Let players serve more than one drink per day. Currently deferred — `Serving Today` plus a single hot/iced pair is intentionally simple. Revisit if testers feel constrained after the current UI lands.
- ~~**Per-recipe cup price.**~~ ✅ Done — `state.cupPrices` now holds a separate hot/iced price; switching hot ↔ iced remembers the price you charged last time.
- **Customer variety.** Right now `spawnCustomer` just rolls preferences from uniform ranges. Could introduce archetypes (sweet-tooth, espresso purist, ice fiend) that show up in different proportions with weather.
- **Day-over-day events.** Random one-off events at the start of a day — supplier sale, festival nearby, equipment breakdown — that tweak prices, demand, or capacity.
- **Spoilage / meltage.** Perishables degrade between days when it's warm out — there's currently no downside to over-buying since stock persists freely. Milk **spoils** above some temperature threshold; ice **melts** above a separate (probably lower) threshold. Tie the threshold to `state.weather.tempC` / the forecast so hot-day stocking becomes a real decision. The **Refrigerator** upgrade (see below) negates it. Lost stock should be surfaced clearly (e.g. on the report card) so it doesn't feel like a silent bug.
- **Hype rework.** Hype is flat today — `decayHype` is a fixed −2/day and customers only nudge it ±1/±2, so it drifts rather than swinging. Boost how much it moves and/or wire it into a fun, readable visual feedback the player can chase (meter pulses, streaks, a "buzz" indicator). Keep it forgiving, not punishing — a bad day shouldn't tank you; the player should be able to bounce back the next day.
- **Out-of-stock warning mid-day.** Running out of cups is silent until the first "Sold out 🚫". Add a HUD warning when cups get low so the player can react (e.g. raise the price to slow demand) before turning customers away.
- **Upgrade system.** Persistent purchases unlocked once you've banked enough cash, applied between days from the buy phase. Each one nudges a specific lever in customer/spawn/economy logic. Some seed ideas:
  - **Mascot.** Costumed character that patrols the sidewalk and physically drags reluctant pedestrians into the queue. Boosts `willStop` rate, especially on bad-weather days.
  - **Espresso machine v2.** Reduces coffee dose per cup (better margins) or speeds up the considering phase so the queue moves faster.
  - **Loyalty card.** Returning customers (same sprite seed) get a small price tolerance bonus — rewards consistency across days.
  - **Awning extension.** Customers in the queue don't flee in rain; smaller demand penalty when it's bad weather.
  - **Refrigerator.** Prevents spoilage/meltage (see **Spoilage / meltage** above) so milk and ice survive hot days. Lets the player safely stock ahead when prices are low regardless of the forecast.
  - **Pastry case.** A side menu of croissants / muffins / cookies that happy customers add to their order. Pure upsell — extra revenue per sale without changing throughput.
  - **Pup cups.** Adds a dog-walker customer type. Their dog gets a free (or cheap) whipped-cream cup; owner is delighted regardless of recipe fit. Strong hype generator, modest revenue.
  - **Tip jar.** Each happy customer drops a few cents on top of the cup price. Scales with hype.
  - **Cosmetics.** Awning colors, sign fonts, shop themes (e.g. "speakeasy", "tiki", "winter"). Pure flavor, no mechanical effect — or a tiny passive hype trickle if the theme matches the weather.

## UI / UX

- **Tutorial / onboarding.** First-time playthrough is confusing per testing. A few inline tooltips on day 1 ("this slider sets dose", "this chip says today's market price") would go a long way.
- ~~**Price history sparkline.**~~ ✅ Done — a 5-day sparkline (`state.priceHistory`) now sits next to each ingredient's price chip, normalized to the band and colored by the last day's direction.
- **Report card depth.** End-of-day card shows totals and top complaint. Could also show which customer types walked by without buying — useful signal for recipe tuning.
- **Day-view stats.** Surface revenue-so-far (and maybe a conversion %) during the day, and/or a small daily summary in the buy phase. Keep it glanceable — the HUD already shows Sold / Walk-bys, so this should add signal without making the UI visually busy.
- ~~**Confirm on Reset.**~~ ✅ Done — Reset now opens a styled in-game confirm modal (`confirmModal` in `ui.ts`) instead of wiping the game silently; cancel/click-outside/Esc all dismiss it.

## Tech / polish

- **Vector art.** `render.ts` is already shaped to allow swapping `emojiSprite` for vector implementations without touching scene code. Worth doing once the gameplay is settled.
- **Audio variety.** Single coin / bell / grumble samples; could use 2–3 variants of each to reduce repetition.
- ~~**Common color themes.**~~ ✅ Mostly done — added Dracula, Catppuccin Mocha + Latte, Nord, and Solarized Light + Dark as `:root[data-theme="…"]` blocks with `THEMES` entries. Still open: **Gruvbox**.
