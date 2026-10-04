// Fabrication (recettes, stations) et atelier d'invention libre.
import { G, bus, toast, news } from '../core/state.js';
import { RECIPES, STATION_NAMES, item, ITEMS } from '../data/items.js';
import { stageDef } from '../data/stages.js';
import * as inv from './inventory.js';
import { sfx } from '../core/audio.js';
import { clamp } from '../core/util.js';

export function nearStation(station) {
  if (!station) return true;
  const P = G.player;
  if (!P || G.mode !== 'world') return false;
  for (const b of G.buildings) {
    const d = G.buildingsSys?.def(b.type);
    if (d?.station === station && Math.hypot(b.x - P.pos.x, b.z - P.pos.z) < 9) return true;
  }
  return false;
}

export function recipeUnlocked(r) {
  return !r.tech || G.techs.includes(r.tech);
}

export function canCraft(r, mult = 1) {
  if (!stageDef(G.stage).canCraft) return false;
  return recipeUnlocked(r) && nearStation(r.station) && inv.hasAll(r.ins, mult);
}

export function craft(r, mult = 1) {
  if (!stageDef(G.stage).canCraft) {
    toast('Tu dois évoluer en Hominidé pour fabriquer des objets.', 'bad');
    return false;
  }
  if (!recipeUnlocked(r)) return toast('Technologie manquante.', 'bad');
  if (!nearStation(r.station)) {
    toast(`Il faut être près d’un(e) ${STATION_NAMES[r.station]}.`, 'bad');
    sfx('error');
    return false;
  }
  if (!inv.takeAll(r.ins, mult)) {
    toast('Ingrédients manquants : ' + inv.missing(r.ins, mult).join(', '), 'bad');
    sfx('error');
    return false;
  }
  inv.add(r.out, r.n * mult);
  G.stats.crafted += mult;
  if (!G.known.includes(r.out)) {
    G.known.push(r.out);
    let s = 3 + Math.round((item(r.out).value || 1) / 8);
    if (G.mutations.includes('gros_cerveau') || G.mutations.includes('genie')) s = Math.round(s * 1.5);
    G.savoir += s;
    toast(`Nouvel objet : ${item(r.out).icon} ${item(r.out).name} (+${s} savoir)`, 'good');
  }
  sfx('craft');
  bus.emit('crafted', r.out);
  return true;
}

// ---------- Atelier d'invention ----------
// Combine n'importe quels objets : si c'est une recette connue, on la fabrique,
// sinon on crée une invention dont les pouvoirs dépendent des ingrédients.

export const INVENTION_TYPES = {
  arme: { name: 'Arme', icon: '⚔️', desc: 'Frappe au corps à corps (ou tire si elle contient de la poudre, une batterie...).' },
  outil: { name: 'Outil', icon: '🔧', desc: 'Récolte bois et pierre (puissance selon les matériaux).' },
  nourriture: { name: 'Nourriture', icon: '🍽️', desc: 'Se mange : faim et santé.' },
  potion: { name: 'Potion', icon: '🧪', desc: 'Effet magique selon les ingrédients.' },
  bombe: { name: 'Explosif', icon: '💣', desc: 'Se lance et explose.' },
  machine: { name: 'Machine', icon: '⚙️', desc: 'Se pose dans le monde et produit une ressource chaque heure.' },
  composant: { name: 'Composant', icon: '🔩', desc: 'Pièce détachée : renforce les inventions qui l’utilisent.' },
  armure: { name: 'Armure', icon: '🛡️', desc: 'Protège automatiquement.' },
};

export function matchRecipe(sel) {
  const ids = Object.keys(sel).filter((k) => sel[k] > 0).sort();
  for (const r of RECIPES) {
    const rid = Object.keys(r.ins).sort();
    if (rid.length !== ids.length || rid.some((x, i) => x !== ids[i])) continue;
    if (rid.every((x) => sel[x] >= r.ins[x])) return r;
  }
  return null;
}

// Prévisualise les caractéristiques d'une invention
export function inventionStats(sel, type) {
  let power = 0;
  let count = 0;
  const tags = new Set();
  for (const [id, n] of Object.entries(sel)) {
    if (n <= 0) continue;
    const it = item(id);
    power += (it.value || 1) * n;
    count += n;
    if (it.cat === 'food' || it.food) tags.add('food');
    if (['poudre', 'dynamite', 'grenade', 'bombe_poudre', 'soufre'].includes(id)) tags.add('boom');
    if (['batterie', 'circuit', 'puce', 'moteur', 'uranium'].includes(id)) tags.add('tech');
    if (['herbe_med', 'champignon', 'fleur', 'plume', 'or'].includes(id) || it.potion) tags.add('magic');
    if (['acier', 'fer', 'bronze', 'pierre', 'silex'].includes(id)) tags.add('hard');
    if (it.custom?.type === 'composant') power += it.custom.power * 0.8;
    for (const res of ['bois', 'pierre', 'fer_brut', 'charbon', 'cuivre', 'petrole', 'ble', 'baies', 'viande', 'herbe_med', 'or_brut', 'silicium', 'uranium']) if (id === res) tags.add('res:' + res);
  }
  const genius = G.mutations.includes('genie') ? 1.3 : 1;
  power *= genius;
  const p = Math.sqrt(power);
  const st = { power: Math.round(power), tags: [...tags] };
  switch (type) {
    case 'arme':
      st.dmg = Math.round(6 + p * 3.2);
      st.ranged = tags.has('boom') || tags.has('tech');
      break;
    case 'outil':
      st.tier = clamp(Math.round(p / 4), 1, 4);
      break;
    case 'nourriture':
      st.hunger = Math.round(10 + p * 4);
      st.hp = Math.round(p * 3);
      break;
    case 'potion':
      st.effect = tags.has('tech') ? 'fly' : tags.has('boom') ? 'strength' : tags.has('magic') ? (p > 10 ? 'giant' : 'speed') : 'heal';
      st.amount = Math.round(30 + p * 6);
      st.dur = Math.round(20 + p * 2);
      break;
    case 'bombe':
      st.dmg = Math.round(30 + p * (tags.has('boom') ? 12 : 4));
      st.radius = Math.round(clamp(3 + p * 0.5, 3, 25));
      break;
    case 'machine': {
      const res = [...tags].filter((t) => t.startsWith('res:')).map((t) => t.slice(4));
      st.produce = res[0] || 'bois';
      st.rate = Math.round(clamp(p / 6, 0.3, 5) * (tags.has('tech') ? 2 : 1) * 10) / 10;
      break;
    }
    case 'composant':
      break;
    case 'armure':
      st.armor = Math.round(clamp(p * 0.8, 1, 40));
      break;
  }
  return st;
}

export function invent(sel, type, name, icon) {
  const ids = Object.keys(sel).filter((k) => sel[k] > 0);
  if (!ids.length) return toast('Choisis au moins un objet.', 'bad');
  for (const id of ids) if (inv.count(id) < sel[id]) return toast('Tu n’as pas assez de ' + item(id).name, 'bad');
  // Recette connue ?
  const r = matchRecipe(sel);
  if (r && recipeUnlocked(r)) {
    if (!nearStation(r.station)) return toast(`C’est la recette de « ${item(r.out).name} », mais il faut un(e) ${STATION_NAMES[r.station]}.`, 'bad');
    return craft(r, 1);
  }
  const st = inventionStats(sel, type);
  for (const id of ids) inv.remove(id, sel[id]);
  const id = 'inv_' + ++G.customCount;
  const value = Math.round(st.power * 1.4 + 5);
  const def = { id, name: name || 'Invention ' + G.customCount, icon: icon || INVENTION_TYPES[type].icon, cat: 'invention', value, custom: { type, power: st.power, from: sel } };
  switch (type) {
    case 'arme':
      def.weapon = st.ranged ? { dmg: st.dmg, range: 90, proj: st.dmg > 80 ? 'laser' : 'bullet', rate: 0.5 } : { dmg: st.dmg, range: 3 };
      break;
    case 'outil':
      def.tool = { kind: 'axe', tier: st.tier };
      def.weapon = { dmg: 8 + st.tier * 6, range: 2.6 };
      // Un outil inventé sert de hache ET de pioche
      def.multitool = true;
      break;
    case 'nourriture':
      def.food = { hunger: st.hunger, hp: st.hp, thirst: 10 };
      break;
    case 'potion':
      def.potion = { effect: st.effect, amount: st.amount, dur: st.dur };
      break;
    case 'bombe':
      def.throw = { dmg: st.dmg, radius: st.radius, kind: 'bomb' };
      break;
    case 'machine':
      def.machine = { produce: st.produce, rate: st.rate };
      break;
    case 'armure':
      def.armor = st.armor;
      break;
  }
  G.customItems[id] = def;
  if (def.multitool) {
    // Ajoute aussi une « pioche » jumelle utilisable automatiquement
    def.tool = { kind: 'axe', tier: st.tier };
    G.customItems[id + '_p'] = { ...def, id: id + '_p', name: def.name + ' (pioche)', tool: { kind: 'pick', tier: st.tier }, hidden: true };
  }
  inv.add(id, 1);
  if (def.multitool) inv.add(id + '_p', 1, true);
  G.savoir += 5;
  sfx('craft');
  news(`Invention : ${def.name}.`);
  toast(`💡 Tu as inventé : ${def.icon} ${def.name} !`, 'good');
  bus.emit('crafted', id);
  return def;
}

export function allRecipes() {
  return RECIPES;
}

export { ITEMS };
