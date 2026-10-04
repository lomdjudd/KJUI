// Effets visuels : particules, explosions, projectiles, textes flottants.
import * as THREE from 'three';
import { G, bus } from '../core/state.js';
import { rand } from '../core/util.js';
import { sfx } from '../core/audio.js';

const MAXP = 2500;

export class FX {
  constructor() {
    this.scene = null;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAXP * 3);
    this.col = new Float32Array(MAXP * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.points.frustumCulled = false;
    this.parts = [];
    for (let i = 0; i < MAXP; i++) this.parts.push({ life: 0, v: new THREE.Vector3(), p: new THREE.Vector3(), c: new THREE.Color(), g: 0 });
    this.next = 0;
    this.projectiles = [];
    this.flashes = [];
    this.shake = 0;
    this.texts = [];
    this.textRoot = null;
  }

  attach(scene) {
    if (this.scene) this.scene.remove(this.points);
    this.scene = scene;
    scene.add(this.points);
    for (const p of this.projectiles) scene.add(p.mesh);
  }

  clear() {
    for (const p of this.projectiles) p.mesh.parent?.remove(p.mesh);
    this.projectiles = [];
    for (const f of this.flashes) f.mesh.parent?.remove(f.mesh);
    this.flashes = [];
    for (const p of this.parts) p.life = 0;
  }

  burst(pos, color = 0xffffff, n = 12, speed = 4, life = 0.8, grav = -6) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.next];
      this.next = (this.next + 1) % MAXP;
      p.p.copy(pos);
      p.v.set(rand(-1, 1), rand(-0.3, 1.2), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
      p.c.copy(c).offsetHSL(0, 0, rand(-0.1, 0.1));
      p.life = life * rand(0.6, 1.2);
      p.g = grav;
    }
  }

  flash(pos, color, radius, dur = 0.5) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(pos);
    this.scene.add(m);
    const light = new THREE.PointLight(color, 30, radius * 4, 1.5);
    m.add(light);
    this.flashes.push({ mesh: m, t: 0, dur, radius });
  }

  explosion(pos, radius, nuke = false) {
    sfx('explode');
    this.flash(pos, nuke ? 0xffffe0 : 0xffa040, radius, nuke ? 3 : 0.6);
    this.burst(pos, 0xff8020, nuke ? 300 : 60, radius * 1.5, 1.2, -3);
    this.burst(pos, 0x555555, nuke ? 200 : 40, radius * 0.8, 2.5, 1.5);
    this.shake = Math.min(2, this.shake + (nuke ? 2 : radius / 8));
    if (nuke) bus.emit('whiteflash');
  }

  spawnProjectile(o) {
    let mesh;
    if (o.kind === 'arrow') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x8a6a3a }));
      mesh.geometry.rotateX(Math.PI / 2);
    } else if (o.kind === 'bullet') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe080 }));
    } else if (o.kind === 'laser') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 5), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
      mesh.geometry.rotateX(Math.PI / 2);
    } else if (o.kind === 'fire') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff8020, transparent: true, opacity: 0.8 }));
    } else if (o.kind === 'virus') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x80ff40, emissive: 0x40a020 }));
    } else if (o.kind === 'rock') {
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, flatShading: true }));
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(o.kind === 'nuke' ? 0.4 : 0.2, 8, 6), new THREE.MeshStandardMaterial({ color: o.kind === 'nuke' ? 0xd0d020 : 0x2a2a2a }));
    }
    mesh.position.copy(o.pos);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      pos: mesh.position,
      vel: o.vel.clone(),
      dmg: o.dmg,
      kind: o.kind,
      side: o.side,
      life: o.life ?? 4,
      grav: o.grav ?? (o.kind === 'arrow' ? -9 : o.kind === 'bullet' || o.kind === 'laser' || o.kind === 'fire' ? 0 : -14),
      radius: o.radius ?? 0,
      virus: o.virus ?? 0,
      owner: o.owner,
    });
  }

  // Liste de toutes les cibles possibles (créatures, PNJ, robots)
  targets() {
    const a = [];
    if (G.creatures) a.push(...G.creatures.list);
    if (G.npcs) a.push(...G.npcs.list);
    return a;
  }

  hostileTo(side, target) {
    if (target === G.player) return side === 'enemy' || side === 'wild';
    if (side === 'player') return target.side !== 'ally';
    if (side === 'ally') return target.side === 'enemy' || target.side === 'wild';
    if (side === 'enemy') return target.side === 'villager' || target.side === 'ally';
    return true;
  }

  areaDamage(pos, radius, dmg, side, virus = 0) {
    for (const t of this.targets()) {
      if (!t.alive) continue;
      const d = t.pos.distanceTo(pos);
      if (d < radius + t.radius) {
        const k = 1 - Math.min(1, d / (radius + t.radius)) * 0.6;
        t.damage(dmg * k, side, pos);
        if (virus) t.infect?.(virus);
      }
    }
    const p = G.player;
    if (p && side !== 'player' && p.pos.distanceTo(pos) < radius) p.damage(dmg * 0.6);
    if (p && side === 'player' && p.pos.distanceTo(pos) < radius * 0.5 && dmg > 400) p.damage(dmg * 0.3);
    if (radius > 30) bus.emit('nuke', pos, radius);
  }

  update(dt) {
    // Particules
    for (let i = 0; i < MAXP; i++) {
      const p = this.parts[i];
      if (p.life > 0) {
        p.life -= dt;
        p.v.y += p.g * dt;
        p.p.addScaledVector(p.v, dt);
        this.pos[i * 3] = p.p.x;
        this.pos[i * 3 + 1] = p.p.y;
        this.pos[i * 3 + 2] = p.p.z;
        const k = Math.max(0, Math.min(1, p.life * 2));
        this.col[i * 3] = p.c.r * k;
        this.col[i * 3 + 1] = p.c.g * k;
        this.col[i * 3 + 2] = p.c.b * k;
      } else {
        this.pos[i * 3 + 1] = -9999;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = f.t / f.dur;
      f.mesh.scale.setScalar(f.radius * (0.3 + k));
      f.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) {
        f.mesh.parent?.remove(f.mesh);
        this.flashes.splice(i, 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2);

    // Projectiles
    const ground = (p) => (G.mode === 'world' && G.world ? G.world.height(p.x, p.z) : -999);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.vel.y += pr.grav * dt;
      pr.pos.addScaledVector(pr.vel, dt);
      if (pr.vel.lengthSq() > 0.01) pr.mesh.lookAt(pr.pos.clone().add(pr.vel));
      if (pr.kind === 'fire') this.burst(pr.pos, 0xff6010, 2, 1, 0.4, 2);
      let hit = false;
      const isBomb = pr.radius > 0;
      if (!isBomb) {
        for (const t of this.targets()) {
          if (!t.alive || !this.hostileTo(pr.side, t)) continue;
          if (t.pos.distanceTo(pr.pos) < t.radius + 0.4) {
            t.damage(pr.dmg, pr.side, pr.pos);
            if (pr.kind === 'fire') t.burn = 3;
            hit = true;
            break;
          }
        }
        const p = G.player;
        if (!hit && p && pr.side !== 'player' && pr.side !== 'ally' && p.pos.distanceTo(pr.pos) < p.radius + 0.4) {
          p.damage(pr.dmg);
          hit = true;
        }
      }
      const gh = ground(pr.pos);
      if (pr.pos.y < gh + 0.1) {
        hit = true;
        pr.pos.y = gh + 0.1;
      }
      if (hit || pr.life <= 0) {
        if (isBomb) {
          if (pr.kind === 'virus') {
            this.burst(pr.pos, 0x80ff40, 50, 6, 2, 0.5);
            sfx('splash');
          } else this.explosion(pr.pos, pr.radius, pr.kind === 'nuke');
          this.areaDamage(pr.pos, pr.radius, pr.dmg, pr.side, pr.virus);
        } else if (hit) this.burst(pr.pos, pr.kind === 'laser' ? 0xff4040 : 0xd0c0a0, 6, 2, 0.4);
        pr.mesh.parent?.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    this.updateTexts(dt);
  }

  // Textes flottants (dégâts, gains)
  text(pos, str, color = '#fff') {
    if (!this.textRoot) this.textRoot = document.getElementById('floaters');
    if (!this.textRoot) return;
    const el = document.createElement('div');
    el.className = 'floater';
    el.textContent = str;
    el.style.color = color;
    this.textRoot.appendChild(el);
    this.texts.push({ el, p: pos.clone(), t: 0 });
    if (this.texts.length > 40) {
      const old = this.texts.shift();
      old.el.remove();
    }
  }

  updateTexts(dt) {
    const cam = G.camera;
    if (!cam) return;
    const v = new THREE.Vector3();
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      t.p.y += dt * 1.2;
      v.copy(t.p).project(cam);
      if (t.t > 1.2 || v.z > 1) {
        t.el.remove();
        this.texts.splice(i, 1);
        continue;
      }
      t.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
      t.el.style.opacity = String(1 - t.t / 1.2);
    }
  }
}
