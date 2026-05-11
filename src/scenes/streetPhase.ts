import { GameState, formatCents, freshStats } from '../state';
import { drawBackground, drawShop } from '../render';
import { weatherEmoji } from '../weather';
import { spawnCustomer, decide, spawnRate, Customer } from '../customers';
import { applyHype } from '../hype';
import { consumeRecipe, maxCups } from '../recipe';
import { play, isMuted, setMuted } from '../audio';

export interface StreetPhaseCallbacks {
  onCloseShop: () => void; // user clicked close; scene will show report card then call cb
  onStateChange: () => void;
}

interface SceneState {
  customers: Customer[];
  lastSpawn: number;
  running: boolean;
  rafId: number | null;
  lastFrame: number | null;
}

export function renderStreetPhase(root: HTMLElement, state: GameState, cb: StreetPhaseCallbacks): () => void {
  // Reset today's stats at the start of the day
  state.todayStats = freshStats(state.hype);

  root.innerHTML = `
    <div class="street-phase">
      <div class="street-hud">
        <div class="stat"><span class="v">${formatCents(state.cash)}</span><span>Cash</span></div>
        <div class="stat"><span class="v" id="cups-left">${maxCups(state.stock, state.activeRecipe)}</span><span>Cups left</span></div>
        <div class="stat"><span class="v" id="sold-count">0</span><span>Sold</span></div>
        <div class="stat"><span class="v" id="walkby-count">0</span><span>Walk-bys</span></div>
        <div class="recipe-badge ${state.activeRecipe.type === 'iced' ? 'iced' : ''}">
          ${state.activeRecipe.type === 'hot' ? '☕' : '🧊'} ${state.activeRecipe.name}
        </div>
        <div id="hype-meter-host"></div>
        <div class="right">
          <label style="font-size:12px;">Cup price
            <input id="hud-cup-price" type="number" min="0" step="0.25" value="${(state.cupPrice / 100).toFixed(2)}" style="width:80px;" />
          </label>
          <span>${weatherEmoji(state.weather.condition)} ${state.weather.tempC}°C</span>
          <button id="hud-mute" class="secondary">${isMuted() ? '🔇' : '🔊'}</button>
          <button id="close-shop-btn" class="danger">Close Shop</button>
        </div>
      </div>
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

  const scene: SceneState = {
    customers: [],
    lastSpawn: performance.now(),
    running: true,
    rafId: null,
    lastFrame: null,
  };

  // Cup price hud control
  root.querySelector<HTMLInputElement>('#hud-cup-price')?.addEventListener('change', (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v >= 0) {
      state.cupPrice = Math.round(v * 100);
      cb.onStateChange();
    }
  });

  root.querySelector('#hud-mute')?.addEventListener('click', () => {
    setMuted(!isMuted());
    const btn = root.querySelector('#hud-mute');
    if (btn) btn.textContent = isMuted() ? '🔇' : '🔊';
  });

  root.querySelector('#close-shop-btn')?.addEventListener('click', () => {
    if (scene.running) {
      scene.running = false;
      if (scene.rafId !== null) cancelAnimationFrame(scene.rafId);
      play('bell');
      showReportCard(root, state, cb);
    }
  });

  function tick(now: number): void {
    if (!scene.running) return;
    const dt = Math.min(0.1, (now - (scene.lastFrame ?? now)) / 1000);
    scene.lastFrame = now;

    // Spawn
    const sps = spawnRate(state);
    const since = (now - scene.lastSpawn) / 1000;
    if (since >= 1 / sps) {
      scene.lastSpawn = now;
      scene.customers.push(spawnCustomer(state, canvas.width, canvas.height));
    }

    // Update
    const shopX = canvas.width * 0.5 - 60;
    for (const c of scene.customers) {
      if (c.phase === 'walking') {
        c.x += c.vx * dt;
        if (c.willStop && !c.decided && c.x > shopX + 20 && c.x < shopX + 60) {
          c.phase = 'considering';
          c.considerUntil = now + 1500 + Math.random() * 1500;
          const dec = decide(state, c);
          c.thought = dec.thought;
          c.thoughtUntil = c.considerUntil;
          // Apply outcome now so other customers see updated hype/stock
          applyOutcome(state, c, dec);
        } else if (c.x > canvas.width + 60) {
          // walked off screen without stopping
          if (!c.decided && c.phase === 'walking') {
            state.todayStats.walkedBy++;
            play('walkby');
          }
          c.phase = 'leaving';
        }
      } else if (c.phase === 'considering') {
        // Pause; thought bubble shown via DOM overlay
        if (now >= c.considerUntil) {
          c.phase = c.hasBought ? 'buying' : 'leaving';
          if (!c.hasBought) {
            state.todayStats.walkedBy++;
          }
        }
      } else if (c.phase === 'buying') {
        // Show "bought" indicator briefly then walk off
        c.x += c.vx * 0.5 * dt;
        if (now >= c.considerUntil + 600) {
          c.phase = 'leaving';
        }
      } else if (c.phase === 'leaving') {
        c.x += c.vx * dt;
      }
    }

    scene.customers = scene.customers.filter(c => c.x < canvas.width + 80);

    // Draw
    drawBackground(ctx, canvas.width, canvas.height, state.weather.condition);
    drawShop(ctx, canvas.width * 0.5 - 60, canvas.height * 0.45, 120, 110);

    for (const c of scene.customers) {
      c.sprite.draw(ctx, c.x, c.y, now);
      if (c.phase === 'buying') {
        ctx.save();
        ctx.font = '18px serif';
        ctx.fillText('💰', c.x + 18, c.y - 18);
        ctx.restore();
      }
    }

    // Update thought bubble overlays
    renderThoughtBubbles(wrap, scene.customers, canvas, now);

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
  const cashEl = root.querySelector('.street-hud .stat:nth-child(1) .v');
  if (cashEl) cashEl.textContent = formatCents(state.cash);
  const cupsLeftEl = root.querySelector('#cups-left');
  if (cupsLeftEl) cupsLeftEl.textContent = String(maxCups(state.stock, state.activeRecipe));
  const soldEl = root.querySelector('#sold-count');
  if (soldEl) soldEl.textContent = String(state.todayStats.sold);
  const wbEl = root.querySelector('#walkby-count');
  if (wbEl) wbEl.textContent = String(state.todayStats.walkedBy);
}

let lastHype = -1;
function renderHypeMeter(host: HTMLElement, hype: number): void {
  const pulse = lastHype >= 0 && Math.abs(hype - lastHype) >= 1;
  lastHype = hype;
  host.innerHTML = `
    <div class="hype-meter ${pulse ? 'pulse' : ''}">
      <div class="label"><span>Hype</span><span>${Math.round(hype)}</span></div>
      <div class="bar"><div class="fill" style="width:${hype}%"></div></div>
    </div>
  `;
}

function showReportCard(_root: HTMLElement, state: GameState, cb: StreetPhaseCallbacks): void {
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
