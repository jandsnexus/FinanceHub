// Mathe-Engine. Kein DOM, keine Firebase. Wird in Node getestet.
import { entryTitle, isISODate } from './schema.js';

export const MONTHLY_FACTOR = {
  woechentlich: 52 / 12,
  monatlich: 1,
  quartalsweise: 1 / 3,
  halbjaehrlich: 1 / 6,
  jaehrlich: 1 / 12,
  einmalig: 0
};

const MONTH_STEP = { monatlich: 1, quartalsweise: 3, halbjaehrlich: 6, jaehrlich: 12 };
const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export const round2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

export function toMonthly(amount, interval = 'monatlich') {
  const f = MONTHLY_FACTOR[interval] ?? 1;
  return round2((Number(amount) || 0) * f);
}

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const toDayNumber = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

const fromDayNumber = n => new Date(n * 86400000).toISOString().slice(0, 10);

export function daysBetween(fromIso, toIso) {
  return Math.round(toDayNumber(toIso) - toDayNumber(fromIso));
}

export function addDays(iso, n) {
  return fromDayNumber(toDayNumber(iso) + n);
}

function daysInMonth(y, m0) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

// 31.01. + 1 Monat = 28./29.02. – immer vom Ursprungsdatum aus gerechnet, damit nichts "wandert".
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = (m - 1) + n;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const day = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Nächster Termin ab heute (inklusive). Einmalig + vorbei = null.
export function nextOccurrence(anchorIso, interval, today) {
  if (!isISODate(anchorIso)) return null;
  if (anchorIso >= today) return anchorIso;
  if (interval === 'einmalig') return null;
  if (interval === 'woechentlich') {
    const diff = daysBetween(anchorIso, today);
    return addDays(anchorIso, Math.ceil(diff / 7) * 7);
  }
  const step = MONTH_STEP[interval] || 1;
  for (let k = 1; k <= 2400; k++) {
    const next = addMonths(anchorIso, k * step);
    if (next >= today) return next;
  }
  return null;
}

// Was ein Eintrag für die Mathematik bedeutet, abgeleitet aus den Rollen der Felder.
export function entryFacts(bereich, eintrag) {
  const facts = { kosten: 0, einnahme: 0, saldo: null, intervall: 'monatlich', faellig: null, fristen: [] };
  const values = eintrag?.values || {};
  for (const fld of bereich?.fields || []) {
    const v = values[fld.id];
    if (v === null || v === undefined || v === '') continue;
    if (fld.type === 'betrag' && typeof v === 'number' && Number.isFinite(v)) {
      if (fld.role === 'kosten') facts.kosten += v;
      else if (fld.role === 'einnahme') facts.einnahme += v;
      else if (fld.role === 'saldo') facts.saldo = (facts.saldo || 0) + v;
    } else if (fld.type === 'intervall' && v in MONTHLY_FACTOR) {
      facts.intervall = v;
    } else if (fld.type === 'datum' && isISODate(v)) {
      if (fld.role === 'faellig' && !facts.faellig) facts.faellig = v;
      else if (fld.role === 'frist') facts.fristen.push({ label: fld.label, datum: v });
    }
  }
  facts.kosten = round2(facts.kosten);
  facts.einnahme = round2(facts.einnahme);
  if (facts.saldo !== null) facts.saldo = round2(facts.saldo);
  return facts;
}

export function monthKey(iso) {
  return iso.slice(0, 7);
}

export function shiftMonth(ym, n) {
  return addMonths(ym + '-01', n).slice(0, 7);
}

export function monthLabel(ym, long = false) {
  const [y, m] = ym.split('-').map(Number);
  if (long) {
    return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }
  return MONTH_NAMES[m - 1];
}

export function monthTotals(buchungen, ym) {
  let ein = 0, aus = 0;
  for (const b of buchungen) {
    if (b.storniert || !b.datum || monthKey(b.datum) !== ym) continue;
    const betrag = Math.abs(Number(b.betrag) || 0);
    if (b.typ === 'einnahme') ein += betrag; else aus += betrag;
  }
  return { ein: round2(ein), aus: round2(aus), saldo: round2(ein - aus) };
}

export function categoryBreakdown(buchungen, ym, typ = 'ausgabe') {
  const map = new Map();
  for (const b of buchungen) {
    if (b.storniert || !b.datum || monthKey(b.datum) !== ym || b.typ !== typ) continue;
    const k = b.kategorie || 'Sonstiges';
    map.set(k, (map.get(k) || 0) + Math.abs(Number(b.betrag) || 0));
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([kategorie, summe]) => ({ kategorie, summe: round2(summe), anteil: total ? summe / total : 0 }))
    .sort((a, b) => b.summe - a.summe);
}

export function fristStatus(tage) {
  if (tage < 0) return { tone: 'danger', text: tage === -1 ? 'Seit gestern fällig' : `Seit ${-tage} Tagen fällig` };
  if (tage === 0) return { tone: 'danger', text: 'Heute' };
  if (tage === 1) return { tone: 'danger', text: 'Morgen' };
  if (tage <= 7) return { tone: 'danger', text: `Noch ${tage} Tage` };
  if (tage <= 30) return { tone: 'warning', text: `Noch ${tage} Tage` };
  if (tage <= 60) return { tone: 'neutral', text: `Noch ${tage} Tage` };
  const monate = Math.round(tage / 30.44);
  return { tone: 'neutral', text: `Noch ${monate} Monate` };
}

// Alles, was das Dashboard braucht, in einem Durchlauf.
export function summarize({ bereiche, eintraege, buchungen, fristen }, today = todayISO()) {
  const byId = new Map(bereiche.map(b => [b.id, b]));
  const proBereich = new Map(bereiche.map(b => [b.id, { count: 0, monat: 0, einnahmenMonat: 0, saldo: 0 }]));
  const konten = [];
  const kommende = [];
  const alleFristen = [];
  let fixkosten = 0, fixeinnahmen = 0, vermoegen = 0;
  const deltas = kontoDeltas(eintraege, buchungen);

  for (const e of eintraege) {
    const b = byId.get(e.bereichId);
    if (!b) continue;
    const facts = entryFacts(b, e);
    const titel = entryTitle(b, e);
    const pb = proBereich.get(b.id);
    pb.count += 1;
    const mk = toMonthly(facts.kosten, facts.intervall);
    const me = toMonthly(facts.einnahme, facts.intervall);
    pb.monat = round2(pb.monat + mk);
    pb.einnahmenMonat = round2(pb.einnahmenMonat + me);
    fixkosten += mk;
    fixeinnahmen += me;
    if (facts.saldo !== null || deltas.has(e.id)) {
      const saldo = round2((facts.saldo || 0) + (deltas.get(e.id) || 0));
      vermoegen += saldo;
      pb.saldo = round2(pb.saldo + saldo);
      konten.push({ id: e.id, bereichId: b.id, titel, saldo });
    }
    if (facts.faellig && (facts.kosten || facts.einnahme)) {
      const datum = nextOccurrence(facts.faellig, facts.intervall, today);
      if (datum) {
        kommende.push({
          id: e.id, bereichId: b.id, titel, datum,
          betrag: round2(facts.einnahme - facts.kosten),
          tage: daysBetween(today, datum)
        });
      }
    }
    for (const fr of facts.fristen) {
      const tage = daysBetween(today, fr.datum);
      if (tage >= 0) {
        alleFristen.push({ quelle: 'eintrag', id: e.id, bereichId: b.id, titel: `${titel}: ${fr.label}`, datum: fr.datum, tage });
      }
    }
  }

  for (const fr of fristen) {
    if (fr.erledigt || !isISODate(fr.datum)) continue;
    alleFristen.push({ quelle: 'frist', id: fr.id, titel: fr.titel || 'Frist', datum: fr.datum, tage: daysBetween(today, fr.datum) });
  }

  kommende.sort((a, b) => a.datum.localeCompare(b.datum) || a.titel.localeCompare(b.titel));
  alleFristen.sort((a, b) => a.datum.localeCompare(b.datum) || a.titel.localeCompare(b.titel));
  konten.sort((a, b) => b.saldo - a.saldo);

  const cur = monthKey(today);
  const monate = [];
  for (let i = 5; i >= 0; i--) {
    const ym = shiftMonth(cur, -i);
    monate.push({ ym, label: monthLabel(ym), ...monthTotals(buchungen, ym) });
  }
  const dieserMonat = monate[5];
  const letzterMonat = monate[4];

  fixkosten = round2(fixkosten);
  fixeinnahmen = round2(fixeinnahmen);
  const frei = round2(fixeinnahmen - fixkosten);

  return {
    vermoegen: round2(vermoegen),
    konten,
    fixkosten,
    fixkostenJahr: round2(fixkosten * 12),
    fixeinnahmen,
    frei,
    sparquote: fixeinnahmen > 0 ? frei / fixeinnahmen : null,
    kommende,
    fristen: alleFristen,
    proBereich,
    monate,
    dieserMonat,
    letzterMonat,
    monatsVeraenderung: round2(dieserMonat.saldo - letzterMonat.saldo)
  };
}

// ---------- Konten & Buchungen ----------

export function hasRole(bereich, role) {
  return (bereich?.fields || []).some(f => f.role === role);
}

export function saldoFieldId(bereich) {
  const f = (bereich?.fields || []).find(x => x.type === 'betrag' && x.role === 'saldo');
  return f ? f.id : null;
}

// Wie stark sich jedes Konto durch Buchungen verändert hat – nur Buchungen NACH dem
// letzten manuell eingetragenen Kontostand zählen (sonst würde doppelt gerechnet).
export function kontoDeltas(eintraege, buchungen) {
  const basis = new Map(eintraege.map(e => [e.id, String(e.saldoGesetztAm || '')]));
  const out = new Map();
  for (const b of buchungen) {
    if (b.storniert || !b.kontoId || !basis.has(b.kontoId)) continue;
    if (String(b.createdAt || '') <= basis.get(b.kontoId)) continue;
    const betrag = Math.abs(Number(b.betrag) || 0);
    out.set(b.kontoId, round2((out.get(b.kontoId) || 0) + (b.typ === 'einnahme' ? betrag : -betrag)));
  }
  return out;
}

// Alle Konten (Einträge in Bereichen mit einem Kontostand-Feld) mit aktuellem Stand.
export function kontoListe(bereiche, eintraege, buchungen) {
  const deltas = kontoDeltas(eintraege, buchungen);
  const out = [];
  for (const b of bereiche) {
    if (!hasRole(b, 'saldo')) continue;
    for (const e of eintraege) {
      if (e.bereichId !== b.id) continue;
      const f = entryFacts(b, e);
      out.push({ id: e.id, bereichId: b.id, titel: entryTitle(b, e), saldo: round2((f.saldo || 0) + (deltas.get(e.id) || 0)) });
    }
  }
  return out.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
}

// Alle Termine einer Zahlung zwischen from und to (inklusive), höchstens max Stück.
export function occurrencesBetween(anchor, interval, from, to, max = 60) {
  if (!isISODate(anchor) || from > to) return [];
  const out = [];
  if (interval === 'einmalig') return anchor >= from && anchor <= to ? [anchor] : [];
  if (interval === 'woechentlich') {
    let d = nextOccurrence(anchor, 'woechentlich', from);
    while (d && d <= to && out.length < max) { out.push(d); d = addDays(d, 7); }
    return out;
  }
  const step = MONTH_STEP[interval] || 1;
  for (let k = 0; k <= 2400 && out.length < max; k++) {
    const d = addMonths(anchor, k * step);
    if (d > to) break;
    if (d >= from) out.push(d);
  }
  return out;
}

// Welche automatischen Abbuchungen fällig sind und noch fehlen.
// Die ID ist eindeutig pro Vertrag und Datum – so entsteht auch auf mehreren Geräten nie eine doppelte Buchung.
export function faelligeAutoBuchungen(bereiche, eintraege, vorhandeneIds, today) {
  const byId = new Map(bereiche.map(b => [b.id, b]));
  const out = [];
  for (const e of eintraege) {
    if (!e.kontoId || !e.autoAb || !isISODate(e.autoAb)) continue;
    const b = byId.get(e.bereichId);
    if (!b) continue;
    const f = entryFacts(b, e);
    const netto = round2(f.einnahme - f.kosten);
    if (!netto || !f.faellig) continue;
    for (const datum of occurrencesBetween(f.faellig, f.intervall, e.autoAb, today, 24)) {
      const id = `auto_${e.id}_${datum}`;
      if (vorhandeneIds.has(id)) continue;
      out.push({
        id,
        data: {
          typ: netto < 0 ? 'ausgabe' : 'einnahme',
          betrag: Math.abs(netto),
          datum,
          kategorie: b.name,
          notiz: entryTitle(b, e),
          kontoId: e.kontoId,
          eintragId: e.id,
          auto: true
        }
      });
    }
  }
  return out;
}

// Termine pro Tag für den Kalender (Fristen, Zahlungen, Notizen) im Zeitraum.
export function kalenderEreignisse({ bereiche, eintraege, fristen, notizen }, from, to) {
  const byId = new Map(bereiche.map(b => [b.id, b]));
  const map = new Map();
  const add = (datum, ev) => {
    if (datum < from || datum > to) return;
    if (!map.has(datum)) map.set(datum, []);
    map.get(datum).push(ev);
  };
  for (const e of eintraege) {
    const b = byId.get(e.bereichId);
    if (!b) continue;
    const f = entryFacts(b, e);
    const titel = entryTitle(b, e);
    const netto = round2(f.einnahme - f.kosten);
    if (f.faellig && netto) {
      for (const d of occurrencesBetween(f.faellig, f.intervall, from, to, 60)) {
        add(d, { art: 'zahlung', titel, betrag: netto, bereichId: b.id });
      }
    }
    for (const fr of f.fristen) add(fr.datum, { art: 'frist', titel: `${titel}: ${fr.label}`, bereichId: b.id });
  }
  for (const fr of fristen) {
    if (isISODate(fr.datum)) add(fr.datum, { art: 'frist', titel: fr.titel || 'Frist', erledigt: !!fr.erledigt, fristId: fr.id });
  }
  for (const n of notizen) {
    if (isISODate(n.datum) && n.text) add(n.datum, { art: 'notiz', titel: n.text });
  }
  return map;
}
