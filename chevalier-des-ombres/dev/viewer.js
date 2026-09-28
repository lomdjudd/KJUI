import * as THREE from 'three';
import { createCharMaterial, createSpectralMaterial } from '../src/gfx/materials.js';
import { buildHumanoid, buildQuadruped, buildSpider, buildBat, buildBlob, buildSerpent, buildWisp, buildEye, buildTentacle, buildMimic, buildDragon, buildWeapon, buildShield } from '../src/actors/models.js';
import { Animator } from '../src/actors/anims.js';
import { makeEnvironment } from '../src/gfx/envmap.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setSize(1280, 720);
r.toneMapping = THREE.ACESFilmicToneMapping;
r.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x201830);
scene.environment = makeEnvironment(r, { skyTop: 0x1a1030, horizon: 0x4a2a6a, accent: 0x7a3cff, rim: 0x39ff9a });
const cam = new THREE.PerspectiveCamera(40, 1280 / 720, 0.1, 100);
scene.add(new THREE.HemisphereLight(0x8878c8, 0x201828, 1.2));
const dl = new THREE.DirectionalLight(0xffffff, 2.5); dl.position.set(3, 6, 5); scene.add(dl);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x302838 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);

const mat = createCharMaterial();
const list = [];
function place(built, x, z = 0, opts = {}, scale = 1) {
  built.mesh.position.set(x, 0, z);
  built.mesh.scale.setScalar(scale);
  scene.add(built.mesh);
  const an = new Animator(built, opts);
  list.push({ built, an, opts });
  return { built, an };
}
const mode = params.get('m') || 'lineup';
const pose = params.get('p');
if (mode === 'lineup') {
  const k = place(buildHumanoid({ torso: 'tabard', head: 'helm_great', extras: ['cape'], c: { main: 0x6a6a78, cloth: 0x4a1060, eyes: 0x9a4dff } }, mat), -3.2, 0, { stance: '1h' });
  const w = buildWeapon({ type: 'sword', look: { glow: 0x9a4dff } }, mat); w.rotation.x = Math.PI / 2; k.built.bones.handR.add(w);
  const sh = buildShield({ shape: 'heater' }, mat); sh.position.set(0.04, -0.3, 0); sh.rotation.set(Math.PI / 2, 0, 0); k.built.bones.foreL.add(sh);
  place(buildHumanoid({ torso: 'armor', head: 'helm_horned', c: { main: 0x4a3a6a, trim: 0x2a2040, eyes: 0xff2020 }, bulk: 1.15 }, mat), -1.8, 0, { stance: '2h' });
  place(buildHumanoid({ torso: 'bones', head: 'skull', arms: 'bone', legs: 'bone' }, mat), -0.6, 0, { stance: '1h' });
  place(buildHumanoid({ torso: 'robe', head: 'lich', arms: 'robe', legs: 'robe', c: { cloth: 0x1a1a24, skin: 0x5a7a9a } }, mat), 0.6, 0, { stance: 'caster' });
  const g = buildHumanoid({ torso: 'tattered', head: 'skull', arms: 'bone', legs: 'none', c: { cloth: 0x60ffa0 } }, createSpectralMaterial(0x39ff9a)); place(g, 1.8, 0, { hover: 1, stance: 'claws' });
  place(buildHumanoid({ torso: 'flesh', head: 'ghoul', arms: 'claws', legs: 'flesh', c: { skin: 0x7a8a6a } }, mat), 3.0, 0, { stance: 'claws', hunch: 0.4 });
  place(buildQuadruped({ type: 'wolf' }, mat), -2.5, 2.5);
  place(buildSpider({}, mat), -0.8, 2.5);
  place(buildBat({}, mat), 0.5, 2.5);
  place(buildBlob({}, mat), 1.6, 2.5);
  place(buildMimic({}, mat), 2.8, 2.5);
  cam.position.set(0, 2.2, 9); cam.lookAt(0, 1, 1);
} else if (mode === 'big') {
  place(buildSerpent({}, mat), -4, 0);
  place(buildWisp({}, mat), -2, 3);
  place(buildEye({}, mat), 0, 3);
  place(buildTentacle({}, mat), 2.5, 1);
  place(buildDragon({}, mat), 0, -4, {}, 1);
  place(buildQuadruped({ type: 'toad' }, mat), -2, 5);
  place(buildHumanoid({ torso: 'stone', head: 'stone', arms: 'stone', legs: 'stone', bulk: 1.5, c: { main: 0x6a6070, glow: 0x39ff9a } }, mat), 4.5, 3, { stance: 'brute' });
  cam.position.set(0, 5, 14); cam.lookAt(0, 1, 0);
} else if (mode === 'pose') {
  const k = place(buildHumanoid({ torso: 'tabard', head: 'helm_great', extras: ['cape'], c: { main: 0x6a6a78, cloth: 0x4a1060, eyes: 0x9a4dff } }, mat), 0, 0, { stance: params.get('s') || '1h', twoHanded: params.get('s') === '2h' });
  const w = buildWeapon({ type: params.get('w') || 'sword', look: { glow: 0x9a4dff } }, mat); w.rotation.x = Math.PI / 2; k.built.bones.handR.add(w);
  k.built.mesh.rotation.y = parseFloat(params.get('ry') || '0.6');
  cam.position.set(0, 1.4, 4.2); cam.lookAt(0, 1.1, 0);
}
let t = 0;
const T = parseFloat(params.get('t') || '0.45');
function frame() {
  const dt = 1 / 60;
  t += dt;
  for (const o of list) {
    if (pose && !o.an.action && t < 0.1) o.an.play(pose, 1);
    if (pose && o.an.action) { o.an.action.t = T * o.an.action.dur; o.an.action.speed = 0; }
    o.an.update(dt, { speed: parseFloat(params.get('v') || '0'), grounded: true, blocking: params.get('b') === '1' });
  }
  r.render(scene, cam);
}
for (let i = 0; i < 90; i++) frame();
window.__done = true;
