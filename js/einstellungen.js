import { h, btn, openModal, confirmDialog, toast, download, nextId, setBusy } from '../ui.js';
import { icon } from '../icons.js';
import * as vault from '../vault.js';
import { rawFromPassword, rewrapPassword, passwordProblem } from '../crypto.js';
import { todayISO } from '../math.js';
import { THEMES, getTheme, setTheme } from '../theme.js';

function section(iconName, title, text, ...actions) {
  return h('article', { class: 'card setting' },
    h('div', { class: 'card-head' }, h('span', { class: 'card-icon' }, icon(iconName, 20)), h('h2', {}, title)),
    text ? h('p', { class: 'muted' }, text) : null,
    actions.length ? h('div', { class: 'setting-actions' }, actions) : null);
}

export function renderEinstellungen(c) {
  const p = c.store.profil();
  const nameId = nextId('name');
  const nameInput = h('input', { id: nameId, class: 'input', type: 'text', maxlength: 60, value: p.name || '', autocomplete: 'given-name' });

  return h('div', { class: 'stack-lg' },
    h('section', { class: 'hero' }, h('div', {}, h('h1', {}, 'Einstellungen'), h('p', { class: 'muted' }, c.user.email || ''))),
    h('section', { class: 'grid grid-2' },
      h('article', { class: 'card setting' },
        h('div', { class: 'card-head' }, h('span', { class: 'card-icon' }, icon('sun', 20)), h('h2', {}, 'Darstellung')),
        h('p', { class: 'muted' }, 'Ändert nur das Aussehen auf diesem Gerät. Alle Funktionen und Daten bleiben gleich.'),
        h('div', { class: 'theme-picker', role: 'radiogroup', 'aria-label': 'Design' }, THEMES.map(t =>
          h('button', { type: 'button', role: 'radio', 'aria-checked': String(getTheme() === t.id),
            class: `theme-choice theme-${t.id}${getTheme() === t.id ? ' active' : ''}`,
            onclick: () => { setTheme(t.id); c.navigate('einstellungen'); } },
          h('span', { class: 'theme-swatch' }), icon(t.icon, 18), h('span', {}, t.label))))),
      h('article', { class: 'card setting' },
        h('div', { class: 'card-head' }, h('span', { class: 'card-icon' }, icon('user', 20)), h('h2', {}, 'Profil')),
        h('div', { class: 'field' }, h('label', { for: nameId }, 'Dein Name (für die Begrüßung)'), nameInput),
        h('div', { class: 'setting-actions' }, btn('Speichern', { variant: 'primary', onClick: () => {
          c.store.save('profil', { name: nameInput.value.trim().slice(0, 60) }, 'profil');
          toast('Gespeichert', 'success');
        } }))),
      section('lock', 'Tresor & Sicherheit',
        'Deine Daten werden auf diesem Gerät verschlüsselt, bevor sie gespeichert werden. Ohne dein Tresor-Passwort oder deinen Wiederherstellungscode kann sie niemand lesen.',
        btn('Tresor-Passwort ändern', { variant: 'secondary', iconName: 'edit', onClick: () => openChangePassword(c) }),
        btn('Jetzt sperren', { variant: 'secondary', iconName: 'lock', onClick: () => c.lock() })),
      section('download', 'Daten exportieren',
        'Lädt alle deine Daten als lesbare Datei herunter, z. B. als Sicherung. Achtung: Die Datei ist nicht verschlüsselt, bewahre sie sicher auf.',
        btn('Export herunterladen', { variant: 'secondary', iconName: 'download', onClick: async () => {
          if (await confirmDialog('Die Exportdatei enthält alle Daten unverschlüsselt, auch Steuer-ID und IBAN.', { okText: 'Herunterladen', title: 'Export' })) {
            download(`financehub-export-${todayISO()}.json`, JSON.stringify(c.store.exportAll(), null, 2), 'application/json');
          }
        } })),
      section('logout', 'Abmelden', 'Meldet dich auf diesem Gerät ab. Beim nächsten Mal brauchst du E-Mail, Passwort und Tresor-Passwort.',
        btn('Abmelden', { variant: 'ghost-danger', iconName: 'logout', onClick: () => c.logout() }))
    ),
    h('p', { class: 'footnote' }, 'FinanceHub · Version 1.1')
  );
}

function openChangePassword(c) {
  const ids = { old: nextId('o'), n1: nextId('n'), n2: nextId('n') };
  const err = h('p', { class: 'form-error', role: 'alert' });
  const mk = (id, label, ac) => h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, class: 'input', type: 'password', autocomplete: ac }));
  const form = h('form', { class: 'stack', novalidate: true, id: nextId('form') },
    mk(ids.old, 'Aktuelles Tresor-Passwort', 'current-password'),
    mk(ids.n1, 'Neues Tresor-Passwort', 'new-password'),
    mk(ids.n2, 'Neues Tresor-Passwort wiederholen', 'new-password'),
    err);
  const save = btn('Ändern', { variant: 'primary', type: 'submit' });
  save.setAttribute('form', form.id);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const oldPw = form.querySelector('#' + ids.old).value;
    const n1 = form.querySelector('#' + ids.n1).value;
    const n2 = form.querySelector('#' + ids.n2).value;
    const problem = passwordProblem(n1);
    if (problem) { err.textContent = problem; return; }
    if (n1 !== n2) { err.textContent = 'Die neuen Passwörter stimmen nicht überein.'; return; }
    setBusy(save, true, 'Wird geändert …');
    try {
      const meta = await vault.getMeta(c.user.uid);
      let raw;
      try { raw = await rawFromPassword(meta, oldPw); } catch { err.textContent = 'Das aktuelle Tresor-Passwort stimmt nicht.'; return; }
      const updated = await rewrapPassword(meta, raw, n1);
      raw.fill(0);
      await vault.saveMeta(c.user.uid, updated, false);
      m.close();
      toast('Tresor-Passwort geändert', 'success');
    } catch (ex) {
      console.error(ex);
      err.textContent = 'Ändern fehlgeschlagen. Dafür ist eine Internetverbindung nötig.';
    } finally {
      if (save.isConnected) setBusy(save, false, 'Ändern');
    }
  });

  const m = openModal({ title: 'Tresor-Passwort ändern', body: form, footer: [btn('Abbrechen', { variant: 'ghost', onClick: () => m.close() }), save] });
}
