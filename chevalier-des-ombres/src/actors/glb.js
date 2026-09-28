// Personnages 3D texturés (fichiers GLB avec squelette « Mixamo ») :
// - préparation à l'installation (textures recolorées par variante, masque d'émission) ;
// - instanciation en jeu avec reciblage des animations procédurales du jeu sur le squelette
//   du modèle (même Animator que les personnages procéduraux, donc mêmes attaques, esquives…).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { textureRegistry } from '../core/device.js';

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Variantes de couleur (dégradé appliqué selon la luminance de la texture d'origine)
// stops : [position 0..1, [r, g, b]] ; accent : couleur des yeux / gemmes (émission)
// ---------------------------------------------------------------------------
export const KNIGHT_VARIANTS = {
  shadow: { label: 'Ombre (d’origine)', original: true, accent: [1, 0.25, 0.55] },
  void: { stops: [[0, [0.01, 0.015, 0.03]], [0.45, [0.05, 0.12, 0.16]], [0.8, [0.18, 0.45, 0.5]], [1, [0.6, 1, 0.95]]], accent: [0.3, 1, 0.85] },
  crimson: { stops: [[0, [0.02, 0.005, 0.005]], [0.45, [0.2, 0.03, 0.03]], [0.8, [0.55, 0.1, 0.06]], [1, [1, 0.55, 0.3]]], accent: [1, 0.35, 0.05] },
  ash: { stops: [[0, [0.03, 0.03, 0.035]], [0.45, [0.2, 0.2, 0.22]], [0.8, [0.48, 0.47, 0.5]], [1, [0.9, 0.88, 0.85]]], accent: [1, 0.8, 0.35] },
  frost: { stops: [[0, [0.02, 0.04, 0.08]], [0.45, [0.2, 0.32, 0.45]], [0.8, [0.55, 0.72, 0.88]], [1, [0.95, 1, 1]]], accent: [0.55, 0.9, 1] },
  gold: { stops: [[0, [0.03, 0.02, 0.01]], [0.45, [0.28, 0.18, 0.05]], [0.8, [0.7, 0.5, 0.16]], [1, [1, 0.92, 0.55]]], accent: [1, 0.95, 0.6] },
  ember: { stops: [[0, [0.02, 0.01, 0.01]], [0.45, [0.15, 0.08, 0.05]], [0.8, [0.4, 0.2, 0.1]], [1, [1, 0.6, 0.25]]], accent: [1, 0.45, 0.05] },
  bone: { stops: [[0, [0.05, 0.04, 0.03]], [0.45, [0.35, 0.31, 0.25]], [0.8, [0.7, 0.65, 0.55]], [1, [1, 0.97, 0.88]]], accent: [0.4, 1, 0.6] },
  emerald: { stops: [[0, [0.01, 0.03, 0.02]], [0.45, [0.04, 0.18, 0.1]], [0.8, [0.15, 0.5, 0.3]], [1, [0.6, 1, 0.7]]], accent: [0.3, 1, 0.5] },
  royal: { stops: [[0, [0.01, 0.01, 0.04]], [0.45, [0.06, 0.08, 0.3]], [0.8, [0.25, 0.3, 0.7]], [1, [0.85, 0.8, 1]]], accent: [1, 0.85, 0.4] },
  obsidian: { stops: [[0, [0.008, 0.006, 0.01]], [0.5, [0.06, 0.045, 0.06]], [0.85, [0.2, 0.14, 0.16]], [1, [0.62, 0.4, 0.4]]], accent: [1, 0.12, 0.04] },
};

// ---------------------------------------------------------------------------
// Outils GLB (binaire) : lecture du JSON, extraction de l'image, suppression des images
// ---------------------------------------------------------------------------
function readGlb(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Fichier GLB invalide');
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(data));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  return { json, bin };
}

function writeGlb(json, bin) {
  const enc = new TextEncoder().encode(JSON.stringify(json));
  const jlen = Math.ceil(enc.length / 4) * 4;
  const blen = bin ? Math.ceil(bin.byteLength / 4) * 4 : 0;
  const total = 12 + 8 + jlen + (bin ? 8 + blen : 0);
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jlen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  u8.set(enc, 20);
  for (let i = enc.length; i < jlen; i++) u8[20 + i] = 0x20;
  if (bin) {
    const o = 20 + jlen;
    dv.setUint32(o, blen, true);
    dv.setUint32(o + 4, 0x004e4942, true);
    u8.set(new Uint8Array(bin), o + 8);
  }
  return out;
}

// Première image intégrée (texture de couleur) sous forme de Blob
export function extractGlbImage(buf) {
  const { json, bin } = readGlb(buf);
  const img = json.images && json.images[0];
  if (!img || img.bufferView === undefined) return null;
  const bv = json.bufferViews[img.bufferView];
  const start = bv.byteOffset || 0;
  return new Blob([bin.slice(start, start + bv.byteLength)], { type: img.mimeType || 'image/jpeg' });
}

// GLB sans images ni textures (la géométrie et le squelette seulement) : les textures
// recolorées sont fournies séparément à la bonne résolution
export function stripGlbImages(buf) {
  const { json, bin } = readGlb(buf);
  const imageViews = new Set((json.images || []).map((i) => i.bufferView).filter((v) => v !== undefined));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials || []) {
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture;
      delete m.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete m.normalTexture;
    delete m.emissiveTexture;
    delete m.occlusionTexture;
  }
  // Reconstruit le tampon binaire sans les octets des images
  const views = json.bufferViews;
  const keep = views.map((v, i) => !imageViews.has(i));
  const remap = new Map();
  const parts = [];
  let size = 0;
  const newViews = [];
  views.forEach((v, i) => {
    if (!keep[i]) return;
    const start = v.byteOffset || 0;
    const pad = (4 - (size % 4)) % 4;
    if (pad) {
      parts.push(new Uint8Array(pad));
      size += pad;
    }
    parts.push(new Uint8Array(bin, start, v.byteLength));
    remap.set(i, newViews.length);
    newViews.push({ ...v, byteOffset: size });
    size += v.byteLength;
  });
  const nb = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    nb.set(p, o);
    o += p.byteLength;
  }
  json.bufferViews = newViews;
  for (const a of json.accessors || []) if (a.bufferView !== undefined) a.bufferView = remap.get(a.bufferView);
  json.buffers = [{ byteLength: size }];
  return writeGlb(json, nb.buffer);
}

// ---------------------------------------------------------------------------
// Recoloration (installation) : image source → pixels de la variante + masque d'émission
// ---------------------------------------------------------------------------
function gradient(stops, t, out) {
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const k = Math.min(1, Math.max(0, (t - t0) / Math.max(1e-4, t1 - t0)));
  out[0] = c0[0] + (c1[0] - c0[0]) * k;
  out[1] = c0[1] + (c1[1] - c0[1]) * k;
  out[2] = c0[2] + (c1[2] - c0[2]) * k;
}

// Pixels source (RGBA 8 bits) → { col, emi } à la même taille
export function recolorPixels(src, variant) {
  const n = src.length / 4;
  // Luminance : percentiles pour normaliser le contraste de la texture d'origine
  const hist = new Uint32Array(256);
  const lum = new Float32Array(n);
  const acc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = src[i * 4] / 255;
    const g = src[i * 4 + 1] / 255;
    const b = src[i * 4 + 2] / 255;
    const l = r * 0.3 + g * 0.45 + b * 0.25;
    lum[i] = l;
    hist[Math.min(255, (l * 255) | 0)]++;
    // Accents lumineux (yeux rouges, gemmes roses) : rouge dominant et saturé
    const a = Math.min(1, Math.max(0, (r - Math.max(g * 1.5, b * 0.95) - 0.08) * 3.5)) * Math.min(1, Math.max(0, (r - 0.4) * 3));
    acc[i] = a;
  }
  const pct = (p) => {
    let c = 0;
    const target = n * p;
    for (let i = 0; i < 256; i++) {
      c += hist[i];
      if (c >= target) return i / 255;
    }
    return 1;
  };
  const lo = pct(0.02);
  const hi = Math.max(lo + 0.05, pct(0.985));
  const col = new Uint8ClampedArray(src.length);
  const emi = new Uint8ClampedArray(src.length);
  const c = [0, 0, 0];
  const ac = variant.accent || [1, 0.3, 0.5];
  for (let i = 0; i < n; i++) {
    const a = acc[i];
    if (variant.original) {
      col[i * 4] = src[i * 4];
      col[i * 4 + 1] = src[i * 4 + 1];
      col[i * 4 + 2] = src[i * 4 + 2];
    } else {
      const t = Math.min(1, Math.max(0, (lum[i] - lo) / (hi - lo)));
      gradient(variant.stops, Math.pow(t, 0.9), c);
      col[i * 4] = (c[0] * (1 - a) + ac[0] * a) * 255;
      col[i * 4 + 1] = (c[1] * (1 - a) + ac[1] * a) * 255;
      col[i * 4 + 2] = (c[2] * (1 - a) + ac[2] * a) * 255;
    }
    col[i * 4 + 3] = 255;
    const e = a * 255;
    emi[i * 4] = e * ac[0];
    emi[i * 4 + 1] = e * ac[1];
    emi[i * 4 + 2] = e * ac[2];
    emi[i * 4 + 3] = 255;
  }
  return { col, emi };
}

// Image (Blob) → pixels RGBA à la taille voulue
export async function blobToPixels(blob, size) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, size, size);
  if (bmp.close) bmp.close();
  return g.getImageData(0, 0, size, size).data;
}

// Pixels RGBA → Blob WebP (ou PNG si WebP indisponible)
export function pixelsToBlob(px, w, h, quality = 0.9) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, px.byteLength), w, h), 0, 0);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/webp', quality));
}

// ---------------------------------------------------------------------------
// Matériau des personnages texturés : mêmes effets que les personnages procéduraux
// (éclair blanc à l'impact, dissolution à la mort, liseré lumineux)
// ---------------------------------------------------------------------------
export function createTexCharMaterial(map, emissiveMap, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: opts.emissiveIntensity ?? 2.4,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1.15,
    side: THREE.DoubleSide,
  });
  const u = {
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uDissolve: { value: 0 },
    uDissolveColor: { value: new THREE.Color(opts.dissolveColor || 0x9a4dff) },
    uRim: { value: new THREE.Color(opts.rim || 0x2a2440) },
    uGlow: { value: opts.glow ?? 1 },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvObjPos = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nuniform float uFlash;\nuniform vec3 uFlashColor;\nuniform float uDissolve;\nuniform vec3 uDissolveColor;\nuniform vec3 uRim;\nuniform float uGlow;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float dn = fract(sin(dot(floor(vObjPos * 26.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        if (uDissolve > 0.0 && dn < uDissolve) discard;`,
      )
      // Rugosité / métal déduits de la couleur : arêtes claires = métal poli, creux = mat
      .replace('#include <roughnessmap_fragment>', 'float lumT = dot(diffuseColor.rgb, vec3(0.3, 0.45, 0.25));\nfloat roughnessFactor = clamp(0.78 - lumT * 1.6, 0.22, 0.85);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = clamp(0.35 + lumT * 1.4, 0.3, 0.9);')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance *= uGlow;
        totalEmissiveRadiance += uFlashColor * uFlash;
        if (uDissolve > 0.0 && dn < uDissolve + 0.1) totalEmissiveRadiance += uDissolveColor * 4.0;
        float rimF = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uRim * rimF;`,
      );
  };
  mat.customProgramCacheKey = () => 'chartex-v1';
  return mat;
}

// ---------------------------------------------------------------------------
// Modèles chargés (gabarits) et textures par variante
// ---------------------------------------------------------------------------
const templates = new Map(); // nom → { scene, height }
const variantTex = new Map(); // `${model}:${variant}` → { map, emi }

export async function registerModel(name, glbNoImages) {
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => loader.parse(glbNoImages, '', resolve, reject));
  let skinned = null;
  gltf.scene.traverse((o) => {
    if (o.isSkinnedMesh && !skinned) skinned = o;
  });
  if (!skinned) throw new Error('Modèle sans squelette : ' + name);
  skinned.geometry.computeBoundingBox();
  const bb = skinned.geometry.boundingBox;
  skinned.geometry.userData.shared = true;
  templates.set(name, { scene: gltf.scene, height: bb.max.y - bb.min.y, minY: bb.min.y });
}

export function hasModel(name) {
  return templates.has(name);
}

export function registerVariantTexture(model, variant, colBitmap, emiBitmap) {
  const mk = (bmp, srgb) => {
    const t = new THREE.Texture(bmp);
    t.flipY = false;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
    return t;
  };
  const key = `${model}:${variant}`;
  variantTex.set(key, { map: mk(colBitmap, true), emi: mk(emiBitmap, true) });
  textureRegistry.add('c:' + key, colBitmap.width, colBitmap.height);
  textureRegistry.add('c:' + key + ':e', emiBitmap.width, emiBitmap.height);
}

export function hasVariant(model, variant) {
  return variantTex.has(`${model}:${variant}`);
}

// ---------------------------------------------------------------------------
// Reciblage : squelette procédural (piloté par l'Animator) → squelette Mixamo
// ---------------------------------------------------------------------------
const H_PARENT = {
  hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  armL: 'chest', foreL: 'armL', handL: 'foreL', armR: 'chest', foreR: 'armR', handR: 'foreR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR',
};
// Bras en T (Mixamo) → bras le long du corps (squelette du jeu)
const R_LEFT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
const R_RIGHT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const ID = new THREE.Quaternion();
// os Mixamo → [os procédural, correction, mélange éventuel avec un 2e os]
const MAP = {
  Hips: ['hips', ID],
  Spine: ['spine', ID],
  Spine1: ['spine', ID, 'chest', 0.5],
  Spine2: ['chest', ID],
  Neck: ['neck', ID],
  Head: ['head', ID],
  LeftShoulder: ['chest', ID],
  LeftArm: ['armL', R_LEFT],
  LeftForeArm: ['foreL', R_LEFT],
  LeftHand: ['handL', R_LEFT],
  RightShoulder: ['chest', ID],
  RightArm: ['armR', R_RIGHT],
  RightForeArm: ['foreR', R_RIGHT],
  RightHand: ['handR', R_RIGHT],
  LeftUpLeg: ['thighL', ID],
  LeftLeg: ['shinL', ID],
  LeftFoot: ['footL', ID],
  LeftToeBase: ['footL', ID],
  RightUpLeg: ['thighR', ID],
  RightLeg: ['shinR', ID],
  RightFoot: ['footR', ID],
  RightToeBase: ['footR', ID],
};

function stripName(n) {
  return n.replace(/^mixamorig[:_]?/i, '').replace(/[^A-Za-z0-9]/g, '');
}

class Retarget {
  constructor(proxy, bones, normScale) {
    this.proxy = proxy;
    this.normScale = normScale;
    this.world = {};
    for (const k in proxy) this.world[k] = new THREE.Quaternion();
    // Ordre hiérarchique des os Mixamo (parents avant enfants)
    this.list = [];
    const visit = (b, parentEntry) => {
      const key = stripName(b.name);
      const m = MAP[key];
      const entry = { bone: b, map: m, parent: parentEntry, world: new THREE.Quaternion(), restY: b.position.y };
      if (b.isBone) this.list.push(entry);
      for (const c of b.children) if (c.isBone) visit(c, entry);
    };
    visit(bones, null);
    this.hips = this.list[0];
  }

  apply() {
    const P = this.proxy;
    const W = this.world;
    // Rotations monde du squelette procédural (la racine est l'identité)
    for (const k in H_PARENT) {
      const b = P[k];
      if (!b) continue;
      const par = H_PARENT[k];
      if (par) W[k].multiplyQuaternions(W[par], b.quaternion);
      else W[k].copy(b.quaternion);
    }
    for (const e of this.list) {
      const m = e.map;
      if (m) {
        e.world.copy(W[m[0]]);
        if (m[2]) e.world.slerp(W[m[2]], m[3]);
        e.world.multiply(m[1]);
      } else if (e.parent) e.world.copy(e.parent.world);
      // Rotation locale = inverse(parent monde) × monde
      if (e.parent) e.bone.quaternion.copy(_q.copy(e.parent.world).invert()).multiply(e.world);
      else e.bone.quaternion.copy(e.world);
    }
    // Décalage vertical du bassin (accroupissements, roulades…)
    const hp = P.hips;
    if (hp && this.hips) this.hips.bone.position.y = this.hips.restY + (hp.position.y - hp.userData.rest.y) / this.normScale;
  }
}

// ---------------------------------------------------------------------------
// Instanciation : renvoie un objet compatible avec Actor.setModel / Animator
// ---------------------------------------------------------------------------
export function createGlbCharacter(model, variant, opts = {}) {
  const tpl = templates.get(model);
  if (!tpl) return null;
  const root = cloneSkinned(tpl.scene);
  let mesh = null;
  root.traverse((o) => {
    if (o.isSkinnedMesh && !mesh) mesh = o;
  });
  const hipsBone = mesh.skeleton.bones.find((b) => stripName(b.name) === 'Hips') || mesh.skeleton.bones[0];
  // La racine devient le maillage lui-même (comme les personnages procéduraux)
  mesh.removeFromParent();
  hipsBone.removeFromParent();
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.add(hipsBone);
  mesh.updateMatrixWorld(true);
  const tex = variantTex.get(`${model}:${variant}`) || variantTex.get(`${model}:shadow`) || [...variantTex.values()].find((v, i) => i === 0);
  const mat = createTexCharMaterial(tex ? tex.map : null, tex ? tex.emi : null, opts);
  mesh.material = mat;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  const h = tpl.height;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, h * 0.5, 0), h * 0.95);
  const normScale = (opts.height || 1.92) / h;
  // Squelette procédural fantôme (non affiché) piloté par l'Animator
  const proxy = {};
  for (const k in H_PARENT) {
    const o = new THREE.Object3D();
    o.name = k;
    o.userData.rest = new THREE.Vector3(0, 0, 0);
    proxy[k] = o;
  }
  const retarget = new Retarget(proxy, hipsBone, normScale);
  const find = (n) => mesh.skeleton.bones.find((b) => stripName(b.name) === n);
  // Points d'attache (armes, bouclier) : correction d'orientation et d'échelle
  const socket = (boneName, corr) => ({ bone: find(boneName), corr, inv: corr.clone().invert() });
  const sockets = {
    handR: socket('RightHand', R_RIGHT),
    handL: socket('LeftHand', R_LEFT),
    foreL: socket('LeftForeArm', R_LEFT),
  };
  return {
    mesh,
    bones: proxy,
    rig: 'humanoid',
    skeleton: mesh.skeleton,
    retarget,
    normScale,
    sockets,
    headBone: find('Head'),
    height: opts.height || 1.92,
    glb: true,
  };
}

// Attache un objet (arme, bouclier) à un point d'attache d'un personnage GLB, avec une
// position/rotation exprimées comme pour le squelette procédural
export function attachToSocket(built, socketName, obj, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const s = built.sockets && built.sockets[socketName];
  if (!s || !s.bone) return false;
  _q2.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  obj.quaternion.copy(s.inv).multiply(_q2);
  _v.set(pos[0], pos[1], pos[2]).applyQuaternion(s.inv).multiplyScalar(1 / built.normScale);
  obj.position.copy(_v);
  obj.scale.setScalar(1 / built.normScale);
  s.bone.add(obj);
  return true;
}
