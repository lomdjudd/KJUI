// Écrans hors vol : menu principal, centre spatial, recherche, centre de
// suivi, missions, astres, défis, options.

import { h, icon, ICONS, toast, modal } from './dom.js';
import { TECHS, TECH_BY_ID } from '../progress/techtree.js';
import { PARTS } from '../parts/catalog.js';
import { MISSIONS } from '../progress/career.js';
import { CHALLENGES, MEDALS, bestMedals } from '../progress/challenges.js';
import { GameState, Settings, remove as removeKey } from '../progress/game.js';
import { fmtMoney, fmtInt, fmtDist, fmtClock, fmt1, fmtTime } from '../core/math.js';

function screen(id) {
  const old = document.getElementById(id);
  if (old) old.remove();
  const el = h('div', { class: 'screen active', id });
  document.getElementById('ui').appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
export class MenuScreen {
  constructor(app) {
    this.app = app;
  }

  enter() {
    const app = this.app;
    const el = screen('menu');
    const career = GameState.load('career');
    const sandbox = GameState.load('sandbox');
    const items = [];
    const item = (title, sub, fn) => items.push(h('button', { class: 'menu-item', onclick: () => { app.audio.unlock(); app.audio.click(); fn(); } }, h('b', {}, title), h('span', {}, sub)));
    if (career) item('Continuer la carrière', `${fmtMoney(career.funds)} · ${fmtInt(career.science)} science`, () => app.startMode('career'));
    item(career ? 'Nouvelle carrière' : 'Carrière', 'Recherche, missions, budget', () => {
      if (career) {
        modal({ title: 'Nouvelle carrière ?', body: '<p>Votre carrière actuelle sera effacée : fonds, recherches, missions et vaisseaux en service.</p>', actions: [{ label: 'Annuler' }, { label: 'Effacer et recommencer', kind: 'danger', onClick: () => { removeKey('save:career'); app.startMode('career', true); } }] });
      } else app.startMode('career', true);
    });
    item('Bac à sable', sandbox ? 'Toutes les pièces · reprendre' : 'Toutes les pièces, fonds illimités', () => app.startMode('sandbox'));
    item('Défis', `${Object.keys(bestMedals()).length} / ${CHALLENGES.length} médailles`, () => this.openChallenges());
    item('Encyclopédie', '24 astres à explorer', () => openBodies(app));
    item('Options', 'Graphismes, son, commandes', () => app.openSettings());
    el.appendChild(h('div', { class: 'menu-col' },
      h('h1', { class: 'menu-title' }, 'FORGE', h('em', {}, 'STELLAIRE')),
      h('p', { class: 'menu-tag' }, 'Assemblez vos lanceurs pièce par pièce, visez l\'orbite, posez-vous sur la Lune, Mars, Titan… et débloquez les technologies qui ouvrent les mondes les plus hostiles.'),
      h('div', { class: 'menu-list' }, ...items)));
    el.appendChild(h('div', { class: 'menu-foot' },
      h('div', {}, 'Textures de la Terre et de la Lune : NASA (via le projet three.js). Planètes générées procéduralement.'),
      h('button', { onclick: () => openCredits() }, 'Crédits et commandes')));
    this.el = el;
    app.showcase.start('orbit', 6 * 3600, null);
  }

  openChallenges() {
    const app = this.app;
    const medals = bestMedals();
    const list = h('div', { class: 'list' });
    for (const c of CHALLENGES) {
      const m = medals[c.id];
      list.appendChild(h('button', { class: 'lrow', onclick: () => { mm.close(); app.startChallenge(c); } },
        h('div', { class: 'grow' }, h('b', {}, c.name), h('small', {}, c.desc), h('div', { style: { fontSize: '11.5px', color: 'var(--cyan)', marginTop: '4px' } }, c.goal)),
        h('span', { class: 'tag', style: { color: m ? MEDALS[m].color : 'var(--dim)' } }, m ? `Médaille ${MEDALS[m].name}` : 'À tenter')));
    }
    const mm = modal({ title: 'Défis', body: list, wide: true, actions: [{ label: 'Fermer' }] });
  }

  update() {}
  render(dt) {
    this.app.showcase.render(dt);
  }
  exit() {
    if (this.el) this.el.remove();
    this.app.showcase.stop();
  }
}

// ---------------------------------------------------------------------------
export class HubScreen {
  constructor(app) {
    this.app = app;
  }

  enter() {
    const app = this.app;
    const g = app.game;
    const el = screen('hub');
    const chips = h('div', { class: 'hub-res' });
    if (g.mode === 'career') {
      chips.appendChild(h('span', { class: 'chip' }, h('i', { style: { background: 'var(--amber)' } }), fmtMoney(g.funds)));
      chips.appendChild(h('span', { class: 'chip' }, h('i', { style: { background: 'var(--violet)' } }), `${fmt1(g.science)} science`));
    }
    chips.appendChild(h('span', { class: 'chip' }, fmtClock(g.ut)));
    el.appendChild(h('div', { class: 'hub-top' },
      h('div', { class: 'hub-title' }, h('small', {}, g.mode === 'career' ? 'Carrière' : 'Bac à sable'), 'Centre spatial'),
      chips));
    const card = (ic, title, text, fn, badge) => h('button', { class: 'hub-card', onclick: () => { app.audio.click(); fn(); } },
      h('div', { class: 'ic', html: icon(ICONS[ic]) }), h('b', {}, title), h('span', {}, text), badge ? h('span', { class: 'badge' }, badge) : null);
    const cards = [];
    cards.push(card('wrench', 'Hall d\'assemblage', 'Concevez vos fusées : 127 pièces, symétrie, étages.', () => app.goBuilder()));
    if (g.lastCraft) cards.push(card('rocket', 'Pas de tir', `Lancer « ${g.lastCraft.name} ».`, () => app.launchCraft(g.lastCraft)));
    cards.push(card('radar', 'Centre de suivi', 'Reprenez le contrôle des vaisseaux en service.', () => this.openTracking(), g.vessels.length ? `${g.vessels.length} en service` : ''));
    if (g.mode === 'career') {
      const avail = TECHS.filter((t) => !g.techs.has(t.id) && t.req.every((r) => g.techs.has(r)) && t.cost <= g.science).length;
      cards.push(card('tree', 'Recherche', 'Arbre technologique : nouvelles pièces et accès aux mondes hostiles.', () => app.goTech(), avail ? `${avail} à rechercher` : ''));
      cards.push(card('list', 'Missions', 'Objectifs et récompenses de l\'agence.', () => openMissions(app), `${app.career.availableMissions().length} disponibles`));
    }
    cards.push(card('planet', 'Encyclopédie', 'Les astres, leurs dangers et les technologies requises.', () => openBodies(app)));
    cards.push(card('gear', 'Options', 'Graphismes, son, commandes.', () => app.openSettings()));
    cards.push(card('home', 'Menu principal', 'Quitter vers l\'écran titre.', () => app.goMenu()));
    el.appendChild(h('div', { class: 'hub-grid' }, ...cards));
    this.el = el;
    app.showcase.start('pad', g.ut, g.lastCraft);
  }

  openTracking() {
    const app = this.app;
    const g = app.game;
    const list = h('div', { class: 'list' });
    const fill = () => {
      list.innerHTML = '';
      if (!g.vessels.length) list.appendChild(h('p', {}, 'Aucun vaisseau en service. Les vaisseaux posés ou en orbite stable sont conservés ici quand vous quittez un vol.'));
      for (const vd of g.vessels) {
        const b = app.system.get(vd.body);
        const st = vd.landed ? `Posé sur ${b.name}` : `En orbite autour de ${b.name} · ${fmtDist(Math.hypot(vd.state.x, vd.state.y) - b.radius)}`;
        list.appendChild(h('div', { class: 'lrow' },
          h('div', { class: 'grow' }, h('b', {}, vd.name), h('small', {}, `${st} · ${vd.parts.length} pièces`)),
          h('button', { class: 'btn primary', onclick: () => { mm.close(); app.resumeVessel(vd); } }, 'Piloter'),
          h('button', { class: 'btn icon danger', title: 'Abandonner ce vaisseau', 'aria-label': 'Abandonner', html: icon(ICONS.trash), onclick: () => { g.vessels = g.vessels.filter((x) => x !== vd); g.save(); fill(); } })));
      }
    };
    fill();
    const mm = modal({ title: 'Centre de suivi', body: list, wide: true, actions: [{ label: 'Fermer' }] });
  }

  update() {}
  render(dt) {
    this.app.showcase.render(dt);
  }
  exit() {
    if (this.el) this.el.remove();
    this.app.showcase.stop();
  }
}

// ---------------------------------------------------------------------------
export class TechScreen {
  constructor(app) {
    this.app = app;
  }

  enter() {
    const app = this.app;
    const el = screen('tech');
    const wrap = h('div', { class: 'tech-wrap' });
    this.sciEl = h('span', { class: 'chip' });
    wrap.appendChild(h('div', { class: 'tech-head' },
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
        h('button', { class: 'btn', onclick: () => app.goHub(), html: icon(ICONS.back) + ' Centre spatial' }),
        h('div', { class: 'hub-title', style: { fontSize: '22px' } }, 'Recherche')),
      this.sciEl));
    this.scroll = h('div', { class: 'tech-scroll' });
    wrap.appendChild(this.scroll);
    this.detail = h('div', { class: 'tech-detail panel', hidden: true });
    wrap.appendChild(this.detail);
    el.appendChild(wrap);
    this.el = el;
    this.draw();
  }

  draw() {
    const g = this.app.game;
    this.sciEl.innerHTML = '';
    this.sciEl.appendChild(h('i', { style: { background: 'var(--violet)' } }));
    this.sciEl.appendChild(document.createTextNode(`${fmt1(g.science)} points de science`));
    const colW = 214, rowH = 104, pad = 30;
    const maxTier = Math.max(...TECHS.map((t) => t.tier));
    const maxRow = Math.max(...TECHS.map((t) => t.row));
    const W = pad * 2 + (maxTier + 1) * colW, H = pad * 2 + (maxRow + 1) * rowH;
    const canvas = h('div', { class: 'tech-canvas', style: { width: W + 'px', height: H + 'px' } });
    const pos = (t) => [pad + t.tier * colW, pad + t.row * rowH];
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    for (const t of TECHS) for (const r of t.req) {
      const a = TECH_BY_ID[r];
      const [x1, y1] = pos(a), [x2, y2] = pos(t);
      const owned = g.techs.has(r);
      svg += `<path d="M${x1 + 176} ${y1 + 32} C ${x1 + 196} ${y1 + 32}, ${x2 - 20} ${y2 + 32}, ${x2} ${y2 + 32}" fill="none" stroke="${owned ? 'rgba(83,227,161,0.55)' : 'rgba(140,176,232,0.25)'}" stroke-width="2"/>`;
    }
    svg += '</svg>';
    canvas.innerHTML = svg;
    for (const t of TECHS) {
      const owned = g.techs.has(t.id);
      const avail = !owned && t.req.every((r) => g.techs.has(r));
      const [x, y] = pos(t);
      const n = h('button', { class: `tnode ${owned ? 'owned' : avail ? 'avail' : 'locked'}${t.special ? ' special' : ''}`, style: { left: x + 'px', top: y + 'px' }, onclick: () => this.select(t) },
        h('b', {}, t.name), h('small', {}, owned ? 'Acquise' : `${t.cost} science`));
      canvas.appendChild(n);
    }
    this.scroll.innerHTML = '';
    this.scroll.appendChild(canvas);
  }

  select(t) {
    const g = this.app.game;
    const owned = g.techs.has(t.id);
    const avail = !owned && t.req.every((r) => g.techs.has(r));
    const parts = PARTS.filter((p) => p.tech === t.id);
    const d = this.detail;
    d.hidden = false;
    d.innerHTML = '';
    d.appendChild(h('div', { class: 'label' }, t.special ? 'Technologie d\'accès' : 'Technologie'));
    d.appendChild(h('h2', { style: { margin: '4px 0', fontFamily: 'var(--f-display)', letterSpacing: '0.06em' } }, t.name));
    d.appendChild(h('p', { style: { color: '#b8c3d8', lineHeight: 1.5, margin: '6px 0' } }, t.desc));
    if (parts.length) d.appendChild(h('div', { class: 'kv', style: { margin: '8px 0' } }, h('span', {}, 'Débloque : ', h('b', {}, parts.map((p) => p.name).join(', ')))));
    if (t.req.length) d.appendChild(h('div', { class: 'kv' }, h('span', {}, 'Prérequis : ', h('b', {}, t.req.map((r) => TECH_BY_ID[r].name).join(', ')))));
    const row = h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } });
    if (owned) row.appendChild(h('span', { class: 'green' }, 'Déjà recherchée'));
    else {
      const b = h('button', { class: 'btn primary', disabled: !avail || g.science < t.cost, onclick: () => this.research(t) }, `Rechercher (${t.cost} science)`);
      row.appendChild(b);
      if (!avail) row.appendChild(h('span', { class: 'warn' }, 'Prérequis manquants'));
      else if (g.science < t.cost) row.appendChild(h('span', { class: 'warn' }, 'Science insuffisante'));
    }
    row.appendChild(h('button', { class: 'btn ghost', onclick: () => { d.hidden = true; } }, 'Fermer'));
    d.appendChild(row);
  }

  research(t) {
    const g = this.app.game;
    if (g.science < t.cost) return;
    g.science -= t.cost;
    g.techs.add(t.id);
    g.save();
    this.app.audio.success();
    toast('Recherche terminée', t.name, 'good');
    this.draw();
    this.select(t);
  }

  update() {}
  render(dt) {
    this.app.showcase.render(dt);
  }
  exit() {
    if (this.el) this.el.remove();
  }
}

// ---------------------------------------------------------------------------
export function openMissions(app) {
  const g = app.game;
  const body = h('div');
  const tabs = h('div', { class: 'tabs' });
  const list = h('div', { class: 'list' });
  const show = (which) => {
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.t === which));
    list.innerHTML = '';
    const ms = which === 'done' ? MISSIONS.filter((m) => g.milestones[m.id]) : app.career.availableMissions();
    if (!ms.length) list.appendChild(h('p', {}, which === 'done' ? 'Aucune mission accomplie pour l\'instant.' : 'Toutes les missions disponibles sont accomplies !'));
    for (const m of ms) list.appendChild(h('div', { class: 'lrow' },
      h('div', { class: 'grow' }, h('b', {}, m.name), h('small', {}, m.desc)),
      h('span', { class: 'tag' }, `${fmtMoney(m.funds)} · ${m.sci} sci.`)));
  };
  tabs.appendChild(h('button', { 'data-t': 'open', onclick: () => show('open') }, 'Disponibles'));
  tabs.appendChild(h('button', { 'data-t': 'done', onclick: () => show('done') }, 'Accomplies'));
  body.appendChild(h('p', {}, 'Les missions se valident automatiquement pendant vos vols. De nouvelles missions apparaissent au fil de vos succès.'));
  body.appendChild(tabs);
  body.appendChild(list);
  show('open');
  modal({ title: 'Missions de l\'agence', body, wide: true, actions: [{ label: 'Fermer' }] });
}

export function openBodies(app) {
  const g = app.game;
  const sys = app.system;
  const hazard = (b) => {
    const t = [];
    if (b.hazards.pressure) t.push('Pression écrasante');
    if (b.hazards.radiation || b.hazards.radiationLocal) t.push('Radiations');
    if (b.hazards.cryo) t.push('Froid extrême');
    if (b.hazards.solarHeat) t.push('Rayonnement solaire');
    if (b.hazards.gas) t.push('Pas de surface');
    if (b.hazards.star) t.push('Chaleur mortelle');
    return t.join(' · ') || 'Aucun danger particulier';
  };
  const list = h('div', { class: 'list' });
  for (const b of sys.bodies) {
    if (b.hidden && !g.hasTech(b.hidden)) {
      list.appendChild(h('div', { class: 'lrow' }, h('div', { class: 'grow' }, h('b', {}, '???'), h('small', {}, 'Un astre inconnu. Recherchez le télescope spatial profond.'))));
      continue;
    }
    const facts = [`Rayon ${fmtDist(b.radius)}`, `Gravité ${b.g.toFixed(2)} m/s²`];
    if (b.atmosphere) facts.push(`Atmosphère ${b.atmosphere.p0} atm`);
    if (b.orbit) facts.push(`Orbite ${fmtDist(b.orbit.a)}`);
    if (b.orbit) facts.push(`Période ${fmtTime(b.orbit.period)}`);
    const tech = b.tech ? TECH_BY_ID[b.tech] : null;
    list.appendChild(h('div', { class: 'lrow' },
      h('span', { style: { width: '14px', height: '14px', borderRadius: '50%', background: b.color, flex: 'none', boxShadow: `0 0 12px ${b.color}` } }),
      h('div', { class: 'grow' }, h('b', {}, b.name), h('small', {}, b.desc), h('div', { style: { fontSize: '11.5px', color: 'var(--muted)', marginTop: '4px' } }, facts.join(' · ')),
        h('div', { style: { fontSize: '11.5px', color: b.tech ? 'var(--violet)' : 'var(--green)', marginTop: '2px' } }, hazard(b) + (tech ? ` — requiert « ${tech.name} »` : ''))),
      h('span', { class: 'tag' }, g.stats.bodies.includes(b.id) ? 'Visité' : '')));
  }
  modal({ title: 'Encyclopédie des astres', body: list, wide: true, actions: [{ label: 'Fermer' }] });
}

export function openCredits() {
  modal({
    title: 'Forge Stellaire',
    body: `<p>Un jeu de construction et de pilotage de fusées dans un système solaire complet, en 2D et en 3D.</p>
<p><b>Commandes au clavier</b> — Q/D ou ←/→ : tourner · Maj / Ctrl : gaz · Z : plein gaz · X : couper · Espace : étage suivant · T : stabilisation · R : RCS (I/J/K/L : translation) · G : train · Y : phares · B : aérofreins · U : panneaux · K : science · O : pilote automatique · M : carte · V : 2D/3D · C : caméra · , et . : accélération du temps · Échap : pause.</p>
<p><b>Atelier</b> — Glissez les pièces depuis la palette · X : symétrie · F : retourner · Suppr : supprimer · Ctrl+Z / Ctrl+Y.</p>
<p><b>Manette</b> — stick gauche : tourner · gâchettes : gaz · A : étage · B : SAS · X : carte · Y : vue · bumpers : temps · Start : pause.</p>
<p><b>Crédits</b> — Moteur 3D three.js. Textures de la Terre et de la Lune issues des cartes de la NASA (Blue Marble, LRO) distribuées avec les exemples three.js. Tout le reste (planètes, pièces, sons, musique) est généré par le code.</p>`,
    actions: [{ label: 'Fermer' }],
  });
}

export function openSettings(app, onClose) {
  const s = Settings.get();
  const body = h('div');
  const row = (label, ctl) => body.appendChild(h('div', { class: 'form-row' }, h('label', {}, label), ctl));
  const sel = (key, opts, onChange) => {
    const e = h('select', { 'aria-label': key }, ...opts.map(([v, n]) => h('option', { value: v, selected: s[key] === v }, n)));
    e.addEventListener('change', () => { Settings.set(key, e.value); if (onChange) onChange(e.value); });
    return e;
  };
  const range = (key, onChange) => {
    const e = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], 'aria-label': key });
    e.addEventListener('input', () => { Settings.set(key, Number(e.value)); if (onChange) onChange(Number(e.value)); });
    return e;
  };
  const chk = (key) => {
    const e = h('input', { type: 'checkbox', checked: !!s[key], 'aria-label': key });
    e.addEventListener('change', () => Settings.set(key, e.checked));
    return e;
  };
  row('Qualité graphique', sel('quality', [['low', 'Basse (téléphones)'], ['medium', 'Moyenne'], ['high', 'Haute']], (v) => { app.R.setQuality(v); toast('Qualité', 'Certains réglages s\'appliqueront au prochain chargement.', '', 3000); }));
  row('Vue par défaut', sel('view', [['3d', '3D'], ['2d', '2D']]));
  row('Musique', range('music', (v) => app.audio.setVolumes(v, Settings.get().sfx)));
  row('Effets sonores', range('sfx', (v) => app.audio.setVolumes(Settings.get().music, v)));
  row('Inverser la rotation', chk('invert'));
  row('Afficher les astuces', chk('hints'));
  modal({ title: 'Options', body, actions: [{ label: 'Fermer', kind: 'primary' }], onClose });
}
