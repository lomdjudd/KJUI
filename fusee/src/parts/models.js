// Modèles 3D procéduraux détaillés de chaque pièce.
// Repère : origine au centre, Y vers le haut, pièces radiales tournées vers +X
// (face de fixation en x = -rad).

import * as THREE from 'three';
import { GeoBag, lathe, disc, cyl, box, sphere, torus, tube, strut, extrudeShape } from './geom.js';
import { materials, decalMaterial } from './materials.js';
import * as TX from './textures.js';
import { PART_BY_ID } from './catalog.js';
import { legGeometry, legFoot } from './legs.js';

const PI = Math.PI;

// Matériaux « par instance » (lueur des tuyères, bouclier, lampes)
const PER_INSTANCE = new Set(['nozzle', 'nozzleInner', 'shield', 'lamp', 'coil']);

function defaultPaint(def) {
  switch (def.style) {
    case 'foam': return 'foam';
    case 'steel': return 'steel';
    case 'black': return 'black';
    case 'carbon': return 'carbon';
    case 'grey': return 'grey';
    case 'alpha': return 'black';
    default: return 'white';
  }
}

function resolver(def, paint) {
  const M = materials();
  const p = paint || defaultPaint(def);
  return (key) => {
    if (key === 'paint') return M.paint[p] || M.white;
    if (key === 'paint2') return p === 'white' ? M.black : M.white; // bande contrastée
    if (key === 'coil') return M.emissivePink;
    return M[key] || M.white;
  };
}

// ---------------------------------------------------------------------------
// Décalcomanies courbes sur un cylindre
function curvedDecal(r, y0, y1, phiC, phiW, texture) {
  const g = lathe([[r, y0], [r, y1]], 8, phiC - phiW / 2, phiW);
  // UV 0..1 sur la zone
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const phi = Math.atan2(z, x);
    let d = phi - (phiC - phiW / 2);
    while (d < -PI) d += 2 * PI;
    while (d > PI) d -= 2 * PI;
    uv.setXY(i, 1 - d / phiW, (y - y0) / (y1 - y0));
  }
  const m = new THREE.Mesh(g, decalMaterial(texture));
  m.renderOrder = 2;
  return m;
}

// ---------------------------------------------------------------------------
function buildTank(def, bag, grp) {
  const r = def.d / 2, h = def.h;
  const e = Math.min(0.06, r * 0.05);
  bag.add('paint', lathe([[r - e, -h / 2], [r, -h / 2 + e], [r, h / 2 - e], [r - e, h / 2]], 56));
  bag.add('darkMetal', disc(r - e, h / 2, true, 40));
  bag.add('darkMetal', disc(r - e, -h / 2, false, 40));
  // lèvres de jonction
  const lip = (y) => bag.add('darkMetal', lathe([[r + 0.012, y - 0.035], [r + 0.012, y + 0.035]], 56).translate(0, 0, 0));
  lip(h / 2 - 0.04);
  lip(-h / 2 + 0.04);
  const s = def.d / 2.5;
  if (def.style === 'steel') {
    // tuiles thermiques sur la moitié « au vent »
    bag.add('hexTiles', lathe([[r + 0.006, -h / 2 + 0.1], [r + 0.006, h / 2 - 0.1]], 32, 0.1, PI - 0.2));
  } else if (def.d >= 1.2) {
    // chemin de câbles
    const w = 0.1 * Math.max(0.6, s), dd = 0.05 * Math.max(0.6, s);
    bag.add(def.style === 'foam' ? 'foam' : 'paint2', box(w, h * 0.9, dd), { p: [0, 0, -(r + dd / 2)] });
  }
  if (def.style === 'foam' && def.d >= 1.2) {
    const a = PI * 0.62;
    const pr = 0.045 * Math.max(1, s);
    bag.add('foam', cyl(pr, pr, h * 0.94, 12), { p: [Math.cos(a) * (r + pr * 1.4), 0, Math.sin(a) * (r + pr * 1.4)] });
    for (let k = -2; k <= 2; k++) bag.add('darkMetal', box(0.05, 0.04, pr * 2.6), { p: [Math.cos(a) * (r + pr * 0.8), (k * h) / 5.5, Math.sin(a) * (r + pr * 0.8)], r: [0, -a, 0] });
  }
  if (def.style === 'fusion') {
    bag.add('coil', lathe([[r + 0.02, -0.12], [r + 0.02, 0.12]], 56));
    bag.add('paint2', lathe([[r + 0.01, h / 2 - 0.4], [r + 0.01, h / 2 - 0.25]], 56));
  }
  if (def.style === 'carbon') {
    bag.add('white', lathe([[r + 0.004, h / 2 - 0.35], [r + 0.004, h / 2 - 0.2]], 56));
  }
  // Décalcomanies
  if (h >= 3.5 && def.d >= 1.2) {
    const dark = ['black', 'carbon', 'foam'].includes(def.style);
    const t = TX.textDecal('FORGE STELLAIRE', dark ? '#f4f1ea' : '#1c2230');
    const len = Math.min(h * 0.7, 7 * s + 2);
    grp.add(curvedDecal(r + 0.008, -len / 2, len / 2, -PI / 2 + 0.35, Math.min(1.1, (len * 0.16) / r), t));
  }
  if (h >= 1.8 && def.d >= 2.4) {
    const ff = TX.flagDecal();
    const sz = Math.min(1.6, h * 0.35);
    grp.add(curvedDecal(r + 0.008, h / 2 - sz - 0.3, h / 2 - 0.3, -PI / 2 - 0.5, sz / r, ff));
  }
}

function buildSphereTank(def, bag) {
  const r = def.d / 2;
  bag.add('grey', sphere(r, 24, 16), { p: [r * 0.2, 0, 0] });
  bag.add('darkMetal', torus(r * 1.0, 0.02, 6, 32), { p: [r * 0.2, 0, 0] });
  bag.add('darkMetal', box(0.2, 0.25, 0.08), { p: [-r * 0.5 + 0.1, 0, 0] });
}

function buildCapsuleTank(def, bag) {
  const r = def.d / 2;
  bag.add('grey', new THREE.CapsuleGeometry(r * 0.9, def.h - r * 1.8, 8, 20), { p: [r * 0.3, 0, 0] });
  for (const y of [-def.h * 0.25, def.h * 0.25]) bag.add('darkMetal', torus(r * 0.92, 0.025, 6, 32), { p: [r * 0.3, y, 0] });
  bag.add('darkMetal', box(0.16, def.h * 0.6, 0.06), { p: [-r * 0.6 + 0.05, 0, 0] });
}

// ---------------------------------------------------------------------------
// Tuyère en cloche : profil de Rao approché
function bellProfile(rt, re, len, y0, n = 18) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const r = rt + (re - rt) * (1 - Math.pow(1 - s, 2.4));
    pts.push([r, y0 - s * len]);
  }
  return pts;
}

function addBell(bag, rt, re, len, y0, outerKey, innerKey = 'nozzleInner', seg = 40) {
  const pts = bellProfile(rt, re, len, y0);
  // extérieur : on parcourt de bas en haut pour une normale sortante
  const outer = pts.map(([r, y]) => [r + 0.012 * (1 + re), y]).reverse();
  bag.add(outerKey, lathe(outer, seg));
  bag.add(innerKey, lathe(pts.slice().reverse(), seg));
  // lèvre de sortie
  bag.add('darkMetal', lathe([[re, y0 - len], [re + 0.012 * (1 + re) + 0.01, y0 - len]], seg));
}

function buildEngine(def, bag, grp, info) {
  const e = def.engine;
  const h = def.h, d = def.d;
  const top = h / 2, bottom = -h / 2;
  const re = e.exitD / 2;
  const style = def.style;
  const bell = e.bell;

  if (bell === 'cluster9' || bell === 'cluster13') {
    const count = e.count;
    const plateH = 0.35;
    bag.add(bell === 'cluster13' ? 'steel' : 'carbon', lathe([[d / 2, top - plateH], [d / 2, top], [0, top]], 56));
    bag.add('darkMetal', disc(d / 2, top - plateH, false, 56));
    bag.add('darkMetal', lathe([[d / 2 + 0.02, top - 0.06], [d / 2 + 0.02, top]], 56));
    const positions = [];
    if (count === 9) {
      positions.push([0, 0]);
      for (let i = 0; i < 8; i++) positions.push([Math.cos((i * PI) / 4) * d * 0.33, Math.sin((i * PI) / 4) * d * 0.33]);
    } else {
      for (let i = 0; i < 3; i++) positions.push([Math.cos((i * 2 * PI) / 3) * d * 0.1, Math.sin((i * 2 * PI) / 3) * d * 0.1]);
      for (let i = 0; i < 10; i++) positions.push([Math.cos((i * PI) / 5) * d * 0.37, Math.sin((i * PI) / 5) * d * 0.37]);
    }
    const sre = bell === 'cluster13' ? d * 0.068 : d * 0.1;
    const len = h - plateH - 0.25;
    for (const [x, z] of positions) {
      const g1 = new GeoBag();
      addBell(g1, sre * 0.32, sre, len * 0.78, top - plateH - len * 0.22, bell === 'cluster13' ? 'brightMetal' : 'bronze');
      g1.add(bell === 'cluster13' ? 'brightMetal' : 'copper', cyl(sre * 0.45, sre * 0.4, len * 0.22, 16), { p: [0, top - plateH - len * 0.11, 0] });
      for (const [k, list] of g1.map) for (const g of list) bag.add(k, g, { p: [x, 0, z] });
    }
    info.nozzles.push({ y: bottom, r: re, cluster: positions.map(([x, z]) => [x, z, sre]) });
    return;
  }

  if (bell === 'spike') {
    // aérospike : bouchon central et chambres annulaires
    bag.add('darkMetal', lathe([[d / 2 * 0.95, top - 0.4], [d / 2 * 0.95, top], [0, top]], 48));
    const plug = [];
    for (let i = 0; i <= 14; i++) {
      const s = i / 14;
      plug.push([d * 0.38 * (1 - Math.pow(s, 0.7) * 0.75), top - 0.4 - s * (h - 0.4)]);
    }
    plug.push([0, bottom]);
    bag.add('copper', lathe(plug.slice().reverse(), 48));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 2 * PI;
      bag.add('darkMetal', box(0.22, 0.3, 0.12), { p: [Math.cos(a) * d * 0.42, top - 0.5, Math.sin(a) * d * 0.42], r: [0, -a, 0] });
    }
    info.nozzles.push({ y: top - 0.6, r: d * 0.42, spike: true });
    return;
  }

  if (bell === 'ion') {
    bag.add('gold', cyl(d / 2, d / 2, h * 0.7, 32), { p: [0, top - h * 0.35, 0] });
    bag.add('darkMetal', lathe([[d / 2, bottom + h * 0.3], [d / 2 + 0.02, bottom + h * 0.3], [d / 2 + 0.02, bottom + 0.02], [d * 0.45, bottom]], 32));
    const grid = new THREE.Mesh(new THREE.CircleGeometry(d * 0.44, 32), materials().emissiveBlue);
    grid.rotation.x = PI / 2;
    grid.position.y = bottom + 0.03;
    grp.add(grid);
    bag.add('metal', disc(d / 2 * 0.98, top, true, 32));
    info.nozzles.push({ y: bottom, r: d * 0.44 });
    return;
  }

  if (bell === 'fusion') {
    // réacteur à confinement magnétique
    bag.add('darkMetal', lathe([[d / 2, top - 0.3], [d / 2, top], [0, top]], 48));
    bag.add('white', cyl(d * 0.38, d * 0.38, h * 0.45, 40), { p: [0, top - 0.3 - h * 0.225, 0] });
    for (let i = 0; i < 5; i++) bag.add('coil', torus(d * 0.42, 0.07, 8, 48), { p: [0, top - 0.5 - i * h * 0.09, 0] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 2 * PI;
      bag.add('darkMetal', box(0.04, h * 0.4, d * 0.5), { p: [Math.cos(a) * d * 0.62, top - h * 0.3, Math.sin(a) * d * 0.62], r: [0, -a, 0] });
    }
    // tuyère magnétique : anneaux ouverts
    for (let i = 0; i < 4; i++) {
      const rr = d * (0.3 + i * 0.05);
      bag.add('copper', torus(rr, 0.06, 8, 48), { p: [0, bottom + 0.25 + (3 - i) * h * 0.1, 0] });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 2 * PI;
      bag.add('titanium', strut([Math.cos(a) * d * 0.38, top - 0.3 - h * 0.45, Math.sin(a) * d * 0.38], [Math.cos(a) * d * 0.46, bottom + 0.25, Math.sin(a) * d * 0.46], 0.05));
    }
    info.nozzles.push({ y: bottom + 0.3, r: d * 0.4 });
    return;
  }

  if (bell === 'srb' || bell === 'les') return; // traité ailleurs

  // --- moteur à tuyère classique -------------------------------------------
  const vac = bell === 'vac';
  const rt = Math.max(0.05, re * (vac ? 0.12 : 0.2));
  const mountH = Math.min(0.12, h * 0.08);
  const bellLen = vac ? h * 0.66 : h * 0.55;
  const chamberH = h * (vac ? 0.12 : 0.18);
  const chamberR = rt * 1.9;
  const yThroat = bottom + bellLen;
  const yChamberTop = yThroat + chamberH;
  // plaque de montage
  bag.add('darkMetal', lathe([[d / 2 * 0.92, top - mountH], [d / 2 * 0.92, top], [0, top]], 40));
  bag.add('darkMetal', disc(d / 2 * 0.92, top - mountH, false, 40));
  // structure de poussée (cône en treillis)
  const nS = 6;
  for (let i = 0; i < nS; i++) {
    const a = (i / nS) * 2 * PI + 0.3;
    bag.add('titanium', strut([Math.cos(a) * d * 0.42, top - mountH, Math.sin(a) * d * 0.42], [Math.cos(a) * chamberR * 1.1, yChamberTop, Math.sin(a) * chamberR * 1.1], Math.max(0.012, d * 0.012)));
  }
  // dôme d'injection et chambre
  const chamberKey = style === 'phenix' || style === 'phenix_v' ? 'brightMetal' : 'copper';
  bag.add(chamberKey, lathe([[rt, yThroat], [chamberR, yThroat + chamberH * 0.35], [chamberR, yChamberTop], [chamberR * 0.6, yChamberTop + chamberH * 0.25], [0, yChamberTop + chamberH * 0.3]], 32));
  // cloche
  let outerKey = 'darkMetal';
  if (style === 'hydra' || style === 'titan') outerKey = 'bronze';
  if (style === 'phenix') outerKey = 'brightMetal';
  if (vac) {
    // section refroidie puis extension rayonnante (lueur)
    const cut = 0.25;
    const pts = bellProfile(rt, re, bellLen, yThroat);
    const idx = Math.round(pts.length * cut);
    const p1 = pts.slice(0, idx + 1);
    const p2 = pts.slice(idx);
    bag.add(style === 'phenix_v' ? 'brightMetal' : 'bronze', lathe(p1.map(([r, y]) => [r + 0.02, y]).reverse(), 40));
    bag.add('nozzle', lathe(p2.map(([r, y]) => [r + 0.012, y]).reverse(), 48));
    bag.add('nozzleInner', lathe(pts.slice().reverse(), 48));
    bag.add('darkMetal', lathe([[re, bottom], [re + 0.035, bottom]], 48));
    bag.add('darkMetal', torus(p2[0][0] + 0.03, 0.025, 6, 40), { p: [0, p2[0][1], 0] });
  } else {
    addBell(bag, rt, re, bellLen, yThroat, outerKey);
    // anneau de raidissement
    const mid = bellProfile(rt, re, bellLen, yThroat)[10];
    bag.add('metal', torus(mid[0] + 0.03, 0.02 + re * 0.01, 6, 40), { p: [0, mid[1], 0] });
  }
  // turbopompe
  const tpR = Math.max(0.06, chamberR * 0.75);
  const tpX = chamberR + tpR * 1.3;
  const tpY = yChamberTop - chamberH * 0.2;
  bag.add('darkMetal', cyl(tpR, tpR, chamberH * 1.4, 20), { p: [tpX, tpY, 0] });
  bag.add('metal', torus(tpR * 1.05, tpR * 0.25, 8, 24), { p: [tpX, tpY + chamberH * 0.5, 0] });
  // canalisations
  const pr = Math.max(0.018, chamberR * 0.18);
  bag.add(style.startsWith('phenix') ? 'brightMetal' : 'metal', tube([[tpX, tpY + chamberH * 0.7, 0], [tpX * 0.7, top - mountH - 0.05, tpR], [chamberR * 0.6, top - mountH - 0.02, chamberR * 0.8]], pr));
  bag.add(style.startsWith('phenix') ? 'brightMetal' : 'metal', tube([[-chamberR * 0.8, yChamberTop, 0], [-chamberR * 1.6, (yChamberTop + top) / 2, -chamberR * 0.4], [-d * 0.3, top - mountH - 0.02, -d * 0.1]], pr));
  bag.add('copper', tube([[tpX, tpY - chamberH * 0.4, 0], [chamberR * 1.2, yThroat, 0], [rt * 1.1, yThroat - 0.02, 0]], pr * 0.8));
  if (style.startsWith('phenix')) {
    // moteur à flux complet : nombreuses conduites brillantes
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 2 * PI;
      bag.add('brightMetal', tube([[Math.cos(a) * chamberR, yChamberTop, Math.sin(a) * chamberR], [Math.cos(a) * chamberR * 1.6, (yChamberTop + top) / 2, Math.sin(a) * chamberR * 1.6], [Math.cos(a + 0.4) * d * 0.35, top - mountH, Math.sin(a + 0.4) * d * 0.35]], pr * 0.7));
    }
    bag.add('brightMetal', cyl(tpR * 0.9, tpR * 0.9, chamberH * 1.2, 20), { p: [-tpX, tpY, 0] });
  }
  // conduit d'échappement de la turbine (cycle générateur de gaz)
  if (['frelon', 'aquila', 'titan', 'small'].includes(style)) {
    const ex = re + 0.05;
    bag.add('darkMetal', tube([[tpX, tpY - chamberH * 0.6, 0], [tpX * 1.05, yThroat, 0.02], [ex * 0.8, (yThroat + bottom) / 2, 0.05], [ex, bottom + bellLen * 0.12, 0.05]], Math.max(0.03, pr * 1.5)));
  }
  if (style === 'titan') {
    // collecteur d'échappement autour de la cloche
    const mp = bellProfile(rt, re, bellLen, yThroat)[7];
    bag.add('darkMetal', torus(mp[0] + 0.09, 0.08, 10, 48), { p: [0, mp[1], 0] });
  }
  if (style === 'vega') {
    bag.add('gold', cyl(chamberR * 1.4, chamberR * 1.4, chamberH * 1.6, 20), { p: [0, yChamberTop + 0.05, 0] });
  }
  if (style === 'hydra') {
    bag.add('metal', box(d * 0.55, chamberH * 1.2, d * 0.35), { p: [0, yChamberTop + chamberH * 0.4, 0] });
  }
  if (style === 'nuke') {
    // réacteur
    const rr = d * 0.42;
    bag.add('grey', cyl(rr, rr, h * 0.28, 32), { p: [0, top - mountH - h * 0.14, 0] });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 2 * PI;
      bag.add('darkMetal', box(0.03, h * 0.26, 0.14), { p: [Math.cos(a) * (rr + 0.07), top - mountH - h * 0.14, Math.sin(a) * (rr + 0.07)], r: [0, -a, 0] });
    }
    grp.add(curvedDecal(rr + 0.004, top - mountH - h * 0.22, top - mountH - h * 0.06, -PI / 2, 0.9, TX.trefoilDecal()));
  }
  // vérins de cardan
  for (const a of [PI * 0.25, PI * 1.25]) {
    bag.add('metal', strut([Math.cos(a) * d * 0.32, top - mountH, Math.sin(a) * d * 0.32], [Math.cos(a) * chamberR * 1.05, yThroat + chamberH * 0.3, Math.sin(a) * chamberR * 1.05], Math.max(0.02, d * 0.018)));
  }
  info.nozzles.push({ y: bottom, r: re });
}

function buildRadialEngine(def, bag, info) {
  const re = def.engine.exitD / 2;
  bag.add('darkMetal', box(0.18, 0.3, 0.2), { p: [-0.05, def.h / 2 - 0.2, 0] });
  bag.add('copper', cyl(0.07, 0.06, 0.18, 16), { p: [0, def.h / 2 - 0.25, 0] });
  addBell(bag, 0.05, re, def.h * 0.55, def.h / 2 - 0.34, 'darkMetal');
  info.nozzles.push({ y: -def.h / 2, r: re });
}

// ---------------------------------------------------------------------------
function buildSRB(def, bag, grp, info) {
  const r = def.d / 2, h = def.h;
  const skirtH = Math.min(h * 0.12, 1.4 * r + 0.3);
  const nozR = def.engine.exitD / 2;
  const segKey = 'paint';
  bag.add(segKey, lathe([[r, -h / 2 + skirtH], [r, h / 2 - 0.02], [r * 0.97, h / 2]], 48));
  bag.add('darkMetal', disc(r * 0.97, h / 2, true, 40));
  // jonctions de segments
  const nSeg = def.style === 'srb_segmented' ? 5 : Math.max(2, Math.round(h / (r * 4)));
  for (let i = 1; i < nSeg; i++) {
    const y = -h / 2 + skirtH + ((h - skirtH) * i) / nSeg;
    bag.add('darkMetal', lathe([[r + 0.015, y - 0.06], [r + 0.015, y + 0.06]], 48));
  }
  if (def.style === 'srb_segmented') {
    bag.add('orange', lathe([[r + 0.006, h / 2 - 1.2], [r + 0.006, h / 2 - 0.6]], 48));
  }
  // jupe arrière évasée
  bag.add('paint', lathe([[r * 1.18, -h / 2], [r * 1.02, -h / 2 + skirtH * 0.8], [r, -h / 2 + skirtH]], 48));
  bag.add('darkMetal', disc(r * 1.18, -h / 2, false, 40, nozR * 1.1));
  // tuyère
  addBell(bag, nozR * 0.45, nozR, skirtH * 0.7, -h / 2 + skirtH * 0.55, 'ablative');
  // tunnel de câbles
  bag.add('grey', box(0.08 * Math.max(1, r), h - skirtH * 1.3, 0.05), { p: [0, skirtH * 0.2, -(r + 0.025)] });
  if (h > 4) grp.add(curvedDecal(r + 0.006, -h * 0.18, h * 0.28, -PI / 2 + 0.3, Math.min(1.2, (h * 0.07) / r), TX.textDecal('PULSAR', '#1c2230')));
  info.nozzles.push({ y: -h / 2 + skirtH * 0.55 - skirtH * 0.7, r: nozR });
}

function buildLES(def, bag, info) {
  const h = def.h;
  const trussH = h * 0.35;
  // treillis
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 2 * PI + PI / 4;
    bag.add('red', strut([Math.cos(a) * 0.45, -h / 2, Math.sin(a) * 0.45], [Math.cos(a) * 0.12, -h / 2 + trussH, Math.sin(a) * 0.12], 0.03));
  }
  bag.add('red', torus(0.45, 0.035, 6, 24), { p: [0, -h / 2 + 0.03, 0] });
  // moteur
  const mY = -h / 2 + trussH;
  bag.add('white', cyl(0.2, 0.22, h * 0.4, 24), { p: [0, mY + h * 0.2, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 2 * PI;
    bag.add('darkMetal', cyl(0.05, 0.1, 0.25, 12), { p: [Math.cos(a) * 0.22, mY + 0.1, Math.sin(a) * 0.22], r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6] });
  }
  // nez
  const nose = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    nose.push([0.2 * Math.sqrt(1 - s * s * 0.98), mY + h * 0.4 + s * (h * 0.25)]);
  }
  bag.add('orange', lathe(nose, 24));
  info.nozzles.push({ y: mY, r: 0.25, escape: true });
}

// ---------------------------------------------------------------------------
function buildCapsule(def, bag, grp) {
  const R = def.d / 2, rT = (def.dTop ?? def.d * 0.4) / 2, h = def.h;
  const y0 = -h / 2;
  if (def.style === 'alpha') {
    const coneTop = h / 2 - h * 0.28;
    bag.add('paint', lathe([[R, y0 + 0.08], [R * 0.98, y0 + 0.14], [rT * 1.15, coneTop], [rT, coneTop + 0.02]], 48));
    bag.add('paint', lathe([[rT, coneTop + 0.02], [rT, h / 2 - 0.05], [rT * 0.9, h / 2], [0, h / 2]], 32));
    // bardeaux : nervures
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 2 * PI;
      bag.add('darkMetal', strut([Math.cos(a) * (R - 0.01), y0 + 0.14, Math.sin(a) * (R - 0.01)], [Math.cos(a) * rT * 1.16, coneTop, Math.sin(a) * rT * 1.16], 0.008, 4));
    }
    bag.add('ablative', lathe([[0, y0], [R * 0.98, y0], [R, y0 + 0.08]], 40));
    bag.add('white', lathe([[rT + 0.01, coneTop - 0.02], [rT + 0.01, coneTop + 0.06]], 32));
    // hublot face caméra
    bag.add('glass', box(0.22, 0.2, 0.03), { p: [0, (y0 + coneTop) / 2 + 0.1, -(R + rT) / 2 - 0.02], r: [-0.45, 0, 0] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 2 * PI + PI / 4;
      bag.add('darkMetal', cyl(0.025, 0.035, 0.06, 8), { p: [Math.cos(a) * (rT + 0.02), coneTop + 0.15, Math.sin(a) * (rT + 0.02)], r: [0, 0, PI / 2] });
    }
    grp.add(curvedDecal(rT + 0.005, coneTop + 0.05, h / 2 - 0.08, -PI / 2, 1.2, TX.flagDecal()));
    return;
  }
  if (def.style === 'orion') {
    const shoulder = y0 + 0.14;
    const topY = h / 2 - 0.3;
    bag.add('ablative', lathe([[0, y0], [R * 0.95, y0 + 0.02], [R, y0 + 0.08]], 48));
    bag.add('metal', lathe([[R, y0 + 0.08], [R + 0.015, y0 + 0.12], [R, shoulder]], 48));
    bag.add('paint', lathe([[R, shoulder], [rT * 1.02, topY], [rT, topY + 0.02]], 56));
    bag.add('darkMetal', lathe([[rT, topY + 0.02], [rT * 0.9, topY + 0.02], [rT * 0.9, h / 2 - 0.05], [rT * 0.7, h / 2], [0, h / 2]], 32));
    bag.add('metal', torus(rT * 0.8, 0.03, 8, 32), { p: [0, h / 2 - 0.12, 0] });
    // hublots
    for (let i = 0; i < 4; i++) {
      const a = -PI / 2 + (i - 1.5) * 0.42;
      const t = 0.62;
      const rr = R + (rT - R) * t;
      const y = shoulder + (topY - shoulder) * t;
      bag.add('glass', box(0.26, 0.2, 0.03), { p: [Math.cos(a) * (rr + 0.01), y, Math.sin(a) * (rr + 0.01)], r: [0, -a + PI / 2, 0] });
    }
    // modules RCS
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 2 * PI + 0.5;
      const t = 0.8;
      const rr = R + (rT - R) * t;
      bag.add('darkMetal', box(0.14, 0.14, 0.04), { p: [Math.cos(a) * (rr + 0.01), shoulder + (topY - shoulder) * t, Math.sin(a) * (rr + 0.01)], r: [0, -a + PI / 2, 0] });
    }
    return;
  }
  // dragon
  const shoulder = y0 + 0.28;
  const noseBase = h / 2 - 0.45;
  bag.add('ablative', lathe([[0, y0], [R * 0.96, y0 + 0.03], [R, y0 + 0.1]], 48));
  bag.add('black', lathe([[R, y0 + 0.1], [R, shoulder]], 56));
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10;
    const r = R - (R - rT) * Math.pow(s, 1.25);
    prof.push([r, shoulder + s * (noseBase - shoulder)]);
  }
  bag.add('paint', lathe(prof, 56));
  // coiffe de nez articulée
  const cap = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10;
    cap.push([rT * 1.02 * Math.cos((s * PI) / 2.2), noseBase + Math.sin((s * PI) / 2.2) * 0.42]);
  }
  cap.push([0, noseBase + 0.42]);
  bag.add('paint', lathe(cap, 40), { p: [0.06, 0, 0] });
  // hublots
  for (let i = 0; i < 4; i++) {
    const a = -PI / 2 + (i - 1.5) * 0.55;
    const t = 0.55;
    const rr = R - (R - rT) * Math.pow(t, 1.25);
    const y = shoulder + t * (noseBase - shoulder);
    bag.add('glass', cyl(0.13, 0.13, 0.03, 20), { p: [Math.cos(a) * (rr + 0.005), y, Math.sin(a) * (rr + 0.005)], r: [PI / 2, 0, -a + PI / 2] });
  }
  // capots des propulseurs latéraux
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 2 * PI + PI / 4;
    const t = 0.2;
    const rr = R - (R - rT) * Math.pow(t, 1.25);
    bag.add('black', box(0.32, 0.5, 0.08), { p: [Math.cos(a) * (rr + 0.02), shoulder + t * (noseBase - shoulder) + 0.1, Math.sin(a) * (rr + 0.02)], r: [0, -a + PI / 2, 0.0] });
  }
}

function buildProbe(def, bag) {
  const r = def.d / 2, h = def.h;
  if (def.style === 'octo') {
    bag.add('gold', cyl(r * 0.95, r * 0.95, h * 0.8, 8), { r: [0, PI / 8, 0] });
    bag.add('darkMetal', cyl(r, r, h * 0.1, 8), { p: [0, h * 0.45, 0], r: [0, PI / 8, 0] });
    bag.add('darkMetal', cyl(r, r, h * 0.1, 8), { p: [0, -h * 0.45, 0], r: [0, PI / 8, 0] });
    bag.add('metal', strut([r * 0.4, h * 0.5, 0], [r * 0.5, h * 0.5 + 0.25, 0], 0.008));
    bag.add('emissiveGreen', sphere(0.02, 8, 6), { p: [0, 0, -r * 0.96] });
    return;
  }
  bag.add('grey', lathe([[r, -h / 2], [r, h / 2]], 48));
  bag.add('darkMetal', disc(r, h / 2, true, 40, r * 0.55));
  bag.add('darkMetal', disc(r, -h / 2, false, 40, r * 0.55));
  bag.add('darkMetal', lathe([[r * 0.55, h / 2], [r * 0.55, -h / 2]], 32));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 2 * PI;
    bag.add(i % 3 === 0 ? 'gold' : 'darkMetal', box(r * 0.28, h * 0.6, 0.06), { p: [Math.cos(a) * (r + 0.02), 0, Math.sin(a) * (r + 0.02)], r: [0, -a + PI / 2, 0] });
  }
  bag.add('emissiveBlue', box(r * 0.3, 0.03, 0.02), { p: [0, h * 0.25, -r - 0.05] });
}

function buildLander(def, bag) {
  const r = def.d / 2, h = def.h;
  // étage de remontée anguleux
  bag.add('silverFoil', cyl(r * 0.8, r * 0.95, h * 0.55, 6), { p: [0, h * 0.05, 0], r: [0, PI / 6, 0] });
  bag.add('gold', cyl(r * 0.95, r * 0.9, h * 0.3, 8), { p: [0, -h * 0.36, 0], r: [0, PI / 8, 0] });
  bag.add('black', box(r * 1.1, h * 0.35, r * 0.6), { p: [0, h * 0.12, -r * 0.35] });
  // hublots triangulaires
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(0.28, 0); sh.lineTo(0.14 * (s > 0 ? 0 : 2), 0.26); sh.lineTo(0, 0);
    bag.add('glass', extrudeShape(sh, 0.02, 0), { p: [s * 0.25 - 0.14, h * 0.18, -r * 0.66] });
  }
  // écoutille et tunnel
  bag.add('darkMetal', cyl(r * 0.35, r * 0.38, h * 0.18, 24), { p: [0, h / 2 - h * 0.09, 0] });
  bag.add('metal', torus(r * 0.36, 0.03, 6, 24), { p: [0, h / 2 - 0.02, 0] });
  // quadrants RCS
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 2 * PI + PI / 4;
    bag.add('darkMetal', box(0.12, 0.12, 0.12), { p: [Math.cos(a) * r * 0.95, h * 0.15, Math.sin(a) * r * 0.95] });
    for (const dy of [-0.1, 0.1]) bag.add('metal', cyl(0.02, 0.035, 0.08, 8), { p: [Math.cos(a) * r * 0.95, h * 0.15 + dy, Math.sin(a) * r * 0.95] });
  }
  // antenne parabolique
  bag.add('white', lathe([[0.001, 0], [0.12, 0.03], [0.22, 0.09]], 20), { p: [r * 0.5, h / 2 + 0.1, r * 0.3], r: [0.4, 0, 0.3] });
}

function buildHab(def, bag, grp) {
  const r = def.d / 2, h = def.h;
  const lab = def.style === 'lab';
  bag.add('paint', lathe([[r * 0.9, -h / 2], [r, -h / 2 + 0.15], [r, h / 2 - 0.15], [r * 0.9, h / 2]], 56));
  bag.add('darkMetal', disc(r * 0.9, h / 2, true));
  bag.add('darkMetal', disc(r * 0.9, -h / 2, false));
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    bag.add('glass', box(0.3, 0.3, 0.03), { p: [Math.cos(a) * (r + 0.01), h * 0.2, Math.sin(a) * (r + 0.01)], r: [0, -a + PI / 2, 0] });
    bag.add('orange', strut([Math.cos(a + 0.2) * (r + 0.08), -h * 0.35, Math.sin(a + 0.2) * (r + 0.08)], [Math.cos(a + 0.2) * (r + 0.08), h * 0.35, Math.sin(a + 0.2) * (r + 0.08)], 0.015));
  }
  for (const y of [-h * 0.3, 0, h * 0.3]) bag.add('darkMetal', lathe([[r + 0.01, y - 0.03], [r + 0.01, y + 0.03]], 56));
  if (lab) bag.add('navy', lathe([[r + 0.006, -h * 0.12], [r + 0.006, -h * 0.02]], 56));
  if (lab) grp.add(curvedDecal(r + 0.01, -h * 0.28, h * 0.05, -PI / 2, 0.8, TX.textDecal('LABO', '#1c2230')));
}

// ---------------------------------------------------------------------------
function buildDecoupler(def, bag) {
  const r = def.d / 2, h = def.h;
  bag.add('darkMetal', lathe([[r, -h / 2], [r, h / 2]], 48));
  bag.add('darkMetal', disc(r, h / 2, true));
  bag.add('darkMetal', disc(r, -h / 2, false));
  bag.add('hazard', lathe([[r + 0.006, -h * 0.12], [r + 0.006, h * 0.12]], 48));
  const n = Math.max(8, Math.round(def.d * 12));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    bag.add('metal', cyl(0.018, 0.018, 0.03, 6), { p: [Math.cos(a) * (r + 0.012), h * 0.32, Math.sin(a) * (r + 0.012)], r: [0, 0, PI / 2] });
  }
}

function buildInterstage(def, bag) {
  const r = def.d / 2, h = def.h;
  bag.add('paint', lathe([[r, -h / 2], [r, h / 2]], 56));
  bag.add('darkMetal', lathe([[r * 0.97, h / 2], [r * 0.97, -h / 2]], 56));
  bag.add('darkMetal', disc(r, -h / 2, false, 48, r * 0.97));
  bag.add('darkMetal', disc(r, h / 2, true, 48, r * 0.8));
  bag.add('metal', lathe([[r + 0.01, h / 2 - 0.08], [r + 0.01, h / 2]], 56));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 2 * PI + 0.4;
    bag.add('darkMetal', box(0.3, 0.15, 0.03), { p: [Math.cos(a) * (r + 0.01), -h * 0.2, Math.sin(a) * (r + 0.01)], r: [0, -a + PI / 2, 0] });
  }
}

function buildRadialDec(def, bag) {
  const w = def.d, h = def.h;
  bag.add('darkMetal', box(w, h, w * 0.8));
  bag.add('hazard', box(w * 1.02, h * 0.1, w * 0.82), { p: [0, h * 0.3, 0] });
  bag.add('hazard', box(w * 1.02, h * 0.1, w * 0.82), { p: [0, -h * 0.3, 0] });
  bag.add('metal', cyl(0.03, 0.03, w * 1.1, 8), { p: [0, h * 0.4, 0], r: [0, 0, PI / 2] });
  bag.add('metal', cyl(0.03, 0.03, w * 1.1, 8), { p: [0, -h * 0.4, 0], r: [0, 0, PI / 2] });
}

function buildAdapter(def, bag) {
  const rb = def.d / 2, rt = (def.dTop ?? def.d) / 2, h = def.h;
  bag.add('paint', lathe([[rb, -h / 2], [rb, -h / 2 + 0.1], [rt, h / 2 - 0.1], [rt, h / 2]], 56));
  bag.add('darkMetal', disc(rb, -h / 2, false));
  bag.add('darkMetal', disc(rt, h / 2, true));
  bag.add('darkMetal', lathe([[rb + 0.01, -h / 2], [rb + 0.01, -h / 2 + 0.06]], 56));
  bag.add('darkMetal', lathe([[rt + 0.01, h / 2 - 0.06], [rt + 0.01, h / 2]], 56));
}

function buildTruss(def, bag) {
  const r = def.d / 2 * 0.9, h = def.h;
  const n = 6;
  bag.add('grey', torus(r, 0.04, 6, 36), { p: [0, h / 2 - 0.04, 0] });
  bag.add('grey', torus(r, 0.04, 6, 36), { p: [0, -h / 2 + 0.04, 0] });
  bag.add('darkMetal', disc(r, h / 2, true, 24));
  bag.add('darkMetal', disc(r, -h / 2, false, 24));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI, b = ((i + 1) / n) * 2 * PI;
    bag.add('grey', strut([Math.cos(a) * r, -h / 2, Math.sin(a) * r], [Math.cos(a) * r, h / 2, Math.sin(a) * r], 0.03));
    bag.add('metal', strut([Math.cos(a) * r, -h / 2, Math.sin(a) * r], [Math.cos(b) * r, h / 2, Math.sin(b) * r], 0.018));
  }
  bag.add('metal', cyl(0.12, 0.12, h, 12));
}

function buildFairingBase(def, bag) {
  const r = def.d / 2, h = def.h;
  bag.add('darkMetal', lathe([[r, -h / 2], [r * 1.02, h / 2]], 48));
  bag.add('white', disc(r * 1.02, h / 2, true, 48));
  bag.add('darkMetal', disc(r, -h / 2, false));
}

function buildNose(def, bag) {
  const R = def.d / 2, h = def.h;
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const s = i / n; // 0 base -> 1 pointe
    const x = 1 - s;
    const th = Math.acos(1 - 2 * x);
    const r = (R / Math.sqrt(PI)) * Math.sqrt(th - Math.sin(2 * th) / 2);
    pts.push([Math.max(r, 0.004), -h / 2 + s * h]);
  }
  bag.add('paint', lathe(pts.slice(0, n - 1), 48));
  bag.add('darkMetal', lathe(pts.slice(n - 2).concat([[0, h / 2]]), 24));
  bag.add('darkMetal', disc(R, -h / 2, false));
  bag.add('darkMetal', lathe([[R + 0.008, -h / 2], [R + 0.008, -h / 2 + 0.05]], 48));
}

// Ailerons (le plan de l'aileron contient l'axe de la fusée et la normale extérieure)
function finShape(def) {
  const h = def.h, span = def.fin.span;
  const s = new THREE.Shape();
  if (def.style === 'delta') {
    s.moveTo(0, -h / 2);
    s.lineTo(span, -h / 2);
    s.lineTo(span * 0.35, h / 2);
    s.lineTo(0, h / 2);
  } else {
    s.moveTo(0, -h / 2);
    s.lineTo(span, -h / 2 - h * 0.12);
    s.lineTo(span, -h / 2 + h * 0.25);
    s.lineTo(0, h / 2);
  }
  s.lineTo(0, -h / 2);
  return s;
}

function buildFin(def, bag, grp, info) {
  const g = extrudeShape(finShape(def), 0.05, 0.012);
  // plan XY (x vers l'extérieur) : l'extrusion suit Z = épaisseur
  bag.add('paint', g);
  bag.add('darkMetal', box(0.08, def.h * 0.9, 0.09), { p: [0.02, 0, 0] });
  if (def.style === 'delta') {
    // gouverne mobile
    const flap = new THREE.Group();
    const fb = new GeoBag();
    fb.add('black', box(def.fin.span * 0.7, 0.3, 0.045), { p: [def.fin.span * 0.45, -0.15, 0] });
    const fm = fb.build(resolver(def));
    flap.add(fm);
    flap.position.set(0, -def.h / 2 + 0.3, 0);
    grp.add(flap);
    info.anim.flap = flap;
  }
}

function buildGridFin(def, grp, info) {
  const M = materials();
  const pivot = new THREE.Group();
  const bag = new GeoBag();
  const W = def.h, D = 0.35, span = def.fin.span;
  const x0 = 0.25;
  bag.add('titanium', box(0.06, 0.12, 0.12), { p: [0.03, 0, 0] });
  bag.add('titanium', cyl(0.04, 0.04, x0, 8), { p: [x0 / 2, 0, 0], r: [0, 0, PI / 2] });
  // cadre
  const fx = x0, fw = span - x0;
  bag.add('titanium', box(fw, 0.04, D), { p: [fx + fw / 2, W / 2, 0] });
  bag.add('titanium', box(fw, 0.04, D), { p: [fx + fw / 2, -W / 2, 0] });
  bag.add('titanium', box(0.04, W, D), { p: [fx, 0, 0] });
  bag.add('titanium', box(0.04, W, D), { p: [fx + fw, 0, 0] });
  // treillis à 45°
  const n = 7;
  for (let i = -n; i <= n; i++) {
    const c = (i / n) * (fw + W) * 0.5;
    for (const s of [1, -1]) {
      // segment de la ligne y = s*(x - cx) + c limité au cadre
      const pts = [];
      const cx = fx + fw / 2;
      for (const x of [fx, fx + fw]) { const y = s * (x - cx) + c; if (Math.abs(y) <= W / 2) pts.push([x, y]); }
      for (const y of [-W / 2, W / 2]) { const x = cx + (y - c) / s; if (x >= fx && x <= fx + fw) pts.push([x, y]); }
      if (pts.length >= 2) {
        const [a, b] = pts;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > 0.01) bag.add('titanium', box(len, 0.014, D * 0.9), { r: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0] });
      }
    }
  }
  const mesh = bag.build(() => M.titanium);
  pivot.add(mesh);
  grp.add(pivot);
  info.anim.gridfin = pivot;
}

function buildAirbrake(def, grp, info) {
  const M = materials();
  const bag = new GeoBag();
  bag.add('darkMetal', box(0.06, 0.12, 0.5), { p: [0.03, def.h / 2 - 0.06, 0] });
  const hinge = new THREE.Group();
  const pb = new GeoBag();
  pb.add('grey', box(0.04, def.h, 0.6), { p: [0.04, -def.h / 2, 0] });
  pb.add('darkMetal', box(0.05, def.h * 0.1, 0.62), { p: [0.04, -def.h * 0.95, 0] });
  hinge.add(pb.build((k) => M[k]));
  hinge.position.set(0.02, def.h / 2, 0);
  grp.add(bag.build((k) => M[k]));
  grp.add(hinge);
  info.anim.airbrake = hinge;
}

function buildWheel(def, bag) {
  const r = def.d / 2, h = def.h;
  bag.add('grey', lathe([[r, -h / 2], [r, h / 2]], 48));
  bag.add('darkMetal', disc(r, h / 2, true));
  bag.add('darkMetal', disc(r, -h / 2, false));
  for (let i = 0; i < 5; i++) bag.add('darkMetal', torus(r + 0.004, 0.012, 4, 48), { p: [0, -h * 0.35 + (i * h * 0.7) / 4, 0] });
  bag.add('emissiveGreen', box(0.04, 0.04, 0.02), { p: [0, h * 0.2, -r - 0.012] });
}

function buildRCS(def, bag) {
  bag.add('darkMetal', box(0.12, 0.16, 0.16), { p: [0.06, 0, 0] });
  bag.add('grey', box(0.05, 0.22, 0.22), { p: [0.0, 0, 0] });
  const noz = (r, p) => bag.add('metal', cyl(0.015, 0.035, 0.07, 8), { p, r });
  noz([0, 0, 0], [0.13, 0.11, 0]);
  noz([PI, 0, 0], [0.13, -0.11, 0]);
  noz([PI / 2, 0, 0], [0.13, 0, 0.11]);
  noz([-PI / 2, 0, 0], [0.13, 0, -0.11]);
}

function buildBox(def, bag) {
  const w = def.d, h = def.h;
  const depth = (def.rad ?? 0.1) * 2;
  bag.add(def.style === 'battery' ? 'grey' : 'darkMetal', box(depth, h, w), { p: [0, 0, 0] });
  if (def.style === 'battery') {
    bag.add('orange', box(depth + 0.004, h * 0.12, w + 0.004), { p: [0, h * 0.3, 0] });
  } else {
    bag.add('emissiveBlue', box(0.01, h * 0.12, w * 0.6), { p: [depth / 2 + 0.004, h * 0.2, 0] });
    bag.add('gold', box(depth * 0.6, h * 0.5, w * 0.9), { p: [0, -h * 0.1, 0] });
  }
}

function buildBatteryStack(def, bag) {
  const r = def.d / 2, h = def.h;
  bag.add('darkMetal', lathe([[r * 0.9, -h / 2], [r * 0.9, h / 2]], 40));
  bag.add('darkMetal', disc(r * 0.9, h / 2, true));
  bag.add('darkMetal', disc(r * 0.9, -h / 2, false));
  const n = Math.round(def.d * 8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    bag.add('grey', box(0.12, h * 0.8, (2 * PI * r) / n - 0.03), { p: [Math.cos(a) * (r - 0.06), 0, Math.sin(a) * (r - 0.06)], r: [0, -a, 0] });
    bag.add('orange', box(0.125, h * 0.1, (2 * PI * r) / n - 0.03), { p: [Math.cos(a) * (r - 0.06), h * 0.25, Math.sin(a) * (r - 0.06)], r: [0, -a, 0] });
  }
}

function buildSolarFixed(def, bag) {
  bag.add('solarBack', box(0.02, def.h, 0.6), { p: [0.0, 0, 0] });
  bag.add('solar', box(0.004, def.h * 0.94, 0.56), { p: [0.013, 0, 0] });
}

function buildSolarWing(def, grp, info) {
  const M = materials();
  const base = new GeoBag();
  base.add('darkMetal', box(0.2, 0.5, 0.35), { p: [0, 0, 0] });
  base.add('metal', cyl(0.05, 0.05, 0.3, 10), { p: [0.2, 0, 0], r: [0, 0, PI / 2] });
  grp.add(base.build((k) => M[k]));
  const panels = [];
  const N = 6, pw = 0.6, ph = def.h * 0.85;
  const holder = new THREE.Group();
  holder.position.set(0.35, 0, 0);
  for (let i = 0; i < N; i++) {
    const pb = new GeoBag();
    pb.add('solar', box(pw, ph, 0.012), { p: [pw / 2, 0, 0] });
    pb.add('darkMetal', box(pw, 0.03, 0.02), { p: [pw / 2, ph / 2, 0] });
    const m = pb.build((k) => M[k]);
    holder.add(m);
    panels.push(m);
  }
  grp.add(holder);
  info.anim.solarWing = { panels, pw };
}

function buildSolarFan(def, grp, info) {
  const M = materials();
  const base = new GeoBag();
  base.add('darkMetal', box(0.2, 0.3, 0.3), { p: [0.0, 0, 0] });
  base.add('metal', cyl(0.04, 0.04, 0.5, 10), { p: [0.3, 0, 0], r: [0, 0, PI / 2] });
  grp.add(base.build((k) => M[k]));
  const hub = new THREE.Group();
  hub.position.set(0.58, 0, 0);
  const N = 10, R = 1.5;
  const petals = [];
  for (let i = 0; i < N; i++) {
    const pb = new GeoBag();
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    const w = (2 * PI) / N;
    for (let k = 0; k <= 6; k++) {
      const a = -w / 2 + (w * k) / 6;
      sh.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    sh.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(sh);
    g.rotateY(PI / 2); // disque dans le plan YZ, face vers +X
    pb.add('solar', g);
    const m = pb.build((k) => M[k]);
    const piv = new THREE.Group();
    piv.add(m);
    hub.add(piv);
    petals.push(piv);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), M.darkMetal);
  cap.rotation.z = PI / 2;
  hub.add(cap);
  grp.add(hub);
  info.anim.solarFan = { petals, N };
}

function buildRTG(def, bag, grp) {
  const h = def.h;
  bag.add('darkMetal', box(0.12, 0.3, 0.2), { p: [-0.12, 0, 0] });
  bag.add('grey', cyl(0.12, 0.12, h, 16), { p: [0.1, 0, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 2 * PI;
    bag.add('darkMetal', box(0.2, h * 0.85, 0.015), { p: [0.1 + Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], r: [0, -a, 0] });
  }
  bag.add('emissiveRed', torus(0.125, 0.01, 4, 20), { p: [0.1, h * 0.46, 0] });
  const d = curvedDecal(0.125, -0.12, 0.12, -PI / 2, 1.6, TX.trefoilDecal());
  d.position.x = 0.1;
  grp.add(d);
}

export { legGeometry, legFoot };

function buildLegs(def, grp, info) {
  const M = materials();
  const g = legGeometry(def);
  const bag = new GeoBag();
  const pivot = new THREE.Group();
  pivot.position.set(g.pivot[0], g.pivot[1], 0);
  if (def.legs.fold) {
    // jambe en carbone : pointe vers le haut au repos (le long de l'étage)
    const lb = new GeoBag();
    const w = def.d * 0.6;
    lb.add(def.style === 'steelleg' ? 'steel' : 'carbon', cyl(w * 0.35, w * 0.55, g.L, 4), { p: [0, g.L / 2, 0], r: [0, PI / 4, 0] });
    lb.add('darkMetal', cyl(w * 0.5, w * 0.7, 0.12, 12), { p: [0, g.L, 0] });
    lb.add('metal', cyl(w * 0.15, w * 0.15, g.L * 0.5, 8), { p: [-w * 0.3, g.L * 0.55, 0] });
    pivot.add(lb.build((k) => M[k]));
    bag.add('darkMetal', box(0.2, 0.3, def.d * 0.8), { p: [0.05, -def.h / 2 + 0.15, 0] });
    bag.add('darkMetal', box(0.12, 0.2, def.d * 0.5), { p: [0.05, def.h / 2 - 0.2, 0] });
  } else {
    const lb = new GeoBag();
    lb.add('metal', cyl(0.035, 0.03, g.L, 10), { p: [0, -g.L / 2, 0] });
    lb.add('gold', cyl(0.06, 0.06, g.L * 0.45, 10), { p: [0, -g.L * 0.25, 0] });
    lb.add('silverFoil', lathe([[0.001, -0.04], [0.2, -0.02], [0.24, 0.05]], 20), { p: [0, -g.L, 0] });
    pivot.add(lb.build((k) => M[k]));
    bag.add('gold', box(0.12, 0.25, 0.25), { p: [0.04, def.h / 2 - 0.12, 0] });
  }
  grp.add(bag.build((k) => M[k]));
  grp.add(pivot);
  info.anim.leg = { pivot, g };
}

function buildChute(def, bag) {
  const rb = def.d / 2, rt = (def.dTop ?? def.d * 0.5) / 2, h = def.h;
  bag.add('darkMetal', lathe([[rb, -h / 2], [rb, -h / 2 + 0.05]], 40));
  bag.add(def.style === 'drogue' ? 'grey' : 'white', lathe([[rb, -h / 2 + 0.05], [rt * 1.1, h / 2 - 0.08], [rt, h / 2 - 0.04]], 40));
  bag.add('orange', lathe([[rt, h / 2 - 0.04], [rt * 0.8, h / 2], [0, h / 2]], 32));
  bag.add('darkMetal', disc(rb, -h / 2, false));
}

function buildRadialChute(def, bag) {
  bag.add('white', new THREE.CapsuleGeometry(def.d * 0.4, def.h - def.d * 0.8, 6, 16), { p: [0.02, 0, 0] });
  bag.add('orange', sphere(def.d * 0.41, 16, 8), { p: [0.02, def.h / 2 - def.d * 0.4, 0], s: [1, 0.6, 1] });
  bag.add('darkMetal', box(0.08, def.h * 0.6, 0.12), { p: [-0.1, 0, 0] });
}

function buildHeatShield(def, bag) {
  const r = def.d / 2, h = def.h;
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10;
    pts.push([r * 1.03 * s, -h / 2 - 0.04 * (1 - s * s) * def.d]);
  }
  bag.add('shield', lathe(pts, 56));
  bag.add('metal', lathe([[r * 1.03, -h / 2], [r * 1.03, -h / 2 + h * 0.5], [r, h / 2]], 56));
  bag.add('darkMetal', disc(r, h / 2, true));
}

function buildLight(def, bag) {
  bag.add('darkMetal', box(0.1, 0.12, 0.12), { p: [0, 0, 0] });
  bag.add('darkMetal', cyl(0.08, 0.06, 0.1, 16), { p: [0.1, 0, 0], r: [0, 0, PI / 2] });
  bag.add('lamp', new THREE.CircleGeometry(0.07, 16).rotateY(PI / 2), { p: [0.152, 0, 0] });
}

function buildScience(def, bag, grp) {
  const s = def.style;
  if (s === 'thermo') {
    bag.add('grey', box(0.06, 0.12, 0.1), { p: [0.03, -0.08, 0] });
    bag.add('metal', cyl(0.012, 0.012, 0.25, 6), { p: [0.05, 0.05, 0] });
    bag.add('emissiveRed', sphere(0.02, 8, 6), { p: [0.05, 0.18, 0] });
  } else if (s === 'baro') {
    bag.add('grey', box(0.06, 0.2, 0.12), { p: [0.03, 0, 0] });
    bag.add('metal', sphere(0.06, 12, 8), { p: [0.07, 0.03, 0], s: [1, 1, 1] });
  } else if (s === 'goo') {
    bag.add('grey', cyl(0.2, 0.2, 0.35, 20), { p: [0.2, 0, 0] });
    bag.add('goo', sphere(0.12, 16, 12), { p: [0.2, 0, -0.1] });
    bag.add('darkMetal', torus(0.2, 0.02, 6, 24), { p: [0.2, 0.17, 0] });
    bag.add('darkMetal', torus(0.2, 0.02, 6, 24), { p: [0.2, -0.17, 0] });
  } else if (s === 'spectro') {
    bag.add('gold', box(0.3, 0.45, 0.4), { p: [0.1, 0, 0] });
    bag.add('darkMetal', cyl(0.1, 0.12, 0.25, 16), { p: [0.3, 0.1, 0], r: [0, 0, PI / 2] });
    bag.add('glass', new THREE.CircleGeometry(0.09, 16).rotateY(PI / 2), { p: [0.43, 0.1, 0] });
  } else if (s === 'gold') {
    bag.add('gold', new THREE.SphereGeometry(0.15, 16, 10, 0, PI * 2, 0, PI / 2), { p: [0.12, 0, 0] });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 2 * PI;
      bag.add('metal', strut([0.12, 0, 0], [0.12 + Math.cos(a) * 0.15, -0.15, Math.sin(a) * 0.15], 0.012));
    }
  } else if (s === 'drill') {
    bag.add('darkMetal', box(0.3, 0.5, 0.35), { p: [0.1, 0.25, 0] });
    bag.add('orange', box(0.305, 0.08, 0.355), { p: [0.1, 0.42, 0] });
    bag.add('metal', cyl(0.05, 0.02, 0.7, 12), { p: [0.2, -0.25, 0] });
    for (let i = 0; i < 8; i++) bag.add('brightMetal', torus(0.05, 0.01, 4, 12), { p: [0.2, -0.05 - i * 0.07, 0] });
  }
  void grp;
}

function buildAntenna(def, bag) {
  bag.add('darkMetal', box(0.06, 0.1, 0.06), { p: [0, -def.h / 2 + 0.05, 0] });
  bag.add('metal', cyl(0.008, 0.012, def.h, 6), { p: [0.02, 0, 0] });
  bag.add('emissiveRed', sphere(0.015, 6, 4), { p: [0.02, def.h / 2, 0] });
}

function buildDish(def, grp, info) {
  const M = materials();
  const R = def.d / 2;
  const base = new GeoBag();
  base.add('darkMetal', box(0.14, 0.3, 0.3), { p: [0, 0, 0] });
  grp.add(base.build((k) => M[k]));
  const piv = new THREE.Group();
  piv.position.set(0.1, 0, 0);
  const b = new GeoBag();
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10;
    prof.push([R * s, R * 0.3 * s * s]);
  }
  const g = lathe(prof, 40);
  g.rotateZ(-PI / 2);
  b.add('ceramic', g, { p: [0.25, 0, 0] });
  const gb = lathe(prof.map(([r, y]) => [r, y - 0.01]).reverse(), 40);
  gb.rotateZ(-PI / 2);
  b.add('darkMetal', gb, { p: [0.25, 0, 0] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 2 * PI;
    b.add('metal', strut([0.25 + R * 0.3, Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9], [0.25 + R * 0.6, 0, 0], 0.01));
  }
  b.add('gold', cyl(0.05, 0.03, 0.12, 10), { p: [0.25 + R * 0.62, 0, 0], r: [0, 0, PI / 2] });
  b.add('metal', cyl(0.04, 0.04, 0.2, 8), { p: [0.12, 0, 0], r: [0, 0, PI / 2] });
  piv.add(b.build((k) => M[k]));
  grp.add(piv);
  info.anim.dish = piv;
}

function buildSpecialRing(def, bag) {
  const r = def.d / 2, h = def.h;
  if (def.style === 'pressure') {
    bag.add('titanium', lathe([[r, -h / 2], [r, h / 2]], 56));
    for (let i = 0; i < 5; i++) bag.add('metal', torus(r + 0.03, 0.035, 8, 56), { p: [0, -h * 0.4 + (i * h * 0.8) / 4, 0] });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 2 * PI;
      bag.add('coil', box(0.02, h * 0.7, 0.04), { p: [Math.cos(a) * (r + 0.02), 0, Math.sin(a) * (r + 0.02)], r: [0, -a, 0] });
    }
  } else if (def.style === 'radiation') {
    bag.add('tantalum', lathe([[r, -h / 2], [r, h / 2]], 56));
    for (let i = 0; i < 3; i++) bag.add('copper', torus(r + 0.06, 0.06, 10, 56), { p: [0, -h * 0.3 + i * h * 0.3, 0] });
    bag.add('hazard', lathe([[r + 0.004, h * 0.42], [r + 0.004, h * 0.5]], 56));
  } else {
    bag.add('aerogel', lathe([[r * 0.98, -h / 2], [r + 0.05, -h / 2 + 0.08], [r + 0.05, h / 2 - 0.08], [r * 0.98, h / 2]], 56));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 2 * PI;
      bag.add('darkMetal', box(0.16, h * 0.6, 0.02), { p: [Math.cos(a) * (r + 0.12), 0, Math.sin(a) * (r + 0.12)], r: [0, -a, 0] });
    }
    bag.add('emissiveBlue', torus(r + 0.055, 0.012, 4, 56), { p: [0, 0, 0] });
  }
  bag.add('darkMetal', disc(r, h / 2, true));
  bag.add('darkMetal', disc(r, -h / 2, false));
}

function buildSunshield(def, bag) {
  const R = def.d / 2, h = def.h;
  bag.add('ceramic', lathe([[R, -h / 2 + 0.1], [R * 0.2, h / 2], [0, h / 2]], 56));
  bag.add('gold', lathe([[0, -h / 2], [R, -h / 2 + 0.1]], 56));
  bag.add('darkMetal', torus(R, 0.03, 6, 56), { p: [0, -h / 2 + 0.1, 0] });
}

// ---------------------------------------------------------------------------
// Construction d'un modèle complet de pièce.
// Renvoie { root, info } où info contient les tuyères et animations.
const CACHE = new Map();

export function buildPartModel(defOrId, paint = null) {
  const def = typeof defOrId === 'string' ? PART_BY_ID[defOrId] : defOrId;
  const key = def.id + '|' + (paint || '');
  let proto = CACHE.get(key);
  if (!proto) {
    proto = buildProto(def, paint);
    CACHE.set(key, proto);
  }
  // clone (géométries partagées), matériaux par instance clonés
  const root = proto.root.clone(true);
  const clonedMats = new Map();
  root.traverse((o) => {
    if (o.isMesh && o.userData.matKey && PER_INSTANCE.has(o.userData.matKey)) {
      if (!clonedMats.has(o.userData.matKey)) clonedMats.set(o.userData.matKey, o.material.clone());
      o.material = clonedMats.get(o.userData.matKey);
    }
  });
  // retrouve les objets animés dans le clone par leur nom
  const info = { nozzles: proto.info.nozzles, anim: {}, mats: clonedMats, def };
  root.traverse((o) => {
    if (o.userData.animKey) info.anim[o.userData.animKey] = o;
  });
  if (proto.info.anim.solarWing) {
    const holder = root.getObjectByName('solarWingHolder');
    info.anim.solarWing = { panels: holder ? holder.children : [], pw: proto.info.anim.solarWing.pw };
  }
  if (proto.info.anim.solarFan) {
    const hub = root.getObjectByName('solarFanHub');
    info.anim.solarFan = { petals: hub ? hub.children.filter((c) => c.isGroup) : [], N: proto.info.anim.solarFan.N };
  }
  if (proto.info.anim.leg) info.anim.leg = { pivot: root.getObjectByName('legPivot'), g: proto.info.anim.leg.g };
  return { root, info };
}

function buildProto(def, paint) {
  const bag = new GeoBag();
  const grp = new THREE.Group();
  const info = { nozzles: [], anim: {} };
  switch (def.shape) {
    case 'tank': buildTank(def, bag, grp); break;
    case 'sphere_tank': buildSphereTank(def, bag); break;
    case 'capsule_tank': buildCapsuleTank(def, bag); break;
    case 'engine': buildEngine(def, bag, grp, info); break;
    case 'radial_engine': buildRadialEngine(def, bag, info); break;
    case 'srb': buildSRB(def, bag, grp, info); break;
    case 'les': buildLES(def, bag, info); break;
    case 'capsule': buildCapsule(def, bag, grp); break;
    case 'probe': buildProbe(def, bag); break;
    case 'lander': buildLander(def, bag); break;
    case 'hab': buildHab(def, bag, grp); break;
    case 'decoupler': buildDecoupler(def, bag); break;
    case 'interstage': buildInterstage(def, bag); break;
    case 'radial_dec': buildRadialDec(def, bag); break;
    case 'adapter': buildAdapter(def, bag); break;
    case 'truss': buildTruss(def, bag); break;
    case 'fairing': buildFairingBase(def, bag); break;
    case 'nose': buildNose(def, bag); break;
    case 'fin': buildFin(def, bag, grp, info); break;
    case 'gridfin': buildGridFin(def, grp, info); break;
    case 'airbrake': buildAirbrake(def, grp, info); break;
    case 'wheel': buildWheel(def, bag); break;
    case 'rcs': buildRCS(def, bag); break;
    case 'box': buildBox(def, bag); break;
    case 'batterystack': buildBatteryStack(def, bag); break;
    case 'solar_fixed': buildSolarFixed(def, bag); break;
    case 'solar_wing': buildSolarWing(def, grp, info); break;
    case 'solar_fan': buildSolarFan(def, grp, info); break;
    case 'rtg': buildRTG(def, bag, grp); break;
    case 'legs_lander':
    case 'legs_fold': buildLegs(def, grp, info); break;
    case 'chute': buildChute(def, bag); break;
    case 'chute_rad': buildRadialChute(def, bag); break;
    case 'heatshield': buildHeatShield(def, bag); break;
    case 'light': buildLight(def, bag); break;
    case 'sci_small':
    case 'sci_goo':
    case 'sci_spectro':
    case 'sci_seismo':
    case 'sci_drill': buildScience(def, bag, grp); break;
    case 'antenna': buildAntenna(def, bag); break;
    case 'dish': buildDish(def, grp, info); break;
    case 'special_ring': buildSpecialRing(def, bag); break;
    case 'sunshield': buildSunshield(def, bag); break;
    default:
      bag.add('paint', cyl(def.d / 2, def.d / 2, def.h, 24));
  }
  const res = resolver(def, paint);
  const main = bag.build(res, 'main');
  const root = new THREE.Group();
  root.add(main);
  // les sous-groupes animés : noms pour les retrouver après clonage
  for (const c of grp.children.slice()) root.add(c);
  if (info.anim.flap) { info.anim.flap.userData.animKey = 'flap'; }
  if (info.anim.gridfin) { info.anim.gridfin.userData.animKey = 'gridfin'; }
  if (info.anim.airbrake) { info.anim.airbrake.userData.animKey = 'airbrake'; }
  if (info.anim.dish) { info.anim.dish.userData.animKey = 'dish'; }
  if (info.anim.leg) info.anim.leg.pivot.name = 'legPivot';
  if (info.anim.solarWing) info.anim.solarWing.panels[0].parent.name = 'solarWingHolder';
  if (info.anim.solarFan) info.anim.solarFan.petals[0].parent.name = 'solarFanHub';
  // matériaux des sous-groupes : repeinture
  root.traverse((o) => {
    if (o.isMesh && o.userData.matKey === 'paint') o.material = res('paint');
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return { root, info };
}

// ---------------------------------------------------------------------------
// Animation des pièces (déploiement 0..1, contrôle -1..1)
export function animatePart(info, state) {
  const a = info.anim;
  const def = info.def;
  if (a.leg && a.leg.pivot) {
    const t = state.deploy ?? 0;
    if (def.legs.fold) {
      a.leg.pivot.rotation.z = -(a.leg.g.stowed + (a.leg.g.deployed - a.leg.g.stowed) * t);
    } else {
      const g = a.leg.g;
      const ang = g.stowed + (g.deployed - g.stowed) * t;
      a.leg.pivot.rotation.z = ang;
    }
  }
  if (a.solarWing) {
    const t = state.deploy ?? 0;
    const { panels, pw } = a.solarWing;
    panels.forEach((p, i) => {
      const fold = (1 - t) * (i % 2 ? -1 : 1) * 1.45;
      p.position.x = i * pw * (0.04 + 0.96 * t);
      p.position.z = (i % 2) * 0.012;
      p.rotation.y = fold * 0.0;
      p.scale.x = 0.05 + 0.95 * t;
      p.visible = t > 0.01 || i === 0;
    });
  }
  if (a.solarFan) {
    const t = state.deploy ?? 0;
    const { petals, N } = a.solarFan;
    petals.forEach((p, i) => {
      p.rotation.x = ((i * 2 * PI) / N) * t;
      p.scale.setScalar(0.35 + 0.65 * Math.min(1, t * 1.5));
    });
  }
  if (a.dish) {
    const t = state.deploy ?? 1;
    a.dish.rotation.z = (1 - t) * (PI / 2);
    a.dish.scale.setScalar(0.4 + 0.6 * t);
  }
  if (a.flap) a.flap.rotation.z = (state.control ?? 0) * 0.35;
  if (a.gridfin) {
    const t = state.deploy ?? 1;
    a.gridfin.rotation.z = (1 - t) * (PI / 2) * 0.95;
    a.gridfin.rotation.x = (state.control ?? 0) * 0.35;
  }
  if (a.airbrake) a.airbrake.rotation.z = (state.deploy ?? 0) * 0.9;
}

// ---------------------------------------------------------------------------
// Coques de coiffe générées selon le contenu (profil [r, y] relatif à la base)
export function buildFairingShells(baseDef, contentTop, contentMaxR, halves = 2) {
  const M = materials();
  const r0 = baseDef.d / 2 * 1.02;
  const R = Math.max(r0, contentMaxR + 0.1);
  const cylH = Math.max(0.3, contentTop - R * 0.6);
  const noseH = R * 1.6;
  const pts = [[r0, 0], [R, Math.min(0.5, cylH * 0.2)], [R, cylH]];
  for (let i = 1; i <= 12; i++) {
    const s = i / 12;
    const r = R * Math.sqrt(1 - Math.pow(s, 1.8));
    pts.push([Math.max(r, 0.02), cylH + s * noseH]);
  }
  pts.push([0, cylH + noseH + 0.02]);
  const shells = [];
  for (let k = 0; k < halves; k++) {
    const phi0 = (k / halves) * 2 * PI + PI / 2;
    const bag = new GeoBag();
    bag.add('white', lathe(pts, 32, phi0, (2 * PI) / halves));
    bag.add('darkMetal', lathe(pts.slice().reverse().map(([r, y]) => [r - 0.03, y]), 32, phi0, (2 * PI) / halves));
    const m = bag.build((key) => M[key]);
    m.userData.phiMid = phi0 + PI / halves;
    shells.push(m);
  }
  return { shells, height: cylH + noseH, radius: R };
}

// Voilure de parachute déployée (hémisphère aplati + suspentes)
export function buildCanopy(radius, lines = 12, length = 2.2) {
  const M = materials();
  const grp = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    const a = s * (PI / 2) * 0.92;
    prof.push([Math.sin(a) * radius, Math.cos(a) * radius * 0.6]);
  }
  const g = lathe(prof.slice().reverse(), 24);
  // UV : fuseaux
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) / (2 * PI * radius));
  const can = new THREE.Mesh(g, M.canopy);
  can.castShadow = true;
  can.position.y = length * radius;
  grp.add(can);
  const pos = [];
  for (let i = 0; i < lines; i++) {
    const a = (i / lines) * 2 * PI;
    pos.push(0, 0, 0, Math.cos(a) * radius * 0.99, length * radius + radius * 0.06, Math.sin(a) * radius * 0.99);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  grp.add(new THREE.LineSegments(lg, M.line));
  grp.userData.canopy = can;
  return grp;
}
