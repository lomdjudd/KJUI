// Ciel nocturne : dégradé, étoiles scintillantes, nébuleuses violettes/vertes et lune.
// Silhouettes de montagnes et de tours à l'horizon pour la profondeur.
import * as THREE from 'three';
import { makeRng } from '../core/utils.js';

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FS = /* glsl */ `
uniform vec3 top; uniform vec3 horizon; uniform vec3 nebula; uniform vec3 nebula2; uniform vec3 moonColor; uniform vec3 moonDir;
uniform float time; uniform float stars; uniform float fogMix; uniform vec3 fogColor;
varying vec3 vDir;
float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ s += a * n3(p); p *= 2.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(horizon * 1.6, top * 2.2 + horizon * 0.25, smoothstep(-0.05, 0.7, y));
  // Nébuleuses
  float neb = fbm(d * 2.5 + vec3(0.0, time * 0.003, 0.0));
  float neb2 = fbm(d * 4.0 + vec3(13.0, 0.0, 7.0));
  float band = smoothstep(0.35, 0.0, abs(d.y - 0.35 + d.x * 0.25));
  col += nebula * pow(neb, 2.5) * 3.2 * band;
  col += nebula2 * pow(neb2, 3.0) * 2.2 * smoothstep(0.1, 0.5, y);
  // Étoiles
  if (stars > 0.0) {
    vec3 sp = d * 180.0;
    vec3 cell = floor(sp);
    float r = h(cell);
    if (r > 0.985) {
      vec3 c = cell + vec3(h(cell + 1.0), h(cell + 2.0), h(cell + 3.0));
      float dist = length(sp - c);
      float tw = 0.6 + 0.4 * sin(time * (2.0 + r * 5.0) + r * 60.0);
      col += vec3(0.9, 0.9, 1.0) * smoothstep(0.35, 0.0, dist) * tw * stars * smoothstep(0.0, 0.25, y) * 2.0;
    }
  }
  // Lune et halo
  float md = dot(d, normalize(moonDir));
  col += moonColor * smoothstep(0.9985, 0.9992, md) * 3.0;
  col += moonColor * pow(max(md, 0.0), 60.0) * 0.5;
  col += moonColor * pow(max(md, 0.0), 8.0) * 0.12;
  // Brume à l'horizon
  col = mix(col, fogColor, fogMix * smoothstep(0.25, -0.02, y));
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  constructor(scene) {
    this.uniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      nebula: { value: new THREE.Color() },
      nebula2: { value: new THREE.Color() },
      moonColor: { value: new THREE.Color() },
      moonDir: { value: new THREE.Vector3(0.4, 0.45, -0.8) },
      time: { value: 0 },
      stars: { value: 1 },
      fogMix: { value: 0.7 },
      fogColor: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VS,
      fragmentShader: SKY_FS,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    this.mesh.scale.setScalar(120);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
    this.horizonGroup = new THREE.Group();
    scene.add(this.horizonGroup);
  }

  setPalette(p, indoor = false) {
    const u = this.uniforms;
    u.top.value.set(p.skyTop);
    u.horizon.value.set(p.horizon);
    u.nebula.value.set(p.nebula || 0);
    u.nebula2.value.set(p.nebula2 || 0);
    u.moonColor.value.set(p.moonDisc || 0);
    u.stars.value = indoor ? 0 : p.stars ?? 1;
    u.fogColor.value.set(p.fog);
    this.mesh.visible = !indoor;
  }

  // Silhouettes lointaines (montagnes + tours gothiques)
  buildHorizon(zoneSize, palette, seed, withCastle = false) {
    this.horizonGroup.clear();
    const rng = makeRng(seed);
    const geos = [];
    const R = 165;
    const n = 42;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.1;
      const h = 25 + rng() * 45;
      const w = 30 + rng() * 40;
      const g = new THREE.ConeGeometry(w, h, 5, 1);
      g.translate(Math.cos(a) * (R + rng() * 25), h / 2 - 8, Math.sin(a) * (R + rng() * 25));
      geos.push(g);
    }
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.fog).multiplyScalar(0.55), fog: false });
    for (const g of geos) {
      const m = new THREE.Mesh(g, mat);
      this.horizonGroup.add(m);
    }
    if (withCastle) {
      // Silhouette du château vert de Nocthar au loin (cf. image de référence)
      const castle = new THREE.Group();
      const dark = new THREE.MeshBasicMaterial({ color: 0x08100c, fog: false });
      const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x39ff6a).multiplyScalar(2.5), fog: false });
      const towers = [[0, 60, 7], [-14, 42, 5], [14, 46, 5], [-26, 30, 4], [26, 32, 4], [-7, 50, 4], [7, 54, 4]];
      for (const [x, h, r] of towers) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 8), dark);
        t.position.set(x, h / 2, 0);
        castle.add(t);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, h * 0.45, 8), dark);
        roof.position.set(x, h + h * 0.22, 0);
        castle.add(roof);
        for (let k = 0; k < 5; k++) {
          const wdw = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.35, r * 0.7), glow);
          wdw.position.set(x + (rng() - 0.5) * r, h * (0.3 + rng() * 0.6), r + 0.05);
          castle.add(wdw);
        }
      }
      const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 18, 6), dark);
      wall.position.set(0, 9, 3);
      castle.add(wall);
      castle.position.set(0, -6, -178);
      castle.scale.setScalar(1.3);
      this.horizonGroup.add(castle);
    }
  }

  update(dt, camPos) {
    this.uniforms.time.value += dt;
    this.mesh.position.copy(camPos);
    this.horizonGroup.position.set(camPos.x, 0, camPos.z);
  }
}
