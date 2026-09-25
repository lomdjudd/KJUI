import * as THREE from 'three';

const _v = new THREE.Vector3();

// Projectiles : toile, balles, bombes (toile / citrouille), toile d'impact
export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.geo = {
      web: new THREE.SphereGeometry(0.14, 8, 6),
      bullet: new THREE.SphereGeometry(0.07, 6, 4),
      webbomb: new THREE.IcosahedronGeometry(0.25, 0),
      pumpkin: new THREE.SphereGeometry(0.32, 12, 8),
      impact: new THREE.SphereGeometry(0.22, 8, 6),
    };
    this.mat = {
      web: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      bullet: new THREE.MeshBasicMaterial({ color: 0xffd36a }),
      webbomb: new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x335577, metalness: 0.6, roughness: 0.3 }),
      pumpkin: new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.8, roughness: 0.5 }),
      impact: new THREE.MeshBasicMaterial({ color: 0xc9f4ff }),
    };
  }

  spawn(kind, from, vel, opts = {}) {
    const mesh = new THREE.Mesh(this.geo[kind], this.mat[kind]);
    mesh.position.copy(from);
    this.game.scene.add(mesh);
    const p = { kind, pos: from.clone(), vel: vel.clone(), mesh, life: kind === 'pumpkin' ? 6 : 3, ...opts };
    if (kind === 'bullet') {
      // traînée
      const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.6 }));
      trail.rotation.x = Math.PI / 2;
      trail.position.z = -0.8;
      mesh.add(trail);
      mesh.lookAt(from.clone().add(vel));
    }
    this.list.push(p);
    return p;
  }

  // Temps avant qu'une balle ou bombe n'atteigne le joueur (pour l'esquive parfaite)
  threatTime(player) {
    let best = Infinity;
    for (const p of this.list) {
      if (p.kind !== 'bullet' && p.kind !== 'pumpkin') continue;
      const d = p.pos.distanceTo(player.chestPos);
      const sp = p.vel.length();
      if (sp < 0.1) continue;
      _v.subVectors(player.chestPos, p.pos).normalize();
      if (_v.dot(p.vel) / sp < 0.8) continue;
      best = Math.min(best, d / sp);
    }
    return best;
  }

  _remove(p) {
    this.game.scene.remove(p.mesh);
    p.dead = true;
  }

  _explode(p, radius, dmg, web = 0, fromPlayer = true) {
    const game = this.game;
    if (fromPlayer) {
      game.fx.webPuff(p.pos);
      for (let i = 0; i < 3; i++) game.fx.webPuff(p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 3)));
      game.audio.play('webshot', 1.2);
      for (const e of game.targets()) {
        if (!e.targetable) continue;
        if (e.pos.distanceTo(p.pos) > radius) continue;
        const dir = e.pos.clone().sub(p.pos).setY(0).normalize();
        e.hit({ dmg, dir, knock: 3, stagger: 1, web, source: 'gadget' });
      }
    } else {
      game.fx.explosion(p.pos, 1);
      game.audio.play('explosion');
      game.cam.shake(0.5);
      const player = game.player;
      if (player.pos.distanceTo(p.pos) < radius + 0.5) player.takeDamage(dmg, p.pos, 'explosion');
    }
  }

  update(dt) {
    const game = this.game;
    const city = game.city;
    const player = game.player;
    for (const p of this.list) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.kind === 'webbomb' || p.kind === 'pumpkin') p.vel.y -= 26 * dt;
      // guidage léger des toiles vers leur cible
      if ((p.kind === 'web' || p.kind === 'impact') && p.target && p.target.targetable) {
        const want = _v.subVectors(p.target.chest || p.target.pos, p.pos).normalize().multiplyScalar(p.vel.length());
        p.vel.lerp(want, Math.min(1, dt * 10));
      }
      const step = p.vel.length() * dt;
      const dir = _v.copy(p.vel).normalize();
      const hit = city.raycast(p.pos, dir, Math.max(step, 0.01), {});
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      if (p.kind === 'pumpkin') {
        p.mesh.rotation.x += dt * 5;
        if (Math.random() < 0.5) game.fx.trail(p.pos, '#ff9a3a', 0.6, 0.3);
      }
      if (p.kind === 'web' && Math.random() < 0.5) game.fx.trail(p.pos, '#ffffff', 0.25, 0.15);

      if (p.kind === 'bullet') {
        if (p.pos.distanceTo(player.chestPos) < 0.75) {
          if (player.takeDamage(p.dmg, p.pos.clone().sub(p.vel), 'hit')) {
            this._remove(p);
            continue;
          }
        }
      }
      if (p.kind === 'web' || p.kind === 'impact') {
        let target = null;
        for (const e of game.targets()) {
          if (!e.targetable) continue;
          const r = e.isBoss ? 2.0 : 1.0;
          if (p.pos.distanceTo(e.chest || e.pos) < r) {
            target = e;
            break;
          }
        }
        if (target) {
          game.fx.webPuff(p.pos);
          if (p.kind === 'web') {
            target.addWeb ? target.addWeb(p.web || 1) : null;
            target.hit({ dmg: 2, stagger: 0.2, knock: 0.5, source: 'web' });
            game.audio.play('webshot', 0.6);
          } else {
            const d = p.vel.clone().setY(0).normalize();
            target.hit({ dmg: 12, dir: d, knock: 16, source: 'gadget', breakGuard: true });
            if (target.addWeb && !target.isBoss) target.addWeb(99);
            if (target.isBoss) target.addWeb(2);
            game.audio.play('heavy', 0.8);
          }
          game.combat.combo++;
          game.hud.comboUpdate(game.combat.combo);
          game.combat.comboTimer = 2.8;
          this._remove(p);
          continue;
        }
      }
      if (p.kind === 'pumpkin' && p.pos.distanceTo(player.chestPos) < 1.3) {
        this._explode(p, 4.5, 22, 0, false);
        this._remove(p);
        continue;
      }
      const groundHit = p.pos.y <= city.groundHeight(p.pos.x, p.pos.z, p.pos.y + 1);
      if (hit || groundHit || p.life <= 0) {
        if (p.kind === 'webbomb') this._explode(p, 6.5, 6, 2, true);
        else if (p.kind === 'pumpkin') this._explode(p, 4.5, 22, 0, false);
        else if (p.kind === 'bullet') game.fx.sparks(p.pos, 4, '#ffd27a', 4);
        else game.fx.webPuff(p.pos);
        this._remove(p);
      }
    }
    this.list = this.list.filter((p) => !p.dead);
  }

  clear() {
    for (const p of this.list) this._remove(p);
    this.list = [];
  }
}
