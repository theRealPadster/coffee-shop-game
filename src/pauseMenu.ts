import { GameState } from './state';
import { paneModal, alertModal, confirmModal } from './ui';
import { THEMES, ThemeId, getTheme, setTheme } from './themes';
import { isMuted, setMuted } from './audio';
import { saveGame, loadGame, clearSave } from './save';
import { play } from './audio';
import { isFullscreen, isFullscreenSupported, onFullscreenChange, toggleFullscreen } from './fullscreen';

export interface PauseMenuOpts {
  state: GameState;
  onRestore: (s: GameState) => void;
  onReset: () => void;
}

/**
 * Pause / settings menu. Opened from the header pause button or Esc.
 * Settings (theme, sound) apply immediately without closing the pane.
 * Game actions (save, restore, reset) close the pane and run their existing
 * confirm/alert flows.
 */
export function openPauseMenu(opts: PauseMenuOpts): Promise<void> {
  return paneModal({
    title: 'Paused',
    className: 'pause-pane',
    body: (host, close) => {
      const themeOptions = THEMES.map(
        t => `<option value="${t.id}" ${t.id === getTheme() ? 'selected' : ''}>${t.label}</option>`
      ).join('');

      host.innerHTML = `
        <section class="pause-section">
          <h3>Settings</h3>
          <div class="pause-row">
            <label for="pause-theme-select">Theme</label>
            <select id="pause-theme-select" class="theme-select">${themeOptions}</select>
          </div>
          <div class="pause-row">
            <label for="pause-mute-btn">Sound</label>
            <button id="pause-mute-btn" class="secondary">${isMuted() ? '🔇 Muted' : '🔊 On'}</button>
          </div>
          ${isFullscreenSupported() ? `
          <div class="pause-row">
            <label for="pause-fullscreen-btn">Fullscreen</label>
            <button id="pause-fullscreen-btn" class="secondary">${isFullscreen() ? '⛶ Exit' : '⛶ Enter'}</button>
          </div>
          ` : ''}
        </section>
        <section class="pause-section">
          <h3>Game</h3>
          <div class="game-actions">
            <button id="pause-save-btn" class="secondary">💾 Save</button>
            <button id="pause-restore-btn" class="secondary">↩ Restore</button>
            <button id="pause-reset-btn" class="danger">⟲ Reset</button>
          </div>
        </section>
      `;

      // Theme: applies immediately, pane stays open.
      const sel = host.querySelector<HTMLSelectElement>('#pause-theme-select');
      sel?.addEventListener('change', () => {
        setTheme(sel.value as ThemeId);
      });

      // Sound: toggles immediately, pane stays open.
      const muteBtn = host.querySelector<HTMLButtonElement>('#pause-mute-btn');
      muteBtn?.addEventListener('click', () => {
        setMuted(!isMuted());
        opts.state.muted = isMuted();
        muteBtn.textContent = isMuted() ? '🔇 Muted' : '🔊 On';
      });

      // Fullscreen: toggles immediately, pane stays open. The label tracks the
      // real fullscreen state via fullscreenchange (covers Esc, F11, etc.).
      const fsBtn = host.querySelector<HTMLButtonElement>('#pause-fullscreen-btn');
      if (fsBtn) {
        const syncFsLabel = (): void => {
          fsBtn.textContent = isFullscreen() ? '⛶ Exit' : '⛶ Enter';
        };
        fsBtn.addEventListener('click', () => { void toggleFullscreen(); });
        const off = onFullscreenChange(syncFsLabel);
        // paneModal resolves on close — the host is detached then, so listener
        // cleanup happens via host's removal; but onFullscreenChange holds a
        // document-level listener, so unhook it explicitly when the row dies.
        const observer = new MutationObserver(() => {
          if (!document.body.contains(fsBtn)) {
            off();
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }

      // Game actions: close the pane first so the follow-up modal owns Esc.
      host.querySelector<HTMLButtonElement>('#pause-save-btn')?.addEventListener('click', () => {
        close();
        const ok = saveGame(opts.state);
        play('cashier');
        void alertModal(ok
          ? { title: 'Game saved', message: 'Your progress has been saved to this browser.' }
          : { title: 'Save failed', message: 'Your game could not be saved. Your browser may be blocking storage.' });
      });

      host.querySelector<HTMLButtonElement>('#pause-restore-btn')?.addEventListener('click', async () => {
        close();
        const restored = loadGame();
        if (!restored) {
          await alertModal({ title: 'No saved game', message: 'There is no saved game to restore yet.' });
          return;
        }
        const ok = await confirmModal({
          title: 'Restore saved game?',
          message: 'This loads your last saved game and discards any progress since then. This cannot be undone.',
          confirmLabel: '↩ Restore',
          cancelLabel: 'Cancel',
          danger: true,
        });
        if (!ok) return;
        opts.onRestore(restored);
      });

      host.querySelector<HTMLButtonElement>('#pause-reset-btn')?.addEventListener('click', async () => {
        close();
        const ok = await confirmModal({
          title: 'Reset game?',
          message: 'This starts a brand-new game and erases your saved progress. This cannot be undone.',
          confirmLabel: '⟲ Reset',
          cancelLabel: 'Cancel',
          danger: true,
        });
        if (!ok) return;
        clearSave();
        opts.onReset();
      });
    },
  });
}
