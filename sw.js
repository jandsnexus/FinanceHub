// Service Worker: macht die App offline nutzbar.
// Bei jedem Update VERSION erhöhen, dann holen sich alle Geräte die neuen Dateien.
const VERSION = 'v1.2.0';
const APP_CACHE = `financehub-app-${VERSION}`;
const SDK_CACHE = 'financehub-sdk-10.12.2';

const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/app.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/theme-boot.js',
  './js/theme.js',
  './js/files.js',
  './js/app.js',
  './js/config.js',
  './js/firebase.js',
  './js/main.js',
  './js/shell.js',
  './js/store.js',
  './js/vault.js',
  './js/crypto.js',
  './js/schema.js',
  './js/math.js',
  './js/ics.js',
  './js/ui.js',
  './js/icons.js',
  './js/views/auth.js',
  './js/views/dashboard.js',
  './js/views/bereiche.js',
  './js/views/buchungen.js',
  './js/views/fristen.js',
  './js/views/einstellungen.js',
  './js/views/bilder.js',
  './js/views/kalender.js'
];

const SDK_PREFIX = 'https://www.gstatic.com/firebasejs/10.12.2/';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('financehub-') && k !== APP_CACHE && k !== SDK_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase-SDK: Versionierte Dateien ändern sich nie -> Cache zuerst.
  if (url.href.startsWith(SDK_PREFIX)) {
    event.respondWith(caches.open(SDK_CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Eigene Dateien: Netz zuerst (immer aktuell), offline aus dem Cache.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })());
  }
  // Alles andere (Firebase-Server) läuft unverändert durch.
});
