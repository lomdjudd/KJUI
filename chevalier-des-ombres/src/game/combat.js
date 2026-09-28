// Combat : dégâts (résistances, faiblesses, critiques), projectiles, zones d'effet
// temporisées (télégraphes), zones persistantes (poison, feu), éruptions et chutes d'objets.
import * as THREE from 'three';
import { ELEMENT_COLORS } from '../gfx/effects.js';
import { settings } from '../core/settings.js';
import { rand, clamp } from '../core/utils.js';
import { audio } from '../core/audio.js';

const PROJ = {
  arrow: { geo: 'arrow', color: 0xc8b890, speed: 28, radius: 0.25, gravity: 1.5, glow: 1 },
  fireball: { geo: 'orb', color: 0xff6a1a, speed: 16, radius: 0.4, trail: 0xff6a1a, explode: 2.2, element: 'fire', glow: 4 },
  frostbolt: { geo: 'orb', color: 0x7ad4ff, speed: 18, radius: 0.35, trail: 0x7ad4ff, element: 'frost', glow: 3 },
  poison: { geo: 'orb', color: 0x7aff3a, speed: 13, radius: 0.35, trail: 0x7aff3a, explode: 1.6, element: 'poison', glow: 3 },
  acid: { geo: 'orb', color: 0xc8ff3a, speed: 14, radius: 0.35, trail: 0xc8ff3a, gravity: 5, explode: 1.5, element: 'poison', glow: 3 },
  shadow: { geo: 'orb', color: 0xa04dff, speed: 12, radius: 0.35, trail: 0xa04dff, element: 'shadow', glow: 3 },
  shadowOrb: { geo: 'orb', color: 0xb04dff, speed: 10, radius: 0.55, trail: 0xb04dff, explode: 2.6, element: 'shadow', glow: 4, scale: 1.8 },
  soul: { geo: 'orb', color: 0x7affd0, speed: 9, radius: 0.35, trail: 0x7affd0, element: 'shadow', glow: 3 },
  bone: { geo: 'bone', color: 0xe8e0c8, speed: 26, radius: 0.3, element: 'physical', glow: 1 },
  web: { geo: 'orb', color: 0xe0e0e8, speed: 17, radius: 0.4, trail: 0xffffff, element: 'physical', glow: 1.2 },
  boulder: { geo: 'rock', color: 0x8a8a98, speed: 18, radius: 0.8, gravity: 9, explode: 2.6, element: 'physical', glow: 1, scale: 1.5 },
  iceLance: { geo: 'lance', color: 0xa8e8ff, speed: 30, radius: 0.35, trail: 0x7ad4ff, element: 'frost', glow: 3, pierce: true },
  bat: { geo: 'orb', color: 0x8a1030, speed: 11, radius: 0.35, trail: 0x5a0a20, element: 'blood', glow: 2 },
  blood: { geo: 'orb', color: 0xff2244, speed: 14, radius: 0.35, trail: 0xff2244, element: 'blood', glow: 3 },
  blade: { geo: 'blade', color: 0xc06aff, speed: 16, radius: 0.4, trail: 0xc06aff, element: 'shadow', glow: 3 },
  ember: { geo: 'orb', color: 0xff8a2a, speed: 16, radius: 0.3, trail: 0xff6a1a, gravity: 4, element: 'fire', glow: 4, scale: 0.7 },
  shadowWave: { geo: 'wave', color: 0xa04dff, speed: 13, radius: 1.3, element: 'shadow', glow: 3, ground: true, pierce: true, life: 1.6 },
  fireWave: { geo: 'wave', color: 0xff6a1a, speed: 13, radius: 1.3, element: 'fire', glow: 3, ground: true, pierce: true, life: 1.6 },
  holy: { geo: 'orb', color: 0xffe89a, speed: 18, radius: 0.4, trail: 0xffe89a, element: 'holy', glow: 4 },
  lightning: { geo: 'orb', color: 0xb8d8ff, speed: 30, radius: 0.35, trail: 0xb8d8ff, element: 'lightning', glow: 4 },
};

const _v = new THREE.Vector3();

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.zones = [];
    this.hazards = [];
    this.spikes = [];
    this.falls = [];
    this._initMeshes();
  }

  _initMeshes() {
    const s = this.game.scene;
    this.geos = {
      orb: new THREE.SphereGeometry(0.25, 10, 8),
      arrow: new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).rotateX(Math.PI / 2),
      bone: new THREE.CylinderGeometry(0.05, 0.1, 1, 5).rotateX(Math.PI / 2),
      rock: new THREE.DodecahedronGeometry(0.5),
      lance: new THREE.OctahedronGeometry(0.3).scale(0.5, 0.5, 3),
      blade: new THREE.BoxGeometry(0.08, 0.02, 1),
      wave: new THREE.BoxGeometry(2.4, 0.9, 0.3).translate(0, 0.45, 0),
    };
    this.projPool = [];
    // Pics / tentacules / racines qui surgissent du sol
    this.spikeGeo = new THREE.ConeGeometry(0.5, 3, 6).translate(0, 1.5, 0);
    this.spikePool = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(this.spikeGeo, new THREE.MeshStandardMaterial({ color: 0xd8cfb0, roughness: 0.6, emissive: 0x000000 }));
      m.visible = false;
      m.castShadow = true;
      s.add(m);
      this.spikePool.push(m);
    }
    // Disques des zones persistantes
    this.hazardGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
    this.hazardPool = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(this.hazardGeo, new THREE.MeshBasicMaterial({ color: 0x5aff3a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false;
      m.renderOrder = 2;
      s.add(m);
      this.hazardPool.push(m);
    }
  }

  // ---------------- Dégâts ----------------
  // info : { amount, element, source, crit, poise, knock, status, kind, canBlock, lifesteal, stun, silent }
  hit(target, info) {
    if (!target || !target.alive) return null;
    const el = info.element || 'physical';
    let amount = info.amount;
    // Résistances et faiblesses (sauf si déjà calculées par l'attaquant)
    if (!info.preResisted) {
      const res = clamp((target.resist && target.resist[el]) || 0, -0.5, 0.95);
      amount *= 1 - res;
      if (target.weak && target.weak.includes(el) && el !== 'physical') amount *= 1.3;
      if (el === 'holy' && target.undead) amount *= 1.4;
    }
    if (info.bonusVs && target.kind === info.bonusVs) amount *= 1.25;
    const result = target.receiveHit({ ...info, amount, element: el });
    if (!result) return null;
    const src = info.source;
    if (result.dmg > 0) {
      const p = _v.set(target.pos.x, target.pos.y + target.height * 0.6 + (target.hover || 0), target.pos.z);
      if (!info.silent) {
        const kind = target.kind === 'metal' && !result.blocked ? 'metal' : target.kind;
        this.game.effects.hitSpark(p, result.blocked ? 'metal' : kind, info.crit);
        if (el !== 'physical') this.game.particles.burst(p, ELEMENT_COLORS[el] || 0xffffff, 8, 3, 0.3, 0.5, { intensity: 2 });
        audio.play('hit', { pos: target.pos, kind: result.blocked ? 'metal' : kind, crit: info.crit });
      }
      if (settings.get('damageNumbers') && this.game.hud) this.game.hud.damageNumber(p, result.dmg, info.crit, target.team === 'player' ? '#ff4a4a' : el !== 'physical' ? '#' + (ELEMENT_COLORS[el] || 0xffffff).toString(16).padStart(6, '0') : null);
      if (src && src.team === 'player' && src === this.game.player) {
        this.game.player.onDealtDamage(target, result.dmg, info);
      }
      if (src && info.lifesteal && src.alive) src.heal ? src.heal(result.dmg * info.lifesteal) : (src.hp = Math.min(src.maxHp, src.hp + result.dmg * info.lifesteal));
    }
    return result;
  }

  dot(target, amount, type) {
    if (!target.alive) return;
    const el = { burn: 'fire', poison: 'poison', shock: 'lightning' }[type] || 'physical';
    const res = clamp((target.resist && target.resist[el]) || 0, -0.5, 0.95);
    const dmg = amount * (1 - res);
    if (dmg <= 0.01) return;
    target.receiveHit({ amount: dmg, element: el, dot: true, canBlock: false, poise: 0 });
    if (settings.get('damageNumbers') && this.game.hud && dmg >= 1) this.game.hud.damageNumber(_v.set(target.pos.x, target.pos.y + target.height, target.pos.z), dmg, false, type === 'burn' ? '#ff8a3a' : '#7aff3a', true);
  }

  // Liste des cibles adverses
  targetsFor(team) {
    if (team === 'none') return [];
    return team === 'player' ? this.game.enemies.filter((e) => e.alive) : [this.game.player, ...this.game.allies].filter((a) => a && a.alive);
  }

  actorsInRadius(x, z, r, team, y = null) {
    const out = [];
    for (const a of this.targetsFor(team)) {
      const d = Math.hypot(a.pos.x - x, a.pos.z - z);
      if (d <= r + a.radius && (y === null || Math.abs(a.pos.y - y) < 4 + a.height)) out.push(a);
    }
    return out;
  }

  // ---------------- Projectiles ----------------
  // opts : { type, from (Vector3), dir (Vector3 normalisé) | target, team, dmg, element, status, homing, speed, source, pierce, scale }
  projectile(opts) {
    const def = PROJ[opts.type] || PROJ.fireball;
    let m = this.projPool.find((p) => !p.visible && p.userData.geo === def.geo);
    if (!m) {
      const col = new THREE.Color(def.color).multiplyScalar(def.glow || 1);
      m = new THREE.Mesh(this.geos[def.geo], new THREE.MeshBasicMaterial({ color: col, transparent: def.geo === 'wave', opacity: def.geo === 'wave' ? 0.7 : 1, blending: def.geo === 'wave' ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: def.geo !== 'wave' }));
      m.userData.geo = def.geo;
      this.game.scene.add(m);
      this.projPool.push(m);
    }
    m.material.color.set(def.color).multiplyScalar(def.glow || 1);
    m.visible = true;
    m.scale.setScalar((def.scale || 1) * (opts.scale || 1));
    m.position.copy(opts.from);
    const speed = opts.speed || def.speed;
    const vel = opts.dir.clone().multiplyScalar(speed);
    if (def.gravity && opts.target) {
      // Tir en cloche : compense la gravité pour atteindre la cible
      const d = Math.hypot(opts.target.x - opts.from.x, opts.target.z - opts.from.z);
      const t = d / speed;
      vel.y = ((opts.target.y ?? opts.from.y) - opts.from.y) / t + 0.5 * def.gravity * t;
    }
    const p = {
      mesh: m, def, vel, team: opts.team, dmg: opts.dmg, element: opts.element || def.element || 'physical', status: opts.status,
      homing: opts.homing || 0, target: opts.homingTarget || null, life: opts.life || def.life || 5, source: opts.source,
      pierce: opts.pierce ?? def.pierce, hitSet: new Set(), explode: opts.explode ?? def.explode, radius: def.radius * (opts.scale || 1), knock: opts.knock,
      prev: opts.from.clone(), stun: opts.stun, slow: opts.slow, crit: opts.crit, onHit: opts.onHit, poise: opts.poise ?? 10,
    };
    m.lookAt(m.position.clone().add(vel));
    this.projectiles.push(p);
    return p;
  }

  _explode(p, pos) {
    const r = p.explode;
    this.game.effects.elementBurst(pos, p.element, r / 2.2);
    this.game.effects.ring(pos, ELEMENT_COLORS[p.element] || 0xffffff, r * 1.2, 0.4);
    audio.play('explosion', { pos, big: r > 2.4 });
    for (const a of this.actorsInRadius(pos.x, pos.z, r, p.team, pos.y)) {
      if (p.hitSet.has(a.id)) continue;
      this.hit(a, { amount: p.dmg * 0.8, element: p.element, source: p.source, status: p.status, kind: 'aoe', canBlock: true, poise: p.poise, knock: p.knock || 4, crit: p.crit, stun: p.stun });
    }
  }

  _updateProjectiles(dt) {
    const w = this.game.world;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const m = p.mesh;
      p.life -= dt;
      p.prev.copy(m.position);
      if (p.homing && p.target && p.target.alive) {
        _v.set(p.target.pos.x - m.position.x, p.target.pos.y + p.target.height * 0.55 - m.position.y, p.target.pos.z - m.position.z).normalize();
        const sp = p.vel.length();
        p.vel.lerp(_v.multiplyScalar(sp), 1 - Math.exp(-p.homing * dt)).setLength(sp);
      }
      if (p.def.gravity) p.vel.y -= p.def.gravity * dt;
      m.position.addScaledVector(p.vel, dt);
      if (p.def.ground) m.position.y = w.heightAt(m.position.x, m.position.z);
      if (p.def.geo !== 'orb') m.lookAt(_v.copy(m.position).add(p.vel));
      else m.rotation.y += dt * 5;
      if (p.def.trail && Math.random() < 0.9) {
        this.game.particles.spawn(m.position.x, m.position.y, m.position.z, rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), 0.35, p.radius * 1.5, p.def.trail, { intensity: 2, drag: 0.9 });
      }
      let dead = p.life <= 0;
      // Sol
      const gh = w.heightAt(m.position.x, m.position.z);
      if (!p.def.ground && m.position.y < gh + 0.05) dead = true;
      // Obstacles
      if (!dead && !p.def.ground) {
        const t = w.colliders.segment(p.prev.x, p.prev.y, p.prev.z, m.position.x, m.position.y, m.position.z);
        if (t < 1) {
          m.position.lerpVectors(p.prev, m.position, t);
          dead = true;
        }
      }
      // Cibles
      if (!dead) {
        for (const a of this.targetsFor(p.team)) {
          if (p.hitSet.has(a.id)) continue;
          const dx = a.pos.x - m.position.x;
          const dz = a.pos.z - m.position.z;
          const rr = a.radius + p.radius;
          if (dx * dx + dz * dz > rr * rr) continue;
          const ay = a.pos.y + (a.hover || 0);
          if (m.position.y < ay - 0.3 || m.position.y > ay + a.height + 0.3) continue;
          p.hitSet.add(a.id);
          const dir = _v.copy(p.vel).normalize();
          const res = this.hit(a, { amount: p.dmg, element: p.element, source: p.source, status: p.status, kind: 'proj', canBlock: true, poise: p.poise, knock: p.knock || 2, dirX: dir.x, dirZ: dir.z, crit: p.crit, stun: p.stun });
          if (p.onHit) p.onHit(a, res);
          if (!p.pierce) {
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        if (p.explode) this._explode(p, m.position);
        else this.game.particles.burst(m.position, p.def.color, 8, 3, 0.25, 0.35, { intensity: 1.5 });
        m.visible = false;
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ---------------- Zones temporisées ----------------
  // opts : { x, z, radius, delay, dmg, element, team, status, visual, source, knock, stun, shape, dir, length, width, angle }
  zone(opts) {
    const tele = this.game.effects.telegraph({
      x: opts.x, z: opts.z, radius: opts.radius, duration: opts.delay, shape: opts.shape || 'circle', dir: opts.dir || 0,
      length: opts.length, width: opts.width, angle: opts.angle, color: opts.team === 'player' ? 0x5ab0ff : ELEMENT_COLORS[opts.element] === undefined || opts.element === 'physical' ? 0xff2a2a : blendRed(ELEMENT_COLORS[opts.element]),
    });
    const z = { ...opts, t: 0, tele };
    if (opts.visual) this._startFall(z);
    this.zones.push(z);
    return z;
  }

  _startFall(z) {
    const v = z.visual;
    if (['spike', 'root', 'tentacle', 'ice', 'bone'].includes(v) && z.rise) return;
    if (['meteor', 'boulder', 'shadowOrb', 'iceFall', 'boneFall', 'dirt', 'lightningFall'].includes(v) || v === 'meteor') {
      const type = { meteor: 'fireball', boulder: 'boulder', shadowOrb: 'shadowOrb', iceFall: 'iceLance', boneFall: 'bone', dirt: 'boulder', lightningFall: 'lightning' }[v] || 'fireball';
      const h = 18;
      const y = this.game.world.heightAt(z.x, z.z);
      const from = new THREE.Vector3(z.x + rand(-3, 3), y + h, z.z + rand(-3, 3));
      const to = new THREE.Vector3(z.x, y, z.z);
      const dir = to.clone().sub(from);
      const dist = dir.length();
      dir.normalize();
      const speed = dist / Math.max(0.2, z.delay);
      z.fall = { from, dir, speed, mesh: null };
      const p = this.projectile({ type, from, dir, team: 'none', dmg: 0, speed, life: z.delay + 0.05 });
      p.visualOnly = true;
      p.explode = 0;
      z.fallProj = p;
    }
  }

  _eruption(x, z, kind, scale = 1) {
    const m = this.spikePool.find((s) => !s.visible) || this.spikePool[0];
    const colors = { spike: 0xd8cfb0, bone: 0xe8e0c8, root: 0x3a2a1c, tentacle: 0x3a1250, ice: 0xa8e0ff, acid: 0x8aff3a, fire: 0xff5a0a, shadow: 0x6a2a9a };
    m.material.color.setHex(colors[kind] || 0xd8cfb0);
    m.material.emissive.setHex(kind === 'fire' || kind === 'acid' || kind === 'shadow' ? colors[kind] : kind === 'ice' ? 0x1a3a5a : 0x000000);
    m.visible = true;
    m.position.set(x, this.game.world.heightAt(x, z) - 3 * scale, z);
    m.rotation.set(rand(-0.2, 0.2), rand(0, 6), rand(-0.2, 0.2));
    m.scale.setScalar(scale);
    m.userData = { t: 0, base: this.game.world.heightAt(x, z), scale };
    this.spikes.push(m);
  }

  _updateZones(dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      if (z.follow) {
        z.x = z.follow.x;
        z.z = z.follow.z;
      }
      if (z.t < z.delay) continue;
      this.zones.splice(i, 1);
      const y = this.game.world.heightAt(z.x, z.z);
      const pos = _v.set(z.x, y + 0.3, z.z);
      // Effets visuels à l'impact
      const vis = z.visual || 'burst';
      if (['spike', 'bone', 'root', 'tentacle', 'ice', 'acidSpike', 'fireSpike', 'shadowSpike'].includes(vis)) {
        const kind = { acidSpike: 'acid', fireSpike: 'fire', shadowSpike: 'shadow' }[vis] || vis;
        this._eruption(z.x, z.z, kind, z.radius / 1.4);
        if (vis !== 'tentacle') this.game.effects.dust(pos, 6);
      } else if (vis === 'pillar') {
        const col = ELEMENT_COLORS[z.element] || 0xffffff;
        this.game.effects.beam(new THREE.Vector3(z.x, y, z.z), new THREE.Vector3(z.x, y + 14, z.z), col, z.radius * 0.6, 0.35);
        this.game.effects.flash(pos, col, 30, 10, 0.3);
      } else if (vis === 'lightning') {
        this.game.effects.lightning(z.x, z.z);
        audio.play('cast', { element: 'lightning', pos });
      }
      if (vis !== 'none') {
        this.game.effects.elementBurst(pos, z.element || 'physical', Math.max(0.6, z.radius / 2.5));
        this.game.effects.ring(pos, ELEMENT_COLORS[z.element] || 0xffaa66, z.radius * 1.1, 0.35);
      }
      if (!z.quiet) audio.play('explosion', { pos, big: z.radius > 3.5 });
      const shake = z.shake ?? Math.min(0.5, z.radius * 0.07);
      this.game.camRig.shake(shake);
      // Impacts puissants : onde de choc et fissures
      if (shake >= 0.3 && vis !== 'none') {
        this.game.effects.shockwave(pos, Math.min(1, shake * 1.4), ELEMENT_COLORS[z.element] || 0xffc080);
        if (z.radius >= 3 && (!z.element || z.element === 'physical' || z.element === 'fire' || z.element === 'shadow')) this.game.effects.cracks(pos, z.radius * 0.8);
      }
      // Dégâts
      for (const a of this.targetsFor(z.team)) {
        if (!a.alive) continue;
        let inside = false;
        const dx = a.pos.x - z.x;
        const dz = a.pos.z - z.z;
        if (!z.shape || z.shape === 'circle') inside = Math.hypot(dx, dz) <= z.radius + a.radius * 0.5;
        else if (z.shape === 'line') {
          const fx = Math.sin(z.dir);
          const fz = Math.cos(z.dir);
          const along = dx * fx + dz * fz;
          const side = Math.abs(dx * fz - dz * fx);
          inside = along >= -a.radius && along <= z.length + a.radius && side <= z.width / 2 + a.radius;
        } else if (z.shape === 'cone') {
          const d = Math.hypot(dx, dz);
          const ang = Math.abs(Math.atan2(dx, dz) - z.dir);
          const aa = Math.min(ang, Math.PI * 2 - ang);
          inside = d <= z.radius && aa <= z.angle;
        }
        if (!inside) continue;
        if (z.groundOnly && a.pos.y > this.game.world.heightAt(a.pos.x, a.pos.z) + 0.8) continue;
        this.hit(a, { amount: z.dmg, element: z.element, source: z.source, status: z.status, kind: 'aoe', canBlock: z.canBlock ?? true, poise: z.poise ?? 25, knock: z.knock ?? 6, dirX: dx, dirZ: dz, stun: z.stun, crit: z.crit });
      }
      if (z.onDone) z.onDone(z);
    }
    // Pics
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const m = this.spikes[i];
      const u = m.userData;
      u.t += dt;
      const k = u.t < 0.12 ? u.t / 0.12 : u.t < 0.8 ? 1 : Math.max(0, 1 - (u.t - 0.8) / 0.4);
      m.position.y = u.base - 3 * u.scale * (1 - k) - 0.2;
      if (u.t > 1.2) {
        m.visible = false;
        this.spikes.splice(i, 1);
      }
    }
  }

  // ---------------- Zones persistantes ----------------
  hazard(opts) {
    const m = this.hazardPool.find((h) => !h.visible);
    if (!m) return null;
    m.visible = true;
    m.material.color.setHex(ELEMENT_COLORS[opts.element] || 0x5aff3a);
    m.position.set(opts.x, this.game.world.heightAt(opts.x, opts.z) + 0.08, opts.z);
    m.scale.setScalar(opts.radius);
    const h = { ...opts, mesh: m, t: 0, tick: 0 };
    this.hazards.push(h);
    return h;
  }

  _updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      const fade = h.t < 0.3 ? h.t / 0.3 : h.t > h.duration - 0.6 ? Math.max(0, (h.duration - h.t) / 0.6) : 1;
      h.mesh.material.opacity = 0.35 * fade * (0.8 + Math.sin(h.t * 6) * 0.2);
      if (Math.random() < dt * 10 * this.game.particles.budget) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * h.radius;
        this.game.particles.spawn(h.x + Math.cos(a) * r, h.mesh.position.y, h.z + Math.sin(a) * r, 0, 0.8 + Math.random(), 0, 0.9, 0.35, ELEMENT_COLORS[h.element] || 0x5aff3a, { intensity: 1.5, drag: 0.97 });
      }
      h.tick -= dt;
      if (h.tick <= 0) {
        h.tick = 0.5;
        for (const a of this.actorsInRadius(h.x, h.z, h.radius, h.team)) {
          if (a.pos.y > this.game.world.heightAt(a.pos.x, a.pos.z) + 1) continue;
          this.hit(a, { amount: h.dps * 0.5, element: h.element, source: h.source, status: h.status, kind: 'hazard', canBlock: false, poise: 0, silent: true });
        }
      }
      if (h.t >= h.duration) {
        h.mesh.visible = false;
        this.hazards.splice(i, 1);
      }
    }
  }

  update(dt) {
    this._updateProjectiles(dt);
    this._updateZones(dt);
    this._updateHazards(dt);
  }

  clear() {
    for (const p of this.projectiles) p.mesh.visible = false;
    this.projectiles.length = 0;
    this.zones.length = 0;
    for (const h of this.hazards) h.mesh.visible = false;
    this.hazards.length = 0;
    for (const s of this.spikes) s.visible = false;
    this.spikes.length = 0;
  }
}

function blendRed(c) {
  const col = new THREE.Color(c);
  col.lerp(new THREE.Color(0xff2020), 0.45);
  return col.getHex();
}
