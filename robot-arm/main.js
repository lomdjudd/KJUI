import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeMaterials } from './materials.js';
import { buildArm, clampJoints, JOINT_NAMES, LIMITS } from './arm.js';
import { buildScene } from './scene.js';
import { BLEND, createMotions, HOME_Q } from './motions.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sm = (x) => x * x * (3 - 2 * x);
const D = Math.PI / 180;
const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');

// ---------------------------------------------------------------- moteur 3D
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const M = makeMaterials();
const props = buildScene(renderer, M);
const { scene } = props;
const arm = buildArm(M);
scene.add(arm.root, arm.leaders);

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
const BASE_TARGET_Y = 0.95;
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, BASE_TARGET_Y, 0);
controls.autoRotateSpeed = 1.1;

const PRESETS = {
  iso: new THREE.Vector3(3.9, 2.2, 4.4),
  front: new THREE.Vector3(6.2, 1.5, 0.001),
  side: new THREE.Vector3(0.001, 1.4, 6.4),
  top: new THREE.Vector3(0.01, 8.2, 0.9),
};
const zoomFor = (e) => 1 + 0.8 * e; // recul de la caméra en vue éclatée
const narrow = () => (window.innerWidth <= 820 ? 0.74 : 1); // recul réduit sur petit écran
camera.position.copy(controls.target).add(PRESETS.iso.clone().multiplyScalar(narrow()));

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // sur portrait (mobile) on élargit le champ pour garder le bras entier à l'écran
  camera.fov = w / h < 0.8 ? 52 : 38;
  applyViewOffset();
}

// Décale l'image pour que le bras reste visible à côté du panneau (ou au-dessus du tiroir sur mobile)
function applyViewOffset() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w > 820) camera.setViewOffset(w, h, -176, 0, w, h);
  else {
    const open = $('#panel').classList.contains('open');
    camera.setViewOffset(w, h, 0, h * (open ? 0.2 : 0.06), w, h);
  }
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- état
const motions = createMotions(arm, props);
const byId = Object.fromEntries(motions.map((m) => [m.id, m]));
byId.display = {
  id: 'display',
  name: 'Vue éclatée',
  desc: 'Bras tendu pour mieux lire l’empilement des pièces.',
  start() {},
  update: () => ({ q: [0, 0, 0, 0, 0, 0], g: 1 }),
};

const S = {
  q: HOME_Q.slice(),
  g: 1,
  prevQ: HOME_Q.slice(),
  prevG: 1,
  mode: 'home',
  motion: byId.home,
  modeT: 0,
  manualQ: HOME_Q.slice(),
  manualG: 1,
  speed: 1,
  paused: false,
  explode: 0,
  explodeTarget: 0,
  framedE: 0,
  selected: null,
  fly: null,
  focus: null,
  dragging: null,
};

const LED = { manual: 0x2dff7a, auto: 0x2cd5ff, explode: 0xffb020 };

// ---------------------------------------------------------------- interface : mouvements
const motionList = $('#motion-list');
const motionDesc = $('#motion-desc');
motions.forEach((m) => {
  const b = document.createElement('button');
  b.className = 'motion';
  b.dataset.id = m.id;
  b.innerHTML = `<span class="ico">${m.icon}</span><b>${m.name}</b>`;
  b.addEventListener('click', () => {
    if (S.explodeTarget > 0) setExplode(false, false);
    setMode(m.id);
  });
  motionList.append(b);
});

function setMode(id) {
  S.motion?.stop?.();
  S.prevQ = S.q.slice();
  S.prevG = S.g;
  S.mode = id;
  S.modeT = 0;
  if (id === 'manual') {
    S.motion = null;
    S.manualQ = S.q.slice();
    S.manualG = S.g;
  } else {
    S.motion = byId[id];
    S.motion.start();
  }
  props.trail.setVisible(id === 'eight');
  $$('.motion').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  motionDesc.textContent = byId[id]?.desc ?? 'Pilotage manuel des six axes.';
  $('#hud-mode').textContent = byId[id]?.name ?? 'Pilotage manuel';
  updateLed();
}

function updateLed() {
  const c = S.explodeTarget > 0.02 || S.explode > 0.02 ? LED.explode : S.mode === 'manual' ? LED.manual : LED.auto;
  arm.setStatusColor(c);
  const led = $('#hud-led');
  led.style.background = led.style.color = '#' + c.toString(16).padStart(6, '0');
}

$('#speed').addEventListener('input', (e) => {
  S.speed = +e.target.value;
  $('#speed-out').textContent = fmt(S.speed) + '×';
  paintRange(e.target);
});
$('#btn-pause').addEventListener('click', togglePause);
function togglePause() {
  S.paused = !S.paused;
  $('#btn-pause').textContent = S.paused ? '▶ Reprendre' : '⏸ Pause';
}
$('#btn-reset-cube').addEventListener('click', () => {
  props.resetCube();
  if (S.mode === 'pick') byId.pick.start();
});

// ---------------------------------------------------------------- interface : axes
const jointList = $('#joint-list');
const jointUI = JOINT_NAMES.map((name, i) => {
  const [lo, hi] = LIMITS[i];
  const wrap = document.createElement('div');
  wrap.className = 'joint';
  wrap.innerHTML = `
    <div class="head"><span>${name}</span><output>0°</output></div>
    <input type="range" min="${lo}" max="${hi}" step="0.5" value="0" aria-label="${name}" />
    <div class="lim"><span>${lo}°</span><span>${hi}°</span></div>`;
  jointList.append(wrap);
  const input = $('input', wrap);
  input.addEventListener('input', () => {
    enterManual();
    S.manualQ[i] = +input.value * D;
  });
  trackDrag(input, i);
  return { input, out: $('output', wrap) };
});
const gripWrap = document.createElement('div');
gripWrap.className = 'joint';
gripWrap.innerHTML = `
  <div class="head"><span>Pince · ouverture</span><output>100 %</output></div>
  <input type="range" min="0" max="100" step="1" value="100" aria-label="Ouverture de la pince" />
  <div class="lim"><span>fermée</span><span>ouverte</span></div>`;
jointList.append(gripWrap);
const gripUI = { input: $('input', gripWrap), out: $('output', gripWrap) };
gripUI.input.addEventListener('input', () => {
  enterManual();
  S.manualG = +gripUI.input.value / 100;
});
trackDrag(gripUI.input, 'g');

function trackDrag(input, key) {
  input.addEventListener('pointerdown', () => (S.dragging = key));
  input.addEventListener('keydown', () => (S.dragging = key));
  const end = () => {
    if (S.dragging === key) S.dragging = null;
  };
  input.addEventListener('pointerup', end);
  input.addEventListener('pointercancel', end);
  input.addEventListener('blur', end);
  input.addEventListener('keyup', end);
}

function enterManual() {
  if (S.mode !== 'manual') {
    if (S.explodeTarget > 0) setExplode(false, false);
    setMode('manual');
  }
}
$('#btn-home').addEventListener('click', () => {
  setExplode(false, false);
  setMode('home');
});
$('#btn-zero').addEventListener('click', () => {
  S.explodeTarget = 0;
  setMode('display');
});

function paintRange(el) {
  const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.setProperty('--fill', pct + '%');
}
$$('input[type=range]').forEach(paintRange);

// ---------------------------------------------------------------- interface : onglets & panneau
$$('.tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
    $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
    $('#panel').classList.add('open');
    applyViewOffset();
  })
);
$('#panel-handle').addEventListener('click', () => {
  $('#panel').classList.toggle('open');
  applyViewOffset();
});
if (window.innerWidth <= 820) {
  $('#panel').classList.remove('open');
  applyViewOffset();
}

// ---------------------------------------------------------------- interface : pièces & éclaté
const partsList = $('#parts-list');
const labels = $('#labels');
const partUI = new Map();
{
  let group = null;
  arm.parts.forEach((p, i) => {
    const { def } = p.userData;
    if (def.group !== group) {
      group = def.group;
      const h = document.createElement('h3');
      h.textContent = group;
      partsList.append(h);
    }
    const b = document.createElement('button');
    b.className = 'part';
    b.innerHTML = `<span class="n">${i + 1}</span><span>${def.name}</span>`;
    b.addEventListener('click', () => select(p, true));
    b.addEventListener('mouseenter', () => arm.setHighlight({ hovered: p }));
    b.addEventListener('mouseleave', () => arm.setHighlight({ hovered: null }));
    partsList.append(b);

    const t = document.createElement('div');
    t.className = 'tag';
    t.textContent = i + 1;
    t.title = def.name;
    t.addEventListener('click', () => select(p, true));
    labels.append(t);
    partUI.set(p, { item: b, tag: t, index: i + 1 });
  });
}

function setExplode(on, switchMode = true) {
  S.explodeTarget = on ? 1 : 0;
  if (on && switchMode) setMode('display');
  $('#btn-explode').classList.toggle('on', on);
  $('#btn-explode').textContent = on ? '🔧 Assembler' : '💥 Vue éclatée';
  updateLed();
}
$('#btn-explode').addEventListener('click', () => {
  const on = S.explodeTarget < 0.5;
  setExplode(on);
  if (!on) setMode('home');
});
const explodeInput = $('#explode');
explodeInput.addEventListener('input', () => {
  const v = +explodeInput.value;
  S.explodeTarget = v;
  paintRange(explodeInput);
  if (v > 0.02 && S.mode !== 'display' && S.mode !== 'manual') setMode('display');
  $('#btn-explode').classList.toggle('on', v > 0.5);
  $('#btn-explode').textContent = v > 0.5 ? '🔧 Assembler' : '💥 Vue éclatée';
  updateLed();
});

$$('.seg button').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.seg button').forEach((x) => x.classList.toggle('active', x === b));
    arm.setView(b.dataset.render);
  })
);
$('#chk-isolate').addEventListener('change', () => arm.setHighlight({ isolate: $('#chk-isolate').checked }));

// carte d'information sur la pièce choisie
function select(part, focus = false) {
  S.selected = part;
  arm.setHighlight({ selected: part, isolate: $('#chk-isolate').checked });
  for (const [p, ui] of partUI) {
    ui.item.classList.toggle('active', p === part);
    ui.tag.classList.toggle('active', p === part);
  }
  const info = $('#info');
  if (!part) {
    info.classList.add('hidden');
    return;
  }
  const { def } = part.userData;
  const ui = partUI.get(part);
  $('#info-num').textContent = ui.index;
  $('#info-group').textContent = def.group;
  $('#info-name').textContent = def.name;
  $('#info-desc').textContent = def.desc;
  $('#info-mat').textContent = def.material;
  info.classList.remove('hidden');
  if (focus) {
    S.focus = { t: 0 };
    ui.item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
$('#info-close').addEventListener('click', () => select(null));

// ---------------------------------------------------------------- interface : caméra
function flyTo(name) {
  const e = S.explode;
  const to = PRESETS[name].clone().multiplyScalar(zoomFor(e) * narrow());
  const from = camera.position.clone().sub(controls.target);
  S.fly = { t: 0, from: new THREE.Spherical().setFromVector3(from), to: new THREE.Spherical().setFromVector3(to) };
  $$('#views [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
}
$$('#views [data-view]').forEach((b) => b.addEventListener('click', () => flyTo(b.dataset.view)));
$('#btn-rotate').addEventListener('click', (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.classList.toggle('on', controls.autoRotate);
});
$('#btn-full').addEventListener('click', () => {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  } catch (_) {
    /* plein écran indisponible */
  }
});
controls.addEventListener('start', () => {
  S.fly = null;
  S.focus = null;
  $$('#views [data-view]').forEach((b) => b.classList.remove('on'));
});

// ---------------------------------------------------------------- picking
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
let down = null;

function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function pickPart(e) {
  setRay(e);
  const hits = raycaster.intersectObject(arm.root, true);
  for (const h of hits) {
    if (!h.object.visible) continue;
    const p = arm.findPart(h.object);
    if (p) return p;
  }
  return null;
}
canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 500;
  down = null;
  if (moved > 6 || !quick) return;
  const part = pickPart(e);
  if (part) return select(part);
  if (S.mode === 'target') {
    setRay(e);
    if (raycaster.ray.intersectPlane(floorPlane, hit)) byId.target.setGoal(hit.x, hit.z);
    return;
  }
  select(null);
});
let hoverPart = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  const p = pickPart(e);
  if (p !== hoverPart) {
    hoverPart = p;
    arm.setHighlight({ hovered: p });
    canvas.style.cursor = p ? 'pointer' : S.mode === 'target' ? 'crosshair' : 'grab';
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePause();
  } else if (e.key === 'e' || e.key === 'E') $('#btn-explode').click();
  else if (e.key === 'Escape') select(null);
  else if (/^[1-7]$/.test(e.key)) $$('.motion')[+e.key - 1]?.click();
});

// ---------------------------------------------------------------- boucle de rendu
let lastT = performance.now();
const tcpPos = new THREE.Vector3();
const tmp = new THREE.Vector3();
const sph = new THREE.Spherical();
const offset = new THREE.Vector3();
let lastHud = '';

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const rdt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const dt = S.paused ? 0 : rdt * S.speed;
  S.modeT += rdt;

  // --- consigne articulaire
  if (S.mode === 'manual') {
    const k = 1 - Math.exp(-12 * rdt);
    for (let i = 0; i < 6; i++) S.q[i] += (S.manualQ[i] - S.q[i]) * k;
    S.g += (S.manualG - S.g) * k;
  } else {
    const out = S.motion.update(dt, rdt);
    const w = sm(clamp(S.modeT / BLEND, 0, 1));
    const target = clampJoints(out.q);
    for (let i = 0; i < 6; i++) S.q[i] = S.prevQ[i] + (target[i] - S.prevQ[i]) * w;
    S.g = S.prevG + (clamp(out.g, 0, 1) - S.prevG) * w;
  }

  // --- éclatement animé
  const de = S.explodeTarget - S.explode;
  S.explode = Math.abs(de) < 0.0008 ? S.explodeTarget : S.explode + de * (1 - Math.exp(-4.5 * rdt));

  arm.setJoints(S.q);
  arm.setGripper(S.g);
  arm.setExplode(S.explode);
  arm.update();
  props.update(rdt);

  // --- caméra : suit la hauteur du bras éclaté
  if (Math.abs(S.explode - S.framedE) > 1e-5) {
    const dE = S.explode - S.framedE;
    offset.copy(camera.position).sub(controls.target);
    offset.multiplyScalar(zoomFor(S.explode) / zoomFor(S.framedE));
    controls.target.y += 1.2 * dE;
    camera.position.copy(controls.target).add(offset);
    S.framedE = S.explode;
    if (S.explode > 0.02 !== S.ledExploded) {
      S.ledExploded = S.explode > 0.02;
      updateLed();
    }
  }
  if (S.fly) {
    S.fly.t = Math.min(1, S.fly.t + rdt / 0.9);
    const k = sm(S.fly.t);
    const a = S.fly.from;
    const b = S.fly.to;
    let dTheta = b.theta - a.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    sph.set(a.radius + (b.radius - a.radius) * k, a.phi + (b.phi - a.phi) * k, a.theta + dTheta * k);
    camera.position.copy(controls.target).add(offset.setFromSpherical(sph));
    if (S.fly.t >= 1) S.fly = null;
  }
  if (S.focus) {
    S.focus.t += rdt;
    if (S.selected) {
      S.selected.getWorldPosition(tmp);
      const before = controls.target.clone();
      controls.target.lerp(tmp, 1 - Math.exp(-6 * rdt));
      camera.position.add(controls.target.clone().sub(before));
    }
    if (S.focus.t > 1.4) S.focus = null;
  }
  controls.update();

  // --- repères numérotés
  const showTags = $('#chk-tags').checked && S.explode > 0.25;
  labels.style.display = showTags ? 'block' : 'none';
  if (showTags) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const [p, ui] of partUI) {
      p.getWorldPosition(tmp).project(camera);
      const ok = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      ui.tag.style.display = ok ? 'grid' : 'none';
      if (ok) ui.tag.style.transform = `translate(${((tmp.x + 1) / 2) * w - 11}px, ${((1 - tmp.y) / 2) * h - 11}px)`;
      ui.tag.style.opacity = clamp((S.explode - 0.25) * 4, 0, 1);
    }
  }

  // --- synchronisation de l'interface
  for (let i = 0; i < 6; i++) {
    const deg = S.q[i] / D;
    const ui = jointUI[i];
    if (S.dragging !== i) {
      ui.input.value = deg;
      paintRange(ui.input);
    }
    ui.out.textContent = fmt(deg) + '°';
  }
  if (S.dragging !== 'g') {
    gripUI.input.value = S.g * 100;
    paintRange(gripUI.input);
  }
  gripUI.out.textContent = Math.round(S.g * 100) + ' %';
  if (document.activeElement !== explodeInput) {
    explodeInput.value = S.explode;
    paintRange(explodeInput);
  }
  $('#explode-out').textContent = Math.round(S.explode * 100) + ' %';

  arm.tcp.getWorldPosition(tcpPos);
  const hud = S.explode < 0.02 ? [tcpPos.x, tcpPos.y, tcpPos.z].map((v) => Math.round(v * 1000)).join('|') : '—';
  if (hud !== lastHud) {
    lastHud = hud;
    const parts = hud.split('|');
    ['x', 'y', 'z'].forEach((a, i) => ($('#hud-' + a).textContent = parts[i] ?? '—'));
  }

  renderer.render(scene, camera);
}

setMode('pick');
$('#btn-pause').textContent = '⏸ Pause';
canvas.style.cursor = 'grab';
frame();

// accès pour le débogage / les tests
window.__bras = { arm, props, S, motions: byId, setMode, setExplode, select, camera, controls, renderer };
