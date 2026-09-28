// Bestiaire : 44 types d'ennemis. Les statistiques sont relatives au palier (tier) de la zone
// et multipliées par les coefficients de chaque créature.

export const tierStats = (tier) => ({
  hp: 50 * Math.pow(1.45, tier - 1),
  dmg: 10 * Math.pow(1.36, tier - 1),
  xp: 14 * Math.pow(1.5, tier - 1),
  shards: 9 * Math.pow(1.5, tier - 1),
});

// Attaques courantes (réutilisées)
const A = {
  slash: { anim: 'slashR', type: 'melee', range: 2.3, arc: 1.3, dmg: 1, cd: 1.6 },
  slash2: { anim: 'slashL', type: 'melee', range: 2.3, arc: 1.3, dmg: 1, cd: 1.6 },
  overhead: { anim: 'overhead', type: 'melee', range: 2.4, arc: 0.8, dmg: 1.4, cd: 2.4 },
  thrust: { anim: 'thrust', type: 'melee', range: 2.8, arc: 0.6, dmg: 1.1, cd: 1.8 },
  slam: { anim: 'slam', type: 'melee', range: 2.8, arc: 1.0, dmg: 1.8, cd: 3.5, shock: 3.5 },
  sweep: { anim: 'sweep2h', type: 'melee', range: 3, arc: 2.2, dmg: 1.3, cd: 2.8 },
  claw: { anim: 'claw', type: 'melee', range: 2, arc: 1.2, dmg: 0.8, cd: 1.1 },
  clawL: { anim: 'clawL', type: 'melee', range: 2, arc: 1.2, dmg: 0.8, cd: 1.1 },
  bite: { anim: 'bite', type: 'melee', range: 2.1, arc: 1, dmg: 1, cd: 1.4 },
  stab: { anim: 'stab', type: 'melee', range: 1.9, arc: 0.8, dmg: 0.7, cd: 0.8 },
  kick: { anim: 'kick', type: 'melee', range: 2, arc: 1, dmg: 0.8, cd: 2.5, knock: 6 },
};

export const ENEMIES = [
  // ===================== CIMETIÈRE DES BRUMES (palier 1) =====================
  {
    id: 'skeleton', name: 'Squelette', rig: 'humanoid', kind: 'bone', undead: true, hpMul: 1, dmgMul: 1, speed: 3.2, poise: 20, ai: 'melee',
    model: { torso: 'bones', head: 'skull', arms: 'bone', legs: 'bone', c: { eyes: 0x39ff9a } }, weapon: { type: 'sword', look: { blade: 0x7a6a5a } }, stance: '1h',
    attacks: [A.slash, A.slash2, A.thrust], resist: { poison: 0.8 }, weak: ['holy', 'physical'],
    desc: 'Les morts du cimetière se relèvent à chaque nuit sans lune.',
  },
  {
    id: 'skeleton_archer', name: 'Squelette archer', rig: 'humanoid', kind: 'bone', undead: true, hpMul: 0.8, dmgMul: 0.9, speed: 3, poise: 12, ai: 'ranged',
    model: { torso: 'bones', head: 'skull', arms: 'bone', legs: 'bone', c: { eyes: 0x39ff9a, helmet: 0x3a3a40 } }, weapon: { type: 'bow' }, stance: 'bow', keepDist: 12,
    attacks: [{ anim: 'bowShot', type: 'projectile', proj: 'arrow', range: 22, dmg: 0.9, cd: 2.8 }, A.stab], resist: { poison: 0.8 }, weak: ['holy'],
    desc: 'Ses flèches sifflent dans la brume. Approchez-vous vite.',
  },
  {
    id: 'ghoul', name: 'Goule', rig: 'humanoid', kind: 'flesh', undead: true, hpMul: 0.9, dmgMul: 0.8, speed: 5, poise: 12, ai: 'melee', hunch: 0.5,
    model: { torso: 'flesh', head: 'ghoul', arms: 'claws', legs: 'flesh', armLen: 1.25, c: { skin: 0x6a7a5a, cloth: 0x2a2018, eyes: 0xffe050 } }, stance: 'claws',
    attacks: [A.claw, A.clawL, { ...A.bite, anim: 'bite', dmg: 1.2, status: { poison: 3 } }], weak: ['fire', 'holy'],
    desc: 'Rapide et affamée. Ses griffes empoisonnent.',
  },
  {
    id: 'zombie', name: 'Mort-vivant', rig: 'humanoid', kind: 'flesh', undead: true, hpMul: 1.3, dmgMul: 1.1, speed: 1.8, poise: 25, ai: 'melee', limp: 1,
    model: { torso: 'flesh', head: 'zombie', arms: 'flesh', legs: 'flesh', c: { skin: 0x7a8a6a, cloth: 0x3a3028, eyes: 0xc8ff3a } }, stance: 'zombie',
    attacks: [{ ...A.overhead, anim: 'hammer', dmg: 1.3 }, A.bite], weak: ['fire'],
    desc: 'Lent, mais il ne s’arrête jamais.',
  },
  {
    id: 'wisp', name: 'Âme errante', rig: 'wisp', kind: 'spirit', undead: true, hpMul: 0.4, dmgMul: 1.6, speed: 4.5, poise: 999, ai: 'exploder', flying: 0.3,
    model: { c: { core: 0x7affd0, shell: 0x1a6a5a } }, spectralGlow: 0x7affd0,
    attacks: [{ anim: 'charge', type: 'explode', range: 2, radius: 3, dmg: 1.4, cd: 99, dur: 1.2, hit: [0.95, 1] }], resist: { physical: 0.3, poison: 1 }, weak: ['holy'],
    desc: 'Une âme perdue qui explose au contact des vivants.',
  },
  {
    id: 'bat', name: 'Chauve-souris vampire', rig: 'bat', kind: 'flesh', hpMul: 0.35, dmgMul: 0.6, speed: 6.5, poise: 5, ai: 'flyer', flying: 1.5, scale: 1.3,
    model: { c: { main: 0x2a1a24, wing: 0x3a1a2a } },
    attacks: [{ anim: 'dive', type: 'melee', range: 1.8, arc: 1.5, dmg: 1, cd: 2, dur: 0.8, hit: [0.5, 0.7], lifesteal: 0.5 }],
    desc: 'Nuées assoiffées. Frappez-les quand elles plongent.',
  },
  {
    id: 'crypt_rat', name: 'Rat des cryptes', rig: 'quad', kind: 'flesh', hpMul: 0.3, dmgMul: 0.5, speed: 5.5, poise: 3, ai: 'swarm', scale: 1.1,
    model: { type: 'rat', c: { main: 0x3a3230, belly: 0x5a4a44, eyes: 0xff3030 } },
    attacks: [{ anim: 'bite', type: 'melee', range: 1.3, arc: 1.2, dmg: 1, cd: 0.9, dur: 0.45, hit: [0.35, 0.5], status: { poison: 1.5 } }],
    desc: 'Seul, inoffensif. Jamais seul.',
  },
  {
    id: 'green_specter', name: 'Spectre vert', rig: 'humanoid', kind: 'spirit', undead: true, hpMul: 1.1, dmgMul: 1.1, speed: 3.6, poise: 30, ai: 'teleporter', hover: 1, spectral: 0x39ff9a,
    model: { torso: 'tattered', head: 'skull', arms: 'bone', legs: 'none', c: { cloth: 0x80ffb0, bone: 0xc0ffe0, eyes: 0xffffff } }, stance: 'claws',
    attacks: [A.claw, A.clawL, { anim: 'cast', type: 'drain', range: 9, dmg: 0.35, cd: 6, duration: 2 }], resist: { physical: 0.35, poison: 1, frost: 0.5 }, weak: ['holy', 'fire'],
    desc: 'Âme d’une noble enterrée vivante. Elle aspire la vie.',
  },
  // ===================== FORÊT MAUDITE (palier 2) =====================
  {
    id: 'shadow_wolf', name: 'Loup des ombres', rig: 'quad', kind: 'flesh', hpMul: 0.8, dmgMul: 0.9, speed: 7, poise: 12, ai: 'charger', scale: 1.1,
    model: { type: 'wolf', c: { main: 0x1a1824, belly: 0x2a2834, eyes: 0xb04dff, dark: 0x0a0810 } },
    attacks: [
      { anim: 'bite', type: 'melee', range: 2, arc: 1.1, dmg: 1, cd: 1.3, dur: 0.5, hit: [0.35, 0.55] },
      { anim: 'pounce', type: 'leap', range: 9, minRange: 4, dmg: 1.3, cd: 5, dur: 1, hit: [0.7, 0.8], radius: 2 },
    ], weak: ['fire'],
    desc: 'Ils chassent en meute sous les arbres morts.',
  },
  {
    id: 'tomb_spider', name: 'Araignée des tombes', rig: 'spider', kind: 'flesh', hpMul: 1, dmgMul: 1, speed: 5, poise: 15, ai: 'ranged', keepDist: 7,
    model: { c: { main: 0x1a1418, mark: 0xb03030, eyes: 0xff3030 } },
    attacks: [
      { anim: 'bite', type: 'melee', range: 2.3, arc: 1.2, dmg: 1.1, cd: 1.5, dur: 0.6, hit: [0.4, 0.6], status: { poison: 4 } },
      { anim: 'spit', type: 'projectile', proj: 'web', range: 15, dmg: 0.5, cd: 4, dur: 0.8, hit: [0.55, 0.6], status: { slow: 2.5 } },
    ], weak: ['fire'],
    desc: 'Crache une toile qui englue les imprudents.',
  },
  {
    id: 'scarecrow', name: 'Épouvantail maudit', rig: 'humanoid', kind: 'flesh', hpMul: 1.2, dmgMul: 1.2, speed: 3.4, poise: 25, ai: 'ambusher',
    model: { torso: 'leather', head: 'sack', arms: 'leather', legs: 'leather', c: { leather: 0x5a4a2a, cloth: 0x4a3a1a, dark: 0x2a1a0a, eyes: 0xff8a1a } }, weapon: { type: 'scythe', look: { blade: 0x5a5a60 } }, stance: 'polearm', twoHanded: true,
    attacks: [A.sweep, { ...A.thrust, range: 3.3 }], weak: ['fire'], resist: { poison: 0.5 },
    desc: 'Immobile… jusqu’à ce que vous passiez à portée de sa faux.',
  },
  {
    id: 'cultist', name: 'Cultiste de l’Ombre', rig: 'humanoid', kind: 'flesh', hpMul: 0.8, dmgMul: 1, speed: 3.4, poise: 12, ai: 'caster', keepDist: 11,
    model: { torso: 'robe', head: 'hood', arms: 'robe', legs: 'robe', c: { cloth: 0x2a0a1a, trim: 0x8a1a2a, eyes: 0xff3030 } }, stance: 'caster',
    attacks: [{ anim: 'cast', type: 'projectile', proj: 'fireball', range: 20, dmg: 1.1, cd: 3, element: 'fire' }, { anim: 'castAoe', type: 'aoe', range: 12, radius: 3, dmg: 1.4, cd: 7, atTarget: true, element: 'fire', telegraph: 1.2 }], resist: { fire: 0.5 },
    desc: 'Il sert le Roi Sans Visage et invoque le feu.',
  },
  {
    id: 'sporeling', name: 'Sporelin', rig: 'humanoid', kind: 'flesh', hpMul: 0.6, dmgMul: 0.8, speed: 3.6, poise: 8, ai: 'exploder', scale: 0.7,
    model: { torso: 'flesh', head: 'mushroom', arms: 'flesh', legs: 'flesh', c: { skin: 0xc8b8a0, cloth: 0x6a2a8a, glow: 0xb56aff, eyes: 0xfff080 } }, stance: 'none',
    attacks: [{ anim: 'castAoe', type: 'explode', range: 2, radius: 3.5, dmg: 1, cd: 99, status: { poison: 5 }, element: 'poison' }], resist: { poison: 1 }, weak: ['fire'],
    desc: 'Explose en un nuage de spores toxiques.',
  },
  {
    id: 'werewolf', name: 'Loup-garou', rig: 'humanoid', kind: 'flesh', hpMul: 2.2, dmgMul: 1.4, speed: 5.5, poise: 45, ai: 'charger', scale: 1.25, hunch: 0.4,
    model: { torso: 'fur', head: 'wolf', arms: 'fur', legs: 'fur', bulk: 1.2, c: { skin: 0x3a3028, dark: 0x1a1410, cloth: 0x2a2018, eyes: 0xffcc22 } }, stance: 'claws', extras: ['tail'],
    attacks: [A.claw, A.clawL, { anim: 'jumpAtk', type: 'leap', range: 10, minRange: 4, dmg: 1.6, cd: 6, radius: 2.5 }, { anim: 'roar', type: 'scream', range: 5, radius: 5, dmg: 0.3, cd: 12 }], weak: ['holy', 'fire'],
    desc: 'Un chasseur qui a trop longtemps regardé la lune.',
  },
  // ===================== MARAIS PUTRIDE (palier 3) =====================
  {
    id: 'plague_zombie', name: 'Pestiféré', rig: 'humanoid', kind: 'flesh', undead: true, hpMul: 1.4, dmgMul: 1, speed: 2.2, poise: 25, ai: 'melee', limp: 1, gut: true,
    model: { torso: 'flesh', head: 'zombie', arms: 'flesh', legs: 'flesh', gut: true, bulk: 1.2, c: { skin: 0x6a8a3a, cloth: 0x3a3a18, eyes: 0xc8ff3a } }, stance: 'zombie',
    attacks: [{ ...A.overhead, anim: 'hammer', status: { poison: 4 } }], deathCloud: { radius: 3.5, poison: 5 }, resist: { poison: 1 }, weak: ['fire'],
    desc: 'À sa mort, il libère un nuage de peste.',
  },
  {
    id: 'acid_slime', name: 'Slime acide', rig: 'blob', kind: 'spirit', hpMul: 1.2, dmgMul: 0.9, speed: 2.8, poise: 10, ai: 'melee', splits: 'acid_slimelet',
    model: { c: { main: 0x7aff3a, core: 0x2a8a10 } },
    attacks: [{ anim: 'slam', type: 'aoe', range: 2.2, radius: 2.5, dmg: 1.1, cd: 2.2, dur: 1, hit: [0.55, 0.6], status: { poison: 3 }, element: 'poison' }], resist: { poison: 1, physical: 0.2 }, weak: ['fire', 'frost'],
    desc: 'Se divise en deux quand on le tranche.',
  },
  {
    id: 'acid_slimelet', name: 'Petit slime', rig: 'blob', kind: 'spirit', hpMul: 0.35, dmgMul: 0.5, speed: 3.6, poise: 3, ai: 'swarm', scale: 0.55, hidden: true,
    model: { c: { main: 0x9aff5a, core: 0x3a9a20 } },
    attacks: [{ anim: 'slam', type: 'melee', range: 1.5, arc: 2, dmg: 1, cd: 1.5, dur: 0.7, hit: [0.5, 0.6], element: 'poison' }], resist: { poison: 1 },
    desc: 'Fragment de slime.',
  },
  {
    id: 'swamp_hag', name: 'Guenaude des marais', rig: 'humanoid', kind: 'flesh', hpMul: 0.9, dmgMul: 1.1, speed: 3.2, poise: 14, ai: 'summoner', keepDist: 10, hunch: 0.5,
    model: { torso: 'tattered', head: 'hag', arms: 'robe', legs: 'robe', c: { cloth: 0x2a3a1a, skin: 0x6a8a4a, eyes: 0xc8ff3a } }, weapon: { type: 'staff', look: { glow: 0x7aff3a, hilt: 0x3a2a14 } }, stance: 'staff',
    attacks: [{ anim: 'cast', type: 'projectile', proj: 'poison', range: 18, dmg: 1, cd: 3, element: 'poison', status: { poison: 3 } }, { anim: 'castUp', type: 'summon', summon: 'acid_slimelet', count: 3, cd: 14, range: 20 }], resist: { poison: 1 }, weak: ['fire'],
    desc: 'Elle élève des slimes comme on élève des poules.',
  },
  {
    id: 'bog_serpent', name: 'Serpent des tourbières', rig: 'serpent', kind: 'flesh', hpMul: 1.4, dmgMul: 1.2, speed: 4.5, poise: 30, ai: 'melee', scale: 0.8,
    model: { segments: 8, c: { main: 0x2a4a2a, belly: 0x8a9a5a, mark: 0x1a2a1a } },
    attacks: [{ anim: 'strike', type: 'melee', range: 3, arc: 0.8, dmg: 1.2, cd: 1.8, dur: 0.7, hit: [0.4, 0.6], status: { poison: 3 } }, { anim: 'spit', type: 'projectile', proj: 'acid', range: 14, dmg: 0.9, cd: 4, dur: 0.8, hit: [0.5, 0.55], element: 'poison' }], resist: { poison: 0.8 }, weak: ['frost'],
    desc: 'Glisse sous l’eau croupie avant de frapper.',
  },
  {
    id: 'drowned', name: 'Noyé', rig: 'humanoid', kind: 'flesh', undead: true, hpMul: 1.2, dmgMul: 1.1, speed: 3, poise: 22, ai: 'melee',
    model: { torso: 'flesh', head: 'zombie', arms: 'claws', legs: 'flesh', extras: ['tentacleBeard'], c: { skin: 0x4a6a6a, cloth: 0x1a2a2a, eyes: 0x5affe0 } }, weapon: { type: 'spear', look: { hilt: 0x2a3a2a, blade: 0x5a7a6a } }, stance: 'polearm', twoHanded: true,
    attacks: [A.thrust, { ...A.sweep, range: 3.3 }], resist: { frost: 0.4, poison: 0.5 }, weak: ['lightning'],
    desc: 'Les pêcheurs disparus reviennent, harpon à la main.',
  },
  {
    id: 'giant_toad', name: 'Crapaud géant', rig: 'quad', kind: 'flesh', hpMul: 1.8, dmgMul: 1.2, speed: 3, poise: 35, ai: 'ranged', keepDist: 6, scale: 1.4,
    model: { type: 'toad', c: { main: 0x3a5a2a, belly: 0x9aa05a, glow: 0xc8ff3a, eyes: 0xffd030 } },
    attacks: [{ anim: 'breath', type: 'projectile', proj: 'acid', range: 12, dmg: 1, cd: 2.5, dur: 0.6, hit: [0.45, 0.5], element: 'poison', count: 3, spread: 0.25 }, { anim: 'pounce', type: 'leap', range: 10, minRange: 3, dmg: 1.4, cd: 5, dur: 1, hit: [0.7, 0.8], radius: 3 }], resist: { poison: 1 },
    desc: 'Sa langue et son venin portent loin.',
  },
  // ===================== CATACOMBES POURPRES (palier 4) =====================
  {
    id: 'skeleton_knight', glb: { model: 'knight', variant: 'bone' }, name: 'Chevalier squelette', rig: 'humanoid', kind: 'bone', undead: true, hpMul: 1.7, dmgMul: 1.2, speed: 3, poise: 45, ai: 'tank', blocks: 0.5,
    model: { torso: 'armor', head: 'skull', arms: 'bone', legs: 'bone', c: { main: 0x4a4a52, trim: 0x6a5a3a, helmet: 0x4a4a52, eyes: 0xb04dff } }, weapon: { type: 'sword', look: { blade: 0x8a8a90 } }, shield: { shape: 'kite', look: { face: 0x3a2a4a, rim: 0x6a5a3a, emblem: 0x5a1a2a } }, stance: '1h',
    attacks: [A.slash, A.overhead, { anim: 'bashL', type: 'melee', range: 2, arc: 1, dmg: 0.8, cd: 4, knock: 7 }], resist: { poison: 0.8 }, weak: ['holy'],
    desc: 'Bloque vos coups de face. Contournez-le ou brisez sa garde.',
  },
  {
    id: 'necro_adept', name: 'Adepte nécromant', rig: 'humanoid', kind: 'flesh', hpMul: 0.9, dmgMul: 1, speed: 3.2, poise: 12, ai: 'summoner', keepDist: 12,
    model: { torso: 'robe', head: 'plague', arms: 'robe', legs: 'robe', c: { cloth: 0x1a1a14, trim: 0x39ff9a, eyes: 0x39ff9a } }, weapon: { type: 'staff', look: { glow: 0x39ff9a } }, stance: 'staff',
    attacks: [{ anim: 'cast', type: 'projectile', proj: 'bone', range: 18, dmg: 1.1, cd: 2.8 }, { anim: 'castUp', type: 'summon', summon: 'skeleton', count: 2, cd: 16, range: 22 }], weak: ['holy'],
    desc: 'Relève les morts. Tuez-le en priorité.',
  },
  {
    id: 'banshee', name: 'Banshee', rig: 'humanoid', kind: 'spirit', undead: true, hpMul: 1, dmgMul: 1.1, speed: 4, poise: 25, ai: 'caster', hover: 1, spectral: 0x8ab8ff, keepDist: 8,
    model: { torso: 'tattered', head: 'hag', arms: 'robe', legs: 'none', c: { cloth: 0xa0c8ff, skin: 0xc0d8ff, eyes: 0xffffff } }, stance: 'caster',
    attacks: [{ anim: 'roar', type: 'scream', range: 6, radius: 6.5, dmg: 0.9, cd: 7, stun: 1.2 }, { anim: 'cast', type: 'projectile', proj: 'shadow', range: 18, dmg: 1, cd: 3, homing: 2 }], resist: { physical: 0.35, poison: 1, frost: 0.5 }, weak: ['holy'],
    desc: 'Son cri paralyse. Restez à distance quand elle inspire.',
  },
  {
    id: 'mimic', name: 'Mimic', rig: 'mimic', kind: 'flesh', hpMul: 2, dmgMul: 1.6, speed: 4, poise: 40, ai: 'ambusher', dormant: true,
    model: {},
    attacks: [{ anim: 'bite', type: 'melee', range: 2, arc: 1.2, dmg: 1.2, cd: 1.3, dur: 0.6, hit: [0.4, 0.55] }], shardMul: 5,
    desc: 'Tout coffre n’est pas un trésor. Celui-ci a des dents.',
  },
  {
    id: 'living_armor', glb: { model: 'knight', variant: 'ash' }, name: 'Armure vivante', rig: 'humanoid', kind: 'metal', hpMul: 2, dmgMul: 1.3, speed: 2.6, poise: 60, ai: 'tank',
    model: { torso: 'armor', head: 'helm_great', c: { main: 0x5a5a6a, trim: 0x3a3a44, eyes: 0x9a4dff } }, weapon: { type: 'greatsword', look: { blade: 0x9a9aa8 } }, stance: '2h', twoHanded: true,
    attacks: [A.sweep, A.slam, { ...A.overhead, dmg: 1.6 }], resist: { physical: 0.3, poison: 1, shadow: 0.3 }, weak: ['lightning'],
    desc: 'Vide à l’intérieur. Seule la foudre l’ébranle vraiment.',
  },
  {
    id: 'shadow_assassin', name: 'Assassin des ombres', rig: 'humanoid', kind: 'flesh', hpMul: 0.9, dmgMul: 1.3, speed: 5.5, poise: 14, ai: 'teleporter', invisible: true,
    model: { torso: 'leather', head: 'hood', arms: 'leather', legs: 'leather', c: { leather: 0x1a1420, cloth: 0x0a0810, dark: 0x050408, eyes: 0xb04dff } }, weapon: { type: 'dagger', look: { blade: 0x3a2a4a, glow: 0xa04dff } }, stance: 'dual',
    attacks: [A.stab, { ...A.stab, anim: 'stabL' }, { anim: 'thrust', type: 'melee', range: 2.4, arc: 0.8, dmg: 1.8, cd: 4, backstab: true }], weak: ['holy', 'fire'],
    desc: 'Invisible jusqu’à ce qu’il frappe dans votre dos.',
  },
  // ===================== CHÂTEAU DE NOCTHAR (palier 5) =====================
  {
    id: 'fallen_knight', glb: { model: 'knight', variant: 'obsidian' }, name: 'Chevalier déchu', rig: 'humanoid', kind: 'metal', hpMul: 1.8, dmgMul: 1.2, speed: 3.4, poise: 45, ai: 'melee', parries: 0.25,
    model: { torso: 'tabard', head: 'helm_bascinet', extras: ['cape'], c: { main: 0x3a3a44, trim: 0x6a5a3a, cloth: 0x2a2a1a, cape: 0x1a1a14, eyes: 0xff3030 } }, weapon: { type: 'sword', look: { blade: 0x6a6a74 } }, shield: { shape: 'heater', look: { face: 0x2a2a30, rim: 0x5a4a2a } }, stance: '1h',
    attacks: [A.slash, A.slash2, A.overhead, A.thrust], weak: ['holy'],
    desc: 'Autrefois frère d’armes. Il pare parfois vos attaques.',
  },
  {
    id: 'horned_knight_minion', glb: { model: 'knight', variant: 'crimson' }, name: 'Chevalier cornu', rig: 'humanoid', kind: 'metal', hpMul: 2.2, dmgMul: 1.4, speed: 3.2, poise: 55, ai: 'tank',
    model: { torso: 'armor', head: 'helm_horned', bulk: 1.1, c: { main: 0x4a3a6a, trim: 0x2a2040, eyes: 0xff2020, glow: 0x9a4dff } }, weapon: { type: 'greataxe', look: { blade: 0x5a4a7a, glow: 0x9a4dff } }, stance: '2h', twoHanded: true,
    attacks: [A.sweep, A.slam, { anim: 'overhead', type: 'melee', range: 2.8, arc: 0.8, dmg: 1.7, cd: 3, element: 'shadow' }], resist: { shadow: 0.5 }, weak: ['holy'],
    desc: 'La garde personnelle du Roi-Liche, aux yeux de braise.',
  },
  {
    id: 'gargoyle', name: 'Gargouille', rig: 'humanoid', kind: 'metal', hpMul: 1.5, dmgMul: 1.2, speed: 4.5, poise: 40, ai: 'flyer', flying: 3, hunch: 0.3,
    model: { torso: 'stone', head: 'demon', arms: 'stone', legs: 'stone', extras: ['stoneWings', 'tail'], c: { main: 0x5a5660, skin: 0x5a5660, dark: 0x3a3640, glow: 0x39ff9a, eyes: 0x39ff9a, wing: 0x4a4650 } }, stance: 'claws',
    attacks: [{ anim: 'claw', type: 'melee', range: 2.2, arc: 1.4, dmg: 1.2, cd: 2.5 }, { anim: 'slam', type: 'leap', range: 12, minRange: 3, dmg: 1.5, cd: 6, radius: 3 }], resist: { physical: 0.3, poison: 1 }, weak: ['lightning'],
    desc: 'Elle veille sur les remparts et fond sur les intrus.',
  },
  {
    id: 'lich_minor', name: 'Liche mineure', rig: 'humanoid', kind: 'bone', undead: true, hpMul: 1.3, dmgMul: 1.3, speed: 3, poise: 20, ai: 'teleporter', keepDist: 10, hover: 1,
    model: { torso: 'robe', head: 'lich', arms: 'robe', legs: 'robe', c: { cloth: 0x14141e, trim: 0x3a5a7a, skin: 0x5a7a9a, eyes: 0xff1a1a } }, stance: 'caster',
    attacks: [{ anim: 'cast', type: 'projectile', proj: 'frostbolt', range: 20, dmg: 1.1, cd: 2.4, element: 'frost', status: { slow: 2 } }, { anim: 'castAoe', type: 'aoe', range: 12, radius: 3.5, dmg: 1.4, cd: 8, atTarget: true, element: 'frost', telegraph: 1.2 }], resist: { frost: 0.8, poison: 1 }, weak: ['holy', 'fire'],
    desc: 'Encapuchonnée, le visage bleu et les yeux rouges. Elle se téléporte.',
  },
  {
    id: 'flagellant', name: 'Porte-fléau', rig: 'humanoid', kind: 'flesh', hpMul: 1.6, dmgMul: 1.3, speed: 3.6, poise: 35, ai: 'melee',
    model: { torso: 'flesh', head: 'executioner', arms: 'flesh', legs: 'leather', bulk: 1.15, extras: ['chains'], c: { skin: 0xa88878, cloth: 0x2a1a14, leather: 0x2a1a14, eyes: 0xff3030 } }, weapon: { type: 'mace', look: { blade: 0x5a5a60 } }, stance: '1h',
    attacks: [{ ...A.slash, anim: 'hammer', dmg: 1.2 }, { anim: 'spin', type: 'melee', range: 2.8, arc: 6.3, dmg: 1.2, cd: 5 }], weak: ['fire'],
    desc: 'Ses tourbillons de fléau ne laissent aucun répit.',
  },
  // ===================== PICS DE GIVRE (palier 6) =====================
  {
    id: 'frost_elemental', name: 'Élémentaire de givre', rig: 'humanoid', kind: 'metal', hpMul: 1.6, dmgMul: 1.2, speed: 3, poise: 40, ai: 'caster', keepDist: 8,
    model: { torso: 'crystal', head: 'elemental', arms: 'crystal', legs: 'crystal', c: { main: 0x8ad0ff, glow: 0xd8f4ff, eyes: 0xffffff } }, stance: 'brute',
    attacks: [{ anim: 'cast', type: 'projectile', proj: 'frostbolt', range: 18, dmg: 1, cd: 2.2, count: 3, spread: 0.2, element: 'frost', status: { slow: 2 } }, { anim: 'castAoe', type: 'aoe', range: 4, radius: 5, dmg: 1.3, cd: 8, element: 'frost', status: { freeze: 1.2 }, telegraph: 1.1 }], resist: { frost: 1, poison: 1 }, weak: ['fire'],
    desc: 'Glace vivante. Le feu la fait fondre.',
  },
  {
    id: 'ice_wraith', name: 'Spectre de glace', rig: 'humanoid', kind: 'spirit', undead: true, hpMul: 1.1, dmgMul: 1.3, speed: 4.5, poise: 20, ai: 'teleporter', hover: 1, spectral: 0x7ad4ff,
    model: { torso: 'tattered', head: 'hood', arms: 'robe', legs: 'none', extras: ['iceSpikes'], c: { cloth: 0xc8e8ff, glow: 0xffffff, eyes: 0xffffff } }, stance: 'claws',
    attacks: [{ ...A.claw, element: 'frost', status: { slow: 1.5 } }, { ...A.clawL, element: 'frost' }], resist: { physical: 0.35, frost: 1 }, weak: ['fire', 'holy'],
    desc: 'Le froid qui tue les voyageurs, fait chair.',
  },
  {
    id: 'frost_wolf', name: 'Loup des neiges', rig: 'quad', kind: 'flesh', hpMul: 1, dmgMul: 1, speed: 7.5, poise: 14, ai: 'charger', scale: 1.2,
    model: { type: 'wolf', c: { main: 0xc8d0e0, belly: 0xe8eef8, eyes: 0x5ad4ff, dark: 0x8a9ab0 } },
    attacks: [{ anim: 'bite', type: 'melee', range: 2, arc: 1.1, dmg: 1, cd: 1.2, dur: 0.5, hit: [0.35, 0.55], element: 'frost' }, { anim: 'pounce', type: 'leap', range: 10, minRange: 4, dmg: 1.3, cd: 5, dur: 1, hit: [0.7, 0.8], radius: 2 }, { anim: 'howl', type: 'summon', summon: 'frost_wolf', count: 1, cd: 30, dur: 1.2, hit: [0.5, 0.55], range: 20 }], resist: { frost: 0.7 }, weak: ['fire'],
    desc: 'Son hurlement appelle la meute.',
  },
  {
    id: 'yeti', name: 'Yéti', rig: 'humanoid', kind: 'flesh', hpMul: 3, dmgMul: 1.6, speed: 3.4, poise: 70, ai: 'melee', scale: 1.6, hunch: 0.3,
    model: { torso: 'fur', head: 'yeti', arms: 'fur', legs: 'fur', bulk: 1.4, armLen: 1.2, c: { skin: 0xd8dce8, dark: 0xa8b0c0, cloth: 0xa8b0c0, eyes: 0x5ad4ff } }, stance: 'brute',
    attacks: [{ ...A.slam, dmg: 1.6 }, A.claw, { anim: 'throw', type: 'projectile', proj: 'boulder', range: 20, dmg: 1.5, cd: 6 }], resist: { frost: 0.8 }, weak: ['fire'],
    desc: 'Il lance des blocs de glace gros comme un homme.',
  },
  {
    id: 'frozen_revenant', glb: { model: 'knight', variant: 'frost' }, name: 'Revenant gelé', rig: 'humanoid', kind: 'bone', undead: true, hpMul: 1.5, dmgMul: 1.2, speed: 3.2, poise: 35, ai: 'melee', revives: 1,
    model: { torso: 'armor', head: 'skull', arms: 'bone', legs: 'bone', extras: ['iceSpikes'], c: { main: 0x6a8aaa, trim: 0xc8e8ff, glow: 0x7ad4ff, helmet: 0x8aaaca, eyes: 0x7ad4ff } }, weapon: { type: 'greataxe', look: { blade: 0xa8d8ff, glow: 0x7ad4ff } }, stance: '2h', twoHanded: true,
    attacks: [A.sweep, { ...A.overhead, element: 'frost' }], resist: { frost: 0.9, poison: 1 }, weak: ['fire', 'holy'],
    desc: 'Se relève une fois après avoir été abattu. Brûlez ses restes.',
  },
  // ===================== ABÎME INFERNAL (palier 7) =====================
  {
    id: 'fire_imp', name: 'Diablotin', rig: 'humanoid', kind: 'flesh', hpMul: 0.6, dmgMul: 0.9, speed: 5.5, poise: 8, ai: 'flyer', flying: 2.2, scale: 0.6,
    model: { torso: 'flesh', head: 'demon', arms: 'claws', legs: 'flesh', extras: ['batwings', 'tail'], c: { skin: 0xc03a1a, cloth: 0x3a0a0a, dark: 0x1a0505, eyes: 0xffd020, wing: 0x5a1a10 } }, stance: 'claws',
    attacks: [{ anim: 'throw', type: 'projectile', proj: 'fireball', range: 16, dmg: 0.9, cd: 2.4, element: 'fire' }, { anim: 'claw', type: 'melee', range: 1.8, arc: 1.3, dmg: 0.8, cd: 1.5 }], resist: { fire: 1 }, weak: ['frost'],
    desc: 'Agaçant, rapide, et il crache des flammes.',
  },
  {
    id: 'hellhound', name: 'Chien des enfers', rig: 'quad', kind: 'flesh', hpMul: 1.3, dmgMul: 1.2, speed: 7, poise: 20, ai: 'charger', scale: 1.3,
    model: { type: 'hound', c: { main: 0x2a1410, belly: 0x3a1a14, eyes: 0xffd020, glow: 0xff5a0a, dark: 0x0a0505 } },
    attacks: [{ anim: 'bite', type: 'melee', range: 2.2, arc: 1.1, dmg: 1, cd: 1.3, dur: 0.5, hit: [0.35, 0.55], element: 'fire', status: { burn: 3 } }, { anim: 'breath', type: 'breath', range: 7, arc: 0.6, dmg: 0.25, cd: 6, dur: 1.6, hit: [0.25, 0.9], element: 'fire', status: { burn: 3 } }], resist: { fire: 1 }, weak: ['frost'],
    desc: 'Son souffle brûle même la pierre.',
  },
  {
    id: 'fire_elemental', name: 'Élémentaire de feu', rig: 'humanoid', kind: 'spirit', hpMul: 1.6, dmgMul: 1.3, speed: 3.4, poise: 40, ai: 'caster', keepDist: 7,
    model: { torso: 'magma', head: 'elemental', arms: 'magma', legs: 'magma', extras: ['flameHead'], c: { main: 0x3a1a10, glow: 0xff6a1a, eyes: 0xffff80 } }, stance: 'brute', aura: { element: 'fire', radius: 2.5, dps: 0.12 },
    attacks: [{ anim: 'cast', type: 'projectile', proj: 'fireball', range: 18, dmg: 1.1, cd: 2.5, element: 'fire' }, { anim: 'castAoe', type: 'aoe', range: 5, radius: 5, dmg: 1.5, cd: 8, element: 'fire', status: { burn: 4 }, telegraph: 1.1 }], resist: { fire: 1, poison: 1 }, weak: ['frost'],
    desc: 'Sa simple présence brûle. Ne restez pas collé à lui.',
  },
  {
    id: 'lesser_demon', name: 'Démon mineur', rig: 'humanoid', kind: 'flesh', hpMul: 2, dmgMul: 1.4, speed: 4, poise: 45, ai: 'melee', scale: 1.2,
    model: { torso: 'fur', head: 'demon', arms: 'claws', legs: 'fur', bulk: 1.15, extras: ['tail', 'batwings'], c: { skin: 0x7a1a14, dark: 0x1a0505, cloth: 0x2a0a08, eyes: 0xffb020, wing: 0x3a0a08 } }, weapon: { type: 'sword', look: { blade: 0x3a1a10, glow: 0xff5a0a } }, stance: '1h',
    attacks: [{ ...A.slash, element: 'fire' }, { ...A.overhead, element: 'fire', dmg: 1.5 }, { anim: 'castAoe', type: 'aoe', range: 3, radius: 4, dmg: 1.2, cd: 9, element: 'fire', telegraph: 1 }], resist: { fire: 0.8 }, weak: ['holy', 'frost'],
    desc: 'L’infanterie des enfers.',
  },
  {
    id: 'lava_golem', name: 'Golem de lave', rig: 'humanoid', kind: 'metal', hpMul: 3.2, dmgMul: 1.6, speed: 2.4, poise: 90, ai: 'tank', scale: 1.6,
    model: { torso: 'magma', head: 'stone', arms: 'magma', legs: 'magma', bulk: 1.5, c: { main: 0x2a1a14, glow: 0xff5a0a, eyes: 0xffd020 } }, stance: 'brute',
    attacks: [{ ...A.slam, element: 'fire', dmg: 1.8 }, { anim: 'claw', type: 'melee', range: 2.6, arc: 1.4, dmg: 1.2, cd: 2 }], resist: { fire: 1, physical: 0.25, poison: 1 }, weak: ['frost'],
    desc: 'Chaque coup au sol laisse une onde de feu.',
  },
  {
    id: 'flame_cultist', name: 'Pyromancien', rig: 'humanoid', kind: 'flesh', hpMul: 1, dmgMul: 1.2, speed: 3.4, poise: 15, ai: 'caster', keepDist: 12,
    model: { torso: 'robe', head: 'hood', arms: 'robe', legs: 'robe', extras: ['flameHead'], c: { cloth: 0x3a0a08, trim: 0xff6a1a, eyes: 0xffd020, glow: 0xff6a1a } }, stance: 'caster',
    attacks: [{ anim: 'castUp', type: 'meteor', range: 20, radius: 3, dmg: 1.5, cd: 8, count: 3, element: 'fire' }, { anim: 'cast', type: 'projectile', proj: 'fireball', range: 20, dmg: 1, cd: 2.5, element: 'fire' }], resist: { fire: 0.8 }, weak: ['frost'],
    desc: 'Il fait pleuvoir le feu du ciel.',
  },
  // ===================== CITADELLE DU NÉANT (palier 8) =====================
  {
    id: 'void_horror', name: 'Rejeton tentaculaire', rig: 'tentacle', kind: 'flesh', hpMul: 2.4, dmgMul: 1.3, speed: 0, poise: 999, ai: 'turret', scale: 0.8, static: true,
    model: { count: 5, c: { main: 0x2a1236, tip: 0xb04dff, eye: 0x7aff4d } },
    attacks: [{ anim: 'slam', type: 'aoe', range: 5, radius: 2.5, dmg: 1.4, cd: 2.5, dur: 1.1, hit: [0.55, 0.6], atTarget: true, telegraph: 0.9 }, { anim: 'sweep', type: 'aoe', range: 4, radius: 4.5, dmg: 1.2, cd: 6, dur: 1.2, hit: [0.55, 0.6] }], resist: { shadow: 0.8, poison: 0.5 }, weak: ['holy', 'fire'],
    desc: 'Enraciné dans le sol. Ne restez pas à sa portée.',
  },
  {
    id: 'void_knight', glb: { model: 'knight', variant: 'void' }, name: 'Chevalier du Néant', rig: 'humanoid', kind: 'metal', hpMul: 2.2, dmgMul: 1.4, speed: 3.8, poise: 55, ai: 'melee', parries: 0.3,
    model: { torso: 'armor', head: 'helm_crown', extras: ['cape'], c: { main: 0x14101c, trim: 0x9a3cff, cape: 0x0a0612, glow: 0xc06aff, eyes: 0xc06aff } }, weapon: { type: 'greatsword', look: { blade: 0x1a1022, glow: 0xc06aff } }, stance: '2h', twoHanded: true,
    attacks: [A.sweep, { ...A.slam, element: 'shadow' }, { anim: 'thrust', type: 'melee', range: 3.2, arc: 0.6, dmg: 1.3, cd: 2.5 }], resist: { shadow: 0.7 }, weak: ['holy'],
    desc: 'Des chevaliers qui ont juré fidélité au vide.',
  },
  {
    id: 'void_eye', name: 'Œil du Néant', rig: 'eye', kind: 'flesh', hpMul: 1.4, dmgMul: 1.3, speed: 2.5, poise: 999, ai: 'caster', flying: 1, keepDist: 10,
    model: { c: { iris: 0xff3a8a } },
    attacks: [{ anim: 'beam', type: 'beam', range: 16, dmg: 0.3, cd: 6, dur: 2, hit: [0.35, 0.95], element: 'shadow' }, { anim: 'cast', type: 'projectile', proj: 'shadow', range: 18, dmg: 0.9, cd: 2.5, dur: 0.6, hit: [0.5, 0.55], count: 3, spread: 0.3 }], resist: { shadow: 1, poison: 1 }, weak: ['holy'],
    desc: 'Il vous regarde. Il vous a toujours regardé.',
  },
  {
    id: 'faceless', name: 'Sans-Visage', rig: 'humanoid', kind: 'flesh', hpMul: 1.4, dmgMul: 1.3, speed: 4.2, poise: 30, ai: 'teleporter',
    model: { torso: 'robe', head: 'faceless', arms: 'robe', legs: 'robe', c: { cloth: 0xd8d0e0, skin: 0xf0e8f0, trim: 0x9a3cff, glow: 0xc06aff } }, weapon: { type: 'rapier', look: { blade: 0xe8e0f0, glow: 0xc06aff } }, stance: '1h',
    attacks: [A.thrust, A.slash, { anim: 'cast', type: 'projectile', proj: 'shadow', range: 18, dmg: 1, cd: 4, homing: 2.5 }], resist: { shadow: 0.8 }, weak: ['holy'],
    desc: 'Les serviteurs du Roi ont offert leur visage.',
  },
  {
    id: 'void_wisp', name: 'Étincelle du Néant', rig: 'wisp', kind: 'spirit', hpMul: 0.5, dmgMul: 1.8, speed: 5.5, poise: 999, ai: 'exploder', flying: 0.3,
    model: { c: { core: 0xc06aff, shell: 0x3a1a5a } },
    attacks: [{ anim: 'charge', type: 'explode', range: 2, radius: 3.5, dmg: 1.4, cd: 99, dur: 1, hit: [0.95, 1], element: 'shadow' }], resist: { shadow: 1, physical: 0.3 }, weak: ['holy'],
    desc: 'Un fragment instable de néant.',
  },
];

export function enemyById(id) {
  return ENEMIES.find((e) => e.id === id);
}
