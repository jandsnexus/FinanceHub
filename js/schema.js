// Schema-Engine: Hier ist definiert, welche Felder es gibt und was sie für die Mathematik bedeuten.
// Rein logisch, kein DOM. Wird in Node getestet.

export const FIELD_TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'mehrzeilig', label: 'Notiz (mehrzeilig)' },
  { id: 'betrag', label: 'Betrag (€)' },
  { id: 'zahl', label: 'Zahl' },
  { id: 'datum', label: 'Datum' },
  { id: 'intervall', label: 'Zahlweise' },
  { id: 'auswahl', label: 'Auswahl' },
  { id: 'geheim', label: 'Geheim (verdeckt)' }
];

// Rollen sagen der Mathe-Engine, wie ein Feld zählt.
export const ROLES = {
  betrag: [
    { id: '', label: 'Nur anzeigen' },
    { id: 'kosten', label: 'Regelmäßige Kosten' },
    { id: 'einnahme', label: 'Regelmäßige Einnahme' },
    { id: 'saldo', label: 'Kontostand / Guthaben' }
  ],
  datum: [
    { id: '', label: 'Nur anzeigen' },
    { id: 'faellig', label: 'Nächste Zahlung' },
    { id: 'frist', label: 'Frist (z. B. kündbar bis)' }
  ]
};

export const INTERVALS = [
  { id: 'monatlich', label: 'Monatlich' },
  { id: 'quartalsweise', label: 'Vierteljährlich' },
  { id: 'halbjaehrlich', label: 'Halbjährlich' },
  { id: 'jaehrlich', label: 'Jährlich' },
  { id: 'woechentlich', label: 'Wöchentlich' },
  { id: 'einmalig', label: 'Einmalig' }
];

export const BEREICH_ICONS = [
  'user', 'bank', 'shield', 'file', 'briefcase', 'receipt', 'home', 'car', 'heart',
  'phone', 'zap', 'wallet', 'folder', 'layers'
];

export function intervalLabel(id) {
  return (INTERVALS.find(i => i.id === id) || INTERVALS[0]).label;
}

export function typeLabel(id) {
  return (FIELD_TYPES.find(t => t.id === id) || { label: id }).label;
}

export function rolesFor(type) {
  return ROLES[type] || null;
}

export function newFieldId() {
  return 'f' + Math.random().toString(36).slice(2, 9);
}

const f = (id, label, type, extra = {}) => ({ id, label, type, role: '', ...extra });

export function defaultBereiche() {
  return [
    {
      name: 'Persönliche Daten', icon: 'user', order: 0,
      fields: [
        f('name', 'Name', 'text', { required: true }),
        f('geburt', 'Geburtsdatum', 'datum'),
        f('adresse', 'Adresse', 'mehrzeilig'),
        f('telefon', 'Telefon', 'text'),
        f('email', 'E-Mail', 'text'),
        f('steuerid', 'Steuer-ID', 'geheim'),
        f('svnr', 'Sozialversicherungsnummer', 'geheim'),
        f('kvnr', 'Krankenversicherungsnummer', 'geheim'),
        f('familienstand', 'Familienstand', 'auswahl', { options: ['Ledig', 'Verheiratet', 'Geschieden', 'Verwitwet'] })
      ]
    },
    {
      name: 'Banken & Konten', icon: 'bank', order: 1,
      fields: [
        f('name', 'Konto', 'text', { required: true }),
        f('art', 'Art', 'auswahl', { options: ['Girokonto', 'Sparkonto', 'Tagesgeld', 'Depot', 'PayPal', 'Kreditkarte', 'Sonstiges'] }),
        f('saldo', 'Kontostand', 'betrag', { role: 'saldo' }),
        f('iban', 'IBAN', 'geheim'),
        f('notiz', 'Notiz', 'mehrzeilig')
      ]
    },
    {
      name: 'Versicherungen', icon: 'shield', order: 2,
      fields: [
        f('name', 'Versicherung', 'text', { required: true }),
        f('anbieter', 'Anbieter', 'text'),
        f('beitrag', 'Beitrag', 'betrag', { role: 'kosten' }),
        f('zahlweise', 'Zahlweise', 'intervall'),
        f('naechste', 'Nächste Zahlung', 'datum', { role: 'faellig' }),
        f('kuendbar', 'Kündbar bis', 'datum', { role: 'frist' }),
        f('vertragsnr', 'Vertragsnummer', 'geheim'),
        f('notiz', 'Notiz', 'mehrzeilig')
      ]
    },
    {
      name: 'Verträge & Rechnungen', icon: 'file', order: 3,
      fields: [
        f('name', 'Bezeichnung', 'text', { required: true }),
        f('anbieter', 'Anbieter', 'text'),
        f('betrag', 'Betrag', 'betrag', { role: 'kosten' }),
        f('zahlweise', 'Zahlweise', 'intervall'),
        f('naechste', 'Nächste Zahlung', 'datum', { role: 'faellig' }),
        f('kuendbar', 'Kündbar bis', 'datum', { role: 'frist' }),
        f('kundennr', 'Kundennummer', 'geheim'),
        f('notiz', 'Notiz', 'mehrzeilig')
      ]
    },
    {
      name: 'Arbeit & Lohn', icon: 'briefcase', order: 4,
      fields: [
        f('name', 'Arbeitgeber', 'text', { required: true }),
        f('beginn', 'Beschäftigt seit', 'datum'),
        f('arbeitszeit', 'Arbeitszeit', 'text'),
        f('brutto', 'Bruttogehalt', 'betrag'),
        f('netto', 'Nettogehalt', 'betrag', { role: 'einnahme' }),
        f('zahlweise', 'Zahlweise', 'intervall'),
        f('notiz', 'Notiz', 'mehrzeilig')
      ]
    },
    {
      name: 'Steuern', icon: 'receipt', order: 5,
      fields: [
        f('name', 'Bezeichnung', 'text', { required: true }),
        f('jahr', 'Steuerjahr', 'zahl'),
        f('betrag', 'Erstattung / Nachzahlung', 'betrag'),
        f('abgabe', 'Abgabe bis', 'datum', { role: 'frist' }),
        f('steuernr', 'Steuernummer', 'geheim'),
        f('notiz', 'Notiz', 'mehrzeilig')
      ]
    }
  ];
}

// "1.234,56" / "1234.56" / "12 €" / "-5" -> Zahl, sonst NaN
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  let s = String(input ?? '').trim().replace(/[€\s\u00a0]/g, '').replace(/\u2212/g, '-');
  if (s === '') return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // "1.234" = Tausenderpunkt
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

export function isISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Rohwert aus dem Formular -> gespeicherter Wert. Gibt { value, error } zurück.
export function coerceValue(field, raw) {
  const str = typeof raw === 'string' ? raw.trim() : raw;
  if (str === '' || str === null || str === undefined) {
    return field.required ? { value: null, error: 'Pflichtfeld' } : { value: null, error: null };
  }
  switch (field.type) {
    case 'betrag':
    case 'zahl': {
      const n = parseAmount(str);
      if (!Number.isFinite(n)) return { value: null, error: 'Bitte eine Zahl eingeben, z. B. 12,50' };
      return { value: field.type === 'betrag' ? Math.round(n * 100) / 100 : n, error: null };
    }
    case 'datum':
      return isISODate(str) ? { value: str, error: null } : { value: null, error: 'Ungültiges Datum' };
    case 'intervall':
      return INTERVALS.some(i => i.id === str) ? { value: str, error: null } : { value: 'monatlich', error: null };
    case 'auswahl':
      return { value: String(str).slice(0, 200), error: null };
    default:
      return { value: String(str).slice(0, 5000), error: null };
  }
}

export function entryTitle(bereich, eintrag) {
  const fields = bereich?.fields || [];
  const first = fields.find(x => x.type === 'text') || fields[0];
  const v = first ? eintrag?.values?.[first.id] : null;
  return v ? String(v) : 'Ohne Titel';
}

export function entrySubtitle(bereich, eintrag) {
  const fields = bereich?.fields || [];
  const firstText = fields.find(x => x.type === 'text');
  const second = fields.find(x => x !== firstText && (x.type === 'text' || x.type === 'auswahl') && eintrag?.values?.[x.id]);
  return second ? String(eintrag.values[second.id]) : '';
}

// Prüft eine Bereichs-Definition aus dem Feld-Editor.
export function validateBereich(b) {
  const errors = [];
  if (!b.name || !String(b.name).trim()) errors.push('Der Bereich braucht einen Namen.');
  if (!Array.isArray(b.fields) || b.fields.length === 0) errors.push('Mindestens ein Feld ist nötig.');
  (b.fields || []).forEach((fld, i) => {
    if (!fld.label || !String(fld.label).trim()) errors.push(`Feld ${i + 1} braucht eine Bezeichnung.`);
    if (!FIELD_TYPES.some(t => t.id === fld.type)) errors.push(`Feld ${i + 1} hat einen ungültigen Typ.`);
    if (fld.type === 'auswahl' && (!fld.options || fld.options.length === 0)) errors.push(`Feld „${fld.label || i + 1}“ braucht Auswahlmöglichkeiten.`);
  });
  return errors;
}

// Entfernt Rollen, die nicht zum Typ passen (z. B. nach Typwechsel).
export function sanitizeField(fld) {
  const out = {
    id: fld.id || newFieldId(),
    label: String(fld.label || '').trim().slice(0, 80),
    type: fld.type,
    role: '',
    required: !!fld.required
  };
  const roles = rolesFor(fld.type);
  if (roles && roles.some(r => r.id === fld.role)) out.role = fld.role;
  if (fld.type === 'auswahl') {
    out.options = (fld.options || []).map(o => String(o).trim()).filter(Boolean).slice(0, 50);
  }
  return out;
}
