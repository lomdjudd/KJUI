// Interface en jeu : barres de vie/endurance/mana, niveau, fioles, pouvoirs, boussole,
// mini-carte, suivi de quête, barre de boss, cible verrouillée, chiffres de dégâts,
// barres des ennemis, notifications, bannières et écran de chargement.
import * as THREE from 'three';
import { settings } from '../core/settings.js';
import { powerById } from '../data/skills.js';
import { xpForLevel } from '../game/state.js';
import { el, clamp, wrapAngle, formatNumber, escapeHtml } from '../core/utils.js';
import { renderZoneMap, mapSymbols, drawSymbol } from './map.js';
import { objectiveNeed } from '../game/quests.js';

const _v = new THREE.Vector3();

const TIPS = [
  'Une parade au tout début d’un coup ennemi l’étourdit : votre riposte fera des ravages.',
  'Roulez à travers les attaques : vous êtes invulnérable pendant la roulade.',
  'Les zones rouges au sol annoncent les attaques des boss. Sortez-en !',
  'Reposez-vous près d’un feu pour tout recharger et sauvegarder.',
  'Les éclats d’âme servent à acheter armes, tenues et pouvoirs au Havre.',
  'Chaque boss vaincu rapporte un point de compétence.',
  'Le feu brûle les morts-vivants, la foudre ébranle les armures.',
  'Appuyez sur V (ou l’icône œil) pour passer en vue à la première personne.',
  'Gorvald le forgeron peut améliorer vos armes jusqu’à +5.',
  'Attention aux coffres des catacombes : certains ont des dents.',
  'Les ondes de choc se sautent ou se traversent en roulade.',
  'Verrouillez une cible (T / clic molette / bouton cible) pour tourner autour.',
];

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.dmgPool = [];
    this.barPool = [];
    this.mapT = 0;
    this.toastT = 0;
    this.build();
    settings.onChange(() => this.applySettings());
    this.applySettings();
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div class="hud-scale" id="hs">
        <div id="player-frame">
          <div id="lvl-badge"><svg viewBox="0 0 66 66"><circle cx="33" cy="33" r="31" fill="none" stroke="#2a1c3a" stroke-width="3"/><circle id="xp-ring" cx="33" cy="33" r="31" fill="none" stroke="#f0d48a" stroke-width="3" stroke-dasharray="195" stroke-dashoffset="195"/></svg><span id="lvl">1</span></div>
          <div>
            <div class="bars">
              <div class="bar hp"><div class="lag" id="hp-lag"></div><div class="fill" id="hp-fill"></div><div class="txt" id="hp-txt"></div></div>
              <div class="bar st"><div class="fill" id="st-fill"></div></div>
              <div class="bar mp"><div class="fill" id="mp-fill"></div></div>
            </div>
            <div id="flasks"><div class="flask heal"><i></i><span id="fl-heal">3</span><span class="key">R</span></div><div class="flask mana"><i></i><span id="fl-mana">1</span><span class="key">X</span></div></div>
            <div id="statuses"></div>
          </div>
        </div>
      </div>
      <div id="shards"><div class="shard-ico"></div><span id="shard-n">0</span></div>
      <div id="compass"><div class="needle"></div></div>
      <div id="minimap-wrap"><canvas id="minimap" width="150" height="150"></canvas><div id="zone-name"></div><div id="tracker"></div></div>
      <div id="saving">Sauvegarde…</div>
      <div id="powers"></div>
      <div id="boss-bar"><div class="name" id="boss-name"></div><div class="title" id="boss-title"></div><div class="bar"><div class="lag" id="boss-lag"></div><div class="fill" id="boss-fill"></div></div><div class="poise"><div id="boss-poise"></div></div><div class="stars" id="boss-stars"></div></div>
      <div id="reticle"></div><div id="crosshair"></div>
      <div id="ebars"></div><div id="dmgs"></div>
      <div id="toast"></div><div id="phase-msg"></div>
      <div id="notifs"></div>
      <div id="prompt"></div>
      <div id="exec-prompt"></div>
      <div id="sneak-ind">◐ Furtif</div>
      <div id="banner"><div class="big"></div><div class="sub"></div></div>
      <div id="zone-title"><div class="n"></div><div class="line"></div><div class="s"></div></div>
      <div id="fps"></div>`;
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    this.e = {
      hpFill: $('hp-fill'), hpLag: $('hp-lag'), hpTxt: $('hp-txt'), stFill: $('st-fill'), mpFill: $('mp-fill'), lvl: $('lvl'), xpRing: $('xp-ring'),
      flHeal: $('fl-heal'), flMana: $('fl-mana'), statuses: $('statuses'), shardN: $('shard-n'), shards: $('shards'), compass: $('compass'),
      minimap: $('minimap'), zoneName: $('zone-name'), tracker: $('tracker'), powers: $('powers'), bossBar: $('boss-bar'), bossFill: $('boss-fill'),
      bossLag: $('boss-lag'), bossName: $('boss-name'), bossTitle: $('boss-title'), bossStars: $('boss-stars'), bossPoise: $('boss-poise'),
      reticle: $('reticle'), crosshair: $('crosshair'), ebars: $('ebars'), dmgs: $('dmgs'), toast: $('toast'), notifs: $('notifs'), prompt: $('prompt'),
      banner: $('banner'), zoneTitle: $('zone-title'), fps: $('fps'), phase: $('phase-msg'), saving: $('saving'),
    };
    this.mctx = this.e.minimap.getContext('2d');
    // Boussole
    this.compassItems = [];
    for (const [lbl, a, major] of [['N', Math.PI, 1], ['NE', Math.PI * 0.75], ['E', Math.PI / 2, 1], ['SE', Math.PI / 4], ['S', 0, 1], ['SO', -Math.PI / 4], ['O', -Math.PI / 2, 1], ['NO', -Math.PI * 0.75]]) {
      const d = el('div', 'c-item' + (major ? ' major' : ''), lbl);
      this.e.compass.appendChild(d);
      this.compassItems.push({ el: d, a });
    }
    this.compassMarks = [];
    for (let i = 0; i < 8; i++) {
      const m = el('div', 'c-mark');
      const t = el('div', 'c-dist');
      m.style.display = t.style.display = 'none';
      this.e.compass.append(m, t);
      this.compassMarks.push({ m, t });
    }
    // Pouvoirs
    this.pslots = [];
    for (let i = 0; i < 4; i++) {
      const s = el('div', 'pslot', `<span class="ic"></span><div class="cd"></div><span class="cost"></span><span class="key">${i + 1}</span>`);
      this.e.powers.appendChild(s);
      this.pslots.push(s);
    }
    this.hpLagV = 1;
  }

  applySettings() {
    const s = settings.values;
    document.documentElement.style.setProperty('--hud-scale', s.hudScale);
    document.documentElement.style.setProperty('--hud-opacity', s.hudOpacity);
    document.getElementById('minimap-wrap').style.display = s.minimap ? '' : 'none';
    this.e.compass.style.display = s.compass ? '' : 'none';
    this.e.fps.style.display = s.showFps ? 'block' : 'none';
  }

  setVisible(v) {
    this.root.classList.toggle('hidden', !v);
  }

  // ---------------- Chargement ----------------
  showLoading(zone) {
    const l = document.getElementById('loading');
    l.querySelector('h2').textContent = zone.name;
    l.querySelector('p').textContent = zone.subtitle;
    l.querySelector('.tip').textContent = settings.get('tips') ? TIPS[Math.floor(Math.random() * TIPS.length)] : '';
    l.classList.add('show');
  }
  hideLoading() {
    document.getElementById('loading').classList.remove('show');
    this.zoneMap = renderZoneMap(this.game.world);
  }

  zoneTitle(zone) {
    const z = this.e.zoneTitle;
    z.querySelector('.n').textContent = zone.name;
    z.querySelector('.s').textContent = zone.subtitle + (zone.level && !zone.safe ? ` · Niveau ${zone.level[0]}–${zone.level[1]}` : '');
    this.e.zoneName.textContent = zone.name;
    if (this.game.state === 'title') return;
    z.classList.add('show');
    clearTimeout(this._zt);
    this._zt = setTimeout(() => z.classList.remove('show'), 3500);
  }

  // ---------------- Rafraîchissements ----------------
  refreshAll() {
    this.refreshFlasks();
    this.refreshPowers();
    this.refreshQuestTracker();
    this.e.lvl.textContent = this.game.profile.level;
    this.e.shardN.textContent = formatNumber(this.game.profile.shards);
    this.setVisible(this.game.state !== 'title');
  }

  refreshFlasks() {
    const p = this.game.player;
    this.e.flHeal.textContent = p.flasks;
    this.e.flMana.textContent = p.manaFlasks;
    if (this.game.touch) this.game.touch.refresh();
  }

  refreshPowers() {
    const prof = this.game.profile;
    this.pslots.forEach((s, i) => {
      const id = prof.powerSlots[i];
      const pw = id ? powerById(id) : null;
      s.querySelector('.ic').textContent = pw ? pw.icon : '';
      s.querySelector('.cost').textContent = pw ? pw.mana : '';
      s.classList.toggle('sel', i === prof.powerIndex);
      s.title = pw ? pw.name : '';
    });
    if (this.game.touch) this.game.touch.refresh();
  }

  refreshQuestTracker() {
    const q = this.game.quests.tracked();
    if (!q) {
      this.e.tracker.innerHTML = '';
      return;
    }
    const cur = this.game.quests.currentObjective(q);
    const need = cur ? cur.need : 1;
    this.e.tracker.innerHTML = `<div class="q-title ${q.main ? '' : 'side'}">${q.main ? '✦ ' : ''}${escapeHtml(q.title)}</div>` + (cur ? `<div class="q-obj">${escapeHtml(cur.o.label)}${need > 1 ? ` (${cur.progress}/${need})` : ''}</div>` : '');
  }

  // ---------------- Messages ----------------
  toast(msg, warn = false) {
    const t = this.e.toast;
    t.textContent = msg;
    t.classList.toggle('warn', warn);
    t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), 1600);
  }

  notify(head, text, type = 'main') {
    const n = el('div', 'notif ' + type, `<div class="h">${escapeHtml(head)}</div><div class="t">${escapeHtml(text)}</div>`);
    this.e.notifs.appendChild(n);
    while (this.e.notifs.children.length > 4) this.e.notifs.firstChild.remove();
    setTimeout(() => n.remove(), 5200);
  }

  questProgress(label, cur, need) {
    this.toast(`${label} : ${cur}/${need}`);
  }

  questComplete(title, r) {
    this.bigBanner('QUÊTE ACCOMPLIE', title + (r && r.shards ? ` — ${formatNumber(r.shards)} éclats, ${formatNumber(r.xp || 0)} XP` : ''), 'quest');
  }

  bigBanner(big, sub, cls = '') {
    const b = this.e.banner;
    b.className = 'show ' + cls;
    b.querySelector('.big').textContent = big;
    b.querySelector('.sub').textContent = sub || '';
    clearTimeout(this._bt);
    this._bt = setTimeout(() => (b.className = ''), 3200);
  }

  levelUp(level) {
    this.e.lvl.textContent = level;
    this.bigBanner('NIVEAU ' + level, 'Vous vous sentez plus fort · +1 point de compétence', 'level');
  }

  shardGain(n) {
    this.e.shardN.textContent = formatNumber(this.game.profile.shards);
    const g = el('div', 'gain', '+' + formatNumber(n));
    this.e.shards.appendChild(g);
    setTimeout(() => g.remove(), 1400);
  }

  saving() {
    this.e.saving.classList.add('show');
    clearTimeout(this._st);
    this._st = setTimeout(() => this.e.saving.classList.remove('show'), 1500);
  }

  // Invite d'exécution / assassinat (ennemi vulnérable devant soi)
  execPrompt(text) {
    const p = this.execEl || (this.execEl = document.getElementById('exec-prompt'));
    if (!p) return;
    if (!text) {
      if (this._exec) {
        p.classList.remove('show');
        this._exec = null;
      }
      return;
    }
    if (this._exec === text) return;
    this._exec = text;
    const inp = this.game.input;
    const key = inp.isTouch ? '⚔' : inp.lastDevice === 'gamepad' ? 'X' : 'Clic';
    p.innerHTML = `<span class="k">${key}</span>${escapeHtml(text)}`;
    p.classList.add('show');
  }

  setSneak(on) {
    const el2 = document.getElementById('sneak-ind');
    if (el2) el2.classList.toggle('show', on);
  }

  prompt(text) {
    const p = this.e.prompt;
    if (!text) {
      if (this._prompt) {
        p.classList.remove('show');
        this._prompt = null;
      }
      return;
    }
    if (this._prompt === text) return;
    this._prompt = text;
    const key = this.game.input.isTouch ? '✋' : this.game.input.lastDevice === 'gamepad' ? 'A' : 'E';
    p.innerHTML = `<span class="k">${key}</span>${escapeHtml(text)}`;
    p.classList.add('show');
    p.onclick = () => this.game.input.tap('interact');
  }

  // ---------------- Boss ----------------
  bossStart(def, boss) {
    this.boss = boss;
    this.e.bossName.textContent = def.name;
    this.e.bossTitle.textContent = def.title;
    this.e.bossStars.textContent = '★'.repeat(def.stars) + '☆'.repeat(5 - def.stars);
    this.e.bossBar.classList.add('show');
    this.bossLagV = 1;
    this.bigBanner(def.name.toUpperCase(), def.intro, 'boss');
  }
  bossEnd() {
    this.boss = null;
    this.e.bossBar.classList.remove('show');
  }
  bossPhase(msg) {
    const e = this.e.phase;
    e.textContent = msg;
    e.classList.add('show');
    clearTimeout(this._pt);
    this._pt = setTimeout(() => e.classList.remove('show'), 3500);
  }

  // ---------------- Chiffres de dégâts ----------------
  damageNumber(pos, dmg, crit, color, small = false) {
    let d = this.dmgPool.find((x) => !x.active);
    if (!d) {
      if (this.dmgPool.length > 30) return;
      d = { el: el('div', 'dmg'), active: false, pos: new THREE.Vector3() };
      this.e.dmgs.appendChild(d.el);
      this.dmgPool.push(d);
    }
    d.active = true;
    d.t = 0;
    d.pos.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y, pos.z + (Math.random() - 0.5) * 0.6);
    d.el.className = 'dmg' + (crit ? ' crit' : '') + (small ? ' small' : '');
    d.el.style.color = color || '';
    d.el.textContent = Math.round(dmg) + (crit ? '!' : '');
    d.el.style.display = 'block';
  }

  _project(pos) {
    _v.copy(pos).project(this.game.camera);
    if (_v.z > 1) return null;
    return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight };
  }

  // ---------------- Mise à jour par image ----------------
  update(dt) {
    const g = this.game;
    const p = g.player;
    const prof = g.profile;
    const e = this.e;
    const hpR = clamp(p.hp / p.maxHp, 0, 1);
    e.hpFill.style.width = hpR * 100 + '%';
    this.hpLagV = hpR > this.hpLagV ? hpR : this.hpLagV + (hpR - this.hpLagV) * Math.min(1, dt * 2.5);
    e.hpLag.style.width = this.hpLagV * 100 + '%';
    e.hpTxt.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    e.stFill.style.width = clamp(p.stamina / p.maxStamina, 0, 1) * 100 + '%';
    if (p.exhausted !== this._exh) {
      this._exh = p.exhausted;
      e.stFill.parentElement.classList.toggle('exhausted', !!p.exhausted);
    }
    e.mpFill.style.width = clamp(p.mana / p.maxMana, 0, 1) * 100 + '%';
    e.xpRing.style.strokeDashoffset = 195 * (1 - prof.xp / xpForLevel(prof.level));
    // États
    const st = Object.entries(p.status).filter(([, s]) => s.t > 0);
    const buffs = Object.keys(p.buffs);
    const key = st.map(([k]) => k).join(',') + '|' + buffs.join(',');
    if (key !== this._stKey) {
      this._stKey = key;
      const names = { burn: ['Brûlure', '#ff8a3a'], poison: ['Poison', '#7aff3a'], slow: ['Lenteur', '#7ad4ff'], freeze: ['Gel', '#bfe8ff'], stun: ['Étourdi', '#ffe066'], shock: ['Choc', '#b8d8ff'] };
      const bn = { berserk: ['Rage', '#ff4a6a'], fury: ['Furie', '#ff8a4a'], soulShield: ['Bouclier', '#4dd8ff'] };
      e.statuses.innerHTML = st.map(([k]) => (names[k] ? `<span class="status-ico" style="color:${names[k][1]};border-color:${names[k][1]}">${names[k][0]}</span>` : '')).join('') + buffs.map((k) => (bn[k] ? `<span class="status-ico" style="color:${bn[k][1]};border-color:${bn[k][1]}">${bn[k][0]}</span>` : '')).join('');
    }
    // Pouvoirs (recharges)
    this.pslots.forEach((s, i) => {
      const id = prof.powerSlots[i];
      const cd = id ? p.cooldowns[id] || 0 : 0;
      const max = (p.cooldownMax && p.cooldownMax[id]) || 1;
      s.querySelector('.cd').style.setProperty('--p', (cd > 0 ? (cd / max) * 100 : 0) + '%');
      const pw = id ? powerById(id) : null;
      s.classList.toggle('nomana', !!pw && p.mana < pw.mana);
    });
    // Boussole
    if (settings.get('compass')) this._compass();
    // Mini-carte
    this.mapT -= dt;
    if (this.mapT <= 0 && settings.get('minimap')) {
      this.mapT = 0.1;
      this._minimap();
    }
    // Cible verrouillée / viseur
    const lt = p.lockTarget;
    if (lt && lt.alive) {
      const s = this._project(_v.set(lt.pos.x, lt.pos.y + lt.hover + lt.height * 0.55, lt.pos.z));
      if (s) {
        e.reticle.classList.add('show');
        e.reticle.style.left = s.x + 'px';
        e.reticle.style.top = s.y + 'px';
      } else e.reticle.classList.remove('show');
    } else e.reticle.classList.remove('show');
    e.crosshair.classList.toggle('show', g.camRig.mode === 'first' && !lt);
    // Barre de boss
    if (this.boss) {
      const b = this.boss;
      const r = clamp(b.hp / b.maxHp, 0, 1);
      e.bossFill.style.width = r * 100 + '%';
      this.bossLagV = r > this.bossLagV ? r : this.bossLagV + (r - this.bossLagV) * Math.min(1, dt * 1.5);
      e.bossLag.style.width = this.bossLagV * 100 + '%';
      e.bossPoise.style.width = clamp(b.poise / b.maxPoise, 0, 1) * 100 + '%';
    }
    this._enemyBars();
    this._damageNumbers(dt);
    if (settings.get('showFps')) e.fps.textContent = `${Math.round(g.fps)} i/s · ${Math.round(g.renderer.dynScale * 100)}% · ${g.renderer.renderer.info.render.calls} dc`;
  }

  _compass() {
    const g = this.game;
    const yaw = g.camRig.yaw;
    const W = this.e.compass.clientWidth || 420;
    const span = Math.PI * 0.6;
    for (const it of this.compassItems) {
      const rel = wrapAngle(it.a - yaw);
      const x = W / 2 - (rel / span) * (W / 2);
      it.el.style.display = Math.abs(rel) < span ? '' : 'none';
      it.el.style.left = x + 'px';
    }
    const marks = g.quests.markers();
    const p = g.player.pos;
    const extra = [];
    if (g.activeBoss) extra.push({ x: g.activeBoss.pos.x, z: g.activeBoss.pos.z, boss: true });
    const all = [...extra, ...marks].slice(0, this.compassMarks.length);
    this.compassMarks.forEach((cm, i) => {
      const m = all[i];
      if (!m) {
        cm.m.style.display = cm.t.style.display = 'none';
        return;
      }
      const a = Math.atan2(m.x - p.x, m.z - p.z);
      let rel = wrapAngle(a - yaw);
      rel = clamp(rel, -span * 0.95, span * 0.95);
      const x = W / 2 - (rel / span) * (W / 2);
      cm.m.className = 'c-mark' + (m.boss ? ' boss' : m.main ? '' : ' side');
      cm.m.style.display = cm.t.style.display = '';
      cm.m.style.left = cm.t.style.left = x + 'px';
      cm.t.textContent = Math.round(Math.hypot(m.x - p.x, m.z - p.z)) + ' m';
    });
  }

  _minimap() {
    const g = this.game;
    const ctx = this.mctx;
    const W = this.e.minimap.width;
    const t = g.world.terrain;
    if (!t || !this.zoneMap) return;
    const p = g.player.pos;
    const range = 55;
    const scale = W / (range * 2);
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#050308';
    ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    // Carte tournée selon la caméra (haut = direction regardée)
    ctx.rotate(-(Math.PI - g.camRig.yaw));
    const mapScale = (this.zoneMap.width / t.size) ;
    const sx = (p.x + t.half) * mapScale;
    const sz = (p.z + t.half) * mapScale;
    const k = scale / mapScale;
    ctx.drawImage(this.zoneMap, -sx * k, -sz * k, this.zoneMap.width * k, this.zoneMap.height * k);
    const toMap = (x, z) => [(x - p.x) * scale, (z - p.z) * scale];
    for (const s of mapSymbols(g)) {
      const [x, y] = toMap(s.x, s.z);
      if (Math.hypot(x, y) > W / 2 + 6) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI - g.camRig.yaw);
      drawSymbol(ctx, 0, 0, s.kind, 0.9);
      ctx.restore();
    }
    for (const e of g.enemies) {
      if (!e.alive || e.state === 'dormant' || e.def.invisible) continue;
      const [x, y] = toMap(e.pos.x, e.pos.z);
      if (Math.hypot(x, y) > W / 2) continue;
      drawSymbol(ctx, x, y, e.isBoss ? 'boss' : 'enemy', e.isBoss ? 0.9 : 1);
    }
    ctx.restore();
    // Joueur (flèche fixe au centre)
    ctx.save();
    ctx.translate(W / 2, W / 2);
    ctx.rotate(-(g.player.yaw - g.camRig.yaw));
    ctx.fillStyle = '#f0d48a';
    ctx.shadowColor = '#f0d48a';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _enemyBars() {
    const g = this.game;
    const show = settings.get('enemyBars');
    const list = show
      ? g.enemies.filter((e) => e.alive && !e.isBoss && !e.clone && e.state !== 'dormant' && (e.hp < e.maxHp || e.state === 'chase' || e.state === 'attack') && e.distTo(g.player) < 22 && e.dissolve < 0.5).slice(0, 10)
      : [];
    while (this.barPool.length < list.length) {
      const b = el('div', 'ebar', '<div></div><span class="nm"></span>');
      this.e.ebars.appendChild(b);
      this.barPool.push(b);
    }
    this.barPool.forEach((b, i) => {
      const e = list[i];
      if (!e) {
        b.style.display = 'none';
        return;
      }
      const s = this._project(_v.set(e.pos.x, e.pos.y + e.hover + e.height + 0.35, e.pos.z));
      if (!s) {
        b.style.display = 'none';
        return;
      }
      b.style.display = 'block';
      b.style.left = s.x + 'px';
      b.style.top = s.y + 'px';
      b.firstChild.style.width = clamp(e.hp / e.maxHp, 0, 1) * 100 + '%';
      const nm = b.lastChild;
      if (nm.textContent !== e.def.name) nm.textContent = e.def.name;
    });
  }

  _damageNumbers(dt) {
    for (const d of this.dmgPool) {
      if (!d.active) continue;
      d.t += dt;
      if (d.t > 0.9) {
        d.active = false;
        d.el.style.display = 'none';
        continue;
      }
      d.pos.y += dt * 1.2;
      const s = this._project(d.pos);
      if (!s) {
        d.el.style.display = 'none';
        continue;
      }
      d.el.style.display = 'block';
      const sc = d.t < 0.1 ? 1 + (0.1 - d.t) * 6 : 1;
      d.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${sc})`;
      d.el.style.left = '0';
      d.el.style.top = '0';
      d.el.style.opacity = d.t > 0.6 ? String(1 - (d.t - 0.6) / 0.3) : '1';
    }
  }
}

export { objectiveNeed };
