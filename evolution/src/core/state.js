// État global partagé du jeu. Ce module n'importe rien pour éviter les cycles.

export const G = {
  // Moteur
  renderer: null,
  camera: null,
  scene: null,
  dt: 0,
  elapsed: 0,
  started: false,
  paused: false,
  panel: null, // nom du panneau ouvert
  building: null, // mode placement de bâtiment

  // Environnement courant : 'micro' (soupe primitive) ou 'world' (monde ouvert)
  mode: 'micro',

  // Temps du jeu
  time: { day: 1, hour: 9, year: -3.8e9 },

  // Évolution
  stage: 0,
  dna: 0,
  dnaTotal: 0,
  mutations: [], // mutations de l'étape courante
  inherited: { hp: 0, atk: 0, speed: 0 }, // bonus hérités des étapes passées

  // Ressources du joueur
  inv: {},
  hotbar: Array(9).fill(null),
  hotSel: 0,
  money: 0,
  savoir: 0,
  techs: [],
  known: [], // objets déjà fabriqués (bonus de savoir la première fois)
  customItems: {}, // inventions du joueur
  customCount: 0,

  // Monde construit
  buildings: [],
  robots: [],

  // Société
  village: null,
  factions: [],
  title: '',
  career: null,
  popularity: 50,
  taxes: 10,
  nextElection: 0,
  laws: [],

  // Génétique avancée
  monster: null,
  disease: null,

  // Ordinateur
  scripts: {},
  shopStock: [], // objets mis en vente {id, price, qty, online}
  market: {}, // multiplicateurs de prix dynamiques
  news: [],

  objectivesDone: [],
  stats: { kills: 0, eaten: 0, crafted: 0, built: 0 },

  settings: { sens: 1, invertY: false, quality: 'medium', volume: 0.6 },

  // Références runtime (remplies au démarrage)
  input: null,
  world: null,
  micro: null,
  player: null,
  creatures: null,
  npcs: null,
  fx: null,
  hud: null,
  sky: null,
};

// Petit bus d'événements
const handlers = {};
export const bus = {
  on(name, fn) {
    (handlers[name] ||= []).push(fn);
  },
  emit(name, ...args) {
    const list = handlers[name];
    if (list) for (const fn of list) fn(...args);
  },
};

export function toast(text, kind = 'info') {
  bus.emit('toast', text, kind);
}

export function news(text) {
  const d = G.time;
  G.news.unshift({ text, day: d.day, year: d.year });
  if (G.news.length > 80) G.news.length = 80;
}
