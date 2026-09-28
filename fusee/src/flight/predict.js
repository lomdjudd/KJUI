// Prédiction de trajectoire par coniques raccordées : orbite actuelle,
// sortie de sphère d'influence, rencontre d'une lune ou d'une planète,
// impact et entrée atmosphérique.

import { Orbit } from '../core/orbit.js';

const tmp = { x: 0, y: 0, vx: 0, vy: 0 };

function distTo(orbit, c, t) {
  orbit.stateAt(t, tmp);
  const cs = c.localState(t);
  return Math.hypot(tmp.x - cs.x, tmp.y - cs.y);
}

// Recherche du minimum par section dorée
function golden(f, a, b, it = 40) {
  const gr = 0.6180339887;
  let c = b - gr * (b - a), d = a + gr * (b - a);
  let fc = f(c), fd = f(d);
  for (let i = 0; i < it; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
  }
  return fc < fd ? [c, fc] : [d, fd];
}

function bisect(f, a, b, it = 50) {
  // f(a) > 0, f(b) <= 0
  for (let i = 0; i < it; i++) {
    const m = (a + b) / 2;
    if (f(m) > 0) a = m; else b = m;
    if (b - a < 0.5) break;
  }
  return b;
}

export function predict(sys, body, x, y, vx, vy, ut, opts = {}) {
  const maxPatches = opts.maxPatches ?? 4;
  const patches = [];
  let b = body, sx = x, sy = y, svx = vx, svy = vy, t0 = ut;
  let skipChild = opts.skipChild || null;
  for (let k = 0; k < maxPatches; k++) {
    const orbit = Orbit.fromState(sx, sy, svx, svy, b.mu, t0);
    const patch = { body: b, orbit, t0, t1: Infinity, end: 'none', next: null, atmoT: null };
    const r0 = Math.hypot(sx, sy);
    // impact (surface) et entrée atmosphérique
    const surfR = b.radius + (b.hasSurface ? 0 : 0);
    if (orbit.periapsis < surfR && r0 > surfR - 1) {
      const t = orbit.timeToRadius(surfR, t0 + 0.01, false);
      if (t != null && t > t0) { patch.t1 = t; patch.end = 'impact'; }
    }
    if (b.atmosphere) {
      const ra = b.radius + b.atmosphere.height;
      if (orbit.periapsis < ra && r0 > ra) {
        const t = orbit.timeToRadius(ra, t0 + 0.01, false);
        if (t != null) patch.atmoT = t;
      }
    }
    // sortie de la sphère d'influence
    if (b.parentBody && (orbit.e >= 1 || orbit.apoapsis > b.soi)) {
      const t = orbit.timeToRadius(b.soi, t0, true);
      if (t != null && t < patch.t1) { patch.t1 = t; patch.end = 'escape'; patch.next = b.parentBody; }
    }
    // rencontres avec les satellites du corps
    if (b.children.length) {
      let win;
      if (isFinite(orbit.period)) win = Math.min(patch.t1, t0 + orbit.period * (opts.periods ?? 1.5));
      else win = Math.min(patch.t1, t0 + (opts.maxTime ?? 3.2e8));
      if (!isFinite(win)) win = t0 + 3.2e8;
      const N = b.type === 'star' ? 700 : 360;
      const dt = (win - t0) / N;
      let best = null;
      for (const c of b.children) {
        if (c === skipChild) continue;
        if (c.hidden && opts.hiddenOk && !opts.hiddenOk(c)) continue;
        // test grossier : la trajectoire peut-elle croiser l'orbite du satellite ?
        const ca = c.orbit;
        const rMin = orbit.periapsis, rMax = isFinite(orbit.apoapsis) ? orbit.apoapsis : Infinity;
        const cMin = ca.periapsis - c.soi, cMax = ca.apoapsis + c.soi;
        if (rMax < cMin || rMin > cMax) continue;
        const f = (t) => distTo(orbit, c, t) - c.soi;
        let prev = f(t0), prev2 = Infinity;
        if (prev < 0) continue; // déjà dedans (on vient d'en sortir)
        for (let i = 1; i <= N; i++) {
          const t = t0 + dt * i;
          const v = f(t);
          let hit = null;
          if (v <= 0) hit = bisect(f, t - dt, t);
          else if (i >= 2 && prev < prev2 && prev < v && prev < c.soi * 4) {
            // minimum local entre t-2dt et t
            const [tm, fm] = golden(f, t - 2 * dt, t);
            if (fm <= 0) hit = bisect(f, t - 2 * dt, tm);
          }
          if (hit != null) {
            if (!best || hit < best.t) best = { t: hit, c };
            break;
          }
          prev2 = prev;
          prev = v;
          if (best && t > best.t) break;
        }
      }
      if (best && best.t < patch.t1) { patch.t1 = best.t; patch.end = 'encounter'; patch.next = best.c; }
    }
    patches.push(patch);
    if (patch.end === 'escape' || patch.end === 'encounter') {
      const st = orbit.stateAt(patch.t1);
      if (patch.end === 'escape') {
        const bs = b.localState(patch.t1);
        sx = st.x + bs.x; sy = st.y + bs.y; svx = st.vx + bs.vx; svy = st.vy + bs.vy;
        skipChild = b;
        b = b.parentBody;
      } else {
        const cs = patch.next.localState(patch.t1);
        sx = st.x - cs.x; sy = st.y - cs.y; svx = st.vx - cs.vx; svy = st.vy - cs.vy;
        skipChild = null;
        b = patch.next;
      }
      t0 = patch.t1;
      continue;
    }
    break;
  }
  return patches;
}

// Rapprochement minimal d'une trajectoire avec un corps cible
export function closestApproach(patches, target) {
  let best = null;
  for (const p of patches) {
    if (p.body !== target.parentBody) continue;
    const t1 = isFinite(p.t1) ? p.t1 : p.t0 + (isFinite(p.orbit.period) ? p.orbit.period * 1.5 : 3e8);
    const f = (t) => distTo(p.orbit, target, t);
    const N = 400;
    const dt = (t1 - p.t0) / N;
    let bi = 0, bv = Infinity;
    for (let i = 0; i <= N; i++) {
      const v = f(p.t0 + dt * i);
      if (v < bv) { bv = v; bi = i; }
    }
    const [tm, fm] = golden(f, p.t0 + Math.max(0, bi - 1) * dt, p.t0 + Math.min(N, bi + 1) * dt);
    if (!best || fm < best.d) best = { d: fm, t: tm, patch: p };
  }
  for (const p of patches) if (p.body === target) return { d: 0, t: p.t0, patch: p, inside: true };
  return best;
}
