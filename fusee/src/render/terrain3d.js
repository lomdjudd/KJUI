// Terrain local détaillé (mode 3D) : grille centrée sous la caméra, qui
// remplace la sphère basse résolution près du sol. Même fonction de relief
// que la physique : ce que l'on voit est ce qui touche les jambes.

import * as THREE from 'three';
import { detailNoiseTexture } from '../parts/textures.js';
import { EARTH_SITES } from '../core/terrain.js';
import { mulberry32, hashStr } from '../core/noise.js';

// Rochers : densité et taille selon le type de sol
const ROCKS = {
  moon: { n: 3000, max: 3.2, color: 0.85 }, cratered: { n: 3000, max: 3.5, color: 0.8 }, ceres: { n: 2000, max: 2.8, color: 0.8 },
  mars: { n: 2800, max: 2.8, color: 0.7 }, potato: { n: 2400, max: 4, color: 0.85 }, io: { n: 1100, max: 2.2, color: 0.75 },
  ganymede: { n: 1500, max: 2.6, color: 0.85 }, volcanic: { n: 2000, max: 2.4, color: 0.7 }, pluto: { n: 1300, max: 2.4, color: 0.9 },
  triton: { n: 900, max: 2, color: 0.9 }, nyx: { n: 2000, max: 3, color: 0.8 }, europa: { n: 500, max: 1.8, color: 0.95 },
  enceladus: { n: 500, max: 1.8, color: 0.95 }, titan: { n: 1000, max: 1.6, color: 0.8 },
};

const s2l = (c) => Math.pow(c, 2.2);

export class LocalTerrain {
  constructor(texMgr, quality) {
    this.tex = texMgr;
    this.N = quality.sphereSeg >= 200 ? 140 : quality.sphereSeg >= 150 ? 112 : 80;
    this.group = new THREE.Group();
    const detail = detailNoiseTexture();
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.4 });
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.detailMap = { value: detail };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float d1 = texture2D(detailMap, vDUv * 0.9).r;
          float d2 = texture2D(detailMap, vDUv * 0.07).r;
          float d3 = texture2D(detailMap, vDUv * 7.0).r;
          diffuseColor.rgb *= 0.62 + d1 * 0.42 + (d2 - 0.5) * 0.35 + (d3 - 0.5) * 0.18;`)
        .replace('#include <common>', '#include <common>\nvarying vec2 vDUv;');
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvDUv = uv;');
    };
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    // eau (Terre, lacs de Titan)
    this.waterMat = new THREE.MeshStandardMaterial({ color: '#0d3550', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.93, envMapIntensity: 0.7 });
    this.water = new THREE.Mesh(new THREE.BufferGeometry(), this.waterMat);
    this.water.frustumCulled = false;
    this.water.receiveShadow = true;
    this.group.add(this.water);
    // rochers instanciés près du centre de la grille
    const rg = new THREE.IcosahedronGeometry(1, 1);
    const rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
      const n = 1 + 0.22 * Math.sin(x * 4.1 + y * 2.3) * Math.cos(z * 3.7 - x) + 0.12 * Math.sin(y * 9.0 + z * 5.0);
      rp.setXYZ(i, x * n, y * n * 0.62, z * n);
    }
    rg.computeVertexNormals();
    this.rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0, flatShading: true, envMapIntensity: 0.3 });
    this.rocks = new THREE.InstancedMesh(rg, this.rockMat, 3000);
    this.rocks.count = 0;
    this.rocks.castShadow = true;
    this.rocks.receiveShadow = true;
    this.rocks.frustumCulled = false;
    this.group.add(this.rocks);
    this.body = null;
    this.centerLon = 0;
    this.W = 0;
    this.visible = false;
  }

  // Doit-on reconstruire la grille ?
  need(body, lonV, alt) {
    const W = Math.min(150000, Math.max(3000, 2.6 * Math.sqrt(2 * body.radius * Math.max(alt, 20)) + 2000));
    if (body !== this.body) return W;
    const shift = Math.abs(((lonV - this.centerLon + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * body.radius;
    if (shift > this.W * 0.18) return W;
    if (W > this.W * 1.35 || W < this.W * 0.6) return W;
    return 0;
  }

  build(body, lonC, W) {
    const N = this.N;
    const R = body.radius;
    const G = body.ground;
    this.body = body;
    this.centerLon = lonC;
    this.W = W;
    const ce = Math.cos(lonC), se = Math.sin(lonC);
    // repère local : est, nord, haut (repère du corps)
    const ex = -se, ey = ce;
    const ux = ce, uy = se;
    const hc = Math.max(0, G.height(ux, uy, 0));
    const Cx = ux * (R + hc), Cy = uy * (R + hc), Cz = 0;
    this.C = [Cx, Cy, Cz];
    const verts = (N + 1) * (N + 1);
    const pos = new Float32Array(verts * 3);
    const col = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const wpos = new Float32Array(verts * 3);
    const liquid = G.hasLiquid;
    let anyWater = false;
    const sampleCol = (lon, lat) => this.tex.sampleColor(body.id, lon, lat) || [0.5, 0.5, 0.5, 1];
    const base = new THREE.Color(body.color);
    const edgeFade = (a, b) => Math.max(Math.abs(a), Math.abs(b));
    for (let j = 0; j <= N; j++) {
      const vj = (j / N) * 2 - 1;
      const sn = Math.sign(vj) * Math.pow(Math.abs(vj), 1.7) * W;
      for (let i = 0; i <= N; i++) {
        const ui = (i / N) * 2 - 1;
        const se_ = Math.sign(ui) * Math.pow(Math.abs(ui), 1.7) * W;
        // projection gnomonique vers la sphère
        let dx = ux * R + ex * se_, dy = uy * R + ey * se_, dz = sn;
        const l = Math.hypot(dx, dy, dz);
        dx /= l; dy /= l; dz /= l;
        const edge = edgeFade(ui, vj);
        let h = G.base(dx, dy, dz);
        const det = G.detail(dx, dy, dz) * (1 - Math.pow(edge, 6));
        h += det;
        let wet = false;
        if (liquid && h <= 0.5 && G.isLiquid(dx, dy, dz)) { wet = true; h = -25; anyWater = true; }
        if (body.id === 'terre' && Math.abs(dz) < 0.002) {
          // sous les dalles du pas de tir et de LZ-1 : on creuse un peu (évite le scintillement)
          const lonV = Math.atan2(dy, dx);
          for (const k in EARTH_SITES) {
            const st = EARTH_SITES[k];
            const dd = Math.max(Math.abs(lonV - st.lon) * R, Math.abs(dz) * R);
            if (dd < (k === 'pad' ? 50 : 46)) h -= 1.2;
          }
        }
        // jupe : les bords descendent un peu pour masquer les jointures
        if (i === 0 || j === 0 || i === N || j === N) h -= 120;
        const r = R + h;
        const k = (j * (N + 1) + i);
        const px = dx * r, py = dy * r, pz = dz * r;
        pos[k * 3] = px - Cx; pos[k * 3 + 1] = py - Cy; pos[k * 3 + 2] = pz - Cz;
        wpos[k * 3] = px; wpos[k * 3 + 1] = py; wpos[k * 3 + 2] = pz;
        uv[k * 2] = se_ / 40; uv[k * 2 + 1] = sn / 40;
        const lon = Math.atan2(dy, dx), lat = Math.asin(dz);
        let c = sampleCol(lon, lat);
        let cr = c[0], cg = c[1], cb = c[2];
        if (body.id === 'terre') {
          // teintes plus naturelles vues de près
          if (wet) { cr = 0.18; cg = 0.22; cb = 0.2; } else {
            cr = cr * 0.9 + 0.02; cg = cg * 0.92 + 0.02; cb = cb * 0.85;
            // mosaïque de végétation : forêts sombres, savanes sèches
            const n1 = G.D.fbm(px / 900, py / 900, pz / 900, 3);
            const n2 = G.D.noise(px / 160 + 17, py / 160, pz / 160);
            const m = 0.8 + n1 * 0.4 + n2 * 0.12;
            cr *= m; cg *= m; cb *= m;
            const dry = Math.min(1, Math.max(0, (n1 + n2 * 0.3 - 0.2) * 2.5)) * 0.55;
            cr += (0.44 - cr) * dry; cg += (0.4 - cg) * dry; cb += (0.25 - cb) * dry;
            // pelouse entretenue autour des installations
            const lonV = Math.atan2(dy, dx);
            for (const k in EARTH_SITES) {
              const dd = Math.hypot((lonV - EARTH_SITES[k].lon) * R, dz * R);
              const lawn = Math.min(1, Math.max(0, (420 - dd) / 160)) * 0.75;
              if (lawn > 0) { cr += (0.3 - cr) * lawn; cg += (0.4 - cg) * lawn; cb += (0.17 - cb) * lawn; }
            }
          }
        }
        col[k * 3] = s2l(cr); col[k * 3 + 1] = s2l(cg); col[k * 3 + 2] = s2l(cb);
      }
    }
    void base;
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // les pentes raides sont plus rocheuses
    const nrm = g.attributes.normal;
    for (let k = 0; k < verts; k++) {
      const wx = wpos[k * 3], wy = wpos[k * 3 + 1], wz = wpos[k * 3 + 2];
      const wl = Math.hypot(wx, wy, wz);
      const up = (nrm.getX(k) * wx + nrm.getY(k) * wy + nrm.getZ(k) * wz) / wl;
      const rock = Math.max(0, Math.min(1, (0.92 - up) * 4));
      col[k * 3] = col[k * 3] * (1 - rock * 0.45) + 0.08 * rock;
      col[k * 3 + 1] = col[k * 3 + 1] * (1 - rock * 0.5) + 0.07 * rock;
      col[k * 3 + 2] = col[k * 3 + 2] * (1 - rock * 0.5) + 0.065 * rock;
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    // eau
    this.water.visible = anyWater;
    if (anyWater) {
      const wg = [];
      const wi = [];
      const M = 40;
      for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) {
        const se_ = ((i / M) * 2 - 1) * W, sn = ((j / M) * 2 - 1) * W;
        let dx = ux * R + ex * se_, dy = uy * R + ey * se_, dz = sn;
        const l = Math.hypot(dx, dy, dz);
        dx /= l; dy /= l; dz /= l;
        wg.push(dx * R - Cx, dy * R - Cy, dz * R - Cz);
      }
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const a = j * (M + 1) + i, b = a + 1, c = a + M + 1, d = c + 1;
        wi.push(a, b, d, a, d, c);
      }
      const wgeo = new THREE.BufferGeometry();
      wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wg, 3));
      wgeo.setIndex(wi);
      wgeo.computeVertexNormals();
      this.water.geometry.dispose();
      this.water.geometry = wgeo;
    }
    this.holeCos = Math.cos((W * 0.97) / R);
    this.holeDir = new THREE.Vector3(ux, uy, 0);
    this.buildRocks(body, ux, uy, ex, ey, Cx, Cy, Cz, lonC);
  }

  buildRocks(body, ux, uy, ex, ey, Cx, Cy, Cz, lonC) {
    const cfg = ROCKS[body.ground.kind];
    const G = body.ground;
    const R = body.radius;
    if (!cfg || body.id === 'terre') { this.rocks.count = 0; return; }
    // rochers fixés au sol : cellules de 400 m le long de l'équateur, chacune
    // avec sa propre graine (les mêmes rochers reviennent au même endroit)
    const CELL = 400;
    const cell = Math.round((lonC * R) / CELL);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    const up = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0);
    const qa = new THREE.Quaternion();
    const per = Math.floor(cfg.n / 5);
    let n = 0;
    for (let ci = cell - 2; ci <= cell + 2; ci++) {
      const rnd = mulberry32((hashStr(body.id) ^ Math.imul(ci, 2654435761)) >>> 0);
      for (let i = 0; i < per && n < this.rocks.instanceMatrix.count; i++) {
        const se = ci * CELL + (rnd() - 0.5) * CELL - lonC * R;
        const sn = (rnd() * 2 - 1) * 420;
        const size = 0.12 + Math.pow(rnd(), 4.5) * cfg.max;
        const yaw = rnd() * 6.28, tilt = (rnd() - 0.5) * 0.5;
        const s1 = 0.8 + rnd() * 0.5, s2 = 0.7 + rnd() * 0.6, s3 = 0.8 + rnd() * 0.5, kc = 0.75 + rnd() * 0.35;
        // pas de gros blocs juste sous le vaisseau (ils ne sont que décoratifs)
        if (size > 0.6 && Math.hypot(se, sn) < 30) continue;
        let dx = ux * R + ex * se, dy = uy * R + ey * se, dz = sn;
        const l = Math.hypot(dx, dy, dz);
        dx /= l; dy /= l; dz /= l;
        if (G.hasLiquid && G.isLiquid(dx, dy, dz)) continue;
        const h = G.height(dx, dy, dz);
        const r = R + h - size * 0.25;
        p.set(dx * r - Cx, dy * r - Cy, dz * r - Cz);
        up.set(dx, dy, dz);
        q.setFromUnitVectors(yAxis, up).multiply(qa.setFromAxisAngle(yAxis, yaw)).multiply(qa.setFromAxisAngle(xAxis, tilt));
        sc.set(size * s1, size * s2, size * s3);
        m4.compose(p, q, sc);
        this.rocks.setMatrixAt(n, m4);
        const c = this.tex.sampleColor(body.id, Math.atan2(dy, dx), Math.asin(dz)) || [0.5, 0.5, 0.5];
        const k = cfg.color * kc;
        col.setRGB(s2l(c[0]) * k, s2l(c[1]) * k, s2l(c[2]) * k);
        this.rocks.setColorAt(n, col);
        n++;
      }
    }
    this.rocks.count = n;
    this.rocks.instanceMatrix.needsUpdate = true;
    if (this.rocks.instanceColor) this.rocks.instanceColor.needsUpdate = true;
  }

  // Place la grille (rotation du corps, origine flottante)
  place(body, ut, bodyRel) {
    if (!this.C) return;
    const rot = body.rotationAt(ut);
    const c = Math.cos(rot), s = Math.sin(rot);
    const [Cx, Cy] = this.C;
    this.group.position.set(bodyRel[0] + Cx * c - Cy * s, bodyRel[1] + Cx * s + Cy * c, 0);
    this.group.rotation.set(0, 0, rot);
  }
}
