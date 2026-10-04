// Construction : placement, collisions, interactions et animations des bâtiments.
import * as THREE from 'three';
import { G, bus, toast, news } from '../core/state.js';
import { BUILD, BUILDINGS } from '../data/buildings.js';
import { buildBuilding } from '../models/buildings.js';
import { box, cyl, pivot, sph } from '../models/kit.js';
import { item } from '../data/items.js';
import { stageDef } from '../data/stages.js';
import * as inv from './inventory.js';
import { power } from './civ.js';
import { sfx } from '../core/audio.js';
import { rand } from '../core/util.js';

const MACHINE = { id: 'machine', name: 'Machine', icon: '⚙️', radius: 1.6 };

export class BuildingSystem {
  constructor() {
    this.ghost = null;
    this.rot = 0;
    this.towerCd = 0;
  }

  def(type) {
    return BUILD[type] || (type === 'machine' ? MACHINE : null);
  }

  available() {
    return BUILDINGS.filter((b) => G.techs.includes(b.tech));
  }

  // ---------- Placement ----------
  start(type, machineItem = null) {
    if (!stageDef(G.stage).canCraft) return toast('Il faut être au moins Hominidé pour construire.', 'bad');
    if (G.mode !== 'world') return;
    const d = this.def(type);
    if (!d) return;
    if (!machineItem && !inv.hasAll(d.cost)) {
      toast('Il manque : ' + inv.missing(d.cost).join(', '), 'bad');
      sfx('error');
      return;
    }
    this.cancel();
    const model = type === 'machine' ? this.machineModel(machineItem) : buildBuilding(type);
    model.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.55;
        o.castShadow = false;
      }
      if (o.isLight) o.intensity = 0;
    });
    G.scene.add(model);
    this.ghost = model;
    G.building = { type, machineItem };
    toast('Clic gauche : construire · R : tourner · Échap : annuler', 'info');
  }

  cancel() {
    if (this.ghost) this.ghost.parent?.remove(this.ghost);
    this.ghost = null;
    G.building = null;
  }

  ghostPos() {
    const P = G.player;
    const d = this.def(G.building.type);
    const dist = d.radius + 3;
    const x = P.pos.x + Math.sin(P.camYaw) * dist;
    const z = P.pos.z + Math.cos(P.camYaw) * dist;
    return new THREE.Vector3(x, G.world.height(x, z), z);
  }

  validAt(p, type) {
    const d = this.def(type);
    const w = G.world;
    if (w.height(p.x, p.z) < 0.4) return 'Impossible de construire dans l’eau.';
    // Pente : on vérifie les coins
    const r = Math.min(d.radius, 4);
    const hs = [w.height(p.x + r, p.z), w.height(p.x - r, p.z), w.height(p.x, p.z + r), w.height(p.x, p.z - r)];
    if (Math.max(...hs) - Math.min(...hs) > 2.5 + r * 0.4) return 'Terrain trop en pente.';
    for (const b of G.buildings) {
      const bd = this.def(b.type);
      if (bd.wall && d.wall) continue;
      if (Math.hypot(b.x - p.x, b.z - p.z) < (bd.radius + d.radius) * 0.85) return 'Trop près d’un autre bâtiment.';
    }
    return null;
  }

  updatePlacement() {
    if (!G.building || !this.ghost) return;
    const I = G.input;
    if (I.consume('rotate')) this.rot += Math.PI / 4;
    const p = this.ghostPos();
    this.ghost.position.copy(p);
    this.ghost.rotation.y = G.player.camYaw + Math.PI + this.rot;
    const err = this.validAt(p, G.building.type);
    this.ghost.traverse((o) => {
      if (o.isMesh) o.material.emissive?.setHex(err ? 0x800000 : 0x004000);
    });
    if (I.consume('attack')) {
      if (err) {
        toast(err, 'bad');
        sfx('error');
        return;
      }
      this.place(G.building.type, p, this.ghost.rotation.y, G.building.machineItem);
    }
  }

  place(type, p, rot, machineItem) {
    const d = this.def(type);
    if (machineItem) {
      if (!inv.remove(machineItem, 1)) return;
    } else if (!inv.takeAll(d.cost)) {
      toast('Ressources insuffisantes.', 'bad');
      return;
    }
    const rec = { id: 'b' + Date.now().toString(36) + Math.floor(rand(0, 999)), type, x: p.x, z: p.z, rot };
    if (machineItem) {
      const it = item(machineItem);
      rec.machine = { ...it.machine, name: it.name, itemId: machineItem };
    }
    G.buildings.push(rec);
    this.spawn(rec);
    G.stats.built++;
    G.savoir += 2;
    sfx('build');
    G.fx.burst(p.clone().setY(p.y + 1), 0xc8b890, 30, 4, 1);
    toast(`${d.icon} ${machineItem ? rec.machine.name : d.name} construit(e) !`, 'good');
    if (d.rocket) toast('Approche-toi de la fusée et appuie sur E pour la lancer !', 'good');
    if (!G.village && d.housing && G.techs.includes('tribu')) toast('Astuce : fonde ton village dans le menu Civilisation (V).', 'info');
    bus.emit('built', rec);
    this.cancel();
    if (machineItem && inv.count(machineItem) > 0) this.start('machine', machineItem);
    else if (!machineItem && inv.hasAll(d.cost) && d.wall) this.start(type);
  }

  machineModel(itemId) {
    const g = new THREE.Group();
    box(g, 0x6a6a74, [0, 0.8, 0], [2, 1.6, 1.6], null, { m: 0.6, r: 0.4 });
    box(g, 0x2a2a2a, [0, 1.65, 0], [1.6, 0.1, 1.2]);
    const gear = pivot(g, [0, 1, 0.82]);
    cyl(gear, 0xd0a020, [0, 0, 0], [0.5, 0.1, 0.5], [Math.PI / 2, 0, 0], { m: 0.8, r: 0.3 }, 10);
    for (let i = 0; i < 8; i++) box(gear, 0xd0a020, [Math.cos((i / 8) * 6.28) * 0.55, Math.sin((i / 8) * 6.28) * 0.55, 0], [0.15, 0.15, 0.1], null, { m: 0.8 });
    sph(g, 0x40ff80, [0.7, 1.8, 0.5], 0.1, { e: 0x20ff40, ei: 2 }, 6);
    cyl(g, 0x5a5a60, [-0.6, 2.2, -0.4], [0.15, 1.2, 0.15], null, { m: 0.6 }, 8);
    g.userData.gear = gear;
    g.userData.smoke = [new THREE.Vector3(-0.6, 2.9, -0.4)];
    return g;
  }

  spawn(rec) {
    const d = this.def(rec.type);
    const m = rec.type === 'machine' ? this.machineModel(rec.machine?.itemId) : buildBuilding(rec.type);
    m.position.set(rec.x, G.world.height(rec.x, rec.z) - 0.05, rec.z);
    m.rotation.y = rec.rot;
    m.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    G.scene.add(m);
    rec.model = m;
    G.world.clearArea(rec.x, rec.z, d.radius + 1);
  }

  spawnAll() {
    for (const b of G.buildings) {
      if (b.model) b.model.parent?.remove(b.model);
      this.spawn(b);
    }
  }

  demolishNearest() {
    const P = G.player;
    let best = null;
    let bd = 8;
    for (const b of G.buildings) {
      const d = Math.hypot(b.x - P.pos.x, b.z - P.pos.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (!best) return toast('Aucun bâtiment à moins de 8 m.', 'bad');
    const d = this.def(best.type);
    if (best.machine) inv.add(best.machine.itemId, 1);
    else for (const [id, n] of Object.entries(d.cost || {})) inv.add(id, Math.floor(n / 2), true);
    best.model?.parent?.remove(best.model);
    G.buildings.splice(G.buildings.indexOf(best), 1);
    toast(`${d.icon} ${best.machine ? best.machine.name : d.name} démoli (50 % remboursé).`, 'info');
    sfx('build');
  }

  // ---------- Collisions ----------
  collide(pos, r) {
    for (const b of G.buildings) {
      const d = this.def(b.type);
      if (d.walkable) continue;
      const rad = (d.wall ? 1.3 : d.radius * 0.8) + r;
      const dx = pos.x - b.x;
      const dz = pos.z - b.z;
      if (Math.abs(dx) > rad || Math.abs(dz) > rad) continue;
      const dist = Math.hypot(dx, dz);
      if (dist < rad && dist > 0.001) {
        pos.x = b.x + (dx / dist) * rad;
        pos.z = b.z + (dz / dist) * rad;
      }
    }
  }

  // ---------- Interactions ----------
  interactable(pos, r) {
    let best = null;
    let bd = Infinity;
    for (const b of G.buildings) {
      const d = this.def(b.type);
      const dist = Math.hypot(b.x - pos.x, b.z - pos.z) - d.radius;
      if (dist > r || dist > bd) continue;
      let prompt = null;
      if (d.computer) prompt = 'Utiliser l’ordinateur';
      else if (d.shop) prompt = 'Ouvrir la boutique';
      else if (d.lab) prompt = 'Laboratoire (génétique)';
      else if (d.well) prompt = 'Boire au puits';
      else if (d.sleep) prompt = 'Dormir jusqu’au matin';
      else if (d.rocket) prompt = '🚀 LANCER LA FUSÉE';
      else if (d.gov) prompt = 'Palais : gouverner';
      else if (d.station) prompt = `Fabriquer (${d.name})`;
      else if (b.machine) prompt = `${b.machine.name} : +${b.machine.rate} ${item(b.machine.produce).name}/h`;
      if (!prompt) continue;
      bd = dist;
      best = { b, prompt, d };
    }
    return best;
  }

  use(t) {
    const { b, d } = t;
    const P = G.player;
    if (d.computer) {
      if (!power().ok) return toast('⚡ Pas assez d’électricité ! Construis une centrale, une éolienne ou des panneaux solaires.', 'bad');
      return bus.emit('openPanel', 'computer');
    }
    if (d.shop) return bus.emit('openPanel', 'shop');
    if (d.lab) return bus.emit('openPanel', 'lab');
    if (d.gov) return bus.emit('openPanel', 'civ', 'gov');
    if (d.well) {
      P.thirst = 100;
      sfx('drink');
      return toast('Tu bois de l’eau fraîche.', 'good');
    }
    if (d.sleep) {
      const h = G.time.hour;
      const skip = h >= 7 ? 24 - h + 7 : 7 - h;
      G.time.hour = 7;
      G.time.day += h >= 7 ? 1 : 0;
      P.heal(P.maxHp());
      P.hunger = Math.max(20, P.hunger - 15);
      P.thirst = Math.max(20, P.thirst - 15);
      G.respawnPoint = new THREE.Vector3(b.x, 0, b.z + 4);
      bus.emit('slept', skip);
      return toast('😴 Tu dors... Bonjour ! (point de réapparition enregistré)', 'good');
    }
    if (d.rocket) {
      if (!power().ok) return toast('⚡ La base a besoin de 10 d’énergie de plus !', 'bad');
      return bus.emit('launchRocket', b);
    }
    if (d.station) return bus.emit('openPanel', 'craft', d.station);
    if (b.machine) return toast(`${b.machine.name} produit ${b.machine.rate} ${item(b.machine.produce).name} par heure.`, 'info');
  }

  // ---------- Animation ----------
  update(dt) {
    this.updatePlacement();
    const t = G.elapsed;
    this.towerCd -= dt;
    const fire = this.towerCd <= 0;
    if (fire) this.towerCd = 1.5;
    for (const b of G.buildings) {
      const m = b.model;
      if (!m) continue;
      const u = m.userData;
      if (u.flame) {
        u.flame.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 9) * 0.15, 1 + Math.cos(t * 11) * 0.1);
        if (u.light) u.light.intensity = 5 + Math.sin(t * 17) * 1.2;
        if (Math.random() < 0.1) G.fx.burst(m.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xffa040, 1, 1, 0.8, 2);
      }
      if (u.rotor) u.rotor.rotation.z += dt * 2;
      if (u.gear) u.gear.rotation.z += dt * 2;
      if (u.pump) u.pump.rotation.z = Math.sin(t * 1.5) * 0.3;
      if (u.smoke && Math.random() < 0.15) {
        const s = u.smoke[Math.floor(Math.random() * u.smoke.length)].clone().applyEuler(m.rotation).add(m.position);
        G.fx.burst(s, 0x8a8a8a, 1, 1, 3, 1.2);
      }
      if (fire && BUILD[b.type]?.tower) {
        const from = m.position.clone().add(new THREE.Vector3(0, 7, 0));
        const foe = G.npcs?.list.find((n) => n.alive && n.side === 'enemy' && n.pos.distanceTo(from) < 40);
        if (foe) {
          const dir = foe.pos.clone().add(new THREE.Vector3(0, 1, 0)).sub(from).normalize();
          G.fx.spawnProjectile({ pos: from, vel: dir.multiplyScalar(50), dmg: 30, kind: 'arrow', side: 'ally', life: 2 });
        }
      }
    }
  }
}
