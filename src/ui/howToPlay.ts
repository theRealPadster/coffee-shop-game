// Static "How to Play" info pane shown from the title screen and from the
// pause menu. Deliberately not an interactive tutorial — that's a separate
// future TODO; this is just a few short cards of explainer to orient
// first-time players, plus a collapsible glossary for deeper lookup.

import { paneModal } from './ui';

export function openHowToPlay(): Promise<void> {
  return paneModal({
    title: 'How to Play',
    className: 'howto-pane',
    body: (host) => {
      host.innerHTML = `
        <section class="howto-section">
          <h3><span class="howto-icon">🕐</span>The day, in two parts</h3>
          <p>
            Each in-game day has a <strong>Buy phase</strong> and a
            <strong>Street phase</strong>. In the buy phase you stock
            ingredients, tune your recipes, and set your cup price.
            Hit <strong>Start Day ▶</strong> to open the stand.
          </p>
        </section>

        <section class="howto-section">
          <h3><span class="howto-icon">📊</span>Reading the market</h3>
          <p>Each ingredient row tells you whether to stock up now or wait.</p>
          <ul class="howto-bullets">
            <li><strong>Price chip</strong> — <strong>▼▼ bargain</strong> through <strong>▲▲ expensive</strong>.</li>
            <li><strong>5-day sparkline</strong> shows the trend so you can catch dips.</li>
            <li><strong>Buy 10</strong> and <strong>Buy 20</strong> bundles get a small per-unit discount.</li>
            <li>The ingredient capping today's brew is <strong>highlighted</strong> in the panel and named under "Cups producible today".</li>
          </ul>
        </section>

        <section class="howto-section">
          <h3><span class="howto-icon">☕🧊</span>Hot vs Iced</h3>
          <p>
            Each side has its own recipe and cup price. The
            <strong>Hot/Iced</strong> toggle in "Serving Today" swaps which
            one you're selling — check the forecast (tap the weather chip)
            and decide before you open.
          </p>
        </section>

        <section class="howto-section">
          <h3><span class="howto-icon">📣</span>Hype</h3>
          <p>
            The hype meter is your reputation. Happy buyers lift it; "too
            expensive" walk-bys and unhappy tasters drop it. Higher hype
            means more pedestrians stop and they tolerate higher prices.
            It gently decays each day, so keep selling well.
          </p>
        </section>

        <section class="howto-section">
          <h3><span class="howto-icon">⏸️</span>Saving and quitting</h3>
          <p>Open the menu (<strong>Esc</strong> or the <strong>⏸</strong> button) any time to:</p>
          <ul class="howto-bullets">
            <li>Save or restore your game</li>
            <li>Change theme or mute sound</li>
            <li>Go fullscreen</li>
            <li>Quit back to the title</li>
          </ul>
        </section>

        <section class="howto-section howto-section--ref">
          <details class="howto-details">
            <summary>
              <span class="howto-icon">📖</span>
              <span class="howto-details__title">Controls reference</span>
              <span class="howto-details__hint">Tap to expand</span>
            </summary>
            <div class="howto-details__body">
              <details class="howto-subdetails" open>
                <summary>Buy phase</summary>
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
                  <dt>Buy 5 / 10 / 20</dt>
                  <dd>Larger bundles include a small per-unit discount.</dd>
                  <dt>Bottleneck highlight</dt>
                  <dd>The ingredient capping today's cup count is shaded in the buy panel and named under "Cups producible today".</dd>
                </dl>
              </details>
              <details class="howto-subdetails">
                <summary>Street phase</summary>
                <dl class="howto-glossary">
                  <dt>HUD counters</dt>
                  <dd>Sold (cups served) · Walk-bys (people who passed without stopping) · Cups left (turns amber when low, red when sold out).</dd>
                  <dt>Time of day</dt>
                  <dd>The day runs on a 12-hour clock from 8am to 8pm. Foot traffic varies through the day.</dd>
                  <dt>Customer thought bubbles</dt>
                  <dd>What they were thinking — praise, complaints, or "wanted iced today" — useful signal for recipe tuning.</dd>
                  <dt>Close shop</dt>
                  <dd>End the day early — handy when you're out of an ingredient. Customers who walk up to a stand that can't serve them get upset, which costs hype, so it's often better to close than keep turning people away. You'll still see the report card.</dd>
                </dl>
              </details>
            </div>
          </details>
        </section>
      `;
    },
  });
}
