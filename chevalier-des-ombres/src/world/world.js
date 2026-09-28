// Construction et gestion d'une région : plan (chemins, zones aplanies), relief, bâtiments,
// décors, eau/lave, lumières recyclées, feux, points d'interaction et camps d'ennemis.
import * as THREE from 'three';
import { ZONES } from '../data/zones.js';
import { makeRng, hashString, dist2 } from '../core/utils.js';
import { settings } from '../core/settings.js';
import { Terrain } from './terrain.js';
import { CollisionWorld } from './colliders.js';
import { StructureBuilder } from './structures.js';
import { buildProps, cullProps } from './props.js';
import { Mats } from '../gfx/materials.js';

const PI = Math.PI;
const LIGHT_POOL = 4;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.colliders = new CollisionWorld(8);
    this.zone = null;
    this.lightPool = [];
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xff8a3a, 0, 12, 2);
      l.castShadow = false;
      scene.add(l);
      this.lightPool.push(l);
    }
    this.lights = [];
    this.fires = [];
    this.interactables = [];
    this.lightTimer = 0;
    this.time = 0;
  }

  heightAt(x, z) {
    return this.terrain ? this.terrain.heightAt(x, z) : 0;
  }

  // Niveau du liquide (eau/lave) : -Infinity si aucun
  get liquidLevel() {
    const t = this.zone && this.zone.terrain;
    if (!t) return -Infinity;
    if (t.water) return t.water.level;
    if (t.lava) return t.lava.level;
    return -Infinity;
  }

  unload() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    if (this.terrain) this.terrain.mesh.material.dispose();
    this.group.clear();
    this.colliders.clear();
    this.lights = [];
    this.fires = [];
    this.interactables = [];
    for (const l of this.lightPool) l.intensity = 0;
  }

  load(zoneId, charMaterial) {
    this.unload();
    const zone = ZONES[zoneId];
    this.zone = zone;
    const seed = hashString(zoneId) % 100000;
    const rng = makeRng(seed);
    const plan = planZone(zone, rng);
    this.plan = plan;
    this.terrain = new Terrain(zone.terrain, seed, { flats: plan.flats, paths: plan.paths });
    this.group.add(this.terrain.mesh);
    this.colliders.bounds = { half: this.terrain.half - (zone.terrain.border ? zone.terrain.border * 0.45 : 1) };
    const sb = new StructureBuilder(this.colliders, this.terrain, seed + 5);
    // Liquides
    const liq = zone.terrain.water || zone.terrain.lava;
    if (liq) {
      const g = new THREE.PlaneGeometry(zone.terrain.size, zone.terrain.size, 1, 1);
      g.rotateX(-PI / 2);
      const m = new THREE.Mesh(g, zone.terrain.water ? Mats.water(zone.terrain.water.color) : Mats.lava());
      m.position.y = liq.level;
      m.receiveShadow = !!zone.terrain.water;
      this.group.add(m);
      if (zone.terrain.lava) {
        const t = m.material.map;
        if (t) t.repeat.set(20, 20);
      }
    }
    // Bâtiments
    for (const p of plan.placements) {
      const fn = sb[p.kind];
      if (fn) fn.apply(sb, p.args);
    }
    sb.finalize(this.group);
    this.lights = sb.lights;
    this.fires = sb.fires;
    // Décors
    const avoid = (x, z, r) => {
      for (const f of plan.flats) if (dist2(x, z, f.x, f.z) < f.r + r + 1) return true;
      for (const a of plan.avoid) if (dist2(x, z, a.x, a.z) < a.r + r) return true;
      return false;
    };
    this.props = buildProps(zone, this.terrain, this.colliders, charMaterial, avoid, seed + 9);
    this.group.add(this.props);
    // Interactions
    this.interactables = plan.interactables.map((it) => ({ ...it, y: this.heightAt(it.x, it.z) }));
    return plan;
  }

  // Distance de visibilité liée au brouillard
  get viewDistance() {
    const z = this.zone;
    if (!z) return 100;
    const dens = z.palette.fogDensity * fogMul();
    return Math.min(220, 2.4 / dens);
  }

  update(dt, camPos, particles, particlesAlpha, playerPos) {
    this.time += dt;
    if (this.props) cullProps(this.props, camPos, this.viewDistance);
    // Attribution des lumières recyclées aux sources les plus proches du joueur
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.3;
      const ref = playerPos || camPos;
      const sorted = this.lights
        .map((l) => ({ l, d: (l.x - ref.x) ** 2 + (l.z - ref.z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, LIGHT_POOL);
      this.lightPool.forEach((pl, i) => {
        const s = sorted[i];
        pl.userData.src = s ? s.l : null;
      });
    }
    for (const pl of this.lightPool) {
      const s = pl.userData.src;
      if (!s) {
        pl.intensity = 0;
        continue;
      }
      pl.position.set(s.x, s.y, s.z);
      pl.color.setHex(s.color);
      pl.distance = s.dist;
      const fl = 1 + (Math.sin(this.time * 13 + s.x) * 0.5 + Math.sin(this.time * 7.3 + s.z) * 0.5) * 0.18 * s.flicker;
      pl.intensity = s.intensity * fl;
    }
    // Flammes (particules) près de la caméra
    const budget = particles.budget;
    for (const f of this.fires) {
      const d2 = (f.x - camPos.x) ** 2 + (f.z - camPos.z) ** 2;
      if (d2 > 45 * 45) continue;
      if (Math.random() < 0.9 * budget * f.scale) {
        particles.spawn(f.x + (Math.random() - 0.5) * 0.3 * f.scale, f.y, f.z + (Math.random() - 0.5) * 0.3 * f.scale, (Math.random() - 0.5) * 0.3, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.4, 0.5 * f.scale, f.color, { drag: 0.96, intensity: 2.2 });
      }
      if (Math.random() < 0.12 * budget) {
        particles.spawn(f.x, f.y + 0.3, f.z, (Math.random() - 0.5) * 0.8, 2 + Math.random() * 2, (Math.random() - 0.5) * 0.8, 1.2, 0.08, 0xffc070, { drag: 0.98, intensity: 3 });
      }
      if (Math.random() < 0.05 * budget) particlesAlpha.spawn(f.x, f.y + 0.8, f.z, 0, 1, 0, 2, 0.8, 0x151015, { grow: 2, alpha: 0.35, drag: 0.98 });
    }
  }
}

export function fogMul() {
  const d = settings.get('drawDistance');
  return d === 'short' ? 1.35 : d === 'long' ? 0.72 : 1;
}

// ======================= PLANS DES RÉGIONS =======================
function planZone(zone, rng) {
  const P = { flats: [], paths: [], placements: [], interactables: [], avoid: [], camps: [], chests: [], page: null };
  const add = (kind, ...args) => P.placements.push({ kind, args });
  const flat = (x, z, r, h) => P.flats.push({ x, z, r, h });
  const half = zone.terrain.size / 2;
  const border = zone.terrain.border || 0;
  const inner = half - border - 6;

  // Entrée
  const e = zone.entry;
  flat(e.x, e.z, 10);
  // Autels
  for (const a of zone.altars || []) {
    flat(a.x, a.z, 6);
    add('altar', a.x, a.z);
    P.interactables.push({ type: 'altar', id: a.id, name: a.name, x: a.x, z: a.z, r: 3 });
  }
  // Arènes de boss
  for (const ar of zone.arenas || []) {
    flat(ar.x, ar.z, ar.r + 4);
    P.avoid.push({ x: ar.x, z: ar.z, r: ar.r + 6 });
  }
  // Points d'intérêt
  for (const poi of zone.pois || []) {
    flat(poi.x, poi.z, 6);
    P.avoid.push({ x: poi.x, z: poi.z, r: 7 });
  }
  // Chemins : entrée → centre → gardien, puis embranchements
  if (!zone.indoor) {
    const arenas = zone.arenas || [];
    const guardian = arenas.find((a) => a.boss && a.x === 0) || arenas[arenas.length - 1];
    const mid = (zone.altars && zone.altars[1]) || { x: 0, z: 0 };
    if (guardian) {
      P.paths.push([{ x: e.x, z: e.z }, { x: (e.x + mid.x) / 2 + (rng() - 0.5) * 20, z: (e.z + mid.z) / 2 }, { x: mid.x, z: mid.z }, { x: (mid.x + guardian.x) / 2 + (rng() - 0.5) * 20, z: (mid.z + guardian.z) / 2 }, { x: guardian.x, z: guardian.z }]);
      for (const ar of arenas) if (ar !== guardian) P.paths.push([{ x: mid.x, z: mid.z }, { x: (mid.x + ar.x) / 2 + (rng() - 0.5) * 16, z: (mid.z + ar.z) / 2 + (rng() - 0.5) * 16 }, { x: ar.x, z: ar.z }]);
      for (const poi of zone.pois || []) if (rng() < 0.6) P.paths.push([{ x: mid.x, z: mid.z }, { x: poi.x, z: poi.z }]);
    }
  }

  const style = zone.structures;
  const S = STYLES[style];
  if (S) S(P, zone, rng, add, flat);

  // Arènes : anneaux de pierres
  const ringStyle = { frost: 'ice', void: 'crystal', inferno: 'spike', forest: 'root', swamp: 'root' }[zone.id] || 'stone';
  if (!zone.indoor) for (const ar of zone.arenas || []) add('arenaRing', ar.x, ar.z, ar.r, ringStyle);
  for (const ar of zone.arenas || []) P.interactables.push({ type: 'arena', boss: ar.boss, x: ar.x, z: ar.z, r: ar.r });
  for (const poi of zone.pois || []) P.interactables.push({ type: 'poi', id: poi.id, name: poi.name, x: poi.x, z: poi.z, r: 4 });

  if (zone.safe) return P;

  // Camps d'ennemis
  const occupied = (x, z, r) => {
    if (dist2(x, z, e.x, e.z) < 28) return true;
    for (const f of P.flats) if (dist2(x, z, f.x, f.z) < f.r + r) return true;
    for (const a of P.avoid) if (dist2(x, z, a.x, a.z) < a.r + r) return true;
    for (const c of P.camps) if (dist2(x, z, c.x, c.z) < 22) return true;
    return false;
  };
  let tries = 0;
  const inset = zone.indoor ? 70 : inner;
  while (P.camps.length < zone.camps && tries < 400) {
    tries++;
    const x = (rng() * 2 - 1) * inset;
    const z = (rng() * 2 - 1) * inset;
    if (occupied(x, z, 6)) continue;
    const pool = zone.pools[P.camps.length % zone.pools.length];
    P.camps.push({ x, z, pool, id: zone.id + '_camp' + P.camps.length });
  }
  // Coffres (et mimics)
  tries = 0;
  let mimics = zone.mimics || 0;
  while (P.chests.length < (zone.chests || 0) && tries < 300) {
    tries++;
    const x = (rng() * 2 - 1) * inset;
    const z = (rng() * 2 - 1) * inset;
    if (occupied(x, z, 3)) continue;
    const isMimic = mimics > 0 && rng() < 0.5;
    if (isMimic) mimics--;
    P.chests.push({ id: zone.id + '_chest' + P.chests.length, x, z, rot: rng() * PI * 2, mimic: isMimic });
    P.avoid.push({ x, z, r: 2 });
  }
  // Page du grimoire
  tries = 0;
  while (!P.page && tries < 200) {
    tries++;
    const x = (rng() * 2 - 1) * inset;
    const z = (rng() * 2 - 1) * inset;
    if (occupied(x, z, 3) || dist2(x, z, e.x, e.z) < 50) continue;
    P.page = { id: 'page_' + zone.id, x, z };
  }
  return P;
}

// Emplacement libre aléatoire (pour décors de style)
function freeSpot(P, rng, inner, r, e) {
  for (let t = 0; t < 60; t++) {
    const x = (rng() * 2 - 1) * inner;
    const z = (rng() * 2 - 1) * inner;
    let ok = !(e && dist2(x, z, e.x, e.z) < 16);
    for (const f of P.flats) if (ok && dist2(x, z, f.x, f.z) < f.r + r) ok = false;
    for (const a of P.avoid) if (ok && dist2(x, z, a.x, a.z) < a.r + r) ok = false;
    if (ok) {
      P.avoid.push({ x, z, r });
      return { x, z };
    }
  }
  return null;
}

const STYLES = {
  hub(P, zone, rng, add, flat) {
    flat(0, 0, 18, 0.2);
    flat(0, -30, 9, 0.4);
    add('floorDisc', 0, 0, 15, 'cobble');
    const portal = { x: 0, z: -32 };
    add('portal', portal.x, portal.z, 0);
    P.interactables.push({ type: 'portal', id: 'hub_portal', name: 'Portail des Âmes', x: portal.x, z: portal.z + 1.5, r: 5 });
    // Personnages
    const npcs = [
      { id: 'anselme', x: -4, z: 9, rot: 0.6 },
      { id: 'gorvald', x: -21, z: 3, rot: 1.4 },
      { id: 'isolde', x: 19, z: 4, rot: -1.4 },
      { id: 'maelis', x: -15, z: -17, rot: 0.8 },
      { id: 'roderic', x: 15, z: -15, rot: -0.8 },
    ];
    for (const n of npcs) {
      P.interactables.push({ type: 'npc', id: n.id, x: n.x, z: n.z, rot: n.rot, r: 3 });
      P.avoid.push({ x: n.x, z: n.z, r: 4 });
    }
    flat(-24, 2, 8, 0.3);
    add('forge', -25, 2, PI / 2);
    add('tent', 23, 4, -PI / 2, 'clothRed', 3.6);
    add('crates', 21, -1);
    add('tent', -19, -20, 0.4, 'clothPurple', 3.4);
    add('brazier', -15, -14, 0x9a4dff);
    add('tent', 19, -18, -0.5, 'clothTan', 3);
    add('crates', 12, -19);
    flat(23, 4, 7, 0.3);
    flat(-19, -19, 6, 0.3);
    flat(19, -18, 6, 0.3);
    for (const [x, z, r] of [[-32, 20, 0.3], [30, 22, -0.4], [-34, -4, 1.3], [34, 0, -1.4], [-28, -30, 0.8], [30, -32, -0.7]]) {
      add('house', x, z, r, rng() < 0.5);
      flat(x, z, 6);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.2;
      add('brazier', Math.cos(a) * 12.5, Math.sin(a) * 12.5, 0xff7a2a);
    }
    add('statue', -7, -22, PI * 0.15);
    add('statue', 7, -22, -PI * 0.15);
    add('well', 8, 12);
    // Remparts avec deux ouvertures (sud et nord)
    const R = 44;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * PI * 2;
      pts.push({ x: Math.cos(a) * R, z: Math.sin(a) * R });
    }
    for (let i = 0; i < 16; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const mz = (a.z + b.z) / 2;
      const mx = (a.x + b.x) / 2;
      if (Math.abs(mx) < 12 && Math.abs(mz) > 30) continue;
      add('wallLine', a.x, a.z, b.x, b.z, 5, 'stone', true);
    }
    for (const [x, z] of [[-10, 42], [10, 42], [-10, -42], [10, -42]]) add('tower', x, z, 2.6, 11, 'glowOrange');
  },

  graveyard(P, zone, rng, add, flat) {
    const e = zone.entry;
    add('gate', e.x, e.z - 8, 0);
    add('fenceLine', -60, e.z - 8, -4.2, e.z - 8);
    add('fenceLine', 4.2, e.z - 8, 60, e.z - 8);
    add('chapelRuin', -8, -4, 0);
    flat(-8, -4, 14);
    const crypt = zone.pois.find((p) => p.id === 'gy_crypt');
    add('mausoleum', crypt.x, crypt.z - 3, PI, true, 'glowGreen');
    const well = zone.pois.find((p) => p.id === 'gy_well');
    add('well', well.x, well.z);
    const oss = zone.pois.find((p) => p.id === 'gy_ossuary');
    add('ossuary', oss.x, oss.z);
    for (let i = 0; i < 9; i++) {
      const s = freeSpot(P, rng, 90, 8, e);
      if (s) {
        add('mausoleum', s.x, s.z, rng() * PI * 2, false, rng() < 0.3 ? 'glowGreen' : null);
        flat(s.x, s.z, 6);
      }
    }
    for (let i = 0; i < 6; i++) {
      const s = freeSpot(P, rng, 95, 3, e);
      if (s) add('bigCross', s.x, s.z);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(P, rng, 90, 2, e);
      if (s) {
        const len = 8 + rng() * 14;
        const a = rng() * PI;
        add('fenceLine', s.x, s.z, s.x + Math.cos(a) * len, s.z + Math.sin(a) * len);
      }
    }
    // Lanternes le long du chemin principal
    for (let i = 0; i < 10; i++) add('lantern', (i % 2 ? 4 : -4) + (rng() - 0.5), 88 - i * 18);
  },

  forest(P, zone, rng, add, flat) {
    const camp = zone.altars[1];
    add('tent', camp.x - 6, camp.z - 3, 0.5, 'clothGreen', 2.6);
    add('tent', camp.x + 6, camp.z - 4, -0.4, 'clothTan', 2.4);
    add('campfire', camp.x, camp.z - 7);
    add('crates', camp.x + 5, camp.z + 4);
    const p1 = zone.pois[0];
    const p2 = zone.pois[1];
    const p3 = zone.pois[2];
    add('cart', p1.x, p1.z, 0.7);
    add('watchtower', p2.x, p2.z, 0.3);
    add('stoneCircle', p3.x, p3.z, 6, 'glowPurple');
    const q = zone.arenas.find((a) => a.boss === 'spider_queen');
    if (q) add('webs', q.x, q.z, q.r);
    for (let i = 0; i < 7; i++) {
      const s = freeSpot(P, rng, 90, 7);
      if (s) {
        add('house', s.x, s.z, rng() * PI * 2, true);
        flat(s.x, s.z, 5);
      }
    }
    for (let i = 0; i < 4; i++) {
      const s = freeSpot(P, rng, 90, 6);
      if (s) add('stoneCircle', s.x, s.z, 4, 'glowPurple');
    }
  },

  swamp(P, zone, rng, add, flat) {
    const e = zone.entry;
    add('walkway', e.x, e.z - 2, e.x, e.z - 22, 0.9);
    const hut = zone.altars[1];
    add('hut', hut.x - 6, hut.z - 5, 0.3);
    for (const poi of zone.pois) add('totem', poi.x, poi.z);
    for (let i = 0; i < 7; i++) {
      const s = freeSpot(P, rng, 90, 7);
      if (s) {
        add('hut', s.x, s.z, rng() * PI * 2);
        if (rng() < 0.6) add('walkway', s.x, s.z + 3, s.x + (rng() - 0.5) * 20, s.z + 14, 0.9);
      }
    }
    for (let i = 0; i < 6; i++) {
      const s = freeSpot(P, rng, 95, 3);
      if (s) add('boat', s.x, s.z, rng() * PI * 2);
    }
    for (let i = 0; i < 6; i++) {
      const s = freeSpot(P, rng, 90, 2);
      if (s) add('totem', s.x, s.z);
    }
  },

  catacombs(P, zone, rng, add) {
    const rooms = [
      ...zone.arenas.map((a) => ({ x: a.x, z: a.z, r: a.r + 2 })),
      ...zone.altars.map((a) => ({ x: a.x, z: a.z, r: 8 })),
      ...zone.pois.map((p) => ({ x: p.x, z: p.z, r: 8 })),
      { x: 0, z: 80, r: 10 },
    ];
    add('catacombMaze', zone.terrain.size, rooms);
    for (const poi of zone.pois) add('seal', poi.x, poi.z);
    for (let i = 0; i < 16; i++) {
      const s = freeSpot(P, rng, 80, 3);
      if (s) add('sarcophagus', s.x, s.z, rng() < 0.5 ? 0 : PI / 2);
    }
    for (const a of zone.arenas) {
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * PI * 2;
        add('brazier', a.x + Math.cos(ang) * (a.r - 2), a.z + Math.sin(ang) * (a.r - 2), 0xb04dff);
      }
    }
  },

  castle(P, zone, rng, add, flat) {
    // Muraille avec porte
    add('wallLine', -105, 32, 105, 32, 7, 'stone', true, { x: 0, z: 32, r: 7 });
    for (const x of [-100, -75, -50, -25, 25, 50, 75, 100]) add('tower', x, 32, 3, 13, 'glowGreen');
    add('tower', -8, 32, 3.5, 16, 'glowGreen');
    add('tower', 8, 32, 3.5, 16, 'glowGreen');
    // Donjon et tours (cf. château vert de référence)
    add('castleKeep', 0, -92);
    flat(0, -92, 22, 6);
    for (const [x, z] of [[-40, -70], [40, -70], [-70, -40], [70, -45]]) add('tower', x, z, 3.5, 20, 'glowGreen');
    add('wallLine', -70, -40, -40, -70, 8, 'stone', true);
    add('wallLine', 40, -70, 70, -45, 8, 'stone', true);
    add('wallLine', -40, -70, -18, -80, 8, 'stone', true);
    add('wallLine', 18, -80, 40, -70, 8, 'stone', true);
    // Cour
    const court = zone.altars[1];
    add('floorDisc', court.x - 8, court.z - 4, 16, 'cobble');
    add('floorDisc', 0, -55, 24, 'cobble');
    for (let i = 0; i < 6; i++) add('brazier', -14 + i * 5.6, -36, 0x39ff6a);
    add('statue', -12, 20, 0.3);
    add('statue', 12, 20, -0.3);
    // Chapelle et bibliothèque
    const ch = zone.pois.find((p) => p.id === 'cs_chapel');
    add('chapelRuin', ch.x, ch.z - 6, PI * 0.1);
    flat(ch.x, ch.z - 6, 13);
    const lib = zone.pois.find((p) => p.id === 'cs_library');
    add('house', lib.x, lib.z - 7, 0.2, false);
    add('house', lib.x + 9, lib.z - 5, -0.3, false);
    for (let i = 0; i < 8; i++) add('lantern', (i % 2 ? 4.5 : -4.5), 88 - i * 8);
    for (let i = 0; i < 5; i++) {
      const s = freeSpot(P, rng, 85, 7);
      if (s && s.z > 40) {
        add('house', s.x, s.z, rng() * PI * 2, true);
        flat(s.x, s.z, 5);
      }
    }
  },

  frost(P, zone, rng, add, flat) {
    const t = zone.altars[1];
    add('iceTemple', t.x - 2, t.z - 2);
    flat(t.x - 2, t.z - 2, 11);
    const camp = zone.pois.find((p) => p.id === 'fr_camp');
    add('tent', camp.x - 3, camp.z, 0.4, 'clothTan', 2.2);
    add('tent', camp.x + 4, camp.z - 2, -0.3, 'clothRed', 2.2);
    add('crates', camp.x, camp.z + 4);
    const st = zone.pois.find((p) => p.id === 'fr_statue');
    add('statue', st.x, st.z, 0.5, 6);
    const cave = zone.pois.find((p) => p.id === 'fr_cave');
    add('caveArch', cave.x, cave.z, 0.3);
    for (let i = 0; i < 6; i++) {
      const s = freeSpot(P, rng, 90, 6);
      if (s) add('stoneCircle', s.x, s.z, 4, 'glowPurple');
    }
    for (let i = 0; i < 5; i++) {
      const s = freeSpot(P, rng, 90, 7);
      if (s) {
        add('house', s.x, s.z, rng() * PI * 2, true);
        flat(s.x, s.z, 5);
      }
    }
  },

  inferno(P, zone, rng, add, flat) {
    const forge = zone.altars[1];
    add('forge', forge.x - 8, forge.z - 2, PI / 2);
    flat(forge.x - 8, forge.z - 2, 7);
    for (const poi of zone.pois) add('demonAltar', poi.x, poi.z);
    for (let i = 0; i < 16; i++) {
      const s = freeSpot(P, rng, 95, 3);
      if (s) add('obsidianSpire', s.x, s.z);
    }
    for (let i = 0; i < 5; i++) {
      const s = freeSpot(P, rng, 90, 6);
      if (s) add('voidArch', s.x, s.z, rng() * PI);
    }
    add('gate', zone.entry.x, zone.entry.z - 8, 0, 'darkStone');
  },

  void(P, zone, rng, add, flat) {
    for (const poi of zone.pois) add('shardPedestal', poi.x, poi.z);
    for (let i = 0; i < 14; i++) {
      const s = freeSpot(P, rng, 95, 3);
      if (s) add('crystalSpire', s.x, s.z, 5 + rng() * 10);
    }
    for (let i = 0; i < 8; i++) {
      const s = freeSpot(P, rng, 90, 6);
      if (s) add('voidArch', s.x, s.z, rng() * PI);
    }
    for (const [x, z] of [[-30, -105], [30, -105], [0, -112], [-55, -100], [55, -100]]) add('tower', x, z, 4, 28, 'glowPurple', 'darkStone');
    add('floorDisc', 0, -90, 22, 'tiles');
  },
};
