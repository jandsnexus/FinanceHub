// Ablauf: nicht angemeldet -> Login | angemeldet ohne Tresor -> Einrichtung | Tresor gesperrt -> Entsperren | offen -> App
import { auth, onAuthStateChanged, signOut } from './firebase.js';
import * as vault from './vault.js';
import * as store from './store.js';
import { h } from './ui.js';
import { renderLogin, renderSetup, renderUnlock, seedDefaults } from './views/auth.js';
import { mountShell, unmountShell } from './shell.js';

let root;
let session = 0;

function loading() {
  root.replaceChildren(h('div', { class: 'boot', role: 'status', 'aria-label': 'Wird geladen' }, h('div', { class: 'spinner' })));
}

export function start(rootEl) {
  root = rootEl;
  onAuthStateChanged(auth, user => {
    const my = ++session;
    unmountShell();
    store.stop();
    if (!user) {
      renderLogin(root);
      return;
    }
    openVault(user, my);
  });
}

async function openVault(user, my) {
  loading();
  let meta;
  try {
    meta = await vault.getMeta(user.uid);
  } catch (err) {
    if (my !== session) return;
    console.error(err);
    root.replaceChildren(h('div', { class: 'auth-wrap' }, h('div', { class: 'auth-card' },
      h('h1', { class: 'auth-title' }, 'Keine Verbindung'),
      h('p', { class: 'muted' }, 'Deine Daten konnten nicht geladen werden. Beim ersten Öffnen auf einem Gerät ist Internet nötig.'),
      h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => openVault(user, my) }, h('span', {}, 'Erneut versuchen')),
      h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: () => signOut(auth) }, h('span', {}, 'Abmelden'))
    )));
    return;
  }
  if (my !== session) return;

  const done = (key, opts) => {
    if (my !== session) return;
    enterApp(user, key, my, opts);
  };

  if (!meta) {
    renderSetup(root, user, done);
    return;
  }
  const remembered = await vault.tryRemembered(user.uid, meta);
  if (my !== session) return;
  if (remembered) {
    done(remembered);
    return;
  }
  renderUnlock(root, user, meta, done);
}

function enterApp(user, key, my, opts = {}) {
  store.start(user.uid, key);
  if (opts.seed) seedDefaults(store, opts.name);
  mountShell(root, {
    user,
    lock: async () => {
      await vault.forget(user.uid);
      unmountShell();
      store.stop();
      if (my === session) openVault(user, my);
    },
    logout: async () => {
      await vault.forget(user.uid);
      history.replaceState(null, '', location.pathname + location.search);
      await signOut(auth);
    }
  });
}
