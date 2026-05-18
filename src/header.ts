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

let lastHype = -1;
export function renderHypeMeter(host: HTMLElement, hype: number): void {
  const pulse = lastHype >= 0 && Math.abs(hype - lastHype) >= 1;
  lastHype = hype;
  host.innerHTML = `
    <div class="hype-meter ${pulse ? 'pulse' : ''}">
      <div class="label"><span>Hype</span><span>${Math.round(hype)}</span></div>
      <div class="bar"><div class="fill" style="width:${hype}%"></div></div>
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
