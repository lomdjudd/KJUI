// Sauvegarde dans le navigateur (localStorage).
import { G } from '../core/state.js';

const KEY = 'evolution_save_v1';
const FIELDS = ['mode', 'time', 'stage', 'dna', 'dnaTotal', 'mutations', 'inherited', 'inv', 'hotbar', 'hotSel', 'money', 'savoir', 'techs', 'known', 'customItems', 'customCount', 'village', 'factions', 'title', 'career', 'popularity', 'taxes', 'nextElection', 'monster', 'disease', 'scripts', 'shopStock', 'market', 'news', 'objectivesDone', 'stats', 'robots', 'look', 'vaccinated', 'seed', 'launched'];

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function save() {
  if (!G.started || !G.player) return false;
  const data = {};
  for (const f of FIELDS) data[f] = G[f];
  data.buildings = G.buildings.map(({ model, ...rest }) => rest);
  const P = G.player;
  data.player = {
    pos: P.pos.toArray(),
    hp: P.hp,
    hunger: P.hunger,
    thirst: P.thirst,
    camYaw: P.camYaw,
  };
  data.respawnPoint = G.respawnPoint ? G.respawnPoint.toArray() : null;
  data.settings = G.settings;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function apply(data) {
  for (const f of FIELDS) if (data[f] !== undefined) G[f] = data[f];
  G.buildings = data.buildings || [];
  if (data.settings) Object.assign(G.settings, data.settings);
}

export function wipe() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('evolution_settings') || 'null');
    if (s) Object.assign(G.settings, s);
  } catch {
    /* rien */
  }
}

export function saveSettings() {
  try {
    localStorage.setItem('evolution_settings', JSON.stringify(G.settings));
  } catch {
    /* rien */
  }
}
