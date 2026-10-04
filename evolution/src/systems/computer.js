// Ordinateur : exécute le code JavaScript du joueur dans un Web Worker isolé,
// avec une API pour piloter le jeu (vendre, fabriquer, robots, recherche...).
import { G, toast, news } from '../core/state.js';
import { item, RECIPES, ITEMS } from '../data/items.js';
import { TECH } from '../data/tech.js';
import * as inv from './inventory.js';
import { sell, buy, price, putOnSale, population } from './civ.js';
import { craft, invent, nearStation } from './crafting.js';
import { research } from './tech.js';
import { fmtYear } from '../core/util.js';

const WORKER_SRC = `
let seq = 0;
const pending = {};
function call(fn, args) {
  return new Promise((res, rej) => {
    const id = ++seq;
    pending[id] = { res, rej };
    postMessage({ type: 'call', id, fn, args });
  });
}
const api = (prefix) => new Proxy({}, { get: (_, fn) => (...args) => call(prefix + '.' + String(fn), args) });
onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'ret') {
    const p = pending[m.id];
    delete pending[m.id];
    if (p) m.error ? p.rej(new Error(m.error)) : p.res(m.value);
    return;
  }
  if (m.type === 'run') {
    const show = (v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
    const afficher = (...a) => postMessage({ type: 'log', text: a.map(show).join(' ') });
    const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
    const console = { log: afficher, error: afficher, warn: afficher };
    try {
      const f = new Function('afficher', 'attendre', 'jeu', 'robots', 'console', '"use strict"; return (async () => {\\n' + m.code + '\\n})();');
      await f(afficher, attendre, api('jeu'), api('robots'), console);
      postMessage({ type: 'done' });
    } catch (err) {
      postMessage({ type: 'error', text: String((err && err.message) || err) });
    }
  }
};`;

let worker = null;
let workerUrl = null;

function resolveId(name) {
  if (!name) return null;
  if (ITEMS[name] || G.customItems[name]) return name;
  const low = String(name).toLowerCase();
  const found = Object.values({ ...ITEMS, ...G.customItems }).find((it) => it.name.toLowerCase() === low);
  return found ? found.id : name;
}

const API = {
  'jeu.inventaire': () => ({ ...G.inv }),
  'jeu.argent': () => Math.floor(G.money),
  'jeu.savoir': () => Math.floor(G.savoir),
  'jeu.prix': (id) => price(resolveId(id)),
  'jeu.vendre': (id, n = 1) => sell(resolveId(id), n) || 0,
  'jeu.acheter': (id, n = 1) => !!buy(resolveId(id), n),
  'jeu.fabriquer': (id, n = 1) => {
    id = resolveId(id);
    const r = RECIPES.find((x) => x.out === id);
    if (!r) throw new Error('Recette inconnue : ' + id);
    // L'ordinateur pilote les ateliers construits n'importe où
    const ok = !r.station || G.buildings.some((b) => G.buildingsSys.def(b.type)?.station === r.station) || nearStation(r.station);
    if (!ok) throw new Error('Il faut construire : ' + r.station);
    let made = 0;
    for (let i = 0; i < n; i++) {
      if (!inv.takeAll(r.ins)) break;
      inv.add(r.out, r.n, true);
      made += r.n;
    }
    return made;
  },
  'jeu.recettes': () => RECIPES.filter((r) => !r.tech || G.techs.includes(r.tech)).map((r) => r.out),
  'jeu.mettreEnVente': (id, qte, prix, enLigne = true) => putOnSale(resolveId(id), qte, prix, enLigne),
  'jeu.boutique': () => G.shopStock.map((s) => ({ objet: s.id, quantite: s.qty, prix: s.price, enLigne: s.online })),
  'jeu.annonce': (txt) => {
    toast('💻 ' + String(txt).slice(0, 120), 'info');
    return true;
  },
  'jeu.actualite': (txt) => {
    news('💻 ' + String(txt).slice(0, 140));
    return true;
  },
  'jeu.heure': () => Math.floor(G.time.hour),
  'jeu.jour': () => G.time.day,
  'jeu.annee': () => fmtYear(G.time.year),
  'jeu.population': () => population(),
  'jeu.bonheur': () => Math.round(G.village?.happiness ?? 0),
  'jeu.popularite': () => Math.round(G.popularity),
  'jeu.technologies': () => [...G.techs],
  'jeu.rechercher': (id) => !!research(id),
  'jeu.nomObjet': (id) => item(resolveId(id)).name,
  'jeu.inventer': (nom, type, ingredients) => {
    const sel = {};
    for (const [k, v] of Object.entries(ingredients || {})) sel[resolveId(k)] = v;
    const d = invent(sel, type, nom);
    return d && d.id ? d.id : null;
  },
  'jeu.soigner': () => {
    const P = G.player;
    const id = ['potion_soin', 'remede_herbes', 'antibiotique'].find((x) => inv.count(x) > 0);
    if (!id) return false;
    P.consume(id);
    return true;
  },
  'robots.liste': () => G.robots.map((r, i) => ({ numero: i, nom: r.name, type: r.kind, mode: r.mode })),
  'robots.ordre': (i, mode) => {
    const r = G.robots[i];
    if (!r) throw new Error('Pas de robot n°' + i);
    if (!['suivre', 'combat', 'recolter', 'garder'].includes(mode)) throw new Error('Modes : suivre, combat, recolter, garder');
    r.mode = mode;
    return true;
  },
  'robots.renommer': (i, nom) => {
    const r = G.robots[i];
    if (!r) return false;
    r.name = String(nom).slice(0, 30);
    const ent = G.npcs.list.find((n) => n.data === r);
    if (ent) ent.name = r.name;
    return true;
  },
};

export function running() {
  return !!worker;
}

export function stop() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

export function run(code, onLog, onEnd) {
  stop();
  if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  worker = new Worker(workerUrl);
  const w = worker;
  w.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'log') onLog(m.text, 'log');
    else if (m.type === 'error') {
      onLog('Erreur : ' + m.text, 'err');
      if (worker === w) worker = null;
      w.terminate();
      onEnd?.();
    } else if (m.type === 'done') {
      onLog('✔ Programme terminé.', 'ok');
      if (worker === w) worker = null;
      w.terminate();
      onEnd?.();
    } else if (m.type === 'call') {
      const fn = API[m.fn];
      try {
        if (!fn) throw new Error(`Fonction inconnue : ${m.fn}()`);
        const value = fn(...(m.args || []));
        w.postMessage({ type: 'ret', id: m.id, value: JSON.parse(JSON.stringify(value ?? null)) });
      } catch (err) {
        w.postMessage({ type: 'ret', id: m.id, error: err.message || String(err) });
      }
    }
  };
  w.postMessage({ type: 'run', code });
}

export const API_DOC = [
  ['afficher(texte)', 'Écrit dans la console.'],
  ['await attendre(ms)', 'Attend (1000 = 1 seconde).'],
  ['await jeu.inventaire()', 'Objets possédés { bois: 12, ... }'],
  ['await jeu.argent()', 'Ton argent.'],
  ['await jeu.prix("bois")', 'Prix actuel du marché.'],
  ['await jeu.vendre("bois", 10)', 'Vend et renvoie le gain.'],
  ['await jeu.acheter("fer", 5)', 'Achète au marché.'],
  ['await jeu.fabriquer("planche", 3)', 'Fabrique (ateliers connectés).'],
  ['await jeu.recettes()', 'Liste des objets fabricables.'],
  ['await jeu.mettreEnVente("pain", 20, 9)', 'Met en vente dans ta boutique en ligne.'],
  ['await jeu.inventer("Super hache", "outil", {acier:2, bois:1})', 'Invente un objet (types : arme, outil, nourriture, potion, bombe, machine, composant, armure).'],
  ['await jeu.rechercher("internet")', 'Lance une recherche.'],
  ['await jeu.annonce("Salut !")', 'Affiche un message à l’écran.'],
  ['await jeu.heure() / jeu.jour() / jeu.annee()', 'Le temps.'],
  ['await jeu.population() / jeu.bonheur()', 'Ton village.'],
  ['await robots.liste()', 'Tes robots.'],
  ['await robots.ordre(0, "recolter")', 'Modes : suivre, combat, recolter, garder.'],
];

export const EXAMPLES = {
  'Bonjour le monde': `afficher("Bonjour le monde !");
const inv = await jeu.inventaire();
afficher("J'ai", Object.keys(inv).length, "sortes d'objets.");
afficher("Argent :", await jeu.argent());`,
  'Vendeur automatique': `// Vend le bois quand le prix est bon, pendant 1 minute
for (let i = 0; i < 12; i++) {
  const p = await jeu.prix("bois");
  const inv = await jeu.inventaire();
  if (p >= 2 && (inv.bois || 0) > 10) {
    const gain = await jeu.vendre("bois", 5);
    afficher("Vendu 5 bois pour", gain, "pièces");
  } else {
    afficher("Prix du bois :", p, "- j'attends...");
  }
  await attendre(5000);
}`,
  'Usine automatique': `// Transforme tout le bois en planches
const inv = await jeu.inventaire();
const n = Math.floor((inv.bois || 0) / 1);
const faites = await jeu.fabriquer("planche", Math.min(n, 20));
afficher("Planches fabriquées :", faites);`,
  'Boutique en ligne': `// Met en vente tes surplus sur Internet
const inv = await jeu.inventaire();
for (const [objet, qte] of Object.entries(inv)) {
  if (qte > 30) {
    const prix = Math.ceil((await jeu.prix(objet)) * 1.2);
    await jeu.mettreEnVente(objet, qte - 20, prix, true);
    afficher("En vente :", qte - 20, await jeu.nomObjet(objet), "à", prix);
  }
}`,
  'Armée de robots': `const liste = await robots.liste();
if (liste.length === 0) afficher("Fabrique d'abord des robots à l'usine !");
for (const r of liste) {
  const mode = r.type === "worker" ? "recolter" : "garder";
  await robots.ordre(r.numero, mode);
  afficher(r.nom, "->", mode);
}`,
};
