// Vaisseau en vol : corps rigide 2D (plan de l'écliptique), pièces,
// ressources, moteurs, aérodynamique, échauffement, contact avec le sol.

import { PART_BY_ID, GLOBAL_RES } from '../parts/catalog.js';
import { Craft, fuelGroups, ispAt, localBox, fairingContents, initialRes } from '../craft/craft.js';
import { legFoot } from '../parts/legs.js';
import { Orbit } from '../core/orbit.js';
import { G0, wrapPi, clamp } from '../core/math.js';

let VID = 1;
const SIGMA = 5.67e-8;
const HEAT_K = 1.74e-4 * 75; // flux de Sutton-Graves amplifié (monde réduit)

export class Vessel {
  constructor(sys) {
    this.sys = sys;
    this.id = 'v' + Date.now().toString(36) + (VID++);
    this.name = 'Vaisseau';
    this.parts = [];
    this.byUid = new Map();
    this.adj = new Map();
    this.stages = [];
    this.stageIdx = 0;
    this.body = sys.home;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.rot = 0; this.av = 0;
    this.mass = 1; this.cx = 0; this.cy = 0; this.inertia = 1;
    this.throttle = 0;
    this.ctrl = { rot: 0, tx: 0, ty: 0 };
    this.sas = 'off'; // off | stab | pro | retro | radout | radin | normal | target | node | surfretro | up
    this.rcsOn = false;
    this.lights = false;
    this.gear = false;
    this.brakes = false;
    this.clamped = false;
    this.clampTimer = 0;
    this.landed = false;
    this.splashed = false;
    this.landedTimer = 0;
    this.onRails = false;
    this.orbit = null;
    this.events = [];
    this.debris = false;
    this.dead = false;
    this.met0 = 0; // instant du lancement
    this.launched = false;
    this.electronicsDead = false;
    this.frozen = false;
    this.hazardTimers = {};
    this.stats = { maxAlt: 0, maxSpeed: 0, maxG: 0 };
    this.lastAccel = 0;
    this.gforce = 0;
    this.heatFlux = 0;
    this.pressureNow = 0;
    this.maxTempFrac = 0;
    this.ecGen = 0;
    this.ecUse = 0;
  }

  // ------------------------------------------------------------------------
  static fromCraft(craftJSON, sys) {
    const c = Craft.fromJSON(craftJSON);
    c.layout();
    const v = new Vessel(sys);
    v.name = c.name;
    for (const p of c.parts) {
      const vp = makePart(p);
      if (vp.def.fairing) vp.fairingContents = fairingContents(p, c.parts)?.contents || null;
      v.addPart(vp);
    }
    for (const p of c.parts) if (p.parent != null) v.link(p.parent, p.uid, p.attach.type);
    v.stages = c.computeStages();
    v.stageIdx = 0;
    v.craftJSON = craftJSON;
    v.structureChanged();
    return v;
  }

  addPart(p) {
    this.parts.push(p);
    this.byUid.set(p.uid, p);
    if (!this.adj.has(p.uid)) this.adj.set(p.uid, []);
  }

  link(a, b, type) {
    if (!this.adj.has(a)) this.adj.set(a, []);
    if (!this.adj.has(b)) this.adj.set(b, []);
    this.adj.get(a).push(b);
    this.adj.get(b).push(a);
    const pb = this.byUid.get(b);
    if (pb) { pb.parent = a; pb.attachType = type; }
  }

  unlink(a, b) {
    const la = this.adj.get(a), lb = this.adj.get(b);
    if (la) { const i = la.indexOf(b); if (i >= 0) la.splice(i, 1); }
    if (lb) { const i = lb.indexOf(a); if (i >= 0) lb.splice(i, 1); }
  }

  get alive() {
    return this.parts;
  }

  get controlPart() {
    let best = null, score = -1;
    for (const p of this.parts) {
      if (!p.def.command) continue;
      const s = p.def.command.crew > 0 ? 2 : 1;
      if (s > score) { score = s; best = p; }
    }
    return best;
  }

  get crewed() {
    const c = this.controlPart;
    return !!(c && c.def.command.crew > 0);
  }

  hasSpecial(k) {
    return this.parts.some((p) => p.def.special === k);
  }

  // ------------------------------------------------------------------------
  // Recalcul après changement de structure (séparation, destruction…)
  structureChanged() {
    this.groups = fuelGroups(this.parts.map((p) => ({ uid: p.uid, id: p.id, parent: this.byUid.has(p.parent) ? p.parent : null })));
    // Colonnes d'empilement : exposition au flux d'air
    const cols = new Map();
    for (const p of this.parts) {
      p.exposedTop = false;
      p.exposedBottom = false;
      if (p.def.radial) continue;
      const k = Math.round(p.pos.x * 20) + ':' + Math.round(p.pos.z * 20);
      if (!cols.has(k)) cols.set(k, []);
      cols.get(k).push(p);
    }
    for (const list of cols.values()) {
      list.sort((a, b) => a.pos.y - b.pos.y);
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const above = list[i + 1];
        const below = list[i - 1];
        const r = Math.max(p.def.d, p.def.dTop ?? p.def.d);
        p.exposedTop = !above || Math.max(above.def.d, above.def.dTop ?? above.def.d) < r * 0.8;
        p.exposedBottom = !below || Math.max(below.def.d, below.def.dTop ?? below.def.d) < r * 0.8;
      }
    }
    // Coiffes : les pièces enveloppées sont protégées
    for (const p of this.parts) p.shielded = false;
    for (const f of this.parts) {
      if (!f.def.fairing || f.fairingDeployed || !f.fairingContents) continue;
      for (const uid of f.fairingContents) {
        const q = this.byUid.get(uid);
        if (q) { q.shielded = true; q.exposedTop = false; }
      }
      f.exposedTop = true;
    }
    // Points de contact
    this.contacts = [];
    for (const p of this.parts) {
      const d = p.def;
      if (d.legs) {
        this.contacts.push({ p, leg: true, lx: 0, ly: 0, inC: false });
        continue;
      }
      const b = localBox(d);
      const c = Math.cos(p.yaw || 0);
      let x0 = Infinity, x1 = -Infinity;
      for (const lx of [b[0], b[1]]) for (const lz of [b[4], b[5]]) {
        const wx = lx * c - lz * Math.sin(p.yaw || 0);
        x0 = Math.min(x0, wx); x1 = Math.max(x1, wx);
      }
      if (x1 - x0 < 0.05) { x0 -= 0.05; x1 += 0.05; }
      for (const lx of [x0, x1]) for (const ly of [b[2], b[3]]) this.contacts.push({ p, lx: p.pos.x + lx, ly: p.pos.y + ly, inC: false });
    }
    this.computeMass();
    this.radius = 1;
    for (const p of this.parts) {
      const dx = p.pos.x - this.cx, dy = p.pos.y - this.cy;
      this.radius = Math.max(this.radius, Math.hypot(dx, dy) + Math.max(p.def.d, p.def.h) / 2);
    }
    this.dirty = true;
  }

  computeMass() {
    let m = 0, mx = 0, my = 0;
    for (const p of this.parts) {
      let pm = p.def.mass;
      for (const k in p.res) if (k !== 'ec') pm += p.res[k];
      p.m = pm;
      m += pm;
      mx += pm * p.pos.x;
      my += pm * p.pos.y;
    }
    m = Math.max(m, 1);
    const ncx = mx / m, ncy = my / m;
    // la position (centre de masse) suit le déplacement du centre de masse
    if (this.mass > 1 && (Math.abs(ncx - this.cx) > 1e-6 || Math.abs(ncy - this.cy) > 1e-6)) {
      const dx = ncx - this.cx, dy = ncy - this.cy;
      const c = Math.cos(this.rot), s = Math.sin(this.rot);
      this.x += dx * c - dy * s;
      this.y += dx * s + dy * c;
    }
    this.mass = m;
    this.cx = ncx;
    this.cy = ncy;
    let I = 0;
    for (const p of this.parts) {
      const dx = p.pos.x - ncx, dy = p.pos.y - ncy;
      I += p.m * (dx * dx + dy * dy) + (p.m * (p.def.h * p.def.h + p.def.d * p.def.d)) / 12;
    }
    this.inertia = Math.max(I, 1);
  }

  // Position d'un point du repère fusée par rapport au centre du corps
  toWorld(px, py, out = [0, 0]) {
    const dx = px - this.cx, dy = py - this.cy;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    out[0] = this.x + dx * c - dy * s;
    out[1] = this.y + dx * s + dy * c;
    return out;
  }

  // Point le plus bas (repère fusée), jambes comprises
  lowestY() {
    let m = Infinity;
    for (const c of this.contacts || []) {
      let y = c.ly;
      if (c.leg) y = c.p.pos.y + legFoot(c.p.def, c.p.deploy || 0)[1];
      m = Math.min(m, y);
    }
    return isFinite(m) ? m : this.cy;
  }

  get axis() {
    return [-Math.sin(this.rot), Math.cos(this.rot)];
  }

  get altitude() {
    return Math.hypot(this.x, this.y) - this.body.radius;
  }

  // Altitude au-dessus du relief (approximée au centre de masse)
  terrainAltitude(ut) {
    const b = this.body;
    if (!b.hasSurface) return this.altitude;
    const lon = Math.atan2(this.y, this.x) - b.rotationAt(ut);
    const g = b.ground.atLon(lon);
    return Math.hypot(this.x, this.y) - b.radius - (b.ground.hasLiquid ? Math.max(0, g) : g);
  }

  // Vitesse par rapport à l'air / la surface (atmosphère co-rotative)
  surfaceVelocity() {
    const w = this.body.angularVelocity();
    return [this.vx + w * this.y, this.vy - w * this.x];
  }

  // ------------------------------------------------------------------------
  // Ressources
  totalRes(k) {
    let s = 0;
    for (const p of this.parts) if (p.res[k] != null) s += p.res[k];
    return s;
  }
  totalCap(k) {
    let s = 0;
    for (const p of this.parts) if (p.cap[k] != null) s += p.cap[k];
    return s;
  }
  drainGlobal(k, amt) {
    if (amt <= 0) return 0;
    const tanks = this.parts.filter((p) => p.res[k] > 0);
    const tot = tanks.reduce((s, p) => s + p.res[k], 0);
    if (tot <= 0) return 0;
    const f = Math.min(1, amt / tot);
    for (const p of tanks) p.res[k] -= p.res[k] * f;
    return tot * f;
  }
  addGlobal(k, amt) {
    const tanks = this.parts.filter((p) => p.cap[k] != null);
    let left = amt;
    for (const p of tanks) {
      const room = p.cap[k] - p.res[k];
      const a = Math.min(room, left);
      p.res[k] += a;
      left -= a;
      if (left <= 0) break;
    }
  }

  // Carburant disponible pour un moteur
  fuelFor(e) {
    const d = e.def.engine;
    if (d.solid) return e.res.solid || 0;
    if (GLOBAL_RES.has(d.prop)) return this.totalRes(d.prop);
    let s = 0;
    for (const t of this.groups.get(e.uid) || []) { const q = this.byUid.get(t); if (q) s += q.res[d.prop] || 0; }
    return s;
  }

  drainFor(e, amt) {
    const d = e.def.engine;
    if (d.solid) { const a = Math.min(amt, e.res.solid || 0); e.res.solid -= a; return a; }
    if (GLOBAL_RES.has(d.prop)) return this.drainGlobal(d.prop, amt);
    const tanks = (this.groups.get(e.uid) || []).map((u) => this.byUid.get(u)).filter((q) => q && q.res[d.prop] > 0);
    const tot = tanks.reduce((s, q) => s + q.res[d.prop], 0);
    if (tot <= 0) return 0;
    const f = Math.min(1, amt / tot);
    for (const q of tanks) q.res[d.prop] -= q.res[d.prop] * f;
    return tot * f;
  }

  // Δv restant de l'étage actuel (moteurs actifs) et estimation totale
  stageDeltaV(pressure = 0) {
    const eng = this.parts.filter((p) => p.def.engine && p.engOn && !p.def.engine.escape);
    if (!eng.length) return 0;
    let F = 0, mdot = 0, fuelMass = 0;
    const seen = new Set();
    for (const e of eng) {
      const d = e.def.engine;
      if (this.fuelFor(e) <= 0) continue;
      F += d.thrust * ispAt(d, pressure) / d.ispVac;
      mdot += d.thrust / (d.ispVac * G0);
      const tanks = d.solid ? [e.uid] : GLOBAL_RES.has(d.prop) ? this.parts.filter((p) => p.cap[d.prop] != null).map((p) => p.uid) : this.groups.get(e.uid) || [];
      for (const t of tanks) {
        const k = t + d.prop;
        if (seen.has(k)) continue;
        seen.add(k);
        fuelMass += this.byUid.get(t)?.res[d.prop] || 0;
      }
    }
    if (mdot <= 0) return 0;
    const isp = F / (mdot * G0);
    return isp * G0 * Math.log(this.mass / Math.max(1, this.mass - fuelMass));
  }

  maxThrust(pressure = 0) {
    let F = 0;
    for (const e of this.parts) {
      const d = e.def.engine;
      if (!d || !e.engOn || d.escape || this.fuelFor(e) <= 0) continue;
      F += (d.thrust * ispAt(d, pressure)) / d.ispVac;
    }
    return F;
  }

  // ------------------------------------------------------------------------
  // Déclenchement de l'étage suivant
  activateNextStage(ut) {
    if (this.stageIdx >= this.stages.length) return false;
    const stage = this.stages[this.stageIdx++];
    if (!this.launched) {
      this.launched = true;
      this.met0 = ut;
    }
    let any = false;
    const decouple = [];
    for (const uid of stage) {
      const p = this.byUid.get(uid);
      if (!p) continue;
      any = true;
      const d = p.def;
      if (d.engine) {
        p.engOn = true;
        p.flameout = false;
        this.events.push({ type: 'ignite', part: p });
        if (d.engine.escape) decouple.push(p);
      } else if (d.decoupler) {
        decouple.push(p);
      } else if (d.fairing) {
        this.deployFairing(p);
      } else if (d.chute) {
        if (p.chute === 'stowed') p.chute = 'armed';
      }
    }
    for (const p of decouple) this.fireDecoupler(p, ut);
    if (this.clamped) this.clampTimer = 0.01;
    this.events.push({ type: 'stage', index: this.stageIdx });
    return any;
  }

  deployFairing(p) {
    if (p.fairingDeployed) return;
    p.fairingDeployed = true;
    // une coiffe larguée automatiquement disparaît des étages à venir
    for (let i = this.stageIdx; i < this.stages.length; i++) this.stages[i] = this.stages[i].filter((u) => u !== p.uid);
    this.stages = this.stages.filter((st, i) => i < this.stageIdx || st.length);
    this.events.push({ type: 'fairing', part: p });
    this.structureChanged();
  }

  fireDecoupler(p, ut) {
    const d = p.def;
    // arête à couper
    let other = null;
    if (d.decoupler.radial) {
      other = p.attachType === 'side' ? p.parent : null;
    } else if (d.engine && d.engine.escape) {
      // tour de sauvetage : se détache de la pièce située sous elle
      other = (this.adj.get(p.uid) || []).find((u) => this.byUid.get(u) && this.byUid.get(u).pos.y < p.pos.y);
    } else {
      // découpleur : se sépare de la pièce située au-dessus
      other = (this.adj.get(p.uid) || []).find((u) => this.byUid.get(u) && this.byUid.get(u).pos.y > p.pos.y + 0.01);
    }
    this.events.push({ type: 'decouple', part: p });
    if (other == null || !this.byUid.has(other)) return;
    this.unlink(p.uid, other);
    const q = this.byUid.get(other);
    // direction de séparation (repère fusée, dans le plan)
    let sx = 0, sy = 1;
    if (d.decoupler.radial) {
      sx = Math.cos(p.yaw || 0);
      sy = 0;
      if (Math.abs(sx) < 0.2) sx = Math.sign(sx || 1) * 0.2;
    }
    if (q.pos.y > p.pos.y && !d.decoupler.radial) { sx = 0; sy = 1; }
    const impulse = (d.decoupler.force || 30000) * 0.12;
    this.split(ut, { sx, sy, impulse, sidePart: p.uid });
  }

  // Sépare le vaisseau en composantes connexes. Renvoie les nouveaux vaisseaux.
  split(ut, sep = null) {
    const seen = new Set();
    const comps = [];
    for (const p of this.parts) {
      if (seen.has(p.uid)) continue;
      const comp = [];
      const q = [p.uid];
      seen.add(p.uid);
      while (q.length) {
        const u = q.pop();
        comp.push(u);
        for (const n of this.adj.get(u) || []) if (!seen.has(n) && this.byUid.has(n)) { seen.add(n); q.push(n); }
      }
      comps.push(comp);
    }
    if (comps.length <= 1) { this.structureChanged(); return []; }
    // la composante qui garde le contrôle reste ce vaisseau
    const ctrl = this.controlPart;
    let keepIdx = 0;
    if (ctrl) keepIdx = comps.findIndex((c) => c.includes(ctrl.uid));
    else {
      let best = -1;
      comps.forEach((c, i) => { if (c.length > best) { best = c.length; keepIdx = i; } });
    }
    const oldCx = this.cx, oldCy = this.cy;
    const oldState = { x: this.x, y: this.y, vx: this.vx, vy: this.vy, rot: this.rot, av: this.av };
    const created = [];
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    comps.forEach((comp, i) => {
      if (i === keepIdx) return;
      const nv = new Vessel(this.sys);
      nv.body = this.body;
      const ids = new Set(comp);
      for (const u of comp) nv.addPart(this.byUid.get(u));
      for (const u of comp) nv.adj.set(u, (this.adj.get(u) || []).filter((n) => ids.has(n)));
      nv.stages = this.stages.slice(this.stageIdx).map((st) => st.filter((u) => ids.has(u))).filter((st) => st.length);
      nv.stageIdx = 0;
      nv.name = this.name + (nv.controlPart ? ' · étage' : ' · débris');
      nv.debris = !nv.controlPart;
      nv.launched = true;
      nv.met0 = this.met0;
      nv.throttle = 0;
      nv.mass = 2;
      nv.cx = oldCx; nv.cy = oldCy;
      nv.x = oldState.x; nv.y = oldState.y; nv.rot = oldState.rot; nv.av = oldState.av;
      nv.vx = oldState.vx; nv.vy = oldState.vy;
      nv.structureChanged(); // recale la position sur son centre de masse
      // vitesse du point (rotation)
      const dx = nv.cx - oldCx, dy = nv.cy - oldCy;
      const wx = dx * c - dy * s, wy = dx * s + dy * c;
      nv.vx += -this.av * wy;
      nv.vy += this.av * wx;
      for (const u of comp) { this.byUid.delete(u); this.adj.delete(u); }
      created.push(nv);
    });
    this.parts = this.parts.filter((p) => this.byUid.has(p.uid));
    for (const [u, l] of this.adj) this.adj.set(u, l.filter((n) => this.byUid.has(n)));
    this.stages = this.stages.map((st) => st.filter((u) => this.byUid.has(u)));
    this.structureChanged();
    // impulsion de séparation
    if (sep && created.length) {
      const wx = sep.sx * c - sep.sy * s, wy = sep.sx * s + sep.sy * c;
      for (const nv of created) {
        // le morceau largué part dans le sens opposé à la partie gardée
        const dx = nv.x - this.x, dy = nv.y - this.y;
        const sign = dx * wx + dy * wy >= 0 ? 1 : -1;
        const J = sep.impulse;
        nv.vx += (sign * wx * J) / nv.mass;
        nv.vy += (sign * wy * J) / nv.mass;
        this.vx -= (sign * wx * J) / this.mass;
        this.vy -= (sign * wy * J) / this.mass;
        nv.av += (Math.random() - 0.5) * 0.08;
      }
    }
    for (const nv of created) this.events.push({ type: 'newVessel', nv });
    return created;
  }

  destroyPart(p, ut, cause = 'crash') {
    if (!this.byUid.has(p.uid)) return;
    const pos = this.toWorld(p.pos.x, p.pos.y);
    this.events.push({ type: 'explode', part: p, x: pos[0], y: pos[1], size: Math.max(p.def.d, 0.5), cause });
    for (const n of (this.adj.get(p.uid) || []).slice()) this.unlink(p.uid, n);
    this.byUid.delete(p.uid);
    this.adj.delete(p.uid);
    this.parts = this.parts.filter((q) => q !== p);
    for (const st of this.stages) { const i = st.indexOf(p.uid); if (i >= 0) st.splice(i, 1); }
    if (!this.parts.length) {
      this.dead = true;
      this.events.push({ type: 'destroyed' });
      return;
    }
    this.split(ut);
  }

  // ------------------------------------------------------------------------
  // Pas de physique
  physicsStep(dt, ut, env) {
    const b = this.body;
    const r2 = this.x * this.x + this.y * this.y;
    const r = Math.sqrt(r2);
    let fx = 0, fy = 0, torque = 0;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    const ax = -s, ay = c; // axe de la fusée
    const alt = r - b.radius;
    const rho = b.density(alt);
    const pres = b.pressure(alt);
    const w = b.angularVelocity();
    const vsx = this.vx + w * this.y, vsy = this.vy - w * this.x; // vitesse / air
    const vs = Math.hypot(vsx, vsy);
    const q = 0.5 * rho * vs * vs;
    this.q = q;
    this.rho = rho;
    this.pressureNow = pres;
    this.airspeed = vs;
    this.mach = vs / b.speedOfSound();
    const ctrlOK = !this.electronicsDead && this.hasControl;
    const rotCmd = ctrlOK ? clamp(this.ctrl.rot, -1, 1) : 0;

    // -- Pinces du pas de tir
    if (this.clamped) {
      if (this.clampTimer > 0) {
        this.clampTimer += dt;
        const weight = this.mass * b.g;
        const thr = this.currentThrust(pres);
        if (thr > weight * 1.02 || this.clampTimer > 3) {
          this.clamped = false;
          this.events.push({ type: 'liftoff' });
        }
      }
      if (this.clamped) {
        this.holdOnGround(ut, dt);
        this.burnEngines(dt, pres, 0, true);
        return;
      }
    }

    // -- Moteurs
    const eng = this.burnEngines(dt, pres, rotCmd, false);
    fx += eng.fx; fy += eng.fy; torque += eng.t;

    // -- Couple des roues de réaction et des capsules
    let wheelT = 0, ecNeed = 0;
    if (ctrlOK && Math.abs(rotCmd) > 0.001) {
      for (const p of this.parts) {
        const t = p.def.wheel ? p.def.wheel.torque : p.def.command ? p.def.command.torque : 0;
        if (t) { wheelT += t; ecNeed += (t / 20000) * Math.abs(rotCmd) * dt; }
      }
      if (ecNeed > 0 && this.totalRes('ec') <= 0) wheelT = 0;
      else this.drainGlobal('ec', ecNeed);
      torque += wheelT * rotCmd;
    }
    // -- RCS
    if (this.rcsOn && ctrlOK) {
      const rcs = this.parts.filter((p) => p.def.rcs);
      if (rcs.length && this.totalRes('mono') > 0) {
        let used = 0;
        const tx = this.ctrl.tx, ty = this.ctrl.ty;
        for (const p of rcs) {
          const T = p.def.rcs.thrust;
          const lever = Math.abs(p.pos.y - this.cy) + 0.5;
          torque += T * lever * rotCmd;
          used += Math.abs(rotCmd) * T;
          if (tx || ty) {
            fx += (tx * c - ty * s) * T;
            fy += (tx * s + ty * c) * T;
            used += Math.hypot(tx, ty) * T;
          }
        }
        this.drainGlobal('mono', (used / (240 * G0)) * dt);
        this.rcsFiring = Math.abs(rotCmd) > 0.05 || tx || ty;
      }
    } else this.rcsFiring = false;

    // -- Aérodynamique
    if (q > 1e-4) {
      const aero = this.aero(q, vsx / vs, vsy / vs, ax, ay, rotCmd, ctrlOK);
      fx += aero.fx; fy += aero.fy; torque += aero.t;
      // amortissement de rotation dans l'air
      torque -= this.av * q * this.radius * this.radius * 0.02;
    }

    // -- Contact avec le sol
    let contact = null;
    if (alt < this.radius + 60 + (b.ground.amp || 0) * 1.3) contact = this.groundContacts(ut, dt);
    if (contact) { fx += contact.fx; fy += contact.fy; torque += contact.t; }

    // -- Intégration (Euler semi-implicite)
    const mu = b.mu;
    const gx = (-mu * this.x) / (r2 * r), gy = (-mu * this.y) / (r2 * r);
    const axT = fx / this.mass, ayT = fy / this.mass;
    this.nonGravAccel = Math.hypot(axT, ayT);
    this.vx += (gx + axT) * dt;
    this.vy += (gy + ayT) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.av += (torque / this.inertia) * dt;
    this.av = clamp(this.av, -6, 6);
    this.rot += this.av * dt;
  }

  get hasControl() {
    const ctrl = this.controlPart;
    if (!ctrl) return false;
    if (ctrl.def.command.probe && this.totalRes('ec') <= 0) return false;
    return true;
  }

  currentThrust(pres) {
    let F = 0;
    for (const p of this.parts) {
      const d = p.def.engine;
      if (!d || !p.engOn || p.flameout) continue;
      F += ((d.thrust * ispAt(d, pres)) / d.ispVac) * (p.thrustFrac || 0);
    }
    return F;
  }

  // Moteurs : consommation, poussée, orientation (cardan)
  burnEngines(dt, pres, rotCmd, holding) {
    let fx = 0, fy = 0, t = 0;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    let anyChange = false;
    for (const p of this.parts) {
      const d = p.def.engine;
      if (!d || !p.engOn) { p.thrustFrac = Math.max(0, (p.thrustFrac || 0) - dt * 4); continue; }
      let target;
      if (d.solid) target = 1;
      else target = this.throttle <= 0.001 ? 0 : Math.max(d.minThrottle || 0, this.throttle);
      if (p.engShut) target = 0;
      if (this.frozen && !d.solid) target = 0;
      if (d.ec) {
        if (this.totalRes('ec') <= 0.01) target = 0;
        else this.drainGlobal('ec', d.ec * target * dt);
      }
      const rate = d.solid ? 6 : 3.2;
      p.thrustFrac = (p.thrustFrac || 0) + clamp(target - (p.thrustFrac || 0), -rate * dt, rate * dt);
      if (p.thrustFrac <= 0.0005) { p.thrustFrac = 0; continue; }
      let frac = p.thrustFrac;
      // courbe de poussée des propulseurs à poudre
      if (d.solid) {
        const f = (p.res.solid || 0) / (p.cap.solid || 1);
        frac *= f > 0.15 ? 1 : 0.2 + (0.8 * f) / 0.15;
      }
      const mdot = (d.thrust / (d.ispVac * G0)) * frac;
      const got = this.drainFor(p, mdot * dt);
      if (got < mdot * dt * 0.98) {
        frac *= got / Math.max(1e-9, mdot * dt);
        if (!p.flameout && got <= 1e-9) {
          p.flameout = true;
          p.engOn = d.solid ? false : p.engOn;
          this.events.push({ type: 'flameout', part: p });
          anyChange = true;
        }
      } else if (p.flameout) p.flameout = false;
      if (d.ecGen) this.addGlobal('ec', d.ecGen * frac * dt);
      if (holding) continue;
      const F = ((d.thrust * ispAt(d, pres)) / d.ispVac) * frac;
      const dy = p.flip ? -1 : 1;
      const ex = p.pos.x - this.cx, ey = p.pos.y - this.cy;
      const gim = (d.gimbal || 0) * (Math.PI / 180);
      const delta = gim * rotCmd * Math.sign(ey * dy || 1);
      p.gimbalNow = delta;
      // direction locale (rotation de (0, dy) par delta)
      const lx = -dy * Math.sin(delta), ly = dy * Math.cos(delta);
      const wx = lx * c - ly * s, wy = lx * s + ly * c;
      fx += wx * F;
      fy += wy * F;
      t += (ex * ly - ey * lx) * F;
    }
    if (anyChange) this.dirty = true;
    return { fx, fy, t };
  }

  // Aérodynamique par pièce
  aero(q, vhx, vhy, ax, ay, rotCmd, ctrlOK) {
    let fx = 0, fy = 0, t = 0;
    const cosA = vhx * ax + vhy * ay;
    const px = vhx - cosA * ax, py = vhy - cosA * ay; // composante perpendiculaire
    const sinA = Math.hypot(px, py);
    const upx = sinA > 1e-6 ? px / sinA : 0, upy = sinA > 1e-6 ? py / sinA : 0;
    const M = this.mach;
    const trans = M < 6 ? 1 + 0.9 * Math.exp(-((M - 1.05) * (M - 1.05)) / 0.09) : 1;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    let ctrlTorque = 0;
    for (const p of this.parts) {
      if (p.shielded) continue;
      const d = p.def;
      let Fax = 0, Fperp = 0;
      if (d.radial) {
        // pièces radiales : petite traînée, ailerons portants
        if (d.fin) {
          const alpha = Math.atan2(sinA, Math.abs(cosA));
          const cn = 1.8 * Math.sin(2 * Math.min(alpha, 0.6)) * (alpha > 0.6 ? Math.max(0.3, 1 - (alpha - 0.6)) : 1);
          Fperp += q * d.fin.area * cn * 0.5;
          Fax += q * d.fin.area * 0.03 * cosA;
          if (d.fin.control && ctrlOK) ctrlTorque += q * d.fin.area * d.fin.control * 0.5 * (Math.abs(p.pos.y - this.cy) + 1);
          if (d.fin.grid) Fax += q * d.fin.area * 0.15 * cosA;
        } else if (d.airbrake) {
          if (this.brakes) Fax += q * d.airbrake.area * 1.2 * cosA + 0;
          Fperp += q * 0.1 * sinA;
        } else {
          Fax += q * d.d * d.d * 0.3 * cosA * Math.abs(cosA);
          Fperp += q * d.d * d.h * 0.3 * sinA * sinA;
        }
      } else {
        const R = Math.max(d.d, d.dTop ?? d.d) / 2;
        const A = Math.PI * R * R;
        let cd = 0;
        if (cosA > 0 && p.exposedTop) cd = d.fairing && !p.fairingDeployed ? 0.18 : d.cdTop ?? (d.shape === 'nose' ? 0.12 : 0.75);
        if (cosA < 0 && p.exposedBottom) cd = d.cdBottom ?? (d.engine ? 0.55 : 0.75);
        Fax += q * cd * trans * A * cosA * Math.abs(cosA);
        Fperp += q * 0.9 * d.h * d.d * sinA * sinA;
        Fax += q * 0.004 * Math.PI * d.d * d.h * cosA; // frottement
      }
      // parachutes
      if (d.chute && (p.chute === 'semi' || p.chute === 'full')) {
        const k = p.chute === 'semi' ? 0.06 : 1;
        const cda = d.chute.cda * k * (p.chuteOpen ?? 1);
        const F = q * cda;
        const wx = p.pos.x - this.cx, wy = p.pos.y - this.cy;
        const ox = wx * c - wy * s, oy = wx * s + wy * c;
        fx -= vhx * F;
        fy -= vhy * F;
        t += ox * (-vhy * F) - oy * (-vhx * F);
        continue;
      }
      // forces monde
      const Fx = -ax * Fax - upx * Fperp;
      const Fy = -ay * Fax - upy * Fperp;
      fx += Fx;
      fy += Fy;
      const wx = p.pos.x - this.cx, wy = p.pos.y - this.cy;
      const ox = wx * c - wy * s, oy = wx * s + wy * c;
      t += ox * Fy - oy * Fx;
    }
    t += ctrlTorque * rotCmd;
    this.aeroCtrl = ctrlTorque;
    return { fx, fy, t };
  }

  // Maintien sur le pas de tir (co-rotation avec la planète)
  holdOnGround(ut, dt) {
    const b = this.body;
    const w = b.angularVelocity();
    const lon = this.padLon + b.rotationAt(ut);
    const R = b.radius + this.padAlt;
    this.x = Math.cos(lon) * R;
    this.y = Math.sin(lon) * R;
    this.vx = -w * this.y;
    this.vy = w * this.x;
    this.rot = lon - Math.PI / 2 + (this.padRot || 0);
    this.av = w;
    void dt;
  }

  // Place le vaisseau posé sur le sol à une longitude (repère du corps)
  placeOnSurface(body, lon, ut, clamp = true, extra = 0) {
    this.body = body;
    this.computeMass();
    let minY = Infinity;
    for (const cpt of this.contacts) {
      const y = cpt.leg ? cpt.p.pos.y - cpt.p.def.h / 2 : cpt.ly;
      minY = Math.min(minY, y);
    }
    const g = body.ground.atLon(lon);
    const h = body.ground.hasLiquid ? Math.max(g, 0) : g;
    this.padLon = lon;
    this.padAlt = h + (this.cy - minY) + 0.02 + extra;
    this.padRot = 0;
    this.clamped = clamp;
    this.holdOnGround(ut, 0);
    this.landed = !clamp;
  }

  // Contacts avec le sol (ressorts amortis par point)
  groundContacts(ut, dt) {
    const b = this.body;
    if (!b.hasSurface) return null;
    const rotB = b.rotationAt(ut);
    const w = b.angularVelocity();
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    let fx = 0, fy = 0, t = 0, n = 0, liquid = false;
    const nPts = Math.max(4, this.contacts.length);
    const kBase = (this.mass * 900) / Math.min(nPts, 12);
    const cBase = 2 * 0.6 * Math.sqrt(kBase * (this.mass / Math.min(nPts, 12)));
    let crashed = null;
    for (const cp of this.contacts) {
      const p = cp.p;
      if (!this.byUid.has(p.uid)) continue;
      let lx = cp.lx, ly = cp.ly;
      let k = kBase, cd = cBase, leg = false;
      if (cp.leg) {
        const def = p.def;
        const foot = legFoot(def, p.deploy || 0);
        const yw = p.yaw || 0;
        lx = p.pos.x + Math.cos(yw) * foot[0];
        ly = p.pos.y + foot[1];
        if ((p.deploy || 0) > 0.8) { k = kBase * 0.45; cd = cBase * 1.3; leg = true; }
      }
      const dx = lx - this.cx, dy = ly - this.cy;
      const wx = this.x + dx * c - dy * s;
      const wy = this.y + dx * s + dy * c;
      const rr = Math.hypot(wx, wy);
      const lon = Math.atan2(wy, wx) - rotB;
      const nxr = wx / rr, nyr = wy / rr;
      let gh = b.ground.atLon(lon);
      let isLiq = false;
      if (b.ground.hasLiquid && gh <= 0.5 && b.ground.isLiquid(Math.cos(lon), Math.sin(lon), 0)) { isLiq = true; gh = 0; }
      const pen = b.radius + gh - rr;
      if (pen <= 0) { cp.inC = false; continue; }
      // normale du relief (pente)
      let nx = nxr, ny = nyr;
      if (!isLiq) {
        const eps = 2 / b.radius;
        const g1 = b.ground.atLon(lon + eps), g0 = b.ground.atLon(lon - eps);
        const slope = (g1 - g0) / 4;
        const tx = -nyr, ty = nxr;
        nx = nxr - tx * slope;
        ny = nyr - ty * slope;
        const l = Math.hypot(nx, ny);
        nx /= l; ny /= l;
      }
      // vitesse du point par rapport au sol
      const ox = wx - this.x, oy = wy - this.y;
      const pvx = this.vx - this.av * oy + w * wy;
      const pvy = this.vy + this.av * ox - w * wx;
      const vn = pvx * nx + pvy * ny;
      const tvx = pvx - vn * nx, tvy = pvy - vn * ny;
      // impact
      if (!cp.inC) {
        const tol = p.def.crash * (isLiq ? 1.6 : 1) * (leg ? 1 : 1);
        if (-vn > tol && !this.clamped) crashed = crashed && crashed.v > -vn ? crashed : { p, v: -vn };
        if (-vn > 2) this.events.push({ type: 'touch', v: -vn, x: wx, y: wy, liquid: isLiq, leg });
        if (!this.landed && -vn > 0.3) this.lastImpact = -vn;
      }
      cp.inC = true;
      n++;
      if (isLiq) { liquid = true; k *= 0.25; cd *= 2; }
      let Fn = k * Math.min(pen, 3) - cd * vn;
      if (Fn < 0) Fn = 0;
      // frottement
      const tv = Math.hypot(tvx, tvy);
      let Ft = 0;
      const mu = isLiq ? 0.05 : leg ? 0.9 : 0.6;
      if (tv > 1e-4) Ft = Math.min(mu * Fn, (this.mass / Math.min(nPts, 12)) * tv / Math.max(dt, 1e-3) * 0.5);
      const Fx = nx * Fn - (tv > 1e-4 ? (tvx / tv) * Ft : 0);
      const Fy = ny * Fn - (tv > 1e-4 ? (tvy / tv) * Ft : 0);
      fx += Fx;
      fy += Fy;
      t += ox * Fy - oy * Fx;
    }
    this.inContact = n > 0;
    this.splashed = liquid && n > 0;
    if (crashed) {
      this.pendingCrash = crashed;
    }
    return n ? { fx, fy, t } : null;
  }

  // ------------------------------------------------------------------------
  // Mises à jour lentes (une fois par image) : chaleur, énergie, parachutes,
  // déploiements, dangers des astres
  frameUpdate(dt, ut, sys) {
    const b = this.body;
    const alt = this.altitude;
    const rho = b.density(alt);
    const vs = this.airspeed || 0;
    // Chaleur de rentrée
    const machK = clamp(((this.mach || 0) - 2.2) / 3.5, 0, 1);
    const flux = rho > 0 ? HEAT_K * Math.sqrt(rho) * vs * vs * vs * Math.pow(machK, 1.5) : 0;
    this.heatFlux = flux;
    const [axx, ayy] = this.axis;
    const sv = this.surfaceVelocity();
    const sl = Math.hypot(sv[0], sv[1]) || 1;
    const cosA = (sv[0] * axx + sv[1] * ayy) / sl;
    const tAmb = b.atmosphere && rho > 0 ? b.atmosphere.temp : 260;
    // flux solaire (danger près du Soleil)
    const sunState = sys.sun.state(ut);
    const bs = b.state(ut);
    const sunFlux = sys.solarFlux(bs.x + this.x - sunState.x, bs.y + this.y - sunState.y);
    this.sunFlux = sunFlux;
    const solarShield = this.hasSpecial('solar');
    let maxFrac = 0;
    for (const p of this.parts.slice()) {
      const d = p.def;
      const A = Math.PI * Math.pow(Math.max(d.d, d.dTop ?? d.d) / 2, 2);
      let expo = 0;
      if (!p.shielded) {
        if (d.radial) expo = 0.12 * Math.sqrt(1 - cosA * cosA) + 0.05;
        else if (cosA > 0 && p.exposedTop) expo = cosA;
        else if (cosA < 0 && p.exposedBottom) expo = -cosA;
        else expo = 0.08 * Math.sqrt(Math.max(0, 1 - cosA * cosA));
      }
      let qin = flux * A * expo;
      if (sunFlux > 3.5 && !solarShield) qin += (sunFlux - 3.5) * 900 * A;
      if (sunFlux > 60) qin += (sunFlux - 60) * 2500 * A;
      const mth = Math.max(40, p.m || d.mass) * 900;
      const Asurf = Math.PI * d.d * Math.max(d.h, 0.3) + A;
      const qout = SIGMA * 0.8 * Asurf * (Math.pow(p.temp, 4) - Math.pow(tAmb, 4));
      p.temp += ((qin - qout) / mth) * dt;
      p.temp += (tAmb - p.temp) * (rho > 0 ? Math.min(1, rho * 0.02) : 0) * dt * 0.1;
      if (d.heatShield && p.temp > 1650 && p.res.ablator > 0) {
        const excess = (p.temp - 1650) * mth;
        const burn = Math.min(p.res.ablator, excess / 8e5);
        p.res.ablator -= burn;
        p.temp = 1650 + (excess - burn * 8e5) / mth;
      }
      p.temp = Math.max(3, p.temp);
      maxFrac = Math.max(maxFrac, p.temp / d.maxTemp);
      if (p.temp > d.maxTemp) {
        this.destroyPart(p, ut, 'heat');
        if (this.dead) return;
      }
    }
    this.maxTempFrac = maxFrac;
    this.reentryGlow = flux > 2.5e5 ? Math.min(1, (flux - 2.5e5) / 1.8e6) : 0;

    // Énergie : panneaux, RTG, consommation de base
    let gen = 0, use = 0;
    const inShadow = this.inShadow(ut, sys);
    for (const p of this.parts) {
      const d = p.def;
      if (d.solar) {
        const dep = d.solar.deploy ? p.deploy || 0 : 1;
        if (!inShadow) gen += d.solar.power * dep * Math.min(sunFlux, 4) * 0.7;
      }
      if (d.rtg) gen += d.rtg.power;
      if (d.command) use += d.command.ec;
      if (d.lamp && this.lights) use += d.lamp.ec;
    }
    this.ecGen = gen;
    this.ecUse = use;
    this.addGlobal('ec', gen * dt);
    this.drainGlobal('ec', use * dt);

    // Parachutes
    for (const p of this.parts) {
      const d = p.def;
      if (!d.chute) continue;
      if (p.chute === 'armed') {
        if (rho > 0.0004 && vs < d.chute.maxSpeed) {
          p.chute = d.chute.drogue ? 'full' : 'semi';
          p.chuteOpen = 0;
          this.events.push({ type: 'chute', part: p });
        }
      } else if (p.chute === 'semi') {
        // ouverture « rifée » : la voilure ne s'ouvre que si la décélération reste supportable
        const o2 = Math.min(1, (p.chuteOpen || 0) + dt * 0.8);
        if (o2 < 0.03 || (this.q * d.chute.cda * 0.06 * o2) / this.mass < 4.5 * 9.81) p.chuteOpen = o2;
        const talt = this.terrainAlt ?? alt;
        if (talt < 1000) { p.chute = 'full'; p.chuteOpen = 0; this.events.push({ type: 'chuteFull', part: p }); }
      } else if (p.chute === 'full') {
        const o2 = Math.min(1, (p.chuteOpen || 0) + dt * 0.5);
        if (o2 < 0.05 || (this.q * d.chute.cda * o2) / this.mass < 5 * 9.81) p.chuteOpen = o2;
        const load = this.q * d.chute.cda * (p.chuteOpen || 0);
        if (load > this.mass * 9.81 * 9 + 60000 && vs > d.chute.maxSpeed * 0.9) {
          p.chute = 'torn';
          this.events.push({ type: 'chuteTorn', part: p });
        }
        if (this.landed || this.splashed) {
          p.cutTimer = (p.cutTimer || 0) + dt;
          if (p.cutTimer > 3) { p.chute = 'cut'; this.events.push({ type: 'chuteCut', part: p }); }
        }
      }
    }

    // Déploiements animés
    for (const p of this.parts) {
      const d = p.def;
      let target = p.deployTarget ?? 0;
      if (d.legs) target = this.gear ? 1 : 0;
      if (d.airbrake) target = this.brakes ? 1 : 0;
      if (d.fin && d.fin.grid) target = 1;
      const speed = d.legs ? 0.6 : 0.4;
      p.deploy = (p.deploy || 0) + clamp(target - (p.deploy || 0), -speed * dt, speed * dt);
      // panneaux arrachés dans l'air dense
      if (d.solar && d.solar.deploy && p.deploy > 0.2 && this.q > 3000) this.destroyPart(p, ut, 'aero');
      if (this.dead) return;
    }

    // Dangers propres à chaque astre
    this.updateHazards(dt, ut, sys);

    // Statistiques
    this.stats.maxAlt = Math.max(this.stats.maxAlt, alt);
    // accéléromètre lissé (≈ 0,25 s) : les chocs brefs au contact du sol ne
    // comptent pas comme une accélération soutenue
    const gRaw = (this.nonGravAccel || 0) / G0;
    this.gforce += (gRaw - this.gforce) * Math.min(1, dt / 0.25);
    if (this.launched && !this.inContact) this.stats.maxG = Math.max(this.stats.maxG, this.gforce);
    if (this.pendingCrash) {
      const pc = this.pendingCrash;
      this.pendingCrash = null;
      if (this.byUid.has(pc.p.uid)) this.destroyPart(pc.p, ut, 'crash');
    }
    if (this.dirty) { this.dirty = false; }
  }

  inShadow(ut, sys) {
    const b = this.body;
    if (b === sys.sun) return false;
    const bs = b.state(ut), ss = sys.sun.state(ut);
    let sx = ss.x - bs.x, sy = ss.y - bs.y;
    const l = Math.hypot(sx, sy);
    sx /= l; sy /= l;
    const along = this.x * sx + this.y * sy;
    if (along > 0) return false;
    const perp = Math.abs(this.x * sy - this.y * sx);
    return perp < b.radius;
  }

  updateHazards(dt, ut, sys) {
    const b = this.body;
    const H = this.hazardTimers;
    const alerts = [];
    const alt = this.altitude;
    // Radiations de Jupiter
    let rad = false;
    for (let o = b; o; o = o.parentBody) {
      if (o.hazards.radiation) {
        const os = o.state(ut), vs = b.state(ut);
        const d = Math.hypot(vs.x + this.x - os.x, vs.y + this.y - os.y);
        if (d < o.hazards.radiation) rad = true;
      }
    }
    if (rad && !this.hasSpecial('radiation') && !this.electronicsDead) {
      H.rad = (H.rad || 0) + dt;
      const left = 25 - H.rad;
      alerts.push({ kind: 'bad', text: `RADIATIONS INTENSES — électronique détruite dans ${Math.max(0, left).toFixed(0)} s (blindage requis)` });
      if (left <= 0) { this.electronicsDead = true; this.events.push({ type: 'hazard', text: 'Les radiations ont grillé l\'électronique de bord.' }); }
    } else if (!rad) H.rad = Math.max(0, (H.rad || 0) - dt * 2);
    // Pression écrasante (Vénus)
    if (b.hazards.pressure && this.pressureNow > b.hazards.pressure && !this.hasSpecial('pressure')) {
      H.press = (H.press || 0) + dt;
      alerts.push({ kind: 'bad', text: `PRESSION ${this.pressureNow.toFixed(0)} atm — la coque cède (coque pressurisée requise)` });
      if (H.press > 2) {
        H.press = 0;
        const victim = this.parts[Math.floor(Math.random() * this.parts.length)];
        if (victim) this.destroyPart(victim, ut, 'pressure');
      }
    }
    // Géantes gazeuses
    if (b.hazards.gas && alt < 0) {
      alerts.push({ kind: 'bad', text: 'ÉCRASÉ PAR LA PRESSION DE LA GÉANTE GAZEUSE' });
      for (const p of this.parts.slice()) this.destroyPart(p, ut, 'pressure');
      return;
    }
    if (b.hazards.gas && alt < b.atmosphere.height * 0.25) alerts.push({ kind: 'warn', text: 'Pression croissante : aucune surface solide sous les nuages !' });
    // Froid extrême
    if (b.hazards.cryo && !this.hasSpecial('cryo')) {
      const low = this.landed || this.splashed || this.inContact || (alt < 8000 && b.hasSurface);
      if (low) {
        H.cold = (H.cold || 0) + dt;
        const left = 10 - H.cold;
        if (!this.frozen) alerts.push({ kind: 'bad', text: `FROID EXTRÊME — systèmes gelés dans ${Math.max(0, left).toFixed(0)} s (isolation cryogénique requise)` });
        if (left <= 0 && !this.frozen) { this.frozen = true; this.electronicsDead = true; this.events.push({ type: 'hazard', text: 'Le froid a gelé les réservoirs et l\'électronique.' }); }
      }
    }
    // Soleil
    if (this.sunFlux > 3.5 && !this.hasSpecial('solar')) alerts.push({ kind: 'bad', text: `RAYONNEMENT SOLAIRE ×${this.sunFlux.toFixed(1)} — surchauffe (bouclier solaire requis)` });
    if (b.type === 'star' && alt < b.radius * 0.5) {
      for (const p of this.parts.slice()) this.destroyPart(p, ut, 'heat');
      return;
    }
    if (this.electronicsDead) alerts.push({ kind: 'bad', text: this.frozen ? 'SYSTÈMES GELÉS — vaisseau incontrôlable' : 'ÉLECTRONIQUE HORS SERVICE — vaisseau incontrôlable' });
    this.alerts = alerts;
  }

  // ------------------------------------------------------------------------
  // Orbite courante (relative au corps)
  computeOrbit(ut) {
    return Orbit.fromState(this.x, this.y, this.vx, this.vy, this.body.mu, ut);
  }

  goOnRails(ut) {
    if (this.onRails) return;
    this.orbit = this.computeOrbit(ut);
    this.onRails = true;
  }

  goOffRails(ut) {
    if (!this.onRails) return;
    if (this.orbit && !this.landed) {
      const s = this.orbit.stateAt(ut);
      this.x = s.x; this.y = s.y; this.vx = s.vx; this.vy = s.vy;
    }
    this.onRails = false;
    this.orbit = null;
  }

  railsUpdate(ut) {
    if (this.landed || this.clamped) {
      this.holdLanded(ut);
      return;
    }
    const s = this.orbit.stateAt(ut);
    this.x = s.x; this.y = s.y; this.vx = s.vx; this.vy = s.vy;
  }

  // Posé : mémorise la position relative au sol pour la garder pendant l'accélération du temps
  captureLanded(ut) {
    const b = this.body;
    const lon = Math.atan2(this.y, this.x) - b.rotationAt(ut);
    this.padLon = lon;
    this.padAlt = Math.hypot(this.x, this.y) - b.radius;
    this.padRot = wrapPi(this.rot - (Math.atan2(this.y, this.x) - Math.PI / 2));
  }

  holdLanded(ut) {
    this.holdOnGround(ut, 0);
  }

  // Changement de sphère d'influence
  changeBody(nb, ut) {
    const ob = this.body;
    if (nb === ob) return;
    const os = ob.state(ut), ns = nb.state(ut);
    this.x += os.x - ns.x;
    this.y += os.y - ns.y;
    this.vx += os.vx - ns.vx;
    this.vy += os.vy - ns.vy;
    this.body = nb;
    if (this.onRails) this.orbit = this.computeOrbit(ut);
    this.events.push({ type: 'soi', from: ob, to: nb });
  }

  checkSOI(ut) {
    const b = this.body;
    const r = Math.hypot(this.x, this.y);
    if (b.parentBody && r > b.soi) { this.changeBody(b.parentBody, ut); return true; }
    for (const c of b.children) {
      const cs = c.localState(ut);
      const dx = this.x - cs.x, dy = this.y - cs.y;
      if (dx * dx + dy * dy < c.soi * c.soi) { this.changeBody(c, ut); return true; }
    }
    return false;
  }

  // Position absolue (héliocentrique)
  absPos(ut) {
    const s = this.body.state(ut);
    return [s.x + this.x, s.y + this.y];
  }

  // ------------------------------------------------------------------------
  // Sauvegarde
  toJSON(ut) {
    return {
      id: this.id,
      name: this.name,
      debris: this.debris,
      body: this.body.id,
      parts: this.parts.map((p) => ({ uid: p.uid, id: p.id, pos: p.pos, yaw: p.yaw, flip: p.flip, paint: p.paint, res: p.res, temp: p.temp, deploy: p.deploy || 0, chute: p.chute, fairingDeployed: !!p.fairingDeployed, fairingContents: p.fairingContents || null, engOn: !!p.engOn, parent: p.parent, attachType: p.attachType })),
      adj: [...this.adj.entries()],
      stages: this.stages,
      stageIdx: this.stageIdx,
      state: { x: this.x, y: this.y, vx: this.vx, vy: this.vy, rot: this.rot, av: this.av },
      landed: this.landed || this.splashed,
      padLon: this.padLon, padAlt: this.padAlt, padRot: this.padRot,
      met0: this.met0,
      launched: this.launched,
      ut,
      toggles: { gear: this.gear, lights: this.lights },
      electronicsDead: this.electronicsDead, frozen: this.frozen,
    };
  }

  static fromJSON(o, sys) {
    const v = new Vessel(sys);
    v.id = o.id;
    v.name = o.name;
    v.debris = o.debris;
    v.body = sys.get(o.body) || sys.home;
    for (const pj of o.parts) {
      const p = makePart({ uid: pj.uid, id: pj.id, pos: pj.pos, yaw: pj.yaw, flip: pj.flip, paint: pj.paint });
      p.res = { ...p.res, ...pj.res };
      p.temp = pj.temp || 290;
      p.deploy = pj.deploy || 0;
      p.chute = pj.chute || p.chute;
      p.fairingDeployed = pj.fairingDeployed;
      p.fairingContents = pj.fairingContents;
      p.engOn = pj.engOn;
      p.parent = pj.parent;
      p.attachType = pj.attachType;
      v.addPart(p);
    }
    v.adj = new Map(o.adj.map(([k, l]) => [k, l.slice()]));
    v.stages = o.stages;
    v.stageIdx = o.stageIdx;
    Object.assign(v, o.state);
    v.padLon = o.padLon; v.padAlt = o.padAlt; v.padRot = o.padRot;
    v.met0 = o.met0 || 0;
    v.launched = o.launched !== false;
    v.gear = o.toggles?.gear || false;
    v.lights = o.toggles?.lights || false;
    v.electronicsDead = !!o.electronicsDead;
    v.frozen = !!o.frozen;
    v.mass = 1;
    const st = { x: v.x, y: v.y };
    v.structureChanged();
    v.x = st.x; v.y = st.y;
    v.landed = !!o.landed;
    return v;
  }
}

// Instance de pièce en vol
export function makePart(p) {
  const def = PART_BY_ID[p.id];
  const res = {}, cap = {};
  if (def.res) {
    const init = p.res0 || initialRes(p);
    for (const k in def.res) { res[k] = init[k] ?? def.res[k]; cap[k] = def.res[k]; }
  }
  return {
    uid: p.uid, id: p.id, def,
    pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, yaw: p.yaw || 0, flip: !!p.flip, paint: p.paint || null,
    parent: p.parent ?? null, attachType: p.attach ? p.attach.type : null,
    res, cap, temp: 290, deploy: 0, deployTarget: def.solar && !def.solar.deploy ? 1 : def.antenna && !def.antenna.deploy ? 1 : 0,
    engOn: false, thrustFrac: 0, flameout: false, engShut: false,
    chute: def.chute ? 'stowed' : null, chuteOpen: 0,
    fairingDeployed: false, fairingContents: null,
    exposedTop: false, exposedBottom: false, shielded: false, m: def.mass,
  };
}
