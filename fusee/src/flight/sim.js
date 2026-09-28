// Gestion du temps et des vaisseaux chargés : pas de physique, accélération
// du temps « sur rails » (orbites képlériennes), changements de sphère
// d'influence, atterrissages.

import { predict } from './predict.js';
import { Vessel } from './vessel.js';

export const WARPS = [1, 2, 3, 4, 10, 50, 100, 1000, 10000, 100000, 1e6, 1e7];
export const PHYS_WARP = 3; // index max de l'accélération physique

export class Sim {
  constructor(sys, ut = 0) {
    this.sys = sys;
    this.ut = ut;
    this.vessels = [];
    this.active = null;
    this.warpIdx = 0;
    this.events = [];
    this.prediction = null;
    this.predT = -1;
    this.predDirty = true;
    this.maxWarpMsg = '';
  }

  get warp() {
    return WARPS[this.warpIdx];
  }

  add(v) {
    if (!this.vessels.includes(v)) this.vessels.push(v);
  }

  remove(v) {
    this.vessels = this.vessels.filter((x) => x !== v);
  }

  setActive(v) {
    this.active = v;
    this.add(v);
    this.predDirty = true;
  }

  // Le passage « sur rails » est-il possible ?
  railsBlocker(v = this.active) {
    if (!v) return '';
    if (v.clamped && !v.launched) return '';
    const b = v.body;
    if (v.landed) return '';
    if (v.inContact) return 'Vaisseau en mouvement au sol';
    if (b.atmosphere && v.altitude < b.atmosphere.height) return 'Dans l\'atmosphère : accélération limitée à ×4';
    if (v.throttle > 0 && v.parts.some((p) => p.engOn && (p.thrustFrac || 0) > 0.01)) return 'Moteurs allumés : accélération limitée à ×4';
    if (v.parts.some((p) => p.engOn && p.def.engine.solid && (p.res.solid || 0) > 0)) return 'Propulseur à poudre allumé';
    // altitude minimale pour les accélérations très fortes
    return '';
  }

  // Accélération maximale selon l'altitude (comme les simulateurs du genre)
  maxRailsIdx(v = this.active) {
    if (!v) return WARPS.length - 1;
    if (v.landed) return WARPS.length - 1;
    const b = v.body;
    const alt = v.altitude;
    const lim = [
      [b.radius * 0.1, 7], // ×1000
      [b.radius * 0.5, 8],
      [b.radius * 3, 9],
      [b.radius * 20, 10],
    ];
    if (b.type === 'star') return WARPS.length - 1;
    for (const [a, idx] of lim) if (alt < a) return idx;
    return WARPS.length - 1;
  }

  setWarp(idx) {
    idx = Math.max(0, Math.min(WARPS.length - 1, idx));
    const v = this.active;
    if (idx > PHYS_WARP) {
      const blk = this.railsBlocker(v);
      if (blk) {
        this.maxWarpMsg = blk;
        idx = PHYS_WARP;
      } else {
        const m = this.maxRailsIdx(v);
        if (idx > m) { idx = m; this.maxWarpMsg = 'Trop près de ' + v.body.name + ' pour accélérer davantage'; }
      }
    }
    if (this.warpIdx !== idx) this.predDirty = true;
    this.warpIdx = idx;
    return idx;
  }

  // ------------------------------------------------------------------------
  update(dtReal, controls) {
    const v = this.active;
    const warp = this.warp;
    let dt = dtReal * warp;
    if (this.warpIdx > PHYS_WARP) {
      // Sur rails
      for (const o of this.vessels) if (!o.onRails) {
        if (o.landed) o.captureLanded(this.ut);
        o.goOnRails(this.ut);
      }
      // Événements à ne pas dépasser (sphère d'influence, atmosphère, sol)
      const tEvent = this.nextEventTime(v);
      let stopWarp = false;
      if (tEvent != null && this.ut + dt >= tEvent) {
        dt = Math.max(0, tEvent - this.ut) + 0.01;
        stopWarp = true;
      }
      this.ut += dt;
      for (const o of this.vessels) {
        o.railsUpdate(this.ut);
        if (!o.landed) {
          if (o.checkSOI(this.ut)) { this.predDirty = true; if (o === v) stopWarp = true; }
        }
      }
      // débris qui retombent : on les supprime pendant l'accélération
      for (const o of this.vessels.slice()) {
        if (o === v || o.landed) continue;
        const b = o.body;
        const low = b.radius + (b.atmosphere ? b.atmosphere.height : 0);
        if (o.orbit && o.orbit.periapsis < low) this.remove(o);
      }
      if (stopWarp) {
        // retour en temps réel près de l'événement
        this.warpIdx = Math.min(this.warpIdx, this.nearEventWarp(v));
        if (v.body.atmosphere && v.altitude < v.body.atmosphere.height * 1.02) this.warpIdx = 0;
        if (v.orbit && v.orbit.periapsis < v.body.radius && v.altitude < v.body.radius * 0.02 + 5000) this.warpIdx = 0;
        this.predDirty = true;
      }
      if (this.warpIdx <= PHYS_WARP) for (const o of this.vessels) o.goOffRails(this.ut);
    } else {
      for (const o of this.vessels) if (o.onRails) o.goOffRails(this.ut);
      this.physics(dt, controls);
    }
    // mises à jour lentes
    for (const o of this.vessels.slice()) {
      if (!o.onRails) o.frameUpdate(dt, this.ut, this.sys);
      else if (o === v) o.frameUpdate(0, this.ut, this.sys);
      this.collectEvents(o);
    }
    this.checkLanded(dt);
    // prédiction de trajectoire (limitée en fréquence)
    const now = performance.now();
    const thrusting = v && !v.onRails && (v.nonGravAccel || 0) > 0.05;
    if (v && (this.predDirty || (thrusting && now - this.predT > 250) || now - this.predT > 2000)) {
      this.updatePrediction();
      this.predT = now;
      this.predDirty = false;
    }
  }

  nearEventWarp(v) {
    const b = v.body;
    const alt = v.altitude;
    if (alt < b.radius * 0.3) return 5;
    return 7;
  }

  nextEventTime(v) {
    if (!v || v.landed || !this.prediction || !this.prediction.length) return null;
    const p = this.prediction[0];
    let t = null;
    if (p.atmoT != null && p.atmoT > this.ut) t = p.atmoT;
    if (isFinite(p.t1) && (t == null || p.t1 < t)) t = p.t1;
    // pour les corps sans atmosphère : arrêt 20 s avant l'impact
    if (p.end === 'impact') {
      const alt = v.altitude;
      const tStop = p.t1 - Math.max(30, alt / 200);
      if (t == null || tStop < t) t = Math.max(this.ut, tStop);
    }
    if (this.stopAt != null && this.stopAt > this.ut && (t == null || this.stopAt < t)) t = this.stopAt;
    return t;
  }

  updatePrediction() {
    const v = this.active;
    if (!v || v.landed || (v.clamped && !v.launched)) { this.prediction = null; return; }
    const hiddenOk = (c) => !c.hidden || (this.game && this.game.hasTech(c.hidden));
    try {
      this.prediction = predict(this.sys, v.body, v.x, v.y, v.vx, v.vy, this.ut, { hiddenOk });
    } catch (e) {
      console.warn('prédiction', e);
      this.prediction = null;
    }
  }

  physics(dt, controls) {
    const v = this.active;
    // pas adapté : plus fin près du sol
    let maxStep = 1 / 120;
    for (const o of this.vessels) {
      if (o.clamped || o.inContact) maxStep = Math.min(maxStep, 1 / 480);
      else if (!o.body.hasSurface) continue;
      else {
        const talt = o.altitude - Math.max(0, o.body.ground.amp || 0) - o.radius;
        if (talt < 150) maxStep = Math.min(maxStep, 1 / 360);
      }
    }
    if (this.warpIdx > 0 && v && v.altitude > (v.body.atmosphere ? v.body.atmosphere.height : 1e4)) maxStep = Math.max(maxStep, 1 / 60);
    const n = Math.min(400, Math.max(1, Math.ceil(dt / maxStep)));
    const h = dt / n;
    for (const o of this.vessels) {
      if (o !== v) { o.ctrl.rot = 0; o.ctrl.tx = 0; o.ctrl.ty = 0; }
      o.computeMass();
    }
    if (controls) controls(h);
    for (let i = 0; i < n; i++) {
      for (const o of this.vessels) {
        if (o.dead) continue;
        o.physicsStep(h, this.ut, null);
        o.checkSOI(this.ut);
      }
      this.ut += h;
    }
  }

  // Détection de l'état « posé »
  checkLanded(dt) {
    for (const o of this.vessels) {
      if (o.onRails || o.clamped) continue;
      if (o.inContact) {
        const sv = o.surfaceVelocity();
        const sp = Math.hypot(sv[0], sv[1]);
        const w = o.body.angularVelocity();
        if (sp < 0.6 && Math.abs(o.av - w) < 0.08) o.landedTimer += dt;
        else o.landedTimer = 0;
        if (o.landedTimer > 0.8 && !o.landed) {
          o.landed = true;
          o.events.push({ type: 'landed', splashed: o.splashed });
        }
      } else {
        o.landedTimer = 0;
        if (o.landed) o.landed = false;
      }
    }
  }

  collectEvents(o) {
    if (!o.events.length) return;
    for (const e of o.events) {
      e.vessel = o;
      if (e.type === 'newVessel') this.add(e.nv);
      this.events.push(e);
    }
    o.events.length = 0;
  }

  takeEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  // Nettoyage des débris lointains (hors de portée physique)
  cleanup() {
    const v = this.active;
    if (!v) return;
    for (const o of this.vessels.slice()) {
      if (o === v) continue;
      if (o.dead || !o.parts.length) { this.remove(o); continue; }
      if (o.body !== v.body) { this.remove(o); o.unloaded = true; continue; }
      const d = Math.hypot(o.x - v.x, o.y - v.y);
      if (d > 60000) { this.remove(o); o.unloaded = true; }
    }
  }
}

export { Vessel };
