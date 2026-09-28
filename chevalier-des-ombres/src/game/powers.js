// Pouvoirs du chevalier et alliés invoqués (loups spectraux).
import * as THREE from 'three';
import { powerById } from '../data/skills.js';
import { Actor } from './actor.js';
import { buildQuadruped } from '../actors/models.js';
import { createSpectralMaterial } from '../gfx/materials.js';
import { ELEMENT_COLORS } from '../gfx/effects.js';
import { H_CLIPS } from '../actors/anims.js';
import { audio } from '../core/audio.js';
import { rand } from '../core/utils.js';

const CAST_ANIM = {
  projectile: 'cast', pierce: 'cast', homing: 'cast', chain: 'cast', drain: 'cast', wave: 'castAoe', strike: 'castUp',
  nova: 'castAoe', quake: 'castAoe', pillars: 'castUp', heal: 'castUp', shield: 'castUp', buff: 'castUp', summon: 'castUp', meteor: 'castUp', cloud: 'cast',
};

export class Powers {
  constructor(game) {
    this.game = game;
    this.channels = [];
  }

  tryCast(id, player) {
    const g = this.game;
    const pw = powerById(id);
    if (!pw) return;
    if ((player.cooldowns[id] || 0) > 0) return g.hud.toast(pw.name + ' : en recharge', true);
    if (player.mana < pw.mana) return g.hud.toast('Pas assez de mana', true);
    player.mana -= pw.mana;
    player.cooldowns[id] = pw.cd * player.stats.cooldownMul;
    player.cooldownMax = player.cooldownMax || {};
    player.cooldownMax[id] = player.cooldowns[id];
    if (pw.type === 'dash') {
      this.execute(pw, player);
      return;
    }
    const anim = CAST_ANIM[pw.type] || 'cast';
    player.state = 'cast';
    player.pendingPower = pw;
    player.castAt = H_CLIPS[anim].hit[0];
    player.anim.play(anim, 1.25);
    // Oriente vers la cible
    const t = this.aimTarget(player);
    if (t) player.faceTowards(t.pos.x, t.pos.z, -1, 0);
    else if (g.camRig.mode === 'first' || !player.moving) player.yaw = g.camRig.yaw;
    audio.play('cast', { pos: player.pos, element: pw.element });
    g.particles.burst({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z }, ELEMENT_COLORS[pw.element] || 0x4dd8ff, 12, 2, 0.3, 0.5, { intensity: 2 });
  }

  aimTarget(player, range = 22) {
    if (player.lockTarget && player.lockTarget.alive) return player.lockTarget;
    const g = this.game;
    const yaw = g.camRig.mode === 'first' ? g.camRig.yaw : player.moving ? player.yaw : g.camRig.yaw;
    return g.nearestEnemy(player.pos, range, yaw, 0.9);
  }

  _dmg(pw, player) {
    const st = player.stats;
    let d = pw.dmg * st.magicMul;
    const crit = st.spellCrit > 0 && Math.random() < st.crit + st.spellCrit;
    if (crit) d *= st.critMul;
    if (player.buffs.berserk) d *= 1.2;
    return { d, crit };
  }

  execute(pw, player) {
    const g = this.game;
    const target = this.aimTarget(player);
    const hand = new THREE.Vector3(player.pos.x + player.forwardX * 0.8, player.pos.y + 1.4, player.pos.z + player.forwardZ * 0.8);
    const dirTo = (t) => {
      if (t) return new THREE.Vector3(t.pos.x - hand.x, t.pos.y + t.height * 0.5 + t.hover - hand.y, t.pos.z - hand.z).normalize();
      if (g.camRig.mode === 'first') {
        const d = new THREE.Vector3();
        g.camera.getWorldDirection(d);
        return d;
      }
      return new THREE.Vector3(player.forwardX, 0, player.forwardZ);
    };
    const { d: dmg, crit } = this._dmg(pw, player);
    const col = ELEMENT_COLORS[pw.element] || 0x4dd8ff;
    const status = { fire: { burn: 4 }, frost: { slow: 3 }, poison: { poison: 5 }, lightning: { shock: 1 } }[pw.element];
    switch (pw.type) {
      case 'projectile':
        g.combat.projectile({ type: pw.id === 'bone_spear' ? 'bone' : 'fireball', from: hand, dir: dirTo(target), team: 'player', dmg, element: pw.element, status, source: player, explode: pw.radius, speed: pw.speed, crit, poise: 25 });
        break;
      case 'pierce':
        g.combat.projectile({ type: 'iceLance', from: hand, dir: dirTo(target), team: 'player', dmg, element: 'frost', status: { slow: 3 }, source: player, pierce: true, speed: pw.speed, crit, poise: 20 });
        break;
      case 'homing': {
        const foes = g.enemies.filter((e) => e.alive && e.distTo(player) < 25).sort((a, b) => a.distTo(player) - b.distTo(player));
        for (let i = 0; i < pw.count; i++) {
          const t = foes[i % Math.max(1, foes.length)] || null;
          const ang = player.yaw + (i - 1) * 0.6;
          g.combat.projectile({ type: 'blade', from: hand.clone().add(new THREE.Vector3(Math.cos(ang) * 0.5, i * 0.2, -Math.sin(ang) * 0.5)), dir: new THREE.Vector3(Math.sin(ang), 0.3, Math.cos(ang)).normalize(), team: 'player', dmg, element: 'shadow', homing: 4, homingTarget: t, source: player, speed: pw.speed, crit, life: 4, poise: 10 });
        }
        break;
      }
      case 'strike': {
        const p = target ? target.pos : { x: player.pos.x + player.forwardX * 8, z: player.pos.z + player.forwardZ * 8 };
        g.combat.zone({ x: p.x, z: p.z, radius: pw.radius, delay: 0.15, dmg, element: 'lightning', team: 'player', source: player, visual: 'lightning', status: { shock: 1 }, crit, poise: 40, shake: 0.3 });
        break;
      }
      case 'nova':
        g.combat.zone({ x: player.pos.x, z: player.pos.z, radius: pw.radius, delay: 0.05, dmg, element: 'frost', team: 'player', source: player, status: { freeze: 2.5 }, crit, poise: 30 });
        g.effects.ring(player.pos, 0xbfe8ff, pw.radius * 1.2, 0.5, 0.5);
        break;
      case 'quake':
        g.combat.zone({ x: player.pos.x, z: player.pos.z, radius: pw.radius, delay: 0.05, dmg, element: 'physical', team: 'player', source: player, stun: 2, crit, poise: 80, shake: 0.7 });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          g.combat.zone({ x: player.pos.x + Math.cos(a) * 5, z: player.pos.z + Math.sin(a) * 5, radius: 1.2, delay: 0.1 + i * 0.02, dmg: 0, team: 'player', source: player, visual: 'spike', quiet: true });
        }
        break;
      case 'meteor': {
        const c = target ? target.pos : { x: player.pos.x + player.forwardX * 9, z: player.pos.z + player.forwardZ * 9 };
        for (let i = 0; i < pw.count; i++) {
          const a = rand(0, Math.PI * 2);
          const r = i === 0 ? 0 : rand(1, 5);
          g.combat.zone({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, radius: pw.radius, delay: 0.7 + i * 0.18, dmg, element: 'fire', team: 'player', source: player, visual: 'meteor', status: { burn: 4 }, crit, poise: 40 });
        }
        break;
      }
      case 'heal':
        player.heal(player.maxHp * pw.heal);
        g.effects.souls({ x: player.pos.x, y: player.pos.y, z: player.pos.z }, 24);
        g.effects.ring(player.pos, 0xffe89a, pw.radius * 1.2, 0.6, 0.3);
        g.effects.flash(player.pos, 0xffe89a, 40, 12, 0.5);
        for (const e of g.combat.actorsInRadius(player.pos.x, player.pos.z, pw.radius, 'player')) if (e.undead) g.combat.hit(e, { amount: dmg * 1.5, element: 'holy', source: player, poise: 30 });
        break;
      case 'cloud': {
        const p = target ? target.pos : { x: player.pos.x + player.forwardX * 6, z: player.pos.z + player.forwardZ * 6 };
        g.combat.hazard({ x: p.x, z: p.z, radius: pw.radius, duration: pw.duration, dps: dmg * 2, element: 'poison', team: 'player', source: player, status: { poison: 4 } });
        break;
      }
      case 'shield':
        player.buffs.soulShield = { t: pw.duration, absorb: pw.absorb };
        g.effects.ring(player.pos, 0x4dd8ff, 3, 0.6, 1);
        g.hud.toast('Bouclier d’âmes actif');
        break;
      case 'buff':
        player.buffs.berserk = { t: pw.duration };
        g.effects.flash(player.pos, 0xff2244, 40, 10, 0.5);
        g.particles.burst({ x: player.pos.x, y: player.pos.y + 1, z: player.pos.z }, 0xff2244, 30, 4, 0.4, 0.8, { intensity: 2 });
        g.hud.toast('Rage du berserker !');
        audio.play('roar', { pos: player.pos });
        break;
      case 'chain': {
        let from = hand.clone();
        let cur = target || g.nearestEnemy(player.pos, pw.range, null);
        const hit = new Set();
        let k = 1;
        for (let i = 0; i < pw.bounces && cur; i++) {
          const to = new THREE.Vector3(cur.pos.x, cur.pos.y + cur.height * 0.6 + cur.hover, cur.pos.z);
          g.effects.beam(from, to, 0xb8d8ff, 0.1, 0.25);
          g.combat.hit(cur, { amount: dmg * k, element: 'lightning', source: player, crit, poise: 20, status: { shock: 1 } });
          hit.add(cur.id);
          from = to;
          k *= 0.85;
          cur = g.enemies.filter((e) => e.alive && !hit.has(e.id) && e.distTo(cur) < pw.range * 0.7).sort((a, b) => a.distTo(cur) - b.distTo(cur))[0];
        }
        g.effects.flash(player.pos, 0xb8d8ff, 40, 12, 0.3);
        break;
      }
      case 'dash': {
        player.state = 'roll';
        player.rollT = 0;
        player.rollDur = 0.3;
        player.backstep = false;
        const fx = player.moving ? player.forwardX : Math.sin(g.camRig.yaw);
        const fz = player.moving ? player.forwardZ : Math.cos(g.camRig.yaw);
        player.rollDir.set(fx, 0, fz);
        player.yaw = Math.atan2(fx, fz);
        player.iframes = 0.45;
        player.anim.play('roll', 2);
        const start = player.pos.clone();
        const hitSet = new Set();
        for (let i = 0; i < 10; i++) {
          const k = i / 9;
          const px = start.x + fx * pw.range * k;
          const pz = start.z + fz * pw.range * k;
          g.particles.spawn(px, player.pos.y + 1, pz, 0, 0.5, 0, 0.6, 0.6, 0xa04dff, { intensity: 2 });
          for (const e of g.combat.actorsInRadius(px, pz, 1.5, 'player')) {
            if (hitSet.has(e.id)) continue;
            hitSet.add(e.id);
            g.combat.hit(e, { amount: dmg, element: 'shadow', source: player, crit, poise: 25 });
          }
        }
        // Déplacement rapide (vitesse de roulade accrue)
        player.dashBoost = pw.range / 0.3;
        audio.play('cast', { pos: player.pos, element: 'shadow' });
        break;
      }
      case 'summon':
        for (let i = 0; i < pw.count; i++) {
          const a = player.yaw + (i ? 1.2 : -1.2);
          g.spawnAlly(player.pos.x + Math.sin(a) * 2, player.pos.z + Math.cos(a) * 2, pw);
        }
        break;
      case 'drain': {
        const t = target;
        if (!t) {
          g.hud.toast('Aucune cible', true);
          break;
        }
        this.channels.push({ pw, target: t, t: 0, tick: 0, dmg });
        break;
      }
      case 'pillars':
        for (let i = 0; i < pw.count; i++) {
          const a = (i / pw.count) * Math.PI * 2;
          const r = pw.radius * (0.4 + (i % 2) * 0.5);
          g.combat.zone({ x: player.pos.x + Math.cos(a) * r, z: player.pos.z + Math.sin(a) * r, radius: 2.4, delay: 0.3 + i * 0.08, dmg, element: 'holy', team: 'player', source: player, visual: 'pillar', crit, poise: 40 });
        }
        break;
      case 'wave':
        g.combat.zone({ x: player.pos.x, z: player.pos.z, radius: pw.range, delay: 0.25, dmg, element: 'shadow', team: 'player', source: player, shape: 'cone', dir: player.yaw, angle: pw.angle, crit, poise: 80, shake: 0.6 });
        for (let i = 0; i < 6; i++) {
          const a = player.yaw + (i / 5 - 0.5) * pw.angle * 1.6;
          g.combat.projectile({ type: 'shadowWave', from: player.pos.clone(), dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), team: 'none', dmg: 0, speed: 20, life: 0.7 });
        }
        break;
      default:
    }
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    for (let i = this.channels.length - 1; i >= 0; i--) {
      const c = this.channels[i];
      c.t += dt;
      if (!c.target.alive || !p.alive || c.t > c.pw.duration || c.target.distTo(p) > c.pw.range + 3) {
        this.channels.splice(i, 1);
        continue;
      }
      const from = new THREE.Vector3(p.pos.x, p.pos.y + 1.3, p.pos.z);
      const to = new THREE.Vector3(c.target.pos.x, c.target.pos.y + c.target.height * 0.6, c.target.pos.z);
      g.effects.beam(to, from, 0xff2244, 0.14, 0.05);
      c.tick -= dt;
      if (c.tick <= 0) {
        c.tick = 0.3;
        const r = g.combat.hit(c.target, { amount: c.dmg * 0.3, element: 'blood', source: p, poise: 3 });
        if (r && r.dmg) p.heal(r.dmg * 0.8);
      }
    }
  }
}

// ---------------- Alliés ----------------
export class Ally extends Actor {
  constructor(game, x, z, pw) {
    super(game, 'player');
    this.radius = 0.5;
    this.scale = 1.1;
    this.pos.set(x, game.world.heightAt(x, z), z);
    this.maxHp = this.hp = 60 + game.player.maxHp * 0.3;
    this.life = pw.duration;
    this.dmg = pw.dmg * game.player.stats.magicMul;
    this.kind = 'spirit';
    this.atkCd = 0;
    this.remove = false;
    const built = buildQuadruped({ type: 'wolf', c: { main: 0x6a4dff, belly: 0x9a7aff, eyes: 0xffffff } }, createSpectralMaterial(0x8a6aff, { fadeLow: 0 }));
    built.mesh.castShadow = false;
    this.setModel(built, {});
    this.height = 1;
  }

  receiveHit(info) {
    if (!this.alive) return null;
    this.hp -= info.amount;
    if (this.hp <= 0) this.alive = false;
    return { dmg: info.amount };
  }

  update(dt) {
    const g = this.game;
    this.life -= dt;
    if (!this.alive || this.life <= 0) {
      this.alive = false;
      this.dissolve = Math.min(1, this.dissolve + dt * 1.5);
      if (this.mat.uniforms) this.mat.uniforms.uDissolve.value = this.dissolve;
      this.updateVisual(dt);
      if (this.dissolve >= 1) this.remove = true;
      return;
    }
    this.atkCd -= dt;
    const target = g.nearestEnemy(this.pos, 14, null);
    let speed = 0;
    if (target) {
      const d = this.distTo(target);
      this.faceTowards(target.pos.x, target.pos.z, 10, dt);
      if (d > 1.8 + target.radius) speed = 8;
      else if (this.atkCd <= 0) {
        this.atkCd = 1;
        this.anim.play('bite', 1, { dur: 0.5 });
        g.combat.hit(target, { amount: this.dmg, element: 'shadow', source: this, poise: 12 });
      }
    } else {
      const p = g.player;
      const d = this.distTo(p);
      if (d > 3.5) {
        this.faceTowards(p.pos.x, p.pos.z, 8, dt);
        speed = d > 8 ? 8 : 5;
      }
    }
    this.pos.x += Math.sin(this.yaw) * speed * dt;
    this.pos.z += Math.cos(this.yaw) * speed * dt;
    g.world.colliders.resolve(this.pos, this.radius);
    this.pos.y = g.world.heightAt(this.pos.x, this.pos.z);
    this.anim.update(dt, { speed });
    this.updateVisual(dt);
  }
}
