// Armes, boucliers et tenues du chevalier.

export const RARITY = {
  common: { label: 'Commun', color: '#b8b0a0' },
  rare: { label: 'Rare', color: '#5ab0ff' },
  epic: { label: 'Épique', color: '#b56aff' },
  legendary: { label: 'Légendaire', color: '#ffb52a' },
};

export const ELEMENT_LABEL = {
  physical: 'Physique',
  fire: 'Feu',
  frost: 'Givre',
  lightning: 'Foudre',
  poison: 'Poison',
  shadow: 'Ombre',
  holy: 'Sacré',
  blood: 'Sang',
};

// Enchaînements par classe d'arme
export const WEAPON_CLASSES = {
  '1h': { label: 'Une main', combo: ['slashR', 'slashL', 'overhead', 'thrust'], heavy: 'overhead', stance: '1h', shield: true },
  '2h': { label: 'Deux mains', combo: ['sweep2h', 'slashL', 'slam'], heavy: 'slam', stance: '2h', shield: false, twoHanded: true },
  polearm: { label: 'Hast', combo: ['thrust', 'thrust', 'sweep2h'], heavy: 'spin', stance: 'polearm', shield: false, twoHanded: true },
  dagger: { label: 'Dague', combo: ['stab', 'slashR', 'stab', 'slashL', 'thrust'], heavy: 'thrust', stance: '1h', shield: true },
  staff: { label: 'Bâton', combo: ['slashR', 'thrust'], heavy: 'castAoe', stance: 'staff', shield: false, twoHanded: true },
};

export const WEAPONS = [
  // --- Épées à une main ---
  { id: 'rusty_sword', name: 'Épée rouillée', type: 'sword', cls: '1h', dmg: 14, speed: 1, reach: 2.2, stamina: 14, poise: 12, element: 'physical', rarity: 'common', price: 0, look: { blade: 0x7a6a5a, hilt: 0x3a2418, guard: 0x5a4a3a, bladeSurf: [0.7, 0.6, 0] }, desc: 'Une lame fatiguée, mais elle a déjà tué.' },
  { id: 'knight_sword', name: 'Épée longue de l’Ordre', type: 'sword', cls: '1h', dmg: 22, speed: 1, reach: 2.3, stamina: 15, poise: 15, element: 'physical', rarity: 'common', price: 350, look: { blade: 0xc8ccd8, guard: 0x9a8a50 }, desc: 'L’arme réglementaire des Chevaliers de l’Aube.' },
  { id: 'silver_rapier', name: 'Rapière d’argent', type: 'rapier', cls: '1h', dmg: 20, speed: 1.3, reach: 2.4, stamina: 11, poise: 8, crit: 0.12, element: 'physical', rarity: 'rare', price: 900, look: { blade: 0xe8ecf8, guard: 0xd8d8e8 }, desc: 'Rapide et précise : +12 % de coups critiques.' },
  { id: 'ember_blade', name: 'Lame des Braises', type: 'sword', cls: '1h', dmg: 26, speed: 1, reach: 2.3, stamina: 15, poise: 15, element: 'fire', elemDmg: 12, rarity: 'rare', price: 1600, look: { blade: 0x5a3020, guard: 0xc8702a, glow: 0xff6a1a }, desc: 'Forgée dans la gueule d’un démon. Brûle les chairs.' },
  { id: 'frost_blade', name: 'Croc de Givre', type: 'sword', cls: '1h', dmg: 25, speed: 1, reach: 2.3, stamina: 15, poise: 15, element: 'frost', elemDmg: 12, rarity: 'rare', price: 1600, look: { blade: 0xa8d8ff, guard: 0x5a7a9a, glow: 0x7ad4ff }, desc: 'Ralentit les ennemis touchés.' },
  { id: 'dawn_blade', name: 'Lame de l’Aube', type: 'sword', cls: '1h', dmg: 30, speed: 1.05, reach: 2.4, stamina: 15, poise: 16, element: 'holy', elemDmg: 16, rarity: 'epic', price: 3800, look: { blade: 0xfff4d0, guard: 0xffc84a, glow: 0xffe89a }, desc: 'Brille dans les ténèbres. Dégâts accrus contre les morts-vivants.' },
  { id: 'doom_blade', name: 'Épée Funeste', type: 'sword', cls: '1h', dmg: 34, speed: 1, reach: 2.4, stamina: 16, poise: 17, element: 'shadow', elemDmg: 18, rarity: 'epic', price: 5200, look: { blade: 0x2a1a3a, guard: 0x5a2a7a, glow: 0xa04dff }, desc: 'Elle murmure le nom de ceux qu’elle a fauchés.' },
  { id: 'spectral_katana', name: 'Lame Spectrale', type: 'katana', cls: '1h', dmg: 36, speed: 1.2, reach: 2.5, stamina: 13, poise: 12, crit: 0.08, element: 'poison', elemDmg: 14, rarity: 'epic', price: 0, look: { blade: 0x9affd0, guard: 0x1a6a4a, glow: 0x39ff9a, bladeSurf: [0.2, 0.5, 0.3] }, desc: 'Trophée de la Dame en Vert. Sa lame traverse l’âme.', source: 'boss:green_lady' },
  // --- Haches et masses ---
  { id: 'war_axe', name: 'Hache de guerre', type: 'axe', cls: '1h', dmg: 26, speed: 0.9, reach: 2.1, stamina: 17, poise: 22, element: 'physical', rarity: 'common', price: 500, look: { blade: 0xa8a8b0 }, desc: 'Lourde, elle brise les gardes.' },
  { id: 'flanged_mace', name: 'Masse à ailettes', type: 'mace', cls: '1h', dmg: 24, speed: 0.95, reach: 2.0, stamina: 16, poise: 26, element: 'physical', bonusVs: 'bone', rarity: 'common', price: 600, look: { blade: 0x8a8a92 }, desc: 'Idéale contre les squelettes et les armures.' },
  { id: 'blessed_star', name: 'Morgenstern bénie', type: 'mace', cls: '1h', dmg: 30, speed: 0.95, reach: 2.1, stamina: 16, poise: 28, element: 'holy', elemDmg: 14, rarity: 'epic', price: 3400, look: { blade: 0xd8c890, guard: 0xffc84a, glow: 0xffe89a }, desc: 'Chaque impact est une prière.' },
  { id: 'storm_axe', name: 'Hache runique d’orage', type: 'axe', cls: '1h', dmg: 32, speed: 0.9, reach: 2.2, stamina: 17, poise: 24, element: 'lightning', elemDmg: 16, rarity: 'epic', price: 4200, look: { blade: 0x6a7a9a, glow: 0xb8d8ff }, desc: 'La foudre suit chacun de ses coups.' },
  // --- Deux mains ---
  { id: 'greatsword', name: 'Espadon', type: 'greatsword', cls: '2h', dmg: 40, speed: 0.8, reach: 2.9, stamina: 24, poise: 34, element: 'physical', rarity: 'common', price: 1100, look: { blade: 0xb8bcc8 }, desc: 'Une lame immense pour faucher plusieurs ennemis.' },
  { id: 'colossus_hammer', name: 'Marteau du Colosse', type: 'hammer', cls: '2h', dmg: 52, speed: 0.7, reach: 2.6, stamina: 28, poise: 50, element: 'physical', bonusVs: 'bone', rarity: 'epic', price: 0, look: { blade: 0xd8cfb0, hilt: 0x5a4a3a, guard: 0x3a3a40, bladeSurf: [0.6, 0, 0] }, desc: 'Taillé dans l’os du Colosse. Écrase tout.', source: 'boss:bone_colossus' },
  { id: 'headsman_axe', name: 'Hache du Bourreau', type: 'greataxe', cls: '2h', dmg: 58, speed: 0.72, reach: 2.8, stamina: 28, poise: 44, element: 'blood', elemDmg: 14, rarity: 'epic', price: 0, look: { blade: 0x5a5a60, hilt: 0x2a1a14, glow: 0xff2244 }, desc: 'Chaque coup draine un peu de vie (vol de vie).', lifesteal: 0.05, source: 'boss:headsman' },
  { id: 'lich_greatsword', name: 'Espadon du Roi-Liche', type: 'greatsword', cls: '2h', dmg: 60, speed: 0.8, reach: 3.0, stamina: 25, poise: 36, element: 'frost', elemDmg: 24, rarity: 'legendary', price: 0, look: { blade: 0x8ab8e8, guard: 0x2a3a5a, glow: 0x7ad4ff }, desc: 'Arme de Malakar. Gèle le sang des vivants.', source: 'boss:lich_king' },
  { id: 'infernal_claymore', name: 'Claymore Infernale', type: 'greatsword', cls: '2h', dmg: 66, speed: 0.78, reach: 3.0, stamina: 26, poise: 38, element: 'fire', elemDmg: 28, rarity: 'legendary', price: 0, look: { blade: 0x3a1a10, guard: 0xff6a1a, glow: 0xff5a0a }, desc: 'Arrachée au démon Asmoroth.', source: 'boss:asmoroth' },
  { id: 'void_blade', name: 'Lame du Néant', type: 'greatsword', cls: '2h', dmg: 80, speed: 0.85, reach: 3.2, stamina: 24, poise: 40, element: 'shadow', elemDmg: 36, rarity: 'legendary', price: 0, look: { blade: 0x0a0612, guard: 0x9a3cff, glow: 0xc06aff }, desc: 'Le fragment d’un monde qui n’existe plus.', source: 'boss:faceless_king' },
  // --- Hast ---
  { id: 'hunting_spear', name: 'Lance de chasse', type: 'spear', cls: 'polearm', dmg: 22, speed: 1, reach: 3.3, stamina: 15, poise: 14, element: 'physical', rarity: 'common', price: 700, look: {}, desc: 'Garde les ennemis à distance.' },
  { id: 'guard_halberd', name: 'Hallebarde de la Garde', type: 'halberd', cls: 'polearm', dmg: 34, speed: 0.85, reach: 3.4, stamina: 20, poise: 26, element: 'physical', rarity: 'rare', price: 2200, look: {}, desc: 'Portée immense, balayages dévastateurs.' },
  { id: 'soul_scythe', name: 'Faux des Âmes', type: 'scythe', cls: 'polearm', dmg: 44, speed: 0.85, reach: 3.3, stamina: 21, poise: 22, element: 'shadow', elemDmg: 18, rarity: 'legendary', price: 0, look: { blade: 0x9affd0, glow: 0x39ff9a }, desc: 'Moissonne l’âme : chaque ennemi tué rend de la mana.', manaOnKill: 12, source: 'boss:hell_forger' },
  { id: 'thunder_lance', name: 'Lance-Tonnerre', type: 'spear', cls: 'polearm', dmg: 42, speed: 1, reach: 3.4, stamina: 17, poise: 20, element: 'lightning', elemDmg: 20, rarity: 'epic', price: 5000, look: { blade: 0x8a9aba, glow: 0xb8d8ff }, desc: 'Le ciel répond quand elle frappe.' },
  // --- Dagues ---
  { id: 'assassin_dagger', name: 'Dague d’assassin', type: 'dagger', cls: 'dagger', dmg: 13, speed: 1.6, reach: 1.8, stamina: 8, poise: 6, crit: 0.15, element: 'poison', elemDmg: 5, rarity: 'rare', price: 1200, look: { blade: 0x5a6a5a, glow: 0x7aff3a }, desc: 'Coups très rapides, critiques fréquents, dos ×2.' },
  { id: 'vampire_fang', name: 'Croc du Vampire', type: 'dagger', cls: 'dagger', dmg: 22, speed: 1.6, reach: 1.9, stamina: 8, poise: 6, crit: 0.12, element: 'blood', elemDmg: 8, lifesteal: 0.08, rarity: 'legendary', price: 0, look: { blade: 0x8a1020, guard: 0x2a0a10, glow: 0xff2244 }, desc: 'Draine la vie à chaque coup (8 %).', source: 'boss:draven' },
  // --- Bâtons (bonus de magie) ---
  { id: 'apprentice_staff', name: 'Bâton d’apprenti', type: 'staff', cls: 'staff', dmg: 12, speed: 1, reach: 2.6, stamina: 12, poise: 10, magic: 0.2, element: 'physical', rarity: 'common', price: 800, look: { glow: 0x4dd8ff }, desc: '+20 % de puissance des pouvoirs.' },
  { id: 'necro_staff', name: 'Bâton du Nécromancien', type: 'staff', cls: 'staff', dmg: 20, speed: 1, reach: 2.6, stamina: 12, poise: 10, magic: 0.45, element: 'shadow', elemDmg: 10, rarity: 'epic', price: 0, look: { glow: 0x39ff9a, hilt: 0x2a2a20 }, desc: '+45 % de puissance des pouvoirs.', source: 'boss:necromancer' },
  { id: 'archmage_scepter', name: 'Sceptre de l’Archimage', type: 'staff', cls: 'staff', dmg: 26, speed: 1, reach: 2.7, stamina: 12, poise: 12, magic: 0.7, element: 'holy', elemDmg: 12, rarity: 'legendary', price: 9000, look: { glow: 0xffe89a, guard: 0xffc84a }, desc: '+70 % de puissance des pouvoirs.' },
];

export const SHIELDS = [
  { id: 'none', name: 'Aucun bouclier', shape: null, block: 0.45, stability: 1.4, price: 0, desc: 'Parade à l’arme : protège moins.' },
  { id: 'wooden', name: 'Rondache en bois', shape: 'round', block: 0.7, stability: 1.1, price: 0, look: { face: 0x5a3a20, rim: 0x5a5a60 }, desc: 'Légère mais fragile.' },
  { id: 'knight_shield', name: 'Écu de chevalier', shape: 'heater', block: 0.82, stability: 0.9, price: 700, look: { face: 0x4a2a6a, rim: 0xc8a050, emblem: 0xd8c890 }, desc: 'L’écu violet de l’Ordre de l’Aube.' },
  { id: 'kite_shield', name: 'Bouclier en amande', shape: 'kite', block: 0.88, stability: 0.8, price: 1500, look: { face: 0x5a5a66, rim: 0x9a8a50, emblem: 0x7a1a2a }, desc: 'Protège tout le flanc.' },
  { id: 'tower_shield', name: 'Pavois de fer', shape: 'tower', block: 0.96, stability: 0.6, price: 3000, speedMul: 0.93, look: { face: 0x3a3a44, rim: 0x6a6a74, emblem: 0x2a2a30 }, desc: 'Presque rien ne passe. Ralentit légèrement.' },
  { id: 'holy_bulwark', name: 'Rempart sacré', shape: 'heater', block: 0.92, stability: 0.7, price: 4500, holyRes: 0.3, look: { face: 0xe8e0c8, rim: 0xffc84a, emblem: 0xffc84a, glow: 0xffe89a }, desc: 'Parade parfaite : soigne légèrement.' },
  { id: 'void_aegis', name: 'Égide du Néant', shape: 'kite', block: 0.95, stability: 0.6, price: 0, look: { face: 0x120a1a, rim: 0x6a2a9a, emblem: 0x9a3cff, glow: 0xc06aff }, desc: 'Absorbe une partie des dégâts en mana.', source: 'boss:void_champion' },
];

// Tenues : apparence (spec humanoïde) + statistiques
export const OUTFITS = [
  {
    id: 'squire', name: 'Tenue d’écuyer', price: 0, rarity: 'common', def: 8, res: {}, bonus: {},
    look: { torso: 'leather', head: 'helm_open', arms: 'leather', legs: 'leather', c: { main: 0x6a6a70, leather: 0x4a3222, cloth: 0x3a2a1c, dark: 0x1a1410, skin: 0xc8a080 } },
    desc: 'Cuir et maille. Mieux que rien.',
  },
  {
    id: 'order_knight', name: 'Chevalier de l’Ordre', price: 600, rarity: 'common', def: 16, res: { shadow: 0.1 }, bonus: { hp: 20 },
    look: { torso: 'tabard', head: 'helm_great', extras: ['cape'], c: { main: 0x7a7a88, trim: 0xc8a050, cloth: 0x4a1060, cape: 0x2a0a3a, eyes: 0x9a4dff } },
    desc: 'L’armure violette de l’Ordre de l’Aube. +20 PV.',
  },
  {
    id: 'black_guard', name: 'Garde Noire', price: 1400, rarity: 'rare', def: 24, res: { shadow: 0.2 }, bonus: { hp: 30 },
    look: { torso: 'armor', head: 'helm_bascinet', extras: ['cape'], c: { main: 0x2a2a32, trim: 0x5a5a66, cape: 0x0a0a0e, eyes: 0xff3030 } },
    desc: 'Plates noircies. Résistance à l’ombre.',
  },
  {
    id: 'scarlet', name: 'Croisé Écarlate', price: 2000, rarity: 'rare', def: 22, res: { fire: 0.25 }, bonus: { dmg: 0.08 },
    look: { torso: 'tabard', head: 'helm_plume', extras: ['cape'], c: { main: 0x9a9aa8, trim: 0xd8b050, cloth: 0x8a1020, cape: 0x5a0a14, eyes: null } },
    desc: '+8 % de dégâts. Résiste au feu.',
  },
  {
    id: 'mist_ranger', name: 'Rôdeur des Brumes', price: 1800, rarity: 'rare', def: 14, res: { poison: 0.3 }, bonus: { stamina: 30, speed: 0.08 },
    look: { torso: 'leather', head: 'hood', arms: 'leather', legs: 'leather', extras: ['cape'], c: { cloth: 0x2a3a2a, leather: 0x3a2a1c, cape: 0x1a2a1a, eyes: 0x7affd0 } },
    desc: 'Léger : +30 endurance, +8 % vitesse.',
  },
  {
    id: 'spellblade', name: 'Lame-Mage', price: 2600, rarity: 'rare', def: 12, res: { lightning: 0.2, frost: 0.2 }, bonus: { mana: 40, magic: 0.2 },
    look: { torso: 'robe', head: 'hood', arms: 'robe', legs: 'robe', c: { cloth: 0x1a2a5a, trim: 0x8ac8ff, eyes: 0x4dd8ff } },
    desc: '+40 mana, +20 % puissance magique.',
  },
  {
    id: 'dawn_paladin', name: 'Paladin de l’Aube', price: 4800, rarity: 'epic', def: 32, res: { holy: 0.4, shadow: 0.25 }, bonus: { hp: 40, regen: 1 },
    look: { torso: 'armor', head: 'helm_crown', extras: ['cape', 'halo'], c: { main: 0xe0dcd0, trim: 0xffc84a, cape: 0xe8e0c8, glow: 0xffe89a, eyes: 0xffe89a } },
    desc: 'Régénère lentement la vie. +40 PV.',
  },
  {
    id: 'horned_knight', name: 'Chevalier Cornu', price: 0, rarity: 'epic', def: 36, res: { shadow: 0.35, fire: 0.15 }, bonus: { dmg: 0.12, hp: 30 },
    look: { torso: 'armor', head: 'helm_horned', extras: ['spikes'], bulk: 1.08, c: { main: 0x4a3a6a, trim: 0x2a2040, glow: 0x9a4dff, eyes: 0xff2020 } },
    desc: 'L’armure maudite du Chevalier Cornu. +12 % dégâts.', source: 'boss:horned_knight',
  },
  {
    id: 'bone_armor', name: 'Armure d’Os', price: 0, rarity: 'epic', def: 28, res: { poison: 0.3, shadow: 0.2 }, bonus: { poise: 0.3, hp: 20 },
    look: { torso: 'armor', head: 'skull', extras: ['shoulderSkulls', 'hunchSpikes'], c: { main: 0xcfc6a8, trim: 0x5a4a3a, bone: 0xe0d8c0, helmet: 0x5a5046, eyes: 0x39ff9a } },
    desc: 'Taillée dans le Colosse. Stabilité accrue.', source: 'boss:bone_colossus',
  },
  {
    id: 'green_specter', name: 'Voile de la Dame en Vert', price: 0, rarity: 'epic', def: 20, res: { poison: 0.5, shadow: 0.3 }, bonus: { mana: 40, lifesteal: 0.03 },
    look: { torso: 'tattered', head: 'hood', arms: 'robe', legs: 'robe', extras: ['cape'], c: { cloth: 0x1a4a3a, trim: 0x39ff9a, cape: 0x0a3a2a, eyes: 0x39ff9a } },
    desc: 'Vol de vie 3 %. Les spectres vous tiennent pour l’un des leurs.', source: 'boss:green_lady',
  },
  {
    id: 'vampire_lord', name: 'Manteau du Seigneur Vampire', price: 0, rarity: 'legendary', def: 26, res: { shadow: 0.3, blood: 0.5 }, bonus: { lifesteal: 0.06, speed: 0.06 },
    look: { torso: 'leather', head: 'vampire', arms: 'leather', legs: 'leather', extras: ['cape'], c: { leather: 0x1a0a10, cloth: 0x3a0a14, cape: 0x4a0a18, skin: 0xd8d0d8, dark: 0x0a0a0a, eyes: 0xff1030 } },
    desc: 'Vol de vie 6 %, +6 % vitesse.', source: 'boss:draven',
  },
  {
    id: 'lich_regalia', name: 'Parure du Roi-Liche', price: 0, rarity: 'legendary', def: 24, res: { frost: 0.5, shadow: 0.4 }, bonus: { mana: 60, magic: 0.35 },
    look: { torso: 'robe', head: 'lich', arms: 'robe', legs: 'robe', extras: ['orbs'], c: { cloth: 0x14141e, trim: 0x5a7a9a, skin: 0x5a7a9a, glow: 0x7ad4ff, eyes: 0xff1a1a } },
    desc: '+35 % magie, +60 mana. Le froid ne vous atteint plus.', source: 'boss:lich_king',
  },
  {
    id: 'frost_plate', name: 'Armure de l’Hiver Éternel', price: 0, rarity: 'legendary', def: 40, res: { frost: 0.6, fire: -0.1 }, bonus: { hp: 60 },
    look: { torso: 'armor', head: 'helm_winged', extras: ['iceSpikes', 'cape'], c: { main: 0xa8c8e8, trim: 0xe8f4ff, cape: 0x2a4a6a, glow: 0x7ad4ff, eyes: 0x7ad4ff } },
    desc: '+60 PV, immunité quasi totale au givre.', source: 'boss:winter_queen',
  },
  {
    id: 'infernal_plate', name: 'Armure Infernale', price: 0, rarity: 'legendary', def: 42, res: { fire: 0.6, frost: -0.1 }, bonus: { dmg: 0.15 },
    look: { torso: 'armor', head: 'demon', extras: ['spikes', 'flameHead'], bulk: 1.1, c: { main: 0x2a1410, trim: 0xff6a1a, skin: 0x3a1a14, dark: 0x0a0505, glow: 0xff5a0a, eyes: 0xffb020 } },
    desc: '+15 % dégâts, résiste aux flammes.', source: 'boss:asmoroth',
  },
  {
    id: 'void_knight', name: 'Chevalier du Néant', price: 0, rarity: 'legendary', def: 48, res: { shadow: 0.5, holy: 0.2, fire: 0.2, frost: 0.2 }, bonus: { dmg: 0.15, magic: 0.15, hp: 50 },
    look: { torso: 'armor', head: 'helm_crown', extras: ['cape', 'halo'], c: { main: 0x14101c, trim: 0x9a3cff, cape: 0x0a0612, glow: 0xc06aff, eyes: 0xc06aff } },
    desc: 'L’armure du Roi Sans Visage. Tout est plus puissant.', source: 'boss:faceless_king',
  },
];

export const CONSUMABLES = {
  heal: { name: 'Fiole de Braise', desc: 'Rend 45 % des PV.', color: '#ff7a2a' },
  mana: { name: 'Fiole d’Éther', desc: 'Rend 60 % de la mana.', color: '#4dd8ff' },
};

export function weaponById(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}
export function shieldById(id) {
  return SHIELDS.find((s) => s.id === id) || SHIELDS[0];
}
export function outfitById(id) {
  return OUTFITS.find((o) => o.id === id) || OUTFITS[0];
}

// Prix d'amélioration de l'arme (+1 à +5)
export function upgradeCost(weapon, level) {
  const base = weapon.rarity === 'legendary' ? 900 : weapon.rarity === 'epic' ? 650 : weapon.rarity === 'rare' ? 450 : 300;
  return Math.round(base * Math.pow(1.7, level));
}
