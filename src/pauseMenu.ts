import { GameState } from './state';
import { paneModal, alertModal, confirmModal } from './ui';
import { saveGame, loadGame, clearSave } from './save';
import { play } from './audio';
import { renderSettingsRows } from './settingsRows';
import { openHowToPlay } from './howToPlay';

export interface PauseMenuOpts {
  state: GameState;
  onRestore: (s: GameState) => void;
  onReset: () => void;
  onQuitToTitle: () => void;
}

/**
 * Pause / settings menu. Opened from the header pause button or Esc.
 * Settings (theme, sound, fullscreen) apply immediately without closing the
 * pane — they're rendered by the shared renderSettingsRows helper so the
 * title screen's Options pane shows the same controls.
 *
 * Game actions (save, restore, reset, quit to title) close the pane and
 * run their own follow-up confirm/alert flows.
 */
export function openPauseMenu(opts: PauseMenuOpts): Promise<void> {
  return paneModal({
    title: 'Paused',
    className: 'pause-pane',
    body: (host, close) => {
      host.innerHTML = `
        <section class="pause-section">
          <h3>Settings</h3>
          <div id="pause-settings-host"></div>
        </section>
        <section class="pause-section">
          <h3>Game</h3>
          <div class="game-actions">
            <button id="pause-save-btn" class="secondary">💾 Save</button>
            <button id="pause-restore-btn" class="secondary">↩ Restore</button>
            <button id="pause-howto-btn" class="secondary">📖 How to Play</button>
            <button id="pause-quit-btn" class="secondary">🏠 Quit to Main Menu</button>
            <button id="pause-reset-btn" class="danger">⟲ Reset</button>
          </div>
        </section>
      `;

      // Settings rows: theme / sound / fullscreen. Shared with title Options.
      const settingsHost = host.querySelector<HTMLElement>('#pause-settings-host')!;
      const settingsTeardown = renderSettingsRows(settingsHost, { state: opts.state });
      // paneModal removes the host on close; clean up listeners then.
      const observer = new MutationObserver(() => {
        if (!document.body.contains(settingsHost)) {
          settingsTeardown();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

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

      host.querySelector<HTMLButtonElement>('#pause-howto-btn')?.addEventListener('click', () => {
        close();
        void openHowToPlay();
      });

      host.querySelector<HTMLButtonElement>('#pause-quit-btn')?.addEventListener('click', async () => {
        close();
        const ok = await confirmModal({
          title: 'Quit to main menu?',
          message: 'Any progress since your last Save will be lost. Your saved game (if any) is kept.',
          confirmLabel: '🏠 Quit to Menu',
          cancelLabel: 'Cancel',
          danger: true,
        });
        if (!ok) return;
        opts.onQuitToTitle();
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
