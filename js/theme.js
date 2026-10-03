// Darstellung: Automatisch (wie das Gerät), Hell, Dunkel, Pink.
// Ändert NUR das Aussehen – Funktionen und Daten bleiben unberührt. Gespeichert pro Gerät.
const KEY = 'fh-theme';
export const THEMES = [
  { id: 'system', label: 'Auto', icon: 'monitor' },
  { id: 'hell', label: 'Hell', icon: 'sun' },
  { id: 'dunkel', label: 'Dunkel', icon: 'moon' },
  { id: 'pink', label: 'Pink', icon: 'heart' }
];
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return THEMES.some(x => x.id === t) ? t : 'system';
  } catch {
    return 'system';
  }
}

export function effectiveTheme() {
  const t = getTheme();
  return t === 'system' ? (media.matches ? 'dunkel' : 'hell') : t;
}

function updateMeta() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}

export function applyTheme() {
  const t = getTheme();
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  updateMeta();
}

export function setTheme(id) {
  try {
    if (id === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch { /* privater Modus: gilt dann nur für diese Sitzung */ }
  applyTheme();
}

// Schnellwechsel oben rechts: Hell -> Dunkel -> Pink -> Hell
export function cycleTheme() {
  const order = ['hell', 'dunkel', 'pink'];
  const next = order[(order.indexOf(effectiveTheme()) + 1) % order.length];
  setTheme(next);
  return THEMES.find(x => x.id === next);
}

media.addEventListener?.('change', updateMeta);
