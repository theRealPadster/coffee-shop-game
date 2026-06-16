// Static "How to Play" info pane shown from the title screen and from the
// pause menu. Deliberately not an interactive tutorial — that's a separate
// future TODO; this is just a few paragraphs of explainer to orient
// first-time players.

import { paneModal } from './ui';

export function openHowToPlay(): Promise<void> {
  return paneModal({
    title: 'How to Play',
    className: 'howto-pane',
    body: (host) => {
      host.innerHTML = `
        <section class="howto-section">
          <h3>The day, in two parts</h3>
          <p>
            Each in-game day has a <strong>Buy phase</strong> and a
            <strong>Street phase</strong>. In the buy phase you stock
            ingredients, tune your recipes, and set your cup price.
            Hit <strong>Start Day ▶</strong> to open the stand.
          </p>
        </section>
        <section class="howto-section">
          <h3>Reading the market</h3>
          <p>
            Each ingredient shows a price chip — <strong>▼▼ bargain</strong>
            through <strong>▲▲ expensive</strong> — and a 5-day sparkline so you
            can stock up when prices dip. <strong>Buy 10</strong> and
            <strong>Buy 20</strong> bundles include a small per-unit discount.
            The <strong>🔻 bottleneck</strong> badge marks the ingredient that's
            limiting how many cups you can brew today.
          </p>
        </section>
        <section class="howto-section">
          <h3>Hot vs Iced</h3>
          <p>
            Each side has its own recipe and cup price. The
            <strong>Hot/Iced</strong> toggle in "Serving Today" swaps which
            one you're selling — check the forecast (tap the weather chip)
            and decide before you open.
          </p>
        </section>
        <section class="howto-section">
          <h3>Hype</h3>
          <p>
            The hype meter is your reputation. Happy buyers lift it; "too
            expensive" walk-bys and unhappy tasters drop it. Higher hype
            means more pedestrians stop and they tolerate higher prices.
            It gently decays each day, so keep selling well.
          </p>
        </section>
        <section class="howto-section">
          <h3>Saving and quitting</h3>
          <p>
            Open the menu (<strong>Esc</strong> or the <strong>⏸</strong>
            button) any time — Save, Restore, change theme, mute sound,
            go fullscreen, or quit back to the title.
          </p>
        </section>
        <section class="howto-section">
          <h3>Controls reference</h3>
          <p><strong>Buy phase</strong></p>
          <dl class="howto-glossary">
            <dt>☕🧊 Serving Today / Hot · Iced toggle</dt>
            <dd>Pick which drink you're selling today. Hot and iced are separate recipes with separate cup prices — the toggle remembers each.</dd>
            <dt>$ per cup</dt>
            <dd>What customers pay. Hype, weather, and the price they see all factor into whether they buy.</dd>
            <dt>🌤️ Weather chip</dt>
            <dd>Tap to expand. Shows today's foot traffic, what the crowd's craving, and a "perishables at risk" warning when it's hot enough for milk or ice to spoil overnight.</dd>
            <dt>📣 Hype chip</dt>
            <dd>Tap to expand. Your shop's buzz meter — happy customers raise it, walk-aways and unhappy tasters drop it. Higher hype means more foot traffic and a higher price tolerance.</dd>
            <dt>Dose slider (per ingredient)</dt>
            <dd>How much of each ingredient goes in a cup. Iced ingredient only applies when you're serving iced.</dd>
            <dt>Stock + spoilage warning</dt>
            <dd>How much you have on hand. Milk and ice show a ⚠ "spoils/melts overnight" warning when today's temp is above their threshold — leftovers degrade by morning.</dd>
            <dt>Market price chip + sparkline</dt>
            <dd>Today's market level (▼▼ bargain → ▲▲ expensive) and a 5-day history. Buy when it dips.</dd>
            <dt>Buy 5 / 10 / 20 + Bottleneck</dt>
            <dd>Larger bundles include a small per-unit discount. The 🔻 bottleneck marker shows which ingredient is capping how many cups you can brew today.</dd>
          </dl>
          <p><strong>Street phase</strong></p>
          <dl class="howto-glossary">
            <dt>HUD counters</dt>
            <dd>Sold (cups served) · Walk-bys (people who passed without stopping) · Cups left (turns amber when low, red when sold out).</dd>
            <dt>Time of day</dt>
            <dd>The day runs on a 12-hour clock from 8am to 8pm. Foot traffic varies through the day.</dd>
            <dt>Customer thought bubbles</dt>
            <dd>What they were thinking — praise, complaints, or "wanted iced today" — useful signal for recipe tuning.</dd>
            <dt>Close shop</dt>
            <dd>End the day early. You'll still see the report card.</dd>
          </dl>
        </section>
      `;
    },
  });
}
