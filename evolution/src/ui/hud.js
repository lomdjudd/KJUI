// Interface en jeu : barres de survie, ADN, objectifs, mini-carte, barre d'objets.
import { G, bus } from '../core/state.js';
import { stageDef } from '../data/stages.js';
import { item } from '../data/items.js';
import { eraOf } from '../data/tech.js';
import { SPECIES } from '../data/species.js';
import { TITLES, CAREERS } from '../systems/civdata.js';
import { currentObjective } from '../systems/objectives.js';
import { canEvolve } from '../systems/evolution.js';
import { fmtYear, fmtNum, escapeHtml, clamp } from '../core/util.js';
import { SIZE } from '../world/terrain.js';
import { MICRO_R } from '../world/micro.js';

const STAGE_ICONS = ['🦠', '🧫', '🐟', '🐸', '🦎', '🐺', '🐒', '🧔', '🧑'];

export class HUD {
  constructor() {
    this.root = document.getElementById('ui');
    this.root.insertAdjacentHTML(
      'beforeend',
      `<div id="hud" class="hidden">
        <div class="hud-tl card">
          <div class="stage-row"><span id="h-icon" class="h-icon"></span><div><div id="h-stage" class="h-stage"></div><div id="h-era" class="h-era"></div></div></div>
          <div class="bar-row"><span>❤️</span><div class="bar"><div id="b-hp" class="fill hp"></div></div><span id="t-hp" class="bt"></span></div>
          <div class="bar-row"><span>🍖</span><div class="bar"><div id="b-food" class="fill food"></div></div></div>
          <div class="bar-row" id="row-water"><span>💧</span><div class="bar"><div id="b-water" class="fill water"></div></div></div>
          <div class="bar-row"><span>⚡</span><div class="bar thin"><div id="b-sta" class="fill sta"></div></div></div>
          <div class="bar-row dna-row"><span>🧬</span><div class="bar"><div id="b-dna" class="fill dna"></div></div><span id="t-dna" class="bt"></span></div>
          <div id="h-res" class="h-res"></div>
          <div id="h-effects" class="h-effects"></div>
        </div>
        <div class="hud-tc">
          <div id="h-obj" class="objective"></div>
          <div id="toasts"></div>
        </div>
        <div class="hud-tr">
          <canvas id="minimap" width="180" height="180"></canvas>
          <div id="h-clock" class="clock"></div>
        </div>
        <div id="h-prompt" class="prompt hidden"></div>
        <div id="crosshair">+</div>
        <div id="hotbar" class="hotbar"></div>
        <div class="hud-br" id="menu-btns">
          <button data-p="inventory" title="Inventaire & fabrication (I)">🎒</button>
          <button data-p="build" title="Construire (B)">🔨</button>
          <button data-p="tech" title="Technologies (T)">🔬</button>
          <button data-p="genetics" title="Génétique / Évolution (G)">🧬</button>
          <button data-p="civ" title="Civilisation (V)">🏛️</button>
          <button data-p="map" title="Carte (M)">🗺️</button>
          <button data-p="pause" title="Menu (Échap)">⏸️</button>
        </div>
        <div id="h-keys" class="hud-bl"></div>
      </div>
      <div id="floaters"></div>
      <div id="hurt"></div>`,
    );
    this.$ = (id) => document.getElementById(id);
    this.mini = this.$('minimap').getContext('2d');
    this.t = 0;
    this.hurtT = 0;
    this.root.querySelectorAll('#menu-btns button').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        bus.emit('openPanel', b.dataset.p);
      }),
    );
    this.$('hotbar').addEventListener('click', (e) => {
      const s = e.target.closest('.slot');
      if (s) G.hotSel = +s.dataset.i;
    });
    bus.on('toast', (t, k) => this.toast(t, k));
    bus.on('hurt', () => (this.hurtT = 0.4));
    bus.on('gain', (id, n) => {
      if (G.player && G.mode === 'world') G.fx.text(G.player.pos.clone().setY(G.player.pos.y + G.player.size + 0.4), `+${n} ${item(id).icon}`, '#ffffff');
    });
  }

  show(on) {
    this.$('hud').classList.toggle('hidden', !on);
  }

  toast(text, kind = 'info') {
    const box = this.$('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4800);
  }

  buildTerrainMap() {
    const c = document.createElement('canvas');
    const N = 256;
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    const w = G.world;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const wx = (x / N - 0.5) * SIZE;
        const wz = (y / N - 0.5) * SIZE;
        const h = w.height(wx, wz);
        let r;
        let g;
        let b;
        if (h < -10) [r, g, b] = [20, 60, 110];
        else if (h < 0) [r, g, b] = [40, 110, 160];
        else if (h < 1.6) [r, g, b] = [220, 205, 150];
        else if (h < 30) [r, g, b] = [70 + h * 1.5, 140 - h, 60];
        else if (h < 60) [r, g, b] = [120, 115, 105];
        else [r, g, b] = [240, 240, 245];
        const i = (y * N + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.terrainMap = c;
    return c;
  }

  drawMinimap() {
    const ctx = this.mini;
    const W = 180;
    const P = G.player;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    if (G.mode === 'micro') {
      ctx.fillStyle = '#0a3a3a';
      ctx.fillRect(0, 0, W, W);
      const scale = W / 2 / 60;
      const radar = G.mutations.includes('oeil') || G.stage === 0;
      for (const c of G.creatures.list) {
        if (!c.alive) continue;
        const dx = (c.pos.x - P.pos.x) * scale;
        const dz = (c.pos.z - P.pos.z) * scale;
        if (Math.hypot(dx, dz) > W / 2) continue;
        const danger = c.size > P.size * 1.05 && (c.def.behavior === 'predator' || c.def.behavior === 'hazard');
        if (!radar && !danger) continue;
        ctx.fillStyle = danger ? '#ff4040' : c.size < P.size * 0.8 ? '#60ff90' : '#ffd040';
        ctx.beginPath();
        ctx.arc(W / 2 + dx, W / 2 + dz, Math.max(1.5, c.size * scale * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
      // Bord de la goutte
      ctx.strokeStyle = '#3affd0';
      ctx.beginPath();
      ctx.arc(W / 2 - P.pos.x * scale, W / 2 - P.pos.z * scale, MICRO_R * scale, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const map = this.terrainMap || this.buildTerrainMap();
      const N = map.width;
      const viewWorld = 240;
      const sx = ((P.pos.x + SIZE / 2) / SIZE) * N;
      const sy = ((P.pos.z + SIZE / 2) / SIZE) * N;
      const sw = (viewWorld / SIZE) * N;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(map, sx - sw / 2, sy - sw / 2, sw, sw, 0, 0, W, W);
      const toMap = (x, z) => [W / 2 + ((x - P.pos.x) / viewWorld) * W, W / 2 + ((z - P.pos.z) / viewWorld) * W];
      for (const b of G.buildings) {
        const [x, y] = toMap(b.x, b.z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
      if (G.village) {
        const [x, y] = toMap(G.village.x, G.village.z);
        ctx.fillStyle = '#ffd040';
        ctx.font = '14px sans-serif';
        ctx.fillText('🏠', x - 7, y + 5);
      }
      for (const f of G.factions) {
        if (f.conquered) continue;
        const [x, y] = toMap(f.x, f.z);
        ctx.fillStyle = '#' + f.color.toString(16).padStart(6, '0');
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        if (f.war) {
          ctx.font = '11px sans-serif';
          ctx.fillText('⚔️', x - 6, y - 6);
        }
      }
      for (const c of G.creatures.list) {
        if (!c.alive) continue;
        const [x, y] = toMap(c.pos.x, c.pos.z);
        ctx.fillStyle = c.hostile ? '#ff3030' : 'rgba(255,255,255,0.6)';
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      for (const n of G.npcs.list) {
        if (!n.alive) continue;
        const [x, y] = toMap(n.pos.x, n.pos.z);
        ctx.fillStyle = n.side === 'enemy' ? '#ff00ff' : n.side === 'ally' ? '#40e0ff' : '#ffe080';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    ctx.restore();
    // Joueur (flèche orientée selon la caméra)
    ctx.save();
    ctx.translate(W / 2, W / 2);
    ctx.rotate(-P.camYaw + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('N', W / 2 - 4, 14);
  }

  update(dt) {
    const P = G.player;
    if (!P) return;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.$('hurt').style.opacity = String(this.hurtT * 2 + (P.hp < P.maxHp() * 0.25 ? 0.25 + Math.sin(G.elapsed * 6) * 0.1 : 0));
    // Barres (chaque frame, peu coûteux)
    const st = stageDef(G.stage);
    this.$('b-hp').style.width = clamp((P.hp / P.maxHp()) * 100, 0, 100) + '%';
    this.$('b-food').style.width = P.hunger + '%';
    this.$('b-water').style.width = P.thirst + '%';
    this.$('b-sta').style.width = P.stamina + '%';
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.15;
    this.$('row-water').style.display = st.env === 'land' ? '' : 'none';
    this.$('t-hp').textContent = `${Math.ceil(P.hp)}/${Math.round(P.maxHp())}`;
    this.$('h-icon').textContent = G.monster ? '👹' : STAGE_ICONS[G.stage];
    this.$('h-stage').textContent = G.monster ? 'Monstre hybride' : st.name;
    const era = G.stage >= 8 ? eraOf(G.time.year).name + ' · ' : '';
    this.$('h-era').textContent = era + fmtYear(G.time.year);
    // ADN
    if (G.stage < 8) {
      const need = st.dna;
      this.$('b-dna').style.width = clamp((G.dna / need) * 100, 0, 100) + '%';
      this.$('t-dna').textContent = `${Math.floor(G.dna)}/${need}`;
      this.$('b-dna').classList.toggle('ready', canEvolve());
    } else {
      this.$('b-dna').style.width = '100%';
      this.$('t-dna').textContent = `${Math.floor(G.dna)}`;
    }
    // Ressources
    const res = [];
    if (G.stage >= 7) res.push(`📚 ${fmtNum(G.savoir)}`);
    if (G.techs.includes('commerce') || G.money > 0) res.push(`💰 ${fmtNum(G.money)}`);
    if (G.title) res.push(`${G.title === 'president' ? '🎖️' : '👑'} ${TITLES[G.title]}`);
    if (G.career && CAREERS[G.career]) res.push(`${CAREERS[G.career].icon} ${CAREERS[G.career].name}`);
    if (G.village) res.push(`🏠 ${G.village.people.length} hab. · 😊 ${Math.round(G.village.happiness)}%`);
    this.$('h-res').innerHTML = res.map((r) => `<span>${escapeHtml(r)}</span>`).join('');
    // Effets
    const ef = [];
    if (P.poison > 0) ef.push('☠️ Empoisonné');
    if (G.disease) ef.push('🤒 ' + G.disease.name);
    const names = { speed: '⚗️ Vitesse', strength: '💪 Force', invis: '👻 Invisible', giant: '🔮 Géant', fly: '🪽 Vol' };
    for (const [k, v] of Object.entries(P.effects)) if (v > 0) ef.push(`${names[k]} ${Math.ceil(v)}s`);
    if (P.inWater && st.env === 'land') ef.push('🌊 Nage');
    this.$('h-effects').innerHTML = ef.map((e) => `<span>${escapeHtml(e)}</span>`).join('');
    // Objectif
    const o = currentObjective();
    this.$('h-obj').innerHTML = o ? `<b>🎯 Objectif</b> ${escapeHtml(o.text)}` : '';
    this.$('h-obj').style.display = o ? '' : 'none';
    // Horloge
    const h = Math.floor(G.time.hour);
    const m = Math.floor((G.time.hour % 1) * 60);
    this.$('h-clock').textContent = `Jour ${G.time.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    // Invite d'interaction
    const pr = this.$('h-prompt');
    if (G.building) {
      pr.textContent = 'Clic : construire · R : tourner · Échap : annuler';
      pr.classList.remove('hidden');
    } else if (P.prompt && !G.panel) {
      pr.innerHTML = `<kbd>E</kbd> ${escapeHtml(P.prompt)}`;
      pr.classList.remove('hidden');
    } else pr.classList.add('hidden');
    this.$('crosshair').style.display = G.stage >= 6 && G.mode === 'world' && !G.panel ? '' : 'none';
    this.renderHotbar();
    this.renderKeys(st);
    this.drawMinimap();
  }

  renderHotbar() {
    const hb = this.$('hotbar');
    if (G.stage < 6) {
      hb.style.display = 'none';
      return;
    }
    hb.style.display = '';
    let html = '';
    for (let i = 0; i < 9; i++) {
      const id = G.hotbar[i];
      const it = id ? item(id) : null;
      const n = id ? G.inv[id] || 0 : 0;
      html += `<div class="slot ${i === G.hotSel ? 'sel' : ''}" data-i="${i}" title="${it ? escapeHtml(it.name) : ''}"><span class="k">${i + 1}</span>${it ? `<span class="ic">${it.icon}</span><span class="n">${n > 1 ? n : ''}</span>` : ''}</div>`;
    }
    if (hb.innerHTML !== html) hb.innerHTML = html;
    const sel = G.hotbar[G.hotSel];
    hb.dataset.name = sel ? item(sel).name : '';
  }

  renderKeys(st) {
    const k = [];
    if (G.input.isTouch) {
      this.$('h-keys').innerHTML = '';
      return;
    }
    if (st.env !== 'land') k.push('ZQSD nager', 'Espace/C monter/descendre', 'Maj sprint', 'Clic mordre', 'G évoluer');
    else {
      k.push('ZQSD bouger', 'Espace sauter', 'Maj sprint', 'Clic attaquer', 'E interagir');
      if (G.stage >= 6) k.push('F manger/utiliser', '1-9 objets');
      if (G.stage >= 7) k.push('I fabriquer', 'B construire', 'T technologies');
      if (G.stage >= 8) k.push('V civilisation');
      k.push('G génétique', 'M carte');
    }
    const html = k.map((x) => `<span>${x}</span>`).join('');
    if (this.$('h-keys').innerHTML !== html) this.$('h-keys').innerHTML = html;
  }
}

export { STAGE_ICONS, SPECIES };
