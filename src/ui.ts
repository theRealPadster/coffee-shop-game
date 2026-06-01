// Small UI helpers shared across scenes.

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // style the confirm button as destructive
}

// A styled in-game confirmation dialog matching the game's modal aesthetic.
// Resolves true if the user confirms, false if they cancel or dismiss.
export function confirmModal(opts: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true">
        <h2>${opts.title}</h2>
        <p class="modal-message">${opts.message}</p>
        <div class="actions">
          <button class="secondary" data-action="cancel">${opts.cancelLabel ?? 'Cancel'}</button>
          <button class="${opts.danger ? 'danger' : 'success'}" data-action="confirm">${opts.confirmLabel ?? 'Confirm'}</button>
        </div>
      </div>
    `;

    function close(result: boolean): void {
      window.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') close(true);
    }

    backdrop.querySelector('[data-action="confirm"]')?.addEventListener('click', () => close(true));
    backdrop.querySelector('[data-action="cancel"]')?.addEventListener('click', () => close(false));
    // Click outside the dialog cancels.
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close(false);
    });
    window.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);
    backdrop.querySelector<HTMLButtonElement>('[data-action="confirm"]')?.focus();
  });
}
