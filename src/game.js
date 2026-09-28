import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Input } from './engine/input.js';
import { AudioSys } from './engine/audio.js';
import { storage, mulberry32 } from './engine/utils.js';
import { City } from './world/city.js';
import { Environment } from './world/sky.js';
import { Traffic } from './world/traffic.js';
import { StreetProps } from './world/props.js';
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
import { computeStats, SKILLS, canBuy } from './player/skills.js';
import { SUITS, suitUnlocked } from './player/suits.js';
import { STYLES } from './player/combat.js';
import { Achievements } from './progress/achievements.js';
import { Weather, Helicopters } from './world/weather.js';
import { Menus } from './ui/menus.js';
import { PhotoMode } from './ui/photo.js';

const SAVE_KEY = 'spiderman-monde-ouvert-v1';
const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

// Étalonnage final (espace sRGB) : contraste, saturation, tons chauds/froids, vignettage
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.1);
      c = (c - 0.5) * 1.06 + 0.5;
      c += mix(vec3(-0.012, -0.004, 0.018), vec3(0.018, 0.008, -0.014), smoothstep(0.15, 0.85, l));
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

const QUALITY = {
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, bloom: true, fogFar: 1500, cars: 300, peds: 320, antialias: true, detail: true },
  medium: { pixelRatio: 1.5, shadows: true, shadowSize: 1024, bloom: false, fogFar: 1200, cars: 190, peds: 200, antialias: true, detail: true },
  low: { pixelRatio: 1, shadows: false, shadowSize: 512, bloom: false, fogFar: 850, cars: 110, peds: 110, antialias: false, detail: false },
};

function defaultSave() {
  return {
    xp: 0,
    level: 1,
    completed: [],
    bags: [],
    races: {},
    crimes: 0,
    suit: 'auto',
    skills: [],
    skillPoints: 0,
    achievements: [],
    counters: {},
    bases: [],
    stations: [],
    gold: [],
    settings: {
      quality: 'auto',
      sens: 1,
      music: true,
      daynight: true,
      weather: 'auto',
      timeMode: 'auto',
      autoCam: true,
      shake: true,
      renderScale: 1,
      showFps: false,
      musicVol: 0.6,
      sfxVol: 0.85,
      invertY: false,
      tbScale: 1,
      tbAlpha: 0.9,
      haptics: true,
    },
  };
}

export class Game {
  constructor() {
    this.save = { ...defaultSave(), ...storage.get(SAVE_KEY, {}) };
    this.save.settings = { ...defaultSave().settings, ...(this.save.settings || {}) };
    // anciennes sauvegardes : points de compétence rétroactifs
    if (!Array.isArray(this.save.skills)) this.save.skills = [];
    if (typeof this.save.skillPoints !== 'number') this.save.skillPoints = this.save.level - 1;
    if (!this.save.counters) this.save.counters = {};
    if (this.save.settings.timeMode === 'auto' && this.save.settings.daynight === false) this.save.settings.timeMode = 'dusk';
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
    const tips = [
      'Maintiens le bouton TOILE en l’air pour te balancer, relâche au sommet pour gagner de la vitesse.',
      'Esquive au moment où le sens d’araignée s’allume : l’esquive parfaite ralentit le temps.',
      'Les passants t’acclament et te prennent en photo quand tu te poses près d’eux.',
      'Les feux tricolores règlent vraiment la circulation : les voitures s’arrêtent au rouge.',
      'Change de style de combat pour changer de costume en mode Auto.',
      'Les stations de métro découvertes permettent de voyager rapidement depuis la carte.',
      'Réduis la résolution dans les options si le jeu saccade sur ton téléphone.',
    ];
    const tipEl = $('load-tip');
    if (tipEl) tipEl.innerHTML = `<b>ASTUCE</b>${tips[Math.floor(Math.random() * tips.length)]}`;
    const setLoad = async (pct, text) => {
      $('load-fill').style.width = `${pct}%`;
      const pe = $('load-pct');
      if (pe) pe.textContent = `${Math.round(pct)} %`;
      if (text) $('load-text').textContent = text;
      await nextFrame();
    };
    await setLoad(5, 'Préparation du rendu…');
    // Polices embarquées chargées avant de dessiner les enseignes et la carte
    try {
      await Promise.race([
        Promise.all(['400 64px "Bebas Neue"', '600 20px "Barlow Condensed"', '700 20px "Barlow Condensed"', '400 16px "Barlow"', '600 16px "Barlow"'].map((f) => document.fonts.load(f))),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      /* polices de secours */
    }
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) throw new Error('WebGL 2 n’est pas disponible sur cet appareil ou ce navigateur. Essaie avec Chrome, Edge, Firefox ou Safari à jour.');
    const canvas = $('game');
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.showError(new Error('Le téléphone a manqué de mémoire graphique. Recharge la page et choisis « Graphismes : Bas ».'));
    });
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(qs.has('pr') ? this.quality.pixelRatio : Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio) * (this.save.settings.renderScale || 1));
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
    this.input.invertY = this.save.settings.invertY;
    this.input.haptic = () => this.vibrate(8);
    this.audio = new AudioSys();
    this.audio.musicOn = this.save.settings.music;
    this.audio.musicVolume = 0.55 * this.save.settings.musicVol;
    this.audio.sfxVolume = this.save.settings.sfxVol;
    this._applyTouchLayout();

    await setLoad(12, 'Tissage de la ville…');
    this.city = new City(this.scene, this.quality);
    this.city.generate();
    this.props = new StreetProps(this.city, this.quality);
    this.scene.add(this.props.group);
    {
      const t = this.city.treeAssets(true);
      this.props.buildTrees(t.trunkG, t.leafG, t.trunkMat, t.leafMat, mulberry32(31));
    }
    await setLoad(45, 'Allumage du ciel…');
    this.env = new Environment(this.scene, renderer, this.quality);
    this.env.camera = this.camera;
    await setLoad(55, 'Mise en circulation…');
    this.traffic = new Traffic(this.scene, this.city, this.quality);
    this.traffic.camera = this.camera;
    this.traffic.onHorn = (car) => {
      const d = Math.hypot(car.x - this.camera.position.x, car.z - this.camera.position.z);
      if (d < 60) this.audio.play('horn', 0.6 * (1 - d / 60));
    };
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
    this.stats = computeStats(this.save, 'classique');
    this.missions.init();
    this.hud.buildMap();
    this.weather = new Weather(this);
    this.helis = new Helicopters(this.scene, this.city);
    this.achievements = new Achievements(this);
    this.menus = new Menus(this);
    this.photo = new PhotoMode(this);
    const saved = this.save.suit;
    if (saved && saved !== 'auto' && SUITS[saved] && suitUnlocked(saved, this.save)) this.player.setSuit(saved);
    this._applyTimeMode();
    this.refreshStats();
    await setLoad(80, 'Compilation des shaders…');

    if (this.quality.bloom) {
      // Cible multi-échantillonnée : l'anticrénelage du canvas ne s'applique pas au composer
      const pr = renderer.getPixelRatio();
      const rt = new THREE.WebGLRenderTarget(window.innerWidth * pr, window.innerHeight * pr, { type: THREE.HalfFloatType, samples: 4 });
      const composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.5, 0.9);
      composer.addPass(this.bloom);
      composer.addPass(new OutputPass());
      composer.addPass(new ShaderPass(GradeShader));
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
    this.fpsEl = $('fps');
    this.fpsEl.classList.toggle('hidden', !(qs.has('fps') || this.save.settings.showFps));
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
        this.audio.init();
        this.audio.play('ui');
        try {
          fn();
        } catch (err) {
          this.showError(err);
        }
      });
    click('btn-play', () => this.startPlay());
    click('btn-new', () => {
      this.confirm('NOUVELLE PARTIE ?', 'Toute la progression sera effacée.').then((ok) => {
        if (!ok) return;
        const settings = this.save.settings;
        storage.set(SAVE_KEY, { ...defaultSave(), settings });
        location.reload();
      });
    });
    click('btn-options-title', () => this.menus.openFromTitle('options'));
    click('btn-controls', () => this.menus.openFromTitle('commandes'));
    click('btn-map-close', () => this._mapOpen && this.toggleMap());
    // Voyage rapide : clic sur une station de métro découverte dans la grande carte
    $('bigmap').addEventListener('click', (e) => {
      const st = this.hud.stationAt(e);
      if (st && this.fastTravel(st)) this.toggleMap();
    });
    click('btn-result-ok', () => this._closeResult());
    click('btn-retry', () => {
      this._closeResult();
      this.player.health = this.player.maxHealth;
      this.missions.retry();
    });
    click('dialog-yes', () => this._dialogAnswer(true));
    click('dialog-no', () => this._dialogAnswer(false));
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.mode === 'play' && !this.paused && !this.input.isTouch && !this._resultOpen && !this._mapOpen && !this.photo.active) {
        this.setPaused(true);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'play' && !this.paused) this.setPaused(true);
    });
  }

  // Boîte de dialogue maison (remplace confirm(), illisible sur téléphone)
  confirm(title, text) {
    $('dialog-title').textContent = title;
    $('dialog-text').textContent = text;
    $('dialog').classList.remove('hidden');
    return new Promise((res) => (this._dialogRes = res));
  }

  _dialogAnswer(v) {
    $('dialog').classList.add('hidden');
    const r = this._dialogRes;
    this._dialogRes = null;
    if (r) r(v);
  }

  // Bouton retour Android / Échap dans les menus
  handleBack() {
    if (!$('dialog').classList.contains('hidden')) {
      this._dialogAnswer(false);
      return 'ok';
    }
    if (this.menus && this.menus.fromTitle) {
      this.menus.close();
      return 'ok';
    }
    if (this.photo && this.photo.active) {
      this.photo.close();
      return 'ok';
    }
    if (this._resultOpen) {
      this._closeResult();
      return 'ok';
    }
    if (this._mapOpen) {
      this.toggleMap();
      return 'ok';
    }
    if (this.mode === 'play') {
      this.setPaused(!this.paused);
      return 'ok';
    }
    return 'exit';
  }

  vibrate(ms) {
    if (!this.save.settings.haptics || !this.input.isTouch) return;
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {
      /* vibration indisponible */
    }
  }

  _applyTouchLayout() {
    const st = this.save.settings;
    document.documentElement.style.setProperty('--tb-scale', st.tbScale);
    document.documentElement.style.setProperty('--tb-alpha', st.tbAlpha);
  }

  showTitle() {
    this.mode = 'title';
    this.hud.show(false);
    $('title-screen').classList.remove('hidden');
    $('touch-ui').classList.add('off');
    const started = this.save.completed.length || this.save.xp;
    $('btn-play').querySelector('span').textContent = started ? 'CONTINUER' : 'JOUER';
    $('play-sub').textContent = started ? `Niveau ${this.save.level} · ${this.save.completed.length} mission${this.save.completed.length > 1 ? 's' : ''} terminée${this.save.completed.length > 1 ? 's' : ''}` : 'Commencer l’aventure';
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
        this.hud.hint('Bienvenue à New York ! Suis le faisceau jaune pour ta première mission. Maintiens TOILE en l’air pour te balancer.', 9);
      } else this.hud.toast('De retour en ville !');
      if (this.input.isTouch && window.innerHeight > window.innerWidth) {
        setTimeout(() => this.hud.toast('Astuce : tourne ton téléphone en paysage pour mieux jouer'), 1500);
      }
    }
  }

  setPaused(p, silent = false) {
    this.paused = p;
    this.input.reset();
    if (p && !silent) this.menus.open('stats');
    else this.menus.close();
    if (p) {
      this.input.exitPointerLock();
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

  refreshPauseStats() {
    if (this.menus && this.menus.isOpen) this.menus.refreshBadge();
  }

  // ---------- Costumes, compétences, options ----------
  refreshStats() {
    if (!this.player || !this.combat) return;
    this.stats = computeStats(this.save, this.player.suitKey);
    const p = this.player;
    const ratio = p.maxHealth ? p.health / p.maxHealth : 1;
    p.maxHealth = this.stats.maxHealth;
    p.health = Math.min(p.maxHealth, Math.max(1, ratio * p.maxHealth));
    this.combat.dmgMul = this.stats.dmgMul;
    this.enemies.difficulty = 1 + Math.min(0.7, this.save.completed.length * 0.08);
  }

  equipSuit(key) {
    if (key !== 'auto' && (!SUITS[key] || !suitUnlocked(key, this.save))) return;
    this.save.suit = key;
    if (key === 'auto') this.player.setSuit(STYLES[this.combat.styleIndex].key);
    else this.player.setSuit(key);
    this.refreshStats();
    this.saveGame();
  }

  buySkill(key) {
    const sk = SKILLS.find((x) => x.key === key);
    if (!sk || !canBuy(sk, this.save)) return;
    this.save.skillPoints -= sk.cost;
    this.save.skills.push(key);
    this.refreshStats();
    this.saveGame();
    this.audio.play('level', 0.8);
  }

  setOption(key, val) {
    this.save.settings[key] = val;
    if (key === 'weather') this.weather.setMode(val);
    if (key === 'timeMode') this._applyTimeMode();
    if (key === 'music') {
      this.audio.musicOn = !val;
      this.audio.toggleMusic();
    }
    if (key === 'musicVol') this.audio.setMusicVolume(0.55 * val);
    if (key === 'sfxVol') this.audio.setSfxVolume(val);
    if (key === 'sens') this.input.sensitivity = val;
    if (key === 'invertY') this.input.invertY = val;
    if (key === 'tbScale' || key === 'tbAlpha') this._applyTouchLayout();
    if (key === 'showFps') this.fpsEl.classList.toggle('hidden', !val);
    if (key === 'renderScale' && !this.fixedPR) {
      this.basePR = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio) * val;
      this.renderer.setPixelRatio(this.basePR);
      if (this.composer) this.composer.setPixelRatio(this.basePR);
      this._resize();
    }
    this.saveGame();
    if (key === 'quality') location.reload();
  }

  _applyTimeMode() {
    const m = this.save.settings.timeMode;
    this.env.cycle = m === 'auto';
    if (m === 'day') this.env.time = 13;
    else if (m === 'dusk') this.env.time = 18.0;
    else if (m === 'night') this.env.time = 22.5;
    this.env.lastEnvTime = -99;
  }

  stat(name, n = 1) {
    const c = this.save.counters;
    c[name] = (c[name] || 0) + n;
  }

  statMax(name, v) {
    const c = this.save.counters;
    if (v > (c[name] || 0)) c[name] = v;
  }

  fastTravel(st) {
    if (this.missions.active || this.combat.inCombat) {
      this.hud.toast('Impossible de voyager pendant une mission ou un combat');
      return false;
    }
    this.player.teleport(st.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    this.cam.snapBehind();
    this.hud.whiteFlash();
    this.hud.toast(`Métro : arrivée à ${st.name}`);
    this.audio.play('whoosh');
    return true;
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
    if (this._mapOpen) {
      this.hud.drawBigMap();
      this.input.exitPointerLock();
      this.input.reset();
    }
  }

  // ---------- Progression ----------
  xpForNext() {
    return 400 + this.save.level * 250;
  }

  gainXP(n, label) {
    const s = this.save;
    n = Math.round(n * (this.stats ? this.stats.xpMul : 1));
    s.xp += n;
    if (label) this.hud.xpGain(n, label);
    while (s.xp >= this.xpForNext()) {
      s.xp -= this.xpForNext();
      s.level++;
      s.skillPoints++;
      this.refreshStats();
      this.player.health = this.player.maxHealth;
      this.hud.levelUp(s.level);
      this.audio.play('level');
    }
    this.saveGame();
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
    this.stat('enemies');
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
      if (input.wasPressed('pause')) this.handleBack();
      this._titleCam(realDt);
      this.helis.update(realDt, this.env.night, performance.now() / 1000);
      this.env.update(realDt, this.player.pos);
      this.city.update(realDt, this.env.night, this.env.uniforms.time.value);
      this.traffic.night = this.env.night;
      this.traffic.update(realDt, this.player.pos, null);
      this.props.update(this.traffic.clock, this.camera);
      input.endFrame();
      return;
    }

    if (input.wasPressed('music')) {
      const on = this.audio.toggleMusic();
      this.save.settings.music = on;
      this.saveGame();
      this.hud.toast(on ? 'Musique activée' : 'Musique coupée');
    }
    if (this.photo.active) {
      if (input.pressed.has('pause') || input.pressed.has('photo')) this.photo.close();
      else this.photo.update(realDt, input);
      input.endFrame();
      return;
    }
    if (input.wasPressed('photo') && !this.paused && !this._mapOpen) {
      this.photo.open();
      input.endFrame();
      return;
    }
    if (input.wasPressed('map') && !this.paused) this.toggleMap();
    if (input.wasPressed('pause')) {
      if (!$('dialog').classList.contains('hidden')) this._dialogAnswer(false);
      else if (this._mapOpen) this.toggleMap();
      else if (this._resultOpen) this._closeResult();
      else this.setPaused(!this.paused);
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
    if (this.boss && this.boss.alive) obs.push(this.boss.pos);
    this.traffic.night = this.env.night;
    this.traffic.update(dt, p.pos, this.combat.inCombat ? p.pos : null);
    this.props.update(this.traffic.clock, this.camera);
    this.weather.update(dt, this.camera.position);
    this.env.update(dt, p.pos);
    this.helis.update(dt, this.env.night, this.time);
    this.achievements.update(dt);
    this.statMax('maxSpeed', Math.round(p.speed));
    this.statMax('maxAltitude', Math.round(p.pos.y));
    this.statMax('maxCombo', this.combat.combo);
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
    if (this.traffic) this.traffic.render();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

