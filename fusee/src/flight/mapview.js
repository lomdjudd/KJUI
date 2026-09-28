// Carte orbitale : astres, orbites, trajectoire prévue (coniques raccordées),
// nœuds de manœuvre, cible et planificateur de transfert.

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { makeSphere } from '../render/planets.js';
import { h, icon, ICONS, toast } from '../ui/dom.js';
import { fmtDist, fmtTime, fmtSpeed, fmtInt, fmt1 } from '../core/math.js';
import { closestApproach, predict } from './predict.js';
import { ManeuverNode } from './guidance.js';
import { Orbit } from '../core/orbit.js';
import { LOGDEPTH_V, LOGDEPTH_F } from '../render/shaders.js';

const GLOW_FS = /* glsl */ `
${LOGDEPTH_F}
uniform vec3 color;
varying vec3 vN;
varying vec3 vV;
void main(){
  #include <logdepthbuf_fragment>
  float f = pow(1.0 - abs(dot(vN, vV)), 3.0);
  gl_FragColor = vec4(color * f * 1.6, f);
}`;
const GLOW_VS = /* glsl */ `
${LOGDEPTH_V}
varying vec3 vN;
varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;

const PATCH_COLORS = ['#5cd6ff', '#ffb23e', '#d27bff', '#6cff9a', '#ff6a8a'];

function lineMat(color, width, opacity = 1, dashed = false) {
  const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, dashed, dashSize: 3, gapSize: 2, worldUnits: false });
  m.depthWrite = false;
  return m;
}

export class MapView {
  constructor(flight) {
    this.f = flight;
    this.app = flight.app;
    this.sys = flight.sys;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#03050b');
    this.camera = new THREE.PerspectiveCamera(50, 1, 10, 1e15);
    this.active = false;
    this.focus = null; // corps
    this.dist = 1e7;
    this.yaw = 0;
    this.pitch = -1.1;
    this.bodies = new Map();
    this.lineMats = [];
    this.sphere = makeSphere(64, 32);
    this.light = new THREE.DirectionalLight('#ffffff', 2.5);
    this.scene.add(this.light);
    this.scene.add(this.light.target);
    this.scene.add(new THREE.AmbientLight('#8090b0', 0.25));
    this.build();
    this.patchLines = [];
    this.nodeLines = [];
    this.lastPredKey = null;
    this.labels = null;
    this.bindInput();
  }

  build() {
    const texMgr = this.f.app.tex;
    for (const b of this.sys.bodies) {
      const o = { body: b, group: new THREE.Group() };
      const tex = texMgr.get(b.id);
      const mat = b.type === 'star'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 6, 3) })
        : new THREE.MeshStandardMaterial({ map: tex ? tex.color : null, color: tex ? '#ffffff' : b.color, roughness: 1, metalness: 0 });
      o.mesh = new THREE.Mesh(this.sphere, mat);
      o.mat = mat;
      o.group.add(o.mesh);
      if (b.atmosphere || b.type === 'star') {
        const col = new THREE.Color(b.type === 'star' ? '#ffcf7a' : b.atmosphere.sky);
        o.glow = new THREE.Mesh(this.sphere, new THREE.ShaderMaterial({ uniforms: { color: { value: col } }, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        o.group.add(o.glow);
      }
      if (b.orbit) {
        const pts = [];
        const o2 = b.orbit;
        const N = 360;
        for (let i = 0; i <= N; i++) {
          const nu = -Math.PI + (i / N) * Math.PI * 2;
          const [x, y] = o2.positionAtTrue(nu);
          pts.push(x, y, 0);
        }
        const g = new LineGeometry();
        g.setPositions(pts);
        const m = lineMat(b.color, 1.3, 0.5);
        this.lineMats.push(m);
        o.orbitLine = new Line2(g, m);
        o.orbitLine.computeLineDistances();
        o.orbitLine.frustumCulled = false;
        this.scene.add(o.orbitLine);
      }
      this.scene.add(o.group);
      this.bodies.set(b.id, o);
    }
    this.app.tex.onReady((id) => {
      const o = this.bodies.get(id);
      const t = this.app.tex.get(id);
      if (o && t && o.mat.isMeshStandardMaterial) { o.mat.map = t.color; o.mat.color.set('#ffffff'); o.mat.needsUpdate = true; }
    });
    // ceinture d'astéroïdes
    const N = 3000;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = (2.2 + Math.random() * 1.1) * 13.6e9;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r; pos[i * 3 + 2] = (Math.random() - 0.5) * 3e8;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.belt = new THREE.Points(bg, new THREE.PointsMaterial({ color: '#8a8070', size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.55 }));
    this.scene.add(this.belt);
    // étoiles lointaines (simples)
    const sp = new Float32Array(4000 * 3);
    for (let i = 0; i < 4000; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      sp[i * 3] = s * Math.cos(t) * 1e14; sp[i * 3 + 1] = s * Math.sin(t) * 1e14; sp[i * 3 + 2] = u * 1e14;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#c8d4ee', size: 1.2, sizeAttenuation: false }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
    // vaisseau
    this.vesselDot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    this.scene.add(this.vesselDot);
    // autres vaisseaux
    this.others = new THREE.Group();
    this.scene.add(this.others);
  }

  // ------------------------------------------------------------------------
  open() {
    this.active = true;
    document.getElementById('flight')?.classList.add('map-on');
    const v = this.f.sim.active;
    this.focus = this.focus || v.body;
    if (this.focusVessel === undefined) this.focusVessel = true;
    this.fitFocus();
    this.buildUI();
    this.lastPredKey = null;
  }

  close() {
    this.active = false;
    document.getElementById('flight')?.classList.remove('map-on');
    if (this.ui) this.ui.remove();
    this.ui = null;
  }

  fitFocus() {
    const v = this.f.sim.active;
    const b = this.focus;
    let d = b.radius * 6;
    const pred = this.f.sim.prediction;
    if (pred && pred[0] && pred[0].body === b) {
      const o = pred[0].orbit;
      d = Math.max(d, (isFinite(o.apoapsis) ? o.apoapsis : o.periapsis * 4) * 3.2);
    }
    if (b.type === 'star') d = 13.6e9 * 4;
    if (b.children.length && !this.focusVessel) d = Math.max(d, b.children[b.children.length - 1].orbit.apoapsis * 2.6);
    this.dist = Math.min(d, 2e13);
    void v;
  }

  setFocus(b, vessel = false) {
    this.focus = b;
    this.focusVessel = vessel;
    this.fitFocus();
    this.app.audio.click();
  }

  // ------------------------------------------------------------------------
  buildUI() {
    if (this.ui) this.ui.remove();
    const f = this.f;
    this.ui = h('div', { class: 'screen active', id: 'map-ui' });
    this.labelsEl = h('div', { class: 'map-labels' });
    this.ui.appendChild(this.labelsEl);
    this.infoEl = h('div', { class: 'map-info panel' });
    this.ui.appendChild(this.infoEl);
    this.nodeEl = h('div', { class: 'node-panel panel', hidden: true });
    this.ui.appendChild(this.nodeEl);
    const top = h('div', { class: 'hud-tl' },
      h('button', { class: 'btn', onclick: () => f.toggleMap(), html: icon(ICONS.back) + ' Vol' }),
      h('button', { class: 'btn', title: 'Centrer sur le vaisseau', onclick: () => this.setFocus(f.sim.active.body, true) }, 'Vaisseau'),
      h('button', { class: 'btn', title: 'Vue du système solaire', onclick: () => this.setFocus(this.sys.sun) }, 'Système'),
      h('button', { class: 'btn', title: 'Créer une manœuvre à l\'apoapside ou maintenant', onclick: () => this.addNodeQuick() }, '+ Manœuvre'),
    );
    this.ui.appendChild(top);
    document.getElementById('ui').insertBefore(this.ui, document.getElementById('flight')?.nextSibling || null);
    this.labels = new Map();
    for (const [id, o] of this.bodies) {
      const b = o.body;
      const el = h('div', { class: 'mlabel' + (b.type === 'moon' || b.type === 'dwarf' ? ' small' : ''), title: 'Clic : centrer · clic droit ou appui long : cible' }, b.name);
      el.addEventListener('click', (e) => { e.stopPropagation(); this.setFocus(b); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.f.setTarget(b); });
      let pressT = null;
      el.addEventListener('pointerdown', () => { pressT = setTimeout(() => { this.f.setTarget(b); pressT = null; }, 600); });
      el.addEventListener('pointerup', () => { if (pressT) clearTimeout(pressT); });
      this.labelsEl.appendChild(el);
      this.labels.set(id, el);
    }
    this.markEls = [];
    this.vesselLabel = h('div', { class: 'mlabel', style: { color: '#fff' } }, f.sim.active.name);
    this.labelsEl.appendChild(this.vesselLabel);
    this.updateInfo(true);
  }

  // ------------------------------------------------------------------------
  bindInput() {
    const cv = this.app.R.canvas;
    this.ptrs = new Map();
    cv.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() });
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) this.dist *= this.pinch / Math.max(10, d);
        this.pinch = d;
        return;
      }
      if (this.f.mode2d) { this.yaw += dx * 0.005; }
      else {
        this.yaw += dx * 0.005;
        this.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(-0.05, this.pitch + dy * 0.005));
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.active) return;
      const p = this.ptrs.get(e.pointerId);
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) this.pinch = null;
      if (p && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6 && e.target === cv) this.clickAt(e.clientX, e.clientY);
    });
    cv.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.dist *= Math.exp(e.deltaY * 0.0015);
      this.dist = Math.max(this.focus.radius * 1.6, Math.min(3e13, this.dist));
    }, { passive: false });
  }

  // Clic sur la trajectoire : création d'un nœud
  clickAt(x, y) {
    const pred = this.f.sim.prediction;
    if (!pred) return;
    let best = null, bd = 26;
    const now = this.f.sim.ut;
    for (const p of pred) {
      const pts = p.samples || [];
      for (const s of pts) {
        const sc = this.project(s.wx, s.wy);
        if (!sc) continue;
        const d = Math.hypot(sc[0] - x, sc[1] - y);
        if (d < bd) { bd = d; best = s; }
      }
    }
    if (best && best.t > now + 5) {
      this.f.createNode(best.t);
      toast('Manœuvre ajoutée', 'Réglez le Δv avec le panneau en bas de l\'écran.', '', 2500);
    }
  }

  addNodeQuick() {
    const pred = this.f.sim.prediction;
    const now = this.f.sim.ut;
    let t = now + 60;
    if (pred && pred[0] && isFinite(pred[0].orbit.period)) t = now + pred[0].orbit.timeToApoapsis(now);
    this.f.createNode(Math.max(now + 30, t));
  }

  project(wx, wy, wz = 0) {
    const v = new THREE.Vector3(wx - this.origin[0], wy - this.origin[1], wz).project(this.camera);
    if (v.z > 1) return null;
    const R = this.app.R;
    return [(v.x * 0.5 + 0.5) * R.width, (-v.y * 0.5 + 0.5) * R.height];
  }

  // ------------------------------------------------------------------------
  // Tracés de la trajectoire
  rebuildPatches(pred, lines, dashed, colorOffset = 0, tMin = -Infinity) {
    for (const l of lines) { this.scene.remove(l.line); l.line.geometry.dispose(); }
    lines.length = 0;
    if (!pred) return;
    const R = this.app.R;
    pred.forEach((p, i) => {
      const o = p.orbit;
      const t0 = Math.max(p.t0, tMin);
      let t1 = p.t1;
      if (!isFinite(t1)) t1 = isFinite(o.period) ? t0 + o.period : t0 + 3e8;
      if (isFinite(o.period) && t1 - t0 > o.period) t1 = t0 + o.period;
      const pts = [];
      const samples = [];
      const N = 360;
      let nu0 = o.trueAnomalyAt(t0);
      let nu1 = o.trueAnomalyAt(t1);
      if (o.e < 1) { while (nu1 <= nu0 + 1e-6) nu1 += Math.PI * 2; if (isFinite(o.period) && t1 - t0 >= o.period - 1) nu1 = nu0 + Math.PI * 2; }
      else {
        // hyperbole : on borne à la sphère d'influence
        const lim = o.nuMax - 0.02;
        nu1 = Math.min(nu1, lim);
        nu0 = Math.max(nu0, -lim);
      }
      for (let k = 0; k <= N; k++) {
        const nu = nu0 + ((nu1 - nu0) * k) / N;
        const [x, y] = o.positionAtTrue(nu);
        pts.push(x, y, 0);
        if (k % 3 === 0) samples.push({ x, y, nu });
      }
      const g = new LineGeometry();
      g.setPositions(pts);
      const m = lineMat(PATCH_COLORS[(i + colorOffset) % PATCH_COLORS.length], dashed ? 2 : 2.6, dashed ? 0.85 : 1, dashed);
      m.resolution.set(R.width, R.height);
      const line = new Line2(g, m);
      line.computeLineDistances();
      line.frustumCulled = false;
      this.scene.add(line);
      lines.push({ line, patch: p });
      // échantillons pour le clic (temps)
      p.samples = samples.map((s) => ({ lx: s.x, ly: s.y, t: o.timeAtTrue(s.nu, t0 - 1) }));
    });
  }

  // ------------------------------------------------------------------------
  update(dt) {
    if (!this.active) return;
    const f = this.f;
    const sim = f.sim;
    const ut = sim.ut;
    const v = sim.active;
    // origine : corps focalisé (ou vaisseau)
    const fs = this.focus.state(ut);
    let ox = fs.x, oy = fs.y;
    this.origin = [ox, oy];
    const R = this.app.R;
    this.camera.aspect = R.width / R.height;
    const d = this.dist;
    const pitch = f.mode2d ? -Math.PI / 2 + 0.0005 : this.pitch;
    const cp = Math.cos(pitch), spc = Math.sin(pitch);
    // caméra du côté -Z du plan (comme la vue 2D), inclinable en 3D
    this.camera.position.set(cp * Math.sin(this.yaw) * d, -cp * Math.cos(this.yaw) * d, spc * d);
    if (pitch < -1.5) this.camera.up.set(Math.sin(this.yaw), Math.cos(this.yaw), 0);
    else this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = Math.max(1, d * 0.001);
    this.camera.far = 1e15;
    this.camera.updateProjectionMatrix();
    const pxPerM = R.height / (2 * d * Math.tan((this.camera.fov * Math.PI) / 360));
    // astres
    const sun = this.sys.sun.state(ut);
    const hiddenOk = (b) => !b.hidden || this.app.game.hasTech(b.hidden);
    for (const [id, o] of this.bodies) {
      const b = o.body;
      const s = b.state(ut);
      const x = s.x - ox, y = s.y - oy;
      o.group.position.set(x, y, 0);
      const dCam = Math.hypot(x - this.camera.position.x, y - this.camera.position.y, this.camera.position.z);
      const minR = (4 / R.height) * dCam * Math.tan((this.camera.fov * Math.PI) / 360) * 2;
      const rr = Math.max(b.radius, minR);
      o.mesh.scale.setScalar(rr);
      if (o.glow) o.glow.scale.setScalar(rr * (b.type === 'star' ? 2.5 : 1.08));
      o.mesh.rotation.z = b.rotationAt(ut);
      const vis = hiddenOk(b);
      o.group.visible = vis;
      if (o.orbitLine) {
        const ps = b.parentBody.state(ut);
        o.orbitLine.position.set(ps.x - ox, ps.y - oy, 0);
        o.orbitLine.material.resolution.set(R.width, R.height);
        o.orbitLine.visible = vis;
        // les lunes ne sont montrées qu'à proximité
        const orbPx = b.orbit.apoapsis * pxPerM;
        o.orbitLine.visible = vis && orbPx > 25;
      }
      const lab = this.labels && this.labels.get(id);
      if (lab) {
        const sc = this.project(s.x, s.y);
        const orbPx = b.orbit ? b.orbit.apoapsis * pxPerM : 1e9;
        const show = vis && sc && (orbPx > 30 || b === this.focus || b.type === 'planet' || b.type === 'star' || b.type === 'gas');
        lab.style.display = show ? 'block' : 'none';
        if (show) { lab.style.left = sc[0] + 'px'; lab.style.top = sc[1] + 'px'; }
        lab.style.color = f.target === b ? '#ff5ce1' : '';
      }
    }
    this.light.position.set(sun.x - ox, sun.y - oy, 0);
    this.light.target.position.set(0, 0, 0);
    this.belt.position.set(sun.x - ox, sun.y - oy, 0);
    this.belt.visible = this.dist > 3e9;
    this.stars.position.copy(this.camera.position);
    // vaisseau
    const vb = v.body.state(ut);
    const vx = vb.x + v.x - ox, vy = vb.y + v.y - oy;
    this.vesselDot.position.set(vx, vy, 0);
    const dv = Math.hypot(vx - this.camera.position.x, vy - this.camera.position.y, this.camera.position.z);
    this.vesselDot.scale.setScalar((5 / R.height) * dv * Math.tan((this.camera.fov * Math.PI) / 360) * 2);
    const sc = this.project(vb.x + v.x, vb.y + v.y);
    if (this.vesselLabel) {
      this.vesselLabel.style.display = sc ? 'block' : 'none';
      if (sc) { this.vesselLabel.style.left = sc[0] + 'px'; this.vesselLabel.style.top = sc[1] + 'px'; }
    }
    // trajectoires
    const pred = sim.prediction;
    const key = pred ? pred.map((p) => p.body.id + p.orbit.e.toFixed(6) + p.orbit.p.toFixed(0) + p.end).join('|') : '';
    if (key !== this.lastPredKey) {
      this.lastPredKey = key;
      this.rebuildPatches(pred, this.patchLines, false, 0, ut);
    }
    for (const l of this.patchLines) {
      const bs = l.patch.body.state(ut);
      l.line.position.set(bs.x - ox, bs.y - oy, 0);
      l.line.material.resolution.set(R.width, R.height);
      // positions monde des échantillons (clic)
      for (const s of l.patch.samples || []) { s.wx = bs.x + s.lx; s.wy = bs.y + s.ly; }
    }
    // manœuvre
    const node = f.node;
    const nkey = node && node.after ? node.after.map((p) => p.body.id + p.orbit.e.toFixed(6) + p.orbit.p.toFixed(0)).join('|') + node.t : '';
    if (nkey !== this.lastNodeKey) {
      this.lastNodeKey = nkey;
      this.rebuildPatches(node ? node.after : null, this.nodeLines, true, 1, node ? node.t : 0);
    }
    for (const l of this.nodeLines) {
      const bs = l.patch.body.state(ut);
      l.line.position.set(bs.x - ox, bs.y - oy, 0);
      l.line.material.resolution.set(R.width, R.height);
    }
    for (const m of this.lineMats) m.resolution.set(R.width, R.height);
    this.updateMarkers(pred, ut);
    this.infoT = (this.infoT || 0) + dt;
    if (this.infoT > 0.25) { this.infoT = 0; this.updateInfo(); }
  }

  mark(i, x, y, text, color) {
    let el = this.markEls[i];
    if (!el) {
      el = h('div', { class: 'mmark' });
      this.labelsEl.appendChild(el);
      this.markEls[i] = el;
    }
    const sc = this.project(x, y);
    if (!sc) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = sc[0] + 'px';
    el.style.top = sc[1] + 'px';
    el.style.color = color;
    el.textContent = text;
  }

  updateMarkers(pred, ut) {
    let i = 0;
    const put = (x, y, t, c) => this.mark(i++, x, y, t, c);
    if (pred) {
      pred.forEach((p, k) => {
        const o = p.orbit;
        const bs = p.body.state(ut);
        const col = PATCH_COLORS[k % PATCH_COLORS.length];
        if (o.e < 1 && (p.end === 'none' || p.end === 'impact' || o.timeToApoapsis(p.t0) + p.t0 < p.t1)) {
          const [ax, ay] = o.positionAtTrue(Math.PI);
          if (p.end === 'none' || p.t0 + o.timeToApoapsis(p.t0) < p.t1) put(bs.x + ax, bs.y + ay, 'Ap ' + fmtDist(o.apoapsis - p.body.radius), col);
        }
        const tPe = o.timeAtTrue(0, p.t0);
        if (tPe < p.t1 || !isFinite(p.t1)) {
          const [px, py] = o.positionAtTrue(0);
          put(bs.x + px, bs.y + py, 'Pe ' + fmtDist(o.periapsis - p.body.radius), col);
        }
        if (isFinite(p.t1) && p.end !== 'none') {
          const st = o.stateAt(p.t1);
          const label = p.end === 'impact' ? 'Impact' : p.end === 'escape' ? `Sortie de ${p.body.name}` : `Rencontre ${p.next.name}`;
          put(bs.x + st.x, bs.y + st.y, label, p.end === 'impact' ? '#ff5d5d' : '#ffffff');
        }
        if (p.atmoT) {
          const st = o.stateAt(p.atmoT);
          put(bs.x + st.x, bs.y + st.y, 'Atmosphère', '#7fc6ff');
        }
      });
    }
    const f = this.f;
    if (f.node && f.node.state) {
      const bs = f.node.body.state(ut);
      put(bs.x + f.node.state.x, bs.y + f.node.state.y, `Manœuvre ${fmtInt(f.node.dvMag)} m/s`, '#4d8dff');
    }
    if (f.target && pred) {
      const ca = closestApproach(f.node && f.node.after ? f.node.after : pred, f.target);
      this.closest = ca;
      if (ca && !ca.inside) {
        const bs = ca.patch.body.state(ut);
        const st = ca.patch.orbit.stateAt(ca.t);
        put(bs.x + st.x, bs.y + st.y, `Approche ${fmtDist(ca.d)}`, '#ff5ce1');
        const ts = f.target.state(ca.t);
        const ps = f.target.parentBody.state(ca.t);
        const cur = f.target.parentBody.state(ut);
        put(cur.x + (ts.x - ps.x), cur.y + (ts.y - ps.y), `${f.target.name} (à ce moment)`, '#ff5ce1');
      }
    }
    for (let k = i; k < this.markEls.length; k++) this.markEls[k].style.display = 'none';
  }

  // ------------------------------------------------------------------------
  updateInfo(force = false) {
    const f = this.f;
    const v = f.sim.active;
    const el = this.infoEl;
    if (!el) return;
    const pred = f.sim.prediction;
    const p0 = pred && pred[0];
    const rows = [];
    rows.push(h('h4', {}, this.focus.name));
    if (p0) {
      const o = p0.orbit;
      const b = p0.body;
      rows.push(h('div', { class: 'kv' },
        h('span', {}, 'Autour de ', h('b', {}, b.name)),
        h('span', {}, 'Ap ', h('b', {}, isFinite(o.apoapsis) ? fmtDist(o.apoapsis - b.radius) : '∞')),
        h('span', {}, 'Pe ', h('b', {}, fmtDist(o.periapsis - b.radius))),
        h('span', {}, 'Excentricité ', h('b', {}, o.e.toFixed(3))),
        h('span', {}, 'Période ', h('b', {}, isFinite(o.period) ? fmtTime(o.period) : '—'))));
      const ev = pred.find((p) => p.end === 'encounter' || p.end === 'escape' || p.end === 'impact');
      if (ev) rows.push(h('div', { class: 'kv' }, h('span', {}, ev.end === 'impact' ? 'Impact dans ' : ev.end === 'escape' ? 'Sortie dans ' : `Rencontre ${ev.next.name} dans `, h('b', {}, fmtTime(ev.t1 - f.sim.ut)))));
    }
    // cible
    const tg = f.target;
    const tsel = h('select', { 'aria-label': 'Cible' }, h('option', { value: '' }, 'Aucune cible'),
      ...this.sys.bodies.filter((b) => b.type !== 'star' && (!b.hidden || this.app.game.hasTech(b.hidden))).map((b) => h('option', { value: b.id, selected: tg === b }, b.name)));
    tsel.addEventListener('change', () => f.setTarget(tsel.value ? this.sys.get(tsel.value) : null));
    rows.push(h('div', { class: 'env-row' }, h('span', { class: 'label' }, 'Cible'), tsel));
    if (tg) {
      const ca = this.closest;
      rows.push(h('div', { class: 'kv' },
        h('span', {}, 'Approche min. ', h('b', {}, ca ? (ca.inside ? 'rencontre !' : fmtDist(ca.d)) : '—')),
        h('span', {}, 'Sphère d\'influence ', h('b', {}, fmtDist(tg.soi)))));
      rows.push(h('button', { class: 'btn', onclick: () => this.planTransfer(tg) }, 'Planifier un transfert'));
    }
    rows.push(h('div', { class: 'label', style: { marginTop: '4px' } }, 'Astuce'));
    rows.push(h('div', { style: { fontSize: '12px', color: 'var(--muted)', lineHeight: '1.4' } }, 'Cliquez sur votre trajectoire pour placer une manœuvre. Glisser : tourner · molette : zoom · clic droit sur un astre : cible.'));
    el.innerHTML = '';
    rows.forEach((r) => el.appendChild(r));
    this.updateNodePanel(force);
  }

  updateNodePanel(force) {
    const f = this.f;
    const n = f.node;
    const el = this.nodeEl;
    if (!el) return;
    el.hidden = !n;
    if (!n) return;
    const v = f.sim.active;
    const bt = n.burnTime(v);
    const key = n.t.toFixed(0) + n.pro.toFixed(1) + n.rad.toFixed(1);
    if (!force && key === this.nodeKey && this.nodeInfo) {
      this.nodeInfo.textContent = `Dans ${fmtTime(n.t - f.sim.ut)} · Δv ${fmt1(n.dvMag)} m/s · poussée ${isFinite(bt) ? fmtTime(bt) : '—'}`;
      return;
    }
    this.nodeKey = key;
    el.innerHTML = '';
    this.nodeInfo = h('div', { class: 'mono', style: { fontSize: '12.5px' } }, `Dans ${fmtTime(n.t - f.sim.ut)} · Δv ${fmt1(n.dvMag)} m/s · poussée ${isFinite(bt) ? fmtTime(bt) : '—'}`);
    el.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } }, h('span', { class: 'label' }, 'Nœud de manœuvre'), this.nodeInfo));
    const grid = h('div', { class: 'node-grid' });
    const nud = (label, key2, color) => {
      const set = (val) => { n[key2] = val; f.updateNode(); };
      const row = h('div', { class: 'nudge' });
      for (const s of [-100, -10, -1, -0.1]) row.appendChild(h('button', { onclick: () => set(n[key2] + s) }, String(s)));
      for (const s of [0.1, 1, 10, 100]) row.appendChild(h('button', { onclick: () => set(n[key2] + s) }, '+' + s));
      grid.appendChild(h('label', { style: { color } }, label));
      grid.appendChild(row);
      grid.appendChild(h('b', { class: 'mono' }, fmt1(n[key2]) + ' m/s'));
    };
    nud('Prograde', 'pro', '#b6ff4d');
    nud('Radial', 'rad', '#5cd6ff');
    const trow = h('div', { class: 'nudge' });
    const o = f.sim.prediction && f.sim.prediction[0] && f.sim.prediction[0].orbit;
    const shifts = [[-600, '-10 min'], [-60, '-1 min'], [-5, '-5 s'], [5, '+5 s'], [60, '+1 min'], [600, '+10 min']];
    if (o && isFinite(o.period)) shifts.push([o.period, '+1 orbite']);
    for (const [s, l] of shifts) trow.appendChild(h('button', { onclick: () => { n.t = Math.max(f.sim.ut + 5, n.t + s); f.updateNode(); } }, l));
    grid.appendChild(h('label', {}, 'Instant'));
    grid.appendChild(trow);
    grid.appendChild(h('span'));
    el.appendChild(grid);
    el.appendChild(h('div', { class: 'row', style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
      h('button', { class: 'btn', onclick: () => { n.pro = 0; n.rad = 0; f.updateNode(); } }, 'Remettre à zéro'),
      h('button', { class: 'btn', onclick: () => { const o0 = f.sim.prediction && f.sim.prediction[0]; if (o0 && isFinite(o0.orbit.period)) { n.t = f.sim.ut + o0.orbit.timeToApoapsis(f.sim.ut); f.updateNode(); } } }, 'À l\'apoapside'),
      h('button', { class: 'btn', onclick: () => { const o0 = f.sim.prediction && f.sim.prediction[0]; if (o0) { n.t = f.sim.ut + Math.max(10, o0.orbit.timeToPeriapsis(f.sim.ut)); f.updateNode(); } } }, 'Au périapside'),
      h('button', { class: 'btn', onclick: () => this.circularizeNode() }, 'Circulariser'),
      h('button', { class: 'btn primary', onclick: () => f.startAutopilot('node', { allowWarp: true }) }, 'Exécuter (auto)'),
      h('button', { class: 'btn danger', onclick: () => f.removeNode() }, 'Supprimer')));
  }

  circularizeNode() {
    const f = this.f;
    const n = f.node;
    if (!n || !n.state) return;
    const b = n.body;
    const st = n.state;
    const r = Math.hypot(st.x, st.y);
    const dir = st.x * st.vy - st.y * st.vx >= 0 ? 1 : -1;
    const tx = (-st.y / r) * dir, ty = (st.x / r) * dir;
    const vc = Math.sqrt(b.mu / r);
    const dvx = tx * vc - st.vx, dvy = ty * vc - st.vy;
    n.pro = dvx * n.dir.px + dvy * n.dir.py;
    n.rad = dvx * n.dir.rx + dvy * n.dir.ry;
    f.updateNode();
  }

  // ------------------------------------------------------------------------
  // Planificateur : recherche d'une manœuvre qui rencontre la cible
  planTransfer(target) {
    const f = this.f;
    const v = f.sim.active;
    const sim = f.sim;
    const ut = sim.ut;
    const b = v.body;
    const orb = v.computeOrbit(ut);
    if (!isFinite(orb.period)) { toast('Transfert impossible', 'Mettez-vous d\'abord en orbite fermée.', 'warn'); return; }
    let parentOfTarget = target.parentBody;
    // cas 1 : la cible tourne autour du même corps (ex. Lune depuis l'orbite terrestre)
    // cas 2 : la cible est une planète sœur (ex. Mars depuis l'orbite terrestre)
    const sameParent = parentOfTarget === b;
    const sibling = b.parentBody && parentOfTarget === b.parentBody;
    if (!sameParent && !sibling) { toast('Transfert non géré', 'Choisissez une lune du corps actuel ou une planète voisine.', 'warn'); return; }
    const hiddenOk = (c) => !c.hidden || this.app.game.hasTech(c.hidden);
    const evalNode = (t, pro, rad = 0) => {
      const st = orb.stateAt(t);
      const sp = Math.hypot(st.vx, st.vy);
      const px = st.vx / sp, py = st.vy / sp;
      let rx = st.x, ry = st.y;
      const d = rx * px + ry * py;
      rx -= d * px; ry -= d * py;
      const rl = Math.hypot(rx, ry);
      rx /= rl; ry /= rl;
      const pr = predict(this.sys, b, st.x, st.y, st.vx + px * pro + rx * rad, st.vy + py * pro + ry * rad, t, { hiddenOk, maxPatches: 3, periods: 1.2 });
      if (pr.some((p) => p.body === target)) return 0;
      const ca = closestApproach(pr, target);
      return ca ? ca.d : 1e15;
    };
    // estimation de Hohmann
    let r1 = orb.semi || (orb.periapsis + orb.apoapsis) / 2;
    let dvEst, window = [ut + 30, ut + orb.period * 1.2];
    if (sameParent) {
      const r2 = target.orbit.a;
      const at = (r1 + r2) / 2;
      dvEst = Math.sqrt(b.mu * (2 / r1 - 1 / at)) - Math.sqrt(b.mu / r1);
      // fenêtre : angle de phase
      const tT = Math.PI * Math.sqrt((at * at * at) / b.mu);
      const nT = Math.sqrt(b.mu / (r2 * r2 * r2));
      const phase = Math.PI - nT * tT; // angle d'avance de la cible
      const nV = Math.sqrt(b.mu / (r1 * r1 * r1));
      const ts = target.localState(ut);
      const cur = wrapA(Math.atan2(ts.y, ts.x) - Math.atan2(v.y, v.x));
      let dt = (cur - phase) / (nV - nT);
      const syn = (Math.PI * 2) / Math.abs(nV - nT);
      while (dt < 60) dt += syn;
      window = [ut + dt - orb.period * 0.5, ut + dt + orb.period * 0.5];
    } else {
      // interplanétaire : fenêtre de phase entre planètes
      const P = b.parentBody;
      const R1 = b.orbit.a, R2 = target.orbit.a;
      const at = (R1 + R2) / 2;
      const vInf = Math.abs(Math.sqrt(P.mu * (2 / R1 - 1 / at)) - Math.sqrt(P.mu / R1));
      dvEst = Math.sqrt(vInf * vInf + (2 * b.mu) / r1) - Math.sqrt(b.mu / r1);
      const tT = Math.PI * Math.sqrt((at * at * at) / P.mu);
      const nT = Math.sqrt(P.mu / (R2 * R2 * R2)), n1 = Math.sqrt(P.mu / (R1 * R1 * R1));
      const phase = Math.PI - nT * tT;
      const s1 = b.localState(ut), s2 = target.localState(ut);
      const cur = wrapA(Math.atan2(s2.y, s2.x) - Math.atan2(s1.y, s1.x));
      let dt = (cur - phase) / (n1 - nT);
      const syn = (Math.PI * 2) / Math.abs(n1 - nT);
      while (dt < 120) dt += syn;
      while (dt > syn) dt -= syn;
      if (dt < 120) dt += syn;
      window = [ut + dt - orb.period, ut + dt + orb.period];
      toast('Fenêtre de lancement', `Prochaine fenêtre vers ${target.name} dans ${fmtTime(dt)}.`, '', 5000);
    }
    // recherche grossière puis affinée
    let best = { t: window[0], pro: dvEst, d: Infinity };
    const N = 36;
    for (let i = 0; i <= N; i++) {
      const t = window[0] + ((window[1] - window[0]) * i) / N;
      if (t < ut + 20) continue;
      for (const k of [0.97, 1, 1.03]) {
        const d = evalNode(t, dvEst * k);
        if (d < best.d) best = { t, pro: dvEst * k, d };
      }
    }
    let stepT = (window[1] - window[0]) / N, stepV = dvEst * 0.02;
    for (let it = 0; it < 40 && best.d > 0; it++) {
      let improved = false;
      for (const [dt2, dv2] of [[stepT, 0], [-stepT, 0], [0, stepV], [0, -stepV]]) {
        const t = best.t + dt2, pro = best.pro + dv2;
        if (t < ut + 20) continue;
        const d = evalNode(t, pro);
        if (d < best.d) { best = { t, pro, d }; improved = true; }
      }
      if (!improved) { stepT *= 0.5; stepV *= 0.5; }
    }
    f.createNode(best.t, best.pro, 0);
    toast(best.d === 0 ? 'Transfert trouvé' : 'Transfert approché', best.d === 0 ? `Rencontre avec ${target.name} : ${fmtInt(best.pro)} m/s.` : `Approche à ${fmtDist(best.d)} : ajustez la manœuvre.`, best.d === 0 ? 'good' : 'warn', 5000);
  }

  render() {
    this.app.R.setBloom(0.7, 0.4, 0.85);
    this.app.R.render(this.scene, this.camera);
  }
}

function wrapA(a) {
  a %= Math.PI * 2;
  return a < 0 ? a + Math.PI * 2 : a;
}

export { Orbit };
