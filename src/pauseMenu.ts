import { GameState } from './state';
import { paneModal, alertModal, confirmModal } from './ui';
import { saveGame, loadGame } from './save';
import { play } from './audio';
import { renderSettingsRows } from './settingsRows';
import { openHowToPlay } from './howToPlay';

export interface PauseMenuOpts {
  state: GameState;
  onRestore: (s: GameState) => void;
  onQuitToTitle: () => void;
}

/**
 * Pause / settings menu. Opened from the header pause button or Esc.
 *
 * Layout:
 *   - Settings — theme / sound / fullscreen / how-to-play (all "reference"
 *     controls that don't touch game state, rendered by renderSettingsRows
 *     so the title-screen Options pane shares the same controls).
 *   - Game — just Save and Restore now (paired save-state actions). The
 *     previous "Reset" option was removed; the title-screen "New Game" path
 *     covers the wipe-and-restart case and now also calls clearSave().
 *   - A prominent full-width Quit-to-Main-Menu button at the bottom — it's
 *     the navigation action that exits the overlay, and it earns a row of
 *     its own instead of hiding in a flex-wrap cluster with Save/Restore.
 *
 * Settings apply immediately without closing the pane. Game actions and
 * the Quit button close the pane first so the follow-up confirm/alert
 * modal owns Esc.
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
          <div class="pause-row">
            <label for="pause-howto-btn">How to Play</label>
            <button id="pause-howto-btn" class="secondary">📖 Open</button>
          </div>
        </section>
        <section class="pause-section">
          <h3>Game</h3>
          <div class="game-actions">
            <button id="pause-save-btn" class="secondary">💾 Save</button>
            <button id="pause-restore-btn" class="secondary">↩ Restore</button>
          </div>
        </section>
        <button id="pause-quit-btn" class="pause-quit-btn">🏠 Quit to Main Menu</button>
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

      // How to Play — reference info, opens a separate static pane.
      host.querySelector<HTMLButtonElement>('#pause-howto-btn')?.addEventListener('click', () => {
        close();
        void openHowToPlay();
      });

      // Save: closes the pane and shows a brief result alert.
      host.querySelector<HTMLButtonElement>('#pause-save-btn')?.addEventListener('click', () => {
        close();
        const ok = saveGame(opts.state);
        play('cashier');
        void alertModal(ok
          ? { title: 'Game saved', message: 'Your progress has been saved to this browser.' }
          : { title: 'Save failed', message: 'Your game could not be saved. Your browser may be blocking storage.' });
      });

      // Restore: confirm before discarding in-memory progress.
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

      // Quit to Main Menu — the prominent bottom action. Saved game is kept
      // (the title's "Continue" still loads it); only in-memory progress
      // since the last Save is lost.
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
    },
  });
}
