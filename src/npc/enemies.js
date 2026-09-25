import * as THREE from 'three';
import { Rig } from '../player/rig.js';
import * as A from '../player/anims.js';
import { clamp, damp, angleLerp, pick, rand } from '../engine/utils.js';

export const ENEMY_TYPES = {
  voyou: {
    name: 'Voyou',
    hp: 55,
    speed: 5.8,
    scale: 1,
    bulk: 1,
    range: 2.0,
    windup: 0.55,
    dmg: 8,
    anim: 'thugPunch',
    kind: 'hit',
    webMax: 3,
    xp: 20,
  },
  tireur: {
    name: 'Tireur',
    hp: 40,
    speed: 5.2,
    scale: 1,
    bulk: 0.95,
    ranged: true,
    windup: 0.85,
    dmg: 7,
    webMax: 2,
    xp: 25,
  },
  costaud: {
    name: 'Costaud',
    hp: 170,
    speed: 4.0,
    scale: 1.28,
    bulk: 1.45,
    range: 2.8,
    windup: 0.95,
    dmg: 18,
    anim: 'bruteSmash',
    kind: 'heavy',
    guard: true,
    webMax: 6,
    xp: 60,
  },
};

const JACKETS = ['#3b3f46', '#5a2a2a', '#2f4a3a', '#6b5a3a', '#2a2f4f', '#4a4a4a', '#7a3b1f'];
const PANTS = ['#1f2530', '#2b2b2b', '#3a3f55', '#4a3b2b'];
const SKINS = ['#f1c7a5', '#d9a07a', '#a86e4a', '#6b4430', '#e8b894'];

function enemyMaterials(type) {
  const std = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const jacket = type === 'costaud' ? '#26262a' : pick(JACKETS);
  const pants = pick(PANTS);
  const skin = pick(SKINS);
  const m = {
    head: std(skin, 0.7),
    torso: std(jacket),
    pelvis: std(pants),
    upperArm: std(type === 'costaud' ? skin : jacket),
    foreArm: std(type === 'costaud' ? skin : jacket),
    hand: std(skin, 0.7),
    thigh: std(pants),
    shin: std(pants),
    foot: std('#151515', 0.6),
  };
  return m;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Enemy {
  constructor(manager, type, pos, opts = {}) {
    this.manager = manager;
    this.game = manager.game;
    this.typeKey = type;
    this.type = ENEMY_TYPES[type];
    this.maxHp = this.type.hp * (opts.hpMul || 1);
    this.hp = this.maxHp;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.facing = Math.random() * Math.PI * 2;
    this.state = opts.aggro ? 'approach' : 'idle';
    this.stateT = 0;
    this.attackCd = rand(0.8, 2.2);
    this.web = 0;
    this.webDecay = 0;
    this.groundY = this.game.city.groundHeight(pos.x, pos.z, pos.y + 0.5);
    this.pos.y = this.groundY;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.desired = this.type.ranged ? rand(11, 16) : rand(2.6, 4.2);
    this.alive = true;
    this.removeT = 0;
    this.mission = opts.mission || null;
    this.home = opts.home ? opts.home.clone() : pos.clone();
    this.leash = opts.leash || 60;
    this.t = Math.random() * 10;
    this.mats = enemyMaterials(type);
    this.rig = new Rig({ materials: this.mats, scale: this.type.scale, bulk: this.type.bulk, kind: 'enemy' });
    this._decorate();
    this.game.scene.add(this.rig.group);
    this.chest = new THREE.Vector3();
    this.hitFlash = 0;
    this.isEnemy = true;
    this.radius = 0.45 * this.type.scale;
    this.fallStart = this.pos.y;
  }

  _decorate() {
    const head = this.rig.j.head;
    const t = this.typeKey;
    if (t === 'voyou' || (t === 'tireur' && Math.random() < 0.5)) {
      // bonnet
      const hat = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: pick(['#1a1a1a', '#6b1d1d', '#1d3b6b', '#2e2e2e']), roughness: 0.9 }),
      );
      hat.position.y = 0.12;
      hat.scale.set(0.95, 0.9, 1.0);
      head.add(hat);
    }
    // masque sur les yeux (bandits)
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    mask.position.set(0, 0.1, 0.1);
    head.add(mask);
    if (t === 'tireur') {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.6, roughness: 0.4 }));
      gun.position.set(0, -0.3, 0.1);
      this.rig.j.rElbow.add(gun);
      this.gun = gun;
    }
    if (t === 'costaud') {
      // plaques de protection
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x3b4450, metalness: 0.5, roughness: 0.4 }));
      plate.position.set(0, 0.1, 0.03);
      this.rig.j.chest.add(plate);
    }
    // cocon de toile (visible si l'ennemi est emmailloté)
    const cocoon = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 1.2, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.9, transparent: true, opacity: 0.92 }),
    );
    cocoon.position.y = 0.95;
    cocoon.visible = false;
    this.rig.group.add(cocoon);
    this.cocoon = cocoon;
  }

  get targetable() {
    return this.alive && this.state !== 'dead';
  }

  get vulnerableAir() {
    return this.state === 'air';
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  // Coup reçu
  hit(info) {
    if (!this.alive || this.state === 'dead') return { killed: false, blocked: false };
    const player = this.game.player;
    let dmg = info.dmg;
    let blocked = false;
    if (
      this.type.guard &&
      !info.breakGuard &&
      !['stagger', 'air', 'down', 'webbed'].includes(this.state) &&
      info.source === 'melee'
    ) {
      const toP = _v.subVectors(player.pos, this.pos).setY(0).normalize();
      const f = _v2.set(Math.sin(this.facing), 0, Math.cos(this.facing));
      if (toP.dot(f) > 0.2) {
        blocked = true;
        dmg *= 0.25;
      }
    }
    if (this.state === 'webbed') dmg *= 1.5;
    this.hp -= dmg;
    this.hitFlash = 0.12;
    this.manager.lastHitTime = this.game.time;
    if (info.web) this.addWeb(info.web);
    if (blocked) {
      this.game.audio.play('block');
      this.game.hud.floatText(this.chest, 'BLOQUÉ', '#9ab');
      this.facing = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      if (this.hp > 0) return { killed: false, blocked: true };
    }
    if (this.hp <= 0) {
      this._die(info);
      return { killed: true, blocked };
    }
    if (this.state === 'webbed') return { killed: false, blocked };
    const dir = info.dir || _v.subVectors(this.pos, player.pos).setY(0).normalize();
    const resist = this.typeKey === 'costaud' && !info.breakGuard ? 0.35 : 1;
    if (info.launch && (this.typeKey !== 'costaud' || info.breakGuard)) {
      this.vel.set(dir.x * (info.knock || 1), info.launch, dir.z * (info.knock || 1));
      this.setState('air');
    } else if (this.state === 'air') {
      // jonglage aérien
      this.vel.set(dir.x * 1.5, Math.max(this.vel.y, info.airLift || 3.5), dir.z * 1.5);
      this.stateT = 0;
    } else if ((info.knock || 0) * resist > 9) {
      this.vel.set(dir.x * info.knock * resist, 4, dir.z * info.knock * resist);
      this.setState('air');
      this.knockdown = true;
    } else {
      this.vel.set(dir.x * (info.knock || 2) * resist, 0, dir.z * (info.knock || 2) * resist);
      this.setState('stagger');
      this.staggerDur = (info.stagger || 0.45) * resist;
    }
    this.facing = Math.atan2(-dir.x, -dir.z);
    return { killed: false, blocked };
  }

  addWeb(n) {
    this.web += n;
    this.webDecay = 4;
    if (this.web >= this.type.webMax && this.state !== 'webbed') {
      this.setState('webbed');
      this.webbedT = 7;
      this.cocoon.visible = true;
      this.cocoon.scale.set(this.type.bulk, 1, this.type.bulk);
      this.game.audio.play('webshot');
      this.game.hud.floatText(this.chest, 'ENTOILÉ !', '#ffffff');
    }
  }

  _die(info) {
    this.hp = 0;
    this.alive = false;
    const dir = info.dir || _v.subVectors(this.pos, this.game.player.pos).setY(0).normalize();
    if (this.state === 'webbed') {
      this.setState('dead');
    } else {
      const k = Math.max(6, info.knock || 6);
      this.vel.set(dir.x * k, Math.max(5, info.launch || 5), dir.z * k);
      this.setState('air');
      this.dying = true;
    }
    this.manager.onDefeated(this);
  }

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.hitFlash -= dt;
    const player = this.game.player;
    const city = this.game.city;
    const toP = _v.subVectors(player.pos, this.pos);
    toP.y = 0;
    const dist = toP.length();
    if (dist > 0.001) toP.multiplyScalar(1 / dist);
    const faceP = Math.atan2(toP.x, toP.z);
    if (this.webDecay > 0) {
      this.webDecay -= dt;
      if (this.webDecay <= 0 && this.state !== 'webbed') this.web = 0;
    }
    let pose;
    let blend = 12;
    let move = false;
    const T = this.type;

    switch (this.state) {
      case 'idle': {
        pose = Math.sin(this.t * 0.7) > 0.6 ? A.cheer(this.t) : A.idle(this.t);
        const aggroR = this.manager.alerted ? 80 : 28;
        if (dist < aggroR && Math.abs(player.pos.y - this.pos.y) < 25) {
          this.setState('approach');
          this.manager.alert();
        }
        break;
      }
      case 'approach':
      case 'strafe': {
        this.attackCd -= dt;
        const want = this.desired;
        let mx = 0;
        let mz = 0;
        if (dist > want + 1.5) {
          mx = toP.x;
          mz = toP.z;
        } else if (dist < want - 1.5 && T.ranged) {
          mx = -toP.x;
          mz = -toP.z;
        } else {
          // tourne autour du joueur
          mx = toP.z * this.strafeDir * 0.55;
          mz = -toP.x * this.strafeDir * 0.55;
          if (Math.random() < dt * 0.3) this.strafeDir *= -1;
        }
        // séparation avec les autres ennemis
        for (const o of this.manager.enemies) {
          if (o === this || !o.alive) continue;
          const dx = this.pos.x - o.pos.x;
          const dz = this.pos.z - o.pos.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 4 && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            mx += (dx / d) * (2 - d);
            mz += (dz / d) * (2 - d);
          }
        }
        const ml = Math.hypot(mx, mz);
        const sp = dist > want + 5 ? T.speed : T.speed * 0.55;
        if (ml > 0.01) {
          this.vel.x = (mx / ml) * sp;
          this.vel.z = (mz / ml) * sp;
          move = true;
        } else {
          this.vel.x = 0;
          this.vel.z = 0;
        }
        this.facing = angleLerp(this.facing, faceP, damp(8, dt));
        const inRange = T.ranged ? dist < 28 && dist > 5 : dist < want + 1.2;
        const sameLevel = Math.abs(player.pos.y - this.pos.y) < (T.ranged ? 30 : 2.5);
        if (this.attackCd <= 0 && inRange && sameLevel && this.manager.requestAttack(this)) {
          this.setState('windup');
          this.vel.set(0, 0, 0);
          this.manager.game.onSpiderSense(this, T.windup);
        }
        if (move) {
          this.runPhase = (this.runPhase || 0) + dt * (4 + sp * 0.7);
          pose = A.run(this.runPhase, clamp(sp / 6, 0.3, 1), 0);
        } else pose = T.ranged ? A.aim(this.t) : A.guard(this.t);
        blend = 10;
        break;
      }
      case 'windup': {
        this.facing = angleLerp(this.facing, faceP, damp(12, dt));
        this.vel.x = 0;
        this.vel.z = 0;
        if (T.ranged) {
          pose = A.aim(this.t);
          if (this.stateT >= T.windup) {
            this._shoot();
            this.setState('recover');
          }
        } else {
          pose = A.lerpPose(A.guard(this.t), A.ATTACKS[T.anim].windup, Math.min(1, this.stateT / 0.3));
          if (this.stateT >= T.windup) {
            this.setState('attack');
            this.didHit = false;
          }
        }
        break;
      }
      case 'attack': {
        const dur = 0.35;
        pose = A.attackPose(T.anim, this.stateT, dur, 0.08);
        blend = 30;
        if (this.stateT < 0.15) {
          const lunge = Math.min(8, Math.max(0, dist - 1.2) / 0.15);
          this.vel.x = toP.x * lunge;
          this.vel.z = toP.z * lunge;
        } else {
          this.vel.x = 0;
          this.vel.z = 0;
        }
        if (!this.didHit && this.stateT > 0.08) {
          this.didHit = true;
          if (dist < T.range + 0.8 && Math.abs(player.pos.y - this.pos.y) < 2) {
            const ok = player.takeDamage(T.dmg * this.manager.difficulty, this.pos, T.kind);
            if (ok) this.game.audio.play(T.kind === 'heavy' ? 'heavy' : 'punch', 0.7);
            if (T.kind === 'heavy') {
              this.game.fx.dust(this.pos, 8);
              this.game.cam.shake(0.4);
            }
          } else this.game.audio.play('whoosh', 0.4);
        }
        if (this.stateT > dur) {
          this.setState('recover');
          this.manager.releaseAttack(this);
        }
        break;
      }
      case 'recover': {
        pose = T.ranged ? A.aim(this.t) : A.guard(this.t);
        this.vel.x = 0;
        this.vel.z = 0;
        if (this.stateT > 0.5) {
          this.setState('strafe');
          this.attackCd = rand(1.8, 3.6) / this.manager.difficulty;
          this.manager.releaseAttack(this);
        }
        break;
      }
      case 'stagger': {
        pose = A.hit(clamp(this.stateT / this.staggerDur, 0, 1));
        blend = 25;
        this.vel.x *= 1 - Math.min(1, 6 * dt);
        this.vel.z *= 1 - Math.min(1, 6 * dt);
        this.manager.releaseAttack(this);
        if (this.stateT > this.staggerDur) this.setState('strafe');
        break;
      }
      case 'air': {
        this.manager.releaseAttack(this);
        const juggled = this.game.player.action && this.game.player.action.hover && dist < 4;
        this.vel.y -= (juggled ? 8 : 26) * dt;
        pose = this.dying || this.knockdown ? A.knockdown() : A.airborne(this.t);
        blend = 8;
        if (this.pos.y <= this.groundY && this.vel.y <= 0) {
          this.pos.y = this.groundY;
          this.vel.set(0, 0, 0);
          this.game.fx.dust(this.pos, 5);
          this.game.audio.play('land', 0.5);
          if (this.fallStart - this.pos.y > 14 && this.alive) {
            // chute depuis un toit : neutralisé
            this.hp = 0;
            this.alive = false;
            this.manager.onDefeated(this);
          }
          this.knockdown = false;
          this.setState(this.alive ? 'down' : 'dead');
        }
        break;
      }
      case 'down': {
        pose = A.knockdown();
        this.vel.set(0, 0, 0);
        if (this.stateT > 1.4) this.setState('getup');
        break;
      }
      case 'getup': {
        pose = A.guard(this.t);
        blend = 6;
        if (this.stateT > 0.6) this.setState('strafe');
        break;
      }
      case 'webbed': {
        pose = A.webbed(this.t);
        this.vel.x = 0;
        this.vel.z = 0;
        this.webbedT -= dt;
        this.manager.releaseAttack(this);
        if (this.webbedT <= 0 && this.alive) {
          this.web = 0;
          this.cocoon.visible = false;
          this.setState('strafe');
        }
        break;
      }
      case 'dead': {
        pose = this.cocoon.visible ? A.webbed(0) : A.knockdown();
        this.vel.set(0, 0, 0);
        this.removeT += dt;
        if (this.cocoon.visible) {
          this.rig.pivot.rotation.x = -1.5;
          this.rig.pivot.position.y = 0.3;
        }
        break;
      }
    }

    // Intégration + collisions
    if (this.state !== 'dead') {
      const nx = this.pos.x + this.vel.x * dt;
      const nz = this.pos.z + this.vel.z * dt;
      const ny = this.pos.y + (this.state === 'air' ? this.vel.y * dt : 0);
      const g = city.groundHeight(nx, nz, Math.max(ny, this.pos.y) + 0.3);
      // ne marche pas dans le vide
      if (this.state !== 'air' && g < this.groundY - 1.5) {
        this.vel.x = 0;
        this.vel.z = 0;
      } else {
        this.pos.x = nx;
        this.pos.z = nz;
        this.pos.y = ny;
        if (this.state === 'air') {
          this.groundY = g;
        } else {
          this.groundY = g;
          this.pos.y = g;
          this.fallStart = g;
        }
      }
      this._pushOut(city);
      // laisse : ne s'éloigne pas trop de sa zone
      if (this.alive && Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > this.leash && this.state !== 'air') {
        _v2.subVectors(this.home, this.pos).setY(0).normalize();
        this.pos.addScaledVector(_v2, 0.1);
      }
    }

    const rg = this.rig.group;
    rg.position.copy(this.pos);
    rg.rotation.y = this.facing;
    if (pose) this.rig.apply(pose, dt, blend);
    if (this.state === 'dead' && this.cocoon.visible) {
      this.rig.pivot.rotation.x = -1.5;
      this.rig.pivot.position.y = 0.3;
    }
    // flash blanc à l'impact
    const flash = this.hitFlash > 0;
    const night = this.game.env.night;
    if (flash !== this._flashing || Math.abs(night - (this._night || 0)) > 0.03) {
      this._flashing = flash;
      this._night = night;
      for (const m of Object.values(this.mats)) {
        if (flash) m.emissive.setScalar(0.6);
        else m.emissive.copy(m.color).multiplyScalar(night * 0.3);
      }
    }
    this.chest.set(this.pos.x, this.pos.y + 1.2 * this.type.scale, this.pos.z);
  }

  _pushOut(city) {
    const r = this.radius;
    const p = this.pos;
    const boxes = city.queryAABB(p.x - r, p.z - r, p.x + r, p.z + r, this._boxes || (this._boxes = []));
    for (const b of boxes) {
      if (p.y >= b.maxY - 0.1 || p.y + 1.8 <= b.minY) continue;
      const cx = clamp(p.x, b.minX, b.maxX);
      const cz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        const pen = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z];
        const k = pen.indexOf(Math.min(...pen));
        if (k === 0) p.x = b.minX - r;
        else if (k === 1) p.x = b.maxX + r;
        else if (k === 2) p.z = b.minZ - r;
        else p.z = b.maxZ + r;
      }
      if (this.state === 'air') {
        this.vel.x *= -0.3;
        this.vel.z *= -0.3;
      }
    }
  }

  _shoot() {
    const player = this.game.player;
    const from = new THREE.Vector3();
    if (this.gun) this.gun.getWorldPosition(from);
    else from.copy(this.chest);
    const target = player.chestPos.clone().addScaledVector(player.vel, 0.25);
    const dir = target.sub(from).normalize();
    this.game.projectiles.spawn('bullet', from, dir.multiplyScalar(48), { dmg: this.type.dmg * this.manager.difficulty, owner: this });
    this.game.audio.play('gun', 0.6);
    this.game.fx.sparks(from, 5, '#ffe08a', 4);
  }

  dispose() {
    this.game.scene.remove(this.rig.group);
    this.rig.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of Object.values(this.mats)) m.dispose();
  }
}

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.meleeTokens = new Set();
    this.rangedTokens = new Set();
    this.difficulty = 1;
    this.lastHitTime = -99;
    this.alerted = false;
    this.listeners = [];
  }

  spawn(type, pos, opts = {}) {
    const e = new Enemy(this, type, pos, opts);
    this.enemies.push(e);
    return e;
  }

  alert() {
    this.alerted = true;
    for (const e of this.enemies) if (e.state === 'idle' && e.pos.distanceTo(this.game.player.pos) < 60) e.setState('approach');
  }

  requestAttack(e) {
    if (e.type.ranged) {
      if (this.rangedTokens.size >= 2) return false;
      this.rangedTokens.add(e);
      return true;
    }
    const maxMelee = this.difficulty > 1.2 ? 2 : 1;
    if (this.meleeTokens.size >= maxMelee) return false;
    this.meleeTokens.add(e);
    return true;
  }

  releaseAttack(e) {
    this.meleeTokens.delete(e);
    this.rangedTokens.delete(e);
  }

  onDefeated(e) {
    this.releaseAttack(e);
    this.game.onEnemyDefeated(e);
  }

  get active() {
    return this.enemies.filter((e) => e.alive);
  }

  // Ennemis engagés près du joueur (pour la musique, la caméra…)
  engagedCount(pos, r = 40) {
    let n = 0;
    for (const e of this.enemies) if (e.alive && e.state !== 'idle' && e.pos.distanceTo(pos) < r) n++;
    return n;
  }

  // Temps restant avant le prochain coup ennemi (sens d'araignée / esquive parfaite)
  nextThreat() {
    let best = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.state === 'windup') best = Math.min(best, e.type.windup - e.stateT + (e.type.ranged ? 0.25 : 0.08));
    }
    return best;
  }

  clear(filter = null) {
    this.enemies = this.enemies.filter((e) => {
      if (filter && !filter(e)) return true;
      e.dispose();
      this.releaseAttack(e);
      return false;
    });
    if (!this.enemies.length) this.alerted = false;
  }

  update(dt) {
    for (const e of this.enemies) e.update(dt);
    // retire les corps après un moment (et loin du regard)
    const p = this.game.player.pos;
    this.enemies = this.enemies.filter((e) => {
      if (!e.alive && e.removeT > 12 && e.pos.distanceTo(p) > 25) {
        e.dispose();
        return false;
      }
      if (!e.alive && e.removeT > 40) {
        e.dispose();
        return false;
      }
      return true;
    });
    if (!this.enemies.some((e) => e.alive)) this.alerted = false;
  }
}
