// Debug mode — enables developer-only affordances in the UI (e.g. the toggle
// switches on the Upgrades panel that grant/revoke upgrades for free, so you
// can A/B their effects without grinding cash).
//
// Activated via `?debug=1` in the URL on any page load, which also persists to
// localStorage so a plain reload keeps it on. `?debug=0` (or `?debug=off`)
// clears the flag. Read once at module load — debug shouldn't toggle mid-
// session and any consumer that's already rendered would have a stale view.

const STORAGE_KEY = 'csg-debug';

function readUrlParam(): 'on' | 'off' | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('debug')) return null;
    const val = (params.get('debug') ?? '').toLowerCase();
    if (val === '0' || val === 'off' || val === 'false') return 'off';
    return 'on';
  } catch {
    return null;
  }
}

function init(): boolean {
  const fromUrl = readUrlParam();
  if (fromUrl === 'on') {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* private mode */ }
    return true;
  }
  if (fromUrl === 'off') {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
    return false;
  }
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

const DEBUG = init();

export function isDebugMode(): boolean {
  return DEBUG;
}
