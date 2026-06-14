import { GameState, formatCents, freshStats, activeRecipe, activeCupPrice } from '../state';
import { drawBackground, drawShop, drawMenuSign } from '../render';
import { weatherEmoji } from '../weather';
import { spawnCustomer, decide, spawnRate, walkByRemark, Customer } from '../customers';
import { applyHype } from '../hype';
import { consumeRecipe, maxCups } from '../recipe';
import { play } from '../audio';
import { appHeaderHtml, attachHeaderMenu } from '../header';
import { openPauseMenu } from '../pauseMenu';
import { setMenuOpener } from '../menuOpener';
import { weatherChipHtml } from '../chips/weatherChip';
import { hypeChipHtml, updateHypeChip } from '../chips/hypeChip';
import { makeExpandableChip } from '../chips/expandableChip';

export interface StreetPhaseCallbacks {
  onCloseShop: () => void;
  onStateChange: () => void;
  onRestore: (state: GameState) => void;
  onQuitToTitle: () => void;
}

// Real-time length of one game day (8:00 → 20:00)
const DAY_DURATION_MS = 90 * 1000; // 90 seconds

// Queue slots: x offsets from shopX where customers stand and wait
const SLOT_OFFSETS = [10, 70, 130] as const;

// Mid-day stock warning: cups-left at or below this (but above zero) is "low".
type StockLevel = 'ok' | 'low' | 'out';
const LOW_CUPS = 3;
function stockStatus(state: GameState): { cupsLeft: number; level: StockLevel } {
  const cupsLeft = maxCups(state.stock, activeRecipe(state));
  const level: StockLevel = cupsLeft <= 0 ? 'out' : cupsLeft <= LOW_CUPS ? 'low' : 'ok';
  return { cupsLeft, level };
}

interface SceneState {
  customers: Customer[];
  queue: Array<number | null>; // customer IDs occupying each slot, null = empty
  lastSpawn: number;
  running: boolean;
  paused: boolean;
  pausedAt: number | null;   // timestamp when the current pause started
  totalPausedMs: number;     // accumulated pause time so far this day
  rafId: number | null;
  lastFrame: number | null;
  dayStartTime: number;
  stockLevel: StockLevel;       // last-seen stock level, for one-shot warning sound
}

export function renderStreetPhase(root: HTMLElement, state: GameState, cb: StreetPhaseCallbacks): () => void {
  // Reset today's stats at the start of the day
  state.todayStats = freshStats(state.hype);

  const todayRecipe = activeRecipe(state);
  const headerCenter = `
    <div class="stat"><span class="v" id="cups-left">${maxCups(state.stock, todayRecipe)}</span><span>Cups left</span></div>
    <div class="stat"><span class="v" id="sold-count">0</span><span>Sold</span></div>
    <div class="stat"><span class="v" id="walkby-count">0</span><span>Walk-bys</span></div>
    <div class="game-clock" id="game-clock">08:00</div>
  `;

  const headerRight = `
    <div class="cup-price-hud">
      <div class="cup-price-controls">
        <button id="cup-price-minus" class="secondary">−</button>
        <span id="cup-price-display">${formatCents(activeCupPrice(state))}</span>
        <button id="cup-price-plus" class="secondary">+</button>
      </div>
      <span class="cup-price-label">Cup price</span>
    </div>
    <button id="close-shop-btn" class="danger">Close Shop</button>
  `;

  root.innerHTML = `
    ${appHeaderHtml(state, { variant: 'street', center: headerCenter, rightExtra: headerRight })}
    <div class="street-phase">
      <div class="street-canvas-wrap">
        <canvas id="street-canvas"></canvas>
        <div class="status-row status-row--overlay">
          ${weatherChipHtml(state, 'street')}
          ${hypeChipHtml(state.hype, 'street')}
        </div>
      </div>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('#street-canvas')!;
  const wrap = root.querySelector<HTMLDivElement>('.street-canvas-wrap')!;
  const ctx = canvas.getContext('2d')!;
  const hudHost = root.querySelector<HTMLElement>('.hype-chip')!;
  const weatherChip = root.querySelector<HTMLElement>('.weather-chip');
  if (weatherChip) makeExpandableChip(weatherChip);
  makeExpandableChip(hudHost);

  // Logical (CSS-pixel) drawing dimensions. The canvas backing store is scaled
  // up by devicePixelRatio for crispness, but all game geometry is computed in
  // these logical units so it stays consistent across monitors and resizes.
  let viewW = 0;
  let viewH = 0;
  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    viewW = wrap.clientWidth;
    viewH = wrap.clientHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    // Draw in logical pixels; the DPR transform maps them to the backing store.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(wrap);

  const now0 = performance.now();
  const scene: SceneState = {
    customers: [],
    queue: [null, null, null],
    lastSpawn: now0,
    running: true,
    paused: false,
    pausedAt: null,
    totalPausedMs: 0,
    rafId: null,
    lastFrame: null,
    dayStartTime: now0,
    // Seed with the actual starting level so we don't fire the warning sound on
    // frame 1 if the player happens to open the day already low on stock.
    stockLevel: stockStatus(state).level,
  };

  // Cup price ± buttons
  root.querySelector('#cup-price-minus')?.addEventListener('click', () => {
    state.cupPrices[state.activeType] = Math.max(0, activeCupPrice(state) - 25);
    const el = root.querySelector('#cup-price-display');
    if (el) el.textContent = formatCents(activeCupPrice(state));
    cb.onStateChange();
  });
  root.querySelector('#cup-price-plus')?.addEventListener('click', () => {
    state.cupPrices[state.activeType] += 25;
    const el = root.querySelector('#cup-price-display');
    if (el) el.textContent = formatCents(activeCupPrice(state));
    cb.onStateChange();
  });

  // Pause helpers — opening the pause menu freezes the in-game clock and
  // pedestrian motion; closing it resumes from the same point via the existing
  // pausedAt / totalPausedMs accumulator.
  function pauseSceneClock(): void {
    if (scene.paused) return;
    scene.pausedAt = performance.now();
    scene.paused = true;
  }
  function resumeSceneClock(): void {
    if (!scene.paused) return;
    if (scene.pausedAt !== null) {
      scene.totalPausedMs += performance.now() - scene.pausedAt;
      scene.pausedAt = null;
    }
    scene.paused = false;
    scene.lastFrame = null; // avoid a dt spike on first resumed frame
  }
  async function onOpenMenu(): Promise<void> {
    pauseSceneClock();
    try {
      await openPauseMenu({ state, onRestore: cb.onRestore, onQuitToTitle: cb.onQuitToTitle });
    } finally {
      // Only resume if the scene is still running; onRestore / onQuitToTitle tear it down.
      if (scene.running) resumeSceneClock();
    }
  }

  attachHeaderMenu(root, () => { void onOpenMenu(); });

  // Route the global Esc key through the same clock-pause flow as the button.
  setMenuOpener(() => { void onOpenMenu(); });

  root.querySelector('#close-shop-btn')?.addEventListener('click', () => {
    if (scene.running) closeShop();
  });

  function closeShop(): void {
    scene.running = false;
    if (scene.rafId !== null) cancelAnimationFrame(scene.rafId);
    play('bell');
    showReportCard(state, cb);
  }

  function tick(now: number): void {
    if (!scene.running) return;

    // Elapsed game time, pauses subtracted out
    const currentPauseMs = scene.pausedAt !== null ? now - scene.pausedAt : 0;
    const elapsed = now - scene.dayStartTime - scene.totalPausedMs - currentPauseMs;
    const timeOfDay = Math.min(1, elapsed / DAY_DURATION_MS);
    const gameHour = 8 + timeOfDay * 12; // 8.0 → 20.0

    // Auto-close at 20:00
    if (gameHour >= 20) {
      closeShop();
      return;
    }

    // Update clock display
    const h = Math.floor(gameHour);
    const m = Math.floor((gameHour - h) * 60);
    const clockEl = root.querySelector<HTMLElement>('#game-clock');
    if (clockEl) clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    // shopX/shopY are used by both the customer logic and the draw call
    const shopX = viewW * 0.5 - 60;
    const shopY = viewH * 0.6 - 110; // bottom of shop = top of sidewalk

    // Keep every customer pinned to the sidewalk relative to the *current*
    // canvas height, so resizing (or moving to another monitor) doesn't leave
    // already-spawned customers floating at a stale vertical position.
    const groundY = viewH * 0.68;
    for (const c of scene.customers) c.y = groundY;

    if (!scene.paused) {
      const dt = Math.min(0.1, (now - (scene.lastFrame ?? now)) / 1000);

      // Spawn customers
      const sps = spawnRate(state);
      const since = (now - scene.lastSpawn) / 1000;
      if (since >= 1 / sps) {
        scene.lastSpawn = now;
        scene.customers.push(spawnCustomer(state, viewW, viewH));
      }

      // Update customer state machine
      for (const c of scene.customers) {
        if (c.phase === 'walking') {
          c.x += c.vx * dt;
          // Bad-reputation passersby badmouth the shop as they pass the storefront.
          if (!c.willStop && !c.remarked && c.x >= shopX - 30) {
            c.remarked = true;
            const remark = walkByRemark(state);
            if (remark) {
              c.thought = remark;
              c.thoughtUntil = now + 2200;
            }
          }
          // When a willing customer reaches the queue entry point, try to claim a slot.
          if (c.willStop && !c.decided && c.x >= shopX - 20) {
            const freeSlot = scene.queue.findIndex(id => id === null);
            if (freeSlot >= 0) {
              scene.queue[freeSlot] = c.id;
              c.queueSlot = freeSlot;
              c.phase = 'queuing';
            } else {
              // Queue full — let them walk by naturally; walk-off handler counts walkedBy.
              c.willStop = false;
            }
          } else if (c.x > viewW + 60) {
            if (!c.decided) {
              state.todayStats.walkedBy++;
              play('walkby');
            }
            c.phase = 'leaving';
          }
        } else if (c.phase === 'queuing') {
          // Walk to the assigned slot position, then start considering.
          const targetX = shopX + SLOT_OFFSETS[c.queueSlot!];
          c.x = Math.min(c.x + c.vx * 0.5 * dt, targetX);
          if (c.x >= targetX) {
            c.x = targetX;
            c.phase = 'considering';
            c.considerUntil = now + 1500 + Math.random() * 1500;
            const dec = decide(state, c);
            applyOutcome(state, c, dec);
            if (dec.buy) {
              // Buyers can't judge the cup until they sip it — hold their taste
              // reaction (praise or gripe) until they walk off, for both happy
              // and unhappy alike. applyOutcome parked it on postSaleReaction.
              c.thought = null;
            } else {
              c.thought = dec.thought;
              c.thoughtUntil = c.considerUntil;
            }
          }
        } else if (c.phase === 'considering') {
          if (now >= c.considerUntil) {
            // Free the queue slot so the next customer can step in.
            if (c.queueSlot !== null) {
              scene.queue[c.queueSlot] = null;
              c.queueSlot = null;
            }
            c.phase = c.hasBought ? 'buying' : 'leaving';
            if (!c.hasBought) state.todayStats.walkedBy++;
          }
        } else if (c.phase === 'buying') {
          c.x += c.vx * 0.5 * dt;
          if (now >= c.considerUntil + 600) {
            c.phase = 'leaving';
            // The cup's been sipped — now they react. Praise or gripe, the bubble
            // and the taste-reaction hype both land here (not on the coin), so the
            // meter moves when they actually voice it. A matching sound plays
            // either way: a warm chime for a satisfied buyer, a grumble for a
            // letdown — so positive feedback is as audible as negative.
            if (c.postSaleReaction) {
              c.thought = c.postSaleReaction;
              c.thoughtUntil = now + 1800;
              c.postSaleReaction = null;
              if (c.postSaleHype !== 0) applyHype(state, c.postSaleHype);
              if (c.postSaleHype < 0) play('grumble');
              else if (c.postSaleHype > 0) play('praise');
            }
          }
        } else if (c.phase === 'leaving') {
          c.x += c.vx * dt;
        }
      }

      scene.customers = scene.customers.filter(c => c.x < viewW + 80);
    }

    // Always update lastFrame so unpause doesn't cause a dt spike
    scene.lastFrame = now;

    // Draw
    drawBackground(ctx, viewW, viewH, state.weather.condition, timeOfDay, elapsed);
    drawShop(ctx, shopX, shopY, 120, 110);

    // Menu sandwich-board sign on the sidewalk to the right of the shop
    const signCx = shopX + 120 + 60;
    const signBase = shopY + 110 + 16;
    const curRecipe = activeRecipe(state);
    drawMenuSign(ctx, signCx, signBase, curRecipe.name, formatCents(activeCupPrice(state)), curRecipe.type === 'iced');

    for (const c of scene.customers) {
      c.sprite.draw(ctx, c.x, c.y, now);
      if (c.phase === 'buying') {
        ctx.save();
        ctx.font = '18px serif';
        ctx.fillText('💰', c.x + 18, c.y - 18);
        ctx.restore();
      }
    }

    // Freeze thought bubble expiry timestamps while paused
    const renderNow = scene.paused && scene.pausedAt !== null ? scene.pausedAt : now;
    renderThoughtBubbles(wrap, scene.customers, viewW, viewH, renderNow);

    // Low/out-of-stock warning: a bubble over the shop, plus a one-shot sound the
    // first time we cross into "low". The HUD counter is recolored in updateHud.
    const { level: stock } = stockStatus(state);
    if (stock !== scene.stockLevel) {
      if (stock === 'low') play('lowstock');
      scene.stockLevel = stock;
    }
    const warnScaleX = viewW > 0 ? wrap.clientWidth / viewW : 1;
    const warnScaleY = viewH > 0 ? wrap.clientHeight / viewH : 1;
    // Anchor just above the awning (which rises ~18px above shopY) so the tail clears it.
    renderShopWarning(wrap, stock, (shopX + 60) * warnScaleX, (shopY - 32) * warnScaleY);

    // Update HUD counters
    updateHud(root, state);
    updateHypeChip(hudHost, state.hype);

    scene.rafId = requestAnimationFrame(tick);
  }

  scene.rafId = requestAnimationFrame(tick);

  // Teardown
  return () => {
    scene.running = false;
    if (scene.rafId !== null) cancelAnimationFrame(scene.rafId);
    resizeObs.disconnect();
    setMenuOpener(null);
    // Remove any leftover thought bubbles and the shop warning
    wrap.querySelectorAll('.thought-bubble').forEach(b => b.remove());
    wrap.querySelector('.shop-warning')?.remove();
  };
}

// Hype awarded at the coin for any completed sale, regardless of taste — the
// intrinsic buzz of converting a passerby. It's split out of the customer's net
// (dec.hypeDelta); the remainder lands later as their taste reaction on walk-off
// (e.g. a +2 "good value" buyer is +1 here and +1 when they voice the praise).
// Kept small so the taste reaction stays the dominant signal — raising it shifts
// the satisfied/unhappy break-even and makes the game easier.
const PURCHASE_HYPE = 1;

function applyOutcome(state: GameState, c: Customer, dec: ReturnType<typeof decide>): void {
  c.decided = true;
  if (dec.buy) {
    const ok = consumeRecipe(state);
    if (ok) {
      state.cash += activeCupPrice(state);
      state.todayStats.sold++;
      state.todayStats.revenue += activeCupPrice(state);
      c.hasBought = true;
      // Cha-ching: every sale gets the money sound the moment they pay.
      play('coin');
      // A completed sale is a little buzz on its own, regardless of taste — so
      // every purchase nudges hype up by PURCHASE_HYPE right here at the coin.
      // The rest of the customer's net hype (dec.hypeDelta) is the *taste*
      // reaction, deferred to when they voice it on walk-off. Splitting it this
      // way keeps each outcome's TOTAL identical to dec.hypeDelta — the bump is
      // a re-timing, not a buff — while making the meter tick up on the sale and
      // (for a letdown) back down a beat later when they grumble.
      applyHype(state, PURCHASE_HYPE);
      if (dec.isHappy) {
        state.todayStats.happyCount++;
      } else {
        // Bought it, but the recipe disappointed them.
        state.todayStats.grumpyCount++;
        if (dec.complaintKey) bumpComplaint(state, dec.complaintKey);
      }
      c.postSaleReaction = dec.thought;
      c.postSaleHype = dec.hypeDelta - PURCHASE_HYPE;
    } else {
      // Lost the sale to sold-out between scoring and consumption
      c.thought = 'Sold out 🚫';
      state.todayStats.grumpyCount++;
      bumpComplaint(state, 'Sold out');
      applyHype(state, -2);
      play('grumble');
    }
  } else {
    state.todayStats.grumpyCount += dec.hypeDelta < 0 ? 1 : 0;
    if (dec.complaintKey) bumpComplaint(state, dec.complaintKey);
    if (dec.hypeDelta !== 0) applyHype(state, dec.hypeDelta);
    if (dec.hypeDelta < 0) play('grumble');
  }
}

function bumpComplaint(state: GameState, key: string): void {
  state.todayStats.complaints[key] = (state.todayStats.complaints[key] ?? 0) + 1;
}

function renderThoughtBubbles(wrap: HTMLElement, customers: Customer[], viewW: number, viewH: number, now: number): void {
  // Map of existing bubbles by customer id
  const existing = new Map<string, HTMLElement>();
  wrap.querySelectorAll<HTMLElement>('.thought-bubble').forEach(el => {
    existing.set(el.dataset.cid!, el);
  });

  const seen = new Set<string>();
  // Customer coordinates are already in logical (CSS) pixels, matching the wrap.
  const scaleX = viewW > 0 ? wrap.clientWidth / viewW : 1;
  const scaleY = viewH > 0 ? wrap.clientHeight / viewH : 1;
  for (const c of customers) {
    if (!c.thought || now >= c.thoughtUntil) continue;
    const id = String(c.id);
    seen.add(id);
    let el = existing.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'thought-bubble';
      el.dataset.cid = id;
      wrap.appendChild(el);
    }
    el.textContent = c.thought;
    el.style.left = `${c.x * scaleX}px`;
    el.style.top = `${(c.y - 30) * scaleY}px`;
  }
  for (const [id, el] of existing) {
    if (!seen.has(id)) el.remove();
  }
}

// Single global warning bubble pinned above the shop. Kept separate from the
// per-customer `.thought-bubble` elements so renderThoughtBubbles doesn't reap it.
function renderShopWarning(wrap: HTMLElement, level: StockLevel, x: number, y: number): void {
  let el = wrap.querySelector<HTMLElement>('.shop-warning');
  if (level === 'ok') {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.className = 'shop-warning';
    wrap.appendChild(el);
  }
  el.textContent = level === 'out' ? '🚫 Sold out!' : '⚠️ Low on cups!';
  el.classList.toggle('danger', level === 'out');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function updateHud(root: HTMLElement, state: GameState): void {
  const cashEl = root.querySelector('#header-cash');
  if (cashEl) cashEl.textContent = formatCents(state.cash);
  const cupsLeftEl = root.querySelector('#cups-left');
  if (cupsLeftEl) {
    const { cupsLeft, level } = stockStatus(state);
    cupsLeftEl.textContent = String(cupsLeft);
    cupsLeftEl.classList.toggle('low', level === 'low');
    cupsLeftEl.classList.toggle('out', level === 'out');
  }
  const soldEl = root.querySelector('#sold-count');
  if (soldEl) soldEl.textContent = String(state.todayStats.sold);
  const wbEl = root.querySelector('#walkby-count');
  if (wbEl) wbEl.textContent = String(state.todayStats.walkedBy);
}

function showReportCard(state: GameState, cb: StreetPhaseCallbacks): void {
  const hypeDelta = state.hype - state.todayStats.hypeStart;
  const complaints = Object.entries(state.todayStats.complaints).sort((a, b) => b[1] - a[1]);
  const topComplaint = complaints.length > 0 ? `${complaints[0][0]} (${complaints[0][1]}x)` : '—';
  const tomorrow = state.tomorrowWeather;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal">
      <h2>End of Day ${state.day}</h2>
      <div class="row"><span>Cups sold</span><strong>${state.todayStats.sold}</strong></div>
      <div class="row"><span>Revenue</span><strong>${formatCents(state.todayStats.revenue)}</strong></div>
      <div class="row"><span>Walk-bys</span><strong>${state.todayStats.walkedBy}</strong></div>
      <div class="row"><span>Happy customers</span><strong>${state.todayStats.happyCount}</strong></div>
      <div class="row"><span>Grumpy customers</span><strong>${state.todayStats.grumpyCount}</strong></div>
      <div class="row"><span>Top complaint</span><strong>${topComplaint}</strong></div>
      <div class="row"><span>Hype change</span><strong>${hypeDelta >= 0 ? '+' : ''}${hypeDelta} (now ${Math.round(state.hype)})</strong></div>
      <div class="row"><span>Tomorrow</span><strong>${weatherEmoji(tomorrow.condition)} ${tomorrow.tempC}°C ${tomorrow.condition}</strong></div>
      <div class="actions">
        <button id="continue-btn" class="success">Continue ▶</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#continue-btn')?.addEventListener('click', () => {
    modal.remove();
    cb.onCloseShop();
  });
}
