// Objets, outils, armes, potions... et recettes de fabrication.
import { G } from '../core/state.js';
import { SPECIES } from './species.js';

// cat : res (ressource), comp (composant), food, tool, weapon, ammo, bomb, potion, cure, virus, armor, robot, adn, invention
const I = (id, name, icon, cat, value, extra = {}) => ({ id, name, icon, cat, value, ...extra });

const LIST = [
  // --- Ressources naturelles ---
  I('baton', 'Bâton', '🥢', 'res', 1, { weapon: { dmg: 4, range: 2.4 } }),
  I('bois', 'Bois', '🪵', 'res', 2),
  I('pierre', 'Pierre', '🪨', 'res', 1, { throw: { dmg: 10, radius: 0, kind: 'rock' } }),
  I('silex', 'Silex', '🔹', 'res', 3),
  I('fibre', 'Fibre végétale', '🧵', 'res', 1),
  I('argile', 'Argile', '🟫', 'res', 2),
  I('sable', 'Sable', '🏖️', 'res', 1),
  I('cuivre', 'Minerai de cuivre', '🟠', 'res', 5),
  I('etain', 'Minerai d’étain', '⚪', 'res', 5),
  I('fer_brut', 'Minerai de fer', '🟤', 'res', 8),
  I('charbon', 'Charbon', '⚫', 'res', 4),
  I('or_brut', 'Pépite d’or', '🟡', 'res', 30),
  I('soufre', 'Soufre', '🟨', 'res', 6),
  I('silicium', 'Silicium', '💠', 'res', 15),
  I('uranium', 'Uranium', '🟢', 'res', 80),
  I('petrole', 'Pétrole', '🛢️', 'res', 20),
  I('peau', 'Peau', '🦬', 'res', 4),
  I('os', 'Os', '🦴', 'res', 2),
  I('plume', 'Plume', '🪶', 'res', 2),
  I('herbe_med', 'Herbe médicinale', '🌿', 'res', 5),
  I('champignon', 'Champignon', '🍄', 'res', 4, { food: { hunger: 8, hp: -5 } }),
  I('fleur', 'Fleur', '🌸', 'res', 3),

  // --- Nourriture ---
  I('baies', 'Baies', '🫐', 'food', 2, { food: { hunger: 10, thirst: 6 } }),
  I('fruit', 'Fruit', '🍎', 'food', 3, { food: { hunger: 14, thirst: 10 } }),
  I('viande', 'Viande crue', '🥩', 'food', 4, { food: { hunger: 18, hp: -4 } }),
  I('viande_cuite', 'Viande grillée', '🍖', 'food', 8, { food: { hunger: 40, hp: 10 } }),
  I('poisson', 'Poisson cru', '🐟', 'food', 4, { food: { hunger: 14, hp: -2 } }),
  I('poisson_cuit', 'Poisson grillé', '🍣', 'food', 8, { food: { hunger: 32, hp: 8 } }),
  I('ble', 'Blé', '🌾', 'food', 2, { food: { hunger: 6 } }),
  I('pain', 'Pain', '🍞', 'food', 7, { food: { hunger: 35, hp: 5 } }),
  I('soupe', 'Soupe', '🍲', 'food', 14, { food: { hunger: 50, thirst: 30, hp: 25 } }),
  I('eau', 'Bouteille d’eau', '💧', 'food', 3, { food: { thirst: 50 } }),
  I('burger', 'Burger', '🍔', 'food', 20, { food: { hunger: 70, hp: 20 } }),

  // --- Matériaux transformés ---
  I('corde', 'Corde', '🪢', 'comp', 4),
  I('cuir', 'Cuir', '👜', 'comp', 10),
  I('planche', 'Planche', '📏', 'comp', 5),
  I('brique', 'Brique', '🧱', 'comp', 5),
  I('poterie', 'Poterie', '🏺', 'comp', 8),
  I('verre', 'Verre', '🔷', 'comp', 8),
  I('bronze', 'Lingot de bronze', '🥉', 'comp', 18),
  I('fer', 'Lingot de fer', '🔩', 'comp', 20),
  I('acier', 'Acier', '🔗', 'comp', 35),
  I('or', 'Lingot d’or', '🥇', 'comp', 90),
  I('papier', 'Papier', '📜', 'comp', 6),
  I('livre', 'Livre', '📘', 'comp', 25, { use: 'read' }),
  I('poudre', 'Poudre noire', '💥', 'comp', 15),
  I('plastique', 'Plastique', '🧴', 'comp', 20),
  I('moteur', 'Moteur', '⚙️', 'comp', 120),
  I('circuit', 'Circuit électronique', '📟', 'comp', 90),
  I('puce', 'Puce informatique', '💾', 'comp', 200),
  I('batterie', 'Batterie', '🔋', 'comp', 60),
  I('ecran', 'Écran', '📺', 'comp', 150),

  // --- Outils (tier : 1 pierre, 2 bronze, 3 fer, 4 moderne) ---
  I('couteau_silex', 'Couteau en silex', '🔪', 'tool', 6, { tool: { kind: 'knife', tier: 1 }, weapon: { dmg: 8, range: 2.2 } }),
  I('hache_pierre', 'Hache en pierre', '🪓', 'tool', 10, { tool: { kind: 'axe', tier: 1 }, weapon: { dmg: 10, range: 2.5 } }),
  I('pioche_pierre', 'Pioche en pierre', '⛏️', 'tool', 10, { tool: { kind: 'pick', tier: 1 }, weapon: { dmg: 9, range: 2.5 } }),
  I('hache_bronze', 'Hache en bronze', '🪓', 'tool', 40, { tool: { kind: 'axe', tier: 2 }, weapon: { dmg: 16, range: 2.6 } }),
  I('pioche_bronze', 'Pioche en bronze', '⛏️', 'tool', 40, { tool: { kind: 'pick', tier: 2 }, weapon: { dmg: 14, range: 2.6 } }),
  I('hache_fer', 'Hache en fer', '🪓', 'tool', 60, { tool: { kind: 'axe', tier: 3 }, weapon: { dmg: 22, range: 2.7 } }),
  I('pioche_fer', 'Pioche en fer', '⛏️', 'tool', 60, { tool: { kind: 'pick', tier: 3 }, weapon: { dmg: 20, range: 2.7 } }),
  I('tronconneuse', 'Tronçonneuse', '🪚', 'tool', 300, { tool: { kind: 'axe', tier: 4 }, weapon: { dmg: 40, range: 2.6 } }),
  I('foreuse', 'Foreuse', '🔧', 'tool', 320, { tool: { kind: 'pick', tier: 4 }, weapon: { dmg: 35, range: 2.6 } }),
  I('canne_peche', 'Canne à pêche', '🎣', 'tool', 12, { tool: { kind: 'fish', tier: 1 } }),
  I('torche', 'Torche', '🕯️', 'tool', 4, { tool: { kind: 'light', tier: 1 }, weapon: { dmg: 7, range: 2.3, fire: true } }),

  // --- Armes ---
  I('lance', 'Lance', '🔱', 'weapon', 10, { weapon: { dmg: 16, range: 3.4 } }),
  I('massue', 'Massue en os', '🦴', 'weapon', 8, { weapon: { dmg: 14, range: 2.6 } }),
  I('arc', 'Arc', '🏹', 'weapon', 25, { weapon: { dmg: 22, range: 60, proj: 'arrow', ammo: 'fleche', rate: 0.7 } }),
  I('epee_bronze', 'Épée en bronze', '🗡️', 'weapon', 50, { weapon: { dmg: 28, range: 3 } }),
  I('epee_fer', 'Épée en fer', '⚔️', 'weapon', 80, { weapon: { dmg: 38, range: 3.1 } }),
  I('epee_acier', 'Épée en acier', '⚔️', 'weapon', 140, { weapon: { dmg: 52, range: 3.2 } }),
  I('arbalete', 'Arbalète', '🏹', 'weapon', 120, { weapon: { dmg: 45, range: 80, proj: 'arrow', ammo: 'fleche', rate: 1.1 } }),
  I('mousquet', 'Mousquet', '🔫', 'weapon', 200, { weapon: { dmg: 70, range: 90, proj: 'bullet', ammo: 'balle', rate: 1.8 } }),
  I('fusil', 'Fusil', '🔫', 'weapon', 450, { weapon: { dmg: 60, range: 140, proj: 'bullet', ammo: 'balle', rate: 0.25 } }),
  I('pistolet_laser', 'Pistolet laser', '🔫', 'weapon', 1500, { weapon: { dmg: 120, range: 200, proj: 'laser', rate: 0.2 } }),
  I('fleche', 'Flèche', '🎯', 'ammo', 2),
  I('balle', 'Balle', '•', 'ammo', 4),

  // --- Bombes ---
  I('bombe_poudre', 'Bombe à poudre', '💣', 'bomb', 40, { throw: { dmg: 120, radius: 7, kind: 'bomb' } }),
  I('dynamite', 'Dynamite', '🧨', 'bomb', 70, { throw: { dmg: 200, radius: 10, kind: 'bomb' } }),
  I('grenade', 'Grenade', '💣', 'bomb', 90, { throw: { dmg: 180, radius: 9, kind: 'bomb' } }),
  I('bombe_atomique', 'Bombe atomique', '☢️', 'bomb', 5000, { throw: { dmg: 5000, radius: 70, kind: 'nuke' } }),

  // --- Protections ---
  I('vetement_peau', 'Vêtements en peau', '🥼', 'armor', 15, { armor: 2 }),
  I('bouclier', 'Bouclier', '🛡️', 'armor', 40, { armor: 4 }),
  I('armure_fer', 'Armure en fer', '🦺', 'armor', 150, { armor: 8 }),
  I('armure_acier', 'Armure en acier', '🦺', 'armor', 260, { armor: 12 }),
  I('gilet', 'Gilet pare-balles', '🦺', 'armor', 400, { armor: 18 }),
  I('exosquelette', 'Exosquelette', '🦾', 'armor', 3000, { armor: 35 }),

  // --- Potions (alchimie) ---
  I('potion_soin', 'Potion de soin', '🧪', 'potion', 30, { potion: { effect: 'heal', amount: 80 } }),
  I('potion_vitesse', 'Potion de vitesse', '⚗️', 'potion', 60, { potion: { effect: 'speed', dur: 60 } }),
  I('potion_force', 'Potion de force', '🍷', 'potion', 60, { potion: { effect: 'strength', dur: 60 } }),
  I('potion_invisibilite', 'Potion d’invisibilité', '👻', 'potion', 90, { potion: { effect: 'invis', dur: 45 } }),
  I('potion_geant', 'Potion de géant', '🔮', 'potion', 120, { potion: { effect: 'giant', dur: 45 } }),
  I('potion_vol', 'Potion de vol', '🪽', 'potion', 150, { potion: { effect: 'fly', dur: 40 } }),

  // --- Remèdes ---
  I('remede_herbes', 'Tisane médicinale', '🍵', 'cure', 15, { cure: 1, potion: { effect: 'heal', amount: 30 } }),
  I('antibiotique', 'Antibiotique', '💊', 'cure', 60, { cure: 2, potion: { effect: 'heal', amount: 40 } }),
  I('vaccin', 'Vaccin', '💉', 'cure', 120, { cure: 3, vaccine: true }),

  // --- Virus (génétique) ---
  I('virus_grippe', 'Fiole de grippe', '🦠', 'virus', 100, { throw: { dmg: 30, radius: 8, kind: 'virus', virus: 1 } }),
  I('virus_peste', 'Fiole de peste', '☣️', 'virus', 250, { throw: { dmg: 60, radius: 10, kind: 'virus', virus: 2 } }),
  I('super_virus', 'Super-virus mutant', '🧫', 'virus', 600, { throw: { dmg: 120, radius: 14, kind: 'virus', virus: 3 } }),
  I('serum_humain', 'Sérum d’humanité', '🩸', 'potion', 200, { potion: { effect: 'human' } }),
  I('mutagene', 'Mutagène', '🧬', 'potion', 150, { potion: { effect: 'mutate' } }),

  // --- Robots ---
  I('robot', 'Robot ouvrier', '🤖', 'robot', 800, { deploy: 'worker' }),
  I('drone', 'Drone', '🛸', 'robot', 900, { deploy: 'drone' }),
  I('robot_combat', 'Robot de combat', '🦾', 'robot', 2500, { deploy: 'combat' }),
];

export const ITEMS = {};
for (const it of LIST) ITEMS[it.id] = it;

// Échantillons d'ADN (un par espèce)
for (const [sid, s] of Object.entries(SPECIES)) {
  ITEMS['adn_' + sid] = I('adn_' + sid, 'ADN : ' + s.name, '🧬', 'adn', 40 + s.dna * 2, { species: sid });
}

export function item(id) {
  return ITEMS[id] || G.customItems[id] || { id, name: id, icon: '❔', cat: 'res', value: 1 };
}

// [sortie, quantité, ingrédients, station, technologie]
// stations : null (à la main), feu, etabli, four, forge, labo, usine
const R = (out, n, ins, station = null, tech = null) => ({ out, n, ins, station, tech });

export const RECIPES = [
  // À la main
  R('corde', 1, { fibre: 3 }),
  R('couteau_silex', 1, { silex: 1, baton: 1 }),
  R('hache_pierre', 1, { baton: 1, pierre: 2, corde: 1 }),
  R('pioche_pierre', 1, { baton: 1, pierre: 3, corde: 1 }),
  R('lance', 1, { baton: 2, silex: 1, corde: 1 }, null, 'chasse'),
  R('massue', 1, { os: 2, corde: 1 }),
  R('torche', 1, { baton: 1, fibre: 2 }, null, 'feu'),
  // Au feu de camp
  R('viande_cuite', 1, { viande: 1 }, 'feu', 'feu'),
  R('poisson_cuit', 1, { poisson: 1 }, 'feu', 'feu'),
  R('remede_herbes', 1, { herbe_med: 2, fleur: 1 }, 'feu', 'medecine_herbes'),
  R('soupe', 1, { viande: 1, champignon: 1, poterie: 1 }, 'feu', 'poterie'),
  R('eau', 2, { poterie: 1 }, 'feu', 'poterie'),
  // Établi
  R('arc', 1, { bois: 3, corde: 2 }, 'etabli', 'arc'),
  R('fleche', 5, { baton: 2, silex: 1, plume: 1 }, 'etabli', 'arc'),
  R('canne_peche', 1, { baton: 2, corde: 2 }, 'etabli', 'peche'),
  R('cuir', 1, { peau: 2 }, 'etabli', 'vetements'),
  R('vetement_peau', 1, { peau: 3, corde: 1 }, 'etabli', 'vetements'),
  R('planche', 2, { bois: 1 }, 'etabli'),
  R('bouclier', 1, { planche: 4, cuir: 2, bronze: 1 }, 'etabli', 'bronze'),
  R('papier', 3, { bois: 1, fibre: 2 }, 'etabli', 'ecriture'),
  R('livre', 1, { papier: 4, cuir: 1 }, 'etabli', 'ecriture'),
  R('arbalete', 1, { planche: 3, acier: 1, corde: 2 }, 'etabli', 'acier'),
  // Four
  R('brique', 2, { argile: 2 }, 'four', 'poterie'),
  R('poterie', 1, { argile: 2 }, 'four', 'poterie'),
  R('verre', 1, { sable: 3 }, 'four', 'poterie'),
  R('pain', 1, { ble: 3 }, 'four', 'agriculture'),
  R('charbon', 2, { bois: 3 }, 'four', 'poterie'),
  // Forge
  R('bronze', 1, { cuivre: 2, etain: 1, charbon: 1 }, 'forge', 'bronze'),
  R('hache_bronze', 1, { bronze: 2, planche: 1 }, 'forge', 'bronze'),
  R('pioche_bronze', 1, { bronze: 2, planche: 1 }, 'forge', 'bronze'),
  R('epee_bronze', 1, { bronze: 3, cuir: 1 }, 'forge', 'bronze'),
  R('fer', 1, { fer_brut: 2, charbon: 1 }, 'forge', 'fer'),
  R('hache_fer', 1, { fer: 2, planche: 1 }, 'forge', 'fer'),
  R('pioche_fer', 1, { fer: 2, planche: 1 }, 'forge', 'fer'),
  R('epee_fer', 1, { fer: 3, cuir: 1 }, 'forge', 'fer'),
  R('armure_fer', 1, { fer: 6, cuir: 2 }, 'forge', 'fer'),
  R('or', 1, { or_brut: 3 }, 'forge', 'bronze'),
  R('acier', 1, { fer: 2, charbon: 2 }, 'forge', 'acier'),
  R('epee_acier', 1, { acier: 3, cuir: 1 }, 'forge', 'acier'),
  R('armure_acier', 1, { acier: 6, cuir: 2 }, 'forge', 'acier'),
  R('mousquet', 1, { acier: 3, planche: 2, poudre: 1 }, 'forge', 'poudre'),
  R('balle', 10, { fer: 1, poudre: 1 }, 'forge', 'poudre'),
  // Laboratoire
  R('potion_soin', 1, { herbe_med: 2, champignon: 1, verre: 1 }, 'labo', 'alchimie'),
  R('potion_vitesse', 1, { fleur: 2, plume: 1, verre: 1 }, 'labo', 'alchimie'),
  R('potion_force', 1, { viande: 2, os: 2, verre: 1 }, 'labo', 'alchimie'),
  R('potion_invisibilite', 1, { champignon: 3, soufre: 1, verre: 1 }, 'labo', 'alchimie'),
  R('potion_geant', 1, { champignon: 4, os: 3, or: 1, verre: 1 }, 'labo', 'alchimie'),
  R('potion_vol', 1, { plume: 6, fleur: 2, or: 1, verre: 1 }, 'labo', 'alchimie'),
  R('poudre', 2, { charbon: 1, soufre: 1 }, 'labo', 'poudre'),
  R('bombe_poudre', 1, { poudre: 3, poterie: 1, corde: 1 }, 'labo', 'poudre'),
  R('dynamite', 2, { poudre: 3, papier: 2, soufre: 1 }, 'labo', 'chimie'),
  R('antibiotique', 2, { champignon: 2, verre: 1, herbe_med: 1 }, 'labo', 'antibiotiques'),
  R('vaccin', 2, { antibiotique: 1, verre: 1, plastique: 1 }, 'labo', 'antibiotiques'),
  R('virus_grippe', 1, { verre: 1, champignon: 2, viande: 1 }, 'labo', 'genetique'),
  R('virus_peste', 1, { virus_grippe: 1, os: 3, soufre: 2 }, 'labo', 'genetique'),
  R('super_virus', 1, { virus_peste: 1, uranium: 1, puce: 1 }, 'labo', 'genetique'),
  R('serum_humain', 1, { herbe_med: 3, verre: 1, antibiotique: 1 }, 'labo', 'genetique'),
  R('mutagene', 1, { uranium: 1, champignon: 2, verre: 1 }, 'labo', 'genetique'),
  // Usine
  R('plastique', 2, { petrole: 1 }, 'usine', 'petrole'),
  R('moteur', 1, { acier: 3, fer: 2 }, 'usine', 'vapeur'),
  R('batterie', 1, { cuivre: 2, plastique: 1, soufre: 1 }, 'usine', 'electricite'),
  R('circuit', 1, { cuivre: 2, silicium: 1, plastique: 1 }, 'usine', 'electronique'),
  R('ecran', 1, { verre: 2, circuit: 1, plastique: 1 }, 'usine', 'electronique'),
  R('puce', 1, { silicium: 2, circuit: 1, or: 1 }, 'usine', 'ordinateurs'),
  R('fusil', 1, { acier: 4, plastique: 1, poudre: 1 }, 'usine', 'armes_modernes'),
  R('grenade', 2, { acier: 1, poudre: 2 }, 'usine', 'armes_modernes'),
  R('gilet', 1, { plastique: 4, acier: 2, cuir: 2 }, 'usine', 'armes_modernes'),
  R('tronconneuse', 1, { moteur: 1, acier: 2, petrole: 1 }, 'usine', 'petrole'),
  R('foreuse', 1, { moteur: 1, acier: 3, petrole: 1 }, 'usine', 'petrole'),
  R('burger', 2, { pain: 1, viande_cuite: 1 }, 'usine', 'electricite'),
  R('robot', 1, { acier: 6, moteur: 2, circuit: 3, batterie: 2 }, 'usine', 'robotique'),
  R('drone', 1, { plastique: 4, moteur: 1, circuit: 2, batterie: 2 }, 'usine', 'robotique'),
  R('robot_combat', 1, { acier: 12, moteur: 3, puce: 2, batterie: 4, fusil: 1 }, 'usine', 'ia'),
  R('exosquelette', 1, { acier: 10, moteur: 2, puce: 1, batterie: 3 }, 'usine', 'ia'),
  R('pistolet_laser', 1, { puce: 2, batterie: 3, verre: 2, acier: 2 }, 'usine', 'laser'),
  R('bombe_atomique', 1, { uranium: 10, acier: 10, puce: 2, poudre: 5 }, 'usine', 'nucleaire'),
];

export const STATION_NAMES = {
  feu: 'Feu de camp',
  etabli: 'Établi',
  four: 'Four',
  forge: 'Forge',
  labo: 'Laboratoire',
  usine: 'Usine',
};

// Nourriture préférée des villageois (ordre de consommation)
export const FOOD_ORDER = ['ble', 'baies', 'fruit', 'poisson_cuit', 'viande_cuite', 'pain', 'poisson', 'viande', 'soupe', 'burger'];
