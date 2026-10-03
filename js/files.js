// Bilder: werden auf dem Gerät verkleinert, verschlüsselt und getrennt von den
// normalen Daten gespeichert. Geladen wird ein Bild erst, wenn man es ansieht.
import { db, doc, getDoc, getDocFromCache, setDoc, deleteDoc, serverTimestamp } from './firebase.js';
import { encryptBytes, decryptBytes } from './crypto.js';
import { toast } from './ui.js';

export const MAX_BILDER = 8;
const ZIEL_BYTES = 450 * 1024;
let ctx = null;
const urls = new Map();
const pending = new Map();

export function setFileContext(uid, key) {
  clearFileContext();
  ctx = { uid, key };
}

export function clearFileContext() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  pending.clear();
  ctx = null;
}

function need() {
  if (!ctx) throw new Error('Tresor ist gesperrt.');
  return ctx;
}

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

export function saveImage(blob) {
  const { uid, key } = need();
  const id = crypto.randomUUID();
  urls.set(id, URL.createObjectURL(blob));
  const p = blob.arrayBuffer()
    .then(buf => encryptBytes(key, new Uint8Array(buf)))
    .then(({ iv, ct }) => setDoc(doc(db, 'users', uid, 'files', id), { iv, ct, mime: 'image/jpeg', updatedAt: serverTimestamp() }))
    .catch(err => {
      console.error('Bild speichern fehlgeschlagen', err);
      toast('Ein Bild konnte nicht gespeichert werden.', 'danger');
    });
  pending.set(id, p);
  return id;
}

export async function imageURL(id) {
  if (urls.has(id)) return urls.get(id);
  const { uid, key } = need();
  const ref = doc(db, 'users', uid, 'files', id);
  let snap;
  try { snap = await getDocFromCache(ref); } catch { snap = null; }
  if (!snap || !snap.exists()) snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Bild nicht gefunden');
  const d = snap.data();
  const bytes = await decryptBytes(key, d.iv, d.ct);
  const url = URL.createObjectURL(new Blob([bytes], { type: d.mime || 'image/jpeg' }));
  urls.set(id, url);
  return url;
}

export function deleteImage(id) {
  const { uid } = need();
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
  deleteDoc(doc(db, 'users', uid, 'files', id)).catch(err => console.warn('Bild löschen fehlgeschlagen', err));
}

export function deleteImages(ids) {
  (ids || []).forEach(deleteImage);
}
