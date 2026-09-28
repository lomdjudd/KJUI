// Paramètres du jeu : schéma (pour générer l'écran d'options), préréglages graphiques,
// persistance et notification des changements.
import { storage, native } from './storage.js';
import { isMobile } from './utils.js';

const KEY = 'cdo_settings_v1';

export const GRAPHICS_PRESETS = {
  low: {
    renderScale: 0.6, dynamicRes: true, shadows: 'off', bloom: false, bloomStrength: 0.7, aa: 'none',
    drawDistance: 'short', propDensity: 0.55, particles: 'low', textureQuality: 'low', grain: false, chroma: false,
  },
  medium: {
    renderScale: 0.8, dynamicRes: true, shadows: 'low', bloom: true, bloomStrength: 0.85, aa: 'none',
    drawDistance: 'medium', propDensity: 0.8, particles: 'medium', textureQuality: 'high', grain: true, chroma: false,
  },
  high: {
    renderScale: 1, dynamicRes: false, shadows: 'high', bloom: true, bloomStrength: 1, aa: 'fxaa',
    drawDistance: 'long', propDensity: 1, particles: 'high', textureQuality: 'high', grain: true, chroma: true,
  },
  ultra: {
    renderScale: 1.25, dynamicRes: false, shadows: 'ultra', bloom: true, bloomStrength: 1.1, aa: 'msaa',
    drawDistance: 'long', propDensity: 1.3, particles: 'high', textureQuality: 'high', grain: true, chroma: true,
  },
};

const onoff = [
  [true, 'Activé'],
  [false, 'Désactivé'],
];

// Schéma : sert à la fois de valeurs par défaut et de description de l'écran d'options.
export const SETTINGS_SCHEMA = [
  {
    id: 'graphics',
    label: 'Graphismes',
    icon: '◈',
    items: [
      { key: 'preset', label: 'Préréglage', type: 'select', def: 'medium', options: [['low', 'Bas'], ['medium', 'Moyen'], ['high', 'Élevé'], ['ultra', 'Ultra'], ['custom', 'Personnalisé']], desc: 'Règle d’un coup toutes les options graphiques.' },
      { key: 'renderScale', label: 'Échelle de rendu', type: 'slider', def: 0.8, min: 0.4, max: 1.5, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %', gfx: true, desc: 'Résolution interne. Baisser améliore beaucoup les performances.' },
      { key: 'dynamicRes', label: 'Résolution dynamique', type: 'toggle', def: true, options: onoff, gfx: true, desc: 'Baisse automatiquement la résolution si le jeu ralentit.' },
      { key: 'fpsLimit', label: 'Limite d’images/s', type: 'select', def: 60, options: [[30, '30 i/s'], [45, '45 i/s'], [60, '60 i/s'], [0, 'Illimitée']], desc: '30 i/s économise la batterie.' },
      { key: 'shadows', label: 'Ombres', type: 'select', def: 'low', options: [['off', 'Désactivées'], ['low', 'Basses'], ['high', 'Hautes'], ['ultra', 'Ultra']], gfx: true },
      { key: 'bloom', label: 'Halo lumineux (bloom)', type: 'toggle', def: true, options: onoff, gfx: true, desc: 'La lueur typique des jeux de l’époque Xbox 360.' },
      { key: 'bloomStrength', label: 'Intensité du halo', type: 'slider', def: 0.85, min: 0, max: 2, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %', gfx: true },
      { key: 'aa', label: 'Anticrénelage', type: 'select', def: 'none', options: [['none', 'Aucun'], ['fxaa', 'FXAA'], ['msaa', 'MSAA 4x']], gfx: true },
      { key: 'drawDistance', label: 'Distance d’affichage', type: 'select', def: 'medium', options: [['short', 'Courte'], ['medium', 'Moyenne'], ['long', 'Longue']], gfx: true },
      { key: 'propDensity', label: 'Densité des décors', type: 'slider', def: 0.8, min: 0.3, max: 1.5, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %', gfx: true, reload: true, desc: 'Arbres, tombes, rochers… (appliqué au prochain chargement de zone).' },
      { key: 'particles', label: 'Particules', type: 'select', def: 'medium', options: [['low', 'Basses'], ['medium', 'Moyennes'], ['high', 'Hautes']], gfx: true },
      { key: 'textureQuality', label: 'Qualité des textures', type: 'select', def: 'high', options: [['low', 'Basse'], ['high', 'Haute']], gfx: true, reload: true, desc: 'Appliqué au prochain démarrage.' },
      { key: 'grain', label: 'Grain de film', type: 'toggle', def: true, options: onoff, gfx: true },
      { key: 'vignette', label: 'Vignettage', type: 'slider', def: 0.6, min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %', gfx: true },
      { key: 'chroma', label: 'Aberration chromatique', type: 'toggle', def: false, options: onoff, gfx: true },
      { key: 'gamma', label: 'Luminosité', type: 'slider', def: 1, min: 0.6, max: 1.6, step: 0.02, fmt: (v) => Math.round(v * 100) + ' %', gfx: true },
      { key: 'showFps', label: 'Afficher les i/s', type: 'toggle', def: false, options: onoff },
    ],
  },
  {
    id: 'camera',
    label: 'Caméra',
    icon: '◉',
    items: [
      { key: 'camMode', label: 'Vue', type: 'select', def: 'third', options: [['third', '3e personne'], ['first', '1re personne']], desc: 'Aussi changeable en jeu (touche V / bouton œil).' },
      { key: 'fov', label: 'Champ de vision', type: 'slider', def: 65, min: 50, max: 100, step: 1, fmt: (v) => v + '°' },
      { key: 'camDistance', label: 'Distance (3e pers.)', type: 'slider', def: 1, min: 0.6, max: 1.6, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'sensX', label: 'Sensibilité horizontale', type: 'slider', def: 1, min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) },
      { key: 'sensY', label: 'Sensibilité verticale', type: 'slider', def: 1, min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) },
      { key: 'invertY', label: 'Inverser l’axe vertical', type: 'toggle', def: false, options: onoff },
      { key: 'shake', label: 'Tremblements de caméra', type: 'slider', def: 1, min: 0, max: 1.5, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'autoLock', label: 'Verrouillage auto des cibles', type: 'toggle', def: true, options: onoff, desc: 'Oriente les attaques vers l’ennemi le plus proche.' },
      { key: 'autoCenter', label: 'Recentrage automatique', type: 'toggle', def: true, options: onoff },
    ],
  },
  {
    id: 'gameplay',
    label: 'Jouabilité',
    icon: '⚔',
    items: [
      { key: 'difficulty', label: 'Difficulté', type: 'select', def: 'knight', options: [['squire', 'Écuyer (facile)'], ['knight', 'Chevalier (normal)'], ['paladin', 'Paladin (difficile)'], ['nightmare', 'Cauchemar']] },
      { key: 'damageNumbers', label: 'Chiffres de dégâts', type: 'toggle', def: true, options: onoff },
      { key: 'telegraphs', label: 'Zones d’attaque visibles', type: 'toggle', def: true, options: onoff, desc: 'Affiche au sol les zones des attaques des boss.' },
      { key: 'autosave', label: 'Sauvegarde automatique', type: 'select', def: 3, options: [[0, 'Désactivée'], [2, 'Toutes les 2 min'], [3, 'Toutes les 3 min'], [5, 'Toutes les 5 min'], [10, 'Toutes les 10 min']] },
      { key: 'vibration', label: 'Vibrations', type: 'toggle', def: true, options: onoff },
      { key: 'tips', label: 'Astuces', type: 'toggle', def: true, options: onoff },
      { key: 'autoLoot', label: 'Ramassage automatique', type: 'toggle', def: true, options: onoff },
      { key: 'hitStop', label: 'Arrêt sur impact', type: 'toggle', def: true, options: onoff, desc: 'Micro-pause à chaque coup porté, pour la sensation de poids.' },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: '♫',
    items: [
      { key: 'master', label: 'Volume général', type: 'slider', def: 0.8, min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'music', label: 'Musique', type: 'slider', def: 0.6, min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'sfx', label: 'Effets sonores', type: 'slider', def: 0.8, min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'ambience', label: 'Ambiance', type: 'slider', def: 0.6, min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'muteBackground', label: 'Couper en arrière-plan', type: 'toggle', def: true, options: onoff },
    ],
  },
  {
    id: 'interface',
    label: 'Interface',
    icon: '❖',
    items: [
      { key: 'hudScale', label: 'Taille de l’interface', type: 'slider', def: 1, min: 0.7, max: 1.4, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'hudOpacity', label: 'Opacité de l’interface', type: 'slider', def: 1, min: 0.3, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'minimap', label: 'Mini-carte', type: 'toggle', def: true, options: onoff },
      { key: 'compass', label: 'Boussole', type: 'toggle', def: true, options: onoff },
      { key: 'touchScale', label: 'Taille des commandes tactiles', type: 'slider', def: 1, min: 0.7, max: 1.4, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'touchOpacity', label: 'Opacité des commandes tactiles', type: 'slider', def: 0.75, min: 0.2, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'leftHanded', label: 'Disposition gaucher', type: 'toggle', def: false, options: onoff, desc: 'Inverse les côtés du joystick et des boutons.' },
      { key: 'colorblind', label: 'Mode daltonien', type: 'select', def: 'none', options: [['none', 'Aucun'], ['protan', 'Protanopie'], ['deutan', 'Deutéranopie'], ['tritan', 'Tritanopie']], gfx: true },
      { key: 'enemyBars', label: 'Barres de vie des ennemis', type: 'toggle', def: true, options: onoff },
    ],
  },
];

export const DIFFICULTY = {
  squire: { enemyDmg: 0.6, enemyHp: 0.75, telegraph: 1.35, xp: 1, label: 'Écuyer' },
  knight: { enemyDmg: 1, enemyHp: 1, telegraph: 1, xp: 1, label: 'Chevalier' },
  paladin: { enemyDmg: 1.4, enemyHp: 1.3, telegraph: 0.85, xp: 1.2, label: 'Paladin' },
  nightmare: { enemyDmg: 2, enemyHp: 1.7, telegraph: 0.7, xp: 1.5, label: 'Cauchemar' },
};

function defaults() {
  const d = {};
  for (const cat of SETTINGS_SCHEMA) for (const it of cat.items) d[it.key] = it.def;
  return d;
}

// Préréglage initial selon l'appareil
function autoPreset() {
  const info = native.deviceInfo();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (info && info.ramGb) || navigator.deviceMemory || 4;
  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch {
    /* ignore */
  }
  if (!isMobile) return /SwiftShader|llvmpipe|Software/i.test(gpu) ? 'low' : 'high';
  const adreno = gpu.match(/Adreno.*?(\d{3})/i);
  const mali = gpu.match(/Mali-G(\d+)/i);
  if (adreno && +adreno[1] >= 730) return 'high';
  if (mali && +mali[1] >= 710) return 'high';
  if (mem <= 3 || cores <= 4) return 'low';
  if (adreno && +adreno[1] < 610) return 'low';
  return 'medium';
}

class Settings {
  constructor() {
    this.values = defaults();
    this.listeners = new Set();
    const saved = storage.getJSON(KEY);
    if (saved) {
      Object.assign(this.values, saved);
    } else {
      const p = autoPreset();
      this.values.preset = p;
      Object.assign(this.values, GRAPHICS_PRESETS[p]);
      if (isMobile) this.values.fpsLimit = 60;
    }
    this.firstRun = !saved;
  }
  get(k) {
    return this.values[k];
  }
  set(k, v, silent = false) {
    this.values[k] = v;
    if (k === 'preset' && GRAPHICS_PRESETS[v]) {
      Object.assign(this.values, GRAPHICS_PRESETS[v]);
    } else if (GRAPHICS_PRESETS.low[k] !== undefined && this.values.preset !== 'custom') {
      this.values.preset = 'custom';
    }
    this.save();
    if (!silent) for (const fn of this.listeners) fn(k, v);
  }
  reset(catId) {
    const d = defaults();
    const cat = SETTINGS_SCHEMA.find((c) => c.id === catId);
    if (cat) for (const it of cat.items) this.values[it.key] = d[it.key];
    if (catId === 'graphics') Object.assign(this.values, GRAPHICS_PRESETS[this.values.preset] || {});
    this.save();
    for (const fn of this.listeners) fn('*', null);
  }
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  save() {
    storage.setJSON(KEY, this.values);
  }
  get difficulty() {
    return DIFFICULTY[this.values.difficulty] || DIFFICULTY.knight;
  }
}

export const settings = new Settings();
