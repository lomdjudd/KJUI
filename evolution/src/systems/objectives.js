// Objectifs guidés pour accompagner le joueur à chaque étape.
import { G, toast } from '../core/state.js';
import { canEvolve } from './evolution.js';
import { sfx } from '../core/audio.js';

const has = (id) => (G.inv[id] || 0) > 0;
const built = (t) => G.buildings.some((b) => b.type === t);

export const OBJECTIVES = [
  { id: 'o_eat', stage: 0, text: 'Mange 10 nutriments jaunes (touche-les)', check: () => G.stats.eaten >= 10, dna: 5 },
  { id: 'o_mut', stage: 0, text: 'Achète ta première mutation (touche G)', check: () => G.mutations.length > 0 },
  { id: 'o_evo0', stage: 0, text: 'Achète « Double noyau », réunis l’ADN et évolue (G)', check: () => G.stage > 0 },
  { id: 'o_hunt1', stage: 1, text: 'Dévore 5 créatures plus petites que toi', check: () => (G.stats.sk || 0) >= 5 },
  { id: 'o_evo1', stage: 1, text: 'Évolue en poisson (Nageoire primitive + Corde dorsale)', check: () => G.stage > 1 },
  { id: 'o_fish', stage: 2, text: 'Chasse 8 proies dans l’océan (clic pour mordre)', check: () => (G.stats.sk || 0) >= 8 },
  { id: 'o_evo2', stage: 2, text: 'Développe Poumons + Nageoires lobées et sors de l’eau', check: () => G.stage > 2 },
  { id: 'o_drink', stage: 3, text: 'Bois de l’eau (E au bord de l’eau) et mange des insectes', check: () => (G.stats.sk || 0) >= 3 },
  { id: 'o_evo3', stage: 3, text: 'Évolue en reptile', check: () => G.stage > 3 },
  { id: 'o_evo4', stage: 4, text: 'Survis aux dinosaures et évolue en mammifère', check: () => G.stage > 4 },
  { id: 'o_evo5', stage: 5, text: 'Chasse, grandis et évolue en primate', check: () => G.stage > 5 },
  { id: 'o_pick', stage: 6, text: 'Ramasse 3 bâtons et 3 pierres (E)', check: () => (G.inv.baton || 0) >= 3 && (G.inv.pierre || 0) >= 3 },
  { id: 'o_evo6', stage: 6, text: 'Évolue en hominidé (Bipédie + Pouce opposable)', check: () => G.stage > 6 },
  { id: 'o_axe', stage: 7, text: 'Fabrique une hache en pierre (I) : bâton + pierres + corde', check: () => has('hache_pierre') },
  { id: 'o_fire', stage: 7, text: 'Recherche le feu (T) puis construis un feu de camp (B)', check: () => built('feu_camp') },
  { id: 'o_cook', stage: 7, text: 'Cuis de la viande au feu de camp', check: () => G.known.includes('viande_cuite') },
  { id: 'o_evo7', stage: 7, text: 'Achète le Langage (G) et deviens Homo sapiens', check: () => G.stage > 7 },
  { id: 'o_tribe', stage: 8, text: 'Recherche « Vie en tribu » (T)', check: () => G.techs.includes('tribu') },
  { id: 'o_village', stage: 8, text: 'Fonde ton village (V)', check: () => !!G.village },
  { id: 'o_hut', stage: 8, text: 'Construis 2 huttes pour loger ton peuple', check: () => G.buildings.filter((b) => b.type === 'hutte').length >= 2 },
  { id: 'o_agri', stage: 8, text: 'Découvre l’agriculture et plante un champ', check: () => built('champ') },
  { id: 'o_bronze', stage: 8, text: 'Entre dans l’âge du bronze (forge)', check: () => built('forge') },
  { id: 'o_shop', stage: 8, text: 'Ouvre une boutique et vends des objets', check: () => (G.stats.sold || 0) > 0 },
  { id: 'o_king', stage: 8, text: 'Construis un palais et deviens roi (Lois)', check: () => G.title === 'roi' || G.title === 'president' },
  { id: 'o_invent', stage: 8, text: 'Invente ton propre objet (I → Atelier d’invention)', check: () => G.customCount > 0 },
  { id: 'o_ind', stage: 8, text: 'Lance la révolution industrielle : construis une usine', check: () => built('usine') },
  { id: 'o_pres', stage: 8, text: 'Découvre la démocratie et deviens président(e)', check: () => G.title === 'president' },
  { id: 'o_2000', stage: 8, text: 'Atteins l’an 2000 et construis un ordinateur', check: () => built('ordinateur') },
  { id: 'o_code', stage: 8, text: 'Écris et lance un programme sur l’ordinateur', check: () => (G.stats.programs || 0) > 0 },
  { id: 'o_robot', stage: 8, text: 'Fabrique un robot à l’usine', check: () => G.robots.length > 0 },
  { id: 'o_monster', stage: 8, text: 'Fusionne de l’ADN au laboratoire et deviens un monstre', check: () => !!G.monster },
  { id: 'o_space', stage: 8, text: 'Lance une fusée vers les étoiles !', check: () => !!G.launched },
];

export function currentObjective() {
  return OBJECTIVES.find((o) => o.stage === G.stage && !G.objectivesDone.includes(o.id)) || null;
}

let timer = 0;
export function updateObjectives(dt) {
  timer -= dt;
  if (timer > 0) return;
  timer = 0.5;
  for (const o of OBJECTIVES) {
    if (o.stage !== G.stage || G.objectivesDone.includes(o.id)) continue;
    if (o.check()) {
      G.objectivesDone.push(o.id);
      const reward = o.dna ? `+${o.dna} ADN` : G.stage >= 7 ? '+10 savoir' : '+10 ADN';
      if (o.dna) G.dna += o.dna;
      else if (G.stage >= 7) G.savoir += 10;
      else G.dna += 10;
      toast(`✅ Objectif accompli : ${o.text} (${reward})`, 'good');
      sfx('levelup');
    }
    break; // un objectif à la fois
  }
  if (canEvolve() && !G._evoHint) {
    G._evoHint = true;
    toast('🧬 Tu peux évoluer ! Ouvre la génétique (G).', 'good');
  }
  if (!canEvolve()) G._evoHint = false;
}
