// Vignettes des pièces (rendu hors écran, mises en cache).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildPartModel, animatePart } from '../parts/models.js';
import { PART_BY_ID } from '../parts/catalog.js';

let R = null, scene, camera, cache = new Map(), queue = [], running = false;

function init() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 160;
  R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.setSize(160, 160, false);
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  const key = new THREE.DirectionalLight('#fff', 2.2);
  key.position.set(-3, 4, -5);
  scene.add(key);
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#302820', 0.6));
  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
}

function renderOne(id) {
  if (!R) init();
  const def = PART_BY_ID[id];
  const { root, info } = buildPartModel(id);
  if (def.legs || def.solar || def.antenna) animatePart(info, { deploy: def.legs ? 0.6 : 1 });
  const holder = new THREE.Group();
  holder.add(root);
  scene.add(holder);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const rad = Math.max(size.x, size.y, size.z) * 0.62 + 0.02;
  const dist = rad / Math.sin((camera.fov * Math.PI) / 360);
  const dir = new THREE.Vector3(-0.55, 0.38, -1).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.near = dist / 50;
  camera.far = dist * 5;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  R.render(scene, camera);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(holder);
  return url;
}

function pump() {
  if (!queue.length) { running = false; return; }
  running = true;
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < 24) {
    const { id, cb } = queue.shift();
    if (!cache.has(id)) {
      try { cache.set(id, renderOne(id)); } catch (e) { cache.set(id, ''); console.warn('vignette', id, e); }
    }
    cb(cache.get(id));
  }
  setTimeout(pump, 16);
}

export function thumb(id, cb) {
  if (cache.has(id)) { cb(cache.get(id)); return; }
  queue.push({ id, cb });
  if (!running) pump();
}
