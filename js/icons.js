// Eigene Outline-Icons (24er Raster). Werden per createElementNS gebaut, kein innerHTML.
const P = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9.5 21v-6h5v6'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5'],
  bank: ['M3 9.5 12 4l9 5.5', 'M4 10h16', 'M6 10v8', 'M10 10v8', 'M14 10v8', 'M18 10v8', 'M3 21h18'],
  shield: ['M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z'],
  file: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'],
  briefcase: ['M4 8h16v11H4z', 'M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8', 'M4 13h16'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  wallet: ['M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11', 'M16 13.5h.01'],
  car: ['M5 16V11l2-5h10l2 5v5', 'M3 16h18v3H3z', 'M5 11h14', 'M7.5 19v1.5', 'M16.5 19v1.5'],
  heart: ['M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z'],
  phone: ['M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M11 18h2'],
  zap: ['M13 3 5 13.5h6L10 21l8-10.5h-6z'],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  layers: ['M12 3 3 8l9 5 9-5z', 'M3 13l9 5 9-5'],
  calendar: ['M4 6h16v15H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.5V12l3 2'],
  swap: ['M7 4 4 7l3 3', 'M4 7h13', 'M17 20l3-3-3-3', 'M20 17H7'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.6-1.5L14 2.6h-4l-.5 2.4a7.5 7.5 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2.6 1.5l.5 2.4h4l.5-2.4a7.5 7.5 0 0 0 2.6-1.5l2.3.9 2-3.4z'],
  plus: ['M12 5v14', 'M5 12h14'],
  x: ['M6 6l12 12', 'M18 6 6 18'],
  check: ['M5 12.5 10 17l9-10'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  eyeOff: ['M3 3l18 18', 'M10.6 6a9.7 9.7 0 0 1 1.4-.1c6 0 9.5 6.1 9.5 6.1a16.5 16.5 0 0 1-2.6 3.3', 'M6.6 7.1A16 16 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 4.4-1.1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  chevronRight: ['M9 5l7 7-7 7'],
  chevronLeft: ['M15 5l-7 7 7 7'],
  chevronUp: ['M5 15l7-7 7 7'],
  chevronDown: ['M5 9l7 7 7-7'],
  lock: ['M6 11h12v10H6z', 'M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11'],
  logout: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
  download: ['M12 4v11', 'M7.5 10.5 12 15l4.5-4.5', 'M5 20h14'],
  arrowUp: ['M12 19V5', 'M6 11l6-6 6 6'],
  arrowDown: ['M12 5v14', 'M6 13l6 6 6-6'],
  alert: ['M12 3 2 20h20z', 'M12 10v4.5', 'M12 17.5h.01'],
  chart: ['M4 20V4', 'M4 20h16', 'M8 16v-4', 'M12 16V8', 'M16 16v-6'],
  sun: ['M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M12 2.5v2', 'M12 19.5v2', 'M4.6 4.6l1.4 1.4', 'M18 18l1.4 1.4', 'M2.5 12h2', 'M19.5 12h2', 'M4.6 19.4 6 18', 'M18 6l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
  monitor: ['M3 5h18v12H3z', 'M8 21h8', 'M12 17v4'],
  image: ['M4 5h16v14H4z', 'M4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 18', 'M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
  note: ['M5 4h14v11l-5 5H5z', 'M14 20v-5h5', 'M8.5 9h7', 'M8.5 12.5h4']
};

const NS = 'http://www.w3.org/2000/svg';

export function icon(name, size = 20) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  for (const d of P[name] || P.folder) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

export const ICON_NAMES = Object.keys(P);
