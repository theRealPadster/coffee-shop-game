import { GameState, formatCents } from './state';

export interface HeaderOpts {
  center?: string;
  rightExtra?: string;
}

export function appHeaderHtml(state: GameState, opts: HeaderOpts = {}): string {
  return `
    <div class="app-header">
      <div class="hdr-left">
        <span class="day-title">☕ Day ${state.day}</span>
        <div class="stat"><span class="v" id="header-cash">${formatCents(state.cash)}</span><span>Cash</span></div>
        <div id="hype-meter-host"></div>
      </div>
      <div class="hdr-center">${opts.center ?? ''}</div>
      <div class="hdr-right">
        ${opts.rightExtra ?? ''}
        <button id="header-menu-btn" class="secondary" title="Menu (Esc)" aria-label="Open menu">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <rect x="3" y="2" width="3.5" height="12" rx="1.25" fill="currentColor"/>
            <rect x="9.5" y="2" width="3.5" height="12" rx="1.25" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

let lastHype: number | null = null;
export function renderHypeMeter(host: HTMLElement, hype: number): void {
  const pulse = lastHype !== null && Math.abs(hype - lastHype) >= 1;
  lastHype = hype;
  // The bar grows from the center: positive fills to the right, negative to the
  // left. Width is clamped to the [-100, 100] visual range, but the label shows
  // the true (uncapped) value.
  const display = Math.max(-100, Math.min(100, hype));
  const half = Math.abs(display) / 2; // % of the full bar (max 50)
  const fillStyle = display >= 0
    ? `left:50%; width:${half}%; background:var(--good);`
    : `right:50%; width:${half}%; background:var(--bad);`;
  host.innerHTML = `
    <div class="hype-meter ${pulse ? 'pulse' : ''}">
      <div class="label"><span>Hype</span><span>${Math.round(hype)}</span></div>
      <div class="bar"><div class="fill" style="${fillStyle}"></div></div>
    </div>
  `;
}

export function attachHeaderMenu(root: HTMLElement, onOpen: () => void): void {
  root.querySelector('#header-menu-btn')?.addEventListener('click', onOpen);
}
