import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input } from './engine/input.js';
import { AudioSys } from './engine/audio.js';
import { storage } from './engine/utils.js';
import { City } from './world/city.js';
import { Environment } from './world/sky.js';
import { Traffic } from './world/traffic.js';
import { Player } from './player/player.js';
import { Combat } from './player/combat.js';
import { EnemyManager } from './npc/enemies.js';
import { Particles } from './fx/particles.js';
import { WebLines } from './fx/web.js';
import { Projectiles } from './fx/projectiles.js';
import { Markers } from './fx/markers.js';
import { MissionManager, STORY } from './missions/missions.js';
import { HUD } from './ui/hud.js';
import { CameraRig } from './camera.js';

const SAVE_KEY = 'spiderman-monde-ouvert-v1';
const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

const QUALITY = {
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, bloom: true, fogFar: 1500, cars: 3, peds: 260, antialias: true },
  medium: { pixelRatio: 1.5, shadows: true, shadowSize: 1024, bloom: false, fogFar: 1200, cars: 2, peds: 160, antialias: true },
  low: { pixelRatio: 1, shadows: false, shadowSize: 512, bloom: false, fogFar: 850, cars: 1, peds: 70, antialias: false },
};

function defaultSave() {
  return { xp: 0, level: 1, completed: [], bags: [], races: {}, crimes: 0, settings: { quality: 'auto', sens: 1, music: true, daynight: true } };
}

export class Game {
  constructor() {
    this.save = { ...defaultSave(), ...storage.get(SAVE_KEY, {}) };
    this.save.settings = { ...defaultSave().settings, ...(this.save.settings || {}) };
    const qs = new URLSearchParams(location.search);
    let q = qs.get('q') || this.save.settings.quality;
    if (q === 'auto') {
      const touch = matchMedia('(pointer: coarse)').matches;
      q = touch ? 'low' : (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium';
    }
    this.qualityKey = q;
    this.quality = { ...(QUALITY[q] || QUALITY.medium) };
    if (qs.has('pr')) this.quality.pixelRatio = parseFloat(qs.get('pr'));
    this.mode = 'loading';
    this.paused = false;
    this.time = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.slowScale = 1;
    this.hitstopT = 0;
    this.senseT = 0;
    this.boss = null;
    this.carTarget = null;
    this.drone = null;
    this.godMode = qs.has('god');
    this.nearbyEntry = null;
  }

  async init() {
    const qs = new URLSearchParams(location.search);
    const setLoad = async (pct, text) => {
      $('load-fill').style.width = `${pct}%`;
      if (text) $('load-text').textContent = text;
      await nextFrame();
    };
    await setLoad(5, 'Préparation du rendu…');
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) throw new Error('WebGL 2 n’est pas disponible sur cet appareil ou ce navigateur. Essaie avec Chrome, Edge, Firefox ou Safari à jour.');
    const canvas = $('game');
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.showError(new Error('Le téléphone a manqué de mémoire graphique. Recharge la page et choisis « Graphismes : Bas ».'));
    });
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(qs.has('pr') ? this.quality.pixelRatio : Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = this.quality.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 4000);
    this.input = new Input(canvas);
    this.input.sensitivity = this.save.settings.sens;
    this.audio = new AudioSys();
    this.audio.musicOn = this.save.settings.music;

    await setLoad(12, 'Tissage de la ville…');
    this.city = new City(this.scene, this.quality);
    this.city.generate();
    await setLoad(45, 'Allumage du ciel…');
    this.env = new Environment(this.scene, renderer, this.quality);
    this.env.cycle = this.save.settings.daynight;
    await setLoad(55, 'Mise en circulation…');
    this.traffic = new Traffic(this.scene, this.city, this.quality);
    await setLoad(65, 'Enfilage du costume…');
    this.fx = new Particles(this.scene);
    this.webs = new WebLines(this.scene);
    this.markers = new Markers(this.scene);
    this.hud = new HUD(this);
    this.cam = new CameraRig(this.camera, this);
    this.player = new Player(this);
    this.combat = new Combat(this);
    this.enemies = new EnemyManager(this);
    this.projectiles = new Projectiles(this);
    this.missions = new MissionManager(this);
    this.missions.init();
    this.hud.buildMap();
    this._applyLevel();
    await setLoad(80, 'Compilation des shaders…');

    if (this.quality.bloom) {
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.45, 0.88);
      composer.addPass(this.bloom);
      composer.addPass(new OutputPass());
      this.composer = composer;
    }
    this.fx.setScale(window.innerHeight);
    this.env.update(0, this.player.pos);
    this.player.animate(0);
    this.cam.snapBehind();
    this.cam.update(0, this.input);
    try {
      renderer.compile(this.scene, this.camera);
    } catch {
      /* compilation paresseuse si indisponible */
    }
    await setLoad(100, 'Prêt !');

    this.fixedPR = qs.has('pr');
    this.basePR = renderer.getPixelRatio();
    if (qs.has('fps')) {
      this.fpsEl = $('fps');
      this.fpsEl.classList.remove('hidden');
    }
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this._bindUI();
    $('loading').classList.add('hidden');
    this.showTitle();
    this._last = performance.now();
    renderer.setAnimationLoop(() => this.frame());
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
    if (this.fx) this.fx.setScale(h * this.renderer.getPixelRatio());
  }

  // ---------- Interface ----------
  _bindUI() {
    const click = (id, fn) =>
      $(id).addEventListener('click', (e) => {
        e.preventDefault();
        try {
          fn();
        } catch (err) {
          this.showError(err);
        }
        this.audio.init();
        this.audio.play('ui');
      });
    click('btn-play', () => this.startPlay());
    click('btn-new', () => {
      if (confirm('Effacer la progression et recommencer ?')) {
        const settings = this.save.settings;
        storage.set(SAVE_KEY, { ...defaultSave(), settings });
        location.reload();
      }
    });
    click('btn-controls', () => this._showControls('title-screen'));
    click('btn-controls2', () => this._showControls('pause-screen'));
    click('btn-controls-back', () => {
      $('controls-screen').classList.add('hidden');
      $(this._controlsBack).classList.remove('hidden');
    });
    click('btn-resume', () => this.setPaused(false));
    click('btn-abandon', () => {
      this.missions.abandon();
      this.setPaused(false);
    });
    click('btn-quit', () => {
      this.setPaused(false, true);
      this.missions.abandon();
      this.showTitle();
    });
    click('btn-music', () => {
      const on = this.audio.toggleMusic();
      this.save.settings.music = on;
      $('btn-music').textContent = on ? 'OUI' : 'NON';
      this.saveGame();
    });
    click('btn-daynight', () => {
      this.env.cycle = !this.env.cycle;
      this.save.settings.daynight = this.env.cycle;
      $('btn-daynight').textContent = this.env.cycle ? 'OUI' : 'NON';
      this.saveGame();
    });
    $('btn-music').textContent = this.save.settings.music ? 'OUI' : 'NON';
    $('btn-daynight').textContent = this.save.settings.daynight ? 'OUI' : 'NON';
    $('opt-sens').value = this.save.settings.sens;
    $('opt-sens').addEventListener('input', (e) => {
      this.input.sensitivity = parseFloat(e.target.value);
      this.save.settings.sens = this.input.sensitivity;
      this.saveGame();
    });
    const qsel = $('opt-quality');
    qsel.value = this.save.settings.quality;
    qsel.addEventListener('change', () => {
      this.save.settings.quality = qsel.value;
      this.saveGame();
      location.reload();
    });
    click('btn-result-ok', () => this._closeResult());
    click('btn-retry', () => {
      this._closeResult();
      this.player.health = this.player.maxHealth;
      this.missions.retry();
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.mode === 'play' && !this.paused && !this.input.isTouch && !this._resultOpen && !this._mapOpen) {
        this.setPaused(true);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'play' && !this.paused) this.setPaused(true);
    });
  }

  _showControls(back) {
    this._controlsBack = back;
    $(back).classList.add('hidden');
    $('controls-screen').classList.remove('hidden');
  }

  showTitle() {
    this.mode = 'title';
    this.hud.show(false);
    $('title-screen').classList.remove('hidden');
    $('touch-ui').classList.add('off');
    $('btn-play').textContent = this.save.completed.length || this.save.xp ? 'CONTINUER' : 'JOUER';
    this.input.exitPointerLock();
  }

  startPlay() {
    this.audio.init();
    $('title-screen').classList.add('hidden');
    $('touch-ui').classList.remove('off');
    this.hud.show(true);
    this.mode = 'play';
    this.input.reset();
    this.input.consumeLook();
    this.cam.snapBehind();
    try {
      if (!this.input.isTouch) {
        const p = this.renderer.domElement.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      }
    } catch {
      /* ignore */
    }
    if (!this._welcomed) {
      this._welcomed = true;
      const next = this.missions.nextStory;
      if (next && next.id === 'tuto') {
        this.hud.hint('Bienvenue à New York ! Suis le faisceau jaune pour ta première mission. Maintiens MAJ en l’air pour te balancer.', 9);
      } else this.hud.toast('De retour en ville !');
      if (this.input.isTouch && window.innerHeight > window.innerWidth) {
        setTimeout(() => this.hud.toast('Astuce : tourne ton téléphone en paysage pour mieux jouer'), 1500);
      }
    }
  }

  setPaused(p, silent = false) {
    this.paused = p;
    this.input.reset();
    $('pause-screen').classList.toggle('hidden', !p || silent);
    $('btn-abandon').classList.toggle('hidden', !this.missions.active);
    if (p) {
      this.input.exitPointerLock();
      const s = this.save;
      $('pause-stats').innerHTML = `Niveau ${s.level} · Missions ${s.completed.length}/${STORY.length} · Sacs à dos ${s.bags.length}/${this.missions.totalBags} · Crimes arrêtés ${s.crimes || 0}<br>Meilleur combo : ${this.combat.bestCombo}`;
      this.audio.setWind(0);
    } else if (this.mode === 'play' && !this.input.isTouch && !silent) {
      try {
        const r = this.renderer.domElement.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }

  showResult({ kicker, title, text, retry }) {
    this._resultOpen = true;
    this.paused = true;
    $('result-kicker').textContent = kicker;
    $('result-title').textContent = title;
    $('result-text').innerHTML = text;
    $('btn-retry').classList.toggle('hidden', !retry);
    $('result-screen').classList.remove('hidden');
    this.input.exitPointerLock();
    this.input.reset();
  }

  _closeResult() {
    this._resultOpen = false;
    $('result-screen').classList.add('hidden');
    this.setPaused(false);
  }

  toggleMap() {
    this._mapOpen = !this._mapOpen;
    $('map-screen').classList.toggle('hidden', !this._mapOpen);
    if (this._mapOpen) this.hud.drawBigMap();
  }

  // ---------- Progression ----------
  xpForNext() {
    return 400 + this.save.level * 250;
  }

  gainXP(n, label) {
    const s = this.save;
    s.xp += n;
    if (label) this.hud.xpGain(n, label);
    while (s.xp >= this.xpForNext()) {
      s.xp -= this.xpForNext();
      s.level++;
      this._applyLevel();
      this.player.health = this.player.maxHealth;
      this.hud.levelUp(s.level);
      this.audio.play('level');
    }
    this.saveGame();
  }

  _applyLevel() {
    const l = this.save.level;
    this.player.maxHealth = 100 + (l - 1) * 12;
    this.player.health = Math.min(this.player.health, this.player.maxHealth);
    this.combat.dmgMul = 1 + (l - 1) * 0.06;
    this.enemies.difficulty = 1 + Math.min(0.6, this.save.completed.length * 0.08);
  }

  saveGame() {
    storage.set(SAVE_KEY, this.save);
  }

  // ---------- Événements ----------
  targets() {
    const out = [];
    for (const e of this.enemies.enemies) if (e.alive) out.push(e);
    if (this.boss && this.boss.alive) out.push(this.boss);
    if (this.carTarget && this.carTarget.targetable) out.push(this.carTarget);
    return out;
  }

  onEnemyDefeated(e) {
    this.gainXP(e.type.xp);
    this.enemies.difficulty = 1 + Math.min(0.6, this.save.completed.length * 0.08);
  }

  onSpiderSense(src, t) {
    this.senseT = Math.max(this.senseT, t);
    this.audio.play('sense', 0.6);
  }

  onPlayerDeath() {
    if (this._dying) return;
    this._dying = true;
    this.slowmo(1.2, 0.25);
    this.audio.play('fail');
    setTimeout(() => {
      this._dying = false;
      const hadMission = !!this.missions.active;
      this.missions.onPlayerDeath();
      this.respawn();
      if (!hadMission) this.hud.toast('Tu as été mis K.O. … Tu te réveilles sur un toit.');
    }, 1300);
  }

  respawn() {
    const p = this.player;
    // loin des ennemis actifs
    this.enemies.clear((e) => !e.mission && e.pos.distanceTo(p.pos) < 60);
    const b = this.city.nearestSafeRoof(p.pos.clone().add(new THREE.Vector3(80, 0, 80)));
    p.teleport(new THREE.Vector3(b.x, b.roof + 0.5, b.z));
    p.health = p.maxHealth;
    p.focus = 0;
    this.projectiles.clear();
    this.hud.whiteFlash();
    this.cam.snapBehind();
  }

  onFellInWater() {
    const p = this.player;
    const b = this.city.nearestSafeRoof(p.pos.clone().multiplyScalar(0.9));
    this.fx.smoke(p.pos.clone(), '#dfe8ff', 3, 1, 3);
    p.teleport(new THREE.Vector3(b.x, b.roof + 0.5, b.z));
    this.hud.toast('Plouf ! Retour sur les toits.');
    this.hud.whiteFlash();
  }

  slowmo(dur, scale) {
    this.slowT = dur;
    this.slowScale = scale;
  }

  hitstop(dur) {
    this.hitstopT = Math.max(this.hitstopT, dur);
  }

  spawnDrone() {
    if (this.drone) this.scene.remove(this.drone.mesh);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc81d25, metalness: 0.5, roughness: 0.3 }));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe14a, emissiveIntensity: 2 }));
    eye.position.z = 0.18;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 20), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7 }));
    ring.rotation.x = Math.PI / 2;
    g.add(body, eye, ring);
    this.scene.add(g);
    this.drone = { mesh: g, life: 12, zapCd: 0.5, a: 0 };
    this.hud.toast('Drone araignée déployé !');
    this.audio.play('coin');
  }

  _updateDrone(dt) {
    const d = this.drone;
    if (!d) return;
    d.life -= dt;
    d.a += dt * 2.2;
    const p = this.player.pos;
    const want = new THREE.Vector3(p.x + Math.cos(d.a) * 2.2, p.y + 2.4 + Math.sin(d.a * 2) * 0.3, p.z + Math.sin(d.a) * 2.2);
    d.mesh.position.lerp(want, Math.min(1, dt * 6));
    d.zapCd -= dt;
    let best = null;
    let bd = 18;
    for (const e of this.targets()) {
      const dist = e.pos.distanceTo(d.mesh.position);
      if (dist < bd && e.state !== 'dead') {
        bd = dist;
        best = e;
      }
    }
    if (best) d.mesh.lookAt(best.chest || best.pos);
    if (best && d.zapCd <= 0) {
      d.zapCd = 0.7;
      best.hit({ dmg: 6, stagger: 0.35, knock: 1.5, source: 'gadget', dir: best.pos.clone().sub(p).setY(0).normalize() });
      this.webs.flash(d.mesh.position.clone(), (best.chest || best.pos).clone(), 0.1);
      this.fx.electric(best.chest || best.pos, 8);
      this.audio.play('zap', 0.4);
    }
    if (d.life <= 0) {
      this.fx.sparks(d.mesh.position, 10, '#ffcf4a', 5);
      this.scene.remove(d.mesh);
      this.drone = null;
    }
  }

  // ---------- Boucle ----------
  frame() {
    this.frameCount = (this.frameCount || 0) + 1;
    const now = performance.now();
    const raw = (now - this._last) / 1000;
    const realDt = Math.min(raw, 1 / 20);
    this._last = now;
    try {
      this.step(realDt);
      this.render();
    } catch (err) {
      // on garde la boucle en vie et on affiche l'erreur
      this.showError(err);
    }
    this._perf(raw);
  }

  // Résolution dynamique : baisse la définition si l'appareil peine
  _perf(raw) {
    if (raw > 0.5) return;
    this._perfT = (this._perfT || 0) + raw;
    this._perfN = (this._perfN || 0) + 1;
    if (this._perfT < 2) return;
    const avg = this._perfT / this._perfN;
    this._perfT = 0;
    this._perfN = 0;
    if (this.fpsEl) this.fpsEl.textContent = `${Math.round(1 / avg)} i/s · x${this.renderer.getPixelRatio().toFixed(2)}`;
    if (this.fixedPR || this.mode !== 'play' || this.paused) return;
    const pr = this.renderer.getPixelRatio();
    let next = pr;
    if (avg > 1 / 26 && pr > 0.5) next = Math.max(0.5, pr - 0.15);
    else if (avg < 1 / 55 && pr < this.basePR) next = Math.min(this.basePR, pr + 0.1);
    if (next !== pr) {
      this.renderer.setPixelRatio(next);
      if (this.composer) this.composer.setPixelRatio(next);
      this._resize();
    }
  }

  showError(err) {
    const msg = (err && (err.message || String(err))) || 'Erreur inconnue';
    console.error(err);
    if (this._lastError === msg) return;
    this._lastError = msg;
    const box = $('error-box');
    if (!box) return;
    const where = err && err.stack ? String(err.stack).split('\n').slice(1, 2).join('').trim() : '';
    box.textContent = `Oups, une erreur : ${msg}${where ? `\n(${where.slice(0, 140)})` : ''}`;
    box.classList.remove('hidden');
  }

  // Logique d'une image (sans rendu) : utilisable aussi pour les tests automatisés
  step(realDt) {
    const input = this.input;
    input.update(realDt);

    if (this.mode === 'title') {
      this._titleCam(realDt);
      this.env.update(realDt, this.player.pos);
      this.city.update(realDt, this.env.night, this.env.uniforms.time.value);
      this.traffic.update(realDt, this.player.pos, null);
      input.endFrame();
      return;
    }

    if (input.wasPressed('music')) {
      const on = this.audio.toggleMusic();
      this.save.settings.music = on;
      $('btn-music').textContent = on ? 'OUI' : 'NON';
      this.hud.toast(on ? 'Musique activée' : 'Musique coupée');
    }
    if (input.wasPressed('map') && !this.paused) this.toggleMap();
    if (input.wasPressed('pause')) {
      if (this._mapOpen) this.toggleMap();
      else if (this._resultOpen) this._closeResult();
      else if ($('controls-screen').classList.contains('hidden')) this.setPaused(!this.paused);
    }
    if (this.paused || this._mapOpen) {
      input.endFrame();
      return;
    }

    // Échelle de temps (ralenti, arrêt sur image)
    if (this.slowT > 0) {
      this.slowT -= realDt;
      this.timeScale += (this.slowScale - this.timeScale) * Math.min(1, realDt * 12);
    } else this.timeScale += (1 - this.timeScale) * Math.min(1, realDt * 5);
    let dt = realDt * this.timeScale;
    if (this.hitstopT > 0) {
      this.hitstopT -= realDt;
      dt *= 0.05;
    }
    this.time += dt;
    this.senseT -= dt;

    // Interaction (lancer une mission)
    this.interactConsumed = false;
    this.nearbyEntry = this.missions.nearbyStart();
    if (this.nearbyEntry && input.wasPressed('interact')) {
      this.interactConsumed = true;
      this.missions.start(this.nearbyEntry);
      this.nearbyEntry = null;
    }

    this.combat.update(dt, input);
    this.player.update(dt, input);
    this.enemies.update(dt);
    if (this.boss && this.boss.active) this.boss.update(dt);
    this.projectiles.update(dt);
    this._updateDrone(dt);
    this.missions.update(dt);

    const p = this.player;
    const obs = this.traffic.obstacles;
    obs.length = 0;
    obs.push(p.pos);
    for (const e of this.enemies.enemies) if (e.alive) obs.push(e.pos);
    this.traffic.update(dt, p.pos, this.combat.inCombat ? p.pos : null);
    this.env.update(dt, p.pos);
    this.city.update(dt, this.env.night, this.env.uniforms.time.value);
    this.fx.update(dt);
    this.webs.tick(dt);
    this.markers.update(dt, this.camera.position);
    this.cam.update(realDt, input);
    this.hud.update(realDt);
    this.audio.setWind(p.state === 'ground' ? 0 : p.speed);
    this.audio.setIntensity(this.combat.inCombat ? 1 : 0);
    input.endFrame();
  }

  _titleCam(dt) {
    this._titleA = (this._titleA || 0) + dt * 0.05;
    const o = this.city.landmarks.oscorp;
    const a = this._titleA;
    this.camera.position.set(o.x + Math.cos(a) * 230, 185 + Math.sin(a * 2) * 15, o.z + Math.sin(a) * 230);
    this.camera.lookAt(o.x, 150, o.z);
    if (this.camera.fov !== 60) {
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
    }
    this.player.animate(dt);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

