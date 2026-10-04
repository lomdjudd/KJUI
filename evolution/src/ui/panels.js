// Tous les menus du jeu (inventaire, fabrication, invention, construction,
// technologies, génétique, civilisation, ordinateur, boutique, labo, dialogues, carte, pause).
import { G, bus, toast } from '../core/state.js';
import { item, ITEMS, RECIPES, STATION_NAMES } from '../data/items.js';
import { STAGES, stageDef } from '../data/stages.js';
import { SPECIES, TRAITS } from '../data/species.js';
import { TECHS, TECH, ERAS, eraOf, eraIndex } from '../data/tech.js';
import { BUILDINGS, BUILD } from '../data/buildings.js';
import * as inv from '../systems/inventory.js';
import * as craftS from '../systems/crafting.js';
import * as evo from '../systems/evolution.js';
import * as techS from '../systems/tech.js';
import * as civ from '../systems/civ.js';
import * as comp from '../systems/computer.js';
import * as lab from '../systems/lab.js';
import { JOBS, CAREERS, TITLES, LINES } from '../systems/civdata.js';
import { escapeHtml as E, fmtNum, fmtYear, pick, clamp } from '../core/util.js';
import { sfx, setVolume } from '../core/audio.js';
import { save, saveSettings } from '../systems/save.js';
import { SIZE } from '../world/terrain.js';

const PAUSING = ['inventory', 'build', 'tech', 'genetics', 'civ', 'map', 'pause', 'help', 'talk', 'lab', 'craft'];

const CAT_NAMES = { res: 'Ressources', comp: 'Matériaux', food: 'Nourriture', tool: 'Outils', weapon: 'Armes', ammo: 'Munitions', bomb: 'Explosifs', armor: 'Protections', potion: 'Potions', cure: 'Remèdes', virus: 'Virus', robot: 'Robots', adn: 'ADN', invention: 'Inventions' };

function chips(map, mult = 1) {
  return Object.entries(map)
    .map(([id, n]) => {
      const ok = inv.count(id) >= n * mult;
      return `<span class="chip ${ok ? 'ok' : 'no'}" title="${E(item(id).name)}">${item(id).icon} ${n * mult}<small>/${fmtNum(inv.count(id))}</small></span>`;
    })
    .join('');
}

function describe(it) {
  const d = [];
  if (it.food) {
    if (it.food.hunger) d.push(`🍖 Faim +${it.food.hunger}`);
    if (it.food.thirst) d.push(`💧 Soif +${it.food.thirst}`);
    if (it.food.hp) d.push(`❤️ Santé ${it.food.hp > 0 ? '+' : ''}${it.food.hp}`);
  }
  if (it.weapon) d.push(`⚔️ Dégâts ${it.weapon.dmg}${it.weapon.proj ? ` · portée ${it.weapon.range} m${it.weapon.ammo ? ` · munitions : ${item(it.weapon.ammo).name}` : ''}` : ''}`);
  if (it.tool) d.push(`🔧 ${{ axe: 'Hache', pick: 'Pioche', knife: 'Couteau (dépeçage)', fish: 'Pêche', light: 'Lumière' }[it.tool.kind]} niveau ${it.tool.tier}${it.multitool ? ' (hache + pioche)' : ''}`);
  if (it.throw) d.push(`💥 Se lance : ${it.throw.dmg} dégâts, rayon ${it.throw.radius} m`);
  if (it.armor) d.push(`🛡️ Armure +${it.armor} (automatique)`);
  if (it.potion) d.push(`🧪 Effet : ${{ heal: 'soin', speed: 'vitesse', strength: 'force', invis: 'invisibilité', giant: 'géant', fly: 'vol', human: 'redevenir humain', mutate: 'mutation aléatoire' }[it.potion.effect]}${it.potion.dur ? ` (${it.potion.dur}s)` : ''}`);
  if (it.cure) d.push(`💊 Guérit les maladies de niveau ${it.cure}${it.vaccine ? ' · vaccin 15 jours' : ''}`);
  if (it.deploy) d.push('🤖 Utilise-le pour l’activer');
  if (it.machine) d.push(`⚙️ Machine : produit ${it.machine.rate} ${item(it.machine.produce).name} / heure (à poser)`);
  if (it.custom) d.push(`💡 Invention (${craftS.INVENTION_TYPES[it.custom.type]?.name}) · puissance ${it.custom.power}`);
  if (it.cat === 'adn') d.push('🧬 À fusionner au laboratoire');
  d.push(`🪙 Valeur ${it.value}`);
  return d.map((x) => `<div>${E(x)}</div>`).join('');
}

export class Panels {
  constructor() {
    document.getElementById('ui').insertAdjacentHTML('beforeend', `<div id="panel" class="hidden"><div class="pbox"><div class="phead"><div id="ptitle"></div><button class="pclose" data-act="close">✕</button></div><div id="ptabs" class="ptabs"></div><div id="pbody" class="pbody"></div></div></div>`);
    this.el = document.getElementById('panel');
    this.body = document.getElementById('pbody');
    this.tabsEl = document.getElementById('ptabs');
    this.titleEl = document.getElementById('ptitle');
    this.name = null;
    this.tab = {};
    this.state = { mix: {}, invType: 'arme', invName: '', invIcon: '', craftFilter: 'all', showLocked: false, selItem: null, labSel: [], app: 'code', script: 'Bonjour le monde', console: [] };
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
    this.el.addEventListener('change', (e) => this.onInput(e));
    this.refreshT = 0;
    bus.on('openPanel', (n, arg) => this.open(n, arg));
    bus.on('talk', (npc) => this.open('talk', npc));
  }

  open(name, arg) {
    if (!G.started) return;
    if (G.building) G.buildingsSys.cancel();
    if (this.name === name && arg === undefined && name !== 'talk') return this.close();
    // Restrictions selon l'étape
    if (['inventory', 'craft'].includes(name) && G.stage < 6) return toast('Évolue en primate pour avoir un inventaire.', 'bad');
    if (['build', 'tech'].includes(name) && G.stage < 7) return toast('Évolue en hominidé pour construire et inventer.', 'bad');
    if (name === 'civ' && G.stage < 8) return toast('La civilisation commence avec Homo sapiens.', 'bad');
    if (name === 'map' && G.mode === 'micro') return toast('Pas de carte dans le monde microscopique.', 'info');
    this.name = name;
    this.arg = arg;
    if (name === 'craft') {
      this.name = 'inventory';
      this.tab.inventory = 'craft';
      this.state.craftFilter = arg || 'all';
    }
    if (name === 'civ' && arg) this.tab.civ = arg;
    G.panel = this.name;
    G.paused = PAUSING.includes(this.name);
    G.input.unlock();
    this.el.classList.remove('hidden');
    this.el.className = 'p-' + this.name;
    sfx('click');
    this.render();
  }

  close() {
    this.name = null;
    G.panel = null;
    G.paused = false;
    this.el.classList.add('hidden');
  }

  setTabs(list, key) {
    const cur = this.tab[key] || list[0][0];
    this.tab[key] = cur;
    this.tabsEl.innerHTML = list.map(([id, label]) => `<button class="${id === cur ? 'on' : ''}" data-act="tab" data-key="${key}" data-id="${id}">${label}</button>`).join('');
    this.tabsEl.style.display = '';
    return cur;
  }

  render() {
    this.tabsEl.style.display = 'none';
    const r = {
      inventory: () => this.rInventory(),
      build: () => this.rBuild(),
      tech: () => this.rTech(),
      genetics: () => this.rGenetics(),
      civ: () => this.rCiv(),
      shop: () => this.rShop(),
      computer: () => this.rComputer(),
      lab: () => this.rLab(),
      talk: () => this.rTalk(),
      map: () => this.rMap(),
      pause: () => this.rPause(),
      help: () => this.rHelp(),
    }[this.name];
    if (r) r();
  }

  update(dt) {
    if (!this.name) return;
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = 1;
    // Rafraîchit les panneaux « vivants » sans perdre la saisie
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
    if (['civ', 'shop'].includes(this.name)) this.render();
    if (this.name === 'computer' && this.state.app !== 'code') this.render();
    if (this.name === 'map') this.drawMap();
  }

  // =============== INVENTAIRE / FABRICATION / INVENTION ===============
  rInventory() {
    this.titleEl.textContent = '🎒 Inventaire & fabrication';
    const t = this.setTabs(
      [
        ['inv', '🎒 Inventaire'],
        ['craft', '🛠️ Fabrication'],
        ['invent', '💡 Atelier d’invention'],
      ],
      'inventory',
    );
    if (t === 'inv') this.rInvList();
    else if (t === 'craft') this.rCraft();
    else this.rInvent();
  }

  rInvList() {
    const list = inv.invList().sort((a, b) => (a.it.cat > b.it.cat ? 1 : a.it.cat < b.it.cat ? -1 : a.it.name.localeCompare(b.it.name)));
    const groups = {};
    for (const x of list) (groups[x.it.cat] ||= []).push(x);
    let html = '<div class="split"><div class="grow">';
    if (!list.length) html += '<p class="muted">Ton inventaire est vide. Ramasse des ressources avec E ou en frappant (clic).</p>';
    for (const [cat, arr] of Object.entries(groups)) {
      html += `<h4>${CAT_NAMES[cat] || cat}</h4><div class="grid">`;
      for (const x of arr) html += `<div class="cell ${this.state.selItem === x.id ? 'sel' : ''}" data-act="selItem" data-id="${x.id}" title="${E(x.it.name)}"><span class="ic">${x.it.icon}</span><span class="n">${fmtNum(x.n)}</span></div>`;
      html += '</div>';
    }
    html += '</div><div class="side">';
    const id = this.state.selItem;
    if (id && inv.count(id)) {
      const it = item(id);
      const usable = it.food || it.potion || it.cure || it.deploy || it.machine;
      html += `<div class="detail"><div class="big">${it.icon}</div><h3>${E(it.name)}</h3><div class="muted">${CAT_NAMES[it.cat] || ''} · x${fmtNum(inv.count(id))}</div>${describe(it)}
        <div class="btns">${usable ? `<button data-act="useItem" data-id="${id}">${it.food ? 'Manger' : it.machine ? 'Poser' : 'Utiliser'}</button>` : ''}
        <button data-act="toHotbar" data-id="${id}">Barre rapide [${G.hotSel + 1}]</button>
        <button class="danger" data-act="drop" data-id="${id}">Jeter 1</button></div></div>`;
    } else html += '<p class="muted">Clique sur un objet pour voir ses détails.</p>';
    html += `<div class="muted small">🛡️ Armure : ${inv.bestArmor()} · Choisis un emplacement de la barre avec 1-9 puis « Barre rapide ».</div></div></div>`;
    this.body.innerHTML = html;
  }

  rCraft() {
    if (!stageDef(G.stage).canCraft) {
      this.body.innerHTML = '<p class="muted">Tu dois évoluer en <b>Hominidé</b> pour fabriquer des objets. En attendant, ramasse des bâtons et des pierres !</p>';
      return;
    }
    const f = this.state.craftFilter;
    const stations = ['all', 'main', 'feu', 'etabli', 'four', 'forge', 'labo', 'usine'];
    let html = '<div class="filters">';
    for (const s of stations) html += `<button class="${f === s ? 'on' : ''}" data-act="craftFilter" data-id="${s}">${s === 'all' ? 'Tout' : s === 'main' ? '✋ À la main' : STATION_NAMES[s]}${s !== 'all' && s !== 'main' ? (craftS.nearStation(s) ? ' ✅' : '') : ''}</button>`;
    html += `<label class="chk"><input type="checkbox" data-act="showLocked" ${this.state.showLocked ? 'checked' : ''}> Voir les recettes verrouillées</label></div><div class="recipes">`;
    const list = RECIPES.filter((r) => {
      if (f === 'main' && r.station) return false;
      if (f !== 'all' && f !== 'main' && r.station !== f) return false;
      if (!this.state.showLocked && !craftS.recipeUnlocked(r)) return false;
      return true;
    }).sort((a, b) => Number(craftS.canCraft(b)) - Number(craftS.canCraft(a)));
    if (!list.length) html += '<p class="muted">Aucune recette ici pour l’instant. Recherche des technologies (T) !</p>';
    for (const r of list) {
      const it = item(r.out);
      const unlocked = craftS.recipeUnlocked(r);
      const near = craftS.nearStation(r.station);
      const can = craftS.canCraft(r);
      html += `<div class="recipe ${can ? 'can' : ''} ${unlocked ? '' : 'locked'}">
        <div class="ric">${it.icon}</div>
        <div class="rinfo"><b>${E(it.name)}</b>${r.n > 1 ? ` x${r.n}` : ''} <span class="badge ${near ? 'ok' : 'no'}">${r.station ? STATION_NAMES[r.station] : 'À la main'}</span>${unlocked ? '' : ` <span class="badge no">🔒 ${E(TECH[r.tech].name)}</span>`}
          <div class="chips">${chips(r.ins)}</div><div class="muted small">${describe(it).replace(/<\/?div>/g, ' ')}</div></div>
        <div class="rbtn"><button ${can ? '' : 'disabled'} data-act="craft" data-i="${RECIPES.indexOf(r)}" data-n="1">Fabriquer</button><button ${craftS.canCraft(r, 5) ? '' : 'disabled'} data-act="craft" data-i="${RECIPES.indexOf(r)}" data-n="5">x5</button></div></div>`;
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  rInvent() {
    if (!stageDef(G.stage).canCraft) {
      this.body.innerHTML = '<p class="muted">Évolue en Hominidé pour inventer.</p>';
      return;
    }
    const s = this.state;
    const mix = s.mix;
    let html = `<p class="muted">Combine <b>n’importe quels objets</b> de ton inventaire. Si c’est une recette connue, elle est fabriquée ; sinon tu crées <b>ta propre invention</b> avec un nom et une utilité !</p><div class="split"><div class="grow"><h4>Ton inventaire (clic = ajouter)</h4><div class="grid">`;
    for (const x of inv.invList()) {
      const left = x.n - (mix[x.id] || 0);
      html += `<div class="cell ${left <= 0 ? 'dim' : ''}" data-act="mixAdd" data-id="${x.id}" title="${E(x.it.name)}"><span class="ic">${x.it.icon}</span><span class="n">${left}</span></div>`;
    }
    html += '</div></div><div class="side"><h4>Mélange</h4><div class="mix">';
    const ids = Object.keys(mix).filter((k) => mix[k] > 0);
    if (!ids.length) html += '<p class="muted">Vide</p>';
    for (const id of ids) html += `<div class="mixrow">${item(id).icon} ${E(item(id).name)} <b>x${mix[id]}</b> <button data-act="mixRem" data-id="${id}">−</button></div>`;
    html += '</div>';
    const r = craftS.matchRecipe(mix);
    if (r) html += `<div class="note ok">✨ Cette combinaison fabrique : ${item(r.out).icon} ${E(item(r.out).name)}</div>`;
    html += '<h4>Type d’invention</h4><div class="types">';
    for (const [id, t] of Object.entries(craftS.INVENTION_TYPES)) html += `<button class="${s.invType === id ? 'on' : ''}" data-act="invType" data-id="${id}" title="${E(t.desc)}">${t.icon} ${t.name}</button>`;
    html += `</div><div class="muted small">${E(craftS.INVENTION_TYPES[s.invType].desc)}</div>`;
    if (ids.length) {
      const st = craftS.inventionStats(mix, s.invType);
      const p = [];
      if (st.dmg) p.push(`⚔️ Dégâts ${st.dmg}${st.ranged ? ' (tir)' : ''}`);
      if (st.tier) p.push(`🔧 Niveau ${st.tier} (hache + pioche)`);
      if (st.hunger) p.push(`🍖 +${st.hunger} faim, ❤️ +${st.hp}`);
      if (st.effect) p.push(`🧪 ${st.effect} (${st.amount})`);
      if (st.radius) p.push(`💥 rayon ${st.radius} m`);
      if (st.produce) p.push(`⚙️ ${st.rate} ${item(st.produce).name}/h`);
      if (st.armor) p.push(`🛡️ Armure ${st.armor}`);
      html += `<div class="note">Puissance ${st.power} · ${p.join(' · ') || 'Composant pour d’autres inventions'}</div>`;
    }
    html += `<h4>Nom et icône</h4><input id="inv-name" type="text" maxlength="30" placeholder="Ex : Super-Hache Turbo" value="${E(s.invName)}">
      <div class="icons">${['⚔️', '🔧', '🔨', '🪄', '🍔', '🧪', '💣', '⚙️', '🔩', '🛡️', '🚀', '🎸', '🧸', '💎', '🔦', '🛸'].map((ic) => `<button class="${s.invIcon === ic ? 'on' : ''}" data-act="invIcon" data-id="${ic}">${ic}</button>`).join('')}</div>
      <button class="big-btn" data-act="invent" ${ids.length ? '' : 'disabled'}>💡 Inventer !</button>
      <button data-act="mixClear">Vider</button></div></div>`;
    const custom = Object.values(G.customItems).filter((c) => !c.hidden);
    if (custom.length) html += `<h4>Tes inventions (${custom.length})</h4><div class="grid">${custom.map((c) => `<div class="cell" title="${E(c.name)}"><span class="ic">${c.icon}</span><span class="n">${inv.count(c.id)}</span></div>`).join('')}</div>`;
    this.body.innerHTML = html;
  }

  // =============== CONSTRUCTION ===============
  rBuild() {
    this.titleEl.textContent = '🔨 Construire';
    const pw = civ.power();
    let html = `<div class="info-row"><span>🏠 Logements : ${civ.housing()}</span><span>⚡ Énergie : ${pw.prod} / ${pw.cons} utilisée ${pw.ok ? '✅' : '⚠️'}</span><span>🧱 Bâtiments : ${G.buildings.length}</span><button data-act="demolish">🗑️ Démolir le plus proche</button></div><div class="cards">`;
    for (const b of BUILDINGS) {
      const unlocked = G.techs.includes(b.tech);
      if (!unlocked && !this.state.showLocked) continue;
      const ok = unlocked && inv.hasAll(b.cost);
      html += `<div class="bcard ${ok ? 'can' : ''} ${unlocked ? '' : 'locked'}"><div class="bic">${b.icon}</div><b>${E(b.name)}</b><div class="muted small">${E(b.desc || '')}</div><div class="chips">${chips(b.cost)}</div>${unlocked ? `<button data-act="build" data-id="${b.id}" ${ok ? '' : 'disabled'}>Construire</button>` : `<span class="badge no">🔒 ${E(TECH[b.tech].name)}</span>`}</div>`;
    }
    html += `</div><label class="chk"><input type="checkbox" data-act="showLocked" ${this.state.showLocked ? 'checked' : ''}> Voir les bâtiments verrouillés</label>`;
    this.body.innerHTML = html;
  }

  // =============== TECHNOLOGIES ===============
  rTech() {
    this.titleEl.textContent = '🔬 Technologies';
    const era = eraOf(G.time.year);
    let html = `<div class="info-row"><span>📚 Savoir : <b>${fmtNum(G.savoir)}</b></span><span>🏛️ ${era.name}</span><span>📅 ${fmtYear(G.time.year)}</span><span class="muted">Gagne du savoir en fabriquant, en récoltant et grâce aux scientifiques.</span></div><div class="techtree">`;
    for (const er of ERAS) {
      const list = TECHS.filter((t) => eraOf(t.year).id === er.id);
      if (!list.length) continue;
      html += `<div class="tcol"><h4>${er.name}</h4>`;
      for (const t of list) {
        const s = techS.techState(t);
        html += `<div class="tcard ${s}" data-act="research" data-id="${t.id}" title="${E(t.desc)}"><div class="tic">${t.icon}</div><div><b>${E(t.name)}</b><div class="small">${E(t.desc)}</div><div class="small muted">${s === 'done' ? '✅ Découvert' : `📚 ${t.cost}`}${t.req.length && s === 'locked' ? ' · requiert ' + t.req.map((r) => TECH[r].name).join(', ') : ''}</div></div></div>`;
      }
      html += '</div>';
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  // =============== GÉNÉTIQUE ===============
  rGenetics() {
    this.titleEl.textContent = '🧬 Génétique & évolution';
    const st = stageDef(G.stage);
    let html = '<div class="timeline">';
    STAGES.forEach((s, i) => {
      html += `<div class="tl ${i < G.stage ? 'past' : i === G.stage ? 'now' : ''}"><span>${['🦠', '🧫', '🐟', '🐸', '🦎', '🐺', '🐒', '🧔', '🧑'][i]}</span><small>${E(s.name.split(' (')[0])}</small></div>`;
    });
    html += `</div><div class="split"><div class="grow"><h3>${E(st.name)}</h3><p>${E(st.intro)}</p><p class="muted">${E(st.goal)}</p>`;
    html += `<h4>Mutations (ADN : <b>${Math.floor(G.dna)}</b>)</h4><div class="muts">`;
    for (const m of evo.stageMutations()) {
      const own = G.mutations.includes(m.id);
      const reqOk = !m.req || G.mutations.includes(m.req);
      const can = !own && reqOk && G.dna >= m.cost;
      const stats = Object.entries(m.stats)
        .map(([k, v]) => `${{ hp: '❤️', atk: '⚔️', speed: '👟', armor: '🛡️', regen: '💚', size: '📏' }[k]} ${v > 0 ? '+' : ''}${v}`)
        .join(' ');
      html += `<div class="mut ${own ? 'own' : can ? 'can' : ''}" data-act="mutate" data-id="${m.id}"><div class="mic">${m.icon}</div><div><b>${E(m.name)}</b>${m.evolve ? ' <span class="badge ev">requis pour évoluer</span>' : ''}<div class="small">${E(m.desc)} ${stats}</div><div class="small muted">${own ? '✅ Acquise' : `🧬 ${m.cost}${m.req && !reqOk ? ' · requiert ' + evo.mutDef(m.req).name : ''}`}</div></div></div>`;
    }
    html += '</div></div><div class="side">';
    const rq = evo.evolveRequirements();
    if (!rq.last) {
      const next = STAGES[G.stage + 1];
      html += `<div class="evo-box"><h4>Prochaine étape</h4><div class="big">${['🦠', '🧫', '🐟', '🐸', '🦎', '🐺', '🐒', '🧔', '🧑'][G.stage + 1]}</div><b>${E(next.name)}</b>
        <div class="${rq.dnaOk ? 'ok' : 'no'}">🧬 ADN : ${Math.floor(G.dna)} / ${rq.dnaNeeded}</div>
        ${evo.stageMutations().filter((m) => m.evolve).map((m) => `<div class="${G.mutations.includes(m.id) ? 'ok' : 'no'}">${m.icon} ${E(m.name)}</div>`).join('')}
        <button class="big-btn" data-act="evolve" ${evo.canEvolve() ? '' : 'disabled'}>✨ ÉVOLUER</button></div>`;
    } else {
      html += `<div class="evo-box"><h4>Sommet de l’évolution</h4><p>Tu es humain. La suite, c’est l’Histoire : technologies (T) et civilisation (V).</p>`;
      if (G.monster) html += `<p>👹 Tu es un <b>monstre</b> : ${G.monster.traits.map((t) => E(TRAITS[t].name)).join(', ')}.<br>F : souffle de feu. Sérum d’humanité pour redevenir humain.</p>`;
      else html += '<p class="muted">Avec le Génie génétique, fusionne de l’ADN au laboratoire pour devenir un monstre !</p>';
      html += '</div>';
    }
    const s = evo.computeStats();
    html += `<div class="stats"><h4>Tes statistiques</h4><div>❤️ Santé ${Math.round(s.hp)}</div><div>⚔️ Attaque ${Math.round(s.atk)}</div><div>👟 Vitesse ${s.speed.toFixed(1)}</div><div>🛡️ Armure ${s.armor}</div><div>💚 Régénération ${s.regen.toFixed(1)}</div><div>🧬 ADN total ${fmtNum(G.dnaTotal)}</div></div></div></div>`;
    this.body.innerHTML = html;
  }

  // =============== CIVILISATION ===============
  rCiv() {
    this.titleEl.textContent = '🏛️ Civilisation';
    const t = this.setTabs(
      [
        ['village', '🏠 Village'],
        ['gov', '👑 Gouvernement'],
        ['diplo', '🤝 Diplomatie'],
        ['career', '💼 Carrière'],
        ['news', '📰 Journal'],
      ],
      'civ',
    );
    const V = G.village;
    let html = '';
    if (t === 'village') {
      if (!V) {
        html += `<div class="center-box"><h3>Fonder un village</h3><p>Rassemble ta tribu autour de toi. Les villageois travaillent, produisent et ont besoin de nourriture et de logements.</p>`;
        if (civ.canFound()) html += `<input id="vname" type="text" maxlength="24" placeholder="Nom du village" value="Aube"><button class="big-btn" data-act="found">🏕️ Fonder ici</button>`;
        else html += `<p class="no">Il faut être Homo sapiens et avoir découvert « Vie en tribu » (T).</p>`;
        html += '</div>';
      } else {
        const pop = civ.population();
        const food = ['ble', 'baies', 'fruit', 'pain', 'viande', 'viande_cuite', 'poisson', 'poisson_cuit', 'soupe', 'burger'].reduce((s, id) => s + inv.count(id), 0);
        html += `<div class="info-row"><span>🏠 <b>${E(V.name)}</b></span><span>👥 ${pop} / ${civ.housing()} logements</span><span>😊 Bonheur ${Math.round(V.happiness)}%</span><span>🍞 Nourriture ${food} (${pop}/jour)</span><span>⚔️ Armée ${civ.military()}</span></div>`;
        if (V.epidemic) html += `<div class="note bad">🦠 Épidémie de ${E(V.epidemic.name)} (niveau ${V.epidemic.level}) : ${V.epidemic.sick} malade(s). <button data-act="treat">💊 Soigner</button></div>`;
        if (pop > civ.housing()) html += '<div class="note bad">Pas assez de logements ! Construis des huttes ou des maisons (B).</div>';
        html += '<h4>Métiers</h4><div class="jobs">';
        const c = civ.jobCounts();
        for (const [id, j] of Object.entries(JOBS)) {
          const avail = civ.jobAvailable(id);
          if (!avail && !c[id]) continue;
          html += `<div class="job"><span class="jic">${j.icon}</span><div class="grow"><b>${j.name}</b><div class="small muted">${E(j.desc)}</div></div><button data-act="jobMinus" data-id="${id}" ${c[id] ? '' : 'disabled'}>−</button><b class="jn">${c[id] || 0}</b><button data-act="jobPlus" data-id="${id}" ${avail ? '' : 'disabled'}>+</button></div>`;
        }
        html += '</div><h4>Habitants</h4><div class="people">';
        for (const p of V.people.slice(0, 60)) html += `<span class="person">${JOBS[p.job]?.icon || '🙂'} ${E(p.name)}</span>`;
        html += '</div>';
      }
    } else if (t === 'gov') {
      html += `<div class="info-row"><span>Titre : <b>${TITLES[G.title] || 'Citoyen'}</b></span><span>📣 Popularité ${Math.round(G.popularity)}%</span><span>💰 ${fmtNum(G.money)}</span></div>`;
      html += `<div class="bar wide"><div class="fill pop" style="width:${G.popularity}%"></div></div>`;
      if (!V) html += '<p class="muted">Fonde d’abord un village.</p>';
      else {
        html += `<h4>Impôts : ${G.taxes}%</h4><p class="muted small">Plus d’impôts = plus d’argent chaque jour, mais moins de bonheur.</p><div class="btns"><button data-act="tax" data-id="-5">−5%</button><button data-act="tax" data-id="5">+5%</button></div>`;
        html += '<h4>Pouvoir</h4>';
        if (G.techs.includes('democratie')) {
          html += `<p>🗳️ Démocratie : prochaine élection le <b>jour ${G.nextElection || G.time.day + 3}</b>. Ta popularité décide du résultat !</p><div class="btns"><button data-act="campaign" data-id="discours">🎤 Faire un discours</button><button data-act="campaign" data-id="argent">💸 Distribuer de l’argent</button><button data-act="campaign" data-id="fete">🎉 Organiser une fête</button></div>`;
        } else if (G.techs.includes('lois')) {
          html += `<p>👑 Avec un Palais, tu peux te faire couronner.</p><button data-act="crown" ${G.title === 'roi' ? 'disabled' : ''}>👑 Se faire couronner</button>`;
        } else html += '<p class="muted">Recherche « Lois et royauté » pour devenir roi, puis « Démocratie » pour les élections présidentielles.</p>';
      }
    } else if (t === 'diplo') {
      html += '<div class="factions">';
      for (const f of G.factions) {
        const col = '#' + f.color.toString(16).padStart(6, '0');
        const status = f.conquered ? '🏴 Conquis' : f.war ? '⚔️ En guerre' : f.ally ? '🤝 Allié' : '😐 Neutre';
        html += `<div class="faction" style="border-color:${col}"><h4 style="color:${col}">${E(f.name)}</h4><div class="small">${E(f.leader)} · peuple ${E(f.trait)}</div><div>${status}</div><div class="small">👥 ${f.pop} · ⚔️ ${Math.round(f.mil)}${f.infected ? ' · 🦠 infecté' : ''}</div>
          <div class="rel"><div style="width:${(f.relation + 100) / 2}%;background:${f.relation < 0 ? '#e04040' : '#40c060'}"></div></div><div class="small">Relation ${Math.round(f.relation)}</div>`;
        if (!f.conquered) {
          html += `<div class="btns"><button data-act="diplo" data-f="${f.id}" data-id="cadeau">🎁 Cadeau</button>`;
          if (!f.war && !f.ally) html += `<button data-act="diplo" data-f="${f.id}" data-id="alliance">🤝 Alliance</button>`;
          if (!f.war) html += `<button class="danger" data-act="diplo" data-f="${f.id}" data-id="guerre">⚔️ Guerre</button>`;
          else html += `<button data-act="diplo" data-f="${f.id}" data-id="paix">🕊️ Paix</button>`;
          if (G.techs.includes('genetique')) html += `<button class="danger" data-act="diplo" data-f="${f.id}" data-id="virus">🦠 Virus</button>`;
          if (f.war && f.mil <= 0) html += `<button data-act="diplo" data-f="${f.id}" data-id="conquerir">🏴 Conquérir</button>`;
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div><p class="muted small">En guerre : bats leurs soldats (dans leur village ou quand ils attaquent le tien). Quand leur armée tombe à 0, conquiers-les !</p>';
    } else if (t === 'career') {
      html += '<p class="muted">Deviens qui tu veux ! Ta carrière te rapporte chaque jour.</p><div class="cards">';
      for (const [id, c] of Object.entries(CAREERS)) {
        const ok = !c.tech || G.techs.includes(c.tech);
        html += `<div class="bcard ${G.career === id ? 'can' : ''} ${ok ? '' : 'locked'}"><div class="bic">${c.icon}</div><b>${c.name}</b><div class="small">${E(c.desc)}</div>${ok ? `<button data-act="career" data-id="${id}" ${G.career === id ? 'disabled' : ''}>${G.career === id ? 'Actuelle' : 'Choisir'}</button>` : `<span class="badge no">🔒 ${E(TECH[c.tech].name)}</span>`}</div>`;
      }
      html += '</div><p class="muted small">Président(e) : par les élections (Gouvernement). Monstre : au laboratoire.</p>';
    } else {
      html += '<div class="news">' + (G.news.length ? G.news.map((n) => `<div><span class="muted">Jour ${n.day} · ${E(fmtYear(n.year))}</span> ${E(n.text)}</div>`).join('') : '<p class="muted">Rien pour l’instant.</p>') + '</div>';
    }
    this.body.innerHTML = html;
  }

  // =============== BOUTIQUE ===============
  rShop(fromComputer = false) {
    this.titleEl.textContent = fromComputer ? '🛒 Boutique en ligne' : '🏪 Boutique & marché';
    const t = this.setTabs(
      [
        ['buy', '🛒 Acheter'],
        ['sell', '💰 Vendre'],
        ['mine', '🏪 Ma boutique'],
      ],
      'shop',
    );
    this.body.innerHTML = this.shopHtml(t);
  }

  shopHtml(t) {
    let html = `<div class="info-row"><span>💰 <b>${fmtNum(G.money)}</b> pièces</span>${G.techs.includes('commerce') ? '' : '<span class="no">Il faut la technologie Monnaie et commerce.</span>'}</div>`;
    if (t === 'buy') {
      html += '<div class="table">';
      for (const id of civ.marketItems()) {
        const it = item(id);
        html += `<div class="trow"><span>${it.icon} ${E(it.name)}</span><span class="muted">x${fmtNum(inv.count(id))}</span><b>${civ.buyPrice(id)} 💰</b><button data-act="buy" data-id="${id}" data-n="1">Acheter</button><button data-act="buy" data-id="${id}" data-n="10">x10</button></div>`;
      }
      html += '</div>';
    } else if (t === 'sell') {
      html += '<div class="table">';
      for (const x of inv.invList()) {
        html += `<div class="trow"><span>${x.it.icon} ${E(x.it.name)}</span><span class="muted">x${fmtNum(x.n)}</span><b>${civ.sellPrice(x.id)} 💰</b><button data-act="sell" data-id="${x.id}" data-n="1">Vendre</button><button data-act="sell" data-id="${x.id}" data-n="${x.n}">Tout</button></div>`;
      }
      html += '</div>';
    } else {
      const online = G.techs.includes('internet');
      const hasShop = G.buildings.some((b) => b.type === 'marche');
      html += `<p class="muted">Mets tes objets en vente au prix que tu veux. ${hasShop ? 'Les villageois et voyageurs les achètent chaque heure.' : 'Construis une Boutique (B) pour vendre aux passants.'} ${online ? 'Avec Internet, la vente en ligne touche le monde entier (ordinateur requis) !' : ''}</p>`;
      html += `<div class="form"><select id="sale-id">${inv.invList().map((x) => `<option value="${x.id}">${x.it.icon} ${E(x.it.name)} (x${x.n})</option>`).join('')}</select>
        <input id="sale-qty" type="number" min="1" value="10" title="Quantité"><input id="sale-price" type="number" min="1" placeholder="Prix" title="Prix unitaire">
        ${online ? '<label class="chk"><input id="sale-online" type="checkbox" checked> En ligne</label>' : ''}<button data-act="putSale">Mettre en vente</button></div>`;
      html += '<div class="table">';
      if (!G.shopStock.length) html += '<p class="muted">Rien en vente.</p>';
      G.shopStock.forEach((s, i) => {
        html += `<div class="trow"><span>${item(s.id).icon} ${E(item(s.id).name)}</span><span>x${s.qty}</span><b>${s.price} 💰</b><span class="small">${s.online ? '🌐 en ligne' : '🏪 boutique'} · marché ${civ.price(s.id)}</span><button data-act="unsale" data-i="${i}">Retirer</button></div>`;
      });
      html += `</div><p class="muted small">Ventes totales : ${G.stats.sold || 0} objets.</p>`;
    }
    return html;
  }

  // =============== ORDINATEUR ===============
  rComputer() {
    this.titleEl.textContent = '💻 Ordinateur — ÉvoOS';
    const s = this.state;
    const apps = [
      ['code', '⌨️ Programmer'],
      ['shop', '🛒 Boutique en ligne'],
      ['market', '📈 Bourse'],
      ['robots', '🤖 Robots'],
      ['news', '📰 Actualités'],
    ];
    let html = '<div class="os"><div class="os-apps">';
    for (const [id, l] of apps) html += `<button class="${s.app === id ? 'on' : ''}" data-act="app" data-id="${id}">${l}</button>`;
    html += '</div><div class="os-main">';
    if (s.app === 'code') {
      const scripts = { ...comp.EXAMPLES, ...G.scripts };
      const code = G.scripts[s.script] ?? comp.EXAMPLES[s.script] ?? '';
      html += `<div class="code-bar"><select id="script-sel">${Object.keys(scripts).map((k) => `<option ${k === s.script ? 'selected' : ''}>${E(k)}</option>`).join('')}</select>
        <button data-act="runCode" class="run">▶ Exécuter</button><button data-act="stopCode">■ Stop</button><button data-act="saveCode">💾 Enregistrer</button><button data-act="newCode">＋ Nouveau</button></div>
        <textarea id="code" spellcheck="false">${E(code)}</textarea>
        <div id="console" class="console">${s.console.map((l) => `<div class="${l.k}">${E(l.t)}</div>`).join('')}</div>
        <details class="apidoc"><summary>📖 Fonctions disponibles (JavaScript)</summary>${comp.API_DOC.map(([a, b]) => `<div><code>${E(a)}</code> — ${E(b)}</div>`).join('')}</details>`;
    } else if (s.app === 'shop') {
      if (!G.techs.includes('internet')) html += '<p class="no">Il faut la technologie Internet.</p>';
      html += this.shopHtml('mine');
    } else if (s.app === 'market') {
      html += '<h4>Cours du marché mondial</h4><div class="table">';
      for (const id of civ.marketItems()) {
        const m = G.market[id] ?? 1;
        html += `<div class="trow"><span>${item(id).icon} ${E(item(id).name)}</span><b>${civ.price(id)} 💰</b><span class="${m >= 1 ? 'ok' : 'no'}">${m >= 1 ? '▲' : '▼'} ${Math.round((m - 1) * 100)}%</span><button data-act="sell" data-id="${id}" data-n="1" ${inv.count(id) ? '' : 'disabled'}>Vendre</button><button data-act="buy" data-id="${id}" data-n="1">Acheter</button></div>`;
      }
      html += '</div>';
    } else if (s.app === 'robots') html += this.robotsHtml();
    else html += '<div class="news">' + G.news.map((n) => `<div><span class="muted">Jour ${n.day}</span> ${E(n.text)}</div>`).join('') + '</div>';
    html += '</div></div>';
    this.body.innerHTML = html;
  }

  robotsHtml() {
    if (!G.robots.length) return '<p class="muted">Aucun robot. Fabrique-en à l’usine (Robotique).</p>';
    let html = '<div class="table">';
    G.robots.forEach((r, i) => {
      html += `<div class="trow"><span>🤖 ${E(r.name)}</span><span class="muted">${r.kind}</span>${['suivre', 'combat', 'recolter', 'garder'].map((m) => `<button class="${r.mode === m ? 'on' : ''}" data-act="robotMode" data-i="${i}" data-id="${m}">${{ suivre: '🚶 Suivre', combat: '⚔️ Combat', recolter: '⛏️ Récolter', garder: '🛡️ Garder' }[m]}</button>`).join('')}</div>`;
    });
    return html + '</div>';
  }

  log(t, k = 'log') {
    this.state.console.push({ t, k });
    if (this.state.console.length > 200) this.state.console.shift();
    const c = document.getElementById('console');
    if (c) {
      const d = document.createElement('div');
      d.className = k;
      d.textContent = t;
      c.appendChild(d);
      c.scrollTop = c.scrollHeight;
    }
  }

  // =============== LABORATOIRE ===============
  rLab() {
    this.titleEl.textContent = '🔬 Laboratoire';
    const t = this.setTabs(
      [
        ['dna', '🧬 Fusion d’ADN'],
        ['craft', '⚗️ Potions & remèdes'],
      ],
      'lab',
    );
    if (t === 'craft') {
      this.state.craftFilter = 'labo';
      this.rCraft();
      return;
    }
    let html = '';
    if (!G.techs.includes('genetique')) html += '<p class="no">La fusion d’ADN demande la technologie « Génie génétique » (an 2010). En attendant, fabrique des potions dans l’autre onglet.</p>';
    html += '<p class="muted">Récupère des échantillons d’ADN en dépeçant des animaux (couteau). Fusionne jusqu’à 3 ADN avec le tien pour devenir un <b>monstre hybride</b> !</p><div class="grid">';
    const smp = lab.samples();
    if (!smp.length) html += '<p class="muted">Aucun échantillon. Chasse des animaux et dépèce-les (E).</p>';
    for (const x of smp) html += `<div class="cell ${this.state.labSel.includes(x.id) ? 'sel' : ''}" data-act="labSel" data-id="${x.id}" title="${E(x.s.name)} : ${E(TRAITS[lab.traitOf(x.sid)].name)}"><span class="ic">🧬</span><span class="lbl">${E(x.s.name)}</span><span class="n">${x.n}</span></div>`;
    html += '</div>';
    if (this.state.labSel.length) {
      const pv = lab.previewFusion(this.state.labSel);
      html += `<div class="note">Résultat : ${pv.traits.map((t) => `<b>${E(TRAITS[t].name)}</b> (${E(TRAITS[t].desc)})`).join(', ')}</div>`;
    }
    html += `<button class="big-btn danger" data-act="fuse" ${this.state.labSel.length && G.techs.includes('genetique') ? '' : 'disabled'}>🧬 FUSIONNER ET MUTER</button>`;
    if (G.monster) html += `<p>👹 Tu es déjà un monstre (${G.monster.traits.map((t) => E(TRAITS[t].name)).join(', ')}). Une nouvelle fusion ajoute des pouvoirs.</p>`;
    this.body.innerHTML = html;
  }

  // =============== DIALOGUE ===============
  rTalk() {
    const n = this.arg;
    if (!n) return this.close();
    let html = '';
    if (n.kind === 'robot') {
      this.titleEl.textContent = `🤖 ${n.name}`;
      html += `<p>« Bip boup. En attente d’instructions. Mode actuel : <b>${n.data.mode}</b>. »</p><div class="btns">${['suivre', 'combat', 'recolter', 'garder'].map((m) => `<button class="${n.data.mode === m ? 'on' : ''}" data-act="robotModeN" data-id="${m}">${{ suivre: '🚶 Suis-moi', combat: '⚔️ Combats', recolter: '⛏️ Récolte des ressources', garder: '🛡️ Garde le village' }[m]}</button>`).join('')}</div>`;
    } else if (n.kind === 'faction') {
      const f = G.factions.find((x) => x.id === n.factionId);
      this.titleEl.textContent = `${n.name} — ${f?.name || ''}`;
      const line = f?.war ? 'Tu oses venir ici, ennemi ?!' : f?.ally ? 'Bienvenue, ami ! Nos peuples sont unis.' : f && f.relation < -30 ? 'Que veux-tu, étranger ? Fais vite.' : 'Bonjour, voyageur. Notre peuple est ouvert au commerce.';
      html += `<p class="speech">« ${E(line)} »</p><div class="btns">`;
      if (f && !f.war) html += `<button data-act="openShop">🛒 Commercer</button>`;
      if (f) html += `<button data-act="diplo" data-f="${f.id}" data-id="cadeau">🎁 Offrir un cadeau</button>`;
      if (f && !f.war && !f.ally) html += `<button data-act="diplo" data-f="${f.id}" data-id="alliance">🤝 Proposer une alliance</button>`;
      if (f && n.role === 'chef' && f.war && f.mil <= 0) html += `<button class="big-btn" data-act="diplo" data-f="${f.id}" data-id="conquerir">🏴 Conquérir ce peuple</button>`;
      if (f && f.war) html += `<button data-act="diplo" data-f="${f.id}" data-id="paix">🕊️ Demander la paix</button>`;
      html += '</div>';
    } else {
      this.titleEl.textContent = `${JOBS[n.role]?.icon || '🙂'} ${n.name}`;
      const V = G.village;
      const mood = G.monster ? 'monster' : eraIndex(G.time.year) >= 8 && Math.random() < 0.5 ? 'modern' : !V ? 'neutral' : V.happiness > 65 ? 'happy' : V.happiness < 35 ? 'sad' : 'neutral';
      html += `<p class="speech">« ${E(pick(LINES[mood]))} »</p><p class="muted">Métier : ${JOBS[n.role]?.name || '—'}</p><h4>Changer de métier</h4><div class="btns">`;
      for (const [id, j] of Object.entries(JOBS)) if (civ.jobAvailable(id)) html += `<button class="${n.role === id ? 'on' : ''}" data-act="setJob" data-id="${id}">${j.icon} ${j.name}</button>`;
      html += `</div><div class="btns"><button data-act="giftVillager">🎁 Offrir à manger</button></div>`;
    }
    this.body.innerHTML = html;
  }

  // =============== CARTE ===============
  rMap() {
    this.titleEl.textContent = '🗺️ Carte du monde';
    this.body.innerHTML = `<canvas id="bigmap" width="640" height="640"></canvas><div class="legend"><span>🧍 Toi</span><span>🏠 Ton village</span><span>⬜ Bâtiments</span><span>● Peuples rivaux</span><span>⚔️ Guerre</span></div>`;
    this.drawMap();
  }

  drawMap() {
    const c = document.getElementById('bigmap');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width;
    const map = G.hud.terrainMap || G.hud.buildTerrainMap();
    ctx.drawImage(map, 0, 0, W, W);
    const to = (x, z) => [((x + SIZE / 2) / SIZE) * W, ((z + SIZE / 2) / SIZE) * W];
    ctx.font = '16px sans-serif';
    for (const b of G.buildings) {
      const [x, y] = to(b.x, b.z);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    if (G.village) {
      const [x, y] = to(G.village.x, G.village.z);
      ctx.fillText('🏠', x - 8, y + 6);
      ctx.fillStyle = '#fff';
      ctx.fillText(G.village.name, x + 10, y + 5);
    }
    for (const f of G.factions) {
      if (f.conquered && !f.keepHouses) continue;
      const [x, y] = to(f.x, f.z);
      ctx.fillStyle = '#' + f.color.toString(16).padStart(6, '0');
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText((f.war ? '⚔️ ' : f.conquered ? '🏴 ' : '') + f.name, x + 10, y + 5);
    }
    const P = G.player;
    const [px, py] = to(P.pos.x, P.pos.z);
    ctx.fillStyle = '#ff3030';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // =============== PAUSE / AIDE ===============
  rPause() {
    this.titleEl.textContent = '⏸️ Pause';
    const s = G.settings;
    this.body.innerHTML = `<div class="center-box">
      <button class="big-btn" data-act="close">▶ Continuer</button>
      <button data-act="save">💾 Sauvegarder</button>
      <button data-act="openHelp">❓ Commandes</button>
      <h4>Options</h4>
      <label>Sensibilité souris <input type="range" min="0.2" max="3" step="0.1" value="${s.sens}" data-set="sens"></label>
      <label>Volume <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
      <label class="chk"><input type="checkbox" data-set="invertY" ${s.invertY ? 'checked' : ''}> Inverser l’axe vertical</label>
      <label>Qualité graphique (au prochain lancement) <select data-set="quality">${['low', 'medium', 'high'].map((q) => `<option value="${q}" ${s.quality === q ? 'selected' : ''}>${{ low: 'Basse', medium: 'Moyenne', high: 'Haute' }[q]}</option>`).join('')}</select></label>
      <button class="danger" data-act="quit">🚪 Menu principal</button></div>`;
  }

  rHelp() {
    this.titleEl.textContent = '❓ Commandes';
    this.body.innerHTML = helpHtml();
  }

  // =============== ÉVÉNEMENTS ===============
  onInput(e) {
    const t = e.target;
    if (t.dataset.set) {
      const k = t.dataset.set;
      const v = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
      G.settings[k] = v;
      if (k === 'volume') setVolume(v);
      saveSettings();
    }
    if (t.id === 'inv-name') this.state.invName = t.value;
    if (t.id === 'script-sel' && e.type === 'change') {
      this.state.script = t.value;
      this.render();
    }
    if (t.dataset.act === 'showLocked' && e.type === 'change') {
      this.state.showLocked = t.checked;
      this.render();
    }
  }

  onClick(e) {
    if (e.target === this.el) return this.close();
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act;
    const id = b.dataset.id;
    const s = this.state;
    sfx('click');
    const findF = () => G.factions.find((f) => f.id === b.dataset.f);
    const acts = {
      close: () => this.close(),
      tab: () => {
        this.tab[b.dataset.key] = id;
        this.render();
      },
      selItem: () => {
        s.selItem = id;
        this.render();
      },
      useItem: () => {
        const it = item(id);
        if (it.machine) {
          this.close();
          G.buildingsSys.start('machine', id);
          return;
        }
        if (it.deploy) {
          this.close();
          G.player.deploy(id);
          return;
        }
        G.player.consume(id);
        this.render();
      },
      toHotbar: () => {
        const old = G.hotbar.indexOf(id);
        if (old >= 0) G.hotbar[old] = null;
        G.hotbar[G.hotSel] = id;
        toast(`${item(id).name} → emplacement ${G.hotSel + 1}`);
        this.render();
      },
      drop: () => {
        inv.remove(id, 1);
        this.render();
      },
      craftFilter: () => {
        s.craftFilter = id;
        this.render();
      },
      craft: () => {
        craftS.craft(RECIPES[+b.dataset.i], +b.dataset.n);
        this.render();
      },
      mixAdd: () => {
        if ((s.mix[id] || 0) < inv.count(id)) s.mix[id] = (s.mix[id] || 0) + 1;
        this.render();
      },
      mixRem: () => {
        s.mix[id] = Math.max(0, (s.mix[id] || 0) - 1);
        if (!s.mix[id]) delete s.mix[id];
        this.render();
      },
      mixClear: () => {
        s.mix = {};
        this.render();
      },
      invType: () => {
        s.invType = id;
        this.render();
      },
      invIcon: () => {
        s.invIcon = id;
        this.render();
      },
      invent: () => {
        const r = craftS.invent({ ...s.mix }, s.invType, s.invName.trim(), s.invIcon);
        if (r) {
          s.mix = {};
          s.invName = '';
        }
        this.render();
      },
      build: () => {
        this.close();
        G.buildingsSys.start(id);
      },
      demolish: () => {
        G.buildingsSys.demolishNearest();
        this.render();
      },
      research: () => {
        techS.research(id);
        this.render();
      },
      mutate: () => {
        if (evo.buyMutation(id)) G.player.rebuild();
        this.render();
      },
      evolve: () => {
        this.close();
        evo.evolve();
      },
      found: () => {
        const n = document.getElementById('vname')?.value.trim();
        civ.foundVillage(n || 'Aube');
        this.render();
      },
      jobPlus: () => {
        const c = civ.jobCounts();
        const from = c.sans ? 'sans' : Object.entries(c).filter(([k]) => k !== id).sort((x, y) => y[1] - x[1])[0]?.[0];
        if (from) civ.changeJob(from, id);
        this.render();
      },
      jobMinus: () => {
        civ.changeJob(id, 'sans');
        this.render();
      },
      treat: () => {
        civ.treatEpidemic();
        this.render();
      },
      tax: () => {
        G.taxes = clamp(G.taxes + +id, 0, 50);
        this.render();
      },
      campaign: () => {
        civ.campaign(id);
        this.render();
      },
      crown: () => {
        civ.crownKing();
        G.player.rebuild();
        this.render();
      },
      career: () => {
        civ.setCareer(id);
        G.player.rebuild();
        this.render();
      },
      diplo: () => {
        const f = findF();
        if (f) civ.diplomacy(f, id);
        if (this.name === 'talk' && id === 'conquerir') this.close();
        else this.render();
      },
      buy: () => {
        civ.buy(id, +b.dataset.n);
        this.render();
      },
      sell: () => {
        civ.sell(id, +b.dataset.n);
        this.render();
      },
      putSale: () => {
        const sid = document.getElementById('sale-id')?.value;
        const q = +document.getElementById('sale-qty')?.value || 1;
        const p = +document.getElementById('sale-price')?.value || civ.price(sid);
        const online = !!document.getElementById('sale-online')?.checked;
        if (online && !G.buildings.some((x) => x.type === 'ordinateur')) toast('La vente en ligne demande un ordinateur.', 'bad');
        if (sid && civ.putOnSale(sid, q, p, online)) toast(`En vente : ${q} ${item(sid).name} à ${p} 💰`, 'good');
        this.render();
      },
      unsale: () => {
        civ.withdrawSale(+b.dataset.i);
        this.render();
      },
      app: () => {
        s.app = id;
        this.render();
      },
      runCode: () => {
        const code = document.getElementById('code').value;
        s.console = [];
        this.render();
        G.stats.programs = (G.stats.programs || 0) + 1;
        this.log('▶ Exécution de « ' + s.script + ' »...', 'ok');
        comp.run(code, (t, k) => this.log(t, k));
      },
      stopCode: () => {
        comp.stop();
        this.log('■ Programme arrêté.', 'err');
      },
      saveCode: () => {
        G.scripts[s.script] = document.getElementById('code').value;
        toast('Programme enregistré.', 'good');
      },
      newCode: () => {
        const name = prompt('Nom du programme :', 'Mon programme');
        if (!name) return;
        G.scripts[name] = '// Écris ton code JavaScript ici\nafficher("Salut !");\n';
        s.script = name;
        this.render();
      },
      robotMode: () => {
        G.robots[+b.dataset.i].mode = id;
        this.render();
      },
      robotModeN: () => {
        this.arg.data.mode = id;
        toast(`${this.arg.name} : mode ${id}`, 'good');
        this.render();
      },
      labSel: () => {
        const i = s.labSel.indexOf(id);
        if (i >= 0) s.labSel.splice(i, 1);
        else if (s.labSel.length < 3) s.labSel.push(id);
        this.render();
      },
      fuse: () => {
        if (lab.fuse([...s.labSel])) {
          s.labSel = [];
          this.close();
          G.player.rebuild();
        } else this.render();
      },
      setJob: () => {
        const n = this.arg;
        if (n.data) n.data.job = id;
        n.role = id;
        G.npcs.remove(n);
        toast(`${n.name} devient ${JOBS[id].name}.`, 'good');
        this.close();
      },
      giftVillager: () => {
        const food = ['viande_cuite', 'pain', 'poisson_cuit', 'baies', 'fruit', 'ble'].find((x) => inv.count(x) > 0);
        if (!food) return toast('Tu n’as rien à offrir.', 'bad');
        inv.remove(food, 1);
        if (G.village) G.village.happiness = clamp(G.village.happiness + 2, 0, 100);
        G.popularity = clamp(G.popularity + 1, 0, 100);
        toast(`${this.arg.name} te remercie ! (+bonheur)`, 'good');
      },
      openShop: () => this.open('shop'),
      save: () => toast(save() ? 'Partie sauvegardée.' : 'Impossible de sauvegarder.', 'good'),
      openHelp: () => this.open('help'),
      quit: () => {
        save();
        location.reload();
      },
    };
    acts[a]?.();
  }
}

export function helpHtml() {
  return `<div class="help">
    <h4>Clavier & souris</h4>
    <div><kbd>Z Q S D</kbd> / <kbd>W A S D</kbd> se déplacer · <kbd>Souris</kbd> caméra (clique dans le jeu pour la capturer)</div>
    <div><kbd>Espace</kbd> sauter / monter · <kbd>C</kbd> ou <kbd>Ctrl</kbd> descendre · <kbd>Maj</kbd> sprint</div>
    <div><kbd>Clic gauche</kbd> attaquer, récolter, tirer, lancer · <kbd>E</kbd> interagir (manger, boire, ramasser, parler)</div>
    <div><kbd>F</kbd> / <kbd>Clic droit</kbd> manger / utiliser l’objet (monstre : souffle de feu) · <kbd>1-9</kbd> / molette barre rapide</div>
    <div><kbd>I</kbd> inventaire, fabrication, invention · <kbd>B</kbd> construire · <kbd>T</kbd> technologies · <kbd>G</kbd> génétique · <kbd>V</kbd> civilisation · <kbd>M</kbd> carte · <kbd>Échap</kbd> pause</div>
    <h4>Le principe</h4>
    <div>🦠 Commence en cellule : mange, gagne de l’ADN, achète des mutations et <b>évolue</b> : cellule → organisme → poisson → amphibien → reptile → mammifère → singe → hominidé → humain.</div>
    <div>🧑 Humain : récolte, fabrique, construis, fonde ton village, découvre les technologies de la Préhistoire à l’an 2000 et au-delà.</div>
    <div>💻 Dès l’an 2000 : ordinateurs programmables en JavaScript, boutique en ligne, robots. 🧬 Génétique : deviens un monstre hybride.</div>
    <div>👑 Deviens chef, roi, président… ou n’importe quel métier. Fais du commerce, des alliances ou la guerre. 🚀 Le but ultime : les étoiles !</div>
    <h4>Sur téléphone</h4>
    <div>Joystick à gauche, glisser à droite pour la caméra, boutons d’action à droite, menus en bas à droite.</div></div>`;
}

export { CAT_NAMES };
