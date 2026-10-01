import { h, btn, fmtEUR, fmtSigned, fmtPct, fmtDate, badge, emptyState } from '../ui.js';
import { icon } from '../icons.js';
import { fristStatus } from '../math.js';
import { openEntryForm, openBereichEditor } from './bereiche.js';
import { openBuchungForm } from './buchungen.js';
import { openFristForm } from './fristen.js';

const NS = 'http://www.w3.org/2000/svg';

function cardHead(iconName, title, link, c) {
  return h('div', { class: 'card-head' },
    h('span', { class: 'card-icon' }, icon(iconName, 20)),
    h('h2', {}, title),
    link ? h('a', { class: 'card-link', href: '#/' + link, 'aria-label': `${title}: alle anzeigen` }, 'Alle', icon('chevronRight', 14)) : null
  );
}

function stat(label, value, sub, tone) {
  return h('div', { class: 'stat' },
    h('p', { class: 'stat-label' }, label),
    h('p', { class: `stat-value${tone ? ' tone-' + tone : ''}` }, value),
    sub ? h('p', { class: 'stat-sub' }, sub) : null
  );
}

function barChart(monate) {
  const W = 320, H = 150, pad = 22, base = H - 22;
  const max = Math.max(1, ...monate.flatMap(m => [m.ein, m.aus]));
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Einnahmen und Ausgaben der letzten sechs Monate');
  const line = document.createElementNS(NS, 'line');
  Object.entries({ x1: pad, x2: W - 4, y1: base, y2: base, class: 'chart-axis' }).forEach(([k, v]) => line.setAttribute(k, v));
  svg.appendChild(line);
  const slot = (W - pad - 4) / monate.length;
  const bw = Math.min(14, slot / 3);
  monate.forEach((m, i) => {
    const cx = pad + slot * i + slot / 2;
    [['ein', -bw / 2 - 1, 'bar-in'], ['aus', bw / 2 + 1, 'bar-out']].forEach(([k, off, cls]) => {
      const val = m[k];
      const hgt = Math.max(val > 0 ? 2 : 0, (val / max) * (base - 10));
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(cx + off - bw / 2));
      r.setAttribute('y', String(base - hgt));
      r.setAttribute('width', String(bw));
      r.setAttribute('height', String(hgt));
      r.setAttribute('rx', '2');
      r.setAttribute('class', cls);
      const t = document.createElementNS(NS, 'title');
      t.textContent = `${m.label}: ${k === 'ein' ? 'Einnahmen' : 'Ausgaben'} ${fmtEUR(val)}`;
      r.appendChild(t);
      svg.appendChild(r);
    });
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', String(cx));
    label.setAttribute('y', String(H - 6));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', i === monate.length - 1 ? 'chart-label strong' : 'chart-label');
    label.textContent = m.label;
    svg.appendChild(label);
  });
  return svg;
}

function quickAdd(c) {
  const bereiche = c.snap.bereiche;
  const items = [
    ['swap', 'Einnahme oder Ausgabe erfassen', () => openBuchungForm(null, c)],
    ['calendar', 'Frist anlegen', () => openFristForm(null, c)],
    ...bereiche.slice(0, 4).map(b => [b.icon || 'folder', `${b.name}: Eintrag hinzufügen`, () => openEntryForm(b, null, c)]),
    ['plus', 'Neuen Bereich erstellen', () => openBereichEditor(null, c)]
  ];
  return h('ul', { class: 'quick' }, items.map(([ic, label, fn]) =>
    h('li', {}, h('button', { type: 'button', class: 'quick-item', onclick: fn }, icon(ic, 18), h('span', {}, label), icon('chevronRight', 16)))));
}

export function renderDashboard(c) {
  const s = c.summary;
  const name = c.store.profil().name;
  const hour = new Date().getHours();
  const gruss = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';

  const konten = s.konten.length
    ? h('ul', { class: 'rows' }, s.konten.slice(0, 6).map(k =>
      h('li', {}, h('a', { class: 'row', href: '#/bereich/' + encodeURIComponent(k.bereichId) },
        h('span', { class: 'row-title' }, k.titel), h('span', { class: 'row-amount' }, fmtEUR(k.saldo))))))
    : emptyState('bank', 'Noch keine Konten. Lege eins an, dann siehst du hier dein Gesamtvermögen.');

  const kommende = s.kommende.length
    ? h('ul', { class: 'rows' }, s.kommende.slice(0, 5).map(k =>
      h('li', {}, h('a', { class: 'row', href: '#/bereich/' + encodeURIComponent(k.bereichId) },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, k.titel), h('span', { class: 'row-sub' }, fmtDate(k.datum))),
        h('span', { class: `row-amount ${k.betrag < 0 ? 'tone-danger' : 'tone-success'}` }, fmtSigned(k.betrag))))))
    : emptyState('clock', 'Keine kommenden Zahlungen. Trage bei Verträgen „Nächste Zahlung“ ein.');

  const fristen = s.fristen.length
    ? h('ul', { class: 'rows' }, s.fristen.slice(0, 5).map(f => {
      const st = fristStatus(f.tage);
      return h('li', {}, h('a', { class: 'row', href: f.quelle === 'frist' ? '#/fristen' : '#/bereich/' + encodeURIComponent(f.bereichId) },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, f.titel), h('span', { class: 'row-sub' }, fmtDate(f.datum))),
        badge(st.text, st.tone)));
    }))
    : emptyState('calendar', 'Keine offenen Fristen.');

  const m = s.dieserMonat;
  const bereichTiles = c.snap.bereiche.map(b => {
    const pb = s.proBereich.get(b.id) || { count: 0, monat: 0, einnahmenMonat: 0, saldo: 0 };
    const detail = pb.monat ? `${fmtEUR(pb.monat)} / Monat`
      : pb.einnahmenMonat ? `+ ${fmtEUR(pb.einnahmenMonat)} / Monat`
        : pb.saldo ? fmtEUR(pb.saldo) : `${pb.count} ${pb.count === 1 ? 'Eintrag' : 'Einträge'}`;
    return h('a', { class: 'tile', href: '#/bereich/' + encodeURIComponent(b.id) },
      h('span', { class: 'card-icon' }, icon(b.icon || 'folder', 20)),
      h('span', { class: 'tile-text' }, h('strong', {}, b.name), h('small', {}, detail)),
      icon('chevronRight', 16));
  });

  return h('div', { class: 'stack-lg' },
    h('section', { class: 'hero' },
      h('div', {},
        h('h1', {}, name ? `${gruss}, ${name}` : gruss),
        h('p', { class: 'muted' }, 'Hier ist deine finanzielle Übersicht.')),
      btn('Buchung', { variant: 'primary', iconName: 'plus', onClick: () => openBuchungForm(null, c) })
    ),

    h('section', { class: 'stats', 'aria-label': 'Kennzahlen' },
      stat('Gesamtvermögen', fmtEUR(s.vermoegen), `${s.konten.length} ${s.konten.length === 1 ? 'Konto' : 'Konten'}`),
      stat('Fixkosten pro Monat', fmtEUR(s.fixkosten), `${fmtEUR(s.fixkostenJahr)} im Jahr`),
      stat('Feste Einnahmen pro Monat', fmtEUR(s.fixeinnahmen), 'aus Arbeit & Co.'),
      stat('Bleibt übrig pro Monat', fmtEUR(s.frei), s.sparquote === null ? 'Trage dein Gehalt ein' : `Sparquote ${fmtPct(s.sparquote)}`, s.frei < 0 ? 'danger' : null)
    ),

    h('section', { class: 'dash' },
      h('article', { class: 'card' }, cardHead('bank', 'Kontostände', null, c),
        h('p', { class: 'big' }, fmtEUR(s.vermoegen)), konten),
      h('article', { class: 'card' }, cardHead('chart', 'Einnahmen & Ausgaben', 'buchungen', c),
        h('div', { class: 'legend' }, h('span', { class: 'dot dot-in' }), 'Einnahmen', h('span', { class: 'dot dot-out' }), 'Ausgaben'),
        barChart(s.monate),
        h('div', { class: 'split' },
          h('div', {}, h('small', {}, 'Einnahmen diesen Monat'), h('strong', {}, fmtEUR(m.ein))),
          h('div', {}, h('small', {}, 'Ausgaben diesen Monat'), h('strong', {}, fmtEUR(m.aus))))),
      h('article', { class: 'card' }, cardHead('clock', 'Kommende Zahlungen', null, c), kommende),
      h('article', { class: 'card' }, cardHead('calendar', 'Offene Fristen', 'fristen', c), fristen),
      h('article', { class: 'card' }, cardHead('grid', 'Deine Bereiche', 'bereiche', c),
        bereichTiles.length ? h('div', { class: 'tiles' }, bereichTiles) : emptyState('folder', 'Noch keine Bereiche.')),
      h('article', { class: 'card' }, cardHead('zap', 'Schnellzugriff', null, c), quickAdd(c))
    )
  );
}
