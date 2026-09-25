import * as THREE from 'three';
import { makeBeamTexture } from '../world/textures.js';

// Faisceaux lumineux verticaux, anneaux de course et objets ramassables
export class Markers {
  constructor(scene) {
    this.scene = scene;
    this.beamTex = makeBeamTexture();
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
    this.beamGeo.translate(0, 0.5, 0);
    this.ringGeo = new THREE.TorusGeometry(5, 0.35, 8, 32);
    this.items = new Set();
    this.t = 0;
  }

  beam(pos, color = '#ffd23f', height = 140, radius = 2.5) {
    const mat = new THREE.MeshBasicMaterial({
      map: this.beamTex,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const m = new THREE.Mesh(this.beamGeo, mat);
    m.position.copy(pos);
    m.scale.set(radius, height, radius);
    m.renderOrder = 3;
    this.scene.add(m);
    const item = { mesh: m, kind: 'beam' };
    this.items.add(item);
    return item;
  }

  ring(pos, yaw, color = '#4fd2ff') {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.copy(pos);
    m.rotation.y = yaw;
    this.scene.add(m);
    const item = { mesh: m, kind: 'ring' };
    this.items.add(item);
    return item;
  }

  backpack(pos) {
    const g = new THREE.Group();
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), new THREE.MeshStandardMaterial({ color: 0x8a2020, roughness: 0.8 }));
    bag.position.y = 0.45;
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.15), new THREE.MeshStandardMaterial({ color: 0x1f3f8a }));
    pocket.position.set(0, 0.35, 0.25);
    const web = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 }));
    web.position.y = 0.45;
    g.add(bag, pocket, web);
    g.position.copy(pos);
    this.scene.add(g);
    const glow = this.beam(pos, '#ffffff', 12, 0.6);
    const item = { mesh: g, kind: 'bag', glow };
    this.items.add(item);
    return item;
  }

  remove(item) {
    if (!item) return;
    this.scene.remove(item.mesh);
    if (item.mesh.material && item.mesh.material.dispose) item.mesh.material.dispose();
    if (item.glow) this.remove(item.glow);
    this.items.delete(item);
  }

  update(dt, camPos) {
    this.t += dt;
    for (const it of this.items) {
      if (it.kind === 'ring') {
        it.mesh.material.opacity = 0.65 + Math.sin(this.t * 5) * 0.2;
      } else if (it.kind === 'bag') {
        it.mesh.rotation.y += dt * 1.5;
        it.mesh.children[0].position.y = 0.45 + Math.sin(this.t * 3) * 0.1;
      } else if (it.kind === 'beam') {
        // les faisceaux lointains restent visibles, s'estompent de près
        const d = camPos ? it.mesh.position.distanceTo(camPos) : 100;
        it.mesh.material.opacity = Math.min(1, Math.max(0.15, (d - 8) / 60));
      }
    }
  }
}
