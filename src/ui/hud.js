import * as THREE from 'three';
import { makeCanvas, formatTime, clamp } from '../engine/utils.js';
import { N, PITCH, X0, STREET, ISLAND } from '../world/city.js';
import { STYLES, GADGETS } from '../player/combat.js';

const $ = (id) => document.getElementById(id);
const _p = new THREE.Vector3();
const GADGET_GLYPHS = { webbomb: '✺', shock: 'ϟ', drone: '◈', impact: '◉' };

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'),
      hp: $('hp-fill'),
      hpLag: $('hp-lag'),
      focus: $('focus-fill'),
      focusBar: $('focus-fill').parentElement,
      xp: $('xp-fill'),
      lvl: $('lvl'),
      mPanel: $('mission-panel'),
      mTitle: $('mission-title'),
      mObj: $('mission-obj'),
      mTimer: $('mission-timer'),
      toasts: $('toasts'),
      minimap: $('minimap'),
      clock: $('clock'),
      styleName: $('style-name'),
      styleDots: $('style-dots'),
      gadgetName: $('gadget-name'),
      gadgetCd: $('gadget-cd'),
      gadgetGlyph: $('gadget-glyph'),
      combo: $('combo'),
      comboN: $('combo-n'),
      bossBar: $('boss-bar'),
      bossFill: $('boss-fill'),
      bossName: $('boss-name'),
      prompt: $('prompt'),
      hint: $('hint'),
      markers: $('markers-layer'),
      floats: $('float-layer'),
      zip: $('zip-reticle'),
      target: $('target-reticle'),
      sense: $('sense'),
      hurt: $('hurt'),
      flash: $('flash'),
      speed: $('speedlines'),
      bigmap: $('bigmap'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.markerPool = [];
    this.floatsList = [];
    this.hintT = 0;
    this.comboT = 0;
    this.boss = null;
    this.speedCtx = this.el.speed.getContext('2d');
    this._buildStyleDots();
    this.gadgetChanged(GADGETS[0]);
  }

  show(on) {
    this.el.hud.classList.toggle('hidden', !on);
  }

  _buildStyleDots() {
    this.el.styleDots.innerHTML = '';
    for (const s of STYLES) {
      const i = document.createElement('i');
      i.style.setProperty('--c', s.color);
      this.el.styleDots.appendChild(i);
    }
    this.styleChanged(STYLES[0]);
  }

  styleChanged(style) {
    if (this._styleInit && this.game.input.isTouch) this.toast(`Style : ${style.name}`);
    this._styleInit = true;
    this.el.styleName.textContent = style.name;
    this.el.styleName.style.color = style.color;
    [...this.el.styleDots.children].forEach((d, k) => d.classList.toggle('on', STYLES[k] === style));
  }

  gadgetChanged(g) {
    if (this._gadgetInit && this.game.input.isTouch) this.toast(`Gadget : ${g.name}`);
    this._gadgetInit = true;
    this.el.gadgetName.textContent = g.name;
    this.el.gadgetGlyph.textContent = GADGET_GLYPHS[g.key] || '✺';
    this.el.gadgetGlyph.style.color = g.color;
  }

  gadgetUsed() {}

  // ---------- Carte statique pré-rendue ----------
  buildMap() {
    const city = this.game.city;
    const S = 1024;
    const W = ISLAND * 2 + 400; // mètres couverts
    this.mapScale = S / W;
    this.mapW = W;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const tx = (x) => (x + W / 2) * this.mapScale;
    ctx.fillStyle = '#16324a';
    ctx.fillRect(0, 0, S, S);
    // île
    ctx.fillStyle = '#2b3140';
    ctx.fillRect(tx(-ISLAND), tx(-ISLAND), ISLAND * 2 * this.mapScale, ISLAND * 2 * this.mapScale);
    // rues
    ctx.fillStyle = '#434b5e';
    for (let i = 0; i <= N; i++) {
      const s = X0 + i * PITCH;
      ctx.fillRect(tx(s - STREET / 2), tx(-ISLAND + 30), STREET * this.mapScale, (ISLAND * 2 - 60) * this.mapScale);
      ctx.fillRect(tx(-ISLAND + 30), tx(s - STREET / 2), (ISLAND * 2 - 60) * this.mapScale, STREET * this.mapScale);
    }
    // parc
    const pk = city.landmarks.park;
    ctx.fillStyle = '#2f6b35';
    ctx.fillRect(tx(pk.x0), tx(pk.z0), (pk.x1 - pk.x0) * this.mapScale, (pk.z1 - pk.z0) * this.mapScale);
    // immeubles
    for (const b of city.buildings) {
      const h = clamp(b.roof / 200, 0, 1);
      const l = 32 + h * 30;
      ctx.fillStyle = b.role === 'oscorp' ? '#3f9a6a' : `hsl(222, 14%, ${l}%)`;
      const x0 = b.fx0 !== undefined ? b.fx0 : b.x0;
      const x1 = b.fx1 !== undefined ? b.fx1 : b.x1;
      const z0 = b.fz0 !== undefined ? b.fz0 : b.z0;
      const z1 = b.fz1 !== undefined ? b.fz1 : b.z1;
      ctx.fillRect(tx(x0), tx(z0), Math.max(1, (x1 - x0) * this.mapScale), Math.max(1, (z1 - z0) * this.mapScale));
    }
    // pont
    const br = city.landmarks.bridge;
    ctx.fillStyle = '#8a8f96';
    ctx.fillRect(tx(ISLAND), tx(br.z - 11), 520 * this.mapScale, 22 * this.mapScale);
    ctx.fillStyle = '#35423a';
    ctx.fillRect(tx(ISLAND + 520), 0, S - tx(ISLAND + 520), S);
    this.mapCanvas = c;
  }

  _worldToMap(x, z) {
    return [(x + this.mapW / 2) * this.mapScale, (z + this.mapW / 2) * this.mapScale];
  }

  drawMinimap(pois) {
    const ctx = this.mm;
    const W = 220;
    const g = this.game;
    const p = g.player.pos;
    const yaw = g.cam.yaw;
    const zoom = 2.2; // px canvas par px de carte
    ctx.save();
    ctx.fillStyle = '#16324a';
    ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    ctx.rotate(yaw);
    const [mx, my] = this._worldToMap(p.x, p.z);
    ctx.scale(zoom, zoom);
    ctx.drawImage(this.mapCanvas, -mx, -my);
    ctx.restore();

    // POI
    const R = W / 2 - 10;
    const k = this.mapScale * zoom;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const drawPoi = (wx, wz, color, size, icon, clampEdge = true) => {
      let dx = (wx - p.x) * k;
      let dy = (wz - p.z) * k;
      let rx = dx * cos - dy * sin;
      let ry = dx * sin + dy * cos;
      const d = Math.hypot(rx, ry);
      if (d > R) {
        if (!clampEdge) return;
        rx = (rx / d) * R;
        ry = (ry / d) * R;
      }
      ctx.beginPath();
      ctx.arc(W / 2 + rx, W / 2 + ry, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      if (icon) {
        ctx.fillStyle = '#111';
        ctx.font = `bold ${size * 1.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, W / 2 + rx, W / 2 + ry + 1);
      }
    };
    for (const e of g.enemies.enemies) if (e.alive) drawPoi(e.pos.x, e.pos.z, '#ff3b3b', 3.5, null, false);
    for (const poi of pois) {
      if (poi.bag) {
        drawPoi(poi.pos.x, poi.pos.z, poi.color, 3, null, false);
        continue;
      }
      drawPoi(poi.pos.x, poi.pos.z, poi.color, poi.small ? 4 : 7, poi.small ? null : poi.icon, !poi.small);
    }
    // Nord
    const nx = sin * (R + 2);
    const ny = -cos * (R + 2);
    ctx.fillStyle = '#e23636';
    ctx.font = 'bold 15px Bangers, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', W / 2 + nx, W / 2 + ny);
    // Joueur
    const f = g.player.facing;
    const fx = Math.sin(f);
    const fz = Math.cos(f);
    const ax = fx * cos - fz * sin;
    const ay = fx * sin + fz * cos;
    const ang = Math.atan2(ay, ax);
    ctx.save();
    ctx.translate(W / 2, W / 2);
    ctx.rotate(ang + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#e23636';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  drawBigMap() {
    const c = this.el.bigmap;
    const ctx = c.getContext('2d');
    const S = c.width;
    ctx.drawImage(this.mapCanvas, 0, 0, S, S);
    const k = S / this.mapCanvas.width;
    const g = this.game;
    const pois = g.missions.getPOIs();
    for (const poi of pois) {
      const [x, y] = this._worldToMap(poi.pos.x, poi.pos.z);
      ctx.beginPath();
      ctx.arc(x * k, y * k, poi.bag ? 4 : poi.small ? 5 : 10, 0, Math.PI * 2);
      ctx.fillStyle = poi.color;
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (poi.label && !poi.small) {
        ctx.fillStyle = '#fff';
        ctx.font = '18px Bangers, Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(poi.label, x * k, y * k - 14);
      }
    }
    const [px, py] = this._worldToMap(g.player.pos.x, g.player.pos.z);
    ctx.save();
    ctx.translate(px * k, py * k);
    ctx.rotate(Math.atan2(Math.cos(g.player.facing), Math.sin(g.player.facing)) + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(10, 10);
    ctx.lineTo(0, 4);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#e23636';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = '26px Bangers, Impact, sans-serif';
    ctx.textAlign = 'left';
    const s = g.save;
    ctx.fillText(`Missions : ${s.completed.length}/7   Sacs à dos : ${s.bags.length}/${g.missions.totalBags}   Crimes arrêtés : ${s.crimes || 0}`, 16, 34);
  }

  // ---------- Projection 3D -> écran ----------
  project(pos, out) {
    const cam = this.game.camera;
    _p.copy(pos).project(cam);
    const w = window.innerWidth;
    const h = window.innerHeight;
    out.x = (_p.x * 0.5 + 0.5) * w;
    out.y = (-_p.y * 0.5 + 0.5) * h;
    out.behind = _p.z > 1;
    out.on = !out.behind && out.x > 0 && out.x < w && out.y > 0 && out.y < h;
    return out;
  }

  _marker(i) {
    let m = this.markerPool[i];
    if (!m) {
      const el = document.createElement('div');
      el.className = 'mk';
      el.innerHTML = '<div class="lb"></div><div class="ic"><span></span></div><div class="ds"></div>';
      this.el.markers.appendChild(el);
      m = { el, lb: el.children[0], ic: el.children[1], icon: el.children[1].children[0], ds: el.children[2] };
      this.markerPool[i] = m;
    }
    return m;
  }

  drawMarkers(pois) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pp = this.game.player.pos;
    let n = 0;
    const scr = {};
    for (const poi of pois) {
      const d = Math.hypot(poi.pos.x - pp.x, poi.pos.z - pp.z);
      if (poi.bag && d > 120) continue;
      if (poi.small && d > 90) continue;
      if (poi.far && d > 500) continue;
      if (!poi.active && !poi.story && !poi.bag && d > 700) continue;
      const wp = _p.copy(poi.pos);
      wp.y += poi.small ? 2.4 : 3;
      this.project(wp, scr);
      let x = scr.x;
      let y = scr.y;
      let edge = false;
      if (!scr.on) {
        if (poi.small || poi.bag) continue;
        edge = true;
        // replie sur le bord de l'écran
        let dx = x - w / 2;
        let dy = y - h / 2;
        if (scr.behind) {
          dx = -dx;
          dy = -dy;
          if (Math.abs(dy) < 1) dy = 1;
        }
        const sx = (w / 2 - 40) / Math.abs(dx || 1);
        const sy = (h / 2 - 50) / Math.abs(dy || 1);
        const s = Math.min(sx, sy);
        x = w / 2 + dx * s;
        y = h / 2 + dy * s;
      }
      const m = this._marker(n++);
      if (m.hidden) {
        m.el.style.display = '';
        m.hidden = false;
      }
      m.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      const cls = `mk${poi.small ? ' small' : ''}${edge ? ' edge' : ''}`;
      if (m.cls !== cls) m.el.className = m.cls = cls;
      if (m.color !== poi.color) m.ic.style.background = m.color = poi.color;
      const icon = poi.icon || '';
      if (m.iconT !== icon) m.icon.textContent = m.iconT = icon;
      const lb = poi.label || '';
      if (m.lbT !== lb) m.lb.textContent = m.lbT = lb;
      const ds = poi.small ? '' : `${Math.round(d / 5) * 5} m`;
      if (m.dsT !== ds) m.ds.textContent = m.dsT = ds;
    }
    for (let i = n; i < this.markerPool.length; i++) {
      const m = this.markerPool[i];
      if (!m.hidden) {
        m.el.style.display = 'none';
        m.hidden = true;
      }
    }
  }

  // ---------- Textes flottants ----------
  floatText(pos, text, color = '#fff', big = false) {
    const el = document.createElement('div');
    el.className = `dmg${big ? ' big' : ''}`;
    el.textContent = text;
    el.style.color = color;
    this.el.floats.appendChild(el);
    this.floatsList.push({ el, pos: pos.clone(), t: 0, life: big ? 1.4 : 1.0, dx: (Math.random() - 0.5) * 30 });
  }

  damage(pos, amount, killed) {
    const el = document.createElement('div');
    el.className = `dmg${killed ? ' kill' : ''}`;
    el.textContent = killed ? `${amount} !` : `${amount}`;
    this.el.floats.appendChild(el);
    this.floatsList.push({ el, pos: pos.clone().add(new THREE.Vector3(0, 0.4, 0)), t: 0, life: 0.8, dx: (Math.random() - 0.5) * 50 });
  }

  _updateFloats(dt) {
    const scr = {};
    this.floatsList = this.floatsList.filter((f) => {
      f.t += dt;
      if (f.t > f.life) {
        f.el.remove();
        return false;
      }
      this.project(f.pos, scr);
      if (!scr.on) {
        f.el.style.display = 'none';
        return true;
      }
      f.el.style.display = '';
      const k = f.t / f.life;
      f.el.style.transform = `translate(${(scr.x + f.dx * k).toFixed(1)}px, ${(scr.y - k * 60).toFixed(1)}px) translate(-50%, -50%)`;
      f.el.style.opacity = `${1 - k * k}`;
      return true;
    });
  }

  comboUpdate(n) {
    this.comboT = 3;
    if (n < 2) return;
    this.el.combo.classList.remove('hidden');
    this.el.comboN.textContent = n;
    this.el.combo.classList.remove('bump');
    void this.el.combo.offsetWidth;
    this.el.combo.classList.add('bump');
  }

  comboBreak() {
    this.el.combo.classList.add('hidden');
  }

  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = text;
    this.el.toasts.appendChild(el);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => el.remove(), 3500);
  }

  hint(text, dur = 6) {
    this.el.hint.textContent = text;
    this.el.hint.classList.remove('hidden');
    this.hintT = dur;
  }

  _pulse(el, peak, dur) {
    el.style.display = 'block';
    const anim = el.animate([{ opacity: peak }, { opacity: 0 }], { duration: dur, easing: 'ease-out' });
    anim.onfinish = () => (el.style.display = 'none');
  }

  hurtFlash() {
    this._pulse(this.el.hurt, 1, 600);
  }

  whiteFlash() {
    this._pulse(this.el.flash, 0.8, 500);
  }

  bossBar(boss) {
    this.boss = boss;
    this.el.bossBar.classList.toggle('hidden', !boss);
    if (boss) this.el.bossName.textContent = boss.name.toUpperCase();
  }

  missionIntro(title, text) {
    const b = $('intro-banner');
    $('intro-title').textContent = title;
    $('intro-text').textContent = text;
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this._introT);
    this._introT = setTimeout(() => b.classList.add('hidden'), 5000);
  }

  missionComplete(title, xp, final) {
    this.game.showResult({
      kicker: final ? 'VICTOIRE !' : 'MISSION RÉUSSIE',
      title,
      text: final
        ? `Le Bouffon Vert est vaincu. New York est sauvée… pour l'instant !<br>+${xp} XP<br><br>La ville reste ouverte : arrête les crimes, trouve les sacs à dos et bats tes records.`
        : `+${xp} XP`,
      retry: false,
    });
  }

  missionFailed(title, reason) {
    this.game.showResult({ kicker: 'MISSION ÉCHOUÉE', title, text: reason, retry: true });
  }

  levelUp(level) {
    this.toast(`NIVEAU ${level} ! Santé et dégâts augmentés`, 'xp');
  }

  xpGain(n, label) {
    this.toast(`+${n} XP${label ? ` — ${label}` : ''}`, 'xp');
  }

  // ---------- Lignes de vitesse ----------
  _speedLines(speed) {
    const c = this.el.speed;
    const ctx = this.speedCtx;
    const w = Math.floor(window.innerWidth / 2);
    const h = Math.floor(window.innerHeight / 2);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const k = clamp((speed - 30) / 25, 0, 1);
    if (k <= 0) {
      if (this._speedDrawn) {
        ctx.clearRect(0, 0, w, h);
        this._speedDrawn = false;
      }
      return;
    }
    ctx.clearRect(0, 0, w, h);
    this._speedDrawn = true;
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * k})`;
    ctx.lineWidth = 1.2;
    const n = Math.floor(28 * k);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = Math.max(w, h) * (0.42 + Math.random() * 0.15);
      const r1 = r0 + 40 + Math.random() * 90;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0 * 0.7);
      ctx.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1 * 0.7);
      ctx.stroke();
    }
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const s = g.save;
    const hpPct = `${(p.health / p.maxHealth) * 100}%`;
    this.el.hp.style.width = hpPct;
    this.el.hpLag.style.width = hpPct;
    this.el.focus.style.width = `${p.focus}%`;
    this.el.focusBar.classList.toggle('full', p.focus >= 50);
    this.el.lvl.textContent = s.level;
    this.el.xp.style.width = `${(s.xp / g.xpForNext()) * 100}%`;

    // Mission
    const m = g.missions.active;
    if (m) {
      this.el.mPanel.classList.remove('hidden');
      this.el.mTitle.textContent = g.missions.activeDef.title;
      this.el.mObj.textContent = m.objective;
      if (m.timer !== null && m.timer !== undefined) {
        this.el.mTimer.textContent = formatTime(m.timer);
        this.el.mTimer.classList.toggle('warn', m.timer < 15);
      } else this.el.mTimer.textContent = '';
    } else this.el.mPanel.classList.add('hidden');

    // Invite de mission
    const near = g.nearbyEntry;
    if (near) {
      this.el.prompt.innerHTML = `<b>[F]</b> ${near.kind === 'story' ? 'Mission' : 'Défi'} : ${near.title}`;
      this.el.prompt.classList.remove('hidden');
    } else this.el.prompt.classList.add('hidden');

    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.el.hint.classList.add('hidden');
    }
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0 || g.combat.combo < 2) this.el.combo.classList.add('hidden');
    }

    // Gadget recharge
    const cd = g.combat.gadgetCd[g.combat.gadgetIndex] / g.combat.gadget.cd;
    this.el.gadgetCd.style.strokeDashoffset = `${94.25 * cd}`;

    // Boss
    if (this.boss) this.el.bossFill.style.width = `${(this.boss.hp / this.boss.maxHp) * 100}%`;

    // Sens d'araignée
    this.el.sense.classList.toggle('on', g.senseT > 0);

    // Réticules
    const scr = {};
    if (p.zipPoint && !g.combat.inCombat) {
      this.project(p.zipPoint, scr);
      if (scr.on) {
        this.el.zip.classList.remove('hidden');
        this.el.zip.style.transform = `translate(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px) translate(-50%, -50%)`;
      } else this.el.zip.classList.add('hidden');
    } else this.el.zip.classList.add('hidden');
    const tgt = g.combat.inCombat ? g.combat.selectTarget(12, g.combat._prefer()) : null;
    if (tgt) {
      this.project(tgt.chest || tgt.pos, scr);
      if (scr.on) {
        this.el.target.classList.remove('hidden');
        this.el.target.style.transform = `translate(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px) translate(-50%, -50%) rotate(45deg)`;
      } else this.el.target.classList.add('hidden');
    } else this.el.target.classList.add('hidden');

    this.el.clock.textContent = g.env.hourLabel;
    const pois = g.missions.getPOIs();
    this._mmT = (this._mmT || 0) - dt;
    if (this._mmT <= 0) {
      this._mmT = 1 / 20;
      this.drawMinimap(pois);
    }
    this.drawMarkers(pois);
    this._updateFloats(dt);
    this._speedLines(p.speed);
  }
}
