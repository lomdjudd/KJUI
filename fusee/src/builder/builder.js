// Atelier d'assemblage : placement des pièces, symétrie, étages, statistiques.

import * as THREE from 'three';
import { Craft, placePart, stageStats } from '../craft/craft.js';
import { CraftView } from '../craft/craftview.js';
import { PARTS, PART_BY_ID, CATEGORIES, PROPELLANTS, partRadiusAt } from '../parts/catalog.js';
import { PAINTS } from '../parts/materials.js';
import { buildHangar, buildBlueprint } from './hangar.js';
import { thumb } from './thumbs.js';
import { h, $, icon, ICONS, toast, modal } from '../ui/dom.js';
import { fmtMass, fmtMoney, fmtInt, fmt1, fmt2, fmtForce } from '../core/math.js';
import { TECH_BY_ID } from '../progress/techtree.js';
import { Library, Settings } from '../progress/game.js';
import { TEMPLATES } from './templates.js';

const TAU = Math.PI * 2;
const tmpV = new THREE.Vector3();

export class Builder {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0f16');
    const hangar = buildHangar(app.R.renderer);
    this.hangar = hangar.group;
    this.envMap = hangar.env;
    this.hangarKey = hangar.key;
    this.blueprint = buildBlueprint().group;
    this.scene.add(this.hangar);
    this.scene.add(this.blueprint);
    this.view = new CraftView();
    this.craftRoot = new THREE.Group();
    this.craftRoot.add(this.view.group);
    this.scene.add(this.craftRoot);
    this.ghostRoot = new THREE.Group();
    this.scene.add(this.ghostRoot);
    this.markers = new THREE.Group();
    this.scene.add(this.markers);
    this.selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#ffb23e', transparent: true, opacity: 0.9, depthTest: false }));
    this.selBox.renderOrder = 10;
    this.selBox.visible = false;
    this.scene.add(this.selBox);

    this.cam3 = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    this.cam2 = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 500);
    this.orbit = { yaw: -Math.PI / 2 - 0.5, pitch: 0.18, dist: 22, ty: 4, tx: 0 };
    this.ortho = { cx: 0, cy: 4, size: 12 };
    this.mode2d = Settings.get().view === '2d';

    this.craft = new Craft('Fusée 1');
    this.history = [];
    this.future = [];
    this.held = null; // { parts: [...], rootUid }
    this.ghostViews = [];
    this.selected = null;
    this.symmetry = 2;
    this.category = 'command';
    this.envBody = 'terre';
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-9, -9);
    this.pointerPx = { x: 0, y: 0 };
    this.cand = null;
    this.dom = null;
    this.bindInput();
  }

  // ------------------------------------------------------------------------
  get camera() {
    return this.mode2d ? this.cam2 : this.cam3;
  }

  enter(craftJSON) {
    if (craftJSON) this.craft = Craft.fromJSON(craftJSON);
    else if (!this.craft.parts.length && this.app.game.lastCraft) this.craft = Craft.fromJSON(this.app.game.lastCraft);
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.55;
    this.buildUI();
    this.refresh(true);
    this.frameCraft();
    this.active = true;
    this.app.audio.ambience('hangar');
  }

  exit() {
    this.active = false;
    this.dropHeld();
    if (this.dom) this.dom.remove();
    this.dom = null;
    this.app.game.lastCraft = this.craft.toJSON();
  }

  // ------------------------------------------------------------------------
  // Interface
  buildUI() {
    if (this.dom) this.dom.remove();
    const g = this.app.game;
    const root = h('div', { class: 'screen active', id: 'builder' });
    // Barre supérieure
    const nameInput = h('input', { class: 'craft-name pe', id: 'craft-name', value: this.craft.name, maxlength: 32, 'aria-label': 'Nom de la fusée' });
    nameInput.addEventListener('input', () => { this.craft.name = nameInput.value || 'Sans nom'; });
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    const btn = (ic, title, fn, cls = '') => h('button', { class: 'btn icon ' + cls, title, 'aria-label': title, onclick: fn, html: icon(ICONS[ic]) });
    this.symBtn = h('button', { class: 'btn', title: 'Symétrie (X)', onclick: () => this.cycleSym() });
    this.viewSeg = h('div', { class: 'seg' },
      h('button', { class: this.mode2d ? '' : 'on', onclick: () => this.setMode2d(false) }, '3D'),
      h('button', { class: this.mode2d ? 'on' : '', onclick: () => this.setMode2d(true) }, '2D'));
    this.costEl = h('div', { class: 'chip' });
    const top = h('div', { class: 'b-top' },
      btn('back', 'Retour au centre spatial', () => this.app.goHub()),
      nameInput,
      btn('undo', 'Annuler (Ctrl+Z)', () => this.undo()),
      btn('redo', 'Rétablir (Ctrl+Y)', () => this.redo()),
      btn('plus', 'Nouvelle fusée', () => this.newCraft()),
      btn('folder', 'Charger une fusée', () => this.openLibrary()),
      btn('save', 'Enregistrer', () => this.saveCraft()),
      h('div', { class: 'grow' }),
      this.symBtn,
      this.viewSeg,
      this.costEl,
      h('button', { class: 'btn primary', id: 'launch-btn', onclick: () => this.launch(), html: icon(ICONS.rocket) + ' Lancer' }),
    );
    root.appendChild(top);

    // Palette
    const cats = h('div', { class: 'b-cats' });
    for (const c of CATEGORIES) {
      cats.appendChild(h('button', { class: 'b-cat' + (c.id === this.category ? ' on' : ''), title: c.name, 'aria-label': c.name, 'data-cat': c.id, html: icon(c.icon), onclick: () => { this.category = c.id; this.fillPalette(); } }));
    }
    this.listEl = h('div', { class: 'b-list' });
    root.appendChild(h('div', { class: 'b-palette panel' }, cats, this.listEl));

    // Inspecteur
    this.statsEl = h('div', { class: 'insp-sec' });
    this.warnEl = h('div', { class: 'insp-sec warnings insp-extra' });
    this.stagesEl = h('div', { class: 'stages' });
    const insp = h('div', { class: 'b-insp panel' }, this.statsEl, this.warnEl,
      h('div', { class: 'insp-sec insp-extra', style: { paddingBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('span', { class: 'label' }, 'Séquence des étages'),
        h('button', { class: 'btn ghost', style: { minHeight: '26px', fontSize: '11px' }, onclick: () => this.resetStaging() }, 'Auto')),
      this.stagesEl);
    insp.addEventListener('click', (e) => { if (e.target === insp && window.innerWidth < 820) insp.classList.toggle('collapsed'); });
    root.appendChild(insp);

    this.infoEl = h('div', { class: 'part-info panel', hidden: true });
    root.appendChild(this.infoEl);
    this.hintEl = h('div', { class: 'hint panel', hidden: true });
    root.appendChild(this.hintEl);

    document.getElementById('ui').appendChild(root);
    this.dom = root;
    this.updateSymBtn();
    this.fillPalette();
    if (g.mode === 'career') this.costEl.title = 'Coût / fonds disponibles';
  }

  fillPalette() {
    const g = this.app.game;
    for (const b of this.dom.querySelectorAll('.b-cat')) b.classList.toggle('on', b.dataset.cat === this.category);
    const cat = CATEGORIES.find((c) => c.id === this.category);
    const list = PARTS.filter((p) => p.cat === this.category);
    list.sort((a, b) => (g.unlocked(b.id) - g.unlocked(a.id)) || a.d - b.d || a.cost - b.cost);
    this.listEl.innerHTML = '';
    this.listEl.appendChild(h('h3', {}, cat.name));
    const grid = h('div', { class: 'b-grid' });
    for (const p of list) {
      const locked = !g.unlocked(p.id);
      const img = h('img', { alt: '', draggable: 'false' });
      thumb(p.id, (url) => { img.src = url; });
      const card = h('button', { class: 'pcard' + (locked ? ' locked' : ''), title: locked ? `Technologie requise : ${TECH_BY_ID[p.tech]?.name}` : p.desc, 'data-part': p.id },
        img, h('b', {}, p.name), h('small', {}, this.cardStat(p)));
      card.addEventListener('pointerdown', (e) => {
        if (locked) { toast('Pièce verrouillée', `Recherchez « ${TECH_BY_ID[p.tech]?.name} » dans l'arbre technologique.`, 'warn'); return; }
        e.preventDefault();
        this.pickFromPalette(p.id, e);
      });
      card.addEventListener('mouseenter', () => { if (!this.held) this.showPartInfo(p, null); });
      grid.appendChild(card);
    }
    this.listEl.appendChild(grid);
  }

  cardStat(p) {
    if (p.command) return p.command.crew ? `${p.command.crew} place${p.command.crew > 1 ? 's' : ''} · ${fmtMass(p.mass)}` : `Sonde · ${fmtMass(p.mass)}`;
    if (p.engine) return `${fmtForce(p.engine.thrust)} · ${p.engine.ispVac}s`;
    if (p.res) {
      const k = Object.keys(p.res).find((r) => r !== 'ec') || 'ec';
      if (k === 'ec') return `${p.res.ec} kWh`;
      return `${fmtMass(p.res[k])} ${PROPELLANTS[k].short}`;
    }
    return `${fmtMass(p.mass)} · ${fmtMoney(p.cost)}`;
  }

  showPartInfo(def, part) {
    const el = this.infoEl;
    if (!def) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '';
    const kv = [];
    kv.push(['Masse', fmtMass(def.mass)], ['Coût', fmtMoney(def.cost)], ['Ø', def.d + ' m'], ['Temp. max', fmtInt(def.maxTemp) + ' K'], ['Impact max', def.crash + ' m/s']);
    if (def.engine) {
      const e = def.engine;
      kv.push(['Poussée vide', fmtForce(e.thrust)], ['Poussée sol', fmtForce((e.thrust * e.ispSL) / e.ispVac)], ['Isp', `${e.ispSL} / ${e.ispVac} s`], ['Ergol', PROPELLANTS[e.prop].name]);
      if (e.gimbal) kv.push(['Orientation', '±' + e.gimbal + '°']);
    }
    if (def.res) for (const k in def.res) kv.push([PROPELLANTS[k].name, k === 'ec' ? def.res[k] + ' kWh' : fmtMass(def.res[k])]);
    if (def.command) kv.push(['Équipage', def.command.crew || 'Sonde'], ['Couple', fmt1(def.command.torque / 1000) + ' kN·m']);
    if (def.chute) kv.push(['Vitesse max d\'ouverture', def.chute.maxSpeed + ' m/s']);
    const kvEl = h('div', { class: 'kv' }, ...kv.map(([k, v]) => h('span', {}, k + ' ', h('b', {}, String(v)))));
    el.appendChild(h('h4', {}, def.name));
    el.appendChild(h('p', {}, def.desc));
    el.appendChild(kvEl);
    if (part) {
      const row = h('div', { class: 'row' });
      const paints = h('div', { class: 'paints' });
      for (const p of PAINTS) {
        paints.appendChild(h('button', { class: 'paint' + ((part.paint || null) === p.id ? ' on' : ''), title: p.name, 'aria-label': 'Peinture ' + p.name, style: { background: p.id ? p.color : 'conic-gradient(#f1f1ec 0 25%, #1c1e21 0 50%, #cd6a2d 0 75%, #c9cdd1 0)' }, onclick: () => this.paintPart(part, p.id) }));
      }
      row.appendChild(paints);
      row.appendChild(h('div', { style: { flex: 1 } }));
      if (!def.radial) row.appendChild(h('button', { class: 'btn', onclick: () => this.flipPart(part), html: icon(ICONS.flip) + ' Retourner' }));
      row.appendChild(h('button', { class: 'btn danger', onclick: () => this.deletePart(part), html: icon(ICONS.trash) + ' Supprimer' }));
      el.appendChild(row);
    }
  }

  setHint(text) {
    if (!this.hintEl) return;
    this.hintEl.textContent = text;
    this.hintEl.hidden = !text || !Settings.get().hints;
  }

  updateSymBtn() {
    this.symBtn.innerHTML = icon(ICONS.sym) + ` ×${this.symmetry}`;
  }

  cycleSym() {
    const seq = [1, 2, 3, 4, 6, 8];
    this.symmetry = seq[(seq.indexOf(this.symmetry) + 1) % seq.length];
    this.updateSymBtn();
    this.app.audio.click();
    if (this.held) this.updateGhost();
  }

  setMode2d(v) {
    this.mode2d = v;
    Settings.set('view', v ? '2d' : '3d');
    const b = this.viewSeg.children;
    b[0].classList.toggle('on', !v);
    b[1].classList.toggle('on', v);
    this.frameCraft();
  }

  // ------------------------------------------------------------------------
  // Historique
  snapshot() {
    this.history.push(JSON.stringify(this.craft.toJSON()));
    if (this.history.length > 80) this.history.shift();
    this.future.length = 0;
  }
  undo() {
    if (!this.history.length) return;
    this.future.push(JSON.stringify(this.craft.toJSON()));
    this.craft = Craft.fromJSON(JSON.parse(this.history.pop()));
    this.selected = null;
    this.refresh(true);
  }
  redo() {
    if (!this.future.length) return;
    this.history.push(JSON.stringify(this.craft.toJSON()));
    this.craft = Craft.fromJSON(JSON.parse(this.future.pop()));
    this.selected = null;
    this.refresh(true);
  }

  newCraft() {
    if (this.craft.parts.length) this.snapshot();
    this.craft = new Craft('Nouvelle fusée');
    this.selected = null;
    this.buildUI();
    this.refresh(true);
  }

  saveCraft() {
    Library.save(this.craft.toJSON());
    toast('Fusée enregistrée', `« ${this.craft.name} » est dans votre bibliothèque.`, 'good');
  }

  openLibrary() {
    const all = Library.all();
    const g = this.app.game;
    const body = h('div');
    const tabs = h('div', { class: 'tabs' });
    const list = h('div', { class: 'list' });
    const show = (which) => {
      list.innerHTML = '';
      [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.t === which));
      if (which === 'models') {
        for (const t of TEMPLATES) {
          const c = t.build();
          const locked = c.parts.some((p) => !g.unlocked(p.id));
          list.appendChild(h('button', { class: 'lrow', onclick: () => { if (locked) { toast('Modèle verrouillé', 'Certaines pièces ne sont pas encore recherchées.', 'warn'); return; } m.close(); this.loadCraft(c.toJSON()); } },
            h('div', { class: 'grow' }, h('b', {}, t.name), h('small', {}, t.desc)),
            h('span', { class: 'tag' }, locked ? 'Verrouillé' : `${c.parts.length} pièces`)));
        }
      } else {
        const names = Object.keys(all).sort((a, b) => (all[b].saved || 0) - (all[a].saved || 0));
        if (!names.length) list.appendChild(h('p', {}, 'Aucune fusée enregistrée. Utilisez le bouton Enregistrer de l\'atelier.'));
        for (const n of names) {
          const cj = all[n];
          const row = h('div', { class: 'lrow' },
            h('div', { class: 'grow' }, h('b', {}, n), h('small', {}, `${cj.parts.length} pièces · ${new Date(cj.saved || Date.now()).toLocaleDateString('fr-FR')}`)),
            h('button', { class: 'btn', onclick: () => { m.close(); this.loadCraft(cj); } }, 'Charger'),
            h('button', { class: 'btn icon danger', title: 'Supprimer', 'aria-label': 'Supprimer', html: icon(ICONS.trash), onclick: () => { Library.remove(n); delete all[n]; show('saved'); } }));
          list.appendChild(row);
        }
      }
    };
    tabs.appendChild(h('button', { 'data-t': 'models', onclick: () => show('models') }, 'Modèles prêts à voler'));
    tabs.appendChild(h('button', { 'data-t': 'saved', onclick: () => show('saved') }, 'Mes fusées'));
    body.appendChild(tabs);
    body.appendChild(list);
    const m = modal({ title: 'Bibliothèque de fusées', body, actions: [{ label: 'Fermer' }], wide: true });
    show(Object.keys(all).length ? 'saved' : 'models');
  }

  loadCraft(json) {
    if (this.craft.parts.length) this.snapshot();
    this.craft = Craft.fromJSON(json);
    this.selected = null;
    this.buildUI();
    this.refresh(true);
    this.frameCraft();
  }

  // ------------------------------------------------------------------------
  // Mise à jour de la vue et des statistiques
  refresh(full = false) {
    this.craft.layout();
    // la fusée repose sur la plateforme (bas à y = 0)
    this.view.sync(this.craft.parts, { deployAll: 0, ghostFairing: true });
    const b = this.craft.bounds;
    this.craftRoot.position.y = this.craft.parts.length ? -b.minY : 0;
    this.updateSelBox();
    this.updateStats();
    if (full) this.updateMarkers();
    this.app.game.lastCraft = this.craft.toJSON();
  }

  updateStats() {
    const c = this.craft;
    const g = this.app.game;
    const body = this.app.system.get(this.envBody);
    const p = this.envBody === 'vide' ? 0 : body.atmosphere ? body.atmosphere.p0 : 0;
    const gg = this.envBody === 'vide' ? 9.81 : body.g;
    const st = c.parts.length ? stageStats(c, p, gg) : [];
    const stVac = c.parts.length ? stageStats(c, 0, gg) : [];
    const dv = st.reduce((s, x) => s + x.dv, 0);
    const dvVac = stVac.reduce((s, x) => s + x.dv, 0);
    const cost = c.cost();
    const mass = c.mass();
    const height = c.parts.length ? c.bounds.maxY - c.bounds.minY : 0;
    const firstTWR = st.find((s) => s.thrust > 0)?.twr ?? 0;
    this.lastStats = st;
    const opts = [['vide', 'Vide spatial'], ...this.app.system.bodies.filter((b) => b.hasSurface && (!b.hidden || g.hasTech(b.hidden))).map((b) => [b.id, b.name + (b.atmosphere ? ' (sol)' : '')])];
    const sel = h('select', { 'aria-label': 'Environnement de calcul' }, ...opts.map(([v, n]) => h('option', { value: v, selected: v === this.envBody }, n)));
    sel.addEventListener('change', () => { this.envBody = sel.value; this.updateStats(); });
    this.statsEl.innerHTML = '';
    this.statsEl.appendChild(h('div', { class: 'label' }, 'Performances'));
    this.statsEl.appendChild(h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' }, h('b', { class: 'amber' }, fmtInt(dv) + ' m/s'), h('span', {}, 'Δv total')),
      h('div', { class: 'stat' }, h('b', { class: firstTWR >= 1.15 ? 'green' : firstTWR >= 1 ? 'amber' : 'red' }, fmt2(firstTWR)), h('span', {}, 'Poussée / poids')),
      h('div', { class: 'stat' }, h('b', {}, fmtMass(mass)), h('span', {}, 'Masse')),
      h('div', { class: 'stat' }, h('b', {}, fmt1(height) + ' m'), h('span', {}, 'Hauteur')),
      h('div', { class: 'stat' }, h('b', {}, fmtInt(dvVac) + ' m/s'), h('span', {}, 'Δv dans le vide')),
      h('div', { class: 'stat' }, h('b', {}, String(c.parts.length)), h('span', {}, 'Pièces')),
    ));
    this.statsEl.appendChild(h('div', { class: 'env-row' }, h('span', { class: 'label' }, 'Calcul'), sel));
    this.costEl.innerHTML = g.mode === 'career' ? `<span class="${g.funds >= cost ? '' : 'red'}">${fmtMoney(cost)}</span>&nbsp;/&nbsp;${fmtMoney(g.funds)}` : fmtMoney(cost);

    // Avertissements
    const warns = [];
    const ctrl = c.controlPart();
    if (c.parts.length) {
      if (!ctrl) warns.push(['bad', 'Aucune capsule ni sonde : la fusée ne sera pas pilotable.']);
      if (!c.parts.some((p) => PART_BY_ID[p.id].engine)) warns.push(['bad', 'Aucun moteur.']);
      else if (firstTWR > 0 && firstTWR < 1 && this.envBody !== 'vide') warns.push(['bad', `Poussée insuffisante pour décoller (${fmt2(firstTWR)} < 1).`]);
      if (ctrl && PART_BY_ID[ctrl.id].command.crew > 0 && !c.parts.some((p) => PART_BY_ID[p.id].chute)) warns.push(['', 'Équipage sans parachute : prévoyez le retour.']);
      if (g.mode === 'career' && cost > g.funds) warns.push(['bad', 'Fonds insuffisants pour ce lancement.']);
      if (ctrl && PART_BY_ID[ctrl.id].command.probe && !c.parts.some((p) => PART_BY_ID[p.id].res?.ec)) warns.push(['', 'Sonde sans batterie.']);
      const unshielded = c.parts.some((p) => PART_BY_ID[p.id].command?.crew) && !c.parts.some((p) => PART_BY_ID[p.id].heatShield);
      if (unshielded && dvVac > 5500) warns.push(['', 'Capsule sans bouclier thermique : dangereux au retour de la Lune ou de Mars.']);
    } else {
      warns.push(['', 'Choisissez une capsule ou une sonde dans la palette pour commencer.']);
    }
    this.warnEl.innerHTML = '';
    this.warnEl.hidden = !warns.length;
    for (const [k, t] of warns) this.warnEl.appendChild(h('div', { class: 'warn ' + k }, t));
    this.renderStages(st);
    const lb = $('#launch-btn', this.dom);
    if (lb) lb.disabled = !ctrl;
  }

  renderStages(st) {
    const c = this.craft;
    const stages = c.computeStages();
    this.stagesEl.innerHTML = '';
    const color = (d) => (d.engine ? (d.engine.solid ? '#e8e2d0' : '#ff8a3d') : d.decoupler ? '#ffd24a' : d.chute ? '#5cd6ff' : d.fairing ? '#b690ff' : '#aaa');
    stages.forEach((s, i) => {
      const info = st[i];
      const items = h('div', { class: 'stage-items' });
      const groups = new Map();
      for (const uid of s) {
        const p = c.byUid(uid);
        if (!p) continue;
        const key = p.id + ':' + (p.sym || uid);
        if (!groups.has(key)) groups.set(key, { p, n: 0 });
        groups.get(key).n++;
      }
      for (const { p, n } of groups.values()) {
        const d = PART_BY_ID[p.id];
        const moveTo = (delta) => {
          this.snapshot();
          const tgt = Math.max(0, i + delta);
          for (const q of c.symGroup(p)) q.stage = tgt;
          this.refresh();
        };
        items.appendChild(h('span', { class: 'sitem', title: d.name },
          h('i', { style: { background: color(d) } }), (n > 1 ? n + '× ' : '') + d.name,
          h('button', { title: 'Étage précédent', 'aria-label': 'Étage précédent', onclick: () => moveTo(-1) }, '▲'),
          h('button', { title: 'Étage suivant', 'aria-label': 'Étage suivant', onclick: () => moveTo(1) }, '▼')));
      }
      this.stagesEl.appendChild(h('div', { class: 'stage' },
        h('div', { class: 'stage-h' }, h('b', {}, `Étage ${i + 1}`), h('span', {}, info && info.dv > 1 ? `${fmtInt(info.dv)} m/s · PP ${fmt2(info.twr)}` : '')),
        items));
    });
    if (!stages.length) this.stagesEl.appendChild(h('div', { class: 'warn' }, 'Les étages apparaîtront ici.'));
  }

  resetStaging() {
    this.snapshot();
    for (const p of this.craft.parts) p.stage = null;
    this.refresh();
  }

  // ------------------------------------------------------------------------
  // Caméra
  frameCraft() {
    const b = this.craft.bounds;
    const hgt = this.craft.parts.length ? b.maxY - b.minY : 6;
    this.lastFrameH = hgt;
    const wid = this.craft.parts.length ? Math.max(b.maxX - b.minX, b.maxZ - b.minZ) : 4;
    this.orbit.ty = hgt / 2;
    this.orbit.tx = 0;
    this.orbit.dist = Math.max(10, Math.max(hgt * 1.65, wid * 2.2) + 6);
    this.ortho.cx = 0;
    this.ortho.cy = hgt / 2;
    this.ortho.size = Math.max(6, hgt * 0.62 + 2);
  }

  updateCamera() {
    const R = this.app.R;
    const aspect = R.width / R.height;
    // décalage latéral : l'espace libre entre les panneaux
    const narrow = R.width < 820;
    const shift = narrow ? 0 : ((318 - 300) / 2 / R.width) * 2;
    if (this.mode2d) {
      const o = this.ortho;
      const c = this.cam2;
      const sy = narrow ? o.size * 1.4 : o.size;
      c.left = -sy * aspect;
      c.right = sy * aspect;
      c.top = sy;
      c.bottom = -sy;
      c.position.set(o.cx - shift * sy * aspect, o.cy - (narrow ? sy * 0.35 : 0), -100);
      c.up.set(0, 1, 0);
      c.lookAt(c.position.x, c.position.y, 0);
      c.near = 1;
      c.far = 400;
      c.updateProjectionMatrix();
      this.hangar.visible = false;
      this.blueprint.visible = true;
      this.scene.background.set('#123a73');
    } else {
      const o = this.orbit;
      const c = this.cam3;
      c.aspect = aspect;
      const tgt = new THREE.Vector3(o.tx, o.ty, 0);
      c.position.set(tgt.x + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist, tgt.y + Math.sin(o.pitch) * o.dist, Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist);
      if (narrow) tgt.y -= o.dist * 0.18;
      c.lookAt(tgt);
      c.near = 0.1;
      c.far = 2000;
      c.updateProjectionMatrix();
      this.hangar.visible = true;
      this.blueprint.visible = false;
      this.scene.background.set('#0b0f16');
    }
  }

  // ------------------------------------------------------------------------
  // Entrées souris / tactile
  bindInput() {
    const cv = this.app.R.canvas;
    this.ptrs = new Map();
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    cv.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      const k = Math.exp(e.deltaY * 0.0012);
      if (this.mode2d) this.ortho.size = Math.min(120, Math.max(2, this.ortho.size * k));
      else this.orbit.dist = Math.min(400, Math.max(3, this.orbit.dist * k));
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  setPointer(e) {
    const r = this.app.R.canvas.getBoundingClientRect();
    this.pointerPx = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.pointer.set((this.pointerPx.x / r.width) * 2 - 1, -(this.pointerPx.y / r.height) * 2 + 1);
  }

  onDown(e) {
    if (!this.active) return;
    this.app.audio.unlock();
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, button: e.button });
    this.setPointer(e);
    if (this.ptrs.size === 2) { this.pinch = this.pinchState(); this.downPart = null; return; }
    this.downAt = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
    this.dragMode = null;
    if (this.held) return;
    const hit = e.button === 0 ? this.pickPart() : null;
    this.downPart = hit;
  }

  pinchState() {
    const [a, b] = [...this.ptrs.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  onMove(e) {
    if (!this.active) return;
    const pt = this.ptrs.get(e.pointerId);
    this.setPointer(e);
    if (pt) {
      const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
      pt.x = e.clientX; pt.y = e.clientY;
      if (this.ptrs.size === 2 && this.pinch) {
        const s = this.pinchState();
        const k = this.pinch.d / Math.max(10, s.d);
        if (this.mode2d) {
          this.ortho.size = Math.min(120, Math.max(2, this.ortho.size * k));
          this.ortho.cx += ((s.cx - this.pinch.cx) / this.app.R.height) * this.ortho.size * 2;
          this.ortho.cy += ((s.cy - this.pinch.cy) / this.app.R.height) * this.ortho.size * 2;
        } else {
          this.orbit.dist = Math.min(400, Math.max(3, this.orbit.dist * k));
          this.orbit.ty += ((s.cy - this.pinch.cy) / this.app.R.height) * this.orbit.dist * 0.8;
        }
        this.pinch = s;
        return;
      }
      const moved = Math.hypot(e.clientX - pt.x0, e.clientY - pt.y0);
      if (!this.held && this.downPart && moved > 7 && pt.button === 0) {
        // on attrape une pièce existante
        this.grabPart(this.downPart);
        this.downPart = null;
      }
      if (!this.held && !this.downPart && (moved > 3 || this.dragMode)) {
        this.dragMode = 'cam';
        if (this.mode2d) {
          const k = (this.ortho.size * 2) / this.app.R.height;
          this.ortho.cx += dx * k;
          this.ortho.cy += dy * k;
        } else if (e.shiftKey || pt.button === 1) {
          this.orbit.ty += dy * this.orbit.dist * 0.0022;
        } else {
          this.orbit.yaw += dx * 0.006;
          this.orbit.pitch = Math.max(-0.25, Math.min(1.35, this.orbit.pitch + dy * 0.005));
        }
      }
    }
    if (this.held) this.updateGhost();
  }

  onUp(e) {
    if (!this.active) return;
    const pt = this.ptrs.get(e.pointerId);
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size < 2) this.pinch = null;
    if (!pt) {
      // glisser-déposer depuis la palette : relâché sur la scène
      if (this.held && this.heldFromDrag && e.target === this.app.R.canvas) {
        this.setPointer(e);
        this.updateGhost();
        if (this.cand) this.placeHeld();
      }
      return;
    }
    this.setPointer(e);
    const moved = Math.hypot(e.clientX - pt.x0, e.clientY - pt.y0);
    const overUI = e.target !== this.app.R.canvas;
    if (this.held) {
      if (overUI) {
        // relâché sur la palette : on jette la pièce
        if (moved > 10 || this.heldFromDrag) this.dropHeld();
        return;
      }
      this.updateGhost();
      if (this.cand) {
        this.placeHeld();
      } else if (moved > 10 && this.heldFromDrag) {
        this.dropHeld();
      }
      return;
    }
    if (this.downPart && moved < 7) {
      this.select(this.downPart);
    } else if (!this.dragMode && moved < 5 && pt.button === 0) {
      this.select(null);
    }
    this.downPart = null;
    this.dragMode = null;
  }

  onKey(e) {
    if (!this.active || document.querySelector('.modal-back')) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); this.undo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.redo(); }
    else if (k === 'delete' || k === 'backspace') { if (this.selected) this.deletePart(this.selected); else if (this.held) this.dropHeld(); }
    else if (k === 'escape') { if (this.held) this.dropHeld(); else this.select(null); }
    else if (k === 'x') this.cycleSym();
    else if (k === 'f') { if (this.held) { const r = this.held.parts[0]; if (!PART_BY_ID[r.id].radial) { r.flip = !r.flip; this.rebuildGhost(); this.updateGhost(); } } else if (this.selected) this.flipPart(this.selected); }
    else if (k === 'v') this.setMode2d(!this.mode2d);
  }

  pickPart() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.view.group, true);
    for (const h0 of hits) {
      const uid = h0.object.userData.uid;
      if (uid != null) {
        const p = this.craft.byUid(uid);
        if (p) return p;
      }
    }
    return null;
  }

  select(p) {
    this.selected = p;
    this.updateSelBox();
    if (p) {
      this.showPartInfo(PART_BY_ID[p.id], p);
      this.app.audio.click();
    } else this.showPartInfo(null);
  }

  updateSelBox() {
    const p = this.selected && this.craft.byUid(this.selected.uid);
    if (!p || !p.box) { this.selBox.visible = false; return; }
    const b = p.box;
    this.selBox.visible = true;
    this.selBox.scale.set(b[1] - b[0] + 0.1, b[3] - b[2] + 0.1, b[5] - b[4] + 0.1);
    this.selBox.position.set((b[0] + b[1]) / 2, (b[2] + b[3]) / 2 + this.craftRoot.position.y, (b[4] + b[5]) / 2);
  }

  // ------------------------------------------------------------------------
  // Pièce tenue (fantôme)
  pickFromPalette(id, e) {
    this.select(null);
    this.held = { parts: [{ uid: 1, id, parent: null, attach: null, sym: 0, flip: false, paint: null }] };
    this.heldFromDrag = true;
    this.rebuildGhost();
    this.setHint(PART_BY_ID[id].radial ? 'Posez la pièce sur le flanc d\'un élément · X : symétrie · Échap : annuler' : 'Approchez un point d\'attache orange · F : retourner · Échap : annuler');
    this.updateMarkers();
    this.app.audio.click();
    if (e) this.setPointer(e);
  }

  grabPart(p) {
    if (p.parent == null) { this.select(p); return; }
    this.snapshot();
    const group = this.craft.symGroup(p);
    const sub = this.craft.subtree(p).map((x) => ({ ...x, attach: x.attach ? { ...x.attach } : null }));
    if (group.length > 1) this.symmetry = group.length;
    for (const q of group) this.craft.remove(q);
    const root = sub[0];
    root.parent = null;
    root.attach = null;
    root.sym = 0;
    this.held = { parts: sub, moved: true };
    this.heldFromDrag = true;
    this.selected = null;
    this.selBox.visible = false;
    this.refresh(true);
    this.rebuildGhost();
    this.updateSymBtn();
    this.setHint('Déplacez puis relâchez sur un point d\'attache · relâcher ailleurs supprime la pièce');
  }

  heldCraft() {
    const c = new Craft('tmp');
    c.parts = this.held.parts.map((p) => ({ ...p, attach: p.attach ? { ...p.attach } : null }));
    c.layout();
    return c;
  }

  rebuildGhost() {
    for (const g of this.ghostViews) this.ghostRoot.remove(g.group);
    this.ghostViews = [];
    this.ghostCraft = this.heldCraft();
    const n = 8;
    for (let i = 0; i < n; i++) {
      const v = new CraftView();
      v.sync(this.ghostCraft.parts, { deployAll: 0 });
      v.group.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.62;
          o.material.depthWrite = true;
          if (o.material.emissive) { o.material.emissive = new THREE.Color('#ff9a20'); o.material.emissiveIntensity = 0.25; }
          o.castShadow = false;
        }
      });
      v.group.visible = false;
      this.ghostRoot.add(v.group);
      this.ghostViews.push(v);
    }
  }

  dropHeld() {
    if (!this.held) return;
    this.held = null;
    for (const g of this.ghostViews) this.ghostRoot.remove(g.group);
    this.ghostViews = [];
    this.cand = null;
    this.setHint('');
    this.updateMarkers();
  }

  // Points d'attache libres (repère de la scène)
  stackNodes() {
    const out = [];
    const held = this.ghostCraft && this.ghostCraft.parts[0];
    if (!held) return out;
    const hd = PART_BY_ID[held.id];
    if (hd.radial && hd.attach.radialOnly) return out;
    const hasTop = !!hd.attach.top;
    const hasBottom = !!hd.attach.bottom;
    const heldTop = held.flip ? hasBottom : hasTop;
    const heldBottom = held.flip ? hasTop : hasBottom;
    const oy = this.craftRoot.position.y;
    for (const P of this.craft.parts) {
      const d = PART_BY_ID[P.id];
      const use = this.craft.nodeUse(P);
      const pTop = P.flip ? !!d.attach.bottom : !!d.attach.top;
      const pBottom = P.flip ? !!d.attach.top : !!d.attach.bottom;
      if (pTop && heldBottom) out.push({ type: 'top', parent: P, pos: new THREE.Vector3(P.pos.x, P.pos.y + d.h / 2 + oy, P.pos.z), occupied: use.top });
      if (pBottom && heldTop) out.push({ type: 'bottom', parent: P, pos: new THREE.Vector3(P.pos.x, P.pos.y - d.h / 2 + oy, P.pos.z), occupied: use.bottom });
      if (d.attach.out && !use.out && !hd.radial) {
        const dist = d.outDist ?? d.d / 2;
        out.push({ type: 'out', parent: P, pos: new THREE.Vector3(P.pos.x + Math.cos(P.yaw) * dist, P.pos.y + oy, P.pos.z + Math.sin(P.yaw) * dist), occupied: false });
      }
    }
    return out;
  }

  updateMarkers() {
    this.markers.clear();
    if (!this.held || !this.craft.parts.length) return;
    this.ghostCraft = this.ghostCraft || this.heldCraft();
    const geo = new THREE.SphereGeometry(1, 16, 12);
    for (const n of this.stackNodes()) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: n.occupied ? '#5cd6ff' : '#ffb23e', transparent: true, opacity: 0.85, depthTest: false }));
      m.renderOrder = 20;
      m.position.copy(n.pos);
      m.userData.node = n;
      this.markers.add(m);
    }
  }

  findCandidate() {
    if (!this.craft.parts.length) return { type: 'root' };
    const cam = this.camera;
    const R = this.app.R;
    const held = this.ghostCraft.parts[0];
    const hd = PART_BY_ID[held.id];
    // 1) points d'empilement
    let best = null, bestD = (this.app.isTouch ? 70 : 46);
    for (const n of this.stackNodes()) {
      tmpV.copy(n.pos).project(cam);
      if (tmpV.z > 1) continue;
      const sx = (tmpV.x * 0.5 + 0.5) * R.width, sy = (-tmpV.y * 0.5 + 0.5) * R.height;
      let d = Math.hypot(sx - this.pointerPx.x, sy - this.pointerPx.y);
      if (n.occupied) d += 14;
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best) return best;
    // 2) fixation en surface pour les pièces radiales
    if (hd.radial) {
      this.raycaster.setFromCamera(this.pointer, cam);
      const hits = this.raycaster.intersectObject(this.view.group, true);
      for (const hit of hits) {
        const P = this.craft.byUid(hit.object.userData.uid);
        if (!P) continue;
        const Pd = PART_BY_ID[P.id];
        if (!Pd.attach.surface) continue;
        const e = this.view.parts.get(P.uid);
        const local = e.obj.worldToLocal(hit.point.clone());
        let y = Math.max(-Pd.h / 2 + 0.05, Math.min(Pd.h / 2 - 0.05, local.y));
        let psi = Math.atan2(local.z, local.x);
        if (this.mode2d) psi = local.x >= 0 ? 0 : Math.PI;
        // aimantation : angles multiples de 15°
        const snap = Math.PI / 12;
        psi = Math.round(psi / snap) * snap;
        if (Math.abs(y) < 0.12 * Pd.h) y = 0;
        return { type: 'side', parent: P, y, psi };
      }
    }
    return null;
  }

  // Liste des emplacements (symétrie comprise)
  expandCandidate(c) {
    if (c.type === 'root') return [{ parent: null, attach: null }];
    const P = c.parent;
    const group = P.sym ? this.craft.symGroup(P) : [P];
    const out = [];
    if (c.type === 'side' && group.length === 1 && this.symmetry > 1) {
      for (let k = 0; k < this.symmetry; k++) out.push({ parent: P, attach: { type: 'side', y: c.y, psi: c.psi + (k * TAU) / this.symmetry } });
    } else {
      for (const q of group) out.push({ parent: q, attach: { type: c.type, y: c.y ?? 0, psi: c.psi ?? 0 } });
    }
    return out;
  }

  updateGhost() {
    if (!this.held) return;
    const c = this.findCandidate();
    this.cand = c;
    const slots = c ? this.expandCandidate(c) : [];
    const oy = this.craftRoot.position.y;
    const root = this.ghostCraft.parts[0];
    const d = PART_BY_ID[root.id];
    this.ghostViews.forEach((v, i) => {
      const s = slots[i];
      if (!s) { v.group.visible = i === 0 && !c; return; }
      v.group.visible = true;
      if (!s.parent) {
        v.group.position.set(0, -this.ghostCraft.bounds.minY, 0);
        v.group.rotation.set(0, 0, 0);
        return;
      }
      const tmp = { id: root.id, attach: s.attach, flip: root.flip };
      placePart(tmp, s.parent);
      v.group.position.set(tmp.pos.x, tmp.pos.y + oy, tmp.pos.z);
      v.group.rotation.set(0, -tmp.yaw, 0);
    });
    if (!c && this.ghostViews[0]) {
      // suit le pointeur dans le plan de la fusée
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const n = this.mode2d ? new THREE.Vector3(0, 0, 1) : this.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(0, 0, 0));
      const pt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, pt)) {
        this.ghostViews[0].group.position.copy(pt);
        this.ghostViews[0].group.rotation.set(0, 0, 0);
      }
    }
    // mise en valeur du point visé
    for (const m of this.markers.children) {
      const n = m.userData.node;
      const on = c && c === n;
      m.scale.setScalar(on ? 0.34 : 0.2);
    }
    void d;
  }

  placeHeld() {
    const c = this.cand;
    if (!c || !this.held) return;
    this.snapshot();
    const slots = this.expandCandidate(c);
    const sub = this.held.parts;
    const symId = slots.length > 1 ? this.craft.symCounter++ : 0;
    // symétrie des sous-pièces : un identifiant par pièce d'origine
    const subSym = new Map();
    if (slots.length > 1) for (const p of sub) subSym.set(p.uid, this.craft.symCounter++);
    for (const s of slots) {
      const map = new Map();
      sub.forEach((p, idx) => {
        let np;
        if (idx === 0) {
          if (!s.parent) np = this.craft.addRoot(p.id);
          else np = this.craft.add(p.id, s.parent, s.attach, { sym: symId, flip: p.flip, paint: p.paint });
          np.flip = p.flip;
          np.paint = p.paint;
        } else {
          const par = this.craft.byUid(map.get(p.parent));
          np = this.craft.add(p.id, par, p.attach, { sym: slots.length > 1 ? subSym.get(p.uid) : p.sym, flip: p.flip, paint: p.paint });
        }
        map.set(p.uid, np.uid);
      });
    }
    this.app.audio.attach();
    const keep = this.held && !this.held.moved && this.shiftDown;
    const id = sub[0].id;
    this.dropHeld();
    this.refresh(true);
    if (keep) this.pickFromPalette(id);
    const placed = this.craft.parts[this.craft.parts.length - 1];
    if (placed) this.flashPart(placed.uid);
    // recadrage si la fusée a grandi
    const hgt = this.craft.bounds.maxY - this.craft.bounds.minY;
    if (hgt > (this.lastFrameH || 0) * 1.15 || hgt < (this.lastFrameH || 0) * 0.6) { this.frameCraft(); }
  }

  flashPart(uid) {
    const e = this.view.parts.get(uid);
    if (!e) return;
    const o = e.obj;
    const t0 = performance.now();
    const base = o.position.y;
    const step = () => {
      const t = (performance.now() - t0) / 260;
      if (t >= 1) { o.position.y = base; return; }
      o.position.y = base + Math.sin(t * Math.PI) * 0.12 * (1 - t);
      requestAnimationFrame(step);
    };
    step();
  }

  deletePart(p) {
    this.snapshot();
    const group = this.craft.symGroup(p);
    for (const q of group) if (this.craft.byUid(q.uid)) this.craft.remove(q);
    this.select(null);
    this.refresh(true);
    this.app.audio.detach();
  }

  flipPart(p) {
    if (PART_BY_ID[p.id].radial) return;
    this.snapshot();
    for (const q of this.craft.symGroup(p)) q.flip = !q.flip;
    this.refresh(true);
  }

  paintPart(p, paint) {
    this.snapshot();
    for (const q of this.craft.symGroup(p)) q.paint = paint;
    this.refresh();
    this.showPartInfo(PART_BY_ID[p.id], p);
  }

  launch() {
    const c = this.craft;
    if (!c.controlPart()) { toast('Impossible de lancer', 'Ajoutez une capsule ou une sonde.', 'bad'); return; }
    this.app.launchCraft(c.toJSON());
  }

  // ------------------------------------------------------------------------
  update(dt) {
    this.updateCamera();
    this.shiftDown = this.app.input.keys.has('ShiftLeft') || this.app.input.keys.has('ShiftRight');
    // légère animation des marqueurs
    const t = performance.now() / 1000;
    for (const m of this.markers.children) m.material.opacity = 0.65 + Math.sin(t * 5) * 0.25;
    void dt;
  }

  render() {
    this.app.R.setBloom(0.3, 0.4, 0.97);
    this.app.R.renderer.toneMappingExposure = this.mode2d ? 1.0 : 0.9;
    this.app.R.render(this.scene, this.camera);
  }
}

export { partRadiusAt };
