// Représentation 3D d'un vaisseau en vol : pièces, flammes, parachutes,
// coiffes largables, lueurs d'échauffement.

import * as THREE from 'three';
import { CraftView } from '../craft/craftview.js';
import { buildCanopy } from '../parts/models.js';
import { partBox } from '../craft/craft.js';
import { makePlume, updatePlume, makePlasma } from '../render/effects.js';

export class VesselView {
  constructor(vessel) {
    this.v = vessel;
    this.root = new THREE.Group(); // au centre de masse, tourné
    this.inner = new THREE.Group(); // décalé du centre de masse
    this.root.add(this.inner);
    this.cv = new CraftView();
    this.inner.add(this.cv.group);
    this.plumes = new Map(); // uid -> [groupes]
    this.canopies = new Map();
    this.plasma = makePlasma();
    this.root.add(this.plasma);
    this.lamps = [];
    this.sync(true);
  }

  // Resynchronise les pièces (après séparation / destruction)
  sync(first = false) {
    const v = this.v;
    const parts = v.parts.map((p) => { const q = { uid: p.uid, id: p.id, pos: p.pos, yaw: p.yaw, flip: p.flip, paint: p.paint, fairingDeployed: p.fairingDeployed }; q.box = partBox(q); return q; });
    // pour les coiffes : boîtes englobantes
    this.cv.sync(parts, {});
    // flammes
    const alive = new Set(v.parts.map((p) => p.uid));
    for (const [uid, list] of this.plumes) if (!alive.has(uid)) { list.forEach((g) => g.parent && g.parent.remove(g)); this.plumes.delete(uid); }
    for (const p of v.parts) {
      if (!p.def.engine || this.plumes.has(p.uid)) continue;
      const e = this.cv.parts.get(p.uid);
      if (!e) continue;
      const list = [];
      for (const nz of e.info.nozzles) {
        const spots = nz.cluster ? nz.cluster : [[nz.x || 0, 0, nz.r]];
        for (const [x, z, r] of spots) {
          const g = makePlume(p.def.engine.plume);
          g.position.set(x, nz.y, z);
          g.userData.exitR = r;
          g.visible = false;
          e.obj.add(g);
          list.push(g);
        }
      }
      this.plumes.set(p.uid, list);
    }
    for (const [uid, c] of this.canopies) if (!alive.has(uid)) { c.parent && c.parent.remove(c); this.canopies.delete(uid); }
    // taille du plasma
    const r = Math.max(1, v.radius);
    this.plasma.scale.set(r * 0.6, r * 1.05, r * 0.6);
    this.lamps = v.parts.filter((p) => p.def.lamp).map((p) => this.cv.parts.get(p.uid)).filter(Boolean);
    void first;
  }

  // Coques de coiffe détachées : renvoie les objets pour les animer comme débris
  detachFairing(uid) {
    const f = this.cv.fairings.get(uid);
    if (!f) return [];
    f.detached = true;
    const out = [];
    for (const s of f.shells) {
      s.updateMatrixWorld(true);
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
      s.getWorldPosition(wp);
      s.getWorldQuaternion(wq);
      s.parent.remove(s);
      out.push({ mesh: s, wp, wq, phi: s.userData.phiMid });
    }
    this.cv.fairings.delete(uid);
    return out;
  }

  update(origin, ut, time, opts) {
    const v = this.v;
    this.root.position.set(v.x - origin[0], v.y - origin[1], 0);
    this.root.rotation.set(0, 0, v.rot);
    this.inner.position.set(-v.cx, -v.cy, 0);
    const pres = v.pressureNow || 0;
    const ortho = opts.ortho;
    // flammes
    for (const p of v.parts) {
      const list = this.plumes.get(p.uid);
      if (!list) continue;
      const on = p.engOn && !p.flameout ? p.thrustFrac || 0 : 0;
      const flick = 0.9 + Math.random() * 0.2;
      for (const g of list) {
        updatePlume(g, on, pres, g.userData.exitR, time, ortho, flick);
        g.rotation.z = -(p.gimbalNow || 0) * (p.flip ? -1 : 1);
      }
      // tuyères chauffées au rouge (extension de vide)
      const e = this.cv.parts.get(p.uid);
      if (e && e.info.mats) {
        const nm = e.info.mats.get('nozzle');
        if (nm) nm.emissiveIntensity += ((on > 0.01 ? 0.7 + on * 1.3 : 0) - nm.emissiveIntensity) * 0.02;
        const ni = e.info.mats.get('nozzleInner');
        if (ni) ni.emissiveIntensity = on * 2.5;
      }
    }
    // pièces qui chauffent : bouclier
    for (const p of v.parts) {
      if (!p.def.heatShield) continue;
      const e = this.cv.parts.get(p.uid);
      const m = e && e.info.mats.get('shield');
      if (m) m.emissiveIntensity = Math.max(0, (p.temp - 800) / 500) * 2.5;
    }
    // déploiements
    for (const p of v.parts) {
      const d = p.def;
      if (d.legs || d.solar || d.antenna || d.airbrake || (d.fin && (d.fin.grid || d.fin.control))) {
        this.cv.setState(p.uid, { deploy: p.deploy || 0, control: d.fin ? v.ctrl.rot * (d.fin.control ? 1 : 0) : 0 });
      }
    }
    // parachutes
    const sv = v.surfaceVelocity();
    const sl = Math.hypot(sv[0], sv[1]) || 1;
    this.chuteExtent = 0;
    for (const p of v.parts) {
      if (!p.def.chute) continue;
      const open = p.chute === 'semi' || p.chute === 'full';
      let c = this.canopies.get(p.uid);
      if (open && !c) {
        const multi = p.def.id === 'chute_m' ? 3 : 1;
        c = new THREE.Group();
        const area = p.def.chute.cda / 1.3 / multi;
        const r = Math.sqrt(area / Math.PI);
        for (let k = 0; k < multi; k++) {
          const can = buildCanopy(r, 14, 2.4);
          if (multi > 1) {
            const a = (k / multi) * Math.PI * 2;
            can.rotation.z = Math.cos(a) * 0.35;
            can.rotation.x = Math.sin(a) * 0.35;
          }
          c.add(can);
        }
        c.userData.r = r;
        this.root.add(c);
        this.canopies.set(p.uid, c);
      }
      if (c) {
        if (!open) { this.root.remove(c); this.canopies.delete(p.uid); continue; }
        // position : à la pièce ; orientation : contre le vent relatif
        const lx = p.pos.x - v.cx, ly = p.pos.y - v.cy;
        c.position.set(lx, ly, p.pos.z);
        const wdx = -sv[0] / sl, wdy = -sv[1] / sl;
        // direction monde -> repère du vaisseau (rotation inverse)
        const cr = Math.cos(-v.rot), sr = Math.sin(-v.rot);
        const dx = wdx * cr - wdy * sr, dy = wdx * sr + wdy * cr;
        const target = new THREE.Vector3(dx, dy, 0).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sl > 0.5 ? target : new THREE.Vector3(0, 1, 0));
        c.quaternion.slerp(q, 0.08);
        const k = p.chute === 'semi' ? 0.22 : 0.22 + 0.78 * (p.chuteOpen || 0);
        const breath = 1 + Math.sin(time * 3 + p.uid) * 0.015;
        c.scale.set(k * breath, Math.max(0.3, k), k * breath);
        this.chuteExtent = Math.max(this.chuteExtent, c.userData.r * (2.4 * Math.max(0.3, k) + 0.6 * k));
      }
    }
    // plasma de rentrée
    const pu = this.plasma.userData.u;
    pu.intensity.value = v.reentryGlow || 0;
    pu.time.value = time;
    if (v.reentryGlow > 0.01) {
      const cr = Math.cos(-v.rot), sr = Math.sin(-v.rot);
      pu.flow.value.set((sv[0] / sl) * cr - (sv[1] / sl) * sr, (sv[0] / sl) * sr + (sv[1] / sl) * cr, 0).normalize();
    }
    this.plasma.visible = pu.intensity.value > 0.01;
    // projecteurs
    for (const e of this.lamps) {
      const m = e.info.mats.get('lamp');
      if (m) m.emissiveIntensity = v.lights ? 8 : 0;
    }
    void ut;
  }

  dispose() {
    this.root.parent && this.root.parent.remove(this.root);
    this.cv.dispose();
  }
}
