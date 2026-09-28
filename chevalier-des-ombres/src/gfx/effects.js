// Effets visuels : traînées d'arme, ondes de choc, zones d'attaque au sol (télégraphes),
// rayons, éclairs et lumières dynamiques recyclées (nombre de lumières constant = pas de recompilation).
import * as THREE from 'three';
import { settings } from '../core/settings.js';
import { rand } from '../core/utils.js';

const TELE_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TELE_FS = /* glsl */ `
uniform vec3 uColor; uniform float uProgress; uniform float uAlpha; uniform int uShape; uniform float uAngle; uniform float uTime;
varying vec2 vUv;
void main(){
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float a = 0.0;
  if (uShape == 0) {           // disque
    if (r > 1.0) discard;
    float ring = smoothstep(0.9, 1.0, r) * (1.0 - smoothstep(0.98, 1.0, r)) * 3.0 + smoothstep(0.95, 0.99, r);
    float fill = step(r, uProgress) * 0.35;
    float edgeFill = smoothstep(uProgress - 0.05, uProgress, r) * step(r, uProgress) * 0.6;
    a = ring * 0.8 + fill + edgeFill + 0.08;
  } else if (uShape == 1) {    // cône
    float ang = atan(c.x, c.y);
    if (r > 1.0 || abs(ang) > uAngle) discard;
    float border = smoothstep(uAngle - 0.06, uAngle, abs(ang)) + smoothstep(0.94, 1.0, r);
    a = border * 0.9 + step(r, uProgress) * 0.35 + 0.08;
  } else {                     // rectangle (ligne)
    float bx = abs(c.x) * 2.0; float by = vUv.y;
    float border = smoothstep(0.85, 1.0, bx) + smoothstep(0.97, 1.0, by) + (1.0 - smoothstep(0.0, 0.03, by));
    a = border * 0.8 + step(by, uProgress) * 0.35 + 0.08;
  }
  a *= uAlpha * (0.85 + 0.15 * sin(uTime * 20.0));
  gl_FragColor = vec4(uColor * 1.6, a);
}`;

// Halo rond (éclats d'impact)
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  // Branches d'étoile
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(0, 31, 64, 2);
  g.fillRect(31, 0, 2, 64);
  return new THREE.CanvasTexture(c);
}

// Fissures rayonnantes incandescentes (décalque au sol)
function makeCrackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineCap = 'round';
  const branch = (x, y, a, len, w, depth) => {
    let px = x;
    let py = y;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      a += (Math.random() - 0.5) * 0.7;
      const nx = px + Math.cos(a) * (len / steps);
      const ny = py + Math.sin(a) * (len / steps);
      g.lineWidth = w * (1 - i / steps) + 0.5;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(nx, ny);
      g.stroke();
      if (depth > 0 && Math.random() < 0.35) branch(nx, ny, a + (Math.random() - 0.5) * 1.6, len * 0.45, w * 0.6, depth - 1);
      px = nx;
      py = ny;
    }
  };
  for (let i = 0; i < 9; i++) branch(128, 128, (i / 9) * Math.PI * 2 + Math.random() * 0.4, 90 + Math.random() * 30, 4, 2);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 40);
  grd.addColorStop(0, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export class Effects {
  constructor(scene, particles, particlesAlpha) {
    this.scene = scene;
    this.p = particles;
    this.pa = particlesAlpha;
    this.heightAt = () => 0;
    this.time = 0;

    // Lumières dynamiques recyclées
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 12, 2);
      l.userData.life = 0;
      scene.add(l);
      this.lights.push(l);
    }

    // Anneaux d'onde de choc
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48, 1);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.rings = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        this.ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      m.visible = false;
      m.userData = { life: 0 };
      m.renderOrder = 4;
      scene.add(m);
      this.rings.push(m);
    }

    // Télégraphes au sol (épousent le relief)
    this.teles = [];
    for (let i = 0; i < 24; i++) {
      const geo = new THREE.PlaneGeometry(2, 2, 12, 12);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xff2a2a) },
          uProgress: { value: 0 },
          uAlpha: { value: 1 },
          uShape: { value: 0 },
          uAngle: { value: 0.6 },
          uTime: { value: 0 },
        },
        vertexShader: TELE_VS,
        fragmentShader: TELE_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 3;
      m.frustumCulled = false;
      m.userData = { active: false };
      scene.add(m);
      this.teles.push(m);
    }

    // Rayons (cylindres étirés)
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    this.beamGeo.translate(0, 0.5, 0);
    this.beamGeo.rotateX(Math.PI / 2);
    this.beams = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        this.beamGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      m.visible = false;
      m.userData = { life: 0 };
      scene.add(m);
      this.beams.push(m);
    }

    // Traînées d'armes
    this.trails = [];
    // Silhouettes rémanentes
    this.ghosts = [];
    // Éclats d'impact (sprites additifs)
    this.sprites = [];
    const glowTex = makeGlowTexture();
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending }));
      sp.visible = false;
      sp.renderOrder = 7;
      sp.userData = { life: 0 };
      scene.add(sp);
      this.sprites.push(sp);
    }
    // Fissures au sol
    this.crackPool = [];
    const crackTex = makeCrackTexture();
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ map: crackTex, color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }),
      );
      m.visible = false;
      m.renderOrder = 2;
      m.userData = { life: 0 };
      scene.add(m);
      this.crackPool.push(m);
    }
    this.renderer = null;
  }

  // ---------- Lumières ----------
  flash(pos, color = 0xffaa55, intensity = 30, dist = 10, life = 0.25) {
    let best = this.lights[0];
    for (const l of this.lights) if (l.userData.life < best.userData.life) best = l;
    best.position.set(pos.x, pos.y + 0.8, pos.z);
    best.color.setHex(color);
    best.distance = dist;
    best.userData.life = life;
    best.userData.maxLife = life;
    best.userData.peak = intensity;
    best.intensity = intensity;
  }

  // ---------- Onde de choc ----------
  ring(pos, color = 0xffffff, radius = 4, life = 0.45, y = 0.15) {
    const m = this.rings.find((r) => !r.visible) || this.rings[0];
    m.visible = true;
    m.position.set(pos.x, (pos.y ?? this.heightAt(pos.x, pos.z)) + y, pos.z);
    m.material.color.setHex(color);
    m.userData = { life, maxLife: life, radius };
    m.scale.setScalar(0.1);
  }

  // ---------- Télégraphes ----------
  // shape: 'circle' | 'cone' | 'line'
  telegraph({ x, z, radius = 3, shape = 'circle', angle = 0.6, dir = 0, length = 10, width = 2, duration = 1, color = 0xff2a2a, follow = null }) {
    if (!settings.get('telegraphs')) return { done: true, pos: { x, z } };
    const m = this.teles.find((t) => !t.userData.active);
    if (!m) return { done: true, pos: { x, z } };
    const u = m.material.uniforms;
    u.uColor.value.setHex(color);
    u.uProgress.value = 0;
    u.uAlpha.value = 1;
    u.uShape.value = shape === 'circle' ? 0 : shape === 'cone' ? 1 : 2;
    u.uAngle.value = angle;
    m.visible = true;
    m.rotation.set(0, 0, 0);
    const data = { active: true, t: 0, duration, x, z, radius, shape, dir, length, width, follow, fade: 0 };
    m.userData = data;
    this._shapeTele(m);
    return data;
  }

  _shapeTele(m) {
    const d = m.userData;
    const pos = m.geometry.attributes.position;
    // Remet la grille unitaire puis applique échelle/rotation et hauteur du terrain
    const seg = 12;
    let k = 0;
    const cos = Math.cos(d.dir);
    const sin = Math.sin(d.dir);
    for (let j = 0; j <= seg; j++) {
      for (let i = 0; i <= seg; i++) {
        let lx = (i / seg - 0.5) * 2;
        let lz = (j / seg - 0.5) * 2;
        let wx;
        let wz;
        if (d.shape === 'line') {
          lx *= d.width * 0.5;
          lz = (1 - j / seg) * d.length;
        } else {
          lx *= d.radius;
          lz *= -d.radius;
        }
        wx = d.x + lx * cos + lz * sin;
        wz = d.z - lx * sin + lz * cos;
        pos.setXYZ(k, wx, this.heightAt(wx, wz) + 0.12, wz);
        k++;
      }
    }
    pos.needsUpdate = true;
    m.geometry.computeBoundingSphere();
  }

  cancelTelegraph(data) {
    if (!data) return;
    data.active = false;
    data.fade = 0.01;
  }

  // ---------- Rayon ----------
  beam(from, to, color = 0xff3355, width = 0.3, life = 0.1) {
    const m = this.beams.find((b) => !b.visible) || this.beams[0];
    m.visible = true;
    m.material.color.setHex(color);
    m.position.copy(from);
    m.lookAt(to);
    const len = from.distanceTo(to);
    m.scale.set(width, width, len);
    m.userData = { life, maxLife: life, width };
    return m;
  }

  // Éclair : suite de segments en zigzag entre le ciel et le sol
  lightning(x, z, color = 0xaad4ff) {
    const y0 = this.heightAt(x, z);
    let prev = new THREE.Vector3(x + rand(-2, 2), y0 + 18, z + rand(-2, 2));
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const next = new THREE.Vector3(x + rand(-1.2, 1.2) * (1 - t), y0 + 18 * (1 - t), z + rand(-1.2, 1.2) * (1 - t));
      if (i === steps) next.set(x, y0, z);
      this.beam(prev, next, color, 0.12, 0.18);
      prev = next;
    }
    this.flash({ x, y: y0 + 2, z }, color, 60, 16, 0.2);
  }

  // ---------- Traînée d'arme ----------
  // Ruban lissé (sous-échantillonné), cœur blanc vers la pointe, couleur de l'élément
  createTrail(color = 0xffffff, maxPoints = 22) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(maxPoints * 2 * 3);
    const alpha = new Float32Array(maxPoints * 2);
    const side = new Float32Array(maxPoints * 2);
    for (let i = 0; i < maxPoints; i++) side[i * 2 + 1] = 1;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    const idx = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 } },
      vertexShader: `attribute float aAlpha; attribute float aSide; varying float vA; varying float vS;
        void main(){ vA = aAlpha; vS = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA; varying float vS;
        void main(){
          float edge = pow(vS, 3.0);
          float core = smoothstep(0.55, 1.0, vS) * vA;
          vec3 c = uColor * (0.9 + edge * 1.6) + vec3(1.0) * core * 1.4;
          float a = vA * (0.15 + edge * 0.85) * uOpacity * 0.75;
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    this.scene.add(mesh);
    const trail = { mesh, pts: [], maxPoints, active: false, color: mat.uniforms.uColor.value, fade: 0 };
    this.trails.push(trail);
    return trail;
  }

  pushTrail(trail, base, tip) {
    const prev = trail.pts[0];
    // Sous-échantillonnage : points intermédiaires quand la lame va vite
    if (prev) {
      const d = Math.hypot(tip.x - prev[3], tip.y - prev[4], tip.z - prev[5]);
      const n = Math.min(3, Math.floor(d / 0.25));
      for (let i = 1; i <= n; i++) {
        const k = i / (n + 1);
        trail.pts.unshift([
          prev[0] + (base.x - prev[0]) * k, prev[1] + (base.y - prev[1]) * k, prev[2] + (base.z - prev[2]) * k,
          prev[3] + (tip.x - prev[3]) * k, prev[4] + (tip.y - prev[4]) * k, prev[5] + (tip.z - prev[5]) * k,
        ]);
      }
    }
    trail.pts.unshift([base.x, base.y, base.z, tip.x, tip.y, tip.z]);
    while (trail.pts.length > trail.maxPoints) trail.pts.pop();
  }

  _updateTrail(tr, dt) {
    if (!tr.active) {
      tr.pts.splice(Math.max(0, tr.pts.length - 3), 3);
    }
    const pos = tr.mesh.geometry.attributes.position;
    const al = tr.mesh.geometry.attributes.aAlpha;
    const n = tr.pts.length;
    tr.mesh.visible = n > 1;
    if (n < 2) return;
    for (let i = 0; i < tr.maxPoints; i++) {
      const p = tr.pts[Math.min(i, n - 1)];
      pos.setXYZ(i * 2, p[0], p[1], p[2]);
      pos.setXYZ(i * 2 + 1, p[3], p[4], p[5]);
      const a = i < n ? Math.pow(1 - i / n, 1.4) : 0;
      al.setX(i * 2, a);
      al.setX(i * 2 + 1, a);
    }
    pos.needsUpdate = true;
    al.needsUpdate = true;
  }

  // ---------- Silhouettes rémanentes (esquives, ruées) ----------
  afterimage(src, color = 0x9a6aff, life = 0.38) {
    if (!src || !src.isSkinnedMesh || this.ghosts.length > 10) return;
    const sk = src.skeleton.clone();
    sk.boneMatrices = new Float32Array(src.skeleton.boneMatrices);
    sk.update = () => {};
    sk.computeBoneTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.65 } },
      vertexShader: `#include <common>
        #include <skinning_pars_vertex>
        varying vec3 vN; varying vec3 vV;
        void main(){
          #include <skinbase_vertex>
          #include <begin_vertex>
          #include <beginnormal_vertex>
          #include <skinnormal_vertex>
          #include <skinning_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
          vN = normalize(normalMatrix * objectNormal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
        void main(){ float fr = pow(1.0 - abs(dot(normalize(vN), vV)), 1.6); gl_FragColor = vec4(uColor * (0.35 + fr * 1.7), (0.06 + fr * 0.62) * uOpacity); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const g = new THREE.SkinnedMesh(src.geometry, mat);
    g.bindMode = src.bindMode;
    g.bind(sk, src.bindMatrix);
    g.matrixAutoUpdate = false;
    g.matrix.copy(src.matrixWorld);
    g.frustumCulled = false;
    g.renderOrder = 5;
    g.userData = { life, maxLife: life };
    this.scene.add(g);
    this.ghosts.push(g);
  }

  // ---------- Onde de choc (distorsion de l'image + anneau + éclair lumineux) ----------
  shockwave(pos, strength = 0.6, color = 0xffffff) {
    if (this.renderer && settings.get('distortion')) this.renderer.addWave(pos, strength);
    this.ring(pos, color, 1.5 + strength * 3, 0.35 + strength * 0.2, 0.3);
    this.flash(pos, color, 20 + strength * 30, 8 + strength * 6, 0.2);
  }

  // ---------- Impact d'arme : éclat lumineux + étincelles ----------
  impact(target, crit, big, element = 'physical') {
    const fxq = settings.get('fxQuality');
    const y = target.pos.y + (target.hover || 0) + Math.min(1.4, (target.height || 1.8) * 0.6);
    const pos = { x: target.pos.x, y, z: target.pos.z };
    const col = ELEMENT_COLORS[element] || 0xffffff;
    const sp = this.sprites.find((s) => !s.visible) || this.sprites[0];
    sp.visible = true;
    sp.position.set(pos.x, pos.y, pos.z);
    sp.material.color.setHex(crit ? 0xffe89a : element === 'physical' ? 0xfff2e0 : col);
    sp.userData = { life: 0.14, maxLife: 0.14, size: crit ? 2.6 : big ? 2.1 : 1.4 };
    if (fxq !== 'low') {
      const n = (fxq === 'high' ? 16 : 9) * (big ? 1.5 : 1);
      this.p.burst(pos, crit ? 0xffe066 : col === 0xffffff ? 0xffd8a8 : col, n, big ? 9 : 6, 0.12, 0.3, { drag: 0.9, gravity: 8, intensity: 2.6 });
    }
    if (big || crit) this.flash(pos, crit ? 0xffe089 : col, big ? 28 : 18, 7, 0.14);
  }

  // Charge d'une attaque lourde : anneau au sol et lueur
  chargePulse(actor, level) {
    const col = [0xffffff, 0xffd08a, 0xff9a3a, 0xc06aff][level] || 0xffffff;
    this.ring({ x: actor.pos.x, z: actor.pos.z, y: actor.pos.y }, col, 1.2 + level * 0.5, 0.35, 0.06);
    this.flash({ x: actor.pos.x, y: actor.pos.y + 0.5, z: actor.pos.z }, col, 12 + level * 10, 6, 0.3);
  }

  // Fissures au sol (coups puissants)
  cracks(pos, radius = 2.5) {
    const m = this.crackPool.find((c) => !c.visible) || this.crackPool[0];
    m.visible = true;
    const y = this.heightAt(pos.x, pos.z);
    m.position.set(pos.x, y + 0.06, pos.z);
    m.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    m.scale.setScalar(radius);
    m.material.opacity = 1;
    m.userData = { life: 4, maxLife: 4 };
  }

  // ---------- Bouffées de particules thématiques ----------
  hitSpark(pos, kind = 'flesh', crit = false) {
    if (kind === 'metal') this.p.burst(pos, 0xffd28a, 14, 7, 0.18, 0.35, { gravity: 12, drag: 0.94, intensity: 2 });
    else if (kind === 'spirit') this.p.burst(pos, 0x6affb0, 16, 4, 0.35, 0.6, { drag: 0.9, intensity: 1.6 });
    else if (kind === 'bone') {
      this.p.burst(pos, 0xe8e0c8, 10, 5, 0.2, 0.5, { gravity: 14, drag: 0.95, intensity: 0.8 });
      this.p.burst(pos, 0xffffff, 6, 3, 0.3, 0.2, { intensity: 1.5 });
    } else {
      this.pa.burst(pos, 0x5a0808, 14, 5, 0.25, 0.6, { gravity: 14, drag: 0.94, alpha: 0.9 });
      this.p.burst(pos, 0xffffff, 5, 3, 0.25, 0.15, { intensity: 1.2 });
    }
    if (crit) {
      this.p.burst(pos, 0xffe066, 20, 9, 0.3, 0.4, { drag: 0.9, intensity: 2.5 });
      this.ring(pos, 0xffe066, 2.2, 0.3, 0.4);
    }
  }

  elementBurst(pos, element, scale = 1) {
    const col = ELEMENT_COLORS[element] || 0xffffff;
    this.p.burst(pos, col, 26 * scale, 6 * scale, 0.45 * scale, 0.7, { drag: 0.92, intensity: 2 });
    if (element === 'fire') this.pa.burst(pos, 0x221510, 10 * scale, 2, 0.9 * scale, 1.2, { grow: 2, drag: 0.95, gravity: -2, alpha: 0.5 });
    if (element === 'frost') this.p.burst(pos, 0xffffff, 12 * scale, 4, 0.2, 0.6, { gravity: 6, intensity: 1.5 });
    this.flash(pos, col, 25 * scale, 9 * scale, 0.25);
  }

  souls(pos, n = 12) {
    for (let i = 0; i < n * this.p.budget; i++) {
      this.p.spawn(pos.x + rand(-0.5, 0.5), pos.y + rand(0, 1.5), pos.z + rand(-0.5, 0.5), rand(-0.3, 0.3), rand(1, 3), rand(-0.3, 0.3), rand(1, 1.8), rand(0.2, 0.45), 0x7affd0, { drag: 0.97, intensity: 1.8 });
    }
  }

  smoke(pos, n = 8, color = 0x2a2530, size = 1.2) {
    this.pa.burst(pos, color, n, 1.5, size, 1.4, { grow: 1.5, drag: 0.95, gravity: -0.8, alpha: 0.55, up: 0.3 });
  }

  dust(pos, n = 10) {
    this.pa.burst(pos, 0x3a342c, n, 3, 0.8, 0.9, { grow: 1.8, drag: 0.9, gravity: -0.3, alpha: 0.45, up: 0.2, spread: 2 });
  }

  update(dt) {
    this.time += dt;
    for (const l of this.lights) {
      if (l.userData.life > 0) {
        l.userData.life -= dt;
        l.intensity = Math.max(0, (l.userData.life / l.userData.maxLife) * l.userData.peak);
      } else l.intensity = 0;
    }
    for (const r of this.rings) {
      if (!r.visible) continue;
      r.userData.life -= dt;
      const t = 1 - r.userData.life / r.userData.maxLife;
      r.scale.setScalar(0.2 + t * r.userData.radius);
      r.material.opacity = (1 - t) * 0.9;
      if (r.userData.life <= 0) r.visible = false;
    }
    for (const m of this.teles) {
      const d = m.userData;
      const u = m.material.uniforms;
      u.uTime.value = this.time;
      if (d.active) {
        d.t += dt;
        if (d.follow) {
          d.x = d.follow.x;
          d.z = d.follow.z;
          if (d.follow.dir !== undefined) d.dir = d.follow.dir;
          this._shapeTele(m);
        }
        u.uProgress.value = Math.min(1, d.t / d.duration);
        if (d.t >= d.duration) {
          d.active = false;
          d.done = true;
          d.fade = 0.15;
        }
      } else if (d.fade > 0) {
        d.fade -= dt;
        u.uAlpha.value = Math.max(0, d.fade / 0.15);
        if (d.fade <= 0) m.visible = false;
      } else m.visible = false;
    }
    for (const b of this.beams) {
      if (!b.visible) continue;
      b.userData.life -= dt;
      b.material.opacity = Math.max(0, b.userData.life / b.userData.maxLife);
      if (b.userData.life <= 0) b.visible = false;
    }
    for (const tr of this.trails) this._updateTrail(tr, dt);
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.userData.life -= dt;
      const k = Math.max(0, g.userData.life / g.userData.maxLife);
      g.material.uniforms.uOpacity.value = k * 0.65;
      if (g.userData.life <= 0) {
        this.scene.remove(g);
        g.material.dispose();
        g.skeleton.dispose();
        this.ghosts.splice(i, 1);
      }
    }
    for (const sp of this.sprites) {
      if (!sp.visible) continue;
      sp.userData.life -= dt;
      const t = 1 - sp.userData.life / sp.userData.maxLife;
      sp.scale.setScalar(sp.userData.size * (0.4 + t * 0.9));
      sp.material.opacity = Math.max(0, 1 - t);
      if (sp.userData.life <= 0) sp.visible = false;
    }
    for (const c of this.crackPool) {
      if (!c.visible) continue;
      c.userData.life -= dt;
      c.material.opacity = Math.min(1, c.userData.life / 1.5) * (0.6 + 0.4 * Math.min(1, (c.userData.maxLife - c.userData.life) * 4));
      if (c.userData.life <= 0) c.visible = false;
    }
  }

  clear() {
    for (const m of this.teles) {
      m.visible = false;
      m.userData.active = false;
      m.userData.fade = 0;
    }
    for (const r of this.rings) r.visible = false;
    for (const b of this.beams) b.visible = false;
    for (const sp of this.sprites) sp.visible = false;
    for (const c of this.crackPool) c.visible = false;
    for (const g of this.ghosts) {
      this.scene.remove(g);
      g.material.dispose();
      g.skeleton.dispose();
    }
    this.ghosts.length = 0;
    for (const l of this.lights) {
      l.userData.life = 0;
      l.intensity = 0;
    }
  }
}

export const ELEMENT_COLORS = {
  physical: 0xffffff,
  fire: 0xff6a1a,
  frost: 0x7ad4ff,
  lightning: 0xb8d8ff,
  poison: 0x7aff3a,
  shadow: 0xa04dff,
  holy: 0xffe89a,
  blood: 0xff2244,
  arcane: 0x4dd8ff,
};
