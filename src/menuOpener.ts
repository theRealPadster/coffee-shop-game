// Lets the active scene customize what happens when the player opens the pause
// menu (via header button or Esc). The street phase uses this to freeze the
// in-game clock before the menu mounts and to resume it after the menu closes.

type Opener = () => void;

let override: Opener | null = null;

export function setMenuOpener(fn: Opener | null): void {
  override = fn;
}

export function getMenuOpener(): Opener | null {
  return override;
}
