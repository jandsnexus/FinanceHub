import { h, btn, fmtDate, openModal, confirmDialog, toast, emptyState, badge, download, nextId } from '../ui.js';
import { icon } from '../icons.js';
import { fristStatus, todayISO, daysBetween } from '../math.js';
import { isISODate } from '../schema.js';
import { buildICS } from '../ics.js';

function exportIcs(f) {
  const ics = buildICS({ titel: f.titel, datum: f.datum, notiz: f.notiz || 'Erinnerung aus FinanceHub', uid: `${f.id}-${f.datum}@financehub` });
  const safe = String(f.titel).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'frist';
  download(`${safe}.ics`, ics, 'text/calendar;charset=utf-8');
}

export function renderFristen(c) {
  const offen = c.summary.fristen;
  const erledigt = c.snap.fristen.filter(f => f.erledigt).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 10);

  const row = f => {
    const st = fristStatus(f.tage);
    const own = f.quelle === 'frist' ? c.store.get(f.id) : null;
    return h('li', { class: 'frist' },
      own
        ? h('button', { type: 'button', class: 'btn btn-ghost btn-icon check-btn', 'aria-label': 'Als erledigt markieren',
          onclick: () => { c.store.save('frist', { ...strip(own), erledigt: true }, own.id); toast('Erledigt', 'success'); } }, icon('check', 18))
        : h('span', { class: 'check-btn check-auto', title: 'Kommt aus einem Eintrag' }, icon('layers', 16)),
      h('button', { type: 'button', class: 'row', onclick: () => own ? openFristForm(own, c) : c.navigate('bereich/' + encodeURIComponent(f.bereichId)) },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, f.titel), h('span', { class: 'row-sub' }, fmtDate(f.datum))),
        badge(st.text, st.tone)),
      btn('', { variant: 'ghost', iconName: 'download', small: true, ariaLabel: 'In Kalender übernehmen', onClick: () => exportIcs(f) })
    );
  };

  return h('div', { class: 'stack-lg' },
    h('section', { class: 'hero' },
      h('div', {}, h('h1', {}, 'Fristen & Erinnerungen'),
        h('p', { class: 'muted' }, 'Eigene Fristen und alles, was aus deinen Verträgen kommt. Über das Kalender-Symbol landet eine Frist mit Erinnerung in deinem Handy-Kalender.')),
      btn('Frist', { variant: 'primary', iconName: 'plus', onClick: () => openFristForm(null, c) })),
    h('section', { class: 'card' },
      offen.length ? h('ul', { class: 'rows' }, offen.map(row))
        : emptyState('calendar', 'Keine offenen Fristen.', btn('Frist anlegen', { variant: 'primary', iconName: 'plus', onClick: () => openFristForm(null, c) }))),
    erledigt.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('span', { class: 'card-icon' }, icon('check', 20)), h('h2', {}, 'Zuletzt erledigt')),
      h('ul', { class: 'rows' }, erledigt.map(f => h('li', {},
        h('button', { type: 'button', class: 'row row-done', onclick: () => openFristForm(f, c) },
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, f.titel), h('span', { class: 'row-sub' }, fmtDate(f.datum))),
          h('span', { class: 'row-sub' }, 'erledigt')))))) : null
  );
}

function strip(f) {
  const { id, kind, ...rest } = f;
  return rest;
}

export function openFristForm(f, c) {
  const isNew = !f;
  const ids = { titel: nextId('t'), datum: nextId('d'), notiz: nextId('n') };
  const err = h('p', { class: 'form-error', role: 'alert' });
  const titel = h('input', { id: ids.titel, class: 'input', type: 'text', maxlength: 120, value: f?.titel || '', placeholder: 'z. B. Steuererklärung abgeben' });
  const datum = h('input', { id: ids.datum, class: 'input', type: 'date', value: f?.datum || '' });
  const notiz = h('textarea', { id: ids.notiz, class: 'input', rows: 3, maxlength: 2000, value: f?.notiz || '' });
  const info = h('p', { class: 'hint' });
  const updateInfo = () => {
    info.textContent = isISODate(datum.value) ? fristStatus(daysBetween(todayISO(), datum.value)).text : '';
  };
  datum.addEventListener('input', updateInfo);
  updateInfo();

  const form = h('form', { class: 'stack', novalidate: true, id: nextId('form') },
    h('div', { class: 'field' }, h('label', { for: ids.titel }, 'Was ist zu tun?'), titel),
    h('div', { class: 'field' }, h('label', { for: ids.datum }, 'Bis wann?'), datum, info),
    h('div', { class: 'field' }, h('label', { for: ids.notiz }, 'Notiz'), notiz),
    err);

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!titel.value.trim()) { err.textContent = 'Bitte beschreibe die Frist.'; titel.focus(); return; }
    if (!isISODate(datum.value)) { err.textContent = 'Bitte ein Datum wählen.'; datum.focus(); return; }
    c.store.save('frist', { titel: titel.value.trim(), datum: datum.value, notiz: notiz.value.trim(), erledigt: f?.erledigt || false }, f?.id);
    m.close();
    toast(isNew ? 'Frist angelegt' : 'Gespeichert', 'success');
  });

  const save = btn(isNew ? 'Anlegen' : 'Speichern', { variant: 'primary', type: 'submit' });
  save.setAttribute('form', form.id);
  const m = openModal({
    title: isNew ? 'Neue Frist' : 'Frist bearbeiten',
    body: form,
    footer: [
      !isNew ? btn('Löschen', { variant: 'ghost-danger', iconName: 'trash', onClick: async () => {
        if (await confirmDialog('Diese Frist löschen?', { okText: 'Löschen', danger: true })) { c.store.remove(f.id); m.close(); toast('Gelöscht'); }
      } }) : null,
      !isNew && f.erledigt ? btn('Wieder öffnen', { variant: 'secondary', onClick: () => { c.store.save('frist', { ...strip(f), erledigt: false }, f.id); m.close(); } }) : null,
      btn('Abbrechen', { variant: 'ghost', onClick: () => m.close() }),
      save
    ]
  });
  if (window.matchMedia('(pointer: fine)').matches) titel.focus();
}
