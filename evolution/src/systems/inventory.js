// Inventaire du joueur et barre d'objets rapides.
import { G, bus, toast } from '../core/state.js';
import { item } from '../data/items.js';

export function count(id) {
  return G.inv[id] || 0;
}

export function add(id, n = 1, silent = false) {
  if (n <= 0) return;
  G.inv[id] = (G.inv[id] || 0) + n;
  // Range automatiquement les outils/armes dans la barre rapide
  const it = item(id);
  if (!it.hidden && (['tool', 'weapon', 'bomb', 'potion', 'cure', 'virus', 'robot'].includes(it.cat) || it.cat === 'invention')) {
    if (!G.hotbar.includes(id)) {
      const free = G.hotbar.indexOf(null);
      if (free >= 0) G.hotbar[free] = id;
    }
  }
  if (!silent) bus.emit('gain', id, n);
  bus.emit('inv');
}

export function remove(id, n = 1) {
  if ((G.inv[id] || 0) < n) return false;
  G.inv[id] -= n;
  if (G.inv[id] <= 0) {
    delete G.inv[id];
    const i = G.hotbar.indexOf(id);
    if (i >= 0) G.hotbar[i] = null;
  }
  bus.emit('inv');
  return true;
}

export function hasAll(map, mult = 1) {
  for (const [id, n] of Object.entries(map)) if (count(id) < n * mult) return false;
  return true;
}

export function takeAll(map, mult = 1) {
  if (!hasAll(map, mult)) return false;
  for (const [id, n] of Object.entries(map)) remove(id, n * mult);
  return true;
}

export function missing(map, mult = 1) {
  const out = [];
  for (const [id, n] of Object.entries(map)) {
    const have = count(id);
    if (have < n * mult) out.push(`${item(id).icon} ${item(id).name} (${have}/${n * mult})`);
  }
  return out;
}

export function selected() {
  return G.hotbar[G.hotSel] || null;
}

export function bestArmor() {
  let best = 0;
  for (const id of Object.keys(G.inv)) {
    const a = item(id).armor || 0;
    if (a > best) best = a;
  }
  return best;
}

// Meilleur outil possédé pour un type de récolte
export function bestTool(kind) {
  let best = null;
  for (const id of Object.keys(G.inv)) {
    const t = item(id).tool;
    if (!t) continue;
    if (t.kind !== kind && !(kind === 'axe' && t.kind === 'knife')) continue;
    if (t.kind === 'knife' && kind === 'axe') continue;
    if (!best || t.tier > best.tier) best = { id, tier: t.tier };
  }
  return best;
}

export function invList() {
  return Object.entries(G.inv)
    .filter(([id, n]) => n > 0 && !item(id).hidden)
    .map(([id, n]) => ({ id, n, it: item(id) }));
}

export function addMoney(n, why) {
  G.money += n;
  bus.emit('money', n, why);
}

export function spend(n) {
  if (G.money < n) {
    toast('Pas assez d’argent !', 'bad');
    return false;
  }
  G.money -= n;
  bus.emit('money', -n);
  return true;
}
