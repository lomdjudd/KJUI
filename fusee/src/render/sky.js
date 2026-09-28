// Ciel : étoiles, Voie lactée, halo et reflets du Soleil.

import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import { STAR_VS, STAR_FS, MILKY_FS } from './shaders.js';
import { mulberry32 } from '../core/noise.js';

const FAR = 20000; // ciel dessiné en premier, sans test de profondeur

function flareTex(kind) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  if (kind === 'core') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(255,250,235,0.95)');
    g.addColorStop(0.25, 'rgba(255,210,150,0.35)');
    g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // rayons
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate((i * Math.PI) / 6);
      const gg = ctx.createLinearGradient(-S / 2, 0, S / 2, 0);
      gg.addColorStop(0, 'rgba(255,230,200,0)');
      gg.addColorStop(0.5, 'rgba(255,240,220,0.35)');
      gg.addColorStop(1, 'rgba(255,230,200,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(-S / 2, -1.5, S, 3);
      ctx.restore();
    }
  } else if (kind === 'ring') {
    ctx.strokeStyle = 'rgba(160,200,255,0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Sky {
  constructor() {
    this.group = new THREE.Group();
    // Étoiles
    const N = 9000;
    const rnd = mulberry32(12345);
    const pos = new Float32Array(N * 3), size = new Float32Array(N), tint = new Float32Array(N * 3);
    const bandN = new THREE.Vector3(0.3, 0.55, 0.78).normalize();
    for (let i = 0; i < N; i++) {
      let x, y, z;
      // concentration vers la Voie lactée
      for (;;) {
        const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        x = s * Math.cos(th); y = s * Math.sin(th); z = u;
        const b = x * bandN.x + y * bandN.y + z * bandN.z;
        if (rnd() < 0.35 + 0.65 * Math.exp(-(b * b) / 0.04)) break;
      }
      const R = FAR * 0.9;
      pos[i * 3] = x * R; pos[i * 3 + 1] = y * R; pos[i * 3 + 2] = z * R;
      const m = Math.pow(rnd(), 6);
      size[i] = 1.2 + m * 5.5;
      const t = rnd();
      const c = t < 0.15 ? [0.7, 0.8, 1.0] : t < 0.7 ? [1, 0.97, 0.92] : t < 0.9 ? [1, 0.85, 0.65] : [1, 0.7, 0.55];
      const br = 0.35 + m * 2.2 + rnd() * 0.3;
      tint[i * 3] = c[0] * br; tint[i * 3 + 1] = c[1] * br; tint[i * 3 + 2] = c[2] * br;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    this.starU = { scale: { value: 1 }, time: { value: 0 }, twinkle: { value: 0 }, brightness: { value: 1 } };
    this.stars = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.starU, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: false, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -10;
    this.group.add(this.stars);
    // Voie lactée : calculée une seule fois dans une texture (économise le GPU)
    this.milkyU = { brightness: { value: 1 } };
    this.milkyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: true });
    const mg = new THREE.SphereGeometry(FAR * 0.95, 64, 32);
    this.milky = new THREE.Mesh(mg, this.milkyMat);
    this.milky.visible = false;
    this.milky.frustumCulled = false;
    this.milky.renderOrder = -11;
    this.group.add(this.milky);

    // Halo du Soleil (sprite) et reflets d'objectif
    const glowMat = new THREE.SpriteMaterial({ map: flareTex('core'), color: new THREE.Color(3, 2.6, 2.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sunGlow = new THREE.Sprite(glowMat);
    this.sunGlow.renderOrder = 5;
    this.lensflare = new Lensflare();
    const soft = flareTex('soft'), ring = flareTex('ring');
    this.lensflare.addElement(new LensflareElement(flareTex('core'), 420, 0, new THREE.Color(1, 0.95, 0.85)));
    this.lensflare.addElement(new LensflareElement(soft, 60, 0.35, new THREE.Color(0.4, 0.6, 1)));
    this.lensflare.addElement(new LensflareElement(ring, 120, 0.55, new THREE.Color(0.6, 0.8, 1)));
    this.lensflare.addElement(new LensflareElement(soft, 90, 0.8, new THREE.Color(1, 0.6, 0.4)));
    this.lensflare.addElement(new LensflareElement(ring, 200, 1.0, new THREE.Color(0.5, 0.7, 1)));
    this.flareOn = true;
  }

  // Pré-calcul de la Voie lactée (texture équirectangulaire)
  bake(renderer) {
    if (this.milkyMat.map) return;
    const W = 2048, H = 1024;
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: { brightness: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: MILKY_FS.replace('#include <logdepthbuf_pars_fragment>', '').replace('#include <logdepthbuf_fragment>', '')
        .replace('varying vec3 vWorld;\nvarying vec3 vObjN;', 'varying vec2 vUv;')
        .replace('vec3 d = normalize(vObjN);', 'float lon = (vUv.x - 0.5) * 6.2831853; float lat = (vUv.y - 0.5) * 3.1415927; vec3 d = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));'),
      depthTest: false, depthWrite: false,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prev);
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.milkyMat.map = rt.texture;
    this.milkyMat.needsUpdate = true;
    this.milky.visible = true;
  }

  attach(scene) {
    scene.add(this.group);
    scene.add(this.sunGlow);
  }

  // cam : caméra (les étoiles suivent sa position) ; sunRel : position du Soleil relative à l'origine
  update(cam, sunRel, sunRadius, dt, opts = {}) {
    this.group.position.copy(cam.position);
    this.starU.time.value += dt;
    this.starU.brightness.value = opts.starBrightness ?? 1;
    this.starU.twinkle.value = opts.twinkle ?? 0;
    this.starU.scale.value = opts.pixelRatio ?? 1;
    this.milkyMat.color.setScalar((opts.starBrightness ?? 1) * 3.2);
    const d = Math.hypot(sunRel.x - cam.position.x, sunRel.y - cam.position.y, sunRel.z - cam.position.z);
    // halo à la position du Soleil (taille apparente + halo)
    this.sunGlow.position.copy(sunRel);
    const ang = sunRadius / Math.max(d, 1);
    const s = d * Math.max(ang * 14, 0.018);
    this.sunGlow.scale.set(s, s, 1);
    this.sunGlow.material.opacity = opts.sunGlow ?? 1;
    this.sunGlow.visible = (opts.sunGlow ?? 1) > 0.01;
  }
}
