import * as THREE from 'three';
import { makeCanvas, mulberry32 } from '../engine/utils.js';
import { grain, normalFromHeight } from '../world/textures.js';

// ---------- Tenues des ennemis ----------
// Textures peintes dans l'espace UV des pièces sculptées du squelette (u = 0,25 : avant, 0,75 : dos ;
// v de bas en haut) : sweats à capuche, blousons de cuir, gilets tactiques, jeans, pantalons cargo, visages.

const cache = new Map();
const cached = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

function texture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};

// Plis verticaux et assombrissement sur les flancs, bruit de tissu
function clothBase(ctx, hctx, W, H, color, rng, { folds = 10, weave = 'knit' } = {}) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, W, H);
  // ombrage doux sur les côtés (u = 0 et 0,5)
  for (const x0 of [0, W / 2, W]) {
    const g = ctx.createRadialGradient(x0, H / 2, 0, x0, H / 2, W * 0.2);
    g.addColorStop(0, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0 - W * 0.2, 0, W * 0.4, H);
  }
  // plis
  for (let i = 0; i < folds; i++) {
    const x = rng() * W;
    const w = 3 + rng() * 8;
    const y0 = rng() * H * 0.5;
    const y1 = y0 + H * (0.25 + rng() * 0.5);
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y0, 2 * w, y1 - y0);
    const hg = hctx.createLinearGradient(x - w, 0, x + w, 0);
    hg.addColorStop(0, 'rgba(128,128,128,0)');
    hg.addColorStop(0.5, 'rgba(60,60,60,0.8)');
    hg.addColorStop(1, 'rgba(128,128,128,0)');
    hctx.fillStyle = hg;
    hctx.fillRect(x - w, y0, 2 * w, y1 - y0);
  }
  if (weave === 'denim') {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let k = -H; k < W; k += 3) {
      ctx.beginPath();
      ctx.moveTo(k, H);
      ctx.lineTo(k + H, 0);
      ctx.stroke();
    }
  }
}

function finish(c, hc, rng, normalStrength = 2.5) {
  grain(c.getContext('2d'), c.width, c.height, rng, 14);
  return { map: texture(c), normalMap: normalFromHeight(hc, normalStrength) };
}

// ---- Hauts ----
function topTexture(style, color, seed) {
  return cached(`top|${style}|${color}|${seed}`, () => {
    const W = 256;
    const H = 128;
    const c = makeCanvas(W, H);
    const hc = makeCanvas(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const hctx = hc.getContext('2d', { willReadFrequently: true });
    const rng = mulberry32(seed);
    const front = W * 0.25;
    clothBase(ctx, hctx, W, H, color, rng, { folds: style === 'leather' ? 6 : 12 });
    if (style === 'hoodie') {
      // poche kangourou, cordons, bord-côte
      ctx.fillStyle = shade(color, 0.82);
      ctx.fillRect(front - 30, H - 50, 60, 30);
      ctx.strokeStyle = shade(color, 0.6);
      ctx.lineWidth = 2;
      ctx.strokeRect(front - 30, H - 50, 60, 30);
      hctx.fillStyle = '#9a9a9a';
      hctx.fillRect(front - 30, H - 50, 60, 30);
      ctx.strokeStyle = 'rgba(230,230,230,0.55)';
      ctx.lineWidth = 1.5;
      for (const dx of [-6, 6]) {
        ctx.beginPath();
        ctx.moveTo(front + dx, 2);
        ctx.lineTo(front + dx * 1.15, 16);
        ctx.stroke();
      }
      ctx.fillStyle = shade(color, 0.7);
      ctx.fillRect(0, H - 10, W, 10);
    } else if (style === 'leather') {
      // cuir : reflets, fermeture éclair décalée, col
      for (let i = 0; i < 18; i++) {
        const x = rng() * W;
        const y = rng() * H;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 14 + rng() * 20);
        g.addColorStop(0, 'rgba(255,255,255,0.08)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 40, y - 40, 80, 80);
      }
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(front + 6, 12, 2, H - 16);
      ctx.fillStyle = shade(color, 0.6);
      ctx.beginPath();
      ctx.moveTo(front - 26, 0);
      ctx.lineTo(front - 4, 30);
      ctx.lineTo(front - 2, 0);
      ctx.moveTo(front + 26, 0);
      ctx.lineTo(front + 10, 30);
      ctx.lineTo(front + 4, 0);
      ctx.fill();
      ctx.fillStyle = shade(color, 0.55);
      ctx.fillRect(0, H - 8, W, 8);
    } else if (style === 'tactical') {
      // gilet tactique avec poches, sur un haut sombre
      for (const cx of [front, W * 0.75]) {
        ctx.fillStyle = '#2d3128';
        ctx.fillRect(cx - 38, 14, 76, H - 20);
        hctx.fillStyle = '#b0b0b0';
        hctx.fillRect(cx - 38, 14, 76, H - 20);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = '#3a4033';
          ctx.fillRect(cx - 34 + k * 24, H - 50, 20, 26);
          ctx.strokeStyle = '#1a1d17';
          ctx.strokeRect(cx - 34 + k * 24, H - 50, 20, 26);
          hctx.fillStyle = '#d0d0d0';
          hctx.fillRect(cx - 34 + k * 24, H - 50, 20, 26);
        }
        ctx.fillStyle = '#1a1d17';
        ctx.fillRect(cx - 38, 36, 76, 4);
      }
    } else if (style === 'tank') {
      // débardeur : large emmanchure (la peau apparaît aux épaules via les bras)
      ctx.fillStyle = shade(color, 0.8);
      ctx.fillRect(0, 0, W, 6);
    } else if (style === 'tee') {
      // t-shirt avec imprimé
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(front, 48, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = '600 16px "Barlow Condensed", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NY', front, 54);
      ctx.fillStyle = shade(color, 0.75);
      ctx.fillRect(0, H - 6, W, 6);
    }
    return finish(c, hc, rng);
  });
}

// ---- Bas ----
function bottomTexture(style, color, seed, part) {
  return cached(`bot|${style}|${color}|${seed}|${part}`, () => {
    const W = 256;
    const H = 128;
    const c = makeCanvas(W, H);
    const hc = makeCanvas(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const hctx = hc.getContext('2d', { willReadFrequently: true });
    const rng = mulberry32(seed + (part === 'pelvis' ? 1 : part === 'thigh' ? 2 : 3));
    const front = W * 0.25;
    clothBase(ctx, hctx, W, H, color, rng, { folds: 8, weave: style === 'jeans' ? 'denim' : 'knit' });
    if (style === 'jeans') {
      // délavé au milieu, coutures orange sur les côtés
      const g = ctx.createRadialGradient(front, H * 0.55, 0, front, H * 0.55, W * 0.18);
      g.addColorStop(0, 'rgba(200,220,255,0.18)');
      g.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(210,140,60,0.7)';
      ctx.setLineDash([3, 2]);
      for (const x of [2, W / 2 - 1, W / 2 + 1, W - 2]) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (style === 'cargo' && part === 'thigh') {
      for (const x of [4, W / 2 - 24]) {
        ctx.fillStyle = shade(color, 0.85);
        ctx.fillRect(x, 40, 36, 34);
        ctx.strokeStyle = shade(color, 0.6);
        ctx.strokeRect(x, 40, 36, 34);
        hctx.fillStyle = '#b8b8b8';
        hctx.fillRect(x, 40, 36, 34);
      }
    } else if (style === 'track') {
      ctx.fillStyle = '#e8e8e8';
      for (const x of [0, W / 2 - 3]) ctx.fillRect(x, 0, 6, H);
    }
    if (part === 'pelvis') {
      // ceinture et boucle
      ctx.fillStyle = '#1b1612';
      ctx.fillRect(0, 0, W, 12);
      ctx.fillStyle = '#b8b0a0';
      ctx.fillRect(front - 7, 1, 14, 10);
      hctx.fillStyle = '#c8c8c8';
      hctx.fillRect(0, 0, W, 12);
      // braguette
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(front, 12);
      ctx.lineTo(front, 60);
      ctx.stroke();
    }
    if (part === 'shin') {
      ctx.fillStyle = shade(color, 0.75);
      ctx.fillRect(0, 0, W, 8);
    }
    return finish(c, hc, rng, 2);
  });
}

// ---- Tête ----
// Sphère non tournée : u = 0,25 face avant, v = 1 en haut du crâne
function faceTexture(skin, hair, cover, seed) {
  return cached(`face|${skin}|${hair}|${cover}|${seed}`, () => {
    const W = 256;
    const H = 128;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const rng = mulberry32(seed);
    const fx = W * 0.25;
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, W, H);
    // modelé : joues, orbites, menton
    const blob = (x, y, r, col) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    blob(fx, H * 0.78, 30, 'rgba(0,0,0,0.18)');
    for (const s of [-1, 1]) {
      blob(fx + s * 12, H * 0.51, 9, 'rgba(60,20,10,0.35)');
      blob(fx + s * 20, H * 0.62, 12, 'rgba(160,40,30,0.12)');
    }
    // nez
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(fx - 1, H * 0.52, 2, H * 0.08);
    blob(fx, H * 0.6, 6, 'rgba(0,0,0,0.2)');
    // barbe de trois jours
    if (rng() < 0.6) {
      for (let i = 0; i < 700; i++) {
        const a = rng();
        const x = fx + (rng() - 0.5) * 60;
        const y = H * (0.62 + rng() * 0.25);
        if (Math.abs(x - fx) > 30 * (1 - (y / H - 0.62) * 0.8)) continue;
        ctx.fillStyle = `rgba(20,14,10,${0.15 + a * 0.2})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // yeux et sourcils
    for (const s of [-1, 1]) {
      const ex = fx + s * 11;
      const ey = H * 0.5;
      ctx.fillStyle = '#f2ece4';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 4.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2618';
      ctx.beginPath();
      ctx.arc(ex + s * 0.3, ey, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#050505';
      ctx.fillRect(ex - 0.6, ey - 0.6, 1.2, 1.2);
      ctx.strokeStyle = 'rgba(30,20,15,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 4.6, 2.3, 0, Math.PI, 0);
      ctx.stroke();
      ctx.strokeStyle = hair;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(ex - s * 5, ey - 5.5);
      ctx.quadraticCurveTo(ex, ey - 7.5 - rng(), ex + s * 5.5, ey - 5);
      ctx.stroke();
    }
    // bouche
    ctx.strokeStyle = 'rgba(90,30,25,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(fx - 7, H * 0.69);
    ctx.quadraticCurveTo(fx, H * 0.69 + (rng() < 0.5 ? 1.5 : -0.5), fx + 7, H * 0.69);
    ctx.stroke();
    // oreilles (sur les côtés u = 0 et 0,5)
    for (const x of [0, W / 2]) blob(x, H * 0.52, 8, 'rgba(0,0,0,0.15)');
    // cheveux : dessus et arrière du crâne, ligne frontale
    if (hair !== 'none') {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H * 0.62);
      ctx.bezierCurveTo(W * 0.62, H * 0.62, W * 0.55, H * 0.45, W * 0.5, H * 0.42);
      ctx.bezierCurveTo(W * 0.42, H * 0.36, fx + 30, H * 0.36, fx, H * 0.36);
      ctx.bezierCurveTo(fx - 30, H * 0.36, W * 0.08, H * 0.36, 0, H * 0.42);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rng() * 0.05})`;
        ctx.fillRect(rng() * W, rng() * H * 0.5, 1, 3);
      }
    }
    // cagoule (tissu sombre, ouverture pour les yeux) ou bandana (bas du visage)
    if (cover === 'balaclava') {
      const knit = '#1a1b1f';
      ctx.save();
      ctx.fillStyle = knit;
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.moveTo(fx - 19, H * 0.44);
      ctx.lineTo(fx - 19, H * 0.56);
      ctx.lineTo(fx + 19, H * 0.56);
      ctx.lineTo(fx + 19, H * 0.44);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();
      for (let i = 0; i < 1500; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rng() * 0.05})`;
        ctx.fillRect(rng() * W, rng() * H, 2, 1);
      }
    } else if (cover === 'bandana') {
      ctx.fillStyle = '#8a1a1a';
      ctx.beginPath();
      ctx.moveTo(fx - 36, H * 0.58);
      ctx.quadraticCurveTo(fx, H * 0.56, fx + 36, H * 0.58);
      ctx.lineTo(fx + 30, H * 0.95);
      ctx.lineTo(fx - 30, H * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 26; i++) ctx.fillRect(fx - 30 + rng() * 60, H * (0.62 + rng() * 0.3), 2, 2);
    }
    grain(ctx, W, H, rng, 8);
    return texture(c);
  });
}

function mat(opts) {
  return new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, ...opts });
}

const SKINS = ['#e9bf9c', '#d6a07a', '#b07850', '#8a5a3a', '#5e3d28', '#f1ccad'];
const HAIRS = ['#15100c', '#2a1c12', '#4a3020', '#6b4a2a', '#1a1a1a'];
const PALETTE = {
  hoodie: ['#2b2e36', '#5a1f24', '#1f3a5a', '#3a3f30', '#6a6a6e', '#1a1a1c', '#7a4a1a'],
  leather: ['#1a1614', '#2a1c14', '#141416'],
  tee: ['#8a2a2a', '#2a4a7a', '#d8d4cc', '#3a5a3a', '#1c1c1e'],
  tank: ['#e8e4dc', '#2a2a2e', '#5a5a5e'],
  tactical: ['#3a3c34', '#26282a'],
};
const BOTTOMS = {
  jeans: ['#27344f', '#1f2a40', '#34466a', '#2b2b30'],
  cargo: ['#4a4a36', '#5a5040', '#33352c'],
  track: ['#141416', '#1c2440'],
};

// Tenue complète : matériaux par pièce du squelette + accessoires à poser sur la tête
export function makeEnemyOutfit(type, rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const seed = Math.floor(rand() * 6);
  let top;
  let bottom;
  let cover;
  let hat;
  if (type === 'civil') {
    top = pick(['tee', 'hoodie', 'tee', 'leather']);
    bottom = pick(['jeans', 'jeans', 'track']);
    cover = 'none';
    hat = pick(['none', 'none', 'cap', 'beanie']);
  } else if (type === 'costaud') {
    top = 'tank';
    bottom = pick(['cargo', 'jeans']);
    cover = rand() < 0.5 ? 'balaclava' : 'none';
    hat = 'none';
  } else if (type === 'tireur') {
    top = 'tactical';
    bottom = 'cargo';
    cover = rand() < 0.6 ? 'balaclava' : 'bandana';
    hat = rand() < 0.4 ? 'cap' : 'none';
  } else {
    top = pick(['hoodie', 'hoodie', 'leather', 'tee']);
    bottom = pick(['jeans', 'jeans', 'track', 'cargo']);
    cover = pick(['none', 'bandana', 'balaclava', 'none']);
    hat = cover === 'balaclava' ? 'none' : pick(['beanie', 'cap', 'none', 'hood']);
    if (hat === 'hood' && top !== 'hoodie') hat = 'beanie';
  }
  const skin = pick(SKINS);
  const hair = cover === 'balaclava' ? 'none' : pick(HAIRS);
  const topColor = pick(PALETTE[top]);
  const botColor = pick(BOTTOMS[bottom]);
  const T = topTexture(top, topColor, seed);
  const bodyMat = mat({ map: T.map, normalMap: T.normalMap, roughness: top === 'leather' ? 0.45 : 0.88 });
  const skinMat = mat({ color: skin, roughness: 0.62 });
  const sleeveMat = top === 'tank' ? skinMat : bodyMat;
  const foreMat = top === 'tank' || top === 'tee' ? skinMat : bodyMat;
  const P = bottomTexture(bottom, botColor, seed, 'pelvis');
  const TH = bottomTexture(bottom, botColor, seed, 'thigh');
  const SH = bottomTexture(bottom, botColor, seed, 'shin');
  const gloves = type !== 'civil' && (type !== 'voyou' || rand() < 0.3);
  const materials = {
    head: mat({ map: faceTexture(skin, hair === 'none' ? 'none' : hair, cover, seed + 11), roughness: cover === 'balaclava' ? 0.95 : 0.6 }),
    neck: cover === 'balaclava' ? mat({ color: '#1a1b1f', roughness: 0.95 }) : skinMat,
    torso: bodyMat,
    pelvis: mat({ map: P.map, normalMap: P.normalMap, roughness: 0.9 }),
    upperArm: sleeveMat,
    foreArm: foreMat,
    hand: gloves ? mat({ color: '#141414', roughness: 0.55 }) : skinMat,
    thigh: mat({ map: TH.map, normalMap: TH.normalMap, roughness: 0.9 }),
    shin: mat({ map: SH.map, normalMap: SH.normalMap, roughness: 0.9 }),
    foot: mat({ color: pick(['#151515', '#e8e8e8', '#3a2a1a', '#20242c']), roughness: 0.55 }),
  };
  return { materials, top, bottom, cover, hat, hood: hat === 'hood' ? topColor : null, hair };
}

// Accessoires de tête (bonnet, casquette, capuche, lunettes)
export function addHeadwear(head, outfit, rand = Math.random) {
  const std = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const y = 0.09;
  if (outfit.hat === 'beanie') {
    const col = ['#1a1a1a', '#6b1d1d', '#1d3b6b', '#2e2e2e', '#4a5a2a'][Math.floor(rand() * 5)];
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), std(col, 0.95));
    b.position.y = y + 0.025;
    b.scale.set(0.93, 1.05, 1.02);
    head.add(b);
    const fold = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.018, 6, 20), std(col, 0.95));
    fold.rotation.x = Math.PI / 2;
    fold.position.y = y + 0.03;
    fold.scale.set(0.95, 1.05, 1);
    head.add(fold);
  } else if (outfit.hat === 'cap') {
    const col = ['#101010', '#1d2b5b', '#7a1a1a', '#e8e8e8'][Math.floor(rand() * 4)];
    const m = std(col, 0.75);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
    crown.position.y = y + 0.03;
    crown.scale.set(0.95, 0.85, 1.03);
    head.add(crown);
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), m);
    visor.position.set(0, y + 0.035, 0.1);
    visor.scale.set(1, 1, 0.9);
    visor.rotation.x = 0.12;
    head.add(visor);
  } else if (outfit.hat === 'hood') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, Math.PI * 0.12, Math.PI * 1.76, 0, Math.PI * 0.78), std(outfit.hood, 0.9));
    hood.material.side = THREE.DoubleSide;
    hood.rotation.y = Math.PI / 2 + Math.PI;
    hood.position.set(0, y + 0.01, -0.012);
    hood.scale.set(0.95, 1.08, 1.05);
    head.add(hood);
  }
  if (outfit.cover !== 'balaclava' && rand() < 0.35) {
    const lens = std('#050608', 0.1);
    lens.metalness = 0.6;
    for (const s of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.022, 0.01), lens);
      g.position.set(s * 0.028, y + 0.012, 0.118);
      head.add(g);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.006, 0.006), lens);
    bridge.position.set(0, y + 0.02, 0.12);
    head.add(bridge);
  }
}
