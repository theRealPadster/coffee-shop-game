import { GameState, formatCents, freshStats, activeRecipe } from '../state';
import { drawBackground, drawShop, drawMenuSign } from '../render';
import { weatherEmoji } from '../weather';
import { spawnCustomer, decide, spawnRate, Customer } from '../customers';
import { applyHype } from '../hype';
import { consumeRecipe, maxCups } from '../recipe';
import { play } from '../audio';
import { appHeaderHtml, renderHypeMeter, attachHeaderMute } from '../header';

export interface StreetPhaseCallbacks {
  onCloseShop: () => void;
  onStateChange: () => void;
}

// Real-time length of one game day (8:00 → 20:00)
const DAY_DURATION_MS = 90 * 1000; // 90 seconds

// Queue slots: x offsets from shopX where customers stand and wait
const SLOT_OFFSETS = [10, 70, 130] as const;

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
}

export function renderStreetPhase(root: HTMLElement, state: GameState, cb: StreetPhaseCallbacks): () => void {
  // Reset today's stats at the start of the day
  state.todayStats = freshStats(state.hype);

  const todayRecipe = activeRecipe(state);
  const headerCenter = `
    <div class="recipe-badge ${todayRecipe.type === 'iced' ? 'iced' : ''}">
      ${todayRecipe.type === 'hot' ? '☕' : '🧊'} ${todayRecipe.name}
    </div>
    <div class="stat"><span class="v" id="cups-left">${maxCups(state.stock, todayRecipe)}</span><span>Cups left</span></div>
    <div class="stat"><span class="v" id="sold-count">0</span><span>Sold</span></div>
    <div class="stat"><span class="v" id="walkby-count">0</span><span>Walk-bys</span></div>
    <div class="game-clock" id="game-clock">08:00</div>
    <span class="weather-chip">${weatherEmoji(state.weather.condition)} ${state.weather.tempC}°C</span>
  `;

  const headerRight = `
    <div class="cup-price-hud">
      <span class="cup-price-label">Cup price</span>
      <div class="cup-price-controls">
        <button id="cup-price-minus" class="secondary">−</button>
        <span id="cup-price-display">${formatCents(state.cupPrice)}</span>
        <button id="cup-price-plus" class="secondary">+</button>
      </div>
    </div>
    <button id="pause-btn" class="secondary">⏸</button>
    <button id="close-shop-btn" class="danger">Close Shop</button>
  `;

  root.innerHTML = `
    ${appHeaderHtml(state, { center: headerCenter, rightExtra: headerRight })}
    <div class="street-phase">
      <div class="street-canvas-wrap">
        <canvas id="street-canvas"></canvas>
      </div>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('#street-canvas')!;
  const wrap = root.querySelector<HTMLDivElement>('.street-canvas-wrap')!;
  const ctx = canvas.getContext('2d')!;
  const hudHost = root.querySelector<HTMLDivElement>('#hype-meter-host')!;
  renderHypeMeter(hudHost, state.hype);

  function resize(): void {
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
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
  };

  // Cup price ± buttons
  root.querySelector('#cup-price-minus')?.addEventListener('click', () => {
    state.cupPrice = Math.max(0, state.cupPrice - 25);
    const el = root.querySelector('#cup-price-display');
    if (el) el.textContent = formatCents(state.cupPrice);
    cb.onStateChange();
  });
  root.querySelector('#cup-price-plus')?.addEventListener('click', () => {
    state.cupPrice += 25;
    const el = root.querySelector('#cup-price-display');
    if (el) el.textContent = formatCents(state.cupPrice);
    cb.onStateChange();
  });

  // Pause / resume
  root.querySelector('#pause-btn')?.addEventListener('click', () => {
    const btn = root.querySelector<HTMLButtonElement>('#pause-btn');
    if (scene.paused) {
      if (scene.pausedAt !== null) {
        scene.totalPausedMs += performance.now() - scene.pausedAt;
        scene.pausedAt = null;
      }
      scene.paused = false;
      scene.lastFrame = null; // avoid a dt spike on first resumed frame
      if (btn) btn.textContent = '⏸';
    } else {
      scene.pausedAt = performance.now();
      scene.paused = true;
      if (btn) btn.textContent = '▶';
    }
  });

  attachHeaderMute(root, state);

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
    const shopX = canvas.width * 0.5 - 60;
    const shopY = canvas.height * 0.6 - 110; // bottom of shop = top of sidewalk

    if (!scene.paused) {
      const dt = Math.min(0.1, (now - (scene.lastFrame ?? now)) / 1000);

      // Spawn customers
      const sps = spawnRate(state);
      const since = (now - scene.lastSpawn) / 1000;
      if (since >= 1 / sps) {
        scene.lastSpawn = now;
        scene.customers.push(spawnCustomer(state, canvas.width, canvas.height));
      }

      // Update customer state machine
      for (const c of scene.customers) {
        if (c.phase === 'walking') {
          c.x += c.vx * dt;
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
          } else if (c.x > canvas.width + 60) {
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
            c.thought = dec.thought;
            c.thoughtUntil = c.considerUntil;
            applyOutcome(state, c, dec);
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
          if (now >= c.considerUntil + 600) c.phase = 'leaving';
        } else if (c.phase === 'leaving') {
          c.x += c.vx * dt;
        }
      }

      scene.customers = scene.customers.filter(c => c.x < canvas.width + 80);
    }

    // Always update lastFrame so unpause doesn't cause a dt spike
    scene.lastFrame = now;

    // Draw
    drawBackground(ctx, canvas.width, canvas.height, state.weather.condition, timeOfDay);
    drawShop(ctx, shopX, shopY, 120, 110);

    // Menu sandwich-board sign on the sidewalk to the right of the shop
    const signCx = shopX + 120 + 60;
    const signBase = shopY + 110 + 16;
    const curRecipe = activeRecipe(state);
    drawMenuSign(ctx, signCx, signBase, curRecipe.name, formatCents(state.cupPrice), curRecipe.type === 'iced');

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
    renderThoughtBubbles(wrap, scene.customers, canvas, renderNow);

    // Update HUD counters
    updateHud(root, state);
    renderHypeMeter(hudHost, state.hype);

    scene.rafId = requestAnimationFrame(tick);
  }

  scene.rafId = requestAnimationFrame(tick);

  // Teardown
  return () => {
    scene.running = false;
    if (scene.rafId !== null) cancelAnimationFrame(scene.rafId);
    resizeObs.disconnect();
    // Remove any leftover thought bubbles
    wrap.querySelectorAll('.thought-bubble').forEach(b => b.remove());
  };
}

function applyOutcome(state: GameState, c: Customer, dec: ReturnType<typeof decide>): void {
  c.decided = true;
  if (dec.buy) {
    const ok = consumeRecipe(state);
    if (ok) {
      state.cash += state.cupPrice;
      state.todayStats.sold++;
      state.todayStats.revenue += state.cupPrice;
      state.todayStats.happyCount++;
      c.hasBought = true;
      applyHype(state, dec.hypeDelta);
      play('coin');
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

function renderThoughtBubbles(wrap: HTMLElement, customers: Customer[], canvas: HTMLCanvasElement, now: number): void {
  // Map of existing bubbles by customer id
  const existing = new Map<string, HTMLElement>();
  wrap.querySelectorAll<HTMLElement>('.thought-bubble').forEach(el => {
    existing.set(el.dataset.cid!, el);
  });

  const seen = new Set<string>();
  const scaleX = wrap.clientWidth / canvas.width;
  const scaleY = wrap.clientHeight / canvas.height;
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

function updateHud(root: HTMLElement, state: GameState): void {
  const cashEl = root.querySelector('#header-cash');
  if (cashEl) cashEl.textContent = formatCents(state.cash);
  const cupsLeftEl = root.querySelector('#cups-left');
  if (cupsLeftEl) cupsLeftEl.textContent = String(maxCups(state.stock, activeRecipe(state)));
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
