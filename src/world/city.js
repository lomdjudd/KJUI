import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, clamp } from '../engine/utils.js';
import {
  makeBillboardTexture,
  makeGlowTexture,
  makeFacadeTextures,
  makeRoofTexture,
  makeGroundTexture,
  makeGrassTexture,
  makeWaterNormal,
  makeSignTexture,
  FACADE_TILE_W,
  FACADE_TILE_H,
  FACADE_COUNT,
} from './textures.js';

export const N = 14; // blocs par côté
export const BLOCK = 62;
export const STREET = 18;
export const PITCH = BLOCK + STREET;
export const HALF = (N * PITCH) / 2; // 560
export const X0 = -HALF;
export const ISLAND = HALF + PITCH / 2; // bord de l'île
const SIDEWALK = 4.5;
const CELL = 40;

const PARK = { i0: 5, i1: 6, j0: 3, j1: 6 };
const OSCORP = { i: 9, j: 5 };
const BUGLE = { i: 6, j: 9 };
const BANK = { i: 3, j: 8 };
const FIRE = { i: 10, j: 10 };
const DOWNTOWNS = [
  { i: 8.5, j: 3.5, s: 2.6, h: 200 },
  { i: 2.5, j: 11.5, s: 2.2, h: 170 },
  { i: 11, j: 9, s: 1.6, h: 90 },
];

class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }
  quad(p, n, uvs, c) {
    const base = this.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      this.pos.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(uvs[k * 2], uvs[k * 2 + 1]);
      this.col.push(c.r, c.g, c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export class City {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.rng = mulberry32(20020503);
    this.boxes = [];
    this.buildings = [];
    this.grid = new Map();
    this._stamp = 0;
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.landmarks = {};
    this.windowMats = [];
    this.lampMat = null;
    this.waterTex = null;
  }

  // --- Coordonnées de la grille ---
  streetX(i) {
    return X0 + i * PITCH;
  }
  streetZ(j) {
    return X0 + j * PITCH;
  }
  blockCenter(i, j) {
    return new THREE.Vector3(X0 + i * PITCH + PITCH / 2, 0, X0 + j * PITCH + PITCH / 2);
  }
  intersection(i, j) {
    return new THREE.Vector3(this.streetX(i), 0, this.streetZ(j));
  }
  isPark(i, j) {
    return i >= PARK.i0 && i <= PARK.i1 && j >= PARK.j0 && j <= PARK.j1;
  }
  inIsland(x, z) {
    return Math.abs(x) < ISLAND && Math.abs(z) < ISLAND;
  }

  generate() {
    const rng = this.rng;
    // Matériaux de façades
    this.facadeMats = [];
    for (let s = 0; s < FACADE_COUNT; s++) {
      const { map, emissive } = makeFacadeTextures(s, 3);
      const glass = s === 2 || s === 3;
      const m = new THREE.MeshStandardMaterial({
        map,
        emissiveMap: emissive,
        emissive: new THREE.Color(1, 0.85, 0.6),
        emissiveIntensity: 0,
        vertexColors: true,
        roughness: glass ? 0.25 : 0.85,
        metalness: glass ? 0.55 : 0.05,
        envMapIntensity: glass ? 1.4 : 0.6,
      });
      this.facadeMats.push(m);
      this.windowMats.push(m);
    }
    const roofTex = makeRoofTexture();
    this.roofMat = new THREE.MeshStandardMaterial({ map: roofTex, vertexColors: true, roughness: 0.95 });

    const nChunks = 4;
    const chunkSize = (N * PITCH) / nChunks;
    const builders = [];
    for (let c = 0; c < nChunks * nChunks; c++) {
      builders.push({ facades: [...Array(FACADE_COUNT)].map(() => new GeoBuilder()), roof: new GeoBuilder() });
    }
    const chunkOf = (x, z) => {
      const cx = clamp(Math.floor((x - X0) / chunkSize), 0, nChunks - 1);
      const cz = clamp(Math.floor((z - X0) / chunkSize), 0, nChunks - 1);
      return builders[cz * nChunks + cx];
    };
    this._chunkOf = chunkOf;

    this.roofProps = { waterTowers: [], ac: [], antennas: [] };

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (this.isPark(i, j)) continue;
        const bx0 = X0 + i * PITCH + STREET / 2;
        const bz0 = X0 + j * PITCH + STREET / 2;
        const bx1 = bx0 + BLOCK;
        const bz1 = bz0 + BLOCK;
        const ix0 = bx0 + SIDEWALK;
        const iz0 = bz0 + SIDEWALK;
        const ix1 = bx1 - SIDEWALK;
        const iz1 = bz1 - SIDEWALK;

        if (i === OSCORP.i && j === OSCORP.j) {
          this._buildOscorp(bx0, bz0, bx1, bz1, chunkOf);
          continue;
        }

        // Hauteur de base selon la proximité des quartiers d'affaires
        let tall = 0;
        for (const d of DOWNTOWNS) {
          const dd = (i - d.i) ** 2 + (j - d.j) ** 2;
          tall = Math.max(tall, d.h * Math.exp(-dd / (2 * d.s * d.s)));
        }
        const edge = Math.min(i, j, N - 1 - i, N - 1 - j);
        const base = 16 + rng() * 22 + (edge === 0 ? 0 : 8);
        const blockH = base + tall * (0.45 + rng() * 0.7);

        // Découpage du bloc en parcelles
        let nx;
        let nz;
        if (blockH > 120) {
          nx = rng() < 0.5 ? 1 : 2;
          nz = 1;
        } else {
          const layouts = [
            [2, 2],
            [3, 2],
            [2, 3],
            [2, 1],
            [1, 2],
            [3, 3],
          ];
          [nx, nz] = layouts[Math.floor(rng() * layouts.length)];
        }
        const special =
          (i === BUGLE.i && j === BUGLE.j) || (i === BANK.i && j === BANK.j) || (i === FIRE.i && j === FIRE.j);
        if (special) {
          nx = 2;
          nz = 2;
        }
        const splitsX = this._splits(ix0, ix1, nx, rng);
        const splitsZ = this._splits(iz0, iz1, nz, rng);
        for (let a = 0; a < nx; a++) {
          for (let b = 0; b < nz; b++) {
            let [lx0, lx1] = splitsX[a];
            let [lz0, lz1] = splitsZ[b];
            // ruelles occasionnelles
            if (rng() < 0.3 && nx > 1) {
              if (a > 0) lx0 += 2;
              if (a < nx - 1) lx1 -= 2;
            }
            if (rng() < 0.3 && nz > 1) {
              if (b > 0) lz0 += 2;
              if (b < nz - 1) lz1 -= 2;
            }
            let h = blockH * (0.55 + rng() * 0.6);
            if (h < 12) h = 12 + rng() * 6;
            let role = null;
            if (special && a === 0 && b === 0) {
              if (i === BUGLE.i && j === BUGLE.j) {
                h = 62;
                role = 'bugle';
              } else if (i === BANK.i && j === BANK.j) {
                h = 34;
                role = 'bank';
              } else {
                h = 74;
                role = 'fire';
              }
            }
            this._building(lx0, lx1, lz0, lz1, h, rng, chunkOf, role, i, j);
          }
        }
      }
    }

    // Géométries fusionnées par secteur et par matériau
    for (const b of builders) {
      b.facades.forEach((gb, s) => {
        const g = gb.build();
        if (!g) return;
        const m = new THREE.Mesh(g, this.facadeMats[s]);
        m.castShadow = true;
        m.receiveShadow = true;
        this.group.add(m);
      });
      const rg = b.roof.build();
      if (rg) {
        const m = new THREE.Mesh(rg, this.roofMat);
        m.receiveShadow = true;
        m.castShadow = true;
        this.group.add(m);
      }
    }

    this._buildRoofProps();
    this._buildGround();
    this._buildPark();
    this._buildStreetLamps();
    this._buildWater();
    this._buildBridge();
    this._buildSkyline();
    this._buildSigns();
    this._buildBillboards();
    this._buildStations();
    this._buildGrid();

    const sp = this.landmarks.bugle;
    this.spawn = new THREE.Vector3(sp.x, sp.roof, sp.z0 + (sp.z1 - sp.z0) * 0.72);
  }

  _splits(a0, a1, n, rng) {
    const total = a1 - a0;
    const w = [];
    let sum = 0;
    for (let k = 0; k < n; k++) {
      const v = 0.7 + rng() * 0.6;
      w.push(v);
      sum += v;
    }
    const out = [];
    let p = a0;
    for (let k = 0; k < n; k++) {
      const len = (w[k] / sum) * total;
      out.push([p, p + len]);
      p += len;
    }
    return out;
  }

  _pickStyle(h, rng) {
    if (h < 40) return [0, 0, 1, 4][Math.floor(rng() * 4)];
    if (h < 100) return [1, 4, 2, 3, 0][Math.floor(rng() * 5)];
    return [2, 3, 2, 1][Math.floor(rng() * 4)];
  }

  _tint(rng, style) {
    const v = 0.82 + rng() * 0.22;
    const c = new THREE.Color(v, v, v);
    if (style === 1 || style === 0) c.offsetHSL(0, 0, (rng() - 0.5) * 0.08);
    if (style === 2) c.setRGB(v * (0.9 + rng() * 0.15), v, v * (1 + rng() * 0.1));
    return c;
  }

  // Ajoute une boîte (4 murs + toit) aux géométries et à la liste de collisions
  _box(minX, maxX, minY, maxY, minZ, maxZ, style, tint, chunkOf, opts = {}) {
    const b = chunkOf((minX + maxX) / 2, (minZ + maxZ) / 2);
    const gb = b.facades[style];
    const uOff = opts.uOff || 0;
    const v0 = minY / FACADE_TILE_H;
    const v1 = maxY / FACADE_TILE_H;
    const wall = (ax, az, bx, bz, nx, nz) => {
      const len = Math.hypot(bx - ax, bz - az) / FACADE_TILE_W;
      gb.quad(
        [ax, minY, az, bx, minY, bz, bx, maxY, bz, ax, maxY, az],
        [nx, 0, nz],
        [uOff, v0, uOff + len, v0, uOff + len, v1, uOff, v1],
        tint,
      );
    };
    wall(minX, maxZ, maxX, maxZ, 0, 1);
    wall(maxX, maxZ, maxX, minZ, 1, 0);
    wall(maxX, minZ, minX, minZ, 0, -1);
    wall(minX, minZ, minX, maxZ, -1, 0);
    const s = 1 / 8;
    b.roof.quad(
      [minX, maxY, maxZ, maxX, maxY, maxZ, maxX, maxY, minZ, minX, maxY, minZ],
      [0, 1, 0],
      [minX * s, maxZ * s, maxX * s, maxZ * s, maxX * s, minZ * s, minX * s, minZ * s],
      opts.roofTint || new THREE.Color(0.9, 0.9, 0.9),
    );
    if (!opts.noCollide) {
      this.boxes.push({ minX, maxX, minY, maxY, minZ, maxZ, type: opts.type || 'building' });
    }
  }

  // Petite boîte pleine (UV monde) ajoutée à un GeoBuilder
  _solid(gb, minX, maxX, minY, maxY, minZ, maxZ, c) {
    const s = 1 / 8;
    const q = (p, n, uv) => gb.quad(p, n, uv, c);
    q([minX, maxY, maxZ, maxX, maxY, maxZ, maxX, maxY, minZ, minX, maxY, minZ], [0, 1, 0], [minX * s, maxZ * s, maxX * s, maxZ * s, maxX * s, minZ * s, minX * s, minZ * s]);
    const v0 = minY * s;
    const v1 = maxY * s;
    q([minX, minY, maxZ, maxX, minY, maxZ, maxX, maxY, maxZ, minX, maxY, maxZ], [0, 0, 1], [minX * s, v0, maxX * s, v0, maxX * s, v1, minX * s, v1]);
    q([maxX, minY, minZ, minX, minY, minZ, minX, maxY, minZ, maxX, maxY, minZ], [0, 0, -1], [maxX * s, v0, minX * s, v0, minX * s, v1, maxX * s, v1]);
    q([maxX, minY, maxZ, maxX, minY, minZ, maxX, maxY, minZ, maxX, maxY, maxZ], [1, 0, 0], [maxZ * s, v0, minZ * s, v0, minZ * s, v1, maxZ * s, v1]);
    q([minX, minY, minZ, minX, minY, maxZ, minX, maxY, maxZ, minX, maxY, minZ], [-1, 0, 0], [minZ * s, v0, maxZ * s, v0, maxZ * s, v1, minZ * s, v1]);
  }

  _building(x0, x1, z0, z1, h, rng, chunkOf, role, bi, bj) {
    const style = role === 'bank' ? 1 : role === 'bugle' ? 1 : this._pickStyle(h, rng);
    const tint = this._tint(rng, style);
    const w = x1 - x0;
    const d = z1 - z0;
    let roofY = h;
    let top = { x0, x1, z0, z1 };
    if (h > 90 && w > 20 && d > 20) {
      // Gratte-ciel à redans
      const h1 = h * (0.45 + rng() * 0.15);
      const h2 = h * (0.75 + rng() * 0.1);
      const i1 = 2.5 + rng() * 3;
      const i2 = i1 + 2.5 + rng() * 3;
      this._box(x0, x1, 0, h1, z0, z1, style, tint, chunkOf);
      this._box(x0 + i1, x1 - i1, 0, h2, z0 + i1, z1 - i1, style, tint, chunkOf);
      this._box(x0 + i2, x1 - i2, 0, h, z0 + i2, z1 - i2, style, tint, chunkOf);
      top = { x0: x0 + i2, x1: x1 - i2, z0: z0 + i2, z1: z1 - i2 };
      if (rng() < 0.6) this.roofProps.antennas.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: h, h: 15 + rng() * 25 });
    } else if (h > 45 && w > 16 && d > 16 && rng() < 0.55) {
      const h1 = h * (0.6 + rng() * 0.15);
      const i1 = 3 + rng() * 3;
      this._box(x0, x1, 0, h1, z0, z1, style, tint, chunkOf);
      this._box(x0 + i1, x1 - i1, 0, h, z0 + i1, z1 - i1, style, tint, chunkOf);
      top = { x0: x0 + i1, x1: x1 - i1, z0: z0 + i1, z1: z1 - i1 };
    } else {
      this._box(x0, x1, 0, h, z0, z1, style, tint, chunkOf);
    }
    const tw = top.x1 - top.x0;
    const td = top.z1 - top.z0;
    // Rebords (parapets) autour du toit
    if (tw > 4 && td > 4) {
      const rb = chunkOf((top.x0 + top.x1) / 2, (top.z0 + top.z1) / 2).roof;
      const t = 0.35;
      const ph = 0.5;
      const pc = new THREE.Color(0.75, 0.74, 0.72);
      this._solid(rb, top.x0, top.x1, roofY, roofY + ph, top.z0, top.z0 + t, pc);
      this._solid(rb, top.x0, top.x1, roofY, roofY + ph, top.z1 - t, top.z1, pc);
      this._solid(rb, top.x0, top.x0 + t, roofY, roofY + ph, top.z0 + t, top.z1 - t, pc);
      this._solid(rb, top.x1 - t, top.x1, roofY, roofY + ph, top.z0 + t, top.z1 - t, pc);
    }
    // Équipements de toit
    if (h < 80 && tw > 12 && td > 12 && rng() < 0.4 && !role) {
      const x = top.x0 + 4 + rng() * (tw - 8);
      const z = top.z0 + 4 + rng() * (td - 8);
      this.roofProps.waterTowers.push({ x, z, y: roofY });
      this.boxes.push({ minX: x - 2.3, maxX: x + 2.3, minY: roofY, maxY: roofY + 7.6, minZ: z - 2.3, maxZ: z + 2.3, type: 'prop' });
    }
    const nAc = Math.floor(rng() * 3);
    for (let k = 0; k < nAc && tw > 8 && td > 8; k++) {
      this.roofProps.ac.push({ x: top.x0 + 2 + rng() * (tw - 4), z: top.z0 + 2 + rng() * (td - 4), y: roofY, r: rng() * Math.PI });
    }
    const b = {
      x0: top.x0,
      x1: top.x1,
      z0: top.z0,
      z1: top.z1,
      x: (top.x0 + top.x1) / 2,
      z: (top.z0 + top.z1) / 2,
      roof: roofY,
      bi,
      bj,
      role,
      fx0: x0,
      fx1: x1,
      fz0: z0,
      fz1: z1,
    };
    this.buildings.push(b);
    if (role) this.landmarks[role] = b;
    return b;
  }

  _buildOscorp(bx0, bz0, bx1, bz1, chunkOf) {
    const cx = (bx0 + bx1) / 2;
    const cz = (bz0 + bz1) / 2;
    const tint = new THREE.Color(0.75, 0.95, 0.85);
    const s = 3;
    this._box(cx - 27, cx + 27, 0, 36, cz - 27, cz + 27, s, tint, chunkOf);
    this._box(cx - 21, cx + 21, 0, 200, cz - 21, cz + 21, s, tint, chunkOf);
    this._box(cx - 7, cx + 7, 0, 216, cz - 7, cz + 7, 3, new THREE.Color(0.5, 0.6, 0.55), chunkOf);
    this.roofProps.antennas.push({ x: cx, z: cz, y: 216, h: 45 });
    const b = { x0: cx - 21, x1: cx + 21, z0: cz - 21, z1: cz + 21, x: cx, z: cz, roof: 200, role: 'oscorp', bi: OSCORP.i, bj: OSCORP.j };
    this.buildings.push(b);
    this.landmarks.oscorp = b;
    // Anneau lumineux au sommet
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x0f3020, emissive: 0x39ff9a, emissiveIntensity: 2.2 });
    const ring = new THREE.Mesh(new THREE.BoxGeometry(43, 1.2, 43), ringMat);
    ring.position.set(cx, 196, cz);
    this.group.add(ring);
    const ring2 = new THREE.Mesh(new THREE.BoxGeometry(55, 0.8, 55), ringMat);
    ring2.position.set(cx, 36.4, cz);
    this.group.add(ring2);
    this.glowMats = [ringMat];
    // Enseigne OSCORP sur les 4 faces
    const signMat = new THREE.MeshBasicMaterial({
      map: makeSignTexture('OSCORP', '#9dffcf'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(36, 9), signMat);
      const a = (k * Math.PI) / 2;
      m.position.set(cx + Math.sin(a) * 21.3, 182, cz + Math.cos(a) * 21.3);
      m.rotation.y = a;
      this.group.add(m);
    }
  }

  _buildRoofProps() {
    const { waterTowers, ac, antennas } = this.roofProps;
    // Château d'eau
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.9 });
    const tankG = new THREE.CylinderGeometry(2.2, 2.2, 4, 12);
    tankG.translate(0, 5.2, 0);
    const capG = new THREE.ConeGeometry(2.5, 1.8, 12);
    capG.translate(0, 8.1, 0);
    const legs = [];
    for (const [lx, lz] of [
      [1.4, 1.4],
      [-1.4, 1.4],
      [1.4, -1.4],
      [-1.4, -1.4],
    ]) {
      const l = new THREE.BoxGeometry(0.25, 3.2, 0.25);
      l.translate(lx, 1.6, lz);
      legs.push(l);
    }
    const wtG = BufferGeometryUtils.mergeGeometries([tankG, capG, ...legs]);
    const wt = new THREE.InstancedMesh(wtG, wood, waterTowers.length);
    const m4 = new THREE.Matrix4();
    waterTowers.forEach((p, k) => {
      m4.makeTranslation(p.x, p.y, p.z);
      wt.setMatrixAt(k, m4);
    });
    wt.castShadow = true;
    wt.receiveShadow = true;
    this.group.add(wt);

    const acG = new THREE.BoxGeometry(2.4, 1.4, 3.2);
    acG.translate(0, 0.7, 0);
    const acM = new THREE.InstancedMesh(acG, new THREE.MeshStandardMaterial({ color: 0xa4a7aa, roughness: 0.6, metalness: 0.3 }), ac.length);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    ac.forEach((p, k) => {
      q.setFromEuler(e.set(0, p.r, 0));
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, one);
      acM.setMatrixAt(k, m4);
    });
    acM.castShadow = true;
    this.group.add(acM);

    const anG = new THREE.CylinderGeometry(0.15, 0.4, 1, 6);
    anG.translate(0, 0.5, 0);
    const anM = new THREE.InstancedMesh(anG, new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.4 }), antennas.length);
    antennas.forEach((p, k) => {
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), q.identity(), new THREE.Vector3(1, p.h, 1));
      anM.setMatrixAt(k, m4);
    });
    this.group.add(anM);
    // Balises rouges au sommet des antennes
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    const bG = new THREE.SphereGeometry(0.5, 8, 6);
    const bM = new THREE.InstancedMesh(bG, beaconMat, antennas.length);
    antennas.forEach((p, k) => {
      m4.makeTranslation(p.x, p.y + p.h, p.z);
      bM.setMatrixAt(k, m4);
    });
    this.group.add(bM);
    this.beaconMat = beaconMat;
  }

  _buildGround() {
    const L = N * PITCH + PITCH;
    const tex = makeGroundTexture(PITCH, STREET);
    tex.repeat.set(L / PITCH, L / PITCH);
    tex.offset.set(0.5, 0.5);
    const g = new THREE.PlaneGeometry(L, L);
    g.rotateX(-Math.PI / 2);
    this.groundMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    const m = new THREE.Mesh(g, this.groundMat);
    m.receiveShadow = true;
    this.group.add(m);

    // Quais tout autour de l'île
    const quayMat = new THREE.MeshStandardMaterial({ color: 0x7c7a74, roughness: 0.9 });
    for (let k = 0; k < 4; k++) {
      const q = new THREE.Mesh(new THREE.BoxGeometry(L + 2, 6, 2), quayMat);
      const a = (k * Math.PI) / 2;
      q.position.set(Math.sin(a) * (L / 2), -3, Math.cos(a) * (L / 2));
      q.rotation.y = a;
      this.group.add(q);
    }
    // Promenade verte le long de l'eau
    const grass = makeGrassTexture();
    grass.repeat.set(40, 1);
    const pm = new THREE.MeshStandardMaterial({ map: grass, roughness: 1 });
    const pw = ISLAND - (HALF + STREET / 2 + SIDEWALK);
    for (let k = 0; k < 4; k++) {
      const pg = new THREE.PlaneGeometry(2 * (HALF + STREET / 2 + SIDEWALK), pw);
      pg.rotateX(-Math.PI / 2);
      const p = new THREE.Mesh(pg, pm);
      const a = (k * Math.PI) / 2;
      const r = ISLAND - pw / 2;
      p.position.set(Math.sin(a) * r, 0.05, Math.cos(a) * r);
      p.rotation.y = a;
      p.receiveShadow = true;
      this.group.add(p);
    }
  }

  _buildPark() {
    const x0 = X0 + PARK.i0 * PITCH + STREET / 2;
    const x1 = X0 + (PARK.i1 + 1) * PITCH - STREET / 2;
    const z0 = X0 + PARK.j0 * PITCH + STREET / 2;
    const z1 = X0 + (PARK.j1 + 1) * PITCH - STREET / 2;
    this.landmarks.park = { x0, x1, z0, z1, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    const grass = makeGrassTexture();
    grass.repeat.set(12, 12);
    const gm = new THREE.MeshStandardMaterial({ map: grass, roughness: 1 });
    const rng = mulberry32(99);
    const trees = [];
    for (let j = PARK.j0; j <= PARK.j1; j++) {
      for (let i = PARK.i0; i <= PARK.i1; i++) {
        const bx0 = X0 + i * PITCH + STREET / 2 + 1;
        const bz0 = X0 + j * PITCH + STREET / 2 + 1;
        const g = new THREE.PlaneGeometry(BLOCK - 2, BLOCK - 2);
        g.rotateX(-Math.PI / 2);
        const p = new THREE.Mesh(g, gm);
        p.position.set(bx0 + (BLOCK - 2) / 2, 0.06, bz0 + (BLOCK - 2) / 2);
        p.receiveShadow = true;
        this.group.add(p);
        const pond = i === PARK.i0 && j === PARK.j0 + 1;
        if (pond) {
          const pg = new THREE.CircleGeometry(20, 32);
          pg.rotateX(-Math.PI / 2);
          const pm = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0x2a5a78, roughness: 0.1, metalness: 0.3 }));
          pm.position.set(bx0 + BLOCK / 2, 0.1, bz0 + BLOCK / 2);
          this.group.add(pm);
        }
        for (let k = 0; k < 26; k++) {
          const x = bx0 + 3 + rng() * (BLOCK - 8);
          const z = bz0 + 3 + rng() * (BLOCK - 8);
          if (pond && Math.hypot(x - (bx0 + BLOCK / 2), z - (bz0 + BLOCK / 2)) < 23) continue;
          trees.push({ x, z, s: 0.8 + rng() * 0.7 });
        }
      }
    }
    // Arbres le long de la promenade
    for (let k = 0; k < 120; k++) {
      const side = k % 4;
      const t = -HALF + rng() * 2 * HALF;
      const r = ISLAND - 12;
      const x = side === 0 ? t : side === 1 ? r : side === 2 ? t : -r;
      const z = side === 0 ? r : side === 1 ? t : side === 2 ? -r : t;
      trees.push({ x, z, s: 0.7 + rng() * 0.5 });
    }
    this._trees(trees, rng);
  }

  _trees(trees, rng) {
    const trunkG = new THREE.CylinderGeometry(0.25, 0.4, 4, 6);
    trunkG.translate(0, 2, 0);
    const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x5b4030 }), trees.length);
    const leafG = new THREE.IcosahedronGeometry(3.2, 1);
    leafG.translate(0, 6, 0);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const leaves = new THREE.InstancedMesh(leafG, leafMat, trees.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    trees.forEach((t, k) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6);
      m4.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      trunk.setMatrixAt(k, m4);
      leaves.setMatrixAt(k, m4);
      c.setHSL(0.24 + rng() * 0.1, 0.45 + rng() * 0.2, 0.25 + rng() * 0.12);
      leaves.setColorAt(k, c);
    });
    trunk.castShadow = true;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    this.group.add(trunk, leaves);
  }

  _buildStreetLamps() {
    const poleG = new THREE.CylinderGeometry(0.1, 0.14, 7, 6);
    poleG.translate(0, 3.5, 0);
    const armG = new THREE.BoxGeometry(0.12, 0.12, 2.2);
    armG.translate(0, 6.9, 1.0);
    const lampG = BufferGeometryUtils.mergeGeometries([poleG, armG]);
    const headG = new THREE.BoxGeometry(0.5, 0.2, 0.9);
    headG.translate(0, 6.8, 2.0);
    const positions = [];
    const off = STREET / 2 - 0.8;
    for (let i = 0; i <= N; i++) {
      for (let k = 0; k < N; k++) {
        const along = X0 + k * PITCH + PITCH / 2;
        const sx = this.streetX(i);
        const sz = this.streetZ(i);
        // rues nord-sud
        positions.push({ x: sx + off, z: along, r: -Math.PI / 2 });
        positions.push({ x: sx - off, z: along + 20, r: Math.PI / 2 });
        // rues est-ouest
        positions.push({ x: along, z: sz + off, r: Math.PI });
        positions.push({ x: along + 20, z: sz - off, r: 0 });
      }
    }
    const filtered = positions.filter((p) => Math.abs(p.x) < HALF + 5 && Math.abs(p.z) < HALF + 5);
    const poles = new THREE.InstancedMesh(lampG, new THREE.MeshStandardMaterial({ color: 0x2f3a33, metalness: 0.5, roughness: 0.5 }), filtered.length);
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const heads = new THREE.InstancedMesh(headG, this.lampMat, filtered.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    filtered.forEach((p, k) => {
      q.setFromAxisAngle(up, p.r);
      m4.compose(new THREE.Vector3(p.x, 0, p.z), q, one);
      poles.setMatrixAt(k, m4);
      heads.setMatrixAt(k, m4);
    });
    poles.castShadow = true;
    this.group.add(poles, heads);

    // Halos lumineux au sol (visibles la nuit)
    const poolG = new THREE.PlaneGeometry(11, 11);
    poolG.rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({
      map: makeGlowTexture('rgba(255,210,150,1)', 'rgba(255,210,150,0)'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pools = new THREE.InstancedMesh(poolG, this.poolMat, filtered.length);
    const off2 = new THREE.Vector3();
    filtered.forEach((p, k) => {
      off2.set(Math.sin(p.r) * 2, 0.08, Math.cos(p.r) * 2);
      m4.makeTranslation(p.x + off2.x, off2.y, p.z + off2.z);
      pools.setMatrixAt(k, m4);
    });
    pools.renderOrder = 2;
    this.pools = pools;
    this.group.add(pools);
  }

  _buildWater() {
    const tex = makeWaterNormal();
    tex.repeat.set(120, 120);
    this.waterTex = tex;
    const g = new THREE.PlaneGeometry(9000, 9000);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        color: 0x1d3f57,
        roughness: 0.08,
        metalness: 0.2,
        normalMap: tex,
        normalScale: new THREE.Vector2(0.35, 0.35),
        envMapIntensity: 1.2,
      }),
    );
    m.position.y = -2;
    this.group.add(m);
  }

  _buildBridge() {
    // Pont suspendu à l'est de l'île
    const z = this.streetZ(7);
    const x0 = ISLAND - 2;
    const x1 = ISLAND + 520;
    const y = 30;
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.7, metalness: 0.3 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 2, 22), mat);
    deck.position.set((x0 + x1) / 2, y - 1, z);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.group.add(deck);
    this.boxes.push({ minX: x0, maxX: x1, minY: y - 2, maxY: y, minZ: z - 11, maxZ: z + 11, type: 'bridge' });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8b6f55, roughness: 0.8 });
    const towers = [x0 + 130, x0 + 390];
    for (const tx of towers) {
      for (const dz of [-9, 9]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(6, 110, 4), towerMat);
        t.position.set(tx, 55 - 2, z + dz);
        t.castShadow = true;
        this.group.add(t);
        this.boxes.push({ minX: tx - 3, maxX: tx + 3, minY: -2, maxY: 108, minZ: z + dz - 2, maxZ: z + dz + 2, type: 'bridge' });
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 22), towerMat);
      beam.position.set(tx, 100, z);
      this.group.add(beam);
      const beam2 = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 22), towerMat);
      beam2.position.set(tx, 60, z);
      this.group.add(beam2);
      this.boxes.push({ minX: tx - 3, maxX: tx + 3, minY: 97.5, maxY: 102.5, minZ: z - 11, maxZ: z + 11, type: 'bridge' });
    }
    // Câbles porteurs
    const pts = [];
    const cable = (dz) => {
      const a = [x0, y + 2];
      const seg = [a, [towers[0], 104], [towers[1], 104], [x1, y + 2]];
      for (let s = 0; s < seg.length - 1; s++) {
        const [ax, ay] = seg[s];
        const [bx, by] = seg[s + 1];
        const steps = 24;
        for (let k = 0; k < steps; k++) {
          const t0 = k / steps;
          const t1 = (k + 1) / steps;
          const sag = (t) => (s === 1 ? -Math.sin(t * Math.PI) * 62 : s === 0 ? -Math.sin(t * Math.PI) * 18 : -Math.sin(t * Math.PI) * 18);
          pts.push(ax + (bx - ax) * t0, ay + (by - ay) * t0 + sag(t0), z + dz);
          pts.push(ax + (bx - ax) * t1, ay + (by - ay) * t1 + sag(t1), z + dz);
          // suspentes verticales
          if (k % 2 === 0) {
            pts.push(ax + (bx - ax) * t0, ay + (by - ay) * t0 + sag(t0), z + dz);
            pts.push(ax + (bx - ax) * t0, y, z + dz);
          }
        }
      }
    };
    cable(-10);
    cable(10);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xc9c2b5 }));
    this.group.add(lines);
    // Terre ferme de l'autre côté
    const land = new THREE.Mesh(new THREE.BoxGeometry(900, 4, 2400), new THREE.MeshStandardMaterial({ color: 0x4f5a4a }));
    land.position.set(x1 + 450, -1, 0);
    this.group.add(land);
    this.landmarks.bridge = { x: (x0 + x1) / 2, z, y };
  }

  _buildSkyline() {
    // Silhouettes de quartiers lointains (décor)
    const rng = mulberry32(5);
    const gb = new GeoBuilder();
    const add = (x, z, w, d, h) => {
      const c = new THREE.Color(0.8, 0.8, 0.85);
      const wall = (ax, az, bx, bz, nx, nz) => {
        const len = Math.hypot(bx - ax, bz - az) / FACADE_TILE_W;
        gb.quad([ax, 0, az, bx, 0, bz, bx, h, bz, ax, h, az], [nx, 0, nz], [0, 0, len, 0, len, h / FACADE_TILE_H, 0, h / FACADE_TILE_H], c);
      };
      wall(x - w, z + d, x + w, z + d, 0, 1);
      wall(x + w, z + d, x + w, z - d, 1, 0);
      wall(x + w, z - d, x - w, z - d, 0, -1);
      wall(x - w, z - d, x - w, z + d, -1, 0);
    };
    for (let k = 0; k < 260; k++) {
      const a = rng() * Math.PI * 2;
      const r = 1150 + rng() * 500;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (x > ISLAND + 300 && Math.abs(z) < 300) continue;
      add(x, z, 10 + rng() * 25, 10 + rng() * 25, 20 + rng() * (rng() < 0.2 ? 160 : 60));
    }
    const g = gb.build();
    const m = new THREE.Mesh(g, this.facadeMats[4]);
    this.group.add(m);
    const ground = new THREE.Mesh(new THREE.RingGeometry(1100, 2200, 64), new THREE.MeshStandardMaterial({ color: 0x3e4640 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    this.group.add(ground);
  }

  _buildSigns() {
    const bugle = this.landmarks.bugle;
    const signMat = new THREE.MeshBasicMaterial({ map: makeSignTexture('DAILY BUGLE', '#ffffff'), transparent: true, depthWrite: false });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.5 });
    const sign = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(24.6, 6.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.7 }));
    back.position.set(0, 6.5, -0.2);
    back.castShadow = true;
    sign.add(back);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), signMat);
    board.position.set(0, 6.5, 0);
    sign.add(board);
    for (const x of [-9, 9]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), frameMat);
      p.position.set(x, 3, -0.3);
      sign.add(p);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 0.3), frameMat);
    bar.position.set(0, 3.6, -0.3);
    sign.add(bar);
    sign.position.set(bugle.x, bugle.roof, bugle.z0 + 1.5);
    sign.rotation.y = Math.PI; // face à la rue, côté nord
    this.group.add(sign);
    this.signMats = [signMat];

    const bank = this.landmarks.bank;
    const bankSign = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4),
      new THREE.MeshBasicMaterial({ map: makeSignTexture('BANQUE', '#ffe28a', 'rgba(20,30,60,0.9)'), transparent: true }),
    );
    bankSign.position.set(bank.x, 12, bank.fz0 - 0.2);
    bankSign.rotation.y = Math.PI;
    this.group.add(bankSign);
  }

  _buildGrid() {
    this.boxes.forEach((b, k) => {
      const cx0 = Math.floor(b.minX / CELL);
      const cx1 = Math.floor(b.maxX / CELL);
      const cz0 = Math.floor(b.minZ / CELL);
      const cz1 = Math.floor(b.maxZ / CELL);
      b._s = 0;
      b.id = k;
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const key = this._key(cx, cz);
          let arr = this.grid.get(key);
          if (!arr) this.grid.set(key, (arr = []));
          arr.push(k);
        }
      }
    });
  }

  _key(cx, cz) {
    return (cx + 5000) * 10000 + (cz + 5000);
  }

  queryAABB(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const s = ++this._stamp;
    const cx0 = Math.floor(minX / CELL);
    const cx1 = Math.floor(maxX / CELL);
    const cz0 = Math.floor(minZ / CELL);
    const cz1 = Math.floor(maxZ / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const arr = this.grid.get(this._key(cx, cz));
        if (!arr) continue;
        for (const k of arr) {
          const b = this.boxes[k];
          if (b._s === s) continue;
          b._s = s;
          if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
          out.push(b);
        }
      }
    }
    return out;
  }

  // Hauteur du sol (toit, pont ou rue) sous le point (x, z) en dessous de y
  groundHeight(x, z, y, r = 0) {
    let h = this.inIsland(x, z) ? 0 : x > ISLAND + 515 && x < ISLAND + 1420 && Math.abs(z) < 1200 ? 1 : -2;
    const list = this.queryAABB(x - r, z - r, x + r, z + r, this._tmpList || (this._tmpList = []));
    for (const b of list) {
      if (b.maxY <= y + 0.6 && b.maxY > h) h = b.maxY;
    }
    return h;
  }

  // Lancer de rayon contre les boîtes de collision
  raycast(origin, dir, maxDist, out = {}) {
    const ex = origin.x + dir.x * maxDist;
    const ez = origin.z + dir.z * maxDist;
    const list = this.queryAABB(
      Math.min(origin.x, ex),
      Math.min(origin.z, ez),
      Math.max(origin.x, ex),
      Math.max(origin.z, ez),
      this._rayList || (this._rayList = []),
    );
    let best = maxDist;
    let hitBox = null;
    let axis = -1;
    let sign = 0;
    const inv = [1 / dir.x, 1 / dir.y, 1 / dir.z];
    const o = [origin.x, origin.y, origin.z];
    for (const b of list) {
      const mn = [b.minX, b.minY, b.minZ];
      const mx = [b.maxX, b.maxY, b.maxZ];
      let tmin = 0;
      let tmax = best;
      let ax = -1;
      let sg = 0;
      let ok = true;
      for (let a = 0; a < 3; a++) {
        let t1 = (mn[a] - o[a]) * inv[a];
        let t2 = (mx[a] - o[a]) * inv[a];
        let s = -1;
        if (t1 > t2) {
          const tt = t1;
          t1 = t2;
          t2 = tt;
          s = 1;
        }
        if (t1 > tmin) {
          tmin = t1;
          ax = a;
          sg = s;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) {
          ok = false;
          break;
        }
      }
      if (ok && ax >= 0 && tmin < best) {
        best = tmin;
        hitBox = b;
        axis = ax;
        sign = sg;
      }
    }
    // Sol
    if (dir.y < 0) {
      const tg = (0 - origin.y) / dir.y;
      if (tg >= 0 && tg < best) {
        best = tg;
        hitBox = null;
        axis = 1;
        sign = 1;
        out.ground = true;
      } else out.ground = false;
    } else out.ground = false;
    if (axis < 0 || best >= maxDist) return null;
    out.dist = best;
    out.point = out.point || new THREE.Vector3();
    out.point.copy(origin).addScaledVector(dir, best);
    out.normal = out.normal || new THREE.Vector3();
    out.normal.set(0, 0, 0);
    out.normal.setComponent(axis, sign);
    out.box = hitBox;
    return out;
  }

  // Point de rue aléatoire à une distance donnée
  randomIntersectionNear(pos, minD, maxD, rng = Math.random) {
    for (let tries = 0; tries < 60; tries++) {
      const i = 1 + Math.floor(rng() * (N - 1));
      const j = 1 + Math.floor(rng() * (N - 1));
      const p = this.intersection(i, j);
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d >= minD && d <= maxD) return { p, i, j };
    }
    const i = 1 + Math.floor(rng() * (N - 1));
    const j = 1 + Math.floor(rng() * (N - 1));
    return { p: this.intersection(i, j), i, j };
  }

  nearestSafeRoof(pos) {
    let best = null;
    let bd = Infinity;
    for (const b of this.buildings) {
      if (b.x1 - b.x0 < 8 || b.z1 - b.z0 < 8) continue;
      const d = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // Chaussée et toits mouillés sous la pluie (reflets du ciel)
  setWet(r) {
    if (Math.abs(r - (this._wet || 0)) < 0.01) return;
    this._wet = r;
    if (this.groundMat) {
      this.groundMat.roughness = 0.92 - r * 0.62;
      this.groundMat.color.setScalar(1 - r * 0.3);
      this.groundMat.envMapIntensity = 1 + r * 1.5;
    }
    if (this.roofMat) {
      this.roofMat.roughness = 0.95 - r * 0.5;
      this.roofMat.color.setScalar(1 - r * 0.25);
    }
  }

  // Panneaux lumineux : quartier « Times Square » + panneaux sur les toits
  _buildBillboards() {
    const rng = mulberry32(4242);
    const texts = [
      ['JOE’S PIZZA', '#ff3b3b', '#1a0505'],
      ['BROADWAY', '#ffd23f', '#1a1030'],
      ['NEW YORK', '#ffffff', '#0a3aa8'],
      ['OSCORP', '#7dffb5', '#032014'],
      ['DAILY BUGLE', '#ffffff', '#111111'],
      ['HOT DOGS', '#ffcf3a', '#b31313'],
      ['CINÉMA', '#ff6ad5', '#200a1c'],
      ['HÔTEL', '#6ad8ff', '#051a24'],
      ['SUSHI BAR', '#ff8a3a', '#140a02'],
      ['24 / 7', '#8aff5a', '#07140a'],
      ['ALCHEMAX', '#5ad2ff', '#021018'],
      ['THÉÂTRE', '#ffe28a', '#3a0a0a'],
      ['SPIDEY FAN CLUB', '#ff3030', '#0a1a55'],
      ['MUSÉE', '#ffffff', '#3a2a14'],
    ];
    const mats = texts.map(([t, fg, bg], k) => {
      const m = new THREE.MeshBasicMaterial({ map: makeBillboardTexture(t, fg, bg, k), toneMapped: false });
      m.color.setScalar(1.15);
      return m;
    });
    this.billboardMats = mats;
    const planeG = new THREE.PlaneGeometry(1, 1);
    const add = (x, y, z, rotY, w, h) => {
      const m = new THREE.Mesh(planeG, mats[Math.floor(rng() * mats.length)]);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      m.scale.set(w, h, 1);
      this.group.add(m);
    };
    const district = (b) => b.bi >= 6 && b.bi <= 8 && b.bj >= 7 && b.bj <= 8 && !b.role;
    let n = 0;
    for (const b of this.buildings) {
      if (b.fx0 === undefined || b.roof < 16) continue;
      const inD = district(b);
      if (!inD && rng() > 0.05) continue;
      const faces = [
        { x0: b.fx0, x1: b.fx1, z: b.fz0 - 0.12, rot: Math.PI, axis: 'x' },
        { x0: b.fx0, x1: b.fx1, z: b.fz1 + 0.12, rot: 0, axis: 'x' },
        { z0: b.fz0, z1: b.fz1, x: b.fx0 - 0.12, rot: -Math.PI / 2, axis: 'z' },
        { z0: b.fz0, z1: b.fz1, x: b.fx1 + 0.12, rot: Math.PI / 2, axis: 'z' },
      ];
      for (const f of faces) {
        if (!inD && rng() > 0.3) continue;
        const len = f.axis === 'x' ? f.x1 - f.x0 : f.z1 - f.z0;
        if (len < 8) continue;
        const count = inD ? 1 + Math.floor(rng() * 2) : 1;
        for (let k = 0; k < count; k++) {
          const w = Math.min(len - 2, 7 + rng() * 6);
          const h = w * (0.4 + rng() * 0.25);
          const y = 5 + h / 2 + rng() * Math.max(0, Math.min(26, b.roof - 8 - h));
          const t = 0.5 + (rng() - 0.5) * Math.max(0, len - w - 2) / len;
          if (f.axis === 'x') add(f.x0 + (f.x1 - f.x0) * t, y, f.z, f.rot, w, h);
          else add(f.x, y, f.z0 + (f.z1 - f.z0) * t, f.rot, w, h);
          n++;
        }
      }
    }
    this.billboardCount = n;
  }

  // Stations de métro (voyage rapide)
  _buildStations() {
    const defs = [
      [6, 2, 'Central Park Nord'],
      [9, 4, 'Oscorp Plaza'],
      [7, 8, 'Times Square'],
      [3, 9, 'Midtown Ouest'],
      [2, 12, 'Quartier financier'],
      [12, 7, 'Pont de l’Est'],
    ];
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1f3a2a, metalness: 0.5, roughness: 0.5 });
    const globeMat = new THREE.MeshStandardMaterial({ color: 0x0f5a2a, emissive: 0x3dff7a, emissiveIntensity: 1.2 });
    const signMat = new THREE.MeshBasicMaterial({ map: makeBillboardTexture('M  MÉTRO', '#ffffff', '#0f7a3a', 99), toneMapped: false });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2b2f2c, metalness: 0.6, roughness: 0.4 });
    this.stations = defs.map(([i, j, name], k) => {
      const p = this.intersection(i, j);
      const x = p.x + STREET / 2 + 2.2;
      const z = p.z + STREET / 2 + 2.2;
      const g = new THREE.Group();
      for (const dx of [-1.6, 1.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 6), postMat);
        post.position.set(dx, 1.5, 0);
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), globeMat);
        globe.position.set(dx, 3.15, 0);
        g.add(post, globe);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 0.08), railMat);
      rail.position.set(0, 0.5, 1.4);
      const rail2 = rail.clone();
      rail2.position.set(0, 0.5, -1.4);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), signMat);
      sign.position.set(0, 2.6, 0.06);
      const sign2 = sign.clone();
      sign2.rotation.y = Math.PI;
      sign2.position.z = -0.06;
      g.add(rail, rail2, sign, sign2);
      g.position.set(x, 0, z);
      this.group.add(g);
      return { key: `m${k}`, name, pos: new THREE.Vector3(x, 0, z) };
    });
  }

  update(dt, night, time) {
    for (const m of this.windowMats) m.emissiveIntensity = night * 0.95;
    if (this.lampMat) this.lampMat.emissiveIntensity = night * 3;
    if (this.poolMat) {
      this.poolMat.opacity = night * 0.55;
      this.pools.visible = night > 0.02;
    }
    if (this.waterTex) {
      this.waterTex.offset.x = (time * 0.004) % 1;
      this.waterTex.offset.y = (time * 0.0025) % 1;
    }
    if (this.beaconMat) this.beaconMat.color.setScalar(Math.sin(time * 3) > 0 ? 1 : 0.2).multiply(new THREE.Color(1, 0.1, 0.1));
  }
}
