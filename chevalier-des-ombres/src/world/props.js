// Décors instanciés (tombes, arbres morts, sapins, rochers, champignons, cristaux…),
// regroupés par morceaux de terrain pour un culling efficace. Un seul matériau partagé.
import * as THREE from 'three';
import { PropBuilder, G, xf, SURF } from '../actors/rig.js';
import { makeRng } from '../core/utils.js';
import { settings } from '../core/settings.js';

const PI = Math.PI;

// Branche tordue récursive
function branch(pb, rng, base, dir, len, r, depth, color) {
  let p = base.clone();
  let d = dir.clone();
  const segs = 3;
  for (let i = 0; i < segs; i++) {
    const sl = len / segs;
    d.x += (rng() - 0.5) * 0.5;
    d.z += (rng() - 0.5) * 0.5;
    d.y += 0.1;
    d.normalize();
    const r0 = r * (1 - i / segs * 0.5);
    const r1 = r * (1 - (i + 1) / segs * 0.5);
    const mid = p.clone().addScaledVector(d, sl / 2);
    const g = G.cyl(r1, r0, sl * 1.08, 5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    const e = new THREE.Euler().setFromQuaternion(q);
    pb.add(xf(g, mid.toArray(), [e.x, e.y, e.z]), color, SURF.wood);
    p.addScaledVector(d, sl);
    if (depth > 0 && i >= 1 && rng() < 0.7) {
      const nd = new THREE.Vector3(d.x + (rng() - 0.5) * 2, d.y * 0.4 + 0.2, d.z + (rng() - 0.5) * 2).normalize();
      branch(pb, rng, p, nd, len * 0.55, r1 * 0.7, depth - 1, color);
    }
  }
}

const GEOS = {
  grave0: () => new PropBuilder().add(xf(G.box(0.7, 1.1, 0.18), [0, 0.5, 0]), 0x6a6670, SURF.stone).add(xf(G.box(0.8, 0.12, 0.3), [0, 0.03, 0]), 0x5a5660, SURF.stone),
  grave1: () =>
    new PropBuilder()
      .add(xf(G.box(0.16, 1.4, 0.16), [0, 0.65, 0]), 0x5a5660, SURF.stone)
      .add(xf(G.box(0.8, 0.16, 0.16), [0, 1.0, 0]), 0x5a5660, SURF.stone)
      .add(xf(G.box(0.5, 0.12, 0.4), [0, 0.02, 0]), 0x4a4650, SURF.stone),
  grave2: () =>
    new PropBuilder()
      .add(xf(G.box(0.6, 0.7, 0.16), [0, 0.35, 0]), 0x6e6a74, SURF.stone)
      .add(xf(G.cyl(0.3, 0.3, 0.16, 12, false), [0, 0.7, 0], [PI / 2, 0, 0]), 0x6e6a74, SURF.stone)
      .add(xf(G.box(0.7, 0.08, 1.4), [0, 0.02, 0.7]), 0x2a261e, SURF.leather),
  grave3: () =>
    new PropBuilder()
      .add(xf(G.box(0.4, 1.6, 0.4), [0, 0.8, 0]), 0x5a5660, SURF.stone)
      .add(xf(G.cone(0.32, 0.5, 4), [0, 1.85, 0], [0, PI / 4, 0]), 0x5a5660, SURF.stone)
      .add(xf(G.box(0.6, 0.2, 0.6), [0, 0.1, 0]), 0x4a4650, SURF.stone),
  deadTree: (rng, opts) => {
    const pb = new PropBuilder();
    const col = opts.burnt ? 0x1a1210 : 0x2a2220;
    pb.add(xf(G.cyl(0.18, 0.32, 1.2, 6), [0, 0.5, 0]), col, SURF.wood);
    branch(pb, rng, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), 4.5, 0.2, 2, col);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + rng();
      pb.add(xf(G.cone(0.1, 0.9, 4), [Math.cos(a) * 0.35, 0.12, Math.sin(a) * 0.35], [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3]), col, SURF.wood);
    }
    return pb;
  },
  pine: (rng, opts) => {
    const pb = new PropBuilder();
    const col = opts.color || 0x1a2a1c;
    pb.add(xf(G.cyl(0.14, 0.24, 2, 6), [0, 1, 0]), 0x2a1c14, SURF.wood);
    for (let i = 0; i < 4; i++) {
      const r = 1.9 - i * 0.4;
      pb.add(xf(G.cone(r, 2.2, 7), [0, 1.8 + i * 1.3, 0], [0, rng() * 2, 0]), col, [0.95, 0, 0]);
      if (opts.snow) pb.add(xf(G.cone(r * 0.75, 0.9, 7), [0, 2.4 + i * 1.3, 0], [0, rng() * 2, 0]), 0xe8f0ff, [0.8, 0, 0.05]);
    }
    return pb;
  },
  rock: (rng, opts) => {
    const pb = new PropBuilder();
    const g = G.dodeca(1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.75 + rng() * 0.5;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    pb.add(xf(g, [0, 0.3, 0]), opts.dark ? 0x1a1424 : 0x4a4652, SURF.stone);
    if (opts.snow) pb.add(xf(G.sphereP(0.8, 8, 4, 0, PI * 2, 0, PI / 2), [0, 0.65, 0], [0, 0, 0], [1, 0.4, 1]), 0xe8f0ff, [0.8, 0, 0.05]);
    return pb;
  },
  bush: (rng) => {
    const pb = new PropBuilder();
    for (let i = 0; i < 9; i++) {
      const a = rng() * PI * 2;
      const t = 0.3 + rng() * 0.6;
      pb.add(xf(G.cone(0.04, 1 + rng() * 0.6, 3), [Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15], [Math.sin(a) * t, 0, -Math.cos(a) * t]), 0x2a2018, SURF.wood);
    }
    return pb;
  },
  mushroom: (rng) => {
    const pb = new PropBuilder();
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const x = (rng() - 0.5) * 0.8;
      const z = (rng() - 0.5) * 0.8;
      const h = 0.3 + rng() * 0.6;
      pb.add(xf(G.cyl(0.05, 0.07, h, 5), [x, h / 2, z]), 0xc8c0b0, SURF.skin);
      pb.add(xf(G.sphereP(0.12 + h * 0.3, 8, 4, 0, PI * 2, 0, PI / 2), [x, h, z], [0, 0, 0], [1, 0.6, 1]), 0x9a4dff, [0.6, 0, 0.9]);
    }
    return pb;
  },
  crystal: (rng) => {
    const pb = new PropBuilder();
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const h = 0.8 + rng() * 2.2;
      const a = rng() * PI * 2;
      pb.add(xf(G.octa(0.3), [Math.cos(a) * 0.3, h * 0.45, Math.sin(a) * 0.3], [(rng() - 0.5) * 0.5, rng(), (rng() - 0.5) * 0.5], [0.6, h, 0.6]), i % 2 ? 0xb06aff : 0x7a3cff, [0.15, 0.3, 0.9]);
    }
    return pb;
  },
  iceSpike: (rng) => {
    const pb = new PropBuilder();
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const h = 1 + rng() * 2.5;
      const a = rng() * PI * 2;
      pb.add(xf(G.cone(0.3 + rng() * 0.2, h, 5), [Math.cos(a) * 0.4, h / 2, Math.sin(a) * 0.4], [(rng() - 0.5) * 0.4, 0, (rng() - 0.5) * 0.4]), 0xa8d8ff, [0.1, 0.3, 0.25]);
    }
    return pb;
  },
  lavaRock: (rng) => {
    const pb = new PropBuilder();
    const g = G.dodeca(1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.8 + rng() * 0.4;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 1.3, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    pb.add(xf(g, [0, 0.8, 0]), 0x140c0a, SURF.stone);
    for (let i = 0; i < 3; i++) pb.add(xf(G.box(0.06, 1.2, 0.06), [(rng() - 0.5) * 0.9, 0.9, 0.85], [0, 0, (rng() - 0.5) * 1.2]), 0xff5a0a, SURF.glow);
    return pb;
  },
  bones: (rng) => {
    const pb = new PropBuilder();
    pb.add(xf(G.sphere(0.12, 8, 6), [0, 0.1, 0], [0.3, rng() * 3, 0.2]), 0xd8cfb0, SURF.bone);
    for (let i = 0; i < 4; i++) pb.add(xf(G.cyl(0.025, 0.025, 0.45, 4), [(rng() - 0.5) * 0.6, 0.03, (rng() - 0.5) * 0.6], [PI / 2, rng() * 3, 0]), 0xd8cfb0, SURF.bone);
    return pb;
  },
  candle: (rng) => {
    const pb = new PropBuilder();
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const h = 0.15 + rng() * 0.35;
      const x = (rng() - 0.5) * 0.5;
      const z = (rng() - 0.5) * 0.5;
      pb.add(xf(G.cyl(0.035, 0.04, h, 6), [x, h / 2, z]), 0xe8e0c8, SURF.skin);
      pb.add(xf(G.cone(0.02, 0.07, 4), [x, h + 0.04, z]), 0xffb050, [1, 0, 2.5]);
    }
    return pb;
  },
  stump: (rng) => {
    const pb = new PropBuilder();
    pb.add(xf(G.cyl(0.4, 0.55, 0.6, 7), [0, 0.3, 0]), 0x2a2018, SURF.wood);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + rng();
      pb.add(xf(G.cone(0.14, 0.9, 4), [Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5], [Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4]), 0x2a2018, SURF.wood);
    }
    return pb;
  },
  reed: (rng) => {
    const pb = new PropBuilder();
    for (let i = 0; i < 10; i++) {
      const h = 0.8 + rng() * 1.2;
      pb.add(xf(G.cyl(0.015, 0.02, h, 3), [(rng() - 0.5) * 0.7, h / 2, (rng() - 0.5) * 0.7], [(rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3]), 0x4a5a2a, SURF.cloth);
      if (rng() < 0.4) pb.add(xf(G.cyl(0.035, 0.035, 0.2, 4), [(rng() - 0.5) * 0.7, h, (rng() - 0.5) * 0.7]), 0x3a2414, SURF.cloth);
    }
    return pb;
  },
  floatRock: (rng) => {
    const pb = new PropBuilder();
    pb.add(xf(G.cone(1.6, 3, 6), [0, 0, 0], [PI, rng(), 0]), 0x1a1424, SURF.stone);
    pb.add(xf(G.cyl(1.6, 1.6, 0.4, 6), [0, 1.6, 0]), 0x2a2034, SURF.stone);
    pb.add(xf(G.octa(0.3), [0, 2.2, 0], [0, 0, 0], [0.6, 2, 0.6]), 0xb06aff, [0.15, 0.3, 0.9]);
    return pb;
  },
};

// Paramètres par type : variantes, collision, échelle, placement
const TYPES = {
  grave: { variants: ['grave0', 'grave1', 'grave2', 'grave3'], radius: 0.4, height: 1.4, scale: [0.85, 1.2], shadow: true },
  deadTree: { variants: ['deadTree', 'deadTree', 'deadTree'], radius: 0.35, height: 9, scale: [0.8, 1.5], shadow: true, avoidWater: true },
  pine: { variants: ['pine', 'pine'], radius: 0.4, height: 9, scale: [0.9, 1.6], shadow: true, avoidWater: true },
  rock: { variants: ['rock', 'rock'], radius: 0.9, height: 1.2, scale: [0.6, 2.2], shadow: true, radiusScale: true },
  bush: { variants: ['bush'], scale: [0.7, 1.3] },
  mushroom: { variants: ['mushroom', 'mushroom'], scale: [0.8, 1.8] },
  crystal: { variants: ['crystal', 'crystal'], radius: 0.6, height: 2.5, scale: [0.7, 1.8], radiusScale: true },
  iceSpike: { variants: ['iceSpike', 'iceSpike'], radius: 0.6, height: 2.5, scale: [0.7, 1.6], radiusScale: true },
  lavaRock: { variants: ['lavaRock', 'lavaRock'], radius: 0.9, height: 2, scale: [0.6, 1.8], radiusScale: true, shadow: true },
  bones: { variants: ['bones'], scale: [0.8, 1.3] },
  candle: { variants: ['candle', 'candle'], scale: [0.9, 1.3] },
  stump: { variants: ['stump'], radius: 0.5, height: 0.6, scale: [0.8, 1.4] },
  reed: { variants: ['reed', 'reed'], scale: [0.8, 1.4], preferWater: true },
  floatRock: { variants: ['floatRock', 'floatRock'], scale: [0.6, 1.8], float: true },
};

export function buildProps(zone, terrain, colliders, material, avoid, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const size = terrain.size;
  const half = terrain.half;
  const border = zone.terrain.border || 0;
  const inner = half - Math.max(4, border * 0.55);
  const chunks = 3;
  const chunkSize = size / chunks;
  const chunkGroups = [];
  for (let cz = 0; cz < chunks; cz++)
    for (let cx = 0; cx < chunks; cx++) {
      const g = new THREE.Group();
      g.userData.center = new THREE.Vector3(-half + (cx + 0.5) * chunkSize, 0, -half + (cz + 0.5) * chunkSize);
      g.userData.radius = chunkSize * 0.75;
      group.add(g);
      chunkGroups.push(g);
    }
  const density = settings.get('propDensity');
  const water = zone.terrain.water ? zone.terrain.water.level : zone.terrain.lava ? zone.terrain.lava.level : -999;
  const dummy = new THREE.Object3D();
  const shadowsOn = settings.get('shadows') === 'high' || settings.get('shadows') === 'ultra';
  for (const spec of zone.props) {
    const type = TYPES[spec.type];
    if (!type) continue;
    const count = Math.round(((spec.density * size * size) / 1000) * density);
    // Géométries des variantes
    const variants = type.variants.map((v, i) => {
      const vr = makeRng(seed + i * 101 + spec.type.length * 7);
      return GEOS[v](vr, spec).buildGeometry();
    });
    const buckets = variants.map(() => chunkGroups.map(() => []));
    let placed = 0;
    let tries = 0;
    while (placed < count && tries < count * 6) {
      tries++;
      const x = (rng() * 2 - 1) * inner;
      const z = (rng() * 2 - 1) * inner;
      if (terrain.pathAt(x, z) > 0.25 && spec.type !== 'candle' && spec.type !== 'bones') continue;
      if (avoid(x, z, type.radius || 0.5)) continue;
      const y = terrain.heightAt(x, z);
      if (type.avoidWater && y < water + 0.3) continue;
      if (type.preferWater && water > -900 && (y > water + 0.8 || y < water - 1.2)) continue;
      const s = type.scale[0] + rng() * (type.scale[1] - type.scale[0]);
      const r = (type.radius || 0) * (type.radiusScale ? s : 1);
      if (r > 0) {
        const near = colliders.query(x, z, r + 0.5);
        let blocked = false;
        for (const c of near) {
          if (c.type === 0 && Math.hypot(c.x - x, c.z - z) < c.r + r + 0.3) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        colliders.addCircle(x, z, r, y - 1, y + (type.height || 2) * s);
      }
      const vi = Math.floor(rng() * variants.length);
      dummy.position.set(x, y + (type.float ? 3 + rng() * 5 : -0.05), z);
      dummy.rotation.set(spec.type === 'grave' ? (rng() - 0.5) * 0.12 : 0, rng() * PI * 2, spec.type === 'grave' ? (rng() - 0.5) * 0.12 : 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      const ci = Math.min(chunks - 1, Math.floor((x + half) / chunkSize)) + Math.min(chunks - 1, Math.floor((z + half) / chunkSize)) * chunks;
      buckets[vi][ci].push(dummy.matrix.clone());
      placed++;
    }
    variants.forEach((geo, vi) => {
      buckets[vi].forEach((mats, ci) => {
        if (!mats.length) return;
        const im = new THREE.InstancedMesh(geo, material, mats.length);
        mats.forEach((m, k) => im.setMatrixAt(k, m));
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = !!type.shadow && shadowsOn;
        im.receiveShadow = false;
        chunkGroups[ci].add(im);
      });
    });
  }
  group.userData.chunks = chunkGroups;
  return group;
}

// Masque les morceaux trop loin (au-delà du brouillard)
export function cullProps(group, camPos, maxDist) {
  for (const g of group.userData.chunks) {
    const d = Math.hypot(g.userData.center.x - camPos.x, g.userData.center.z - camPos.z);
    g.visible = d < maxDist + g.userData.radius;
  }
}
