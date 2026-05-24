# Ideas / TODO

Loose backlog. No commitments, no order — just stuff to consider next.

## Gameplay

- **Multi-recipe menu.** Let players serve more than one drink per day. Currently deferred — `Serving Today` plus a single hot/iced pair is intentionally simple. Revisit if testers feel constrained after the current UI lands.
- **Per-recipe cup price.** `state.cupPrice` is global today; tying it to the recipe means switching hot ↔ iced remembers the price you charged last time. Small UX win, small state change.
- **Customer variety.** Right now `spawnCustomer` just rolls preferences from uniform ranges. Could introduce archetypes (sweet-tooth, espresso purist, ice fiend) that show up in different proportions with weather.
- **Day-over-day events.** Random one-off events at the start of a day — supplier sale, festival nearby, equipment breakdown — that tweak prices, demand, or capacity.
- **Upgrade system.** Persistent purchases unlocked once you've banked enough cash, applied between days from the buy phase. Each one nudges a specific lever in customer/spawn/economy logic. Some seed ideas:
  - **Mascot.** Costumed character that patrols the sidewalk and physically drags reluctant pedestrians into the queue. Boosts `willStop` rate, especially on bad-weather days.
  - **Espresso machine v2.** Reduces coffee dose per cup (better margins) or speeds up the considering phase so the queue moves faster.
  - **Loyalty card.** Returning customers (same sprite seed) get a small price tolerance bonus — rewards consistency across days.
  - **Awning extension.** Customers in the queue don't flee in rain; smaller demand penalty when it's bad weather.
  - **Pastry case.** A side menu of croissants / muffins / cookies that happy customers add to their order. Pure upsell — extra revenue per sale without changing throughput.
  - **Pup cups.** Adds a dog-walker customer type. Their dog gets a free (or cheap) whipped-cream cup; owner is delighted regardless of recipe fit. Strong hype generator, modest revenue.
  - **Tip jar.** Each happy customer drops a few cents on top of the cup price. Scales with hype.
  - **Cosmetics.** Awning colors, sign fonts, shop themes (e.g. "speakeasy", "tiki", "winter"). Pure flavor, no mechanical effect — or a tiny passive hype trickle if the theme matches the weather.

## UI / UX

- **Tutorial / onboarding.** First-time playthrough is confusing per testing. A few inline tooltips on day 1 ("this slider sets dose", "this chip says today's market price") would go a long way.
- **Price history sparkline.** The market chips show *today*'s level vs the band, but not the trend. A 3–5 day sparkline next to each ingredient would make stocking decisions feel less random.
- **Report card depth.** End-of-day card shows totals and top complaint. Could also show which customer types walked by without buying — useful signal for recipe tuning.

## Tech / polish

- **Vector art.** `render.ts` is already shaped to allow swapping `emojiSprite` for vector implementations without touching scene code. Worth doing once the gameplay is settled.
- **Audio variety.** Single coin / bell / grumble samples; could use 2–3 variants of each to reduce repetition.
