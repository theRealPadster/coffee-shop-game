export type ThemeId = 'classic' | 'sunset' | 'dark' | 'blossom' | 'seaside';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'classic', label: '☕ Classic' },
  { id: 'sunset', label: '🌅 Sunset' },
  { id: 'dark', label: '🌙 Dark' },
  { id: 'blossom', label: '🌸 Blossom' },
  { id: 'seaside', label: '🌊 Seaside' },
];

const KEY = 'coffee-shop-theme';
const DEFAULT_THEME: ThemeId = 'classic';

function isThemeId(v: string | null): v is ThemeId {
  return v !== null && THEMES.some(t => t.id === v);
}

export function getTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (isThemeId(v)) return v;
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
}

export function setTheme(id: ThemeId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // ignore
  }
  applyTheme(id);
}

export function loadAndApplyTheme(): void {
  applyTheme(getTheme());
}
