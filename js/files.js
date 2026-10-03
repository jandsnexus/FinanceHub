// Bilder werden LOKAL auf dem Gerät gespeichert (IndexedDB im Browser), verschlüsselt
// mit deinem Tresor-Schlüssel. Kein Cloud-Speicher, kein zusätzlicher Anbieter.
// Hinweis: Ein Bild ist nur auf dem Gerät sichtbar, auf dem es hinzugefügt wurde.
import { encryptBytes, decryptBytes } from './crypto.js';
import { toast } from './ui.js';

export const MAX_BILDER = 8;
const ZIEL_BYTES = 450 * 1024;
const DB_NAME = 'financehub-bilder';
const STORE = 'bilder';
let ctx = null;
const urls = new Map();

export function setFileContext(uid, key) {
  clearFileContext();
  ctx = { uid, key };
  // Browser bitten, die Bilder nicht automatisch zu löschen, wenn Speicher knapp wird
  navigator.storage?.persist?.().catch(() => {});
}

export function clearFileContext() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  ctx = null;
}

function need() {
  if (!ctx) throw new Error('Tresor ist gesperrt.');
  return ctx;
}

// ---- IndexedDB ----
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

const dbKey = (uid, id) => `${uid}:${id}`;

// ---- Verkleinern ----
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    img.src = src;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Verkleinert ein Foto (z. B. 3 MB vom iPhone) auf meist 150–450 KB.
export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Das ist kein Bild.');
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    let maxSide = 1800;
    let quality = 0.82;
    let blob = null;
    for (let i = 0; i < 10; i++) {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      const hgt = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = hgt;
      const c2d = canvas.getContext('2d');
      c2d.fillStyle = '#ffffff';
      c2d.fillRect(0, 0, w, hgt);
      c2d.drawImage(img, 0, 0, w, hgt);
      blob = await canvasToBlob(canvas, quality);
      if (!blob) throw new Error('Bild konnte nicht umgewandelt werden');
      if (blob.size <= ZIEL_BYTES) break;
      if (quality > 0.6) quality -= 0.1;
      else maxSide = Math.round(maxSide * 0.8);
    }
    return blob;
  } finally {
    URL.revokeObjectURL(src);
  }
}

// ---- Speichern / Laden / Löschen ----
export async function saveImage(blob) {
  const { uid, key } = need();
  const id = crypto.randomUUID();
  const { iv, ct } = await encryptBytes(key, new Uint8Array(await blob.arrayBuffer()));
  try {
    await tx('readwrite', s => s.put({ iv, ct, mime: 'image/jpeg', savedAt: Date.now() }, dbKey(uid, id)));
  } catch (err) {
    console.error('Bild speichern fehlgeschlagen', err);
    toast('Ein Bild konnte nicht gespeichert werden. Ist der Gerätespeicher voll?', 'danger');
    throw err;
  }
  urls.set(id, URL.createObjectURL(blob));
  return id;
}

export async function imageURL(id) {
  if (urls.has(id)) return urls.get(id);
  const { uid, key } = need();
  const rec = await tx('readonly', s => s.get(dbKey(uid, id)));
  if (!rec) throw new Error('Bild ist nur auf einem anderen Gerät gespeichert');
  const bytes = await decryptBytes(key, rec.iv, rec.ct);
  const url = URL.createObjectURL(new Blob([bytes], { type: rec.mime || 'image/jpeg' }));
  urls.set(id, url);
  return url;
}

export function deleteImage(id) {
  if (!ctx) return;
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
  tx('readwrite', s => s.delete(dbKey(ctx.uid, id))).catch(err => console.warn('Bild löschen fehlgeschlagen', err));
}

export function deleteImages(ids) {
  (ids || []).forEach(deleteImage);
}
