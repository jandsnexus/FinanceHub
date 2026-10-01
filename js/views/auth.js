import {
  auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  sendEmailVerification, signOut
} from '../firebase.js';
import { h, setBusy, toast } from '../ui.js';
import { icon } from '../icons.js';
import { createVault, unlockWithPassword, rawFromRecovery, rewrapPassword, importDataKey, passwordProblem } from '../crypto.js';
import * as vault from '../vault.js';
import { defaultBereiche } from '../schema.js';

const AUTH_ERRORS = {
  'auth/invalid-email': 'Diese E-Mail-Adresse ist ungültig.',
  'auth/missing-password': 'Bitte ein Passwort eingeben.',
  'auth/weak-password': 'Das Passwort ist zu schwach (mindestens 8 Zeichen).',
  'auth/email-already-in-use': 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.',
  'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
  'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
  'auth/user-not-found': 'E-Mail oder Passwort stimmt nicht.',
  'auth/too-many-requests': 'Zu viele Versuche. Bitte warte ein paar Minuten.',
  'auth/network-request-failed': 'Keine Internetverbindung.',
  'auth/user-disabled': 'Dieses Konto ist gesperrt.',
  'auth/operation-not-allowed': 'E-Mail-Anmeldung ist in Firebase noch nicht aktiviert (siehe Anleitung).',
  'auth/unauthorized-domain': 'Diese Adresse ist in Firebase nicht freigegeben (Authorized domains, siehe Anleitung).'
};

const authError = err => AUTH_ERRORS[err?.code] || 'Das hat nicht geklappt. Bitte erneut versuchen.';

function card(...children) {
  return h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-card' },
      h('div', { class: 'brand brand-lg' }, h('span', { class: 'brand-mark' }), h('span', {}, 'FinanceHub')),
      ...children
    )
  );
}

function input(id, label, type, attrs = {}) {
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('input', { id, name: id, type, class: 'input', required: true, ...attrs })
  );
}

function errorBox() {
  return h('p', { class: 'form-error', role: 'alert' });
}

function passwordToggle(inputEl) {
  const b = h('button', { type: 'button', class: 'btn btn-ghost btn-icon pw-toggle', 'aria-label': 'Passwort anzeigen' }, icon('eye', 18));
  b.addEventListener('click', () => {
    const show = inputEl.type === 'password';
    inputEl.type = show ? 'text' : 'password';
    b.replaceChildren(icon(show ? 'eyeOff' : 'eye', 18));
    b.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
  });
  return b;
}

function pwField(id, label, attrs = {}) {
  const el = h('input', { id, name: id, type: 'password', class: 'input', required: true, ...attrs });
  return h('div', { class: 'field' }, h('label', { for: id }, label), h('div', { class: 'pw-wrap' }, el, passwordToggle(el)));
}

// ---------- Anmelden / Registrieren ----------
export function renderLogin(root, mode = 'login') {
  const err = errorBox();
  const isLogin = mode === 'login';
  const isReset = mode === 'reset';

  const form = h('form', { class: 'stack', novalidate: true },
    input('email', 'E-Mail', 'email', { autocomplete: 'email', inputmode: 'email' }),
    isReset ? null : pwField('password', 'Passwort', { autocomplete: isLogin ? 'current-password' : 'new-password', minlength: 8 }),
    mode === 'register' ? pwField('password2', 'Passwort wiederholen', { autocomplete: 'new-password' }) : null,
    err,
    h('button', { type: 'submit', class: 'btn btn-primary btn-block' },
      h('span', {}, isLogin ? 'Anmelden' : isReset ? 'Link zum Zurücksetzen senden' : 'Konto erstellen'))
  );

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const email = form.email.value.trim();
    const submit = form.querySelector('button[type=submit]');
    if (!email) { err.textContent = 'Bitte E-Mail eingeben.'; return; }
    try {
      setBusy(submit, true);
      if (isReset) {
        await sendPasswordResetEmail(auth, email);
        toast('Falls ein Konto existiert, kommt gleich eine E-Mail.', 'success');
        renderLogin(root, 'login');
        return;
      }
      const pw = form.password.value;
      if (mode === 'register') {
        if (pw.length < 8) { err.textContent = 'Das Passwort braucht mindestens 8 Zeichen.'; return; }
        if (pw !== form.password2.value) { err.textContent = 'Die Passwörter stimmen nicht überein.'; return; }
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        sendEmailVerification(cred.user).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, email, pw);
      }
    } catch (ex) {
      err.textContent = authError(ex);
    } finally {
      if (submit.isConnected) setBusy(submit, false);
    }
  });

  const switcher = isLogin
    ? h('p', { class: 'auth-switch' }, 'Neu hier? ', h('button', { type: 'button', class: 'link', onclick: () => renderLogin(root, 'register') }, 'Konto erstellen'))
    : h('p', { class: 'auth-switch' }, h('button', { type: 'button', class: 'link', onclick: () => renderLogin(root, 'login') }, 'Zurück zur Anmeldung'));

  root.replaceChildren(card(
    h('h1', { class: 'auth-title' }, isLogin ? 'Willkommen zurück' : isReset ? 'Passwort zurücksetzen' : 'Konto erstellen'),
    h('p', { class: 'muted' }, isLogin ? 'Melde dich an, um deine Übersicht zu sehen.'
      : isReset ? 'Wir schicken dir einen Link per E-Mail.'
        : 'Danach legst du ein Tresor-Passwort fest, mit dem deine Daten verschlüsselt werden.'),
    form,
    isLogin ? h('p', { class: 'auth-switch' }, h('button', { type: 'button', class: 'link', onclick: () => renderLogin(root, 'reset') }, 'Passwort vergessen?')) : null,
    switcher
  ));
  form.email.focus();
}

// ---------- Tresor einrichten (einmalig pro Konto) ----------
export function renderSetup(root, user, done) {
  const err = errorBox();
  const form = h('form', { class: 'stack', novalidate: true },
    input('name', 'Wie heißt du?', 'text', { autocomplete: 'given-name', required: false, maxlength: 60 }),
    pwField('vpw', 'Tresor-Passwort', { autocomplete: 'new-password', minlength: 10 }),
    h('p', { class: 'hint' }, 'Mindestens 10 Zeichen. Ein Satz aus 3–4 Wörtern ist ideal und leicht zu merken.'),
    pwField('vpw2', 'Tresor-Passwort wiederholen', { autocomplete: 'new-password' }),
    err,
    h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, h('span', {}, 'Tresor erstellen'))
  );

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const pw = form.vpw.value;
    const problem = passwordProblem(pw);
    if (problem) { err.textContent = problem; return; }
    if (pw !== form.vpw2.value) { err.textContent = 'Die Passwörter stimmen nicht überein.'; return; }
    const submit = form.querySelector('button[type=submit]');
    setBusy(submit, true, 'Wird verschlüsselt …');
    try {
      const created = await createVault(pw);
      showRecovery(root, user, created, form.name.value.trim(), done);
    } catch (ex) {
      console.error(ex);
      err.textContent = 'Der Tresor konnte nicht erstellt werden. Dein Browser unterstützt evtl. keine Verschlüsselung.';
      setBusy(submit, false, 'Tresor erstellen');
    }
  });

  root.replaceChildren(card(
    h('h1', { class: 'auth-title' }, 'Tresor einrichten'),
    h('p', { class: 'muted' }, 'Alle deine Daten werden mit diesem Passwort auf deinem Gerät verschlüsselt. Niemand außer dir kann sie lesen, auch nicht der Betreiber der App.'),
    form,
    h('p', { class: 'auth-switch' }, h('button', { type: 'button', class: 'link', onclick: () => signOut(auth) }, 'Abmelden'))
  ));
}

function showRecovery(root, user, { meta, dataKey, recoveryCode }, name, done) {
  const err = errorBox();
  const check = h('input', { type: 'checkbox', id: 'saved' });
  const go = h('button', { type: 'button', class: 'btn btn-primary btn-block', disabled: true }, h('span', {}, 'Weiter zur App'));
  check.addEventListener('change', () => { go.disabled = !check.checked; });
  const copy = h('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, icon('file', 16), h('span', {}, 'Kopieren'));
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(recoveryCode); toast('Code kopiert', 'success'); } catch { toast('Bitte abschreiben', 'neutral'); }
  });

  go.addEventListener('click', async () => {
    err.textContent = '';
    setBusy(go, true, 'Wird gespeichert …');
    try {
      await vault.saveMeta(user.uid, meta, true);
    } catch (ex) {
      console.error(ex);
      err.textContent = 'Speichern fehlgeschlagen. Prüfe die Internetverbindung und die Firestore-Regeln.';
      setBusy(go, false, 'Weiter zur App');
      return;
    }
    await vault.remember(user.uid, dataKey);
    done(dataKey, { seed: true, name });
  });

  root.replaceChildren(card(
    h('h1', { class: 'auth-title' }, 'Dein Wiederherstellungscode'),
    h('p', { class: 'muted' }, 'Wenn du dein Tresor-Passwort vergisst, ist dieser Code der einzige Weg zurück an deine Daten. Schreib ihn auf und bewahre ihn sicher auf.'),
    h('div', { class: 'recovery' }, h('code', {}, recoveryCode), copy),
    h('label', { class: 'check', for: 'saved' }, check, h('span', {}, 'Ich habe den Code sicher notiert.')),
    err,
    go
  ));
}

// ---------- Entsperren ----------
export function renderUnlock(root, user, meta, done) {
  const err = errorBox();
  const remember = h('input', { type: 'checkbox', id: 'remember', checked: true });
  const form = h('form', { class: 'stack', novalidate: true },
    h('input', { type: 'email', name: 'username', autocomplete: 'username', value: user.email || '', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' }),
    pwField('vpw', 'Tresor-Passwort', { autocomplete: 'current-password' }),
    h('label', { class: 'check', for: 'remember' }, remember, h('span', {}, 'Auf diesem Gerät entsperrt bleiben')),
    err,
    h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, h('span', {}, 'Entsperren'))
  );

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const submit = form.querySelector('button[type=submit]');
    setBusy(submit, true, 'Wird entsperrt …');
    try {
      const key = await unlockWithPassword(meta, form.vpw.value);
      if (remember.checked) await vault.remember(user.uid, key);
      done(key);
    } catch {
      err.textContent = 'Das Tresor-Passwort stimmt nicht.';
      setBusy(submit, false, 'Entsperren');
      form.vpw.select();
    }
  });

  root.replaceChildren(card(
    h('h1', { class: 'auth-title' }, 'Tresor entsperren'),
    h('p', { class: 'muted' }, `Angemeldet als ${user.email || 'unbekannt'}.`),
    form,
    h('p', { class: 'auth-switch' },
      h('button', { type: 'button', class: 'link', onclick: () => renderRecover(root, user, meta, done) }, 'Tresor-Passwort vergessen?')),
    h('p', { class: 'auth-switch' }, h('button', { type: 'button', class: 'link', onclick: () => signOut(auth) }, 'Abmelden'))
  ));
  form.vpw.focus();
}

// ---------- Mit Wiederherstellungscode ----------
function renderRecover(root, user, meta, done) {
  const err = errorBox();
  const form = h('form', { class: 'stack', novalidate: true },
    input('code', 'Wiederherstellungscode', 'text', { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX' }),
    pwField('vpw', 'Neues Tresor-Passwort', { autocomplete: 'new-password' }),
    pwField('vpw2', 'Neues Tresor-Passwort wiederholen', { autocomplete: 'new-password' }),
    err,
    h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, h('span', {}, 'Passwort neu setzen'))
  );

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const pw = form.vpw.value;
    const problem = passwordProblem(pw);
    if (problem) { err.textContent = problem; return; }
    if (pw !== form.vpw2.value) { err.textContent = 'Die Passwörter stimmen nicht überein.'; return; }
    const submit = form.querySelector('button[type=submit]');
    setBusy(submit, true, 'Wird geprüft …');
    let raw;
    try {
      raw = await rawFromRecovery(meta, form.code.value);
    } catch {
      err.textContent = 'Der Wiederherstellungscode stimmt nicht.';
      setBusy(submit, false, 'Passwort neu setzen');
      return;
    }
    try {
      const updated = await rewrapPassword(meta, raw, pw);
      await vault.saveMeta(user.uid, updated, false);
      const key = await importDataKey(raw);
      raw.fill(0);
      toast('Neues Tresor-Passwort gespeichert', 'success');
      done(key);
    } catch (ex) {
      console.error(ex);
      err.textContent = 'Speichern fehlgeschlagen. Bitte Internetverbindung prüfen.';
      setBusy(submit, false, 'Passwort neu setzen');
    }
  });

  root.replaceChildren(card(
    h('h1', { class: 'auth-title' }, 'Tresor wiederherstellen'),
    h('p', { class: 'muted' }, 'Gib den Code ein, den du beim Einrichten notiert hast, und wähle ein neues Tresor-Passwort.'),
    form,
    h('p', { class: 'auth-switch' }, h('button', { type: 'button', class: 'link', onclick: () => renderUnlock(root, user, meta, done) }, 'Zurück'))
  ));
}

// Startdaten nach der Einrichtung
export function seedDefaults(store, name) {
  if (name) store.save('profil', { name }, 'profil');
  defaultBereiche().forEach(b => store.save('bereich', b));
}
