// Quêtes principales et secondaires.
// Objectifs : talk, kill, boss, explore (pois), activate (pois), altar, level, upgrade, bestiary, collect.

export const QUESTS = [
  // ======================= HISTOIRE PRINCIPALE =======================
  {
    id: 'm1', main: true, title: 'Le Réveil', zone: 'hub', autoStart: true,
    desc: 'Vous vous réveillez au Havre-des-Cendres, sans souvenirs. Un moine vous attend près du feu.',
    objectives: [{ type: 'talk', target: 'anselme', label: 'Parler à Frère Anselme' }],
    rewards: { xp: 40, shards: 150 }, next: 'm2',
  },
  {
    id: 'm2', main: true, title: 'Les Morts sans Repos', zone: 'graveyard',
    desc: 'Les morts du Cimetière des Brumes se relèvent. Passez le Portail des Âmes et nettoyez le cimetière.',
    objectives: [
      { type: 'altar', target: 'gy_gate', label: 'Allumer le feu du Portail du cimetière' },
      { type: 'kill', target: ['skeleton', 'skeleton_archer'], count: 6, label: 'Détruire des squelettes' },
    ],
    rewards: { xp: 120, shards: 250 }, next: 'm3',
  },
  {
    id: 'm3', main: true, title: 'Le Gardien du Cimetière', zone: 'graveyard',
    desc: 'Un colosse fait d’os garde la route du nord. Abattez-le pour ouvrir le chemin de la Forêt Maudite.',
    objectives: [{ type: 'boss', target: 'bone_colossus', label: 'Vaincre le Colosse d’Os' }],
    rewards: { xp: 300, shards: 500 }, next: 'm4',
  },
  {
    id: 'm4', main: true, title: 'La Patrouille Perdue', zone: 'forest',
    desc: 'Une patrouille de l’Ordre a disparu dans la Forêt Maudite. Retrouvez sa trace.',
    objectives: [{ type: 'explore', target: ['fo_patrol1', 'fo_patrol2', 'fo_patrol3'], label: 'Retrouver les traces de la patrouille' }],
    rewards: { xp: 350, shards: 400 }, next: 'm5',
  },
  {
    id: 'm5', main: true, title: 'Le Cœur Pourri', zone: 'forest',
    desc: 'La corruption vient du plus vieil arbre de la forêt. Il faut l’abattre.',
    objectives: [{ type: 'boss', target: 'rotting_sylvan', label: 'Vaincre le Sylvain Pourrissant' }],
    rewards: { xp: 600, shards: 800 }, next: 'm6',
  },
  {
    id: 'm6', main: true, title: 'Les Totems Pourris', zone: 'swamp',
    desc: 'Trois totems empoisonnent le Marais Putride. Purifiez-les.',
    objectives: [{ type: 'activate', target: ['sw_totem1', 'sw_totem2', 'sw_totem3'], label: 'Purifier les totems' }],
    rewards: { xp: 700, shards: 700 }, next: 'm7',
  },
  {
    id: 'm7', main: true, title: 'Le Serpent des Tourbières', zone: 'swamp',
    desc: 'Vorgath bloque l’entrée des catacombes. Personne n’en est revenu vivant.',
    objectives: [{ type: 'boss', target: 'vorgath', label: 'Vaincre Vorgath' }],
    rewards: { xp: 1100, shards: 1300 }, next: 'm8',
  },
  {
    id: 'm8', main: true, title: 'Les Trois Sceaux', zone: 'catacombs',
    desc: 'La porte du gardien des catacombes est scellée. Brisez les trois sceaux.',
    objectives: [{ type: 'activate', target: ['ca_seal1', 'ca_seal2', 'ca_seal3'], label: 'Briser les sceaux' }],
    rewards: { xp: 1200, shards: 1100 }, next: 'm9',
  },
  {
    id: 'm9', main: true, title: 'Le Chevalier Cornu', zone: 'catacombs',
    desc: 'Derrière les sceaux attend le premier champion du Roi-Liche.',
    objectives: [{ type: 'boss', target: 'horned_knight', label: 'Vaincre le Chevalier Cornu' }],
    rewards: { xp: 1800, shards: 2000 }, next: 'm10',
  },
  {
    id: 'm10', main: true, title: 'Les Portes de Nocthar', zone: 'castle',
    desc: 'Le château de Nocthar brille d’une lumière verte. Le Roi-Liche y règne.',
    objectives: [
      { type: 'explore', target: ['cs_throne'], label: 'Atteindre le parvis du trône' },
      { type: 'boss', target: 'lich_king', label: 'Vaincre Malakar, le Roi-Liche' },
    ],
    rewards: { xp: 2800, shards: 3000 }, next: 'm11',
  },
  {
    id: 'm11', main: true, title: 'L’Hiver Éternel', zone: 'frost',
    desc: 'La Reine de l’Hiver maintient le nord dans la glace. Brisez son règne.',
    objectives: [{ type: 'boss', target: 'winter_queen', label: 'Vaincre Sylvaine, la Reine de l’Hiver' }],
    rewards: { xp: 4000, shards: 4200 }, next: 'm12',
  },
  {
    id: 'm12', main: true, title: 'La Porte des Enfers', zone: 'inferno',
    desc: 'Asmoroth garde la dernière porte avant la Citadelle du Néant.',
    objectives: [{ type: 'boss', target: 'asmoroth', label: 'Vaincre Asmoroth' }],
    rewards: { xp: 5600, shards: 6000 }, next: 'm13',
  },
  {
    id: 'm13', main: true, title: 'Les Éclats du Monde', zone: 'void',
    desc: 'Pour atteindre le trône du Roi Sans Visage, réunissez les trois éclats du monde.',
    objectives: [{ type: 'activate', target: ['vo_shard1', 'vo_shard2', 'vo_shard3'], label: 'Réunir les éclats du monde' }],
    rewards: { xp: 6000, shards: 5000 }, next: 'm14',
  },
  {
    id: 'm14', main: true, title: 'Le Roi Sans Visage', zone: 'void',
    desc: 'Tout se termine ici. Affrontez le Souverain du Néant.',
    objectives: [{ type: 'boss', target: 'faceless_king', label: 'Vaincre le Roi Sans Visage' }],
    rewards: { xp: 10000, shards: 10000 },
  },
  // ======================= QUÊTES GÉNÉRALES =======================
  {
    id: 'g_forge', title: 'Le Feu de la Forge', zone: 'hub', autoStart: true, giver: 'gorvald',
    desc: 'Gorvald le forgeron peut renforcer vos armes. Montrez-lui ce que vous valez.',
    objectives: [{ type: 'upgrade', count: 3, label: 'Améliorer une arme jusqu’à +3' }],
    rewards: { xp: 500, shards: 800 },
  },
  {
    id: 'g_level', title: 'L’Épreuve du Chevalier', zone: 'hub', autoStart: true, giver: 'roderic',
    desc: 'Le capitaine Roderic veut voir si vous tiendrez le coup. Endurcissez-vous.',
    objectives: [{ type: 'level', count: 10, label: 'Atteindre le niveau 10' }],
    rewards: { xp: 400, shards: 1000, item: { flaskHeal: 1 } },
  },
  {
    id: 'g_level2', title: 'Vétéran', zone: 'hub', requires: ['g_level'], giver: 'roderic',
    desc: 'Roderic vous estime. Devenez une légende.',
    objectives: [{ type: 'level', count: 25, label: 'Atteindre le niveau 25' }],
    rewards: { xp: 2000, shards: 5000, item: { flaskHeal: 1 } },
  },
  {
    id: 'g_bestiary', title: 'Le Bestiaire de Maëlis', zone: 'hub', autoStart: true, giver: 'maelis',
    desc: 'La voyante veut connaître toutes les créatures qui rôdent dans le royaume.',
    objectives: [{ type: 'bestiary', count: 20, label: 'Découvrir 20 types d’ennemis' }],
    rewards: { xp: 1500, shards: 2500, item: { flaskMana: 1 } },
  },
  {
    id: 'g_grimoire', title: 'Le Grimoire Perdu', zone: 'hub', autoStart: true, giver: 'maelis',
    desc: 'Les pages du Grimoire de l’Aube sont éparpillées dans le royaume (une par région).',
    objectives: [{ type: 'collect', target: 'page', count: 8, label: 'Retrouver les pages du grimoire' }],
    rewards: { xp: 5000, shards: 8000, power: 'chain_lightning' },
  },
  // ======================= CIMETIÈRE =======================
  { id: 's_gy_ghouls', title: 'Chasse aux goules', zone: 'graveyard', giver: 'roderic', desc: 'Les goules dévorent les cadavres frais. Réduisez leur nombre.', objectives: [{ type: 'kill', target: ['ghoul'], count: 8, label: 'Tuer des goules' }], rewards: { xp: 200, shards: 300 } },
  { id: 's_gy_digger', title: 'Le Fossoyeur', zone: 'graveyard', giver: 'anselme', desc: 'Quelqu’un creuse des tombes pour des gens encore vivants…', objectives: [{ type: 'boss', target: 'gravedigger', label: 'Vaincre Mortemain le Fossoyeur' }], rewards: { xp: 250, shards: 400 } },
  { id: 's_gy_lady', title: 'La Berceuse', zone: 'graveyard', giver: 'maelis', desc: 'Une chanson triste résonne depuis la crypte des Brumeval.', objectives: [{ type: 'explore', target: ['gy_crypt'], label: 'Visiter la crypte des Brumeval' }, { type: 'boss', target: 'green_lady', label: 'Libérer la Dame en Vert' }], rewards: { xp: 300, shards: 500 } },
  { id: 's_gy_explore', title: 'Les Lieux Maudits', zone: 'graveyard', giver: 'anselme', desc: 'Repérez les endroits où la brume est la plus épaisse.', objectives: [{ type: 'explore', target: ['gy_well', 'gy_ossuary'], label: 'Explorer le puits et l’ossuaire' }], rewards: { xp: 150, shards: 250 } },
  // ======================= FORÊT =======================
  { id: 's_fo_wolves', title: 'La Meute', zone: 'forest', giver: 'roderic', desc: 'Les loups des ombres attaquent les convois.', objectives: [{ type: 'kill', target: ['shadow_wolf'], count: 10, label: 'Tuer des loups des ombres' }], rewards: { xp: 400, shards: 500 } },
  { id: 's_fo_fenrok', title: 'L’Alpha', zone: 'forest', giver: 'roderic', desc: 'Sans leur chef, les loups se disperseront.', objectives: [{ type: 'boss', target: 'fenrok', label: 'Vaincre Fenrok' }], rewards: { xp: 500, shards: 700 } },
  { id: 's_fo_queen', title: 'La Toile', zone: 'forest', giver: 'maelis', desc: 'Une reine araignée pond ses œufs dans les ruines.', objectives: [{ type: 'boss', target: 'spider_queen', label: 'Vaincre Arachnéa' }], rewards: { xp: 550, shards: 750 } },
  { id: 's_fo_cult', title: 'Le Culte de l’Ombre', zone: 'forest', giver: 'anselme', desc: 'Des cultistes prient le Roi Sans Visage entre les arbres.', objectives: [{ type: 'kill', target: ['cultist'], count: 6, label: 'Tuer des cultistes' }], rewards: { xp: 400, shards: 500 } },
  // ======================= MARAIS =======================
  { id: 's_sw_slimes', title: 'Gelée Vivante', zone: 'swamp', giver: 'maelis', desc: 'Les slimes contaminent les puits.', objectives: [{ type: 'kill', target: ['acid_slime', 'acid_slimelet'], count: 12, label: 'Détruire des slimes' }], rewards: { xp: 600, shards: 700 } },
  { id: 's_sw_witch', title: 'La Sorcière', zone: 'swamp', giver: 'anselme', desc: 'Morgause enlève les enfants des villages.', objectives: [{ type: 'boss', target: 'swamp_witch', label: 'Vaincre Morgause' }], rewards: { xp: 750, shards: 900 } },
  { id: 's_sw_plague', title: 'La Peste', zone: 'swamp', giver: 'roderic', desc: 'La source de la peste se cache au fond du marais.', objectives: [{ type: 'boss', target: 'plague_abomination', label: 'Vaincre l’Abomination Pestilente' }], rewards: { xp: 800, shards: 1000 } },
  // ======================= CATACOMBES =======================
  { id: 's_ca_necro', title: 'Le Voleur de Morts', zone: 'catacombs', giver: 'anselme', desc: 'Le nécromancien Vaelis profane les tombes de l’Ordre.', objectives: [{ type: 'boss', target: 'necromancer', label: 'Vaincre Vaelis' }], rewards: { xp: 1000, shards: 1200 } },
  { id: 's_ca_headsman', title: 'L’Exécuteur', zone: 'catacombs', giver: 'roderic', desc: 'On entend encore sa hache tomber dans les profondeurs.', objectives: [{ type: 'boss', target: 'headsman', label: 'Vaincre le Bourreau Sans-Tête' }], rewards: { xp: 1100, shards: 1400 } },
  { id: 's_ca_mimic', title: 'Coffres Voraces', zone: 'catacombs', giver: 'gorvald', desc: 'Certains coffres mordent. Gorvald veut leurs dents.', objectives: [{ type: 'kill', target: ['mimic'], count: 2, label: 'Tuer des mimics' }], rewards: { xp: 900, shards: 2000 } },
  // ======================= CHÂTEAU =======================
  { id: 's_cs_valdric', title: 'Le Maître Déchu', zone: 'castle', giver: 'roderic', desc: 'Sire Valdric vous a tout appris. Il faut l’arrêter.', objectives: [{ type: 'boss', target: 'valdric', label: 'Vaincre Sire Valdric' }], rewards: { xp: 1500, shards: 1800 } },
  { id: 's_cs_draven', title: 'Le Bal du Vampire', zone: 'castle', giver: 'maelis', desc: 'Draven donne un bal dans la grande salle. Vous n’êtes pas invité.', objectives: [{ type: 'boss', target: 'draven', label: 'Vaincre Draven' }], rewards: { xp: 1600, shards: 2000 } },
  { id: 's_cs_books', title: 'Savoirs Interdits', zone: 'castle', giver: 'maelis', desc: 'La bibliothèque et la chapelle du château cachent des secrets.', objectives: [{ type: 'explore', target: ['cs_library', 'cs_chapel'], label: 'Explorer la bibliothèque et la chapelle' }], rewards: { xp: 1200, shards: 1500 } },
  // ======================= PICS DE GIVRE =======================
  { id: 's_fr_heart', title: 'Le Cœur de la Montagne', zone: 'frost', giver: 'maelis', desc: 'Un cristal vivant entretient l’hiver.', objectives: [{ type: 'boss', target: 'frost_heart', label: 'Briser le Cœur de Givre' }], rewards: { xp: 2000, shards: 2400 } },
  { id: 's_fr_titan', title: 'Le Dernier Géant', zone: 'frost', giver: 'roderic', desc: 'Un géant de glace s’est réveillé sous le glacier.', objectives: [{ type: 'boss', target: 'frost_titan', label: 'Vaincre Ymirax' }], rewards: { xp: 2200, shards: 2600 } },
  { id: 's_fr_wolves', title: 'Hurlements dans la Neige', zone: 'frost', giver: 'roderic', desc: 'Les loups des neiges ont goûté la chair humaine.', objectives: [{ type: 'kill', target: ['frost_wolf'], count: 8, label: 'Tuer des loups des neiges' }], rewards: { xp: 1600, shards: 2000 } },
  // ======================= ABÎME INFERNAL =======================
  { id: 's_in_elem', title: 'La Colère de la Terre', zone: 'inferno', giver: 'maelis', desc: 'Ignaros fait trembler l’Abîme.', objectives: [{ type: 'boss', target: 'inferno_elemental', label: 'Vaincre Ignaros' }], rewards: { xp: 2800, shards: 3200 } },
  { id: 's_in_forger', title: 'L’Enclume Maudite', zone: 'inferno', giver: 'gorvald', desc: 'Gorvald rêve de détruire la forge de Brakkar.', objectives: [{ type: 'boss', target: 'hell_forger', label: 'Vaincre Brakkar' }], rewards: { xp: 3000, shards: 3500 } },
  { id: 's_in_altars', title: 'Autels Impies', zone: 'inferno', giver: 'anselme', desc: 'Trois autels nourrissent les démons de sang.', objectives: [{ type: 'activate', target: ['in_altar1', 'in_altar2', 'in_altar3'], label: 'Profaner les autels impies' }], rewards: { xp: 2500, shards: 3000 } },
  // ======================= NÉANT =======================
  { id: 's_vo_horror', title: 'Ce qui Rampe', zone: 'void', giver: 'maelis', desc: 'Une horreur venue d’entre les étoiles s’est enracinée dans la citadelle.', objectives: [{ type: 'boss', target: 'void_horror_boss', label: 'Vaincre Xal’Thuun' }], rewards: { xp: 3500, shards: 4000 } },
  { id: 's_vo_champion', title: 'Votre Reflet', zone: 'void', giver: 'anselme', desc: 'On dit qu’un chevalier noir porte votre visage.', objectives: [{ type: 'boss', target: 'void_champion', label: 'Vaincre le Champion Maudit' }], rewards: { xp: 3800, shards: 4200 } },
  { id: 's_vo_dragon', title: 'Les Ailes du Néant', zone: 'void', giver: 'roderic', desc: 'Le dragon d’ombre survole la citadelle.', objectives: [{ type: 'boss', target: 'nyxalith', label: 'Vaincre Nyxalith' }], rewards: { xp: 4500, shards: 5000 } },
];

export function questById(id) {
  return QUESTS.find((q) => q.id === id);
}

// Dialogues des personnages du Havre
export const NPCS = {
  anselme: {
    name: 'Frère Anselme', role: 'Moine de l’Aube',
    look: { torso: 'robe', head: 'monk', arms: 'robe', legs: 'robe', c: { cloth: 0x4a3a2a, trim: 0xc8a050, skin: 0xc8a080 } },
    lines: {
      default: ['Que la lumière de l’Aube vous garde, chevalier.', 'Le Roi Sans Visage dévore le royaume, région après région.', 'Reposez-vous près du feu : il garde vos progrès.'],
      m1: ['Vous voilà enfin réveillé ! Nous vous avons trouvé dans les cendres, votre épée à la main.', 'Le royaume se meurt, chevalier. Le Roi Sans Visage a corrompu chaque terre.', 'Traversez le Portail des Âmes, au nord du Havre. Commencez par le Cimetière des Brumes.'],
      ending: ['Vous l’avez fait… Le Néant recule. L’aube se lève enfin sur le royaume.', 'Mais le Néant est patient. Restez vigilant, Chevalier des Ombres.'],
    },
  },
  gorvald: {
    name: 'Gorvald', role: 'Forgeron',
    look: { torso: 'leather', head: 'helm_open', arms: 'flesh', legs: 'leather', bulk: 1.25, c: { leather: 0x3a2a1c, skin: 0xb88a6a, main: 0x5a5a60, dark: 0x1a1410 } },
    shop: 'forge',
    lines: { default: ['Une lame bien affûtée vaut mieux que dix prières.', 'Apporte-moi des éclats d’âme, je rendrai ton arme redoutable.', 'Les boucliers ne sont pas pour les lâches. Ils sont pour les vivants.'] },
  },
  isolde: {
    name: 'Isolde', role: 'Armurière',
    look: { torso: 'tabard', head: 'helm_open', c: { main: 0x8a8a98, cloth: 0x7a1a3a, trim: 0xc8a050, skin: 0xe0b898 } },
    shop: 'armory',
    lines: { default: ['Une armure, c’est une seconde peau. Choisis-la bien.', 'Les boss laissent parfois leurs parures… si tu survis.', 'Tu peux changer de tenue quand tu veux ici.'] },
  },
  maelis: {
    name: 'Maëlis', role: 'Voyante',
    look: { torso: 'robe', head: 'hood', arms: 'robe', legs: 'robe', extras: ['orbs'], c: { cloth: 0x3a1a5a, trim: 0x9a4dff, glow: 0x9a4dff, eyes: 0x9a4dff } },
    shop: 'mystic',
    lines: { default: ['Je vois des flammes… des crocs… et une couronne sans visage.', 'La magie a un prix. Mes pouvoirs aussi.', 'Je peux effacer tes compétences, si tu veux choisir une autre voie.'] },
  },
  roderic: {
    name: 'Capitaine Roderic', role: 'Chef de la garde',
    look: { torso: 'armor', head: 'helm_open', extras: ['cape'], c: { main: 0x6a6a74, trim: 0xa08040, cape: 0x5a1010, skin: 0xb08868 } },
    shop: 'quartermaster',
    lines: { default: ['Tenez votre garde haute. Roulez sur le côté quand un coup lourd arrive.', 'Une parade au bon moment désarçonne n’importe quel ennemi.', 'Je peux renforcer vos fioles avec des braises d’âme.'] },
  },
};
