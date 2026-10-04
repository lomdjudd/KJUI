// Île procédurale : relief, océan, biomes, végétation et ressources récoltables.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeNoise } from '../core/noise.js';
import { mulberry, clamp, lerp } from '../core/util.js';
import { G } from '../core/state.js';

export const SIZE = 1400;
const SEG = 240;
export const WATER = 0;

// ---------- Définitions des ressources ----------
// gather : objets obtenus. need : outil requis (kind) et niveau. hp : nombre de coups.
export const NODE_TYPES = {
  arbre: { name: 'Arbre', gather: { bois: 2 }, hand: { baton: 1 }, need: 'axe', tier: 0, hp: 4, respawn: 600, collide: 0.5, bonus: { fruit: 0.25, baton: 0.4 } },
  sapin: { name: 'Sapin', gather: { bois: 3 }, hand: { baton: 1 }, need: 'axe', tier: 0, hp: 5, respawn: 700, collide: 0.5, bonus: { baton: 0.4 } },
  palmier: { name: 'Palmier', gather: { bois: 2 }, hand: { fruit: 1 }, need: 'axe', tier: 0, hp: 3, respawn: 600, collide: 0.4, bonus: { fibre: 0.5 } },
  buisson: { name: 'Buisson à baies', gather: { baies: 2 }, need: null, hp: 1, respawn: 240, food: true },
  herbes: { name: 'Hautes herbes', gather: { fibre: 2 }, need: null, hp: 1, respawn: 180, bonus: { ble: 0.15 } },
  rocher: { name: 'Rocher', gather: { pierre: 3 }, hand: { pierre: 1 }, need: 'pick', tier: 0, hp: 5, respawn: 900, collide: 0.9, bonus: { silex: 0.35 } },
  cuivre: { name: 'Filon de cuivre', gather: { cuivre: 2 }, need: 'pick', tier: 1, hp: 6, respawn: 1200, collide: 0.8, color: 0xd07a3a },
  etain: { name: 'Filon d’étain', gather: { etain: 2 }, need: 'pick', tier: 1, hp: 6, respawn: 1200, collide: 0.8, color: 0xc8c8d0 },
  charbon: { name: 'Gisement de charbon', gather: { charbon: 3 }, need: 'pick', tier: 1, hp: 6, respawn: 1200, collide: 0.8, color: 0x1a1a1a },
  soufre: { name: 'Gisement de soufre', gather: { soufre: 2 }, need: 'pick', tier: 1, hp: 5, respawn: 1200, collide: 0.8, color: 0xe8d020 },
  fer: { name: 'Filon de fer', gather: { fer_brut: 2 }, need: 'pick', tier: 2, hp: 8, respawn: 1500, collide: 0.8, color: 0x9a5a3a },
  or: { name: 'Filon d’or', gather: { or_brut: 1 }, need: 'pick', tier: 2, hp: 8, respawn: 2400, collide: 0.8, color: 0xffd030 },
  silicium: { name: 'Quartz (silicium)', gather: { silicium: 2 }, need: 'pick', tier: 2, hp: 7, respawn: 1800, collide: 0.8, color: 0xc0e8ff },
  uranium: { name: 'Gisement d’uranium', gather: { uranium: 1 }, need: 'pick', tier: 3, hp: 10, respawn: 3000, collide: 0.8, color: 0x40ff40 },
  herbe_med: { name: 'Herbe médicinale', gather: { herbe_med: 1 }, need: null, hp: 1, respawn: 400 },
  champignon: { name: 'Champignons', gather: { champignon: 2 }, need: null, hp: 1, respawn: 400, food: true },
  fleur: { name: 'Fleurs', gather: { fleur: 2 }, need: null, hp: 1, respawn: 300 },
  argile: { name: 'Argile', gather: { argile: 2 }, need: null, hp: 2, respawn: 300 },
  sable: { name: 'Sable', gather: { sable: 2 }, need: null, hp: 2, respawn: 300 },
  petrole: { name: 'Nappe de pétrole', gather: { petrole: 1 }, need: 'pick', tier: 4, hp: 4, respawn: 900 },
  baton: { name: 'Bâton', gather: { baton: 1 }, need: null, hp: 1, respawn: 200 },
  caillou: { name: 'Caillou', gather: { pierre: 1 }, need: null, hp: 1, respawn: 200, bonus: { silex: 0.3 } },
};

function prep(geo, color, m) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const M = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function nodeGeometry(type) {
  const parts = [];
  const cyl = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
  const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
  const cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
  switch (type) {
    case 'arbre':
      parts.push(prep(cyl(0.22, 0.35, 3.2), 0x6a4a2a, M(0, 1.6, 0)));
      parts.push(prep(ico(1.6, 1), 0x3a7a2a, M(0, 3.8, 0, 1, 0.85, 1)));
      parts.push(prep(ico(1.1, 1), 0x4a8a32, M(0.8, 3.3, 0.4)));
      parts.push(prep(ico(1.0, 1), 0x2f6a24, M(-0.7, 3.5, -0.5)));
      break;
    case 'sapin':
      parts.push(prep(cyl(0.18, 0.3, 2.5), 0x5a3a20, M(0, 1.25, 0)));
      parts.push(prep(cone(1.7, 2.6, 8), 0x1f5a32, M(0, 2.8, 0)));
      parts.push(prep(cone(1.35, 2.2, 8), 0x246a3a, M(0, 4, 0)));
      parts.push(prep(cone(0.9, 1.8, 8), 0x2a7440, M(0, 5.1, 0)));
      break;
    case 'palmier': {
      for (let i = 0; i < 5; i++) parts.push(prep(cyl(0.16 - i * 0.015, 0.2 - i * 0.015, 1.1), 0x8a6a40, M(i * 0.12, 0.55 + i * 1.05, 0, 1, 1, 1, 0, 0, -0.08)));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        parts.push(prep(new THREE.BoxGeometry(0.5, 0.05, 2.6), 0x3a8a2a, M(0.6 + Math.cos(a) * 1.1, 5.3, Math.sin(a) * 1.1, 1, 1, 1, 0.35, -a + Math.PI / 2, 0)));
      }
      parts.push(prep(ico(0.18), 0x6a4a20, M(0.65, 5.1, 0.15)));
      parts.push(prep(ico(0.18), 0x6a4a20, M(0.5, 5.1, -0.15)));
      break;
    }
    case 'buisson':
      parts.push(prep(ico(0.8, 1), 0x2f6a2a, M(0, 0.55, 0, 1.2, 0.8, 1.2)));
      for (let i = 0; i < 9; i++) {
        const a = i * 2.1;
        parts.push(prep(ico(0.09), 0x3040c0, M(Math.cos(a) * 0.75, 0.5 + Math.sin(i) * 0.25, Math.sin(a) * 0.75)));
      }
      break;
    case 'herbes':
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        parts.push(prep(cone(0.08, 1.3, 3), 0x7aa040, M(Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3, 1, 1, 1, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3)));
      }
      break;
    case 'rocher':
    case 'caillou':
      parts.push(prep(ico(1, 0), 0x8a8a84, M(0, 0.4, 0, 1.2, 0.8, 1)));
      parts.push(prep(ico(0.6, 0), 0x7a7a74, M(0.7, 0.25, 0.3)));
      break;
    case 'cuivre':
    case 'etain':
    case 'charbon':
    case 'soufre':
    case 'fer':
    case 'or':
    case 'silicium':
    case 'uranium': {
      parts.push(prep(ico(1, 0), 0x6a6a64, M(0, 0.5, 0, 1.2, 0.9, 1.1)));
      const c = NODE_TYPES[type].color;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.7;
        const crystal = type === 'silicium' || type === 'uranium';
        parts.push(prep(crystal ? new THREE.OctahedronGeometry(0.25) : ico(0.22, 0), c, M(Math.cos(a) * 0.8, 0.5 + Math.sin(i * 2) * 0.35, Math.sin(a) * 0.7, crystal ? 0.7 : 1, crystal ? 1.8 : 1, crystal ? 0.7 : 1)));
      }
      break;
    }
    case 'herbe_med':
      for (let i = 0; i < 5; i++) {
        const a = i * 1.25;
        parts.push(prep(new THREE.BoxGeometry(0.12, 0.02, 0.45), 0x2ab050, M(Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15, 1, 1, 1, 0.5, -a, 0)));
      }
      parts.push(prep(ico(0.06), 0xffffff, M(0, 0.45, 0)));
      break;
    case 'champignon':
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.25;
        parts.push(prep(cyl(0.05, 0.06, 0.25), 0xf0e8d0, M(x, 0.12, (i % 2) * 0.2)));
        parts.push(prep(new THREE.SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xd02020, M(x, 0.24, (i % 2) * 0.2)));
      }
      break;
    case 'fleur':
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        const x = Math.cos(a) * 0.3;
        const z = Math.sin(a) * 0.3;
        parts.push(prep(cyl(0.015, 0.015, 0.4, 3), 0x3a8a2a, M(x, 0.2, z)));
        parts.push(prep(ico(0.08), [0xff60a0, 0xffe040, 0xffffff, 0xa060ff, 0xff8040][i], M(x, 0.42, z, 1, 0.5, 1)));
      }
      break;
    case 'argile':
      parts.push(prep(new THREE.CylinderGeometry(1, 1.1, 0.15, 9), 0x9a6a4a, M(0, 0.05, 0)));
      parts.push(prep(ico(0.35), 0xa8785a, M(0.3, 0.15, 0.2)));
      break;
    case 'sable':
      parts.push(prep(new THREE.ConeGeometry(0.9, 0.5, 9), 0xe8d8a0, M(0, 0.2, 0)));
      break;
    case 'petrole':
      parts.push(prep(new THREE.CylinderGeometry(1.5, 1.5, 0.05, 12), 0x080808, M(0, 0.04, 0)));
      parts.push(prep(ico(0.2), 0x101010, M(0.4, 0.1, 0.2)));
      break;
    case 'baton':
      parts.push(prep(cyl(0.04, 0.05, 1.1, 5), 0x6a4a2a, M(0, 0.06, 0, 1, 1, 1, Math.PI / 2, 0, 0)));
      parts.push(prep(cyl(0.025, 0.03, 0.35, 4), 0x6a4a2a, M(0.1, 0.06, 0.15, 1, 1, 1, Math.PI / 2, 0.8, 0)));
      break;
  }
  return mergeGeometries(parts);
}

export class World {
  constructor(seed = 1234) {
    this.seed = seed;
    this.noise = makeNoise(seed);
    this.noise2 = makeNoise(seed + 77);
    this.group = new THREE.Group();
    this.heights = new Float32Array((SEG + 1) * (SEG + 1));
    this.nodes = [];
    this.grid = new Map();
    this.colliders = new Map();
    this.meshes = {};
    this.time = 0;
  }

  rawHeight(x, z) {
    const n = this.noise;
    const nx = x / SIZE;
    const nz = z / SIZE;
    const d = Math.hypot(nx * 1.05, nz) * 2;
    let e = n.fbm(nx * 2.6 + 3.1, nz * 2.6 - 1.7, 5) * 0.5 + 0.5;
    e = e * 0.55 + (1 - d * 1.15) * 0.75;
    let h = (e - 0.42) * 80;
    if (h > 0) {
      const r = n.ridge(nx * 5 + 10, nz * 5 - 4, 4);
      const mt = Math.max(0, e - 0.62);
      h = h * 0.55 + r * r * mt * 220;
      // Petits vallonnements
      h += this.noise2.fbm(nx * 18, nz * 18, 3) * 2.5 * clamp(h / 6, 0, 1);
    } else {
      h = Math.max(h * 1.3, -42) + this.noise2.fbm(nx * 12, nz * 12, 3) * 3;
    }
    return h;
  }

  height(x, z) {
    const half = SIZE / 2;
    const fx = clamp(((x + half) / SIZE) * SEG, 0, SEG - 0.001);
    const fz = clamp(((z + half) / SIZE) * SEG, 0, SEG - 0.001);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const W = SEG + 1;
    const h = this.heights;
    const a = h[iz * W + ix];
    const b = h[iz * W + ix + 1];
    const c = h[(iz + 1) * W + ix];
    const d = h[(iz + 1) * W + ix + 1];
    // Même découpage en triangles que PlaneGeometry
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  moisture(x, z) {
    return this.noise2.fbm(x * 0.003 + 50, z * 0.003 - 20, 3) * 0.5 + 0.5;
  }

  slope(x, z) {
    const e = 1.5;
    return Math.hypot(this.height(x + e, z) - this.height(x - e, z), this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
  }

  build(progress) {
    const half = SIZE / 2;
    const W = SEG + 1;
    for (let iz = 0; iz <= SEG; iz++) {
      for (let ix = 0; ix <= SEG; ix++) {
        const x = -half + (ix / SEG) * SIZE;
        const z = -half + (iz / SEG) * SIZE;
        this.heights[iz * W + ix] = this.rawHeight(x, z);
      }
    }
    progress?.(0.2);
    this.buildTerrainMesh();
    progress?.(0.4);
    this.buildWater();
    this.buildSeabed();
    progress?.(0.55);
    this.scatter();
    progress?.(0.8);
    this.buildGrass();
    progress?.(0.9);
  }

  buildTerrainMesh() {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const sand = new THREE.Color(0xd8c890);
    const grass = new THREE.Color(0x5a9a3a);
    const grass2 = new THREE.Color(0x7aa848);
    const forest = new THREE.Color(0x3a6a2a);
    const rock = new THREE.Color(0x7a7468);
    const snow = new THREE.Color(0xf4f6fa);
    const seabed = new THREE.Color(0xb8a878);
    const deep = new THREE.Color(0x4a5a5a);
    const dirt = new THREE.Color(0x7a6040);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ix = Math.round(((x + SIZE / 2) / SIZE) * SEG);
      const iz = Math.round(((z + SIZE / 2) / SIZE) * SEG);
      const h = this.heights[iz * (SEG + 1) + ix];
      pos.setY(i, h);
      const m = this.moisture(x, z);
      const jitter = this.noise2.noise2(x * 0.15, z * 0.15) * 0.06;
      if (h < -6) c.copy(deep).lerp(seabed, clamp((h + 40) / 34, 0, 1));
      else if (h < 1.6) c.copy(sand);
      else if (h < 40) {
        c.copy(grass).lerp(grass2, clamp(1 - m * 1.5, 0, 1)).lerp(forest, clamp((m - 0.5) * 2.5, 0, 1));
        if (h < 3) c.lerp(sand, (3 - h) / 1.4);
        if (h > 28) c.lerp(rock, (h - 28) / 12);
      } else if (h < 62) c.copy(rock).lerp(dirt, clamp(this.noise2.noise2(x * 0.05, z * 0.05), 0, 0.4));
      else c.copy(rock).lerp(snow, clamp((h - 62) / 8, 0, 1));
      c.offsetHSL(0, 0, jitter);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // Les pentes raides deviennent rocheuses
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const ny = nrm.getY(i);
      const h = pos.getY(i);
      if (ny < 0.8 && h > 2) {
        const t = clamp((0.8 - ny) * 4, 0, 1);
        colors[i * 3] = lerp(colors[i * 3], rock.r, t);
        colors[i * 3 + 1] = lerp(colors[i * 3 + 1], rock.g, t);
        colors[i * 3 + 2] = lerp(colors[i * 3 + 2], rock.b, t);
      }
    }
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    mesh.receiveShadow = true;
    this.terrain = mesh;
    this.group.add(mesh);
  }

  buildWater() {
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x0a4a7a) },
        uShallow: { value: new THREE.Color(0x2aa8b8) },
        uSky: { value: new THREE.Color(0xa8d8ff) },
        uSun: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uLight: { value: 1 },
      },
    ]);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        varying vec3 vW;
        #include <fog_pars_vertex>
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          float t = uTime;
          w.y += sin(w.x * 0.05 + t) * 0.25 + sin(w.z * 0.07 + t * 1.3) * 0.2 + sin((w.x + w.z) * 0.18 + t * 2.1) * 0.08;
          vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun; uniform float uLight; uniform float uTime;
        varying vec3 vW;
        #include <fog_pars_fragment>
        void main() {
          vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
          if (n.y < 0.0) n = -n;
          vec3 v = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          float ripple = sin(vW.x * 0.9 + uTime * 2.0) * sin(vW.z * 1.1 - uTime * 1.6) * 0.5 + 0.5;
          vec3 col = mix(uDeep, uShallow, 0.35 + ripple * 0.15);
          col = mix(col, uSky, fres * 0.65);
          vec3 h = normalize(normalize(uSun) + v);
          float spec = pow(max(dot(n, h), 0.0), 120.0) * 1.5;
          col = col * uLight + spec * uLight;
          float a = cameraPosition.y < 0.0 ? 0.55 : 0.82 + fres * 0.15;
          gl_FragColor = vec4(col, a);
          #include <fog_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(SIZE * 3, SIZE * 3, 200, 200);
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, mat);
    water.position.y = WATER;
    water.renderOrder = 2;
    this.water = water;
    this.group.add(water);
  }

  buildSeabed() {
    const rnd = mulberry(this.seed + 9);
    const weed = mergeGeometries([0, 1, 2].map((i) => prep(new THREE.BoxGeometry(0.15, 3, 0.05), 0x2a8a4a, M(i * 0.2 - 0.2, 1.5, 0, 1, 1 + i * 0.3, 1, 0, i, 0.1 * i))));
    const coral = mergeGeometries([
      prep(new THREE.IcosahedronGeometry(0.6, 0), 0xff7a7a, M(0, 0.4, 0)),
      prep(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 5), 0xffa040, M(0.5, 0.6, 0, 1, 1, 1, 0, 0, 0.4)),
      prep(new THREE.CylinderGeometry(0.08, 0.12, 1, 5), 0xc060ff, M(-0.4, 0.5, 0.2, 1, 1, 1, 0.3, 0, -0.3)),
    ]);
    const N = G.settings.quality === 'low' ? 600 : 1500;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const wIM = new THREE.InstancedMesh(weed, mat, N);
    const cIM = new THREE.InstancedMesh(coral, mat, N / 3);
    let wi = 0;
    let ci = 0;
    const m = new THREE.Matrix4();
    for (let tries = 0; tries < N * 8 && (wi < N || ci < N / 3); tries++) {
      const x = (rnd() - 0.5) * SIZE;
      const z = (rnd() - 0.5) * SIZE;
      const h = this.height(x, z);
      if (h > -2 || h < -38) continue;
      const s = 0.7 + rnd() * 1.2;
      m.compose(new THREE.Vector3(x, h, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(s, s, s));
      if (rnd() < 0.7 && wi < N) wIM.setMatrixAt(wi++, m);
      else if (ci < N / 3 && h > -20) cIM.setMatrixAt(ci++, m);
    }
    wIM.count = wi;
    cIM.count = ci;
    this.weed = wIM;
    this.group.add(wIM, cIM);
  }

  placeOk(x, z, minH, maxH, maxSlope = 0.6) {
    const h = this.height(x, z);
    if (h < minH || h > maxH) return false;
    return this.slope(x, z) <= maxSlope;
  }

  scatter() {
    const rnd = mulberry(this.seed + 3);
    const q = G.settings.quality === 'low' ? 0.6 : G.settings.quality === 'high' ? 1.3 : 1;
    const plan = [
      ['arbre', 1300, (x, z, h, m) => h > 2.5 && h < 32 && m > 0.35 && rnd() < m],
      ['sapin', 900, (x, z, h, m) => h > 18 && h < 55],
      ['palmier', 260, (x, z, h) => h > 0.8 && h < 4],
      ['buisson', 420, (x, z, h, m) => h > 2 && h < 30],
      ['herbes', 650, (x, z, h) => h > 2 && h < 28],
      ['rocher', 650, (x, z, h) => h > 1 && h < 70],
      ['cuivre', 70, (x, z, h) => h > 8 && h < 40],
      ['etain', 60, (x, z, h) => h > 8 && h < 40],
      ['charbon', 70, (x, z, h) => h > 12 && h < 55],
      ['soufre', 40, (x, z, h) => h > 15],
      ['fer', 70, (x, z, h) => h > 20],
      ['or', 30, (x, z, h) => h > 30],
      ['silicium', 40, (x, z, h) => h > 0.5 && h < 25],
      ['uranium', 18, (x, z, h) => h > 40],
      ['herbe_med', 160, (x, z, h, m) => h > 3 && h < 30 && m > 0.45],
      ['champignon', 160, (x, z, h, m) => h > 3 && h < 35 && m > 0.5],
      ['fleur', 260, (x, z, h) => h > 2.5 && h < 25],
      ['argile', 120, (x, z, h) => h > 0.3 && h < 3],
      ['sable', 120, (x, z, h) => h > 0.2 && h < 1.6],
      ['petrole', 26, (x, z, h) => h > 2 && h < 15],
      ['baton', 350, (x, z, h) => h > 2 && h < 35],
      ['caillou', 300, (x, z, h) => h > 1 && h < 40],
    ];
    const half = SIZE / 2 - 20;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    const mtx = new THREE.Matrix4();
    const col = new THREE.Color();
    for (const [type, count0, ok] of plan) {
      const count = Math.round(count0 * (type === 'arbre' || type === 'sapin' ? q : 1));
      const list = [];
      for (let tries = 0; tries < count * 30 && list.length < count; tries++) {
        const x = (rnd() * 2 - 1) * half;
        const z = (rnd() * 2 - 1) * half;
        const h = this.height(x, z);
        const m = this.moisture(x, z);
        if (!ok(x, z, h, m)) continue;
        if (this.slope(x, z) > (type === 'rocher' || NODE_TYPES[type].color ? 1.2 : 0.7)) continue;
        list.push({ x, z, h });
      }
      const geo = nodeGeometry(type);
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      im.castShadow = ['arbre', 'sapin', 'palmier', 'rocher', 'buisson'].includes(type) || !!NODE_TYPES[type].color;
      im.receiveShadow = true;
      const def = NODE_TYPES[type];
      list.forEach((p, i) => {
        const s = (type === 'arbre' || type === 'sapin' ? 0.8 + rnd() * 0.7 : 0.7 + rnd() * 0.6) * (type === 'caillou' ? 0.3 : 1);
        const rot = rnd() * Math.PI * 2;
        mtx.compose(new THREE.Vector3(p.x, p.h - 0.1, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s, s, s));
        im.setMatrixAt(i, mtx);
        col.setHSL(0, 0, 0.85 + rnd() * 0.3);
        if (type === 'arbre') col.setRGB(0.8 + rnd() * 0.4, 0.85 + rnd() * 0.3, 0.7 + rnd() * 0.3);
        im.setColorAt(i, col);
        const node = { type, x: p.x, y: p.h, z: p.z, s, rot, alive: true, hp: def.hp, respawn: 0, im, idx: i };
        this.nodes.push(node);
        this.addToGrid(node);
        if (def.collide) this.addCollider(p.x, p.z, def.collide * s, node);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.meshes[type] = im;
      this.group.add(im);
    }
  }

  buildGrass() {
    const rnd = mulberry(this.seed + 5);
    const N = G.settings.quality === 'low' ? 5000 : G.settings.quality === 'high' ? 22000 : 12000;
    const blade = mergeGeometries([0, 1, 2].map((i) => prep(new THREE.PlaneGeometry(0.5, 0.7), i % 2 ? 0x6a9a3a : 0x5a8a32, M(0, 0.35, 0, 1, 1, 1, 0, (i * Math.PI) / 3, 0))));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(blade, mat, N);
    const m = new THREE.Matrix4();
    let n = 0;
    const half = SIZE / 2 - 20;
    for (let t = 0; t < N * 6 && n < N; t++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      const h = this.height(x, z);
      if (h < 2.5 || h > 30) continue;
      if (this.slope(x, z) > 0.6) continue;
      const s = 0.6 + rnd() * 0.9;
      m.compose(new THREE.Vector3(x, h - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 3, 0)), new THREE.Vector3(s, s * (0.7 + rnd() * 0.6), s));
      im.setMatrixAt(n++, m);
    }
    im.count = n;
    im.receiveShadow = true;
    this.group.add(im);
  }

  key(x, z) {
    return Math.floor(x / 20) + ',' + Math.floor(z / 20);
  }

  addToGrid(node) {
    const k = this.key(node.x, node.z);
    let a = this.grid.get(k);
    if (!a) this.grid.set(k, (a = []));
    a.push(node);
  }

  addCollider(x, z, r, ref = null) {
    const c = { x, z, r, ref };
    const k = this.key(x, z);
    let a = this.colliders.get(k);
    if (!a) this.colliders.set(k, (a = []));
    a.push(c);
    return c;
  }

  removeCollider(c) {
    const a = this.colliders.get(this.key(c.x, c.z));
    if (a) {
      const i = a.indexOf(c);
      if (i >= 0) a.splice(i, 1);
    }
  }

  // Repousse une position hors des obstacles (troncs, rochers, bâtiments)
  collide(pos, radius) {
    const cx = Math.floor(pos.x / 20);
    const cz = Math.floor(pos.z / 20);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const a = this.colliders.get(cx + dx + ',' + (cz + dz));
        if (!a) continue;
        for (const c of a) {
          if (c.ref && c.ref.alive === false) continue;
          const ddx = pos.x - c.x;
          const ddz = pos.z - c.z;
          const d = Math.hypot(ddx, ddz);
          const min = c.r + radius;
          if (d < min && d > 0.0001) {
            pos.x = c.x + (ddx / d) * min;
            pos.z = c.z + (ddz / d) * min;
          }
        }
      }
    }
  }

  nodesNear(x, z, r) {
    const out = [];
    const cx = Math.floor(x / 20);
    const cz = Math.floor(z / 20);
    const n = Math.ceil(r / 20);
    for (let dx = -n; dx <= n; dx++) {
      for (let dz = -n; dz <= n; dz++) {
        const a = this.grid.get(cx + dx + ',' + (cz + dz));
        if (!a) continue;
        for (const node of a) {
          if (!node.alive) continue;
          if (Math.hypot(node.x - x, node.z - z) <= r) out.push(node);
        }
      }
    }
    return out;
  }

  nearestNode(x, z, r, filter) {
    let best = null;
    let bd = r;
    for (const n of this.nodesNear(x, z, r)) {
      if (filter && !filter(n)) continue;
      const d = Math.hypot(n.x - x, n.z - z) - (NODE_TYPES[n.type].collide || 0) * n.s;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  setNodeVisible(node, vis) {
    const m = new THREE.Matrix4();
    const s = vis ? node.s : 0.0001;
    m.compose(new THREE.Vector3(node.x, node.y - 0.1, node.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, node.rot, 0)), new THREE.Vector3(s, s, s));
    node.im.setMatrixAt(node.idx, m);
    node.im.instanceMatrix.needsUpdate = true;
  }

  depleteNode(node, respawnScale = 1) {
    node.alive = false;
    node.respawn = G.elapsed + NODE_TYPES[node.type].respawn * respawnScale;
    this.setNodeVisible(node, false);
  }

  update(dt, camPos) {
    this.time += dt;
    this.water.material.uniforms.uTime.value = this.time;
    // Repousse des ressources
    if (Math.floor(this.time) !== Math.floor(this.time - dt)) {
      for (const n of this.nodes) {
        if (!n.alive && G.elapsed >= n.respawn) {
          n.alive = true;
          n.hp = NODE_TYPES[n.type].hp;
          this.setNodeVisible(n, true);
        }
      }
    }
    this.water.position.x = Math.round(camPos.x / 50) * 50;
    this.water.position.z = Math.round(camPos.z / 50) * 50;
  }

  // Trouve un point de la côte (pour l'arrivée sur la terre ferme)
  findShore(angle = Math.PI / 2) {
    for (let r = SIZE * 0.5; r > 0; r -= 2) {
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const h = this.height(x, z);
      if (h > 1.2) return new THREE.Vector3(x, h, z);
    }
    return new THREE.Vector3(0, this.height(0, 0), 0);
  }

  findSpot(rnd, minH, maxH, avoid = [], minDist = 0, maxSlope = 0.35) {
    const half = SIZE / 2 - 60;
    for (let i = 0; i < 4000; i++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      if (!this.placeOk(x, z, minH, maxH, maxSlope)) continue;
      if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < minDist)) continue;
      return new THREE.Vector3(x, this.height(x, z), z);
    }
    return new THREE.Vector3(0, this.height(0, 0), 0);
  }

  // Dégage la végétation autour d'un point (bâtiments, villages)
  clearArea(x, z, r) {
    for (const n of this.nodesNear(x, z, r)) {
      if (['arbre', 'sapin', 'palmier', 'rocher', 'buisson', 'herbes'].includes(n.type) || NODE_TYPES[n.type].color) {
        n.alive = false;
        n.respawn = Infinity;
        this.setNodeVisible(n, false);
      }
    }
  }
}
