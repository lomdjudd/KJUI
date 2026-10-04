// Petites briques pour construire les modèles procéduraux, avec caches.
import * as THREE from 'three';

const mats = new Map();
const geos = new Map();

export function mat(color, o = {}) {
  const key = color + '|' + (o.r ?? 0.8) + (o.m ?? 0) + (o.e ?? '') + (o.ei ?? '') + (o.op ?? 1) + (o.flat ? 'f' : '') + (o.side ?? '') + (o.dw ?? '');
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.r ?? 0.8,
      metalness: o.m ?? 0,
      flatShading: !!o.flat,
      transparent: (o.op ?? 1) < 1,
      opacity: o.op ?? 1,
      side: o.side ?? THREE.FrontSide,
      depthWrite: o.dw ?? (o.op ?? 1) >= 1,
    });
    if (o.e !== undefined) {
      m.emissive = new THREE.Color(o.e);
      m.emissiveIntensity = o.ei ?? 1;
    }
    mats.set(key, m);
  }
  return m;
}

function geo(key, make) {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}

export const G_BOX = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
export const G_SPH = (s = 12) => geo('sph' + s, () => new THREE.SphereGeometry(1, s, Math.max(6, s * 0.75 | 0)));
export const G_CYL = (s = 8) => geo('cyl' + s, () => new THREE.CylinderGeometry(1, 1, 1, s));
export const G_CONE = (s = 8) => geo('cone' + s, () => new THREE.ConeGeometry(1, 1, s));
export const G_ICO = () => geo('ico', () => new THREE.IcosahedronGeometry(1, 0));
export const G_HEMI = () => geo('hemi', () => new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
export const G_TORUS = () => geo('torus', () => new THREE.TorusGeometry(1, 0.12, 6, 16, Math.PI));
// Taper (cylindre conique) avec rayon haut/bas
export const G_TAPER = (rt, rb, s = 8) => geo(`tp${rt}_${rb}_${s}`, () => new THREE.CylinderGeometry(rt, rb, 1, s));

function mk(g, m, shadow) {
  const me = new THREE.Mesh(g, m);
  if (shadow) {
    me.castShadow = true;
  }
  return me;
}

// Ajoute un maillage à un parent : p = [x,y,z], s = [sx,sy,sz] ou nombre, r = [rx,ry,rz]
export function part(parent, g, m, p = [0, 0, 0], s = 1, r = null, shadow = true) {
  const me = mk(g, m, shadow);
  me.position.set(p[0], p[1], p[2]);
  if (typeof s === 'number') me.scale.setScalar(s);
  else me.scale.set(s[0], s[1], s[2]);
  if (r) me.rotation.set(r[0], r[1], r[2]);
  parent.add(me);
  return me;
}

export function box(parent, color, p, s, r, o) {
  return part(parent, G_BOX(), mat(color, o), p, s, r);
}
export function sph(parent, color, p, s, o, segs = 12) {
  return part(parent, G_SPH(segs), mat(color, o), p, s);
}
export function cyl(parent, color, p, s, r, o, segs = 8) {
  return part(parent, G_CYL(segs), mat(color, o), p, s, r);
}
export function cone(parent, color, p, s, r, o, segs = 8) {
  return part(parent, G_CONE(segs), mat(color, o), p, s, r);
}

export function pivot(parent, p = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(p[0], p[1], p[2]);
  parent.add(g);
  return g;
}

// Membre : pivot à l'épaule/hanche, cylindre qui descend
export function limb(parent, p, len, rad, color, o) {
  const pv = pivot(parent, p);
  cyl(pv, color, [0, -len / 2, 0], [rad, len, rad], null, o, 6);
  return pv;
}

export function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}

export function mix(a, b, t) {
  const c = new THREE.Color(a).lerp(new THREE.Color(b), t);
  return c.getHex();
}

export function noShadow(obj) {
  obj.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
}

// Animation générique d'un rig : t = temps, spd = vitesse, atk = 0..1 (attaque)
export function animateRig(g, t, spd, atk = 0) {
  const rig = g.userData.rig;
  if (!rig) return;
  const gait = rig.gait || 5;
  const s = Math.min(1.6, spd / gait);
  const f = rig.freq || 8;
  if (rig.legs) {
    for (const L of rig.legs) L.pv.rotation.x = Math.sin(t * f + L.ph) * (rig.legAmp || 0.7) * s;
  }
  if (rig.arms) {
    rig.arms.forEach((A, i) => {
      A.pv.rotation.x = -Math.sin(t * f + A.ph) * 0.6 * s;
      if (i === 1 && atk > 0) A.pv.rotation.x = -2.4 * Math.sin(atk * Math.PI);
    });
  }
  if (rig.tail) {
    rig.tail.forEach((pv, i) => {
      pv.rotation.y = Math.sin(t * (rig.tailF || 3) - i * 0.7) * (rig.tailAmp || 0.25) * (0.5 + s);
    });
  }
  if (rig.fins) for (const F of rig.fins) F.pv.rotation[F.axis || 'z'] = Math.sin(t * 6 + F.ph) * 0.4 * F.sign;
  if (rig.wings) {
    const a = Math.sin(t * (rig.wingF || 9)) * 0.7;
    rig.wings[0].rotation.z = a;
    rig.wings[1].rotation.z = -a;
  }
  if (rig.flag) rig.flag.forEach((pv, i) => (pv.rotation.y = Math.sin(t * 14 - i * 0.9) * 0.45));
  if (rig.cilia) rig.cilia.rotation.z = Math.sin(t * 10) * 0.08;
  if (rig.tent) rig.tent.forEach((pv, i) => (pv.rotation.x = Math.sin(t * 3 + i) * 0.35));
  if (rig.pulse) {
    const k = 1 + Math.sin(t * 4) * 0.05;
    rig.pulse.scale.set(k, 1 / k, k);
  }
  if (rig.body && rig.bob) rig.body.position.y = rig.bodyY + Math.abs(Math.sin(t * f)) * rig.bob * s;
  if (rig.head && atk > 0 && !rig.arms) rig.head.rotation.x = -0.5 * Math.sin(atk * Math.PI);
  if (rig.jaw) rig.jaw.rotation.x = atk > 0 ? 0.6 * Math.sin(atk * Math.PI) : 0.05 + Math.sin(t * 2) * 0.03;
  if (rig.snake) rig.snake.forEach((pv, i) => (pv.rotation.y = Math.sin(t * 6 - i * 0.8) * 0.5));
}
