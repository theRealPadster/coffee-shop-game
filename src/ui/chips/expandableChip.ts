// Click-to-expand behaviour for a chip that grows in place into an info card.
//
// The collapsed/expanded visuals are pure CSS, driven by the `is-open` class on
// the chip. This module only owns the interaction: toggle on the trigger,
// dismiss on outside-click / Esc / tap-again, and the aria wiring.
//
// Esc is handled in the capture phase and stops propagation, so the global
// pause-menu Esc handler (see main.ts) doesn't also fire while a chip is open —
// the open chip "owns" Escape.

export function makeExpandableChip(chip: HTMLElement): void {
  const trigger = chip.querySelector<HTMLElement>('[data-expand-trigger]') ?? chip;
  let open = false;

  function setOpen(next: boolean): void {
    if (next === open) return;
    open = next;
    chip.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('keydown', onKeydown, true);
      document.addEventListener('pointerdown', onPointerDown, true);
    } else {
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    setOpen(false);
  }

  function onPointerDown(e: PointerEvent): void {
    if (!chip.contains(e.target as Node)) setOpen(false);
  }

  trigger.setAttribute('role', 'button');
  trigger.setAttribute('tabindex', '0');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', () => setOpen(!open));
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(!open);
    }
  });
}
