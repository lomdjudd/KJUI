// Bibliothèque de matériaux partagés. Les personnages utilisent un unique shader
// (couleurs, rugosité, métal et émission par sommet) : un seul programme GPU pour tous.
import * as THREE from 'three';
import { Textures } from './textures.js';

const shared = { time: { value: 0 }, detail: { value: 1 } };
const animated = [];

// ---------- Matériau des personnages (maillage « skinné » rigide) ----------
// Détails de surface procéduraux selon le type de matière (métal martelé et rayé, tissu
// tissé, cuir, peau, os poreux et fissuré, pierre, bois, cristal, fourrure, écailles),
// relief par dérivées écran (sans texture), occlusion simulée et yeux qui palpitent.
const CHAR_PARS = /* glsl */ `
varying vec4 vMat;
varying vec3 vObjPos;
varying vec3 vRest;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uDissolve;
uniform vec3 uDissolveColor;
uniform vec3 uRim;
uniform float uTime;
uniform float uDetail;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// Motif par type : x = relief, y = teinte (multiplicateur), z = variation de rugosité
vec3 surfPattern(float kind, vec3 p){
  if (kind < 0.5) return vec3(0.0, 1.0, 0.0);
  float n1 = vnoise(p * 9.0);
  if (kind < 1.5) { // métal : martelage + rayures
    float n2 = vnoise(p * vec3(60.0, 4.0, 60.0));
    float scratch = smoothstep(0.93, 1.0, n2);
    float dents = n1 * n1;
    return vec3(dents * 0.6 - scratch * 0.4, 0.86 + n1 * 0.2 + scratch * 0.35, -scratch * 0.3 + dents * 0.15);
  }
  if (kind < 2.5) { // tissu : trame
    float w = sin(p.x * 260.0) * sin(p.y * 260.0 + p.z * 90.0);
    return vec3(w * 0.25 + n1 * 0.3, 0.8 + n1 * 0.3 + w * 0.06, 0.0);
  }
  if (kind < 3.5) { // cuir : grain et plis
    float c = vnoise(p * 30.0);
    return vec3(c * 0.4 + n1 * 0.3, 0.8 + n1 * 0.35, c * 0.1);
  }
  if (kind < 4.5) { // peau : marbrures et veines
    float v = 1.0 - abs(vnoise(p * 6.0) * 2.0 - 1.0);
    float vein = smoothstep(0.9, 1.0, v);
    return vec3(n1 * 0.25 + vein * 0.2, 0.85 + n1 * 0.25 - vein * 0.25, 0.0);
  }
  if (kind < 5.5) { // os : pores et fissures
    float pores = smoothstep(0.62, 0.8, vnoise(p * 45.0));
    float crack = smoothstep(0.94, 1.0, 1.0 - abs(vnoise(p * 7.0) * 2.0 - 1.0));
    return vec3(-pores * 0.4 - crack * 0.6 + n1 * 0.2, 0.9 + n1 * 0.18 - pores * 0.15 - crack * 0.45, pores * 0.2);
  }
  if (kind < 6.5) { // pierre
    float c = vnoise(p * 3.0);
    return vec3(n1 * 0.6 + c * 0.4, 0.75 + n1 * 0.3 + c * 0.2, 0.0);
  }
  if (kind < 7.5) { // bois : veinage
    float g = sin(p.y * 90.0 + n1 * 8.0) * 0.5 + 0.5;
    return vec3(g * 0.35, 0.75 + g * 0.3, 0.0);
  }
  if (kind < 8.5) { // cristal : facettes scintillantes
    return vec3(n1 * 0.3, 0.9 + pow(n1, 6.0) * 1.2, -0.1);
  }
  if (kind < 9.5) { // fourrure : mèches verticales
    float strand = vnoise(p * vec3(70.0, 9.0, 70.0));
    float clump = vnoise(p * vec3(14.0, 3.0, 14.0));
    return vec3(strand * 0.7 + clump * 0.3, 0.6 + strand * 0.55 + clump * 0.25, strand * 0.1);
  }
  // écailles : cellules
  vec3 q = p * 22.0; q.y += floor(q.x) * 0.5;
  vec3 f = fract(q) - 0.5;
  float cell = 1.0 - smoothstep(0.2, 0.5, length(f.xy));
  return vec3(cell * 0.6 + n1 * 0.2, 0.7 + cell * 0.45, -cell * 0.15);
}
vec3 bumpNormal(vec3 surfPos, vec3 n, float h, float k){
  vec3 dx = dFdx(surfPos); vec3 dy = dFdy(surfPos);
  vec3 r1 = cross(dy, n); vec3 r2 = cross(n, dx);
  float det = dot(dx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad * k);
}
`;

export function createCharMaterial(opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1,
  });
  const u = {
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uDissolve: { value: 0 },
    uDissolveColor: { value: new THREE.Color(opts.dissolveColor || 0x9a4dff) },
    uRim: { value: new THREE.Color(opts.rim || 0x2a2440) },
    uTime: shared.time,
    uDetail: shared.detail,
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nvarying vec4 vMat;\nvarying vec3 vObjPos;\nvarying vec3 vRest;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvMat = aMat;\nvObjPos = transformed;\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CHAR_PARS)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float dn = fract(sin(dot(floor(vObjPos * 14.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        if (uDissolve > 0.0 && dn < uDissolve) discard;
        vec3 sp = uDetail > 0.5 ? surfPattern(vMat.w, vRest) : vec3(0.0, 1.0, 0.0);
        // Occlusion simulée : bas du corps et creux plus sombres (personnages et décors)
        #if defined(USE_SKINNING) || defined(USE_INSTANCING)
        float ao = mix(0.62, 1.0, smoothstep(-0.1, 0.9, vRest.y)) * (0.92 + 0.08 * sp.y);
        #else
        float ao = 1.0;
        #endif`,
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= sp.y * ao;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(roughness * vMat.x + sp.z, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.y;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (uDetail > 0.5 && vMat.w > 0.5) normal = bumpNormal(-vViewPosition, normal, sp.x, vMat.w < 1.5 ? 0.012 : vMat.w > 8.5 ? 0.02 : 0.015);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float pulse = 0.82 + 0.18 * sin(uTime * 3.2 + vRest.x * 7.0 + vRest.y * 3.0);
        totalEmissiveRadiance += vColor.rgb * vMat.z * 3.2 * pulse + uFlashColor * uFlash;
        if (uDissolve > 0.0 && dn < uDissolve + 0.12) totalEmissiveRadiance += uDissolveColor * 4.0;
        float rimF = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uRim * rimF * (vMat.w > 8.5 && vMat.w < 9.5 ? 1.8 : 1.0);`,
      );
  };
  mat.customProgramCacheKey = () => 'char-v2';
  return mat;
}

// Qualité du détail des surfaces (désactivé en effets « sobres »)
export function setCharDetail(on) {
  shared.detail.value = on ? 1 : 0;
}

// ---------- Matériau spectral (fantômes verts, banshees, spectres de glace) ----------
export function createSpectralMaterial(color = 0x39ff9a, opts = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opts.opacity ?? 0.9 },
      uTime: shared.time,
      uFadeLow: { value: opts.fadeLow ?? 0.1 },
      uDetail: shared.detail,
      uFlash: { value: 0 },
      uDissolve: { value: 0 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vCol; varying vec3 vP;
      void main(){
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        vH = position.y;
        vP = position;
        #ifdef USE_COLOR
        vCol = color;
        #else
        vCol = vec3(1.0);
        #endif
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        vN = normalize(normalMatrix * objectNormal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uFadeLow; uniform float uFlash; uniform float uDissolve;
      uniform float uDetail;
      varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vCol; varying vec3 vP;
      float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vnoise(vec3 x){
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main(){
        float fr = pow(1.0 - abs(dot(normalize(vN), vV)), 2.0);
        float lum = dot(vCol, vec3(0.333));
        // Volutes d'ectoplasme qui montent le long du corps
        float wisp = 1.0; float vein = 0.0;
        if (uDetail > 0.5) {
          vec3 q = vP * 3.5 + vec3(0.0, -uTime * 0.9, uTime * 0.2);
          float n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 7.0) * 0.35;
          wisp = 0.45 + n * 1.1;
          vein = smoothstep(0.86, 1.0, 1.0 - abs(vnoise(vP * 5.0 + vec3(0.0, -uTime * 0.6, 0.0)) * 2.0 - 1.0));
        }
        float a = (0.16 + fr * 0.9) * uOpacity * (0.5 + lum) * wisp;
        a *= smoothstep(uFadeLow, uFadeLow + 0.7, vH);
        a *= 1.0 - uDissolve;
        float flick = 0.85 + 0.15 * sin(uTime * 7.0 + vH * 6.0);
        vec3 c = uColor * (0.5 + fr * 2.2 + vein * 1.6) * flick * (0.4 + lum * 1.2) + vec3(uFlash);
        gl_FragColor = vec4(c, a + vein * 0.25 * uOpacity * (1.0 - uDissolve));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    side: THREE.FrontSide,
  });
  mat.userData.u = { uFlash: mat.uniforms.uFlash, uDissolve: mat.uniforms.uDissolve, uFlashColor: { value: new THREE.Color() } };
  mat.userData.spectral = true;
  return mat;
}

// ---------- Matériaux du monde ----------
const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export function clearWorldMaterials() {
  // Les matériaux sont conservés entre les zones (partagés) : rien à libérer.
}

export const Mats = {
  stone: () =>
    cached('stone', () => {
      const t = Textures.stone();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.92, metalness: 0, color: 0xb8b0c8 });
    }),
  darkStone: () =>
    cached('darkStone', () => {
      const t = Textures.stone();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.85, metalness: 0.05, color: 0x6a6378 });
    }),
  tiles: () =>
    cached('tiles', () => {
      const t = Textures.tiles();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.55, metalness: 0.1 });
    }),
  cobble: () =>
    cached('cobble', () => {
      const t = Textures.cobble();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.9 });
    }),
  rock: () =>
    cached('rock', () => {
      const t = Textures.rock();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.95, color: 0x9a94a6 });
    }),
  bark: () =>
    cached('bark', () => {
      const t = Textures.bark();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 1, color: 0x8a8090 });
    }),
  wood: () =>
    cached('wood', () => {
      const t = Textures.wood();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.9 });
    }),
  iron: () =>
    cached('iron', () => {
      const t = Textures.metal();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, color: 0x3a3a44, roughness: 0.45, metalness: 0.9 });
    }),
  gold: () =>
    cached('gold', () => {
      const t = Textures.metal();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, color: 0xc89b3c, roughness: 0.35, metalness: 1 });
    }),
  bone: () => cached('bone', () => new THREE.MeshStandardMaterial({ color: 0xcfc6a8, roughness: 0.7 })),
  cloth: (color = 0x3a1450) => cached('cloth' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide })),
  foliage: (color = 0x1c2a1c) => cached('foliage' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })),
  glow: (color, intensity = 3) =>
    cached('glow' + color + '_' + intensity, () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 1 })),
  crystal: (color = 0x9a4dff) =>
    cached('crystal' + color, () =>
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88, flatShading: true }),
    ),
  ice: () =>
    cached('ice', () => {
      const t = Textures.ice();
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, color: 0xb8e0ff, roughness: 0.15, metalness: 0.1, emissive: 0x0a2040, flatShading: true });
    }),
  snow: () => cached('snow', () => new THREE.MeshStandardMaterial({ color: 0xdfe8f5, roughness: 0.8 })),
  lava: () =>
    cached('lava', () => {
      const t = Textures.lava();
      const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.map, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.6 });
      animated.push((dt) => {
        t.map.offset.x += dt * 0.01;
        t.map.offset.y += dt * 0.006;
      });
      return m;
    }),
  water: (color = 0x0c1a14) =>
    cached('water' + color, () => {
      const t = Textures.water();
      const n = t.normalMap.clone();
      n.needsUpdate = true;
      n.repeat.set(24, 24);
      const m = new THREE.MeshStandardMaterial({ color, normalMap: n, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.9, envMapIntensity: 0.35 });
      animated.push((dt) => {
        n.offset.x += dt * 0.02;
        n.offset.y += dt * 0.013;
      });
      return m;
    }),
  fogWall: () =>
    cached('fogWall', () => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: shared.time, uColor: { value: new THREE.Color(0xd8c8ff) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main(){
            vec2 p = vec2(vUv.x * 40.0, vUv.y * 3.0 - uTime * 0.6);
            float v = n(p) * 0.6 + n(p * 2.3 + uTime * 0.2) * 0.4;
            float a = v * smoothstep(1.0, 0.2, vUv.y) * smoothstep(0.0, 0.1, vUv.y) * 0.42;
            gl_FragColor = vec4(uColor * (0.6 + v), a);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      return m;
    }),
  portal: (color = 0x7a3cff) =>
    cached('portal' + color, () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: shared.time, uColor: { value: new THREE.Color(color) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = atan(c.y, c.x);
            float swirl = sin(a * 5.0 + r * 12.0 - uTime * 3.0) * 0.5 + 0.5;
            float core = smoothstep(1.0, 0.0, r);
            vec3 col = uColor * (1.0 + swirl * 2.0) * core + vec3(1.0) * pow(core, 6.0) * 2.0;
            gl_FragColor = vec4(col, core * (0.6 + swirl * 0.4));
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    ),
};

export function updateMaterials(dt) {
  shared.time.value += dt;
  for (const fn of animated) fn(dt);
}

export const sharedTime = shared.time;
