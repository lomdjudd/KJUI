import { SUITS, SUIT_ORDER, suitUnlocked } from '../player/suits.js';
import { SKILLS, BRANCHES, canBuy } from '../player/skills.js';
import { ACHIEVEMENTS } from '../progress/achievements.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Menus à onglets : costumes, compétences, trophées, options
export class Menus {
  constructor(game) {
    this.game = game;
    this.root = $('menu-screen');
    this.body = $('menu-body');
    this.tab = 'costumes';
    this.root.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.game.audio.play('ui');
        this.show(b.dataset.tab);
      }),
    );
    $('btn-menu-back').addEventListener('click', (e) => {
      e.preventDefault();
      this.game.audio.play('ui');
      this.close();
    });
    this.body.addEventListener('click', (e) => this._onClick(e));
  }

  get isOpen() {
    return !this.root.classList.contains('hidden');
  }

  open(tab) {
    $('pause-screen').classList.add('hidden');
    this.root.classList.remove('hidden');
    this.show(tab || this.tab);
  }

  close() {
    this.root.classList.add('hidden');
    if (this.game.paused) $('pause-screen').classList.remove('hidden');
    this.game.refreshPauseStats();
  }

  show(tab) {
    this.tab = tab;
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'costumes') this._suits();
    else if (tab === 'competences') this._skills();
    else if (tab === 'trophees') this._trophies();
    else this._options();
  }

  _suits() {
    const g = this.game;
    const s = g.save;
    const auto = s.suit === 'auto';
    let html = `<p class="menu-note">Chaque costume donne un bonus. En mode <b>Auto</b>, le costume change avec le style de combat (1-4).</p><div class="cards">`;
    html += `<button class="card ${auto ? 'worn' : ''}" data-suit="auto"><div class="swatch auto">AUTO</div><b>Selon le style</b><small>Le costume suit ton style de combat</small>${auto ? '<i class="tag">Actif</i>' : ''}</button>`;
    for (const k of SUIT_ORDER) {
      const suit = SUITS[k];
      const ok = suitUnlocked(k, s);
      const worn = !auto && s.suit === k;
      html += `<button class="card ${ok ? '' : 'locked'} ${worn ? 'worn' : ''}" data-suit="${k}" ${ok ? '' : 'disabled'}>
        <div class="swatch" style="background: linear-gradient(135deg, ${suit.main} 0 55%, ${suit.second} 55% 100%)"><span style="color:${suit.emblem}">🕷</span></div>
        <b>${esc(suit.name)}</b><small>${esc(ok ? suit.bonusText : `🔒 ${suit.unlockText}`)}</small>${worn ? '<i class="tag">Porté</i>' : ''}</button>`;
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  _skills() {
    const s = this.game.save;
    let html = `<p class="menu-note">Points disponibles : <b class="pts">${s.skillPoints}</b> — tu gagnes 1 point par niveau, par boss vaincu et par base démantelée.</p><div class="branches">`;
    for (const br of BRANCHES) {
      html += `<div class="branch"><h3 style="color:${br.color}">${br.name}</h3>`;
      for (const sk of SKILLS.filter((x) => x.branch === br.key)) {
        const owned = s.skills.includes(sk.key);
        const reqOk = !sk.req || s.skills.includes(sk.req);
        const buy = canBuy(sk, s);
        const state = owned ? 'owned' : !reqOk ? 'locked' : buy ? 'buy' : 'poor';
        const label = owned ? '✔ Acquis' : !reqOk ? '🔒 Prérequis' : `${sk.cost} pt${sk.cost > 1 ? 's' : ''}`;
        html += `<button class="skill ${state}" data-skill="${sk.key}" ${buy ? '' : 'disabled'} style="--c:${br.color}"><b>${esc(sk.name)}</b><small>${esc(sk.desc)}</small><i>${label}</i></button>`;
      }
      html += '</div>';
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  _trophies() {
    const got = this.game.save.achievements || [];
    let html = `<p class="menu-note">Trophées : <b>${got.length}/${ACHIEVEMENTS.length}</b></p><div class="trophies">`;
    for (const a of ACHIEVEMENTS) {
      const ok = got.includes(a.key);
      html += `<div class="trophy ${ok ? 'ok' : ''}"><span class="ti">${ok ? a.icon : '🔒'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div></div>`;
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  _options() {
    const st = this.game.save.settings;
    const opt = (key, val, label) => `<button class="chip ${st[key] === val ? 'on' : ''}" data-opt="${key}" data-val="${val}">${label}</button>`;
    this.body.innerHTML = `<div class="options">
      <div class="opt-line"><span>Météo</span>${opt('weather', 'auto', 'Auto')}${opt('weather', 'clear', 'Soleil')}${opt('weather', 'rain', 'Pluie')}</div>
      <div class="opt-line"><span>Heure</span>${opt('timeMode', 'auto', 'Cycle')}${opt('timeMode', 'day', 'Jour')}${opt('timeMode', 'dusk', 'Coucher')}${opt('timeMode', 'night', 'Nuit')}</div>
      <div class="opt-line"><span>Aide à la caméra</span>${opt('autoCam', true, 'Oui')}${opt('autoCam', false, 'Non')}</div>
      <div class="opt-line"><span>Vibrations d'écran</span>${opt('shake', true, 'Oui')}${opt('shake', false, 'Non')}</div>
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
      return;
    }
    const optBtn = e.target.closest('[data-opt]');
    if (optBtn) {
      let val = optBtn.dataset.val;
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      g.setOption(optBtn.dataset.opt, val);
      g.audio.play('ui');
      this._options();
    }
  }
}
