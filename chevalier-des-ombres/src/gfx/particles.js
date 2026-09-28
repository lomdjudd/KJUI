// Particules : système CPU à tampon fixe (aucune allocation en jeu) + champs d'ambiance
// entièrement animés sur GPU (lucioles, braises, neige, spores, cendres).
import * as THREE from 'three';
import { settings } from '../core/settings.js';
import { rand } from '../core/utils.js';

const PS_VS = /* glsl */ `
attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
uniform float uScale;
varying vec3 vColor; varying float vAlpha;
void main(){
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PS_FS = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * (1.0 + a), a);
}`;

export class Particles {
  constructor(scene, max = 1500, additive = true) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.baseAlpha = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 300 } },
      vertexShader: PS_VS,
      fragmentShader: PS_FS,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.tmpColor = new THREE.Color();
  }

  get budget() {
    const q = settings.get('particles');
    return q === 'low' ? 0.35 : q === 'medium' ? 0.65 : 1;
  }

  spawn(x, y, z, vx, vy, vz, life, size, color, opts = {}) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseSize[i] = size;
    const c = typeof color === 'number' ? this.tmpColor.setHex(color) : color;
    const k = opts.intensity ?? 1;
    this.col[i * 3] = c.r * k;
    this.col[i * 3 + 1] = c.g * k;
    this.col[i * 3 + 2] = c.b * k;
    this.grav[i] = opts.gravity ?? 0;
    this.drag[i] = opts.drag ?? 1;
    this.grow[i] = opts.grow ?? 0;
    this.baseAlpha[i] = opts.alpha ?? 1;
    this.size[i] = size;
    this.alpha[i] = this.baseAlpha[i];
  }

  // Gerbe de particules dans toutes les directions
  burst(p, color, n, speed = 4, size = 0.4, life = 0.6, opts = {}) {
    n = Math.ceil(n * this.budget);
    const up = opts.up ?? 0.5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * Math.PI * 0.6;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.spawn(
        p.x + rand(-0.1, 0.1) * (opts.spread || 1),
        p.y + rand(-0.1, 0.1),
        p.z + rand(-0.1, 0.1) * (opts.spread || 1),
        Math.cos(a) * Math.cos(e) * s,
        Math.sin(e) * s + up * speed,
        Math.sin(a) * Math.cos(e) * s,
        life * (0.6 + Math.random() * 0.6),
        size * (0.6 + Math.random() * 0.8),
        color,
        opts,
      );
    }
  }

  update(dt, pixelScale) {
    this.mat.uniforms.uScale.value = pixelScale;
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // Remplace par la dernière particule (compactage)
        const last = --this.count;
        if (i !== last) this._copy(last, i);
        continue;
      }
      const i3 = i * 3;
      const dr = Math.pow(this.drag[i], dt * 60);
      this.vel[i3] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt;
      this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.size[i] = this.baseSize[i] * (1 + this.grow[i] * (1 - t));
      this.alpha[i] = this.baseAlpha[i] * Math.min(1, t * 2.5) * (t > 0.9 ? (1 - t) * 10 : 1);
      i++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.count);
    if (this.count > 0) {
      this.aPos.addUpdateRange(0, this.count * 3);
      this.aCol.addUpdateRange(0, this.count * 3);
      this.aSize.addUpdateRange(0, this.count);
      this.aAlpha.addUpdateRange(0, this.count);
      this.aPos.needsUpdate = true;
      this.aCol.needsUpdate = true;
      this.aSize.needsUpdate = true;
      this.aAlpha.needsUpdate = true;
    }
  }

  _copy(a, b) {
    for (let k = 0; k < 3; k++) {
      this.pos[b * 3 + k] = this.pos[a * 3 + k];
      this.vel[b * 3 + k] = this.vel[a * 3 + k];
      this.col[b * 3 + k] = this.col[a * 3 + k];
    }
    this.life[b] = this.life[a];
    this.maxLife[b] = this.maxLife[a];
    this.baseSize[b] = this.baseSize[a];
    this.size[b] = this.size[a];
    this.alpha[b] = this.alpha[a];
    this.grav[b] = this.grav[a];
    this.drag[b] = this.drag[a];
    this.grow[b] = this.grow[a];
    this.baseAlpha[b] = this.baseAlpha[a];
  }

  clear() {
    this.count = 0;
    this.points.geometry.setDrawRange(0, 0);
  }
}

// ---------- Champ d'ambiance (100 % GPU) ----------
const AMB_VS = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uCenter; uniform float uBox; uniform vec3 uWind; uniform float uScale; uniform float uSize; uniform float uWobble;
varying float vAlpha; varying float vTw;
void main(){
  vec3 p = aSeed.xyz * uBox + uWind * uTime;
  p.x += sin(uTime * 0.7 + aSeed.w * 20.0) * uWobble;
  p.z += cos(uTime * 0.5 + aSeed.w * 13.0) * uWobble;
  p.y += sin(uTime * 0.9 + aSeed.w * 7.0) * uWobble * 0.5;
  vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  vec3 wp = uCenter + rel;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float edge = 1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(rel));
  vTw = 0.5 + 0.5 * sin(uTime * 3.0 + aSeed.w * 50.0);
  vAlpha = edge;
  gl_PointSize = uSize * (0.5 + aSeed.w) * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const AMB_FS = /* glsl */ `
uniform vec3 uColor; uniform float uTwinkle; uniform float uOpacity;
varying float vAlpha; varying float vTw;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= vAlpha * uOpacity * mix(1.0, vTw, uTwinkle);
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export const AMBIENT_TYPES = {
  fireflies: { color: 0x9dff6a, size: 0.25, wind: [0.1, 0.05, 0.05], wobble: 1.2, twinkle: 1, opacity: 1.6, count: 140, additive: true, box: 36 },
  embers: { color: 0xff7a2a, size: 0.18, wind: [0.3, 1.2, 0.1], wobble: 0.8, twinkle: 0.7, opacity: 2.2, count: 260, additive: true, box: 40 },
  snow: { color: 0xeaf2ff, size: 0.16, wind: [0.8, -2.2, 0.3], wobble: 0.6, twinkle: 0, opacity: 0.9, count: 500, additive: false, box: 34 },
  spores: { color: 0xb56aff, size: 0.2, wind: [0.1, 0.25, 0.08], wobble: 1.5, twinkle: 0.8, opacity: 1.5, count: 200, additive: true, box: 36 },
  ash: { color: 0x9a8f88, size: 0.12, wind: [0.4, -0.6, 0.2], wobble: 0.5, twinkle: 0, opacity: 0.7, count: 320, additive: false, box: 34 },
  motes: { color: 0x7affd0, size: 0.14, wind: [0.05, 0.3, 0.05], wobble: 1, twinkle: 0.9, opacity: 1.4, count: 180, additive: true, box: 30 },
  dust: { color: 0xc8a0ff, size: 0.1, wind: [0.05, 0.05, 0.05], wobble: 0.5, twinkle: 0.4, opacity: 0.8, count: 200, additive: true, box: 26 },
};

export class AmbientField {
  constructor(scene, type) {
    const def = AMBIENT_TYPES[type];
    this.def = def;
    const q = settings.get('particles');
    const n = Math.floor(def.count * (q === 'low' ? 0.4 : q === 'medium' ? 0.7 : 1));
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) seeds[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: def.box },
        uWind: { value: new THREE.Vector3(...def.wind) },
        uScale: { value: 300 },
        uSize: { value: def.size },
        uWobble: { value: def.wobble },
        uColor: { value: new THREE.Color(def.color) },
        uTwinkle: { value: def.twinkle },
        uOpacity: { value: def.opacity },
      },
      vertexShader: AMB_VS,
      fragmentShader: AMB_FS,
      transparent: true,
      depthWrite: false,
      blending: def.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  update(dt, center, pixelScale) {
    const u = this.mat.uniforms;
    u.uTime.value += dt;
    u.uCenter.value.copy(center);
    u.uScale.value = pixelScale;
  }
  dispose() {
    this.points.parent && this.points.parent.remove(this.points);
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}
