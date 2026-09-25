import * as THREE from 'three';
import { Boss } from '../npc/boss.js';
import { Rhino } from '../npc/rhino.js';
import { mulberry32, formatTime, pick } from '../engine/utils.js';
import { N } from '../world/city.js';
import { Rig } from '../player/rig.js';
import * as A from '../player/anims.js';

// ---------- Missions de l'histoire ----------
// Chaque mission : { id, title, intro, where(game) -> Vector3, create(game) -> instance }
// Une instance expose : objective, markers[], timer, update(dt) -> 'running' | 'success' | 'fail', cleanup()

function v(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

class BaseMission {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.objective = '';
    this.markers = []; // {pos, color, label}
    this.timer = null;
    this.items = [];
    this.enemies = [];
    this.failReason = '';
  }
  beam(pos, color, h) {
    const b = this.game.markers.beam(pos, color, h);
    this.items.push(b);
    return b;
  }
  // keep : on laisse les ennemis vaincus au sol (ils disparaîtront d'eux-mêmes)
  cleanup(keep = false) {
    for (const it of this.items) this.game.markers.remove(it);
    this.items = [];
    if (!keep) this.game.enemies.clear((e) => e.mission === this);
  }
  spawnWave(center, types, radius = 8, opts = {}) {
    const out = [];
    types.forEach((t, k) => {
      const a = (k / types.length) * Math.PI * 2 + Math.random() * 0.5;
      const r = radius * (0.5 + Math.random() * 0.5);
      const p = center.clone().add(v(Math.cos(a) * r, 0, Math.sin(a) * r));
      const e = this.game.enemies.spawn(t, p, { mission: this, home: center, leash: opts.leash || 40, aggro: opts.aggro, hpMul: opts.hpMul });
      out.push(e);
      this.enemies.push(e);
    });
    return out;
  }
  aliveCount() {
    return this.enemies.filter((e) => e.alive).length;
  }
}

// 1. Tutoriel de balancement
class SwingTutorial extends BaseMission {
  constructor(game, def) {
    super(game, def);
    const city = game.city;
    // Parcours le long d'une avenue
    const pts = [];
    const x = city.streetX(6);
    for (let k = 0; k < 8; k++) {
      const z = city.streetZ(10) - k * 70;
      pts.push(v(x + Math.sin(k * 1.3) * 5, 22 + Math.sin(k * 0.9) * 8 + k * 2, z));
    }
    // virage final vers l'est
    pts.push(v(city.streetX(7) + 20, 40, city.streetZ(2)));
    pts.push(v(city.streetX(8) + 10, 46, city.streetZ(2)));
    this.points = pts;
    this.index = 0;
    this.timer = 100;
    this.hints = [
      [0, 'Maintiens MAJ (ou TOILE) en l’air pour te balancer. Relâche pour t’envoler !'],
      [2, 'ESPACE en l’air : propulsion-toile. Enchaîne les balancements !'],
      [4, 'E : point de lancement vers le toit visé (cercle blanc). ESPACE en arrivant = envol.'],
      [6, 'Contre un mur : tu grimpes. MAJ pour courir sur le mur !'],
    ];
    this._ring();
  }
  _ring() {
    if (this.ring) this.game.markers.remove(this.ring);
    const p = this.points[this.index];
    const next = this.points[this.index + 1] || p.clone().add(v(0, 0, -10));
    const yaw = Math.atan2(next.x - p.x, next.z - p.z);
    this.ring = this.game.markers.ring(p, yaw);
    this.items.push(this.ring);
    this.markers = [{ pos: p, color: '#4fd2ff', label: `${this.index + 1}/${this.points.length}` }];
    this.objective = `Traverse les anneaux (${this.index}/${this.points.length})`;
    for (const [i, h] of this.hints) if (i === this.index) this.game.hud.hint(h, 7);
  }
  update(dt) {
    this.timer -= dt;
    const p = this.points[this.index];
    if (this.game.player.chestPos.distanceTo(p) < 6.5) {
      this.game.audio.play('checkpoint');
      this.index++;
      this.timer += 6;
      if (this.index >= this.points.length) return 'success';
      this._ring();
    }
    if (this.timer <= 0) {
      this.failReason = 'Temps écoulé !';
      return 'fail';
    }
    return 'running';
  }
}

// 2 & 6. Combat par vagues
class WaveFight extends BaseMission {
  constructor(game, def) {
    super(game, def);
    this.center = def.where(game).clone();
    this.waves = def.waves;
    this.wave = -1;
    this.started = false;
    this.markers = [{ pos: this.center, color: '#ff4040', label: 'Combat' }];
    this.objective = def.approach || 'Rends-toi sur les lieux';
    this.pause = 0;
  }
  update(dt) {
    const p = this.game.player;
    if (!this.started) {
      if (p.pos.distanceTo(this.center) < 55) {
        this.started = true;
        this._next();
      }
      return 'running';
    }
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) this._spawn();
      return 'running';
    }
    const n = this.aliveCount();
    this.objective = `${this.def.fightText || 'Neutralise les criminels'} — vague ${this.wave + 1}/${this.waves.length} (${n} restant${n > 1 ? 's' : ''})`;
    this.markers = this.enemies.filter((e) => e.alive).map((e) => ({ pos: e.pos, color: '#ff4040', small: true }));
    if (n === 0) {
      if (this.wave + 1 >= this.waves.length) return 'success';
      this._next();
    }
    return 'running';
  }
  _next() {
    this.wave++;
    this.pause = this.wave === 0 ? 0.01 : 2.5;
    if (this.wave > 0) this.game.hud.toast('Des renforts arrivent !');
  }
  _spawn() {
    const w = this.waves[this.wave];
    this.spawnWave(this.center, w, 12, { aggro: this.wave > 0, leash: 45, hpMul: this.def.hpMul });
    if (this.def.hints && this.def.hints[this.wave]) this.game.hud.hint(this.def.hints[this.wave], 9);
  }
}

// 3. Course-poursuite
class CarChase extends BaseMission {
  constructor(game, def) {
    super(game, def);
    const city = game.city;
    this.ci = def.start ? def.start.i : 2;
    this.cj = def.start ? def.start.j : 12;
    const start = city.intersection(this.ci, this.cj);
    this.path = start.clone();
    this.pos = start.clone();
    this.dir = { x: 1, z: 0 };
    this.speed = 0;
    this.maxSpeed = 21;
    this.hp = 100;
    this.markers = [{ pos: this.pos, color: '#ff4040', label: 'Voiture' }];
    this.objective = 'Rattrape la voiture des braqueurs';
    this.stage = 'chase';
    this.escapeT = 0;
    // voiture
    const geo = game.traffic.mesh.geometry;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x222222, roughness: 0.3, metalness: 0.6 });
    this.car = new THREE.Mesh(geo, mat);
    this.car.castShadow = true;
    game.scene.add(this.car);
    this.items.push({ mesh: this.car, kind: 'mesh' });
    this.nextNode = { i: this.ci + 1, j: this.cj };
    if (this.nextNode.i > N - 1) this.nextNode.i = this.ci - 1;
    this.isCar = true;
    this.chest = this.pos.clone();
    this.alive = true;
    this.radius = 2.2;
    this.state = 'drive';
    game.carTarget = this;
  }
  get targetable() {
    return this.stage === 'chase';
  }
  addWeb(n) {
    this.hit({ dmg: 7 * n });
  }
  hit(info) {
    if (this.stage !== 'chase') return { killed: false, blocked: false };
    this.hp -= info.dmg * 0.7;
    this.game.fx.sparks(this.chest, 8, '#ffd27a', 6);
    if (this.hp <= 0) {
      this.stage = 'crash';
      this.speed = 0;
      this.game.fx.explosion(this.pos.clone().add(v(0, 1, 0)), 0.6);
      this.game.audio.play('explosion');
      this.game.hud.toast('Voiture arrêtée ! Neutralise les braqueurs !');
      this.spawnWave(this.pos, ['voyou', 'voyou', 'tireur', 'voyou'], 5, { aggro: true, leash: 30 });
      this.game.carTarget = null;
    }
    return { killed: false, blocked: false };
  }
  _pickNext() {
    const opts = [];
    const cand = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dz] of cand) {
      if (dx === -this.dir.x && dz === -this.dir.z) continue;
      const ni = this.ci + dx;
      const nj = this.cj + dz;
      if (ni < 1 || nj < 1 || ni > N - 1 || nj > N - 1) continue;
      opts.push({ dx, dz, ni, nj });
    }
    const o = pick(opts);
    this.dir = { x: o.dx, z: o.dz };
    this.nextNode = { i: o.ni, j: o.nj };
  }
  update(dt) {
    const game = this.game;
    const city = game.city;
    const p = game.player;
    if (this.stage === 'chase') {
      const dist = p.pos.distanceTo(this.pos);
      this.speed = Math.min(this.maxSpeed, this.speed + dt * 6);
      if (dist < 25) this.speed = Math.max(this.speed, 16);
      const target = city.intersection(this.nextNode.i, this.nextNode.j);
      const to = target.clone().sub(this.path);
      to.y = 0;
      const d = to.length();
      if (d < this.speed * dt + 0.5) {
        this.path.copy(target);
        this.ci = this.nextNode.i;
        this.cj = this.nextNode.j;
        this._pickNext();
      } else {
        to.multiplyScalar(1 / d);
        this.path.addScaledVector(to, this.speed * dt);
      }
      // voie de droite
      const lane = new THREE.Vector3(-this.dir.z, 0, this.dir.x).multiplyScalar(-3.4);
      this.car.position.copy(this.path).add(lane);
      this.pos.copy(this.car.position);
      this.car.rotation.y = Math.atan2(this.dir.x, this.dir.z);
      this.chest.copy(this.car.position).setY(1.2);
      // le joueur sur le toit frappe la voiture
      if (Math.random() < dt * 3) game.fx.smoke(this.car.position.clone().add(v(0, 0.5, 0)), '#666', 1, 0.8, 1);
      this.objective = `Arrête la voiture ! Frappe-la ou tire-lui dessus (R) — ${Math.max(0, Math.ceil(this.hp))}%`;
      if (dist > 320) {
        this.escapeT += dt;
        if (this.escapeT > 6) {
          this.failReason = 'Les braqueurs se sont échappés !';
          return 'fail';
        }
        this.objective = `Ils s'échappent ! Rattrape-les (${Math.ceil(6 - this.escapeT)} s)`;
      } else this.escapeT = 0;
      this.markers = [{ pos: this.car.position, color: '#ff4040', label: 'Voiture' }];
      if (Math.random() < dt * 0.4) game.audio.play('horn', 0.5);
      return 'running';
    }
    // combat après l'accident
    if (Math.random() < dt * 4) game.fx.smoke(this.car.position.clone().add(v(0, 1, 1.5)), '#333', 2.5, 2.5, 3);
    const n = this.aliveCount();
    this.objective = `Neutralise les braqueurs (${n} restant${n > 1 ? 's' : ''})`;
    this.markers = this.enemies.filter((e) => e.alive).map((e) => ({ pos: e.pos, color: '#ff4040', small: true }));
    if (n === 0) return 'success';
    return 'running';
  }
  cleanup(keep) {
    this.game.scene.remove(this.car);
    this.game.carTarget = null;
    this.items = this.items.filter((i) => i.kind !== 'mesh');
    super.cleanup(keep);
  }
}

// 4. Chute libre : rattraper des civils qui tombent d'un immeuble en feu
class FallingCivilians extends BaseMission {
  constructor(game, def) {
    super(game, def);
    this.b = def.building || game.city.landmarks.fire;
    this.onFire = def.fire !== false;
    this.center = v(this.b.x, 0, this.b.z);
    this.saved = 0;
    this.total = def.total || 4;
    this.falling = null;
    this.nextT = def.event ? 0.3 : 4;
    this.started = !!def.event;
    this.markers = [{ pos: this.center, color: '#ff8a3a', label: 'Incendie' }];
    this.objective = 'Rends-toi à l’immeuble en feu';
    this.fireT = 0;
  }
  _civ() {
    const m = {
      head: new THREE.MeshStandardMaterial({ color: '#e8b894' }),
      torso: new THREE.MeshStandardMaterial({ color: pick(['#d94f4f', '#4f7dd9', '#e0c040', '#6fcf6f']) }),
      pelvis: new THREE.MeshStandardMaterial({ color: '#333a55' }),
      upperArm: new THREE.MeshStandardMaterial({ color: '#e8b894' }),
      foreArm: new THREE.MeshStandardMaterial({ color: '#e8b894' }),
      hand: new THREE.MeshStandardMaterial({ color: '#e8b894' }),
      thigh: new THREE.MeshStandardMaterial({ color: '#333a55' }),
      shin: new THREE.MeshStandardMaterial({ color: '#333a55' }),
      foot: new THREE.MeshStandardMaterial({ color: '#222' }),
    };
    const rig = new Rig({ materials: m, kind: 'civ' });
    this.game.scene.add(rig.group);
    return rig;
  }
  _drop() {
    const b = this.b;
    const side = Math.floor(Math.random() * 4);
    const t = 0.2 + Math.random() * 0.6;
    let x;
    let z;
    let nx = 0;
    let nz = 0;
    if (side === 0) {
      x = b.fx0 + (b.fx1 - b.fx0) * t;
      z = b.fz0 - 1;
      nz = -1;
    } else if (side === 1) {
      x = b.fx1 + 1;
      z = b.fz0 + (b.fz1 - b.fz0) * t;
      nx = 1;
    } else if (side === 2) {
      x = b.fx0 + (b.fx1 - b.fx0) * t;
      z = b.fz1 + 1;
      nz = 1;
    } else {
      x = b.fx0 - 1;
      z = b.fz0 + (b.fz1 - b.fz0) * t;
      nx = -1;
    }
    const rig = this._civ();
    this.falling = { rig, pos: v(x, b.roof - 2, z), vy: 0, n: v(nx, 0, nz), t: 0, caught: false };
    this.game.hud.toast('Quelqu’un tombe ! Rattrape-le (touche-le ou tire une toile R) !');
    this.game.audio.play('sense');
  }
  update(dt) {
    const game = this.game;
    const p = game.player;
    this.fireT += dt;
    // feu et fumée
    const b = this.b;
    if (this.onFire && Math.random() < dt * 25) {
      const fx = b.fx0 + Math.random() * (b.fx1 - b.fx0);
      const fz = b.fz0 + Math.random() * (b.fz1 - b.fz0);
      const fy = b.roof * (0.5 + Math.random() * 0.5);
      game.fx.fire(v(fx, fy, Math.random() < 0.5 ? b.fz0 - 0.5 : b.fz1 + 0.5), 3);
      game.fx.smoke(v(fx, b.roof + 2, fz), '#2a2a2a', 6, 5, 6);
    }
    if (!this.started) {
      if (p.pos.distanceTo(this.center) < 110) {
        this.started = true;
        this.game.hud.hint('Des civils vont sauter des fenêtres ! Surveille le sens d’araignée et rattrape-les avant le sol.', 8);
      }
      return 'running';
    }
    this.objective = `Sauve les civils (${this.saved}/${this.total})`;
    this.markers = [{ pos: this.center, color: '#ff8a3a', label: 'Incendie' }];
    if (!this.falling) {
      this.nextT -= dt;
      if (this.nextT <= 0) this._drop();
      return 'running';
    }
    const f = this.falling;
    f.t += dt;
    if (!f.caught) {
      f.vy -= (this.slow ? 3.2 : 7) * dt; // chute « au ralenti » pour laisser une chance
      f.vy = Math.max(f.vy, this.slow ? -7 : -14);
      f.pos.y += f.vy * dt;
      f.rig.group.position.copy(f.pos);
      f.rig.apply(A.airborne(f.t), dt, 8);
      this.markers.push({ pos: f.pos, color: '#ffe14a', label: 'Au secours !' });
      const chest = f.pos.clone().setY(f.pos.y + 1);
      // touché par le joueur
      let caught = p.chestPos.distanceTo(chest) < 2.8;
      // ou toile récente
      for (const pr of game.projectiles.list) if (pr.kind === 'web' && pr.pos.distanceTo(chest) < 2.5) caught = true;
      if (caught) {
        f.caught = true;
        f.catchT = 0;
        this.saved++;
        game.audio.play('checkpoint');
        game.hud.toast(`Civil sauvé ! (${this.saved}/${this.total})`);
        game.webs.flash(p.chestPos.clone(), chest, 0.3);
        game.gainXP(40, 'Sauvetage');
        game.stat('rescues');
      } else if (f.pos.y <= 0.2) {
        this.failReason = 'Un civil n’a pas été rattrapé…';
        return 'fail';
      }
    } else {
      // descente en douceur, collé à une toile
      f.catchT += dt;
      f.pos.y = Math.max(0, f.pos.y - dt * 6);
      f.rig.group.position.copy(f.pos);
      f.rig.apply(f.pos.y > 0 ? A.webbed(f.t) : A.cheer(f.t), dt, 8);
      if (f.catchT > 3.5) {
        this.game.scene.remove(f.rig.group);
        this.falling = null;
        this.nextT = 3;
        if (this.saved >= this.total) return 'success';
      }
    }
    return 'running';
  }
  cleanup(keep) {
    if (this.falling) this.game.scene.remove(this.falling.rig.group);
    super.cleanup(keep);
  }
}

// 5. Bombes citrouilles à désamorcer sur les toits
class PumpkinBombs extends BaseMission {
  constructor(game, def) {
    super(game, def);
    const city = game.city;
    const rng = mulberry32(77);
    const center = city.blockCenter(7, 8);
    const roofs = city.buildings
      .filter((b) => b.roof > 25 && b.roof < 150 && Math.hypot(b.x - center.x, b.z - center.z) < 300 && b.x1 - b.x0 > 8)
      .sort(() => rng() - 0.5)
      .slice(0, 5);
    this.bombs = roofs.map((b) => {
      const pos = v(b.x, b.roof, b.z);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff4a00, emissiveIntensity: 1 }));
      mesh.position.copy(pos).setY(b.roof + 0.6);
      game.scene.add(mesh);
      const beam = this.beam(pos, '#ff8a1a', 60);
      return { pos, mesh, beam, done: false, prog: 0 };
    });
    this.timer = 170;
    this.objective = 'Désamorce les bombes citrouilles';
    game.audio.play('laugh');
    game.hud.hint('Le Bouffon a posé des bombes sur les toits ! Reste près de chaque bombe pour la désamorcer.', 8);
  }
  update(dt) {
    this.timer -= dt;
    const p = this.game.player;
    let left = 0;
    this.markers = [];
    for (const b of this.bombs) {
      if (b.done) continue;
      left++;
      b.mesh.material.emissiveIntensity = 0.6 + Math.sin(this.game.time * 8) * 0.5;
      this.markers.push({ pos: b.pos, color: '#ff8a1a', label: b.prog > 0 ? `${Math.floor(b.prog * 100)}%` : 'Bombe' });
      if (p.pos.distanceTo(b.pos) < 4.5) {
        b.prog += dt / 1.4;
        if (Math.random() < dt * 20) this.game.fx.electric(b.mesh.position, 2);
        if (b.prog >= 1) {
          b.done = true;
          this.game.scene.remove(b.mesh);
          this.game.markers.remove(b.beam);
          this.game.audio.play('checkpoint');
          this.game.hud.toast('Bombe désamorcée !');
          this.timer += 10;
        }
      } else b.prog = Math.max(0, b.prog - dt * 0.5);
    }
    this.objective = `Désamorce les bombes citrouilles (${this.bombs.length - left}/${this.bombs.length})`;
    if (left === 0) return 'success';
    if (this.timer <= 0) {
      for (const b of this.bombs) if (!b.done) this.game.fx.explosion(b.mesh.position, 2);
      this.game.audio.play('explosion');
      this.failReason = 'Les bombes ont explosé !';
      return 'fail';
    }
    return 'running';
  }
  cleanup(keep) {
    for (const b of this.bombs) this.game.scene.remove(b.mesh);
    super.cleanup(keep);
  }
}

// 7. Boss final
class BossFight extends BaseMission {
  constructor(game, def) {
    super(game, def);
    this.arena = def.arena(game);
    this.started = false;
    this.markers = [{ pos: this.arena.pos, color: def.color || '#6fff6f', label: this.arena.label }];
    this.objective = def.approach;
  }
  _inArena(p) {
    const a = this.arena;
    const h = Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z);
    if (a.ground) return h < 45 && p.pos.y < a.pos.y + 12;
    return p.pos.y > a.pos.y - 2 && h < a.radius;
  }
  update(dt) {
    const game = this.game;
    const p = game.player;
    const a = this.arena;
    if (!this.started) {
      if (this._inArena(p)) {
        this.started = true;
        const kind = this.def.boss;
        this.boss = kind === 'rhino' ? new Rhino(game, a.pos) : new Boss(game, a.pos, a.pos.y, kind);
        game.boss = this.boss;
        this.boss.onPhase2 = () => {
          const c = a.pos.clone().add(v(8, 0, 8));
          this.spawnWave(c, this.def.minions || ['voyou', 'voyou', 'tireur'], 5, { aggro: true, leash: 22 });
        };
        game.audio.play(kind === 'rhino' ? 'heavy' : 'laugh');
        game.hud.bossBar(this.boss);
        game.hud.hint(this.def.fightHint, 11);
      }
      return 'running';
    }
    const b = this.boss;
    this.markers = [{ pos: b.pos, color: this.def.color || '#6fff6f', label: b.name }];
    const near = a.ground ? p.pos.distanceTo(b.pos) < 90 : p.pos.y > a.pos.y - 30;
    this.objective = near ? `Vaincs ${b.name.replace(/^Le /, 'le ')}` : this.def.returnText;
    if (!b.alive && b.state === 'defeated' && b.stateT > 2.5) return 'success';
    return 'running';
  }
  cleanup(keep) {
    if (this.boss) {
      this.boss.dispose();
      this.game.boss = null;
      this.game.hud.bossBar(null);
    }
    super.cleanup(keep);
  }
}

// Toit le plus vaste d'une zone (arènes et bases)
function bigRoof(city, filter) {
  let best = null;
  let area = 0;
  for (const b of city.buildings) {
    if (!filter(b)) continue;
    const a = (b.x1 - b.x0) * (b.z1 - b.z0);
    if (a > area) {
      area = a;
      best = b;
    }
  }
  return best;
}

export const STORY = [
  {
    id: 'tuto',
    title: 'Premiers balancements',
    intro: 'Peter, la ville a besoin de toi. Commence par te dégourdir les toiles au-dessus de Manhattan !',
    where: (g) => g.city.intersection(6, 10).setY(0),
    create: (g, d) => new SwingTutorial(g, d),
    xp: 200,
  },
  {
    id: 'braquage',
    title: 'Braquage à la banque',
    intro: 'Des braqueurs attaquent la banque de la 3e avenue. Montre-leur à qui ils ont affaire !',
    where: (g) => {
      const b = g.city.landmarks.bank;
      return v(b.x, 0, b.fz0 - 12);
    },
    create: (g, d) => new WaveFight(g, d),
    approach: 'Rends-toi à la banque',
    fightText: 'Arrête les braqueurs',
    waves: [
      ['voyou', 'voyou', 'voyou', 'voyou'],
      ['voyou', 'voyou', 'tireur', 'tireur'],
    ],
    hints: [
      'Clic gauche / J : attaquer (maintiens pour projeter en l’air). Clic droit / C : esquiver quand le sens d’araignée s’active !',
      'Les tireurs restent à distance : F pour foncer sur eux (frappe-toile), R pour les entoiler.',
    ],
    xp: 300,
  },
  {
    id: 'poursuite',
    title: 'Course-poursuite',
    intro: 'Les complices du braquage fuient en voiture. Rattrape-les en te balançant !',
    where: (g) => g.city.intersection(2, 12).setY(0),
    create: (g, d) => new CarChase(g, d),
    xp: 350,
  },
  {
    id: 'incendie',
    title: 'Chute libre',
    intro: 'Un immeuble est en feu ! Des habitants sont piégés et vont sauter. Sauve-les !',
    where: (g) => {
      const b = g.city.landmarks.fire;
      return v(b.x, 0, b.z);
    },
    create: (g, d) => new FallingCivilians(g, d),
    xp: 400,
  },
  {
    id: 'bombes',
    title: 'Bombes citrouilles',
    intro: 'Le Bouffon Vert a piégé les toits du centre-ville. Désamorce ses bombes avant l’explosion !',
    where: (g) => g.city.blockCenter(7, 8).setY(0),
    create: (g, d) => new PumpkinBombs(g, d),
    xp: 450,
  },
  {
    id: 'assaut',
    title: 'L’assaut d’Oscorp',
    intro: 'Les hommes de main du Bouffon protègent la tour Oscorp. Fraye-toi un chemin !',
    where: (g) => {
      const o = g.city.landmarks.oscorp;
      return v(o.x, 0, o.z + 42);
    },
    create: (g, d) => new WaveFight(g, d),
    approach: 'Rends-toi au pied de la tour Oscorp',
    fightText: 'Repousse l’armée du Bouffon',
    waves: [
      ['voyou', 'voyou', 'voyou', 'voyou', 'voyou'],
      ['costaud', 'tireur', 'tireur', 'voyou'],
      ['costaud', 'costaud', 'voyou', 'voyou', 'tireur', 'tireur'],
    ],
    hints: [
      'Change de style de combat avec 1-2-3-4 : Classique, Acrobate, Brute, Tisseur !',
      'Les costauds bloquent les coups de face : utilise le style Brute (3), la frappe-toile (F) ou entoile-les (R).',
      'Utilise tes gadgets (G, changer avec T) et ta concentration : H pour te soigner, V pour un coup de grâce.',
    ],
    hpMul: 1.1,
    xp: 600,
  },
  {
    id: 'bouffon',
    title: 'Le Bouffon Vert',
    intro: 'C’est l’heure de l’affrontement. Le Bouffon Vert t’attend au sommet de la tour Oscorp.',
    where: (g) => {
      const o = g.city.landmarks.oscorp;
      return v(o.x, 0, o.z + 42);
    },
    create: (g, d) => new BossFight(g, d),
    boss: 'bouffon',
    arena: (g) => {
      const o = g.city.landmarks.oscorp;
      return { pos: v(o.x, o.roof, o.z), radius: 30, label: 'Oscorp' };
    },
    approach: 'Rejoins le sommet de la tour Oscorp',
    returnText: 'Retourne au sommet de la tour Oscorp !',
    fightHint: 'Tire des toiles (R) sur le planeur pour le faire tomber, puis frappe le Bouffon ! Esquive les bombes.',
    outro: 'Le Bouffon Vert est vaincu… mais un monstre blindé, le Rhino, sème déjà la panique dans le quartier financier !',
    xp: 1000,
    skillPoint: true,
  },
  {
    id: 'rhino',
    title: 'La charge du Rhino',
    intro: 'Le Rhino ravage le quartier financier. Esquive ses charges pour qu’il percute les murs, puis frappe-le quand il est sonné !',
    where: (g) => g.city.intersection(3, 11).setY(0),
    create: (g, d) => new BossFight(g, d),
    boss: 'rhino',
    color: '#c0c4c8',
    arena: (g) => ({ pos: g.city.intersection(2, 11).setY(0), ground: true, label: 'Rhino' }),
    approach: 'Trouve le Rhino dans le quartier financier',
    returnText: 'Retourne affronter le Rhino !',
    fightHint: 'Ses coups de face sont bloqués : esquive sa charge (clic droit / C) pour qu’il fonce dans un mur, puis cogne ! La toile le ralentit.',
    minions: ['voyou', 'costaud', 'voyou'],
    outro: 'Le Rhino est à terre ! Mais au-dessus du pont, un homme ailé attaque les toits : le Vautour…',
    xp: 900,
    skillPoint: true,
  },
  {
    id: 'vautour',
    title: 'Les ailes du Vautour',
    intro: 'Le Vautour terrorise les toits près du pont de l’Est. Englue ses ailes avec ta toile pour le faire tomber !',
    where: (g) => {
      const b = vultureRoof(g.city);
      return v(b.x, 0, b.z);
    },
    create: (g, d) => new BossFight(g, d),
    boss: 'vautour',
    color: '#9acb6a',
    arena: (g) => {
      const b = vultureRoof(g.city);
      return { pos: v(b.x, b.roof, b.z), radius: 34, label: 'Toit du Vautour' };
    },
    approach: 'Monte sur le toit où rôde le Vautour',
    returnText: 'Retourne sur le toit du Vautour !',
    fightHint: 'Tire 5 toiles (R) sur le Vautour pour engluer ses ailes. Esquive ses plumes d’acier et ses piqués !',
    minions: ['tireur', 'voyou', 'tireur'],
    outro: 'Le Vautour est tombé. New York est sauvée… pour l’instant ! La ville reste ouverte : bases ennemies, crimes, défis et costumes t’attendent.',
    xp: 1200,
    skillPoint: true,
  },
];

function vultureRoof(city) {
  return bigRoof(city, (b) => b.bi >= 11 && b.bj >= 5 && b.bj <= 9 && b.roof > 30 && b.roof < 110 && !b.role) || city.landmarks.bugle;
}

// ---------- Bases ennemies (toits) ----------
function baseDefs(city) {
  const zones = [
    { name: 'Base du Nord', f: (b) => b.bj <= 2 && b.bi >= 8 },
    { name: 'Entrepôt de Chinatown', f: (b) => b.bj >= 11 && b.bi >= 7 },
    { name: 'Repaire de l’Ouest', f: (b) => b.bi <= 2 && b.bj >= 3 && b.bj <= 8 },
  ];
  return zones.map((z, k) => {
    const b = bigRoof(city, (x) => z.f(x) && x.roof > 18 && x.roof < 70 && !x.role) || city.buildings[k * 50];
    return {
      id: `base${k}`,
      title: z.name,
      intro: 'Des hommes de main du Bouffon ont installé une base sur ce toit. Démantèle-la !',
      where: () => v(b.x, b.roof, b.z),
      roof: b,
      approach: 'Monte sur le toit de la base',
      fightText: 'Démantèle la base',
      waves: [
        ['voyou', 'voyou', 'voyou', 'tireur'],
        ['voyou', 'costaud', 'tireur', 'tireur', 'voyou'],
        ['costaud', 'costaud', 'voyou', 'voyou', 'tireur', 'tireur'],
      ],
      hpMul: 1.15,
      xp: 500,
    };
  });
}

// ---------- Activités secondaires ----------
class StreetCrime extends BaseMission {
  constructor(game, pos, level) {
    super(game, { id: 'crime', title: 'Crime en cours' });
    this.center = pos;
    const pool = level < 3 ? ['voyou', 'voyou', 'voyou', 'tireur'] : ['voyou', 'voyou', 'tireur', 'costaud', 'voyou'];
    const n = Math.min(6, 3 + Math.floor(level / 2));
    const types = [];
    for (let k = 0; k < n; k++) types.push(pool[Math.floor(Math.random() * pool.length)]);
    this.spawnWave(pos, types, 7, { leash: 35 });
    this.beamItem = this.beam(pos, '#ff3030', 90);
    this.engaged = false;
  }
  update() {
    const n = this.aliveCount();
    if (n === 0) return 'success';
    if (!this.engaged && this.game.player.pos.distanceTo(this.center) < 40) {
      this.engaged = true;
      this.game.markers.remove(this.beamItem);
    }
    return 'running';
  }
}

function randomChase(game) {
  const { i, j } = game.city.randomIntersectionNear(game.player.pos, 120, 320);
  const m = new CarChase(game, { id: 'evt-chase', title: 'Poursuite', start: { i: Math.max(1, Math.min(N - 2, i)), j } });
  m.kind = 'chase';
  Object.defineProperty(m, 'center', { get: () => m.pos });
  return m;
}

function randomFall(game) {
  const p = game.player.pos;
  const cands = game.city.buildings.filter((b) => b.fx0 !== undefined && b.roof > 35 && b.roof < 140 && Math.hypot(b.x - p.x, b.z - p.z) > 60 && Math.hypot(b.x - p.x, b.z - p.z) < 180);
  if (!cands.length) return null;
  const b = cands[Math.floor(Math.random() * cands.length)];
  const m = new FallingCivilians(game, { id: 'evt-fall', title: 'Chute', building: b, total: 1, fire: false, event: true });
  m.kind = 'fall';
  // chute plus lente pour laisser le temps d'arriver
  m.slow = true;
  Object.defineProperty(m, 'center', { get: () => (m.falling ? m.falling.pos : m.centerPos) });
  m.centerPos = v(b.x, b.roof, b.z);
  return m;
}

class Race {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.index = 0;
    this.t = 0;
    this.items = [];
    this.objective = '';
    this.markers = [];
    this.timer = null;
    this._ring();
  }
  _ring() {
    for (const i of this.items) this.game.markers.remove(i);
    this.items = [];
    const p = this.def.points[this.index];
    const next = this.def.points[this.index + 1] || p;
    this.items.push(this.game.markers.ring(p, Math.atan2(next.x - p.x, next.z - p.z), '#ffe14a'));
    this.markers = [{ pos: p, color: '#ffe14a', label: `${this.index + 1}/${this.def.points.length}` }];
  }
  update(dt) {
    this.t += dt;
    this.objective = `Défi de vitesse : ${formatTime(this.t)} (or < ${formatTime(this.def.gold)})`;
    const p = this.def.points[this.index];
    if (this.game.player.chestPos.distanceTo(p) < 7) {
      this.game.audio.play('checkpoint');
      this.index++;
      if (this.index >= this.def.points.length) return 'success';
      this._ring();
    }
    if (this.t > this.def.gold * 3) return 'fail';
    return 'running';
  }
  cleanup() {
    for (const i of this.items) this.game.markers.remove(i);
  }
}

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.save = game.save;
    this.active = null;
    this.activeDef = null;
    this.crimes = []; // événements libres : crimes, poursuites, chutes
    this.crimeTimer = 25;
    this.storyBeam = null;
    this.bags = [];
    this.races = [];
    this.raceBeams = [];
    this.bases = [];
  }

  get storyCount() {
    return STORY.length;
  }

  init() {
    this._setupBags();
    this._setupRaces();
    this._setupBases();
    this._refreshStoryMarker();
  }

  get storyIndex() {
    return this.save.completed.length;
  }

  get nextStory() {
    return STORY.find((s) => !this.save.completed.includes(s.id)) || null;
  }

  _refreshStoryMarker() {
    if (this.storyBeam) this.game.markers.remove(this.storyBeam);
    this.storyBeam = null;
    const s = this.nextStory;
    if (s && !this.active) {
      this.storyPos = s.where(this.game);
      this.storyBeam = this.game.markers.beam(this.storyPos, '#ffd23f', 180, 3);
    }
  }

  _setupBags() {
    const city = this.game.city;
    const rng = mulberry32(2002);
    const cands = city.buildings.filter((b) => b.roof > 15 && b.x1 - b.x0 > 6 && b.z1 - b.z0 > 6);
    const chosen = [];
    for (let k = 0; k < 400 && chosen.length < 20; k++) {
      const b = cands[Math.floor(rng() * cands.length)];
      if (chosen.some((c) => Math.hypot(c.x - b.x, c.z - b.z) < 120)) continue;
      chosen.push(b);
    }
    chosen.forEach((b, i) => {
      const id = `sac${i}`;
      if (this.save.bags.includes(id)) return;
      const pos = v(b.x0 + 2 + rng() * (b.x1 - b.x0 - 4), b.roof, b.z0 + 2 + rng() * (b.z1 - b.z0 - 4));
      const item = this.game.markers.backpack(pos);
      this.bags.push({ id, pos, item });
    });
    this.totalBags = chosen.length;
  }

  _setupRaces() {
    const city = this.game.city;
    const mk = (pts) => pts.map(([i, j, h]) => city.intersection(i, j).setY(h));
    this.races = [
      { id: 'course1', title: 'Défi : Traversée de Midtown', gold: 45, points: mk([[9, 7, 30], [9, 5, 40], [9, 3, 55], [11, 3, 50], [12, 5, 35], [12, 8, 30]]) },
      { id: 'course2', title: 'Défi : Grand tour du parc', gold: 55, points: mk([[4, 3, 25], [5, 2, 30], [7, 2, 28], [8, 4, 30], [8, 7, 30], [7, 8, 25], [5, 8, 25], [4, 6, 25]]) },
      { id: 'course3', title: 'Défi : Plongeon financier', gold: 50, points: mk([[1, 9, 60], [2, 10, 45], [3, 11, 35], [3, 13, 25], [5, 13, 20], [6, 12, 30]]) },
    ];
    for (const r of this.races) {
      const b = this.game.markers.beam(r.points[0].clone().setY(0), '#ffe14a', 70, 1.6);
      this.raceBeams.push(b);
      r.beam = b;
    }
  }

  _setupBases() {
    this.save.bases = this.save.bases || [];
    this.baseDefs = baseDefs(this.game.city);
    for (const d of this.baseDefs) {
      if (this.save.bases.includes(d.id)) continue;
      const pos = d.where();
      const beam = this.game.markers.beam(pos, '#b04dff', 90, 2.2);
      // caisses et drapeau sur le toit
      const grp = new THREE.Group();
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.9 });
      for (let k = 0; k < 6; k++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), crateMat);
        c.position.set((k % 3) * 1.3 - 5, 0.6 + (k > 2 ? 1.2 : 0), -5 + Math.floor(k / 3) * 0.1);
        c.rotation.y = k * 0.3;
        c.castShadow = true;
        grp.add(c);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      pole.position.set(4, 2, 4);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: 0x5b2a7a, side: THREE.DoubleSide }));
      flag.position.set(4.8, 3.4, 4);
      grp.add(pole, flag);
      grp.position.copy(pos);
      this.game.scene.add(grp);
      this.bases.push({ def: d, pos, beam, grp });
    }
  }

  // Points d'intérêt pour la mini-carte et le HUD
  getPOIs() {
    const out = [];
    if (this.active) {
      for (const m of this.active.markers) out.push({ ...m, active: true });
      return out;
    }
    const s = this.nextStory;
    if (s) out.push({ pos: this.storyPos, color: '#ffd23f', label: s.title, icon: '★', story: true });
    for (const c of this.crimes) {
      const label = c.kind === 'chase' ? 'Poursuite' : c.kind === 'fall' ? 'Au secours !' : 'Crime';
      out.push({ pos: c.center, color: c.kind === 'fall' ? '#ffe14a' : '#ff3030', label, icon: c.kind === 'chase' ? '🚗' : '!' });
    }
    for (const b of this.bases) out.push({ pos: b.pos, color: '#b04dff', label: b.def.title, icon: '⚑', far: true });
    for (const r of this.races) out.push({ pos: r.points[0], color: '#ffe14a', label: r.title.replace('Défi : ', ''), icon: '⏱', race: true, far: true });
    for (const b of this.bags) out.push({ pos: b.pos, color: '#cfcfcf', icon: '◆', bag: true });
    const found = this.save.stations || [];
    for (const st of this.game.city.stations) {
      const known = found.includes(st.key);
      out.push({ pos: st.pos, color: known ? '#3dff7a' : '#6b7a70', icon: 'M', station: true, bag: !known, label: known ? st.name : '' });
    }
    return out;
  }

  canStart() {
    return !this.active && !this.game.combat.inCombat;
  }

  // Mission proposée si le joueur est dans la zone de départ
  nearbyStart() {
    if (!this.canStart()) return null;
    const p = this.game.player.pos;
    const s = this.nextStory;
    if (s && this.storyPos && Math.hypot(p.x - this.storyPos.x, p.z - this.storyPos.z) < 14) return { kind: 'story', def: s, title: s.title };
    for (const r of this.races) {
      const st = r.points[0];
      if (Math.hypot(p.x - st.x, p.z - st.z) < 12) return { kind: 'race', def: r, title: r.title };
    }
    for (const b of this.bases) {
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 18 && p.y > b.pos.y - 3) return { kind: 'base', def: b.def, title: b.def.title };
    }
    return null;
  }

  start(entry) {
    const g = this.game;
    this.kind = entry.kind;
    this.activeDef = entry.def;
    if (entry.kind === 'story') {
      this.active = entry.def.create(g, entry.def);
      g.hud.missionIntro(entry.def.title, entry.def.intro);
    } else if (entry.kind === 'base') {
      this.active = new WaveFight(g, entry.def);
      g.hud.missionIntro(entry.def.title, entry.def.intro);
    } else {
      this.active = new Race(g, entry.def);
      g.hud.missionIntro(entry.def.title, `Traverse les anneaux le plus vite possible. Or : ${formatTime(entry.def.gold)}`);
    }
    if (this.storyBeam) {
      g.markers.remove(this.storyBeam);
      this.storyBeam = null;
    }
    for (const b of this.raceBeams) b.mesh.visible = false;
    for (const b of this.bases) b.beam.mesh.visible = false;
    // les événements en cours disparaissent pendant une mission
    for (const c of this.crimes) c.cleanup();
    this.crimes = [];
    g.audio.play('mission', 0.6);
  }

  abandon() {
    if (!this.active) return;
    this._end('abandon');
  }

  retry() {
    const def = this.lastFailed;
    if (!def) return;
    this.start(def);
  }

  _end(result) {
    const g = this.game;
    const def = this.activeDef;
    const kind = this.kind;
    const mission = this.active;
    mission.cleanup(result === 'success');
    this.active = null;
    this.activeDef = null;
    for (const b of this.raceBeams) b.mesh.visible = true;
    for (const b of this.bases) b.beam.mesh.visible = true;
    if (result === 'success') {
      if (kind === 'story') {
        if (!this.save.completed.includes(def.id)) {
          this.save.completed.push(def.id);
          if (def.skillPoint) {
            this.save.skillPoints++;
            g.hud.toast('+1 point de compétence (menu Pause > Compétences)', 'xp');
          }
        }
        g.gainXP(def.xp, def.title);
        g.hud.missionComplete(def.title, def.xp, STORY.indexOf(def) === STORY.length - 1, def.outro);
        g.refreshStats();
      } else if (kind === 'base') {
        if (!this.save.bases.includes(def.id)) this.save.bases.push(def.id);
        this.save.skillPoints++;
        const b = this.bases.find((x) => x.def === def);
        if (b) {
          g.markers.remove(b.beam);
          g.scene.remove(b.grp);
          this.bases = this.bases.filter((x) => x !== b);
        }
        g.gainXP(def.xp, def.title);
        g.hud.missionComplete(`${def.title} démantelée !`, def.xp, false, '+1 point de compétence');
      } else {
        const t = mission.t;
        const best = this.save.races[def.id];
        if (!best || t < best) this.save.races[def.id] = t;
        const medal = t <= def.gold ? 'OR' : t <= def.gold * 1.3 ? 'ARGENT' : 'BRONZE';
        if (medal === 'OR') {
          this.save.gold = this.save.gold || [];
          if (!this.save.gold.includes(def.id)) this.save.gold.push(def.id);
        }
        const xp = medal === 'OR' ? 250 : medal === 'ARGENT' ? 150 : 80;
        g.gainXP(xp, def.title);
        g.hud.missionComplete(`${def.title} — ${formatTime(t)} (${medal})`, xp, false);
      }
      g.audio.play('mission');
      g.saveGame();
    } else if (result === 'fail') {
      this.lastFailed = { kind, def };
      g.hud.missionFailed(def.title, mission.failReason || 'Mission échouée');
      g.audio.play('fail');
    }
    this._refreshStoryMarker();
  }

  onPlayerDeath() {
    if (this.active) {
      this.active.failReason = 'Tu as été mis K.O.';
      this._end('fail');
    }
  }

  // Nouvel événement libre : crime (le plus souvent), poursuite ou chute
  _spawnEvent() {
    const g = this.game;
    const p = g.player;
    const r = Math.random();
    let e = null;
    if (r < 0.2 && !g.carTarget && !this.crimes.some((c) => c.kind === 'chase')) {
      e = randomChase(g);
      g.hud.toast('Des voleurs s’enfuient en voiture ! (icône voiture)');
    } else if (r < 0.38 && !this.crimes.some((c) => c.kind === 'fall')) {
      e = randomFall(g);
      if (e) g.hud.toast('Un laveur de vitres est tombé ! Vite, rattrape-le !');
    }
    if (!e) {
      const { p: pos } = g.city.randomIntersectionNear(p.pos, 150, 420);
      e = new StreetCrime(g, pos, g.save.level);
      e.kind = 'crime';
      g.hud.toast('Crime signalé à proximité ! (marqueur rouge)');
    }
    this.crimes.push(e);
    g.audio.play('sense', 0.5);
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (this.active) {
      const r = this.active.update(dt);
      if (r === 'success' || r === 'fail') this._end(r);
    } else {
      this.crimeTimer -= dt;
      if (this.crimeTimer <= 0 && this.crimes.length < 2) {
        this.crimeTimer = 40 + Math.random() * 30;
        this._spawnEvent();
      }
      for (const c of this.crimes) {
        const r = c.update(dt);
        if (r === 'success') {
          c.done = true;
          c.cleanup(true);
          if (c.kind === 'fall') {
            g.hud.toast('Civil sauvé !');
          } else {
            const xp = c.kind === 'chase' ? 200 : 100;
            g.gainXP(xp, c.kind === 'chase' ? 'Voleurs arrêtés' : 'Crime arrêté');
            g.save.crimes = (g.save.crimes || 0) + 1;
          }
          g.audio.play('checkpoint');
          g.saveGame();
        } else if (r === 'fail') {
          c.done = true;
          c.cleanup();
          g.hud.toast(c.kind === 'fall' ? 'Trop tard… les secours s’en occupent.' : 'Ils se sont échappés…');
        } else if (p.pos.distanceTo(c.center) > 800) {
          c.done = true;
          c.cleanup();
        }
      }
      this.crimes = this.crimes.filter((c) => !c.done);
    }
    // Sacs à dos
    for (const b of this.bags) {
      if (b.taken) continue;
      if (p.pos.distanceTo(b.pos) < 2.5) {
        b.taken = true;
        g.markers.remove(b.item);
        this.save.bags.push(b.id);
        g.gainXP(50, 'Sac à dos');
        g.hud.toast(`Sac à dos retrouvé ! (${this.save.bags.length}/${this.totalBags})`);
        g.audio.play('coin');
        g.saveGame();
      }
    }
    this.bags = this.bags.filter((b) => !b.taken);
    // Stations de métro
    this.save.stations = this.save.stations || [];
    for (const st of g.city.stations) {
      if (this.save.stations.includes(st.key)) continue;
      if (Math.hypot(p.pos.x - st.pos.x, p.pos.z - st.pos.z) < 26 && p.pos.y < 30) {
        this.save.stations.push(st.key);
        g.hud.toast(`Station de métro découverte : ${st.name} — voyage rapide depuis la carte (Tab)`, 'xp');
        g.audio.play('coin');
        g.saveGame();
      }
    }
  }
}
