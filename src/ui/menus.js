import { SUITS, SUIT_ORDER, suitUnlocked } from '../player/suits.js';
import { SKILLS, BRANCHES, canBuy } from '../player/skills.js';
import { ACHIEVEMENTS } from '../progress/achievements.js';
import { STORY } from '../missions/missions.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const TITLES = {
  stats: ['PROGRESSION', 'Ton parcours dans la ville'],
  costumes: ['COSTUMES', 'Chaque costume apporte un bonus'],
  competences: ['COMPÉTENCES', '1 point par niveau, boss vaincu et base démantelée'],
  trophees: ['TROPHÉES', ''],
  options: ['OPTIONS', 'Réglages enregistrés automatiquement'],
  commandes: ['COMMANDES', 'Clavier · manette · tactile'],
};

// Menu de pause plein écran (barre latérale + contenu) ; sert aussi aux options depuis l'écran titre
export class Menus {
  constructor(game) {
    this.game = game;
    this.root = $('pause-screen');
    this.body = $('menu-body');
    this.head = $('menu-head');
    this.tab = 'stats';
    this.fromTitle = false;
    this.root.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.game.audio.init();
        this.game.audio.play('ui');
        this._nav(b.dataset.tab);
      }),
    );
    this.body.addEventListener('click', (e) => this._onClick(e));
    this.body.addEventListener('input', (e) => this._onInput(e));
  }

  get isOpen() {
    return !this.root.classList.contains('hidden');
  }

  // Depuis le jeu (pause)
  open(tab = 'stats') {
    this.fromTitle = false;
    this.root.classList.remove('from-title', 'hidden');
    this.root.querySelector('[data-tab="resume"]').textContent = 'REPRENDRE';
    this.root.querySelector('.side-title').textContent = 'PAUSE';
    $('btn-abandon').classList.toggle('hidden', !this.game.missions.active);
    this.show(tab);
  }

  // Depuis l'écran titre : options et commandes seulement
  openFromTitle(tab) {
    this.fromTitle = true;
    $('title-screen').classList.add('hidden');
    this.root.classList.add('from-title');
    this.root.classList.remove('hidden');
    this.root.querySelector('[data-tab="resume"]').textContent = 'RETOUR';
    this.root.querySelector('.side-title').textContent = 'MENU';
    this.show(tab);
  }

  close() {
    this.root.classList.add('hidden');
    if (this.fromTitle) {
      this.fromTitle = false;
      this.root.classList.remove('from-title');
      $('title-screen').classList.remove('hidden');
    }
  }

  _nav(tab) {
    const g = this.game;
    if (tab === 'resume') {
      if (this.fromTitle) this.close();
      else g.setPaused(false);
      return;
    }
    if (tab === 'photo') {
      g.setPaused(false, true);
      g.photo.open();
      return;
    }
    if (tab === 'abandon') {
      g.confirm('ABANDONNER ?', 'La mission en cours sera annulée.').then((ok) => {
        if (!ok) return;
        g.missions.abandon();
        g.setPaused(false);
      });
      return;
    }
    if (tab === 'quit') {
      g.confirm('MENU PRINCIPAL ?', 'Ta progression est sauvegardée automatiquement.').then((ok) => {
        if (!ok) return;
        g.setPaused(false, true);
        g.missions.abandon();
        g.showTitle();
      });
      return;
    }
    this.show(tab);
  }

  show(tab) {
    this.tab = tab;
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const [t, sub] = TITLES[tab] || [tab.toUpperCase(), ''];
    this.head.innerHTML = `${esc(t)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    if (tab === 'stats') this._stats();
    else if (tab === 'costumes') this._suits();
    else if (tab === 'competences') this._skills();
    else if (tab === 'trophees') this._trophies();
    else if (tab === 'commandes') this._controls();
    else this._options();
    this.body.scrollTop = 0;
    this.refreshBadge();
  }

  refreshBadge() {
    const pts = this.game.save.skillPoints;
    const b = $('skill-badge');
    b.classList.toggle('hidden', pts <= 0);
    b.textContent = pts;
  }

  _stats() {
    const g = this.game;
    const s = g.save;
    const c = s.counters || {};
    const xpPct = Math.round((s.xp / g.xpForNext()) * 100);
    const stat = (v, label, max) => `<div class="stat"><b>${v}${max ? `<span style="font-size:18px;color:var(--muted)"> / ${max}</span>` : ''}</b><small>${label}</small>${max ? `<div class="mini"><i style="width:${Math.min(100, (parseFloat(v) / max) * 100)}%"></i></div>` : ''}</div>`;
    const total = STORY.length + g.missions.totalBags + 3 + 6;
    const done = s.completed.length + s.bags.length + s.bases.length + (s.stations || []).length;
    this.body.innerHTML = `
      <div class="profile">
        <div class="big-lvl"><small>NIVEAU</small>${s.level}</div>
        <div class="xp-line"><span>EXPÉRIENCE — ${s.xp} / ${g.xpForNext()} XP</span><div class="xp-track"><i style="width:${xpPct}%"></i></div><span>Achèvement global : ${Math.round((done / total) * 100)} %${s.skillPoints > 0 ? ` · <b style="color:var(--gold)">${s.skillPoints} point${s.skillPoints > 1 ? 's' : ''} de compétence à dépenser</b>` : ''}</span></div>
      </div>
      <div class="stat-grid">
        ${stat(s.completed.length, 'Missions de l’histoire', STORY.length)}
        ${stat(s.bags.length, 'Sacs à dos', g.missions.totalBags)}
        ${stat(s.bases.length, 'Bases démantelées', 3)}
        ${stat((s.stations || []).length, 'Stations de métro', 6)}
        ${stat(s.crimes || 0, 'Crimes arrêtés')}
        ${stat(s.achievements.length, 'Trophées', ACHIEVEMENTS.length)}
        ${stat(c.enemies || 0, 'Ennemis vaincus')}
        ${stat(Math.max(g.combat.bestCombo, c.maxCombo || 0), 'Meilleur combo')}
        ${stat(`${Math.round((c.maxSpeed || 0) * 3.6)}`, 'Vitesse max (km/h)')}
        ${stat(`${c.maxAltitude || 0} m`, 'Altitude max')}
        ${stat(c.photos || 0, 'Photos prises')}
        ${stat(c.webbed || 0, 'Ennemis entoilés')}
      </div>`;
  }

  _suits() {
    const g = this.game;
    const s = g.save;
    const auto = s.suit === 'auto';
    let html = `<p class="menu-note">En mode <b>Auto</b>, le costume change avec le style de combat (touches 1-4 ou bouton STYLE).</p><div class="cards">`;
    html += `<button class="card ${auto ? 'worn' : ''}" data-suit="auto"><div class="swatch auto">AUTO</div><b>Selon le style</b><small>Suit ton style de combat</small>${auto ? '<i class="tag">ACTIF</i>' : ''}</button>`;
    for (const k of SUIT_ORDER) {
      const suit = SUITS[k];
      const ok = suitUnlocked(k, s);
      const worn = !auto && s.suit === k;
      html += `<button class="card ${ok ? '' : 'locked'} ${worn ? 'worn' : ''}" data-suit="${k}" ${ok ? '' : 'disabled'}>
        <div class="swatch" style="background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25), transparent 45%), linear-gradient(135deg, ${suit.main} 0 55%, ${suit.second} 55% 100%)"><span style="color:${suit.emblem}">🕷</span></div>
        <b>${esc(suit.name)}</b><small>${esc(ok ? suit.bonusText : `🔒 ${suit.unlockText}`)}</small>${worn ? '<i class="tag">PORTÉ</i>' : ''}</button>`;
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  _skills() {
    const s = this.game.save;
    let html = `<p class="menu-note">Points disponibles : <b class="pts">${s.skillPoints}</b></p><div class="branches">`;
    for (const br of BRANCHES) {
      html += `<div class="branch"><h3 style="color:${br.color}">${br.name}</h3>`;
      for (const sk of SKILLS.filter((x) => x.branch === br.key)) {
        const owned = s.skills.includes(sk.key);
        const reqOk = !sk.req || s.skills.includes(sk.req);
        const buy = canBuy(sk, s);
        const state = owned ? 'owned' : !reqOk ? 'locked' : buy ? 'buy' : 'poor';
        const label = owned ? '✔ ACQUIS' : !reqOk ? '🔒' : `${sk.cost} PT${sk.cost > 1 ? 'S' : ''}`;
        html += `<button class="skill ${state}" data-skill="${sk.key}" ${buy ? '' : 'disabled'} style="--c:${br.color}"><b>${esc(sk.name)}</b><small>${esc(sk.desc)}</small><i>${label}</i></button>`;
      }
      html += '</div>';
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  _trophies() {
    const got = this.game.save.achievements || [];
    this.head.innerHTML = `TROPHÉES<small>${got.length} / ${ACHIEVEMENTS.length} obtenus</small>`;
    let html = '<div class="trophies">';
    for (const a of ACHIEVEMENTS) {
      const ok = got.includes(a.key);
      html += `<div class="trophy ${ok ? 'ok' : ''}"><span class="ti">${ok ? a.icon : '🔒'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div></div>`;
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  _options() {
    const st = this.game.save.settings;
    const seg = (key, choices) =>
      `<div class="seg-ctl">${choices.map(([val, label]) => `<button class="chip ${st[key] === val ? 'on' : ''}" data-opt="${key}" data-val="${val}">${label}</button>`).join('')}</div>`;
    const onoff = (key) => seg(key, [[true, 'OUI'], [false, 'NON']]);
    const range = (key, min, max, step, fmt) => `<div class="range"><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${st[key]}"><output>${fmt(st[key])}</output></div>`;
    const pct = (v) => `${Math.round(v * 100)} %`;
    const line = (label, sub, ctl) => `<div class="opt-line"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>${ctl}</div>`;
    const touch = this.game.input.isTouch;
    this.body.innerHTML = `<div class="options">
      <div class="opt-group">GRAPHISMES</div>
      ${line('Qualité', 'Redémarre le jeu', seg('quality', [['auto', 'AUTO'], ['high', 'ÉLEVÉE'], ['medium', 'MOYENNE'], ['low', 'BASSE']]))}
      ${line('Résolution', 'Baisse-la si le jeu saccade', range('renderScale', 0.5, 1, 0.05, pct))}
      ${line('Afficher les images/s', '', onoff('showFps'))}
      <div class="opt-group">MONDE</div>
      ${line('Météo', '', seg('weather', [['auto', 'AUTO'], ['clear', 'SOLEIL'], ['rain', 'PLUIE']]))}
      ${line('Heure', '', seg('timeMode', [['auto', 'CYCLE'], ['day', 'JOUR'], ['dusk', 'CRÉPUSCULE'], ['night', 'NUIT']]))}
      <div class="opt-group">SON</div>
      ${line('Musique', '', onoff('music'))}
      ${line('Volume de la musique', '', range('musicVol', 0, 1, 0.05, pct))}
      ${line('Volume des effets', '', range('sfxVol', 0, 1, 0.05, pct))}
      <div class="opt-group">CAMÉRA ET COMMANDES</div>
      ${line('Sensibilité', '', range('sens', 0.3, 2.5, 0.1, (v) => `${(+v).toFixed(1)}`))}
      ${line('Inverser l’axe vertical', '', onoff('invertY'))}
      ${line('Aide à la caméra', 'La caméra se replace derrière toi', onoff('autoCam'))}
      ${line('Secousses de caméra', '', onoff('shake'))}
      ${touch ? `<div class="opt-group">ÉCRAN TACTILE</div>
      ${line('Taille des boutons', '', range('tbScale', 0.7, 1.35, 0.05, pct))}
      ${line('Opacité des boutons', '', range('tbAlpha', 0.35, 1, 0.05, pct))}
      ${line('Vibrations', 'Retour haptique des coups et des chocs', onoff('haptics'))}` : ''}
    </div>`;
  }

  _controls() {
    this.body.innerHTML = `<div class="controls-grid">
      <div>
        <h3>Tactile</h3>
        <p>Pouce gauche : <b>joystick</b> (il apparaît où tu poses le doigt)</p>
        <p>Glisse à droite pour tourner la <b>caméra</b></p>
        <p><b>TOILE</b> maintenu en l’air : se balancer · <b>SAUT</b> : sauter, en l’air propulsion</p>
        <p><b>ZIP</b> : point de lancement · maintenir <b>SAUT</b> au sol : super-saut</p>
        <p>En combat : <b>FRAPPE</b>, <b>ESQUIVE</b>, <b>TIR</b>, <b>ASSAUT</b>, <b>SOIN</b>, <b>K.O.</b></p>
        <p>Le bouton jaune <b>!</b> apparaît près d’une mission</p>
      </div>
      <div>
        <h3>Clavier et souris</h3>
        <p><b>ZQSD</b> / <b>WASD</b> se déplacer · <b>Souris</b> caméra</p>
        <p><b>Espace</b> sauter · en l’air : propulsion-toile</p>
        <p><b>Maj</b> maintenu : sprint, balancement, course sur les murs</p>
        <p><b>E</b> point de lancement · <b>Clic droit</b> esquive / plongeon</p>
        <p><b>Clic gauche</b> attaquer (maintenir : projection) · <b>R</b> toile · <b>F</b> assaut</p>
        <p><b>1-4</b> styles · <b>G</b> gadget · <b>T</b> changer · <b>H</b> soin · <b>V</b> K.O.</p>
        <p><b>Entrée</b> / <b>F</b> lancer une mission · <b>Tab</b> carte · <b>O</b> photo · <b>Échap</b> pause</p>
      </div>
      <div>
        <h3>Manette</h3>
        <p><b>RT</b> balancement · <b>A</b> saut · <b>X</b> attaque · <b>B</b> esquive</p>
        <p><b>Y</b> assaut / action · <b>LB</b> toile · <b>RB</b> gadget · <b>LT</b> zip</p>
        <p><b>Croix</b> : gadget, soin, styles · <b>Start</b> pause · <b>Select</b> carte</p>
        <h3 style="margin-top:14px">Astuces</h3>
        <p>Fonce contre un mur pour grimper, saute pour t’en éjecter.</p>
        <p>Esquive quand le sens d’araignée s’allume pour une esquive parfaite.</p>
      </div>
    </div>`;
  }

  _onClick(e) {
    const g = this.game;
    const suitBtn = e.target.closest('[data-suit]');
    if (suitBtn && !suitBtn.disabled) {
      g.equipSuit(suitBtn.dataset.suit);
      g.audio.play('ui');
      this._suits();
      return;
    }
    const skillBtn = e.target.closest('[data-skill]');
    if (skillBtn && !skillBtn.disabled) {
      g.buySkill(skillBtn.dataset.skill);
      this._skills();
      this.refreshBadge();
      return;
    }
    const optBtn = e.target.closest('[data-opt]');
    if (optBtn) {
      let val = optBtn.dataset.val;
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      g.audio.play('ui');
      if (optBtn.dataset.opt === 'quality') {
        if (val === g.save.settings.quality) return;
        g.confirm('CHANGER LA QUALITÉ ?', 'Le jeu va redémarrer (ta progression est conservée).').then((ok) => {
          if (ok) g.setOption('quality', val);
        });
        return;
      }
      g.setOption(optBtn.dataset.opt, val);
      this._options();
    }
  }

  _onInput(e) {
    const r = e.target.closest('[data-range]');
    if (!r) return;
    const key = r.dataset.range;
    const v = parseFloat(r.value);
    this.game.setOption(key, v);
    const out = r.parentElement.querySelector('output');
    if (out) out.textContent = key === 'sens' ? v.toFixed(1) : `${Math.round(v * 100)} %`;
  }
}
