import { GameState, formatCents } from './state';
import { isMuted, setMuted } from './audio';
import { THEMES, ThemeId, getTheme, setTheme } from './themes';

export interface HeaderOpts {
  center?: string;
  rightExtra?: string;
}

export function appHeaderHtml(state: GameState, opts: HeaderOpts = {}): string {
  const currentTheme = getTheme();
  const themeOptions = THEMES.map(
    t => `<option value="${t.id}" ${t.id === currentTheme ? 'selected' : ''}>${t.label}</option>`
  ).join('');
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
        <select id="header-theme-select" class="theme-select" title="Theme">${themeOptions}</select>
        <button id="header-mute-btn" class="secondary" title="Toggle sound">${isMuted() ? '🔇' : '🔊'}</button>
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

export function attachHeaderMute(root: HTMLElement, state: GameState): void {
  root.querySelector('#header-mute-btn')?.addEventListener('click', () => {
    setMuted(!isMuted());
    state.muted = isMuted();
    const btn = root.querySelector('#header-mute-btn');
    if (btn) btn.textContent = isMuted() ? '🔇' : '🔊';
  });
}

export function attachHeaderTheme(root: HTMLElement): void {
  const sel = root.querySelector<HTMLSelectElement>('#header-theme-select');
  sel?.addEventListener('change', () => {
    setTheme(sel.value as ThemeId);
  });
}
