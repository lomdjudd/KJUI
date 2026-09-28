// Relief procédural : champ de hauteur (fBm) aplani autour des lieux importants et des
// chemins, bordé de falaises. Mélange sol / roche selon la pente, directement dans le shader.
import * as THREE from 'three';
import { fbm, clamp, smoothstep, lerp } from '../core/utils.js';
import { Textures } from '../gfx/textures.js';

export class Terrain {
  constructor(def, seed, features) {
    this.size = def.size;
    this.half = def.size / 2;
    this.def = def;
    this.seed = seed;
    this.features = features; // { flats: [{x,z,r,h}], paths: [[{x,z},...]] }
    const seg = def.flat ? 2 : Math.min(128, Math.round(def.size / 2.4));
    this.seg = seg;
    this.step = def.size / seg;
    this.heights = new Float32Array((seg + 1) * (seg + 1));
    this._generate();
    this.mesh = this._buildMesh();
  }

  _rawHeight(x, z) {
    const d = this.def;
    if (d.flat) return 0;
    const f = d.freq;
    let h = (fbm(x * f + 100, z * f + 100, 5, this.seed) - 0.5) * 2 * d.height;
    // Ondulations plus fines
    h += (fbm(x * f * 4, z * f * 4, 2, this.seed + 7) - 0.5) * d.height * 0.15;
    // Zones aplanies (arènes, autels, bâtiments)
    for (const fl of this.features.flats) {
      const dist = Math.hypot(x - fl.x, z - fl.z);
      const k = 1 - smoothstep(fl.r * 0.75, fl.r * 1.35, dist);
      if (k > 0) h = lerp(h, fl.h ?? 0, k);
    }
    // Chemins : lisse la hauteur vers une valeur douce
    let pathK = 0;
    for (const path of this.features.paths) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
        const px = a.x + abx * t;
        const pz = a.z + abz * t;
        const dd = Math.hypot(x - px, z - pz);
        pathK = Math.max(pathK, 1 - smoothstep(2.5, 6, dd));
      }
    }
    if (pathK > 0) h = lerp(h, h * 0.35, pathK);
    this._pathK = pathK;
    // Bordure : falaises
    if (d.border > 0) {
      const edge = Math.max(Math.abs(x), Math.abs(z));
      const inner = this.half - d.border;
      if (edge > inner) {
        const t = (edge - inner) / d.border;
        h += Math.pow(t, 1.6) * 30 + (fbm(x * 0.08, z * 0.08, 3, this.seed + 3) - 0.3) * 10 * t;
      }
    }
    return h;
  }

  _generate() {
    const seg = this.seg;
    this.pathMask = new Float32Array((seg + 1) * (seg + 1));
    for (let j = 0; j <= seg; j++) {
      for (let i = 0; i <= seg; i++) {
        const x = -this.half + i * this.step;
        const z = -this.half + j * this.step;
        this._pathK = 0;
        this.heights[j * (seg + 1) + i] = this._rawHeight(x, z);
        this.pathMask[j * (seg + 1) + i] = this._pathK || 0;
      }
    }
  }

  // Hauteur exacte du maillage (interpolation bilinéaire par triangles)
  heightAt(x, z) {
    const seg = this.seg;
    const fx = clamp((x + this.half) / this.step, 0, seg - 0.0001);
    const fz = clamp((z + this.half) / this.step, 0, seg - 0.0001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const w = seg + 1;
    const h00 = this.heights[j * w + i];
    const h10 = this.heights[j * w + i + 1];
    const h01 = this.heights[(j + 1) * w + i];
    const h11 = this.heights[(j + 1) * w + i + 1];
    return lerp(lerp(h00, h10, u), lerp(h01, h11, u), v);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.8;
    const hl = this.heightAt(x - e, z);
    const hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e);
    const hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  pathAt(x, z) {
    const seg = this.seg;
    const i = Math.round(clamp((x + this.half) / this.step, 0, seg));
    const j = Math.round(clamp((z + this.half) / this.step, 0, seg));
    return this.pathMask[j * (seg + 1) + i];
  }

  _buildMesh() {
    const seg = this.seg;
    const w = seg + 1;
    const geo = new THREE.PlaneGeometry(this.size, this.size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const rock = new Float32Array(pos.count);
    const path = new Float32Array(pos.count);
    const col = new Float32Array(pos.count * 3);
    const tmpN = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const z = pos.getZ(k);
      // PlaneGeometry pivotée : l'ordre des sommets suit z croissant
      const i = Math.round((x + this.half) / this.step);
      const j = Math.round((z + this.half) / this.step);
      const h = this.heights[j * w + i];
      pos.setY(k, h);
      uv.setXY(k, x / 7, z / 7);
      this.normalAt(x, z, tmpN);
      rock[k] = smoothstep(0.82, 0.62, tmpN.y);
      path[k] = this.pathMask[j * w + i];
      const n = fbm(x * 0.05, z * 0.05, 2, this.seed + 11);
      const tint = 0.8 + n * 0.4;
      col[k * 3] = tint;
      col[k * 3 + 1] = tint;
      col[k * 3 + 2] = tint;
    }
    geo.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
    geo.setAttribute('aPath', new THREE.BufferAttribute(path, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const g = Textures.ground(this.def.ground === 'tiles' || this.def.ground === 'cobble' ? 'dirt' : this.def.ground);
    const r = Textures.rock();
    const main = this.def.ground === 'tiles' ? Textures.tiles() : this.def.ground === 'cobble' ? Textures.cobble() : g;
    const pathTex = this.def.pathGround === 'cobble' ? Textures.cobble() : this.def.ground === 'snow' ? Textures.ground('snow') : Textures.ground(this.def.ground === 'dirt' ? 'mud' : 'dirt');
    const mat = new THREE.MeshStandardMaterial({
      map: main.map,
      normalMap: main.normalMap,
      vertexColors: true,
      roughness: this.def.ground === 'tiles' ? 0.55 : this.def.ground === 'snow' ? 0.7 : 0.95,
      metalness: 0,
    });
    const hasPath = !this.def.flat;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.rockMap = { value: r.map };
      shader.uniforms.pathMap = { value: pathTex.map };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aRock;\nattribute float aPath;\nvarying float vRock;\nvarying float vPath;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;\nvPath = aPath;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D rockMap;\nuniform sampler2D pathMap;\nvarying float vRock;\nvarying float vPath;')
        .replace(
          '#include <map_fragment>',
          `vec4 texelColor = texture2D(map, vMapUv);
          ${hasPath ? 'texelColor = mix(texelColor, texture2D(pathMap, vMapUv * 1.3), smoothstep(0.3, 0.8, vPath));' : ''}
          vec4 rockColor = texture2D(rockMap, vMapUv * 0.6);
          texelColor = mix(texelColor, rockColor, vRock);
          diffuseColor *= texelColor;`,
        );
    };
    mat.customProgramCacheKey = () => 'terrain' + (hasPath ? 'p' : '');
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }
}
