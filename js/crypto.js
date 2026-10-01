// Ende-zu-Ende-Verschlüsselung. Läuft komplett im Browser, nichts davon verlässt das Gerät unverschlüsselt.
//
// Aufbau:
//  - Ein zufälliger Datenschlüssel (256 Bit) verschlüsselt alle Einträge.
//  - Der Datenschlüssel wird zweimal "eingepackt": einmal mit dem Tresor-Passwort,
//    einmal mit dem Wiederherstellungscode. Nur die eingepackten Versionen landen in der Cloud.

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = globalThis.crypto.subtle;

export const PASSWORD_ITER = 600000; // PBKDF2-SHA256, Empfehlung OWASP
export const RECOVERY_ITER = 100000; // Code hat 100 Bit Zufall, daher reichen weniger Runden
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32 (ohne I, L, O, U)

export function randomBytes(n) {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function toB64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveKey(secret, salt, iterations) {
  const base = await subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function decryptBytes(key, iv, ct) {
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct));
  return new Uint8Array(plain);
}

export function importDataKey(raw) {
  // nicht exportierbar: Selbst bei einem Fehler im Code kann der Schlüssel nicht ausgelesen werden.
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptJSON(key, obj) {
  return encryptBytes(key, enc.encode(JSON.stringify(obj)));
}

export async function decryptJSON(key, iv, ct) {
  return JSON.parse(dec.decode(await decryptBytes(key, iv, ct)));
}

export function generateRecoveryCode() {
  const bytes = randomBytes(20);
  let code = '';
  for (const b of bytes) code += RECOVERY_ALPHABET[b & 31];
  return code.match(/.{4}/g).join('-');
}

export function normalizeRecoveryCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

async function wrap(raw, secret, iterations) {
  const salt = randomBytes(16);
  const key = await deriveKey(secret, salt, iterations);
  const box = await encryptBytes(key, raw);
  return { salt: toB64(salt), iter: iterations, iv: box.iv, ct: box.ct };
}

async function unwrap(wrapped, secret) {
  const key = await deriveKey(secret, fromB64(wrapped.salt), wrapped.iter);
  return decryptBytes(key, wrapped.iv, wrapped.ct);
}

// Neuen Tresor erstellen. Gibt die Metadaten (für die Cloud), den Schlüssel und den Code zurück.
export async function createVault(password) {
  const raw = randomBytes(32);
  const recoveryCode = generateRecoveryCode();
  const dataKey = await importDataKey(raw);
  const meta = {
    v: 1,
    pw: await wrap(raw, password, PASSWORD_ITER),
    rc: await wrap(raw, normalizeRecoveryCode(recoveryCode), RECOVERY_ITER),
    check: await encryptJSON(dataKey, { ok: true })
  };
  raw.fill(0);
  return { meta, dataKey, recoveryCode };
}

// Liefert den Rohschlüssel, wirft bei falschem Passwort.
export async function rawFromPassword(meta, password) {
  return unwrap(meta.pw, password);
}

export async function rawFromRecovery(meta, code) {
  return unwrap(meta.rc, normalizeRecoveryCode(code));
}

export async function unlockWithPassword(meta, password) {
  const raw = await rawFromPassword(meta, password);
  const key = await importDataKey(raw);
  raw.fill(0);
  return key;
}

// Neues Passwort setzen (nach Passwortänderung oder Wiederherstellung).
export async function rewrapPassword(meta, raw, newPassword) {
  return { ...meta, pw: await wrap(raw, newPassword, PASSWORD_ITER) };
}

export async function verifyKey(meta, key) {
  try {
    const res = await decryptJSON(key, meta.check.iv, meta.check.ct);
    return res && res.ok === true;
  } catch {
    return false;
  }
}

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Mindestens 10 Zeichen.';
  if (/^(.)\1+$/.test(pw)) return 'Bitte nicht nur ein Zeichen wiederholen.';
  return null;
}
