import { GameState, formatCents } from '../state';

export interface HeaderOpts {
  variant: 'buy' | 'street';
  center?: string;
  rightExtra?: string;
}

export function appHeaderHtml(state: GameState, opts: HeaderOpts): string {
  return `
    <div class="app-header app-header--${opts.variant}">
      <div class="hdr-left">
        <span class="day-title">☕ Day ${state.day}</span>
        <div class="stat"><span class="v" id="header-cash">${formatCents(state.cash)}</span><span>Cash</span></div>
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

export function attachHeaderMenu(root: HTMLElement, onOpen: () => void): void {
  root.querySelector('#header-menu-btn')?.addEventListener('click', onOpen);
}
