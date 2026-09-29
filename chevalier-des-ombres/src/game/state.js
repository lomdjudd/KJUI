// Profil de partie (tout ce qui est sauvegardé) et calcul des statistiques du chevalier.
import { SKILLS } from '../data/skills.js';
import { weaponById, shieldById, outfitById, WEAPON_CLASSES } from '../data/equipment.js';
import { QUESTS } from '../data/quests.js';

export const SAVE_VERSION = 1;

export function newProfile(difficulty = 'knight') {
  return {
    version: SAVE_VERSION,
    created: Date.now(),
    saved: Date.now(),
    difficulty,
    level: 1,
    xp: 0,
    shards: 0,
    skillPoints: 0,
    zone: 'hub',
    pos: null,
    yaw: Math.PI,
    lastAltar: { zone: 'hub', id: 'hub' },
    altars: ['hub'],
    zonesUnlocked: ['hub', 'graveyard'],
    weapons: { rusty_sword: 0 },
    weapon: 'rusty_sword',
    shields: ['none', 'wooden'],
    shield: 'wooden',
    outfits: ['squire'],
    outfit: 'squire',
    powers: ['fireball'],
    powerSlots: ['fireball', null, null, null],
    powerIndex: 0,
    skills: {},
    flaskUpgrades: { heal: 0, mana: 0, potency: 0 },
    quests: {},
    bosses: {},
    chests: {},
    pages: {},
    pois: {},
    bestiary: {},
    stats: { kills: 0, deaths: 0, playTime: 0, bossKills: 0, damageDealt: 0 },
    flags: {},
    ending: false,
  };
}

// Complète un profil ancien avec les champs manquants
export function migrateProfile(p) {
  const base = newProfile(p.difficulty);
  for (const k of Object.keys(base)) if (p[k] === undefined) p[k] = base[k];
  for (const k of Object.keys(base.stats)) if (p.stats[k] === undefined) p.stats[k] = 0;
  for (const k of Object.keys(base.flaskUpgrades)) if (p.flaskUpgrades[k] === undefined) p.flaskUpgrades[k] = 0;
  return p;
}

export function xpForLevel(level) {
  return Math.round(90 * Math.pow(level, 1.45));
}

// Somme des bonus des compétences apprises
export function skillMods(profile) {
  const m = {};
  for (const s of SKILLS) {
    const rank = profile.skills[s.id] || 0;
    if (!rank) continue;
    for (const [k, v] of Object.entries(s.mods)) m[k] = (m[k] || 0) + v * rank;
  }
  return m;
}

// Statistiques dérivées (niveau + compétences + équipement)
export function computeStats(profile) {
  const sk = skillMods(profile);
  const w = weaponById(profile.weapon);
  const cls = WEAPON_CLASSES[w.cls];
  const sh = cls.shield ? shieldById(profile.shield) : shieldById('none');
  const o = outfitById(profile.outfit);
  const ob = o.bonus || {};
  const L = profile.level - 1;
  const up = profile.weapons[w.id] || 0;
  const st = {
    maxHp: Math.round(100 + L * 12 + (sk.hp || 0) + (ob.hp || 0)),
    maxStamina: Math.round(110 + L * 3 + (sk.stamina || 0) + (ob.stamina || 0)),
    maxMana: Math.round(60 + L * 4 + (sk.mana || 0) + (ob.mana || 0)),
    def: (o.def || 0) + (sk.def || 0) + L * 0.6,
    res: { ...(o.res || {}) },
    dmgMul: (1 + L * 0.045) * (1 + (sk.dmg || 0) + (ob.dmg || 0)),
    magicMul: (1 + L * 0.045) * (1 + (sk.magic || 0) + (ob.magic || 0) + (w.magic || 0)),
    crit: 0.05 + (sk.crit || 0) + (w.crit || 0) + (ob.crit || 0),
    critMul: 1.8 + (sk.critMul || 0),
    heavyMul: 1.6 * (1 + (sk.heavyDmg || 0)),
    poiseMul: 1 + (sk.poiseDmg || 0),
    staggerMul: 1 + (sk.staggerDmg || 0),
    elemMul: 1 + (sk.elemDmg || 0),
    parryWindow: 0.2 * (1 + (sk.parryWindow || 0)),
    blockCost: Math.max(0.3, 1 + (sk.blockCost || 0)),
    rollCost: Math.max(0.4, 1 + (sk.rollCost || 0)),
    rollIframes: 0.34 + (sk.rollIframes || 0),
    sprintCost: Math.max(0.3, 1 + (sk.sprintCost || 0)),
    speedMul: (1 + (sk.speed || 0) + (ob.speed || 0)) * (sh.speedMul || 1),
    lifesteal: (sk.lifesteal || 0) + (ob.lifesteal || 0) + (w.lifesteal || 0),
    manaRegen: 1.5 + (sk.manaRegen || 0),
    hpRegen: ob.regen || 0,
    staminaRegen: 52 * (1 + (sk.staminaRegen || 0)),
    cooldownMul: Math.max(0.5, 1 - (sk.cooldown || 0)),
    flaskHeal: 0.45 * (1 + (sk.flaskHeal || 0) + profile.flaskUpgrades.potency * 0.15),
    flasks: 3 + (sk.flasks || 0) + profile.flaskUpgrades.heal,
    manaFlasks: 1 + (sk.manaFlasks || 0) + profile.flaskUpgrades.mana,
    manaOnHit: sk.manaOnHit || 0,
    backstab: sk.backstab ? 2 : 1.4,
    riposte: 1 + (sk.riposte || 0),
    furyOnKill: !!sk.furyOnKill,
    secondWind: !!sk.secondWind,
    dodgeCounter: !!sk.dodgeCounter,
    comboSpeed: 1 + (sk.comboSpeed || 0),
    spellCrit: sk.spellCrit || 0,
    shardMul: 1 + (sk.shards || 0),
    xpMul: 1 + (sk.xp || 0),
    poise: 25 * (1 + (sk.poise || 0) + (ob.poise || 0)),
    // Arme
    weapon: w,
    weaponClass: cls,
    upgrade: up,
    weaponDmg: w.dmg * (1 + up * 0.14),
    weaponElem: (w.elemDmg || 0) * (1 + up * 0.12),
    shield: sh,
    outfit: o,
  };
  return st;
}

export function questState(profile, id) {
  return profile.quests[id];
}

export function initialQuests(profile) {
  for (const q of QUESTS) if (q.autoStart && !profile.quests[q.id]) profile.quests[q.id] = { status: 'active', progress: q.objectives.map(() => 0) };
}
