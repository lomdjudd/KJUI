import * as THREE from 'three';
import { clamp, lerp, smooth } from '../engine/utils.js';

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFrag = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 groundCol;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float stars;
uniform float time;
uniform float cloudLight;
uniform float cover;
uniform float flash;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, groundCol, clamp(-h * 3.0, 0.0, 1.0));
  float s = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(s, 1500.0) * 30.0 + pow(s, 64.0) * 0.6 + pow(s, 6.0) * 0.25);

  // Étoiles
  if (stars > 0.01 && h > 0.0) {
    vec2 sp = d.xz / (d.y + 0.3) * 180.0;
    float st = step(0.997, hash(floor(sp)));
    col += vec3(st) * stars * clamp(h * 3.0, 0.0, 1.0);
  }

  // Nuages
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.3 + vec2(time * 0.004, time * 0.0015);
    float c = fbm(uv);
    c = smoothstep(0.5 - cover * 0.42, 0.85 - cover * 0.2, c) * clamp(h * 6.0, 0.0, 1.0);
    vec3 cl = mix(horizon * 0.9 + 0.08, vec3(1.0), cloudLight) * (1.0 - cover * 0.55);
    cl += sunColor * pow(s, 8.0) * 0.6;
    col = mix(col, cl, c * (0.85 + cover * 0.15));
  }

  col = mix(col, col * 0.55 + vec3(0.08, 0.09, 0.1), cover * 0.6);
  col += vec3(0.8, 0.85, 1.0) * flash * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Palettes selon l'élévation du soleil
const PALETTES = [
  { e: -0.35, zenith: '#050a1c', horizon: '#18264a', sun: '#000000', light: '#8fa6e8', li: 1.0, hemi: 0.75, fog: '#141e38', stars: 1, cloud: 0.1 },
  { e: -0.05, zenith: '#1b2a55', horizon: '#c0563a', sun: '#ff6a2a', light: '#ff9a66', li: 1.0, hemi: 0.6, fog: '#6a4a52', stars: 0.25, cloud: 0.35 },
  { e: 0.12, zenith: '#3a5d99', horizon: '#ffae6b', sun: '#ffb070', light: '#ffc28a', li: 2.2, hemi: 0.55, fog: '#d9a27f', stars: 0, cloud: 0.75 },
  { e: 0.35, zenith: '#3b76c8', horizon: '#cfe0ee', sun: '#fff0d8', light: '#fff1dc', li: 2.5, hemi: 0.7, fog: '#b9cde0', stars: 0, cloud: 1 },
  { e: 1.0, zenith: '#2f6ccc', horizon: '#c4dcf2', sun: '#ffffff', light: '#fffaf0', li: 2.7, hemi: 0.75, fog: '#b3cbe3', stars: 0, cloud: 1 },
];

const _c1 = new THREE.Color();
const _nightSky = new THREE.Color('#6d82c8');
const _rainFog = new THREE.Color('#5a6270');
const _dayGround = new THREE.Color('#4a4036');
const _nightGround = new THREE.Color('#2a2a3a');
const _c2 = new THREE.Color();

function samplePalette(e) {
  let a = PALETTES[0];
  let b = PALETTES[PALETTES.length - 1];
  for (let i = 0; i < PALETTES.length - 1; i++) {
    if (e >= PALETTES[i].e && e <= PALETTES[i + 1].e) {
      a = PALETTES[i];
      b = PALETTES[i + 1];
      break;
    }
  }
  if (e < PALETTES[0].e) b = a;
  const t = a === b ? 0 : smooth(clamp((e - a.e) / (b.e - a.e), 0, 1));
  const mixC = (k) => _c1.set(a[k]).lerp(_c2.set(b[k]), t).clone();
  return {
    zenith: mixC('zenith'),
    horizon: mixC('horizon'),
    sun: mixC('sun'),
    light: mixC('light'),
    fog: mixC('fog'),
    li: lerp(a.li, b.li, t),
    hemi: lerp(a.hemi, b.hemi, t),
    stars: lerp(a.stars, b.stars, t),
    cloud: lerp(a.cloud, b.cloud, t),
  };
}

export class Environment {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 17.2; // heure de départ : fin d'après-midi dorée
    this.timeSpeed = 1 / 30; // 1 heure de jeu = 30 s
    this.cycle = true;
    this.night = 0;
    this.rain = 0;
    this.flash = 0;
    this.sunDir = new THREE.Vector3();

    this.uniforms = {
      zenith: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      groundCol: { value: new THREE.Color('#2a2f38') },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: this.sunDir },
      stars: { value: 0 },
      time: { value: 0 },
      cloudLight: { value: 1 },
      cover: { value: 0 },
      flash: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
    this.sky.scale.setScalar(4000);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    // Scène séparée contenant uniquement le ciel, pour générer la carte d'environnement (reflets)
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(this.sky.geometry, skyMat);
    this.envSky.scale.setScalar(100);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.lastEnvTime = -99;

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality.shadows;
    const sz = quality.shadowSize;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    sc.left = -70;
    sc.right = 70;
    sc.top = 70;
    sc.bottom = -70;
    sc.near = 1;
    sc.far = 700;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a4036, 0.6);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(0xbfd0e0, 150, quality.fogFar);
    this.fogFar = quality.fogFar;
    this.update(0, new THREE.Vector3());
  }

  update(dt, focus) {
    if (this.cycle) this.time = (this.time + dt * this.timeSpeed) % 24;
    this.uniforms.time.value += dt;
    const ang = ((this.time - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(ang);
    // Soleil : se lève à l'est (+x), se couche à l'ouest, légèrement au sud
    this.sunDir.set(Math.cos(ang), elev, -0.35).normalize();
    const p = samplePalette(elev);
    this.uniforms.zenith.value.copy(p.zenith);
    this.uniforms.horizon.value.copy(p.horizon);
    this.uniforms.sunColor.value.copy(p.sun);
    this.uniforms.stars.value = p.stars;
    this.uniforms.cloudLight.value = p.cloud;

    this.night = clamp(1 - (elev + 0.2) / 0.35, 0, 1);

    // Lumière principale : soleil le jour, lune la nuit
    const lightDir = elev > -0.02 ? this.sunDir : new THREE.Vector3(-this.sunDir.x, -this.sunDir.y, 0.3).normalize();
    this.sun.color.copy(p.light);
    this.sun.intensity = p.li * (1 - this.rain * 0.7);
    this.sun.position.copy(focus).addScaledVector(lightDir, 300);
    this.sun.target.position.copy(focus);
    this.hemi.intensity = p.hemi * (1 - this.rain * 0.25) + this.flash * 2.5;
    this.uniforms.cover.value = this.rain;
    this.uniforms.flash.value = this.flash;
    this.hemi.color.copy(p.horizon).lerp(p.zenith, 0.5).lerp(_nightSky, this.night * 0.75);
    this.hemi.groundColor.copy(_dayGround).lerp(_nightGround, this.night);
    this.scene.fog.color.copy(p.fog).lerp(_rainFog, this.rain * 0.6);
    this.scene.fog.far = this.fogFar * (1 - this.rain * 0.45);
    this.scene.fog.near = 150 * (1 - this.rain * 0.6);
    this.sky.position.copy(focus);

    if (Math.abs(this.time - this.lastEnvTime) > 0.25 || Math.abs(this.rain - (this.lastEnvRain || 0)) > 0.15 || !this.envRT) {
      this.lastEnvTime = this.time;
      this.lastEnvRain = this.rain;
      const old = this.envRT;
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = lerp(0.5, 0.9, 1 - this.night);
      if (old) old.dispose();
    }
  }

  get hourLabel() {
    const h = Math.floor(this.time);
    const m = Math.floor((this.time - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
