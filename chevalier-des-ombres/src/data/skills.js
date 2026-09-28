// Arbre de compétences (4 branches) et pouvoirs magiques.

export const BRANCHES = [
  { id: 'blade', name: 'Lame', color: '#ff5a4a', icon: '⚔', desc: 'Dégâts, critiques et enchaînements.' },
  { id: 'bulwark', name: 'Rempart', color: '#e0b050', icon: '⛨', desc: 'Vitalité, défense et parades.' },
  { id: 'arcana', name: 'Arcanes', color: '#5ab0ff', icon: '✦', desc: 'Mana, puissance et pouvoirs.' },
  { id: 'shadow', name: 'Ombre', color: '#b56aff', icon: '☾', desc: 'Esquives, vitesse et vol de vie.' },
];

// mods : bonus par rang. tier : rangée dans l'arbre (0 en haut). req : compétence requise.
export const SKILLS = [
  // --- Lame ---
  { id: 'strength', branch: 'blade', tier: 0, col: 1, name: 'Force', max: 3, cost: 1, mods: { dmg: 0.08 }, desc: '+8 % de dégâts physiques par rang.' },
  { id: 'precision', branch: 'blade', tier: 1, col: 0, name: 'Précision', max: 2, cost: 1, req: 'strength', mods: { crit: 0.05 }, desc: '+5 % de chances de critique par rang.' },
  { id: 'heavy_hand', branch: 'blade', tier: 1, col: 2, name: 'Main lourde', max: 2, cost: 1, req: 'strength', mods: { heavyDmg: 0.2, poiseDmg: 0.2 }, desc: 'Attaques lourdes +20 %, brise-garde +20 % par rang.' },
  { id: 'flurry', name: 'Enchaînement', branch: 'blade', tier: 2, col: 0, max: 1, cost: 2, req: 'precision', mods: { comboSpeed: 0.12 }, desc: 'Les enchaînements sont 12 % plus rapides.' },
  { id: 'riposte', branch: 'blade', tier: 2, col: 1, name: 'Riposte mortelle', max: 1, cost: 2, req: 'strength', mods: { riposte: 1.5 }, desc: 'Après une parade parfaite, le coup suivant inflige +150 %.' },
  { id: 'executioner', branch: 'blade', tier: 2, col: 2, name: 'Exécuteur', max: 2, cost: 1, req: 'heavy_hand', mods: { staggerDmg: 0.3 }, desc: '+30 % de dégâts contre les ennemis étourdis, par rang.' },
  { id: 'fury', branch: 'blade', tier: 3, col: 1, name: 'Furie', max: 1, cost: 3, req: 'riposte', mods: { furyOnKill: 1 }, desc: 'Chaque ennemi tué : +20 % de dégâts pendant 6 s.' },
  { id: 'critmaster', branch: 'blade', tier: 3, col: 0, name: 'Coup fatal', max: 1, cost: 2, req: 'flurry', mods: { critMul: 0.5 }, desc: 'Les critiques infligent ×2,3 au lieu de ×1,8.' },
  // --- Rempart ---
  { id: 'vitality', branch: 'bulwark', tier: 0, col: 1, name: 'Vitalité', max: 3, cost: 1, mods: { hp: 30 }, desc: '+30 PV max par rang.' },
  { id: 'endurance', branch: 'bulwark', tier: 1, col: 0, name: 'Endurance', max: 2, cost: 1, req: 'vitality', mods: { stamina: 20, staminaRegen: 0.1 }, desc: '+20 endurance, +10 % récupération par rang.' },
  { id: 'iron_skin', branch: 'bulwark', tier: 1, col: 2, name: 'Peau de fer', max: 2, cost: 1, req: 'vitality', mods: { def: 10 }, desc: '+10 défense par rang.' },
  { id: 'perfect_parry', branch: 'bulwark', tier: 2, col: 0, name: 'Parade parfaite', max: 1, cost: 2, req: 'endurance', mods: { parryWindow: 0.5 }, desc: 'Fenêtre de parade parfaite +50 %.' },
  { id: 'shield_master', branch: 'bulwark', tier: 2, col: 2, name: 'Maître du bouclier', max: 2, cost: 1, req: 'iron_skin', mods: { blockCost: -0.2 }, desc: 'Bloquer coûte 20 % d’endurance en moins par rang.' },
  { id: 'flask_mastery', branch: 'bulwark', tier: 2, col: 1, name: 'Alchimie', max: 2, cost: 1, req: 'vitality', mods: { flaskHeal: 0.25, flasks: 1 }, desc: '+1 Fiole de Braise, soins +25 % par rang.' },
  { id: 'second_wind', branch: 'bulwark', tier: 3, col: 1, name: 'Second souffle', max: 1, cost: 3, req: 'flask_mastery', mods: { secondWind: 1 }, desc: 'Une fois par repos, survit à un coup fatal avec 30 % de PV.' },
  { id: 'unbreakable', branch: 'bulwark', tier: 3, col: 2, name: 'Inébranlable', max: 1, cost: 2, req: 'shield_master', mods: { poise: 0.5 }, desc: 'Vous êtes beaucoup plus difficile à interrompre.' },
  // --- Arcanes ---
  { id: 'wisdom', branch: 'arcana', tier: 0, col: 1, name: 'Sagesse', max: 3, cost: 1, mods: { mana: 25 }, desc: '+25 mana max par rang.' },
  { id: 'power', branch: 'arcana', tier: 1, col: 0, name: 'Puissance occulte', max: 3, cost: 1, req: 'wisdom', mods: { magic: 0.12 }, desc: '+12 % de dégâts des pouvoirs par rang.' },
  { id: 'meditation', branch: 'arcana', tier: 1, col: 2, name: 'Méditation', max: 2, cost: 1, req: 'wisdom', mods: { manaRegen: 1.2 }, desc: '+1,2 mana/s par rang.' },
  { id: 'focus', branch: 'arcana', tier: 2, col: 2, name: 'Concentration', max: 2, cost: 1, req: 'meditation', mods: { cooldown: 0.12 }, desc: 'Temps de recharge des pouvoirs −12 % par rang.' },
  { id: 'soul_siphon', branch: 'arcana', tier: 2, col: 1, name: 'Siphon d’âme', max: 1, cost: 2, req: 'wisdom', mods: { manaOnHit: 2 }, desc: 'Chaque coup d’arme rend 2 mana.' },
  { id: 'elemental', branch: 'arcana', tier: 2, col: 0, name: 'Affinité élémentaire', max: 2, cost: 1, req: 'power', mods: { elemDmg: 0.2 }, desc: 'Dégâts élémentaires des armes +20 % par rang.' },
  { id: 'ether_flask', branch: 'arcana', tier: 3, col: 1, name: 'Fioles d’éther', max: 1, cost: 2, req: 'soul_siphon', mods: { manaFlasks: 1 }, desc: '+1 Fiole d’Éther.' },
  { id: 'archmage', branch: 'arcana', tier: 3, col: 0, name: 'Archimage', max: 1, cost: 3, req: 'elemental', mods: { magic: 0.25, spellCrit: 0.15 }, desc: '+25 % magie, les pouvoirs peuvent être critiques.' },
  // --- Ombre ---
  { id: 'agility', branch: 'shadow', tier: 0, col: 1, name: 'Agilité', max: 2, cost: 1, mods: { rollCost: -0.15 }, desc: 'Les roulades coûtent 15 % d’endurance en moins par rang.' },
  { id: 'swift', branch: 'shadow', tier: 1, col: 0, name: 'Célérité', max: 2, cost: 1, req: 'agility', mods: { speed: 0.06, sprintCost: -0.25 }, desc: '+6 % vitesse, sprint moins coûteux, par rang.' },
  { id: 'phantom_step', branch: 'shadow', tier: 1, col: 2, name: 'Pas fantôme', max: 1, cost: 2, req: 'agility', mods: { rollIframes: 0.1 }, desc: 'Invulnérabilité prolongée pendant les roulades.' },
  { id: 'backstab', branch: 'shadow', tier: 2, col: 0, name: 'Assassin', max: 1, cost: 2, req: 'swift', mods: { backstab: 1 }, desc: 'Les coups dans le dos infligent ×2.' },
  { id: 'leech', branch: 'shadow', tier: 2, col: 1, name: 'Vampirisme', max: 2, cost: 1, req: 'agility', mods: { lifesteal: 0.025 }, desc: 'Vol de vie +2,5 % par rang.' },
  { id: 'shadow_counter', branch: 'shadow', tier: 2, col: 2, name: 'Contre-ombre', max: 1, cost: 2, req: 'phantom_step', mods: { dodgeCounter: 1 }, desc: 'Une esquive parfaite ralentit le temps un court instant.' },
  { id: 'greed', branch: 'shadow', tier: 3, col: 0, name: 'Pilleur', max: 2, cost: 1, req: 'backstab', mods: { shards: 0.15, xp: 0.05 }, desc: '+15 % d’éclats d’âme et +5 % d’expérience par rang.' },
  { id: 'night_hunter', branch: 'shadow', tier: 3, col: 1, name: 'Chasseur nocturne', max: 1, cost: 3, req: 'leech', mods: { dmg: 0.1, crit: 0.05, speed: 0.04 }, desc: '+10 % dégâts, +5 % critique, +4 % vitesse.' },
];

// Pouvoirs : sorts équipables sur 4 emplacements
export const POWERS = [
  { id: 'fireball', name: 'Boule de feu', element: 'fire', mana: 16, cd: 2.5, type: 'projectile', dmg: 34, radius: 3, speed: 22, icon: '🔥', price: 0, desc: 'Projectile qui explose et enflamme.' },
  { id: 'lightning', name: 'Foudre', element: 'lightning', mana: 22, cd: 5, type: 'strike', dmg: 55, radius: 3, icon: '⚡', price: 800, desc: 'La foudre s’abat sur l’ennemi ciblé.' },
  { id: 'frost_nova', name: 'Nova de givre', element: 'frost', mana: 28, cd: 9, type: 'nova', dmg: 30, radius: 7, icon: '❄', price: 1200, desc: 'Gèle les ennemis autour de vous.' },
  { id: 'spectral_blades', name: 'Lames spectrales', element: 'shadow', mana: 24, cd: 6, type: 'homing', dmg: 22, count: 3, speed: 16, icon: '🗡', price: 1500, desc: 'Trois lames qui cherchent leurs proies.' },
  { id: 'shadow_step', name: 'Pas de l’ombre', element: 'shadow', mana: 14, cd: 4, type: 'dash', dmg: 26, range: 9, icon: '☾', price: 1000, desc: 'Traverse les ennemis en les blessant. Invulnérable.' },
  { id: 'holy_light', name: 'Lumière sacrée', element: 'holy', mana: 30, cd: 14, type: 'heal', heal: 0.35, dmg: 20, radius: 5, icon: '✚', price: 1400, desc: 'Soigne 35 % des PV et blesse les morts-vivants proches.' },
  { id: 'poison_cloud', name: 'Nuée pestilente', element: 'poison', mana: 22, cd: 8, type: 'cloud', dmg: 9, radius: 4, duration: 6, icon: '☣', price: 0, desc: 'Un nuage toxique qui ronge les ennemis.', source: 'boss:plague_abomination' },
  { id: 'earthquake', name: 'Séisme', element: 'physical', mana: 30, cd: 10, type: 'quake', dmg: 50, radius: 8, icon: '⛰', price: 0, desc: 'Frappe le sol : dégâts massifs et étourdissement.', source: 'boss:frost_titan' },
  { id: 'meteor', name: 'Pluie de météores', element: 'fire', mana: 45, cd: 16, type: 'meteor', dmg: 60, radius: 3.5, count: 6, icon: '☄', price: 0, desc: 'Des météores s’écrasent autour de la cible.', source: 'boss:inferno_elemental' },
  { id: 'soul_shield', name: 'Bouclier d’âmes', element: 'arcane', mana: 30, cd: 18, type: 'shield', absorb: 0.5, duration: 10, icon: '◈', price: 2000, desc: 'Absorbe la moitié des dégâts pendant 10 s.' },
  { id: 'berserk', name: 'Rage du berserker', element: 'blood', mana: 20, cd: 20, type: 'buff', dmgBuff: 0.4, speedBuff: 0.15, duration: 10, icon: '♥', price: 0, desc: '+40 % dégâts, +15 % vitesse pendant 10 s.', source: 'boss:fenrok' },
  { id: 'chain_lightning', name: 'Chaîne d’éclairs', element: 'lightning', mana: 32, cd: 8, type: 'chain', dmg: 38, bounces: 5, range: 12, icon: 'ϟ', price: 3500, desc: 'Un éclair qui rebondit d’ennemi en ennemi.' },
  { id: 'ice_lance', name: 'Lance de glace', element: 'frost', mana: 20, cd: 3.5, type: 'pierce', dmg: 42, speed: 30, icon: '✧', price: 0, desc: 'Traverse tous les ennemis alignés et les ralentit.', source: 'boss:winter_queen' },
  { id: 'spirit_wolves', name: 'Loups spectraux', element: 'shadow', mana: 40, cd: 30, type: 'summon', count: 2, duration: 25, dmg: 14, icon: '🐺', price: 0, desc: 'Invoque deux loups spectraux alliés.', source: 'boss:spider_queen' },
  { id: 'life_drain', name: 'Drain de vie', element: 'blood', mana: 8, cd: 12, type: 'drain', dmg: 18, duration: 3, range: 12, icon: '❦', price: 0, desc: 'Aspire la vie de l’ennemi ciblé (canalisé).', source: 'boss:draven' },
  { id: 'divine_wrath', name: 'Colère divine', element: 'holy', mana: 50, cd: 22, type: 'pillars', dmg: 70, count: 8, radius: 9, icon: '☀', price: 6000, desc: 'Des piliers de lumière frappent tout autour.' },
  { id: 'bone_spear', name: 'Lance d’os', element: 'physical', mana: 18, cd: 3, type: 'projectile', dmg: 40, radius: 1.5, speed: 34, icon: '🦴', price: 0, desc: 'Un projectile d’os perforant.', source: 'boss:necromancer' },
  { id: 'void_wave', name: 'Onde du Néant', element: 'shadow', mana: 60, cd: 25, type: 'wave', dmg: 120, range: 14, angle: 0.8, icon: '◉', price: 0, desc: 'Une onde qui déchire tout devant vous.', source: 'boss:nyxalith' },
];

export function powerById(id) {
  return POWERS.find((p) => p.id === id);
}
export function skillById(id) {
  return SKILLS.find((s) => s.id === id);
}
