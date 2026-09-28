// Représentation 3D d'une fusée (ensemble des modèles de pièces).

import * as THREE from 'three';
import { buildPartModel, animatePart, buildFairingShells } from '../parts/models.js';
import { PART_BY_ID } from '../parts/catalog.js';
import { fairingContents } from './craft.js';
export { fairingContents };

export class CraftView {
  constructor() {
    this.group = new THREE.Group();
    this.parts = new Map(); // uid -> { obj, info, key }
    this.fairings = new Map(); // uid -> { shells, group }
  }

  // parts : liste d'instances { uid, id, pos, yaw, flip, paint }
  sync(parts, opts = {}) {
    const seen = new Set();
    for (const p of parts) {
      seen.add(p.uid);
      const key = p.id + '|' + (p.paint || '');
      let e = this.parts.get(p.uid);
      if (!e || e.key !== key) {
        if (e) this.group.remove(e.obj);
        const { root, info } = buildPartModel(p.id, p.paint);
        const obj = new THREE.Group();
        obj.add(root);
        obj.userData.uid = p.uid;
        root.traverse((o) => { o.userData.uid = p.uid; });
        e = { obj, info, key, state: { deploy: 0, control: 0 } };
        this.parts.set(p.uid, e);
        this.group.add(obj);
      }
      e.obj.position.set(p.pos.x, p.pos.y, p.pos.z);
      e.obj.rotation.set(p.flip ? Math.PI : 0, -(p.yaw || 0), 0, 'YXZ');
      const d = PART_BY_ID[p.id];
      // les pièces déployables sont visibles déployées dans l'atelier si demandé
      if (opts.deployAll != null && (d.legs || d.solar || d.antenna || d.fin)) {
        e.state.deploy = opts.deployAll;
        animatePart(e.info, e.state);
      } else if (d.fin && d.fin.grid) {
        animatePart(e.info, e.state);
      }
    }
    for (const [uid, e] of this.parts) {
      if (!seen.has(uid)) {
        this.group.remove(e.obj);
        this.parts.delete(uid);
      }
    }
    this.syncFairings(parts, opts);
  }

  // Coiffes : coques autour des pièces empilées au-dessus de la base
  syncFairings(parts, opts = {}) {
    for (const [uid, f] of this.fairings) {
      const e = this.parts.get(uid);
      if (!e || f.detached) continue;
      e.obj.remove(f.group);
    }
    for (const [uid, f] of this.fairings) if (!f.detached) this.fairings.delete(uid);
    for (const p of parts) {
      const d = PART_BY_ID[p.id];
      if (!d.fairing || p.fairingDeployed) continue;
      const e = this.parts.get(p.uid);
      const info = fairingContents(p, parts);
      if (!info) continue;
      const { shells, height, radius } = buildFairingShells(d, info.top, info.maxR);
      const g = new THREE.Group();
      g.position.y = d.h / 2 * (p.flip ? -1 : 1);
      if (p.flip) g.rotation.x = Math.PI;
      shells.forEach((s) => g.add(s));
      if (opts.ghostFairing) shells.forEach((s) => s.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.25; o.material.depthWrite = false; } }));
      e.obj.add(g);
      this.fairings.set(p.uid, { group: g, shells, height, radius, contents: info.contents });
    }
  }

  setState(uid, state) {
    const e = this.parts.get(uid);
    if (!e) return;
    Object.assign(e.state, state);
    animatePart(e.info, e.state);
  }

  dispose() {
    this.group.clear();
    this.parts.clear();
    this.fairings.clear();
  }
}

