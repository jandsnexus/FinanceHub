// Tresor-Verwaltung: Schlüssel-Metadaten (nur verschlüsselt) in Firestore,
// optional "Auf diesem Gerät merken" als nicht exportierbarer Schlüssel in IndexedDB.
import { db, doc, getDoc, setDoc, serverTimestamp } from './firebase.js';
import { verifyKey } from './crypto.js';

const metaRef = uid => doc(db, 'users', uid, 'meta', 'keys');

export async function getMeta(uid) {
  const snap = await getDoc(metaRef(uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { v: d.v, pw: d.pw, rc: d.rc, check: d.check };
}

export async function saveMeta(uid, meta, isNew) {
  const data = { v: meta.v, pw: meta.pw, rc: meta.rc, check: meta.check, updatedAt: serverTimestamp() };
  if (isNew) data.createdAt = serverTimestamp();
  await setDoc(metaRef(uid), data, { merge: !isNew });
}

// ---- Geräte-Speicher (IndexedDB) ----
const DB_NAME = 'financehub-device';
const STORE = 'keys';

function openDevice() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const dbh = await openDevice();
  try {
    return await new Promise((resolve, reject) => {
      const t = dbh.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    dbh.close();
  }
}

export async function remember(uid, key) {
  try { await tx('readwrite', s => s.put(key, uid)); return true; } catch { return false; }
}

export async function forget(uid) {
  try { await tx('readwrite', s => s.delete(uid)); } catch { /* egal */ }
}

export async function tryRemembered(uid, meta) {
  try {
    const key = await tx('readonly', s => s.get(uid));
    if (key && await verifyKey(meta, key)) return key;
    if (key) await forget(uid);
  } catch { /* privater Modus o. ä. */ }
  return null;
}
