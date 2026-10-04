// Civilisation : village, métiers, gouvernement, élections, diplomatie, guerres,
// épidémies, économie (marché, boutiques, ventes en ligne).
import * as THREE from 'three';
import { G, bus, toast, news } from '../core/state.js';
import { item, ITEMS, FOOD_ORDER } from '../data/items.js';
import { BUILD } from '../data/buildings.js';
import { eraIndex, eraOf } from '../data/tech.js';
import { JOBS, CAREERS, FACTION_DEFS, DISEASES } from './civdata.js';
import { randomName } from '../entities/npcs.js';
import { randomLook, buildPerson } from '../models/humans.js';
import { buildFactionHouse, buildBanner } from '../models/buildings.js';
import * as inv from './inventory.js';
import { rand, randi, pick, clamp, mulberry } from '../core/util.js';
import { sfx } from '../core/audio.js';

// ---------------- Marché ----------------
export function price(id) {
  const base = item(id).value || 1;
  const m = G.market[id] ?? 1;
  return Math.max(1, Math.round(base * m));
}
export function sellPrice(id) {
  let k = 0.65;
  if (G.career === 'marchand') k += 0.2;
  if (G.mutations.includes('charisme')) k += 0.1;
  return Math.max(1, Math.round(price(id) * k));
}
export function buyPrice(id) {
  let k = 1.25;
  if (G.career === 'marchand') k -= 0.15;
  return Math.max(1, Math.round(price(id) * k));
}

export function sell(id, n = 1) {
  if (!G.techs.includes('commerce')) return toast('Il faut la technologie Monnaie et commerce.', 'bad');
  n = Math.min(n, inv.count(id));
  if (n <= 0) return false;
  inv.remove(id, n);
  const gain = sellPrice(id) * n;
  inv.addMoney(gain);
  G.market[id] = clamp((G.market[id] ?? 1) - 0.01 * n, 0.4, 2.5);
  sfx('coin');
  return gain;
}

export function buy(id, n = 1) {
  if (!G.techs.includes('commerce')) return toast('Il faut la technologie Monnaie et commerce.', 'bad');
  const cost = buyPrice(id) * n;
  if (!inv.spend(cost)) return false;
  inv.add(id, n);
  G.market[id] = clamp((G.market[id] ?? 1) + 0.01 * n, 0.4, 2.5);
  sfx('coin');
  return true;
}

// Objets disponibles à l'achat selon l'époque
export function marketItems() {
  const out = ['bois', 'pierre', 'fibre', 'argile', 'sable', 'peau', 'viande', 'ble', 'baies', 'pain', 'corde', 'brique', 'cuivre', 'etain', 'charbon', 'fer_brut', 'verre', 'poterie'];
  const t = G.techs;
  if (t.includes('bronze')) out.push('bronze', 'or_brut');
  if (t.includes('fer')) out.push('fer', 'cuir');
  if (t.includes('alchimie')) out.push('herbe_med', 'champignon', 'soufre', 'potion_soin');
  if (t.includes('acier')) out.push('acier', 'fleche');
  if (t.includes('poudre')) out.push('poudre', 'balle');
  if (t.includes('vapeur')) out.push('moteur');
  if (t.includes('petrole')) out.push('petrole', 'plastique');
  if (t.includes('electronique')) out.push('silicium', 'circuit', 'batterie', 'ecran');
  if (t.includes('ordinateurs')) out.push('puce');
  if (t.includes('antibiotiques')) out.push('antibiotique', 'vaccin');
  if (t.includes('nucleaire')) out.push('uranium');
  return out;
}

function fluctuateMarket() {
  for (const id of Object.keys(ITEMS)) {
    if (ITEMS[id].cat === 'adn') continue;
    const m = G.market[id] ?? 1;
    G.market[id] = clamp(m + (1 - m) * 0.05 + rand(-0.05, 0.05), 0.4, 2.5);
  }
}

// ---------------- Village ----------------
export function canFound() {
  return G.stage >= 8 && G.techs.includes('tribu') && !G.village;
}

export function foundVillage(name) {
  if (!canFound()) return false;
  const P = G.player;
  G.village = {
    name: name || 'Mon village',
    x: P.pos.x,
    z: P.pos.z,
    people: [],
    happiness: 70,
    founded: G.time.day,
    epidemic: null,
    hungerDays: 0,
  };
  for (let i = 0; i < 3; i++) addVillager(['bucheron', 'chasseur', 'scientifique'][i]);
  G.title = 'chef';
  G.world.clearArea(P.pos.x, P.pos.z, 6);
  news(`Fondation du village ${G.village.name}.`);
  toast(`🏕️ Tu fondes ${G.village.name} et deviens Chef de tribu !`, 'good');
  sfx('levelup');
  bus.emit('titleChanged');
  return true;
}

export function addVillager(job = null) {
  const V = G.village;
  if (!V) return null;
  const person = { id: 'p' + Math.floor(rand(0, 1e9)).toString(36), name: randomName(), look: randomLook(), job: job || bestJob(), mood: 70 };
  V.people.push(person);
  return person;
}

function bestJob() {
  const V = G.village;
  const c = jobCounts();
  const pop = V.people.length + 1;
  if ((c.bucheron || 0) < pop * 0.2) return 'bucheron';
  if (G.techs.includes('agriculture') && (c.fermier || 0) < pop * 0.25) return 'fermier';
  if ((c.chasseur || 0) < pop * 0.15) return 'chasseur';
  if ((c.mineur || 0) < pop * 0.15) return 'mineur';
  if ((c.scientifique || 0) < pop * 0.15) return 'scientifique';
  if ((c.soldat || 0) < pop * 0.1) return 'soldat';
  if (G.techs.includes('commerce') && (c.marchand || 0) < pop * 0.1) return 'marchand';
  return pick(['bucheron', 'mineur', 'chasseur', 'scientifique']);
}

export function jobCounts() {
  const c = {};
  for (const p of G.village?.people || []) if (!p.dead) c[p.job] = (c[p.job] || 0) + 1;
  return c;
}

export function jobAvailable(job) {
  const j = JOBS[job];
  if (!j) return false;
  if (j.tech && !G.techs.includes(j.tech)) return false;
  if (j.building && !G.buildings.some((b) => b.type === j.building)) return false;
  return true;
}

export function changeJob(from, to, n = 1) {
  const V = G.village;
  if (!V || !jobAvailable(to)) return;
  let moved = 0;
  for (const p of V.people) {
    if (moved >= n) break;
    if (p.job === from && !p.dead) {
      p.job = to;
      moved++;
      const ent = G.npcs.list.find((e) => e.data === p);
      if (ent) G.npcs.remove(ent); // reconstruit avec la bonne tenue
    }
  }
}

export function housing() {
  let h = 0;
  for (const b of G.buildings) h += BUILD[b.type]?.housing || 0;
  return h;
}

export function population() {
  return G.village ? G.village.people.filter((p) => !p.dead).length : 0;
}

export function power() {
  let prod = 0;
  let cons = 0;
  for (const b of G.buildings) {
    const p = BUILD[b.type]?.power || 0;
    if (p > 0) prod += p;
    else cons -= p;
  }
  return { prod, cons, ok: prod >= cons };
}

export function military() {
  const c = jobCounts();
  const era = eraIndex(G.time.year);
  let m = (c.soldat || 0) * (10 + era * 4);
  if (G.buildings.some((b) => b.type === 'caserne')) m *= 1.5;
  for (const b of G.buildings) m += BUILD[b.type]?.defense || 0;
  m += G.robots.filter((r) => r.kind !== 'worker').length * 40;
  return Math.round(m);
}

// ---------------- Production horaire ----------------
function hourlyTick() {
  const V = G.village;
  const era = eraIndex(G.time.year);
  const t = G.techs;
  const roue = t.includes('roue') ? 1.25 : 1;
  if (V) {
    const sick = V.epidemic ? V.epidemic.sick : 0;
    const happyK = 0.5 + V.happiness / 100;
    let savoir = 0;
    let money = 0;
    const out = {};
    const give = (id, n) => (out[id] = (out[id] || 0) + n);
    const fields = G.buildings.filter((b) => b.type === 'champ').length;
    let working = 0;
    for (const p of V.people) {
      if (p.dead) continue;
      working++;
      if (working <= sick) continue;
      const k = happyK * roue;
      switch (p.job) {
        case 'bucheron':
          give('bois', 1 * k);
          if (Math.random() < 0.2) give('baton', 1);
          break;
        case 'mineur':
          give('pierre', 0.8 * k);
          if (Math.random() < 0.3) give('silex', 1);
          if (t.includes('bronze')) {
            give(pick(['cuivre', 'etain', 'charbon']), 0.4 * k);
          }
          if (t.includes('fer')) give('fer_brut', 0.3 * k);
          if (t.includes('poudre') && Math.random() < 0.2) give('soufre', 1);
          if (Math.random() < 0.04) give('or_brut', 1);
          if (t.includes('electronique') && Math.random() < 0.2) give('silicium', 1);
          if (t.includes('nucleaire') && Math.random() < 0.05) give('uranium', 1);
          break;
        case 'fermier':
          give('ble', (fields ? 1.2 : 0.4) * k);
          give('baies', 0.3 * k);
          if (G.buildings.some((b) => b.type === 'enclos')) give('viande', 0.3 * k);
          break;
        case 'chasseur':
          give('viande', 0.6 * k);
          if (Math.random() < 0.4) give('peau', 1);
          if (Math.random() < 0.3) give('os', 1);
          if (Math.random() < 0.2) give('plume', 1);
          break;
        case 'pecheur':
          give('poisson', 0.9 * k);
          break;
        case 'scientifique': {
          let s = 0.35;
          if (t.includes('ecriture')) s *= 1.6;
          if (t.includes('sciences')) s *= 1.5;
          if (t.includes('imprimerie')) s *= 1.3;
          if (t.includes('ordinateurs')) s *= 1.6;
          if (t.includes('ia')) s *= 2;
          savoir += s * k;
          break;
        }
        case 'marchand':
          money += (2 + era * 2) * k;
          break;
        case 'medecin':
          if (Math.random() < 0.3) give('herbe_med', 1);
          break;
        case 'ouvrier':
          if (G.buildings.some((b) => b.type === 'usine')) {
            const pool = ['planche', 'brique'];
            if (t.includes('petrole')) pool.push('plastique');
            if (t.includes('electronique')) pool.push('circuit');
            if (t.includes('vapeur')) pool.push('moteur');
            if (Math.random() < 0.35) give(pick(pool), 1);
            money += era * 1.5;
          }
          break;
        case 'programmeur':
          money += 12 * k;
          savoir += 0.5 * k;
          break;
      }
    }
    // Bâtiments producteurs
    for (const b of G.buildings) {
      const d = BUILD[b.type];
      if (d?.produce && b.type !== 'champ') for (const [id, n] of Object.entries(d.produce)) give(id, n);
      if (b.machine) give(b.machine.produce, b.machine.rate);
    }
    // Robots ouvriers
    for (const r of G.robots) {
      if (r.kind === 'worker' && r.mode === 'recolter') {
        give(pick(['bois', 'pierre', 'charbon', 'fer_brut', 'cuivre']), 1.5);
      }
    }
    // Arrondis stochastiques
    for (const [id, n] of Object.entries(out)) {
      const whole = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      if (whole > 0) inv.add(id, whole, true);
    }
    G.savoir += savoir;
    if (money > 0 && G.techs.includes('commerce')) G.money += Math.round(money);
    // Hôpital : soigne les malades
    if (V.epidemic && G.buildings.some((b) => b.type === 'hopital') && Math.random() < 0.5) {
      V.epidemic.sick = Math.max(0, V.epidemic.sick - 1);
    }
  }
  shopTick();
  if (G.time.hour % 6 === 0) fluctuateMarket();
}

// Ventes des boutiques (physique et en ligne)
function shopTick() {
  if (!G.shopStock.length) return;
  const hasShop = G.buildings.some((b) => b.type === 'marche');
  const online = G.techs.includes('internet') && G.buildings.some((b) => b.type === 'ordinateur');
  const pop = population() + G.factions.filter((f) => !f.conquered && !f.war).reduce((s, f) => s + f.pop * 0.3, 0);
  for (const s of G.shopStock) {
    if (s.qty <= 0) continue;
    if (!hasShop && !(s.online && online)) continue;
    const ratio = price(s.id) / Math.max(1, s.price);
    let chance = clamp(0.08 * (pop / 8) * ratio * ratio, 0, 0.95);
    if (s.online && online) chance = clamp(chance * 3 + 0.15, 0, 0.98);
    let sold = 0;
    for (let i = 0; i < 3 && s.qty > 0; i++) {
      if (Math.random() < chance) {
        s.qty--;
        sold++;
      }
    }
    if (sold) {
      G.money += sold * s.price;
      G.stats.sold = (G.stats.sold || 0) + sold;
      bus.emit('shopSale', s.id, sold, s.price);
    }
  }
  G.shopStock = G.shopStock.filter((s) => s.qty > 0);
}

export function putOnSale(id, qty, priceEach, online = false) {
  qty = Math.min(qty, inv.count(id));
  if (qty <= 0) return false;
  inv.remove(id, qty);
  const ex = G.shopStock.find((s) => s.id === id && s.online === online);
  if (ex) {
    ex.qty += qty;
    ex.price = priceEach;
  } else G.shopStock.push({ id, qty, price: priceEach, online });
  return true;
}

export function withdrawSale(idx) {
  const s = G.shopStock[idx];
  if (!s) return;
  inv.add(s.id, s.qty, true);
  G.shopStock.splice(idx, 1);
}

// ---------------- Journée ----------------
function dailyTick() {
  const V = G.village;
  // Carrière du joueur
  const car = CAREERS[G.career];
  if (car) {
    if (car.money) G.money += car.money * (1 + eraIndex(G.time.year) * 0.3);
    if (car.savoir) G.savoir += car.savoir;
    if (car.give) for (const [id, n] of Object.entries(car.give)) inv.add(id, n, true);
    if (car.pop) G.popularity = clamp(G.popularity + car.pop, 0, 100);
  }
  if (G.title === 'president') G.money += 100 + population() * 5;
  if (G.title === 'roi') G.money += 40 + population() * 3;

  if (V) {
    const pop = population();
    // Nourriture
    let need = pop;
    let fed = 0;
    for (const id of FOOD_ORDER) {
      while (need > 0 && inv.count(id) > 0) {
        inv.remove(id, 1);
        need--;
        fed++;
      }
    }
    const foodOk = need <= 0;
    let h = V.happiness;
    h += foodOk ? 3 : -10;
    V.hungerDays = foodOk ? 0 : V.hungerDays + 1;
    const house = housing();
    if (pop > house + 3) h -= 6;
    else if (pop <= house) h += 2;
    // Impôts
    if (G.techs.includes('commerce') || G.title === 'roi' || G.title === 'president') {
      const eraK = 1 + eraIndex(G.time.year) * 0.6;
      const tax = Math.round(pop * (G.taxes / 100) * 10 * eraK);
      if (tax > 0) {
        G.money += tax;
        h -= (G.taxes - 10) * 0.3;
      }
    }
    for (const b of G.buildings) if (BUILD[b.type]?.popularity) h += 0.5;
    if (G.monster) h -= 8;
    if (V.epidemic) h -= 5;
    if (G.factions.some((f) => f.war)) h -= 2;
    V.happiness = clamp(h, 0, 100);
    G.popularity = clamp(G.popularity + (V.happiness - 50) * 0.05, 0, 100);

    // Croissance / départs
    if (V.happiness > 55 && foodOk && pop < house + 2 && Math.random() < 0.7) {
      const p = addVillager();
      toast(`👶 ${p.name} rejoint le village !`, 'good');
    }
    if (V.hungerDays >= 3 && pop > 1) {
      const p = V.people.find((x) => !x.dead);
      p.dead = true;
      toast(`💀 ${p.name} est mort de faim !`, 'bad');
      news(`Famine : ${p.name} est mort de faim.`);
    } else if (V.happiness < 20 && pop > 1 && Math.random() < 0.5) {
      const i = V.people.findIndex((x) => !x.dead);
      const p = V.people.splice(i, 1)[0];
      toast(`😠 ${p.name} quitte le village, mécontent.`, 'bad');
    }
    V.people = V.people.filter((p) => !p.dead);

    // Épidémies
    if (!V.epidemic && pop > 4 && Math.random() < 0.04 + (G.buildings.some((b) => b.type === 'hopital') ? -0.03 : 0.02)) {
      const d = pick(DISEASES.filter((x) => x.level <= 1 + Math.floor(eraIndex(G.time.year) / 3)));
      V.epidemic = { ...d, sick: Math.max(1, Math.round(pop * 0.3)), days: 0 };
      toast(`🦠 Épidémie de ${d.name} au village ! Soigne les malades (V).`, 'bad');
      news(`Épidémie de ${d.name} dans ${V.name}.`);
    }
    if (V.epidemic) {
      V.epidemic.days++;
      if (V.epidemic.days > 2 && V.epidemic.sick > 0 && Math.random() < 0.3 * V.epidemic.level) {
        const p = V.people[Math.floor(Math.random() * V.people.length)];
        if (p && V.people.length > 1) {
          V.people.splice(V.people.indexOf(p), 1);
          toast(`💀 ${p.name} a succombé à la ${V.epidemic.name}.`, 'bad');
        }
      }
      if (V.epidemic.sick <= 0) {
        toast('L’épidémie est terminée.', 'good');
        V.epidemic = null;
      } else if (V.epidemic.days > 8) {
        V.epidemic = null;
      }
      // Le joueur peut l'attraper
      if (V.epidemic && !G.disease && !(G.vaccinated > G.time.day) && Math.random() < 0.2) {
        G.disease = { name: V.epidemic.name, level: V.epidemic.level };
        toast(`Tu as attrapé la ${V.epidemic.name} ! Prends un remède.`, 'bad');
      }
    }
  }

  // Élections
  if (G.techs.includes('democratie') && G.village) {
    if (!G.nextElection) G.nextElection = G.time.day + 3;
    if (G.time.day >= G.nextElection) election();
  }
  factionsDaily();
  G.campaignToday = false;
}

// ---------------- Gouvernement ----------------
export function crownKing() {
  if (!G.techs.includes('lois')) return toast('Il faut la technologie Lois et royauté.', 'bad');
  if (!G.buildings.some((b) => b.type === 'palais')) return toast('Construis d’abord un Palais.', 'bad');
  if (G.techs.includes('democratie')) return toast('C’est une démocratie maintenant : gagne les élections !', 'bad');
  G.title = 'roi';
  toast('👑 Tu es couronné(e) ! Longue vie au souverain !', 'good');
  news('Couronnement du nouveau souverain.');
  sfx('levelup');
  bus.emit('titleChanged');
}

export function campaign(kind) {
  if (!G.techs.includes('democratie')) return;
  if (kind === 'discours') {
    if (G.campaignToday) return toast('Tu as déjà fait un discours aujourd’hui.', 'bad');
    G.campaignToday = true;
    const gain = 3 + (G.mutations.includes('charisme') ? 4 : 0) + Math.floor(rand(0, 3));
    G.popularity = clamp(G.popularity + gain, 0, 100);
    toast(`🎤 Discours réussi : +${gain} popularité`, 'good');
  } else if (kind === 'argent') {
    const cost = 200 + population() * 20;
    if (!inv.spend(cost)) return;
    G.popularity = clamp(G.popularity + 8, 0, 100);
    toast(`💸 Tu distribues ${cost} pièces : +8 popularité`, 'good');
  } else if (kind === 'fete') {
    if (inv.count('viande_cuite') < 10 && inv.count('pain') < 10) return toast('Il faut 10 viandes grillées ou 10 pains pour la fête.', 'bad');
    inv.remove(inv.count('viande_cuite') >= 10 ? 'viande_cuite' : 'pain', 10);
    G.popularity = clamp(G.popularity + 6, 0, 100);
    if (G.village) G.village.happiness = clamp(G.village.happiness + 10, 0, 100);
    toast('🎉 Grande fête au village ! +6 popularité, +10 bonheur', 'good');
  }
}

function election() {
  const rival = randomName();
  const rivalScore = rand(38, 62);
  const me = G.popularity + rand(-8, 8) + (G.title === 'president' ? 3 : 0);
  G.nextElection = G.time.day + 5;
  const pct = Math.round(clamp(50 + (me - rivalScore) * 1.2, 5, 95));
  if (me > rivalScore) {
    const was = G.title === 'president';
    G.title = 'president';
    toast(`🗳️ Élections : tu ${was ? 'es réélu(e)' : 'deviens Président(e)'} avec ${pct} % des voix !`, 'good');
    news(`Élection présidentielle : victoire avec ${pct} % des voix.`);
    sfx('levelup');
  } else {
    if (G.title === 'president' || G.title === 'roi' || G.title === 'chef') toast(`🗳️ Élections perdues contre ${rival} (${100 - pct} %). Tu redeviens citoyen.`, 'bad');
    else toast(`🗳️ ${rival} remporte l’élection. Fais campagne pour la prochaine !`, 'bad');
    news(`${rival} remporte l’élection présidentielle.`);
    G.title = '';
  }
  bus.emit('titleChanged');
}

export function setCareer(id) {
  const c = CAREERS[id];
  if (!c) return;
  if (c.tech && !G.techs.includes(c.tech)) return toast(`Il faut la technologie requise.`, 'bad');
  G.career = id;
  toast(`Nouvelle carrière : ${c.icon} ${c.name}`, 'good');
  bus.emit('titleChanged');
}

// ---------------- Peuples rivaux ----------------
export function createFactions() {
  const rnd = mulberry(G.world.seed + 11);
  const avoid = [G.player.pos.clone()];
  G.factions = FACTION_DEFS.map((d) => {
    const p = G.world.findSpot(rnd, 3, 25, avoid, 260, 0.3);
    avoid.push(p);
    return { ...d, x: p.x, z: p.z, pop: 8, mil: 20, relation: 0, war: false, ally: false, conquered: false, infected: 0, era: 0 };
  });
}

export function placeFactionVillages() {
  if (G.factionGroup) G.factionGroup.parent?.remove(G.factionGroup);
  const grp = new THREE.Group();
  const era = eraIndex(G.time.year);
  for (const f of G.factions) {
    G.world.clearArea(f.x, f.z, 22);
    if (f.conquered && !f.keepHouses) continue;
    const n = Math.min(9, 3 + Math.floor(f.pop / 4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 12 + (i % 2) * 5;
      const x = f.x + Math.cos(a) * r;
      const z = f.z + Math.sin(a) * r;
      const h = buildFactionHouse(era, f.color);
      h.position.set(x, G.world.height(x, z) - 0.1, z);
      h.rotation.y = -a + Math.PI / 2 + Math.PI;
      grp.add(h);
      G.world.addCollider(x, z, 2.2);
    }
    const ban = buildBanner(f.color);
    ban.position.set(f.x, G.world.height(f.x, f.z), f.z);
    grp.add(ban);
  }
  (G.worldScene || G.scene).add(grp);
  G.factionGroup = grp;
  G.factionEra = era;
}

function factionsDaily() {
  const myEra = eraIndex(G.time.year);
  for (const f of G.factions) {
    if (f.conquered) continue;
    f.pop = clamp(f.pop + (Math.random() < 0.5 ? 1 : 0) - (f.infected ? randi(1, 3) : 0), 0, 60);
    f.mil = clamp(f.mil + rand(1, 4) + myEra, 0, 400);
    if (f.infected) {
      f.infected--;
      if (f.pop <= 0) {
        toast(`☠️ ${f.name} a été anéanti par le virus.`, 'bad');
        news(`${f.name} a été anéanti par une épidémie.`);
        f.conquered = true;
        f.keepHouses = true;
      }
    }
    if (!f.war) f.relation = clamp(f.relation + (f.ally ? 1 : rand(-1, 1.5)), -100, 100);
    // Déclaration de guerre spontanée
    if (!f.war && !f.ally && f.relation < -60 && Math.random() < 0.3 && G.village) {
      f.war = true;
      toast(`⚔️ ${f.name} te déclare la guerre !`, 'bad');
      news(`${f.name} déclare la guerre.`);
    }
    // Raids
    if (f.war && G.village && Math.random() < 0.6) {
      const n = clamp(Math.round(f.mil / 30), 2, 8);
      G.npcs.spawnRaid(f, n);
      toast(`⚔️ Attaque de ${f.name} sur ton village ! (${n} soldats)`, 'bad');
      const def = military();
      // Combat abstrait si le joueur est loin
      const P = G.player;
      if (Math.hypot(P.pos.x - G.village.x, P.pos.z - G.village.z) > 230) {
        if (def >= f.mil * 0.5) {
          f.mil = Math.max(0, f.mil - def * 0.3);
          toast('🛡️ Ton armée a repoussé l’attaque.', 'good');
        } else {
          const lost = Math.min(G.village.people.length - 1, randi(1, 2));
          G.village.people.splice(0, lost);
          inv.remove('bois', Math.min(inv.count('bois'), 20));
          toast(`🔥 Le village a été pillé ! ${lost} habitant(s) perdu(s).`, 'bad');
        }
      }
    }
  }
  if (myEra !== G.factionEra && G.mode === 'world') placeFactionVillages();
}

export function diplomacy(f, action) {
  if (!G.village && action !== 'cadeau') return toast('Fonde d’abord un village (onglet Village).', 'bad');
  switch (action) {
    case 'cadeau': {
      const gift = G.techs.includes('commerce') ? 100 : 0;
      if (gift) {
        if (!inv.spend(gift)) return;
      } else {
        const food = FOOD_ORDER.find((id) => inv.count(id) >= 5);
        if (!food) return toast('Il te faut 5 aliments à offrir.', 'bad');
        inv.remove(food, 5);
      }
      f.relation = clamp(f.relation + 15, -100, 100);
      toast(`🎁 ${f.name} apprécie ton cadeau (+15).`, 'good');
      break;
    }
    case 'alliance':
      if (f.relation < 50) return toast('La relation doit être d’au moins 50.', 'bad');
      f.ally = true;
      f.war = false;
      toast(`🤝 Alliance conclue avec ${f.name} !`, 'good');
      news(`Alliance avec ${f.name}.`);
      break;
    case 'guerre':
      f.war = true;
      f.ally = false;
      f.relation = -80;
      toast(`⚔️ Tu déclares la guerre à ${f.name} ! Va détruire leur armée puis parle à leur chef.`, 'bad');
      news(`Guerre déclarée à ${f.name}.`);
      break;
    case 'paix': {
      const cost = 150 + f.mil * 2;
      if (G.techs.includes('commerce') && !inv.spend(cost)) return;
      f.war = false;
      f.relation = -20;
      toast(`🕊️ Paix signée avec ${f.name}.`, 'good');
      news(`Traité de paix avec ${f.name}.`);
      for (const n of G.npcs.list.filter((x) => x.kind === 'raider' && x.factionId === f.id)) G.npcs.remove(n);
      break;
    }
    case 'virus': {
      const v = ['super_virus', 'virus_peste', 'virus_grippe'].find((id) => inv.count(id) > 0);
      if (!v) return toast('Il te faut une fiole de virus (laboratoire, génétique).', 'bad');
      inv.remove(v, 1);
      const lvl = item(v).throw.virus;
      f.infected = 3 + lvl * 2;
      f.pop = Math.max(0, f.pop - lvl * 3);
      f.mil = Math.max(0, f.mil - lvl * 20);
      f.relation = -100;
      f.war = true;
      toast(`🦠 Le virus se répand chez ${f.name}... ils te déclarent la guerre !`, 'bad');
      news(`Une mystérieuse épidémie frappe ${f.name}.`);
      if (G.village && Math.random() < 0.35 && !G.village.epidemic) {
        G.village.epidemic = { name: item(v).name.replace('Fiole de ', ''), level: lvl, sick: 2, days: 0 };
        toast('Le virus est revenu jusqu’à ton village !', 'bad');
      }
      break;
    }
    case 'conquerir':
      conquer(f);
      break;
  }
}

export function conquer(f) {
  if (f.mil > 0) return toast(`L’armée de ${f.name} résiste encore (force ${Math.round(f.mil)}).`, 'bad');
  f.conquered = true;
  f.keepHouses = true;
  f.war = false;
  const n = Math.max(2, Math.floor(f.pop * 0.6));
  for (let i = 0; i < n; i++) addVillager();
  toast(`🏴 Tu as conquis ${f.name} ! ${n} habitants rejoignent ton peuple.`, 'good');
  news(`Conquête de ${f.name}.`);
  sfx('levelup');
}

// Quand un soldat ennemi meurt, l'armée de sa faction s'affaiblit
bus.on('npcDied', (n, side) => {
  const f = G.factions.find((x) => x.id === n.factionId);
  if (f && n.role === 'soldat') f.mil = Math.max(0, f.mil - (8 + n.era * 2));
  if (f && side === 'player' && !f.war && n.kind === 'faction') {
    f.relation = clamp(f.relation - 40, -100, 100);
    toast(`${f.name} est furieux : tu as tué l’un des leurs !`, 'bad');
  }
  if (n.kind === 'villager' && n.data) {
    const V = G.village;
    if (V) {
      V.people = V.people.filter((p) => p !== n.data);
      V.happiness = clamp(V.happiness - 10, 0, 100);
      G.popularity = clamp(G.popularity - (side === 'player' ? 15 : 3), 0, 100);
      toast(`💀 ${n.name} est mort.`, 'bad');
    }
  }
  if (n.kind === 'robot' && n.data) {
    G.robots = G.robots.filter((r) => r !== n.data);
    toast(`🤖 ${n.name} a été détruit.`, 'bad');
  }
  if (n.kind === 'raider' && side === 'player') G.popularity = clamp(G.popularity + 1, 0, 100);
});

bus.on('npcHit', (n) => {
  if (n.kind === 'villager' && G.village) {
    G.village.happiness = clamp(G.village.happiness - 2, 0, 100);
    G.popularity = clamp(G.popularity - 2, 0, 100);
  }
  if (n.kind === 'faction') {
    const f = G.factions.find((x) => x.id === n.factionId);
    if (f && !f.war) f.relation = clamp(f.relation - 8, -100, 100);
  }
});

export function treatEpidemic() {
  const V = G.village;
  if (!V?.epidemic) return;
  const cure = ['vaccin', 'antibiotique', 'remede_herbes'].find((id) => inv.count(id) > 0 && item(id).cure >= V.epidemic.level);
  if (!cure) return toast(`Il faut un remède de niveau ${V.epidemic.level} (tisane 1, antibiotique 2, vaccin 3).`, 'bad');
  const n = Math.min(V.epidemic.sick, inv.count(cure));
  inv.remove(cure, n);
  V.epidemic.sick -= n;
  toast(`💊 ${n} malade(s) soigné(s).`, 'good');
  if (V.epidemic.sick <= 0) {
    V.epidemic = null;
    toast('L’épidémie est vaincue !', 'good');
  }
}

// ---------------- Temps ----------------
let lastHour = -1;
let lastDay = -1;
export function civTick() {
  const h = Math.floor(G.time.hour);
  if (h !== lastHour) {
    if (lastHour !== -1) hourlyTick();
    lastHour = h;
  }
  if (G.time.day !== lastDay) {
    if (lastDay !== -1) dailyTick();
    lastDay = G.time.day;
  }
}

export function resetCivClock() {
  lastHour = -1;
  lastDay = -1;
}

export { JOBS, CAREERS, eraOf, buildPerson };
