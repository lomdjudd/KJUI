// Recherche technologique : dépense du savoir, fait avancer les époques.
import { G, bus, toast, news } from '../core/state.js';
import { TECHS, TECH, eraOf } from '../data/tech.js';
import { stageDef } from '../data/stages.js';
import { sfx } from '../core/audio.js';
import { fmtYear } from '../core/util.js';

export function techState(t) {
  if (G.techs.includes(t.id)) return 'done';
  if (!t.req.every((r) => G.techs.includes(r))) return 'locked';
  return G.savoir >= t.cost ? 'ready' : 'expensive';
}

export function canResearchAtAll() {
  return stageDef(G.stage).canCraft;
}

export function research(id) {
  const t = TECH[id];
  if (!t) return false;
  if (!canResearchAtAll()) return toast('Il faut être Hominidé pour inventer des technologies.', 'bad');
  if (t.id === 'tribu' && G.stage < 8) return toast('La vie en tribu demande le Langage : évolue en Homo sapiens.', 'bad');
  const s = techState(t);
  if (s === 'done') return false;
  if (s === 'locked') return toast('Recherche d’abord : ' + t.req.filter((r) => !G.techs.includes(r)).map((r) => TECH[r].name).join(', '), 'bad');
  if (s === 'expensive') {
    sfx('error');
    return toast(`Il faut ${t.cost} points de savoir.`, 'bad');
  }
  G.savoir -= t.cost;
  G.techs.push(t.id);
  const oldEra = eraOf(G.time.year).id;
  if (G.stage >= 8) G.time.year = Math.max(G.time.year, t.year);
  const newEra = eraOf(G.time.year);
  sfx('levelup');
  toast(`🔬 Découverte : ${t.icon} ${t.name} !`, 'good');
  news(`Découverte : ${t.name} (${fmtYear(G.time.year)}).`);
  if (newEra.id !== oldEra && G.stage >= 8) {
    setTimeout(() => toast(`🏛️ Nouvelle époque : ${newEra.name} !`, 'good'), 1200);
    news(`Entrée dans l’époque : ${newEra.name}.`);
    bus.emit('newEra', newEra);
  }
  bus.emit('tech', t.id);
  return true;
}

export { TECHS, TECH };
