// Mon Système Solaire : point d'entrée (rendu, caméra, passage 2D → 3D, clics).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, YEAR } from './world.js';
import { loadCrafts } from './crafts.js';
import { createActivities } from './activities.js';
import { ICONS, icon } from './icons.js';
import { THUMBS, renderBodyThumbs, renderCraftThumbs } from './thumbs.js';

// Icônes de la console
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon] || ''; });
document.getElementById('bot-img').innerHTML = `<span class="ico">${ICONS.helmet}</span>`;
import { $, settings, unlockAudio, sfx, say, initMascot, toast, hideInfo, setMusic, stopSpeaking, collapseBubble } from './ui.js';

const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches;
const pixelRatio = Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 1.75);

// ---------- Rendu ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.id = 'labels';
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const BG_2D = new THREE.Color('#0f2150');
const BG_3D = new THREE.Color('#000000');
scene.background = BG_2D.clone();

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.02, 5000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.minDistance = 0.6;
controls.maxDistance = 420;
controls.rotateSpeed = 0.6;

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.4, 0.45, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- État partagé ----------
const app = {
  THREE, scene, camera, controls, renderer, bloom,
  world: null, crafts: new Map(), rocketScene: null,
  dim: 0, dimFrom: 0, dimTo: 0, dimT: 1, dimDur: 3.2,
  timeScale: 1, timeIndex: 2, simYears: 0, timeFactor: 1,
  follow: null, followDist: 10, flying: false, flyT: 0,
  activity: null, busy: false,
};
window.__app = app;

// ---------- Caméra ----------
function topPose() {
  const fovV = THREE.MathUtils.degToRad(camera.fov / 2);
  const need = camera.aspect < 1 ? 76 : 88; // rayon à montrer (jusqu'à Pluton)
  const hV = need / Math.tan(fovV);
  const hH = need / (Math.tan(fovV) * camera.aspect);
  return { pos: new THREE.Vector3(0, Math.max(hV, hH) * 1.02, 0.001), target: new THREE.Vector3() };
}
function overviewPose() {
  const r = camera.aspect < 1 ? 150 / Math.max(camera.aspect, 0.5) * 0.75 : 118;
  return { pos: new THREE.Vector3(-r * 0.25, r * 0.42, r * 0.88), target: new THREE.Vector3(6, 0, 0) };
}

const sph0 = new THREE.Spherical(), sph1 = new THREE.Spherical();
const trans = { from: null, to: null };

function setDim(target, { instant = false } = {}) {
  if (app.dimTo === target && app.dimT >= 1) return;
  app.follow = null;
  app.flying = false;
  app.dimFrom = app.dim;
  app.dimTo = target;
  app.dimT = instant ? 1 : 0;
  trans.from = { pos: camera.position.clone(), target: controls.target.clone() };
  trans.to = target === 1 ? overviewPose() : topPose();
  controls.enabled = false;
  if (!instant) (target === 1 ? sfx.warp : sfx.whoosh)();
  updateDimButton();
  if (instant) finishDim();
}
function finishDim() {
  app.dim = app.dimTo;
  camera.position.copy(trans.to.pos);
  controls.target.copy(trans.to.target);
  controls.enabled = true;
  controls.enableRotate = app.dim === 1;
  controls.maxPolarAngle = Math.PI;
  controls.mouseButtons.LEFT = app.dim === 1 ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
  controls.touches.ONE = app.dim === 1 ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
  app.world.setDimension(app.dim);
  app.onDimChanged && app.onDimChanged(app.dim);
}
app.setDim = setDim;
app.whenDim = (target) => new Promise((resolve) => {
  if (app.dim === target && app.dimT >= 1) return resolve();
  setDim(target);
  const iv = setInterval(() => { if (app.dimT >= 1 && app.dim === target) { clearInterval(iv); resolve(); } }, 50);
});

function updateDim(dt) {
  if (app.dimT >= 1) return;
  app.dimT = Math.min(1, app.dimT + dt / app.dimDur);
  const t = app.dimT;
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
  app.dim = THREE.MathUtils.lerp(app.dimFrom, app.dimTo, e);
  app.world.setDimension(app.dim);

  // Trajectoire en arc : on tourne autour du système en s'inclinant
  const tgt = trans.from.target.clone().lerp(trans.to.target, e);
  sph0.setFromVector3(trans.from.pos.clone().sub(trans.from.target));
  sph1.setFromVector3(trans.to.pos.clone().sub(trans.to.target));
  let dTheta = sph1.theta - sph0.theta;
  if (dTheta > Math.PI) dTheta -= Math.PI * 2;
  if (dTheta < -Math.PI) dTheta += Math.PI * 2;
  const extraSpin = app.dimTo === 1 ? -0.9 : 0.6;
  const r = THREE.MathUtils.lerp(sph0.radius, sph1.radius, e) * (1 + Math.sin(e * Math.PI) * (app.dimTo === 1 ? -0.25 : 0.1));
  const s = new THREE.Spherical(r, Math.max(0.0005, THREE.MathUtils.lerp(sph0.phi, sph1.phi, e)), sph0.theta + dTheta * e + Math.sin(e * Math.PI) * extraSpin);
  camera.position.setFromSpherical(s).add(tgt);
  controls.target.copy(tgt);
  scene.background.copy(BG_2D).lerp(BG_3D, THREE.MathUtils.smoothstep(app.dim, 0.1, 0.8));
  if (app.dimT >= 1) finishDim();
}

// Suivre / voler vers un objet
const followPos = new THREE.Vector3(), lastFollow = new THREE.Vector3();
function bodyWorldPos(b, out) {
  return (b.group || b.mesh).getWorldPosition(out);
}
function focusOn(body, dist, { dir = null } = {}) {
  if (!body) return;
  app.follow = body;
  // Un engin posé sur un astre : on arrête la rotation de l'astre pour bien le voir
  app.world.opt.freeze = body.isCraft && body.fixed ? body.data.host : null;
  app.flying = true;
  app.flyT = 0;
  app.followDist = (dist || Math.max(body.radius * 4.2, 2.2)) * (innerWidth <= 760 ? 1.3 : 1);
  bodyWorldPos(body, followPos);
  lastFollow.copy(followPos);
  if (dir) app.followDir = dir.clone().normalize();
  else if (app.dim < 0.5) app.followDir = new THREE.Vector3(0, 1, 0.001);
  else {
    // On regarde depuis le côté éclairé par le Soleil, un peu en hauteur
    const toSun = followPos.clone().negate();
    if (toSun.lengthSq() < 1) toSun.set(0.3, 0.2, 1);
    toSun.normalize();
    const side = new THREE.Vector3().crossVectors(toSun, new THREE.Vector3(0, 1, 0)).normalize();
    app.followDir = toSun.multiplyScalar(0.75).add(side.multiplyScalar(0.55)).add(new THREE.Vector3(0, 0.38, 0)).normalize();
  }
  controls.enabled = true;
}
app.focusOn = focusOn;
app.clearFocus = () => { app.follow = null; app.flying = false; app.world.opt.freeze = null; };
app.resetView = () => {
  app.follow = null;
  app.flying = false;
  const p = app.dim >= 0.5 ? overviewPose() : topPose();
  app.fly = { pos: p.pos, target: p.target, t: 0 };
};

const tmpV = new THREE.Vector3();
function updateCamera(dt) {
  if (app.dimT < 1) return;
  const a = 1 - Math.exp(-dt * 2.6);
  if (app.fly) {
    camera.position.lerp(app.fly.pos, a);
    controls.target.lerp(app.fly.target, a);
    if (camera.position.distanceTo(app.fly.pos) < 0.5) app.fly = null;
  }
  if (!app.follow) return;
  bodyWorldPos(app.follow, followPos);
  if (app.flying) {
    app.flyT += dt;
    controls.target.lerp(followPos, a);
    const want = tmpV.copy(app.followDir).multiplyScalar(app.followDist).add(followPos);
    camera.position.lerp(want, a);
    if (camera.position.distanceTo(want) < app.followDist * 0.04 || app.flyT > 5) app.flying = false;
  } else {
    // L'objet bouge : la caméra le suit, on peut toujours tourner autour
    const delta = tmpV.copy(followPos).sub(lastFollow);
    camera.position.add(delta);
    controls.target.add(delta);
    controls.target.lerp(followPos, a * 0.5);
  }
  lastFollow.copy(followPos);
}

// ---------- Temps ----------
const SPEEDS = [
  { v: 0, ico: 'pause', txt: 'Pause' },
  { v: 0.25, ico: 'slow', txt: 'x¼' },
  { v: 1, ico: 'play', txt: 'x1' },
  { v: 5, ico: 'fast', txt: 'x5' },
  { v: 25, ico: 'faster', txt: 'x25' },
  { v: 100, ico: 'bolt', txt: 'x100' },
];
function setTimeIndex(i) {
  app.timeIndex = i;
  app.timeScale = SPEEDS[i].v;
  $('time-ico').innerHTML = ICONS[SPEEDS[i].ico];
  $('time-txt').textContent = SPEEDS[i].txt;
  document.querySelectorAll('#speed-row button').forEach((b, j) => b.classList.toggle('on', j === i));
  const daysPerSec = (365.25 / YEAR) * app.timeScale;
  $('time-explain').textContent = app.timeScale === 0
    ? 'Le temps est arrêté : les planètes font une pause !'
    : `Ici, 1 seconde = ${daysPerSec < 10 ? daysPerSec.toFixed(1).replace('.', ',') : Math.round(daysPerSec)} jours. Regarde : Mercure file comme une flèche, et Neptune avance à peine… Plus une planète est loin du Soleil, plus son tour est long !`;
}
app.setTimeIndex = setTimeIndex;
SPEEDS.forEach((s, i) => {
  const b = document.createElement('button');
  b.innerHTML = `${icon(s.ico)}<small>${s.txt}</small>`;
  b.addEventListener('click', () => { sfx.click(); setTimeIndex(i); });
  $('speed-row').appendChild(b);
});

// ---------- Clics et survol ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;
let hovered = null;

function pickAt(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(app.world.pickables, false);
  for (const h of hits) {
    const b = h.object.userData.body;
    if (!b) continue;
    if (b.isCraft && app.dim < 0.8) continue;
    if (b.isMoon && app.dim < 0.6) continue;
    if (!h.object.parent.visible) continue;
    return b;
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  const long = performance.now() - downAt.t;
  downAt = null;
  if (moved > 8 || long > 600 || app.dimT < 1) return;
  const b = pickAt(e.clientX, e.clientY);
  if (b) app.activities.pick(b);
  else app.activities.pickEmpty && app.activities.pickEmpty();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !app.world) return;
  hovered = pickAt(e.clientX, e.clientY);
  canvas.style.cursor = hovered ? 'pointer' : '';
});

// ---------- Boutons ----------
function updateDimButton() {
  $('seg-2d').classList.toggle('on', app.dimTo === 0);
  $('seg-3d').classList.toggle('on', app.dimTo === 1);
}
document.querySelectorAll('#dim-seg button').forEach((b) => b.addEventListener('click', () => {
  $('dim-seg').classList.remove('glow');
  const k = +b.dataset.dim;
  if (k !== app.dimTo) app.activities.switchDim(k);
}));
function togglePop(id) {
  ['settings', 'time-panel'].forEach((p) => { if (p !== id) $(p).classList.add('hidden'); });
  $(id).classList.toggle('hidden');
  sfx.click();
}
$('settings-btn').addEventListener('click', () => togglePop('settings'));
$('time-chip').addEventListener('click', () => togglePop('time-panel'));
canvas.addEventListener('pointerdown', () => { $('settings').classList.add('hidden'); $('time-panel').classList.add('hidden'); collapseBubble(); });
$('opt-labels').addEventListener('change', (e) => { settings.labels = e.target.checked; document.body.classList.toggle('labels-off', !settings.labels); });
$('opt-orbits').addEventListener('change', (e) => { app.world.opt.orbits = e.target.checked; });
$('opt-voice').addEventListener('change', (e) => { settings.voice = e.target.checked; if (!settings.voice) stopSpeaking(); });
$('opt-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; });
$('opt-music').addEventListener('change', (e) => { unlockAudio(); setMusic(e.target.checked); });
$('info-close').addEventListener('click', () => { sfx.click(); hideInfo(); app.activities.infoClosed && app.activities.infoClosed(); });
document.querySelectorAll('#toolbar .tool').forEach((b) => b.addEventListener('click', () => app.activities.start(b.dataset.tool)));

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') { hideInfo(); app.activities.start('explore'); }
  if (e.key === ' ') { setTimeIndex(app.timeScale === 0 ? 2 : 0); e.preventDefault(); }
  if (e.key === '3') app.activities.switchDim(1);
  if (e.key === '2') app.activities.switchDim(0);
});

// ---------- Redimensionnement ----------
function resize() {
  camera.clearViewOffset();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

// ---------- Chargement ----------
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  const pct = Math.round((loaded / total) * 100);
  $('load-fill').style.width = `${pct}%`;
  $('load-pct').textContent = `${pct} %`;
};
const tl = new THREE.TextureLoader(manager);
const T = {};
const files = {
  stars: 'stars.jpg', moon: 'moon_1024.jpg', venus: 'venus.jpg', earthDay: 'earth_atmos_2048.jpg', earthNight: 'earth_lights_2048.png',
  earthSpec: 'earth_specular_2048.jpg', earthClouds: 'earth_clouds_1024.png', mars: 'mars.jpg', jupiter: 'jupiter.jpg', saturn: 'saturn.jpg',
  neptune: 'neptune.jpg', pluto: 'pluto.jpg', io: 'io.jpg', europa: 'europa.jpg', ganymede: 'ganymede.jpg', callisto: 'callisto.jpg',
  titan: 'titan.jpg', charon: 'charon.jpg', phobos: 'phobos.jpg',
};
Object.entries(files).forEach(([k, f]) => {
  T[k] = tl.load('./textures/' + f, (t) => { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });
});
['earthDay', 'earthNight'].forEach((k) => { T[k].colorSpace = THREE.SRGBColorSpace; });

manager.onLoad = () => {
  if (app.world) return;
  app.world = buildWorld(scene, T, pixelRatio);
  app.activities = createActivities(app);
  const p = topPose();
  camera.position.copy(p.pos);
  controls.target.copy(p.target);
  trans.to = p;
  app.dimTo = 0;
  finishDim();
  renderer.compile(scene, camera);
  renderBodyThumbs(T);
  $('load-text').textContent = 'Systèmes prêts. Lancement autorisé.';
  $('start-btn').classList.remove('hidden');
  if (params.has('auto')) start();
};
manager.onError = (url) => console.warn('Échec de chargement :', url);

function start() {
  unlockAudio();
  sfx.pop();
  $('loader').classList.add('hidden');
  ['topbar', 'toolbar'].forEach((id) => $(id).classList.remove('hidden'));
  $('dim-seg').classList.add('glow');
  initMascot();
  setTimeIndex(2);
  app.activities.start('explore', { silent: true });
  say('Salut, je suis Cosmo, ton astronaute guide ! Voici le plan du système solaire, vu d\'en haut comme une carte. Au centre : le Soleil. Autour, 8 planètes tournent sur leur chemin, qu\'on appelle une orbite. Touche une planète pour la découvrir, ou choisis « Espace 3D » en haut de l\'écran !', { stay: 30000 });
  $('hint').textContent = 'Clique sur un astre · Glisse pour te déplacer · Molette ou pincement pour zoomer';
  $('hint').classList.remove('hidden');
  setTimeout(() => $('hint').classList.add('hidden'), 9000);

  // Les modèles 3D de la NASA arrivent pendant qu'on explore le plan
  const cs = loadCrafts(app.world);
  app.craftSys = cs;
  app.crafts = cs.crafts;
  cs.ready.then(({ rocketScene }) => {
    app.rocketScene = rocketScene;
    renderCraftThumbs(app.crafts);
    if (THUMBS.astronaut) $('bot-img').innerHTML = `<img src="${THUMBS.astronaut}" alt="">`;
    app.modelsReady = true;
    if (app.dim > 0.5) toast('Les vaisseaux de la NASA sont arrivés');
  });
  if (params.has('d3')) setTimeout(() => app.activities.switchDim(1), 300);
}
$('start-btn').addEventListener('click', start);

// ---------- Boucle ----------
const clock = new THREE.Clock();
const FIXED_DT = params.has('simdt') ? +params.get('simdt') : 0; // pour les tests automatiques
let elapsed = 0;
const hoverPos = new THREE.Vector3();
const viewOff = { x: 0, y: 0 };

// Centre de la zone d'écran laissée libre par les modules ouverts (fiche, activité)
function freeCenter() {
  const b = document.body.classList;
  if (!b.contains('info-open') && !b.contains('panel-open')) return null;
  const W = innerWidth, H = innerHeight;
  let l = 0, r = W, t = 0, bot = H;
  ['panel', 'info'].forEach((id) => {
    const el = $(id);
    if (el.classList.contains('hidden') || getComputedStyle(el).display === 'none') return;
    const R = el.getBoundingClientRect();
    if (R.width < 1 || R.height < 1) return;
    if (R.width > W * 0.7) { if (R.top > H * 0.25) bot = Math.min(bot, R.top); }
    else if (R.left + R.width / 2 < W / 2) l = Math.max(l, R.right);
    else r = Math.min(r, R.left);
  });
  if (r - l < 160) { l = 0; r = W; }
  if (bot - t < 140) { t = 0; bot = H; }
  return { fx: (l + r) / 2 / W, fy: (t + bot) / 2 / H };
}

function loop() {
  requestAnimationFrame(loop);
  const dt = FIXED_DT || Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (!app.world) { renderer.render(scene, camera); return; }

  const simDt = dt * app.timeScale * app.timeFactor;
  app.simYears += simDt / YEAR;
  $('years-count').textContent = app.simYears.toFixed(app.simYears < 10 ? 2 : 1).replace('.', ',');

  updateDim(dt);
  app.world.update(dt, simDt, elapsed, camera);
  app.craftSys && app.craftSys.update(dt, simDt, app.hideCrafts ? 0 : app.dim, camera);
  app.activities.update(dt, simDt);
  updateCamera(dt);
  controls.update();

  // Décale le centre de l'image quand la fiche d'un astre cache une partie de l'écran
  const fc = freeCenter();
  const wantX = fc ? THREE.MathUtils.clamp(1 - 2 * fc.fx, -0.8, 0.8) : 0;
  const wantY = fc ? THREE.MathUtils.clamp(1 - 2 * fc.fy, -0.8, 0.8) : 0;
  const ka = 1 - Math.exp(-dt * 4);
  viewOff.x += (wantX - viewOff.x) * ka;
  viewOff.y += (wantY - viewOff.y) * ka;
  if (Math.abs(viewOff.x) > 0.002 || Math.abs(viewOff.y) > 0.002) {
    const ax = Math.abs(viewOff.x), ay = Math.abs(viewOff.y);
    camera.setViewOffset(innerWidth * (1 + ax), innerHeight * (1 + ay), viewOff.x > 0 ? innerWidth * ax : 0, viewOff.y > 0 ? innerHeight * ay : 0, innerWidth, innerHeight);
  } else if (camera.view && camera.view.enabled) {
    camera.clearViewOffset();
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  // Anneau de survol / sélection (masqué quand on est tout près)
  const hs = app.world.hoverSprite;
  let target = hovered || app.activities.selected;
  if (target && !hovered && app.dim > 0.5) {
    bodyWorldPos(target, hoverPos);
    if (hoverPos.distanceTo(camera.position) < target.radius * (target.group.scale ? target.group.scale.x : 1) * 9) target = null;
  }
  if (target && !target.isCraft) {
    bodyWorldPos(target, hoverPos);
    hs.position.copy(hoverPos);
    const r = app.dim < 0.5 && target.r2d ? target.r2d : target.radius * (target.group.scale ? target.group.scale.x : 1);
    hs.scale.setScalar(r * (target.isSun ? 2.6 : 3.0) * (1 + Math.sin(elapsed * 4) * 0.04));
    hs.material.rotation += dt * 0.5;
    hs.material.opacity += (0.9 - hs.material.opacity) * 0.2;
  } else hs.material.opacity *= 0.85;

  // Le Soleil éclaire moins fort en mode 2D, le bloom s'intensifie en 3D
  bloom.strength = THREE.MathUtils.lerp(0.2, app.bloomOverride ?? 0.7, app.dim);
  app.world.bodies.get('moon').label.visible = app.dim > 0.6;

  composer.render();
  labelRenderer.render(scene, camera);
}
loop();
