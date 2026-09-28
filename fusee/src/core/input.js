// Entrées clavier et manette. Les touches sont identifiées par leur code
// physique (KeyA = Q sur un clavier AZERTY).

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.keyHit = new Set(); // touches selon leur libellé (disposition du clavier)
    this.pad = null;
    this.padPrev = [];
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.keys.has(e.code)) { this.pressed.add(e.code); if (e.key) this.keyHit.add(e.key.toLowerCase()); }
      this.keys.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  hit(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  // Manette : axes et boutons (disposition standard)
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    if (!this.pad) return;
    const b = this.pad.buttons.map((x) => x.pressed);
    this.padHit = b.map((v, i) => v && !this.padPrev[i]);
    this.padPrev = b;
  }

  padAxis(i) {
    if (!this.pad) return 0;
    const v = this.pad.axes[i] || 0;
    return Math.abs(v) < 0.15 ? 0 : v;
  }

  padButton(i) {
    return !!(this.pad && this.pad.buttons[i] && this.pad.buttons[i].pressed);
  }

  padValue(i) {
    return this.pad && this.pad.buttons[i] ? this.pad.buttons[i].value : 0;
  }

  padPressed(i) {
    return !!(this.padHit && this.padHit[i]);
  }

  // touche selon son libellé (AZERTY/QWERTY)
  key(...ks) {
    return ks.some((k) => this.keyHit.has(k));
  }

  endFrame() {
    this.pressed.clear();
    this.keyHit.clear();
  }
}
