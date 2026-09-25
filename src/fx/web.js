import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();

// Fils de toile rendus comme de fins cylindres
export class WebLines {
  constructor(scene) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    this.geo = g;
    this.mat = new THREE.MeshBasicMaterial({ color: 0xf2f4f8, transparent: true, opacity: 0.95 });
    this.pool = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(g, this.mat);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.pool.push({ mesh: m, life: 0, persistent: false, from: new THREE.Vector3(), to: new THREE.Vector3(), follow: null });
    }
  }

  _set(l, from, to, r = 0.022) {
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 0.001) {
      l.mesh.visible = false;
      return;
    }
    l.mesh.position.copy(from);
    _q.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
    l.mesh.quaternion.copy(_q);
    l.mesh.scale.set(r, len, r);
    l.mesh.visible = true;
  }

  // Ligne persistante (balancement) : renvoie un identifiant à mettre à jour
  acquire() {
    const l = this.pool.find((p) => !p.mesh.visible && p.life <= 0 && !p.persistent);
    if (!l) return null;
    l.persistent = true;
    return l;
  }

  release(l) {
    if (!l) return;
    l.persistent = false;
    l.mesh.visible = false;
    l.follow = null;
  }

  update(l, from, to, r) {
    if (l) this._set(l, from, to, r);
  }

  // Ligne éphémère (tir, frappe-toile)
  flash(from, to, life = 0.15, follow = null) {
    const l = this.pool.find((p) => !p.persistent && p.life <= 0);
    if (!l) return;
    l.life = life;
    l.from.copy(from);
    l.to.copy(to);
    l.follow = follow;
    this._set(l, from, to, 0.018);
  }

  tick(dt) {
    for (const l of this.pool) {
      if (l.persistent || l.life <= 0) continue;
      l.life -= dt;
      if (l.follow) {
        l.follow(l.from, l.to);
        this._set(l, l.from, l.to, 0.018);
      }
      if (l.life <= 0) l.mesh.visible = false;
    }
  }
}
