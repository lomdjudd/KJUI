// Scènes de décor animées : la Terre vue d'orbite (menu) et le pas de tir
// au lever du jour (centre spatial). Elles réutilisent la scène de vol.

import * as THREE from 'three';
import { CraftView } from '../craft/craftview.js';
import { Craft } from '../craft/craft.js';
import { TEMPLATES } from '../builder/templates.js';
import { EARTH_SITES } from '../core/terrain.js';

export class Showcase {
  constructor(flight) {
    this.f = flight;
    this.cam = new THREE.PerspectiveCamera(42, 1, 0.5, 1e15);
    this.time = 0;
    this.craftView = null;
    this.mode = 'orbit';
    this.ut = 0;
  }

  setCraft(craftJSON) {
    const f = this.f;
    if (this.craftView) f.scene.remove(this.craftView.group);
    const c = Craft.fromJSON(craftJSON || TEMPLATES[3].build().toJSON());
    c.layout();
    this.craft = c;
    this.craftView = new CraftView();
    this.craftView.sync(c.parts, { deployAll: 0 });
    f.scene.add(this.craftView.group);
    this.height = c.bounds.maxY - c.bounds.minY;
    this.minY = c.bounds.minY;
    this.maxY = c.bounds.maxY;
    f.site.buildPad(this.height, Math.max(1.2, (c.bounds.maxX - c.bounds.minX) / 2));
  }

  start(mode, ut, craftJSON) {
    this.mode = mode;
    this.ut = ut;
    this.time = 0;
    this.setCraft(craftJSON);
    // cache les éléments du vol
    for (const vw of this.f.views.values()) vw.root.visible = false;
    this.f.effects.group.visible = false;
  }

  stop() {
    const f = this.f;
    if (this.craftView) f.scene.remove(this.craftView.group);
    this.craftView = null;
    f.effects.group.visible = true;
  }

  render(dt) {
    const f = this.f;
    const R = f.app.R;
    const sys = f.sys;
    this.time += dt;
    const earth = sys.home;
    let ut = this.ut + this.time * (this.mode === 'orbit' ? 8 : 20);
    const es = earth.state(ut);
    const sun = sys.sun.state(ut);
    const sunAng = Math.atan2(sun.y - es.y, sun.x - es.x);
    let ox, oy, up;
    const cam = this.cam;
    cam.aspect = R.width / R.height;
    const cv = this.craftView;
    if (this.mode === 'orbit') {
      // lever de Soleil sur le limbe terrestre, vu depuis l'orbite
      const alt = 240e3;
      const r = earth.radius + alt;
      const dip = Math.acos(earth.radius / r);
      const a = sunAng + Math.PI / 2 + dip - 0.035;
      ox = es.x + Math.cos(a) * r;
      oy = es.y + Math.sin(a) * r;
      up = [Math.cos(a), Math.sin(a)];
      const west = new THREE.Vector3(up[1], -up[0], 0);
      const upV = new THREE.Vector3(up[0], up[1], 0);
      const north = new THREE.Vector3(0, 0, 1);
      const t = this.time * 0.035;
      const L = west.clone().multiplyScalar(Math.cos(dip)).addScaledVector(upV, -Math.sin(dip) + 0.12).normalize();
      const S = new THREE.Vector3().crossVectors(L, upV).normalize();
      const U = new THREE.Vector3().crossVectors(S, L).normalize();
      const d = Math.max(30, this.height * 1.25);
      cam.position.copy(L).multiplyScalar(-d).addScaledVector(U, d * 0.08 + Math.sin(t) * d * 0.05).addScaledVector(S, Math.cos(t * 0.7) * d * 0.06);
      cam.up.copy(U);
      cam.lookAt(L.clone().multiplyScalar(d * 0.6).addScaledVector(S, -d * 0.42).addScaledVector(U, -d * 0.05));
      cam.fov = 50;
      if (cv) {
        cv.group.visible = true;
        // la fusée traverse le champ, nez vers la droite et l'horizon
        const A = S.clone().multiplyScalar(0.82).addScaledVector(L, 0.3).addScaledVector(U, 0.2).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A);
        const roll = new THREE.Quaternion().setFromAxisAngle(A, 0.8 + this.time * 0.05);
        cv.group.quaternion.copy(roll.multiply(q));
        const c = (this.minY + this.maxY) / 2;
        cv.group.position.copy(A).multiplyScalar(-c).addScaledVector(S, d * 0.05);
      }
    } else {
      // pas de tir, caméra en orbite lente
      const lon = EARTH_SITES.pad.lon;
      const a = lon + earth.rotationAt(ut);
      const R0 = earth.radius + EARTH_SITES.pad.h;
      ox = es.x + Math.cos(a) * R0;
      oy = es.y + Math.sin(a) * R0;
      up = [Math.cos(a), Math.sin(a)];
      const east = new THREE.Vector3(-up[1], up[0], 0);
      const upV = new THREE.Vector3(up[0], up[1], 0);
      const north = new THREE.Vector3(0, 0, 1);
      const t = this.time * 0.04;
      const d = Math.max(60, this.height * 2.4);
      const pos = east.clone().multiplyScalar(Math.sin(t) * d).add(north.clone().multiplyScalar(-Math.cos(t) * d)).add(upV.clone().multiplyScalar(d * 0.28 + 8));
      cam.position.copy(pos);
      cam.up.copy(upV);
      cam.lookAt(upV.clone().multiplyScalar(this.height * 0.45));
      cam.fov = 45;
      if (cv) {
        cv.group.visible = true;
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east.clone().negate(), upV, north));
        cv.group.quaternion.copy(q);
        cv.group.position.copy(upV.clone().multiplyScalar(-this.minY + 0.02));
      }
    }
    cam.near = 0.5;
    cam.far = 1e15;
    cam.updateProjectionMatrix();
    // éclairage
    const sunDir = new THREE.Vector3(sun.x - ox, sun.y - oy, 0).normalize();
    const vFake = {
      body: earth, altitude: Math.hypot(ox - es.x, oy - es.y) - earth.radius, sunFlux: 1,
      inShadow: () => { const along = (ox - es.x) * sunDir.x + (oy - es.y) * sunDir.y; if (along > 0) return false; return Math.abs((ox - es.x) * sunDir.y - (oy - es.y) * sunDir.x) < earth.radius; },
    };
    const light = f.computeLighting(vFake, sunDir, up);
    f.sunLight.position.copy(sunDir).multiplyScalar(80);
    f.sunLight.target.position.set(0, 0, 0);
    f.sunLight.color.copy(light.sunColor);
    f.sunLight.intensity = light.sunI;
    f.sunLight.castShadow = false;
    f.hemi.color.copy(light.skyTop).multiplyScalar(1.4).addScalar(0.02);
    f.hemi.groundColor.copy(light.ground).addScalar(0.02);
    f.scene.environment = f.envLight.update(dt, { skyTop: light.skyTop, horizon: light.horizon, ground: light.ground, sunDir, sunColor: light.sunColor.clone().multiplyScalar(light.sunI * 0.4), up: new THREE.Vector3(up[0], up[1], 0) });
    f.scene.fog = null;
    f.planets3d.group.visible = true;
    f.planets2d.group.visible = false;
    f.stars2d.visible = false;
    f.sky.group.visible = true;
    f.planets3d.update(ut, [ox, oy], cam, dt, { hiddenOk: () => false });
    // terrain et pas de tir
    const useTerrain = this.mode === 'pad';
    f.terrain.group.visible = useTerrain;
    if (useTerrain) {
      const lonV = EARTH_SITES.pad.lon;
      const W = f.terrain.need(earth, lonV, 200);
      if (W) f.terrain.build(earth, lonV, W);
      f.terrain.place(earth, ut, [es.x - ox, es.y - oy]);
      f.planets3d.setHole(earth.id, f.terrain.holeDir, f.terrain.holeCos);
    } else f.planets3d.setHole(null);
    f.site.update(ut, [es.x - ox, es.y - oy], this.mode === 'pad' ? 0 : Infinity, light.sunI < 0.2, null);
    f.sky.update(cam, new THREE.Vector3(sun.x - ox, sun.y - oy, 0), sys.sun.radius, dt, { starBrightness: light.starBright, twinkle: 0, pixelRatio: R.renderer.getPixelRatio(), sunGlow: light.sunGlow });
    for (const vw of f.views.values()) vw.root.visible = false;
    f.engineLight.intensity = 0;
    R.renderer.toneMappingExposure = light.exposure;
    R.setBloom(0.75, 0.5, 0.86);
    R.render(f.scene, cam);
  }
}
