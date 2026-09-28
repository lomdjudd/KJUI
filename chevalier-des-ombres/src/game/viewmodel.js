// Vue à la première personne : bras en armure, arme et bouclier rendus par-dessus la scène
// (passe séparée, pas de traversée des murs), animés selon les attaques.
import * as THREE from 'three';
import { PropBuilder, G, xf, SURF } from '../actors/rig.js';
import { buildWeapon, buildShield } from '../actors/models.js';
import { createCharMaterial } from '../gfx/materials.js';
import { smoothstep, damp } from '../core/utils.js';

const PI = Math.PI;
const Y_DOWN = new THREE.Vector3(0, -1, 0);

// Avant-bras qui part de la main (origine) vers le bas de l'écran
function forearm(mat, color, trim, dark, surf, dir) {
  const pb = new PropBuilder();
  pb.add(xf(G.cyl(0.05, 0.065, 0.55, 8), [0, -0.3, 0]), color, surf);
  pb.add(xf(G.torus(0.06, 0.012, 4, 10), [0, -0.08, 0], [PI / 2, 0, 0]), trim, SURF.gold);
  pb.add(xf(G.box(0.1, 0.11, 0.1), [0, 0, 0]), dark, SURF.darkMetal);
  const m = pb.build(mat, false);
  m.quaternion.setFromUnitVectors(Y_DOWN, dir.clone().normalize());
  return m;
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.02, 10);
    this.scene.add(this.camera);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 1);
    this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dir.position.set(1, 2, 1);
    this.scene.add(this.dir);
    this.mat = createCharMaterial();
    this.right = new THREE.Group();
    this.left = new THREE.Group();
    this.camera.add(this.right, this.left);
    this.bob = 0;
    this.sway = new THREE.Vector2();
    this.flask = null;
  }

  build(outfit, weaponDef, shieldDef, twoHanded) {
    this.right.clear();
    this.left.clear();
    const c = outfit.look.c || {};
    const cloth = outfit.look.arms === 'robe' || outfit.look.arms === 'leather';
    const armCol = cloth ? c.cloth ?? c.leather ?? 0x2a2a3a : c.main ?? 0x6a6a74;
    const surf = cloth ? SURF.cloth : SURF.metal;
    const trim = c.trim ?? 0x8a7a50;
    const dark = c.dark ?? 0x2a2a30;
    this.right.add(forearm(this.mat, armCol, trim, dark, surf, new THREE.Vector3(0.25, -0.45, 0.55)));
    if (weaponDef) {
      const w = buildWeapon(weaponDef, this.mat);
      w.castShadow = false;
      w.rotation.set(-0.5, 0, -0.12);
      this.right.add(w);
      this.weapon = w;
    }
    this.left.add(forearm(this.mat, armCol, trim, dark, surf, new THREE.Vector3(-0.25, -0.45, 0.55)));
    if (shieldDef && shieldDef.shape) {
      const s = buildShield(shieldDef, this.mat);
      s.castShadow = false;
      s.position.set(0.0, 0.02, -0.04);
      s.scale.setScalar(0.38);
      s.rotation.y = Math.PI;
      this.left.add(s);
      this.shield = s;
    } else this.shield = null;
    const fp = new PropBuilder();
    fp.add(xf(G.sphere(0.06, 8, 6), [0, 0.06, 0]), 0xff7a2a, [0.2, 0, 1.2]);
    fp.add(xf(G.cyl(0.02, 0.025, 0.08, 6), [0, 0.14, 0]), 0xd8d0c0, SURF.bone);
    this.flask = fp.build(this.mat, false);
    this.flask.visible = false;
    this.left.add(this.flask);
    this.twoHanded = twoHanded;
  }

  syncLights(hemiSky, hemiGround, dirColor, env) {
    this.hemi.color.set(hemiSky);
    this.hemi.groundColor.set(hemiGround);
    this.dir.color.set(dirColor);
    this.scene.environment = env;
  }

  // st : { action, t (0..1), moving, speed, blocking, casting, castT, drinking, drinkT }
  update(dt, mainCam, st) {
    this.camera.position.copy(mainCam.position);
    this.camera.quaternion.copy(mainCam.quaternion);
    if (this.camera.fov !== mainCam.fov || this.camera.aspect !== mainCam.aspect) {
      this.camera.fov = mainCam.fov;
      this.camera.aspect = mainCam.aspect;
      this.camera.updateProjectionMatrix();
    }
    if (st.moving) this.bob += dt * (5 + st.speed * 1.1);
    const amp = Math.min(1, st.speed / 4);
    const bobX = Math.sin(this.bob) * 0.012 * amp;
    const bobY = Math.abs(Math.cos(this.bob)) * 0.014 * amp;
    // Main droite : position de la main et orientation de la lame
    let px = 0.24;
    let py = -0.24;
    let pz = -0.48;
    let rx = 0;
    let ry = 0;
    let rz = 0;
    const t = st.t;
    const a = st.action;
    if (a) {
      const wind = smoothstep(0, 0.28, t);
      const k = smoothstep(0.25, 0.55, t);
      const back = smoothstep(0.65, 1, t);
      switch (a) {
        case 'slashR':
        case 'sweep2h':
        case 'spin':
          rz = -1.4 * wind * (1 - back);
          ry = (-0.3 + k * 2.9) * (1 - back);
          px = 0.24 + 0.1 * wind - k * 0.4 + back * 0.3;
          break;
        case 'slashL':
          rz = 1.4 * wind * (1 - back);
          ry = (0.3 - k * 2.9) * (1 - back);
          px = 0.24 - 0.3 * wind + k * 0.4 - back * 0.1;
          break;
        case 'overhead':
        case 'slam':
        case 'jumpAtk':
        case 'hammer':
        case 'rising':
          rx = (0.9 * wind - k * 2.6) * (1 - back);
          py = -0.24 + 0.12 * wind - 0.1 * k + back * 0.1;
          px = 0.14;
          break;
        case 'thrust':
        case 'stab':
        case 'stabL':
          rx = -1.45 * wind * (1 - back);
          pz = -0.48 + 0.1 * wind - Math.sin(k * PI) * 0.35;
          px = 0.18;
          break;
        case 'castAoe':
          rx = -0.6 * Math.sin(t * PI);
          break;
        default:
      }
    }
    this.right.position.set(px + bobX + this.sway.x, py - bobY + this.sway.y, pz);
    this.right.rotation.set(rx, ry, rz);
    // Main gauche
    let lx = -0.32;
    let ly = -0.34;
    let lz = -0.5;
    let lrx = 0;
    let lry = 0;
    if (st.blocking) {
      lx = -0.1;
      ly = -0.14;
      lz = -0.4;
      lry = 0.25;
    }
    if (st.casting) {
      const k = Math.sin(Math.min(1, st.castT) * PI);
      lx = -0.12;
      ly = -0.16;
      lz = -0.45 - k * 0.15;
      lrx = -0.6;
    }
    if (this.twoHanded && !st.blocking && !st.casting && !st.drinking) {
      lx = px - 0.1;
      ly = py - 0.06;
      lz = pz + 0.08;
      lrx = rx;
      lry = ry;
    }
    this.flask.visible = !!st.drinking;
    if (st.drinking) {
      const k = Math.sin(Math.min(1, st.drinkT) * PI);
      lx = -0.08;
      ly = -0.3 + k * 0.2;
      lz = -0.36;
      lrx = k * 1.2;
    }
    const L = this.left;
    L.position.x = damp(L.position.x, lx - bobX, 16, dt);
    L.position.y = damp(L.position.y, ly - bobY, 16, dt);
    L.position.z = damp(L.position.z, lz, 16, dt);
    L.rotation.x = damp(L.rotation.x, lrx, 16, dt);
    L.rotation.y = damp(L.rotation.y, lry, 16, dt);
    this.sway.multiplyScalar(Math.exp(-8 * dt));
  }

  addSway(dx, dy) {
    this.sway.x = Math.max(-0.04, Math.min(0.04, this.sway.x - dx * 0.05));
    this.sway.y = Math.max(-0.04, Math.min(0.04, this.sway.y + dy * 0.05));
  }
}
