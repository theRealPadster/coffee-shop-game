// Small UI helpers shared across scenes.

export interface ModalButton<T> {
  label: string;
  value: T;                                 // what the modal resolves to when clicked
  style?: 'accent' | 'secondary' | 'danger' | 'success'; // 'accent' is the default button color
  primary?: boolean;                        // focused on open and triggered by Enter
}

export interface ModalOptions<T> {
  title: string;
  message: string;
  buttons: ModalButton<T>[];
  dismissValue: T;                          // resolved on Esc or click outside the dialog
}

/**
 * Generic styled dialog matching the game's modal aesthetic. The buttons and
 * the value each resolves to are fully caller-defined; confirmModal/alertModal
 * are thin wrappers over this.
 */
export function modal<T>(opts: ModalOptions<T>): Promise<T> {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const buttonsHtml = opts.buttons
      // 'accent' (the default) is the base button color, so it needs no modifier class.
      .map((b, i) => `<button class="${b.style && b.style !== 'accent' ? b.style : ''}" data-idx="${i}">${b.label}</button>`)
      .join('');
    backdrop.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true">
        <h2>${opts.title}</h2>
        <p class="modal-message">${opts.message}</p>
        <div class="actions">${buttonsHtml}</div>
      </div>
    `;

    function close(result: T): void {
      window.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        close(opts.dismissValue);
      } else if (e.key === 'Enter') {
        const primary = opts.buttons.find(b => b.primary) ?? opts.buttons[opts.buttons.length - 1];
        if (primary) close(primary.value);
      }
    }

    backdrop.querySelectorAll<HTMLButtonElement>('[data-idx]').forEach(el => {
      el.addEventListener('click', () => close(opts.buttons[Number(el.dataset.idx)].value));
    });
    // Click outside the dialog dismisses.
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close(opts.dismissValue);
    });
    window.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);
    const idx = Math.max(0, opts.buttons.findIndex(b => b.primary));
    backdrop.querySelectorAll<HTMLButtonElement>('[data-idx]')[idx]?.focus();
  });
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // style the confirm button as destructive
}

// A confirmation dialog. Resolves true if confirmed, false if cancelled/dismissed.
export function confirmModal(opts: ConfirmOptions): Promise<boolean> {
  return modal<boolean>({
    title: opts.title,
    message: opts.message,
    dismissValue: false,
    buttons: [
      { label: opts.cancelLabel ?? 'Cancel', value: false, style: 'secondary' },
      { label: opts.confirmLabel ?? 'Confirm', value: true, style: opts.danger ? 'danger' : 'success', primary: true },
    ],
  });
}

export interface AlertOptions {
  title: string;
  message: string;
  okLabel?: string;
}

// An informational dialog with a single dismiss button. Resolves once dismissed.
export function alertModal(opts: AlertOptions): Promise<void> {
  return modal<void>({
    title: opts.title,
    message: opts.message,
    dismissValue: undefined,
    buttons: [{ label: opts.okLabel ?? 'OK', value: undefined, style: 'accent', primary: true }],
  });
}
