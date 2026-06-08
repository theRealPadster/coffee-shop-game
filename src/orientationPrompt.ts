// Landscape-rotate fullscreen prompt. When a mobile device is rotated to
// landscape and the page isn't already fullscreen, a small floating pill
// invites the user to expand. The Fullscreen API requires a user gesture, so
// we can only invite — never auto-enter.

import { enterFullscreen, isFullscreen, isFullscreenSupported, onFullscreenChange } from './fullscreen';

let promptEl: HTMLElement | null = null;
// Dismissed-for-this-rotation flag. Reset whenever the device returns to
// portrait, so a fresh landscape rotation re-prompts.
let dismissedThisRotation = false;

function isSmallViewport(): boolean {
  // Phones/small tablets typically have a short edge ≤ 700 CSS px in landscape.
  // Desktops rotating a monitor are rare and not worth filtering out hard — if
  // the prompt shows briefly it just offers a one-tap fullscreen, no harm done.
  return Math.min(window.innerWidth, window.innerHeight) <= 700;
}

function landscape(): boolean {
  return window.matchMedia('(orientation: landscape)').matches;
}

function shouldShow(): boolean {
  if (!isFullscreenSupported()) return false;
  if (isFullscreen()) return false;
  if (dismissedThisRotation) return false;
  if (!isSmallViewport()) return false;
  return landscape();
}

function show(): void {
  if (promptEl) return;
  const el = document.createElement('div');
  el.className = 'fullscreen-prompt';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Enter fullscreen');
  el.innerHTML = `
    <button class="fullscreen-prompt-action" type="button">⛶ Tap for fullscreen</button>
    <button class="fullscreen-prompt-dismiss" type="button" aria-label="Dismiss">✕</button>
  `;
  el.querySelector<HTMLButtonElement>('.fullscreen-prompt-action')?.addEventListener('click', () => {
    void enterFullscreen();
  });
  el.querySelector<HTMLButtonElement>('.fullscreen-prompt-dismiss')?.addEventListener('click', () => {
    dismissedThisRotation = true;
    hide();
  });
  document.body.appendChild(el);
  promptEl = el;
}

function hide(): void {
  promptEl?.remove();
  promptEl = null;
}

function refresh(): void {
  if (shouldShow()) show();
  else hide();
}

export function initOrientationPrompt(): void {
  if (!isFullscreenSupported()) return;

  const mql = window.matchMedia('(orientation: landscape)');
  // Rotating back to portrait clears the dismissal so the next landscape
  // rotation gets a fresh prompt; this is the "not nag-y but available" tradeoff.
  const onOrientationChange = (): void => {
    if (!mql.matches) dismissedThisRotation = false;
    refresh();
  };
  mql.addEventListener('change', onOrientationChange);
  // Entering fullscreen (via any path — this prompt, the pause menu, or the
  // browser's own keybind) hides the prompt; exiting can re-show it.
  onFullscreenChange(refresh);

  refresh();
}
