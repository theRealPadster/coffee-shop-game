// Fullscreen API wrapper. Adds feature detection, a change-event subscription
// helper, and a safe no-op fallback on browsers that don't support requesting
// fullscreen on the document element (notably iOS Safari before 16.4).

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

function docEl(): FullscreenElement {
  return document.documentElement as FullscreenElement;
}
function doc(): FullscreenDocument {
  return document as FullscreenDocument;
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const el = docEl();
  return !!(el.requestFullscreen ?? el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  const d = doc();
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<void> {
  if (isFullscreen()) return;
  const el = docEl();
  const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!req) return;
  try {
    await req.call(el);
  } catch {
    // Browser refused (no user gesture, permission denied, etc.) — silent.
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  const d = doc();
  const fn = d.exitFullscreen ?? d.webkitExitFullscreen;
  if (!fn) return;
  try {
    await fn.call(d);
  } catch {
    // ignore
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen();
  else await enterFullscreen();
}

// Subscribe to fullscreen state changes (entered or exited, by any means
// including the browser's own Esc/F11 shortcut). Returns an unsubscribe fn.
export function onFullscreenChange(cb: () => void): () => void {
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
  return () => {
    document.removeEventListener('fullscreenchange', cb);
    document.removeEventListener('webkitfullscreenchange', cb);
  };
}
