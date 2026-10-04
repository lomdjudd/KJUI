// Clavier / souris / tactile. Les touches sont lues par position physique
// (event.code) : ZQSD sur AZERTY correspond à WASD sur QWERTY.
import { G } from './state.js';

const KEYMAP = {
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  ControlLeft: 'down',
  KeyC: 'down',
  KeyE: 'interact',
  KeyF: 'use2',
  KeyR: 'rotate',
  KeyI: 'inventory',
  Tab: 'inventory',
  KeyB: 'build',
  KeyT: 'tech',
  KeyG: 'genetics',
  KeyV: 'civ',
  KeyM: 'map',
  Escape: 'pause',
  KeyP: 'pause',
  KeyH: 'help',
};

const TOUCH_BUTTONS = [
  { action: 'attack', label: '⚔', cls: 'tb-attack' },
  { action: 'interact', label: 'E', cls: 'tb-interact' },
  { action: 'jump', label: '⤒', cls: 'tb-jump' },
  { action: 'down', label: '⤓', cls: 'tb-down' },
  { action: 'sprint', label: '»', cls: 'tb-sprint', toggle: true },
  { action: 'use2', label: 'F', cls: 'tb-use2' },
];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.down = new Set();
    this.pressed = new Set();
    this.look = { x: 0, y: 0 };
    this.wheel = 0;
    this.locked = false;
    this.stick = { x: 0, y: 0 };
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.digit = -1;
    this._bind();
    if (this.isTouch) this._buildTouch();
  }

  _press(a) {
    if (!this.down.has(a)) this.pressed.add(a);
    this.down.add(a);
  }
  _release(a) {
    this.down.delete(a);
  }

  _typing(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (this._typing(e)) {
        if (e.code === 'Escape') this._press('pause');
        return;
      }
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      const a = KEYMAP[e.code];
      if (a) this._press(a);
      if (/^Digit[1-9]$/.test(e.code)) this.digit = +e.code.slice(5) - 1;
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const a = KEYMAP[e.code];
      if (a) this._release(a);
    });
    addEventListener('blur', () => {
      this.keys.clear();
      this.down.clear();
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isTouch) return;
      if (!this.locked && !G.panel && G.started && !G.paused) {
        this.canvas.requestPointerLock?.();
      }
      if (e.button === 0) this._press('attack');
      if (e.button === 2) this._press('use2');
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this._release('attack');
      if (e.button === 2) this._release('use2');
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.look.x += e.movementX;
        this.look.y += e.movementY;
      }
    });
    addEventListener(
      'wheel',
      (e) => {
        if (G.panel) return;
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: true },
    );
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
  }

  _buildTouch() {
    const root = document.getElementById('touch-ui');
    root.classList.add('on');
    root.innerHTML = `<div class="stick-zone"><div class="stick-base"><div class="stick-knob"></div></div></div>
      <div class="look-zone"></div><div class="tbtns"></div>`;
    const zone = root.querySelector('.stick-zone');
    const base = root.querySelector('.stick-base');
    const knob = root.querySelector('.stick-knob');
    let sid = null;
    let cx = 0;
    let cy = 0;
    const R = 50;
    zone.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        sid = t.identifier;
        cx = t.clientX;
        cy = t.clientY;
        base.style.left = cx - 60 + 'px';
        base.style.top = cy - 60 + 'px';
        base.classList.add('on');
      },
      { passive: false },
    );
    zone.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== sid) continue;
          let dx = t.clientX - cx;
          let dy = t.clientY - cy;
          const l = Math.hypot(dx, dy);
          if (l > R) {
            dx *= R / l;
            dy *= R / l;
          }
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          this.stick.x = dx / R;
          this.stick.y = -dy / R;
        }
      },
      { passive: false },
    );
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        sid = null;
        this.stick.x = this.stick.y = 0;
        knob.style.transform = '';
        base.classList.remove('on');
      }
    };
    zone.addEventListener('touchend', endStick);
    zone.addEventListener('touchcancel', endStick);

    const look = root.querySelector('.look-zone');
    let lid = null;
    let lx = 0;
    let ly = 0;
    look.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        lid = t.identifier;
        lx = t.clientX;
        ly = t.clientY;
      },
      { passive: false },
    );
    look.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== lid) continue;
          this.look.x += (t.clientX - lx) * 2.2;
          this.look.y += (t.clientY - ly) * 2.2;
          lx = t.clientX;
          ly = t.clientY;
        }
      },
      { passive: false },
    );
    look.addEventListener('touchend', () => (lid = null));

    const wrap = root.querySelector('.tbtns');
    for (const b of TOUCH_BUTTONS) {
      const el = document.createElement('div');
      el.className = 'tbtn ' + b.cls;
      el.textContent = b.label;
      wrap.appendChild(el);
      el.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          if (b.toggle) {
            if (this.down.has(b.action)) {
              this._release(b.action);
              el.classList.remove('act');
            } else {
              this._press(b.action);
              el.classList.add('act');
            }
          } else {
            this._press(b.action);
            el.classList.add('act');
          }
        },
        { passive: false },
      );
      if (!b.toggle) {
        const up = (e) => {
          e.preventDefault();
          this._release(b.action);
          el.classList.remove('act');
        };
        el.addEventListener('touchend', up, { passive: false });
        el.addEventListener('touchcancel', up, { passive: false });
      }
    }
  }

  // Vecteur de déplacement (x = droite, y = avant)
  move() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    x += this.stick.x;
    y += this.stick.y;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  isDown(a) {
    return this.down.has(a);
  }
  wasPressed(a) {
    return this.pressed.has(a);
  }
  consume(a) {
    const had = this.pressed.has(a);
    this.pressed.delete(a);
    return had;
  }

  endFrame() {
    this.pressed.clear();
    this.look.x = this.look.y = 0;
    this.wheel = 0;
    this.digit = -1;
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
}
