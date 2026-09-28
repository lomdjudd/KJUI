// Écran de vol : simulation, rendu 2D/3D, caméras, éclairage, effets,
// commandes et événements.

import * as THREE from 'three';
import { Sim, WARPS, PHYS_WARP } from './sim.js';
import { Vessel } from './vessel.js';
import { VesselView } from './vesselview.js';
import { FlightHUD } from './hud.js';
import { MapView } from './mapview.js';
import { Autopilot, ManeuverNode, steerTo, sasDirection, rotFor } from './guidance.js';
import { Planets3D } from '../render/planets.js';
import { Planets2D } from '../render/planet2d.js';
import { Sky } from '../render/sky.js';
import { LocalTerrain } from '../render/terrain3d.js';
import { LaunchSite } from '../render/launchsite.js';
import { Effects, plumeStyle } from '../render/effects.js';
import { EARTH_SITES } from '../core/terrain.js';
import { h, toast, modal } from '../ui/dom.js';
import { clamp, damp, wrapPi, fmtMoney, fmtInt, fmtDist } from '../core/math.js';
import { Settings } from '../progress/game.js';

const ENV_VS = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ENV_FS = /* glsl */ `
uniform vec3 skyTop; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 up;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = dot(d, up);
  vec3 col = h > 0.0 ? mix(horizon, skyTop, pow(h, 0.45)) : mix(horizon * 0.7, ground, pow(-h, 0.35));
  float s = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(s, 900.0) * 80.0 + pow(s, 12.0) * 0.5);
  gl_FragColor = vec4(col, 1.0);
}`;

// Fond étoilé en mode 2D (plein écran)
const STARS2D_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const STARS2D_FS = /* glsl */ `
uniform vec2 offset; uniform float bright; uniform vec2 res; uniform float rot;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 p = (vUv - 0.5) * res;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p + offset;
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float sc = 2.2 + float(l) * 1.7;
    vec2 q = p / sc;
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash(cell + float(l) * 17.0);
    if (h > 0.985) {
      vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      float d = length(f - o * 0.6);
      float b = smoothstep(0.12, 0.0, d) * (h - 0.985) * 66.0;
      col += b * mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.75), hash(cell + 11.0));
    }
  }
  gl_FragColor = vec4(col * bright, 1.0);
}`;

class EnvLight {
  constructor(renderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.scene = new THREE.Scene();
    this.u = {
      skyTop: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(1, 0, 0) }, sunColor: { value: new THREE.Color(1, 1, 1) }, up: { value: new THREE.Vector3(0, 1, 0) },
    };
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: ENV_VS, fragmentShader: ENV_FS, side: THREE.BackSide })));
    this.rt = null;
    this.t = 99;
  }
  update(dt, p, force = false) {
    this.t += dt;
    if (this.t < 1.2 && !force && this.rt) return this.rt.texture;
    this.t = 0;
    this.u.skyTop.value.copy(p.skyTop);
    this.u.horizon.value.copy(p.horizon);
    this.u.ground.value.copy(p.ground);
    this.u.sunDir.value.copy(p.sunDir);
    this.u.sunColor.value.copy(p.sunColor);
    this.u.up.value.copy(p.up);
    const old = this.rt;
    this.rt = this.pmrem.fromScene(this.scene, 0, 0.1, 100);
    if (old) old.dispose();
    return this.rt.texture;
  }
}

export class Flight {
  constructor(app) {
    this.app = app;
    this.sys = app.system;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000');
    this.cam3 = new THREE.PerspectiveCamera(55, 1, 0.3, 1e15);
    this.cam2 = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 2000);
    const q = app.R.q;
    this.q = q;
    // lumières
    this.sunLight = new THREE.DirectionalLight('#ffffff', 3);
    this.sunLight.castShadow = q.shadows;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.05;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.hemi = new THREE.HemisphereLight('#8fb4ff', '#403020', 0.4);
    this.scene.add(this.hemi);
    this.engineLight = new THREE.PointLight('#ffae5a', 0, 600, 1.5);
    this.scene.add(this.engineLight);
    // décors
    this.planets3d = new Planets3D(this.sys, app.tex, q);
    this.planets2d = new Planets2D(this.sys, app.tex);
    this.sky = new Sky();
    this.sky.bake(app.R.renderer);
    this.sky.attach(this.scene);
    this.scene.add(this.planets3d.group);
    this.scene.add(this.planets2d.group);
    this.terrain = new LocalTerrain(app.tex, q);
    this.scene.add(this.terrain.group);
    this.site = new LaunchSite(this.sys);
    this.scene.add(this.site.group);
    this.effects = new Effects(q);
    this.scene.add(this.effects.group);
    this.envLight = new EnvLight(app.R.renderer);
    this.stars2d = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: { offset: { value: new THREE.Vector2() }, bright: { value: 1 }, res: { value: new THREE.Vector2(1, 1) }, rot: { value: 0 } }, vertexShader: STARS2D_VS, fragmentShader: STARS2D_FS, depthWrite: false, depthTest: false }));
    this.stars2d.frustumCulled = false;
    this.stars2d.renderOrder = -100;
    this.scene.add(this.stars2d);
    this.fog = new THREE.FogExp2('#9fc0e8', 0);
    this.views = new Map();
    this.debrisObjs = [];
    this.hud = new FlightHUD(this);
    this.map = null;
    this.ap = new Autopilot(this);
    this.cam = { yaw: 0, pitch: 0.12, dist: 30, mode: 'orbit' };
    this.view2 = { size: 30, up: 0 };
    this.time = 0;
    this.touchRot = 0;
    this.warpMsgT = 0;
    this.shake = 0;
    this.active = false;
    this.bindInput();
  }

  get sim() {
    return this._sim;
  }

  enter(opts) {
    this.start(opts);
  }

  // Balise au sol (objectif d'un défi)
  setMarker(site) {
    if (this.marker) this.scene.remove(this.marker);
    this.marker = null;
    this.markerSite = site || null;
    if (!site) return;
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(site.radius * 0.06, site.radius * 0.02, 4000, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 2.2), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 2000;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(site.radius, site.radius * 0.035, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.4) }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.5;
    g.add(beam, ring);
    this.marker = g;
    this.scene.add(g);
  }

  placeMarker(ut, origin) {
    const m = this.marker, s = this.markerSite;
    if (!m) return;
    const b = this.sys.get(s.body);
    const bs = b.state(ut);
    const a = s.lon + b.rotationAt(ut);
    const R = b.radius + Math.max(b.ground.hasLiquid ? 0 : -1e9, b.ground.atLon(s.lon));
    m.position.set(bs.x - origin[0] + Math.cos(a) * R, bs.y - origin[1] + Math.sin(a) * R, 0);
    const mat = new THREE.Matrix4().makeBasis(new THREE.Vector3(Math.sin(a), -Math.cos(a), 0), new THREE.Vector3(Math.cos(a), Math.sin(a), 0), new THREE.Vector3(0, 0, 1));
    m.quaternion.setFromRotationMatrix(mat);
  }

  // ------------------------------------------------------------------------
  // Démarrage d'un vol
  // opts : { craft, site } | { vesselData } | { scenario }
  start(opts) {
    const app = this.app;
    const g = app.game;
    this.opts = opts;
    this.mode2d = Settings.get().view === '2d';
    this._sim = new Sim(this.sys, g.ut);
    this.sim.game = g;
    this.node = null;
    this.target = null;
    this.countdown = null;
    this.liftoffT = null;
    this.failed = false;
    this.recovered = false;
    this.flags = {};
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    this.effects.smoke.clear();
    this.effects.fire.clear();
    this.effects.sparks.clear();
    for (const d of this.debrisObjs) this.scene.remove(d.mesh);
    this.debrisObjs = [];
    let v;
    if (opts.vesselData) {
      v = Vessel.fromJSON(opts.vesselData, this.sys);
      const dt = Math.max(0, this.sim.ut - (opts.vesselData.ut || this.sim.ut));
      if (v.landed) v.holdLanded(this.sim.ut);
      else if (dt > 0) {
        const o = v.computeOrbit(opts.vesselData.ut);
        const st = o.stateAt(this.sim.ut);
        v.x = st.x; v.y = st.y; v.vx = st.vx; v.vy = st.vy;
      }
      g.vessels = g.vessels.filter((x) => x.id !== v.id);
    } else if (opts.scenario) {
      v = opts.scenario.create(this.sys, this.sim);
    } else {
      v = Vessel.fromCraft(opts.craft, this.sys);
      const site = opts.site === 'lz' ? EARTH_SITES.lz : EARTH_SITES.pad;
      v.placeOnSurface(this.sys.home, site.lon, this.sim.ut, true);
      v.met0 = this.sim.ut;
      g.stats.launches++;
    }
    this.sim.setActive(v);
    this.addView(v);
    this.setMarker(opts.scenario ? opts.scenario.site : null);
    // tour de lancement adaptée à la fusée
    const hgt = v.parts.reduce((m, p) => Math.max(m, p.pos.y + p.def.h / 2), 0) - v.parts.reduce((m, p) => Math.min(m, p.pos.y - p.def.h / 2), 0);
    const rad = v.parts.reduce((m, p) => Math.max(m, Math.abs(p.pos.x) + p.def.d / 2, Math.abs(p.pos.z) + p.def.d / 2), 0.6);
    this.site.buildPad(hgt, rad);
    this.cam.dist = Math.max(12, hgt * 1.6 + 8);
    this.cam.yaw = 0;
    this.cam.pitch = 0.1;
    this.cam.mode = 'orbit';
    this.view2.size = Math.max(12, hgt * 0.8 + 6);
    this.view2.snap = true;
    this.hud.build();
    this.hud.setView2d(this.mode2d);
    this.active = true;
    this.envLight.t = 99;
    // textures des astres proches en priorité
    app.tex.request(v.body.id, true);
    for (const c of v.body.children) app.tex.request(c.id);
    if (v.body.parentBody) app.tex.request(v.body.parentBody.id);
    app.tex.requestAll();
    if (!opts.vesselData && !opts.scenario) this.hud.flash(v.name, 'Espace : allumage · ou lancez le compte à rebours', 3500);
    this.app.audio.ambience('flight');
  }

  addView(v) {
    if (this.views.has(v)) return;
    const vw = new VesselView(v);
    this.views.set(v, vw);
    this.scene.add(vw.root);
  }

  exit() {
    this.active = false;
    this.hud.destroy();
    if (this.map) this.map.close();
    this.persist();
    this.app.R.renderer.toneMappingExposure = 1;
  }

  // Enregistre les vaisseaux encore en service (centre de suivi)
  persist() {
    const g = this.app.game;
    const sim = this.sim;
    if (!sim) return;
    g.ut = sim.ut;
    if (g.mode === 'challenge') return;
    const keep = [];
    for (const v of sim.vessels) {
      if (v.dead || !v.controlPart || !v.launched || v === this.recoveredVessel) continue;
      if (v.clamped) continue;
      // état stable uniquement : posé ou en orbite hors atmosphère
      const b = v.body;
      if (!v.landed && !v.splashed) {
        const o = v.computeOrbit(sim.ut);
        const low = b.radius + (b.atmosphere ? b.atmosphere.height : 0);
        if (o.periapsis < low && v !== sim.active) continue;
      }
      if (v.inContact && !v.landed) { v.landed = true; v.captureLanded(sim.ut); }
      if (v.landed) v.captureLanded(sim.ut);
      keep.push(v.toJSON(sim.ut));
    }
    g.vessels = g.vessels.filter((x) => !keep.some((k) => k.id === x.id)).concat(keep);
    g.save();
  }

  // ------------------------------------------------------------------------
  // Commandes
  stage() {
    const v = this.sim.active;
    if (!v || this.failed) return;
    if (!v.hasControl && v.launched) { toast('Pas de contrôle', 'Le vaisseau ne répond plus.', 'bad'); return; }
    if (this.countdown != null) this.countdown = null;
    if (v.activateNextStage(this.sim.ut)) this.app.audio.stage();
  }

  setThrottle(t) {
    const v = this.sim.active;
    if (v) v.throttle = clamp(t, 0, 1);
  }

  setSAS(mode) {
    const v = this.sim.active;
    if (!v) return;
    if (!this.sasAvailable(mode)) { toast('Mode indisponible', mode === 'node' ? 'Aucune manœuvre planifiée.' : mode === 'target' ? 'Aucune cible sélectionnée (carte).' : 'Technologie « Stabilité » requise.', 'warn'); return; }
    v.sas = v.sas === mode ? 'off' : mode;
    this.sasHold = v.rot;
    this.app.audio.click();
  }

  sasAvailable(mode) {
    const g = this.app.game;
    if (mode === 'node') return !!this.node;
    if (mode === 'target') return !!this.target;
    if (mode === 'stab') return true;
    if (g.mode !== 'career') return true;
    if (['pro', 'retro'].includes(mode)) return g.hasTech('stabilite');
    return g.hasTech('guidage') || g.hasTech('sondes');
  }

  toggle(key) {
    const v = this.sim.active;
    if (!v) return;
    if (key === 'rcs') v.rcsOn = !v.rcsOn;
    if (key === 'gear') v.gear = !v.gear;
    if (key === 'lights') v.lights = !v.lights;
    if (key === 'brakes') v.brakes = !v.brakes;
    if (key === 'panels') {
      this.panelsOut = !this.panelsOut;
      for (const p of v.parts) if ((p.def.solar && p.def.solar.deploy) || (p.def.antenna && p.def.antenna.deploy)) p.deployTarget = this.panelsOut ? 1 : 0;
    }
    this.app.audio.click();
  }

  toggle2d() {
    this.mode2d = !this.mode2d;
    this.view2.snap = true;
    Settings.set('view', this.mode2d ? '2d' : '3d');
    this.hud.setView2d(this.mode2d);
    this.envLight.t = 99;
  }

  toggleMap() {
    if (!this.map) this.map = new MapView(this);
    if (this.map.active) this.map.close();
    else this.map.open();
    this.app.audio.click();
  }

  cycleCamera() {
    const modes = this.mode2d ? ['orbit', 'lock'] : ['orbit', 'chase', 'ground', 'free'];
    const i = modes.indexOf(this.cam.mode);
    this.cam.mode = modes[(i + 1) % modes.length];
    const names = { orbit: 'Orbitale', chase: 'Poursuite', ground: 'Caméra au sol', free: 'Libre (repère inertiel)', lock: 'Vaisseau fixe' };
    toast('Caméra', names[this.cam.mode], '', 1500);
    if (this.cam.mode === 'ground') this.groundCam = null;
  }

  warpStep(d) {
    const s = this.sim;
    const before = s.warpIdx;
    const after = s.setWarp(s.warpIdx + d);
    if (after === before && d > 0) this.warpMsgT = 3;
    this.app.audio.click();
  }

  setTarget(b) {
    this.target = b;
    if (b) toast('Cible', b.name, '', 1500);
    const v = this.sim.active;
    if (!b && v && v.sas === 'target') v.sas = 'off';
  }

  createNode(t, pro = 0, rad = 0) {
    this.node = new ManeuverNode(t, pro, rad);
    this.updateNode();
  }

  updateNode() {
    const n = this.node;
    if (!n) return;
    n.started = false;
    n.baseOrbit = null;
    n.compute(this.sim.active, this.sys, this.sim.prediction, this.app.game);
    if (this.map) this.map.lastNodeKey = null;
  }

  removeNode() {
    this.node = null;
    const v = this.sim.active;
    if (v && v.sas === 'node') v.sas = 'off';
  }

  autopilotAvailable() {
    const g = this.app.game;
    if (g.mode !== 'career') return true;
    const v = this.sim.active;
    return !!(v && v.parts.some((p) => p.def.special === 'autopilot'));
  }

  toggleAutopilotPanel() {
    this.hud.buildAutopilot();
    this.hud.apEl.hidden = !this.hud.apEl.hidden;
  }

  startAutopilot(mode, opts) {
    if (!this.autopilotAvailable()) { toast('Pilote automatique', 'Ordinateur de guidage requis.', 'warn'); return; }
    if (mode === 'node' && !this.node) { toast('Aucune manœuvre', 'Placez une manœuvre sur la carte.', 'warn'); return; }
    this.ap.start(mode, opts);
    const v = this.sim.active;
    v.sas = 'off';
    toast('Pilote automatique', { ascent: 'Mise en orbite', node: 'Exécution de la manœuvre', land: 'Atterrissage propulsif' }[mode], 'good', 2000);
  }

  onAutopilotDone(kind) {
    if (kind === 'orbit') this.hud.flash('ORBITE ATTEINTE', this.sim.active.body.name);
  }

  runScience() {
    const v = this.sim.active;
    if (v) this.app.career.runScience(v, this.sim.ut);
  }

  situationText(v) {
    const b = v.body;
    if (v.clamped && !v.launched) return 'Au pas de tir';
    if (v.splashed) return `Amerri · ${b.name}`;
    if (v.landed) return `Posé · ${b.name}`;
    const p = this.sim.prediction && this.sim.prediction[0];
    if (b.atmosphere && v.altitude < b.atmosphere.height) return `En vol · ${b.name}`;
    if (p && p.body === b) {
      if (p.end === 'impact') return `Suborbital · ${b.name}`;
      if (p.end === 'escape') return `Évasion · ${b.name}`;
      if (p.orbit.e < 1 && p.orbit.periapsis > b.radius) return `En orbite · ${b.name}`;
    }
    return `Dans l'espace · ${b.name}`;
  }

  cutChutes() {
    const v = this.sim.active;
    if (!v) return;
    for (const p of v.parts) if (p.chute === 'semi' || p.chute === 'full') { p.chute = 'cut'; v.events.push({ type: 'chuteCut', part: p }); }
    this.app.audio.noiseBurst(0.3, 900, 0.3, 0.4);
  }

  contextActions(v) {
    const acts = [];
    const b = v.body;
    if (v.clamped && !v.launched) {
      if (this.countdown == null) acts.push({ label: 'Compte à rebours', kind: 'primary', fn: () => { this.countdown = 10; } });
      else acts.push({ label: 'Annuler le décompte', kind: 'danger', fn: () => { this.countdown = null; } });
      acts.push({ label: 'Atelier', fn: () => this.backToBuilder(true) });
    }
    if (v.launched && (v.landed || v.splashed) && b.id === 'terre' && !this.recovered) acts.push({ label: 'Récupérer le vaisseau', kind: 'primary', fn: () => this.recover() });
    else if (v.launched && (v.landed || v.splashed) && !this.recovered) acts.push({ label: 'Terminer le vol', fn: () => this.app.goHub() });
    const others = this.sim.vessels.filter((o) => o !== v && o.controlPart && !o.dead);
    if (others.length) acts.push({ label: 'Changer de vaisseau', fn: () => this.switchVessel(1) });
    if (v.parts.some((p) => p.def.engine && p.def.engine.escape)) acts.push({ label: 'Éjection !', kind: 'danger', fn: () => this.abort() });
    if (!v.landed && !v.splashed && v.parts.some((p) => p.chute === 'semi' || p.chute === 'full')) acts.push({ label: 'Larguer les parachutes', fn: () => this.cutChutes() });
    return acts;
  }

  switchVessel(dir) {
    const list = this.sim.vessels.filter((o) => o.controlPart && !o.dead);
    if (list.length < 2) return;
    const i = list.indexOf(this.sim.active);
    const nv = list[(i + dir + list.length) % list.length];
    this.sim.active.throttle = this.sim.active === nv ? nv.throttle : this.sim.active.throttle;
    this.ap.stop();
    this.sim.setActive(nv);
    this.hud.stageKey = null;
    this.node = null;
    toast('Vaisseau actif', nv.name, '', 1600);
  }

  abort() {
    const v = this.sim.active;
    const les = v.parts.find((p) => p.def.engine && p.def.engine.escape);
    if (!les) return;
    les.engOn = true;
    v.fireDecoupler(les, this.sim.ut);
    for (const p of v.parts) if (p.def.chute && p.chute === 'stowed') p.chute = 'armed';
    this.app.audio.alarm();
    this.hud.flash('ÉJECTION', 'Tour de sauvetage activée');
  }

  recover() {
    const v = this.sim.active;
    const res = this.app.career.recover(v);
    this.recovered = true;
    this.recoveredVessel = v;
    const g = this.app.game;
    const body = h('div', {},
      h('p', {}, `« ${v.name} » a été récupéré ${v.splashed ? 'en mer' : 'au sol'} par les équipes de la base.`),
      g.mode === 'career' ? h('p', {}, `Remboursement des pièces : ${fmtMoney(res.refund)}${res.sci ? ` · Science rapportée : +${fmtInt(res.sci)}` : ''}`) : null,
      h('p', {}, `Altitude max : ${fmtDist(v.stats.maxAlt)} · Accélération max : ${v.stats.maxG.toFixed(1)} g`));
    modal({ title: 'Vaisseau récupéré', body, actions: [{ label: 'Atelier', onClick: () => this.backToBuilder(false) }, { label: 'Centre spatial', kind: 'primary', onClick: () => this.app.goHub() }] });
    this.app.audio.success();
  }

  backToBuilder(refund) {
    const g = this.app.game;
    if (refund && this.opts.craft && g.mode === 'career' && !this.sim.active.launched) g.funds += this.opts.cost || 0;
    this.app.goBuilder(this.opts.craft || null);
  }

  revert() {
    const g = this.app.game;
    if (!this.opts.craft) return;
    if (g.mode === 'career') g.funds += this.opts.cost || 0;
    this.app.launchCraft(this.opts.craft, true);
  }

  openPause() {
    const wasWarp = this.sim.warpIdx;
    this.paused = true;
    const g = this.app.game;
    const acts = [
      { label: 'Reprendre', kind: 'primary', onClick: () => {} },
    ];
    if (this.opts.craft) {
      acts.push({ label: 'Revenir au lancement', onClick: () => this.revert() });
      acts.push({ label: 'Revenir à l\'atelier', onClick: () => this.backToBuilder(false) });
    }
    acts.push({ label: 'Options', onClick: () => this.app.openSettings(() => this.openPause()) });
    acts.push({ label: g.mode === 'challenge' ? 'Quitter le défi' : 'Centre spatial', onClick: () => (g.mode === 'challenge' ? this.app.goMenu() : this.app.goHub()) });
    const body = h('div', {},
      h('p', {}, 'Le temps est suspendu. Les vaisseaux en orbite ou posés sont conservés dans le centre de suivi quand vous quittez le vol.'),
      h('div', { class: 'kv' }, h('span', {}, 'Commandes : ', h('b', {}, 'Q/D ou ←/→'), ' tourner · ', h('b', {}, 'Maj/Ctrl'), ' gaz · ', h('b', {}, 'Z/X'), ' plein/coupé · ', h('b', {}, 'Espace'), ' étage · ', h('b', {}, 'T'), ' SAS · ', h('b', {}, 'M'), ' carte · ', h('b', {}, 'V'), ' 2D/3D · ', h('b', {}, ', .'), ' temps')));
    modal({ title: 'Pause', body, actions: acts, onClose: () => { this.paused = false; this.sim.warpIdx = wasWarp; } });
  }

  // ------------------------------------------------------------------------
  bindInput() {
    const cv = this.app.R.canvas;
    this.ptrs = new Map();
    cv.addEventListener('pointerdown', (e) => {
      if (!this.active || (this.map && this.map.active)) return;
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.active || (this.map && this.map.active)) return;
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) this.zoom(this.pinch / Math.max(10, d));
        this.pinch = d;
        return;
      }
      if (!this.mode2d) {
        this.cam.yaw -= dx * 0.006;
        this.cam.pitch = clamp(this.cam.pitch + dy * 0.005, -1.45, 1.45);
      }
    });
    const up = (e) => { this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch = null; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      if (!this.active || (this.map && this.map.active)) return;
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
  }

  zoom(k) {
    if (this.mode2d) this.view2.size = clamp(this.view2.size * k, 3, 5e9);
    else this.cam.dist = clamp(this.cam.dist * k, 3, 5e8);
  }

  handleKeys(dt) {
    const I = this.app.input;
    const v = this.sim.active;
    if (!v || document.querySelector('.modal-back')) return;
    if (I.hit('Space') || I.padPressed(0)) this.stage();
    if (I.down('ShiftLeft', 'ShiftRight') || I.padValue(7) > 0.1) v.throttle = clamp(v.throttle + dt * 0.8 * (I.padValue(7) || 1), 0, 1);
    if (I.down('ControlLeft', 'ControlRight') || I.padValue(6) > 0.1) v.throttle = clamp(v.throttle - dt * 0.8 * (I.padValue(6) || 1), 0, 1);
    if (I.key('z', 'w')) v.throttle = 1;
    if (I.key('x')) v.throttle = 0;
    if (I.key('t') || I.padPressed(1)) this.setSAS('stab');
    if (I.key('r')) this.toggle('rcs');
    if (I.key('g')) this.toggle('gear');
    if (I.key('y')) this.toggle('lights');
    if (I.key('b')) this.toggle('brakes');
    if (I.key('u')) this.toggle('panels');
    if (I.key('m') || I.padPressed(2)) this.toggleMap();
    if (I.key('v') || I.padPressed(3)) this.toggle2d();
    if (I.key('c')) this.cycleCamera();
    if (I.key('o')) this.toggleAutopilotPanel();
    if (I.key('k')) this.runScience();
    if (I.key('.', ':') || I.padPressed(5)) this.warpStep(1);
    if (I.key(',', ';') || I.padPressed(4)) this.warpStep(-1);
    if (I.key('/', '!')) this.sim.setWarp(0);
    if (I.key('escape', 'p') || I.padPressed(9)) this.openPause();
    if (I.key('backspace')) this.abort();
    if (I.key('[')) this.switchVessel(-1);
    if (I.key(']', 'tab')) this.switchVessel(1);
  }

  // Commandes d'attitude (joueur + SAS + pilote automatique)
  controlInputs(h) {
    const v = this.sim.active;
    if (!v) return;
    const I = this.app.input;
    let rot = 0;
    if (I.down('KeyA', 'ArrowLeft')) rot -= 1;
    if (I.down('KeyD', 'ArrowRight')) rot += 1;
    rot += this.touchRot || 0;
    rot += I.padAxis(0);
    if (Settings.get().invert) rot = -rot;
    rot = clamp(rot, -1, 1);
    v.ctrl.tx = (I.down('KeyL') ? 1 : 0) - (I.down('KeyJ') ? 1 : 0);
    v.ctrl.ty = (I.down('KeyI') ? 1 : 0) - (I.down('KeyK') ? 1 : 0);
    if (this.ap.mode) {
      if (Math.abs(rot) > 0.1) { this.ap.stop('Reprise en main manuelle'); }
      else {
        const c = this.ap.update(h, v, this.sim);
        if (c) { v.ctrl.rot = c.rot; return; }
      }
    }
    if (Math.abs(rot) > 0.01) {
      v.ctrl.rot = rot;
      if (v.sas === 'stab') this.sasHold = v.rot;
      return;
    }
    // SAS
    if (v.sas !== 'off' && v.hasControl && !v.electronicsDead) {
      if (v.sas === 'stab') {
        if (v.clamped || v.landed) { v.ctrl.rot = 0; return; }
        if (this.sasHold == null) this.sasHold = v.rot;
        v.ctrl.rot = steerTo(v, this.sasHold, h);
        return;
      }
      const d = sasDirection(v, v.sas, { node: this.node, target: this.target, ut: this.sim.ut });
      if (d) { v.ctrl.rot = steerTo(v, rotFor(d[0], d[1]), h); return; }
    }
    v.ctrl.rot = 0;
  }

  // ------------------------------------------------------------------------
  update(dt) {
    if (!this.active) return;
    if (this.paused) { this.render(); return; }
    this.time += dt;
    const sim = this.sim;
    this.handleKeys(dt);
    // compte à rebours
    if (this.countdown != null) {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after >= 0) {
        this.app.audio.countdown(after === 0);
        if (after <= 5) this.hud.flash(after > 0 ? String(after) : 'ALLUMAGE', after > 0 ? 'Compte à rebours' : '', 900);
        if (after === 3) { const v = sim.active; if (v) v.throttle = Math.max(v.throttle, 1); }
      }
      if (this.countdown <= 0) { this.countdown = null; this.stage(); }
    }
    this.warpMsgT -= dt;
    sim.update(dt, (h) => this.controlInputs(h));
    if (this.node) this.node.track(sim.active, sim.ut);
    this.handleEvents(sim.takeEvents());
    sim.cleanup();
    for (const [v, vw] of this.views) if (!sim.vessels.includes(v)) { vw.dispose(); this.views.delete(v); }
    for (const v of sim.vessels) this.addView(v);
    const v = sim.active;
    if (v) this.app.career.tick(v, sim, dt);
    // échec de mission
    if (v && !this.failed && (v.dead || !v.controlPart)) {
      this.failed = true;
      setTimeout(() => this.showFailure(), 2200);
    }
    if (this.map && this.map.active) {
      this.map.update(dt);
      this.hud.update(dt);
      this.updateAudio(dt);
      return;
    }
    this.hud.update(dt);
    this.updateAudio(dt);
  }

  showFailure() {
    const g = this.app.game;
    g.stats.lost++;
    const acts = [];
    if (this.opts.craft) acts.push({ label: 'Revenir au lancement', kind: 'primary', onClick: () => this.revert() });
    if (this.opts.craft) acts.push({ label: 'Atelier', onClick: () => this.backToBuilder(false) });
    acts.push({ label: g.mode === 'challenge' ? 'Menu' : 'Centre spatial', onClick: () => (g.mode === 'challenge' ? this.app.goMenu() : this.app.goHub()) });
    acts.push({ label: 'Rester', onClick: () => {} });
    modal({ title: 'Vaisseau perdu', body: '<p>Le module de commande a été détruit. Analysez ce qui s\'est passé, puis retentez votre chance : chaque échec rapproche du succès.</p>', actions: acts });
  }

  handleEvents(events) {
    const sim = this.sim;
    const a = this.app.audio;
    const va = sim.active;
    for (const e of events) {
      const v = e.vessel;
      const isActive = v === va;
      switch (e.type) {
        case 'ignite':
          if (isActive) a.blip(120, 0.3, 'sine', 0.2);
          break;
        case 'liftoff':
          this.liftoffT = 0;
          this.hud.flash('DÉCOLLAGE', v.name);
          this.shake = 1.4;
          break;
        case 'decouple': {
          a.stage();
          const p = e.part;
          const pos = v.toWorld(p.pos.x, p.pos.y);
          for (let i = 0; i < 10; i++) this.effects.smoke.emit({ x: pos[0], y: pos[1], z: (Math.random() - 0.5) * p.def.d, vx: v.vx + (Math.random() - 0.5) * 8, vy: v.vy + (Math.random() - 0.5) * 8, life: 2.5, s0: p.def.d * 0.6, s1: p.def.d * 3, r: 0.9, g: 0.9, b: 0.9, a: 0.5, drag: 0.8 });
          break;
        }
        case 'fairing': {
          const vw = this.views.get(v);
          if (!vw) break;
          const shells = vw.detachFairing(e.part.uid);
          for (const s of shells) {
            this.scene.add(s.mesh);
            const out = new THREE.Vector3(Math.cos(s.phi), 0, Math.sin(s.phi));
            const c = Math.cos(v.rot), sn = Math.sin(v.rot);
            const wx = out.x * c, wy = out.x * sn;
            const origin = this.originAbs || v.absPos(sim.ut);
            const bs = v.body.state(sim.ut);
            this.debrisObjs.push({
              mesh: s.mesh, x: s.wp.x + origin[0] - bs.x, y: s.wp.y + origin[1] - bs.y, z: s.wp.z,
              vx: v.vx + wx * 6, vy: v.vy + wy * 6, vz: out.z * 6, q: s.wq, spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.2), t: 0, body: v.body,
            });
          }
          a.noiseBurst(0.5, 500, 0.4, 0.6);
          break;
        }
        case 'chute':
        case 'chuteFull':
          if (isActive) a.chute();
          break;
        case 'chuteTorn':
          if (isActive) toast('Parachute arraché', 'Il a été ouvert à une vitesse trop élevée.', 'bad');
          break;
        case 'explode':
          this.effects.explosion(e.x, e.y, e.size, v.vx, v.vy, v.rho > 0.001);
          a.explosion(Math.min(2, e.size));
          if (isActive) this.shake = Math.max(this.shake, 1);
          if (isActive && e.cause === 'heat') toast('Pièce détruite par la chaleur', e.part.def.name, 'bad', 3000);
          if (isActive && e.cause === 'pressure') toast('Pièce écrasée par la pression', e.part.def.name, 'bad', 3000);
          break;
        case 'flameout':
          if (isActive && !e.part.def.engine.solid) toast('Extinction', `${e.part.def.name} : plus d'ergols`, 'warn', 2200);
          break;
        case 'landed':
          if (isActive) {
            const b = v.body;
            this.hud.flash(e.splashed ? 'AMERRISSAGE' : 'POSÉ', `${b.name}${v.launched ? '' : ''}`);
            a.thud(0.35);
          }
          break;
        case 'touch':
          if (e.v > 3) a.thud(Math.min(0.6, e.v / 20));
          if (e.liquid) for (let i = 0; i < 12; i++) this.effects.smoke.emit({ x: e.x, y: e.y, z: (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 2, s0: 2, s1: 8, r: 0.95, g: 0.97, b: 1, a: 0.7, drag: 1 });
          break;
        case 'soi':
          if (isActive) {
            toast('Changement de sphère d\'influence', `${e.from.name} → ${e.to.name}`, '', 3500);
            this.app.tex.request(e.to.id, true);
            for (const c of e.to.children) this.app.tex.request(c.id);
            if (this.map && this.map.active) this.map.setFocus(e.to, true);
          }
          break;
        case 'hazard':
          if (isActive) { toast('Danger', e.text, 'bad', 6000); a.alarm(); }
          break;
        case 'newVessel':
          this.addView(e.nv);
          break;
        case 'stage':
          break;
        default:
          break;
      }
    }
  }

  updateAudio(dt) {
    const a = this.app.audio;
    const v = this.sim.active;
    if (!v) { a.setEngine(0, 0); a.setWind(0); return; }
    const thr = v.currentThrust(v.pressureNow || 0);
    const level = clamp(thr / (v.mass * 9.81 * 1.3 + 1), 0, 1);
    const air = clamp((v.rho || 0) / 0.15, 0, 1);
    const solid = v.parts.some((p) => p.engOn && p.def.engine.solid && (p.thrustFrac || 0) > 0.1) ? 1 : 0;
    const muffle = this.sim.warpIdx > PHYS_WARP ? 0 : 1;
    a.setEngine(level * muffle, air, solid);
    a.setWind(clamp((v.q || 0) / 30000, 0, 1) * muffle, clamp((v.airspeed || 0) / 1500, 0, 1));
    void dt;
  }

  // ------------------------------------------------------------------------
  // Rendu
  render() {
    if (!this.active) return;
    if (this.map && this.map.active) { this.map.render(); return; }
    const sim = this.sim;
    const v = sim.active;
    if (!v) return;
    const dt = Math.min(0.1, this.time - (this.lastRenderT ?? this.time) || 0.016);
    this.lastRenderT = this.time;
    const ut = sim.ut;
    const b = v.body;
    const bs = b.state(ut);
    // origine flottante : le vaisseau actif
    const ox = bs.x + v.x, oy = bs.y + v.y;
    this.originAbs = [ox, oy];
    const R = this.app.R;
    const mode2d = this.mode2d;
    const up = [v.x, v.y];
    const rr = Math.hypot(up[0], up[1]);
    up[0] /= rr; up[1] /= rr;
    // --- caméra
    let cam;
    if (mode2d) {
      cam = this.cam2;
      const aspect = R.width / R.height;
      const s = this.view2.size;
      cam.left = -s * aspect; cam.right = s * aspect; cam.top = s; cam.bottom = -s;
      // le haut de l'écran suit la verticale locale (ou le vaisseau)
      let upAng = Math.atan2(up[1], up[0]);
      if (this.cam.mode === 'lock') upAng = v.rot + Math.PI / 2;
      if (s > b.radius * 2.5) upAng = Math.PI / 2;
      this.view2.up = this.view2.snap ? upAng : this.view2.up + wrapPi(upAng - this.view2.up) * Math.min(1, dt * 4);
      this.view2.snap = false;
      const shk = this.shake * s * 0.004;
      cam.position.set((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk, -500);
      // parachutes ouverts : cadrage élargi vers le haut
      const ext = this.views.get(v)?.chuteExtent || 0;
      if (ext > 0) {
        const s2 = Math.max(s, ext * 0.95);
        cam.left = -s2 * aspect; cam.right = s2 * aspect; cam.top = s2; cam.bottom = -s2;
        cam.position.x += up[0] * ext * 0.18;
        cam.position.y += up[1] * ext * 0.18;
      }
      cam.up.set(Math.cos(this.view2.up), Math.sin(this.view2.up), 0);
      cam.lookAt(cam.position.x, cam.position.y, 0);
      cam.near = 1;
      cam.far = 1000;
      cam.updateProjectionMatrix();
    } else {
      cam = this.cam3;
      this.updateCamera3(v, up, dt);
    }
    this.shake = Math.max(0, this.shake - dt * 1.2);
    if (this.liftoffT != null) this.liftoffT += dt;
    // --- lumière du Soleil
    const sun = this.sys.sun.state(ut);
    const sdx = sun.x - ox, sdy = sun.y - oy;
    const sdl = Math.hypot(sdx, sdy);
    const sunDir = new THREE.Vector3(sdx / sdl, sdy / sdl, 0);
    const light = this.computeLighting(v, sunDir, up);
    const ldir = sunDir.clone();
    if (mode2d) ldir.add(new THREE.Vector3(0, 0, -0.55)).normalize();
    const vr = Math.max(2, v.radius);
    this.sunLight.position.set(ldir.x * vr * 4, ldir.y * vr * 4, ldir.z * vr * 4);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.color.copy(light.sunColor);
    this.sunLight.intensity = light.sunI * (mode2d ? 1.1 : 1);
    const sc = this.sunLight.shadow.camera;
    const ext = Math.max(vr * 1.6, 30);
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.near = 0.1; sc.far = vr * 10 + 200;
    sc.updateProjectionMatrix();
    this.sunLight.castShadow = this.q.shadows && !mode2d && light.sunI > 0.05;
    // ciel désaturé pour l'ambiance (l'œil compense le bleu)
    const amb = light.skyTop.clone().lerp(new THREE.Color(light.skyTop.r + light.skyTop.g + light.skyTop.b).multiplyScalar(0.34), 0.55);
    this.hemi.color.copy(amb).multiplyScalar(1.5).addScalar(0.02);
    this.hemi.groundColor.copy(light.ground).addScalar(0.015);
    this.hemi.intensity = mode2d ? 1.1 : 0.9;
    this.hemi.position.set(up[0], up[1], 0);
    // horizon brumeux : la diffusion multiple blanchit le ciel bas (reflets et brouillard)
    const hz = light.horizon;
    const hzLum = hz.r * 0.2126 + hz.g * 0.7152 + hz.b * 0.0722;
    const haze = new THREE.Color(0.74, 0.82, 0.94).multiplyScalar(hzLum * 3.2 + 0.004).lerp(hz, 0.2);
    // réflexions
    const envTex = this.envLight.update(dt, { skyTop: light.skyTop.clone().lerp(new THREE.Color(light.skyTop.r + light.skyTop.g + light.skyTop.b).multiplyScalar(0.34), 0.4), horizon: haze, ground: light.ground, sunDir, sunColor: light.sunColor.clone().multiplyScalar(light.sunI * 0.4), up: new THREE.Vector3(up[0], up[1], 0) });
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.55;
    // brouillard dans l'atmosphère
    if (!mode2d && b.atmosphere && v.altitude < b.atmosphere.height) {
      const dens = b.density(Math.max(0, v.altitude)) / b.atmosphere.rho0;
      this.fog.color.copy(haze);
      this.fog.density = (3.5e-5 * Math.sqrt(Math.max(0, dens))) / Math.max(0.3, b.atmosphere.H / 5600) * (b.atmosphere.density || 1);
      this.scene.fog = this.fog;
    } else this.scene.fog = null;
    for (const o of this.planets3d.objs.values()) {
      if (!o.uniforms) continue;
      const on = this.scene.fog && o.body === b;
      o.uniforms.fogDensity.value = on ? this.fog.density : 0;
      if (on) o.uniforms.fogColor.value.copy(this.fog.color);
    }
    // --- astres
    const hiddenOk = (bb) => !bb.hidden || this.app.game.hasTech(bb.hidden);
    this.planets3d.group.visible = !mode2d;
    this.planets2d.group.visible = mode2d;
    this.sky.group.visible = !mode2d;
    this.stars2d.visible = mode2d;
    if (!mode2d) {
      this.planets3d.update(ut, [ox, oy], cam, dt, { hiddenOk });
      for (const o of this.planets3d.objs.values()) if (o.uniforms) o.uniforms.ambient.value = 0.004;
    } else {
      const px = (this.view2.size * 2) / R.height;
      this.planets2d.update(ut, [ox, oy], v, this.view2.size, px);
      const dbh = R.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
      for (const o of this.planets2d.objs.values()) {
        if (!o.au) continue;
        o.au.screenH.value = dbh;
        o.au.grad.value = o.body === b ? clamp(1 - this.view2.size / (b.atmosphere.height * 0.08), 0, 1) : 0;
      }
      const su = this.stars2d.material.uniforms;
      su.res.value.set(R.width, R.height);
      su.offset.value.set(0, 0);
      su.rot.value = -this.view2.up;
      su.bright.value = light.starBright;
    }
    // --- terrain local (3D)
    const talt = b.hasSurface ? v.terrainAltitude(ut) : Infinity;
    const camAlt = mode2d ? talt : talt + (this.cam3.position.x * up[0] + this.cam3.position.y * up[1]);
    const useTerrain = !mode2d && b.hasSurface && camAlt < Math.min(80000, b.radius * 0.25);
    this.terrain.group.visible = useTerrain;
    if (useTerrain) {
      const lonV = Math.atan2(v.y, v.x) - b.rotationAt(ut);
      const W = this.terrain.need(b, lonV, Math.max(camAlt, talt, 10));
      if (W) this.terrain.build(b, lonV, W);
      this.terrain.place(b, ut, [bs.x - ox, bs.y - oy]);
      const rot = b.rotationAt(ut);
      void rot;
      this.planets3d.setHole(b.id, this.terrain.holeDir, this.terrain.holeCos);
    } else this.planets3d.setHole(null);
    // --- pas de tir
    const home = this.sys.home;
    const hs = home.state(ut);
    const siteDist = b === home ? Math.hypot(v.x - Math.cos(EARTH_SITES.pad.lon + home.rotationAt(ut)) * home.radius, v.y - Math.sin(EARTH_SITES.pad.lon + home.rotationAt(ut)) * home.radius) : Infinity;
    this.site.update(ut, [hs.x - ox, hs.y - oy], siteDist, light.sunI < 0.2, this.liftoffT);
    this.placeMarker(ut, [ox, oy]);
    // --- étoiles et Soleil
    const sunRel = new THREE.Vector3(sun.x - ox, sun.y - oy, 0);
    this.sky.update(cam, sunRel, this.sys.sun.radius, dt, { starBrightness: light.starBright, twinkle: v.rho > 0.01 ? 1 : 0, pixelRatio: R.renderer.getPixelRatio(), sunGlow: light.sunGlow });
    this.sky.sunGlow.visible = !mode2d && light.sunGlow > 0.01;
    // --- vaisseaux
    for (const [vv, vw] of this.views) {
      if (vv.dirtyView !== vv.parts.length + ':' + vv.stageIdx) {
        vv.dirtyView = vv.parts.length + ':' + vv.stageIdx;
        vw.sync();
      }
      const vbs = vv.body.state(ut);
      vw.update([ox - vbs.x, oy - vbs.y], ut, this.time, { ortho: mode2d });
      vw.root.visible = !vv.dead;
    }
    // --- effets
    this.updateEffects(dt, v, [ox, oy], mode2d, light);
    // --- débris de coiffe
    for (const d of this.debrisObjs.slice()) {
      d.t += dt;
      const dbs = d.body.state(ut);
      const r = Math.hypot(d.x, d.y);
      const gk = -d.body.mu / (r * r * r);
      const rho = d.body.density(r - d.body.radius);
      const k = Math.exp(-rho * 0.3 * dt);
      d.vx = (d.vx + gk * d.x * dt) * k; d.vy = (d.vy + gk * d.y * dt) * k; d.vz *= k;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.mesh.position.set(dbs.x + d.x - ox, dbs.y + d.y - oy, d.z);
      d.q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(d.spin.x * dt, d.spin.y * dt, d.spin.z * dt)));
      d.mesh.quaternion.copy(d.q);
      if (d.t > 40 || r < d.body.radius) { this.scene.remove(d.mesh); this.debrisObjs.splice(this.debrisObjs.indexOf(d), 1); }
    }
    // exposition : un peu plus lumineuse la nuit au sol
    R.renderer.toneMappingExposure = light.exposure;
    R.setBloom(0.6, 0.45, 0.88);
    R.render(this.scene, cam);
  }

  updateCamera3(v, up, dt) {
    const cam = this.cam3;
    const R = this.app.R;
    cam.aspect = R.width / R.height;
    const c = this.cam;
    const ux = up[0], uy = up[1];
    // repère local : haut, est, nord (+Z)
    const east = new THREE.Vector3(-uy, ux, 0);
    const upV = new THREE.Vector3(ux, uy, 0);
    const north = new THREE.Vector3(0, 0, 1);
    const shk = this.shake * 0.25 * Math.min(1, c.dist / 40);
    const tgt = new THREE.Vector3((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk, 0);
    if (c.mode === 'ground' && this.liftoffT != null && v.body === this.sys.home && v.altitude < 40000) {
      // caméra au sol, téléobjectif qui suit la fusée
      if (!this.groundCam) {
        const off = east.clone().multiplyScalar(-420).add(north.clone().multiplyScalar(-650)).add(upV.clone().multiplyScalar(-v.terrainAltitude(this.sim.ut) + 8));
        this.groundCam = { x: v.x + off.x, y: v.y + off.y, z: off.z, bodyRot: v.body.rotationAt(this.sim.ut) };
      }
      const g = this.groundCam;
      const rot = v.body.rotationAt(this.sim.ut) - g.bodyRot;
      const gx = g.x * Math.cos(rot) - g.y * Math.sin(rot), gy = g.x * Math.sin(rot) + g.y * Math.cos(rot);
      cam.position.set(gx - v.x, gy - v.y, g.z);
      cam.up.copy(upV);
      cam.lookAt(tgt);
      const d = cam.position.length();
      cam.fov = clamp((2 * Math.atan((Math.max(v.radius, 10) * 3) / d) * 180) / Math.PI, 1.5, 55);
    } else {
      cam.fov = 55;
      let pos;
      if (c.mode === 'chase') {
        const ax = -Math.sin(v.rot), ay = Math.cos(v.rot);
        const back = new THREE.Vector3(-ax, -ay, 0);
        pos = back.multiplyScalar(c.dist * 0.8).add(north.clone().multiplyScalar(-c.dist * 0.6)).add(new THREE.Vector3(ax, ay, 0).multiplyScalar(-c.dist * 0.1));
        cam.up.set(ax, ay, 0);
      } else if (c.mode === 'free') {
        const cp = Math.cos(c.pitch);
        pos = new THREE.Vector3(Math.sin(c.yaw) * cp, Math.sin(c.pitch), -Math.cos(c.yaw) * cp).multiplyScalar(c.dist);
        cam.up.set(0, 1, 0);
      } else {
        const cp = Math.cos(c.pitch);
        pos = east.clone().multiplyScalar(Math.sin(c.yaw) * cp).add(north.clone().multiplyScalar(-Math.cos(c.yaw) * cp)).add(upV.clone().multiplyScalar(Math.sin(c.pitch)));
        pos.multiplyScalar(c.dist);
        cam.up.copy(upV);
      }
      // parachutes ouverts : on recule et on vise entre la capsule et la voilure
      const ext = this.views.get(v)?.chuteExtent || 0;
      if (ext > 0) {
        const need = ext * 2.1;
        if (pos.length() < need) pos.setLength(need);
        tgt.addScaledVector(upV, ext * 0.28);
      }
      // ne pas passer sous le sol
      if (v.body.hasSurface) {
        const talt = v.terrainAltitude(this.sim.ut);
        const along = pos.dot(upV);
        if (talt + along < 2) pos.addScaledVector(upV, 2 - (talt + along));
      }
      cam.position.copy(pos).add(tgt);
      // on vise un peu sous le vaisseau : il apparaît au-dessus des instruments
      cam.lookAt(tgt.clone().addScaledVector(upV, -c.dist * 0.16));
    }
    cam.near = Math.max(0.2, Math.min(cam.position.length() * 0.02, 50));
    cam.far = 1e15;
    cam.updateProjectionMatrix();
    void dt;
  }

  // Couleurs du ciel, du Soleil et de l'ambiance selon l'atmosphère et l'heure
  computeLighting(v, sunDir, up) {
    const b = v.body;
    const out = {
      skyTop: new THREE.Color(0, 0, 0), horizon: new THREE.Color(0.01, 0.012, 0.02), ground: new THREE.Color(0, 0, 0),
      sunColor: new THREE.Color(1, 1, 1), sunI: 3.0, starBright: 1, sunGlow: 1, exposure: 1,
    };
    const elev = sunDir.x * up[0] + sunDir.y * up[1];
    const shadow = v.inShadow(this.sim ? this.sim.ut : 0, this.sys);
    // éclairement solaire selon la distance au Soleil
    const flux = v.sunFlux || 1;
    out.sunI = 3.0 * Math.min(2.2, Math.pow(flux, 0.35));
    if (shadow) out.sunI = 0;
    const planetCol = new THREE.Color(b.color).convertSRGBToLinear();
    const altR = v.altitude / b.radius;
    // lumière réfléchie par l'astre proche
    const near = clamp(1 - altR * 0.8, 0, 1);
    const lit = clamp(elev * 0.5 + 0.5, 0, 1);
    out.ground.copy(planetCol).multiplyScalar(0.25 * near * (0.2 + 0.8 * lit) * (shadow ? 0.15 : 1));
    if (b.atmosphere) {
      const a = b.atmosphere;
      const dens = clamp(b.density(Math.max(0, v.altitude)) / a.rho0, 0, 1);
      const thick = clamp(Math.sqrt(dens) * 1.3, 0, 1);
      const day = clamp((elev + 0.1) / 0.3, 0, 1) * (shadow ? 0.15 : 1);
      const sky = new THREE.Color(a.sky).convertSRGBToLinear();
      out.skyTop.copy(sky).multiplyScalar(0.55 * thick * day);
      const dusk = Math.exp(-(elev * elev) / 0.02) * thick;
      out.horizon.copy(sky).multiplyScalar(0.75 * thick * day).lerp(new THREE.Color(1.0, 0.45, 0.15), dusk * 0.6);
      out.ground.lerp(planetCol.clone().multiplyScalar(0.3 * day), thick);
      // près du sol : lumière renvoyée par le terrain local (forêt, désert…) et non la teinte moyenne de l'astre
      const nearGround = clamp(1 - v.altitude / 25000, 0, 1);
      if (nearGround > 0 && b.hasSurface && this.app.tex) {
        const lonV = Math.atan2(v.y, v.x) - b.rotationAt(this.sim ? this.sim.ut : 0);
        const c = this.app.tex.sampleColor(b.id, lonV, 0);
        if (c) out.ground.lerp(new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear().multiplyScalar(0.35 * day), nearGround);
      }
      // transmittance vers le Soleil (couchers de soleil orangés)
      const airmass = 1 / Math.max(0.04, elev + 0.06);
      const tau = 0.12 * dens * Math.min(airmass, 38) * (a.density || 1);
      out.sunColor.setRGB(Math.exp(-tau * 0.45), Math.exp(-tau * 1.0), Math.exp(-tau * 2.1));
      if (elev < -0.05 && v.altitude < a.height * 0.5) out.sunI *= clamp((elev + 0.12) / 0.07, 0, 1);
      out.starBright = clamp(1 - day * thick * 1.4, 0, 1);
      out.sunGlow = clamp(1 - thick * 0.4, 0.4, 1) * (shadow ? 0 : 1);
      out.exposure = 1 + (1 - day) * thick * 0.6;
    } else {
      out.skyTop.setRGB(0.002, 0.002, 0.004);
      out.horizon.setRGB(0.004, 0.004, 0.008);
      out.sunGlow = shadow ? 0 : 1;
    }
    return out;
  }

  // Fumée, vapeur, poussière, étincelles
  updateEffects(dt, va, origin, mode2d, light) {
    const sim = this.sim;
    const fx = this.effects;
    const b = va.body;
    const w = b.angularVelocity();
    const airFn = (x, y) => {
      const r = Math.hypot(x, y);
      const rho = b.density(r - b.radius);
      const k = b.atmosphere ? clamp(rho / b.atmosphere.rho0 * 6, 0.02, 1) : 0;
      return [-w * y, w * x, k];
    };
    const gravFn = (x, y) => {
      const r = Math.hypot(x, y);
      const g = -b.mu / (r * r * r) * 0.3;
      return [g * x, g * y];
    };
    let engineLightI = 0;
    let lightPos = null;
    for (const v of sim.vessels) {
      if (v.body !== b) continue;
      const d = Math.hypot(v.x - va.x, v.y - va.y);
      if (d > 30000) continue;
      const rho = v.rho || 0;
      const talt = b.hasSurface ? v.terrainAltitude(sim.ut) - (v.cy - v.lowestY()) : 1e9;
      const c = Math.cos(v.rot), s = Math.sin(v.rot);
      for (const p of v.parts) {
        const e = p.def.engine;
        if (!e || !p.engOn || p.flameout) continue;
        const tf = p.thrustFrac || 0;
        if (tf < 0.02) continue;
        const st = plumeStyle(e.plume);
        const r = e.exitD / 2;
        const dy = p.flip ? 1 : -1;
        const ex = p.pos.x - v.cx, ey = p.pos.y - v.cy + (dy * p.def.h) / 2;
        const wx = v.x + ex * c - ey * s, wy = v.y + ex * s + ey * c;
        const dirx = -s * dy * -1 * -1, diry = c * dy;
        const exhX = -(-s) * (p.flip ? -1 : 1), exhY = -c * (p.flip ? -1 : 1);
        void dirx; void diry;
        engineLightI += e.thrust * tf;
        lightPos = [wx, wy];
        // traînée de fumée dans l'atmosphère
        if (st.smoke && rho > 2e-4) {
          const dens = clamp(rho / 0.4, 0.15, 1);
          const rate = (e.solid ? 95 : 48) * Math.min(3, 0.5 + r) * tf * dens * Math.max(0.6, this.q.particles / 1400);
          const n = rate * dt + Math.random();
          for (let i = 0; i < Math.floor(n); i++) {
            const jit = (Math.random() - 0.5) * r;
            const sp = 30 + Math.random() * 40;
            const sh = 0.55 + Math.random() * 0.25;
            const lightK = 0.25 + light.sunI * 0.28;
            fx.smoke.emit({
              x: wx + exhX * r * 1.5 + jit * c, y: wy + exhY * r * 1.5 + jit * s, z: (Math.random() - 0.5) * r * 2,
              vx: v.vx + exhX * sp, vy: v.vy + exhY * sp, vz: (Math.random() - 0.5) * 6,
              life: (e.solid ? 16 : 9) + Math.random() * 6, s0: r * 2.4, s1: r * (e.solid ? 30 : 18) * (1 + (1 - dens)),
              r: st.smoke[0] * sh * lightK, g: st.smoke[1] * sh * lightK, b: st.smoke[2] * sh * lightK * 1.05,
              a: (e.solid ? 0.85 : 0.55) * dens, drag: 2.2, lift: 0.8,
            });
          }
          // flammèches près de la tuyère
          if (rho > 0.05 && (e.plume === 'kero' || e.plume === 'srb')) {
            for (let i = 0; i < 2; i++) fx.fire.emit({ x: wx + exhX * r * 3, y: wy + exhY * r * 3, z: 0, vx: v.vx + exhX * 60, vy: v.vy + exhY * 60, life: 0.25 + Math.random() * 0.25, s0: r * 2.2, s1: r * 5, r: 3.2, g: 1.3, b: 0.35, a: 0.35 * tf, drag: 4 });
          }
        }
        // souffle au sol : vapeur / poussière
        if (b.hasSurface && talt < 80 + r * 30 && tf > 0.1) {
          const gnd = Math.hypot(wx, wy);
          const upx = wx / gnd, upy = wy / gnd;
          const groundR = gnd - (talt + 2);
          const gx = upx * groundR, gy = upy * groundR;
          const onPad = b === this.sys.home && this.liftoffT != null && this.liftoffT < 25;
          const n = (onPad ? 5 : 3) * dt * 30 * tf * Math.min(1.5, r);
          const surfCol = b.atmosphere && b.id === 'terre' ? [0.9, 0.9, 0.92] : new THREE.Color(b.color).toArray();
          for (let i = 0; i < Math.floor(n + Math.random()); i++) {
            const side = Math.random() < 0.5 ? -1 : 1;
            const sp = 15 + Math.random() * 35;
            const tx = -upy * side, ty = upx * side;
            const lightK = 0.3 + light.sunI * 0.25;
            fx.smoke.emit({
              x: gx + tx * r * 2, y: gy + ty * r * 2, z: (Math.random() - 0.5) * r * 4,
              vx: -w * gy + tx * sp + upx * Math.random() * 6, vy: w * gx + ty * sp + upy * Math.random() * 6, vz: (Math.random() - 0.5) * sp,
              life: onPad ? 9 + Math.random() * 6 : 4 + Math.random() * 3, s0: r * 3, s1: Math.min(35, r * (onPad ? 20 : 12)),
              r: surfCol[0] * lightK, g: surfCol[1] * lightK, b: surfCol[2] * lightK, a: onPad ? 0.55 : 0.4, drag: b.atmosphere ? 0.6 : 0.05, lift: b.atmosphere ? 0.6 : 0,
            });
          }
        }
      }
      // plasma de rentrée : étincelles
      if (v.reentryGlow > 0.15) {
        const sv = v.surfaceVelocity();
        const sl = Math.hypot(sv[0], sv[1]) || 1;
        for (let i = 0; i < 4; i++) {
          fx.sparks.emit({ x: v.x + (sv[0] / sl) * v.radius * 0.5, y: v.y + (sv[1] / sl) * v.radius * 0.5, z: (Math.random() - 0.5) * v.radius, vx: v.vx - (sv[0] / sl) * 200, vy: v.vy - (sv[1] / sl) * 200, life: 0.6, s0: 0.6, s1: 0.1, r: 5, g: 2.2, b: 0.8, a: v.reentryGlow, drag: 2 });
        }
      }
    }
    fx.smoke.update(dt, airFn, null);
    fx.fire.update(dt, airFn, null);
    fx.sparks.update(dt, airFn, gravFn);
    // éclairs d'explosion
    let flash = 0;
    for (const f of fx.flashes.slice()) {
      f.t += dt;
      flash = Math.max(flash, (1 - f.t / 0.6) * f.size * 60000);
      if (f.t > 0.6) fx.flashes.splice(fx.flashes.indexOf(f), 1);
    }
    fx.flashLight.intensity = flash;
    if (fx.flashes.length) { const f = fx.flashes[fx.flashes.length - 1]; fx.flashLight.position.set(f.x - va.x, f.y - va.y, 0); }
    this.shake = Math.max(this.shake, fx.shake);
    fx.shake = 0;
    // la lueur des moteurs éclaire la fumée et le sol
    this.engineLight.intensity = lightPos ? clamp(engineLightI / 2e5, 0, 40) * 200 : 0;
    if (lightPos) this.engineLight.position.set(lightPos[0] - va.x, lightPos[1] - va.y, 0);
    const lk = 1;
    // en 2D, les particules passent derrière le vaisseau
    const z2 = mode2d ? 25 : null;
    fx.smoke.upload(va.x, va.y, lk, z2);
    fx.fire.upload(va.x, va.y, 1, mode2d ? 22 : null);
    fx.sparks.upload(va.x, va.y, 1, mode2d ? -5 : null);
    void origin; void mode2d;
  }
}

export { WARPS };
