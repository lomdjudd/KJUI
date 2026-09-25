// Gestion unifiée clavier / souris / manette / tactile.
// Les touches sont lues par position physique (event.code) : ZQSD sur AZERTY = WASD sur QWERTY.

const KEYMAP = {
  Space: ['jump'],
  ShiftLeft: ['swing'],
  ShiftRight: ['swing'],
  KeyJ: ['attack'],
  KeyC: ['dodge'],
  KeyK: ['dodge'],
  KeyR: ['webShoot'],
  KeyF: ['webStrike', 'interact'],
  Enter: ['interact'],
  KeyE: ['zip'],
  KeyV: ['finisher'],
  KeyH: ['heal'],
  KeyG: ['gadget'],
  KeyT: ['gadgetNext'],
  Digit1: ['style1'],
  Digit2: ['style2'],
  Digit3: ['style3'],
  Digit4: ['style4'],
  Numpad1: ['style1'],
  Numpad2: ['style2'],
  Numpad3: ['style3'],
  Numpad4: ['style4'],
  Escape: ['pause'],
  KeyP: ['pause'],
  Tab: ['map'],
  KeyN: ['music'],
  KeyO: ['photo'],
};

// Manette (mapping standard)
const PADMAP = {
  0: 'jump',
  1: 'dodge',
  2: 'attack',
  3: ['webStrike', 'interact'],
  4: 'webShoot',
  5: 'gadget',
  6: 'zip',
  7: 'swing',
  8: 'map',
  9: 'pause',
  11: 'finisher',
  12: 'gadgetNext',
  13: 'heal',
  14: 'stylePrev',
  15: 'styleNext',
};

const TOUCH_BUTTONS = [
  { action: 'swing', label: 'TOILE', cls: 'tb-swing' },
  { action: 'jump', label: 'SAUT', cls: 'tb-jump' },
  { action: 'attack', label: 'FRAPPE', cls: 'tb-attack' },
  { action: 'dodge', label: 'ESQUIVE', cls: 'tb-dodge' },
  { action: 'webShoot', label: 'TIR', cls: 'tb-web' },
  { action: 'webStrike', label: 'ASSAUT', cls: 'tb-strike' },
  { action: 'zip', label: 'ZIP', cls: 'tb-zip' },
  { action: 'gadget', label: 'GADGET', cls: 'tb-gadget' },
  { action: 'gadgetNext', label: '⟳', cls: 'tb-gnext' },
  { action: 'finisher', label: 'K.O.', cls: 'tb-finisher' },
  { action: 'heal', label: 'SOIN', cls: 'tb-heal' },
  { action: 'styleNext', label: 'STYLE', cls: 'tb-style' },
  { action: 'interact', label: 'ACTION', cls: 'tb-interact' },
];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set(); // actions maintenues
    this.pressed = new Set(); // actions appuyées cette frame
    this.released = new Set();
    this.keys = new Set();
    this.look = { x: 0, y: 0 };
    this.lookInputTime = 0;
    this.wheel = 0;
    this.pointerLocked = false;
    this.enabled = true;
    this.touchMove = { x: 0, y: 0 };
    this.touchActive = false;
    this.padMove = { x: 0, y: 0 };
    this.padLook = { x: 0, y: 0 };
    this.padPrev = {};
    this.sensitivity = 1;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this._sources = new Map(); // action -> nombre de sources actives
    this._bind();
    if (this.isTouch) this._buildTouch();
  }

  _press(action) {
    const n = this._sources.get(action) || 0;
    this._sources.set(action, n + 1);
    if (n === 0) {
      this.down.add(action);
      this.pressed.add(action);
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

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      if (this.keys.has(e.code)) return;
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
      if (this.enabled && !this.pointerLocked && this.canvas.requestPointerLock) {
        try {
          const p = this.canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch {
          /* pointer lock refusé (iframe) : on garde le glisser-souris */
        }
      }
      if (e.button === 0) this._press('attack');
      if (e.button === 2) this._press('dodge');
      if (e.button === 1) this._press('webStrike');
      this._mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._release('attack');
      if (e.button === 2) this._release('dodge');
      if (e.button === 1) this._release('webStrike');
      this._mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked || (this._mouseDown && !this.isTouch)) {
        this.look.x += e.movementX * 0.0022 * this.sensitivity;
        this.look.y += e.movementY * 0.0022 * this.sensitivity;
        this.lookInputTime = performance.now();
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        this.wheel += Math.sign(e.deltaY);
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
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _buildTouch() {
    const root = document.getElementById('touch-ui');
    if (!root) return;
    root.style.display = 'block';
    // Joystick gauche
    const stick = root.querySelector('.stick');
    const knob = root.querySelector('.knob');
    const zone = root.querySelector('.stick-zone');
    let stickId = null;
    let cx = 0;
    let cy = 0;
    const R = 55;
    zone.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        stickId = t.identifier;
        cx = t.clientX;
        cy = t.clientY;
        stick.style.left = `${cx - 70}px`;
        stick.style.top = `${cy - 70}px`;
        stick.classList.add('active');
        this.touchActive = true;
      },
      { passive: false },
    );
    const moveStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        const l = Math.hypot(dx, dy);
        if (l > R) {
          dx = (dx / l) * R;
          dy = (dy / l) * R;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.touchMove.x = dx / R;
        this.touchMove.y = -dy / R;
      }
    };
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        stickId = null;
        knob.style.transform = '';
        stick.classList.remove('active');
        this.touchMove.x = 0;
        this.touchMove.y = 0;
      }
    };
    zone.addEventListener('touchmove', moveStick, { passive: false });
    zone.addEventListener('touchend', endStick);
    zone.addEventListener('touchcancel', endStick);

    // Zone de regard (moitié droite)
    const lookZone = root.querySelector('.look-zone');
    let lookId = null;
    let lx = 0;
    let ly = 0;
    lookZone.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        lookId = t.identifier;
        lx = t.clientX;
        ly = t.clientY;
      },
      { passive: false },
    );
    lookZone.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== lookId) continue;
          this.look.x += (t.clientX - lx) * 0.006 * this.sensitivity;
          this.look.y += (t.clientY - ly) * 0.006 * this.sensitivity;
          lx = t.clientX;
          ly = t.clientY;
          this.lookInputTime = performance.now();
        }
      },
      { passive: false },
    );
    const endLook = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    };
    lookZone.addEventListener('touchend', endLook);
    lookZone.addEventListener('touchcancel', endLook);

    // Boutons
    const btnWrap = root.querySelector('.touch-buttons');
    for (const b of TOUCH_BUTTONS) {
      const el = document.createElement('div');
      el.className = `tbtn ${b.cls}`;
      el.textContent = b.label;
      el.dataset.action = b.action;
      btnWrap.appendChild(el);
      el.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          el.classList.add('down');
          this._press(b.action);
        },
        { passive: false },
      );
      const up = (e) => {
        e.preventDefault();
        el.classList.remove('down');
        this._release(b.action);
      };
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
    }
    const pauseBtn = root.querySelector('.tbtn-pause');
    pauseBtn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this._press('pause');
        setTimeout(() => this._release('pause'), 50);
      },
      { passive: false },
    );
    const mapBtn = root.querySelector('.tbtn-map');
    mapBtn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this._press('map');
        setTimeout(() => this._release('map'), 50);
      },
      { passive: false },
    );
  }

  _pollGamepad() {
    let pads = [];
    if (!this._noPad && navigator.getGamepads) {
      try {
        pads = navigator.getGamepads() || [];
      } catch {
        this._noPad = true; // API manette interdite dans ce contexte
      }
    }
    let pad = null;
    for (const p of pads) if (p && p.connected) pad = p;
    this.padMove.x = 0;
    this.padMove.y = 0;
    this.padLook.x = 0;
    this.padLook.y = 0;
    if (!pad) return;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.padMove.x = dz(pad.axes[0] || 0);
    this.padMove.y = -dz(pad.axes[1] || 0);
    this.padLook.x = dz(pad.axes[2] || 0);
    this.padLook.y = dz(pad.axes[3] || 0);
    if (this.padLook.x || this.padLook.y) this.lookInputTime = performance.now();
    for (const [idx, mapped] of Object.entries(PADMAP)) {
      const b = pad.buttons[idx];
      const isDown = b ? b.pressed || b.value > 0.4 : false;
      const was = this.padPrev[idx] || false;
      const actions = Array.isArray(mapped) ? mapped : [mapped];
      if (isDown && !was) actions.forEach((a) => this._press(a));
      if (!isDown && was) actions.forEach((a) => this._release(a));
      this.padPrev[idx] = isDown;
    }
  }

  update(dt) {
    this._pollGamepad();
    if (this.padLook.x || this.padLook.y) {
      this.look.x += this.padLook.x * 2.6 * dt * this.sensitivity;
      this.look.y += this.padLook.y * 2.0 * dt * this.sensitivity;
    }
    // Flèches : caméra au clavier
    const kx = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    const ky = (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0);
    if (kx || ky) {
      this.look.x += kx * 2.4 * dt;
      this.look.y += ky * 1.6 * dt;
      this.lookInputTime = performance.now();
    }
    if (this.wheel) {
      if (this.wheel > 0) {
        this.pressed.add('gadgetNext');
      }
      this.wheel = 0;
    }
  }

  // Vecteur de déplacement (x = droite, y = avant), longueur ≤ 1
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW')) y += 1;
    if (this.keys.has('KeyS')) y -= 1;
    if (this.keys.has('KeyD')) x += 1;
    if (this.keys.has('KeyA')) x -= 1;
    x += this.touchMove.x + this.padMove.x;
    y += this.touchMove.y + this.padMove.y;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return l;
  }

  isDown(a) {
    return this.enabled && this.down.has(a);
  }
  wasPressed(a) {
    return this.enabled && this.pressed.has(a);
  }
  wasReleased(a) {
    return this.released.has(a);
  }
  consume(a) {
    this.pressed.delete(a);
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}
