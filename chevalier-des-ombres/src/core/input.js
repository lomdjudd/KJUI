// Entrées unifiées : clavier (positions physiques, ZQSD = WASD), souris, manette et tactile.
import { settings } from './settings.js';
import { clamp } from './utils.js';

const KEYMAP = {
  Space: ['jump'],
  ShiftLeft: ['sprint'],
  ShiftRight: ['sprint'],
  KeyJ: ['attack'],
  KeyK: ['heavy'],
  KeyC: ['dodge'],
  AltLeft: ['dodge'],
  KeyQ: ['block'],
  KeyE: ['interact'],
  KeyF: ['interact'],
  Enter: ['interact'],
  KeyR: ['heal'],
  KeyX: ['mana'],
  KeyT: ['lock'],
  MouseMiddle: ['lock'],
  KeyV: ['camera'],
  Digit1: ['power0'],
  Digit2: ['power1'],
  Digit3: ['power2'],
  Digit4: ['power3'],
  Escape: ['pause'],
  KeyP: ['pause'],
  Tab: ['map'],
  KeyM: ['map'],
  KeyI: ['inventory'],
  KeyL: ['journal'],
};

// Manettes connectées ; l'API peut être refusée (page intégrée dans un cadre) : liste vide
export function listGamepads() {
  try {
    return navigator.getGamepads ? [...navigator.getGamepads()] : [];
  } catch {
    return [];
  }
}

// Mapping standard des manettes (Xbox)
const PADMAP = {
  0: 'jump', // A (interagit aussi à proximité d'un PNJ/objet)
  1: 'dodge', // B
  2: 'attack', // X
  3: 'heavy', // Y
  4: 'block', // LB
  5: 'power', // RB (pouvoir sélectionné)
  6: 'blockAlt', // LT
  7: 'heavy', // RT
  8: 'map', // Back
  9: 'pause', // Start
  10: 'sprint', // L3
  11: 'lock', // R3
  12: 'heal', // haut
  13: 'mana', // bas
  14: 'powerPrev', // gauche
  15: 'powerNext', // droite
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.keys = new Set();
    this.look = { x: 0, y: 0 };
    this.move = { x: 0, y: 0 };
    this.lastDevice = 'keyboard';
    this.pointerLocked = false;
    this.enabled = true;
    this.touchMove = { x: 0, y: 0 };
    this.padMove = { x: 0, y: 0 };
    this.padLook = { x: 0, y: 0 };
    this.padPrev = {};
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this._sources = new Map();
    this.onAnyPress = null;
    this._bind();
  }

  _press(action) {
    const n = this._sources.get(action) || 0;
    this._sources.set(action, n + 1);
    if (n === 0) {
      this.down.add(action);
      this.pressed.add(action);
      if (this.onAnyPress) this.onAnyPress(action);
    }
  }

  _release(action) {
    const n = this._sources.get(action) || 0;
    if (n <= 1) {
      this._sources.delete(action);
      if (this.down.has(action)) {
        this.down.delete(action);
        this.released.add(action);
      }
    } else this._sources.set(action, n - 1);
  }

  // Appui ponctuel déclenché par l'interface (boutons tactiles, pont Android…)
  tap(action) {
    this._press(action);
    setTimeout(() => this._release(action), 60);
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'AltLeft') e.preventDefault();
      this.lastDevice = 'keyboard';
      if (e.repeat || this.keys.has(e.code)) return;
      this.keys.add(e.code);
      const acts = KEYMAP[e.code];
      if (acts) acts.forEach((a) => this._press(a));
    });
    window.addEventListener('keyup', (e) => {
      if (!this.keys.has(e.code)) return;
      this.keys.delete(e.code);
      const acts = KEYMAP[e.code];
      if (acts) acts.forEach((a) => this._release(a));
    });
    window.addEventListener('blur', () => this.reset());

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isTouch && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      this.lastDevice = 'keyboard';
      if (this.enabled && !this.pointerLocked && this.canvas.requestPointerLock) {
        try {
          const p = this.canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch {
          /* pointer lock refusé : glisser-souris */
        }
      }
      if (e.button === 0) this._press('attack');
      if (e.button === 2) this._press('block');
      if (e.button === 1) this._press('lock');
      this._mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._release('attack');
      if (e.button === 2) this._release('block');
      if (e.button === 1) this._release('lock');
      this._mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked || (this._mouseDown && !this.isTouch)) {
        this.look.x += e.movementX * 0.0022 * settings.get('sensX');
        this.look.y += e.movementY * 0.0022 * settings.get('sensY') * (settings.get('invertY') ? -1 : 1);
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        this.tap(e.deltaY > 0 ? 'powerNext' : 'powerPrev');
      },
      { passive: true },
    );
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  reset() {
    for (const a of this.down) this.released.add(a);
    this.down.clear();
    this.keys.clear();
    this._sources.clear();
    this.touchMove.x = this.touchMove.y = 0;
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  addLook(dx, dy) {
    this.look.x += dx * settings.get('sensX');
    this.look.y += dy * settings.get('sensY') * (settings.get('invertY') ? -1 : 1);
  }

  _pollPad() {
    const pads = listGamepads();
    let pad = null;
    for (const p of pads) if (p && p.connected) {
      pad = p;
      break;
    }
    if (!pad) {
      this.padMove.x = this.padMove.y = 0;
      this.padLook.x = this.padLook.y = 0;
      return;
    }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    this.padMove.x = dz(pad.axes[0] || 0);
    this.padMove.y = dz(pad.axes[1] || 0);
    this.padLook.x = dz(pad.axes[2] || 0);
    this.padLook.y = dz(pad.axes[3] || 0);
    if (this.padMove.x || this.padMove.y || this.padLook.x || this.padLook.y) this.lastDevice = 'gamepad';
    pad.buttons.forEach((b, i) => {
      const was = this.padPrev[i];
      const is = b.pressed || b.value > 0.5;
      if (is !== was) {
        const act = PADMAP[i];
        if (act) {
          // A : saut, ou interaction quand un objet/PNJ est à portée (le joueur choisit)
          const acts = act === 'blockAlt' ? ['block'] : act === 'jump' ? ['jump', 'interact'] : [act];
          for (const a of acts) {
            if (is) this._press(a);
            else this._release(a);
          }
        }
        this.padPrev[i] = is;
        if (is) this.lastDevice = 'gamepad';
      }
    });
  }

  // Appelé une fois par frame avant la logique
  update(dt) {
    this._pollPad();
    let mx = 0;
    let my = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    mx += this.padMove.x + this.touchMove.x;
    my += this.padMove.y + this.touchMove.y;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    this.move.x = mx;
    this.move.y = my;
    if (this.padLook.x || this.padLook.y) {
      const s = 2.8 * dt;
      this.look.x += this.padLook.x * Math.abs(this.padLook.x) * s * settings.get('sensX');
      this.look.y += this.padLook.y * Math.abs(this.padLook.y) * s * 0.8 * settings.get('sensY') * (settings.get('invertY') ? -1 : 1);
    }
  }

  consumeLook() {
    const l = { x: clamp(this.look.x, -1, 1), y: clamp(this.look.y, -1, 1) };
    this.look.x = 0;
    this.look.y = 0;
    return l;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }

  wasPressed(a) {
    return this.pressed.has(a);
  }
  isDown(a) {
    return this.down.has(a);
  }
}
