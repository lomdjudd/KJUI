// Effets visuels : flammes des moteurs, fumée, vapeur, explosions,
// plasma de rentrée, cône de vapeur, poussière d'atterrissage.

import * as THREE from 'three';
import { NOISE_GLSL, LOGDEPTH_V, LOGDEPTH_F } from './shaders.js';
import { smokeTexture, glowTexture } from '../parts/textures.js';

// ---------------------------------------------------------------------------
// Particules (billboards instanciés)
const P_VS = /* glsl */ `
${LOGDEPTH_V}
attribute vec3 iPos;
attribute vec4 iCol;
attribute vec3 iSRF; // taille, rotation, variante
varying vec2 vUv;
varying vec4 vCol;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iSRF.y), s = sin(iSRF.y);
  vec2 p = mat2(c, -s, s, c) * position.xy;
  mv.xy += p * iSRF.x;
  float v = iSRF.z;
  vUv = uv * 0.5 + vec2(mod(v, 2.0), floor(v / 2.0)) * 0.5;
  vCol = iCol;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const P_FS = /* glsl */ `
${LOGDEPTH_F}
uniform sampler2D map;
uniform float additive;
varying vec2 vUv;
varying vec4 vCol;
void main(){
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(map, vUv);
  float a = t.a * vCol.a;
  if (a < 0.003) discard;
  if (additive > 0.5) gl_FragColor = vec4(vCol.rgb * a, a);
  else gl_FragColor = vec4(vCol.rgb * t.r, a);
}`;

export class Particles {
  constructor(max, additive, tex) {
    this.max = max;
    this.n = 0;
    this.pos = new Float64Array(max * 3); // relatif au centre du corps
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.a0 = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.rv = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.lift = new Float32Array(max);
    this.variant = new Float32Array(max);
    this.fadeIn = new Float32Array(max);
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aSRF = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (const a of [this.aPos, this.aCol, this.aSRF]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos);
    g.setAttribute('iCol', this.aCol);
    g.setAttribute('iSRF', this.aSRF);
    g.instanceCount = 0;
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, additive: { value: additive ? 1 : 0 } },
      vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 8 : 7;
  }

  // o : { x,y,z, vx,vy,vz, life, s0, s1, r,g,b, a, drag, lift, rv }
  emit(o) {
    let i;
    if (this.n < this.max) i = this.n++;
    else {
      // remplace la plus vieille
      let best = 0, ba = -1;
      for (let k = 0; k < this.n; k += 7) { const f = this.age[k] / this.life[k]; if (f > ba) { ba = f; best = k; } }
      i = best;
    }
    this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z || 0;
    this.vel[i * 3] = o.vx || 0; this.vel[i * 3 + 1] = o.vy || 0; this.vel[i * 3 + 2] = o.vz || 0;
    this.age[i] = 0;
    this.life[i] = o.life || 2;
    this.s0[i] = o.s0 || 1;
    this.s1[i] = o.s1 ?? this.s0[i] * 3;
    this.col[i * 3] = o.r ?? 1; this.col[i * 3 + 1] = o.g ?? 1; this.col[i * 3 + 2] = o.b ?? 1;
    this.a0[i] = o.a ?? 1;
    this.rot[i] = Math.random() * Math.PI * 2;
    this.rv[i] = o.rv ?? (Math.random() - 0.5) * 0.6;
    this.drag[i] = o.drag ?? 0.5;
    this.lift[i] = o.lift ?? 0;
    this.variant[i] = Math.floor(Math.random() * 4);
    this.fadeIn[i] = o.fadeIn ?? 0.08;
  }

  // air : fonction(x, y) -> [vx, vy] vitesse de l'air ; up : fonction -> direction verticale
  update(dt, airFn, gravFn) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) continue;
      const x = this.pos[i * 3], y = this.pos[i * 3 + 1];
      let ax = 0, ay = 0;
      if (airFn && this.drag[i] > 0) {
        const air = airFn(x, y);
        ax += (air[0] - this.vel[i * 3]) * this.drag[i] * air[2];
        ay += (air[1] - this.vel[i * 3 + 1]) * this.drag[i] * air[2];
        this.vel[i * 3 + 2] *= Math.exp(-this.drag[i] * air[2] * dt);
        if (this.lift[i]) {
          const r = Math.hypot(x, y) || 1;
          ax += (x / r) * this.lift[i] * air[2];
          ay += (y / r) * this.lift[i] * air[2];
        }
      }
      if (gravFn) { const g = gravFn(x, y); ax += g[0]; ay += g[1]; }
      this.vel[i * 3] += ax * dt;
      this.vel[i * 3 + 1] += ay * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.rot[i] += this.rv[i] * dt;
      // compactage
      if (w !== i) this.copy(i, w);
      w++;
    }
    this.n = w;
  }

  copy(i, w) {
    for (let k = 0; k < 3; k++) {
      this.pos[w * 3 + k] = this.pos[i * 3 + k];
      this.vel[w * 3 + k] = this.vel[i * 3 + k];
      this.col[w * 3 + k] = this.col[i * 3 + k];
    }
    this.age[w] = this.age[i]; this.life[w] = this.life[i]; this.s0[w] = this.s0[i]; this.s1[w] = this.s1[i];
    this.a0[w] = this.a0[i]; this.rot[w] = this.rot[i]; this.rv[w] = this.rv[i]; this.drag[w] = this.drag[i];
    this.lift[w] = this.lift[i]; this.variant[w] = this.variant[i]; this.fadeIn[w] = this.fadeIn[i];
  }

  // Remplit les tampons GPU (positions relatives à l'origine)
  upload(ox, oy, light = 1, zFixed = null) {
    const P = this.aPos.array, C = this.aCol.array, S = this.aSRF.array;
    for (let i = 0; i < this.n; i++) {
      const f = this.age[i] / this.life[i];
      P[i * 3] = this.pos[i * 3] - ox;
      P[i * 3 + 1] = this.pos[i * 3 + 1] - oy;
      P[i * 3 + 2] = zFixed == null ? this.pos[i * 3 + 2] : zFixed;
      const fi = Math.min(1, this.age[i] / Math.max(0.001, this.fadeIn[i] * this.life[i]));
      const a = this.a0[i] * fi * (1 - f) * (1 - f * 0.3);
      C[i * 4] = this.col[i * 3] * light; C[i * 4 + 1] = this.col[i * 3 + 1] * light; C[i * 4 + 2] = this.col[i * 3 + 2] * light; C[i * 4 + 3] = a;
      S[i * 3] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(f);
      S[i * 3 + 1] = this.rot[i];
      S[i * 3 + 2] = this.variant[i];
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSRF.needsUpdate = true;
    this.aPos.clearUpdateRanges();
    this.aCol.clearUpdateRanges();
    this.aSRF.clearUpdateRanges();
    this.aPos.addUpdateRange(0, this.n * 3);
    this.aCol.addUpdateRange(0, this.n * 4);
    this.aSRF.addUpdateRange(0, this.n * 3);
    this.geo.instanceCount = this.n;
  }

  clear() {
    this.n = 0;
    this.geo.instanceCount = 0;
  }
}

// ---------------------------------------------------------------------------
// Flamme d'un moteur (cône à l'intérieur lumineux)
const PLUME_VS = /* glsl */ `
${LOGDEPTH_V}
uniform float expand;
uniform float len;
uniform float r0;
uniform float time;
varying float vS;
varying vec3 vN;
varying vec3 vView;
varying float vAng;
void main(){
  float s = -position.y; // 0 à la tuyère, 1 au bout
  vS = s;
  float r = r0 * (1.0 + expand * pow(s, 0.65)) * (1.0 - 0.25 * s * s);
  float wob = 1.0 + 0.04 * sin(time * 40.0 + s * 20.0);
  vec3 p = vec3(position.x * r * wob, -s * len, position.z * r * wob);
  vAng = atan(position.z, position.x);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const PLUME_FS = /* glsl */ `
${LOGDEPTH_F}
${NOISE_GLSL}
uniform vec3 cCore;
uniform vec3 cMid;
uniform vec3 cOuter;
uniform float intensity;
uniform float time;
uniform float diamonds;
uniform float ortho;
varying float vS;
varying vec3 vN;
varying vec3 vView;
varying float vAng;
void main(){
  #include <logdepthbuf_fragment>
  float facing = ortho > 0.5 ? 1.0 - abs(sin(vAng)) * 0.4 : abs(dot(vN, vView));
  float core = pow(facing, 2.5);
  float n = snoise(vec3(vAng * 1.5, vS * 6.0 - time * 14.0, time * 2.0)) * 0.5 + 0.5;
  float along = 1.0 - smoothstep(0.0, 1.0, vS);
  vec3 col = mix(cOuter, cMid, smoothstep(0.1, 0.8, along));
  col = mix(col, cCore, smoothstep(0.75, 1.0, along) * core);
  float dia = 1.0 + diamonds * pow(max(sin(vS * 38.0), 0.0), 10.0) * smoothstep(0.55, 0.0, vS);
  float a = along * (0.25 + 0.75 * core) * (0.65 + 0.5 * n) * intensity * dia;
  a *= smoothstep(0.0, 0.04, vS + 0.01);
  gl_FragColor = vec4(col * a, a);
}`;

const PLUMES = {
  kero: { core: [7, 5.2, 3], mid: [4.2, 1.7, 0.45], outer: [1.4, 0.35, 0.08], diamonds: 0.3, smoke: [0.55, 0.52, 0.5] },
  spike: { core: [7, 5.2, 3], mid: [4.2, 1.7, 0.45], outer: [1.4, 0.35, 0.08], diamonds: 0.0, smoke: [0.6, 0.58, 0.55] },
  metha: { core: [4.5, 5, 7], mid: [2.2, 1.2, 3.2], outer: [0.5, 0.25, 0.9], diamonds: 0.9, smoke: [0.8, 0.8, 0.82] },
  hydro: { core: [3.2, 3.4, 5.2], mid: [1.4, 1.2, 2.6], outer: [0.25, 0.25, 0.7], diamonds: 1.4, smoke: [0.92, 0.93, 0.95] },
  srb: { core: [9, 8, 6], mid: [6, 3.6, 1.4], outer: [2.2, 0.9, 0.3], diamonds: 0.1, smoke: [0.88, 0.86, 0.83] },
  nuke: { core: [4.5, 3.2, 6], mid: [2.2, 1.0, 2.6], outer: [0.6, 0.2, 0.8], diamonds: 0.5, smoke: [0.9, 0.9, 0.95] },
  ion: { core: [1.5, 4, 9], mid: [0.6, 1.6, 4.5], outer: [0.1, 0.3, 1.2], diamonds: 0.0, smoke: null },
  fusion: { core: [9, 5, 9], mid: [4, 1.2, 5.5], outer: [1.2, 0.3, 2.2], diamonds: 0.6, smoke: null },
};

export function plumeStyle(type) {
  return PLUMES[type] || PLUMES.kero;
}

const plumeGeo = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 28, 24, true);
  g.translate(0, -0.5, 0);
  return g;
})();

export function makePlume(type) {
  const st = plumeStyle(type);
  const mk = (scale) => {
    const u = {
      expand: { value: 1 }, len: { value: 10 }, r0: { value: 1 }, time: { value: 0 },
      cCore: { value: new THREE.Vector3(...st.core) }, cMid: { value: new THREE.Vector3(...st.mid) }, cOuter: { value: new THREE.Vector3(...st.outer) },
      intensity: { value: 1 }, diamonds: { value: st.diamonds }, ortho: { value: 0 },
    };
    const m = new THREE.Mesh(plumeGeo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: PLUME_VS, fragmentShader: PLUME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    m.renderOrder = 9;
    m.userData.u = u;
    m.userData.scale = scale;
    return m;
  };
  const g = new THREE.Group();
  const inner = mk(0.55);
  const outer = mk(1);
  g.add(outer);
  g.add(inner);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(...st.core).multiplyScalar(0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.renderOrder = 10;
  g.add(glow);
  g.userData = { inner, outer, glow, type };
  return g;
}

// Met à jour une flamme : throttle 0..1, pression ambiante (atm), rayon de sortie
export function updatePlume(g, throttle, pressure, exitR, time, ortho, flicker = 1) {
  const { inner, outer, glow, type } = g.userData;
  const on = throttle > 0.01;
  g.visible = on;
  if (!on) return;
  const vac = Math.max(0, 1 - Math.min(1, pressure));
  const tf = 0.35 + 0.65 * throttle;
  const isIon = type === 'ion' || type === 'fusion';
  const len = exitR * (isIon ? 26 : 9 + 16 * tf) * (1 + vac * (isIon ? 0.5 : 1.8));
  const expand = isIon ? 0.15 + vac * 0.3 : 0.25 + vac * 3.4;
  for (const m of [outer, inner]) {
    const u = m.userData.u;
    const s = m.userData.scale;
    u.len.value = len * (m === inner ? 0.62 : 1);
    u.r0.value = exitR * s * 0.97;
    u.expand.value = expand * (m === inner ? 0.35 : 1);
    u.time.value = time;
    u.intensity.value = (m === inner ? 1.1 : 0.55) * tf * (1 - vac * 0.45) * flicker;
    u.ortho.value = ortho ? 1 : 0;
  }
  glow.scale.setScalar(exitR * (4 + 3 * throttle));
  glow.position.y = -exitR * 0.3;
  glow.material.opacity = 0.6 * tf;
}

// ---------------------------------------------------------------------------
// Plasma de rentrée : coque lumineuse autour du vaisseau
const PLASMA_VS = /* glsl */ `
${LOGDEPTH_V}
varying vec3 vN;
varying vec3 vView;
varying vec3 vP;
void main(){
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const PLASMA_FS = /* glsl */ `
${LOGDEPTH_F}
${NOISE_GLSL}
uniform float intensity;
uniform float time;
uniform vec3 flow; // direction du flux (repère objet)
varying vec3 vN;
varying vec3 vView;
varying vec3 vP;
void main(){
  #include <logdepthbuf_fragment>
  float rim = pow(1.0 - abs(dot(vN, vView)), 1.6);
  float front = smoothstep(-0.3, 1.0, dot(normalize(vP), -flow));
  float n = snoise(vP * 0.8 + flow * time * 12.0) * 0.5 + 0.5;
  vec3 col = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.55, 0.95), n * 0.5) * 4.0;
  float a = intensity * (rim * 0.8 + front * 0.6) * (0.5 + n * 0.7);
  gl_FragColor = vec4(col * a, a);
}`;

export function makePlasma() {
  const u = { intensity: { value: 0 }, time: { value: 0 }, flow: { value: new THREE.Vector3(0, -1, 0) } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.ShaderMaterial({ uniforms: u, vertexShader: PLASMA_VS, fragmentShader: PLASMA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.renderOrder = 11;
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}

// Cône de vapeur (passage du mur du son)
export function makeVaporCone() {
  const g = new THREE.ConeGeometry(1, 1, 32, 1, true);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 6;
  return m;
}

export class Effects {
  constructor(quality) {
    this.group = new THREE.Group();
    const max = quality.particles;
    this.smoke = new Particles(max, false, smokeTexture());
    this.fire = new Particles(Math.round(max * 0.6), true, smokeTexture());
    this.sparks = new Particles(Math.round(max * 0.3), true, glowTexture());
    this.group.add(this.smoke.mesh);
    this.group.add(this.fire.mesh);
    this.group.add(this.sparks.mesh);
    this.flashes = [];
    this.flashLight = new THREE.PointLight('#ffb070', 0, 400, 1.2);
    this.group.add(this.flashLight);
    this.shake = 0;
  }

  explosion(x, y, size, vx = 0, vy = 0, inAir = true) {
    const n = Math.round(14 + size * 12);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * Math.PI;
      const sp = (8 + Math.random() * 22) * Math.sqrt(size);
      this.fire.emit({ x, y, z: 0, vx: vx + Math.cos(a) * Math.cos(e) * sp, vy: vy + Math.sin(a) * Math.cos(e) * sp, vz: Math.sin(e) * sp, life: 0.8 + Math.random() * 1.2, s0: size * 2, s1: size * 9, r: 4, g: 1.6, b: 0.45, a: 0.9, drag: inAir ? 1.5 : 0.2 });
    }
    for (let i = 0; i < n * 1.4; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * Math.PI;
      const sp = (4 + Math.random() * 12) * Math.sqrt(size);
      this.smoke.emit({ x, y, z: 0, vx: vx + Math.cos(a) * Math.cos(e) * sp, vy: vy + Math.sin(a) * Math.cos(e) * sp, vz: Math.sin(e) * sp, life: 4 + Math.random() * 5, s0: size * 3, s1: size * 16, r: 0.16, g: 0.14, b: 0.13, a: inAir ? 0.8 : 0.4, drag: inAir ? 1.0 : 0.05, lift: inAir ? 3 : 0, fadeIn: 0.05 });
    }
    for (let i = 0; i < n * 2; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * Math.PI;
      const sp = (20 + Math.random() * 60) * Math.sqrt(size);
      this.sparks.emit({ x, y, z: 0, vx: vx + Math.cos(a) * Math.cos(e) * sp, vy: vy + Math.sin(a) * Math.cos(e) * sp, vz: Math.sin(e) * sp, life: 0.6 + Math.random() * 1.6, s0: 0.35 * Math.sqrt(size), s1: 0.1, r: 6, g: 3, b: 1, a: 1, drag: inAir ? 0.6 : 0, grav: 1 });
    }
    this.flashes.push({ x, y, t: 0, size });
    this.shake = Math.max(this.shake, Math.min(2, size * 0.6));
  }
}
