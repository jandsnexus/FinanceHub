// Erzeugt eine .ics-Datei (Kalendertermin) – kostenlose Erinnerung ohne Server.
import { addDays } from './math.js';

function esc(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Zeilen länger als 75 Byte müssen umgebrochen werden (RFC 5545).
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + len > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += len;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compact = iso => iso.replace(/-/g, '');

export function buildICS({ titel, datum, notiz = '', uid }, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FinanceHub//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid || (Date.now() + '@financehub')}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(datum)}`,
    `DTEND;VALUE=DATE:${compact(addDays(datum, 1))}`,
    `SUMMARY:${esc(titel)}`,
    notiz ? `DESCRIPTION:${esc(notiz)}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(titel)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(titel)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);
  return lines.map(fold).join('\r\n') + '\r\n';
}
