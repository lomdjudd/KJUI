// État d'une partie (carrière, bac à sable, défi) et sauvegarde locale.

import { PART_BY_ID } from '../parts/catalog.js';
import { TECHS } from './techtree.js';

const PREFIX = 'forge-stellaire:';

export function store(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function load(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (e) { /* rien */ }
}

export class GameState {
  constructor(mode = 'career') {
    this.mode = mode;
    this.funds = mode === 'career' ? 40000 : Infinity;
    this.science = 0;
    this.techs = new Set(mode === 'career' ? ['base'] : TECHS.map((t) => t.id));
    this.ut = 17400; // milieu de matinée au pas de tir
    this.vessels = []; // vaisseaux persistants
    this.milestones = {};
    this.scienceLog = {};
    this.contracts = { active: [], done: [] };
    this.stats = { launches: 0, landings: 0, maxAlt: 0, maxSpeed: 0, lost: 0, bodies: [] };
    this.lastCraft = null;
    this.challenge = null;
    this.created = Date.now();
  }

  get isCareer() {
    return this.mode === 'career';
  }

  hasTech(id) {
    return this.techs.has(id);
  }

  unlocked(partId) {
    if (this.mode !== 'career') return true;
    const d = PART_BY_ID[partId];
    return !!d && this.techs.has(d.tech);
  }

  canAfford(c) {
    return this.mode !== 'career' || this.funds >= c;
  }

  spend(c) {
    if (this.mode === 'career') this.funds -= c;
  }

  earn(funds = 0, sci = 0) {
    if (this.mode === 'career') this.funds += funds;
    this.science += sci;
  }

  toJSON() {
    return {
      mode: this.mode,
      funds: this.funds === Infinity ? null : this.funds,
      science: this.science,
      techs: [...this.techs],
      ut: this.ut,
      vessels: this.vessels,
      milestones: this.milestones,
      scienceLog: this.scienceLog,
      contracts: this.contracts,
      stats: this.stats,
      lastCraft: this.lastCraft,
      created: this.created,
    };
  }

  static fromJSON(o) {
    const g = new GameState(o.mode);
    g.funds = o.funds == null ? Infinity : o.funds;
    g.science = o.science || 0;
    if (o.mode === 'career') g.techs = new Set(o.techs || ['base']);
    g.ut = o.ut || 0;
    g.vessels = o.vessels || [];
    g.milestones = o.milestones || {};
    g.scienceLog = o.scienceLog || {};
    g.contracts = o.contracts || { active: [], done: [] };
    g.stats = Object.assign(g.stats, o.stats || {});
    g.lastCraft = o.lastCraft || null;
    g.created = o.created || Date.now();
    return g;
  }

  save() {
    if (this.mode === 'challenge') return;
    store('save:' + this.mode, this.toJSON());
  }

  static load(mode) {
    const o = load('save:' + mode);
    return o ? GameState.fromJSON(o) : null;
  }
}

// Bibliothèque de fusées enregistrées (partagée entre les modes)
export const Library = {
  all() {
    return load('crafts', {});
  },
  save(craftJSON) {
    const all = this.all();
    all[craftJSON.name] = { ...craftJSON, saved: Date.now() };
    store('crafts', all);
  },
  remove(name) {
    const all = this.all();
    delete all[name];
    store('crafts', all);
  },
};

export const Settings = {
  data: null,
  get() {
    if (!this.data) {
      const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      this.data = Object.assign({
        quality: isTouch ? 'low' : 'medium',
        view: '3d',
        music: 0.5,
        sfx: 0.8,
        invert: false,
        hints: true,
        autoStage: false,
      }, load('settings', {}));
    }
    return this.data;
  },
  set(k, v) {
    this.get()[k] = v;
    store('settings', this.data);
  },
};
