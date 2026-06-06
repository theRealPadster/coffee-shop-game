// Small UI helpers shared across scenes.

// -----------------------------------------------------------------------------
// Shared modal shell
// -----------------------------------------------------------------------------

interface ModalShellOptions {
  closeOnEsc: boolean;
  closeOnBackdrop: boolean;
}

interface ModalShell {
  dialog: HTMLElement;             // the .modal element to populate
  close: () => void;               // idempotent: removes listeners + backdrop, fires onClose
  onClose: (cb: () => void) => void;
  onKey: (cb: (e: KeyboardEvent) => void) => void; // extra keydown subscribers (e.g. Enter)
}

/**
 * Internal: backdrop + dialog scaffolding shared by every modal-shaped UI.
 * Owns the lifecycle (mount, dismiss listeners, unmount) so callers only have
 * to populate the dialog and decide what dismissal means.
 */
function createModalShell(opts: ModalShellOptions): ModalShell {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  backdrop.appendChild(dialog);

  const closeCbs: Array<() => void> = [];
  const keyCbs: Array<(e: KeyboardEvent) => void> = [];
  let closed = false;

  function close(): void {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    backdrop.remove();
    for (const cb of closeCbs) cb();
  }

  function onKey(e: KeyboardEvent): void {
    if (opts.closeOnEsc && e.key === 'Escape') {
      close();
      return;
    }
    for (const cb of keyCbs) cb(e);
  }

  if (opts.closeOnBackdrop) {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close();
    });
  }
  window.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);

  return {
    dialog,
    close,
    onClose: cb => { closeCbs.push(cb); },
    onKey: cb => { keyCbs.push(cb); },
  };
}

// -----------------------------------------------------------------------------
// modal(): "ask a question, resolve to a value"
// -----------------------------------------------------------------------------

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
    const shell = createModalShell({ closeOnEsc: true, closeOnBackdrop: true });
    let result: T = opts.dismissValue;

    const buttonsHtml = opts.buttons
      // 'accent' (the default) is the base button color, so it needs no modifier class.
      .map((b, i) => `<button class="${b.style && b.style !== 'accent' ? b.style : ''}" data-idx="${i}">${b.label}</button>`)
      .join('');
    shell.dialog.innerHTML = `
      <h2>${opts.title}</h2>
      <p class="modal-message">${opts.message}</p>
      <div class="actions">${buttonsHtml}</div>
    `;

    shell.dialog.querySelectorAll<HTMLButtonElement>('[data-idx]').forEach(el => {
      el.addEventListener('click', () => {
        result = opts.buttons[Number(el.dataset.idx)].value;
        shell.close();
      });
    });

    shell.onKey(e => {
      if (e.key === 'Enter') {
        const primary = opts.buttons.find(b => b.primary) ?? opts.buttons[opts.buttons.length - 1];
        if (primary) {
          result = primary.value;
          shell.close();
        }
      }
    });

    shell.onClose(() => resolve(result));

    const idx = Math.max(0, opts.buttons.findIndex(b => b.primary));
    shell.dialog.querySelectorAll<HTMLButtonElement>('[data-idx]')[idx]?.focus();
  });
}

// -----------------------------------------------------------------------------
// paneModal(): "show a pane of live controls until dismissed"
// -----------------------------------------------------------------------------

export interface PaneModalOptions {
  title: string;
  body: (host: HTMLElement, close: () => void) => void;
  className?: string;        // extra class on .modal, e.g. 'pause-pane'
  closeButton?: boolean;     // shows the ✕ in the top-right; default true
  closeOnBackdrop?: boolean; // default true
  closeOnEsc?: boolean;      // default true
}

/**
 * A modal whose body is built imperatively by the caller — for pause menus,
 * settings panes, main menus, etc. Shares the backdrop/dismiss plumbing with
 * modal() via createModalShell but otherwise has no notion of buttons or a
 * return value; the body wires its own controls.
 */
export function paneModal(opts: PaneModalOptions): Promise<void> {
  return new Promise(resolve => {
    const shell = createModalShell({
      closeOnEsc: opts.closeOnEsc ?? true,
      closeOnBackdrop: opts.closeOnBackdrop ?? true,
    });
    shell.dialog.classList.add('pane');
    if (opts.className) shell.dialog.classList.add(opts.className);

    const showClose = opts.closeButton ?? true;
    shell.dialog.innerHTML = `
      <div class="modal__title-row">
        <h2>${opts.title}</h2>
        ${showClose ? '<button class="modal__close-btn" aria-label="Close" title="Close">✕</button>' : ''}
      </div>
      <div class="modal__body"></div>
    `;
    if (showClose) {
      shell.dialog.querySelector<HTMLButtonElement>('.modal__close-btn')
        ?.addEventListener('click', () => shell.close());
    }

    const host = shell.dialog.querySelector<HTMLElement>('.modal__body')!;
    opts.body(host, shell.close);

    shell.onClose(() => resolve());
  });
}

// -----------------------------------------------------------------------------
// confirmModal / alertModal — thin wrappers over modal()
// -----------------------------------------------------------------------------

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
