import { h, btn, fmtEUR, fmtSigned, fmtDate, fmtPct, amountToInput, openModal, confirmDialog, toast, emptyState, nextId, badge } from '../ui.js';
import { icon } from '../icons.js';
import { parseAmount, isISODate } from '../schema.js';
import { monthKey, monthLabel, monthTotals, categoryBreakdown, shiftMonth, todayISO, kontoListe } from '../math.js';
import { imageField } from './bilder.js';
import { deleteImages } from '../files.js';

export const KATEGORIEN = {
  ausgabe: ['Wohnen', 'Lebensmittel', 'Essen gehen', 'Mobilität', 'Versicherung', 'Handy & Internet', 'Abos', 'Freizeit', 'Kleidung', 'Gesundheit', 'Bildung', 'Geschenke', 'Sonstiges'],
  einnahme: ['Lohn', 'Nebenjob', 'Kindergeld', 'Erstattung', 'Geschenk', 'Verkauf', 'Sonstiges']
};

const KEIN_KONTO = '__kein';
let viewMonth = null;
let letztesKonto = null;

export function renderBuchungen(c) {
  const today = todayISO();
  if (!viewMonth) viewMonth = monthKey(today);
  const alle = c.snap.buchungen;
  const kontoNamen = new Map(kontoListe(c.snap.bereiche, c.snap.eintraege, alle).map(k => [k.id, k.titel]));
  const imMonat = alle.filter(b => b.datum && monthKey(b.datum) === viewMonth)
    .sort((a, b) => b.datum.localeCompare(a.datum) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const t = monthTotals(alle, viewMonth);
  const cats = categoryBreakdown(alle, viewMonth, 'ausgabe');
  const go = n => { viewMonth = shiftMonth(viewMonth, n); c.navigate('buchungen'); };

  return h('div', { class: 'stack-lg' },
    h('section', { class: 'hero' },
      h('div', { class: 'hero-text' }, h('h1', {}, 'Einnahmen & Ausgaben'), h('p', { class: 'muted' }, 'Jede Buchung fließt automatisch in deine Übersicht und in deine Kontostände ein.')),
      btn('Buchung', { variant: 'primary', iconName: 'plus', onClick: () => openBuchungForm(null, c) })),

    h('div', { class: 'month-nav' },
      btn('', { variant: 'ghost', iconName: 'chevronLeft', ariaLabel: 'Vorheriger Monat', onClick: () => go(-1) }),
      h('strong', {}, monthLabel(viewMonth, true)),
      btn('', { variant: 'ghost', iconName: 'chevronRight', ariaLabel: 'Nächster Monat', onClick: () => go(1) })),

    h('section', { class: 'stats stats-3' },
      h('div', { class: 'stat' }, h('p', { class: 'stat-label' }, 'Einnahmen'), h('p', { class: 'stat-value tone-success' }, fmtEUR(t.ein))),
      h('div', { class: 'stat' }, h('p', { class: 'stat-label' }, 'Ausgaben'), h('p', { class: 'stat-value tone-danger' }, fmtEUR(t.aus))),
      h('div', { class: 'stat' }, h('p', { class: 'stat-label' }, 'Ergebnis'), h('p', { class: `stat-value ${t.saldo < 0 ? 'tone-danger' : ''}` }, fmtSigned(t.saldo)),
        h('p', { class: 'stat-sub' }, t.ein > 0 ? `${fmtPct(Math.max(0, t.saldo) / t.ein)} gespart` : ''))),

    h('section', { class: 'grid grid-2' },
      h('article', { class: 'card' },
        h('div', { class: 'card-head' }, h('span', { class: 'card-icon' }, icon('swap', 20)), h('h2', {}, 'Buchungen')),
        imMonat.length
          ? h('ul', { class: 'rows' }, imMonat.map(b => {
            const sub = [fmtDate(b.datum), b.kontoId ? (kontoNamen.get(b.kontoId) || 'Konto gelöscht') : null, b.notiz].filter(Boolean).join(' · ');
            return h('li', {},
              h('button', { type: 'button', class: 'row', onclick: () => openBuchungForm(b, c) },
                h('span', { class: 'row-main' },
                  h('span', { class: 'row-title-line' },
                    h('span', { class: 'row-title' }, b.kategorie || 'Sonstiges'),
                    b.auto ? badge('automatisch', 'neutral') : null,
                    b.bilder && b.bilder.length ? h('span', { class: 'inline-icon' }, icon('image', 14)) : null),
                  h('span', { class: 'row-sub ellipsis' }, sub)),
                h('span', { class: `row-amount ${b.typ === 'einnahme' ? 'tone-success' : ''}` }, fmtSigned(b.typ === 'einnahme' ? Math.abs(b.betrag) : -Math.abs(b.betrag)))));
          }))
          : emptyState('swap', 'In diesem Monat gibt es noch keine Buchungen.', btn('Buchung erfassen', { variant: 'primary', iconName: 'plus', onClick: () => openBuchungForm(null, c) }))),
      h('article', { class: 'card' },
        h('div', { class: 'card-head' }, h('span', { class: 'card-icon' }, icon('chart', 20)), h('h2', {}, 'Wofür ging das Geld weg?')),
        cats.length
          ? h('ul', { class: 'cats' }, cats.map(k => {
            const bar = h('span', { class: 'cat-bar-fill' });
            bar.style.width = `${Math.max(2, Math.round(k.anteil * 100))}%`;
            return h('li', {},
              h('div', { class: 'cat-line' }, h('span', { class: 'ellipsis' }, k.kategorie), h('span', {}, `${fmtEUR(k.summe)} · ${fmtPct(k.anteil)}`)),
              h('span', { class: 'cat-bar' }, bar));
          }))
          : emptyState('chart', 'Sobald du Ausgaben erfasst, siehst du hier die Verteilung.'))
    )
  );
}

function strip(b) {
  const { id, kind, ...rest } = b;
  return rest;
}

export function openBuchungForm(b, c) {
  const isNew = !b;
  let typ = b?.typ || 'ausgabe';
  const ids = { betrag: nextId('b'), datum: nextId('d'), kat: nextId('k'), notiz: nextId('n'), list: nextId('l'), konto: nextId('ko') };
  const err = h('p', { class: 'form-error', role: 'alert' });

  const segment = h('div', { class: 'segment', role: 'radiogroup', 'aria-label': 'Art' });
  const datalist = h('datalist', { id: ids.list });
  const katInput = h('input', { id: ids.kat, class: 'input', type: 'text', list: ids.list, maxlength: 60, value: b?.kategorie || '', placeholder: 'z. B. Lebensmittel' });
  function drawType() {
    segment.replaceChildren(
      ...[['ausgabe', 'Ausgabe'], ['einnahme', 'Einnahme']].map(([id, label]) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(typ === id), class: `segment-item${typ === id ? ' active' : ''}`,
          onclick: () => { typ = id; drawType(); } }, label)));
    datalist.replaceChildren(...KATEGORIEN[typ].map(k => h('option', { value: k })));
  }
  drawType();

  const betrag = h('input', { id: ids.betrag, class: 'input input-lg', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00',
    value: b ? amountToInput(Math.abs(b.betrag)) : '' });
  const datum = h('input', { id: ids.datum, class: 'input', type: 'date', value: b?.datum || todayISO() });
  const notiz = h('input', { id: ids.notiz, class: 'input', type: 'text', maxlength: 200, value: b?.notiz || '', placeholder: 'optional' });

  // Welche Bank? Ein Konto = automatisch gewählt. Mehrere = Auswahl nötig.
  const konten = kontoListe(c.snap.bereiche, c.snap.eintraege, c.snap.buchungen);
  let kontoSelect = null;
  let kontoFeld;
  if (konten.length) {
    let initial;
    if (b) initial = b.kontoId && konten.some(k => k.id === b.kontoId) ? b.kontoId : KEIN_KONTO;
    else if (konten.length === 1) initial = konten[0].id;
    else initial = konten.some(k => k.id === letztesKonto) ? letztesKonto : '';
    kontoSelect = h('select', { id: ids.konto, class: 'input', value: initial },
      konten.length > 1 ? h('option', { value: '', disabled: true }, 'Bitte Konto wählen') : null,
      konten.map(k => h('option', { value: k.id }, `${k.titel} · ${fmtEUR(k.saldo)}`)),
      h('option', { value: KEIN_KONTO }, 'Keinem Konto zuordnen'));
    kontoFeld = h('div', { class: 'field' }, h('label', { for: ids.konto }, 'Konto'), kontoSelect,
      h('p', { class: 'hint' }, 'Der Betrag wird bei diesem Konto automatisch abgezogen bzw. hinzugefügt.'));
  } else {
    kontoFeld = h('p', { class: 'hint hint-box' }, icon('bank', 16),
      h('span', {}, 'Tipp: Lege unter „Banken & Konten“ ein Konto an. Dann wird jede Buchung automatisch beim Kontostand verrechnet.'));
  }

  const bilder = imageField(b?.bilder || []);

  const form = h('form', { class: 'stack', novalidate: true, id: nextId('form') },
    segment,
    h('div', { class: 'field' }, h('label', { for: ids.betrag }, 'Betrag in €'), betrag),
    kontoFeld,
    h('div', { class: 'field' }, h('label', { for: ids.kat }, 'Kategorie'), katInput, datalist),
    h('div', { class: 'field' }, h('label', { for: ids.datum }, 'Datum'), datum),
    h('div', { class: 'field' }, h('label', { for: ids.notiz }, 'Notiz'), notiz),
    bilder.el,
    b?.auto ? h('p', { class: 'hint hint-box' }, icon('zap', 16), h('span', {}, 'Diese Buchung wurde automatisch aus einem Vertrag erstellt.')) : null,
    err);

  let saved = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const n = parseAmount(betrag.value);
    if (!Number.isFinite(n) || n === 0) { err.textContent = 'Bitte einen Betrag eingeben, z. B. 12,50'; betrag.focus(); return; }
    if (kontoSelect && !kontoSelect.value) { err.textContent = 'Bitte wähle, welches Konto betroffen ist.'; kontoSelect.focus(); return; }
    if (!isISODate(datum.value)) { err.textContent = 'Bitte ein gültiges Datum wählen.'; datum.focus(); return; }
    save.disabled = true;
    const kontoId = kontoSelect && kontoSelect.value !== KEIN_KONTO ? kontoSelect.value : null;
    if (kontoId) letztesKonto = kontoId;
    const bilderIds = await bilder.commit();
    saved = true;
    c.store.save('buchung', {
      ...(b ? strip(b) : {}),
      typ,
      betrag: Math.round(Math.abs(n) * 100) / 100,
      datum: datum.value,
      kategorie: katInput.value.trim() || 'Sonstiges',
      notiz: notiz.value.trim(),
      kontoId,
      bilder: bilderIds,
      createdAt: b?.createdAt || new Date().toISOString()
    }, b?.id);
    m.close();
    toast(isNew ? 'Gebucht' : 'Gespeichert', 'success');
  });

  const save = btn(isNew ? 'Buchen' : 'Speichern', { variant: 'primary', type: 'submit' });
  save.setAttribute('form', form.id);
  const m = openModal({
    title: isNew ? 'Neue Buchung' : 'Buchung bearbeiten',
    body: form,
    footer: [
      !isNew ? btn('Löschen', { variant: 'ghost-danger', iconName: 'trash', collapse: true, onClick: async () => {
        if (await confirmDialog('Diese Buchung löschen? Der Kontostand wird entsprechend korrigiert.', { okText: 'Löschen', danger: true })) {
          deleteImages(b.bilder);
          // Automatische Buchungen werden nur storniert, damit sie nicht neu entstehen.
          if (b.auto) c.store.save('buchung', { ...strip(b), bilder: [], storniert: true }, b.id);
          else c.store.remove(b.id);
          saved = true;
          m.close();
          toast('Gelöscht');
        }
      } }) : null,
      btn('Abbrechen', { variant: 'ghost', onClick: () => m.close() }),
      save
    ],
    onClose: () => { if (!saved) bilder.discard(); }
  });
  if (window.matchMedia('(pointer: fine)').matches) betrag.focus();
}
