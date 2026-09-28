import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { N, PITCH, X0, STREET, BLOCK } from './city.js';
import { mulberry32, clamp } from '../engine/utils.js';

// ---------- Foule ----------
// Piétons instanciés : le squelette (hanches, genoux, épaules, coudes) est animé dans le shader,
// ce qui permet des centaines de passants qui marchent, courent, applaudissent ou prennent des photos.

// Os : 0 corps, 1 cuisse G, 2 tibia G, 3 cuisse D, 4 tibia D, 5 bras G, 6 avant-bras G, 7 bras D, 8 avant-bras D
// Zones : 0 peau, 1 haut, 2 bas, 3 chaussures, 4 cheveux, 5 téléphone, 6 yeux, 7 avant-bras (manche/peau), 8 tibias (pantalon/peau)
const HIP = 0.93;
const KNEE = 0.5;
const SHOULDER = 1.42;
const ELBOW = 1.13;

function lathe(profile, seg, sx = 1, sz = 1) {
  const g = new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(r, y)), seg);
  g.scale(sx, 1, sz);
  return g;
}

function tag(geo, bone, zone) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const n = g.attributes.position.count;
  g.setAttribute('bone', new THREE.BufferAttribute(new Float32Array(n).fill(bone), 1));
  g.setAttribute('zone', new THREE.BufferAttribute(new Float32Array(n).fill(zone), 1));
  return g;
}

function ellipsoid(rx, ry, rz, seg, x, y, z, part = null) {
  const g = part ? new THREE.SphereGeometry(1, seg, Math.max(4, seg * 0.7), 0, Math.PI * 2, part[0], part[1]) : new THREE.SphereGeometry(1, seg, Math.max(4, Math.round(seg * 0.7)));
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}

// Silhouette humaine (hauteur 1,75 m avant mise à l'échelle), femme ou homme, proche ou lointaine
function buildPerson(female, detail) {
  const parts = [];
  const seg = detail ? 12 : 6;
  const sh = female ? 0.17 : 0.2; // demi-largeur d'épaules
  const hipW = female ? 1.12 : 1;
  for (const side of [1, -1]) {
    const x = side * 0.1;
    const thigh = lathe([[-0.43, 0.05], [-0.3, 0.06], [-0.1, 0.075], [0, 0.082], [0.04, 0.07]], seg, 1, 1.05);
    thigh.translate(x, HIP, 0);
    parts.push(tag(thigh, side > 0 ? 1 : 3, 2));
    const shin = lathe([[-0.43, 0.036], [-0.3, 0.045], [-0.15, 0.056], [-0.02, 0.05], [0.02, 0.048]], seg, 1, 1.05);
    shin.translate(x, KNEE, 0);
    parts.push(tag(shin, side > 0 ? 2 : 4, 8));
    const foot = ellipsoid(0.045, 0.04, 0.12, detail ? 8 : 5, x, 0.04, 0.045);
    foot.translate(0, 0, 0);
    parts.push(tag(foot, side > 0 ? 2 : 4, 3));
    const upper = lathe([[-0.3, 0.037], [-0.2, 0.043], [-0.05, 0.05], [0.02, 0.052], [0.05, 0.03]], seg);
    upper.translate(side * (sh + 0.02), SHOULDER, 0);
    parts.push(tag(upper, side > 0 ? 5 : 7, 1));
    const fore = lathe([[-0.26, 0.028], [-0.2, 0.031], [-0.08, 0.038], [0, 0.04], [0.02, 0.036]], seg);
    fore.translate(side * (sh + 0.02), ELBOW, 0);
    parts.push(tag(fore, side > 0 ? 6 : 8, 7));
    const hand = ellipsoid(0.03, 0.055, 0.042, detail ? 8 : 5, side * (sh + 0.02), ELBOW - 0.3, 0.005);
    parts.push(tag(hand, side > 0 ? 6 : 8, 0));
    // Épaule arrondie (deltoïde)
    const delt = ellipsoid(0.062, 0.058, 0.06, detail ? 9 : 5, side * (sh + 0.005), SHOULDER + 0.02, 0);
    parts.push(tag(delt, side > 0 ? 5 : 7, 1));
  }
  // Bassin, buste (épaules, poitrine), cou, tête
  const pelvis = lathe([[-0.08, 0.1], [-0.02, 0.15], [0.05, 0.155], [0.1, 0.14]], seg + 2, hipW * 1.1, 0.72);
  pelvis.translate(0, HIP, 0);
  parts.push(tag(pelvis, 0, 2));
  const torso = lathe(
    female
      ? [[-0.02, 0.135], [0.08, 0.125], [0.2, 0.14], [0.3, 0.155], [0.38, 0.15], [0.44, 0.12], [0.47, 0.07], [0.48, 0.04]]
      : [[-0.02, 0.145], [0.08, 0.145], [0.2, 0.16], [0.3, 0.175], [0.38, 0.18], [0.44, 0.15], [0.47, 0.08], [0.48, 0.05]],
    seg + 4,
    1.12,
    0.66,
  );
  {
    const pos = torso.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      let z = pos.getZ(k);
      const chest = Math.max(0, Math.sin(((y - 0.18) / 0.26) * Math.PI));
      z = z > 0 ? z * (1 + (female ? 0.28 : 0.16) * chest) : z * 0.9;
      pos.setZ(k, z);
    }
    torso.computeVertexNormals();
  }
  torso.translate(0, HIP + 0.02, 0);
  parts.push(tag(torso, 0, 1));
  const neck = lathe([[0, 0.045], [0.08, 0.042], [0.1, 0.04]], seg);
  neck.translate(0, 1.46, 0);
  parts.push(tag(neck, 0, 0));
  const head = ellipsoid(0.083, 0.108, 0.098, detail ? 14 : 7, 0, 1.64, 0.008);
  parts.push(tag(head, 0, 0));
  // Cheveux : calotte (courts) ou calotte + masse arrière (longs)
  const hair = ellipsoid(0.09, 0.1, 0.104, detail ? 14 : 7, 0, 1.665, -0.004, [0, Math.PI * 0.55]);
  parts.push(tag(hair, 0, 4));
  if (female) {
    const back = ellipsoid(0.085, 0.16, 0.06, detail ? 10 : 6, 0, 1.56, -0.06);
    parts.push(tag(back, 0, 4));
  }
  if (detail) {
    for (const s of [1, -1]) {
      const eye = ellipsoid(0.012, 0.009, 0.006, 5, s * 0.032, 1.655, 0.1);
      parts.push(tag(eye, 0, 6));
    }
    const nose = ellipsoid(0.012, 0.022, 0.018, 5, 0, 1.63, 0.1);
    parts.push(tag(nose, 0, 0));
    // Téléphone (visible seulement quand le passant filme)
    const phone = new THREE.BoxGeometry(0.075, 0.14, 0.012);
    phone.translate(-(sh + 0.02), ELBOW - 0.32, 0.05);
    parts.push(tag(phone, 8, 5));
  }
  const g = BufferGeometryUtils.mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

function makeCrowdMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.time;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float bone;
        attribute float zone;
        attribute vec3 iTop;
        attribute vec4 iBot;
        attribute vec4 iSkin;
        attribute vec4 iHair;
        attribute vec4 iAnim;
        uniform float uTime;
        varying vec3 vZoneCol;
        vec3 rx(vec3 p, vec3 c, float a) { p -= c; float cs = cos(a); float sn = sin(a); return c + vec3(p.x, cs * p.y - sn * p.z, sn * p.y + cs * p.z); }
        vec3 rxn(vec3 n, float a) { float cs = cos(a); float sn = sin(a); return vec3(n.x, cs * n.y - sn * n.z, sn * n.y + cs * n.z); }
        void pose(inout vec3 p, inout vec3 n) {
          float ph = iAnim.x;
          float amp = iAnim.y;
          float run = iAnim.z;
          float act = iAnim.w;
          float A = mix(0.4, 0.78, run) * amp;
          float A2 = mix(0.75, 1.75, run) * amp;
          float A3 = mix(0.42, 1.0, run) * amp;
          float b = bone;
          if (b > 0.5 && b < 4.5) {
            bool left = b < 2.5;
            float lp = left ? ph : ph + 3.14159;
            float aT = -A * sin(lp);
            float aK = A2 * pow(max(0.0, sin(lp + 2.2)), 1.5);
            vec3 hip = vec3(left ? 0.1 : -0.1, ${HIP.toFixed(3)}, 0.0);
            if (b == 2.0 || b == 4.0) { p = rx(p, vec3(hip.x, ${KNEE.toFixed(3)}, 0.0), aK); n = rxn(n, aK); }
            p = rx(p, hip, aT); n = rxn(n, aT);
          } else if (b > 4.5) {
            bool left = b < 6.5;
            float s = left ? 1.0 : -1.0;
            float aS = A3 * sin(ph) * s;
            float aE = -0.18 - mix(0.12, 1.35, run) * amp;
            float wave = sin(uTime * 9.0 + ph * 3.0);
            if (act > 1.5 && act < 2.5) { aS = -2.75 + 0.22 * wave * (left ? 1.0 : -1.0); aE = -0.35; }
            if (act > 2.5 && act < 3.5) { aS = left ? 0.05 : -1.25; aE = left ? -0.15 : -1.05; }
            if (act > 3.5) { aS = 0.08 * s; aE = -1.2; }
            vec3 sp = vec3(s * 0.21, ${SHOULDER.toFixed(3)}, 0.0);
            if (b == 6.0 || b == 8.0) { p = rx(p, vec3(sp.x, ${ELBOW.toFixed(3)}, 0.0), aE); n = rxn(n, aE); }
            p = rx(p, sp, aS); n = rxn(n, aS);
          }
          if (b < 0.5 || b > 4.5) {
            float lean = 0.2 * run * amp + (act > 3.5 ? 0.12 : 0.0);
            p = rx(p, vec3(0.0, ${HIP.toFixed(3)}, 0.0), lean); n = rxn(n, lean);
          }
          float hop = (act > 1.5 && act < 2.5) ? abs(sin(uTime * 7.0 + ph)) * 0.08 : 0.0;
          p.y += abs(sin(ph)) * 0.035 * amp - 0.015 * amp + hop;
          if (zone > 4.5 && zone < 5.5 && (act < 2.5 || act > 3.5)) p = vec3(0.0, 1.0, 0.0);
        }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 objectNormal = vec3(normal);
        vec3 posed = vec3(position);
        pose(posed, objectNormal);
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
        #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = posed;
        vec3 zc = iSkin.rgb;
        if (zone > 0.5 && zone < 1.5) zc = iTop;
        else if (zone > 1.5 && zone < 2.5) zc = iBot.rgb;
        else if (zone > 2.5 && zone < 3.5) zc = vec3(iHair.a);
        else if (zone > 3.5 && zone < 4.5) zc = iHair.rgb;
        else if (zone > 4.5 && zone < 6.5) zc = vec3(0.03);
        else if (zone > 6.5 && zone < 7.5) zc = mix(iTop, iSkin.rgb, iSkin.a);
        else if (zone > 7.5) zc = mix(iBot.rgb, iSkin.rgb, iBot.a);
        vZoneCol = zc;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vZoneCol;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vZoneCol;');
  };
  return mat;
}

const TOPS = ['#2b2f38', '#e8e4dc', '#7a2025', '#1f3d6b', '#3c5a3a', '#c9a24a', '#5b4a6b', '#d86a3a', '#b8c4cc', '#1b1b1d', '#8a6a4a', '#2f6f8a', '#a83a5a', '#f0f0f0', '#4a4f55'];
const BOTTOMS = ['#1f2a44', '#2a3550', '#1b1b1d', '#4a4a4f', '#7a6a50', '#3a3a3e', '#28324a', '#5a4632', '#c2b8a0'];
const SKINS = ['#f1c7a5', '#e0ac85', '#c68a60', '#a86e4a', '#7a4e32', '#5a3a26', '#f4d2b8'];
const HAIRS = ['#1a1410', '#2e2018', '#4a3020', '#7a5a34', '#b08a50', '#d8c090', '#6a6a6a', '#8a3a1c', '#101010'];

const MAX_NEAR = 70;
const CULL = 150;
const R_PED = 125; // rayon de la foule simulée autour du joueur

export class Crowd {
  constructor(scene, city, quality) {
    this.city = city;
    this.quality = quality;
    this.uniforms = { time: { value: 0 } };
    const rng = mulberry32(777);
    const count = quality.peds;
    this.peds = [];
    const c = new THREE.Color();
    const col = (arr) => c.set(arr[Math.floor(rng() * arr.length)]).clone();
    for (let k = 0; k < count; k++) {
      const i = 0;
      const j = 0;
      const female = rng() < 0.48;
      const stand = rng() < 0.18;
      const top = col(TOPS).offsetHSL(0, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.08);
      this.peds.push({
        i,
        j,
        s: rng() * 4,
        off: 1.2 + rng() * 2.4,
        dir: rng() < 0.5 ? 1 : -1,
        speed: 1.15 + rng() * 0.55,
        phase: rng() * 10,
        female,
        scale: (female ? 0.93 : 1.0) * (0.95 + rng() * 0.1),
        top,
        bot: col(BOTTOMS),
        shorts: rng() < (female ? 0.3 : 0.12) ? 1 : 0,
        skin: col(SKINS),
        sleeves: rng() < 0.4 ? 1 : 0,
        hair: rng() < 0.08 ? col(['#e8e2d8', '#9a9a9a']) : col(HAIRS),
        shoe: 0.05 + rng() * (rng() < 0.2 ? 0.8 : 0.15),
        mode: stand ? 'idle' : 'walk',
        stand,
        modeT: 0,
        cool: rng() * 5,
        amp: stand ? 0 : 1,
        run: 0,
        act: 0,
        faceYaw: 0,
        pos: new THREE.Vector3(),
        yaw: 0,
      });
    }
    this.mat = makeCrowdMaterial(this.uniforms);
    const mk = (geo, max) => {
      const g = new THREE.BufferGeometry();
      for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.attributes[k]);
      if (geo.index) g.setIndex(geo.index);
      g.boundingSphere = geo.boundingSphere;
      const attr = (size) => new THREE.InstancedBufferAttribute(new Float32Array(max * size), size);
      g.setAttribute('iTop', attr(3));
      g.setAttribute('iBot', attr(4));
      g.setAttribute('iSkin', attr(4));
      g.setAttribute('iHair', attr(4));
      g.setAttribute('iAnim', attr(4));
      const m = new THREE.InstancedMesh(g, this.mat, max);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = quality.shadows;
      scene.add(m);
      return m;
    };
    this.meshes = {};
    for (const female of [false, true]) {
      const key = female ? 'f' : 'm';
      this.meshes[key] = { near: mk(buildPerson(female, true), MAX_NEAR), far: mk(buildPerson(female, false), count) };
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._frustum = new THREE.Frustum();
    this._pm = new THREE.Matrix4();
    this._sphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  }

  // Les passants vivent autour du joueur : ceux qui s'éloignent réapparaissent hors champ, près de lui
  _respawn(ped, center, anywhere) {
    const bi = Math.floor((center.x - X0) / PITCH);
    const bj = Math.floor((center.z - X0) / PITCH);
    const r = Math.ceil(R_PED / PITCH);
    for (let tries = 0; tries < 8; tries++) {
      const i = clamp(bi + Math.floor(Math.random() * (2 * r + 1)) - r, 0, N - 1);
      const j = clamp(bj + Math.floor(Math.random() * (2 * r + 1)) - r, 0, N - 1);
      if (this.city.isPark(i, j)) continue;
      ped.i = i;
      ped.j = j;
      ped.s = Math.random() * 4;
      ped.off = 1.2 + Math.random() * 2.4;
      this._pedPos(ped, ped.pos);
      const d = Math.hypot(ped.pos.x - center.x, ped.pos.z - center.z);
      if (d > R_PED) continue;
      if (!anywhere && tries < 7 && d < R_PED * 0.8 && this._hasFrustum) {
        this._sphere.center.set(ped.pos.x, 0.9, ped.pos.z);
        if (this._frustum.intersectsSphere(this._sphere)) continue;
      }
      ped.mode = ped.stand ? 'idle' : 'walk';
      ped.yaw = this._pedPos(ped, ped.pos);
      return;
    }
  }

  // Position sur le périmètre du trottoir de son bloc
  _pedPos(p, out) {
    const bx0 = X0 + p.i * PITCH + STREET / 2 + p.off;
    const bz0 = X0 + p.j * PITCH + STREET / 2 + p.off;
    const L = BLOCK - 2 * p.off;
    const s = ((p.s % 4) + 4) % 4;
    const side = Math.floor(s);
    const f = (s - side) * L;
    let yaw;
    if (side === 0) {
      out.set(bx0 + f, 0, bz0);
      yaw = Math.PI / 2;
    } else if (side === 1) {
      out.set(bx0 + L, 0, bz0 + f);
      yaw = 0;
    } else if (side === 2) {
      out.set(bx0 + L - f, 0, bz0 + L);
      yaw = -Math.PI / 2;
    } else {
      out.set(bx0, 0, bz0 + L - f);
      yaw = Math.PI;
    }
    if (p.dir < 0) yaw += Math.PI;
    return yaw;
  }

  update(dt, playerPos, danger) {
    this.uniforms.time.value += dt;
    const player = playerPos;
    const jump = !this._center || Math.hypot(player.x - this._center.x, player.z - this._center.z) > R_PED;
    if (jump) {
      this._center = player.clone();
      for (const ped of this.peds) this._respawn(ped, player, true);
    } else this._center.copy(player);
    for (const ped of this.peds) {
      if (Math.hypot(ped.pos.x - player.x, ped.pos.z - player.z) > R_PED + 15) this._respawn(ped, player, false);
      const dP = Math.hypot(ped.pos.x - player.x, ped.pos.z - player.z);
      const near = danger && Math.hypot(ped.pos.x - danger.x, ped.pos.z - danger.z) < 45;
      ped.cool -= dt;
      if (near) {
        if (ped.mode !== 'flee') {
          ped.mode = 'flee';
          // fuit dans la direction qui l'éloigne du danger
          const yaw = this._pedPos(ped, this._p);
          const fx = Math.sin(yaw);
          const fz = Math.cos(yaw);
          if (fx * (ped.pos.x - danger.x) + fz * (ped.pos.z - danger.z) < 0) ped.dir *= -1;
        }
        ped.modeT = 4;
      } else if (ped.mode === 'flee') {
        ped.modeT -= dt;
        if (ped.modeT <= 0) ped.mode = ped.stand ? 'idle' : 'walk';
      } else if ((ped.mode === 'walk' || ped.mode === 'idle') && dP < 9 && ped.cool <= 0 && player.y < 3) {
        // Le héros est là : on l'acclame ou on le filme
        ped.cool = 18 + Math.random() * 12;
        ped.mode = Math.random() < 0.55 ? 'cheer' : 'photo';
        ped.modeT = 3 + Math.random() * 3;
      } else if (ped.mode === 'cheer' || ped.mode === 'photo') {
        ped.modeT -= dt;
        if (ped.modeT <= 0 || dP > 25) ped.mode = ped.stand ? 'idle' : 'walk';
      }

      let moving = ped.mode === 'walk' || ped.mode === 'flee';
      const run = ped.mode === 'flee' ? 1 : 0;
      ped.run += (run - ped.run) * Math.min(1, dt * 4);
      ped.amp += ((moving ? 1 : 0) - ped.amp) * Math.min(1, dt * 5);
      ped.act = ped.mode === 'cheer' ? 2 : ped.mode === 'photo' ? 3 : 0;
      const sp = ped.speed * (1 + ped.run * 2.4) * ped.amp;
      // s'écarte si le joueur est sur le chemin
      if (dP < 1.4 && player.y < 2) ped.off = clamp(ped.off + (ped.off > 2.4 ? 1 : -1) * dt * 2, 0.9, 4);
      ped.s += (ped.dir * sp * dt) / (BLOCK - 2 * ped.off);
      ped.phase += dt * (sp * 3.9 + (moving ? 0 : 0.8));
      let yaw = this._pedPos(ped, ped.pos);
      if (!moving) {
        if (ped.act) {
          yaw = Math.atan2(player.x - ped.pos.x, player.z - ped.pos.z);
        } else yaw += ped.stand ? Math.PI / 2 : 0;
      }
      // rotation lissée
      let dy = yaw - ped.yaw;
      dy -= Math.round(dy / (Math.PI * 2)) * Math.PI * 2;
      ped.yaw += dy * Math.min(1, dt * 8);
    }
  }

  render(camera) {
    const { _m: m, _q: q, _s: s, _p: p, _up: up } = this;
    const cp = camera ? camera.position : new THREE.Vector3();
    if (camera) {
      camera.updateMatrixWorld();
      this._pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._pm);
      this._hasFrustum = true;
    }
    for (const k of ['m', 'f']) {
      this.meshes[k].near.count = 0;
      this.meshes[k].far.count = 0;
    }
    for (const ped of this.peds) {
      const dx = ped.pos.x - cp.x;
      const dz = ped.pos.z - cp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > CULL * CULL) continue;
      this._sphere.center.set(ped.pos.x, 0.9, ped.pos.z);
      if (camera && !this._frustum.intersectsSphere(this._sphere)) continue;
      const set = this.meshes[ped.female ? 'f' : 'm'];
      let mesh = d2 < 45 * 45 ? set.near : set.far;
      if (mesh === set.near && mesh.count >= MAX_NEAR) mesh = set.far;
      const n = mesh.count++;
      q.setFromAxisAngle(up, ped.yaw);
      s.setScalar(ped.scale);
      m.compose(ped.pos, q, s);
      mesh.setMatrixAt(n, m);
      const a = mesh.geometry.attributes;
      a.iTop.setXYZ(n, ped.top.r, ped.top.g, ped.top.b);
      a.iBot.setXYZW(n, ped.bot.r, ped.bot.g, ped.bot.b, ped.shorts);
      a.iSkin.setXYZW(n, ped.skin.r, ped.skin.g, ped.skin.b, ped.sleeves);
      a.iHair.setXYZW(n, ped.hair.r, ped.hair.g, ped.hair.b, ped.shoe);
      a.iAnim.setXYZW(n, ped.phase, ped.amp, ped.run, ped.act);
    }
    for (const k of ['m', 'f']) {
      for (const mesh of [this.meshes[k].near, this.meshes[k].far]) {
        mesh.instanceMatrix.needsUpdate = true;
        for (const name of ['iTop', 'iBot', 'iSkin', 'iHair', 'iAnim']) mesh.geometry.attributes[name].needsUpdate = true;
        mesh.visible = mesh.count > 0;
      }
    }
  }
}
