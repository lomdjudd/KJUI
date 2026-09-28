import * as THREE from 'three';
import { makeCanvas, damp, mulberry32 } from '../engine/utils.js';

export const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee'];

// ---------- Géométries sculptées ----------
// Profils [y, rayon] du bas vers le haut, révolution autour de Y.
// u = 0.25 : face avant (+Z), u = 0 et 0.5 : flancs, u = 0.75 : dos.
const PROFILES = {
  pelvis: [[-0.17, 0], [-0.16, 0.06], [-0.13, 0.103], [-0.08, 0.126], [-0.02, 0.134], [0.04, 0.13], [0.09, 0.12], [0.13, 0.108], [0.15, 0]],
  torso: [[-0.21, 0], [-0.2, 0.1], [-0.16, 0.118], [-0.1, 0.124], [-0.03, 0.132], [0.04, 0.145], [0.11, 0.158], [0.17, 0.162], [0.22, 0.152], [0.26, 0.128], [0.29, 0.095], [0.31, 0.06], [0.32, 0]],
  neck: [[-0.05, 0], [-0.045, 0.05], [0, 0.057], [0.06, 0.051], [0.1, 0.046], [0.12, 0]],
  upperArm: [[-0.325, 0], [-0.31, 0.036], [-0.27, 0.043], [-0.2, 0.05], [-0.13, 0.056], [-0.07, 0.06], [-0.02, 0.069], [0.02, 0.07], [0.05, 0.058], [0.07, 0.035], [0.078, 0]],
  foreArm: [[-0.275, 0], [-0.265, 0.03], [-0.24, 0.032], [-0.18, 0.038], [-0.11, 0.047], [-0.05, 0.05], [0, 0.047], [0.03, 0.036], [0.047, 0]],
  hand: [[-0.075, 0], [-0.07, 0.022], [-0.05, 0.04], [-0.01, 0.046], [0.03, 0.043], [0.05, 0.033], [0.058, 0]],
  thumb: [[-0.045, 0], [-0.04, 0.014], [-0.01, 0.016], [0.01, 0.015], [0.018, 0]],
  thigh: [[-0.46, 0], [-0.445, 0.048], [-0.41, 0.056], [-0.34, 0.064], [-0.25, 0.075], [-0.15, 0.085], [-0.06, 0.09], [0, 0.088], [0.04, 0.075], [0.07, 0.045], [0.08, 0]],
  shin: [[-0.43, 0], [-0.42, 0.034], [-0.38, 0.036], [-0.3, 0.042], [-0.2, 0.052], [-0.12, 0.06], [-0.05, 0.058], [0, 0.056], [0.04, 0.045], [0.06, 0]],
  foot: [[-0.075, 0], [-0.07, 0.03], [-0.045, 0.042], [0, 0.044], [0.05, 0.042], [0.1, 0.036], [0.14, 0.022], [0.155, 0]],
};

const bump = (y, a, b) => (y <= a || y >= b ? 0 : Math.sin(((y - a) / (b - a)) * Math.PI));
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Normales lisses, y compris sur les coutures et les pôles (sommets confondus)
function smoothNormals(g) {
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    let e = groups.get(key);
    if (!e) groups.set(key, (e = { x: 0, y: 0, z: 0, ids: [] }));
    e.x += nor.getX(i);
    e.y += nor.getY(i);
    e.z += nor.getZ(i);
    e.ids.push(i);
  }
  for (const e of groups.values()) {
    const l = Math.hypot(e.x, e.y, e.z) || 1;
    for (const i of e.ids) nor.setXYZ(i, e.x / l, e.y / l, e.z / l);
  }
  return g;
}

function sculpt(profile, { seg = 18, sx = 1, sz = 1, r = 1, warp = null } = {}) {
  const pts = profile.map(([y, rad]) => new THREE.Vector2(rad * r, y));
  const g = new THREE.LatheGeometry(pts, seg, -Math.PI / 2, Math.PI * 2);
  const n = pts.length;
  // v proportionnel à la longueur du profil (toile régulière)
  const cum = [0];
  for (let j = 1; j < n; j++) cum.push(cum[j - 1] + pts[j].distanceTo(pts[j - 1]));
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    uv.setY(k, cum[k % n] / cum[n - 1]);
    v.fromBufferAttribute(pos, k);
    v.x *= typeof sx === 'function' ? sx(v.y) : sx;
    v.z *= typeof sz === 'function' ? sz(v.y) : sz;
    if (warp) warp(v);
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  return smoothNormals(g);
}

const HEAD_R = 0.125;
const HEAD_AXES = [0.9, 1.12, 1];

function headGeometry(s, hero) {
  const g = new THREE.SphereGeometry(HEAD_R, 32, 24);
  // Pôle de la sphère sur le visage (un peu sous les yeux) : la texture forme une toile radiale
  // (visages texturés des autres personnages : sphère standard, u = 0,25 face avant)
  if (hero) g.rotateX(Math.PI / 2 + 0.18);
  g.scale(HEAD_AXES[0] * s, HEAD_AXES[1] * s, HEAD_AXES[2] * s);
  if (hero) {
    // Menton plus fin, arrière du crâne légèrement aplati
    const pos = g.attributes.position;
    const b = HEAD_R * HEAD_AXES[1] * s;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      const t = Math.max(0, -y / b);
      const x = pos.getX(k) * (1 - 0.24 * t * t);
      let z = pos.getZ(k);
      z *= z < 0 ? 0.95 : 1 - 0.1 * t * t;
      pos.setXYZ(k, x, y, z);
    }
  }
  return smoothNormals(g);
}

// Grille d'une lentille d'œil posée sur l'ellipsoïde de la tête (coordonnées angulaires)
const EYE_BOX = { az0: 0.02, az1: 0.86, el0: -0.2, el1: 0.42 };
function eyePatchGeometry(axes, mirror) {
  const [a, b, c] = axes;
  const nx = 14;
  const ny = 10;
  const pos = [];
  const nor = [];
  const uvs = [];
  const idx = [];
  const d = new THREE.Vector3();
  const nn = new THREE.Vector3();
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const v = j / ny;
      const az = (EYE_BOX.az0 + (EYE_BOX.az1 - EYE_BOX.az0) * u) * (mirror ? -1 : 1);
      const el = EYE_BOX.el0 + (EYE_BOX.el1 - EYE_BOX.el0) * v;
      d.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      const s = 1 / Math.sqrt((d.x / a) ** 2 + (d.y / b) ** 2 + (d.z / c) ** 2);
      nn.set((d.x * s) / (a * a), (d.y * s) / (b * b), (d.z * s) / (c * c)).normalize();
      d.multiplyScalar(s).addScaledVector(nn, 0.0015);
      pos.push(d.x, d.y, d.z);
      nor.push(nn.x, nn.y, nn.z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = j * (nx + 1) + i;
      const q = p + nx + 1;
      if (mirror) idx.push(p, q, p + 1, p + 1, q, q + 1);
      else idx.push(p, p + 1, q, p + 1, q + 1, q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

// ---------- Textures de costume ----------
const wrap = (u) => u - Math.round(u);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Distance (m) à une toile radiale : rayons + anneaux festonnés vers le centre
function radialWeb(x, y, spokes, ring, sag) {
  const r = Math.hypot(x, y);
  const step = (Math.PI * 2) / spokes;
  const f = Math.atan2(x, y) / step;
  const dSpoke = r * Math.abs(Math.sin((f - Math.round(f)) * step));
  const t = f - Math.floor(f);
  const bow = 1 - sag * Math.sin(Math.PI * t);
  const rr = r / bow;
  const k = Math.round(rr / ring);
  const dRing = k === 0 ? Infinity : Math.abs(rr - k * ring) * bow;
  return Math.min(dSpoke, dRing);
}

// Distance (m) à une toile en grille autour d'un membre : lignes verticales + anneaux festonnés
function gridWeb(u, v, n, C, L, ring, sag) {
  const X = u * n;
  const dV = (Math.abs(X - Math.round(X)) / n) * C;
  const t = X - Math.floor(X);
  const Y = v * L + sag * ring * Math.sin(Math.PI * t);
  const dH = Math.abs(Y - Math.round(Y / ring) * ring);
  return Math.min(dV, dH);
}

function hexRGB(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

function drawSpider(ctx, s) {
  // Emblème en mètres, y vers le haut (s = échelle)
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.ellipse(0, 0.026, 0.011, 0.015, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -0.016, 0.014, 0.028, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.0055;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const legs = [
    [0.008, 0.03, 0.03, 0.05, 0.036, 0.085],
    [0.009, 0.022, 0.042, 0.03, 0.058, 0.058],
    [0.01, -0.004, 0.042, -0.008, 0.058, -0.04],
    [0.009, -0.014, 0.03, -0.04, 0.034, -0.08],
  ];
  for (const sx of [-1, 1]) {
    for (const l of legs) {
      ctx.beginPath();
      ctx.moveTo(sx * l[0], l[1]);
      ctx.lineTo(sx * l[2], l[3]);
      ctx.lineTo(sx * l[4], l[5]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Peint une texture de costume pixel par pixel + carte de relief des coutures de toile
function paintSuit({ w, h, C, L, region, web, main, alt, lines, lw = 0.0017, emblems = [], emblemColor = null, seed = 1 }) {
  const rng = mulberry32(seed);
  const cMain = hexRGB(main);
  const cAlt = hexRGB(alt);
  const cLine = hexRGB(lines);
  const sameAlt = main.toLowerCase() === alt.toLowerCase();
  const pix = Math.max(C / w, L / h);
  const height = new Float32Array(w * h);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let py = 0; py < h; py++) {
    const v = 1 - (py + 0.5) / h;
    for (let px = 0; px < w; px++) {
      const u = (px + 0.5) / w;
      const s = sameAlt || !region ? 1 : region(u, v);
      const am = clamp01(s / pix + 0.5);
      const d = web ? web(u, v) : Infinity;
      const aw = clamp01((lw - d) / pix + 0.5) * am;
      const ab = sameAlt || !region ? 0 : clamp01((0.0022 - Math.abs(s)) / pix + 0.5);
      const line = Math.max(aw, ab) * 0.92;
      const grain = 1 + (rng() - 0.5) * 0.05;
      const o = (py * w + px) * 4;
      for (let k = 0; k < 3; k++) {
        const base = (cAlt[k] + (cMain[k] - cAlt[k]) * am) * grain;
        data[o + k] = base + (cLine[k] - base) * line;
      }
      data[o + 3] = 255;
      height[py * w + px] = aw + ab * 0.7;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (emblems.length && emblemColor) {
    const mask = makeCanvas(w, h);
    const mctx = mask.getContext('2d', { willReadFrequently: true });
    for (const [target, color] of [
      [ctx, emblemColor],
      [mctx, '#ffffff'],
    ]) {
      for (const e of emblems) {
        target.save();
        target.translate(e.u * w, (1 - e.v) * h);
        target.scale(w / C, -h / L);
        target.fillStyle = color;
        target.strokeStyle = color;
        drawSpider(target, e.s);
        target.restore();
      }
    }
    const md = mctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) height[i] = Math.max(height[i], (md[i * 4] / 255) * 1.2);
  }
  // Carte de normales (u bouclé horizontalement)
  const n = makeCanvas(w, h);
  const nctx = n.getContext('2d');
  const nimg = nctx.createImageData(w, h);
  const nd = nimg.data;
  const k = 1.4;
  for (let py = 0; py < h; py++) {
    const up = Math.max(0, py - 1);
    const dn = Math.min(h - 1, py + 1);
    for (let px = 0; px < w; px++) {
      const l = (px - 1 + w) % w;
      const r = (px + 1) % w;
      const dx = (height[py * w + r] - height[py * w + l]) * 0.5 * k;
      const dy = (height[up * w + px] - height[dn * w + px]) * 0.5 * k;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const o = (py * w + px) * 4;
      nd[o] = (-dx * inv * 0.5 + 0.5) * 255;
      nd[o + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      nd[o + 2] = (inv * 0.5 + 0.5) * 255;
      nd[o + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.wrapS = THREE.RepeatWrapping;
  const normal = new THREE.CanvasTexture(n);
  normal.anisotropy = 8;
  normal.wrapS = THREE.RepeatWrapping;
  return { map, normal };
}

// Dimensions physiques approximatives (m) : circonférence C, longueur du profil L
const DIMS = {
  torso: { C: 0.93, L: 0.62 },
  pelvis: { C: 0.8, L: 0.42 },
  upperArm: { C: 0.38, L: 0.46 },
  foreArm: { C: 0.28, L: 0.36 },
  hand: { C: 0.22, L: 0.17 },
  thigh: { C: 0.52, L: 0.6 },
  shin: { C: 0.34, L: 0.52 },
  foot: { C: 0.26, L: 0.26 },
};

function limbWeb(dim, n, ring = 0.03, sag = 0.28) {
  return (u, v) => gridWeb(u, v, n, dim.C, dim.L, ring, sag);
}

function eyeTexture(eyeColor) {
  const W = 256;
  const H = 192;
  const box = EYE_BOX;
  const make = (fill, rim) => {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.setTransform(W / (box.az1 - box.az0), 0, 0, -H / (box.el1 - box.el0), (-box.az0 * W) / (box.az1 - box.az0), H + (box.el0 * H) / (box.el1 - box.el0));
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0.1, 0.0);
      ctx.bezierCurveTo(0.12, 0.2, 0.28, 0.3, 0.46, 0.31);
      ctx.bezierCurveTo(0.64, 0.32, 0.76, 0.3, 0.78, 0.16);
      ctx.bezierCurveTo(0.8, 0.0, 0.64, -0.08, 0.44, -0.09);
      ctx.bezierCurveTo(0.24, -0.1, 0.11, -0.07, 0.1, 0.0);
      ctx.closePath();
    };
    if (rim) {
      path();
      ctx.lineWidth = 0.075;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = rim;
      ctx.stroke();
      ctx.fillStyle = rim;
      ctx.fill();
    }
    path();
    const g = ctx.createLinearGradient(0.3, 0.31, 0.5, -0.09);
    g.addColorStop(0, fill);
    g.addColorStop(1, fill === '#000000' ? fill : shade(fill, 0.82));
    ctx.fillStyle = g;
    ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  };
  const map = make(eyeColor, '#060606');
  map.colorSpace = THREE.SRGBColorSpace;
  const glow = make('#ffffff', '#000000');
  glow.colorSpace = THREE.SRGBColorSpace;
  return { map, glow };
}

export function makeSuitMaterials(suit) {
  const lw = 0.0017 * ((suit.lineWidth || 1.6) / 1.6);
  const std = ({ map, normal }) =>
    new THREE.MeshStandardMaterial({
      map,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      // emissiveMap = map : permet de garder le costume lisible la nuit (intensité réglée en jeu)
      emissiveMap: map,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: suit.metal ? 0.3 : 0.52,
      metalness: suit.metal ? 0.6 : 0.04,
    });
  const common = { main: suit.main, lines: suit.lines, lw };
  const panel = (suit.panel || 0.12) / 0.12;
  const eS = suit.emblemScale || 1;

  const T = DIMS.torso;
  const torso = paintSuit({
    ...common,
    w: 512,
    h: 512,
    C: T.C,
    L: T.L,
    alt: suit.second || suit.main,
    // Panneaux latéraux (plus larges à la taille), ceinture en bas
    region: (u, v) => {
      const ds = Math.min(Math.abs(wrap(u)), Math.abs(wrap(u - 0.5))) * T.C;
      const hw = (0.085 - 0.045 * smoothstep(0.1, 0.78, v)) * panel;
      const inside = Math.min(hw - ds, (0.78 - v) * T.L, (v - 0.11) * T.L);
      return -inside;
    },
    web: (u, v) => {
      const front = Math.abs(wrap(u - 0.25)) < 0.25;
      const x = wrap(u - (front ? 0.25 : 0.75)) * T.C;
      const y = (v - (front ? 0.62 : 0.6)) * T.L;
      return radialWeb(x, y, 18, 0.042, 0.14);
    },
    emblems: [
      { u: 0.25, v: 0.62, s: eS },
      { u: 0.75, v: 0.58, s: 1.55 * eS },
    ],
    emblemColor: suit.emblem,
    seed: 3,
  });

  // Tête : pôle de la sphère au milieu du visage => lignes à u constant = rayons de la toile
  const HR = 0.118;
  const head = paintSuit({
    ...common,
    w: 512,
    h: 256,
    C: 2 * Math.PI * HR * 0.9,
    L: Math.PI * HR,
    alt: suit.main,
    web: (u, v) => {
      const th = (1 - v) * Math.PI * HR;
      const ph = u * Math.PI * 2;
      return radialWeb(Math.sin(ph) * th, Math.cos(ph) * th, 20, 0.024, 0.12);
    },
    seed: 5,
  });

  const limb2 = suit.limb2 || suit.main;
  const UA = DIMS.upperArm;
  const upperArm = paintSuit({
    ...common,
    w: 256,
    h: 256,
    C: UA.C,
    L: UA.L,
    alt: limb2,
    region: (u, v) => (v - 0.74 + 0.06 * Math.cos(Math.PI * 2 * (u - 0.5))) * UA.L,
    web: limbWeb(UA, 12),
    seed: 7,
  });
  const foreArm = paintSuit({ ...common, w: 256, h: 256, ...DIMS.foreArm, alt: suit.main, web: limbWeb(DIMS.foreArm, 10), seed: 9 });
  const hand = paintSuit({ ...common, w: 128, h: 128, ...DIMS.hand, alt: suit.main, web: limbWeb(DIMS.hand, 8, 0.024), seed: 11 });
  const TH = DIMS.thigh;
  const thigh = paintSuit({ ...common, w: 256, h: 256, C: TH.C, L: TH.L, alt: limb2, region: () => -1, web: limbWeb(TH, 16), seed: 13 });
  const pelvis = paintSuit({ ...common, w: 256, h: 256, ...DIMS.pelvis, alt: limb2, region: () => -1, web: limbWeb(DIMS.pelvis, 24), seed: 15 });
  const SH = DIMS.shin;
  const shin = paintSuit({
    ...common,
    w: 256,
    h: 256,
    C: SH.C,
    L: SH.L,
    alt: limb2,
    // Bottes : bord supérieur en pointe sur le devant
    region: (u, v) => (0.66 + 0.12 * Math.max(0, Math.cos(Math.PI * 2 * (u - 0.25))) ** 3 - v) * SH.L,
    web: limbWeb(SH, 11),
    seed: 17,
  });
  const foot = paintSuit({ ...common, w: 128, h: 128, ...DIMS.foot, alt: suit.main, web: limbWeb(DIMS.foot, 9, 0.028), seed: 19 });

  const eyes = eyeTexture(suit.eyes);
  const eyeLum = new THREE.Color(suit.eyes).getHSL({}).l;
  return {
    head: std(head),
    torso: std(torso),
    pelvis: std(pelvis),
    upperArm: std(upperArm),
    foreArm: std(foreArm),
    hand: std(hand),
    thigh: std(thigh),
    shin: std(shin),
    foot: std(foot),
    eye: new THREE.MeshStandardMaterial({
      map: eyes.map,
      emissiveMap: eyes.glow,
      emissive: suit.eyes,
      // les lentilles claires restent sobres, les colorées brillent
      emissiveIntensity: eyeLum > 0.75 ? 0.3 : 1.3,
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  };
}

function shade(hex, k = 0.6) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

// ---------- Squelette humanoïde procédural ----------
export class Rig {
  constructor({ materials, scale = 1, bulk = 1, kind = 'hero' }) {
    this.kind = kind;
    this.scale = scale;
    this.group = new THREE.Group();
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);
    this.pivot.position.y = 0.98;
    this.j = {};
    const J = (name, parent, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      this.j[name] = g;
      return g;
    };
    const m = materials;
    this.materials = m;
    const hero = kind === 'hero';
    const add = (geo, mat, parent, shadow = true) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadow;
      parent.add(mesh);
      return mesh;
    };
    const P = PROFILES;
    const b = bulk;
    this.meshes = {};

    const hips = J('hips', this.pivot, 0, 0, 0);
    this.meshes.pelvis = add(sculpt(P.pelvis, { sx: 1.17 * b, sz: 0.84 * b }), m.pelvis, hips);
    const spine = J('spine', hips, 0, 0.1, 0);
    const chest = J('chest', spine, 0, 0.18, 0);
    // Buste en V : large aux épaules, pectoraux marqués, dos plus plat
    const torsoGeo = sculpt(P.torso, {
      seg: 24,
      sx: (y) => (1.16 + 0.3 * smoothstep(-0.12, 0.2, y)) * b,
      sz: 0.8 * b,
      warp: (v) => {
        if (v.z > 0) v.z *= 1 + 0.13 * bump(v.y, 0.03, 0.24);
        else v.z *= 0.93;
      },
    });
    this.meshes.torso = add(torsoGeo, m.torso, chest);
    const neck = J('neck', chest, 0, 0.3, 0);
    add(sculpt(P.neck, { seg: 14, sz: 1.05, r: b > 1 ? 1 + (b - 1) * 0.6 : 1 }), m.neck || m.head, neck, false);
    const head = J('head', neck, 0, 0.07, 0);
    const headScale = hero ? 0.94 : 1;
    const headMesh = add(headGeometry(headScale, hero), m.head, head);
    headMesh.position.y = 0.09;
    this.meshes.head = headMesh;
    this.headMesh = headMesh;

    const armGeo = sculpt(P.upperArm, {
      r: b,
      warp: (v) => {
        if (v.z > 0) v.z *= 1 + 0.12 * bump(v.y, -0.22, -0.06);
      },
    });
    const foreGeo = sculpt(P.foreArm, { r: b, sx: 1.06 });
    const handGeo = sculpt(P.hand, { seg: 14, r: b, sx: 0.62 });
    const thumbGeo = sculpt(P.thumb, { seg: 8, r: b });
    const thighGeo = sculpt(P.thigh, {
      r: b,
      sx: 0.95,
      warp: (v) => {
        if (v.z > 0) v.z *= 1 + 0.1 * bump(v.y, -0.32, -0.04);
      },
    });
    const shinGeo = sculpt(P.shin, {
      r: b,
      sx: 0.92,
      warp: (v) => {
        if (v.z < 0) v.z *= 1 + 0.25 * bump(v.y, -0.24, -0.02);
      },
    });
    const footGeo = sculpt(P.foot, { seg: 14, r: b, sx: 0.95 });
    footGeo.rotateX(Math.PI / 2);
    {
      // semelle plate
      const pos = footGeo.attributes.position;
      for (let k = 0; k < pos.count; k++) pos.setY(k, Math.max(-0.03, pos.getY(k) * 0.8));
      smoothNormals(footGeo);
    }

    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? 1 : -1;
      const sh = J(`${side}Shoulder`, chest, sx * 0.235 * b, 0.23, 0);
      add(armGeo, m.upperArm, sh);
      const el = J(`${side}Elbow`, sh, 0, -0.3, 0);
      add(foreGeo, m.foreArm, el);
      const hand = new THREE.Group();
      hand.position.y = -0.31;
      el.add(hand);
      add(handGeo, m.hand, hand);
      const thumb = add(thumbGeo, m.hand, hand, false);
      thumb.position.set(-sx * 0.012 * b, 0.012, 0.03 * b);
      thumb.rotation.set(-0.55, 0, sx * 0.25);
      this.j[`${side}Hand`] = hand;
      const hp = J(`${side}Hip`, hips, sx * 0.1 * b, -0.06, 0);
      add(thighGeo, m.thigh, hp);
      const kn = J(`${side}Knee`, hp, 0, -0.43, 0);
      add(shinGeo, m.shin, kn);
      const foot = add(footGeo, m.foot, kn);
      foot.position.set(0, -0.445, 0.045);
    }

    if (hero && m.eye) {
      const axes = HEAD_AXES.map((a) => a * HEAD_R * headScale);
      for (const mirror of [false, true]) {
        const eye = new THREE.Mesh(eyePatchGeometry(axes, mirror), m.eye);
        eye.renderOrder = 1;
        headMesh.add(eye);
      }
    }

    this.group.scale.setScalar(scale);
    this.cur = new Float32Array(JOINTS.length * 3);
    this.curRoot = new Float32Array(3);
    this.curHipsY = 0;
    this.blendSpeed = 16;
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._v = new THREE.Vector3();
  }

  // Remplace les matériaux par clé (pour changer de costume)
  swapMaterials(oldM, newM) {
    const map = new Map();
    for (const k of Object.keys(oldM)) if (newM[k]) map.set(oldM[k], newM[k]);
    this.group.traverse((o) => {
      if (o.isMesh && map.has(o.material)) o.material = map.get(o.material);
    });
    this.materials = newM;
  }

  // Applique une pose cible avec un lissage
  apply(pose, dt, speed = this.blendSpeed) {
    const k = dt <= 0 ? 1 : damp(speed, dt);
    for (let i = 0; i < JOINTS.length; i++) {
      const t = pose[JOINTS[i]];
      const o = i * 3;
      const tx = t ? t[0] : 0;
      const ty = t ? t[1] : 0;
      const tz = t ? t[2] : 0;
      this.cur[o] += (tx - this.cur[o]) * k;
      this.cur[o + 1] += (ty - this.cur[o + 1]) * k;
      this.cur[o + 2] += (tz - this.cur[o + 2]) * k;
      this.j[JOINTS[i]].rotation.set(this.cur[o], this.cur[o + 1], this.cur[o + 2]);
    }
    const r = pose.root || [0, 0, 0];
    // les rotations complètes (salto) ne sont pas lissées
    const kr = pose.rootSnap ? 1 : k;
    for (let a = 0; a < 3; a++) {
      if (!pose.rootSnap) {
        // évite de « rembobiner » un salto : on ramène l'écart dans [-π, π]
        const d = r[a] - this.curRoot[a];
        const w = d - Math.round(d / (Math.PI * 2)) * Math.PI * 2;
        this.curRoot[a] = r[a] - w;
      }
      this.curRoot[a] += (r[a] - this.curRoot[a]) * kr;
    }
    this.pivot.rotation.set(this.curRoot[0], this.curRoot[1], this.curRoot[2]);
    const hy = pose.hipsY || 0;
    this.curHipsY += (hy - this.curHipsY) * k;
    this.pivot.position.y = 0.98 + this.curHipsY;
  }

  // Oriente un bras vers une direction monde (bras tendu vers l'ancrage de toile)
  pointArm(side, worldDir, weight = 1) {
    const sh = this.j[`${side}Shoulder`];
    const el = this.j[`${side}Elbow`];
    this.group.updateMatrixWorld(true);
    sh.parent.getWorldQuaternion(this._q).invert();
    const local = this._v.copy(worldDir).applyQuaternion(this._q).normalize();
    this._q2.setFromUnitVectors(new THREE.Vector3(0, -1, 0), local);
    sh.quaternion.slerp(this._q2, weight);
    el.rotation.x *= 1 - weight;
    const idx = JOINTS.indexOf(`${side}Shoulder`) * 3;
    this.cur[idx] = sh.rotation.x;
    this.cur[idx + 1] = sh.rotation.y;
    this.cur[idx + 2] = sh.rotation.z;
  }

  handWorld(side, out) {
    return this.j[`${side}Hand`].getWorldPosition(out);
  }
}
