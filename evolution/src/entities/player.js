// Le joueur : déplacements (nage, marche, vol), survie, combat, récolte, interactions.
import * as THREE from 'three';
import { G, bus, toast } from '../core/state.js';
import { stageDef, MUTATIONS, STAGES } from '../data/stages.js';
import { item } from '../data/items.js';
import { NODE_TYPES, WATER } from '../world/terrain.js';
import { buildPlayerModel } from '../models/player.js';
import { attachHeld } from '../models/humans.js';
import { animateRig } from '../models/kit.js';
import * as inv from '../systems/inventory.js';
import { computeStats, gainDna } from '../systems/evolution.js';
import { eraIndex } from '../data/tech.js';
import { clamp, damp, dampAngle, rand, pick } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { TRAITS } from '../data/species.js';

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Paramètres de forme par étape : rayon et distance de caméra relatifs à la taille
const FORM = [
  { r: 1, cam: 7, eye: 0 },
  { r: 0.8, cam: 5, eye: 0 },
  { r: 0.5, cam: 5.5, eye: 0.2 },
  { r: 0.35, cam: 5, eye: 0.3 },
  { r: 0.4, cam: 4.5, eye: 0.4 },
  { r: 0.4, cam: 4.2, eye: 0.6 },
  { r: 0.3, cam: 3.4, eye: 0.8 },
  { r: 0.22, cam: 2.7, eye: 0.85 },
  { r: 0.22, cam: 2.6, eye: 0.88 },
];

export class Player {
  constructor() {
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.camYaw = 0;
    this.camPitch = -0.25;
    this.camPos = new THREE.Vector3();
    this.hp = 100;
    this.hunger = 100;
    this.thirst = 100;
    this.stamina = 100;
    this.alive = true;
    this.onGround = false;
    this.inWater = false;
    this.effects = { speed: 0, strength: 0, invis: 0, giant: 0, fly: 0 };
    this.poison = 0;
    this.atkCd = 0;
    this.atkAnim = 0;
    this.anim = 0;
    this.model = null;
    this.stats = computeStats();
    this.prompt = '';
    this.target = null;
    this.radius = 1;
    this.size = 1;
    this.heldId = undefined;
    this.side = 'player';
    this.invuln = 0;
    this.breathCd = 0;
  }

  get monster() {
    return G.monster;
  }

  get swims3D() {
    return G.mode === 'micro' || G.stage === 2;
  }

  get canFly() {
    return this.effects.fly > 0 || (G.monster && G.monster.traits.includes('ailes'));
  }

  rebuild() {
    const old = this.model;
    const parent = old?.parent || G.scene;
    if (old) parent.remove(old);
    this.stats = computeStats();
    this.model = buildPlayerModel(G.stage, G.mutations, {
      monster: G.monster,
      era: eraIndex(G.time.year),
      look: G.look,
      title: G.title,
      career: G.career,
    });
    this.model.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.heldId = undefined;
    this.applySize();
    parent?.add(this.model);
    this.model.position.copy(this.pos);
  }

  applySize() {
    const s = this.stats;
    const giant = this.effects.giant > 0 ? 2.2 : 1;
    this.size = s.size * giant;
    this.form = FORM[Math.min(G.stage, FORM.length - 1)];
    this.radius = this.size * (G.monster ? 0.3 : this.form.r);
    if (this.model) this.model.scale.setScalar(this.size);
  }

  attach(scene) {
    if (this.model) {
      this.model.parent?.remove(this.model);
      scene.add(this.model);
    }
  }

  maxHp() {
    return this.stats.hp;
  }

  damage(amount, source) {
    if (!this.alive || this.invuln > 0 || G.godMode) return;
    const armor = this.stats.armor || 0;
    const dmg = amount * (100 / (100 + armor * 8));
    this.hp -= dmg;
    sfx('hurt');
    bus.emit('hurt', dmg);
    G.fx.burst(v1.copy(this.pos).setY(this.pos.y + this.size * 0.5), G.mode === 'micro' ? 0xffffff : 0xb01010, 6, 3, 0.5);
    if (this.hp <= 0) this.die(source);
  }

  heal(n) {
    this.hp = Math.min(this.maxHp(), this.hp + n);
  }

  die(source) {
    this.alive = false;
    this.hp = 0;
    const by = source?.def?.name || source?.name || '';
    bus.emit('death', by);
  }

  respawn(point) {
    this.alive = true;
    this.hp = this.maxHp();
    this.hunger = Math.max(this.hunger, 60);
    this.thirst = Math.max(this.thirst, 60);
    this.poison = 0;
    this.invuln = 3;
    if (point) this.pos.copy(point);
    this.vel.set(0, 0, 0);
  }

  // ------------------------------------------------------------------
  update(dt) {
    const I = G.input;
    const st = stageDef(G.stage);
    this.anim += dt;
    this.atkCd -= dt;
    this.breathCd -= dt;
    this.invuln -= dt;
    this.atkAnim = Math.max(0, this.atkAnim - dt * 3.5);
    for (const k of Object.keys(this.effects)) {
      if (this.effects[k] > 0) {
        this.effects[k] -= dt;
        if (this.effects[k] <= 0 && k === 'giant') this.applySize();
      }
    }
    this.stats = computeStats();
    if (this.effects.strength > 0) this.stats.atk *= 1.6;
    if (this.effects.speed > 0) this.stats.speed *= 1.5;
    if (this.effects.giant > 0) this.stats.atk *= 1.5;
    if (G.disease) this.stats.speed *= 0.75;
    const sz = this.stats.size * (this.effects.giant > 0 ? 2.2 : 1);
    if (Math.abs(sz - this.size) > 0.01) this.applySize();
    if (this.hp > this.maxHp()) this.hp = this.maxHp();

    if (!G.panel && !G.building) {
      const k = 0.0024 * G.settings.sens;
      this.camYaw -= I.look.x * k;
      this.camPitch -= I.look.y * k * (G.settings.invertY ? -1 : 1);
      this.camPitch = clamp(this.camPitch, -1.35, 1.1);
      if (I.digit >= 0) G.hotSel = I.digit;
      if (I.wheel) G.hotSel = (G.hotSel + I.wheel + 9) % 9;
    }

    if (this.alive) {
      this.survival(dt, st);
      if (this.swims3D) this.moveSwim(dt);
      else this.moveLand(dt);
      if (!G.panel && !G.building) this.actions(dt, st);
    }

    // Objet tenu en main
    const sel = inv.selected();
    const show = sel && (item(sel).weapon || item(sel).tool) && G.stage >= 6 && !G.monster ? sel : null;
    if (show !== this.heldId) {
      this.heldId = show;
      attachHeld(this.model, show);
    }

    // Modèle
    this.model.position.copy(this.pos);
    this.model.rotation.set(this.swims3D ? this.pitch : 0, this.yaw, 0, 'YXZ');
    const hs = Math.hypot(this.vel.x, this.vel.z) + (this.swims3D ? Math.abs(this.vel.y) : 0);
    animateRig(this.model, this.anim, hs / Math.max(0.5, this.size * 0.6), this.atkAnim > 0 ? 1 - this.atkAnim : 0);
    if (this.effects.invis > 0) this.setOpacity(0.25);
    else if (this._faded) this.setOpacity(1);
    this.updateCamera(dt);
  }

  setOpacity(o) {
    this._faded = o < 1;
    this.model.traverse((m) => {
      if (m.isMesh) {
        if (!m.userData.ownMat) {
          m.material = m.material.clone();
          m.userData.ownMat = true;
        }
        m.material.transparent = o < 1 || m.material.userData.wasT;
        m.material.opacity = o;
      }
    });
  }

  survival(dt, st) {
    const land = st.env === 'land';
    let hungerRate = G.mode === 'micro' ? 0.45 : 0.22;
    if (G.monster) hungerRate *= 1.5;
    this.hunger = Math.max(0, this.hunger - hungerRate * dt);
    if (land) {
      let tr = 0.28;
      if (G.stage === 3 && !G.mutations.includes('peau_seche') && !this.nearWater(15)) tr *= 3;
      if (this.inWater) this.thirst = Math.min(100, this.thirst + 10 * dt);
      this.thirst = Math.max(0, this.thirst - tr * dt);
    } else this.thirst = 100;
    if (this.hunger <= 0 || this.thirst <= 0) {
      this.hp -= 2.5 * dt;
      if (this.hp <= 0) this.die({ name: this.hunger <= 0 ? 'la faim' : 'la soif' });
    } else if (this.hunger > 25) {
      let regen = this.stats.regen;
      if (G.mutations.includes('chloroplaste') && G.sky?.day > 0.5) regen += 1;
      this.heal(regen * dt);
    }
    if (this.poison > 0) {
      this.poison -= dt;
      this.hp -= 4 * dt;
      if (Math.random() < 0.1) G.fx.burst(this.pos, 0x80ff40, 1, 1, 0.5, 1);
      if (this.hp <= 0) this.die({ name: 'le poison' });
    }
    if (G.disease) {
      this.hp -= G.disease.level * 0.6 * dt * (G.mutations.includes('immunite') ? 0.3 : 1);
      if (this.hp <= 0) this.die({ name: G.disease.name });
    }
    const sprint = G.input.isDown('sprint') && this.vel.lengthSq() > 1;
    if (sprint) this.stamina = Math.max(0, this.stamina - 18 * dt);
    else this.stamina = Math.min(100, this.stamina + 14 * dt);
  }

  nearWater(r) {
    if (G.mode !== 'world') return true;
    for (let a = 0; a < 6.28; a += 0.8) {
      if (G.world.height(this.pos.x + Math.cos(a) * r, this.pos.z + Math.sin(a) * r) < WATER) return true;
    }
    return G.world.height(this.pos.x, this.pos.z) < WATER + 0.2;
  }

  camForward(out = v1) {
    const cp = Math.cos(this.camPitch);
    return out.set(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
  }

  moveSwim(dt) {
    const I = G.input;
    const mv = G.panel ? { x: 0, y: 0 } : I.move();
    const f = this.camForward(v1).clone();
    const right = v2.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const dir = new THREE.Vector3().addScaledVector(f, mv.y).addScaledVector(right, mv.x);
    if (!G.panel) {
      if (I.isDown('jump')) dir.y += 1;
      if (I.isDown('down')) dir.y -= 1;
    }
    if (dir.lengthSq() > 1) dir.normalize();
    let speed = this.stats.speed;
    if (I.isDown('sprint') && this.stamina > 0) speed *= 1.6;
    const target = dir.multiplyScalar(speed);
    this.vel.x = damp(this.vel.x, target.x, 4, dt);
    this.vel.y = damp(this.vel.y, target.y, 4, dt);
    this.vel.z = damp(this.vel.z, target.z, 4, dt);
    this.pos.addScaledVector(this.vel, dt);
    if (G.mode === 'micro') G.micro.clamp(this.pos, this.radius);
    else {
      const h = G.world.height(this.pos.x, this.pos.z);
      this.pos.y = clamp(this.pos.y, h + this.radius * 0.8, WATER - this.radius * 0.6);
      this.inWater = true;
      // Le poisson ne peut pas sortir de l'eau
      if (h > WATER - 0.6) {
        this.pos.addScaledVector(this.vel, -dt * 1.5);
        this.vel.multiplyScalar(-0.3);
      }
    }
    if (this.vel.lengthSq() > 0.3) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 6, dt);
      const hl = Math.hypot(this.vel.x, this.vel.z);
      this.pitch = damp(this.pitch, -Math.atan2(this.vel.y, hl) * 0.8, 5, dt);
    } else this.pitch = damp(this.pitch, 0, 3, dt);
  }

  moveLand(dt) {
    const I = G.input;
    const w = G.world;
    const mv = G.panel ? { x: 0, y: 0 } : I.move();
    const fwd = v1.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = v2.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const dir = new THREE.Vector3().addScaledVector(fwd, mv.y).addScaledVector(right, mv.x);
    let speed = this.stats.speed * 0.75;
    const sprinting = I.isDown('sprint') && this.stamina > 0 && !G.panel;
    if (sprinting) speed *= 1.6;
    const ground = w.height(this.pos.x, this.pos.z);
    const deep = ground < WATER - this.size * 0.6;
    const flying = this.canFly;
    this.inWater = deep && this.pos.y < WATER + 0.3 && !flying;
    if (this.inWater) speed *= G.stage === 3 ? 0.9 : 0.55;
    this.vel.x = damp(this.vel.x, dir.x * speed, this.onGround || this.inWater || flying ? 10 : 2, dt);
    this.vel.z = damp(this.vel.z, dir.z * speed, this.onGround || this.inWater || flying ? 10 : 2, dt);

    if (flying) {
      let vy = 0;
      if (!G.panel && I.isDown('jump')) vy = speed * 0.8;
      if (!G.panel && I.isDown('down')) vy = -speed * 0.8;
      this.vel.y = damp(this.vel.y, vy, 5, dt);
      if (Math.random() < 0.3) G.fx.burst(this.pos, 0xffffff, 1, 0.5, 0.3, 0);
    } else if (this.inWater) {
      const surf = WATER - this.size * 0.35;
      let ty = surf;
      if (G.stage === 3 && !G.panel && I.isDown('down')) ty = Math.max(ground + 0.3, this.pos.y - 3);
      this.vel.y = (ty - this.pos.y) * 3;
      if (!G.panel && I.consume('jump') && this.pos.y > surf - 0.5) this.vel.y = 5;
    } else {
      this.vel.y -= 22 * dt;
      if (!G.panel && this.onGround && I.consume('jump')) {
        const agile = G.mutations.includes('pattes') || G.mutations.includes('agilite') ? 1.4 : 1;
        this.vel.y = (6 + this.size * 0.8) * agile;
        this.onGround = false;
      }
    }
    this.pos.addScaledVector(this.vel, dt);
    // Bords du monde
    const lim = 690;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
    const gh = w.height(this.pos.x, this.pos.z);
    if (this.inWater) {
      if (this.pos.y < gh) this.pos.y = gh;
      this.onGround = false;
    } else if (this.pos.y <= gh) {
      if (this.vel.y < -18 && !flying) this.damage((-this.vel.y - 18) * 3);
      this.pos.y = gh;
      this.vel.y = 0;
      this.onGround = true;
    } else this.onGround = this.pos.y - gh < 0.05;
    if (!flying || this.pos.y - gh < 3) w.collide(this.pos, this.radius);
    if (G.buildingsSys) G.buildingsSys.collide(this.pos, this.radius);

    const hs = Math.hypot(this.vel.x, this.vel.z);
    const aiming = (G.input.isDown('attack') || this.atkAnim > 0) && G.stage >= 6 && !G.panel;
    if (aiming) this.yaw = dampAngle(this.yaw, this.camYaw, 12, dt);
    else if (hs > 0.5) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 10, dt);
  }

  updateCamera(dt) {
    const cam = G.camera;
    const f = this.camForward(v1);
    let dist = Math.max(2.5, this.size * this.form.cam + (G.stage >= 6 ? 1.2 : 2));
    if (G.monster) dist = this.size * 4 + 2;
    const target = v2.copy(this.pos);
    target.y += this.size * (this.form.eye || 0) + (this.swims3D ? 0 : 0.3);
    const want = target.clone().addScaledVector(f, -dist);
    if (G.mode === 'world') {
      const gh = G.world.height(want.x, want.z) + 0.4;
      if (want.y < gh) want.y = gh;
      if (this.swims3D && want.y > WATER - 0.3) want.y = WATER - 0.3;
    }
    if (!this.camInit) {
      this.camPos.copy(want);
      this.camInit = true;
    }
    this.camPos.lerp(want, 1 - Math.exp(-14 * dt));
    cam.position.copy(this.camPos);
    if (G.fx.shake > 0) {
      const s = G.fx.shake * 0.4;
      cam.position.x += rand(-s, s);
      cam.position.y += rand(-s, s);
    }
    cam.lookAt(target);
    const sprint = G.input.isDown('sprint') && this.vel.lengthSq() > 4;
    cam.fov = damp(cam.fov, sprint ? 80 : 70, 4, dt);
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------
  // Actions : attaque, utilisation d'objet, interaction
  actions(dt, st) {
    const I = G.input;
    // Contact : manger ce qui est plus petit (étapes aquatiques)
    if (st.env !== 'land') this.autoEat();
    this.findInteraction(st);
    if (I.consume('interact')) this.interact(st);
    if (I.isDown('attack') && this.atkCd <= 0) this.primary(st);
    if (I.consume('use2')) this.secondary(st);
  }

  autoEat() {
    const pos = this.pos;
    if (G.mode === 'micro') {
      const n = G.micro.eatFoodNear(pos, this.radius);
      if (n) {
        this.hunger = Math.min(100, this.hunger + 6 * n);
        this.heal(2 * n);
        gainDna(1 * n, pos);
        sfx('eat');
        G.stats.eaten += n;
      }
    }
    for (const c of G.creatures.list) {
      if (!c.alive) continue;
      const ratio = G.mode === 'micro' ? 0.8 : 0.45;
      if (c.size < this.size * ratio && c.pos.distanceTo(pos) < this.radius + c.radius * 0.8) {
        c.die('player');
      }
    }
  }

  // Manger une créature tuée (bus 'eatCreature')
  eat(c) {
    this.hunger = Math.min(100, this.hunger + 8 + c.def.dna);
    this.heal(4 + c.def.dna * 0.5);
    gainDna(c.def.dna, c.pos);
    G.stats.eaten++;
    sfx('eat');
  }

  meleeRange() {
    const sel = inv.selected();
    const w = sel ? item(sel).weapon : null;
    let r = this.radius + 1.2 + this.size * 0.4;
    if (w && !w.proj && G.stage >= 6) r = Math.max(r, w.range * (this.size / 1.7) + 0.4);
    if (G.monster && G.monster.traits.includes('tentacules')) r *= 1.8;
    return r;
  }

  attackDamage() {
    const sel = inv.selected();
    const w = sel ? item(sel).weapon : null;
    let d = this.stats.atk;
    if (w && !w.proj && G.stage >= 6) d += w.dmg;
    return d * rand(0.85, 1.15);
  }

  primary(st) {
    const sel = inv.selected();
    const it = sel ? item(sel) : null;
    if (it && G.stage >= 6) {
      if (it.weapon?.proj) return this.shoot(it);
      if (it.throw && G.stage >= 6) return this.throwItem(it);
      if ((it.food || it.potion || it.cure) && !it.weapon) {
        this.atkCd = 0.4;
        return this.consume(sel);
      }
      if (it.deploy) {
        this.atkCd = 0.5;
        return this.deploy(sel);
      }
      if (it.machine) {
        this.atkCd = 0.5;
        return bus.emit('placeMachine', sel);
      }
      if (it.tool?.kind === 'fish') return this.fish();
    }
    this.melee();
  }

  melee() {
    this.atkCd = G.monster && G.monster.traits.includes('griffes') ? 0.35 : 0.55;
    this.atkAnim = 1;
    sfx('swoosh');
    const range = this.meleeRange();
    const f = this.swims3D ? this.camForward(new THREE.Vector3()).normalize() : null;
    const yaw = this.swims3D ? this.yaw : this.camYaw;
    let target = G.creatures.inFront(this.pos, yaw, range, this.swims3D ? 0.4 : 0.55, f);
    if (!target && G.npcs) target = G.npcs.inFront(this.pos, yaw, range);
    if (target) {
      const dmg = this.attackDamage();
      target.damage(dmg, 'player', this.pos);
      if (G.monster?.traits.some((t) => t === 'poison' || t === 'venin')) target.infect?.(2);
      sfx('hit');
      return;
    }
    // Sinon : frapper une ressource (arbre, rocher...)
    if (G.mode === 'world' && G.stage >= 6) {
      const node = this.nodeInFront(range + 1);
      if (node) this.harvest(node);
    }
  }

  fish() {
    this.atkCd = 1.2;
    this.atkAnim = 1;
    if (!this.nearWater(5)) return toast('Approche-toi de l’eau pour pêcher.', 'bad');
    sfx('splash');
    const r = Math.random();
    if (r < 0.45) {
      inv.add('poisson', 1);
      if (G.stage >= 7) G.savoir += 0.2;
    } else if (r < 0.5) inv.add(Math.random() < 0.5 ? 'os' : 'plume', 1);
    else G.fx.text(this.pos.clone().setY(this.pos.y + 2), 'Ça ne mord pas...', '#cde');
  }

  nodeInFront(range) {
    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    let best = null;
    let bd = Infinity;
    for (const n of G.world.nodesNear(this.pos.x, this.pos.z, range + 2)) {
      const d = Math.hypot(n.x - this.pos.x, n.z - this.pos.z) - (NODE_TYPES[n.type].collide || 0.3) * n.s;
      if (d > range) continue;
      const dir = v1.set(n.x - this.pos.x, 0, n.z - this.pos.z).normalize();
      if (dir.dot(fwd) < 0.3 && d > 0.8) continue;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  shoot(it) {
    const w = it.weapon;
    if (w.ammo && !inv.remove(w.ammo, 1)) {
      toast(`Plus de munitions (${item(w.ammo).name})`, 'bad');
      this.atkCd = 0.5;
      return;
    }
    this.atkCd = w.rate || 0.6;
    this.atkAnim = 0.6;
    const dir = this.camForward(new THREE.Vector3()).normalize();
    dir.y += 0.03;
    const speed = w.proj === 'arrow' ? 50 : w.proj === 'laser' ? 160 : 130;
    const start = this.pos.clone().add(new THREE.Vector3(0, this.size * 0.8, 0)).addScaledVector(dir, 0.8);
    G.fx.spawnProjectile({ pos: start, vel: dir.multiplyScalar(speed), dmg: w.dmg + this.stats.atk * 0.3, kind: w.proj, side: 'player', life: (w.range / speed) * 1.5 });
    sfx(w.proj === 'laser' ? 'laser' : w.proj === 'arrow' ? 'swoosh' : 'shoot');
  }

  throwItem(it) {
    this.atkCd = 0.8;
    this.atkAnim = 1;
    const t = it.throw;
    if (!inv.remove(it.id, 1)) return;
    const dir = this.camForward(new THREE.Vector3()).normalize();
    const start = this.pos.clone().add(new THREE.Vector3(0, this.size * 0.9, 0)).addScaledVector(dir, 0.6);
    const vel = dir.multiplyScalar(t.kind === 'rock' ? 26 : 20).add(new THREE.Vector3(0, 5, 0));
    G.fx.spawnProjectile({ pos: start, vel, dmg: t.dmg + (t.kind === 'rock' ? this.stats.atk * 0.4 : 0), kind: t.kind === 'rock' ? 'rock' : t.kind, side: 'player', radius: t.radius, virus: t.virus, life: 6 });
    sfx('swoosh');
    if (t.kind === 'nuke') toast('☢️ BOMBE ATOMIQUE LANCÉE ! COURS !', 'bad');
  }

  secondary(st) {
    // Capacité spéciale du monstre : souffle de feu / poison
    if (G.monster && this.breathCd <= 0) {
      this.breathCd = 2;
      const dir = this.camForward(new THREE.Vector3()).normalize();
      const venom = G.monster.traits.some((t) => t === 'poison' || t === 'venin');
      for (let i = 0; i < 6; i++) {
        const d = dir.clone().add(new THREE.Vector3(rand(-0.1, 0.1), rand(-0.05, 0.1), rand(-0.1, 0.1))).normalize();
        G.fx.spawnProjectile({ pos: this.pos.clone().add(new THREE.Vector3(0, this.size * 0.9, 0)).addScaledVector(d, 1), vel: d.multiplyScalar(25), dmg: 25 + this.stats.atk * 0.3, kind: 'fire', side: 'player', life: 0.9 });
      }
      if (venom) G.fx.burst(this.pos.clone().addScaledVector(dir, 4), 0x80ff40, 30, 5, 1);
      sfx('roar');
      return;
    }
    const sel = inv.selected();
    if (sel && (item(sel).food || item(sel).potion || item(sel).cure)) this.consume(sel);
    else if (G.stage >= 6 && !this.swims3D) {
      // Manger le premier aliment disponible
      const food = Object.keys(G.inv).find((id) => item(id).food && item(id).food.hunger > 0);
      if (food && this.hunger < 95) this.consume(food);
    }
  }

  consume(id) {
    const it = item(id);
    if (!inv.remove(id, 1)) return;
    if (it.food) {
      const f = it.food;
      this.hunger = clamp(this.hunger + (f.hunger || 0), 0, 100);
      this.thirst = clamp(this.thirst + (f.thirst || 0), 0, 100);
      if (f.hp) {
        if (f.hp > 0) this.heal(f.hp);
        else this.hp = Math.max(1, this.hp + f.hp);
      }
      if ((id === 'viande' || id === 'poisson') && Math.random() < 0.08 && !G.disease && G.stage >= 7) {
        G.disease = { name: 'Intoxication', level: 1 };
        toast('Tu es malade : la viande crue ! Prends une tisane.', 'bad');
      }
      sfx(f.thirst > f.hunger ? 'drink' : 'eat');
    }
    if (it.potion) {
      const p = it.potion;
      sfx('drink');
      if (p.effect === 'heal') this.heal(p.amount);
      else if (p.effect === 'human') {
        if (G.monster) {
          G.monster = null;
          toast('Tu redeviens humain.', 'good');
          this.rebuild();
        } else toast('Tu es déjà humain.');
      } else if (p.effect === 'mutate') {
        const pool = (MUTATIONS[STAGES[G.stage].id] || []).filter((m) => !G.mutations.includes(m.id) && !m.evolve);
        if (G.monster) {
          const keys = Object.keys(TRAITS).filter((t) => !G.monster.traits.includes(t));
          if (keys.length) {
            const t = pick(keys);
            G.monster.traits.push(t);
            toast(`Nouvelle mutation monstrueuse : ${TRAITS[t].name} !`, 'good');
            this.rebuild();
          }
        } else if (pool.length) {
          const m = pick(pool);
          G.mutations.push(m.id);
          toast(`Mutation : ${m.icon} ${m.name} !`, 'good');
          this.rebuild();
        } else toast('Rien ne se passe...');
      } else {
        this.effects[p.effect] = p.dur;
        if (p.effect === 'giant') this.applySize();
        toast(`${it.icon} ${it.name} : effet actif ${p.dur}s`, 'good');
      }
    }
    if (it.cure) {
      if (it.vaccine) {
        G.vaccinated = G.time.day + 15;
        toast('Vacciné pour 15 jours.', 'good');
      }
      if (G.disease && it.cure >= G.disease.level) {
        toast(`Guéri de : ${G.disease.name}`, 'good');
        G.disease = null;
      } else if (G.disease) toast('Ce remède est trop faible pour cette maladie.', 'bad');
    }
  }

  deploy(id) {
    const it = item(id);
    if (!G.npcs) return;
    inv.remove(id, 1);
    const p = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 2, 0, Math.cos(this.yaw) * 2));
    G.npcs.spawnRobot(it.deploy, p);
    toast(`${it.icon} ${it.name} activé ! Ordres : parle-lui (E) ou utilise l’ordinateur.`, 'good');
  }

  // ------------------------------------------------------------------
  findInteraction(st) {
    this.prompt = '';
    this.target = null;
    if (G.mode !== 'world' || G.stage < 3) return;
    const p = this.pos;
    // Bâtiments
    const b = G.buildingsSys?.interactable(p, this.radius + 2.2);
    if (b) {
      this.target = { kind: 'building', b };
      this.prompt = b.prompt;
      return;
    }
    // PNJ
    const npc = G.npcs?.nearest(p, 3.2);
    if (npc && G.stage >= 7) {
      this.target = { kind: 'npc', npc };
      this.prompt = npc.prompt();
      return;
    }
    // Cadavre
    const c = G.creatures.nearestCorpse(p, 2 + this.radius);
    if (c) {
      const skin = st.canCraft && (inv.count('couteau_silex') || inv.bestTool('axe') || inv.bestTool('pick'));
      this.target = { kind: 'corpse', c, skin };
      this.prompt = skin ? `Dépecer : ${c.def.name}` : `Manger : ${c.def.name}`;
      return;
    }
    // Ressource
    const node = G.world.nearestNode(p.x, p.z, 1.6 + this.radius, (n) => {
      const d = NODE_TYPES[n.type];
      if (!st.canPickUp) return !!d.food;
      return true;
    });
    if (node) {
      const d = NODE_TYPES[node.type];
      this.target = { kind: 'node', node };
      this.prompt = (st.canPickUp ? (d.need ? 'Récolter : ' : 'Ramasser : ') : 'Manger : ') + d.name;
      return;
    }
    if (this.nearWater(1.5 + this.radius) && this.thirst < 99 && !this.inWater) {
      this.target = { kind: 'water' };
      this.prompt = 'Boire';
    }
  }

  interact(st) {
    const t = this.target;
    if (!t) return;
    if (t.kind === 'building') return G.buildingsSys.use(t.b);
    if (t.kind === 'npc') return bus.emit('talk', t.npc);
    if (t.kind === 'water') {
      this.thirst = Math.min(100, this.thirst + 35);
      sfx('drink');
      G.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0x80c0ff, 8, 2, 0.5);
      return;
    }
    if (t.kind === 'corpse') {
      const c = t.c;
      this.atkAnim = 1;
      if (t.skin) {
        const drops = c.def.drops || { viande: 1 };
        for (const [id, n] of Object.entries(drops)) inv.add(id, Math.max(1, Math.round(n * (c.size / c.def.size))));
        if (G.techs.includes('genetique') || G.stage >= 8) {
          if (Math.random() < (G.techs.includes('genetique') ? 0.8 : 0.25)) inv.add('adn_' + c.id, 1);
        }
        gainDna(Math.round(c.def.dna * 0.5), c.pos);
        sfx('harvest');
      } else {
        this.eat(c);
      }
      c.remove = true;
      return;
    }
    if (t.kind === 'node') return this.harvest(t.node);
  }

  harvest(node) {
    const st = stageDef(G.stage);
    const def = NODE_TYPES[node.type];
    this.atkAnim = 1;
    this.atkCd = 0.45;
    // Avant les primates : on ne peut que manger
    if (!st.canPickUp) {
      if (def.food) {
        this.hunger = Math.min(100, this.hunger + 15);
        this.thirst = Math.min(100, this.thirst + 6);
        gainDna(2, this.pos);
        sfx('eat');
        G.world.depleteNode(node);
      }
      return;
    }
    let yieldK = 1;
    let gives = def.gather;
    if (def.need) {
      const tool = inv.bestTool(def.need);
      const tier = tool ? tool.tier : 0;
      if (def.tier > tier) {
        const need = def.need === 'pick' ? 'pioche' : 'hache';
        const lvl = ['', 'en pierre', 'en bronze', 'en fer', 'moderne (foreuse)'][def.tier] || '';
        toast(`Il faut une ${need} ${lvl}${def.tier >= 4 ? '' : ' ou mieux'}.`, 'bad');
        sfx('error');
        return;
      }
      if (!tool || !st.canCraft) {
        if (!def.hand) return;
        gives = def.hand;
        node.hp -= 0.5;
      } else {
        yieldK = 1 + (tier - 1) * 0.5;
        node.hp -= 1 + tier * 0.4;
      }
    } else node.hp -= 1;
    for (const [id, n] of Object.entries(gives)) inv.add(id, Math.max(1, Math.round(n * yieldK)));
    if (def.bonus) for (const [id, ch] of Object.entries(def.bonus)) if (Math.random() < ch) inv.add(id, 1);
    if (G.stage >= 7) G.savoir += 0.1;
    sfx('harvest');
    G.fx.burst(new THREE.Vector3(node.x, node.y + 1, node.z), def.color || 0xc8b890, 8, 3, 0.5);
    if (node.hp <= 0) G.world.depleteNode(node);
  }
}
