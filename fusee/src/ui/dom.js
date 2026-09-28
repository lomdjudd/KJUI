// Petits utilitaires DOM : création d'éléments, messages, fenêtres modales.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function icon(path, extra = '') {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}><path d="${path}"/></svg>`;
}

// Icônes (tracés SVG 24x24)
export const ICONS = {
  back: 'M15 5 L8 12 L15 19',
  undo: 'M9 7 L4 12 L9 17 M4 12 H15 A5 5 0 0 1 15 22',
  redo: 'M15 7 L20 12 L15 17 M20 12 H9 A5 5 0 0 0 9 22',
  trash: 'M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 H17 L18 7 M10 11 V17 M14 11 V17',
  flip: 'M12 3 V21 M8 7 L4 12 L8 17 M16 7 L20 12 L16 17',
  save: 'M5 4 H16 L20 8 V20 H4 V4 Z M8 4 V9 H15 V4 M8 20 V14 H16 V20',
  folder: 'M3 6 H10 L12 8 H21 V19 H3 Z',
  plus: 'M12 5 V19 M5 12 H19',
  rocket: 'M12 2 C15 5 16 9 15 14 L9 14 C8 9 9 5 12 2 Z M9 14 L6 18 L9 17 M15 14 L18 18 L15 17 M11 17 H13 V21 H11 Z',
  map: 'M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z M9 4 V18 M15 6 V20',
  cube: 'M12 2 L21 7 V17 L12 22 L3 17 V7 Z M3 7 L12 12 L21 7 M12 12 V22',
  square: 'M4 4 H20 V20 H4 Z M4 12 H20 M12 4 V20',
  pause: 'M8 5 V19 M16 5 V19',
  gear: 'M12 8 A4 4 0 1 1 11.9 8 Z M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9',
  camera: 'M3 8 H7 L9 5 H15 L17 8 H21 V19 H3 Z M12 10 A3.5 3.5 0 1 1 11.9 10 Z',
  flask: 'M9 3 H15 M10 3 V9 L4 20 H20 L14 9 V3',
  tree: 'M12 3 V8 M5 13 V9 H19 V13 M5 13 A2 2 0 1 0 5.1 13 M19 13 A2 2 0 1 0 19.1 13 M12 8 A2 2 0 1 0 12.1 8',
  radar: 'M12 12 L19 5 M12 3 A9 9 0 1 0 21 12 M12 7 A5 5 0 1 0 17 12',
  list: 'M8 6 H20 M8 12 H20 M8 18 H20 M4 6 H4.1 M4 12 H4.1 M4 18 H4.1',
  trophy: 'M8 4 H16 V9 A4 4 0 0 1 8 9 Z M8 6 H4 V8 A3 3 0 0 0 8 10 M16 6 H20 V8 A3 3 0 0 1 16 10 M12 13 V17 M8 20 H16 M9 17 H15 V20 H9 Z',
  info: 'M12 3 A9 9 0 1 1 11.9 3 Z M12 11 V17 M12 7.5 V8',
  sym: 'M12 3 V21 M5 8 A3 3 0 1 0 5.1 8 M19 8 A3 3 0 1 0 19.1 8 M5 16 A3 3 0 1 0 5.1 16 M19 16 A3 3 0 1 0 19.1 16',
  paint: 'M4 20 C4 16 7 15 9 15 L18 6 A2 2 0 0 0 15 3 L6 12 C6 14 5 16 4 20 Z',
  eye: 'M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z M12 9 A3 3 0 1 1 11.9 9 Z',
  target: 'M12 3 A9 9 0 1 1 11.9 3 Z M12 8 A4 4 0 1 1 11.9 8 Z M12 12 H12.1',
  sound: 'M4 9 H8 L13 5 V19 L8 15 H4 Z M16 9 C18 11 18 13 16 15 M19 6 C22 10 22 14 19 18',
  mute: 'M4 9 H8 L13 5 V19 L8 15 H4 Z M17 9 L22 14 M22 9 L17 14',
  home: 'M3 11 L12 4 L21 11 V20 H14 V14 H10 V20 H3 Z',
  play: 'M7 4 L20 12 L7 20 Z',
  wrench: 'M14 6 A4 4 0 0 0 19 11 L21 9 A6 6 0 0 1 13 17 L6 22 L2 18 L7 11 A6 6 0 0 1 15 3 Z',
  expand: 'M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15',
  node: 'M12 4 A8 8 0 1 1 11.9 4 Z M12 1 V7 M12 17 V23 M1 12 H7 M17 12 H23',
  planet: 'M12 6 A6 6 0 1 1 11.9 6 Z M3 16 C8 18 17 12 21 7',
};

let toastRoot = null;
export function toast(title, text = '', kind = '', ms = 4200) {
  if (!toastRoot) {
    toastRoot = h('div', { id: 'toasts' });
    document.getElementById('ui').appendChild(toastRoot);
  }
  const t = h('div', { class: 'toast ' + kind }, h('b', {}, title), text ? h('div', {}, text) : null);
  toastRoot.appendChild(t);
  while (toastRoot.children.length > 5) toastRoot.firstChild.remove();
  setTimeout(() => {
    t.style.transition = 'opacity .4s, transform .4s';
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    setTimeout(() => t.remove(), 450);
  }, ms);
}

// Fenêtre modale. content : élément DOM ; actions : [{label, kind, onClick, keep}]
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog' });
  if (title) box.appendChild(h('h2', {}, title));
  if (typeof body === 'string') box.appendChild(h('div', { html: body }));
  else if (body) box.appendChild(body);
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    if (onClose) onClose();
  };
  if (actions.length) {
    const row = h('div', { class: 'actions' });
    for (const a of actions) {
      row.appendChild(h('button', { class: 'btn ' + (a.kind || ''), onclick: () => { if (!a.keep) close(); if (a.onClick) a.onClick(); } }, a.label));
    }
    box.appendChild(row);
  }
  back.appendChild(box);
  back.addEventListener('pointerdown', (e) => { if (e.target === back && !actions.some((a) => a.required)) close(); });
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
  };
  document.addEventListener('keydown', onKey, true);
  document.getElementById('ui').appendChild(back);
  return { close, el: box };
}

export function setLoading(p, msg) {
  const f = document.getElementById('load-fill');
  const m = document.getElementById('load-msg');
  if (f) f.style.width = Math.round(p * 100) + '%';
  if (m && msg) m.textContent = msg;
}
