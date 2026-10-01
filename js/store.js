// Datenschicht. Die UI spricht NUR mit diesem Modul.
// Alles wird vor dem Speichern verschlüsselt; in der Cloud stehen nur "kind", "iv", "ct", "updatedAt".
import { db, collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from './firebase.js';
import { encryptJSON, decryptJSON } from './crypto.js';
import { toast } from './ui.js';

export const KINDS = ['bereich', 'eintrag', 'buchung', 'frist', 'profil'];

const items = new Map();
const subscribers = new Set();
let ctx = null;
let queue = Promise.resolve();
let ready = false;
let syncError = null;
let scheduled = false;

function emit() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    for (const fn of subscribers) {
      try { fn(); } catch (err) { console.error(err); }
    }
  });
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export const isReady = () => ready;
export const getSyncError = () => syncError;

export function start(uid, key) {
  stop();
  const gen = {};
  ctx = { uid, key, gen, unsub: null };
  ctx.unsub = onSnapshot(collection(db, 'users', uid, 'items'), { includeMetadataChanges: false }, snap => {
    const changes = snap.docChanges();
    queue = queue.then(async () => {
      if (!ctx || ctx.gen !== gen) return;
      for (const ch of changes) {
        const id = ch.doc.id;
        if (ch.type === 'removed') { items.delete(id); continue; }
        const d = ch.doc.data();
        if (!KINDS.includes(d.kind)) continue;
        try {
          const data = await decryptJSON(key, d.iv, d.ct);
          if (!ctx || ctx.gen !== gen) return;
          items.set(id, { ...data, id, kind: d.kind });
        } catch (err) {
          console.warn('Eintrag konnte nicht entschlüsselt werden:', id, err);
        }
      }
      ready = true;
      syncError = null;
      emit();
    });
  }, err => {
    console.error('Sync-Fehler', err);
    syncError = err;
    ready = true;
    emit();
  });
}

export function stop() {
  if (ctx?.unsub) ctx.unsub();
  ctx = null;
  items.clear();
  ready = false;
  syncError = null;
  queue = Promise.resolve();
  emit();
}

function need() {
  if (!ctx) throw new Error('Tresor ist gesperrt.');
  return ctx;
}

function reportWriteError(err) {
  console.error('Speichern fehlgeschlagen', err);
  const denied = err && (err.code === 'permission-denied' || /permission/i.test(err.message || ''));
  toast(denied ? 'Speichern abgelehnt. Bitte neu anmelden.' : 'Speichern fehlgeschlagen. Bitte erneut versuchen.', 'danger');
}

// Speichert sofort lokal (UI reagiert direkt) und synchronisiert im Hintergrund.
// Offline wird automatisch nachgeholt, sobald wieder Internet da ist.
export function save(kind, data, id = crypto.randomUUID()) {
  if (!KINDS.includes(kind)) throw new Error('Unbekannte Art: ' + kind);
  const { uid, key } = need();
  const clean = { ...data };
  delete clean.id;
  delete clean.kind;
  items.set(id, { ...clean, id, kind });
  emit();
  encryptJSON(key, clean)
    .then(({ iv, ct }) => setDoc(doc(db, 'users', uid, 'items', id), { kind, iv, ct, updatedAt: serverTimestamp() }))
    .catch(reportWriteError);
  return id;
}

export function remove(id) {
  const { uid } = need();
  items.delete(id);
  emit();
  deleteDoc(doc(db, 'users', uid, 'items', id)).catch(reportWriteError);
}

export function get(id) {
  return items.get(id) || null;
}

export function all(kind) {
  const out = [];
  for (const it of items.values()) if (it.kind === kind) out.push(it);
  return out;
}

export function bereiche() {
  return all('bereich').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name)));
}

export function eintraegeVon(bereichId) {
  return all('eintrag').filter(e => e.bereichId === bereichId)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export function profil() {
  return get('profil') || { name: '' };
}

export function snapshot() {
  return {
    bereiche: bereiche(),
    eintraege: all('eintrag'),
    buchungen: all('buchung'),
    fristen: all('frist')
  };
}

// Für den Export: alles entschlüsselt als JSON.
export function exportAll() {
  return {
    app: 'FinanceHub',
    version: 1,
    exportiertAm: new Date().toISOString(),
    daten: [...items.values()]
  };
}
