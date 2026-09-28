// Orbites képlériennes planes (coniques 2D) : ellipses et hyperboles.
// Convention : le mouvement se fait dans le plan XY ; dir = +1 pour un
// mouvement antihoraire (vu depuis +Z), -1 pour un mouvement rétrograde.

import { TAU, wrapPi } from './math.js';

const EPS_PARA = 1e-7;

export class Orbit {
  constructor() {
    this.mu = 1;
    this.e = 0;
    this.p = 1;
    this.a = 1;
    this.argPe = 0;
    this.dir = 1;
    this.n = 1;
    this.M0 = 0;
    this.t0 = 0;
  }

  static fromState(x, y, vx, vy, mu, t) {
    return new Orbit().setFromState(x, y, vx, vy, mu, t);
  }

  static fromElements(mu, a, e, argPe, M0, t0 = 0, dir = 1) {
    const o = new Orbit();
    o.mu = mu;
    o.e = e;
    o.a = a;
    o.p = a * (1 - e * e);
    o.argPe = argPe;
    o.dir = dir;
    o.n = Math.sqrt(mu / Math.abs(a * a * a));
    o.M0 = M0;
    o.t0 = t0;
    return o;
  }

  clone() {
    const o = new Orbit();
    Object.assign(o, this);
    return o;
  }

  setFromState(x, y, vx, vy, mu, t) {
    this.mu = mu;
    const r = Math.sqrt(x * x + y * y);
    const v2 = vx * vx + vy * vy;
    let h = x * vy - y * vx;
    if (Math.abs(h) < 1e-6) h = h < 0 ? -1e-6 : 1e-6;
    this.dir = h >= 0 ? 1 : -1;
    const ha = Math.abs(h);
    const rv = x * vx + y * vy;
    const k = v2 - mu / r;
    const ex = (k * x - rv * vx) / mu;
    const ey = (k * y - rv * vy) / mu;
    let e = Math.sqrt(ex * ex + ey * ey);
    if (Math.abs(e - 1) < EPS_PARA) e = e < 1 ? 1 - EPS_PARA : 1 + EPS_PARA;
    this.e = e;
    this.p = (ha * ha) / mu;
    this.a = this.p / (1 - e * e);
    const theta = Math.atan2(y, x);
    this.argPe = e > 1e-9 ? Math.atan2(ey, ex) : theta;
    const nu = wrapPi(this.dir * (theta - this.argPe));
    this.n = Math.sqrt(mu / Math.abs(this.a * this.a * this.a));
    this.M0 = this.meanFromTrue(nu);
    this.t0 = t;
    return this;
  }

  get isHyperbolic() {
    return this.e >= 1;
  }
  get periapsis() {
    return this.p / (1 + this.e);
  }
  get apoapsis() {
    return this.e < 1 ? this.p / (1 - this.e) : Infinity;
  }
  get period() {
    return this.e < 1 ? TAU / this.n : Infinity;
  }
  get energy() {
    return -this.mu / (2 * this.a);
  }
  // Anomalie vraie maximale (asymptote) pour une hyperbole
  get nuMax() {
    return this.e > 1 ? Math.acos(-1 / this.e) : Math.PI;
  }

  meanFromTrue(nu) {
    const e = this.e;
    if (e < 1) {
      const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
      return E - e * Math.sin(E);
    }
    const lim = this.nuMax - 1e-9;
    if (nu > lim) nu = lim;
    if (nu < -lim) nu = -lim;
    const tt = Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2);
    const H = 2 * Math.atanh(Math.max(-0.999999999999, Math.min(0.999999999999, tt)));
    return e * Math.sinh(H) - H;
  }

  trueFromMean(M) {
    const e = this.e;
    if (e < 1) {
      M = wrapPi(M);
      let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
      for (let i = 0; i < 40; i++) {
        const f = E - e * Math.sin(E) - M;
        const d = f / (1 - e * Math.cos(E));
        E -= d;
        if (Math.abs(d) < 1e-12) break;
      }
      return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    }
    let H = Math.asinh(M / e);
    for (let i = 0; i < 60; i++) {
      const f = e * Math.sinh(H) - H - M;
      const d = f / (e * Math.cosh(H) - 1);
      H -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return 2 * Math.atan2(Math.sqrt(e + 1) * Math.sinh(H / 2), Math.sqrt(e - 1) * Math.cosh(H / 2));
  }

  meanAt(t) {
    return this.M0 + this.n * (t - this.t0);
  }

  trueAnomalyAt(t) {
    return this.trueFromMean(this.meanAt(t));
  }

  radiusAtTrue(nu) {
    return this.p / (1 + this.e * Math.cos(nu));
  }

  // Position/vitesse relatives au corps parent à l'instant t
  stateAt(t, out = {}) {
    const nu = this.trueAnomalyAt(t);
    return this.stateAtTrue(nu, out);
  }

  stateAtTrue(nu, out = {}) {
    const e = this.e;
    const cn = Math.cos(nu), sn = Math.sin(nu);
    const r = this.p / (1 + e * cn);
    const th = this.argPe + this.dir * nu;
    const ct = Math.cos(th), st = Math.sin(th);
    const k = Math.sqrt(this.mu / this.p);
    const vr = k * e * sn;
    const vt = k * (1 + e * cn);
    out.x = r * ct;
    out.y = r * st;
    out.vx = vr * ct - vt * this.dir * st;
    out.vy = vr * st + vt * this.dir * ct;
    out.r = r;
    out.nu = nu;
    return out;
  }

  positionAtTrue(nu) {
    const r = this.p / (1 + this.e * Math.cos(nu));
    const th = this.argPe + this.dir * nu;
    return [r * Math.cos(th), r * Math.sin(th)];
  }

  // Premier instant >= tAfter où l'anomalie vraie vaut nu
  timeAtTrue(nu, tAfter) {
    const M = this.meanFromTrue(nu);
    let t = this.t0 + (M - this.M0) / this.n;
    if (this.e < 1) {
      const P = this.period;
      const k = Math.ceil((tAfter - t) / P - 1e-9);
      t += k * P;
    }
    return t;
  }

  // Anomalie vraie (>= 0, branche montante) pour un rayon donné, ou null
  trueAtRadius(r) {
    const c = (this.p / r - 1) / this.e;
    if (c < -1 || c > 1 || !isFinite(c)) return null;
    return Math.acos(c);
  }

  // Instant où le rayon atteint r (montée si outward, descente sinon)
  timeToRadius(r, tAfter, outward) {
    const nu = this.trueAtRadius(r);
    if (nu === null) return null;
    const target = outward ? nu : -nu;
    if (this.e >= 1) {
      const t = this.timeAtTrue(target, tAfter);
      return t >= tAfter - 1e-6 ? t : null;
    }
    return this.timeAtTrue(target, tAfter);
  }

  timeToPeriapsis(t) {
    return this.timeAtTrue(0, t) - t;
  }
  timeToApoapsis(t) {
    if (this.e >= 1) return Infinity;
    return this.timeAtTrue(Math.PI, t) - t;
  }

  // Points de la conique pour l'affichage (relatifs au corps parent).
  // nuFrom/nuTo : plage d'anomalie vraie parcourue dans le sens du mouvement.
  samplePoints(n, nuFrom, nuTo, out = []) {
    out.length = 0;
    for (let i = 0; i <= n; i++) {
      const nu = nuFrom + ((nuTo - nuFrom) * i) / n;
      const r = this.p / (1 + this.e * Math.cos(nu));
      const th = this.argPe + this.dir * nu;
      out.push(r * Math.cos(th), r * Math.sin(th));
    }
    return out;
  }

  // Plage d'anomalie vraie à afficher, bornée par un rayon maximal
  displayRange(maxR) {
    if (this.e < 1 && this.apoapsis <= maxR) return [-Math.PI, Math.PI];
    const nu = this.trueAtRadius(maxR);
    if (nu === null) return [-Math.PI, Math.PI];
    return [-nu, nu];
  }
}
