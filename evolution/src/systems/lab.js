// Laboratoire de génétique : fusion d'ADN pour devenir un monstre hybride.
import * as THREE from 'three';
import { G, bus, toast, news } from '../core/state.js';
import { SPECIES, TRAITS } from '../data/species.js';
import { mix } from '../models/kit.js';
import * as inv from './inventory.js';
import { sfx } from '../core/audio.js';

export function samples() {
  return Object.keys(G.inv)
    .filter((id) => id.startsWith('adn_') && G.inv[id] > 0)
    .map((id) => ({ id, sid: id.slice(4), n: G.inv[id], s: SPECIES[id.slice(4)] }));
}

export function traitOf(sid) {
  const s = SPECIES[sid];
  if (s.trait) return s.trait;
  if (s.size > 2) return 'force';
  if (s.behavior === 'prey') return 'vitesse';
  return 'griffes';
}

export function previewFusion(ids) {
  const traits = [...new Set(ids.map((id) => traitOf(id.slice(4))))];
  let color = 0x5a8a3a;
  ids.forEach((id, i) => {
    const c = SPECIES[id.slice(4)].color;
    color = i === 0 ? c : mix(color, c, 0.5);
  });
  // Couleur vive et lisible
  const hsl = {};
  new THREE.Color(color).getHSL(hsl);
  color = new THREE.Color().setHSL((hsl.h + ids.length * 0.13) % 1, Math.max(0.55, hsl.s), Math.min(0.55, Math.max(0.4, hsl.l))).getHex();
  return { traits, color };
}

export function fuse(ids) {
  if (!G.techs.includes('genetique')) return toast('Il faut la technologie Génie génétique.', 'bad');
  if (ids.length < 1) return toast('Choisis au moins un échantillon d’ADN.', 'bad');
  for (const id of ids) if (!inv.count(id)) return toast('Échantillon manquant.', 'bad');
  const pv = previewFusion(ids);
  for (const id of ids) inv.remove(id, 1);
  const old = G.monster ? G.monster.traits : [];
  G.monster = {
    traits: [...new Set([...old, ...pv.traits])].slice(0, 6),
    color: pv.color,
    species: ids.map((i) => i.slice(4)),
  };
  G.career = 'monstre';
  sfx('roar');
  news('Une créature hybride monstrueuse a été aperçue !');
  toast(`🧬 MÉTAMORPHOSE ! Tu deviens un monstre : ${G.monster.traits.map((t) => TRAITS[t].name).join(', ')}`, 'good');
  toast('F : souffle de feu. Bois un Sérum d’humanité pour redevenir humain.', 'info');
  bus.emit('monster');
  return true;
}
