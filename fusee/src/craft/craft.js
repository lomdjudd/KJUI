// Assemblage d'une fusée : arbre de pièces, placement, séparation en
// étages et calcul des performances (Δv, poussée/poids…).

import { PART_BY_ID, partRadiusAt, GLOBAL_RES } from '../parts/catalog.js';
import { G0 } from '../core/math.js';

let UID = 1;

export class Craft {
  constructor(name = 'Nouvelle fusée') {
    this.name = name;
    this.parts = [];
    this.symCounter = 1;
  }

  static fromJSON(o) {
    const c = new Craft(o.name);
    c.parts = (o.parts || []).filter((p) => PART_BY_ID[p.id]).map((p) => ({ ...p, attach: p.attach ? { ...p.attach } : null }));
    for (const p of c.parts) UID = Math.max(UID, p.uid + 1);
    c.symCounter = o.symCounter || 1;
    for (const p of c.parts) c.symCounter = Math.max(c.symCounter, (p.sym || 0) + 1);
    // Supprime les pièces orphelines
    const ids = new Set(c.parts.map((p) => p.uid));
    c.parts = c.parts.filter((p) => p.parent == null || ids.has(p.parent));
    c.layout();
    return c;
  }

  toJSON() {
    return {
      name: this.name,
      symCounter: this.symCounter,
      parts: this.parts.map((p) => ({ uid: p.uid, id: p.id, parent: p.parent, attach: p.attach, sym: p.sym || 0, flip: !!p.flip, paint: p.paint || null, stage: p.stage ?? null })),
    };
  }

  clone() {
    return Craft.fromJSON(JSON.parse(JSON.stringify(this.toJSON())));
  }

  get root() {
    return this.parts.find((p) => p.parent == null) || null;
  }

  byUid(uid) {
    return this.parts.find((p) => p.uid === uid);
  }

  childrenOf(p) {
    return this.parts.filter((c) => c.parent === p.uid);
  }

  def(p) {
    return PART_BY_ID[p.id];
  }

  addRoot(id) {
    const p = { uid: UID++, id, parent: null, attach: null, sym: 0, flip: false, paint: null, stage: null };
    this.parts.push(p);
    this.layout();
    return p;
  }

  // Ajoute une pièce ; attach = { type: 'top'|'bottom'|'side'|'out', y, psi }
  // Si le nœud visé est occupé, la nouvelle pièce s'intercale.
  add(id, parent, attach, opts = {}) {
    const p = { uid: UID++, id, parent: parent.uid, attach: { ...attach }, sym: opts.sym || 0, flip: !!opts.flip, paint: opts.paint || null, stage: null };
    if (attach.type === 'top' || attach.type === 'bottom') {
      const occ = this.childrenOf(parent).find((c) => c.attach.type === attach.type);
      if (occ) {
        occ.parent = p.uid;
      } else if (parent.attach && parent.parent != null && ((attach.type === 'top' && parent.attach.type === 'bottom') || (attach.type === 'bottom' && parent.attach.type === 'top'))) {
        // le nœud est relié au parent : insertion entre les deux
        const grand = this.byUid(parent.parent);
        p.parent = grand.uid;
        p.attach = { type: parent.attach.type, y: 0, psi: 0 };
        parent.parent = p.uid;
      }
    }
    this.parts.push(p);
    return p;
  }

  // Liste des pièces d'un sous-arbre
  subtree(p) {
    const out = [p];
    for (let i = 0; i < out.length; i++) for (const c of this.childrenOf(out[i])) out.push(c);
    return out;
  }

  remove(p) {
    const del = new Set(this.subtree(p).map((x) => x.uid));
    this.parts = this.parts.filter((x) => !del.has(x.uid));
    this.layout();
  }

  // Pièces de la même symétrie (y compris p)
  symGroup(p) {
    if (!p.sym) return [p];
    return this.parts.filter((x) => x.sym === p.sym);
  }

  // Nœuds libres (haut/bas) en coordonnées « monde » de la fusée
  nodeUse(p) {
    const use = { top: false, bottom: false, out: false };
    if (p.attach) {
      if (p.attach.type === 'top') use.bottom = true;
      if (p.attach.type === 'bottom') use.top = true;
    }
    for (const c of this.childrenOf(p)) {
      if (c.attach.type === 'top') use.top = true;
      if (c.attach.type === 'bottom') use.bottom = true;
      if (c.attach.type === 'out') use.out = true;
    }
    return use;
  }

  // Calcule position (repère fusée) et orientation de chaque pièce
  layout() {
    const root = this.root;
    this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    if (!root) return;
    const byParent = new Map();
    for (const p of this.parts) {
      if (p.parent == null) continue;
      if (!byParent.has(p.parent)) byParent.set(p.parent, []);
      byParent.get(p.parent).push(p);
    }
    const stack = [root];
    root.pos = { x: 0, y: 0, z: 0 };
    root.yaw = 0;
    root.placed = true;
    while (stack.length) {
      const P = stack.pop();
      const kids = byParent.get(P.uid) || [];
      for (const c of kids) {
        placePart(c, P);
        stack.push(c);
      }
    }
    // Recentre verticalement : y=0 au bas de la fusée
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of this.parts) {
      const b = partBox(p);
      p.box = b;
      minX = Math.min(minX, b[0]); maxX = Math.max(maxX, b[1]);
      minY = Math.min(minY, b[2]); maxY = Math.max(maxY, b[3]);
      minZ = Math.min(minZ, b[4]); maxZ = Math.max(maxZ, b[5]);
    }
    this.bounds = { minX, maxX, minY, maxY, minZ, maxZ };
  }

  // Contrôleur principal : capsule avec équipage, sinon sonde
  controlPart(parts = this.parts) {
    let best = null, score = -1;
    for (const p of parts) {
      const d = PART_BY_ID[p.id];
      if (!d.command) continue;
      const s = d.command.crew > 0 ? 2 : 1;
      if (s > score) { score = s; best = p; }
    }
    return best;
  }

  // Liste des arêtes (liaisons) entre pièces
  edges() {
    return this.parts.filter((p) => p.parent != null).map((p) => [p.parent, p.uid, p.attach.type]);
  }

  // Arête coupée par un découpleur donné (ou null)
  breakEdgeOf(p) {
    const d = PART_BY_ID[p.id];
    if (!d.decoupler) return null;
    if (d.decoupler.radial) {
      return p.parent != null && p.attach.type === 'side' ? [p.parent, p.uid] : null;
    }
    if (d.engine && d.engine.escape) {
      // la tour de sauvetage se détache par le bas
      if (p.attach && p.attach.type === 'top') return [p.parent, p.uid];
      const c = this.childrenOf(p).find((k) => k.attach.type === 'bottom');
      return c ? [p.uid, c.uid] : null;
    }
    if (p.attach && p.attach.type === 'bottom') return [p.parent, p.uid];
    const top = this.childrenOf(p).find((k) => k.attach.type === 'top');
    return top ? [p.uid, top.uid] : null;
  }

  // Étagement automatique (voir README) puis application des choix du joueur
  computeStages() {
    const parts = this.parts;
    if (!parts.length) return [];
    const ctrl = this.controlPart() || this.root;
    const uf = new Map(parts.map((p) => [p.uid, p.uid]));
    const find = (a) => {
      while (uf.get(a) !== a) { uf.set(a, uf.get(uf.get(a))); a = uf.get(a); }
      return a;
    };
    const breaks = new Map(); // clé d'arête -> découpleur
    for (const p of parts) {
      const e = this.breakEdgeOf(p);
      if (e) breaks.set(e[0] + ':' + e[1], p);
    }
    for (const p of parts) {
      if (p.parent == null) continue;
      if (breaks.has(p.parent + ':' + p.uid)) continue;
      uf.set(find(p.uid), find(p.parent));
    }
    const segOf = (uid) => find(uid);
    const segs = new Map();
    for (const p of parts) {
      const s = segOf(p.uid);
      if (!segs.has(s)) segs.set(s, { id: s, parts: [], children: [], parent: null, dec: null, radial: false, minY: Infinity });
      const S = segs.get(s);
      S.parts.push(p);
      S.minY = Math.min(S.minY, p.box ? p.box[2] : 0);
    }
    // Graphe des segments
    const rootSeg = segs.get(segOf(ctrl.uid));
    const adj = new Map();
    for (const [key, dec] of breaks) {
      const [a, b] = key.split(':').map(Number);
      const sa = segs.get(segOf(a)), sb = segs.get(segOf(b));
      if (!sa || !sb || sa === sb) continue;
      if (!adj.has(sa)) adj.set(sa, []);
      if (!adj.has(sb)) adj.set(sb, []);
      adj.get(sa).push([sb, dec]);
      adj.get(sb).push([sa, dec]);
    }
    const seen = new Set([rootSeg]);
    const q = [rootSeg];
    while (q.length) {
      const s = q.shift();
      for (const [n, dec] of adj.get(s) || []) {
        if (seen.has(n)) continue;
        seen.add(n);
        n.parent = s;
        n.dec = dec;
        n.radial = !!PART_BY_ID[dec.id].decoupler.radial;
        s.children.push(n);
        q.push(n);
      }
    }
    const isEngine = (p) => {
      const d = PART_BY_ID[p.id];
      return d.engine && !(d.engine.escape);
    };
    const radialDesc = (S) => {
      const out = [];
      const walk = (s) => { for (const c of s.children) if (c.radial) { out.push(c); walk(c); } };
      walk(S);
      return out;
    };
    const ignite = (S) => {
      const list = [];
      for (const s of [S, ...radialDesc(S)]) for (const p of s.parts) if (isEngine(p)) list.push(p.uid);
      return list;
    };
    // Chaîne principale (vers le bas)
    const chain = [rootSeg];
    let cur = rootSeg;
    for (;;) {
      const below = cur.children.filter((c) => !c.radial && c.minY < cur.minY + 0.01);
      if (!below.length) break;
      below.sort((a, b) => a.minY - b.minY);
      cur = below[0];
      chain.push(cur);
    }
    const order = chain.slice().reverse();
    const stages = [];
    const used = new Set();
    const push = (arr) => {
      const a = arr.filter((u) => !used.has(u));
      a.forEach((u) => used.add(u));
      if (a.length) stages.push(a);
    };
    for (let i = 0; i < order.length; i++) {
      const S = order[i];
      if (i === 0) push(ignite(S));
      // séparation des propulseurs latéraux, du plus profond au moins profond
      const levels = [];
      const walk = (s, lvl) => {
        for (const c of s.children) if (c.radial) {
          (levels[lvl] ||= []).push(c.dec.uid);
          walk(c, lvl + 1);
        }
      };
      walk(S, 0);
      for (let l = levels.length - 1; l >= 0; l--) push(levels[l]);
      // coiffes du segment
      const fair = [];
      for (const p of S.parts) if (PART_BY_ID[p.id].fairing) fair.push(p.uid);
      // éléments empilés hors de la chaîne (tour de sauvetage…)
      const extras = S.children.filter((c) => !c.radial && !chain.includes(c)).map((c) => c.dec.uid);
      if (i < order.length - 1) {
        const next = order[i + 1];
        push([S.dec ? S.dec.uid : null, ...ignite(next)].filter((u) => u != null));
        if (extras.length) push(extras);
        const nf = [];
        for (const p of next.parts) if (PART_BY_ID[p.id].fairing) nf.push(p.uid);
        if (nf.length) push(nf);
      } else {
        if (extras.length) push(extras);
        if (fair.length) push(fair);
      }
    }
    // Moteurs non encore attribués (sur des éléments non standard)
    const loose = parts.filter((p) => isEngine(p) && !used.has(p.uid)).map((p) => p.uid);
    if (loose.length) {
      if (stages.length) stages[0].push(...loose);
      else stages.push(loose);
      loose.forEach((u) => used.add(u));
    }
    const leftoverDec = parts.filter((p) => (PART_BY_ID[p.id].decoupler || PART_BY_ID[p.id].fairing) && !used.has(p.uid)).map((p) => p.uid);
    if (leftoverDec.length) push(leftoverDec);
    // Parachutes à la fin
    const chutes = parts.filter((p) => PART_BY_ID[p.id].chute);
    const drogues = chutes.filter((p) => PART_BY_ID[p.id].chute.drogue).map((p) => p.uid);
    const mains = chutes.filter((p) => !PART_BY_ID[p.id].chute.drogue).map((p) => p.uid);
    push(drogues);
    push(mains);

    // Choix manuels du joueur
    for (const p of parts) {
      if (p.stage == null || !used.has(p.uid)) continue;
      for (const s of stages) {
        const i = s.indexOf(p.uid);
        if (i >= 0) s.splice(i, 1);
      }
      while (stages.length <= p.stage) stages.push([]);
      stages[p.stage].push(p.uid);
    }
    return stages.filter((s) => s.length);
  }

  // Détermine le composant restant attaché au contrôleur quand on coupe une arête
  splitAt(edgeA, edgeB, partsSubset = this.parts) {
    const ids = new Set(partsSubset.map((p) => p.uid));
    const adj = new Map();
    for (const p of partsSubset) adj.set(p.uid, []);
    for (const p of partsSubset) {
      if (p.parent == null || !ids.has(p.parent)) continue;
      if ((p.parent === edgeA && p.uid === edgeB) || (p.parent === edgeB && p.uid === edgeA)) continue;
      adj.get(p.uid).push(p.parent);
      adj.get(p.parent).push(p.uid);
    }
    return adj;
  }

  // Coût total
  cost() {
    let c = 0;
    for (const p of this.parts) c += PART_BY_ID[p.id].cost;
    return c;
  }

  mass() {
    let m = 0;
    for (const p of this.parts) {
      const d = PART_BY_ID[p.id];
      m += d.mass;
      if (d.res) for (const k in d.res) if (k !== 'ec') m += d.res[k];
    }
    return m;
  }
}

// ---------------------------------------------------------------------------
// Placement d'une pièce par rapport à son parent
export function placePart(c, P) {
  const Pd = PART_BY_ID[P.id];
  const d = PART_BY_ID[c.id];
  const a = c.attach;
  if (a.type === 'top') {
    c.pos = { x: P.pos.x, y: P.pos.y + Pd.h / 2 + d.h / 2, z: P.pos.z };
    c.yaw = P.yaw;
  } else if (a.type === 'bottom') {
    c.pos = { x: P.pos.x, y: P.pos.y - Pd.h / 2 - d.h / 2, z: P.pos.z };
    c.yaw = P.yaw;
  } else if (a.type === 'side') {
    const ang = P.yaw + (P.flip ? -a.psi : a.psi);
    const dy = P.flip ? -a.y : a.y;
    const r = partRadiusAt(Pd, a.y);
    const depth = d.rad ?? d.d / 2;
    c.pos = { x: P.pos.x + Math.cos(ang) * (r + depth), y: P.pos.y + dy, z: P.pos.z + Math.sin(ang) * (r + depth) };
    c.yaw = ang;
  } else if (a.type === 'out') {
    const ang = P.yaw;
    const dist = (Pd.outDist ?? Pd.d / 2) + (d.rad ?? d.d / 2);
    c.pos = { x: P.pos.x + Math.cos(ang) * dist, y: P.pos.y, z: P.pos.z + Math.sin(ang) * dist };
    c.yaw = ang;
  }
}

// Boîte englobante locale d'une pièce [minX,maxX,minY,maxY,minZ,maxZ]
export function localBox(d, deployed = false) {
  if (d.radial && !(d.attach && (d.attach.top || d.attach.bottom))) {
    const depth = d.rad ?? d.d / 2;
    let out = d.d - depth;
    let w = d.d;
    if (d.fin) { out = d.fin.span; w = 0.12; }
    if (d.legs) { out = deployed ? d.legs.span : 0.4; }
    if (d.solar && d.solar.deploy && deployed) out = 3;
    if (d.airbrake) out = 0.2;
    return [-depth, Math.max(out, 0.1), -d.h / 2, d.h / 2, -w / 2, w / 2];
  }
  const r = Math.max(d.d, d.dTop ?? d.d) / 2;
  return [-r, r, -d.h / 2, d.h / 2, -r, r];
}

export function partBox(p) {
  const d = PART_BY_ID[p.id];
  const b = localBox(d);
  const c = Math.cos(p.yaw || 0), s = Math.sin(p.yaw || 0);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const x of [b[0], b[1]]) for (const z of [b[4], b[5]]) {
    // rotation autour de Y : x' = x cos - z sin... (local +x -> (cos,0,sin))
    const wx = x * c - z * s;
    const wz = x * s + z * c;
    minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
    minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
  }
  return [p.pos.x + minX, p.pos.x + maxX, p.pos.y + b[2], p.pos.y + b[3], p.pos.z + minZ, p.pos.z + maxZ];
}

// ---------------------------------------------------------------------------
// Isp et poussée selon la pression ambiante (atm)
export function ispAt(e, p) {
  if (p <= 0) return e.ispVac;
  const isp = e.ispVac + (e.ispSL - e.ispVac) * p;
  return Math.max(isp, e.ispVac * 0.03);
}
export function thrustAt(e, p) {
  return (e.thrust * ispAt(e, p)) / e.ispVac;
}

// Groupes de carburant : réservoirs reliés à un moteur sans traverser de découpleur
export function fuelGroups(parts) {
  const byUid = new Map(parts.map((p) => [p.uid, p]));
  const adj = new Map(parts.map((p) => [p.uid, []]));
  for (const p of parts) {
    if (p.parent != null && byUid.has(p.parent)) {
      adj.get(p.uid).push(p.parent);
      adj.get(p.parent).push(p.uid);
    }
  }
  const groups = new Map(); // uid moteur -> liste d'uid de réservoirs
  for (const p of parts) {
    const d = PART_BY_ID[p.id];
    if (!d.engine) continue;
    const seen = new Set([p.uid]);
    const q = [p.uid];
    const tanks = [];
    while (q.length) {
      const u = q.shift();
      const up = byUid.get(u);
      const ud = PART_BY_ID[up.id];
      if (ud.res && ud.res[d.engine.prop] != null) tanks.push(u);
      for (const n of adj.get(u)) {
        if (seen.has(n)) continue;
        seen.add(n);
        const nd = PART_BY_ID[byUid.get(n).id];
        if (nd.decoupler && !(nd.engine)) continue; // barrière
        q.push(n);
      }
    }
    groups.set(p.uid, tanks);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Performances par étage (simulation simplifiée de la séquence de vol)
export function stageStats(craft, pressure = 0, g = 9.81) {
  const stages = craft.computeStages();
  let parts = craft.parts.slice();
  const res = new Map();
  for (const p of parts) {
    const d = PART_BY_ID[p.id];
    if (d.res) res.set(p.uid, { ...d.res });
  }
  const ctrl = craft.controlPart() || craft.root;
  const active = new Set();
  const out = [];
  const massOf = (ps) => {
    let m = 0;
    for (const p of ps) {
      m += PART_BY_ID[p.id].mass;
      const r = res.get(p.uid);
      if (r) for (const k in r) if (k !== 'ec') m += r[k];
    }
    return m;
  };
  const detach = (ps, decUid) => {
    const dec = ps.find((p) => p.uid === decUid);
    if (!dec) return ps;
    const e = craft.breakEdgeOf(dec);
    if (!e) return ps;
    const adj = craft.splitAt(e[0], e[1], ps);
    const start = ps.find((p) => p.uid === (ctrl ? ctrl.uid : ps[0].uid)) || ps[0];
    const keep = new Set([start.uid]);
    const q = [start.uid];
    while (q.length) for (const n of adj.get(q.shift()) || []) if (!keep.has(n)) { keep.add(n); q.push(n); }
    return ps.filter((p) => keep.has(p.uid));
  };
  const applyStage = (ps, stage) => {
    for (const uid of stage) {
      const p = ps.find((x) => x.uid === uid);
      if (!p) continue;
      const d = PART_BY_ID[p.id];
      if (d.engine) active.add(uid);
      if (d.decoupler && !d.engine) ps = detach(ps, uid);
      if (d.engine && d.engine.escape) ps = detach(ps, uid);
    }
    return ps;
  };

  for (let si = 0; si < stages.length; si++) {
    parts = applyStage(parts, stages[si]);
    const present = new Set(parts.map((p) => p.uid));
    for (const u of [...active]) if (!present.has(u)) active.delete(u);
    // moteurs qui seront largués à l'étage suivant
    let dropNext = null;
    if (si + 1 < stages.length) {
      const saved = new Set(active);
      const after = new Set(applyStage(parts.slice(), stages[si + 1]).map((p) => p.uid));
      active.clear();
      saved.forEach((u) => active.add(u));
      dropNext = [...active].filter((u) => !after.has(u));
      if (!dropNext.length) dropNext = null;
    }
    const groups = fuelGroups(parts);
    const m0 = massOf(parts);
    let dv = 0, time = 0, twr0 = 0, thrust0 = 0;
    let first = true;
    for (let guard = 0; guard < 40; guard++) {
      // moteurs actifs avec carburant
      const burning = [];
      for (const u of active) {
        const p = parts.find((x) => x.uid === u);
        const e = PART_BY_ID[p.id].engine;
        const tanks = e.solid ? [u] : GLOBAL_RES.has(e.prop) ? parts.filter((x) => { const r = res.get(x.uid); return r && r[e.prop] > 0; }).map((x) => x.uid) : groups.get(u) || [];
        const fuel = tanks.reduce((s, t) => s + ((res.get(t) || {})[e.prop] || 0), 0);
        if (fuel > 1e-6) burning.push({ u, e, tanks, fuel });
      }
      if (!burning.length) break;
      if (dropNext && !burning.some((b) => dropNext.includes(b.u))) break;
      let F = 0, mdot = 0;
      for (const b of burning) {
        const f = thrustAt(b.e, pressure);
        F += f;
        b.mdot = b.e.thrust / (b.e.ispVac * G0);
        mdot += b.mdot;
      }
      if (first) { thrust0 = F; twr0 = F / (m0 * g); first = false; }
      // temps jusqu'au premier épuisement : consommation par réservoir partagée
      const draw = new Map();
      for (const b of burning) for (const t of b.tanks) {
        const k = t + ':' + b.e.prop;
        draw.set(k, (draw.get(k) || 0) + b.mdot / b.tanks.length);
      }
      let dt = Infinity;
      for (const [k, rate] of draw) {
        const [t, prop] = k.split(':');
        const amt = res.get(Number(t))[prop];
        dt = Math.min(dt, amt / rate);
      }
      if (!isFinite(dt) || dt <= 0) break;
      const m = massOf(parts);
      const m1 = m - mdot * dt;
      const isp = F / (mdot * G0);
      dv += isp * G0 * Math.log(m / Math.max(m1, 1));
      time += dt;
      for (const [k, rate] of draw) {
        const [t, prop] = k.split(':');
        const r = res.get(Number(t));
        r[prop] = Math.max(0, r[prop] - rate * dt);
        if (r[prop] < 1e-3) r[prop] = 0;
      }
    }
    out.push({ index: si, parts: stages[si], dv, time, twr: twr0, thrust: thrust0, m0, m1: massOf(parts) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pièces enveloppées par une coiffe : empilement contigu au-dessus de la base
export function fairingContents(base, parts) {
  const d = PART_BY_ID[base.id];
  const top = base.pos.y + d.h / 2;
  const maxR = d.fairing.maxD / 2;
  const cand = parts.filter((p) => {
    if (p.uid === base.uid || !p.box) return false;
    if (p.box[2] < top - 0.05) return false;
    const rx = Math.max(Math.abs(p.box[0] - base.pos.x), Math.abs(p.box[1] - base.pos.x));
    const rz = Math.max(Math.abs(p.box[4] - base.pos.z), Math.abs(p.box[5] - base.pos.z));
    return Math.max(rx, rz) <= maxR + 0.01;
  });
  cand.sort((a, b) => a.box[2] - b.box[2]);
  let cur = top;
  let r = d.d / 2;
  const contents = [];
  for (const p of cand) {
    if (p.box[2] > cur + 0.05) break;
    cur = Math.max(cur, p.box[3]);
    const rx = Math.max(Math.abs(p.box[0] - base.pos.x), Math.abs(p.box[1] - base.pos.x));
    const rz = Math.max(Math.abs(p.box[4] - base.pos.z), Math.abs(p.box[5] - base.pos.z));
    r = Math.max(r, rx, rz);
    contents.push(p.uid);
  }
  if (!contents.length) return null;
  return { top: cur - top + 0.15, maxR: r, contents };
}
