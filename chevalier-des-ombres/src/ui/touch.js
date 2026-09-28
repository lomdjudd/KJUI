// Commandes tactiles : joystick dynamique, caméra par glissement, boutons d'action
// (tailles, opacité et disposition gaucher réglables).
import { settings } from '../core/settings.js';
import { powerById } from '../data/skills.js';
import { el } from '../core/utils.js';
import { audio } from '../core/audio.js';

// Positions (en px, depuis le bas-droit) : [action, libellé, icône, taille, droite, bas, maintenu]
const BUTTONS = [
  ['attack', 'Frappe', '⚔', 86, 36, 34, false],
  ['heavy', 'Lourde', '⚒', 60, 132, 22, false],
  ['dodge', 'Roulade', '↻', 64, 28, 132, false],
  ['block', 'Garde', '⛨', 62, 118, 110, true],
  ['jump', 'Saut', '⇧', 52, 200, 34, false],
  ['power', 'Pouvoir', '✦', 60, 104, 192, false],
  ['powerNext', '', '⟳', 36, 176, 222, false],
  ['lock', 'Cible', '◎', 46, 30, 216, false],
  ['heal', '', '', 46, 214, 110, false],
  ['mana', '', '', 40, 268, 150, false],
  ['interact', 'Action', '✋', 58, 196, 186, false],
];

export class Touch {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.root = document.getElementById('touch');
    this.enabled = this.input.isTouch;
    this.buttons = {};
    this.stickId = null;
    this.lookId = null;
    this.sprintT = 0;
    if (!this.enabled) return;
    this.build();
    settings.onChange(() => this.applySettings());
    this.applySettings();
  }

  build() {
    const r = this.root;
    r.innerHTML = '<div class="zone-l"></div><div class="zone-r"></div><div class="stick-hint"></div><div class="stick"><div class="knob"></div></div>';
    this.zoneL = r.querySelector('.zone-l');
    this.zoneR = r.querySelector('.zone-r');
    this.stick = r.querySelector('.stick');
    this.knob = r.querySelector('.knob');
    this.hint = r.querySelector('.stick-hint');
    for (const [act, label, ico, size] of BUTTONS) {
      const b = el('div', 'tbtn', `<div><div class="ico">${ico}</div>${label}</div>`);
      b.dataset.act = act;
      b.dataset.size = size;
      if (act === 'heal') b.innerHTML = '<div><div class="ico" style="color:#ff8a3a">⚱</div></div><span class="cnt"></span>';
      if (act === 'mana') b.innerHTML = '<div><div class="ico" style="color:#4dd8ff">⚱</div></div><span class="cnt"></span>';
      if (act === 'power') b.innerHTML = '<div class="cd"></div><div><div class="ico">✦</div><span class="pn"></span></div>';
      r.appendChild(b);
      this.buttons[act] = b;
      this._bindButton(b, act, BUTTONS.find((x) => x[0] === act)[6]);
    }
    // Boutons du haut : pause et vue
    const pause = el('div', 'tbtn', '<div class="ico">☰</div>');
    pause.dataset.fixed = 'pause';
    r.appendChild(pause);
    pause.addEventListener('touchstart', (e) => {
      e.preventDefault();
      audio.init();
      if (this.game.state === 'playing') this.game.menus.openPause();
    });
    this.pauseBtn = pause;
    const cam = el('div', 'tbtn', '<div class="ico">👁</div>');
    cam.dataset.fixed = 'camera';
    r.appendChild(cam);
    this._bindButton(cam, 'camera', false);
    this.camBtn = cam;
    const map = el('div', 'tbtn', '<div class="ico">🗺</div>');
    map.dataset.fixed = 'map';
    r.appendChild(map);
    map.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.game.state === 'playing') this.game.menus.openPause('map');
    });
    this.mapBtn = map;
    this._bindStick();
    this._bindLook();
  }

  _bindButton(b, act, hold) {
    b.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        audio.init();
        b.classList.add('on');
        this.input._press(act);
        b._tid = e.changedTouches[0].identifier;
      },
      { passive: false },
    );
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== b._tid) continue;
        b.classList.remove('on');
        this.input._release(act);
      }
    };
    b.addEventListener('touchend', end);
    b.addEventListener('touchcancel', end);
  }

  _bindStick() {
    const z = this.zoneL;
    let cx = 0;
    let cy = 0;
    const R = () => 55 * settings.get('touchScale');
    z.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        audio.init();
        if (this.stickId !== null) return;
        const t = e.changedTouches[0];
        this.stickId = t.identifier;
        cx = t.clientX;
        cy = t.clientY;
        this.stick.style.display = 'block';
        this.stick.style.left = cx + 'px';
        this.stick.style.top = cy + 'px';
        this.hint.style.display = 'none';
      },
      { passive: false },
    );
    z.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== this.stickId) continue;
          let dx = t.clientX - cx;
          let dy = t.clientY - cy;
          const d = Math.hypot(dx, dy);
          const r = R();
          if (d > r) {
            dx = (dx / d) * r;
            dy = (dy / d) * r;
          }
          this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.input.touchMove.x = dx / r;
          this.input.touchMove.y = dy / r;
          // Poussé à fond : sprint
          const full = d > r * 0.97;
          if (full && !this.sprinting) {
            this.sprinting = true;
            this.input._press('sprint');
          } else if (!full && this.sprinting) {
            this.sprinting = false;
            this.input._release('sprint');
          }
        }
      },
      { passive: false },
    );
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.stickId) continue;
        this.stickId = null;
        this.stick.style.display = 'none';
        this.hint.style.display = '';
        this.knob.style.transform = '';
        this.input.touchMove.x = this.input.touchMove.y = 0;
        if (this.sprinting) {
          this.sprinting = false;
          this.input._release('sprint');
        }
      }
    };
    z.addEventListener('touchend', end);
    z.addEventListener('touchcancel', end);
  }

  _bindLook() {
    const z = this.zoneR;
    let lx = 0;
    let ly = 0;
    let t0 = 0;
    let moved = 0;
    z.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        audio.init();
        if (this.lookId !== null) return;
        const t = e.changedTouches[0];
        this.lookId = t.identifier;
        lx = t.clientX;
        ly = t.clientY;
        t0 = performance.now();
        moved = 0;
      },
      { passive: false },
    );
    z.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== this.lookId) continue;
          const dx = t.clientX - lx;
          const dy = t.clientY - ly;
          lx = t.clientX;
          ly = t.clientY;
          moved += Math.abs(dx) + Math.abs(dy);
          this.input.addLook(dx * 0.0062, dy * 0.0052);
        }
      },
      { passive: false },
    );
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.lookId) continue;
        this.lookId = null;
        // Tap rapide sur la zone caméra : attaque
        if (moved < 10 && performance.now() - t0 < 220) this.input.tap('attack');
      }
    };
    z.addEventListener('touchend', end);
    z.addEventListener('touchcancel', end);
  }

  applySettings() {
    if (!this.enabled) return;
    const s = settings.get('touchScale');
    const left = settings.get('leftHanded');
    document.documentElement.style.setProperty('--touch-scale', s);
    document.documentElement.style.setProperty('--touch-opacity', settings.get('touchOpacity'));
    const side = left ? 'left' : 'right';
    const other = left ? 'right' : 'left';
    for (const [act, , , size, rx, by] of BUTTONS) {
      const b = this.buttons[act];
      const sz = size * s;
      b.style.width = b.style.height = sz + 'px';
      b.style[side] = `calc(${rx * s}px + var(--safe-${left ? 'l' : 'r'}))`;
      b.style[other] = '';
      b.style.bottom = `calc(${by * s}px + var(--safe-b))`;
    }
    this.zoneL.style.left = left ? '' : '0';
    this.zoneL.style.right = left ? '0' : '';
    this.zoneR.style.right = left ? '' : '0';
    this.zoneR.style.left = left ? '0' : '';
    this.hint.style.left = left ? '' : `calc(70px + var(--safe-l))`;
    this.hint.style.right = left ? `calc(70px + var(--safe-r))` : '';
    const top = (b, i) => {
      b.style.width = b.style.height = 42 * s + 'px';
      b.style.top = `calc(${176 * 1 + i * 52 * s}px + var(--safe-t))`;
      b.style[other] = '';
      b.style[side] = `calc(${24}px + var(--safe-${left ? 'l' : 'r'}))`;
    };
    // Pause/vue/carte : colonne sous la mini-carte
    [this.pauseBtn, this.camBtn, this.mapBtn].forEach((b, i) => {
      b.style.width = b.style.height = 40 * s + 'px';
      b.style.top = `calc(${8 + i * 48 * s}px + var(--safe-t))`;
      b.style.right = '';
      b.style.left = '';
      b.style[left ? 'right' : 'left'] = `calc(${50 + 250 * 0}px + 45vw)`;
    });
    void top;
    this.refresh();
  }

  setVisible(v) {
    if (!this.enabled) return;
    this.root.classList.toggle('show', v);
    if (!v) {
      this.input.touchMove.x = this.input.touchMove.y = 0;
      this.stickId = this.lookId = null;
      if (this.stick) this.stick.style.display = 'none';
    }
  }

  refresh() {
    if (!this.enabled) return;
    const g = this.game;
    const p = g.player;
    const prof = g.profile;
    this.buttons.heal.querySelector('.cnt').textContent = p.flasks;
    this.buttons.mana.querySelector('.cnt').textContent = p.manaFlasks;
    const id = prof.powerSlots[prof.powerIndex];
    const pw = id ? powerById(id) : null;
    this.buttons.power.querySelector('.ico').textContent = pw ? pw.icon : '✦';
    this.buttons.power.querySelector('.pn').textContent = '';
  }

  update() {
    if (!this.enabled || !this.root.classList.contains('show')) return;
    const g = this.game;
    const p = g.player;
    const prof = g.profile;
    const id = prof.powerSlots[prof.powerIndex];
    const cd = id ? p.cooldowns[id] || 0 : 0;
    const max = (p.cooldownMax && p.cooldownMax[id]) || 1;
    this.buttons.power.querySelector('.cd').style.setProperty('--p', (cd > 0 ? (cd / max) * 100 : 0) + '%');
    this.buttons.interact.classList.toggle('hide', !g.interactTarget);
    this.buttons.lock.classList.toggle('on', !!p.lockTarget);
  }
}
