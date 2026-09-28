// Stabilisation (SAS), nœuds de manœuvre et pilotes automatiques :
// mise en orbite, exécution de manœuvre, atterrissage propulsif.

import { wrapPi, clamp, G0 } from '../core/math.js';
import { Orbit } from '../core/orbit.js';
import { predict } from './predict.js';
import { ispAt } from '../craft/craft.js';

export const SAS_MODES = [
  { id: 'stab', name: 'Stabilité', key: 'stab' },
  { id: 'pro', name: 'Prograde' },
  { id: 'retro', name: 'Rétrograde' },
  { id: 'radout', name: 'Radial sortant' },
  { id: 'radin', name: 'Radial entrant' },
  { id: 'up', name: 'Verticale' },
  { id: 'node', name: 'Manœuvre' },
  { id: 'target', name: 'Cible' },
];

// Mode de vitesse : surface (près du sol) ou orbital
export function speedMode(v) {
  const b = v.body;
  const lim = b.atmosphere ? b.atmosphere.height : Math.max(20000, b.radius * 0.08);
  return v.altitude < lim ? 'surface' : 'orbit';
}

export function velocityFor(v, mode = speedMode(v)) {
  if (mode === 'surface') return v.surfaceVelocity();
  return [v.vx, v.vy];
}

// Angle « rot » qui aligne le nez sur une direction (x, y)
export function rotFor(dx, dy) {
  return Math.atan2(dy, dx) - Math.PI / 2;
}

// Couple maximal disponible (estimation) pour régler l'asservissement
export function maxTorque(v) {
  let T = 0;
  const ec = v.totalRes('ec') > 0;
  for (const p of v.parts) {
    const d = p.def;
    if (ec && d.wheel) T += d.wheel.torque;
    if (ec && d.command) T += d.command.torque;
    if (d.engine && p.engOn && (p.thrustFrac || 0) > 0.05 && d.gimbal) {
      T += d.thrust * (p.thrustFrac || 0) * Math.sin((d.gimbal * Math.PI) / 180) * Math.abs(p.pos.y - v.cy);
    }
    if (d.rcs && v.rcsOn) T += d.rcs.thrust * (Math.abs(p.pos.y - v.cy) + 0.5);
  }
  T += v.aeroCtrl || 0;
  return T;
}

// Asservissement d'attitude vers un angle cible
export function steerTo(v, targetRot, dt, targetRate = 0) {
  const T = maxTorque(v);
  const alpha = Math.max(1e-4, T / v.inertia);
  const err = wrapPi(targetRot - v.rot);
  const want = Math.sign(err) * Math.min(Math.sqrt(2 * alpha * 0.6 * Math.abs(err)), 1.5) + targetRate;
  const cmd = (want - v.av) / (alpha * Math.max(dt, 0.02) * 6);
  return clamp(cmd, -1, 1);
}

// Direction cible du SAS (vecteur monde) ou null
export function sasDirection(v, mode, ctx) {
  const up = [v.x, v.y];
  const r = Math.hypot(up[0], up[1]);
  up[0] /= r; up[1] /= r;
  const vm = velocityFor(v);
  const sp = Math.hypot(vm[0], vm[1]);
  switch (mode) {
    case 'pro': return sp > 0.5 ? [vm[0] / sp, vm[1] / sp] : up;
    case 'retro': return sp > 0.5 ? [-vm[0] / sp, -vm[1] / sp] : up;
    case 'radout':
    case 'radin': {
      let d;
      if (speedMode(v) === 'surface' || sp < 1) d = up;
      else {
        const t = [vm[0] / sp, vm[1] / sp];
        const dot = up[0] * t[0] + up[1] * t[1];
        d = [up[0] - dot * t[0], up[1] - dot * t[1]];
        const l = Math.hypot(d[0], d[1]) || 1;
        d = [d[0] / l, d[1] / l];
      }
      return mode === 'radout' ? d : [-d[0], -d[1]];
    }
    case 'up': return up;
    case 'node': {
      const n = ctx && ctx.node;
      if (!n || !n.remaining) return null;
      const l = Math.hypot(n.remaining[0], n.remaining[1]);
      return l > 0.01 ? [n.remaining[0] / l, n.remaining[1] / l] : null;
    }
    case 'target': {
      const t = ctx && ctx.target;
      if (!t) return null;
      const ts = t.state(ctx.ut), vs = v.body.state(ctx.ut);
      const dx = ts.x - (vs.x + v.x), dy = ts.y - (vs.y + v.y);
      const l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    }
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Nœud de manœuvre
export class ManeuverNode {
  constructor(t, pro = 0, rad = 0) {
    this.t = t;
    this.pro = pro;
    this.rad = rad;
    this.remaining = null;
    this.started = false;
  }

  // État sur la trajectoire prévue à l'instant du nœud
  compute(v, sys, patches, game) {
    const patch = (patches || []).find((p) => this.t >= p.t0 && this.t <= p.t1) || (patches && patches[0]);
    if (!patch) return null;
    const st = patch.orbit.stateAt(this.t);
    const sp = Math.hypot(st.vx, st.vy);
    const px = st.vx / sp, py = st.vy / sp;
    let rx = st.x, ry = st.y;
    const dot = rx * px + ry * py;
    rx -= dot * px; ry -= dot * py;
    const rl = Math.hypot(rx, ry) || 1;
    rx /= rl; ry /= rl;
    this.body = patch.body;
    this.state = st;
    this.dir = { px, py, rx, ry };
    this.dv = [px * this.pro + rx * this.rad, py * this.pro + ry * this.rad];
    this.dvMag = Math.hypot(this.dv[0], this.dv[1]);
    const hiddenOk = (c) => !c.hidden || (game && game.hasTech(c.hidden));
    this.after = predict(sys, patch.body, st.x, st.y, st.vx + this.dv[0], st.vy + this.dv[1], this.t, { hiddenOk });
    if (!this.started) this.remaining = this.dv.slice();
    return this.after;
  }

  // Durée estimée de la poussée
  burnTime(v) {
    const pres = v.pressureNow || 0;
    let F = 0, mdot = 0;
    for (const p of v.parts) {
      const d = p.def.engine;
      if (!d || !p.engOn || d.escape || v.fuelFor(p) <= 0) continue;
      F += (d.thrust * ispAt(d, pres)) / d.ispVac;
      mdot += d.thrust / (d.ispVac * G0);
    }
    if (F <= 0) return Infinity;
    const isp = F / (mdot * G0);
    const m1 = v.mass / Math.exp(this.dvMag / (isp * G0));
    return (v.mass - m1) / mdot;
  }

  // Suivi du Δv restant pendant la poussée
  track(v, ut) {
    if (!this.state || this.body !== v.body) return;
    if (ut < this.t - 600 && !this.started) { this.remaining = this.dv.slice(); return; }
    if (!this.baseOrbit) {
      this.baseOrbit = Orbit.fromState(this.state.x, this.state.y, this.state.vx, this.state.vy, v.body.mu, this.t);
    }
    const s = this.baseOrbit.stateAt(ut);
    const applied = [v.vx - s.vx, v.vy - s.vy];
    const rem = [this.dv[0] - applied[0], this.dv[1] - applied[1]];
    // si le vaisseau n'a pas encore poussé, on garde le vecteur initial
    if (!this.started && Math.hypot(applied[0], applied[1]) < 0.5) { this.remaining = this.dv.slice(); return; }
    this.started = true;
    this.remaining = rem;
  }
}

// ---------------------------------------------------------------------------
// Pilote automatique
export class Autopilot {
  constructor(flight) {
    this.f = flight;
    this.mode = null;
    this.status = '';
    this.phase = '';
    this.targetAlt = 90000;
    this.stageCool = 0;
  }

  start(mode, opts = {}) {
    this.mode = mode;
    this.phase = 'init';
    this.status = '';
    Object.assign(this, opts);
    const v = this.f.sim.active;
    if (mode === 'ascent') {
      const b = v.body;
      if (!opts.targetAlt) this.targetAlt = b.atmosphere ? b.atmosphere.height + 25000 : Math.max(15000, b.radius * 0.1);
    }
  }

  stop(msg = '') {
    this.mode = null;
    this.status = msg;
    const v = this.f.sim.active;
    if (v) v.throttle = 0;
  }

  // Étagement automatique quand l'étage est épuisé
  autoStage(v, dt) {
    this.stageCool -= dt;
    if (this.stageCool > 0 || v.stageIdx >= v.stages.length) return;
    const active = v.parts.filter((p) => p.def.engine && p.engOn && !p.def.engine.escape);
    const burning = active.filter((p) => v.fuelFor(p) > 0);
    // propulseurs vides à larguer
    const empties = v.parts.filter((p) => p.def.engine && !p.def.engine.escape && (p.engOn || p.flameout) && v.fuelFor(p) <= 0);
    const next = v.stages[v.stageIdx] || [];
    const nextHasChute = next.some((u) => v.byUid.get(u)?.def.chute);
    if (nextHasChute) return;
    if (!burning.length || (empties.length && next.some((u) => v.byUid.get(u)?.def.decoupler))) {
      v.activateNextStage(this.f.sim.ut);
      this.stageCool = 1.2;
    }
  }

  update(dt, v, sim) {
    if (!this.mode || !v) return null;
    if (!v.hasControl || v.electronicsDead) { this.stop('Pilote automatique coupé : pas de contrôle'); return null; }
    const fn = this['run_' + this.mode];
    return fn ? fn.call(this, dt, v, sim) : null;
  }

  run_ascent(dt, v, sim) {
    const b = v.body;
    const alt = v.altitude;
    const orb = v.computeOrbit(sim.ut);
    const A = this.targetAlt;
    const atmH = b.atmosphere ? b.atmosphere.height : 0;
    const turnEnd = b.atmosphere ? atmH * 0.75 : Math.max(4000, A * 0.5);
    const up = Math.atan2(v.y, v.x);
    const apAlt = orb.apoapsis - b.radius;
    const peAlt = orb.periapsis - b.radius;
    if (v.clamped && !v.launched) { v.throttle = 1; v.activateNextStage(sim.ut); this.status = 'Allumage'; return { rot: 0 }; }
    this.autoStage(v, dt);
    // coiffe hors de l'atmosphère dense
    if (b.atmosphere && alt > atmH * 0.85) {
      for (const p of v.parts) if (p.def.fairing && !p.fairingDeployed) v.deployFairing(p);
    }
    let targetRot, throttle = 1;
    const r = Math.hypot(v.x, v.y);
    const ux = v.x / r, uy = v.y / r;
    const tx = -uy, ty = ux; // horizontale vers l'est
    if (this.phase === 'init' || this.phase === 'climb') {
      this.phase = 'climb';
      let pitch = 0;
      if (alt > 250) pitch = Math.min(1.52, 1.5 * Math.pow((alt - 250) / turnEnd, 0.45));
      // virage gravitationnel : on suit la vitesse si elle est plus couchée que le programme
      const sv = alt < atmH ? v.surfaceVelocity() : [v.vx, v.vy];
      const vs = Math.hypot(sv[0], sv[1]);
      if (vs > 80 && alt > 1500) {
        const velPitch = Math.atan2(sv[0] * tx + sv[1] * ty, sv[0] * ux + sv[1] * uy);
        if (velPitch > pitch) pitch = Math.min(velPitch, pitch + 0.12);
      }
      targetRot = up + Math.min(pitch, 1.57) - Math.PI / 2;
      const twr = v.maxThrust(v.pressureNow) / (v.mass * b.g) || 1;
      if (b.atmosphere && alt < atmH * 0.35 && twr > 2.2) throttle = 2.2 / twr;
      if (apAlt >= A) { throttle = 0; this.phase = 'coast'; }
      this.status = `Ascension · apoapside ${(apAlt / 1000).toFixed(1)} / ${(A / 1000).toFixed(0)} km`;
    } else if (this.phase === 'coast') {
      targetRot = Math.atan2(v.vy, v.vx) - Math.PI / 2;
      throttle = 0;
      if (apAlt < A * 0.985 && alt < atmH) throttle = 0.25;
      const tta = orb.timeToApoapsis(sim.ut);
      const stAp = orb.stateAt(sim.ut + tta);
      const dvC = Math.sqrt(b.mu / orb.apoapsis) - Math.hypot(stAp.vx, stAp.vy);
      const node = new ManeuverNode(sim.ut + tta, dvC);
      node.dvMag = Math.abs(dvC);
      const bt = node.burnTime(v);
      this.status = `Croisière jusqu'à l'apoapside · T-${tta.toFixed(0)} s · Δv ${dvC.toFixed(0)} m/s`;
      if (alt > atmH && tta > bt / 2 + 40 && sim.warpIdx === 0 && this.allowWarp) sim.setWarp(5);
      if (tta < bt / 2 + 25 && sim.warpIdx > 3) sim.setWarp(0);
      if (alt > atmH * 0.98 && (tta < bt / 2 + 1 || (orb.e < 1 && tta > orb.period * 0.75))) this.phase = 'circ';
    } else if (this.phase === 'circ') {
      // vitesse circulaire à l'altitude actuelle, à l'horizontale
      const vc = Math.sqrt(b.mu / r);
      const dvx = tx * vc - v.vx, dvy = ty * vc - v.vy;
      const dv = Math.hypot(dvx, dvy);
      targetRot = rotFor(dvx, dvy);
      const err = Math.abs(wrapPi(targetRot - v.rot));
      const acc = v.maxThrust(0) / v.mass || 1;
      throttle = err < 0.2 ? clamp(dv / (acc * 1.3), 0.03, 1) : 0;
      this.status = `Circularisation · Δv ${dv.toFixed(0)} m/s · périapside ${(peAlt / 1000).toFixed(1)} km`;
      if (dv < 1.2 || (peAlt > Math.max(atmH + 3000, A * 0.9) && orb.e < 0.006)) {
        v.throttle = 0;
        this.stop('Orbite atteinte !');
        this.f.onAutopilotDone('orbit');
        return { rot: steerTo(v, targetRot, dt) };
      }
    }
    v.throttle = throttle;
    return { rot: steerTo(v, targetRot, dt) };
  }

  run_node(dt, v, sim) {
    const n = this.f.node;
    if (!n) { this.stop('Aucune manœuvre'); return null; }
    n.track(v, sim.ut);
    const bt = n.burnTime(v);
    const tStart = n.t - (isFinite(bt) ? bt / 2 : 0);
    const dir = n.remaining || n.dv;
    const rem = Math.hypot(dir[0], dir[1]);
    const targetRot = rotFor(dir[0], dir[1]);
    const err = Math.abs(wrapPi(targetRot - v.rot));
    this.autoStage(v, dt);
    if (sim.ut < tStart - 30) {
      v.throttle = 0;
      this.status = `Orientation · allumage dans ${(tStart - sim.ut).toFixed(0)} s`;
      if (err < 0.05 && Math.abs(v.av) < 0.02 && this.allowWarp) {
        // accélère jusqu'à T-30 s
        sim.stopAt = tStart - 25;
        if (sim.warpIdx < 4 && tStart - sim.ut > 120) sim.setWarp(Math.min(sim.maxRailsIdx(), 9));
      }
      return { rot: steerTo(v, targetRot, dt) };
    }
    sim.stopAt = null;
    if (sim.warpIdx > 0 && sim.ut > tStart - 30) sim.setWarp(0);
    if (sim.ut < tStart) {
      v.throttle = 0;
      this.status = `Allumage dans ${(tStart - sim.ut).toFixed(0)} s`;
      return { rot: steerTo(v, targetRot, dt) };
    }
    const acc = v.maxThrust(v.pressureNow) / v.mass || 1;
    v.throttle = err < 0.15 ? clamp(rem / (acc * 1.5), 0.02, 1) : 0;
    this.status = `Poussée · Δv restant ${rem.toFixed(1)} m/s`;
    // fin : Δv atteint ou vecteur qui s'inverse
    const dot = n.remaining && n.dv ? n.remaining[0] * n.dv[0] + n.remaining[1] * n.dv[1] : 1;
    if (rem < 0.3 || dot < 0) {
      v.throttle = 0;
      this.f.removeNode();
      this.stop('Manœuvre terminée');
      return null;
    }
    return { rot: steerTo(v, targetRot, dt) };
  }

  run_land(dt, v, sim) {
    const b = v.body;
    if (!b.hasSurface) { this.stop('Pas de surface ici !'); return null; }
    const talt = v.terrainAltitude(sim.ut) - (v.cy - v.lowestY());
    const up = [v.x, v.y];
    const r = Math.hypot(up[0], up[1]);
    up[0] /= r; up[1] /= r;
    const sv = v.surfaceVelocity();
    const vv = sv[0] * up[0] + sv[1] * up[1]; // vitesse verticale (+ = monte)
    const hx = sv[0] - vv * up[0], hy = sv[1] - vv * up[1];
    const hs = Math.hypot(hx, hy);
    const g = b.mu / (r * r);
    const acc = v.maxThrust(v.pressureNow) / v.mass;
    this.autoStage(v, dt);
    if (v.landed || v.splashed) { v.throttle = 0; this.stop('Posé !'); return { rot: 0 }; }
    if (acc <= g * 1.05) { this.status = 'Poussée insuffisante pour se poser'; }
    if (talt < Math.max(1500, -vv * 25)) v.gear = true;
    let dir;
    const spd = Math.hypot(sv[0], sv[1]);
    // direction : rétrograde surface, redressée près du sol
    if (spd > 1) dir = [-sv[0] / spd, -sv[1] / spd];
    else dir = up;
    if (talt < 60 || spd < 12) {
      // corrige la vitesse horizontale tout en restant proche de la verticale
      const k = clamp(hs / 8, 0, 0.35);
      dir = [up[0] - (hx / (hs || 1)) * k, up[1] - (hy / (hs || 1)) * k];
      const l = Math.hypot(dir[0], dir[1]);
      dir = [dir[0] / l, dir[1] / l];
    }
    // on ne pointe jamais vers le sol
    if (dir[0] * up[0] + dir[1] * up[1] < 0.05) {
      dir = [dir[0] + up[0] * 0.2, dir[1] + up[1] * 0.2];
    }
    let targetRot = rotFor(dir[0], dir[1]);
    // distance d'arrêt
    const cosT = Math.max(0.5, dir[0] * up[0] + dir[1] * up[1]);
    const aNet = Math.max(0.1, acc * 0.85 * cosT - g);
    const vDown = Math.max(0, -vv);
    const stopDist = (vDown * vDown) / (2 * aNet);
    // cible au sol (balise du défi, zone d'atterrissage) : guidage de précision
    let tgtDist = null;
    const site = this.f.markerSite;
    if (site && site.body === b.id) {
      const lonV = Math.atan2(v.y, v.x) - b.rotationAt(sim.ut);
      const d = wrapPi(site.lon - lonV) * b.radius; // > 0 : la cible est à l'est
      if (Math.abs(d) < 600000) tgtDist = d;
    }
    const ex = -up[1], ey = up[0];
    const vhE = sv[0] * ex + sv[1] * ey;
    let throttle = 0;
    if (this.phase === 'init') this.phase = 'wait';
    if (this.phase === 'wait') {
      this.status = `Descente · allumage à ${(stopDist * 1.2 + 40).toFixed(0)} m (alt. ${talt.toFixed(0)} m)`;
      if (hs > 30 && talt > 3000 && b.atmosphere == null) {
        // sans cible : on annule tout de suite la vitesse horizontale ;
        // avec cible : on attend que la distance de freinage l'atteigne
        const aBr = Math.max(0.2, acc * 0.6);
        const sStop = (hs * hs) / (2 * aBr) + hs * 3;
        if (tgtDist != null && Math.sign(tgtDist) === Math.sign(vhE) && Math.abs(tgtDist) > sStop) {
          this.status = `Approche de la cible · freinage dans ${((Math.abs(tgtDist) - sStop) / 1000).toFixed(1)} km`;
          if (sim.warpIdx > 0 && (Math.abs(tgtDist) - sStop) / hs < 60) sim.setWarp(0);
        } else { throttle = tgtDist != null ? 1 : 0.6; this.status = 'Annulation de la vitesse horizontale'; }
      }
      if (talt < stopDist * 1.2 + 40 + vDown * 0.6) this.phase = 'burn';
      if (sim.warpIdx > 0 && talt < stopDist * 3 + 2000) sim.setWarp(0);
    }
    if (this.phase === 'burn') {
      // vitesse verticale visée selon l'altitude
      const h = Math.max(0, talt - 1.5);
      const targetV = -Math.max(1.2, Math.min(Math.sqrt(2 * aNet * 0.6 * h), 1.5 + h * 0.4));
      const err = targetV - vv; // > 0 : on tombe trop vite
      let need = (g + err * 2.4) / Math.max(0.1, acc) / Math.max(0.3, dir[0] * up[0] + dir[1] * up[1]);
      if (tgtDist != null && Math.abs(tgtDist) < 3000 + talt) {
        // accélération voulue = verticale (profil) + horizontale (vers la cible)
        const tgo = (2 * talt) / Math.max(3, -vv) + 1;
        const vCap = clamp(talt * 0.12, 1.5, 70);
        const vDes = clamp(tgtDist / tgo, -vCap, vCap);
        const aV = Math.max(0.2, g + err * 2.4);
        const hl = aV * (talt < 30 ? 0.4 : 0.7);
        const aH = clamp((vDes - vhE) * 1.5, -hl, hl);
        const l = Math.hypot(aV, aH);
        dir = [(up[0] * aV + ex * aH) / l, (up[1] * aV + ey * aH) / l];
        need = l / Math.max(0.1, acc);
        targetRot = rotFor(dir[0], dir[1]);
      }
      throttle = clamp(need, 0, 1);
      // moteurs à poussée minimale élevée : on coupe plutôt que de remonter
      let minThr = 0;
      for (const p of v.parts) if (p.engOn && p.def.engine && !p.def.engine.solid) minThr = Math.max(minThr, p.def.engine.minThrottle || 0);
      if (throttle < minThr * 0.5) throttle = 0;
      this.status = `Atterrissage · ${(-vv).toFixed(1)} m/s · ${talt.toFixed(0)} m` + (tgtDist != null ? ` · cible ${Math.abs(tgtDist).toFixed(0)} m` : '');
    }
    v.throttle = throttle;
    return { rot: steerTo(v, targetRot, dt) };
  }
}
