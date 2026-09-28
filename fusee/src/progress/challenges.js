// Défis : scénarios chronométrés ou de précision, avec médailles.

import { Craft } from '../craft/craft.js';
import { Vessel } from '../flight/vessel.js';
import { EARTH_SITES } from '../core/terrain.js';
import { load, store } from './game.js';
import { fmtDist } from '../core/math.js';

// Place un vaisseau au-dessus d'une longitude (repère du corps), vitesses
// données dans le repère du sol (horizontale vers l'est +, verticale +)
function placeAbove(v, body, lon, alt, ut, vh, vv, noseAngleFromUp = 0) {
  const a = lon + body.rotationAt(ut);
  const g = body.ground.atLon(lon);
  const R = body.radius + Math.max(body.ground.hasLiquid ? 0 : g, g) + alt;
  v.body = body;
  v.x = Math.cos(a) * R;
  v.y = Math.sin(a) * R;
  const w = body.angularVelocity();
  const ux = Math.cos(a), uy = Math.sin(a);
  const ex = -uy, ey = ux;
  v.vx = -w * v.y + ex * vh + ux * vv;
  v.vy = w * v.x + ey * vh + uy * vv;
  v.rot = a - Math.PI / 2 + noseAngleFromUp;
  v.av = 0;
  v.launched = true;
  v.met0 = ut;
}

function inOrbit(v, body, alt, ut) {
  const r = body.radius + alt;
  const a = Math.PI / 2 + 0.3;
  v.body = body;
  v.x = Math.cos(a) * r;
  v.y = Math.sin(a) * r;
  const s = Math.sqrt(body.mu / r);
  v.vx = -Math.sin(a) * s;
  v.vy = Math.cos(a) * s;
  v.rot = a - Math.PI / 2 + Math.PI / 2;
  v.launched = true;
  v.met0 = ut;
}

function fuelFraction(v, f) {
  for (const p of v.parts) for (const k in p.res) if (k !== 'ec' && k !== 'ablator') p.res[k] *= f;
}

function ignite(v) {
  for (const p of v.parts) if (p.def.engine && !p.def.engine.solid) { p.engOn = true; }
  v.stages = v.stages.filter((s) => !s.every((u) => v.byUid.get(u)?.def.engine && !v.byUid.get(u).def.engine.solid));
  v.stageIdx = 0;
}

function lander(extra = []) {
  const c = new Craft('Atterrisseur');
  const cab = c.addRoot('lander_cab');
  let t = c.add('tank_k_m2', cab, { type: 'bottom' });
  for (const id of extra) t = c.add(id, t, { type: 'bottom' });
  c.add('eng_colibri', t, { type: 'bottom' });
  const s = c.symCounter++;
  for (let k = 0; k < 4; k++) c.add('legs_s', c.parts[1], { type: 'side', y: 0, psi: Math.PI / 4 + (k * Math.PI) / 2 }, { sym: s });
  c.add('computer', cab, { type: 'side', y: 0, psi: Math.PI });
  return c;
}

const distTo = (v, ut, lon) => {
  const b = v.body;
  const lv = Math.atan2(v.y, v.x) - b.rotationAt(ut);
  let d = lv - lon;
  d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return Math.abs(d) * b.radius;
};

export const CHALLENGES = [
  {
    id: 'booster', name: 'Retour du lanceur', icon: 'rocket',
    desc: 'Un premier étage redescend à 9 km d\'altitude, à 6 km de la zone d\'atterrissage LZ-1. Posez-le en douceur au centre de la croix.',
    goal: 'Or : à moins de 15 m du centre · Argent : 40 m · Bronze : posé sur la plateforme (45 m)',
    site: { body: 'terre', lon: EARTH_SITES.lz.lon, name: 'LZ-1', radius: 40 },
    create(sys, sim) {
      const c = new Craft('Premier étage Aquila');
      const pc = c.addRoot('probe_nexus_m');
      const t = c.add('tank_k_m8', pc, { type: 'bottom' });
      const t2 = c.add('tank_k_m4', t, { type: 'bottom' });
      c.add('eng_aquila', t2, { type: 'bottom' });
      const s1 = c.symCounter++;
      for (let k = 0; k < 4; k++) c.add('fin_grid', t, { type: 'side', y: 3.2, psi: Math.PI / 4 + (k * Math.PI) / 2 }, { sym: s1 });
      const s2 = c.symCounter++;
      for (let k = 0; k < 4; k++) c.add('legs_m', t2, { type: 'side', y: -0.4, psi: Math.PI / 4 + (k * Math.PI) / 2 }, { sym: s2 });
      c.add('computer', pc, { type: 'side', y: 0, psi: 0 });
      const v = Vessel.fromCraft(c.toJSON(), sys);
      fuelFraction(v, 0.16);
      v.computeMass();
      placeAbove(v, sys.home, EARTH_SITES.lz.lon - 6000 / sys.home.radius, 9000, sim.ut, 190, -210, Math.PI + 0.35);
      ignite(v);
      v.sas = 'retro';
      return v;
    },
    check(v, sim) {
      if (!v.landed || v.body.id !== 'terre') return null;
      const d = distTo(v, sim.ut, EARTH_SITES.lz.lon);
      if (d <= 15) return { medal: 'or', text: `Posé à ${fmtDist(d)} du centre` };
      if (d <= 40) return { medal: 'argent', text: `Posé à ${fmtDist(d)} du centre` };
      if (d <= 45) return { medal: 'bronze', text: `Posé à ${fmtDist(d)} du centre` };
      return { medal: null, text: `Posé à ${fmtDist(d)} : hors de la plateforme` };
    },
  },
  {
    id: 'moon_precision', name: 'Alunissage de précision', icon: 'target',
    desc: 'Depuis une orbite lunaire de 14 km, posez le module Aigle près de la balise de la base Tranquillité.',
    goal: 'Or : 150 m · Argent : 600 m · Bronze : 2 km',
    site: { body: 'lune', lon: 0.95, name: 'Base Tranquillité', radius: 30 },
    create(sys, sim) {
      const v = Vessel.fromCraft(lander().toJSON(), sys);
      const b = sys.get('lune');
      const r = b.radius + 14000;
      const target = 0.95 + b.rotationAt(sim.ut);
      const a = target - 0.28;
      v.body = b;
      v.x = Math.cos(a) * r; v.y = Math.sin(a) * r;
      const s = Math.sqrt(b.mu / r);
      v.vx = -Math.sin(a) * s; v.vy = Math.cos(a) * s;
      v.rot = a;
      v.launched = true;
      v.met0 = sim.ut;
      ignite(v);
      v.gear = true;
      return v;
    },
    check(v, sim) {
      if (!v.landed || v.body.id !== 'lune') return null;
      const d = distTo(v, sim.ut, 0.95);
      const medal = d <= 150 ? 'or' : d <= 600 ? 'argent' : d <= 2000 ? 'bronze' : null;
      return { medal, text: `Posé à ${fmtDist(d)} de la balise` };
    },
  },
  {
    id: 'reentry', name: 'Retour de la Lune', icon: 'flask',
    desc: 'La capsule Orion-X revient de la Lune à 3,1 km/s. Orientez le bouclier face au vent, déployez les parachutes et amerrissez.',
    goal: 'Or : accélération max sous 6 g · Argent : sous 9 g · Bronze : survivre',
    create(sys, sim) {
      const c = new Craft('Orion-X');
      const cap = c.addRoot('cap_orion');
      c.add('chute_m', cap, { type: 'top' });
      c.add('shield_m', cap, { type: 'bottom' });
      const v = Vessel.fromCraft(c.toJSON(), sys);
      const b = sys.home;
      const r = b.radius + 110000;
      const a = Math.PI * 0.7;
      v.body = b;
      v.x = Math.cos(a) * r; v.y = Math.sin(a) * r;
      const gam = 5.2 * Math.PI / 180;
      const sp = 3100;
      const tx = -Math.sin(a), ty = Math.cos(a);
      v.vx = sp * (tx * Math.cos(gam) - Math.cos(a) * Math.sin(gam));
      v.vy = sp * (ty * Math.cos(gam) - Math.sin(a) * Math.sin(gam));
      v.rot = Math.atan2(-v.vy, -v.vx) - Math.PI / 2 + Math.PI;
      v.launched = true;
      v.met0 = sim.ut;
      v.sas = 'retro';
      return v;
    },
    check(v) {
      if (!(v.landed || v.splashed) || v.body.id !== 'terre') return null;
      const g = v.stats.maxG;
      return { medal: g < 6 ? 'or' : g < 9 ? 'argent' : 'bronze', text: `Accélération maximale : ${g.toFixed(1)} g` };
    },
  },
  {
    id: 'olympus', name: 'Sommet d\'Olympus Mons', icon: 'planet',
    desc: 'Posez un atterrisseur au sommet du plus grand volcan du système, sur Mars.',
    goal: 'Or : à moins de 4 km du sommet · Argent : 12 km · Bronze : 35 km',
    site: { body: 'mars', lon: 1.25, name: 'Olympus Mons', radius: 60 },
    create(sys, sim) {
      const v = Vessel.fromCraft(lander(['tank_k_m2']).toJSON(), sys);
      const b = sys.get('mars');
      const r = b.radius + 30000;
      const target = 1.25 + b.rotationAt(sim.ut);
      const a = target - 0.35;
      v.body = b;
      v.x = Math.cos(a) * r; v.y = Math.sin(a) * r;
      const s = Math.sqrt(b.mu / r);
      v.vx = -Math.sin(a) * s; v.vy = Math.cos(a) * s;
      v.rot = a;
      v.launched = true;
      v.met0 = sim.ut;
      ignite(v);
      return v;
    },
    check(v, sim) {
      if (!v.landed || v.body.id !== 'mars') return null;
      const d = distTo(v, sim.ut, 1.25);
      const medal = d <= 4000 ? 'or' : d <= 12000 ? 'argent' : d <= 35000 ? 'bronze' : null;
      return { medal, text: `Posé à ${fmtDist(d)} du sommet` };
    },
  },
  {
    id: 'venus', name: 'Descente vers Vénus', icon: 'planet',
    desc: 'Une sonde à coque pressurisée entre dans l\'atmosphère écrasante de Vénus. Survivez jusqu\'au sol.',
    goal: 'Or : se poser à moins de 8 m/s · Argent : 14 m/s · Bronze : se poser',
    create(sys, sim) {
      const c = new Craft('Sonde Vénéra');
      const pr = c.addRoot('probe_nexus');
      c.add('chute_m', pr, { type: 'top' });
      const sp = c.add('spec_pressure', pr, { type: 'bottom' });
      const ba = c.add('battery_s', sp, { type: 'bottom' });
      c.add('shield_m', ba, { type: 'bottom' });
      c.add('sci_baro', sp, { type: 'side', y: 0, psi: 0 });
      c.add('sci_thermo', sp, { type: 'side', y: 0, psi: Math.PI });
      const v = Vessel.fromCraft(c.toJSON(), sys);
      const b = sys.get('venus');
      const r = b.radius + b.atmosphere.height + 20000;
      const a = Math.PI * 0.2;
      v.body = b;
      v.x = Math.cos(a) * r; v.y = Math.sin(a) * r;
      const gam = 9 * Math.PI / 180;
      const spd = 2900;
      v.vx = spd * (-Math.sin(a) * Math.cos(gam) - Math.cos(a) * Math.sin(gam));
      v.vy = spd * (Math.cos(a) * Math.cos(gam) - Math.sin(a) * Math.sin(gam));
      v.rot = Math.atan2(-v.vy, -v.vx) - Math.PI / 2 + Math.PI;
      v.launched = true;
      v.met0 = sim.ut;
      v.stages = [v.parts.filter((p) => p.def.chute).map((p) => p.uid)];
      v.stageIdx = 0;
      v.sas = 'retro';
      return v;
    },
    check(v) {
      if (!(v.landed) || v.body.id !== 'venus') return null;
      const s = v.lastImpact || 0;
      return { medal: s < 8 ? 'or' : s < 14 ? 'argent' : 'bronze', text: `Contact au sol à ${s.toFixed(1)} m/s` };
    },
  },
  {
    id: 'titan', name: 'Plongée sur Titan', icon: 'planet',
    desc: 'Une sonde isolée pour le froid traverse la brume orangée de Titan. Posez-la sur la terre ferme (ou amerrissez sur un lac de méthane).',
    goal: 'Or : posé sur la terre ferme · Argent : amerri sur un lac · Bronze : sonde intacte',
    create(sys, sim) {
      const c = new Craft('Sonde Huygens');
      const pr = c.addRoot('probe_nexus');
      c.add('chute_m', pr, { type: 'top' });
      const cr = c.add('spec_cryo', pr, { type: 'bottom' });
      const ba = c.add('battery_s', cr, { type: 'bottom' });
      c.add('shield_m', ba, { type: 'bottom' });
      c.add('sci_goo', cr, { type: 'side', y: 0, psi: 0 });
      const v = Vessel.fromCraft(c.toJSON(), sys);
      const b = sys.get('titan');
      const r = b.radius + b.atmosphere.height + 10000;
      const a = 1.1;
      v.body = b;
      v.x = Math.cos(a) * r; v.y = Math.sin(a) * r;
      const gam = 18 * Math.PI / 180;
      const spd = 1900;
      v.vx = spd * (-Math.sin(a) * Math.cos(gam) - Math.cos(a) * Math.sin(gam));
      v.vy = spd * (Math.cos(a) * Math.cos(gam) - Math.sin(a) * Math.sin(gam));
      v.rot = Math.atan2(-v.vy, -v.vx) - Math.PI / 2 + Math.PI;
      v.launched = true;
      v.met0 = sim.ut;
      v.stages = [v.parts.filter((p) => p.def.chute).map((p) => p.uid)];
      v.stageIdx = 0;
      v.sas = 'retro';
      return v;
    },
    check(v) {
      if (!(v.landed || v.splashed) || v.body.id !== 'titan') return null;
      return { medal: v.splashed ? 'argent' : 'or', text: v.splashed ? 'Amerrissage sur un lac de méthane' : 'Posé sur la terre ferme' };
    },
  },
];

export const MEDALS = { or: { name: 'Or', color: '#ffcc4d' }, argent: { name: 'Argent', color: '#d7dee8' }, bronze: { name: 'Bronze', color: '#d08a4a' } };

export function bestMedals() {
  return load('medals', {});
}

export function saveMedal(id, medal) {
  const all = bestMedals();
  const rank = { or: 3, argent: 2, bronze: 1 };
  if (!all[id] || rank[medal] > rank[all[id]]) {
    all[id] = medal;
    store('medals', all);
    return true;
  }
  return false;
}

export { placeAbove, inOrbit };
