// Monde de collision 2D½ (cercles et boîtes orientées avec hauteur) indexé par grille.

export class CollisionWorld {
  constructor(cell = 8) {
    this.cell = cell;
    this.grid = new Map();
    this.list = [];
    this._stamp = 0;
    this.bounds = null; // { half } : limite carrée de la zone
  }

  clear() {
    this.grid.clear();
    this.list.length = 0;
  }

  _insert(c, minx, minz, maxx, maxz) {
    const s = this.cell;
    for (let ix = Math.floor(minx / s); ix <= Math.floor(maxx / s); ix++) {
      for (let iz = Math.floor(minz / s); iz <= Math.floor(maxz / s); iz++) {
        const k = ix * 73856093 ^ iz * 19349663;
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(c);
      }
    }
    this.list.push(c);
  }

  // Cylindre vertical : y0 → y1 en coordonnées absolues
  addCircle(x, z, r, y0 = -100, y1 = 100, tag = null) {
    const c = { type: 0, x, z, r, y0, y1, tag, _s: 0 };
    this._insert(c, x - r, z - r, x + r, z + r);
    return c;
  }

  // Boîte orientée : demi-largeur hw (x local), demi-profondeur hd (z local), rotation rot (yaw)
  addBox(x, z, hw, hd, rot = 0, y0 = -100, y1 = 100, tag = null) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const c = { type: 1, x, z, hw, hd, cos, sin, y0, y1, tag, _s: 0 };
    const ex = Math.abs(hw * cos) + Math.abs(hd * sin);
    const ez = Math.abs(hw * sin) + Math.abs(hd * cos);
    this._insert(c, x - ex, z - ez, x + ex, z + ez);
    return c;
  }

  query(x, z, r, out = []) {
    out.length = 0;
    const s = this.cell;
    this._stamp++;
    for (let ix = Math.floor((x - r) / s); ix <= Math.floor((x + r) / s); ix++) {
      for (let iz = Math.floor((z - r) / s); iz <= Math.floor((z + r) / s); iz++) {
        const arr = this.grid.get(ix * 73856093 ^ iz * 19349663);
        if (!arr) continue;
        for (const c of arr) {
          if (c._s === this._stamp) continue;
          c._s = this._stamp;
          out.push(c);
        }
      }
    }
    return out;
  }

  // Repousse un cercle (pos.x, pos.z, rayon r) hors des obstacles. y = hauteur des pieds.
  resolve(pos, r, y = 0, height = 1.8) {
    const cand = this.query(pos.x, pos.z, r + 1, this._tmp || (this._tmp = []));
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of cand) {
        if (y > c.y1 || y + height < c.y0) continue;
        if (c.type === 0) {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const d2 = dx * dx + dz * dz;
          const rr = r + c.r;
          if (d2 < rr * rr) {
            const d = Math.sqrt(d2) || 0.0001;
            const push = rr - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
            hit = true;
          }
        } else {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const lx = dx * c.cos - dz * c.sin;
          const lz = dx * c.sin + dz * c.cos;
          const cx = Math.max(-c.hw, Math.min(c.hw, lx));
          const cz = Math.max(-c.hd, Math.min(c.hd, lz));
          let nx = lx - cx;
          let nz = lz - cz;
          let d2 = nx * nx + nz * nz;
          let plx = lx;
          let plz = lz;
          if (d2 < 1e-8) {
            // Centre à l'intérieur : sortie par la face la plus proche
            const px = c.hw - Math.abs(lx);
            const pz = c.hd - Math.abs(lz);
            if (px < pz) plx = Math.sign(lx || 1) * (c.hw + r);
            else plz = Math.sign(lz || 1) * (c.hd + r);
            hit = true;
          } else if (d2 < r * r) {
            const d = Math.sqrt(d2);
            plx = cx + (nx / d) * r;
            plz = cz + (nz / d) * r;
            hit = true;
          } else continue;
          // Retour en coordonnées monde
          pos.x = c.x + plx * c.cos + plz * c.sin;
          pos.z = c.z - plx * c.sin + plz * c.cos;
        }
      }
    }
    if (this.bounds) {
      const h = this.bounds.half;
      if (pos.x > h) pos.x = h;
      if (pos.x < -h) pos.x = -h;
      if (pos.z > h) pos.z = h;
      if (pos.z < -h) pos.z = -h;
    }
    return hit;
  }

  // Premier impact sur le segment A→B (0..1), 1 si rien
  segment(ax, ay, az, bx, by, bz, ignoreLow = 0) {
    const minx = Math.min(ax, bx);
    const maxx = Math.max(ax, bx);
    const minz = Math.min(az, bz);
    const maxz = Math.max(az, bz);
    const cx = (minx + maxx) / 2;
    const cz = (minz + maxz) / 2;
    const rad = Math.max(maxx - minx, maxz - minz) / 2 + 1;
    const cand = this.query(cx, cz, rad, this._tmp2 || (this._tmp2 = []));
    let best = 1;
    const dx = bx - ax;
    const dz = bz - az;
    const dy = by - ay;
    for (const c of cand) {
      if (c.y1 - c.y0 < ignoreLow) continue;
      let t = -1;
      if (c.type === 0) {
        const fx = ax - c.x;
        const fz = az - c.z;
        const a = dx * dx + dz * dz;
        const b = 2 * (fx * dx + fz * dz);
        const cc = fx * fx + fz * fz - c.r * c.r;
        if (cc < 0) t = 0;
        else if (a > 1e-8) {
          const disc = b * b - 4 * a * cc;
          if (disc >= 0) {
            const tt = (-b - Math.sqrt(disc)) / (2 * a);
            if (tt >= 0 && tt <= 1) t = tt;
          }
        }
      } else {
        const ox = ax - c.x;
        const oz = az - c.z;
        const lox = ox * c.cos - oz * c.sin;
        const loz = ox * c.sin + oz * c.cos;
        const ldx = dx * c.cos - dz * c.sin;
        const ldz = dx * c.sin + dz * c.cos;
        let tmin = 0;
        let tmax = 1;
        const slab = (o, d, h) => {
          if (Math.abs(d) < 1e-8) return o >= -h && o <= h;
          let t1 = (-h - o) / d;
          let t2 = (h - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          return tmin <= tmax;
        };
        if (slab(lox, ldx, c.hw) && slab(loz, ldz, c.hd)) t = tmin;
      }
      if (t >= 0 && t < best) {
        const y = ay + dy * t;
        if (y >= c.y0 && y <= c.y1) best = t;
      }
    }
    return best;
  }
}
