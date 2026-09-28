// Rendu 3D des astres : surface, nuages, atmosphère, anneaux, Soleil.
// Les positions sont relatives à une « origine flottante » (le vaisseau)
// pour garder la précision à toutes les échelles.

import * as THREE from 'three';
import { PLANET_VS, PLANET_FS, CLOUD_FS, ATMO_VS, atmoFS, RING_VS, RING_FS, SUN_FS } from './shaders.js';

// Sphère dont les pôles sont sur l'axe Z (l'équateur est le plan de vol)
export function makeSphere(wSeg, hSeg, heights = null, hw = 0, hh = 0, R = 1) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j <= hSeg; j++) {
    const v = j / hSeg;
    const lat = (v - 0.5) * Math.PI;
    for (let i = 0; i <= wSeg; i++) {
      const u = i / wSeg;
      const lon = (u - 0.5) * Math.PI * 2;
      const x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
      let r = 1;
      if (heights) {
        const hx = Math.min(hw - 1, Math.floor(u * hw)), hy = Math.min(hh - 1, Math.floor(v * hh));
        r = 1 + heights[hy * hw + (hx % hw)] / R;
      }
      pos.push(x * r, y * r, z * r);
      nor.push(x, y, z);
      uv.push(u, v);
    }
  }
  const row = wSeg + 1;
  for (let j = 0; j < hSeg; j++) for (let i = 0; i < wSeg; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    if (j !== 0) idx.push(a, b, d);
    if (j !== hSeg - 1) idx.push(a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function ringTexture(inner, outer, id) {
  const W = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = 4;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, 4);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bands = [];
  for (let i = 0; i < 90; i++) bands.push([rnd(), rnd() * 0.02 + 0.002, rnd()]);
  for (let x = 0; x < W; x++) {
    const t = x / W; // 0 = intérieur, 1 = extérieur
    let a;
    if (id === 'saturne') {
      a = 0.25 + 0.55 * Math.sin(t * Math.PI) ;
      if (t > 0.58 && t < 0.63) a *= 0.08; // division de Cassini
      if (t < 0.18) a *= 0.35 * t / 0.18 + 0.15; // anneau C translucide
      if (t > 0.86 && t < 0.87) a *= 0.3; // division d'Encke
    } else {
      a = 0.0;
      for (const k of [0.15, 0.35, 0.6, 0.82, 0.95]) a += Math.exp(-((t - k) * (t - k)) / 0.0004);
    }
    for (const [p, w, s] of bands) a *= 1 - 0.35 * s * Math.exp(-((t - p) * (t - p)) / (w * w));
    a = Math.max(0, Math.min(1, a));
    const shade = 0.75 + 0.25 * Math.sin(t * 40) * Math.sin(t * 7);
    for (let y = 0; y < 4; y++) {
      const i = (y * W + x) * 4;
      img.data[i] = 255 * shade;
      img.data[i + 1] = 240 * shade;
      img.data[i + 2] = 215 * shade;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  void inner; void outer;
  return t;
}

export class Planets3D {
  constructor(sys, texMgr, quality) {
    this.sys = sys;
    this.tex = texMgr;
    this.q = quality;
    this.group = new THREE.Group();
    this.objs = new Map();
    const seg = quality.sphereSeg;
    this.sphereHi = makeSphere(seg, Math.round(seg / 2));
    this.sphereLo = makeSphere(64, 32);
    this.time = 0;
    for (const b of sys.bodies) this.build(b);
    texMgr.onReady((id) => this.applyTextures(id));
    for (const b of sys.bodies) this.applyTextures(b.id);
  }

  build(b) {
    const o = { body: b, group: new THREE.Group() };
    const isStar = b.type === 'star';
    if (isStar) {
      const mat = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } }, vertexShader: PLANET_VS, fragmentShader: SUN_FS });
      o.surface = new THREE.Mesh(this.sphereLo, mat);
      o.surface.scale.setScalar(b.radius);
      o.group.add(o.surface);
      this.objs.set(b.id, o);
      this.group.add(o.group);
      return;
    }
    const uniforms = {
      map: { value: null }, normalMap: { value: null }, nightMap: { value: null }, specMap: { value: null },
      hasNormal: { value: 0 }, hasNight: { value: 0 }, isEarth: { value: 0 }, liquidSpec: { value: b.def.liquid ? 1 : 0 },
      sunDir: { value: new THREE.Vector3(1, 0, 0) }, sunColor: { value: new THREE.Color(1, 1, 1) }, ambient: { value: 0.012 },
      baseColor: { value: new THREE.Color(b.color).convertSRGBToLinear() }, hasMap: { value: 0 },
      holeDir: { value: new THREE.Vector3(1, 0, 0) }, holeCos: { value: 2 }, emissive: { value: 0 }, time: { value: 0 },
      gasFlow: { value: b.type === 'gas' ? 0.0000004 : 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VS, fragmentShader: PLANET_FS });
    o.surface = new THREE.Mesh(this.sphereHi, mat);
    o.surface.scale.setScalar(b.radius);
    o.group.add(o.surface);
    o.uniforms = uniforms;
    // Nuages
    if (b.id === 'terre' || b.id === 'venus') {
      const cu = {
        map: { value: null }, sunDir: uniforms.sunDir, sunColor: uniforms.sunColor, ambient: { value: 0.01 }, opacity: { value: b.id === 'venus' ? 1.0 : 0.95 },
        time: { value: 0 }, drift: { value: b.id === 'venus' ? 0.0000012 : 0.0000002 }, tint: { value: new THREE.Color(1, 1, 1) },
        holeDir: uniforms.holeDir, holeCos: { value: 2 },
      };
      const cm = new THREE.ShaderMaterial({ uniforms: cu, vertexShader: PLANET_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      o.clouds = new THREE.Mesh(this.sphereHi, cm);
      const alt = b.id === 'venus' ? 55e3 : 6.5e3;
      o.clouds.scale.setScalar(b.radius + alt);
      o.clouds.renderOrder = 2;
      o.cloudU = cu;
      o.group.add(o.clouds);
    }
    // Atmosphère
    if (b.atmosphere) {
      const a = b.atmosphere;
      const Ra = b.radius + a.H * (b.type === 'gas' ? 9 : 10.5);
      const k = a.density || 1;
      const baseR = [5.8e-6, 13.5e-6, 33.1e-6];
      const col = a.rayleigh;
      const betaR = new THREE.Vector3(
        (baseR[2] * col[0]) * k * (5600 / a.H),
        (baseR[2] * col[1]) * k * (5600 / a.H),
        (baseR[2] * col[2]) * k * (5600 / a.H),
      );
      const au = {
        uPlanet: { value: new THREE.Vector3() }, uR: { value: b.radius }, uRa: { value: Ra },
        uBetaR: { value: betaR }, uBetaM: { value: (a.mie || 0.01) * 1.6e-3 * (5600 / a.H) }, uHR: { value: a.H }, uHM: { value: a.H * 0.22 },
        uG: { value: a.mieG || 0.76 }, uSunDir: uniforms.sunDir, uSunI: { value: 22 },
      };
      const am = new THREE.ShaderMaterial({
        uniforms: au, vertexShader: ATMO_VS, fragmentShader: atmoFS(this.q.atmSteps, this.q.atmSteps > 8 ? 4 : 3),
        transparent: true, depthWrite: false, side: THREE.FrontSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      });
      o.atmo = new THREE.Mesh(this.sphereLo, am);
      o.atmo.scale.setScalar(Ra * 1.002);
      o.atmo.renderOrder = 3;
      o.atmoU = au;
      o.Ra = Ra;
      o.group.add(o.atmo);
    }
    // Anneaux (inclinés pour la beauté ; purement décoratifs)
    if (b.def.rings) {
      const r = b.def.rings;
      const g = new THREE.RingGeometry(b.radius * r.inner, b.radius * r.outer, 160, 1);
      // UV : x = position radiale
      const pos = g.attributes.position, uvA = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const d = Math.hypot(pos.getX(i), pos.getY(i));
        uvA.setXY(i, (d / b.radius - r.inner) / (r.outer - r.inner), 0.5);
      }
      const ru = { map: { value: ringTexture(r.inner, r.outer, b.id) }, sunDir: uniforms.sunDir, planetPos: { value: new THREE.Vector3() }, planetR: { value: b.radius }, opacity: { value: r.opacity }, color: { value: new THREE.Color(r.color) } };
      const rm = new THREE.ShaderMaterial({ uniforms: ru, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      o.rings = new THREE.Mesh(g, rm);
      o.rings.rotation.x = b.id === 'uranus' ? 1.35 : 0.47;
      o.rings.renderOrder = 4;
      o.ringU = ru;
      o.group.add(o.rings);
    }
    this.objs.set(b.id, o);
    this.group.add(o.group);
  }

  applyTextures(id) {
    const o = this.objs.get(id === 'venus_nuages' ? 'venus' : id);
    if (!o || !o.uniforms) return;
    if (id === 'venus_nuages') {
      const t = this.tex.get('venus_nuages');
      if (t && o.cloudU) {
        // nuages opaques de Vénus : texture couleur complète
        t.color.needsUpdate = true;
        o.cloudU.map.value = t.color;
      }
      return;
    }
    const t = this.tex.get(id);
    if (!t) return;
    const u = o.uniforms;
    u.map.value = t.color;
    u.hasMap.value = 1;
    if (t.normal) { u.normalMap.value = t.normal; u.hasNormal.value = 1; }
    if (id === 'terre') {
      u.nightMap.value = t.night;
      u.hasNight.value = 1;
      u.specMap.value = t.spec;
      u.isEarth.value = 1;
      if (o.cloudU) o.cloudU.map.value = t.clouds;
    }
    // relief visible sur les petits corps : maillage déformé
    if (t.heights && o.body.ground.amp / o.body.radius > 0.004) {
      const seg = o.body.radius < 30e3 ? 128 : this.q.sphereSeg;
      o.surface.geometry = makeSphere(seg, Math.round(seg / 2), t.heights, t.hw, t.hh, o.body.radius);
    }
  }

  // Mise à jour : positions relatives à l'origine, direction du Soleil
  update(ut, origin, cam, dt, opts = {}) {
    this.time += dt;
    const sys = this.sys;
    const sunS = sys.sun.state(ut);
    for (const [id, o] of this.objs) {
      const b = o.body;
      const s = b.state(ut);
      const px = s.x - origin[0], py = s.y - origin[1];
      o.group.position.set(px, py, 0);
      if (b.hidden && opts.hiddenOk && !opts.hiddenOk(b)) { o.group.visible = false; continue; }
      // culling grossier : trop petit à l'écran
      const d = Math.hypot(px - cam.position.x, py - cam.position.y, cam.position.z);
      const pix = (b.radius / Math.max(d, 1)) * 1000;
      o.group.visible = pix > 0.05 || b.type === 'star';
      if (b.type === 'star') {
        o.surface.material.uniforms.time.value = this.time;
        continue;
      }
      o.surface.rotation.z = b.rotationAt(ut);
      if (o.clouds) {
        o.clouds.rotation.z = o.surface.rotation.z;
        o.cloudU.time.value = ut;
      }
      const sd = o.uniforms.sunDir.value.set(sunS.x - s.x, sunS.y - s.y, 0).normalize();
      void sd;
      o.uniforms.time.value = ut;
      if (o.atmo) {
        o.atmoU.uPlanet.value.set(px, py, 0);
        // coquille vue de l'intérieur : face arrière
        const inside = d < o.Ra;
        o.atmo.material.side = inside ? THREE.BackSide : THREE.FrontSide;
      }
      if (o.rings) o.ringU.planetPos.value.set(px, py, 0);
    }
  }

  // Trou dans la sphère là où le terrain local détaillé est affiché
  setHole(bodyId, dirObj, cosA) {
    for (const [id, o] of this.objs) {
      if (!o.uniforms) continue;
      if (id === bodyId && dirObj) {
        o.uniforms.holeDir.value.copy(dirObj);
        o.uniforms.holeCos.value = cosA;
      } else o.uniforms.holeCos.value = 2;
    }
  }
}
