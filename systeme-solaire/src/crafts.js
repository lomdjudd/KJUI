// Engins spatiaux : modèles 3D officiels de la NASA (glTF, domaine public).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CRAFTS } from './data.js';
import { latLonToVec3 } from './world.js';

const BASE = './models/';

// Centre le modèle et le met à la taille voulue (plus grande dimension).
export function normalizeModel(root, size) {
  const box = new THREE.Box3().setFromObject(root);
  const dims = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = size / Math.max(dims.x, dims.y, dims.z, 1e-6);
  root.position.sub(center);
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(s);
  holder.userData.dims = dims.multiplyScalar(s);
  return holder;
}

function brighten(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.noPick = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      // Les modèles NASA sont souvent très sombres/métalliques sans environnement.
      if ('metalness' in m) m.metalness = Math.min(m.metalness, 0.35);
      if ('roughness' in m) m.roughness = Math.max(m.roughness, 0.45);
      if (m.emissive && m.emissive.getHex() === 0 && m.color) {
        m.emissive = m.color.clone().multiplyScalar(0.12);
      }
    });
  });
}

export function loadCrafts(world, onProgress) {
  const loader = new GLTFLoader();
  const crafts = new Map();
  let done = 0;
  const total = CRAFTS.length + 1;

  const tick = () => { done++; onProgress && onProgress(done / total); };

  const load = (file) => new Promise((resolve) => {
    // Certains hébergeurs ne servent pas les .glb : ils peuvent fournir une version glTF embarquée (.json)
    if (window.__MODEL_EXT) file = file.replace(/\.glb$/, window.__MODEL_EXT);
    loader.load(BASE + file, (g) => resolve(g.scene), undefined, (err) => { console.warn('Modèle introuvable', file, err); resolve(null); });
  });

  const promises = CRAFTS.map(async (c) => {
    const scene = await load(c.model);
    tick();
    if (!scene) return;
    brighten(scene);
    const model = normalizeModel(scene, c.size);
    const holder = new THREE.Group();
    const popper = new THREE.Group();
    popper.add(model);
    holder.add(popper);

    const el = document.createElement('div');
    el.className = 'label craft';
    el.textContent = c.name;
    const label = new CSS2DObject(el);
    label.position.y = c.size * 0.8;
    holder.add(label);

    const pick = new THREE.Mesh(new THREE.SphereGeometry(c.size * 0.9, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    holder.add(pick);

    const craft = { data: c, id: c.id, group: holder, model, popper, label, pick, angle: Math.random() * 6.28, isCraft: true, radius: c.size * 0.5 };
    pick.userData.body = craft;
    world.pickables.push(pick);

    const host = world.bodies.get(c.host);
    if (c.id === 'perseverance') {
      // Posé sur Mars, dans le cratère Jezero : il tourne avec la planète
      const mars = world.bodies.get('mars');
      const n = latLonToVec3(18.4, 77.5, 1).normalize();
      holder.position.copy(n).multiplyScalar(mars.radius + c.size * 0.28);
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      mars.mesh.add(holder);
      label.position.y = c.size * 0.7;
      craft.fixed = true;
    } else if (c.id === 'lem') {
      // Posé sur la Lune (mer de la Tranquillité, Apollo 11)
      const moon = world.bodies.get('moon');
      const n = latLonToVec3(0.7, 23.5, 1).normalize();
      holder.position.copy(n).multiplyScalar(moon.radius + c.size * 0.3);
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      moon.mesh.add(holder);
      craft.fixed = true;
    } else if (c.host === 'deep') {
      holder.position.set(92, 9, -36);
      world.sun.group.parent.add(holder);
      craft.deep = true;
    } else if (host) {
      const pivot = new THREE.Group();
      pivot.rotation.x = 0.35 + Math.random() * 0.3;
      pivot.rotation.z = (Math.random() - 0.5) * 0.4;
      host.group.add(pivot);
      pivot.add(holder);
      craft.pivot = pivot;
    }
    crafts.set(c.id, craft);
  });

  // La fusée Saturn V est utilisée par l'activité "Voyage en fusée"
  const rocketP = load('saturnv.glb').then((scene) => {
    tick();
    if (!scene) return null;
    brighten(scene);
    return scene;
  });

  const ready = Promise.all([...promises, rocketP]).then(async () => ({ crafts, rocketScene: await rocketP }));

  const wp = new THREE.Vector3();
  function update(dt, simDt, dim, camera) {
    const k = Math.max(0.001, Math.min(1, (dim - 0.7) / 0.3));
    crafts.forEach((c) => {
      c.group.visible = dim > 0.7;
      // Les noms des vaisseaux n'apparaissent que quand on s'approche
      c.label.visible = dim > 0.7 && camera && c.group.getWorldPosition(wp).distanceTo(camera.position) < 14;
      c.popper.scale.setScalar(k);
      if (c.fixed) return;
      if (c.deep) {
        c.group.rotation.y += dt * 0.1;
        c.group.position.x += simDt * 0.004;
        return;
      }
      c.angle += dt * c.data.speed * 0.25 + simDt * 0.02;
      c.group.position.set(Math.cos(c.angle) * c.data.orbit, 0, Math.sin(c.angle) * c.data.orbit);
      c.group.rotation.y = -c.angle;
      if (c.id === 'astronaut') { c.model.rotation.x += dt * 0.2; c.model.rotation.z += dt * 0.13; }
    });
  }

  return { crafts, ready, update };
}
