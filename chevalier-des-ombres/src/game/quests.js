// Gestion des quêtes : démarrage, progression par événements, récompenses, marqueurs.
import { QUESTS, questById } from '../data/quests.js';
import { ZONES } from '../data/zones.js';
import { audio } from '../core/audio.js';

export class QuestManager {
  constructor(game) {
    this.game = game;
  }

  get profile() {
    return this.game.profile;
  }

  state(id) {
    return this.profile.quests[id];
  }

  isDone(id) {
    const s = this.state(id);
    return s && s.status === 'done';
  }

  start(id, silent = false) {
    const q = questById(id);
    if (!q || this.profile.quests[id]) return;
    if (q.requires && !q.requires.every((r) => this.isDone(r))) return;
    this.profile.quests[id] = { status: 'active', progress: q.objectives.map(() => 0) };
    if (!silent) {
      this.game.hud.notify('Nouvelle quête', q.title, q.main ? 'main' : 'side');
      audio.play('quest');
    }
    // Objectifs déjà remplis (boss déjà vaincu, niveau atteint…)
    this._retroCheck(q);
  }

  _retroCheck(q) {
    const p = this.profile;
    const s = p.quests[q.id];
    q.objectives.forEach((o, i) => {
      if (o.type === 'boss' && p.bosses[o.target]) s.progress[i] = 1;
      if (o.type === 'level') s.progress[i] = Math.min(o.count, p.level);
      if (o.type === 'upgrade') s.progress[i] = Math.min(o.count, Math.max(0, ...Object.values(p.weapons)));
      if (o.type === 'bestiary') s.progress[i] = Math.min(o.count, Object.keys(p.bestiary).length);
      if (o.type === 'collect' && o.target === 'page') s.progress[i] = Math.min(o.count, Object.keys(p.pages).length);
      if ((o.type === 'explore' || o.type === 'activate') && Array.isArray(o.target)) s.progress[i] = o.target.filter((t) => p.pois[t]).length;
      if (o.type === 'altar' && p.altars.includes(o.target)) s.progress[i] = 1;
    });
    this._check(q);
  }

  // Quêtes secondaires d'une région (démarrées à la première visite)
  zoneEntered(zoneId) {
    for (const q of QUESTS) {
      if (q.main || q.autoStart) continue;
      if (q.zone === zoneId && !this.profile.quests[q.id]) this.start(q.id);
    }
    for (const q of QUESTS) if (q.requires && !this.profile.quests[q.id] && q.requires.every((r) => this.isDone(r)) && q.zone === 'hub') this.start(q.id);
  }

  event(type, data = {}) {
    const p = this.profile;
    for (const [id, s] of Object.entries(p.quests)) {
      if (s.status !== 'active') continue;
      const q = questById(id);
      if (!q) continue;
      let changed = false;
      q.objectives.forEach((o, i) => {
        const need = objectiveNeed(o);
        if (s.progress[i] >= need) return;
        if (o.type !== type) return;
        switch (type) {
          case 'kill':
            if (o.target.includes(data.id)) {
              s.progress[i]++;
              changed = true;
            }
            break;
          case 'boss':
          case 'talk':
          case 'altar':
            if (o.target === data.id) {
              s.progress[i] = 1;
              changed = true;
            }
            break;
          case 'explore':
          case 'activate':
            if (o.target.includes(data.id)) {
              s.progress[i] = o.target.filter((t) => p.pois[t]).length;
              changed = true;
            }
            break;
          case 'level':
          case 'upgrade':
          case 'bestiary':
            s.progress[i] = Math.min(o.count, data.value);
            changed = true;
            break;
          case 'collect':
            if (o.target === data.item) {
              s.progress[i] = Math.min(o.count, data.value);
              changed = true;
            }
            break;
          default:
        }
        if (changed && s.progress[i] < need && (type === 'kill' || type === 'explore' || type === 'activate' || type === 'collect')) {
          this.game.hud.questProgress(o.label, s.progress[i], need);
        }
      });
      if (changed) this._check(q);
    }
    this.game.hud && this.game.hud.refreshQuestTracker();
  }

  _check(q) {
    const s = this.profile.quests[q.id];
    if (!s || s.status !== 'active') return;
    // Les objectifs d'une quête s'enchaînent dans l'ordre
    const done = q.objectives.every((o, i) => s.progress[i] >= objectiveNeed(o));
    if (done) this.complete(q.id);
  }

  complete(id) {
    const q = questById(id);
    const s = this.profile.quests[id];
    s.status = 'done';
    const g = this.game;
    const r = q.rewards || {};
    if (r.shards) g.addShards(r.shards, false);
    if (r.xp) g.player.addXp(r.xp);
    if (r.power && !this.profile.powers.includes(r.power)) {
      this.profile.powers.push(r.power);
      g.hud.notify('Nouveau pouvoir', r.power, 'item');
    }
    if (r.item) {
      if (r.item.flaskHeal) this.profile.flaskUpgrades.heal++;
      if (r.item.flaskMana) this.profile.flaskUpgrades.mana++;
      g.player.refreshStats();
    }
    g.hud.questComplete(q.title, r);
    audio.play('quest');
    if (q.next) setTimeout(() => this.start(q.next), 2500);
    // Débloque les quêtes qui en dépendent
    for (const other of QUESTS) if (other.requires && other.requires.includes(id)) setTimeout(() => this.start(other.id), 3500);
    g.hud.refreshQuestTracker();
    g.requestAutosave();
  }

  active() {
    return Object.entries(this.profile.quests)
      .filter(([, s]) => s.status === 'active')
      .map(([id]) => questById(id))
      .filter(Boolean)
      .sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
  }

  // Quête suivie (principale en priorité, sinon une quête de la zone)
  tracked() {
    const list = this.active();
    const zone = this.game.zoneId;
    return list.find((q) => q.main) || list.find((q) => q.zone === zone) || list[0] || null;
  }

  currentObjective(q) {
    const s = this.profile.quests[q.id];
    for (let i = 0; i < q.objectives.length; i++) if (s.progress[i] < objectiveNeed(q.objectives[i])) return { o: q.objectives[i], i, progress: s.progress[i], need: objectiveNeed(q.objectives[i]) };
    return null;
  }

  // Positions des objectifs dans la région courante (boussole et carte)
  markers() {
    const g = this.game;
    const zone = ZONES[g.zoneId];
    const out = [];
    const p = this.profile;
    for (const q of this.active()) {
      const cur = this.currentObjective(q);
      if (!cur) continue;
      const o = cur.o;
      const tgt = [];
      if (o.type === 'boss') {
        const ar = (zone.arenas || []).find((a) => a.boss === o.target);
        if (ar) tgt.push({ x: ar.x, z: ar.z });
      } else if (o.type === 'explore' || o.type === 'activate') {
        for (const t of o.target) {
          if (p.pois[t]) continue;
          const poi = (zone.pois || []).find((pp) => pp.id === t);
          if (poi) tgt.push({ x: poi.x, z: poi.z });
        }
      } else if (o.type === 'altar') {
        const a = (zone.altars || []).find((aa) => aa.id === o.target);
        if (a) tgt.push({ x: a.x, z: a.z });
      } else if (o.type === 'talk' && g.zoneId === 'hub') {
        const n = g.world.interactables.find((it) => it.type === 'npc' && it.id === o.target);
        if (n) tgt.push({ x: n.x, z: n.z });
      }
      // Quête dans une autre région : pointer vers le portail/l'autel
      if (!tgt.length && q.zone !== g.zoneId && q.zone !== 'hub') {
        if (g.zoneId === 'hub') {
          const portal = g.world.interactables.find((it) => it.type === 'portal');
          if (portal) tgt.push({ x: portal.x, z: portal.z, away: true });
        }
      }
      for (const t of tgt) out.push({ ...t, main: !!q.main, label: o.label });
    }
    return out;
  }
}

export function objectiveNeed(o) {
  if (o.count) return o.count;
  if (Array.isArray(o.target) && (o.type === 'explore' || o.type === 'activate')) return o.target.length;
  return 1;
}
