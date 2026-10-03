// UI-Helfer. Wichtig für die Sicherheit: Nutzertext wird IMMER als Text eingefügt, nie als HTML.
import { icon } from './icons.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  let deferredValue;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') deferredValue = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  appendChildren(el, children);
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}

function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// collapse: auf schmalen Handys nur das Symbol zeigen (Text bleibt für Screenreader erhalten)
export function btn(label, { variant = 'secondary', iconName, onClick, type = 'button', small, ariaLabel, disabled, collapse } = {}) {
  return h('button', {
    type, class: `btn btn-${variant}${small ? ' btn-sm' : ''}${label ? '' : ' btn-icon'}${collapse && iconName ? ' btn-collapse' : ''}`,
    onclick: onClick, 'aria-label': ariaLabel || (collapse ? label : null), title: collapse ? label : null, disabled: !!disabled
  }, iconName ? icon(iconName, small ? 16 : 18) : null, label ? h('span', {}, label) : null);
}

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 });
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

export const fmtEUR = n => eur.format(Number.isFinite(n) ? n : 0);
export const fmtNum = n => (Number.isFinite(n) ? num.format(n) : '');
export const fmtSigned = n => (n > 0 ? '+ ' : n < 0 ? '− ' : '') + eur.format(Math.abs(Number.isFinite(n) ? n : 0));
export const fmtPct = n => (Number.isFinite(n) ? `${Math.round(n * 100)} %` : '–');

export function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '–';
  const [y, m, d] = iso.split('-').map(Number);
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

// Zahl -> Text fürs Eingabefeld ("1234,5")
export function amountToInput(n) {
  if (!Number.isFinite(n)) return '';
  return String(n).replace('.', ',');
}

let toastHost;
export function toast(message, tone = 'neutral') {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const t = h('div', { class: `toast toast-${tone}` }, message);
  while (toastHost.children.length >= 2) toastHost.firstElementChild.remove();
  toastHost.append(t);
  setTimeout(() => t.classList.add('toast-out'), 3200);
  setTimeout(() => t.remove(), 3600);
}

export function openModal({ title, body, footer, onClose, wide }) {
  const closeBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Schließen' }, icon('x'));
  const dlg = h('dialog', { class: `modal${wide ? ' modal-wide' : ''}`, 'aria-label': title },
    h('div', { class: 'modal-inner' },
      h('div', { class: 'modal-head' }, h('h2', {}, title), closeBtn),
      h('div', { class: 'modal-body' }, body),
      footer ? h('div', { class: 'modal-foot' }, footer) : null
    )
  );
  const close = () => { if (dlg.open) dlg.close(); };
  closeBtn.addEventListener('click', close);
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  dlg.addEventListener('mousedown', e => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  return { close, el: dlg };
}

export function confirmDialog(text, { okText = 'Bestätigen', danger = false, title = 'Sicher?' } = {}) {
  return new Promise(resolve => {
    let result = false;
    const m = openModal({
      title,
      body: h('p', { class: 'muted' }, text),
      footer: [
        btn('Abbrechen', { variant: 'ghost', onClick: () => m.close() }),
        btn(okText, { variant: danger ? 'danger' : 'primary', onClick: () => { result = true; m.close(); } })
      ],
      onClose: () => resolve(result)
    });
  });
}

export function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, class: 'sr-only' });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

export function emptyState(iconName, text, action) {
  return h('div', { class: 'empty' }, icon(iconName, 28), h('p', {}, text), action || null);
}

export function badge(text, tone = 'neutral') {
  return h('span', { class: `badge badge-${tone}` }, text);
}

export function formRow(label, control, { hint, error, id } = {}) {
  return h('div', { class: 'field' },
    h('label', { for: id || null }, label),
    control,
    hint ? h('p', { class: 'hint' }, hint) : null,
    h('p', { class: 'error', 'data-error-for': id || '' }, error || '')
  );
}

let uid = 0;
export const nextId = (prefix = 'i') => `${prefix}${++uid}`;

export function setBusy(button, busy, label) {
  button.disabled = busy;
  button.classList.toggle('is-busy', busy);
  if (label) {
    const span = button.querySelector('span');
    if (span) span.textContent = label;
  }
}
