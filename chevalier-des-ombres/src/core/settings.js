// Paramètres du jeu : schéma (pour générer l'écran d'options), préréglages graphiques,
// persistance et notification des changements.
import { storage } from './storage.js';
import { isMobile } from './utils.js';
import { device, TIER_REC } from './device.js';

const KEY = 'cdo_settings_v1';

export const GRAPHICS_PRESETS = {
  low: {
    renderScale: 0.6, dynamicRes: true, shadows: 'off', bloom: false, bloomStrength: 0.7, aa: 'none',
    drawDistance: 'short', propDensity: 0.55, particles: 'low', textureQuality: 'low', grain: false, chroma: false,
    charTexture: 512, fxQuality: 'low', distortion: true, afterimages: true, maxEnemies: 10,
  },
  medium: {
    renderScale: 0.8, dynamicRes: true, shadows: 'low', bloom: true, bloomStrength: 0.85, aa: 'none',
    drawDistance: 'medium', propDensity: 0.8, particles: 'medium', textureQuality: 'high', grain: true, chroma: false,
    charTexture: 1024, fxQuality: 'medium', distortion: true, afterimages: true, maxEnemies: 16,
  },
  high: {
    renderScale: 1, dynamicRes: false, shadows: 'high', bloom: true, bloomStrength: 1, aa: 'fxaa',
    drawDistance: 'long', propDensity: 1, particles: 'high', textureQuality: 'high', grain: true, chroma: true,
    charTexture: 1024, fxQuality: 'high', distortion: true, afterimages: true, maxEnemies: 24,
  },
  ultra: {
    renderScale: 1.25, dynamicRes: false, shadows: 'ultra', bloom: true, bloomStrength: 1.1, aa: 'msaa',
    drawDistance: 'long', propDensity: 1.3, particles: 'high', textureQuality: 'high', grain: true, chroma: true,
    charTexture: 2048, fxQuality: 'high', distortion: true, afterimages: true, maxEnemies: 32,
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
      { key: 'autoQuality', label: 'Qualité automatique', type: 'toggle', def: true, options: onoff, desc: 'Choisit les réglages selon la mémoire et la puissance de l’appareil, et les baisse si le jeu risque de ralentir ou de manquer de mémoire.' },
      { key: 'preset', label: 'Préréglage', type: 'select', def: 'medium', options: [['low', 'Bas'], ['medium', 'Moyen'], ['high', 'Élevé'], ['ultra', 'Ultra'], ['custom', 'Personnalisé']], desc: 'Règle d’un coup toutes les options graphiques.' },
      { key: 'powerSave', label: 'Économie de batterie', type: 'toggle', def: false, options: onoff, desc: 'Limite à 30 images/s et baisse la résolution : le téléphone chauffe moins.' },
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
      { key: 'textureQuality', label: 'Qualité des textures', type: 'select', def: 'high', options: [['low', 'Basse'], ['high', 'Haute']], gfx: true, reload: true, desc: 'Textures du décor. Appliqué au prochain démarrage.' },
      { key: 'charModel', label: 'Modèles des personnages', type: 'select', def: 'hd', options: [['hd', 'HD (chevalier texturé, créatures sculptées)'], ['classic', 'Classiques (légers)']], desc: 'Le chevalier utilise le modèle 3D texturé ; les créatures et les boss, leur version sculptée lors de l’installation.' },
      { key: 'charTexture', label: 'Textures des personnages', type: 'select', def: 1024, options: [[512, '512 px (léger)'], [1024, '1024 px'], [2048, '2048 px (HD)']], gfx: true, reload: true, desc: 'Résolution des modèles 3D texturés. Appliqué au prochain chargement de zone.' },
      { key: 'maxEnemies', label: 'Ennemis actifs max', type: 'select', def: 16, options: [[10, '10'], [16, '16'], [24, '24'], [32, '32']], gfx: true, desc: 'Au-delà, les ennemis lointains sont mis en veille pour préserver les performances.' },
      { key: 'fxQuality', label: 'Effets visuels', type: 'select', def: 'medium', options: [['low', 'Sobres'], ['medium', 'Moyens'], ['high', 'Spectaculaires']], gfx: true, desc: 'Traînées d’armes, étincelles, éclats et poussière.' },
      { key: 'distortion', label: 'Ondes de choc', type: 'toggle', def: true, options: onoff, gfx: true, desc: 'Distorsion de l’image lors des impacts puissants.' },
      { key: 'afterimages', label: 'Images rémanentes', type: 'toggle', def: true, options: onoff, gfx: true, desc: 'Silhouettes spectrales lors des esquives et des ruées.' },
      { key: 'slowmo', label: 'Ralentis', type: 'toggle', def: true, options: onoff, desc: 'Ralenti lors des esquives parfaites, parades et exécutions.' },
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
      { key: 'musicSource', label: 'Style de musique', type: 'select', def: 'recorded', options: [['recorded', 'Orchestrale (enregistrée)'], ['composed', 'Composée par le jeu']], desc: 'Musiques orchestrales enregistrées (voir Crédits) ou musique générée en temps réel.' },
      { key: 'sfx', label: 'Effets sonores', type: 'slider', def: 0.8, min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'ambience', label: 'Ambiance', type: 'slider', def: 0.6, min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
      { key: 'muteBackground', label: 'Couper en arrière-plan', type: 'toggle', def: true, options: onoff },
      { key: 'audioQuality', label: 'Qualité audio', type: 'select', def: 'medium', options: [['low', 'Légère'], ['medium', 'Normale'], ['high', 'Haute']], desc: 'Finesse des instruments et de la réverbération (appliquée à la prochaine installation des données).' },
      { key: 'reverb', label: 'Réverbération', type: 'slider', def: 0.8, min: 0, max: 1.5, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %', desc: 'Écho des cathédrales et des cryptes.' },
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

// Onglet « Appareil & données » : contenu généré par l'interface (profil, installation)
SETTINGS_SCHEMA.push({ id: 'device', label: 'Appareil & données', icon: '▣', items: [], custom: true });

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

// Préréglage initial selon l'appareil (affiné après le test de performance de l'installation)
function autoPreset() {
  return device.ensure(null).tier;
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
      this.values.audioQuality = TIER_REC[p].audioQuality;
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
  // Applique les réglages recommandés pour le palier de l'appareil
  applyRecommended(tier = device.tier) {
    const rec = TIER_REC[tier];
    if (!rec) return;
    Object.assign(this.values, GRAPHICS_PRESETS[rec.preset]);
    this.values.preset = rec.preset;
    this.values.audioQuality = rec.audioQuality;
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
