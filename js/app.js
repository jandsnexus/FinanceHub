// Einstiegspunkt. Prüft zuerst die Konfiguration, damit nie ein leerer oder kaputter Bildschirm entsteht.
import { firebaseConfig } from './config.js';
import { h } from './ui.js';
import { applyTheme } from './theme.js';

const root = document.getElementById('app');

function isConfigured(c) {
  const bad = v => !v || String(v).includes('HIER_EINTRAGEN');
  return c && !bad(c.apiKey) && !bad(c.projectId) && !bad(c.authDomain) && !bad(c.appId);
}

function message(title, text, detail) {
  root.replaceChildren(
    h('div', { class: 'auth-wrap' },
      h('div', { class: 'auth-card' },
        h('div', { class: 'brand brand-lg' }, h('span', { class: 'brand-mark' }), h('span', {}, 'FinanceHub')),
        h('h1', { class: 'auth-title' }, title),
        h('p', { class: 'muted' }, text),
        detail ? h('pre', { class: 'code' }, detail) : null,
        h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => location.reload() }, h('span', {}, 'Neu laden'))
      )
    )
  );
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service Worker nicht registriert', err));
}

async function boot() {
  applyTheme();
  if (!isConfigured(firebaseConfig)) {
    message('Einrichtung fehlt', 'Trage zuerst die Firebase-Konfiguration in js/config.js ein. Die Anleitung steht in der Datei ANLEITUNG.md.');
    return;
  }
  registerServiceWorker();
  try {
    const main = await import('./main.js');
    main.start(root);
  } catch (err) {
    console.error(err);
    message('Laden fehlgeschlagen', 'Die App konnte nicht geladen werden. Prüfe deine Internetverbindung und lade neu.', String(err?.message || err));
  }
}

boot();
