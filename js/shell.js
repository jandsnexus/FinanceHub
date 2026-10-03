// App-Rahmen: Sidebar (Desktop), Tab-Leiste (Handy), Router über #/pfad (funktioniert auf GitHub Pages ohne 404).
import * as store from './store.js';
import { h, fmtDate } from './ui.js';
import { icon } from './icons.js';
import { summarize, todayISO, faelligeAutoBuchungen } from './math.js';
import { cycleTheme, effectiveTheme } from './theme.js';
import { toast } from './ui.js';
import { renderDashboard } from './views/dashboard.js';
import { renderBereichList, renderBereichDetail, openBereichEditor } from './views/bereiche.js';
import { renderBuchungen } from './views/buchungen.js';
import { renderFristen } from './views/fristen.js';
import { renderEinstellungen } from './views/einstellungen.js';
import { openKalender } from './views/kalender.js';

let state = null;

export function parseRoute(hash = location.hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [name = 'dashboard', id] = parts;
  const known = ['dashboard', 'bereiche', 'bereich', 'buchungen', 'fristen', 'einstellungen'];
  return known.includes(name) ? { name, id } : { name: 'dashboard' };
}

export function navigate(path) {
  const target = '#/' + path.replace(/^#?\/?/, '');
  if (location.hash === target) render(true);
  else location.hash = target;
}

function navLink(path, iconName, label, active) {
  return h('a', { href: '#/' + path, class: `nav-link${active ? ' active' : ''}`, 'aria-current': active ? 'page' : null },
    icon(iconName, 20), h('span', {}, label));
}

function buildSidebar(route) {
  const bereiche = store.bereiche();
  const p = store.profil();
  return h('aside', { class: 'sidebar', 'aria-label': 'Hauptnavigation' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }),
      h('span', { class: 'brand-text' }, h('strong', {}, 'FinanceHub'), h('small', {}, 'Alles an einem Ort'))),
    h('nav', { class: 'nav' },
      navLink('dashboard', 'home', 'Übersicht', route.name === 'dashboard'),
      h('p', { class: 'nav-group' }, 'Bereiche'),
      bereiche.map(b => navLink('bereich/' + encodeURIComponent(b.id), b.icon || 'folder', b.name, route.name === 'bereich' && route.id === b.id)),
      h('button', { type: 'button', class: 'nav-link nav-add', onclick: () => openBereichEditor(null, ctx()) }, icon('plus', 20), h('span', {}, 'Bereich hinzufügen')),
      h('p', { class: 'nav-group' }, 'Geld & Termine'),
      navLink('buchungen', 'swap', 'Einnahmen & Ausgaben', route.name === 'buchungen'),
      navLink('fristen', 'calendar', 'Fristen', route.name === 'fristen'),
      navLink('einstellungen', 'settings', 'Einstellungen', route.name === 'einstellungen')
    ),
    h('div', { class: 'sidebar-foot' },
      h('div', { class: 'me' }, h('span', { class: 'avatar' }, (p.name || state.user.email || '?').trim().charAt(0).toUpperCase()),
        h('span', { class: 'me-text' }, h('strong', {}, p.name || 'Mein Konto'), h('small', {}, state.user.email || ''))),
      h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Tresor sperren', title: 'Tresor sperren', onclick: () => state.lock() }, icon('lock', 18))
    )
  );
}

function buildTabbar(route) {
  const tab = (path, iconName, label, active) =>
    h('a', { href: '#/' + path, class: `tab${active ? ' active' : ''}`, 'aria-current': active ? 'page' : null }, icon(iconName, 22), h('span', {}, label));
  return h('nav', { class: 'tabbar', 'aria-label': 'Navigation' },
    tab('dashboard', 'home', 'Übersicht', route.name === 'dashboard'),
    tab('bereiche', 'grid', 'Bereiche', route.name === 'bereiche' || route.name === 'bereich'),
    tab('buchungen', 'swap', 'Buchungen', route.name === 'buchungen'),
    tab('fristen', 'calendar', 'Fristen', route.name === 'fristen'),
    tab('einstellungen', 'settings', 'Mehr', route.name === 'einstellungen')
  );
}

function statusBanner() {
  const err = store.getSyncError();
  if (err) {
    return h('div', { class: 'banner banner-danger', role: 'alert' }, icon('alert', 18),
      h('span', {}, err.code === 'permission-denied'
        ? 'Zugriff verweigert. Prüfe die Firestore-Regeln (siehe Anleitung) oder melde dich neu an.'
        : 'Synchronisierung unterbrochen. Deine Änderungen bleiben auf dem Gerät gespeichert.'));
  }
  if (!navigator.onLine) {
    return h('div', { class: 'banner' }, icon('alert', 18), h('span', {}, 'Offline. Änderungen werden synchronisiert, sobald du wieder online bist.'));
  }
  return null;
}

export function ctx() {
  const snap = store.snapshot();
  return {
    store,
    navigate,
    user: state.user,
    lock: state.lock,
    logout: state.logout,
    snap,
    summary: summarize(snap, todayISO())
  };
}

function viewFor(route, c) {
  switch (route.name) {
    case 'bereiche': return renderBereichList(c);
    case 'bereich': return renderBereichDetail(c, route.id);
    case 'buchungen': return renderBuchungen(c);
    case 'fristen': return renderFristen(c);
    case 'einstellungen': return renderEinstellungen(c);
    default: return renderDashboard(c);
  }
}

function render(routeChanged = false) {
  if (!state) return;
  const route = parseRoute();
  const main = h('main', { class: 'view', id: 'view' });
  if (!store.isReady()) {
    main.append(h('div', { class: 'boot boot-inline', role: 'status', 'aria-label': 'Daten werden entschlüsselt' }, h('div', { class: 'spinner' })));
  } else {
    let content;
    try {
      content = viewFor(route, ctx());
    } catch (err) {
      console.error(err);
      content = h('div', { class: 'card' }, h('h2', {}, 'Diese Ansicht konnte nicht angezeigt werden.'),
        h('p', { class: 'muted' }, 'Bitte lade die Seite neu. Deine Daten sind davon nicht betroffen.'));
    }
    main.append(content);
  }
  const themeIcon = { hell: 'sun', dunkel: 'moon', pink: 'heart' }[effectiveTheme()] || 'sun';
  const topbar = h('header', { class: 'topbar' },
    h('div', { class: 'brand brand-mobile' }, h('span', { class: 'brand-mark' }), h('strong', {}, 'FinanceHub')),
    h('button', { type: 'button', class: 'topbar-date', 'aria-label': 'Kalender öffnen', title: 'Kalender & Notizen', onclick: () => openKalender(ctx()) },
      icon('calendar', 18), h('span', {}, fmtDate(todayISO()))),
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Design wechseln', title: 'Design wechseln', onclick: () => {
      const t = cycleTheme();
      toast(`Design: ${t.label}`);
      render(false);
    } }, icon(themeIcon, 18)),
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon topbar-lock', 'aria-label': 'Tresor sperren', onclick: () => state.lock() }, icon('lock', 18))
  );
  const layout = h('div', { class: 'layout' },
    buildSidebar(route),
    h('div', { class: 'main-col' }, topbar, statusBanner(), main),
    buildTabbar(route)
  );
  const y = window.scrollY;
  state.root.replaceChildren(layout);
  if (routeChanged) window.scrollTo(0, 0);
  else window.scrollTo(0, y);
}

const onHash = () => render(true);
const onNet = () => render(false);

// Fällige Abbuchungen aus Verträgen automatisch buchen – erst wenn frische Daten vom Server da sind,
// damit auf mehreren Geräten nichts doppelt oder trotz Löschen erneut gebucht wird.
function autoBuchen() {
  if (!store.isReady() || !store.isServerSynced() || !navigator.onLine) return;
  const snap = store.snapshot();
  const vorhanden = new Set(snap.alleBuchungen.map(b => b.id));
  const neu = faelligeAutoBuchungen(snap.bereiche, snap.eintraege, vorhanden, todayISO());
  if (!neu.length) return;
  const now = new Date().toISOString();
  for (const n of neu) store.save('buchung', { ...n.data, createdAt: now }, n.id);
  toast(neu.length === 1 ? '1 fällige Zahlung wurde gebucht' : `${neu.length} fällige Zahlungen wurden gebucht`);
}

export function mountShell(root, { user, lock, logout }) {
  unmountShell();
  state = { root, user, lock, logout };
  state.unsub = store.subscribe(() => { autoBuchen(); render(false); });
  window.addEventListener('hashchange', onHash);
  window.addEventListener('online', onNet);
  window.addEventListener('offline', onNet);
  render(true);
}

export function unmountShell() {
  if (!state) return;
  state.unsub?.();
  window.removeEventListener('hashchange', onHash);
  window.removeEventListener('online', onNet);
  window.removeEventListener('offline', onNet);
  document.querySelectorAll('dialog.modal').forEach(d => d.open && d.close());
  state = null;
}
