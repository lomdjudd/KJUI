// Menus : écran titre, nouvelle partie, chargement, paramètres, pause (personnage, équipement,
// compétences, pouvoirs, quêtes, carte, bestiaire, sauvegarde, commandes), dialogues,
// boutiques, autels, portail, mort, introduction et fin.
import { settings, SETTINGS_SCHEMA, DIFFICULTY } from '../core/settings.js';
import { audio } from '../core/audio.js';
import { listGamepads } from '../core/input.js';
import { device, TIER_LABEL } from '../core/device.js';
import { installer } from '../core/installer.js';
import { native } from '../core/storage.js';
import { el, escapeHtml, formatTime, formatNumber, clamp } from '../core/utils.js';
import { SLOTS, slotInfo, slotLabel, loadProfile, deleteSlot, mostRecentSlot, exportCode, importCode, saveProfile } from '../game/save.js';
import { WEAPONS, SHIELDS, OUTFITS, RARITY, ELEMENT_LABEL, WEAPON_CLASSES, weaponById, shieldById, outfitById, upgradeCost } from '../data/equipment.js';
import { SKILLS, BRANCHES, POWERS, powerById, skillById } from '../data/skills.js';
import { QUESTS, NPCS, questById } from '../data/quests.js';
import { ENEMIES } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';
import { ZONES, ZONE_ORDER } from '../data/zones.js';
import { computeStats, xpForLevel } from '../game/state.js';
import { objectiveNeed } from '../game/quests.js';
import { mapSymbols, drawSymbol, SYMBOL_STYLE } from './map.js';

const RES_LABEL = { physical: 'Physique', fire: 'Feu', frost: 'Givre', lightning: 'Foudre', poison: 'Poison', shadow: 'Ombre', holy: 'Sacré', blood: 'Sang' };
const pct = (v) => (v >= 0 ? '+' : '') + Math.round(v * 100) + ' %';

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('menu');
    this.stack = [];
    this.current = null;
    this.pauseTab = 'character';
    this.root.addEventListener('click', (e) => this._onClick(e));
    this.root.addEventListener('input', (e) => this._onInput(e));
    this.root.addEventListener('pointerover', (e) => {
      const b = e.target.closest('.btn, .tab, .card, .skill');
      if (b && b !== this._hover) {
        this._hover = b;
        audio.play('uiHover');
      }
    });
    window.addEventListener('keydown', (e) => this._onKey(e));
  }

  isOpen() {
    return !!this.current;
  }

  _show(name, html, cls = '') {
    this.current = name;
    this.root.className = 'show ' + cls;
    this.root.innerHTML = `<div class="veil"></div>${html}`;
    this.game.input.exitPointerLock();
    this.game.input.reset();
    if (this.game.touch) this.game.touch.setVisible(false);
  }

  close() {
    this.current = null;
    this.stack = [];
    this.root.className = '';
    this.root.innerHTML = '';
    // La touche qui a fermé le menu ne doit pas agir aussi en jeu (ex. rouvrir un dialogue)
    this.game.input.reset();
    this.game.input.endFrame();
    if (this.game.touch) this.game.touch.setVisible(this.game.state === 'playing');
    this.game.hud.refreshAll();
  }

  back() {
    audio.play('uiBack');
    if (['death', 'intro', 'ending', 'title'].includes(this.current)) return;
    const prev = this.stack.pop();
    if (prev) prev();
    else if (this.game.state === 'title') this.showTitle();
    else this.close();
  }

  _push(fn) {
    this.stack.push(fn);
  }

  // ======================= ÉCRAN TITRE =======================
  showTitle() {
    this.stack = [];
    const recent = mostRecentSlot();
    this.recent = recent;
    const html = `
      <div class="m-left">
        <div class="logo">Chevalier<small>DES OMBRES</small></div>
        <div class="logo-sub">Le Serment de Cendre</div>
        ${recent ? `<button class="btn primary" data-act="continue">Continuer<br><span class="muted" style="font-size:12px;letter-spacing:1px">${escapeHtml(slotLabel(recent.slot))} · Niv. ${recent.level} · ${escapeHtml(recent.zone)}</span></button>` : ''}
        <button class="btn ${recent ? '' : 'primary'}" data-act="new">Nouvelle partie</button>
        <button class="btn" data-act="load">Charger</button>
        <button class="btn" data-act="settings">Paramètres</button>
        <button class="btn" data-act="credits">Crédits</button>
        ${native.available ? '<button class="btn" data-act="quitApp">Quitter</button>' : ''}
      </div>
      <div class="m-foot">Fan-création · Graphismes et sons 100 % générés par le code · v1.0</div>`;
    this._show('title', html, 'title');
  }

  newGame() {
    this._push(() => this.showTitle());
    const slots = ['1', '2', '3'];
    this.newDiff = settings.get('difficulty');
    this.newSlot = slots.find((s) => !slotInfo(s)) || '1';
    const render = () => {
      const html = `<div class="m-center frame">
        <h2 class="m-title">Nouvelle partie</h2>
        <h3 class="cinzel" style="color:var(--gold)">Difficulté</h3>
        ${Object.entries(DIFFICULTY).map(([k, d]) => `<button class="btn small ${this.newDiff === k ? 'primary' : ''}" data-act="diff" data-v="${k}">${d.label}</button>`).join('')}
        <p class="muted">${{ squire: 'Pour découvrir l’histoire : ennemis moins dangereux, attaques mieux annoncées.', knight: 'L’expérience prévue : exigeante mais juste.', paladin: 'Pour les vétérans : ennemis plus robustes et plus agressifs.', nightmare: 'Chaque erreur est fatale. Plus d’ennemis, plus d’expérience.' }[this.newDiff]}</p>
        <h3 class="cinzel" style="color:var(--gold)">Emplacement</h3>
        ${slots.map((s) => { const i = slotInfo(s); return `<div class="slot" data-act="nslot" data-v="${s}" style="${this.newSlot === s ? 'border-color:var(--gold)' : ''}"><div><div class="nm">${slotLabel(s)}</div><div class="inf">${i ? `Niv. ${i.level} · ${escapeHtml(i.zone)} · sera écrasé` : 'Vide'}</div></div><div>${this.newSlot === s ? '✦' : ''}</div></div>`; }).join('')}
        <button class="btn primary" data-act="startNew">Commencer l’aventure</button>
        <button class="btn" data-act="back">Retour</button>
      </div>`;
      this._show('newGame', html);
    };
    this._renderNew = render;
    render();
  }

  loadScreen(fromPause = false) {
    this._push(fromPause ? () => this.openPause('save') : () => this.showTitle());
    const html = `<div class="m-center frame">
      <h2 class="m-title">Charger une partie</h2>
      ${SLOTS.map((s) => { const i = slotInfo(s); return `<div class="slot" ${i ? `data-act="loadSlot" data-v="${s}"` : ''}><div><div class="nm">${slotLabel(s)}</div><div class="inf">${i ? `Niveau ${i.level} · ${escapeHtml(i.zone)} · ${formatTime(i.playTime)} · ${i.bosses}/25 boss · ${new Date(i.saved).toLocaleString('fr-FR')}` : 'Vide'}</div></div>${i ? `<button class="btn small danger" data-act="delSlot" data-v="${s}">✕</button>` : ''}</div>`; }).join('')}
      <h3 class="cinzel" style="color:var(--gold)">Importer un code de sauvegarde</h3>
      <textarea class="code" id="import-code" placeholder="Collez ici un code CDO1:…"></textarea>
      <button class="btn small" data-act="importCode">Importer dans l’emplacement 3</button>
      <button class="btn" data-act="back">Retour</button>
    </div>`;
    this._show('load', html);
  }

  credits() {
    this._push(() => this.showTitle());
    this._show('credits', `<div class="m-center frame"><h2 class="m-title">Crédits</h2>
      <div class="story"><p><b class="cinzel">Chevalier des Ombres — Le Serment de Cendre</b></p>
      <p>Action-RPG dark fantasy en 3D.<br>Moteur : Three.js (WebGL) · Interface et logique en JavaScript.</p>
      <p>Tous les modèles, textures, animations, musiques et bruitages sont générés procéduralement par le code : aucun fichier extrait d’un autre jeu.</p>
      <p>Polices : Cinzel, Cinzel Decorative et IM Fell English (licence SIL Open Font).</p>
      <p class="muted">Merci d’avoir joué. Que l’Aube vous garde.</p></div>
      <button class="btn" data-act="back">Retour</button></div>`);
  }

  // ======================= PARAMÈTRES =======================
  settingsScreen(fromPause = false) {
    this._push(fromPause ? () => this.openPause('settings') : () => this.showTitle());
    this.setTab = this.setTab || 'graphics';
    this._show('settings', `<div class="m-center frame" style="width:min(820px,94vw)"><h2 class="m-title">Paramètres</h2>${this._settingsHtml()}<button class="btn" data-act="back">Retour</button></div>`);
  }

  // Onglet « Appareil & données » : profil, budget mémoire, données installées
  _deviceHtml() {
    const p = device.profile || {};
    const m = installer.meta;
    const used = this.game.memUsageMb || device.estimateUsage(this.game);
    const budget = device.budgetMb;
    const ratio = Math.min(1, used / Math.max(1, budget));
    const line = (a, b) => `<div class="statline"><span>${a}</span><b>${b}</b></div>`;
    const date = m ? new Date(m.date).toLocaleString('fr-FR') : '—';
    return `<div class="dev-panel">
      <h3 class="cinzel" style="color:var(--gold)">Profil de l’appareil</h3>
      ${line('Mémoire vive', `${String(p.ramGb ?? '?').replace('.', ',')} Go (${escapeHtml(p.ramSource || '')})`)}
      ${line('Processeur graphique', escapeHtml((p.gpu || 'inconnu').slice(0, 60)))}
      ${line('Cœurs du processeur', p.cores ?? '?')}
      ${line('Score graphique / calcul', `${p.gpuScore != null ? p.gpuScore.toLocaleString('fr-FR') : 'non mesuré'} / ${p.cpuScore ?? '?'}`)}
      ${line('Palier recommandé', `<span style="color:var(--gold-bright)">${TIER_LABEL[device.tier]}</span>`)}
      <div class="statline"><span>Mémoire graphique estimée</span><b>${used} / ${budget} Mo</b></div>
      <div class="mem-bar"><div style="width:${(ratio * 100).toFixed(0)}%;background:${ratio > 0.9 ? '#ff5a4a' : ratio > 0.7 ? '#ffc84a' : '#7affb0'}"></div></div>
      <p class="muted" style="font-size:13px">Avec la qualité automatique, le jeu baisse lui-même les réglages si cette mémoire approche du budget ou si les images par seconde chutent, pour éviter les ralentissements et les plantages.</p>
      <button class="btn small" data-act="devApply">Appliquer les réglages recommandés</button>
      <button class="btn small" data-act="devAnalyze">Relancer l’analyse</button>
      <h3 class="cinzel" style="color:var(--gold);margin-top:14px">Données installées</h3>
      ${m ? `${line('Version des données', m.version)}${line('Installées le', date)}${line('Taille', (m.bytes / 1048576).toFixed(1).replace('.', ',') + ' Mo')}${line('Textures des personnages', m.charSize + ' px')}${line('Textures du monde', m.worldSize + ' px')}${line('Qualité audio installée', { low: 'Légère', medium: 'Normale', high: 'Haute' }[m.audioQuality] || m.audioQuality)}${line('Stockage permanent', m.persistent ? 'oui' : 'non (préparées à chaque lancement)')}` : '<p class="muted">Aucune donnée installée.</p>'}
      <p class="muted" style="font-size:13px" id="dev-storage"></p>
      <button class="btn small" data-act="dataReinstall">Réinstaller les données</button>
      <button class="btn small danger" data-act="dataDelete">Supprimer les données</button>
    </div>`;
  }

  _settingsHtml() {
    if (!this.setTab) this.setTab = 'graphics';
    const cat = SETTINGS_SCHEMA.find((c) => c.id === this.setTab);
    const v = settings.values;
    if (cat.custom) {
      device.storageEstimate().then((e) => {
        const el2 = this.root.querySelector('#dev-storage');
        if (el2 && e) el2.textContent = `Stockage utilisé par le navigateur : ${e.usageMb} Mo sur ${e.quotaMb} Mo disponibles.`;
      });
      return `<div class="set-tabs">${SETTINGS_SCHEMA.map((c) => `<button class="btn small ${c.id === this.setTab ? 'on' : ''}" data-act="setTab" data-v="${c.id}">${c.icon} ${c.label}</button>`).join('')}</div>
      <div id="set-rows">${this._deviceHtml()}</div>`;
    }
    const rows = cat.items
      .map((it) => {
        let ctl = '';
        if (it.type === 'slider') ctl = `<input type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${v[it.key]}" data-set="${it.key}"><span class="val" id="val-${it.key}">${it.fmt ? it.fmt(v[it.key]) : v[it.key]}</span>`;
        else {
          const opt = it.options.find((o) => o[0] === v[it.key]) || it.options[0];
          ctl = `<div class="sel"><button data-act="setPrev" data-v="${it.key}">‹</button><span>${escapeHtml(opt[1])}</span><button data-act="setNext" data-v="${it.key}">›</button></div>`;
        }
        return `<div class="set-row"><div><div class="lbl">${escapeHtml(it.label)}${it.reload ? ' <span class="muted" style="font-size:11px">(rechargement)</span>' : ''}</div>${it.desc ? `<div class="ds">${escapeHtml(it.desc)}</div>` : ''}</div><div class="ctl">${ctl}</div></div>`;
      })
      .join('');
    return `<div class="set-tabs">${SETTINGS_SCHEMA.map((c) => `<button class="btn small ${c.id === this.setTab ? 'on' : ''}" data-act="setTab" data-v="${c.id}">${c.icon} ${c.label}</button>`).join('')}</div>
      <div id="set-rows">${rows}</div>
      <div style="text-align:right;margin-top:8px"><button class="btn small" data-act="setReset">Valeurs par défaut</button></div>`;
  }

  _refreshSettings() {
    const host = this.root.querySelector('#set-rows');
    if (!host) return;
    const wrap = host.parentElement;
    const tmp = el('div');
    tmp.innerHTML = this._settingsHtml();
    wrap.querySelector('.set-tabs').replaceWith(tmp.querySelector('.set-tabs'));
    host.replaceWith(tmp.querySelector('#set-rows'));
  }

  // ======================= MENU PAUSE =======================
  openPause(tab) {
    if (tab) this.pauseTab = tab;
    this.stack = [];
    const p = this.game.profile;
    const tabs = [
      ['resume', 'Reprendre'], ['character', 'Personnage'], ['equipment', 'Équipement'], ['skills', 'Compétences' + (p.skillPoints ? '<span class="dot"></span>' : '')], ['powers', 'Pouvoirs'],
      ['quests', 'Quêtes'], ['map', 'Carte'], ['bestiary', 'Bestiaire'], ['save', 'Sauvegarder', 'sep'], ['settings', 'Paramètres'], ['controls', 'Commandes'], ['quit', 'Menu principal'],
    ];
    const html = `<div class="pause"><div class="p-nav frame">${tabs.map(([id, l, c]) => `<div class="tab ${c || ''} ${id === this.pauseTab ? 'on' : ''}" data-act="ptab" data-v="${id}">${l}</div>`).join('')}</div><div class="p-body frame" id="pbody"></div></div>`;
    this._show('pause', html);
    this._renderPauseTab();
    audio.play('uiClick');
  }

  _renderPauseTab() {
    const body = this.root.querySelector('#pbody');
    if (!body) return;
    const t = this.pauseTab;
    const fn = {
      character: () => this._tabCharacter(), equipment: () => this._tabEquipment(), skills: () => this._tabSkills(), powers: () => this._tabPowers(),
      quests: () => this._tabQuests(), map: () => this._tabMap(), bestiary: () => this._tabBestiary(), save: () => this._tabSave(), settings: () => `<h2>Paramètres</h2>${this._settingsHtml()}`,
      controls: () => this._tabControls(), quit: () => `<h2>Menu principal</h2><p>Revenir à l’écran titre ? Votre progression depuis la dernière sauvegarde sera perdue.</p><button class="btn small primary" data-act="saveQuit">Sauvegarder et quitter</button><button class="btn small danger" data-act="quitNoSave">Quitter sans sauvegarder</button>`,
    }[t];
    body.innerHTML = fn ? fn() : '';
    if (t === 'map') this._drawBigMap();
    this.root.querySelectorAll('.p-nav .tab').forEach((x) => x.classList.toggle('on', x.dataset.v === t));
  }

  _tabCharacter() {
    const g = this.game;
    const p = g.profile;
    const st = computeStats(p);
    const pl = g.player;
    const res = Object.entries(RES_LABEL).map(([k, l]) => `<div class="statline"><span>${l}</span><b>${pct(st.res[k] || 0)}</b></div>`).join('');
    return `<h2>${escapeHtml(st.outfit.name)}</h2>
      <p class="muted">Niveau ${p.level} · ${formatNumber(p.xp)} / ${formatNumber(xpForLevel(p.level))} XP · ${formatNumber(p.shards)} éclats d’âme · ${p.skillPoints} point(s) de compétence</p>
      <div class="stats-cols">
        <div>
          <h3>Attributs</h3>
          <div class="statline"><span>Points de vie</span><b>${Math.ceil(pl.hp)} / ${st.maxHp}</b></div>
          <div class="statline"><span>Endurance</span><b>${st.maxStamina}</b></div>
          <div class="statline"><span>Mana</span><b>${st.maxMana}</b></div>
          <div class="statline"><span>Défense</span><b>${Math.round(st.def)} (−${Math.round((1 - 100 / (100 + st.def)) * 100)} % dégâts)</b></div>
          <div class="statline"><span>Dégâts de l’arme</span><b>${Math.round(st.weaponDmg * st.dmgMul)}${st.weaponElem ? ' + ' + Math.round(st.weaponElem * st.dmgMul * st.elemMul) + ' ' + ELEMENT_LABEL[st.weapon.element] : ''}</b></div>
          <div class="statline"><span>Puissance magique</span><b>×${st.magicMul.toFixed(2)}</b></div>
          <div class="statline"><span>Critique</span><b>${Math.round(st.crit * 100)} % (×${st.critMul.toFixed(1)})</b></div>
          <div class="statline"><span>Vol de vie</span><b>${(st.lifesteal * 100).toFixed(1)} %</b></div>
          <div class="statline"><span>Vitesse</span><b>${pct(st.speedMul - 1)}</b></div>
          <div class="statline"><span>Fioles</span><b>${st.flasks} braise · ${st.manaFlasks} éther (soin ${Math.round(st.flaskHeal * 100)} %)</b></div>
        </div>
        <div>
          <h3>Résistances</h3>${res}
          <h3>Chroniques</h3>
          <div class="statline"><span>Temps de jeu</span><b>${formatTime(p.stats.playTime)}</b></div>
          <div class="statline"><span>Ennemis vaincus</span><b>${formatNumber(p.stats.kills)}</b></div>
          <div class="statline"><span>Boss terrassés</span><b>${Object.keys(p.bosses).length} / 25</b></div>
          <div class="statline"><span>Morts</span><b>${p.stats.deaths}</b></div>
          <div class="statline"><span>Difficulté</span><b>${settings.difficulty.label}</b></div>
          <div class="statline"><span>Pages du grimoire</span><b>${Object.keys(p.pages).length} / 8</b></div>
        </div>
      </div>`;
  }

  _weaponStats(w, up) {
    const cls = WEAPON_CLASSES[w.cls];
    return `${Math.round(w.dmg * (1 + up * 0.14))} dégâts${w.elemDmg ? ` + ${Math.round(w.elemDmg * (1 + up * 0.12))} ${ELEMENT_LABEL[w.element]}` : ''} · ${cls.label} · vitesse ${w.speed.toFixed(1)} · portée ${w.reach}`;
  }

  _tabEquipment() {
    const p = this.game.profile;
    const weapons = WEAPONS.filter((w) => p.weapons[w.id] !== undefined);
    const shields = SHIELDS.filter((s) => p.shields.includes(s.id));
    const outfits = OUTFITS.filter((o) => p.outfits.includes(o.id));
    const w = weaponById(p.weapon);
    return `<h2>Équipement</h2>
      <h3>Armes (${weapons.length}/${WEAPONS.length})</h3>
      <div class="grid">${weapons.map((x) => `<div class="card ${x.id === p.weapon ? 'eq' : ''}" data-act="eqWeapon" data-v="${x.id}"><div class="tag" style="color:${RARITY[x.rarity].color}">${RARITY[x.rarity].label}</div><div class="nm" style="color:${RARITY[x.rarity].color}">${escapeHtml(x.name)}${p.weapons[x.id] ? ' +' + p.weapons[x.id] : ''}</div><div class="st">${this._weaponStats(x, p.weapons[x.id])}</div><div class="ds">${escapeHtml(x.desc)}</div></div>`).join('')}</div>
      <h3>Boucliers ${WEAPON_CLASSES[w.cls].shield ? '' : '<span class="muted">(inutilisables avec une arme à deux mains)</span>'}</h3>
      <div class="grid">${shields.map((x) => `<div class="card ${x.id === p.shield ? 'eq' : ''}" data-act="eqShield" data-v="${x.id}"><div class="nm">${escapeHtml(x.name)}</div><div class="st">Blocage ${Math.round(x.block * 100)} % · stabilité ${x.stability < 0.8 ? 'haute' : x.stability < 1.1 ? 'moyenne' : 'faible'}</div><div class="ds">${escapeHtml(x.desc)}</div></div>`).join('')}</div>
      <h3>Tenues (${outfits.length}/${OUTFITS.length})</h3>
      <div class="grid">${outfits.map((x) => `<div class="card ${x.id === p.outfit ? 'eq' : ''}" data-act="eqOutfit" data-v="${x.id}"><div class="tag" style="color:${RARITY[x.rarity].color}">${RARITY[x.rarity].label}</div><div class="nm" style="color:${RARITY[x.rarity].color}">${escapeHtml(x.name)}</div><div class="st">Défense ${x.def}${Object.entries(x.res).map(([k, v]) => ` · ${RES_LABEL[k]} ${pct(v)}`).join('')}</div><div class="ds">${escapeHtml(x.desc)}</div></div>`).join('')}</div>`;
  }

  _skillState(s) {
    const p = this.game.profile;
    const rank = p.skills[s.id] || 0;
    const reqOk = !s.req || (p.skills[s.req] || 0) > 0;
    return { rank, reqOk, can: reqOk && rank < s.max && p.skillPoints >= s.cost };
  }

  _tabSkills() {
    const p = this.game.profile;
    const sel = this.selSkill ? skillById(this.selSkill) : null;
    let info = '<span class="muted">Touchez une compétence pour voir ses effets.</span>';
    if (sel) {
      const s = this._skillState(sel);
      info = `<div class="cinzel" style="font-size:18px;color:var(--gold-bright)">${escapeHtml(sel.name)} <span class="muted">(${s.rank}/${sel.max})</span></div><div>${escapeHtml(sel.desc)}</div>
        <div class="muted" style="font-size:13px">Coût : ${sel.cost} point(s)${sel.req ? ' · Requiert : ' + escapeHtml(skillById(sel.req).name) : ''}</div>
        ${s.rank < sel.max ? `<button class="btn small primary" data-act="learn" data-v="${sel.id}" ${s.can ? '' : 'disabled'}>Apprendre</button>` : '<span class="up cinzel">Maîtrisée</span>'}`;
    }
    return `<h2>Compétences</h2><p class="muted">${p.skillPoints} point(s) disponible(s) · 1 point par niveau et par boss vaincu. Maëlis peut réinitialiser l’arbre.</p>
      <div class="skill-info">${info}</div>
      <div class="tree-wrap">${BRANCHES.map((b) => {
        const skills = SKILLS.filter((s) => s.branch === b.id);
        const tiers = [0, 1, 2, 3].map((t) => `<div class="tier">${[0, 1, 2].map((c) => {
          const s = skills.find((x) => x.tier === t && x.col === c);
          if (!s) return '<div></div>';
          const st = this._skillState(s);
          return `<div class="skill ${st.rank ? 'has' : ''} ${st.rank >= s.max ? 'max' : ''} ${st.can ? 'can' : ''} ${!st.reqOk ? 'lock' : ''}" data-act="selSkill" data-v="${s.id}" style="${this.selSkill === s.id ? 'outline:1px solid ' + b.color : ''}">${escapeHtml(s.name)}<div class="r">${st.rank}/${s.max}</div></div>`;
        }).join('')}</div>`).join('');
        return `<div class="branch"><h4 style="color:${b.color}">${b.icon} ${b.name}</h4>${tiers}</div>`;
      }).join('')}</div>`;
  }

  _tabPowers() {
    const p = this.game.profile;
    const owned = POWERS.filter((x) => p.powers.includes(x.id));
    const sel = this.selPower;
    return `<h2>Pouvoirs</h2><p class="muted">Choisissez un pouvoir puis un emplacement (touches 1 à 4, ou bouton Pouvoir en tactile).</p>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">${[0, 1, 2, 3].map((i) => { const pw = p.powerSlots[i] ? powerById(p.powerSlots[i]) : null; return `<div class="card ${sel ? 'can' : ''}" data-act="slotPower" data-v="${i}" style="text-align:center"><div class="muted cinzel" style="font-size:11px">Emplacement ${i + 1}</div><div style="font-size:26px">${pw ? pw.icon : '—'}</div><div class="nm">${pw ? escapeHtml(pw.name) : 'Vide'}</div></div>`; }).join('')}</div>
      <h3>Pouvoirs connus (${owned.length}/${POWERS.length})</h3>
      <div class="grid">${owned.map((x) => `<div class="card ${sel === x.id ? 'eq' : ''}" data-act="selPower" data-v="${x.id}"><div class="nm">${x.icon} ${escapeHtml(x.name)}</div><div class="st">${x.mana} mana · recharge ${x.cd} s${x.dmg ? ' · ' + x.dmg + ' dégâts' : ''}</div><div class="ds">${escapeHtml(x.desc)}</div></div>`).join('')}</div>`;
  }

  _tabQuests() {
    const p = this.game.profile;
    const all = QUESTS.filter((q) => p.quests[q.id]);
    const active = all.filter((q) => p.quests[q.id].status === 'active').sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
    const done = all.filter((q) => p.quests[q.id].status === 'done');
    const card = (q) => {
      const s = p.quests[q.id];
      return `<div class="detail" style="${q.main ? 'border-color:var(--gold)' : ''}"><div class="cinzel" style="color:${q.main ? 'var(--gold-bright)' : '#8ad0ff'};font-size:16px">${q.main ? '✦ ' : ''}${escapeHtml(q.title)} <span class="muted" style="font-size:12px">— ${escapeHtml(ZONES[q.zone].name)}</span></div>
        <div class="muted" style="margin:4px 0 6px">${escapeHtml(q.desc)}</div>
        ${q.objectives.map((o, i) => { const need = objectiveNeed(o); const pr = Math.min(need, s.progress[i] || 0); return `<div style="font-size:15px" class="${pr >= need ? 'up' : ''}">${pr >= need ? '✔' : '◇'} ${escapeHtml(o.label)}${need > 1 ? ` (${pr}/${need})` : ''}</div>`; }).join('')}
        <div class="muted" style="font-size:12px;margin-top:4px">Récompense : ${formatNumber(q.rewards.xp || 0)} XP · ${formatNumber(q.rewards.shards || 0)} éclats${q.rewards.power ? ' · pouvoir' : ''}</div></div>`;
    };
    return `<h2>Journal des quêtes</h2><h3>En cours (${active.length})</h3>${active.map(card).join('') || '<p class="muted">Aucune quête en cours.</p>'}
      <h3>Accomplies (${done.length})</h3>${done.map((q) => `<div class="muted" style="padding:3px 0">✔ ${escapeHtml(q.title)}</div>`).join('')}`;
  }

  _tabMap() {
    const g = this.game;
    const p = g.profile;
    const zone = g.zone;
    const legend = [['questMain', 'Quête principale'], ['questSide', 'Quête secondaire'], ['altar', 'Feu (autel)'], ['boss', 'Boss'], ['bossDone', 'Boss vaincu'], ['poi', 'Lieu d’intérêt'], ['chest', 'Coffre'], ['portal', 'Portail'], ['npc', 'Personnage']];
    return `<h2>${escapeHtml(zone.name)}</h2><p class="muted">${escapeHtml(zone.subtitle)}</p>
      <div class="map-wrap"><canvas id="bigmap" width="520" height="520"></canvas>
      <div><div class="legend">${legend.map(([k, l]) => `<div><i style="background:${SYMBOL_STYLE[k].color}"></i>${l}</div>`).join('')}</div>
      <h3>Régions</h3>${ZONE_ORDER.map((z) => { const zz = ZONES[z]; const un = p.zonesUnlocked.includes(z); const n = (zz.arenas || []).filter((a) => p.bosses[a.boss]).length; return `<div style="font-size:14px;padding:2px 0" class="${un ? '' : 'muted'}">${un ? '◆' : '🔒'} ${escapeHtml(zz.name)} ${un ? `<span class="muted">(${n}/${zz.arenas.length} boss)</span>` : ''}</div>`; }).join('')}</div></div>`;
  }

  _drawBigMap() {
    const g = this.game;
    const c = this.root.querySelector('#bigmap');
    if (!c || !g.hud.zoneMap) return;
    const ctx = c.getContext('2d');
    const W = c.width;
    ctx.drawImage(g.hud.zoneMap, 0, 0, W, W);
    const t = g.world.terrain;
    const k = W / t.size;
    for (const s of mapSymbols(g)) drawSymbol(ctx, (s.x + t.half) * k, (s.z + t.half) * k, s.kind, 1.4);
    const pl = g.player;
    ctx.save();
    ctx.translate((pl.pos.x + t.half) * k, (pl.pos.z + t.half) * k);
    ctx.rotate(Math.PI - pl.yaw);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#f0d48a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = '12px Cinzel, serif';
    ctx.fillStyle = '#e8dcc8';
    ctx.textAlign = 'center';
    for (const it of g.world.interactables) if (it.name && (it.type === 'altar' || it.type === 'poi' || it.type === 'portal')) ctx.fillText(it.name, (it.x + t.half) * k, (it.z + t.half) * k - 9);
  }

  _tabBestiary() {
    const p = this.game.profile;
    const list = [...ENEMIES.filter((e) => !e.hidden).map((e) => ({ ...e, boss: false })), ...BOSSES.map((b) => ({ ...b, boss: true }))];
    const sel = list.find((x) => x.id === this.selBeast) || null;
    let detail = '<p class="muted">Sélectionnez une créature.</p>';
    if (sel) {
      const known = !!p.bestiary[sel.id];
      if (!known) detail = '<div class="detail"><div class="nm">???</div><p class="muted">Vous n’avez pas encore vaincu cette créature.</p></div>';
      else {
        const zone = sel.boss ? ZONES[sel.zone].name : ZONE_ORDER.filter((z) => (ZONES[z].pools || []).some((pool) => pool.includes(sel.id))).map((z) => ZONES[z].name).join(', ') || 'Invocation';
        detail = `<div class="detail"><div class="nm" style="color:${sel.boss ? '#ff8a6a' : 'var(--text)'}">${escapeHtml(sel.name)}</div>${sel.boss ? `<div class="muted" style="font-style:italic">${escapeHtml(sel.title)} · ${'★'.repeat(sel.stars)}${'☆'.repeat(5 - sel.stars)}</div>` : ''}
          <p>${escapeHtml(sel.boss ? sel.lore : sel.desc)}</p>
          <div class="statline"><span>Région</span><b>${escapeHtml(zone)}</b></div>
          <div class="statline"><span>Faiblesses</span><b>${(sel.weak || []).map((w) => RES_LABEL[w]).join(', ') || '—'}</b></div>
          <div class="statline"><span>Résistances</span><b>${Object.entries(sel.resist || {}).filter(([, v]) => v > 0).map(([k, v]) => `${RES_LABEL[k]} ${Math.round(v * 100)} %`).join(', ') || '—'}</b></div>
          <div class="statline"><span>Vaincus</span><b>${p.bestiary[sel.id]}</b></div></div>`;
      }
    }
    const nKnown = list.filter((x) => p.bestiary[x.id]).length;
    return `<h2>Bestiaire</h2><p class="muted">${nKnown} / ${list.length} créatures répertoriées (${ENEMIES.filter((e) => !e.hidden).length} ennemis, ${BOSSES.length} boss)</p>
      <div class="beast"><div class="beast-list">${list.map((x) => `<div class="beast-item ${p.bestiary[x.id] ? '' : 'unk'} ${this.selBeast === x.id ? 'on' : ''}" data-act="selBeast" data-v="${x.id}"><span>${x.boss ? '☠ ' : ''}${p.bestiary[x.id] ? escapeHtml(x.name) : '???'}</span><span class="k">${p.bestiary[x.id] ? '×' + p.bestiary[x.id] : ''}</span></div>`).join('')}</div><div>${detail}</div></div>`;
  }

  _tabSave() {
    const g = this.game;
    return `<h2>Sauvegarder</h2><p class="muted">La partie est aussi sauvegardée automatiquement (feux, boss, quêtes et toutes les ${settings.get('autosave') || '—'} min).</p>
      ${SLOTS.filter((s) => s !== 'auto').map((s) => { const i = slotInfo(s); return `<div class="slot" data-act="saveSlot" data-v="${s}"><div><div class="nm">${slotLabel(s)}${g.slot === s ? ' ✦' : ''}</div><div class="inf">${i ? `Niveau ${i.level} · ${escapeHtml(i.zone)} · ${formatTime(i.playTime)} · ${new Date(i.saved).toLocaleString('fr-FR')}` : 'Vide'}</div></div><span class="cinzel" style="color:var(--gold)">Sauver</span></div>`; }).join('')}
      <button class="btn small" data-act="loadFromPause">Charger une partie…</button>
      <h3>Code de sauvegarde</h3><p class="muted">Copiez ce code pour garder une copie de votre partie ou la transférer sur un autre appareil.</p>
      <textarea class="code" id="export-code" readonly></textarea><button class="btn small" data-act="exportCode">Générer le code</button><button class="btn small" data-act="copyCode">Copier</button>`;
  }

  _tabControls() {
    const rows = (arr) => arr.map(([a, b]) => `<div class="statline"><span>${a}</span><b>${b}</b></div>`).join('');
    return `<h2>Commandes</h2><div class="stats-cols"><div><h3>Clavier et souris</h3>${rows([
      ['Se déplacer', 'ZQSD / WASD'], ['Caméra', 'Souris'], ['Attaque légère', 'Clic gauche / J'], ['Attaque lourde (maintenir = charger)', 'K'], ['Garde / parade', 'Clic droit / A (Q)'], ['Esquive', 'C / Alt'],
      ['Sauter (2× = double saut)', 'Espace'], ['Sprinter', 'Maj'], ['Mode furtif', 'Ctrl'], ['Art d’arme', 'G'], ['Verrouiller la cible', 'T / clic molette'], ['Pouvoirs', '1 2 3 4 · molette = sélection'],
      ['Fiole de Braise / d’Éther', 'R / X'], ['Interagir', 'E / F'], ['Vue 1re / 3e personne', 'V'], ['Carte', 'Tab / M'], ['Inventaire / Journal', 'I / L'], ['Pause', 'Échap / P'],
    ])}</div><div><h3>Manette</h3>${rows([
      ['Attaque légère / lourde', 'X / Y · RT'], ['Garde', 'LB'], ['Art d’arme', 'LT'], ['Esquive', 'B'], ['Sauter / interagir', 'A'], ['Pouvoir sélectionné', 'RB'], ['Changer de pouvoir', 'Croix ← →'],
      ['Fioles', 'Croix ↑ (braise) · ↓ (éther)'], ['Verrouiller', 'R3'], ['Sprint · furtif (à l’arrêt)', 'L3'], ['Carte / Pause', 'Select / Start'],
    ])}<h3>Tactile</h3>${rows([['Déplacement', 'Joystick à gauche (doigt au-delà du cercle = sprint)'], ['Caméra', 'Glisser à droite'], ['Actions', 'Boutons à droite (Art, Furtif…)'], ['Vue', 'Icône œil']])}
    <h3>Techniques</h3>${rows([
      ['Roulade', 'Esquive + direction (avant, arrière, côtés si cible verrouillée)'], ['Bond arrière', 'Esquive sans direction'], ['Pas de garde', 'Esquive en tenant la garde'], ['Glissade', 'Esquive en sprintant'], ['Ruée aérienne', 'Esquive en l’air'], ['Esquive parfaite', 'Esquiver au dernier moment : le temps ralentit'],
      ['Contre-attaque', 'Attaquer juste après une esquive'], ['Attaque en course', 'Attaquer en sprintant'], ['Attaque plongeante', 'Attaquer en l’air, en hauteur'], ['Coup de pied', 'Attaque lourde en garde : brise les boucliers'],
      ['Exécution', 'Attaquer un ennemi étourdi'], ['Assassinat', 'En mode furtif, attaquer un ennemi de dos'],
    ])}</div></div>`;
  }

  // ======================= DIALOGUES ET BOUTIQUES =======================
  openDialog(npcId) {
    const npc = NPCS[npcId];
    const q = this.game.quests;
    let lines = npc.lines.default;
    if (npcId === 'anselme' && q.state('m1') && q.state('m1').status !== 'done') lines = npc.lines.m1;
    if (npcId === 'anselme' && this.game.profile.ending) lines = npc.lines.ending;
    this.dlg = { npcId, lines, i: 0 };
    this._renderDialog();
  }

  _renderDialog() {
    const d = this.dlg;
    const npc = NPCS[d.npcId];
    const last = d.i >= d.lines.length - 1;
    const shopLabel = { forge: 'Forge (armes et boucliers)', armory: 'Tenues', mystic: 'Pouvoirs et savoirs', quartermaster: 'Fioles' }[npc.shop];
    this._show('dialog', `<div class="dialog frame"><div class="who">${escapeHtml(npc.name)}</div><div class="role">${escapeHtml(npc.role)}</div><div class="line">« ${escapeHtml(d.lines[d.i])} »</div>
      <div class="acts">${!last ? '<button class="btn small primary" data-act="dlgNext">Suivant</button>' : ''}${npc.shop ? `<button class="btn small ${last ? 'primary' : ''}" data-act="shop" data-v="${npc.shop}">${shopLabel}</button>` : ''}<button class="btn small" data-act="close">Au revoir</button></div></div>`);
  }

  openShop(type) {
    this.shopType = type;
    this._push(() => this._renderDialog());
    const titles = { forge: 'Forge de Gorvald', armory: 'Armurerie d’Isolde', mystic: 'Tente de Maëlis', quartermaster: 'Intendance de Roderic' };
    this._show('shop', `<div class="m-center frame" style="width:min(900px,94vw)"><h2 class="m-title">${titles[type]}</h2><p class="m-sub"><span class="shard-ico" style="display:inline-block;vertical-align:middle"></span> <span id="shop-shards">${formatNumber(this.game.profile.shards)}</span> éclats d’âme</p><div id="shop-body"></div><button class="btn" data-act="back">Retour</button></div>`);
    this._renderShop();
  }

  _renderShop() {
    const p = this.game.profile;
    const body = this.root.querySelector('#shop-body');
    if (!body) return;
    this.root.querySelector('#shop-shards').textContent = formatNumber(p.shards);
    const buyCard = (id, kind, name, stats, desc, price, owned, color) => `<div class="card ${owned ? 'eq' : ''}" ${owned ? '' : `data-act="buy" data-kind="${kind}" data-v="${id}"`}><div class="nm" style="color:${color || 'var(--text)'}">${escapeHtml(name)}</div><div class="st">${stats}</div><div class="ds">${escapeHtml(desc)}</div><div class="price">${owned ? 'Possédé' : formatNumber(price) + ' éclats'}</div></div>`;
    let html = '';
    if (this.shopType === 'forge') {
      const ws = WEAPONS.filter((w) => w.price > 0);
      html += `<h3 class="cinzel" style="color:var(--gold)">Armes</h3><div class="grid">${ws.map((w) => buyCard(w.id, 'weapon', w.name, this._weaponStats(w, 0), w.desc, w.price, p.weapons[w.id] !== undefined, RARITY[w.rarity].color)).join('')}</div>`;
      const owned = WEAPONS.filter((w) => p.weapons[w.id] !== undefined);
      html += `<h3 class="cinzel" style="color:var(--gold)">Améliorations (+1 à +5)</h3><div class="grid">${owned.map((w) => { const lv = p.weapons[w.id]; const cost = upgradeCost(w, lv); return `<div class="card" ${lv < 5 ? `data-act="upgrade" data-v="${w.id}"` : ''}><div class="nm" style="color:${RARITY[w.rarity].color}">${escapeHtml(w.name)} +${lv}</div><div class="st">${this._weaponStats(w, lv)}</div>${lv < 5 ? `<div class="st up">→ +${lv + 1} : ${Math.round(w.dmg * (1 + (lv + 1) * 0.14))} dégâts</div><div class="price">${formatNumber(cost)} éclats</div>` : '<div class="price">Maximum</div>'}</div>`; }).join('')}</div>`;
      const ss = SHIELDS.filter((s) => s.price > 0);
      html += `<h3 class="cinzel" style="color:var(--gold)">Boucliers</h3><div class="grid">${ss.map((s) => buyCard(s.id, 'shield', s.name, `Blocage ${Math.round(s.block * 100)} %`, s.desc, s.price, p.shields.includes(s.id))).join('')}</div>`;
    } else if (this.shopType === 'armory') {
      html += `<div class="grid">${OUTFITS.map((o) => {
        const owned = p.outfits.includes(o.id);
        if (!owned && !o.price) return `<div class="card locked"><div class="nm">${escapeHtml(o.name)}</div><div class="ds">Trophée d’un boss.</div></div>`;
        const eq = p.outfit === o.id;
        return `<div class="card ${eq ? 'eq' : ''}" data-act="${owned ? 'eqOutfit' : 'buy'}" data-kind="outfit" data-v="${o.id}"><div class="tag" style="color:${RARITY[o.rarity].color}">${RARITY[o.rarity].label}</div><div class="nm" style="color:${RARITY[o.rarity].color}">${escapeHtml(o.name)}</div><div class="st">Défense ${o.def}</div><div class="ds">${escapeHtml(o.desc)}</div><div class="price">${eq ? 'Portée' : owned ? 'Porter' : formatNumber(o.price) + ' éclats'}</div></div>`;
      }).join('')}</div>`;
    } else if (this.shopType === 'mystic') {
      html += `<h3 class="cinzel" style="color:var(--gold)">Pouvoirs</h3><div class="grid">${POWERS.map((pw) => {
        const owned = p.powers.includes(pw.id);
        if (!owned && !pw.price) return `<div class="card locked"><div class="nm">${pw.icon} ${escapeHtml(pw.name)}</div><div class="ds">Arraché à un boss.</div></div>`;
        return buyCard(pw.id, 'power', pw.icon + ' ' + pw.name, `${pw.mana} mana · ${pw.cd} s`, pw.desc, pw.price, owned);
      }).join('')}</div>`;
      const cost = 150 * p.level;
      html += `<h3 class="cinzel" style="color:var(--gold)">Réinitialiser les compétences</h3><p class="muted">Récupérez tous vos points de compétence pour ${formatNumber(cost)} éclats.</p><button class="btn small" data-act="resetSkills">Réinitialiser (${formatNumber(cost)})</button>`;
    } else if (this.shopType === 'quartermaster') {
      const fu = p.flaskUpgrades;
      const items = [
        ['heal', 'Fiole de Braise supplémentaire', `${3 + fu.heal} → ${4 + fu.heal} fioles`, [800, 2500, 6000], fu.heal],
        ['potency', 'Braise concentrée', `Soin +15 % par fiole (${fu.potency}/3)`, [1000, 3000, 7000], fu.potency],
        ['mana', 'Fiole d’Éther supplémentaire', `${1 + fu.mana} → ${2 + fu.mana} fioles`, [1500, 5000], fu.mana],
      ];
      html += `<div class="grid">${items.map(([id, name, st, costs, lv]) => `<div class="card" ${lv < costs.length ? `data-act="flaskUp" data-v="${id}"` : ''}><div class="nm">${name}</div><div class="st">${st}</div><div class="price">${lv < costs.length ? formatNumber(costs[lv]) + ' éclats' : 'Maximum'}</div></div>`).join('')}</div>`;
    }
    body.innerHTML = html;
  }

  // ======================= AUTEL / PORTAIL =======================
  openAltar(altar) {
    this.altar = altar;
    this.stack = [];
    this._show('altar', `<div class="m-center frame"><h2 class="m-title">${escapeHtml(altar.name)}</h2><p class="m-sub">Vous vous reposez. Vie, mana et fioles sont restaurées. Les ennemis sont revenus.</p>
      <button class="btn primary" data-act="close">Se relever</button>
      <button class="btn" data-act="travelMenu">Voyage rapide</button>
      <button class="btn" data-act="pauseTab" data-v="skills">Compétences${this.game.profile.skillPoints ? ' (' + this.game.profile.skillPoints + ')' : ''}</button>
      <button class="btn" data-act="pauseTab" data-v="equipment">Équipement</button>
      <button class="btn" data-act="pauseTab" data-v="save">Sauvegarder</button>
      ${this.game.zoneId !== 'hub' ? '<button class="btn" data-act="toHub">Retourner au Havre</button>' : ''}</div>`);
  }

  travelMenu() {
    this._push(() => this.openAltar(this.altar));
    const p = this.game.profile;
    const zones = ['hub', ...ZONE_ORDER].filter((z) => p.zonesUnlocked.includes(z));
    const html = zones
      .map((z) => {
        const zone = ZONES[z];
        const altars = (zone.altars || []).filter((a) => p.altars.includes(a.id));
        if (!altars.length) return '';
        return `<h3 class="cinzel" style="color:var(--gold)">${escapeHtml(zone.name)}</h3>${altars.map((a) => `<button class="btn small" data-act="travel" data-z="${z}" data-v="${a.id}">${escapeHtml(a.name)}</button>`).join('')}`;
      })
      .join('');
    this._show('travel', `<div class="m-center frame"><h2 class="m-title">Voyage rapide</h2>${html}<button class="btn" data-act="back">Retour</button></div>`);
  }

  openPortal() {
    this.stack = [];
    const p = this.game.profile;
    const rows = ZONE_ORDER.map((z) => {
      const zone = ZONES[z];
      const un = p.zonesUnlocked.includes(z);
      const n = (zone.arenas || []).filter((a) => p.bosses[a.boss]).length;
      return `<div class="slot" ${un ? `data-act="travel" data-z="${z}"` : ''} style="${un ? '' : 'opacity:0.45'}"><div><div class="nm">${escapeHtml(zone.name)}</div><div class="inf">${un ? `${escapeHtml(zone.subtitle)} · Niveau ${zone.level[0]}–${zone.level[1]} · ${n}/${zone.arenas.length} boss` : 'Scellé — vaincre le gardien de la région précédente'}</div></div><div>${un ? '➤' : '🔒'}</div></div>`;
    }).join('');
    this._show('portal', `<div class="m-center frame"><h2 class="m-title">Portail des Âmes</h2><p class="m-sub">Où souhaitez-vous aller ?</p>${rows}<button class="btn" data-act="close">Rester au Havre</button></div>`);
  }

  // ======================= MORT / INTRO / FIN =======================
  showDeath() {
    this._show('death', `<div class="death-screen"><div class="big">VOUS ÊTES MORT</div><div class="sub">Les cendres se rassemblent au dernier feu…</div><div style="width:min(360px,80vw)"><button class="btn primary" data-act="respawn">Se relever</button></div></div>`);
  }

  showIntro() {
    this._show('intro', `<div class="m-center frame" style="width:min(720px,94vw)"><h2 class="m-title">Le Serment de Cendre</h2><div class="story">
      <p>Il y a mille ans, le Roi Sans Visage fut enchaîné au bord du monde par l’Ordre de l’Aube.</p>
      <p>Cette nuit, ses chaînes ont cédé. Le Néant s’est répandu sur le royaume : les morts se relèvent, les forêts pourrissent, les rois deviennent des monstres.</p>
      <p>Vous vous réveillez dans les cendres du Havre, dernier refuge des vivants, sans souvenir de votre nom. Seule votre épée se souvient du serment.</p>
      <p class="muted">Allumez les feux. Terrassez les gardiens. Brisez la couronne du Néant.</p></div>
      <button class="btn primary" data-act="close">Se relever</button></div>`);
  }

  showEnding() {
    const p = this.game.profile;
    this._show('ending', `<div class="m-center frame" style="width:min(760px,94vw)"><h2 class="m-title">L’Aube se lève</h2><div class="story">
      <p>Le Roi Sans Visage s’effondre en une pluie d’étoiles mortes. Pour la première fois depuis mille ans, le soleil touche la Citadelle.</p>
      <p>Dans les cendres, vous retrouvez un nom gravé sur votre lame. Le vôtre. Celui du dernier Chevalier de l’Aube.</p>
      <p>Le royaume est libre. Mais quelque part, entre les étoiles, quelque chose vous regarde encore.</p>
      <p class="cinzel" style="color:var(--gold)">Temps de jeu : ${formatTime(p.stats.playTime)} · Niveau ${p.level} · ${Object.keys(p.bosses).length}/25 boss · ${p.stats.deaths} morts</p>
      <p class="muted">Merci d’avoir joué à Chevalier des Ombres.</p></div>
      <button class="btn primary" data-act="endingContinue">Continuer l’aventure</button></div>`);
  }

  confirm(text, onYes) {
    const prev = this.current;
    this._confirm = onYes;
    this._push(() => (prev === 'pause' ? this.openPause() : this.showTitle()));
    this._show('confirm', `<div class="m-center frame"><p style="font-size:19px;text-align:center">${escapeHtml(text)}</p><button class="btn danger" data-act="confirmYes">Confirmer</button><button class="btn" data-act="back">Annuler</button></div>`);
  }

  // ======================= ÉVÉNEMENTS =======================
  async _onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const v = t.dataset.v;
    const g = this.game;
    const p = g.profile;
    audio.init();
    if (act !== 'back') audio.play('uiClick');
    switch (act) {
      case 'back':
        return this.back();
      case 'close':
        return this.close();
      case 'continue': {
        const prof = loadProfile(this.recent.slot);
        if (!prof) return;
        this.close();
        await g.continueGame(prof, this.recent.slot === 'auto' ? prof.lastSlot || '1' : this.recent.slot);
        return;
      }
      case 'new':
        return this.newGame();
      case 'diff':
        this.newDiff = v;
        return this._renderNew();
      case 'nslot':
        this.newSlot = v;
        return this._renderNew();
      case 'startNew':
        this.close();
        await g.newGame(this.newSlot, this.newDiff);
        return;
      case 'load':
        return this.loadScreen();
      case 'loadFromPause':
        return this.loadScreen(true);
      case 'loadSlot': {
        const prof = loadProfile(v);
        if (!prof) return;
        this.close();
        await g.continueGame(prof, v === 'auto' ? '1' : v);
        return;
      }
      case 'delSlot':
        e.stopPropagation();
        return this.confirm('Supprimer définitivement cette sauvegarde ?', () => {
          deleteSlot(v);
          this.stack = [];
          this.loadScreen();
        });
      case 'importCode': {
        try {
          const prof = importCode(this.root.querySelector('#import-code').value);
          saveProfile('3', prof);
          g.hud.toast('Sauvegarde importée dans l’emplacement 3');
          this.stack.pop();
          this.loadScreen();
        } catch {
          audio.play('uiError');
          g.hud.toast('Code invalide', true);
        }
        return;
      }
      case 'settings':
        return this.settingsScreen();
      case 'credits':
        return this.credits();
      case 'quitApp':
        return native.exit();
      case 'setTab':
        this.setTab = v;
        return this._refreshSettings();
      case 'setPrev':
      case 'setNext': {
        const it = SETTINGS_SCHEMA.flatMap((c) => c.items).find((x) => x.key === v);
        const idx = it.options.findIndex((o) => o[0] === settings.get(v));
        const ni = (idx + (act === 'setNext' ? 1 : -1) + it.options.length) % it.options.length;
        settings.set(v, it.options[ni][0]);
        return this._refreshSettings();
      }
      case 'setReset':
        settings.reset(this.setTab);
        return this._refreshSettings();
      case 'devApply':
        settings.applyRecommended();
        g.hud.toast(`Réglages du palier ${TIER_LABEL[device.tier]} appliqués`);
        return this._refreshSettings();
      case 'devAnalyze':
        device.analyze(g.renderer.renderer);
        if (settings.get('autoQuality')) settings.applyRecommended();
        g.hud.toast(`Analyse terminée : palier ${TIER_LABEL[device.tier]}`);
        return this._refreshSettings();
      case 'dataReinstall':
        return this.confirm('Réinstaller les données du jeu ? Vos sauvegardes sont conservées. Le jeu va redémarrer.', async () => {
          if (g.state === 'playing') g.autosave();
          await installer.uninstall();
          location.reload();
        });
      case 'dataDelete':
        return this.confirm('Supprimer les données installées ? Vos sauvegardes sont conservées, mais l’installation sera redemandée au prochain lancement.', async () => {
          if (g.state === 'playing') g.autosave();
          await installer.uninstall();
          location.reload();
        });
      case 'ptab':
        if (v === 'resume') return this.close();
        this.pauseTab = v;
        return this._renderPauseTab();
      case 'pauseTab':
        return this.openPause(v);
      case 'eqWeapon':
        p.weapon = v;
        g.equip();
        return this._renderPauseTab();
      case 'eqShield':
        p.shield = v;
        g.equip();
        return this._renderPauseTab();
      case 'eqOutfit':
        p.outfit = v;
        g.equip();
        return this.current === 'shop' ? this._renderShop() : this._renderPauseTab();
      case 'selSkill':
        this.selSkill = v;
        return this._renderPauseTab();
      case 'learn': {
        const s = skillById(v);
        const st = this._skillState(s);
        if (!st.can) return audio.play('uiError');
        p.skills[v] = st.rank + 1;
        p.skillPoints -= s.cost;
        g.player.refreshStats();
        audio.play('levelUp');
        return this._renderPauseTab();
      }
      case 'selPower':
        this.selPower = v;
        return this._renderPauseTab();
      case 'slotPower': {
        const i = +v;
        if (this.selPower) {
          const prev = p.powerSlots.indexOf(this.selPower);
          if (prev >= 0) p.powerSlots[prev] = p.powerSlots[i];
          p.powerSlots[i] = this.selPower;
          this.selPower = null;
        } else p.powerSlots[i] = null;
        g.hud.refreshPowers();
        return this._renderPauseTab();
      }
      case 'selBeast':
        this.selBeast = v;
        return this._renderPauseTab();
      case 'saveSlot':
        g.saveTo(v);
        g.hud.toast('Partie sauvegardée (' + slotLabel(v) + ')');
        return this._renderPauseTab();
      case 'exportCode':
        g._snapshot();
        this.root.querySelector('#export-code').value = exportCode(p);
        return;
      case 'copyCode': {
        const ta = this.root.querySelector('#export-code');
        if (!ta.value) {
          g._snapshot();
          ta.value = exportCode(p);
        }
        ta.select();
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText(ta.value);
          else document.execCommand('copy');
          g.hud.toast('Code copié');
        } catch {
          document.execCommand('copy');
        }
        return;
      }
      case 'saveQuit':
        g.saveTo(g.slot || '1');
        this.close();
        await g.showTitle();
        return this.showTitle();
      case 'quitNoSave':
        this.close();
        await g.showTitle();
        return this.showTitle();
      case 'dlgNext':
        this.dlg.i++;
        return this._renderDialog();
      case 'shop':
        return this.openShop(v);
      case 'buy': {
        const kind = t.dataset.kind;
        const item = kind === 'weapon' ? weaponById(v) : kind === 'shield' ? shieldById(v) : kind === 'outfit' ? outfitById(v) : powerById(v);
        if (p.shards < item.price) {
          audio.play('uiError');
          return g.hud.toast('Pas assez d’éclats d’âme', true);
        }
        p.shards -= item.price;
        if (kind === 'weapon') p.weapons[v] = 0;
        if (kind === 'shield') p.shields.push(v);
        if (kind === 'outfit') p.outfits.push(v);
        if (kind === 'power') {
          p.powers.push(v);
          const empty = p.powerSlots.indexOf(null);
          if (empty >= 0) p.powerSlots[empty] = v;
        }
        audio.play('buy');
        g.hud.toast(item.name + ' acquis !');
        g.requestAutosave();
        return this._renderShop();
      }
      case 'upgrade': {
        const w = weaponById(v);
        const lv = p.weapons[v];
        const cost = upgradeCost(w, lv);
        if (p.shards < cost) {
          audio.play('uiError');
          return g.hud.toast('Pas assez d’éclats d’âme', true);
        }
        p.shards -= cost;
        p.weapons[v] = lv + 1;
        audio.play('forge');
        g.hud.toast(`${w.name} +${lv + 1} !`);
        g.player.refreshStats();
        g.quests.event('upgrade', { value: Math.max(...Object.values(p.weapons)) });
        return this._renderShop();
      }
      case 'flaskUp': {
        const costs = { heal: [800, 2500, 6000], potency: [1000, 3000, 7000], mana: [1500, 5000] }[v];
        const lv = p.flaskUpgrades[v];
        if (lv >= costs.length) return;
        if (p.shards < costs[lv]) {
          audio.play('uiError');
          return g.hud.toast('Pas assez d’éclats d’âme', true);
        }
        p.shards -= costs[lv];
        p.flaskUpgrades[v]++;
        g.player.refreshStats();
        g.player.flasks = g.player.stats.flasks;
        g.player.manaFlasks = g.player.stats.manaFlasks;
        audio.play('buy');
        return this._renderShop();
      }
      case 'resetSkills': {
        const cost = 150 * p.level;
        if (p.shards < cost) return g.hud.toast('Pas assez d’éclats d’âme', true);
        let pts = 0;
        for (const [id, r] of Object.entries(p.skills)) pts += r * skillById(id).cost;
        p.skills = {};
        p.skillPoints += pts;
        p.shards -= cost;
        g.player.refreshStats();
        g.hud.toast(pts + ' points récupérés');
        return this._renderShop();
      }
      case 'travelMenu':
        return this.travelMenu();
      case 'travel':
        this.close();
        await g.travel(t.dataset.z, v || null);
        return;
      case 'toHub':
        this.close();
        await g.travel('hub', 'hub');
        return;
      case 'respawn':
        this.close();
        await g.respawn();
        return;
      case 'endingContinue':
        this.close();
        await g.travel('hub', 'hub');
        return;
      case 'confirmYes':
        this.stack.pop();
        if (this._confirm) this._confirm();
        return;
      default:
    }
  }

  _onInput(e) {
    const t = e.target;
    if (t.dataset.set) {
      const key = t.dataset.set;
      const val = parseFloat(t.value);
      settings.set(key, val);
      const it = SETTINGS_SCHEMA.flatMap((c) => c.items).find((x) => x.key === key);
      const lab = this.root.querySelector('#val-' + key);
      if (lab) lab.textContent = it.fmt ? it.fmt(val) : val;
      if (key === 'renderScale' || key === 'bloomStrength') {
        const sel = this.root.querySelector('.set-tabs');
        if (sel && settings.get('preset') === 'custom') this._refreshPresetLabel();
      }
    }
  }

  _refreshPresetLabel() {
    // Le préréglage passe en « Personnalisé » : on rafraîchit seulement la ligne correspondante
    const rows = this.root.querySelectorAll('.set-row');
    rows.forEach((r) => {
      const b = r.querySelector('[data-v="preset"]');
      if (b) r.querySelector('.sel span').textContent = 'Personnalisé';
    });
  }

  _onKey(e) {
    if (!this.current) return;
    const focusables = [...this.root.querySelectorAll('.btn:not(:disabled), .tab, .card[data-act], .slot[data-act], .skill, .beast-item')];
    if (!focusables.length) return;
    let i = focusables.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      i = (i + 1) % focusables.length;
      focusables[i].focus && focusables[i].setAttribute('tabindex', '0');
      focusables[i].focus();
      e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      i = (i - 1 + focusables.length) % focusables.length;
      focusables[i].setAttribute('tabindex', '0');
      focusables[i].focus();
      e.preventDefault();
    } else if (e.key === 'Enter' && document.activeElement && this.root.contains(document.activeElement)) {
      document.activeElement.click();
      e.preventDefault();
    }
  }

  // Navigation à la manette dans les menus
  pollGamepad() {
    if (!this.current) return;
    const pad = listGamepads().find((p) => p && p.connected);
    if (!pad) return;
    const prev = this._padPrev || {};
    const press = (i) => pad.buttons[i] && pad.buttons[i].pressed && !prev[i];
    const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    if (press(12) || press(14)) key('ArrowUp');
    if (press(13) || press(15)) key('ArrowDown');
    if (press(0)) key('Enter');
    if (press(1)) this.back();
    this._padPrev = pad.buttons.map((b) => b.pressed);
  }
}
