// Point d'entrée : moteur, menus, boucle de jeu, transitions entre les époques.
import * as THREE from 'three';
import './style.css';
import { G, bus, toast, news } from './core/state.js';
import { Input } from './core/input.js';
import { initAudio, sfx, ambience, setVolume } from './core/audio.js';
import { World, WATER } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { MicroWorld } from './world/micro.js';
import { FX } from './entities/fx.js';
import { CreatureManager } from './entities/creatures.js';
import { NPCManager } from './entities/npcs.js';
import { Player } from './entities/player.js';
import { BuildingSystem } from './systems/buildings.js';
import { HUD } from './ui/hud.js';
import { Panels, helpHtml } from './ui/panels.js';
import { STAGES, stageDef } from './data/stages.js';
import { TECHS, eraIndex, eraOf } from './data/tech.js';
import * as inv from './systems/inventory.js';
import { civTick, createFactions, placeFactionVillages, foundVillage, resetCivClock } from './systems/civ.js';
import { updateObjectives } from './systems/objectives.js';
import { computeStats } from './systems/evolution.js';
import * as saveS from './systems/save.js';
import { randomLook } from './models/humans.js';
import { fmtYear, rand, clamp, escapeHtml } from './core/util.js';

const HOUR_SECONDS = 25; // une heure de jeu = 25 secondes

// ------------------------------------------------------------------ moteur
saveS.loadSettings();
const urlQ = new URLSearchParams(location.search).get('q');
if (urlQ) G.settings.quality = urlQ;
if (new URLSearchParams(location.search).has('god')) G.godMode = true;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: G.settings.quality !== 'low', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, G.settings.quality === 'high' ? 2 : G.settings.quality === 'low' ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = G.settings.quality !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
G.renderer = renderer;

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2500);
G.camera = camera;
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

G.input = new Input(canvas);
G.fx = new FX();
G.creatures = new CreatureManager();
G.npcs = new NPCManager();
G.buildingsSys = new BuildingSystem();
G.hud = new HUD();
const panels = new Panels();
G.panels = panels;

const worldScene = new THREE.Scene();
G.worldScene = worldScene;
let micro = null;
let world = null;
let sky = null;

const ldFill = document.getElementById('ld-fill');
function progress(p) {
  ldFill.style.width = Math.round(p * 100) + '%';
}

// ------------------------------------------------------------------ menus
const ui = document.getElementById('ui');
ui.insertAdjacentHTML(
  'beforeend',
  `<div id="menu" class="hidden">
    <div class="menu-box">
      <div class="m-title">ÉVOLUTION</div>
      <div class="m-sub">De la première cellule à la conquête des étoiles</div>
      <div id="m-main" class="m-btns">
        <button id="m-continue" class="big-btn hidden">▶ Continuer la partie</button>
        <button id="m-new" class="big-btn">🦠 Nouvelle partie</button>
        <button id="m-era">⏩ Commencer à une autre époque</button>
        <button id="m-help">❓ Comment jouer</button>
      </div>
      <div id="m-eras" class="m-btns hidden">
        <button data-start="0">🦠 Cellule (il y a 3,8 milliards d’années)</button>
        <button data-start="2">🐟 Poisson (océans primitifs)</button>
        <button data-start="4">🦎 Reptile (âge des dinosaures)</button>
        <button data-start="6">🐒 Singe</button>
        <button data-start="7">🧔 Hominidé (âge de pierre)</button>
        <button data-start="8">🧑 Humain : Préhistoire</button>
        <button data-start="medieval">🏰 Humain : Moyen Âge (village, roi)</button>
        <button data-start="2000">💻 Humain : An 2000 (ordinateurs, code)</button>
        <button id="m-back">← Retour</button>
      </div>
      <div id="m-helpbox" class="hidden"><div class="help-scroll"></div><button id="m-back2">← Retour</button></div>
      <div class="m-foot">Graphismes et sons 100 % générés par le code · Sauvegarde automatique</div>
    </div>
  </div>
  <div id="cine" class="hidden"><div class="cine-year"></div><div class="cine-title"></div><div class="cine-text"></div><button id="cine-go" class="big-btn">Continuer</button></div>
  <div id="death" class="hidden"><div class="d-title">Tu es mort</div><div id="d-text"></div><button id="d-btn" class="big-btn">Réapparaître</button></div>`,
);
const $ = (id) => document.getElementById(id);

function showMenu() {
  $('menu').classList.remove('hidden');
  $('m-continue').classList.toggle('hidden', !saveS.hasSave());
  $('m-main').classList.remove('hidden');
  $('m-eras').classList.add('hidden');
  $('m-helpbox').classList.add('hidden');
}
$('m-era').onclick = () => {
  $('m-main').classList.add('hidden');
  $('m-eras').classList.remove('hidden');
};
$('m-back').onclick = showMenu;
$('m-back2').onclick = showMenu;
$('m-help').onclick = () => {
  $('m-main').classList.add('hidden');
  $('m-helpbox').classList.remove('hidden');
  $('m-helpbox').querySelector('.help-scroll').innerHTML = helpHtml();
};
$('m-new').onclick = () => {
  if (saveS.hasSave() && !confirm('Commencer une nouvelle partie ? La sauvegarde actuelle sera remplacée.')) return;
  newGame(0);
};
$('m-continue').onclick = () => continueGame();
$('m-eras').querySelectorAll('[data-start]').forEach((b) =>
  b.addEventListener('click', () => {
    if (saveS.hasSave() && !confirm('Commencer une nouvelle partie ? La sauvegarde actuelle sera remplacée.')) return;
    newGame(b.dataset.start);
  }),
);

// ------------------------------------------------------------------ cinématique
let cineResolve = null;
function cinematic(year, title, text) {
  return new Promise((res) => {
    $('cine').classList.remove('hidden');
    $('cine').querySelector('.cine-year').textContent = year;
    $('cine').querySelector('.cine-title').textContent = title;
    $('cine').querySelector('.cine-text').textContent = text;
    G.paused = true;
    G.input.unlock();
    cineResolve = res;
  });
}
$('cine-go').onclick = () => {
  $('cine').classList.add('hidden');
  G.paused = !!G.panel;
  cineResolve?.();
  cineResolve = null;
};

function whiteFlash(dur = 1.2) {
  const f = $('flash');
  f.style.transition = 'none';
  f.style.opacity = '1';
  requestAnimationFrame(() => {
    f.style.transition = `opacity ${dur}s`;
    f.style.opacity = '0';
  });
}

// ------------------------------------------------------------------ mondes
function ensureWorlds() {
  if (!world) {
    world = new World(G.seed || 1234);
    world.build(progress);
    worldScene.add(world.group);
    sky = new Sky(worldScene);
    G.sky = sky;
    G.world = world;
  }
  if (!micro) {
    micro = new MicroWorld();
    G.micro = micro;
  }
}

function setScene(scene) {
  G.scene = scene;
  G.creatures.clear();
  G.creatures.attach(scene);
  G.fx.clear();
  G.fx.attach(scene);
  G.npcs.clear();
  G.npcs.attach(scene);
  G.player.attach(scene);
}

function enterMicro() {
  G.mode = 'micro';
  setScene(micro.scene);
  G.player.pos.set(0, 0, 0);
  G.player.camInit = false;
  document.getElementById('underwater').classList.remove('on');
  ambience('micro');
}

function enterWorld(spawn) {
  G.mode = 'world';
  setScene(worldScene);
  if (G.factionGroup) worldScene.add(G.factionGroup);
  for (const b of G.buildings) if (!b.model) G.buildingsSys.spawn(b);
  if (spawn) {
    G.player.pos.copy(spawn);
    // Regarde vers l'intérieur de l'île
    if (G.stage !== 2) G.player.camYaw = Math.atan2(-spawn.x, -spawn.z);
  }
  G.player.camInit = false;
  ambience(G.stage === 2 ? 'ocean' : eraIndex(G.time.year) >= 7 && G.stage >= 8 ? 'modern' : 'land');
}

function oceanSpawn() {
  const shore = world.findShore(Math.PI / 2);
  const dir = new THREE.Vector3(shore.x, 0, shore.z).normalize();
  for (let r = 20; r < 200; r += 5) {
    const p = shore.clone().addScaledVector(dir, r);
    const h = world.height(p.x, p.z);
    if (h < -12) return new THREE.Vector3(p.x, h * 0.5, p.z);
  }
  return new THREE.Vector3(shore.x, -6, shore.z + 60);
}

function landSpawn() {
  const s = world.findShore(Math.PI / 2);
  // Un peu à l'intérieur des terres
  const dir = new THREE.Vector3(-s.x, 0, -s.z).normalize();
  const p = s.clone().addScaledVector(dir, 30);
  p.y = world.height(p.x, p.z);
  return p;
}

// ------------------------------------------------------------------ parties
function resetState() {
  Object.assign(G, {
    time: { day: 1, hour: 9, year: -3.8e9 },
    stage: 0,
    dna: 0,
    dnaTotal: 0,
    mutations: [],
    inherited: { hp: 0, atk: 0, speed: 0 },
    inv: {},
    hotbar: Array(9).fill(null),
    hotSel: 0,
    money: 0,
    savoir: 0,
    techs: [],
    known: [],
    customItems: {},
    customCount: 0,
    buildings: [],
    robots: [],
    village: null,
    factions: [],
    title: '',
    career: null,
    popularity: 50,
    taxes: 10,
    nextElection: 0,
    monster: null,
    disease: null,
    scripts: {},
    shopStock: [],
    market: {},
    news: [],
    objectivesDone: [],
    stats: { kills: 0, eaten: 0, crafted: 0, built: 0, sk: 0 },
    look: randomLook(),
    respawnPoint: null,
    launched: false,
    seed: 1234,
  });
  resetCivClock();
}

function techsUntil(year) {
  return TECHS.filter((t) => t.year <= year).map((t) => t.id);
}

function startKit(choice) {
  const give = (m) => {
    for (const [id, n] of Object.entries(m)) inv.add(id, n, true);
  };
  if (choice === 'medieval') {
    G.stage = 8;
    G.techs = techsUntil(1100);
    G.time.year = 1100;
    G.money = 500;
    G.savoir = 60;
    give({ bois: 120, pierre: 120, fibre: 40, corde: 20, brique: 60, argile: 20, fer: 30, acier: 10, peau: 20, cuir: 10, viande_cuite: 40, pain: 40, epee_fer: 1, hache_fer: 1, pioche_fer: 1, arc: 1, fleche: 40, armure_fer: 1, potion_soin: 3, or: 6, verre: 20, herbe_med: 10, remede_herbes: 5 });
    G.hotbar = ['epee_fer', 'hache_fer', 'pioche_fer', 'arc', 'potion_soin', null, null, null, null];
    return 'village';
  }
  if (choice === '2000') {
    G.stage = 8;
    G.techs = techsUntil(2000);
    G.time.year = 2000;
    G.money = 5000;
    G.savoir = 200;
    give({ bois: 200, pierre: 200, brique: 200, verre: 120, acier: 120, fer: 60, plastique: 40, circuit: 20, ecran: 4, puce: 6, moteur: 10, batterie: 10, cuivre: 30, silicium: 20, petrole: 30, uranium: 6, or: 10, burger: 30, eau: 20, fusil: 1, balle: 200, tronconneuse: 1, foreuse: 1, gilet: 1, antibiotique: 5, vaccin: 3, grenade: 5, herbe_med: 20 });
    G.hotbar = ['fusil', 'tronconneuse', 'foreuse', 'grenade', 'antibiotique', null, null, null, null];
    return 'village';
  }
  const st = +choice;
  G.stage = st;
  if (st >= 7) G.techs = ['outils_pierre'];
  if (st >= 8) {
    G.techs = ['outils_pierre', 'feu'];
    G.savoir = 20;
    give({ hache_pierre: 1, pioche_pierre: 1, couteau_silex: 1, baton: 5, corde: 3 });
  }
  G.time.year = stageDef(st).year;
  return null;
}

async function newGame(choice) {
  initAudio();
  $('menu').classList.add('hidden');
  resetState();
  saveS.wipe();
  ensureWorlds();
  const extra = startKit(choice);
  G.player = new Player();
  G.player.rebuild();
  G.started = true;
  G.hud.show(true);
  const st = stageDef(G.stage);
  if (st.env === 'micro') enterMicro();
  else if (st.env === 'ocean') enterWorld(oceanSpawn());
  else enterWorld(landSpawn());
  createFactions();
  placeFactionVillages();
  if (extra === 'village') {
    foundVillage(choice === '2000' ? 'Néo-Ville' : 'Castelmont');
    for (let i = 0; i < (choice === '2000' ? 9 : 6); i++) {
      const { addVillager } = await import('./systems/civ.js');
      addVillager();
    }
    if (choice === 'medieval') G.title = 'roi';
    G.player.rebuild();
  }
  G.player.hp = G.player.maxHp();
  await cinematic(fmtYear(G.time.year), st.name, st.intro);
  saveS.save();
}

function continueGame() {
  initAudio();
  const data = saveS.load();
  if (!data) return newGame(0);
  $('menu').classList.add('hidden');
  resetState();
  saveS.apply(data);
  setVolume(G.settings.volume);
  ensureWorlds();
  G.player = new Player();
  G.player.rebuild();
  const p = data.player;
  G.started = true;
  G.hud.show(true);
  if (G.mode === 'micro') enterMicro();
  else {
    enterWorld(new THREE.Vector3().fromArray(p.pos));
    if (!G.factions.length) createFactions();
    placeFactionVillages();
    G.buildingsSys.spawnAll();
  }
  if (data.respawnPoint) G.respawnPoint = new THREE.Vector3().fromArray(data.respawnPoint);
  G.player.hp = p.hp;
  G.player.hunger = p.hunger;
  G.player.thirst = p.thirst;
  G.player.camYaw = p.camYaw || 0;
  toast('Partie chargée. Bon retour !', 'good');
}

// ------------------------------------------------------------------ événements
bus.on('evolved', async (from, to) => {
  const st = stageDef(to);
  whiteFlash(1.5);
  G.player.rebuild();
  G.player.hp = G.player.maxHp();
  G.player.hunger = 100;
  G.player.thirst = 100;
  if (st.env !== stageDef(from).env) {
    if (st.env === 'ocean') enterWorld(oceanSpawn());
    else if (st.env === 'land') {
      const shore = world.findShore(Math.atan2(G.player.pos.z, G.player.pos.x));
      enterWorld(shore);
    }
  }
  if (to === 8 && !G.factions.length) createFactions();
  if (to >= 7) placeFactionVillages();
  await cinematic(fmtYear(G.time.year), `Tu deviens : ${st.name}`, st.intro);
  saveS.save();
});

bus.on('kill', () => {
  G.stats.sk = (G.stats.sk || 0) + 1;
});
bus.on('eatCreature', (c) => G.player.eat(c));
bus.on('placeMachine', (id) => G.buildingsSys.start('machine', id));
bus.on('titleChanged', () => G.player.rebuild());
bus.on('monster', () => {
  whiteFlash(1);
  G.player.rebuild();
});
bus.on('newEra', () => {
  G.player.rebuild();
  for (const n of [...G.npcs.list]) if (n.kind !== 'robot') G.npcs.remove(n);
  placeFactionVillages();
  ambience(eraIndex(G.time.year) >= 7 ? 'modern' : 'land');
});
bus.on('whiteflash', () => whiteFlash(3));
bus.on('nuke', (pos, radius) => {
  let lostB = 0;
  for (const b of [...G.buildings]) {
    if (Math.hypot(b.x - pos.x, b.z - pos.z) < radius) {
      b.model?.parent?.remove(b.model);
      G.buildings.splice(G.buildings.indexOf(b), 1);
      lostB++;
    }
  }
  if (G.village && Math.hypot(G.village.x - pos.x, G.village.z - pos.z) < radius * 1.5) {
    const lost = Math.floor(G.village.people.length * 0.8);
    G.village.people.splice(0, lost);
    toast(`☢️ Ton propre village est touché ! ${lost} morts.`, 'bad');
  }
  for (const f of G.factions) {
    if (!f.conquered && Math.hypot(f.x - pos.x, f.z - pos.z) < radius * 1.5) {
      f.pop = 0;
      f.mil = 0;
      f.conquered = true;
      toast(`☢️ ${f.name} a été rayé de la carte.`, 'bad');
      news(`☢️ ${f.name} anéanti par une bombe atomique.`);
    }
  }
  G.popularity = clamp(G.popularity - 40, 0, 100);
  if (lostB) toast(`${lostB} bâtiment(s) détruit(s).`, 'bad');
  if (G.player.pos.distanceTo(pos) < radius * 2 && !G.disease) {
    G.disease = { name: 'Irradiation', level: 3 };
    toast('☢️ Tu es irradié ! Il te faut un vaccin.', 'bad');
  }
  placeFactionVillages();
});

let rocketAnim = null;
bus.on('launchRocket', (b) => {
  if (rocketAnim) return;
  panels.close();
  rocketAnim = { b, t: 0 };
  toast('🚀 3... 2... 1... DÉCOLLAGE !', 'good');
  sfx('explode');
});

function updateRocket(dt) {
  if (!rocketAnim) return;
  const r = rocketAnim;
  r.t += dt;
  const rocket = r.b.model?.userData.rocket;
  if (rocket) {
    rocket.position.y = 0.6 + Math.max(0, r.t - 1) ** 2 * 6;
    const base = r.b.model.position.clone().add(new THREE.Vector3(0, rocket.position.y, 0));
    G.fx.burst(base, 0xff8020, 8, 6, 1, -2);
    G.fx.burst(base, 0xcccccc, 4, 3, 2.5, 0.5);
    G.fx.shake = Math.max(G.fx.shake, 0.5);
  }
  if (r.t > 7) {
    rocketAnim = null;
    if (rocket) rocket.position.y = 0.6;
    G.launched = true;
    news('🚀 Lancement historique : l’humanité part vers les étoiles !');
    cinematic(
      fmtYear(G.time.year),
      '🌌 VICTOIRE : CAP SUR LES ÉTOILES',
      `De la toute première cellule jusqu’à la conquête de l’espace : tu as mené la vie à travers ${Math.round(3.8e9 + G.time.year).toLocaleString('fr-FR')} années d’évolution. ${G.stats.kills} créatures chassées, ${G.stats.crafted} objets fabriqués, ${G.stats.built} bâtiments construits. Le monde reste ouvert : continue à jouer !`,
    );
  }
}

bus.on('death', (by) => {
  G.paused = true;
  G.input.unlock();
  $('death').classList.remove('hidden');
  const st = stageDef(G.stage);
  const penalty = G.stage < 8 ? 'Tu perds 25 % de ton ADN.' : 'Tu perds 10 % de ton argent.';
  $('d-text').textContent = `${by ? 'Tué par : ' + by + '. ' : ''}${penalty} La vie continue...`;
  sfx('hurt');
  void st;
});
$('d-btn').onclick = () => {
  $('death').classList.add('hidden');
  const P = G.player;
  if (G.stage < 8) G.dna = Math.floor(G.dna * 0.75);
  else G.money = Math.floor(G.money * 0.9);
  let point = null;
  if (G.mode === 'micro') point = micro.randomPoint();
  else if (G.stage === 2) point = oceanSpawn();
  else if (G.respawnPoint) point = G.respawnPoint.clone();
  else if (G.village) point = new THREE.Vector3(G.village.x + 3, 0, G.village.z + 3);
  else point = landSpawn();
  if (G.mode === 'world' && G.stage !== 2) point.y = world.height(point.x, point.z) + 0.5;
  G.disease = null;
  P.respawn(point);
  P.camInit = false;
  G.paused = !!G.panel;
};

// ------------------------------------------------------------------ raccourcis
function globalKeys() {
  const I = G.input;
  if (I.consume('pause')) {
    if (G.building) G.buildingsSys.cancel();
    else if (G.panel) panels.close();
    else panels.open('pause');
  }
  if (I.consume('inventory')) panels.open('inventory');
  if (I.consume('build')) panels.open('build');
  if (I.consume('tech')) panels.open('tech');
  if (I.consume('genetics')) panels.open('genetics');
  if (I.consume('civ')) panels.open('civ');
  if (I.consume('map')) panels.open('map');
  if (I.consume('help')) panels.open('help');
}

// ------------------------------------------------------------------ boucle
let last = performance.now();
let saveTimer = 0;

function advanceTime(dt) {
  const t = G.time;
  t.hour += dt / HOUR_SECONDS;
  if (t.hour >= 24) {
    t.hour -= 24;
    t.day++;
    if (t.year >= 0 && G.stage >= 8) t.year += 1;
  }
}

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  G.dt = dt;
  if (G.started) {
    globalKeys();
    if (!G.paused) {
      G.elapsed += dt;
      advanceTime(dt);
      G.player.update(dt);
      G.creatures.update(dt);
      if (G.mode === 'world') {
        G.npcs.update(dt);
        G.buildingsSys.update(dt);
        world.update(dt, G.player.pos);
        civTick();
        updateRocket(dt);
      } else micro.update(dt);
      G.fx.update(dt);
      updateObjectives(dt);
      saveTimer += dt;
      if (saveTimer > 60) {
        saveTimer = 0;
        saveS.save();
      }
    } else if (G.panel === 'computer' || G.panel === 'shop') {
      // l'ordinateur et la boutique laissent le temps s'écouler
      G.elapsed += dt;
      advanceTime(dt);
      if (G.mode === 'world') civTick();
    }
    const under = G.mode === 'world' && camera.position.y < WATER;
    document.getElementById('underwater').classList.toggle('on', under);
    if (G.mode === 'world') sky.update(G.player.pos, under);
    G.hud.update(dt);
    panels.update(dt);
  }
  renderer.render(G.scene || worldScene, camera);
  G.input.endFrame();
}

// ------------------------------------------------------------------ démarrage
function boot() {
  progress(0.05);
  setTimeout(() => {
    try {
      ensureWorlds();
      progress(1);
      // Décor du menu : survol de l'île
      G.scene = worldScene;
      sky.update(new THREE.Vector3(), false);
      camera.position.set(0, 120, 420);
      camera.lookAt(0, 0, 0);
      document.getElementById('loading').classList.add('hidden');
      showMenu();
      frame();
      menuOrbit();
    } catch (e) {
      document.querySelector('#loading .ld-sub').textContent = 'Erreur : ' + e.message;
      console.error(e);
    }
  }, 50);
}

function menuOrbit() {
  if (G.started) return;
  const t = performance.now() * 0.00005;
  camera.position.set(Math.cos(t) * 480, 140, Math.sin(t) * 480);
  camera.lookAt(0, 0, 0);
  world.update(0.016, camera.position);
  sky.update(new THREE.Vector3(Math.cos(t) * 200, 0, Math.sin(t) * 200), false);
  requestAnimationFrame(menuOrbit);
}

// Expose quelques outils pour le débogage
window.__G = G;
void computeStats;
void eraOf;
void rand;
void escapeHtml;
void STAGES;
boot();
