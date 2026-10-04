// Humanoïdes (singes, hominidés, humains de toutes les époques), robots,
// monstres génétiques et objets tenus en main.
import * as THREE from 'three';
import { mat, part, sph, cyl, cone, box, pivot, shade, mix, G_SPH, G_BOX, G_HEMI, G_TORUS, G_CYL, G_CONE } from './kit.js';

const SKINS = [0xf1c8a8, 0xe0ac84, 0xc68c5c, 0x9a6440, 0x6a4028, 0x4a2c1c];
const HAIRS = [0x1a1008, 0x3a2410, 0x6a4020, 0xc89a50, 0x8a2a10, 0x9a9a9a];

export function randomLook(rnd = Math.random) {
  return {
    skin: SKINS[Math.floor(rnd() * SKINS.length)],
    hairColor: HAIRS[Math.floor(rnd() * HAIRS.length)],
    hair: ['court', 'long', 'chauve', 'queue', 'court'][Math.floor(rnd() * 5)],
    beard: rnd() < 0.3,
    top: new THREE.Color().setHSL(rnd(), 0.45, 0.45).getHex(),
    bottom: new THREE.Color().setHSL(rnd(), 0.3, 0.3).getHex(),
  };
}

// Tenue selon l'époque (0 = préhistoire ... 9 = futur)
export function outfitFor(era, look) {
  const o = { ...look };
  if (era <= 0) Object.assign(o, { top: 0x7a5a3a, bottom: 0x6a4a2a, shoes: o.skin, bareChest: true });
  else if (era === 1) Object.assign(o, { top: 0x8a6a4a, bottom: 0x6a5030, shoes: 0x5a3a20 });
  else if (era <= 3) Object.assign(o, { bottom: o.top, shoes: 0x8a6030, tunic: true });
  else if (era === 4) Object.assign(o, { bottom: 0x4a3a2a, shoes: 0x3a2a1a, tunic: true, hood: true });
  else if (era === 5) Object.assign(o, { bottom: 0x2a2a3a, shoes: 0x1a1a1a, collar: true });
  else if (era === 6) Object.assign(o, { top: 0xe8e0d0, vest: 0x3a2a2a, bottom: 0x3a3a3a, shoes: 0x1a1a1a, hat: 'haut' });
  else if (era === 7) Object.assign(o, { bottom: 0x2a3a6a, shoes: 0xeeeeee });
  else if (era === 8) Object.assign(o, { bottom: 0x2a3a6a, shoes: 0xeeeeee, hood: true });
  else Object.assign(o, { top: 0xc8d0e0, bottom: 0x8a90a0, shoes: 0x3a3a4a, glow: 0x40e0ff });
  return o;
}

// Humanoïde générique : hauteur ~1, origine aux pieds
export function buildHumanoid(o = {}) {
  const g = new THREE.Group();
  const skin = o.skin ?? SKINS[1];
  const fur = o.fur; // couleur de pelage (singes)
  const top = fur ?? o.top ?? 0x4a6a9a;
  const bottom = fur ?? o.bottom ?? 0x3a3a4a;
  const hunch = o.hunch ?? 0;
  const armLen = o.armLen ?? 1;
  const bulk = o.bulk ?? 1;
  const furO = fur ? { r: 1 } : { r: 0.75 };
  const rig = { legs: [], arms: [], gait: 5, freq: 9, bob: 0.02, bodyY: 0.48, legAmp: 0.8 };

  const hips = pivot(g, [0, 0.48, 0]);
  rig.body = hips;
  // Jambes
  for (const sx of [-1, 1]) {
    const pv = pivot(g, [sx * 0.06 * bulk, 0.48, 0]);
    cyl(pv, bottom, [0, -0.12, 0], [0.045 * bulk, 0.25, 0.05 * bulk], null, furO, 6);
    cyl(pv, o.shortsLegs ? skin : bottom, [0, -0.34, 0], [0.04 * bulk, 0.22, 0.042 * bulk], null, furO, 6);
    box(pv, o.shoes ?? (fur ? shade(fur, 0.6) : 0x2a2a2a), [0, -0.46, 0.03], [0.08 * bulk, 0.045, 0.14]);
    rig.legs.push({ pv, ph: sx > 0 ? 0 : Math.PI });
  }
  // Torse
  const torso = pivot(hips, [0, 0.0, 0]);
  torso.rotation.x = hunch * 0.6;
  rig.torso = torso;
  box(torso, o.bareChest ? skin : top, [0, 0.15, 0], [0.2 * bulk, 0.3, 0.12 * bulk], null, furO);
  box(torso, bottom, [0, 0.0, 0], [0.205 * bulk, 0.06, 0.125 * bulk]);
  if (o.bareChest && !fur) box(torso, o.top, [0, -0.02, 0], [0.21 * bulk, 0.1, 0.13 * bulk], null, { r: 1 }); // pagne
  if (o.tunic) box(torso, o.top, [0, -0.06, 0], [0.22 * bulk, 0.14, 0.13 * bulk]);
  if (o.vest) box(torso, o.vest, [0, 0.14, 0.01], [0.205 * bulk, 0.24, 0.125 * bulk]);
  if (o.collar) box(torso, 0xf0f0f0, [0, 0.29, 0], [0.16, 0.03, 0.1]);
  if (o.armor) {
    box(torso, o.armor, [0, 0.17, 0], [0.22 * bulk, 0.26, 0.14 * bulk], null, { m: 0.7, r: 0.35 });
    box(torso, o.armor, [0.13 * bulk, 0.28, 0], [0.09, 0.05, 0.13], null, { m: 0.7, r: 0.35 });
    box(torso, o.armor, [-0.13 * bulk, 0.28, 0], [0.09, 0.05, 0.13], null, { m: 0.7, r: 0.35 });
  }
  if (o.glow) box(torso, o.glow, [0, 0.18, 0.062 * bulk], [0.05, 0.05, 0.01], null, { e: o.glow, ei: 2 });
  if (o.tie) box(torso, o.tie, [0, 0.17, 0.062 * bulk], [0.025, 0.2, 0.01]);
  if (o.cape) {
    const cp = pivot(torso, [0, 0.29, -0.065 * bulk]);
    box(cp, o.cape, [0, -0.22, -0.01], [0.26 * bulk, 0.46, 0.015], [0.08, 0, 0]);
    rig.cape = cp;
  }
  if (o.belly) sph(torso, top, [0, 0.08, 0.04], [0.11 * bulk, 0.12, 0.1], furO);

  // Tête
  const neck = pivot(torso, [0, 0.3, 0]);
  cyl(neck, skin, [0, 0.02, 0], [0.035, 0.05, 0.035], null, {}, 6);
  const head = pivot(neck, [0, 0.1, 0]);
  rig.head = head;
  const faceC = fur ? (o.face ?? 0xc8a080) : skin;
  part(head, G_SPH(14), mat(fur ?? skin, furO), [0, 0, 0], [0.085, 0.095, 0.09]);
  if (fur) {
    part(head, G_SPH(10), mat(faceC), [0, -0.015, 0.045], [0.06, 0.065, 0.055]);
    box(head, shade(fur, 0.8), [0, 0.035, 0.07], [0.11, 0.02, 0.03]); // arcade
    sph(head, faceC, [0, -0.04, 0.08], [0.04, 0.03, 0.03], {}, 8); // museau
  } else {
    sph(head, shade(skin, 0.92), [0, -0.005, 0.088], [0.014, 0.02, 0.016], {}, 6); // nez
  }
  for (const sx of [-1, 1]) {
    sph(head, 0xffffff, [sx * 0.03, 0.015, 0.075], 0.014, { r: 0.3 }, 6);
    sph(head, o.eyeColor ?? 0x1a1a1a, [sx * 0.03, 0.015, 0.087], 0.008, { r: 0.2, e: o.eyeGlow, ei: 2 }, 5);
    sph(head, fur ?? skin, [sx * 0.088, 0, 0], [0.015, 0.025, 0.015], {}, 6); // oreilles
  }
  if (!fur) {
    box(head, 0x8a4a3a, [0, -0.045, 0.082], [0.03, 0.007, 0.01]); // bouche
    const hc = o.hairColor ?? HAIRS[1];
    if (o.hair !== 'chauve') {
      part(head, G_HEMI(), mat(hc, { r: 0.9 }), [0, 0.01, -0.005], [0.09, 0.1, 0.095]);
      if (o.hair === 'long') box(head, hc, [0, -0.06, -0.06], [0.17, 0.16, 0.04]);
      if (o.hair === 'queue') cyl(head, hc, [0, -0.04, -0.1], [0.02, 0.12, 0.02], [0.4, 0, 0], {}, 5);
    }
    if (o.beard) part(head, G_SPH(8), mat(hc, { r: 1 }), [0, -0.06, 0.05], [0.07, 0.05, 0.05]);
  }
  if (o.hood) part(head, G_HEMI(), mat(o.top, { r: 1 }), [0, 0.0, -0.01], [0.1, 0.115, 0.105]);
  if (o.hat === 'haut') {
    cyl(head, 0x1a1a1a, [0, 0.1, 0], [0.1, 0.012, 0.1], null, {}, 12);
    cyl(head, 0x1a1a1a, [0, 0.16, 0], [0.065, 0.11, 0.065], null, {}, 12);
  } else if (o.hat === 'couronne') {
    cyl(head, 0xffd040, [0, 0.09, 0], [0.075, 0.04, 0.075], null, { m: 0.9, r: 0.2, e: 0x664400, ei: 0.3 }, 10);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      cone(head, 0xffd040, [Math.cos(a) * 0.07, 0.125, Math.sin(a) * 0.07], [0.015, 0.04, 0.015], null, { m: 0.9, r: 0.2 }, 4);
    }
  } else if (o.hat === 'casque') {
    part(head, G_HEMI(), mat(o.helmet ?? 0x6a6a5a, { m: 0.6, r: 0.4 }), [0, 0.015, 0], [0.1, 0.11, 0.105]);
  } else if (o.hat === 'casquette') {
    part(head, G_HEMI(), mat(o.top), [0, 0.02, 0], [0.092, 0.08, 0.095]);
    box(head, o.top, [0, 0.03, 0.09], [0.12, 0.01, 0.08]);
  }

  // Bras
  for (const sx of [-1, 1]) {
    const pv = pivot(torso, [sx * (0.125 * bulk + 0.01), 0.27, 0]);
    pv.rotation.z = sx * 0.06;
    cyl(pv, o.bareChest || o.shortSleeves ? (fur ?? skin) : top, [0, -0.1 * armLen, 0], [0.033 * bulk, 0.2 * armLen, 0.033 * bulk], null, furO, 6);
    cyl(pv, fur ?? (o.armor ? o.armor : skin), [0, -0.29 * armLen, 0], [0.028 * bulk, 0.18 * armLen, 0.028 * bulk], null, furO, 6);
    sph(pv, fur ? faceC : skin, [0, -0.39 * armLen, 0], 0.03 * bulk, {}, 6);
    const hand = pivot(pv, [0, -0.39 * armLen, 0.01]);
    if (o.claws) for (let k = -1; k <= 1; k++) cone(hand, 0xf0f0e0, [k * 0.015, -0.03, 0.02], [0.008, 0.06, 0.008], [0.3, 0, 0], {}, 3);
    rig.arms.push({ pv, ph: sx > 0 ? Math.PI : 0, hand });
  }
  rig.hand = rig.arms[1].hand;
  g.userData.rig = rig;
  return g;
}

export function buildApe(color = 0x5a3a2a, extra = {}) {
  return buildHumanoid({ fur: color, hunch: 0.65, armLen: 1.35, bulk: 1.15, face: 0xb08a6a, ...extra });
}

// Modèle pour un villageois / ennemi d'une époque donnée
export function buildPerson(look, era, role) {
  const o = outfitFor(era, look);
  if (role === 'soldat') {
    o.hat = era >= 2 ? 'casque' : null;
    if (era >= 3 && era <= 5) o.armor = era >= 4 ? 0x9aa0a8 : 0xb08040;
    if (era >= 7) Object.assign(o, { top: 0x4a5a3a, bottom: 0x4a5a3a, helmet: 0x3a4a2a, hat: 'casque' });
    if (era >= 9) Object.assign(o, { armor: 0x2a3a5a, glow: 0xff4040 });
  } else if (role === 'chef') {
    o.hat = 'couronne';
    o.cape = 0x8a1a2a;
  } else if (role === 'scientifique' && era >= 5) {
    o.top = 0xf5f5f5;
  } else if (role === 'medecin' && era >= 4) {
    o.top = 0xf0f8ff;
  } else if (role === 'programmeur' && era >= 8) {
    o.hood = true;
    o.top = 0x2a2a2a;
  }
  const g = buildHumanoid(o);
  const w = soldierWeapon(era, role);
  if (w) attachHeld(g, w);
  return g;
}

export function soldierWeapon(era, role) {
  if (role === 'soldat') return ['lance', 'lance', 'epee_bronze', 'epee_fer', 'epee_acier', 'mousquet', 'mousquet', 'fusil', 'fusil', 'pistolet_laser'][Math.min(era, 9)];
  if (role === 'bucheron') return era >= 2 ? 'hache_bronze' : 'hache_pierre';
  if (role === 'mineur') return 'pioche_pierre';
  if (role === 'chasseur') return era >= 1 ? 'arc' : 'lance';
  if (role === 'pecheur') return 'canne_peche';
  if (role === 'fermier') return 'baton';
  return null;
}

// ===================== ROBOTS =====================

export function buildRobot(kind = 'worker') {
  if (kind === 'drone') return buildDrone();
  const c = kind === 'combat' ? 0x5a6070 : 0xd8b020;
  const g = new THREE.Group();
  const rig = { legs: [], arms: [], gait: 5, freq: 8, bodyY: 0.5, bob: 0.02 };
  const metal = { m: 0.8, r: 0.35 };
  const body = pivot(g, [0, 0.5, 0]);
  rig.body = body;
  box(body, c, [0, 0.2, 0], [0.32, 0.34, 0.22], null, metal);
  box(body, 0x2a2a2a, [0, 0.2, 0.115], [0.2, 0.14, 0.01]);
  sph(body, kind === 'combat' ? 0xff3030 : 0x40e0ff, [0, 0.2, 0.12], 0.035, { e: kind === 'combat' ? 0xff2020 : 0x20c0ff, ei: 2 }, 8);
  const head = pivot(body, [0, 0.42, 0]);
  rig.head = head;
  box(head, c, [0, 0.06, 0], [0.2, 0.15, 0.17], null, metal);
  box(head, 0x111111, [0, 0.07, 0.086], [0.16, 0.05, 0.01]);
  box(head, kind === 'combat' ? 0xff3030 : 0x40ffff, [0, 0.07, 0.092], [0.13, 0.02, 0.005], null, { e: kind === 'combat' ? 0xff2020 : 0x40ffff, ei: 2.5 });
  cyl(head, 0x888888, [0.06, 0.18, 0], [0.006, 0.1, 0.006], null, metal, 4);
  sph(head, 0xff4040, [0.06, 0.24, 0], 0.015, { e: 0xff2020, ei: 2 }, 6);
  for (const sx of [-1, 1]) {
    const lp = pivot(g, [sx * 0.09, 0.5, 0]);
    box(lp, 0x555a60, [0, -0.22, 0], [0.08, 0.44, 0.09], null, metal);
    box(lp, c, [0, -0.47, 0.03], [0.11, 0.05, 0.16], null, metal);
    rig.legs.push({ pv: lp, ph: sx > 0 ? 0 : Math.PI });
    const ap = pivot(body, [sx * 0.2, 0.33, 0]);
    box(ap, 0x555a60, [0, -0.15, 0], [0.07, 0.3, 0.07], null, metal);
    box(ap, c, [0, -0.32, 0], [0.09, 0.06, 0.09], null, metal);
    const hand = pivot(ap, [0, -0.33, 0.02]);
    rig.arms.push({ pv: ap, ph: sx > 0 ? Math.PI : 0, hand });
  }
  rig.hand = rig.arms[1].hand;
  g.userData.rig = rig;
  if (kind === 'combat') {
    box(body, 0x3a3a3a, [0, 0.25, -0.15], [0.26, 0.26, 0.1], null, metal);
    attachHeld(g, 'fusil');
  }
  return g;
}

export function buildDrone() {
  const g = new THREE.Group();
  const rig = { rotors: [] };
  const metal = { m: 0.7, r: 0.3 };
  box(g, 0x2a2a30, [0, 0, 0], [0.3, 0.08, 0.3], null, metal);
  sph(g, 0x40e0ff, [0, -0.05, 0.12], 0.04, { e: 0x20c0ff, ei: 2 }, 8);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 0.28;
    const z = Math.sin(a) * 0.28;
    box(g, 0x3a3a40, [x / 2, 0, z / 2], [0.04, 0.03, 0.4], [0, -a + Math.PI / 2, 0], metal);
    const r = pivot(g, [x, 0.05, z]);
    box(r, 0xcccccc, [0, 0, 0], [0.24, 0.005, 0.03], null, { op: 0.7 });
    rig.rotors.push(r);
  }
  g.userData.rig = rig;
  return g;
}

// ===================== MONSTRE GÉNÉTIQUE =====================

export function buildMonster(m) {
  const traits = m.traits || [];
  const c = m.color ?? 0x5a8a3a;
  const o = {
    skin: c,
    top: shade(c, 0.8),
    bottom: shade(c, 0.6),
    shoes: shade(c, 0.4),
    bulk: traits.includes('force') || traits.includes('geant') ? 1.5 : 1.25,
    armLen: 1.15,
    hair: 'chauve',
    bareChest: true,
    claws: traits.includes('griffes') || traits.includes('force'),
    eyeColor: 0xff2020,
    eyeGlow: 0xff0000,
    hunch: 0.25,
  };
  const g = buildHumanoid(o);
  const rig = g.userData.rig;
  const head = rig.head;
  const torso = rig.torso;
  if (traits.includes('cornes')) {
    for (const sx of [-1, 1]) {
      cyl(head, 0xe8d8b0, [sx * 0.06, 0.1, 0], [0.012, 0.12, 0.012], [0, 0, sx * -0.6], {}, 4);
      cyl(head, 0xe8d8b0, [sx * 0.11, 0.16, 0.02], [0.01, 0.08, 0.01], [0.4, 0, sx * -1.1], {}, 4);
    }
  }
  if (traits.includes('defenses')) {
    for (const sx of [-1, 1]) cone(head, 0xf5f0e0, [sx * 0.035, -0.05, 0.08], [0.012, 0.09, 0.012], [-0.4, 0, sx * 0.3], {}, 4);
  }
  if (traits.includes('machoires')) {
    box(head, shade(c, 0.7), [0, -0.06, 0.06], [0.12, 0.04, 0.1]);
    for (let i = -2; i <= 2; i++) cone(head, 0xffffff, [i * 0.02, -0.04, 0.11], [0.006, 0.025, 0.006], [Math.PI, 0, 0], {}, 3);
  }
  if (traits.includes('ailes')) {
    rig.wings = [];
    for (const sx of [-1, 1]) {
      const w = pivot(torso, [sx * 0.06, 0.24, -0.07]);
      const wc = shade(c, 0.5);
      cyl(w, wc, [sx * 0.2, 0.08, -0.02], [0.012, 0.42, 0.012], [0, 0, sx * -1.2], {}, 4);
      box(w, wc, [sx * 0.24, -0.02, -0.03], [0.4, 0.3, 0.01], [0, 0, sx * -0.3], { op: 0.85, side: THREE.DoubleSide });
      rig.wings.push(w);
    }
    rig.wingF = 3;
  }
  if (traits.includes('tentacules')) {
    rig.tent = [];
    for (let i = 0; i < 4; i++) {
      let prev = pivot(torso, [(i - 1.5) * 0.06, 0.1, -0.06]);
      prev.rotation.x = -0.8;
      for (let k = 0; k < 4; k++) {
        cyl(prev, mix(c, 0xd05a7a, 0.5), [0, -0.05, 0], [0.018 - k * 0.003, 0.1, 0.018 - k * 0.003], null, {}, 5);
        rig.tent.push(prev);
        prev = pivot(prev, [0, -0.1, 0]);
      }
    }
  }
  if (traits.includes('venin') || traits.includes('poison')) {
    for (let i = 0; i < 6; i++) sph(torso, 0x80ff40, [Math.sin(i) * 0.09, 0.05 + i * 0.04, 0.065], 0.012, { e: 0x60ff20, ei: 2 }, 5);
  }
  if (traits.includes('geant') || traits.includes('regen')) {
    for (let i = 0; i < 5; i++) cone(torso, shade(c, 0.5), [0, 0.05 + i * 0.05, -0.07], [0.02, 0.06, 0.02], [-1.3, 0, 0], { flat: true }, 4);
  }
  // Queue
  const tail = pivot(rig.body, [0, 0, -0.06]);
  rig.tail = [tail];
  cyl(tail, c, [0, -0.04, -0.12], [0.03, 0.26, 0.03], [1.2, 0, 0], {}, 5);
  return g;
}

// ===================== OBJETS TENUS =====================

export function buildHeld(id) {
  const g = new THREE.Group();
  const wood = 0x7a5a3a;
  const stone = 0x8a8a8a;
  const metalC = id.includes('bronze') ? 0xc08a40 : id.includes('fer') ? 0x9a9aa0 : 0xc8ccd8;
  const metal = { m: 0.85, r: 0.3 };
  const handle = (len = 0.35, c = wood) => cyl(g, c, [0, 0, len / 2 - 0.05], [0.012, len, 0.012], [Math.PI / 2, 0, 0], {}, 5);
  if (id.startsWith('hache')) {
    handle();
    box(g, id === 'hache_pierre' ? stone : metalC, [0, 0.04, 0.27], [0.02, 0.09, 0.07], null, id === 'hache_pierre' ? { flat: true } : metal);
  } else if (id.startsWith('pioche')) {
    handle();
    box(g, id === 'pioche_pierre' ? stone : metalC, [0, 0, 0.28], [0.02, 0.2, 0.03], null, id === 'pioche_pierre' ? { flat: true } : metal);
  } else if (id.startsWith('epee')) {
    cyl(g, 0x3a2a1a, [0, 0, 0.02], [0.012, 0.08, 0.012], [Math.PI / 2, 0, 0], {}, 5);
    box(g, 0x8a7030, [0, 0, 0.07], [0.09, 0.015, 0.02], null, metal);
    box(g, metalC, [0, 0, 0.3], [0.012, 0.04, 0.44], null, metal);
  } else if (id === 'lance') {
    cyl(g, wood, [0, 0, 0.25], [0.01, 0.8, 0.01], [Math.PI / 2, 0, 0], {}, 5);
    cone(g, stone, [0, 0, 0.7], [0.02, 0.1, 0.02], [Math.PI / 2, 0, 0], { flat: true }, 4);
  } else if (id === 'baton' || id === 'massue') {
    cyl(g, id === 'massue' ? 0xe8e0c8 : wood, [0, 0, 0.18], [0.015, 0.45, 0.015], [Math.PI / 2, 0, 0], {}, 5);
    if (id === 'massue') sph(g, 0xe8e0c8, [0, 0, 0.4], 0.04, {}, 6);
  } else if (id === 'couteau_silex') {
    handle(0.1);
    cone(g, 0x5a6a7a, [0, 0, 0.12], [0.015, 0.12, 0.008], [Math.PI / 2, 0, 0], { flat: true }, 4);
  } else if (id === 'torche') {
    handle(0.3);
    sph(g, 0xff8020, [0, 0, 0.27], 0.035, { e: 0xff6010, ei: 3 }, 6);
    const light = new THREE.PointLight(0xff9040, 4, 12, 1.6);
    light.position.set(0, 0.05, 0.3);
    g.add(light);
  } else if (id === 'arc' || id === 'arbalete') {
    if (id === 'arbalete') box(g, wood, [0, 0, 0.15], [0.03, 0.03, 0.3]);
    const b = part(g, G_TORUS(), mat(wood), [0, 0, id === 'arbalete' ? 0.28 : 0.05], [0.18, 0.18, 0.18], [0, Math.PI / 2, Math.PI / 2]);
    b.rotation.set(Math.PI / 2, 0, 0);
  } else if (id === 'mousquet' || id === 'fusil') {
    box(g, id === 'fusil' ? 0x2a2a2a : wood, [0, 0, 0.05], [0.03, 0.06, 0.2]);
    cyl(g, 0x3a3a3a, [0, 0.015, 0.3], [0.012, 0.45, 0.012], [Math.PI / 2, 0, 0], metal, 6);
  } else if (id === 'pistolet_laser') {
    box(g, 0xe8e8f0, [0, 0, 0.08], [0.04, 0.06, 0.18], null, metal);
    cyl(g, 0x40e0ff, [0, 0.01, 0.2], [0.012, 0.08, 0.012], [Math.PI / 2, 0, 0], { e: 0x20c0ff, ei: 2 }, 6);
  } else if (id === 'canne_peche') {
    cyl(g, wood, [0, 0.2, 0.3], [0.008, 0.9, 0.008], [0.9, 0, 0], {}, 4);
  } else if (id === 'tronconneuse' || id === 'foreuse') {
    box(g, 0xd06020, [0, 0, 0.06], [0.08, 0.1, 0.16]);
    box(g, 0x8a8a8a, [0, 0, 0.25], [0.02, 0.06, 0.3], null, metal);
  } else if (id === 'pierre') {
    sph(g, stone, [0, 0, 0.03], 0.05, { flat: true }, 5);
  } else {
    return null;
  }
  return g;
}

export function attachHeld(model, id) {
  const rig = model.userData.rig;
  if (!rig || !rig.hand) return;
  if (rig.held) {
    rig.hand.remove(rig.held);
    rig.held = null;
  }
  if (!id) return;
  const h = buildHeld(id);
  if (!h) return;
  // L'objet est tenu à l'horizontale, pointé vers l'avant
  h.rotation.x = -0.3;
  h.scale.setScalar(1);
  rig.hand.add(h);
  rig.held = h;
}
