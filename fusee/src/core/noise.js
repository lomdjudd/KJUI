// Bruit procédural déterministe (simplex 3D, fbm, crêtes, cratères).
// Le même code tourne dans le thread principal (physique du relief) et dans
// le worker qui génère les textures des planètes : le relief affiché et le
// relief « physique » sont donc strictement identiques.

const F3 = 1 / 3;
const G3 = 1 / 6;
const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Hash entier 3D -> [0,1)
export function hash3(x, y, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Simplex3 {
  constructor(seed = 1) {
    const rnd = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  noise(xin, yin, zin) {
    const perm = this.perm, permMod12 = this.permMod12;
    let n0, n1, n2, n3;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0;
    else {
      const gi0 = permMod12[ii + perm[jj + perm[kk]]] * 3;
      t0 *= t0;
      n0 = t0 * t0 * (GRAD3[gi0] * x0 + GRAD3[gi0 + 1] * y0 + GRAD3[gi0 + 2] * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0;
    else {
      const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
      t1 *= t1;
      n1 = t1 * t1 * (GRAD3[gi1] * x1 + GRAD3[gi1 + 1] * y1 + GRAD3[gi1 + 2] * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0;
    else {
      const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
      t2 *= t2;
      n2 = t2 * t2 * (GRAD3[gi2] * x2 + GRAD3[gi2 + 1] * y2 + GRAD3[gi2 + 2] * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0;
    else {
      const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
      t3 *= t3;
      n3 = t3 * t3 * (GRAD3[gi3] * x3 + GRAD3[gi3 + 1] * y3 + GRAD3[gi3 + 2] * z3);
    }
    return 32 * (n0 + n1 + n2 + n3);
  }

  fbm(x, y, z, oct = 5, lac = 2.0, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let o = 0; o < oct; o++) {
      s += a * this.noise(x * f, y * f, z * f);
      n += a;
      a *= gain;
      f *= lac;
    }
    return s / n;
  }

  ridged(x, y, z, oct = 5, lac = 2.0, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0, prev = 1;
    for (let o = 0; o < oct; o++) {
      let v = 1 - Math.abs(this.noise(x * f, y * f, z * f));
      v *= v;
      s += a * v * prev;
      prev = v;
      n += a;
      a *= gain;
      f *= lac;
    }
    return s / n;
  }

  // Déformation de domaine : donne des formes « tourbillonnaires »
  warp(x, y, z, strength, oct = 3) {
    const wx = this.fbm(x + 5.2, y + 1.3, z + 7.7, oct);
    const wy = this.fbm(x + 1.7, y + 9.2, z + 3.1, oct);
    const wz = this.fbm(x + 8.3, y + 2.8, z + 4.4, oct);
    return [x + wx * strength, y + wy * strength, z + wz * strength];
  }
}

// Champ de cratères : somme de plusieurs « octaves » de cratères répartis
// sur une grille 3D. Renvoie un décalage de hauteur (négatif = cuvette).
// density : probabilité qu'une cellule contienne un cratère.
export function craterField(x, y, z, seed, freq, density, octaves = 3, fresh = 0.5) {
  let h = 0;
  let f = freq;
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const px = x * f, py = y * f, pz = z * f;
    const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
    const big = o === 0;
    const r0 = big ? -1 : 0, r1 = big ? 1 : 0;
    for (let dx = r0; dx <= r1; dx++) for (let dy = r0; dy <= r1; dy++) for (let dz = r0; dz <= r1; dz++) {
      const ix = cx + dx, iy = cy + dy, iz = cz + dz;
      const s = seed + o * 7919;
      if (hash3(ix, iy, iz, s) > density) continue;
      const mx = ix + 0.25 + 0.5 * hash3(ix, iy, iz, s + 1);
      const my = iy + 0.25 + 0.5 * hash3(ix, iy, iz, s + 2);
      const mz = iz + 0.25 + 0.5 * hash3(ix, iy, iz, s + 3);
      const rr = big ? 0.25 + 0.55 * hash3(ix, iy, iz, s + 4) : 0.08 + 0.12 * hash3(ix, iy, iz, s + 4);
      const ddx = px - mx, ddy = py - my, ddz = pz - mz;
      const d = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) / rr;
      if (d > 1.6) continue;
      const age = hash3(ix, iy, iz, s + 5) * (1 - fresh) + fresh;
      let c;
      if (d < 1) c = (d * d - 1) * 0.9; // cuvette
      else c = 0;
      const rim = Math.exp(-((d - 1) * (d - 1)) / 0.045) * 0.35;
      // piton central des grands cratères
      const peak = big && rr > 0.5 ? Math.exp(-d * d / 0.02) * 0.35 : 0;
      h += (c + rim + peak) * amp * rr * age;
    }
    f *= 2.7;
    amp *= 0.45;
  }
  return h;
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
