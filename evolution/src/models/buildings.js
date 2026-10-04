// Modèles des constructions. Origine au sol, taille en unités du monde.
import * as THREE from 'three';
import { mat, part, sph, cyl, cone, box, pivot, shade, G_HEMI, G_CONE, G_CYL, G_BOX } from './kit.js';

const WOOD = 0x8a6038;
const WOOD_D = 0x5a3a20;
const STONE = 0x9a9488;
const BRICK = 0xa8553a;
const ROOF = 0x7a3a2a;
const THATCH = 0xc8a050;
const GLASS = 0x8ac8e8;
const METAL = { m: 0.75, r: 0.35 };

function hut(g) {
  part(g, G_CONE(10), mat(THATCH, { r: 1, flat: true }), [0, 1.6, 0], [2.2, 3.2, 2.2]);
  cyl(g, WOOD_D, [0, 0.45, 0], [1.9, 0.9, 1.9], null, { r: 1 }, 10);
  box(g, 0x2a1a10, [0, 0.55, 1.88], [0.7, 1.1, 0.1]);
}

function campfire(g) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sph(g, STONE, [Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55], 0.18, { flat: true }, 5);
  }
  for (let i = 0; i < 4; i++) cyl(g, WOOD_D, [0, 0.15, 0], [0.06, 0.8, 0.06], [Math.PI / 2, (i * Math.PI) / 4, 0.3], {}, 5);
  const flame = pivot(g, [0, 0.2, 0]);
  cone(flame, 0xff7a20, [0, 0.3, 0], [0.3, 0.7, 0.3], null, { e: 0xff5010, ei: 2.5, op: 0.9 }, 6);
  cone(flame, 0xffe060, [0, 0.25, 0], [0.16, 0.45, 0.16], null, { e: 0xffc020, ei: 3 }, 6);
  g.userData.flame = flame;
  const light = new THREE.PointLight(0xff8030, 6, 14, 1.6);
  light.position.set(0, 1, 0);
  g.add(light);
  g.userData.light = light;
}

function workbench(g) {
  box(g, WOOD, [0, 0.8, 0], [1.8, 0.12, 0.9]);
  for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) box(g, WOOD_D, [x, 0.4, z], [0.1, 0.8, 0.1]);
  box(g, STONE, [-0.4, 0.92, 0], [0.3, 0.12, 0.3], null, { flat: true });
  cyl(g, WOOD_D, [0.4, 0.9, 0.1], [0.03, 0.4, 0.03], [0, 0, Math.PI / 2], {}, 5);
}

function house(g, wall, roof, w = 4, d = 4, h = 2.6, floors = 1) {
  for (let f = 0; f < floors; f++) {
    box(g, wall, [0, h / 2 + f * h, 0], [w, h, d]);
    for (const sx of [-1, 1]) {
      box(g, GLASS, [sx * w * 0.28, h * 0.6 + f * h, d / 2 + 0.01], [0.6, 0.6, 0.05], null, { r: 0.1, m: 0.3, e: 0x332200, ei: 0.2 });
      box(g, GLASS, [w / 2 + 0.01, h * 0.6 + f * h, sx * d * 0.25], [0.05, 0.6, 0.6], null, { r: 0.1, m: 0.3 });
    }
  }
  box(g, WOOD_D, [0, 0.8, d / 2 + 0.02], [0.8, 1.6, 0.06]);
  const roofG = pivot(g, [0, h * floors, 0]);
  const r = part(roofG, G_CONE(4), mat(roof, { flat: true }), [0, 0.9, 0], [w * 0.8, 1.8, d * 0.8]);
  r.rotation.y = Math.PI / 4;
  box(g, shade(wall, 0.7), [w * 0.3, h * floors + 1.2, -d * 0.2], [0.35, 1.2, 0.35]);
}

function furnace(g) {
  part(g, G_HEMI(), mat(BRICK, { flat: true }), [0, 0, 0], [1.2, 1.6, 1.2]);
  box(g, 0x1a0a05, [0, 0.4, 1.05], [0.5, 0.5, 0.2], null, { e: 0xff4010, ei: 1.2 });
  cyl(g, BRICK, [0, 1.8, -0.3], [0.2, 1, 0.2], null, {}, 8);
}

function forge(g) {
  box(g, STONE, [0, 0.5, 0], [2, 1, 1.4], null, { flat: true });
  box(g, 0x2a1a10, [0, 1.02, 0], [1.4, 0.05, 0.9], null, { e: 0xff4010, ei: 1.5 });
  box(g, 0x2a2a2a, [1.6, 0.6, 0.4], [0.6, 0.3, 0.3], null, METAL);
  box(g, 0x2a2a2a, [1.6, 0.35, 0.4], [0.2, 0.4, 0.2], null, METAL);
  cyl(g, BRICK, [-0.6, 2, -0.4], [0.25, 2.2, 0.25], null, {}, 8);
  const light = new THREE.PointLight(0xff6020, 3, 8, 2);
  light.position.set(0, 1.4, 0);
  g.add(light);
}

function well(g) {
  cyl(g, STONE, [0, 0.4, 0], [1, 0.8, 1], null, { flat: true }, 12);
  cyl(g, 0x2a5a8a, [0, 0.78, 0], [0.85, 0.02, 0.85], null, { r: 0.1 }, 12);
  for (const sx of [-1, 1]) box(g, WOOD, [sx * 0.9, 1.3, 0], [0.12, 1.8, 0.12]);
  part(g, G_CONE(4), mat(ROOF, { flat: true }), [0, 2.5, 0], [1.4, 0.8, 1.4], [0, Math.PI / 4, 0]);
}

function field(g) {
  box(g, 0x5a3a20, [0, 0.05, 0], [5.5, 0.1, 5.5], null, { r: 1 });
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      cone(g, 0xd8b840, [x * 1.05, 0.45, z * 1.05], [0.22, 0.8, 0.22], null, { flat: true }, 4);
    }
  }
}

function pen(g) {
  const R = 3.2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    box(g, WOOD_D, [Math.cos(a) * R, 0.5, Math.sin(a) * R], [0.12, 1, 0.12]);
  }
  for (const y of [0.4, 0.8]) {
    for (let i = 0; i < 16; i++) {
      const a = ((i + 0.5) / 16) * Math.PI * 2;
      box(g, WOOD, [Math.cos(a) * R, y, Math.sin(a) * R], [0.06, 0.08, 1.3], [0, -a, 0]);
    }
  }
}

function wall(g, c, h) {
  box(g, c, [0, h / 2, 0], [3, h, 0.6], null, { flat: true });
  if (c === STONE) for (let i = -1; i <= 1; i++) box(g, c, [i, h + 0.2, 0], [0.5, 0.4, 0.6]);
  else for (let i = -3; i <= 3; i++) cone(g, WOOD, [i * 0.42, h + 0.2, 0], [0.2, 0.5, 0.2], null, {}, 5);
}

function tower(g) {
  cyl(g, STONE, [0, 3, 0], [1.6, 6, 1.6], null, { flat: true }, 8);
  cyl(g, STONE, [0, 6.3, 0], [2, 0.6, 2], null, { flat: true }, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(g, STONE, [Math.cos(a) * 1.8, 6.9, Math.sin(a) * 1.8], [0.5, 0.6, 0.5]);
  }
  cyl(g, WOOD_D, [0, 8, 0], [0.04, 2, 0.04], null, {}, 4);
  box(g, 0xc02020, [0.4, 8.6, 0], [0.8, 0.5, 0.02]);
}

function shop(g) {
  box(g, BRICK, [0, 1.3, 0], [4.5, 2.6, 3.5]);
  box(g, GLASS, [0, 1.3, 1.76], [3, 1.4, 0.05], null, { r: 0.1, m: 0.3, e: 0x443300, ei: 0.3 });
  for (let i = 0; i < 6; i++) box(g, i % 2 ? 0xffffff : 0xd03030, [-1.9 + i * 0.76, 2.8, 2.2], [0.76, 0.08, 1], [0.35, 0, 0]);
  box(g, 0xffd040, [0, 3.2, 1.8], [2.4, 0.5, 0.1], null, { e: 0x664400, ei: 0.5 });
  part(g, G_CONE(4), mat(ROOF, { flat: true }), [0, 3.4, 0], [3.4, 1.4, 2.8], [0, Math.PI / 4, 0]);
}

function palace(g) {
  box(g, 0xe8e0d0, [0, 0.4, 0], [10, 0.8, 8]);
  box(g, 0xf0e8d8, [0, 3.2, -0.5], [8.5, 4.8, 6]);
  for (let i = -3; i <= 3; i++) cyl(g, 0xf8f4ea, [i * 1.25, 3, 3], [0.3, 4.4, 0.3], null, {}, 10);
  box(g, 0xe8e0d0, [0, 5.6, 1], [9, 0.5, 5]);
  part(g, G_CONE(4), mat(0xe8e0d0, { flat: true }), [0, 6.6, 1], [6.5, 1.6, 3.6], [0, Math.PI / 4, 0]);
  part(g, G_HEMI(), mat(0xd8b040, METAL), [0, 5.8, -1], [2.2, 2.2, 2.2]);
  box(g, 0x8a1a2a, [0, 1.5, 3.05], [1.2, 2.2, 0.05]);
}

function hospital(g) {
  box(g, 0xf0f0f0, [0, 2.5, 0], [7, 5, 5]);
  for (let f = 0; f < 2; f++) for (let i = -2; i <= 2; i++) box(g, GLASS, [i * 1.3, 1.5 + f * 2.2, 2.51], [0.8, 1, 0.05], null, { r: 0.1, m: 0.3 });
  box(g, 0xe02020, [0, 5.4, 2.4], [1.4, 0.4, 0.1], null, { e: 0xa00000, ei: 0.6 });
  box(g, 0xe02020, [0, 5.4, 2.4], [0.4, 1.4, 0.1], null, { e: 0xa00000, ei: 0.6 });
}

function barracks(g) {
  part(g, G_CONE(4), mat(0x6a6a3a, { flat: true, r: 1 }), [0, 1.4, 0], [3.2, 2.8, 4], [0, Math.PI / 4, 0]);
  cyl(g, WOOD_D, [0, 1.8, 0], [0.06, 3.6, 0.06], null, {}, 4);
  for (let i = 0; i < 3; i++) cyl(g, WOOD_D, [3 + i * 0.4, 0.8, 1], [0.03, 1.6, 0.03], [0.2, 0, 0], {}, 4);
}

function lab(g) {
  box(g, 0xd8dce4, [0, 1.6, 0], [5, 3.2, 4]);
  part(g, G_HEMI(), mat(GLASS, { op: 0.6, r: 0.1 }), [0, 3.2, 0], [1.8, 1.4, 1.8], null, false);
  for (let i = 0; i < 3; i++) cyl(g, [0x40ff80, 0xff40c0, 0x40c0ff][i], [-1.5 + i * 1.5, 1.2, 2.05], [0.2, 0.8, 0.2], null, { e: [0x20a040, 0xa02080, 0x2080a0][i], ei: 1.5, op: 0.8 }, 8);
  cyl(g, 0x9a9aa0, [1.8, 3.8, -1.2], [0.1, 1.4, 0.1], null, METAL, 6);
}

function mine(g) {
  box(g, STONE, [0, 1, 0], [4, 2, 3], null, { flat: true });
  box(g, 0x0a0a0a, [0, 0.8, 1.51], [1.6, 1.6, 0.05]);
  for (const sx of [-1, 1]) box(g, WOOD, [sx * 0.85, 0.9, 1.6], [0.2, 1.8, 0.2]);
  box(g, WOOD, [0, 1.85, 1.6], [2, 0.2, 0.2]);
  box(g, 0x6a6a6a, [2.4, 0.4, 1.5], [0.8, 0.5, 1.2], null, METAL);
}

function factory(g) {
  box(g, BRICK, [0, 2.5, 0], [10, 5, 7]);
  for (let i = 0; i < 4; i++) {
    const r = part(g, G_BOX(), mat(0x6a6a70, METAL), [-3.75 + i * 2.5, 5.6, 0], [2.4, 1.2, 7]);
    r.rotation.z = 0.5;
  }
  for (const x of [3, 4.3]) cyl(g, BRICK, [x, 7.5, -2.5], [0.5, 7, 0.5], null, {}, 10);
  for (let i = -3; i <= 3; i++) box(g, GLASS, [i * 1.3, 2.5, 3.51], [0.9, 1.6, 0.05], null, { r: 0.1, m: 0.3, e: 0x443300, ei: 0.3 });
  box(g, 0x4a4a50, [0, 1.2, 3.52], [2.5, 2.4, 0.05], null, METAL);
  g.userData.smoke = [new THREE.Vector3(3, 11, -2.5), new THREE.Vector3(4.3, 11, -2.5)];
}

function oilPump(g) {
  box(g, 0x3a3a3a, [0, 0.2, 0], [3, 0.4, 1.2], null, METAL);
  box(g, 0x6a6a70, [0, 1.3, 0], [0.3, 2.2, 0.3], null, METAL);
  const arm = pivot(g, [0, 2.4, 0]);
  box(arm, 0xd0a020, [0, 0, 0], [3.2, 0.3, 0.3], null, METAL);
  box(arm, 0xd0a020, [1.7, -0.3, 0], [0.4, 0.9, 0.35], null, METAL);
  g.userData.pump = arm;
}

function powerPlant(g, nuclear) {
  if (nuclear) {
    for (const x of [-3, 3]) {
      part(g, new THREE.CylinderGeometry(1.8, 2.6, 9, 16, 1, true), mat(0xd8d8d8, { side: THREE.DoubleSide }), [x, 4.5, -1], 1);
    }
    box(g, 0xc8c8c8, [0, 2, 3], [8, 4, 4]);
    part(g, G_HEMI(), mat(0xe0e0e0), [0, 4, 3], [2.4, 2.4, 2.4]);
    g.userData.smoke = [new THREE.Vector3(-3, 10, -1), new THREE.Vector3(3, 10, -1)];
  } else {
    box(g, 0x8a8a8a, [0, 2, 0], [7, 4, 5], null, METAL);
    cyl(g, BRICK, [2.5, 6, -1.5], [0.6, 8, 0.6], null, {}, 10);
    for (let i = 0; i < 3; i++) box(g, 0xffd020, [-2 + i * 2, 4.3, 2.51], [0.8, 0.5, 0.05], null, { e: 0xaa8800, ei: 1 });
    g.userData.smoke = [new THREE.Vector3(2.5, 10, -1.5)];
  }
}

function windmill(g) {
  cyl(g, 0xf0f0f0, [0, 5, 0], [0.18, 10, 0.18], null, METAL, 8);
  const rot = pivot(g, [0, 10, 0.3]);
  for (let i = 0; i < 3; i++) {
    const b = pivot(rot);
    b.rotation.z = (i * Math.PI * 2) / 3;
    box(b, 0xf8f8f8, [0, 2.2, 0], [0.35, 4.4, 0.06], null, METAL);
  }
  sph(g, 0xf0f0f0, [0, 10, 0.2], 0.35, METAL, 8);
  g.userData.rotor = rot;
}

function solar(g) {
  for (const sx of [-1, 1]) {
    box(g, 0x9a9aa0, [sx * 0.9, 0.5, 0], [0.08, 1, 0.08], null, METAL);
    const p = box(g, 0x1a2a5a, [sx * 0.9, 1.05, 0], [1.6, 0.05, 1.2], [0.5, 0, 0], { r: 0.2, m: 0.6 });
    p.castShadow = true;
  }
}

function modernHouse(g) {
  box(g, 0xf0ece4, [0, 1.6, 0], [7, 3.2, 6]);
  box(g, 0x3a3a40, [1, 4.2, -0.5], [5, 2.2, 5]);
  box(g, GLASS, [-1.5, 1.6, 3.01], [3, 2.4, 0.05], null, { r: 0.05, m: 0.5, e: 0x332200, ei: 0.3 });
  box(g, GLASS, [1, 4.2, 2.01], [4, 1.6, 0.05], null, { r: 0.05, m: 0.5 });
  box(g, 0x2a2a2a, [0, 6.4, 0], [8, 0.2, 7]);
  box(g, 0x5a3a20, [2.3, 1.2, 3.02], [1, 2.4, 0.05]);
}

function tower2(g) {
  box(g, 0x8a9aaa, [0, 12, 0], [8, 24, 8], null, { m: 0.5, r: 0.3 });
  for (let f = 0; f < 10; f++) {
    for (const side of [0, 1, 2, 3]) {
      const a = (side * Math.PI) / 2;
      const w = box(g, GLASS, [Math.sin(a) * 4.02, 1.5 + f * 2.3, Math.cos(a) * 4.02], [7, 1.2, 0.05], [0, a, 0], { r: 0.05, m: 0.6, e: 0x2a3040, ei: 0.4 });
      w.castShadow = false;
    }
  }
  cyl(g, 0xaaaaaa, [0, 25.5, 0], [0.1, 3, 0.1], null, METAL, 4);
}

function computer(g) {
  box(g, WOOD, [0, 0.75, 0], [1.6, 0.08, 0.8]);
  for (const [x, z] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) box(g, 0x3a3a3a, [x, 0.37, z], [0.06, 0.74, 0.06]);
  box(g, 0x1a1a1a, [0, 1.15, -0.15], [0.9, 0.6, 0.05]);
  box(g, 0x2050c0, [0, 1.15, -0.12], [0.82, 0.52, 0.01], null, { e: 0x2060ff, ei: 1.2 });
  box(g, 0x1a1a1a, [0, 0.82, -0.15], [0.1, 0.08, 0.1]);
  box(g, 0x2a2a2a, [0, 0.8, 0.15], [0.6, 0.02, 0.2]);
  box(g, 0x2a2a2a, [0.9, 0.5, 0], [0.25, 0.5, 0.5]);
  box(g, 0x2a2a2a, [0, 0.45, 0.6], [0.5, 0.06, 0.5]);
  box(g, 0x2a2a2a, [0, 0.7, 0.85], [0.5, 0.5, 0.06]);
}

function rocketPad(g) {
  box(g, 0x6a6a6a, [0, 0.3, 0], [12, 0.6, 12]);
  box(g, 0x8a3a2a, [-4.5, 9, 0], [1.2, 18, 1.2], null, METAL);
  const rocket = pivot(g, [0, 0.6, 0]);
  cyl(rocket, 0xf0f0f0, [0, 8, 0], [1.2, 14, 1.2], null, METAL, 14);
  cone(rocket, 0xd02020, [0, 16.5, 0], [1.2, 3, 1.2], null, METAL, 14);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    box(rocket, 0xd02020, [Math.cos(a) * 1.4, 2, Math.sin(a) * 1.4], [0.15, 3, 1.2], [0, -a, 0], METAL);
  }
  box(rocket, 0x2050c0, [0, 10, 1.21], [0.8, 0.8, 0.02], null, { e: 0x1030a0, ei: 0.6 });
  g.userData.rocket = rocket;
}

function statue(g) {
  box(g, STONE, [0, 0.8, 0], [1.6, 1.6, 1.6], null, { flat: true });
  cyl(g, 0x5a9a8a, [0, 2.6, 0], [0.4, 2, 0.4], null, METAL, 8);
  sph(g, 0x5a9a8a, [0, 3.9, 0], 0.45, METAL, 10);
  cyl(g, 0x5a9a8a, [0.45, 4.2, 0], [0.1, 1.4, 0.1], [0, 0, -0.3], METAL, 6);
  cone(g, 0xffc040, [0.65, 5, 0], [0.2, 0.4, 0.2], null, { e: 0xff8000, ei: 1.5 }, 6);
}

const BUILDERS = {
  feu_camp: campfire,
  etabli: workbench,
  hutte: hut,
  champ: field,
  enclos: pen,
  four: furnace,
  puits: well,
  mur_bois: (g) => wall(g, WOOD, 2),
  maison_bois: (g) => house(g, WOOD, THATCH, 4.5, 4, 2.6),
  forge,
  marche: shop,
  palais: palace,
  caserne: barracks,
  maison_pierre: (g) => house(g, STONE, ROOF, 5, 4.5, 2.8, 2),
  mur_pierre: (g) => wall(g, STONE, 3),
  tour_garde: tower,
  statue,
  hopital: hospital,
  labo: lab,
  mine,
  usine: factory,
  puits_petrole: oilPump,
  centrale: (g) => powerPlant(g, false),
  centrale_nucleaire: (g) => powerPlant(g, true),
  eolienne: windmill,
  panneau_solaire: solar,
  maison_moderne: modernHouse,
  immeuble: tower2,
  ordinateur: computer,
  base_lancement: rocketPad,
};

export function buildBuilding(id) {
  const g = new THREE.Group();
  (BUILDERS[id] || workbench)(g);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

// Village d'une faction rivale selon l'époque
export function buildFactionHouse(era, color) {
  const g = new THREE.Group();
  if (era <= 1) hut(g);
  else if (era <= 4) house(g, era <= 2 ? WOOD : STONE, color, 4, 4, 2.6);
  else if (era <= 6) house(g, BRICK, color, 4.5, 4.5, 2.8, 2);
  else modernHouse(g);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function buildBanner(color) {
  const g = new THREE.Group();
  cyl(g, WOOD_D, [0, 3, 0], [0.08, 6, 0.08], null, {}, 5);
  box(g, color, [0.7, 5.3, 0], [1.4, 0.9, 0.04]);
  return g;
}
