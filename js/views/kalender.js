// Kalender (oben rechts): Monatsansicht mit Notizen, Fristen und Zahlungen pro Tag.
import { h, btn, fmtSigned, openModal, toast, nextId } from '../ui.js';
import { todayISO, monthKey, monthLabel, shiftMonth, addDays, kalenderEreignisse } from '../math.js';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const longDate = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function weekdayIndex(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Montag = 0
}

function lastDayOfMonth(ym) {
  return addDays(shiftMonth(ym, 1) + '-01', -1);
}

const noteId = datum => 'notiz_' + datum;

export function openKalender(c) {
  const today = todayISO();
  let ym = monthKey(today);
  let sel = today;
  const gridWrap = h('div');
  const dayWrap = h('div', { class: 'cal-day' });
  const title = h('strong', { class: 'cal-title' });

  function events(from, to) {
    const snap = c.store.snapshot();
    return kalenderEreignisse(snap, from, to);
  }

  function drawGrid() {
    const first = ym + '-01';
    const last = lastDayOfMonth(ym);
    const start = addDays(first, -weekdayIndex(first));
    const end = addDays(last, 6 - weekdayIndex(last));
    const ev = events(start, end);
    title.textContent = monthLabel(ym, true);
    const cells = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const list = ev.get(d) || [];
      const kinds = new Set(list.filter(x => !x.erledigt).map(x => x.art));
      const day = d;
      cells.push(h('button', {
        type: 'button',
        class: ['cal-cell', d.slice(0, 7) !== ym ? 'is-outside' : '', d === today ? 'is-today' : '', d === sel ? 'is-selected' : ''].filter(Boolean).join(' '),
        'aria-label': `${longDate.format(new Date(d + 'T00:00:00Z'))}${list.length ? `, ${list.length} Einträge` : ''}`,
        'aria-pressed': String(d === sel),
        onclick: () => { sel = day; if (day.slice(0, 7) !== ym) ym = day.slice(0, 7); drawGrid(); drawDay(); }
      },
      h('span', { class: 'cal-num' }, String(Number(d.slice(8)))),
      h('span', { class: 'cal-dots' },
        kinds.has('notiz') ? h('span', { class: 'cal-dot dot-note' }) : null,
        kinds.has('frist') ? h('span', { class: 'cal-dot dot-frist' }) : null,
        kinds.has('zahlung') ? h('span', { class: 'cal-dot dot-pay' }) : null)));
    }
    gridWrap.replaceChildren(
      h('div', { class: 'cal-grid cal-head' }, WOCHENTAGE.map(w => h('span', {}, w))),
      h('div', { class: 'cal-grid' }, cells)
    );
  }

  function drawDay() {
    const list = (events(sel, sel).get(sel) || []).filter(x => x.art !== 'notiz');
    const note = c.store.get(noteId(sel));
    const tid = nextId('note');
    const area = h('textarea', { id: tid, class: 'input', rows: 3, maxlength: 2000, value: note?.text || '', placeholder: 'Notiz für diesen Tag …' });
    const saveBtn = btn('Notiz speichern', { variant: 'primary', small: true, iconName: 'check', onClick: () => {
      const text = area.value.trim();
      if (!text) {
        if (note) { c.store.remove(note.id); toast('Notiz gelöscht'); }
      } else {
        c.store.save('notiz', { datum: sel, text }, noteId(sel));
        toast('Notiz gespeichert', 'success');
      }
      drawGrid();
      drawDay();
    } });
    const delBtn = note ? btn('Löschen', { variant: 'ghost-danger', small: true, iconName: 'trash', onClick: () => {
      c.store.remove(note.id); toast('Notiz gelöscht'); drawGrid(); drawDay();
    } }) : null;

    dayWrap.replaceChildren(
      h('h3', { class: 'section-title' }, longDate.format(new Date(sel + 'T00:00:00Z'))),
      list.length
        ? h('ul', { class: 'cal-events' }, list.map(x => h('li', { class: `cal-event ev-${x.art}${x.erledigt ? ' is-done' : ''}` },
          h('span', { class: `cal-dot ${x.art === 'frist' ? 'dot-frist' : 'dot-pay'}` }),
          h('span', { class: 'cal-event-text' }, x.titel),
          x.art === 'zahlung' ? h('span', { class: `cal-event-amount ${x.betrag > 0 ? 'tone-success' : ''}` }, fmtSigned(x.betrag)) : null)))
        : h('p', { class: 'hint' }, 'Keine Fristen oder Zahlungen an diesem Tag.'),
      h('div', { class: 'field' }, h('label', { for: tid }, 'Notiz'), area),
      h('div', { class: 'cal-actions' }, delBtn, saveBtn)
    );
  }

  const nav = h('div', { class: 'cal-nav' },
    btn('', { variant: 'ghost', iconName: 'chevronLeft', ariaLabel: 'Vorheriger Monat', onClick: () => { ym = shiftMonth(ym, -1); drawGrid(); } }),
    title,
    btn('', { variant: 'ghost', iconName: 'chevronRight', ariaLabel: 'Nächster Monat', onClick: () => { ym = shiftMonth(ym, 1); drawGrid(); } }),
    btn('Heute', { variant: 'secondary', small: true, onClick: () => { ym = monthKey(today); sel = today; drawGrid(); drawDay(); } }));

  const legend = h('div', { class: 'cal-legend' },
    h('span', {}, h('span', { class: 'cal-dot dot-note' }), 'Notiz'),
    h('span', {}, h('span', { class: 'cal-dot dot-frist' }), 'Frist'),
    h('span', {}, h('span', { class: 'cal-dot dot-pay' }), 'Zahlung'));

  drawGrid();
  drawDay();
  openModal({
    title: 'Kalender',
    wide: true,
    body: h('div', { class: 'cal' }, h('div', { class: 'cal-main' }, nav, gridWrap, legend), dayWrap)
  });
}
