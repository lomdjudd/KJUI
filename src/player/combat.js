import * as THREE from 'three';
import * as A from './anims.js';
import { clamp } from '../engine/utils.js';

// ---------- Styles de combat ----------
export const STYLES = [
  {
    key: 'classique',
    name: 'Classique',
    desc: 'Équilibré : enchaînements poings-pieds, projection finale.',
    color: '#e23636',
    speed: 1,
    dmgMul: 1,
    combo: [
      { anim: 'jabL', dur: 0.3, hit: 0.09, dmg: 10, knock: 2.5, range: 2.4, sfx: 'punch' },
      { anim: 'crossR', dur: 0.3, hit: 0.09, dmg: 11, knock: 2.5, range: 2.4, sfx: 'punch' },
      { anim: 'hookL', dur: 0.34, hit: 0.11, dmg: 12, knock: 3, range: 2.5, sfx: 'punch' },
      { anim: 'roundhouse', dur: 0.5, hit: 0.2, dmg: 20, knock: 14, range: 2.9, sfx: 'kick', arc: 2.6, finale: true },
    ],
    launcher: { anim: 'uppercutR', dur: 0.42, hit: 0.14, dmg: 12, launch: 13, range: 2.5, sfx: 'heavy' },
    air: [
      { anim: 'airKick', dur: 0.3, hit: 0.1, dmg: 10, knock: 1, range: 2.8, sfx: 'kick' },
      { anim: 'jabL', dur: 0.28, hit: 0.08, dmg: 9, knock: 1, range: 2.6, sfx: 'punch' },
      { anim: 'crossR', dur: 0.28, hit: 0.08, dmg: 9, knock: 1, range: 2.6, sfx: 'punch' },
      { anim: 'slam', dur: 0.5, hit: 0.18, dmg: 18, knock: 3, range: 3, sfx: 'heavy', spike: true },
    ],
    finisher: { anim: 'uppercutR', launch: 22 },
  },
  {
    key: 'acrobate',
    name: 'Acrobate',
    desc: 'Très rapide et aérien : saltos, coups de pied tournoyants, esquives longues.',
    color: '#d8d8e0',
    speed: 1.3,
    dmgMul: 0.8,
    dodgeBonus: 0.15,
    combo: [
      { anim: 'frontKick', dur: 0.3, hit: 0.1, dmg: 9, knock: 2.5, range: 2.8, sfx: 'kick' },
      { anim: 'jabL', dur: 0.24, hit: 0.07, dmg: 8, knock: 2, range: 2.4, sfx: 'punch' },
      { anim: 'spinKick', dur: 0.42, hit: 0.2, dmg: 12, knock: 4, range: 3.0, sfx: 'kick', arc: 6.3 },
      { anim: 'crossR', dur: 0.24, hit: 0.07, dmg: 8, knock: 2, range: 2.4, sfx: 'punch' },
      { anim: 'flipKick', dur: 0.55, hit: 0.22, dmg: 14, launch: 12, range: 2.8, sfx: 'kick', finale: true },
    ],
    launcher: { anim: 'flipKick', dur: 0.5, hit: 0.2, dmg: 10, launch: 14, range: 2.8, sfx: 'kick' },
    air: [
      { anim: 'spinKick', dur: 0.36, hit: 0.15, dmg: 10, knock: 1, range: 3.2, sfx: 'kick', arc: 6.3 },
      { anim: 'airKick', dur: 0.26, hit: 0.08, dmg: 9, knock: 1, range: 3, sfx: 'kick' },
      { anim: 'flipKick', dur: 0.45, hit: 0.18, dmg: 11, knock: 1, range: 3, sfx: 'kick' },
    ],
    finisher: { anim: 'spinKick', launch: 16 },
  },
  {
    key: 'brute',
    name: 'Brute',
    desc: 'Lent mais dévastateur : brise la garde des costauds, onde de choc au sol.',
    color: '#e0a82a',
    speed: 0.82,
    dmgMul: 1.7,
    breakGuard: true,
    combo: [
      { anim: 'heavyR', dur: 0.46, hit: 0.2, dmg: 13, knock: 5, range: 2.6, sfx: 'heavy' },
      { anim: 'heavyL', dur: 0.46, hit: 0.2, dmg: 13, knock: 5, range: 2.6, sfx: 'heavy' },
      { anim: 'slam', dur: 0.7, hit: 0.3, dmg: 20, knock: 12, range: 4.8, sfx: 'heavy', arc: 6.3, shock: true, finale: true },
    ],
    launcher: { anim: 'uppercutR', dur: 0.5, hit: 0.18, dmg: 16, launch: 12, range: 2.6, sfx: 'heavy' },
    air: [
      { anim: 'heavyR', dur: 0.4, hit: 0.16, dmg: 12, knock: 1, range: 2.8, sfx: 'heavy' },
      { anim: 'slam', dur: 0.55, hit: 0.2, dmg: 16, knock: 3, range: 3.2, sfx: 'heavy', spike: true },
    ],
    finisher: { anim: 'slam', launch: 4 },
  },
  {
    key: 'tisseur',
    name: 'Tisseur',
    desc: 'Combat à la toile : longue portée, chaque coup entoile les ennemis.',
    color: '#4f7dff',
    speed: 1.05,
    dmgMul: 0.8,
    combo: [
      { anim: 'webWhip', dur: 0.36, hit: 0.13, dmg: 8, knock: 3, range: 5.5, sfx: 'webshot', web: 1, webLine: true },
      { anim: 'webWhip', dur: 0.36, hit: 0.13, dmg: 8, knock: 3, range: 5.5, sfx: 'webshot', web: 1, webLine: true },
      { anim: 'webPull', dur: 0.42, hit: 0.14, dmg: 9, knock: -9, range: 7, sfx: 'thwip', web: 1, webLine: true },
      { anim: 'webSpin', dur: 0.6, hit: 0.3, dmg: 14, knock: 10, range: 5.5, sfx: 'whoosh', arc: 6.3, web: 1, finale: true },
    ],
    launcher: { anim: 'webWhip', dur: 0.45, hit: 0.15, dmg: 8, launch: 13, range: 5.5, sfx: 'thwip', web: 1, webLine: true },
    air: [
      { anim: 'webWhip', dur: 0.32, hit: 0.12, dmg: 8, knock: 1, range: 5, sfx: 'webshot', web: 1, webLine: true },
      { anim: 'webSpin', dur: 0.45, hit: 0.2, dmg: 10, knock: 1, range: 5, sfx: 'whoosh', arc: 6.3, web: 1 },
    ],
    finisher: { anim: 'webSpin', launch: 3, web: 99 },
  },
];

export const GADGETS = [
  { key: 'webbomb', name: 'Bombe de toile', cd: 8, color: '#ffffff' },
  { key: 'shock', name: 'Choc électrique', cd: 10, color: '#7fd8ff' },
  { key: 'drone', name: 'Drone araignée', cd: 22, color: '#ffcf4a' },
  { key: 'impact', name: "Toile d'impact", cd: 6, color: '#b5f0ff' },
];

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Combat {
  constructor(game) {
    this.game = game;
    this.styleIndex = 0;
    this.gadgetIndex = 0;
    this.gadgetCd = GADGETS.map(() => 0);
    this.combo = 0;
    this.comboTimer = 0;
    this.comboIdx = 0;
    this.lastAttackEnd = -99;
    this.attackBuffer = 0;
    this.holdT = 0;
    this.launchedThisPress = false;
    this.webCd = 0;
    this.counterT = 0;
    this.inCombat = false;
    this.drone = null;
    this.target = null;
    this.bestCombo = 0;
    this.dmgMul = 1;
  }

  get style() {
    return STYLES[this.styleIndex];
  }

  get gadget() {
    return GADGETS[this.gadgetIndex];
  }

  setStyle(i) {
    if (i < 0 || i >= STYLES.length) return;
    this.styleIndex = i;
    this.game.player.setSuit(STYLES[i].key);
    this.game.hud.styleChanged(STYLES[i]);
    this.game.audio.play('ui');
  }

  onPlayerHurt() {
    if (this.combo > 3) this.game.hud.comboBreak();
    this.combo = 0;
  }

  // Choix de la cible : proximité + direction de l'entrée
  selectTarget(maxRange, preferDir = null) {
    const p = this.game.player;
    let best = null;
    let bestScore = Infinity;
    const list = this.game.targets();
    for (const e of list) {
      _v.subVectors(e.pos, p.pos);
      const dy = Math.abs(_v.y);
      _v.y = 0;
      const d = _v.length();
      if (d > maxRange || dy > Math.max(6, maxRange * 0.6)) continue;
      let score = d + dy * 0.5;
      if (preferDir && d > 0.1) {
        const dot = (_v.x * preferDir.x + _v.z * preferDir.z) / d;
        score += (1 - dot) * 5;
      }
      if (e.state === 'dead') continue;
      if (e.state === 'webbed') score += 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  _prefer() {
    const p = this.game.player;
    const amt = p.wishDir(this.game.input, _v2);
    if (amt > 0.2) return _v2.normalize().clone();
    const yaw = this.game.cam.yaw;
    return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  }

  update(dt, input) {
    const game = this.game;
    const p = game.player;
    const st = this.style;
    this.webCd -= dt;
    this.counterT -= dt;
    this.attackBuffer -= dt;
    this.comboTimer -= dt;
    for (let i = 0; i < this.gadgetCd.length; i++) this.gadgetCd[i] = Math.max(0, this.gadgetCd[i] - dt);
    if (this.comboTimer <= 0 && this.combo > 0) this.combo = 0;
    this.inCombat = game.enemies.engagedCount(p.pos, 40) > 0 || (game.boss && game.boss.active);
    if (this.inCombat) p.lastCombat = p.time;

    // Styles & gadgets
    for (let i = 0; i < 4; i++) if (input.wasPressed(`style${i + 1}`)) this.setStyle(i);
    if (input.wasPressed('styleNext')) this.setStyle((this.styleIndex + 1) % STYLES.length);
    if (input.wasPressed('stylePrev')) this.setStyle((this.styleIndex + STYLES.length - 1) % STYLES.length);
    if (input.wasPressed('gadgetNext')) {
      this.gadgetIndex = (this.gadgetIndex + 1) % GADGETS.length;
      game.hud.gadgetChanged(this.gadget);
      game.audio.play('ui');
    }

    const a = p.action;
    if (input.wasPressed('attack')) {
      this.attackBuffer = 0.3;
      this.holdT = 0;
      this.launchedThisPress = false;
    }
    if (input.isDown('attack')) this.holdT += dt;

    // --- Action en cours ---
    if (a) {
      a.t += dt;
      this._runAction(a, dt);
      if (a.t >= a.dur) {
        p.action = null;
        if (a.kind === 'attack') this.lastAttackEnd = p.time;
        if (a.after) a.after();
      }
    }

    const cur = p.action;
    const canCancel = !cur || (cur.kind === 'attack' && cur.t > cur.hitT + 0.04) || (cur.kind === 'dodge' && cur.t > cur.dur * 0.7);

    // Esquive
    if (input.wasPressed('dodge') && (!cur || cur.kind === 'attack' || cur.kind === 'hit' && cur.t > 0.15)) {
      this._dodge();
      return;
    }
    // Soin
    if (input.wasPressed('heal')) this._heal();
    // Coup de grâce
    if (input.wasPressed('finisher') && canCancel) {
      if (this._finisher()) return;
    }
    // Gadget
    if (input.wasPressed('gadget')) this._useGadget();
    // Tir de toile
    if (input.wasPressed('webShoot') && this.webCd <= 0 && (!cur || cur.kind !== 'strike')) this._webShoot();
    // Frappe-toile (sauf si la touche a servi à interagir)
    if (input.wasPressed('webStrike') && canCancel && !game.interactConsumed) {
      if (this._webStrike()) return;
    }

    // Projection (maintenir attaque)
    if (input.isDown('attack') && this.holdT > 0.28 && !this.launchedThisPress && (!p.action || p.action.kind === 'attack')) {
      const t = this.selectTarget(4, this._prefer());
      if (t && !p.inAir && t.state !== 'air' && !t.isBoss) {
        this.launchedThisPress = true;
        this._startAttack(st.launcher, t, { launcher: true });
        return;
      }
    }
    // Attaque normale
    if (this.attackBuffer > 0 && canCancel) {
      this.attackBuffer = 0;
      const air = p.state === 'air' || p.state === 'swing';
      const t = this.selectTarget(air ? 7 : 13, this._prefer());
      if (air && !t) {
        return;
      }
      const list = air ? st.air : st.combo;
      if (p.time - this.lastAttackEnd > 0.6 && (!cur || cur.kind !== 'attack')) this.comboIdx = 0;
      const def = list[this.comboIdx % list.length];
      this.comboIdx = (this.comboIdx + 1) % list.length;
      this._startAttack(def, t, { air });
    }
  }

  _startAttack(def, target, { air = false, launcher = false } = {}) {
    const p = this.game.player;
    const sp = this.style.speed;
    const a = {
      kind: 'attack',
      def,
      t: 0,
      dur: def.dur / sp,
      hitT: def.hit / sp,
      lock: true,
      target,
      hover: air || p.state === 'air',
      hit: false,
      launcher,
      vel: { x: 0, z: 0, y: air ? 0 : null },
    };
    if (p.state === 'swing' || p.state === 'wall' || p.state === 'zip') p.setState('air');
    if (target) {
      _v.subVectors(target.pos, p.pos);
      const dy = _v.y;
      _v.y = 0;
      const d = _v.length();
      if (d > 0.01) _v.multiplyScalar(1 / d);
      a.face = Math.atan2(_v.x, _v.z);
      p.facing = a.face;
      // Rapprochement éclair vers la cible
      const gap = d - def.range * 0.75;
      if (gap > 0.3) {
        const dashSpeed = 34;
        a.dash = Math.min(0.42, gap / dashSpeed);
        a.dashVel = { x: _v.x * dashSpeed, z: _v.z * dashSpeed };
        if (a.hover) a.dashVel.y = clamp(dy / Math.max(0.05, a.dash), -20, 20);
        this.game.audio.play('whoosh', 0.5);
      }
    }
    p.action = a;
  }

  _runAction(a, dt) {
    const p = this.game.player;
    switch (a.kind) {
      case 'attack': {
        if (a.dash > 0) {
          a.dash -= dt;
          a.t -= dt; // l'attaque attend la fin du rapprochement
          a.vel.x = a.dashVel.x;
          a.vel.z = a.dashVel.z;
          if (a.hover) a.vel.y = a.dashVel.y || 0;
          a.pose = A.attackPose(a.def.anim, 0, a.dur, a.hitT);
          if (a.target && a.target.alive) {
            const tgt = a.target.pos;
            a.face = Math.atan2(tgt.x - p.pos.x, tgt.z - p.pos.z);
          }
          break;
        }
        a.vel.x = 0;
        a.vel.z = 0;
        if (a.hover) a.vel.y = 0;
        else a.vel.y = null;
        a.pose = A.attackPose(a.def.anim, a.t, a.dur, a.hitT);
        if (!a.hit && a.t >= a.hitT) {
          a.hit = true;
          this._resolveHit(a);
        }
        break;
      }
      case 'dodge': {
        const k = a.t / a.dur;
        const s = (1 - k) * a.speed;
        a.vel.x = a.dir.x * s;
        a.vel.z = a.dir.z * s;
        a.iframes = a.t < a.iDur;
        a.pose = A.dodgePose(a.anim, Math.min(1, k * 1.15));
        break;
      }
      case 'hit': {
        a.pose = A.hit(Math.min(1, a.t / a.dur));
        const k = 1 - a.t / a.dur;
        if (a.vel) {
          a.vel.x *= 1 - Math.min(1, 5 * dt);
          a.vel.z *= 1 - Math.min(1, 5 * dt);
          if (a.vel.y !== null && a.vel.y !== undefined) a.vel.y = null;
        }
        if (k < 0) a.pose = A.guard(p.time);
        break;
      }
      case 'strike': {
        const tgt = a.target;
        if (!tgt || !tgt.targetable) {
          a.t = a.dur;
          this.game.webs.release(a.line);
          break;
        }
        _v.subVectors(tgt.chest || tgt.pos, p.chestPos);
        const d = _v.length();
        const hand = p.rig.handWorld('r', _v2);
        this.game.webs.update(a.line, hand, tgt.chest || tgt.pos, 0.02);
        if (!a.hit) {
          a.dur = a.t + 1; // prolongé jusqu'à l'impact
          _v.multiplyScalar(1 / Math.max(0.01, d));
          const sp = Math.min(46, 18 + a.t * 120);
          a.vel.x = _v.x * sp;
          a.vel.z = _v.z * sp;
          a.vel.y = _v.y * sp;
          a.face = Math.atan2(_v.x, _v.z);
          a.pose = d < 5 ? A.attackPose('dropKick', 0.2, 0.4, 0.1) : A.zip(p.time);
          if (d < 2.0 || a.t > 1.6) {
            a.hit = true;
            a.dur = a.t + 0.35;
            this.game.webs.release(a.line);
            a.line = null;
            const dir = _v.clone().setY(0).normalize();
            this._applyHit(tgt, { dmg: 16, knock: 11, stagger: 0.7, dir, sfx: 'kick', breakGuard: true }, 1.2);
            a.vel.x = -dir.x * 6;
            a.vel.z = -dir.z * 6;
            a.vel.y = 6;
          }
        } else {
          a.pose = A.jump(4);
          a.vel.y = null;
        }
        break;
      }
      case 'finisher': {
        const def = a.def;
        a.pose = A.attackPose(def.anim, a.t * 0.6, a.dur * 0.6, 0.3);
        if (!a.hit && a.t > 0.45) {
          a.hit = true;
          const tgt = a.target;
          if (tgt && tgt.targetable) {
            const dir = _v.subVectors(tgt.pos, p.pos).setY(0).normalize().clone();
            const dmg = tgt.isBoss ? 90 : 9999;
            tgt.hit({ dmg, dir, knock: 18, launch: def.launch, source: 'finisher', breakGuard: true, web: def.web });
            this.game.fx.explosion(tgt.chest, 0.4);
            this.game.fx.impact(tgt.chest, '#ffffff');
            this.game.audio.play('finisher');
            this.game.cam.shake(0.8);
            this.game.hud.floatText(tgt.chest, 'K.O. !', '#ffd23f', true);
            this.game.slowmo(0.6, 0.25);
          }
        }
        break;
      }
      case 'heal': {
        a.pose = A.guard(p.time);
        break;
      }
    }
  }

  _resolveHit(a) {
    const p = this.game.player;
    const def = a.def;
    const f = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
    const arc = def.arc || 1.9;
    let hits = 0;
    for (const e of this.game.targets()) {
      if (!e.targetable || e.state === 'dead') continue;
      _v.subVectors(e.pos, p.pos);
      const dy = _v.y;
      _v.y = 0;
      const d = _v.length();
      const range = def.range + (e.radius || 0.4) + (e === a.target ? 0.6 : 0);
      if (d > range) continue;
      if (Math.abs(dy) > (a.hover ? 3 : 2.2) && !(e.isBoss && e.stunned)) continue;
      if (d > 0.3) {
        const ang = Math.acos(clamp((_v.x * f.x + _v.z * f.z) / d, -1, 1));
        if (ang > arc / 2 && e !== a.target) continue;
      }
      const dir = d > 0.01 ? _v.clone().multiplyScalar(1 / d) : f.clone();
      const info = {
        dmg: def.dmg,
        knock: def.knock,
        launch: def.launch,
        dir,
        stagger: def.finale ? 0.8 : 0.45,
        web: def.web,
        spike: def.spike,
        sfx: def.sfx,
        breakGuard: this.style.breakGuard || def.shock,
      };
      if (def.spike && e.state === 'air') info.launch = -18;
      if (a.hover && !def.spike) info.airLift = 4;
      this._applyHit(e, info, def.finale ? 1.4 : 1);
      if (def.webLine) {
        const hand = p.rig.handWorld('r', new THREE.Vector3());
        this.game.webs.flash(hand, e.chest.clone(), 0.15);
      }
      hits++;
    }
    if (def.shock) {
      this.game.fx.dust(p.pos, 18);
      this.game.cam.shake(0.5);
    }
    if (a.launcher && hits) {
      // le joueur suit l'ennemi projeté
      a.after = () => {
        if (this.game.input.isDown('attack') || this.game.input.isDown('jump')) {
          p.vel.y = 13.5;
          p.setState('air');
        }
      };
    }
    if (!hits) this.game.audio.play('whoosh', 0.5);
  }

  _applyHit(e, info, shake = 1) {
    const counter = this.counterT > 0 ? 1.5 : 1;
    const dmg = info.dmg * this.style.dmgMul * this.dmgMul * counter;
    const r = e.hit({ ...info, dmg, source: 'melee' });
    const p = this.game.player;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = 2.8;
    p.focus = Math.min(100, p.focus + (r.blocked ? 1 : 3 + Math.min(this.combo, 25) * 0.25));
    p.lastCombat = p.time;
    const fx = this.game.fx;
    fx.sparks(e.chest, r.blocked ? 6 : 14, r.blocked ? '#9fd0ff' : '#ffd27a', 9);
    fx.impact(e.chest, r.blocked ? '#9fd0ff' : '#ffffff');
    this.game.audio.play(r.blocked ? 'block' : info.sfx || 'punch');
    this.game.hitstop(r.killed ? 0.1 : 0.045);
    this.game.cam.shake(0.12 * shake + (r.killed ? 0.2 : 0));
    this.game.hud.damage(e.chest, Math.round(dmg), r.killed);
    this.game.hud.comboUpdate(this.combo);
    return r;
  }

  _dodge() {
    const game = this.game;
    const p = game.player;
    const dir = new THREE.Vector3();
    const amt = p.wishDir(game.input, dir);
    const f = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
    if (amt < 0.2) dir.copy(f).multiplyScalar(-1);
    else dir.normalize();
    const dot = dir.dot(f);
    const cross = f.x * dir.z - f.z * dir.x;
    let anim;
    if (dot > 0.7) anim = 'front';
    else if (dot < -0.7) anim = 'back';
    else anim = cross > 0 ? 'right' : 'left';
    const bonus = this.style.dodgeBonus || 0;
    p.action = {
      kind: 'dodge',
      t: 0,
      dur: 0.45 + bonus,
      iDur: 0.38 + bonus,
      iframes: true,
      lock: true,
      dir,
      anim,
      speed: 16,
      vel: { x: 0, z: 0, y: p.inAir ? 1 : null },
      hover: p.inAir,
    };
    if (p.state === 'swing' || p.state === 'wall' || p.state === 'zip') p.setState('air');
    game.audio.play('whoosh', 0.8);
    // Esquive parfaite : le coup allait tomber
    const threat = Math.min(game.enemies.nextThreat(), game.projectiles.threatTime(p), game.boss ? game.boss.threatTime() : Infinity);
    if (threat < 0.45) {
      game.slowmo(0.7, 0.3);
      p.focus = Math.min(100, p.focus + 12);
      this.counterT = 1.5;
      game.hud.floatText(p.chestPos, 'ESQUIVE PARFAITE', '#7fe3ff', true);
      game.audio.play('slowmo');
    }
  }

  _heal() {
    const p = this.game.player;
    if (p.focus < 50 || p.health >= p.maxHealth) {
      if (p.focus < 50) this.game.hud.toast('Concentration insuffisante (il faut 1 barre)');
      return;
    }
    p.focus -= 50;
    p.health = Math.min(p.maxHealth, p.health + p.maxHealth * 0.45);
    this.game.audio.play('heal');
    for (let i = 0; i < 12; i++) this.game.fx.trail(p.chestPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 1.2 - 0.5, (Math.random() - 0.5) * 1.2)), '#6fff9a', 0.6, 0.6);
    this.game.hud.floatText(p.chestPos, '+ SANTÉ', '#6fff9a');
  }

  _finisher() {
    const p = this.game.player;
    if (p.focus < 50) {
      this.game.hud.toast('Coup de grâce : il faut 1 barre de concentration');
      return false;
    }
    const t = this.selectTarget(6, this._prefer());
    if (!t || (t.isBoss && !t.stunned)) {
      if (t && t.isBoss) this.game.hud.toast('Étourdis d’abord le Bouffon avec ta toile !');
      return false;
    }
    p.focus -= 50;
    const def = this.style.finisher;
    _v.subVectors(t.pos, p.pos).setY(0);
    p.facing = Math.atan2(_v.x, _v.z);
    p.action = { kind: 'finisher', def, t: 0, dur: 1.0, lock: true, iframes: true, target: t, face: p.facing, vel: null, hover: p.inAir };
    this.game.cam.punchIn(1.0);
    this.game.audio.play('whoosh');
    return true;
  }

  _webShoot() {
    const game = this.game;
    const p = game.player;
    this.webCd = 0.3;
    const t = this.selectTarget(32, this._prefer());
    const from = p.rig.handWorld('r', new THREE.Vector3());
    let dir;
    if (t) {
      dir = (t.chest || t.pos).clone().sub(from).normalize();
      p.aim = { dir: dir.clone(), t: 0.3 };
    } else {
      const yaw = game.cam.yaw;
      dir = new THREE.Vector3(-Math.sin(yaw), -Math.sin(game.cam.pitch) * 0.6 + 0.05, -Math.cos(yaw)).normalize();
      p.aim = { dir: dir.clone(), t: 0.3 };
    }
    const webN = this.style.key === 'tisseur' ? 2 : 1;
    game.projectiles.spawn('web', from, dir.multiplyScalar(70), { target: t, web: webN });
    game.audio.play('webshot');
  }

  _webStrike() {
    const p = this.game.player;
    const t = this.selectTarget(30, this._prefer());
    if (!t) return false;
    const line = this.game.webs.acquire();
    p.action = { kind: 'strike', t: 0, dur: 2, lock: true, iframes: true, target: t, line, hit: false, vel: { x: 0, y: 0, z: 0 }, hover: true };
    if (p.state === 'swing' || p.state === 'wall' || p.state === 'zip') p.setState('air');
    this.game.audio.play('thwip');
    return true;
  }

  _useGadget() {
    const game = this.game;
    const i = this.gadgetIndex;
    const g = GADGETS[i];
    if (this.gadgetCd[i] > 0) {
      game.hud.toast(`${g.name} : recharge (${Math.ceil(this.gadgetCd[i])} s)`);
      return;
    }
    const p = game.player;
    const t = this.selectTarget(30, this._prefer());
    const from = p.rig.handWorld('r', new THREE.Vector3());
    switch (g.key) {
      case 'webbomb': {
        const target = t ? t.pos.clone() : p.pos.clone().add(new THREE.Vector3(Math.sin(p.facing) * 12, 0, Math.cos(p.facing) * 12));
        const flight = 0.7;
        const v = target.clone().sub(from).multiplyScalar(1 / flight);
        v.y += 0.5 * 26 * flight;
        game.projectiles.spawn('webbomb', from, v, {});
        game.audio.play('whoosh');
        break;
      }
      case 'shock': {
        game.fx.electric(p.chestPos, 60);
        game.audio.play('zap', 1.2);
        game.cam.shake(0.3);
        for (const e of game.targets()) {
          if (!e.targetable) continue;
          const d = e.pos.distanceTo(p.pos);
          if (d > 7) continue;
          const dir = e.pos.clone().sub(p.pos).setY(0).normalize();
          e.hit({ dmg: e.isBoss ? 25 : 14, dir, knock: 4, stagger: 1.6, source: 'gadget', breakGuard: true });
          game.fx.electric(e.chest, 20);
          game.webs.flash(p.chestPos.clone(), e.chest.clone(), 0.2);
        }
        break;
      }
      case 'drone': {
        game.spawnDrone();
        break;
      }
      case 'impact': {
        const dir = t ? (t.chest || t.pos).clone().sub(from).normalize() : new THREE.Vector3(Math.sin(p.facing), 0.05, Math.cos(p.facing));
        game.projectiles.spawn('impact', from, dir.multiplyScalar(60), { target: t });
        game.audio.play('thwip');
        break;
      }
    }
    this.gadgetCd[i] = g.cd;
    game.hud.gadgetUsed(g);
  }
}
