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
      `;
    },
  });
}
