// ADN, mutations, statistiques et passage d'une étape de l'évolution à l'autre.
import { G, bus, toast, news } from '../core/state.js';
import { STAGES, MUTATIONS, stageDef } from '../data/stages.js';
import { TRAITS } from '../data/species.js';
import { bestArmor } from './inventory.js';
import { pick } from '../core/util.js';
import { sfx } from '../core/audio.js';

export function stageMutations(stage = G.stage) {
  return MUTATIONS[STAGES[stage].id] || [];
}

export function mutDef(id, stage = G.stage) {
  return stageMutations(stage).find((m) => m.id === id);
}

export function gainDna(n, pos) {
  let k = 1;
  if (G.stage === 0 && G.mutations.includes('noyau')) k = 1.5;
  if (G.stage >= 1) k = 1 + G.stage * 0.05;
  const v = Math.max(1, Math.round(n * k));
  G.dna += v;
  G.dnaTotal += v;
  if (pos) G.fx.text(pos.clone().setY(pos.y + 1), `+${v} ADN`, '#7affc0');
  bus.emit('dna');
}

export function buyMutation(id) {
  const m = mutDef(id);
  if (!m || G.mutations.includes(id)) return false;
  if (m.req && !G.mutations.includes(m.req)) {
    toast(`Il faut d’abord : ${mutDef(m.req).name}`, 'bad');
    return false;
  }
  if (G.dna < m.cost) {
    toast('Pas assez d’ADN', 'bad');
    sfx('error');
    return false;
  }
  G.dna -= m.cost;
  G.mutations.push(id);
  sfx('levelup');
  toast(`Mutation acquise : ${m.icon} ${m.name}`, 'good');
  bus.emit('mutated');
  return true;
}

export function evolveRequirements() {
  const st = stageDef(G.stage);
  const req = stageMutations().filter((m) => m.evolve);
  const missingMuts = req.filter((m) => !G.mutations.includes(m.id));
  return { dnaNeeded: st.dna, dnaOk: G.dna >= st.dna, missingMuts, last: G.stage >= STAGES.length - 1 };
}

export function canEvolve() {
  const r = evolveRequirements();
  return !r.last && r.dnaOk && r.missingMuts.length === 0;
}

export function evolve() {
  if (!canEvolve()) return false;
  const from = G.stage;
  // Une partie des mutations est transmise aux descendants
  for (const id of G.mutations) {
    const m = mutDef(id);
    if (!m) continue;
    for (const k of ['hp', 'atk', 'speed']) if (m.stats[k]) G.inherited[k] += m.stats[k] * 0.25;
  }
  G.dna -= stageDef(from).dna;
  G.stats.sk = 0;
  G.stage++;
  G.mutations = [];
  const st = stageDef(G.stage);
  G.time.year = Math.max(G.time.year, st.year);
  if (st.canCraft && !G.techs.includes('outils_pierre')) G.techs.push('outils_pierre');
  // Mutation aléatoire offerte
  const pool = stageMutations().filter((m) => !m.evolve && !m.req);
  if (pool.length && Math.random() < 0.5) {
    const m = pick(pool);
    G.mutations.push(m.id);
    setTimeout(() => toast(`Mutation aléatoire : ${m.icon} ${m.name} !`, 'good'), 4000);
  }
  news(`Évolution : tu deviens ${st.name}.`);
  sfx('evolve');
  bus.emit('evolved', from, G.stage);
  return true;
}

// Statistiques finales du joueur
export function computeStats() {
  const st = stageDef(G.stage);
  const s = { ...st.base };
  s.hp += G.inherited.hp;
  s.atk += G.inherited.atk;
  s.speed += G.inherited.speed * 0.5;
  for (const id of G.mutations) {
    const m = mutDef(id);
    if (!m) continue;
    for (const [k, v] of Object.entries(m.stats)) s[k] = (s[k] || 0) + v;
  }
  // Grossit en mangeant (étapes aquatiques)
  if (st.env !== 'land') s.size *= 1 + 0.6 * Math.min(1, G.dna / st.dna);
  if (G.monster) {
    s.size *= 1.4;
    s.hp += 200;
    s.atk += 30;
    for (const t of G.monster.traits) {
      const tr = TRAITS[t];
      if (!tr) continue;
      for (const [k, v] of Object.entries(tr.stats)) {
        if (k === 'size') s.size *= 1 + v * 0.3;
        else s[k] = (s[k] || 0) + v;
      }
    }
  }
  s.armor += bestArmor();
  if (G.career === 'soldat') s.atk += 10;
  if (G.career === 'chasseur') s.atk += 5;
  if (G.mutations.includes('athlete')) s.speed += 0;
  return s;
}

export const HUMAN_STAGE = STAGES.length - 1;
