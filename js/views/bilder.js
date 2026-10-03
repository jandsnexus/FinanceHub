// Bilder in Formularen (hinzufügen/entfernen) und in der Detailansicht (Galerie + Vollbild).
import { h, openModal, toast } from '../ui.js';
import { icon } from '../icons.js';
import { compressImage, saveImage, imageURL, deleteImage, MAX_BILDER } from '../files.js';

function thumbImg(id) {
  const img = h('img', { alt: 'Bild', class: 'thumb-img', loading: 'lazy' });
  const tile = h('span', { class: 'thumb-media is-loading' }, img);
  imageURL(id)
    .then(url => { img.src = url; tile.classList.remove('is-loading'); })
    .catch(() => { tile.classList.remove('is-loading'); tile.classList.add('is-missing'); tile.replaceChildren(icon('image', 20)); });
  return tile;
}

export function openLightbox(ids, start = 0) {
  let i = start;
  const img = h('img', { class: 'lightbox-img', alt: 'Bild' });
  const counter = h('span', { class: 'muted' });
  const prev = h('button', { type: 'button', class: 'btn btn-secondary btn-icon', 'aria-label': 'Vorheriges Bild' }, icon('chevronLeft'));
  const next = h('button', { type: 'button', class: 'btn btn-secondary btn-icon', 'aria-label': 'Nächstes Bild' }, icon('chevronRight'));
  const show = () => {
    img.removeAttribute('src');
    imageURL(ids[i]).then(url => { img.src = url; }).catch(() => toast('Bild konnte nicht geladen werden.', 'danger'));
    counter.textContent = `${i + 1} von ${ids.length}`;
    prev.disabled = i === 0;
    next.disabled = i === ids.length - 1;
  };
  prev.addEventListener('click', () => { if (i > 0) { i--; show(); } });
  next.addEventListener('click', () => { if (i < ids.length - 1) { i++; show(); } });
  openModal({
    title: 'Bild',
    wide: true,
    body: h('div', { class: 'lightbox' }, h('div', { class: 'lightbox-frame' }, img)),
    footer: ids.length > 1 ? [prev, counter, next] : null
  });
  show();
}

// Nur anzeigen (Detailansicht)
export function gallery(ids) {
  if (!ids || !ids.length) return null;
  return h('div', { class: 'thumbs' }, ids.map((id, idx) =>
    h('button', { type: 'button', class: 'thumb', 'aria-label': `Bild ${idx + 1} öffnen`, onclick: () => openLightbox(ids, idx) }, thumbImg(id))));
}

// Im Formular: Bilder hinzufügen und entfernen. Gespeichert wird erst beim Absenden (commit).
export function imageField(existing = []) {
  const items = existing.map(id => ({ id }));
  const removed = [];
  const jobs = new Set();
  const grid = h('div', { class: 'thumbs' });
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  const addBtn = h('button', { type: 'button', class: 'thumb thumb-add' }, icon('plus', 20), h('span', {}, 'Bild'));
  addBtn.addEventListener('click', () => input.click());

  function draw() {
    grid.replaceChildren(
      ...items.map((it, idx) => {
        const media = it.id ? thumbImg(it.id)
          : it.url ? h('span', { class: 'thumb-media' }, h('img', { src: it.url, alt: 'Neues Bild', class: 'thumb-img' }))
            : h('span', { class: 'thumb-media is-loading' });
        const remove = h('button', { type: 'button', class: 'thumb-remove', 'aria-label': `Bild ${idx + 1} entfernen` }, icon('x', 14));
        remove.addEventListener('click', () => {
          const [gone] = items.splice(idx, 1);
          if (gone.id) removed.push(gone.id);
          if (gone.url) URL.revokeObjectURL(gone.url);
          draw();
        });
        return h('div', { class: 'thumb' }, media, it.blob || it.id ? remove : null);
      }),
      items.length < MAX_BILDER ? addBtn : null
    );
  }

  input.addEventListener('change', () => {
    const files = [...input.files].slice(0, MAX_BILDER - items.length);
    if (input.files.length > files.length) toast(`Höchstens ${MAX_BILDER} Bilder pro Eintrag.`);
    input.value = '';
    for (const file of files) {
      const it = { blob: null, url: null };
      items.push(it);
      const job = compressImage(file)
        .then(blob => { it.blob = blob; it.url = URL.createObjectURL(blob); })
        .catch(err => { toast(err.message || 'Bild konnte nicht gelesen werden.', 'danger'); items.splice(items.indexOf(it), 1); })
        .finally(() => { jobs.delete(job); draw(); });
      jobs.add(job);
    }
    draw();
  });

  draw();
  return {
    el: h('div', { class: 'field' }, h('span', { class: 'label' }, 'Bilder'), grid, input,
      h('p', { class: 'hint' }, 'Fotos werden automatisch verkleinert und verschlüsselt gespeichert.')),
    busy: () => jobs.size > 0,
    // Speichert neue Bilder, löscht entfernte, gibt die endgültige Liste zurück.
    async commit() {
      await Promise.all([...jobs]);
      const ids = [];
      for (const it of items) {
        if (it.id) ids.push(it.id);
        else if (it.blob) {
          ids.push(saveImage(it.blob));
          URL.revokeObjectURL(it.url);
        }
      }
      removed.forEach(deleteImage);
      return ids;
    },
    discard() {
      for (const it of items) if (it.url) URL.revokeObjectURL(it.url);
    }
  };
}
