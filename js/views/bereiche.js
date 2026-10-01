import { h, btn, fmtEUR, fmtDate, fmtNum, amountToInput, openModal, confirmDialog, toast, emptyState, nextId } from '../ui.js';
import { icon } from '../icons.js';
import {
  FIELD_TYPES, INTERVALS, BEREICH_ICONS, rolesFor, intervalLabel, coerceValue, entryTitle, entrySubtitle,
  validateBereich, sanitizeField, newFieldId
} from '../schema.js';
import { entryFacts, toMonthly, nextOccurrence, todayISO, round2 } from '../math.js';

// ---------- Anzeige-Helfer ----------
function displayValue(field, v) {
  if (v === null || v === undefined || v === '') return '–';
  switch (field.type) {
    case 'betrag': return typeof v === 'number' ? fmtEUR(v) : String(v);
    case 'zahl': return typeof v === 'number' ? fmtNum(v) : String(v);
    case 'datum': return fmtDate(v);
    case 'intervall': return intervalLabel(v);
    default: return String(v);
  }
}

function maskSecret(v) {
  const s = String(v);
  return '•••••• ' + s.slice(-4);
}

function secretValue(v) {
  const text = h('span', { class: 'secret' }, maskSecret(v));
  let shown = false;
  const toggle = h('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'Anzeigen' }, icon('eye', 16));
  toggle.addEventListener('click', () => {
    shown = !shown;
    text.textContent = shown ? String(v) : maskSecret(v);
    toggle.replaceChildren(icon(shown ? 'eyeOff' : 'eye', 16));
    toggle.setAttribute('aria-label', shown ? 'Verbergen' : 'Anzeigen');
  });
  const copy = h('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'Kopieren' }, icon('file', 16));
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(String(v)); toast('Kopiert', 'success'); } catch { toast('Kopieren nicht möglich', 'danger'); }
  });
  return h('span', { class: 'secret-wrap' }, text, toggle, copy);
}

function amountLine(bereich, eintrag) {
  const f = entryFacts(bereich, eintrag);
  if (f.kosten) {
    const monthly = toMonthly(f.kosten, f.intervall);
    return h('span', { class: 'row-right' },
      h('span', { class: 'row-amount' }, fmtEUR(f.kosten)),
      h('span', { class: 'row-sub' }, f.intervall === 'monatlich' ? 'monatlich' : `${intervalLabel(f.intervall)} · ≈ ${fmtEUR(monthly)}/Monat`));
  }
  if (f.einnahme) {
    return h('span', { class: 'row-right' },
      h('span', { class: 'row-amount tone-success' }, '+ ' + fmtEUR(f.einnahme)),
      h('span', { class: 'row-sub' }, intervalLabel(f.intervall)));
  }
  if (f.saldo !== null) return h('span', { class: 'row-right' }, h('span', { class: 'row-amount' }, fmtEUR(f.saldo)));
  return icon('chevronRight', 16);
}

// ---------- Bereichs-Übersicht (mobil: Tab "Bereiche") ----------
export function renderBereichList(c) {
  const list = c.snap.bereiche;
  return h('div', { class: 'stack-lg' },
    h('section', { class: 'hero' },
      h('div', {}, h('h1', {}, 'Bereiche'), h('p', { class: 'muted' }, 'Alles, was du verwaltest. Du kannst jeden Bereich anpassen oder neue anlegen.')),
      btn('Bereich', { variant: 'primary', iconName: 'plus', onClick: () => openBereichEditor(null, c) })),
    list.length
      ? h('div', { class: 'card' }, h('div', { class: 'tiles' }, list.map(b => {
        const pb = c.summary.proBereich.get(b.id) || { count: 0 };
        return h('a', { class: 'tile', href: '#/bereich/' + encodeURIComponent(b.id) },
          h('span', { class: 'card-icon' }, icon(b.icon || 'folder', 20)),
          h('span', { class: 'tile-text' }, h('strong', {}, b.name), h('small', {}, `${pb.count} ${pb.count === 1 ? 'Eintrag' : 'Einträge'}`)),
          icon('chevronRight', 16));
      })))
      : h('div', { class: 'card' }, emptyState('folder', 'Noch keine Bereiche.', btn('Ersten Bereich erstellen', { variant: 'primary', onClick: () => openBereichEditor(null, c) })))
  );
}

// ---------- Bereich im Detail ----------
export function renderBereichDetail(c, id) {
  const b = c.store.get(id);
  if (!b || b.kind !== 'bereich') {
    return h('div', { class: 'card' }, emptyState('folder', 'Diesen Bereich gibt es nicht mehr.',
      btn('Zur Übersicht', { variant: 'primary', onClick: () => c.navigate('dashboard') })));
  }
  const entries = c.store.eintraegeVon(b.id);
  const pb = c.summary.proBereich.get(b.id) || { count: 0, monat: 0, einnahmenMonat: 0, saldo: 0 };
  const chips = [];
  if (pb.monat) chips.push(h('div', { class: 'chip' }, h('small', {}, 'Kosten pro Monat'), h('strong', {}, fmtEUR(pb.monat))),
    h('div', { class: 'chip' }, h('small', {}, 'Kosten pro Jahr'), h('strong', {}, fmtEUR(round2(pb.monat * 12)))));
  if (pb.einnahmenMonat) chips.push(h('div', { class: 'chip' }, h('small', {}, 'Einnahmen pro Monat'), h('strong', { class: 'tone-success' }, fmtEUR(pb.einnahmenMonat))));
  if (pb.saldo) chips.push(h('div', { class: 'chip' }, h('small', {}, 'Summe'), h('strong', {}, fmtEUR(pb.saldo))));

  return h('div', { class: 'stack-lg' },
    h('section', { class: 'hero' },
      h('div', { class: 'hero-title' },
        h('span', { class: 'card-icon card-icon-lg' }, icon(b.icon || 'folder', 24)),
        h('div', {}, h('h1', {}, b.name), h('p', { class: 'muted' }, `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}`))),
      h('div', { class: 'hero-actions' },
        btn('Felder', { variant: 'secondary', iconName: 'edit', onClick: () => openBereichEditor(b, c) }),
        btn('Eintrag', { variant: 'primary', iconName: 'plus', onClick: () => openEntryForm(b, null, c) }))),
    chips.length ? h('section', { class: 'chips' }, chips) : null,
    h('section', { class: 'card' },
      entries.length
        ? h('ul', { class: 'rows' }, entries.map(e => h('li', {},
          h('button', { type: 'button', class: 'row', onclick: () => openEntryDetail(b, e, c) },
            h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, entryTitle(b, e)),
              entrySubtitle(b, e) ? h('span', { class: 'row-sub' }, entrySubtitle(b, e)) : null),
            amountLine(b, e)))))
        : emptyState(b.icon || 'folder', `Noch nichts in „${b.name}“.`,
          btn('Ersten Eintrag hinzufügen', { variant: 'primary', iconName: 'plus', onClick: () => openEntryForm(b, null, c) })))
  );
}

// ---------- Eintrag ansehen ----------
export function openEntryDetail(b, e, c) {
  const facts = entryFacts(b, e);
  const rows = b.fields.map(f => {
    const v = e.values?.[f.id];
    const empty = v === null || v === undefined || v === '';
    return h('div', { class: 'kv' }, h('dt', {}, f.label),
      h('dd', {}, f.type === 'geheim' && !empty ? secretValue(v) : displayValue(f, v)));
  });
  const insights = [];
  if (facts.kosten) {
    const mon = toMonthly(facts.kosten, facts.intervall);
    insights.push(`Das sind ≈ ${fmtEUR(mon)} pro Monat bzw. ${fmtEUR(round2(mon * 12))} pro Jahr.`);
  }
  if (facts.faellig) {
    const next = nextOccurrence(facts.faellig, facts.intervall, todayISO());
    if (next) insights.push(`Nächste Zahlung am ${fmtDate(next)}.`);
  }
  const m = openModal({
    title: entryTitle(b, e),
    body: h('div', { class: 'stack' },
      insights.length ? h('div', { class: 'insight' }, icon('zap', 18), h('div', {}, insights.map(t => h('p', {}, t)))) : null,
      h('dl', { class: 'kv-list' }, rows)),
    footer: [
      btn('Löschen', { variant: 'ghost-danger', iconName: 'trash', onClick: async () => {
        if (await confirmDialog(`„${entryTitle(b, e)}“ wirklich löschen?`, { okText: 'Löschen', danger: true })) {
          c.store.remove(e.id); m.close(); toast('Gelöscht');
        }
      } }),
      btn('Bearbeiten', { variant: 'primary', iconName: 'edit', onClick: () => { m.close(); openEntryForm(b, e, c); } })
    ]
  });
}

// ---------- Eintrag hinzufügen / bearbeiten ----------
function controlFor(field, value, id) {
  const common = { id, name: field.id, class: 'input' };
  switch (field.type) {
    case 'mehrzeilig':
      return h('textarea', { ...common, rows: 3, maxlength: 5000, value: value ?? '' });
    case 'betrag':
    case 'zahl':
      return h('input', { ...common, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: field.type === 'betrag' ? '0,00' : '',
        value: typeof value === 'number' ? amountToInput(value) : (value ?? '') });
    case 'datum':
      return h('input', { ...common, type: 'date', value: value ?? '' });
    case 'intervall':
      return h('select', { ...common, value: value || 'monatlich' }, INTERVALS.map(i => h('option', { value: i.id }, i.label)));
    case 'auswahl': {
      const opts = [...(field.options || [])];
      if (value && !opts.includes(value)) opts.push(value);
      return h('select', { ...common, value: value ?? '' }, h('option', { value: '' }, 'Bitte wählen'), opts.map(o => h('option', { value: o }, o)));
    }
    case 'geheim':
      return h('input', { ...common, type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', maxlength: 200, value: value ?? '' });
    default:
      return h('input', { ...common, type: 'text', maxlength: 500, value: value ?? '' });
  }
}

export function openEntryForm(b, e, c) {
  const isNew = !e;
  const ids = {};
  const rows = b.fields.map(f => {
    const id = ids[f.id] = nextId('fld');
    const label = f.required ? `${f.label} *` : f.label;
    const hint = f.role === 'kosten' ? 'Zählt zu deinen Fixkosten.'
      : f.role === 'einnahme' ? 'Zählt zu deinen festen Einnahmen.'
        : f.role === 'saldo' ? 'Zählt zu deinem Gesamtvermögen.'
          : f.role === 'faellig' ? 'Ab hier rechnet die App die nächsten Zahlungen aus.'
            : f.role === 'frist' ? 'Erscheint bei deinen Fristen.' : null;
    return h('div', { class: 'field' },
      h('label', { for: id }, label),
      controlFor(f, e?.values?.[f.id], id),
      hint ? h('p', { class: 'hint' }, hint) : null,
      h('p', { class: 'error', 'data-for': f.id }));
  });
  const form = h('form', { class: 'stack', novalidate: true }, rows);
  const save = btn(isNew ? 'Hinzufügen' : 'Speichern', { variant: 'primary', type: 'submit' });
  save.setAttribute('form', form.id = nextId('form'));

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const values = {};
    let firstError = null;
    for (const f of b.fields) {
      const el = form.querySelector('#' + ids[f.id]);
      const { value, error } = coerceValue(f, el.value);
      const errEl = form.querySelector(`[data-for="${CSS.escape(f.id)}"]`);
      errEl.textContent = error || '';
      if (error && !firstError) firstError = el;
      if (value !== null) values[f.id] = value;
    }
    if (firstError) { firstError.focus(); return; }
    const data = { bereichId: b.id, values, createdAt: e?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    c.store.save('eintrag', data, e?.id);
    m.close();
    toast(isNew ? 'Hinzugefügt' : 'Gespeichert', 'success');
  });

  const m = openModal({
    title: isNew ? `${b.name}: neuer Eintrag` : 'Eintrag bearbeiten',
    body: form,
    footer: [btn('Abbrechen', { variant: 'ghost', onClick: () => m.close() }), save]
  });
  const first = form.querySelector('input, textarea, select');
  if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
}

// ---------- Bereich anlegen / Felder bearbeiten ----------
export function openBereichEditor(b, c) {
  const isNew = !b;
  const model = {
    name: b?.name || '',
    icon: b?.icon || 'folder',
    fields: (b?.fields || [{ id: newFieldId(), label: 'Bezeichnung', type: 'text', role: '', required: true }]).map(f => ({ ...f, options: f.options ? [...f.options] : undefined }))
  };
  const errBox = h('p', { class: 'form-error', role: 'alert' });
  const nameId = nextId('bn');
  const nameInput = h('input', { id: nameId, class: 'input', type: 'text', maxlength: 60, value: model.name, placeholder: 'z. B. Auto' });
  nameInput.addEventListener('input', () => { model.name = nameInput.value; });

  const iconPicker = h('div', { class: 'icon-picker', role: 'radiogroup', 'aria-label': 'Symbol' });
  function drawIcons() {
    iconPicker.replaceChildren(...BEREICH_ICONS.map(name =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(model.icon === name), 'aria-label': name,
        class: `icon-choice${model.icon === name ? ' active' : ''}`, onclick: () => { model.icon = name; drawIcons(); } }, icon(name, 20))));
  }
  drawIcons();

  const list = h('div', { class: 'field-list' });
  function drawFields() {
    list.replaceChildren(...model.fields.map((f, i) => {
      const lid = nextId('fl');
      const label = h('input', { id: lid, class: 'input', type: 'text', maxlength: 80, value: f.label, placeholder: 'Bezeichnung', 'aria-label': `Feld ${i + 1} Bezeichnung` });
      label.addEventListener('input', () => { f.label = label.value; });
      const type = h('select', { class: 'input', value: f.type, 'aria-label': `Feld ${i + 1} Typ` }, FIELD_TYPES.map(t => h('option', { value: t.id }, t.label)));
      type.addEventListener('change', () => { f.type = type.value; f.role = ''; if (f.type === 'auswahl' && !f.options) f.options = []; drawFields(); });
      const roles = rolesFor(f.type);
      let roleSel = null;
      if (roles) {
        roleSel = h('select', { class: 'input', value: f.role || '', 'aria-label': `Feld ${i + 1} Bedeutung` }, roles.map(r => h('option', { value: r.id }, r.label)));
        roleSel.addEventListener('change', () => { f.role = roleSel.value; });
      }
      let opts = null;
      if (f.type === 'auswahl') {
        opts = h('input', { class: 'input', type: 'text', value: (f.options || []).join(', '), placeholder: 'Möglichkeiten, mit Komma getrennt', 'aria-label': `Feld ${i + 1} Auswahlmöglichkeiten` });
        opts.addEventListener('input', () => { f.options = opts.value.split(',').map(s => s.trim()).filter(Boolean); });
      }
      const move = (dir) => {
        const j = i + dir;
        if (j < 0 || j >= model.fields.length) return;
        [model.fields[i], model.fields[j]] = [model.fields[j], model.fields[i]];
        drawFields();
      };
      return h('div', { class: 'field-edit' },
        h('div', { class: 'field-edit-main' }, label, type, roleSel, opts),
        h('div', { class: 'field-edit-actions' },
          btn('', { variant: 'ghost', iconName: 'chevronUp', small: true, ariaLabel: 'Nach oben', disabled: i === 0, onClick: () => move(-1) }),
          btn('', { variant: 'ghost', iconName: 'chevronDown', small: true, ariaLabel: 'Nach unten', disabled: i === model.fields.length - 1, onClick: () => move(1) }),
          btn('', { variant: 'ghost-danger', iconName: 'trash', small: true, ariaLabel: 'Feld entfernen', disabled: model.fields.length === 1,
            onClick: () => { model.fields.splice(i, 1); drawFields(); } })));
    }));
  }
  drawFields();

  const body = h('div', { class: 'stack' },
    h('div', { class: 'field' }, h('label', { for: nameId }, 'Name des Bereichs'), nameInput),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Symbol'), iconPicker),
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'Felder'),
      h('p', { class: 'hint' }, 'Bei „Betrag“ und „Datum“ legst du fest, was das Feld bedeutet. Daran erkennt die App, was sie ausrechnen soll.'),
      list,
      btn('Feld hinzufügen', { variant: 'secondary', iconName: 'plus', small: true, onClick: () => {
        model.fields.push({ id: newFieldId(), label: '', type: 'text', role: '' });
        drawFields();
        list.lastElementChild?.querySelector('input')?.focus();
      } })),
    errBox
  );

  const footer = [
    !isNew ? btn('Bereich löschen', { variant: 'ghost-danger', iconName: 'trash', onClick: async () => {
      const count = c.store.eintraegeVon(b.id).length;
      const text = count ? `„${b.name}“ und alle ${count} Einträge darin werden gelöscht.` : `„${b.name}“ wird gelöscht.`;
      if (await confirmDialog(text, { okText: 'Endgültig löschen', danger: true })) {
        c.store.eintraegeVon(b.id).forEach(e => c.store.remove(e.id));
        c.store.remove(b.id);
        m.close();
        toast('Bereich gelöscht');
        c.navigate('dashboard');
      }
    } }) : null,
    btn('Abbrechen', { variant: 'ghost', onClick: () => m.close() }),
    btn(isNew ? 'Erstellen' : 'Speichern', { variant: 'primary', onClick: () => {
      const fields = model.fields.map(sanitizeField);
      if (fields.length) fields[0].required = fields[0].required || isNew;
      const candidate = { name: String(model.name).trim().slice(0, 60), icon: BEREICH_ICONS.includes(model.icon) ? model.icon : 'folder', fields };
      const errors = validateBereich(candidate);
      if (errors.length) { errBox.textContent = errors[0]; return; }
      const order = isNew ? Math.max(-1, ...c.snap.bereiche.map(x => x.order ?? 0)) + 1 : (b.order ?? 0);
      const id = c.store.save('bereich', { ...candidate, order }, b?.id);
      m.close();
      toast(isNew ? 'Bereich erstellt' : 'Gespeichert', 'success');
      if (isNew) c.navigate('bereich/' + encodeURIComponent(id));
    } })
  ];

  const m = openModal({ title: isNew ? 'Neuer Bereich' : `${b.name} anpassen`, body, footer, wide: true });
  if (isNew) nameInput.focus();
}
