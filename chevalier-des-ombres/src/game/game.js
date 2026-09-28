// Chef d'orchestre : boucle de jeu, chargement des régions, entités, arènes de boss,
// interactions, mort et réapparition, sauvegarde automatique.
import * as THREE from 'three';
import { Renderer } from '../gfx/renderer.js';
import { Particles, AmbientField } from '../gfx/particles.js';
import { Effects } from '../gfx/effects.js';
import { updateMaterials, createCharMaterial, Mats } from '../gfx/materials.js';
import { makeEnvironment } from '../gfx/envmap.js';
import { World, fogMul } from '../world/world.js';
import { Sky } from '../world/sky.js';
import { ZONES } from '../data/zones.js';
import { enemyById, ENEMIES } from '../data/enemies.js';
import { bossById } from '../data/bosses.js';
import { NPCS } from '../data/quests.js';
import { WEAPONS, SHIELDS, OUTFITS } from '../data/equipment.js';
import { powerById } from '../data/skills.js';
import { Input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { device } from '../core/device.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Boss, cloneDefFromBoss } from './boss.js';
import { Combat } from './combat.js';
import { CameraRig } from './camera.js';
import { ViewModel } from './viewmodel.js';
import { Powers, Ally } from './powers.js';
import { QuestManager } from './quests.js';
import { newProfile, initialQuests } from './state.js';
import { saveProfile } from './save.js';
import { buildHumanoid } from '../actors/models.js';
import { Animator } from '../actors/anims.js';
import { PropBuilder, G, xf, SURF } from '../actors/rig.js';
import { rand, dist2, clamp, makeRng, hashString } from '../core/utils.js';

const _v = new THREE.Vector3();

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new Renderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.get('fov'), window.innerWidth / window.innerHeight, 0.08, 400);
    this.renderer.camera = this.camera;
    this.time = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.hitStop = 0;
    this.enemies = [];
    this.allies = [];
    this.npcs = [];
    this.chests = [];
    this.tokens = new Set();
    this.state = 'boot';
    this.zoneId = null;
    this.profile = newProfile();
    this.autosaveT = 0;
    this.pendingSave = false;
    this.activeBoss = null;
    this.bosses = [];
    this.fps = 60;

    // Lumières
    this.hemi = new THREE.HemisphereLight(0x6a5a9a, 0x1a1410, 0.8);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0xb8b0ff, 1.5);
    this.moon.castShadow = true;
    this.moon.shadow.bias = -0.0005;
    this.moon.shadow.normalBias = 0.03;
    this.scene.add(this.moon, this.moon.target);
    this.rim = new THREE.DirectionalLight(0x7a3cff, 0.6);
    this.scene.add(this.rim, this.rim.target);
    this.scene.fog = new THREE.FogExp2(0x1a1024, 0.02);

    this.sky = new Sky(this.scene);
    this.world = new World(this.scene);
    this.particles = new Particles(this.scene, 1800, true);
    this.particlesAlpha = new Particles(this.scene, 700, false);
    this.effects = new Effects(this.scene, this.particles, this.particlesAlpha);
    this.effects.heightAt = (x, z) => this.world.heightAt(x, z);
    this.effects.renderer = this.renderer;
    this.combat = new Combat(this);
    this.camRig = new CameraRig(this.camera, this.world);
    this.viewModel = new ViewModel();
    this.renderer.overlay = null;
    this.input = new Input(canvas);
    this.powers = new Powers(this);
    this.quests = new QuestManager(this);
    this.player = new Player(this);
    this.propMaterial = createCharMaterial();
    this.applyShadowSettings();
    settings.onChange((k) => {
      if (k === 'shadows' || k === 'preset' || k === '*') this.applyShadowSettings();
      if (k === 'drawDistance' || k === 'preset' || k === '*') this.applyFog();
      if (k === 'charModel' && this.player.mesh) this.player.rebuild();
      if (k === 'camMode') {
        this.camRig.mode = settings.get('camMode');
        this.player.updateFirstPerson();
      }
    });
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    // Perte du contexte graphique (mémoire saturée, appli en arrière-plan) : pause puis reprise
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      device.lost = true;
      if (this.state === 'playing' && this.player.alive && !this.activeBoss) this.autosave();
      if (this.hud) this.hud.toast('Récupération graphique…', true);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      device.lost = false;
      this.renderer.applySettings();
      if (settings.get('autoQuality')) this._degrade('mémoire graphique');
      if (this.hud) this.hud.toast('Affichage rétabli');
    });
  }

  // Surveille la fluidité et la mémoire estimée ; baisse la qualité si nécessaire
  _perfGuard(realDt) {
    const g = this._guard || (this._guard = { t: 0, frames: 0, low: 0, cooldown: 4 });
    g.t += realDt;
    g.frames++;
    g.cooldown -= realDt;
    if (g.t < 2) return;
    const fps = g.frames / g.t;
    g.t = 0;
    g.frames = 0;
    this.memUsageMb = device.estimateUsage(this);
    if (!settings.get('autoQuality') || g.cooldown > 0) return;
    if (this.memUsageMb > device.budgetMb) {
      this._degrade('mémoire');
      g.cooldown = 6;
      return;
    }
    const target = settings.get('powerSave') ? 30 : settings.get('fpsLimit') || 60;
    if (fps < Math.min(24, target * 0.7)) {
      g.low++;
      if (g.low >= 3 && (!settings.get('dynamicRes') || this.renderer.dynScale <= 0.6)) {
        this._degrade('fluidité');
        g.low = 0;
        g.cooldown = 10;
      }
    } else g.low = 0;
  }

  _degrade(reason) {
    const s = settings.values;
    const order = ['ultra', 'high', 'medium', 'low'];
    const i = order.indexOf(s.preset);
    if (s.shadows === 'ultra') settings.set('shadows', 'high');
    else if (!s.dynamicRes) settings.set('dynamicRes', true);
    else if (s.renderScale > 0.65) settings.set('renderScale', Math.max(0.6, Math.round((s.renderScale - 0.1) * 100) / 100));
    else if (i >= 0 && i < 3) settings.set('preset', order[i + 1]);
    else if (s.shadows !== 'off') settings.set('shadows', 'off');
    else if (s.charTexture > 512) settings.set('charTexture', 512);
    else return;
    if (this.hud) this.hud.toast(`Qualité ajustée automatiquement (${reason})`);
  }

  // Seuls les N ennemis les plus proches (et ceux déjà au combat) sont pleinement actifs
  _updateActiveSet(realDt) {
    this._activeT = (this._activeT || 0) - realDt;
    if (this._activeT > 0) return;
    this._activeT = 0.5;
    const max = settings.get('maxEnemies') || 16;
    const p = this.player.pos;
    const list = this.enemies.filter((e) => e.alive);
    list.sort((a, b) => (a.pos.x - p.x) ** 2 + (a.pos.z - p.z) ** 2 - ((b.pos.x - p.x) ** 2 + (b.pos.z - p.z) ** 2));
    list.forEach((e, i) => {
      e.sleeping = i >= max && !e.isBoss && e.state !== 'chase' && e.state !== 'attack';
    });
  }

  // Poids approximatif des géométries de la scène (pour le budget mémoire)
  _measureGeometry() {
    const seen = new Set();
    let bytes = 0;
    this.scene.traverse((o) => {
      const g = o.geometry;
      if (!g || seen.has(g)) return;
      seen.add(g);
      for (const k in g.attributes) bytes += g.attributes[k].array.byteLength;
      if (g.index) bytes += g.index.array.byteLength;
      if (o.isInstancedMesh) bytes += o.instanceMatrix.array.byteLength;
    });
    this._geoMb = bytes / 1048576;
  }

  // Branche l'interface (créée après le jeu)
  attachUI(hud, menus) {
    this.hud = hud;
    this.menus = menus;
  }

  start() {
    requestAnimationFrame(this._loop);
  }

  applyShadowSettings() {
    const s = settings.get('shadows');
    const size = s === 'ultra' ? 4096 : s === 'high' ? 2048 : 1024;
    const ext = s === 'ultra' ? 36 : s === 'high' ? 30 : 22;
    this.moon.castShadow = s !== 'off';
    if (this.moon.shadow.mapSize.x !== size) {
      this.moon.shadow.mapSize.set(size, size);
      if (this.moon.shadow.map) {
        this.moon.shadow.map.dispose();
        this.moon.shadow.map = null;
      }
    }
    const c = this.moon.shadow.camera;
    c.left = -ext;
    c.right = ext;
    c.top = ext;
    c.bottom = -ext;
    c.near = 1;
    c.far = 160;
    c.updateProjectionMatrix();
    this.shadowExt = ext;
  }

  applyFog() {
    if (!this.zone) return;
    this.scene.fog.density = this.zone.palette.fogDensity * fogMul();
    this.camera.far = this.world.viewDistance + 200;
    this.camera.updateProjectionMatrix();
  }

  // ================= Chargement de région =================
  async loadZone(zoneId, spawn = null) {
    const prev = this.state;
    this.state = 'loading';
    this.hud && this.hud.showLoading(ZONES[zoneId]);
    await new Promise((r) => setTimeout(r, 40));
    this._clearEntities();
    const zone = ZONES[zoneId];
    this.zone = zone;
    this.zoneId = zoneId;
    this.profile.zone = zoneId;
    const plan = this.world.load(zoneId, this.propMaterial);
    this.plan = plan;
    // Ambiance
    const pal = zone.palette;
    this.scene.fog.color.set(pal.fog);
    this.applyFog();
    this.hemi.color.set(pal.hemiSky);
    this.hemi.groundColor.set(pal.hemiGround);
    this.hemi.intensity = pal.hemi * 2.4;
    this.moon.color.set(pal.moon);
    this.moon.intensity = pal.moonI * 1.7;
    this.rim.color.set(pal.rim);
    this.rim.intensity = zone.indoor ? 0.5 : 1.1;
    this.sky.setPalette(pal, zone.indoor);
    this.sky.buildHorizon(zone.terrain.size, pal, hashString(zoneId), zoneId === 'hub' || zoneId === 'graveyard' || zoneId === 'forest');
    this.scene.background = new THREE.Color(pal.fog);
    const env = makeEnvironment(this.renderer.renderer, { skyTop: pal.skyTop, horizon: pal.horizon, ground: pal.ground, accent: pal.accent, rim: pal.rim, moon: pal.moon });
    this.scene.environment = env;
    this.scene.environmentIntensity = zone.indoor ? 0.8 : 1;
    this.viewModel.syncLights(pal.hemiSky, pal.hemiGround, pal.moon, env);
    this.renderer.setGrade(pal.grade);
    if (this.ambient) this.ambient.dispose();
    this.ambient = zone.ambient ? new AmbientField(this.scene, zone.ambient) : null;
    audio.setMood(zone.mood);
    audio.setAmbience(zone.ambience);
    audio.setIntensity(0);
    // Entités
    this._spawnCamps();
    this._spawnChests();
    this._spawnPage();
    this._spawnNpcs();
    this._spawnPortalFx();
    // Joueur
    if (!this.player.mesh) this.player.rebuild();
    let sp = spawn;
    if (!sp) sp = zone.entry;
    this.player.spawn(sp.x, sp.z, sp.yaw ?? zone.entry.yaw);
    this.camRig.curDist = this.camRig.dist;
    this.quests.zoneEntered(zoneId);
    if (this.hud) {
      this.hud.hideLoading();
      this.hud.zoneTitle(zone);
      this.hud.refreshAll();
    }
    this.state = prev === 'title' ? 'title' : 'playing';
    // Pré-compilation des shaders pour éviter les saccades
    this.renderer.renderer.compile(this.scene, this.camera);
    this._measureGeometry();
  }

  _clearEntities() {
    for (const e of this.enemies) e.removeModel();
    this.enemies = [];
    for (const a of this.allies) a.removeModel();
    this.allies = [];
    for (const n of this.npcs) this._disposeMesh(n.mesh, true);
    this.npcs = [];
    for (const c of this.chests) this._disposeMesh(c.mesh);
    this.chests = [];
    if (this.pageMesh) {
      this._disposeMesh(this.pageMesh);
      this.pageMesh = null;
    }
    if (this.portalFx) {
      this._disposeMesh(this.portalFx);
      this.portalFx = null;
    }
    this._endBossFight(false);
    this.bosses = [];
    this.tokens.clear();
    this.combat.clear();
    this.effects.clear();
    this.particles.clear();
    this.particlesAlpha.clear();
    this.powers.channels = [];
  }

  // Retire un objet de la scène et libère ses géométries (et ses matériaux propres)
  _disposeMesh(root, ownMaterials = false) {
    this.scene.remove(root);
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isSkinnedMesh) o.skeleton.dispose();
      if (ownMaterials && o.material && o.material.dispose) o.material.dispose();
    });
  }

  _spawnCamps() {
    if (!this.plan || !this.plan.camps) return;
    const diff = settings.get('difficulty');
    const extra = diff === 'nightmare' ? 1 : 0;
    for (const camp of this.plan.camps) {
      const ids = [...camp.pool];
      for (let i = 0; i < extra; i++) ids.push(camp.pool[0]);
      ids.forEach((id, i) => {
        const a = (i / ids.length) * Math.PI * 2 + rand(0, 1);
        const r = ids.length > 1 ? rand(1.5, 4.5) : 0;
        const x = camp.x + Math.cos(a) * r;
        const z = camp.z + Math.sin(a) * r;
        this.spawnEnemy(id, x, z, { tier: this.zone.tier, camp });
      });
    }
  }

  spawnEnemy(id, x, z, opts = {}) {
    const def = enemyById(id);
    if (!def) return null;
    if (this.enemies.length > 90) return null;
    const pos = { x, z };
    this.world.colliders.resolve(pos, 0.5);
    const e = new Enemy(this, def, pos.x, pos.z, { tier: opts.tier || this.zone.tier, ...opts });
    this.enemies.push(e);
    return e;
  }

  spawnClone(bossDef, x, z, tier) {
    const def = cloneDefFromBoss(bossDef);
    const e = new Enemy(this, def, x, z, { tier, clone: true, summoned: true, xpMul: 0 });
    e.state = 'chase';
    e.cloneLife = 16;
    this.enemies.push(e);
    return e;
  }

  spawnAlly(x, z, pw) {
    const a = new Ally(this, x, z, pw);
    this.allies.push(a);
    this.particles.burst({ x, y: a.pos.y + 0.5, z }, 0x8a6aff, 20, 3, 0.4, 0.8, { intensity: 2 });
    return a;
  }

  _chestMesh() {
    const pb = new PropBuilder();
    pb.add(xf(G.box(0.9, 0.5, 0.6), [0, 0.25, 0]), 0x4a2a18, SURF.wood);
    pb.add(xf(G.box(0.94, 0.06, 0.64), [0, 0.1, 0]), 0xa08a40, SURF.gold);
    pb.add(xf(G.box(0.94, 0.06, 0.64), [0, 0.44, 0]), 0xa08a40, SURF.gold);
    pb.add(xf(G.box(0.1, 0.14, 0.06), [0, 0.42, 0.31]), 0xc8a050, SURF.gold);
    const body = pb.build(this.propMaterial);
    const lp = new PropBuilder();
    lp.add(xf(G.cylP(0.3, 0.3, 0.9, 10, 0, Math.PI), [0, 0, 0.3], [0, 0, Math.PI / 2]), 0x4a2a18, SURF.wood);
    lp.add(xf(G.box(0.1, 0.1, 0.06), [0, 0.02, 0.6]), 0xc8a050, SURF.gold);
    const lid = lp.build(this.propMaterial);
    lid.position.set(0, 0.5, -0.3);
    body.add(lid);
    body.userData.lid = lid;
    return body;
  }

  _spawnChests() {
    if (!this.plan || !this.plan.chests) return;
    for (const c of this.plan.chests) {
      if (c.mimic) {
        if (this.profile.chests[c.id]) continue;
        const e = this.spawnEnemy('mimic', c.x, c.z, { tier: this.zone.tier, yaw: c.rot });
        if (e) e.chestId = c.id;
        continue;
      }
      const mesh = this._chestMesh();
      const y = this.world.heightAt(c.x, c.z);
      mesh.position.set(c.x, y, c.z);
      mesh.rotation.y = c.rot;
      const opened = !!this.profile.chests[c.id];
      if (opened) mesh.userData.lid.rotation.x = -1.6;
      this.scene.add(mesh);
      this.world.colliders.addCircle(c.x, c.z, 0.5, y - 1, y + 0.8);
      this.chests.push({ ...c, mesh, opened, y });
    }
  }

  _spawnPage() {
    const p = this.plan && this.plan.page;
    if (!p || this.profile.pages[this.zoneId]) return;
    const g = new THREE.PlaneGeometry(0.5, 0.65);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c0).multiplyScalar(2.5), side: THREE.DoubleSide }));
    m.position.set(p.x, this.world.heightAt(p.x, p.z) + 1.3, p.z);
    this.scene.add(m);
    this.pageMesh = m;
    this.world.lights.push({ x: p.x, y: m.position.y, z: p.z, color: 0xffe0a0, intensity: 12, dist: 8, flicker: 0.2 });
  }

  _spawnNpcs() {
    for (const it of this.world.interactables) {
      if (it.type !== 'npc') continue;
      const def = NPCS[it.id];
      const mat = createCharMaterial();
      const built = buildHumanoid(def.look, mat);
      built.mesh.position.set(it.x, this.world.heightAt(it.x, it.z), it.z);
      built.mesh.rotation.y = it.rot;
      this.scene.add(built.mesh);
      const anim = new Animator(built, { stance: 'none' });
      this.world.colliders.addCircle(it.x, it.z, 0.5);
      this.npcs.push({ id: it.id, mesh: built.mesh, anim, yaw: it.rot, baseYaw: it.rot, x: it.x, z: it.z });
    }
  }

  _spawnPortalFx() {
    const portal = this.world.interactables.find((i) => i.type === 'portal');
    if (!portal) return;
    const m = new THREE.Mesh(new THREE.CircleGeometry(3.6, 40), Mats.portal(0x7a3cff));
    m.position.set(portal.x, this.world.heightAt(portal.x, portal.z - 1.5) + 5, portal.z - 1.5);
    this.scene.add(m);
    this.portalFx = m;
  }

  // ================= Boucle =================
  _loop(now) {
    requestAnimationFrame(this._loop);
    let elapsed = (now - this.last) / 1000;
    const limit = settings.get('powerSave') ? 30 : settings.get('fpsLimit');
    if (limit && elapsed < 1 / limit - 0.002) return;
    if (device.lost) return;
    this.last = now;
    elapsed = Math.min(elapsed, 0.1);
    this.fps = this.fps * 0.95 + (1 / Math.max(0.001, elapsed)) * 0.05;
    const dt = Math.min(elapsed, 0.05);
    try {
      this.update(dt, elapsed);
    } catch (e) {
      console.error(e);
    }
    this.render(elapsed);
    this.input.endFrame();
  }

  slowMo(scale, dur) {
    this.timeScale = scale;
    this.slowT = dur;
  }

  // Temps des Ombres (esquive parfaite) : le monde ralentit, pas le chevalier
  shadowTime(dur) {
    if (!settings.get('slowmo')) return;
    this.witchT = dur;
    this.witchMax = dur;
    audio.setSlowmo && audio.setSlowmo(true);
  }

  update(realDt, elapsed) {
    const input = this.input;
    input.update(realDt);
    // Pause / menus
    const menuOpen = this.menus && this.menus.isOpen();
    if (this.state === 'playing' && !menuOpen) {
      if (input.wasPressed('pause')) return this.menus.openPause();
      if (input.wasPressed('map')) return this.menus.openPause('map');
      if (input.wasPressed('inventory')) return this.menus.openPause('equipment');
      if (input.wasPressed('journal')) return this.menus.openPause('quests');
    }
    if (menuOpen && input.wasPressed('pause')) this.menus.back();
    // Temps
    let dt = realDt;
    if (this.slowT > 0) {
      this.slowT -= realDt;
      dt *= this.timeScale;
      if (this.slowT <= 0) this.timeScale = 1;
    }
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      dt *= 0.05;
    }
    let playerDt = dt;
    if (this.witchT > 0) {
      this.witchT -= realDt;
      playerDt = this.hitStop > 0 ? realDt * 0.05 : realDt;
      dt *= 0.28;
      if (this.witchT <= 0) audio.setSlowmo && audio.setSlowmo(false);
    }
    this.renderer.fx.shadowTime = this.witchT > 0 ? Math.min(1, this.witchT / 0.25, (this.witchMax - this.witchT) / 0.12 + 0.2) : 0;
    const paused = this.state !== 'playing' || menuOpen;
    if (this.state === 'title') {
      this._titleUpdate(realDt);
      return;
    }
    if (paused) {
      input.consumeLook();
      updateMaterials(realDt * 0.2);
      return;
    }
    this.time += dt;
    this.profile.stats.playTime += realDt;
    // Caméra (souris / stick droit / tactile)
    const look = input.consumeLook();
    this.camRig.applyLook(look, realDt);
    if (this.camRig.mode === 'first') this.viewModel.addSway(look.x, look.y);
    // Entités
    this._perfGuard(realDt);
    this._updateActiveSet(realDt);
    this.player.update(playerDt, input);
    for (const e of this.enemies) e.update(dt);
    for (const a of this.allies) a.update(dt);
    this._cleanup();
    this.combat.update(dt);
    this.powers.update(dt);
    this._updateArenas(dt);
    this._updateInteractions(dt);
    this._updateNpcs(dt);
    // Monde et effets
    this.effects.update(dt);
    const pxScale = this.renderer.size ? this.renderer.size.h * 0.5 / Math.tan((this.camera.fov * Math.PI) / 360) : 300;
    this.particles.update(dt, pxScale);
    this.particlesAlpha.update(dt, pxScale);
    this.camRig.update(realDt, this.player, this.player.lockTarget);
    this.world.update(dt, this.camera.position, this.particles, this.particlesAlpha, this.player.pos);
    this.sky.update(dt, this.camera.position);
    if (this.ambient) this.ambient.update(dt, this.camera.position, pxScale);
    updateMaterials(dt);
    this._updateShadowCam();
    if (this.pageMesh) {
      this.pageMesh.rotation.y += dt * 1.5;
      this.pageMesh.position.y += Math.sin(this.time * 2) * 0.003;
      if (Math.random() < 0.3) this.particles.spawn(this.pageMesh.position.x, this.pageMesh.position.y, this.pageMesh.position.z, rand(-0.3, 0.3), rand(0.2, 0.8), rand(-0.3, 0.3), 1, 0.15, 0xffe0a0, { intensity: 2 });
    }
    // Audio
    audio.setListener(this.camera.position.x, this.camera.position.z, this.camRig.yaw);
    const inCombat = this.enemies.some((e) => e.alive && !e.isBoss && (e.state === 'chase' || e.state === 'attack') && e.distTo(this.player) < 25);
    audio.setIntensity(this.activeBoss ? 2 : inCombat ? 1 : 0);
    // Vie basse
    const ratio = this.player.hp / this.player.maxHp;
    this.renderer.fx.lowHp = this.player.alive && ratio < 0.3 ? (0.3 - ratio) / 0.3 : 0;
    if (this.renderer.fx.lowHp > 0.2) {
      this.heartT = (this.heartT || 0) - realDt;
      if (this.heartT <= 0) {
        this.heartT = 0.9;
        audio.play('heartbeat');
      }
    }
    // Sauvegarde automatique
    const autoMin = settings.get('autosave');
    this.autosaveT += realDt;
    if ((autoMin && this.autosaveT > autoMin * 60) || this.pendingSave) {
      if (!inCombat && !this.activeBoss && this.player.alive) {
        this.autosave();
      }
    }
    this.hud.update(realDt);
  }

  _titleUpdate(dt) {
    this.time += dt;
    const t = this.time * 0.08;
    const c = this.titleCenter || { x: 0, z: 6 };
    this.camera.position.set(c.x + Math.sin(t) * 7, this.world.heightAt(c.x, c.z) + 2.6 + Math.sin(t * 0.7) * 0.4, c.z + Math.cos(t) * 7);
    this.camera.lookAt(c.x, this.world.heightAt(c.x, c.z) + 1.4, c.z);
    this.player.anim.update(dt, { speed: 0, grounded: true });
    this.player.updateVisual(dt);
    this._updateNpcs(dt);
    this.effects.update(dt);
    const pxScale = this.renderer.size ? this.renderer.size.h * 0.5 / Math.tan((this.camera.fov * Math.PI) / 360) : 300;
    this.particles.update(dt, pxScale);
    this.particlesAlpha.update(dt, pxScale);
    this.world.update(dt, this.camera.position, this.particles, this.particlesAlpha, this.camera.position);
    this.sky.update(dt, this.camera.position);
    if (this.ambient) this.ambient.update(dt, this.camera.position, pxScale);
    updateMaterials(dt);
    this._updateShadowCam(c);
  }

  _updateShadowCam(center) {
    const p = center || this.player.pos;
    const ext = this.shadowExt || 25;
    // Aligne sur la grille des texels pour éviter le scintillement
    const step = (ext * 2) / this.moon.shadow.mapSize.x;
    const cx = Math.round(p.x / step) * step;
    const cz = Math.round(p.z / step) * step;
    const y = this.world.heightAt(cx, cz);
    this.moon.position.set(cx + 30, y + 60, cz + 25);
    this.moon.target.position.set(cx, y, cz);
    this.rim.position.set(cx - 20, y + 15, cz - 30);
    this.rim.target.position.set(cx, y, cz);
  }

  render(dt) {
    const fp = this.camRig.mode === 'first' && this.state === 'playing' && this.player.alive;
    this.renderer.overlay = fp ? { scene: this.viewModel.scene, camera: this.viewModel.camera } : null;
    this.renderer.updateFx();
    this.renderer.render(this.scene, this.camera, dt);
  }

  _cleanup() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.cloneLife !== undefined && e.alive) {
        e.cloneLife -= 1 / 60;
        if (e.cloneLife <= 0 || !this.activeBoss) e.die(true);
      }
      if (e.remove) {
        e.removeModel();
        this.enemies.splice(i, 1);
      }
    }
    for (let i = this.allies.length - 1; i >= 0; i--) {
      if (this.allies[i].remove) {
        this.allies[i].removeModel();
        this.allies.splice(i, 1);
      }
    }
  }

  // ================= Aides au combat =================
  nearestEnemy(pos, range, yaw = null, arc = null, exclude = null) {
    let best = null;
    let bd = range;
    for (const e of this.enemies) {
      if (!e.alive || e === exclude || e.untargetable) continue;
      if (e.state === 'dormant' && e.def.rig === 'mimic') continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d > bd) continue;
      if (yaw !== null && arc !== null) {
        const a = Math.atan2(e.pos.x - pos.x, e.pos.z - pos.z);
        let diff = Math.abs(((a - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff > arc) continue;
      }
      best = e;
      bd = d;
    }
    return best;
  }

  findLockTarget() {
    const yaw = this.camRig.yaw;
    let best = null;
    let score = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.untargetable || (e.state === 'dormant' && e.def.rig === 'mimic')) continue;
      const d = e.distTo(this.player);
      if (d > 26) continue;
      const a = Math.atan2(e.pos.x - this.player.pos.x, e.pos.z - this.player.pos.z);
      const diff = Math.abs(((a - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > 1.3) continue;
      const s = d + diff * 12 - (e.isBoss ? 20 : 0);
      if (s < score) {
        score = s;
        best = e;
      }
    }
    return best;
  }

  maxTokens() {
    return { squire: 1, knight: 2, paladin: 3, nightmare: 4 }[settings.get('difficulty')] || 2;
  }

  requestToken(e, peek = false) {
    if (e.hasToken) return true;
    for (const t of this.tokens) if (!t.alive || t.state !== 'attack') {
      this.tokens.delete(t);
      t.hasToken = false;
    }
    if (this.tokens.size >= this.maxTokens()) return false;
    if (peek) return true;
    this.tokens.add(e);
    e.hasToken = true;
    return true;
  }

  releaseToken(e) {
    this.tokens.delete(e);
    e.hasToken = false;
  }

  alertNearby(src) {
    for (const e of this.enemies) {
      if (e === src || !e.alive || e.isBoss) continue;
      if ((e.state === 'idle' || e.state === 'dormant') && e.def.ai !== 'ambusher' && e.distTo(src) < 12) e._setState('alert');
    }
  }

  // ================= Événements =================
  onEnemyKilled(e) {
    const p = this.profile;
    const player = this.player;
    if (e.clone) return;
    p.stats.kills++;
    if (!e.opts.summoned || e.isBoss) {
      player.addXp(e.xp);
      this.addShards(e.shards * player.stats.shardMul * rand(0.8, 1.2));
    } else player.addXp(e.xp * 0.3);
    this.effects.souls({ x: e.pos.x, y: e.pos.y + 0.5, z: e.pos.z }, e.isBoss ? 60 : 10);
    player.onKill(e);
    if (player.lockTarget === e) player.lockTarget = this.findLockTarget();
    // Bestiaire
    const id = e.isBoss ? e.bossDef.id : e.def.id;
    const first = !p.bestiary[id];
    p.bestiary[id] = (p.bestiary[id] || 0) + 1;
    if (first && !e.def.hidden) {
      this.hud.notify('Bestiaire', (e.isBoss ? e.bossDef.name : e.def.name) + ' ajouté au bestiaire', 'item');
      this.quests.event('bestiary', { value: Object.keys(p.bestiary).length });
    }
    if (e.chestId) {
      p.chests[e.chestId] = true;
      this.addShards(300 * this.zone.tier);
    }
    // Effets à la mort
    if (e.def.deathCloud) this.combat.hazard({ x: e.pos.x, z: e.pos.z, radius: e.def.deathCloud.radius, duration: 5, dps: e.dmg * 0.25, element: 'poison', team: 'enemy', source: e, status: { poison: e.def.deathCloud.poison } });
    if (e.def.splits && !e.opts.summoned) {
      for (let i = 0; i < 2; i++) {
        const s = this.spawnEnemy(e.def.splits, e.pos.x + rand(-1, 1), e.pos.z + rand(-1, 1), { tier: e.tier, summoned: true, xpMul: 0.5 });
        if (s) s.state = 'chase';
      }
    }
    if (e.isBoss) this._bossDefeated(e);
    else this.quests.event('kill', { id: e.def.id });
  }

  addShards(n, show = true) {
    n = Math.round(n);
    this.profile.shards += n;
    if (show && this.hud) this.hud.shardGain(n);
    if (show) audio.play('shards');
  }

  onLevelUp() {
    audio.play('levelUp');
    this.hud.levelUp(this.profile.level);
    this.effects.souls({ x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z }, 40);
    this.effects.ring(this.player.pos, 0xffe89a, 4, 0.8, 0.3);
    this.quests.event('level', { value: this.profile.level });
  }

  onPlayerDeath() {
    this.profile.stats.deaths++;
    audio.setIntensity(0);
    setTimeout(() => this.menus.showDeath(), 1800);
  }

  async respawn() {
    const p = this.profile;
    const la = p.lastAltar || { zone: 'hub', id: 'hub' };
    this.player.fullRestore();
    this.player.rebuild();
    const zone = ZONES[la.zone];
    const altar = (zone.altars || []).find((a) => a.id === la.id) || zone.entry;
    const spawn = { x: altar.x + 2, z: altar.z + 2.5, yaw: Math.PI };
    await this.loadZone(la.zone, spawn);
    this.state = 'playing';
  }

  requestAutosave() {
    this.pendingSave = true;
  }

  autosave() {
    this.pendingSave = false;
    this.autosaveT = 0;
    this._snapshot();
    saveProfile('auto', this.profile);
    if (this.slot && this.slot !== 'auto') saveProfile(this.slot, this.profile);
    this.hud.saving();
  }

  saveTo(slot) {
    this._snapshot();
    saveProfile(slot, this.profile);
    this.slot = slot;
  }

  _snapshot() {
    this.profile.pos = { x: this.player.pos.x, z: this.player.pos.z };
    this.profile.yaw = this.player.yaw;
    this.profile.zone = this.zoneId;
    this.profile.difficulty = settings.get('difficulty');
  }

  // ================= Démarrage d'une partie =================
  async newGame(slot, difficulty) {
    this.profile = newProfile(difficulty);
    settings.set('difficulty', difficulty);
    initialQuests(this.profile);
    this.slot = slot;
    this.player.hp = 0;
    this.player.fullRestore();
    this.player.mesh && this.player.removeModel();
    this.player.mesh = null;
    await this.loadZone('hub');
    this.player.rebuild();
    this.player.fullRestore();
    this.state = 'playing';
    this.hud.refreshAll();
    saveProfile(slot, this.profile);
    this.menus.showIntro();
  }

  async continueGame(profile, slot) {
    this.profile = profile;
    if (profile.difficulty) settings.set('difficulty', profile.difficulty, true);
    initialQuests(profile);
    this.slot = slot;
    this.player.mesh && this.player.removeModel();
    this.player.mesh = null;
    const spawn = profile.pos ? { x: profile.pos.x, z: profile.pos.z, yaw: profile.yaw } : null;
    await this.loadZone(profile.zone || 'hub', spawn);
    this.player.rebuild();
    this.player.fullRestore();
    this.state = 'playing';
    this.hud.refreshAll();
  }

  async showTitle() {
    this.state = 'title';
    await this.loadZone('hub');
    this.state = 'title';
    // Chevalier agenouillé devant le feu
    const p = this.player;
    const look = this.profile;
    look.outfit = 'order_knight';
    look.weapon = 'knight_sword';
    look.weapons.knight_sword = 0;
    look.shield = 'knight_shield';
    p.rebuild();
    p.spawn(0, 8.8, Math.PI);
    p.anim.play('kneel', 1);
    p.anim.action.t = 1.4;
    this.titleCenter = { x: 0, z: 7.5 };
    this.hud.setVisible(false);
  }

  // ================= Arènes de boss =================
  _updateArenas(dt) {
    const p = this.player;
    if (!this.world.interactables) return;
    for (const ar of this.world.interactables) {
      if (ar.type !== 'arena') continue;
      if (this.profile.bosses[ar.boss]) continue;
      const d = Math.hypot(p.pos.x - ar.x, p.pos.z - ar.z);
      let boss = this.bosses.find((b) => b.bossDef.id === ar.boss && b.alive);
      if (!boss && d < ar.r + 30) {
        const def = bossById(ar.boss);
        if (def) {
          boss = new Boss(this, def, ar);
          this.enemies.push(boss);
          this.bosses.push(boss);
        }
      }
      if (boss && !this.activeBoss && d < ar.r - 1.5 && p.alive) this._startBossFight(boss, ar);
    }
    if (this.activeBoss) {
      const ar = this.activeArena;
      // Le joueur reste dans l'arène
      const dx = p.pos.x - ar.x;
      const dz = p.pos.z - ar.z;
      const d = Math.hypot(dx, dz);
      if (d > ar.r) {
        p.pos.x = ar.x + (dx / d) * ar.r;
        p.pos.z = ar.z + (dz / d) * ar.r;
      }
      if (!p.alive) this._endBossFight(false);
    }
  }

  _startBossFight(boss, ar) {
    this.activeBoss = boss;
    this.activeArena = ar;
    boss.engage();
    // Mur de brume
    const geo = new THREE.CylinderGeometry(ar.r + 0.3, ar.r + 0.3, 7, 64, 1, true);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
    const wall = new THREE.Mesh(geo, Mats.fogWall());
    wall.position.set(ar.x, this.world.heightAt(ar.x, ar.z) + 3, ar.z);
    wall.renderOrder = 7;
    this.scene.add(wall);
    this.fogWall = wall;
    audio.play('fogwall', { pos: this.player.pos });
    this.hud.bossStart(boss.bossDef, boss);
    // Plan de présentation
    const f = { x: Math.sin(boss.yaw), z: Math.cos(boss.yaw) };
    const hy = boss.pos.y + boss.height * 0.6;
    this.camRig.setCinematic({
      t: 0, dur: 2.2, hold: 0.3,
      from: new THREE.Vector3(boss.pos.x + f.x * (4 + boss.scale * 2) + 3, hy + 1, boss.pos.z + f.z * (4 + boss.scale * 2) + 2),
      to: new THREE.Vector3(boss.pos.x + f.x * (6 + boss.scale * 2.5) - 2, hy + 0.5, boss.pos.z + f.z * (6 + boss.scale * 2.5)),
      look: new THREE.Vector3(boss.pos.x, hy, boss.pos.z),
    });
    this.player.lockTarget = boss;
  }

  _endBossFight(victory) {
    if (this.fogWall) {
      this.scene.remove(this.fogWall);
      this.fogWall.geometry.dispose();
      this.fogWall = null;
    }
    if (this.activeBoss && !victory) {
      // Réinitialise le boss (il reviendra entier)
      const b = this.activeBoss;
      b.alive = false;
      b.remove = true;
    }
    this.activeBoss = null;
    this.activeArena = null;
    if (this.hud) this.hud.bossEnd();
    this.camRig.setCinematic(null);
  }

  _bossDefeated(b) {
    const def = b.bossDef;
    const p = this.profile;
    p.bosses[def.id] = true;
    p.stats.bossKills++;
    p.skillPoints++;
    this.slowMo(0.25, 1.2);
    this.camRig.shake(0.8);
    audio.play('victory');
    this.effects.ring(b.pos, 0xffe89a, 14, 1.2, 0.5);
    this.effects.flash(b.pos, 0xffe89a, 80, 30, 1);
    for (const e of this.enemies) if (e.alive && (e.opts.summoned || e.clone)) e.die(true);
    const rewards = [];
    const r = def.rewards;
    if (r.weapon && p.weapons[r.weapon] === undefined) {
      p.weapons[r.weapon] = 0;
      rewards.push(WEAPONS.find((w) => w.id === r.weapon).name);
    }
    if (r.outfit && !p.outfits.includes(r.outfit)) {
      p.outfits.push(r.outfit);
      rewards.push(OUTFITS.find((o) => o.id === r.outfit).name);
    }
    if (r.shield && !p.shields.includes(r.shield)) {
      p.shields.push(r.shield);
      rewards.push(SHIELDS.find((s) => s.id === r.shield).name);
    }
    if (r.power && !p.powers.includes(r.power)) {
      p.powers.push(r.power);
      rewards.push(powerById(r.power).name);
      const empty = p.powerSlots.indexOf(null);
      if (empty >= 0) p.powerSlots[empty] = r.power;
    }
    rewards.push('1 point de compétence');
    if (r.unlock && !p.zonesUnlocked.includes(r.unlock)) {
      p.zonesUnlocked.push(r.unlock);
      setTimeout(() => this.hud.notify('Nouvelle région', ZONES[r.unlock].name + ' est accessible par le Portail des Âmes', 'main'), 5000);
    }
    setTimeout(() => {
      this._endBossFight(true);
      this.hud.bigBanner('ENNEMI TERRASSÉ', def.name, 'victory');
      this.hud.notify('Récompenses', rewards.join(' · '), 'item');
    }, 1400);
    this.quests.event('boss', { id: def.id });
    this.requestAutosave();
    if (r.ending) {
      p.ending = true;
      setTimeout(() => this.menus.showEnding(), 7000);
    }
  }

  // ================= Interactions =================
  _updateInteractions(dt) {
    const p = this.player;
    let best = null;
    let bd = Infinity;
    const cands = [];
    for (const it of this.world.interactables) {
      if (it.type === 'arena') continue;
      const d = Math.hypot(p.pos.x - it.x, p.pos.z - it.z);
      // Exploration automatique des points d'intérêt
      if (it.type === 'poi' && d < 7 && !this.profile.pois[it.id] && this._poiIsExplore(it.id)) this._discoverPoi(it);
      if (d < (it.r || 3) && d < bd) {
        if (it.type === 'poi' && (this.profile.pois[it.id] || !this._poiIsActivate(it.id))) continue;
        best = it;
        bd = d;
      }
    }
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
      if (d < 2.2 && d < bd) {
        best = { type: 'chest', chest: c };
        bd = d;
      }
    }
    // Page du grimoire : ramassage automatique
    if (this.pageMesh && this.plan.page && Math.hypot(p.pos.x - this.plan.page.x, p.pos.z - this.plan.page.z) < 1.8) this._pickPage();
    this.interactTarget = best;
    this.hud.prompt(best ? promptFor(best, this) : null);
    if (best && this.input.wasPressed('interact') && p.state === 'move' && p.alive && !this.activeBoss) this._interact(best);
  }

  _poiIsExplore(id) {
    return this.quests.active().some((q) => q.objectives.some((o) => o.type === 'explore' && o.target.includes(id)));
  }
  _poiIsActivate(id) {
    return this.quests.active().some((q) => q.objectives.some((o) => o.type === 'activate' && o.target.includes(id)));
  }

  _discoverPoi(it) {
    this.profile.pois[it.id] = true;
    this.hud.notify('Lieu découvert', it.name, 'side');
    audio.play('quest');
    this.quests.event('explore', { id: it.id });
  }

  _pickPage() {
    this.profile.pages[this.zoneId] = true;
    this.scene.remove(this.pageMesh);
    this.pageMesh = null;
    audio.play('pickup');
    this.effects.souls({ x: this.plan.page.x, y: this.world.heightAt(this.plan.page.x, this.plan.page.z), z: this.plan.page.z }, 16);
    const n = Object.keys(this.profile.pages).length;
    this.hud.notify('Page du grimoire', `${n} / 8 pages retrouvées`, 'item');
    this.quests.event('collect', { item: 'page', value: n });
  }

  _interact(it) {
    const p = this.profile;
    switch (it.type) {
      case 'altar':
        if (!p.altars.includes(it.id)) {
          p.altars.push(it.id);
          this.hud.notify('Feu allumé', it.name, 'side');
        }
        p.lastAltar = { zone: this.zoneId, id: it.id };
        this.quests.event('altar', { id: it.id });
        audio.play('altar');
        this.effects.souls({ x: it.x, y: it.y + 1, z: it.z }, 30);
        this.restAtAltar();
        this.menus.openAltar(it);
        break;
      case 'portal':
        audio.play('portal');
        this.menus.openPortal();
        break;
      case 'npc':
        this.quests.event('talk', { id: it.id });
        this.menus.openDialog(it.id);
        break;
      case 'poi':
        p.pois[it.id] = true;
        audio.play('altar');
        this.effects.souls({ x: it.x, y: it.y, z: it.z }, 30);
        this.effects.ring({ x: it.x, z: it.z }, 0xffe89a, 6, 0.8, 0.3);
        this.hud.notify('Accompli', it.name, 'side');
        this.quests.event('activate', { id: it.id });
        break;
      case 'chest':
        this._openChest(it.chest);
        break;
      default:
    }
  }

  restAtAltar() {
    const pl = this.player;
    pl.fullRestore();
    // Les ennemis reviennent (sauf les boss vaincus)
    for (const e of this.enemies) if (!e.isBoss) e.removeModel();
    this.enemies = this.enemies.filter((e) => e.isBoss);
    this.tokens.clear();
    this._spawnCamps();
    this._spawnChests();
    this.hud.refreshAll();
    this._snapshot();
    this.autosave();
  }

  _openChest(c) {
    c.opened = true;
    this.profile.chests[c.id] = true;
    audio.play('chest', { pos: c.mesh.position });
    const lid = c.mesh.userData.lid;
    const t0 = performance.now();
    const anim = () => {
      const k = Math.min(1, (performance.now() - t0) / 500);
      lid.rotation.x = -1.6 * k;
      if (k < 1) requestAnimationFrame(anim);
    };
    anim();
    const tier = this.zone.tier;
    const shards = Math.round((80 + Math.random() * 120) * Math.pow(1.5, tier - 1));
    this.addShards(shards);
    this.effects.souls({ x: c.x, y: c.y + 0.5, z: c.z }, 20);
    const rng = makeRng(hashString(c.id));
    // Chance d'y trouver une arme ou un bouclier
    const pool = [...WEAPONS.filter((w) => w.price > 0 && w.price <= 1800 * tier && this.profile.weapons[w.id] === undefined), ...SHIELDS.filter((s) => s.price > 0 && s.price <= 1800 * tier && !this.profile.shields.includes(s.id))];
    if (pool.length && rng() < 0.4) {
      const item = pool[Math.floor(rng() * pool.length)];
      if (WEAPONS.includes(item)) this.profile.weapons[item.id] = 0;
      else this.profile.shields.push(item.id);
      this.hud.notify('Trésor', item.name + ' · ' + shards + ' éclats', 'item');
    } else this.hud.notify('Trésor', shards + ' éclats d’âme', 'item');
    this.requestAutosave();
  }

  _updateNpcs(dt) {
    const p = this.player;
    for (const n of this.npcs) {
      const d = Math.hypot(p.pos.x - n.x, p.pos.z - n.z);
      const want = d < 6 && this.state === 'playing' ? Math.atan2(p.pos.x - n.x, p.pos.z - n.z) : n.baseYaw;
      n.yaw += ((((want - n.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-3 * dt)));
      n.mesh.rotation.y = n.yaw;
      n.anim.update(dt, { speed: 0, grounded: true });
    }
  }

  // Voyage rapide (autels découverts / portail)
  async travel(zoneId, altarId = null) {
    const zone = ZONES[zoneId];
    let spawn = null;
    if (altarId) {
      const a = zone.altars.find((x) => x.id === altarId);
      if (a) spawn = { x: a.x + 2, z: a.z + 2.5, yaw: Math.PI };
    }
    audio.play('portal');
    this.renderer.fx.flash = 1;
    this.renderer.fx.flashColor.setHex(0x9a4dff);
    this.player.fullRestore();
    await this.loadZone(zoneId, spawn);
    if (altarId) this.profile.lastAltar = { zone: zoneId, id: altarId };
    else if (zone.altars && zone.altars[0]) {
      if (!this.profile.altars.includes(zone.altars[0].id)) this.profile.altars.push(zone.altars[0].id);
    }
    this.state = 'playing';
    this.requestAutosave();
  }

  // Changement d'équipement
  equip() {
    this.player.rebuild();
    this.hud.refreshAll();
  }
}

function promptFor(it, game) {
  switch (it.type) {
    case 'altar':
      return 'Se reposer au feu — ' + it.name;
    case 'portal':
      return 'Voyager — Portail des Âmes';
    case 'npc':
      return 'Parler à ' + NPCS[it.id].name;
    case 'poi': {
      const zone = game.zoneId;
      const verb = zone === 'swamp' ? 'Purifier' : zone === 'catacombs' ? 'Briser' : zone === 'inferno' ? 'Profaner' : zone === 'void' ? 'Prendre' : 'Activer';
      return verb + ' — ' + it.name;
    }
    case 'chest':
      return 'Ouvrir le coffre';
    default:
      return null;
  }
}
