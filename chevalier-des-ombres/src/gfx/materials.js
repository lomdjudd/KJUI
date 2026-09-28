// Bibliothèque de matériaux partagés. Les personnages utilisent un unique shader
// (couleurs, rugosité, métal et émission par sommet) : un seul programme GPU pour tous.
import * as THREE from 'three';
import { Textures } from './textures.js';

const shared = { time: { value: 0 } };
const animated = [];

// ---------- Matériau des personnages (maillage « skinné » rigide) ----------
export function createCharMaterial(opts = {}) {
  const det = Textures.detail();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 1,
    map: det.map,
    normalMap: det.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 1,
  });
  const u = {
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uDissolve: { value: 0 },
    uDissolveColor: { value: new THREE.Color(opts.dissolveColor || 0x9a4dff) },
    uRim: { value: new THREE.Color(opts.rim || 0x000000) },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMat;\nvarying vec3 vMat;\nvarying vec3 vObjPos;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvMat = aMat;\nvObjPos = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vMat;\nvarying vec3 vObjPos;\nuniform float uFlash;\nuniform vec3 uFlashColor;\nuniform float uDissolve;\nuniform vec3 uDissolveColor;\nuniform vec3 uRim;',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float dn = fract(sin(dot(floor(vObjPos * 14.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        if (uDissolve > 0.0 && dn < uDissolve) discard;`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(roughness * vMat.x, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.y;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * vMat.z * 3.0 + uFlashColor * uFlash;
        if (uDissolve > 0.0 && dn < uDissolve + 0.12) totalEmissiveRadiance += uDissolveColor * 4.0;
        float rimF = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uRim * rimF;`,
      );
  };
  mat.customProgramCacheKey = () => 'char-v1';
  return mat;
}

// ---------- Matériau spectral (fantômes verts, banshees, spectres de glace) ----------
export function createSpectralMaterial(color = 0x39ff9a, opts = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opts.opacity ?? 0.9 },
      uTime: shared.time,
      uFadeLow: { value: opts.fadeLow ?? 0.1 },
      uFlash: { value: 0 },
      uDissolve: { value: 0 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vCol;
      void main(){
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        vH = position.y;
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
      varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vCol;
      void main(){
        float fr = pow(1.0 - abs(dot(normalize(vN), vV)), 2.0);
        float lum = dot(vCol, vec3(0.333));
        float a = (0.18 + fr * 0.9) * uOpacity * (0.5 + lum);
        a *= smoothstep(uFadeLow, uFadeLow + 0.7, vH);
        a *= 1.0 - uDissolve;
        float flick = 0.85 + 0.15 * sin(uTime * 7.0 + vH * 6.0);
        vec3 c = uColor * (0.5 + fr * 2.2) * flick * (0.4 + lum * 1.2) + vec3(uFlash);
        gl_FragColor = vec4(c, a);
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
      const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.map, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.6 });
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
      const m = new THREE.MeshStandardMaterial({ color, normalMap: n, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.92 });
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
            float a = v * smoothstep(1.0, 0.2, vUv.y) * smoothstep(0.0, 0.1, vUv.y) * 0.65;
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
