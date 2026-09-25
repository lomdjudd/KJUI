import { SUITS } from './suits.js';

// Arbre de compétences : 1 point par niveau gagné (+1 par boss vaincu)
export const BRANCHES = [
  { key: 'defense', name: 'Défense', color: '#ff5a5a' },
  { key: 'combat', name: 'Combat', color: '#ffc83f' },
  { key: 'toile', name: 'Toile', color: '#4fb6ff' },
];

export const SKILLS = [
  { key: 'vitalite1', branch: 'defense', name: 'Vitalité I', desc: '+15 points de vie', cost: 1, eff: { hp: 15 } },
  { key: 'vitalite2', branch: 'defense', name: 'Vitalité II', desc: '+25 points de vie', cost: 2, req: 'vitalite1', eff: { hp: 25 } },
  { key: 'recup', branch: 'defense', name: 'Récupération', desc: 'Régénération hors combat x2', cost: 1, eff: { regenMul: 2 } },
  { key: 'reflexes', branch: 'defense', name: 'Réflexes', desc: 'Esquive plus longue et esquive parfaite plus facile', cost: 2, eff: { perfectWindow: 0.15, dodgeBonus: 0.1 } },
  { key: 'force1', branch: 'combat', name: 'Force I', desc: 'Dégâts +10 %', cost: 1, eff: { dmgMul: 1.1 } },
  { key: 'force2', branch: 'combat', name: 'Force II', desc: 'Dégâts +15 %', cost: 2, req: 'force1', eff: { dmgMul: 1.15 } },
  { key: 'focus', branch: 'combat', name: 'Concentration', desc: 'Gain de concentration +40 %', cost: 1, eff: { focusMul: 1.4 } },
  { key: 'bourreau', branch: 'combat', name: 'Maître du K.O.', desc: 'Soin et coup de grâce coûtent 35 au lieu de 50', cost: 2, eff: { focusCost: 35 } },
  { key: 'ingenieur', branch: 'combat', name: 'Ingénieur', desc: 'Recharge des gadgets -30 %', cost: 1, eff: { gadgetCdMul: 0.7 } },
  { key: 'elan', branch: 'toile', name: 'Élan', desc: 'Balancement 10 % plus rapide', cost: 1, eff: { swingMul: 1.1 } },
  { key: 'propulsion', branch: 'toile', name: 'Propulsion+', desc: '+2 propulsions-toile en l’air', cost: 1, eff: { airBoosts: 2 } },
  { key: 'catapulte', branch: 'toile', name: 'Catapulte', desc: 'Super-saut chargé 40 % plus haut', cost: 1, eff: { superJump: 1.4 } },
  { key: 'lanceur', branch: 'toile', name: 'Lanceur', desc: 'Lancer d’ennemi : dégâts x2', cost: 2, eff: { throwMul: 2 } },
];

export function canBuy(skill, save) {
  if (save.skills.includes(skill.key)) return false;
  if (skill.req && !save.skills.includes(skill.req)) return false;
  return save.skillPoints >= skill.cost;
}

function applyEff(st, eff) {
  for (const [k, v] of Object.entries(eff)) {
    if (k === 'hp') st.maxHealth += v;
    else if (k === 'focusCost') st.focusCost = Math.min(st.focusCost, v);
    else if (k === 'airBoosts' || k === 'webBonus' || k === 'perfectWindow' || k === 'dodgeBonus') st[k] += v;
    else st[k] *= v;
  }
}

// Statistiques du joueur : niveau + compétences + bonus du costume porté
export function computeStats(save, suitKey) {
  const l = save.level;
  const st = {
    maxHealth: 100 + (l - 1) * 12,
    dmgMul: 1 + (l - 1) * 0.06,
    dmgTakenMul: 1,
    regenMul: 1,
    swingMul: 1,
    focusMul: 1,
    gadgetCdMul: 1,
    webBonus: 0,
    xpMul: 1,
    perfectWindow: 0,
    dodgeBonus: 0,
    focusCost: 50,
    airBoosts: 3,
    superJump: 1,
    throwMul: 1,
  };
  for (const s of SKILLS) if (save.skills.includes(s.key)) applyEff(st, s.eff);
  const suit = SUITS[suitKey];
  if (suit) applyEff(st, suit.bonus || {});
  return st;
}
