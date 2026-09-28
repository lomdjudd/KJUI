// Rendu + post-traitement « génération Xbox 360 » : HDR, halo (bloom dual-kawase),
// tonemapping ACES, étalonnage par zone, vignettage, grain, aberration chromatique,
// FXAA / MSAA, filtres daltoniens et résolution dynamique.
import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { settings } from '../core/settings.js';
import { clamp, isMobile } from '../core/utils.js';
import { device } from '../core/device.js';

const _wv = new THREE.Vector3();

const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOWN_FS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 halfPx; uniform float threshold; uniform float knee; uniform bool bright;
varying vec2 vUv;
vec3 pre(vec3 c){
  if(!bright) return c;
  c = min(c, vec3(24.0));
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - threshold) / max(br, 1e-4);
  return c * contrib;
}
void main(){
  vec3 s = pre(texture2D(tSrc, vUv).rgb) * 4.0;
  s += pre(texture2D(tSrc, vUv - halfPx).rgb);
  s += pre(texture2D(tSrc, vUv + halfPx).rgb);
  s += pre(texture2D(tSrc, vUv + vec2(halfPx.x, -halfPx.y)).rgb);
  s += pre(texture2D(tSrc, vUv - vec2(halfPx.x, -halfPx.y)).rgb);
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;

const UP_FS = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 halfPx; uniform float baseMix;
varying vec2 vUv;
void main(){
  vec3 s = texture2D(tSrc, vUv + vec2(-halfPx.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-halfPx.x, halfPx.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, halfPx.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(halfPx.x, halfPx.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(halfPx.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(halfPx.x, -halfPx.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -halfPx.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-halfPx.x, -halfPx.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tBase, vUv).rgb * baseMix, 1.0);
}`;

const COMPOSITE_FS = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform bool useBloom; uniform float bloomStrength; uniform float exposure;
uniform float vignette; uniform float grain; uniform float chroma; uniform float time;
uniform float gamma; uniform float saturation; uniform float contrast;
uniform vec3 tint; uniform vec3 lift; uniform float damage; uniform float lowHp; uniform float flash; uniform vec3 flashColor;
uniform int colorblind; uniform vec2 res; uniform float aspect;
uniform vec4 waves[4]; uniform float shadowT; uniform float radial;
varying vec2 vUv;

vec3 aces(vec3 x){
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 daltonize(vec3 c, int mode){
  mat3 sim;
  if(mode == 1) sim = mat3(0.0, 0.0, 0.0, 2.02344, 1.0, 0.0, -2.52581, 0.0, 1.0);
  else if(mode == 2) sim = mat3(1.0, 0.494207, 0.0, 0.0, 0.0, 0.0, 0.0, 1.24827, 1.0);
  else sim = mat3(1.0, 0.0, -0.395913, 0.0, 1.0, 0.801109, 0.0, 0.0, 0.0);
  mat3 rgb2lms = mat3(17.8824, 3.45565, 0.0299566, 43.5161, 27.1554, 0.184309, 4.11935, 3.86714, 1.46709);
  mat3 lms2rgb = mat3(0.0809444479, -0.0102485335, -0.000365296938, -0.130504409, 0.0540193266, -0.00412161469, 0.116721066, -0.113614708, 0.693511405);
  vec3 lms = rgb2lms * c;
  vec3 s = lms2rgb * (sim * lms);
  vec3 err = c - s;
  vec3 corr = vec3(0.0, err.r * 0.7 + err.g, err.r * 0.7 + err.b);
  return clamp(c + corr, 0.0, 1.0);
}
void main(){
  vec2 uv = vUv;
  // Ondes de choc : distorsion annulaire autour du point d'impact
  float waveEdge = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 w = waves[i];
    if (w.w <= 0.0) continue;
    vec2 d = (uv - w.xy) * vec2(aspect, 1.0);
    float r = length(d);
    float ring = smoothstep(w.z - 0.06, w.z, r) * (1.0 - smoothstep(w.z, w.z + 0.05, r));
    uv -= normalize(d + 1e-5) / vec2(aspect, 1.0) * ring * w.w * 0.035;
    waveEdge += ring * w.w;
  }
  vec2 dc = uv - 0.5;
  vec3 col;
  float ch = chroma + waveEdge * 3.0 + shadowT * 1.5;
  if(ch > 0.0){
    vec2 off = dc * ch * 0.006;
    col.r = texture2D(tScene, uv + off).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - off).b;
  } else col = texture2D(tScene, uv).rgb;
  // Flou radial (ruées, Temps des Ombres)
  float rb = radial + shadowT * 0.35;
  if (rb > 0.01) {
    vec3 acc = col;
    for (int i = 1; i <= 4; i++) acc += texture2D(tScene, uv - dc * float(i) * 0.012 * rb).rgb;
    col = acc / 5.0;
  }
  if(useBloom) col += texture2D(tBloom, uv).rgb * bloomStrength;
  col *= exposure;
  col = aces(col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation * (1.0 - lowHp * 0.7));
  col = (col - 0.5) * contrast + 0.5;
  col = max(col * tint + lift, 0.0);
  // Temps des Ombres : monde désaturé, teinté de violet, vignettage appuyé
  if (shadowT > 0.0) {
    float lm = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 mono = vec3(lm) * vec3(0.78, 0.62, 1.15);
    float keep = smoothstep(0.55, 0.9, max(col.r, col.b) - lm);
    col = mix(col, mix(mono, col, keep), shadowT * 0.85);
  }
  float r = length(dc * vec2(aspect, 1.0));
  float vig = smoothstep(1.05, 0.25, r);
  col *= mix(1.0, vig, min(1.0, vignette + shadowT * 0.6));
  float edge = smoothstep(0.35, 1.0, r);
  col = mix(col, vec3(0.45, 0.0, 0.02), clamp(damage * edge * 1.4 + lowHp * edge * 0.35, 0.0, 0.85));
  col = mix(col, flashColor, flash);
  col = pow(col, vec3(1.0 / gamma));
  col = toSRGB(clamp(col, 0.0, 1.0));
  if(colorblind > 0) col = daltonize(col, colorblind);
  col += (hash(uv * res + fract(time) * 91.7) - 0.5) * grain;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    }));
    r.setPixelRatio(1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.info.autoReset = true;
    this.maxDpr = device.rec.maxDpr || 2;
    this.dynScale = 1;
    this.frameTimes = [];
    this.lastResize = 0;
    this.time = 0;
    this.grade = {
      tint: new THREE.Color(1, 1, 1),
      lift: new THREE.Color(0, 0, 0),
      saturation: 1,
      contrast: 1.05,
      exposure: 1,
    };
    this.fx = { damage: 0, lowHp: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1), shadowTime: 0 };
    const ext = r.extensions;
    this.hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);

    this.downMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, halfPx: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 }, bright: { value: false } },
      vertexShader: QUAD_VS,
      fragmentShader: DOWN_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.upMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, tBase: { value: null }, halfPx: { value: new THREE.Vector2() }, baseMix: { value: 1 } },
      vertexShader: QUAD_VS,
      fragmentShader: UP_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, useBloom: { value: true }, bloomStrength: { value: 0.8 },
        exposure: { value: 1 }, vignette: { value: 0.6 }, grain: { value: 0.04 }, chroma: { value: 0 }, time: { value: 0 },
        gamma: { value: 1 }, saturation: { value: 1 }, contrast: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) },
        lift: { value: new THREE.Color(0, 0, 0) }, damage: { value: 0 }, lowHp: { value: 0 }, flash: { value: 0 },
        flashColor: { value: new THREE.Color(1, 1, 1) }, colorblind: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, aspect: { value: 1 },
        waves: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, shadowT: { value: 0 }, radial: { value: 0 },
      },
      vertexShader: QUAD_VS,
      fragmentShader: COMPOSITE_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.fxaaMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: FXAAShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    this.targets = null;
    this.applySettings();
    settings.onChange((k) => {
      if (k === '*' || ['renderScale', 'aa', 'bloom', 'shadows', 'preset', 'dynamicRes', 'powerSave'].includes(k)) this.applySettings();
    });
    window.addEventListener('resize', () => this.resize(true));
  }

  applySettings() {
    const s = settings.values;
    this.usePost = !!(s.bloom || s.aa === 'fxaa' || s.grain || s.chroma || s.colorblind !== 'none' || s.vignette > 0.05 || s.aa === 'msaa');
    this.renderer.shadowMap.enabled = s.shadows !== 'off';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = this.usePost ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = this.usePost ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
    if (!s.dynamicRes) this.dynScale = 1;
    this._disposeTargets();
    this.resize(true);
    // Les matériaux doivent être recompilés si le tonemapping change
    this.needsMaterialUpdate = true;
  }

  _disposeTargets() {
    if (!this.targets) return;
    const t = this.targets;
    t.scene.dispose();
    if (t.ldr) t.ldr.dispose();
    t.down.forEach((d) => d.dispose());
    t.up.forEach((d) => d.dispose());
    this.targets = null;
  }

  get pixelRatio() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    return dpr * settings.get('renderScale') * this.dynScale * (settings.get('powerSave') ? 0.8 : 1);
  }

  resize(force = false) {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const pr = this.pixelRatio;
    const rw = Math.max(64, Math.round(w * pr));
    const rh = Math.max(64, Math.round(h * pr));
    if (!force && this.size && this.size.w === rw && this.size.h === rh) return;
    this.size = { w: rw, h: rh, cssW: w, cssH: h };
    this.renderer.setSize(rw, rh, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (!this.usePost) {
      this._disposeTargets();
      return;
    }
    const s = settings.values;
    const type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const mk = (ww, hh, opts = {}) =>
      new THREE.WebGLRenderTarget(ww, hh, {
        type,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        generateMipmaps: false,
        ...opts,
      });
    if (this.targets && this.targets.w === rw && this.targets.h === rh && this.targets.msaa === (s.aa === 'msaa')) return;
    this._disposeTargets();
    const scene = mk(rw, rh, { depthBuffer: true, samples: s.aa === 'msaa' ? 4 : 0 });
    const down = [];
    const up = [];
    let bw = rw;
    let bh = rh;
    const levels = isMobile ? 4 : 5;
    for (let i = 0; i < levels; i++) {
      bw = Math.max(2, Math.round(bw / 2));
      bh = Math.max(2, Math.round(bh / 2));
      if (i === 0) continue; // on démarre à 1/4 de résolution
      down.push(mk(bw, bh));
    }
    for (let i = 0; i < down.length - 1; i++) up.push(mk(down[i].width, down[i].height));
    const ldr = s.aa === 'fxaa' ? mk(rw, rh, { type: THREE.UnsignedByteType }) : null;
    this.targets = { scene, down, up, ldr, w: rw, h: rh, msaa: s.aa === 'msaa' };
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  setGrade(g) {
    if (g.tint) this.grade.tint.set(g.tint);
    if (g.lift) this.grade.lift.set(g.lift);
    if (g.saturation !== undefined) this.grade.saturation = g.saturation;
    if (g.contrast !== undefined) this.grade.contrast = g.contrast;
    if (g.exposure !== undefined) this.grade.exposure = g.exposure;
  }

  // Résolution dynamique : ajuste l'échelle selon le temps de frame mesuré
  _dynamic(dt) {
    if (!settings.get('dynamicRes')) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const limit = settings.get('powerSave') ? 30 : settings.get('fpsLimit') || 60;
    const target = 1 / Math.min(limit, 60);
    const now = performance.now();
    if (now - this.lastResize < 1500) return;
    let ns = this.dynScale;
    if (avg > target * 1.2) ns = clamp(ns - 0.08, 0.55, 1);
    else if (avg < target * 1.04) ns = clamp(ns + 0.05, 0.55, 1);
    if (Math.abs(ns - this.dynScale) > 0.01) {
      this.dynScale = ns;
      this.lastResize = now;
      this.resize();
    }
  }

  render(scene, camera, dt) {
    this.camera = camera;
    this.time += dt;
    this._dynamic(dt);
    const r = this.renderer;
    if (!this.usePost || !this.targets) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      this._overlay();
      return;
    }
    const s = settings.values;
    const t = this.targets;
    r.setRenderTarget(t.scene);
    r.render(scene, camera);
    this._overlay();

    const useBloom = s.bloom && s.bloomStrength > 0.01;
    if (useBloom) {
      // Descente
      let src = t.scene;
      for (let i = 0; i < t.down.length; i++) {
        const u = this.downMat.uniforms;
        u.tSrc.value = src.texture;
        u.halfPx.value.set(0.5 / src.width * (i === 0 ? 2 : 1), 0.5 / src.height * (i === 0 ? 2 : 1));
        u.bright.value = i === 0;
        u.threshold.value = this.hdr ? 0.95 : 0.7;
        u.knee.value = this.hdr ? 0.6 : 0.3;
        this._pass(this.downMat, t.down[i]);
        src = t.down[i];
      }
      // Remontée
      for (let i = t.up.length - 1; i >= 0; i--) {
        const small = i === t.up.length - 1 ? t.down[i + 1] : t.up[i + 1];
        const u = this.upMat.uniforms;
        u.tSrc.value = small.texture;
        u.tBase.value = t.down[i].texture;
        u.halfPx.value.set(0.5 / small.width, 0.5 / small.height);
        u.baseMix.value = 1;
        this._pass(this.upMat, t.up[i]);
      }
    }
    const c = this.compMat.uniforms;
    c.tScene.value = t.scene.texture;
    c.tBloom.value = useBloom ? (t.up[0] || t.down[0]).texture : null;
    c.useBloom.value = useBloom;
    c.bloomStrength.value = s.bloomStrength * 0.55;
    c.exposure.value = this.grade.exposure * 1.15;
    c.vignette.value = s.vignette;
    c.grain.value = s.grain ? 0.045 : 0;
    c.chroma.value = s.chroma ? 1 : 0;
    c.time.value = this.time;
    c.gamma.value = s.gamma;
    c.saturation.value = this.grade.saturation;
    c.contrast.value = this.grade.contrast;
    c.tint.value.copy(this.grade.tint);
    c.lift.value.copy(this.grade.lift);
    c.damage.value = this.fx.damage;
    c.lowHp.value = this.fx.lowHp;
    c.flash.value = this.fx.flash;
    c.flashColor.value.copy(this.fx.flashColor);
    c.colorblind.value = { none: 0, protan: 1, deutan: 2, tritan: 3 }[s.colorblind] || 0;
    c.res.value.set(t.w, t.h);
    c.aspect.value = t.w / t.h;
    c.shadowT.value = this.fx.shadowTime || 0;
    c.radial.value = this.fx.radial || 0;
    this._updateWaves(camera, c.waves.value);
    if (t.ldr) {
      this._pass(this.compMat, t.ldr);
      this.fxaaMat.uniforms.tDiffuse.value = t.ldr.texture;
      this.fxaaMat.uniforms.resolution.value.set(1 / t.w, 1 / t.h);
      this._pass(this.fxaaMat, null);
    } else {
      this._pass(this.compMat, null);
    }
  }

  // Ondes de choc : position monde → écran, rayon croissant, intensité décroissante
  addWave(pos, strength = 0.6) {
    if (!this.waves) this.waves = [];
    if (this.waves.length >= 4) this.waves.shift();
    this.waves.push({ x: pos.x, y: (pos.y || 0) + 1, z: pos.z, t: 0, dur: 0.45 + strength * 0.25, s: strength });
  }

  _updateWaves(camera, out) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this._wLast || now)) / 1000);
    this._wLast = now;
    const list = this.waves || [];
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].t += dt;
      if (list[i].t >= list[i].dur) list.splice(i, 1);
    }
    for (let i = 0; i < 4; i++) {
      const w = list[i];
      if (!w) {
        out[i].set(0, 0, 0, 0);
        continue;
      }
      _wv.set(w.x, w.y, w.z).project(camera);
      if (_wv.z > 1) {
        out[i].set(0, 0, 0, 0);
        continue;
      }
      const k = w.t / w.dur;
      out[i].set(_wv.x * 0.5 + 0.5, _wv.y * 0.5 + 0.5, 0.02 + k * (0.18 + w.s * 0.25), w.s * (1 - k) * (1 - k));
    }
  }

  // Passe par-dessus la scène (vue 1re personne) : profondeur effacée
  _overlay() {
    const o = this.overlay;
    if (!o) return;
    const r = this.renderer;
    const ac = r.autoClear;
    r.autoClear = false;
    r.clearDepth();
    r.render(o.scene, o.camera);
    r.autoClear = ac;
  }

  // Effets plein écran pilotés par le jeu (décroissance automatique)
  updateFx() {
    // Décroissance en temps réel (indépendante des ralentis et des chutes d'images)
    const now = performance.now();
    const dt = Math.min(0.25, (now - (this._fxLast || now)) / 1000);
    this._fxLast = now;
    this.fx.damage = Math.max(0, this.fx.damage - dt * 2.2);
    this.fx.flash = Math.max(0, this.fx.flash - dt * 3);
    this.fx.radial = Math.max(0, (this.fx.radial || 0) - dt * 3.5);
  }
}
