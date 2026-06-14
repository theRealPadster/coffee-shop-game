// Title screen: animated street backdrop + game title + button stack.
// Reuses drawBackground / drawShop / pedestrian sprites from the street phase
// so we don't need any new art assets — the title scene IS the game's street
// scene, paused at a fixed warm time-of-day and decorated with a few wandering
// pedestrians.
//
// renderTitleScreen takes over the #app root, mounts a canvas + DOM overlay,
// and returns a teardown that cancels the rAF loop and disconnects the resize
// observer.

import { GameState } from '../state';
import { drawBackground, drawShop, randomPedestrianSprite, Sprite } from '../render';
import { loadGame } from '../save';
import { paneModal, confirmModal, alertModal } from '../ui';
import { renderSettingsRows } from '../settingsRows';
import { openHowToPlay } from '../howToPlay';

export interface TitleScreenCallbacks {
  onContinue: (restored: GameState) => void;
  onNewGame: () => void;
}

// Above this width/height ratio we switch into "landscape" mode: the shop
// drifts left so the overlay can lay the title card + button stack out down
// the right side without the two colliding. The CSS uses a matching media
// query (`(orientation: landscape) and (min-aspect-ratio: 13/10)`) so the
// canvas and DOM agree on what counts as landscape.
const LANDSCAPE_RATIO = 1.3;

function shopXForCanvas(viewW: number, viewH: number): number {
  // Landscape: anchor the shop just left of center so it sits next to the
  // menu overlay (which lives in the right-middle band) without overlapping.
  // Was viewW * 0.28 originally; nudged right toward center so the title
  // card and shop read as one balanced composition instead of one element
  // on each edge with a dead zone between them.
  if (viewW / viewH > LANDSCAPE_RATIO) return viewW * 0.32 - 60;
  // Portrait / squarish: centered, matching the street phase exactly.
  return viewW * 0.5 - 60;
}

// Title screen backdrop: warm late-afternoon golden hour. timeOfDay=0.65 maps
// to ~5pm in the street scene's 8am→8pm window — keeps the sky warm without
// being a literal sunset.
const TITLE_TIME_OF_DAY = 0.65;

// Sky condition for the backdrop. Sunny keeps things bright and inviting; the
// weather chip on the in-game header still varies day-to-day.
const TITLE_CONDITION = 'sunny';

interface TitlePedestrian {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
}

export function renderTitleScreen(root: HTMLElement, cb: TitleScreenCallbacks): () => void {
  const hasSave = loadGame() !== null;

  root.innerHTML = `
    <div class="title-screen">
      <canvas id="title-canvas"></canvas>
      <div class="title-overlay">
        <div class="title-card">
          <h1 class="title-name">Coffee Shop</h1>
          <p class="title-tagline">Run the corner stand.</p>
        </div>
        <nav class="title-buttons" aria-label="Main menu">
          ${hasSave ? `<button id="title-continue-btn" class="title-btn primary">▶ Continue</button>` : ''}
          <button id="title-newgame-btn" class="title-btn ${hasSave ? 'secondary' : 'primary'}">${hasSave ? '✨ New Game' : '▶ New Game'}</button>
          <button id="title-howto-btn" class="title-btn secondary">📖 How to Play</button>
          <button id="title-options-btn" class="title-btn secondary">⚙ Options</button>
        </nav>
        <footer class="title-footer">
          <a href="https://github.com/theRealPadster/coffee-shop-game" target="_blank" rel="noopener noreferrer">github</a>
        </footer>
      </div>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('#title-canvas')!;
  const wrap = root.querySelector<HTMLDivElement>('.title-screen')!;
  const ctx = canvas.getContext('2d')!;

  // Logical (CSS-pixel) dimensions — backing store scales by DPR.
  let viewW = 0;
  let viewH = 0;
  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    viewW = wrap.clientWidth;
    viewH = wrap.clientHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(wrap);

  const pedestrians: TitlePedestrian[] = [];
  // Seed a few walkers spread across the sidewalk so the scene doesn't start
  // empty. Subsequent walkers spawn off-screen left and stroll across.
  for (let i = 0; i < 4; i++) {
    pedestrians.push({
      sprite: randomPedestrianSprite(),
      x: (i / 4) * (viewW || 800) + Math.random() * 60,
      y: 0, // set per-frame from viewH
      vx: 50 + Math.random() * 40,
    });
  }

  let running = true;
  let rafId: number | null = null;
  let lastSpawn = performance.now();
  let lastFrame: number | null = null;

  function tick(now: number): void {
    if (!running) return;

    const dt = Math.min(0.1, (now - (lastFrame ?? now)) / 1000);
    lastFrame = now;

    // Sprinkle in a new pedestrian every few seconds so the sidewalk stays
    // lively without piling up.
    if (pedestrians.length < 6 && now - lastSpawn > 2500 + Math.random() * 2500) {
      pedestrians.push({
        sprite: randomPedestrianSprite(),
        x: -40,
        y: 0,
        vx: 50 + Math.random() * 40,
      });
      lastSpawn = now;
    }

    // Walk + cull.
    const groundY = viewH * 0.68;
    for (const p of pedestrians) {
      p.x += p.vx * dt;
      p.y = groundY;
    }
    for (let i = pedestrians.length - 1; i >= 0; i--) {
      if (pedestrians[i].x > viewW + 80) pedestrians.splice(i, 1);
    }

    // Draw. Shop bottom is anchored to the top of the sidewalk (viewH * 0.6)
    // to match the street phase exactly; shop X drifts left in landscape so
    // the menu overlay can sit down the right side.
    drawBackground(ctx, viewW, viewH, TITLE_CONDITION, TITLE_TIME_OF_DAY, now);
    drawShop(ctx, shopXForCanvas(viewW, viewH), viewH * 0.6 - 110, 120, 110);
    for (const p of pedestrians) {
      p.sprite.draw(ctx, p.x, p.y, now);
    }

    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  // Wire buttons.
  root.querySelector('#title-continue-btn')?.addEventListener('click', () => {
    const restored = loadGame();
    if (!restored) {
      void alertModal({ title: 'No saved game', message: 'There is no saved game to continue.' });
      return;
    }
    cb.onContinue(restored);
  });

  root.querySelector('#title-newgame-btn')?.addEventListener('click', async () => {
    if (hasSave) {
      const ok = await confirmModal({
        title: 'Start a new game?',
        message: 'This will erase your saved game and start over from day 1. This cannot be undone.',
        confirmLabel: '✨ New Game',
        cancelLabel: 'Cancel',
        danger: true,
      });
      if (!ok) return;
    }
    cb.onNewGame();
  });

  root.querySelector('#title-howto-btn')?.addEventListener('click', () => {
    void openHowToPlay();
  });

  root.querySelector('#title-options-btn')?.addEventListener('click', () => {
    void paneModal({
      title: 'Options',
      className: 'options-pane',
      body: (host) => {
        // Wrap in a "pause-section" so the shared rows pick up the existing
        // section styling (label/control layout already defined for the
        // pause menu).
        host.innerHTML = `<section class="pause-section"><h3>Settings</h3><div id="options-rows-host"></div></section>`;
        const rowsHost = host.querySelector<HTMLElement>('#options-rows-host')!;
        const teardown = renderSettingsRows(rowsHost);
        // paneModal removes the host on close; clean up the fullscreenchange
        // listener when that happens.
        const observer = new MutationObserver(() => {
          if (!document.body.contains(rowsHost)) {
            teardown();
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      },
    });
  });

  return () => {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    resizeObs.disconnect();
  };
}
