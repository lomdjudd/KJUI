import * as THREE from 'three';
import { clamp } from '../engine/utils.js';

const rainVert = /* glsl */ `
attribute float tip;
uniform float time;
uniform vec3 center;
varying float vTip;
void main() {
  vec3 p = position;
  // chute et bouclage dans une boîte qui suit la caméra
  p.y = mod(p.y - time * 32.0, 44.0) - 22.0;
  p.x += tip * 0.18;
  p.y += tip * 1.1;
  vec3 w = p + center;
  vTip = tip;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const rainFrag = /* glsl */ `
uniform float opacity;
varying float vTip;
void main() {
  gl_FragColor = vec4(0.72, 0.78, 0.9, opacity * (0.35 + vTip * 0.65));
}`;

// Météo : pluie, orages et chaussée mouillée
export class Weather {
  constructor(game) {
    this.game = game;
    this.mode = game.save.settings.weather || 'auto';
    this.rain = 0;
    this.target = this.mode === 'rain' ? 1 : 0;
    this.timer = 120 + Math.random() * 120;
    this.flash = 0;
    this.nextBolt = 6;
    const N = game.quality.shadows ? 2600 : 1400;
    const pos = new Float32Array(N * 2 * 3);
    const tip = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 70;
      const y = Math.random() * 44;
      const z = (Math.random() - 0.5) * 70;
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3);
        tip[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
    this.uniforms = { time: { value: 0 }, center: { value: new THREE.Vector3() }, opacity: { value: 0 } };
    this.mesh = new THREE.LineSegments(
      g,
      new THREE.ShaderMaterial({ vertexShader: rainVert, fragmentShader: rainFrag, uniforms: this.uniforms, transparent: true, depthWrite: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    game.scene.add(this.mesh);
  }

  setMode(m) {
    this.mode = m;
    if (m === 'rain') this.target = 1;
    else if (m === 'clear') this.target = 0;
  }

  get label() {
    return this.rain > 0.5 ? 'Pluie' : 'Clair';
  }

  update(dt, camPos) {
    const g = this.game;
    if (this.mode === 'auto') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.target = Math.random() < 0.35 ? 1 : 0;
        this.timer = this.target ? 90 + Math.random() * 90 : 150 + Math.random() * 200;
        if (this.target) g.hud.toast('La pluie commence à tomber sur New York…');
      }
    }
    this.rain += (this.target - this.rain) * Math.min(1, dt * 0.25);
    if (Math.abs(this.rain - this.target) < 0.002) this.rain = this.target;
    const r = this.rain;
    this.uniforms.time.value += dt;
    this.uniforms.center.value.set(Math.round(camPos.x), camPos.y - 8, Math.round(camPos.z));
    this.uniforms.opacity.value = r * 0.55;
    this.mesh.visible = r > 0.02;

    // Éclairs pendant les grosses pluies
    this.flash = Math.max(0, this.flash - dt * 3);
    if (r > 0.7) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 7 + Math.random() * 14;
        this.flash = 1;
        const delay = 600 + Math.random() * 1600;
        setTimeout(() => g.audio.play('thunder'), delay);
      }
    }
    g.env.rain = r;
    g.env.flash = this.flash;
    g.city.setWet(r);
    g.audio.setRain(r);
  }
}

// Hélicoptères d'information / de police qui survolent la ville
export class Helicopters {
  constructor(scene, city) {
    this.list = [];
    const mk = (color) => {
      const grp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10), mat);
      body.scale.set(1, 0.9, 1.6);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.8, roughness: 0.1 }));
      glass.position.set(0, 0.25, 1.25);
      glass.scale.set(0.9, 0.7, 0.8);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 5), mat);
      tail.position.set(0, 0.3, -3.8);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.7), mat);
      fin.position.set(0, 0.8, -6.1);
      const rotor = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0x151515 }));
        b.rotation.y = (k * Math.PI) / 2;
        rotor.add(b);
      }
      rotor.position.y = 1.7;
      const skidMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      for (const sx of [-0.9, 0.9]) {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.6), skidMat);
        skid.position.set(sx, -1.5, 0);
        grp.add(skid);
      }
      const blink = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      blink.position.set(0, -0.2, -6.3);
      // cône de projecteur (visible la nuit)
      const coneG = new THREE.ConeGeometry(9, 110, 20, 1, true);
      coneG.translate(0, -55, 0);
      const cone = new THREE.Mesh(
        coneG,
        new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      cone.position.set(0, -1.4, 1.2);
      cone.rotation.x = 0.35;
      grp.add(body, glass, tail, fin, rotor, blink, cone);
      scene.add(grp);
      return { grp, rotor, blink, cone };
    };
    const centers = [city.landmarks.oscorp, city.landmarks.park, city.landmarks.bugle];
    const colors = [0xf2f2f2, 0x1d2f6b, 0x2a2a2a];
    centers.forEach((c, i) => {
      const h = mk(colors[i]);
      h.cx = c.x;
      h.cz = c.z;
      h.r = 160 + i * 60;
      h.alt = 150 + i * 30;
      h.a = i * 2.1;
      h.speed = (0.05 + i * 0.012) * (i % 2 ? -1 : 1);
      this.list.push(h);
    });
  }

  update(dt, night, t) {
    for (const h of this.list) {
      h.a += h.speed * dt;
      const x = h.cx + Math.cos(h.a) * h.r;
      const z = h.cz + Math.sin(h.a) * h.r;
      h.grp.position.set(x, h.alt + Math.sin(t * 0.3 + h.a) * 6, z);
      // orientation tangente au cercle
      const dir = h.speed > 0 ? 1 : -1;
      h.grp.rotation.set(0, Math.atan2(-Math.sin(h.a) * dir, Math.cos(h.a) * dir), dir * 0.18);
      h.rotor.rotation.y += dt * 30;
      h.blink.visible = Math.sin(t * 6 + h.a) > 0.4;
      h.cone.material.opacity = clamp(night, 0, 1) * 0.1;
      h.cone.visible = night > 0.05;
    }
  }
}
