import * as THREE from 'three';

const vert = /* glsl */ `
attribute float size;
attribute float alpha;
attribute vec3 color;
varying float vAlpha;
varying vec3 vColor;
uniform float scale;
void main() {
  vAlpha = alpha;
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(size * scale / max(0.1, -mv.z), 180.0);
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
uniform float soft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = (1.0 - smoothstep(soft, 1.0, d)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}`;

class ParticlePool {
  constructor(scene, max, blending, soft) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { scale: { value: 600 }, soft: { value: soft } },
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  emit(p, v, color, size, life, { grav = 0, drag = 0, grow = 0 } = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x;
    this.vel[i * 3 + 1] = v.y;
    this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.baseSize[i] = size;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.alpha[i] = 1;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.grow[i] = grow;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = 1 - this.drag[i] * dt;
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, k * 2.5);
      this.size[i] = this.baseSize[i] * (1 + this.grow[i] * (1 - k));
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true;
    a.color.needsUpdate = true;
    a.size.needsUpdate = true;
    a.alpha.needsUpdate = true;
  }
}

const _v = new THREE.Vector3();
const _c = new THREE.Color();

export class Particles {
  constructor(scene) {
    this.add = new ParticlePool(scene, 1500, THREE.AdditiveBlending, 0.0);
    this.norm = new ParticlePool(scene, 900, THREE.NormalBlending, 0.3);
  }

  setScale(h) {
    this.add.mat.uniforms.scale.value = h * 0.9;
    this.norm.mat.uniforms.scale.value = h * 0.9;
  }

  sparks(p, n = 14, color = '#ffd27a', speed = 9) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      this.add.emit(p, _v, _c, 0.25 + Math.random() * 0.2, 0.25 + Math.random() * 0.25, { grav: 15, drag: 3 });
    }
    _v.set(0, 0, 0);
    this.add.emit(p, _v, _c, 1.2, 0.12, { grow: 1 });
  }

  impact(p, color = '#ffffff') {
    _c.set(color);
    _v.set(0, 0, 0);
    this.add.emit(p, _v, _c, 1.6, 0.15, { grow: 1.2 });
  }

  dust(p, n = 10) {
    _c.set('#a09a90');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      _v.set(Math.cos(a) * 4, 0.5 + Math.random(), Math.sin(a) * 4);
      this.norm.emit(p, _v, _c, 0.6 + Math.random() * 0.5, 0.7, { drag: 3, grow: 1.5 });
    }
  }

  smoke(p, color = '#555555', size = 3, life = 2.5, rise = 3) {
    _c.set(color);
    _v.set((Math.random() - 0.5) * 1.5, rise * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 1.5);
    this.norm.emit(p, _v, _c, size, life, { drag: 0.3, grow: 2.5 });
  }

  fire(p, size = 2.5) {
    _c.setHSL(0.05 + Math.random() * 0.06, 1, 0.5 + Math.random() * 0.1);
    _v.set((Math.random() - 0.5) * 2, 3 + Math.random() * 4, (Math.random() - 0.5) * 2);
    this.add.emit(p, _v, _c, size, 0.6 + Math.random() * 0.4, { drag: 1, grow: 0.5 });
  }

  explosion(p, scale = 1) {
    for (let i = 0; i < 40 * scale; i++) {
      _c.setHSL(0.03 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.2);
      _v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(6 + Math.random() * 12 * scale);
      this.add.emit(p, _v, _c, 2 + Math.random() * 2 * scale, 0.5 + Math.random() * 0.5, { drag: 3, grow: 1 });
    }
    for (let i = 0; i < 20 * scale; i++) {
      _c.setScalar(0.15 + Math.random() * 0.15);
      _v.set(Math.random() - 0.5, Math.random() * 0.6 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 5);
      this.norm.emit(p, _v, _c, 3 + Math.random() * 3 * scale, 1.5 + Math.random(), { drag: 1.5, grow: 2 });
    }
    this.sparks(p, 20, '#ffb347', 18);
  }

  webPuff(p) {
    _c.set('#f4f4f4');
    for (let i = 0; i < 8; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(5);
      this.norm.emit(p, _v, _c, 0.4 + Math.random() * 0.3, 0.4, { drag: 4 });
    }
  }

  electric(p, n = 20) {
    _c.set('#7fd8ff');
    for (let i = 0; i < n; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(10 + Math.random() * 8);
      this.add.emit(p, _v, _c, 0.35, 0.3, { drag: 5 });
    }
  }

  trail(p, color, size = 0.5, life = 0.35) {
    _c.set(color);
    _v.set(0, 0, 0);
    this.add.emit(p, _v, _c, size, life);
  }

  update(dt) {
    this.add.update(dt);
    this.norm.update(dt);
  }
}
