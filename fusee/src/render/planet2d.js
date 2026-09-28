// Rendu 2D des astres (vue de côté, comme sur une carte) : disque ombré
// dont le contour suit exactement le relief physique, couches du sol en
// coupe près de la surface, et halo atmosphérique.

import * as THREE from 'three';
import { NOISE_GLSL } from './shaders.js';

const Z_DISK = 140;
const Z_ATMO = 130;
const COARSE = 720;
const FINE = 1024;

const DISK_VS = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const HEIGHT_FN = /* glsl */ `
uniform sampler2D hCoarse;
uniform sampler2D hFine;
uniform float fineA0;
uniform float fineA1;
uniform float R;
uniform float hScale;
// hauteur (m) et liquide (0/1) à un angle monde
vec2 heightAt(float th){
  float a = th;
  float span = fineA1 - fineA0;
  float rel = a - fineA0;
  rel = rel - 6.2831853 * floor(rel / 6.2831853);
  if (span > 0.0 && rel <= span) {
    return texture2D(hFine, vec2((rel / span) * (${FINE - 1}.0 / ${FINE}.0) + 0.5 / ${FINE}.0, 0.5)).rg * vec2(hScale, 1.0);
  }
  float u = a / 6.2831853;
  u = u - floor(u);
  return texture2D(hCoarse, vec2(u, 0.5)).rg * vec2(hScale, 1.0);
}`;

const DISK_FS = /* glsl */ `
${NOISE_GLSL}
${HEIGHT_FN}
uniform vec3 center;
uniform float rot;
uniform sampler2D map;
uniform float hasMap;
uniform vec3 baseColor;
uniform vec3 sunDir;
uniform float ambient;
uniform float emissive;
uniform float isGas;
uniform float ocean;
uniform float pxSize;
varying vec3 vWorld;
void main(){
  vec2 p = (vWorld.xy - center.xy) / R;
  float r = length(p);
  float th = atan(p.y, p.x);
  vec2 hl = heightAt(th);
  float surfR = R + hl.x;
  float depth = surfR - r * R;
  float zz = r < 1.0 ? -sqrt(1.0 - r * r) : 0.0;
  vec3 n = r < 1.0 ? vec3(p, zz) : vec3(p / r, 0.0);
  float lonW = atan(n.y, n.x);
  float lon = lonW - rot;
  float lat = asin(clamp(n.z, -1.0, 1.0));
  vec2 uv = vec2(fract(lon / 6.2831853 + 0.5), lat / 3.1415927 + 0.5);
  vec3 sph = hasMap > 0.5 ? texture2D(map, uv).rgb : baseColor;
  float diff = max(dot(normalize(n), sunDir), 0.0);
  float term = smoothstep(-0.08, 0.2, dot(vec3(p / max(r, 1e-6), 0.0), sunDir));
  vec3 col;
  if (isGas > 0.5 || emissive > 0.0) {
    col = sph * (diff * term + ambient) + sph * emissive;
  } else {
    // coupe du sol près de la surface
    vec2 uvEq = vec2(fract((th - rot) / 6.2831853 + 0.5), 0.5);
    vec3 top = hasMap > 0.5 ? texture2D(map, uvEq).rgb : baseColor;
    vec2 q = vec2(th * R, depth);
    float nz = snoise(vec3(q * 0.004, 1.0)) * 0.5 + snoise(vec3(q * 0.02, 2.0)) * 0.3 + snoise(vec3(q * 0.1, 3.0)) * 0.2;
    float strata = sin(depth * 0.02 + nz * 3.0) * 0.5 + 0.5;
    vec3 soil = top * mix(0.55, 0.8, strata) * (0.9 + nz * 0.15);
    vec3 deep = top * 0.28;
    vec3 ground = mix(soil, deep, smoothstep(40.0, 2500.0, depth));
    ground = mix(top * (1.05 + nz * 0.1), ground, smoothstep(0.5 * pxSize + 1.5, 4.0 * pxSize + 6.0, depth));
    if (hl.y > 0.5 && ocean > 0.5) {
      vec3 water = mix(vec3(0.05, 0.22, 0.45), vec3(0.01, 0.04, 0.12), smoothstep(0.0, 900.0, depth));
      ground = water;
    }
    float lightTop = max(dot(vec3(p / max(r, 1e-6), 0.0), sunDir), 0.0) * term;
    vec3 g = ground * (lightTop * 0.95 + ambient + 0.04);
    vec3 s = sph * (diff * term + ambient);
    col = mix(g, s, smoothstep(R * 0.0015 + 20.0 * pxSize, R * 0.02 + 80.0 * pxSize, depth));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const ATMO2D_FS = /* glsl */ `
${HEIGHT_FN}
uniform vec3 center;
uniform float atmH;
uniform float H;
uniform vec3 sky;
uniform vec3 sunset;
uniform vec3 sunDir;
uniform float strength;
varying vec3 vWorld;
void main(){
  vec2 p = (vWorld.xy - center.xy);
  float r = length(p);
  float th = atan(p.y, p.x);
  vec2 hl = heightAt(th);
  float alt = r - R - max(hl.x, 0.0);
  if (alt < 0.0) discard;
  float dens = exp(-alt / H) * (1.0 - smoothstep(atmH * 0.7, atmH, r - R));
  float c = dot(p / r, sunDir.xy);
  float day = smoothstep(-0.3, 0.25, c);
  float dusk = exp(-c * c / 0.02) * 0.9;
  vec3 col = mix(sky * day, sunset, dusk * (1.0 - day * 0.5)) ;
  float a = dens * strength * (0.25 + 0.75 * max(day, dusk * 0.8));
  gl_FragColor = vec4(col * (0.6 + 0.8 * day), clamp(a, 0.0, 0.96));
}`;

function makeHeightTex(n) {
  const data = new Float32Array(n * 4);
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

export class Planets2D {
  constructor(sys, texMgr) {
    this.sys = sys;
    this.tex = texMgr;
    this.group = new THREE.Group();
    this.objs = new Map();
    for (const b of sys.bodies) this.build(b);
    texMgr.onReady((id) => this.applyTex(id));
    for (const b of sys.bodies) this.applyTex(b.id);
  }

  build(b) {
    const o = { body: b, group: new THREE.Group(), lastKey: '' };
    const hC = makeHeightTex(COARSE), hF = makeHeightTex(FINE);
    const common = {
      hCoarse: { value: hC }, hFine: { value: hF }, fineA0: { value: 0 }, fineA1: { value: 0 },
      R: { value: b.radius }, hScale: { value: 1 }, center: { value: new THREE.Vector3() },
      sunDir: { value: new THREE.Vector3(1, 0, 0) },
    };
    const du = {
      ...common, rot: { value: 0 }, map: { value: null }, hasMap: { value: 0 },
      baseColor: { value: new THREE.Color(b.color).convertSRGBToLinear() }, ambient: { value: 0.06 },
      emissive: { value: b.type === 'star' ? 8 : 0 }, isGas: { value: b.hasSurface ? 0 : 1 }, ocean: { value: b.def.ocean || b.def.liquid ? 1 : 0 },
      pxSize: { value: 1 },
    };
    o.du = du;
    o.hC = hC; o.hF = hF;
    o.disk = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: du, vertexShader: DISK_VS, fragmentShader: DISK_FS, depthWrite: false, side: THREE.DoubleSide }));
    o.disk.frustumCulled = false;
    o.disk.renderOrder = -5;
    o.group.add(o.disk);
    if (b.atmosphere) {
      const a = b.atmosphere;
      const au = {
        ...common, atmH: { value: a.height }, H: { value: a.H * 1.6 },
        sky: { value: new THREE.Color(a.sky).convertSRGBToLinear() }, sunset: { value: new THREE.Color('#ff8a3c').convertSRGBToLinear() },
        strength: { value: Math.min(1, 0.55 + (a.density || 1) * 0.3) },
      };
      o.au = au;
      const ringG = new THREE.RingGeometry(b.radius * 0.97, b.radius + a.height * 1.02, 360, 1);
      o.atmo = new THREE.Mesh(ringG, new THREE.ShaderMaterial({ uniforms: au, vertexShader: DISK_VS, fragmentShader: ATMO2D_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      o.atmo.frustumCulled = false;
      o.atmo.renderOrder = -4;
      o.group.add(o.atmo);
    }
    this.objs.set(b.id, o);
    this.group.add(o.group);
  }

  applyTex(id) {
    const o = this.objs.get(id);
    if (!o) return;
    const t = this.tex.get(id === 'venus' ? 'venus' : id);
    if (!t) return;
    o.du.map.value = t.color;
    o.du.hasMap.value = 1;
    // Vénus : les nuages cachent la surface vue de loin
    if (id === 'venus' && this.tex.get('venus_nuages')) o.cloudTex = this.tex.get('venus_nuages').color;
  }

  // Contour du disque : échantillonnage grossier + fin autour du point observé
  rebuild(o, ut, focusAngleW, halfSpan) {
    const b = o.body;
    const G = b.ground;
    const rotB = b.rotationAt(ut);
    const hasSurf = b.hasSurface && G.amp > 0;
    // hauteurs grossières (repère monde)
    const dc = o.hC.image.data;
    const liquidOK = G.hasLiquid;
    for (let i = 0; i < COARSE; i++) {
      const a = (i / COARSE) * Math.PI * 2;
      const lon = a - rotB;
      let h = hasSurf ? G.atLon(lon) : 0;
      let liq = 0;
      if (liquidOK && h <= 0.5 && G.isLiquid(Math.cos(lon), Math.sin(lon), 0)) { liq = 1; h = 0; }
      dc[i * 4] = h;
      dc[i * 4 + 1] = liq;
    }
    o.hC.needsUpdate = true;
    let a0 = 0, a1 = 0;
    const df = o.hF.image.data;
    if (halfSpan > 0 && halfSpan < Math.PI * 0.45) {
      a0 = focusAngleW - halfSpan;
      a1 = focusAngleW + halfSpan;
      for (let i = 0; i < FINE; i++) {
        const a = a0 + ((a1 - a0) * i) / (FINE - 1);
        const lon = a - rotB;
        let h = hasSurf ? G.atLon(lon) : 0;
        let liq = 0;
        if (liquidOK && h <= 0.5 && G.isLiquid(Math.cos(lon), Math.sin(lon), 0)) { liq = 1; h = 0; }
        df[i * 4] = h;
        df[i * 4 + 1] = liq;
      }
      o.hF.needsUpdate = true;
    }
    const wrapA0 = ((a0 % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    o.du.fineA0.value = wrapA0;
    o.du.fineA1.value = wrapA0 + (a1 - a0);
    if (o.au) { o.au.fineA0.value = wrapA0; o.au.fineA1.value = wrapA0 + (a1 - a0); }
    // géométrie : éventail (centre + contour)
    const pts = [];
    const fineN = halfSpan > 0 && halfSpan < Math.PI * 0.45 ? FINE : 0;
    const angles = [];
    for (let i = 0; i < COARSE; i++) {
      const a = (i / COARSE) * Math.PI * 2;
      let rel = a - wrapA0;
      rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (fineN && rel <= a1 - a0) continue;
      angles.push([a, dc[i * 4]]);
    }
    for (let i = 0; i < fineN; i++) angles.push([wrapA0 + ((a1 - a0) * i) / (FINE - 1), df[i * 4]]);
    angles.sort((p, q) => p[0] - q[0]);
    o.outline = angles;
    for (const [a, h] of angles) pts.push(a, h);
    o.lastRot = rotB;
    o.lastUT = ut;
    o.geoPts = pts;
  }

  // Place les disques ; origin : position du point de vue
  update(ut, origin, focus, viewSize, pxSize) {
    const sunS = this.sys.sun.state(ut);
    for (const [id, o] of this.objs) {
      const b = o.body;
      const s = b.state(ut);
      const cx = s.x - origin[0], cy = s.y - origin[1];
      const dist = Math.hypot(cx, cy);
      const visible = dist - b.radius * 1.3 < viewSize * 1.5 && b.radius / viewSize > 0.0005;
      o.group.visible = visible || b.type === 'star';
      if (!o.group.visible) continue;
      // angle observé et demi-ouverture fine
      const fa = Math.atan2(-cy, -cx);
      const half = Math.min(Math.PI * 0.46, (viewSize * 1.6) / b.radius);
      const key = Math.round(fa / (half * 0.25)) + ':' + Math.round(Math.log(half) * 3);
      const rotB = b.rotationAt(ut);
      const rotMoved = Math.abs(rotB - (o.lastRot ?? 0)) > half * 0.1;
      if (key !== o.lastKey || rotMoved || !o.geoPts) {
        o.lastKey = key;
        this.rebuild(o, ut, fa, dist > b.radius * 3 ? Math.PI : half);
        this.rebuildGeometry(o, b);
      }
      this.placeVertices(o, cx, cy);
      if (o.atmo) o.atmo.position.set(cx, cy, Z_ATMO);
      const sd = new THREE.Vector3(sunS.x - s.x, sunS.y - s.y, 0).normalize();
      o.du.sunDir.value.copy(sd);
      o.du.center.value.set(cx, cy, 0);
      o.du.rot.value = rotB;
      o.du.pxSize.value = pxSize;
      if (id === 'venus' && o.cloudTex) {
        // de loin : nuages ; de près : surface
        const far = viewSize > b.radius * 0.3;
        o.du.map.value = far ? o.cloudTex : this.tex.get('venus')?.color || o.cloudTex;
      }
      if (o.au) {
        o.au.sunDir.value.copy(sd);
        o.au.center.value.set(cx, cy, 0);
      }
      void focus;
    }
  }

  rebuildGeometry(o, b) {
    const pts = o.geoPts;
    const n = pts.length / 2;
    const pos = new Float32Array((n + 1) * 3);
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + ((i + 1) % n));
    const g = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr);
    g.setIndex(idx);
    o.disk.geometry.dispose();
    o.disk.geometry = g;
    o.posAttr = attr;
    if (o.atmo) o.atmo.position.z = Z_ATMO;
  }

  // Sommets recalculés à chaque image, relatifs à l'origine (précision)
  placeVertices(o, cx, cy) {
    const b = o.body;
    const pts = o.geoPts;
    const n = pts.length / 2;
    const pos = o.posAttr.array;
    pos[0] = cx; pos[1] = cy; pos[2] = Z_DISK;
    for (let i = 0; i < n; i++) {
      const a = pts[i * 2], r = b.radius + pts[i * 2 + 1];
      pos[(i + 1) * 3] = cx + Math.cos(a) * r;
      pos[(i + 1) * 3 + 1] = cy + Math.sin(a) * r;
      pos[(i + 1) * 3 + 2] = Z_DISK;
    }
    o.posAttr.needsUpdate = true;
  }
}
