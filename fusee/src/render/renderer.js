// Rendu : WebGL2, profondeur logarithmique (de 10 cm à 10¹³ m), bloom HDR.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const QUALITY = {
  low: { pixelRatio: 1, bloom: false, shadows: false, msaa: 0, atmSteps: 6, sphereSeg: 96, particles: 600, texScale: 0.5 },
  medium: { pixelRatio: 1.5, bloom: true, shadows: true, msaa: 2, atmSteps: 10, sphereSeg: 160, particles: 1400, texScale: 1 },
  high: { pixelRatio: 2, bloom: true, shadows: true, msaa: 4, atmSteps: 14, sphereSeg: 220, particles: 2600, texScale: 1 },
};

export class Renderer {
  constructor(canvas, qualityName = 'medium') {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.scene = null;
    this.camera = null;
    this.setQuality(qualityName);
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    this.qualityName = QUALITY[name] ? name : 'medium';
    this.q = QUALITY[this.qualityName];
    const r = this.renderer;
    r.shadowMap.enabled = this.q.shadows;
    this.buildComposer();
    this.resize();
  }

  buildComposer() {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: this.q.msaa,
    });
    if (this.composer) this.composer.dispose();
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.bloom = null;
    if (this.q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.55, 0.92);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
  }

  setBloom(strength, radius = 0.55, threshold = 0.92) {
    if (!this.bloom) return;
    this.bloom.strength = strength;
    this.bloom.radius = radius;
    this.bloom.threshold = threshold;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.q.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.width = w;
    this.height = h;
    if (this.onResize) this.onResize(w, h);
  }

  render(scene, camera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }
}
