// Shared settings rows (Theme / Sound / Fullscreen) used by both the in-game
// pause menu and the title screen's Options pane. Renders directly into the
// passed host element and returns a teardown that unhooks the document-level
// fullscreenchange listener.
//
// state is optional so the title screen can render the same controls without
// needing a GameState in scope. When state is provided, the sound toggle also
// keeps state.muted in sync so it persists into a future save.

import { GameState } from '../state';
import { THEMES, ThemeId, getTheme, setTheme } from '../themes/themes';
import { isMuted, setMuted } from '../platform/audio';
import {
  isFullscreen,
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from '../platform/fullscreen';

export interface SettingsRowsOpts {
  state?: GameState;
}

export function renderSettingsRows(host: HTMLElement, opts: SettingsRowsOpts = {}): () => void {
  const themeOptions = THEMES.map(
    t => `<option value="${t.id}" ${t.id === getTheme() ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  host.innerHTML = `
    <div class="pause-row">
      <label for="settings-theme-select">Theme</label>
      <select id="settings-theme-select" class="theme-select">${themeOptions}</select>
    </div>
    <div class="pause-row">
      <label for="settings-mute-btn">Sound</label>
      <button id="settings-mute-btn" class="secondary">${isMuted() ? '🔇 Muted' : '🔊 On'}</button>
    </div>
    ${isFullscreenSupported() ? `
    <div class="pause-row">
      <label for="settings-fullscreen-btn">Fullscreen</label>
      <button id="settings-fullscreen-btn" class="secondary">${isFullscreen() ? '⛶ Exit' : '⛶ Enter'}</button>
    </div>
    ` : ''}
  `;

  // Theme: applies immediately.
  const sel = host.querySelector<HTMLSelectElement>('#settings-theme-select');
  sel?.addEventListener('change', () => {
    setTheme(sel.value as ThemeId);
  });

  // Sound: toggles immediately, and keeps state.muted in sync if a state was
  // provided (so the persisted save reflects the toggle the next time around).
  const muteBtn = host.querySelector<HTMLButtonElement>('#settings-mute-btn');
  muteBtn?.addEventListener('click', () => {
    setMuted(!isMuted());
    if (opts.state) opts.state.muted = isMuted();
    muteBtn.textContent = isMuted() ? '🔇 Muted' : '🔊 On';
  });

  // Fullscreen: toggles immediately. Label tracks real state via the
  // fullscreenchange event so the browser's own Esc/F11 stays in sync.
  let cleanupFs: (() => void) | null = null;
  const fsBtn = host.querySelector<HTMLButtonElement>('#settings-fullscreen-btn');
  if (fsBtn) {
    const sync = (): void => {
      fsBtn.textContent = isFullscreen() ? '⛶ Exit' : '⛶ Enter';
    };
    fsBtn.addEventListener('click', () => { void toggleFullscreen(); });
    cleanupFs = onFullscreenChange(sync);
  }

  return () => {
    cleanupFs?.();
  };
}
