// Interface de vol : instruments, étages, ressources, commandes tactiles.

import { h, icon, ICONS } from '../ui/dom.js';
import { Navball } from './navball.js';
import { SAS_MODES, speedMode } from './guidance.js';
import { PROPELLANTS } from '../parts/catalog.js';
import { WARPS, PHYS_WARP } from './sim.js';
import { fmtDist, fmtSpeed, fmtTime, fmtMET, fmtInt, fmt1, fmtMass, fmtClock } from '../core/math.js';

const SAS_ICON = {
  stab: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  pro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h4M17 12h4M12 3v4" stroke="currentColor" stroke-width="2"/></svg>',
  retro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9l6 6M15 9l-6 6M12 17v4" stroke="currentColor" stroke-width="2"/></svg>',
  radout: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8V2M8.5 14l-5 3M15.5 14l5 3" stroke="currentColor" stroke-width="2"/></svg>',
  radin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v4M3.5 17l4-2.5M20.5 17l-4-2.5" stroke="currentColor" stroke-width="2"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 3l6 8h-4v9h-4v-9H6z" fill="currentColor"/></svg>',
  node: '<svg viewBox="0 0 24 24"><path d="M5 9a7 7 0 0 1 14 0M5 15a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="currentColor" stroke-width="2"/></svg>',
};

export class FlightHUD {
  constructor(flight) {
    this.f = flight;
    this.el = null;
    this.t = 0;
  }

  build() {
    const f = this.f;
    if (this.el) this.el.remove();
    const root = h('div', { class: 'screen active', id: 'flight' });
    const btn = (ic, title, fn, extra = '') => h('button', { class: 'btn icon ' + extra, title, 'aria-label': title, onclick: fn, html: icon(ICONS[ic]) });

    // Haut gauche : menu, carte, vue, caméra
    this.viewBtn = h('button', { class: 'btn', title: 'Vue 2D / 3D (V)', onclick: () => f.toggle2d() }, '3D');
    this.camBtn = btn('camera', 'Caméra (C)', () => f.cycleCamera());
    root.appendChild(h('div', { class: 'hud-tl' },
      btn('pause', 'Pause et menu (Échap)', () => f.openPause()),
      btn('map', 'Carte (M)', () => f.toggleMap()),
      this.viewBtn, this.camBtn));

    // Haut centre : horloge, avertissement de temps
    this.metEl = h('div', { class: 'met' }, 'T+00:00:00');
    this.metSub = h('div', { class: 'met-sub' }, '');
    this.warpArrows = h('div', { class: 'arrows' });
    for (let i = 0; i < WARPS.length; i++) this.warpArrows.appendChild(h('i', { title: '×' + WARPS[i] }));
    this.warpVal = h('div', { class: 'warp-val' }, '×1');
    const warp = h('div', { class: 'warp' },
      h('button', { class: 'btn icon ghost', title: 'Ralentir le temps (,)', 'aria-label': 'Ralentir le temps', onclick: () => f.warpStep(-1), html: '<svg viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>' }),
      h('div', {}, this.warpVal, this.warpArrows),
      h('button', { class: 'btn icon ghost', title: 'Accélérer le temps (.)', 'aria-label': 'Accélérer le temps', onclick: () => f.warpStep(1), html: '<svg viewBox="0 0 24 24"><path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>' }));
    root.appendChild(h('div', { class: 'hud-top' },
      h('div', { class: 'hud-box panel' }, this.metEl, this.metSub),
      h('div', { class: 'panel', style: { display: 'flex', alignItems: 'center' } }, warp)));

    // Haut droite : actions contextuelles
    this.trEl = h('div', { class: 'hud-tr' });
    root.appendChild(this.trEl);

    // Gauche : étages
    this.stagesEl = h('div', { class: 'hud-left panel' });
    root.appendChild(this.stagesEl);

    // Droite : ressources + manette des gaz
    this.resEl = h('div', {});
    this.thrFill = h('div', { class: 'fill' });
    this.thrVal = h('div', { class: 'tv' }, '0 %');
    this.throttleEl = h('div', { class: 'throttle', title: 'Manette des gaz (Maj / Ctrl, Z / X)' }, this.thrFill, h('div', { class: 'ticks' }), this.thrVal);
    this.bindThrottle(this.throttleEl);
    root.appendChild(h('div', { class: 'hud-right panel' },
      h('div', { style: { display: 'flex', gap: '10px' } },
        this.throttleEl,
        h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 } }, h('div', { class: 'label' }, 'Ressources'), this.resEl))));

    // Bas : instruments
    this.navCanvas = h('canvas', {});
    this.navball = new Navball(this.navCanvas);
    const tape = () => h('div', { class: 'tape panel' });
    this.tapeL = tape();
    this.tapeR = tape();
    root.appendChild(h('div', { class: 'hud-bottom' }, this.tapeL, h('div', { class: 'navball-wrap panel' }, this.navCanvas), this.tapeR));

    // SAS
    this.sasEl = h('div', { class: 'sas-row panel' });
    for (const m of SAS_MODES) {
      const b = h('button', { class: 'sas-btn', title: `${m.name}${m.id === 'stab' ? ' (T)' : ''}`, 'aria-label': m.name, html: SAS_ICON[m.id], 'data-mode': m.id, onclick: () => f.setSAS(m.id) });
      this.sasEl.appendChild(b);
    }
    root.appendChild(this.sasEl);

    // Bas gauche : bascules
    this.togEl = h('div', { class: 'hud-mini panel' });
    const tog = (key, label, kbd) => {
      const b = h('button', { class: 'toggle-chip', 'data-t': key, onclick: () => f.toggle(key) }, label, h('kbd', {}, kbd));
      this.togEl.appendChild(b);
    };
    tog('rcs', 'RCS', 'R');
    tog('gear', 'Train', 'G');
    tog('lights', 'Phares', 'Y');
    tog('brakes', 'Aérofreins', 'B');
    tog('panels', 'Panneaux', 'U');
    this.togEl.appendChild(h('button', { class: 'toggle-chip', 'data-t': 'ap', onclick: () => f.toggleAutopilotPanel() }, 'Pilote auto', h('kbd', {}, 'O')));
    this.togEl.appendChild(h('button', { class: 'toggle-chip', 'data-t': 'sci', onclick: () => f.runScience() }, 'Science', h('kbd', {}, 'K')));
    root.appendChild(this.togEl);

    // Alertes
    this.alertsEl = h('div', { class: 'alerts' });
    root.appendChild(this.alertsEl);
    this.bigEl = h('div', { class: 'bigmsg', hidden: true });
    root.appendChild(this.bigEl);

    // Pilote automatique
    this.apEl = h('div', { class: 'ap-panel panel', hidden: true });
    root.appendChild(this.apEl);

    // Commandes tactiles
    const rotBtn = (dir, txt) => {
      const b = h('button', { 'aria-label': dir < 0 ? 'Tourner à gauche' : 'Tourner à droite' }, txt);
      const on = (e) => { e.preventDefault(); f.touchRot = dir; b.classList.add('act'); };
      const off = (e) => { e.preventDefault(); if (f.touchRot === dir) f.touchRot = 0; b.classList.remove('act'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
      return b;
    };
    root.appendChild(h('div', { class: 'touch t-rot' }, rotBtn(-1, '⟲'), rotBtn(1, '⟳')));
    this.stageBtn = h('button', { class: 'stage-btn', onclick: () => f.stage() }, 'ÉTAGE');
    root.appendChild(h('div', { class: 'touch', style: { position: 'absolute', right: 'calc(214px + var(--safe-r))', bottom: 'calc(14px + var(--safe-b))', pointerEvents: 'auto' } }, this.stageBtn));

    document.getElementById('ui').appendChild(root);
    this.el = root;
    this.buildAutopilot();
  }

  bindThrottle(el) {
    const set = (e) => {
      const r = el.getBoundingClientRect();
      const v = 1 - (e.clientY - r.top) / r.height;
      this.f.setThrottle(Math.max(0, Math.min(1, v)));
    };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); set(e); el._drag = true; });
    el.addEventListener('pointermove', (e) => { if (el._drag) set(e); });
    el.addEventListener('pointerup', () => { el._drag = false; });
    el.addEventListener('pointercancel', () => { el._drag = false; });
  }

  buildAutopilot() {
    const f = this.f;
    const el = this.apEl;
    el.innerHTML = '';
    const avail = f.autopilotAvailable();
    el.appendChild(h('div', { class: 'label' }, 'Pilote automatique'));
    if (!avail) {
      el.appendChild(h('div', { class: 'warn' }, 'Ajoutez un Ordinateur de guidage (technologie « Guidage automatique ») pour piloter automatiquement.'));
      return;
    }
    const alt = h('input', { type: 'number', min: 10, max: 5000, step: 5, value: Math.round((f.ap.targetAlt || 90000) / 1000), id: 'ap-alt', 'aria-label': 'Altitude visée en km' });
    alt.addEventListener('keydown', (e) => e.stopPropagation());
    el.appendChild(h('div', { class: 'row', style: { alignItems: 'center' } }, h('span', { class: 'label' }, 'Orbite visée'), alt, h('span', {}, 'km')));
    const warpChk = h('input', { type: 'checkbox', id: 'ap-warp', checked: true });
    el.appendChild(h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' } }, warpChk, 'Accélérer le temps automatiquement'));
    const b = (label, mode) => h('button', { class: 'btn', onclick: () => f.startAutopilot(mode, { targetAlt: Number(alt.value) * 1000, allowWarp: warpChk.checked }) }, label);
    el.appendChild(h('div', { class: 'row' }, b('Mise en orbite', 'ascent'), b('Manœuvre', 'node'), b('Atterrissage', 'land')));
    el.appendChild(h('div', { class: 'row' }, h('button', { class: 'btn danger', onclick: () => f.ap.stop('Pilote automatique désactivé') }, 'Arrêter')));
    this.apStatus = h('div', { class: 'ap-status' }, '');
    el.appendChild(this.apStatus);
  }

  flash(title, sub = '', ms = 2600) {
    const el = this.bigEl;
    el.innerHTML = '';
    el.appendChild(h('b', {}, title));
    if (sub) el.appendChild(h('span', {}, sub));
    el.hidden = false;
    el.classList.remove('anim');
    void el.offsetWidth;
    el.classList.add('anim');
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => { el.hidden = true; }, ms);
  }

  // ------------------------------------------------------------------------
  update(dt) {
    const f = this.f;
    const v = f.sim.active;
    if (!v || !this.el) return;
    this.t += dt;
    const ut = f.sim.ut;
    // navigation (chaque image)
    const up = Math.atan2(v.y, v.x);
    const nose = v.rot + Math.PI / 2;
    const mode = speedMode(v);
    const vel = mode === 'surface' ? v.surfaceVelocity() : [v.vx, v.vy];
    const markers = [];
    if (Math.hypot(vel[0], vel[1]) > 0.5) {
      const a = Math.atan2(vel[1], vel[0]);
      markers.push({ kind: 'pro', ang: a }, { kind: 'retro', ang: a + Math.PI });
      if (mode === 'orbit') {
        const pro = a;
        const rad = Math.sin(up - pro) >= 0 ? pro + Math.PI / 2 : pro - Math.PI / 2;
        markers.push({ kind: 'radout', ang: rad }, { kind: 'radin', ang: rad + Math.PI });
      }
    }
    if (f.node && f.node.remaining) markers.push({ kind: 'node', ang: Math.atan2(f.node.remaining[1], f.node.remaining[0]) });
    if (f.target) {
      const ts = f.target.state(ut), bs = v.body.state(ut);
      markers.push({ kind: 'target', ang: Math.atan2(ts.y - bs.y - v.y, ts.x - bs.x - v.x) });
    }
    let pd = ((nose - up) * 180) / Math.PI;
    pd = ((pd + 540) % 360) - 180;
    this.navball.draw({ nose, up, markers, mode, pitchDeg: Math.abs(pd) });
    // gaz
    this.thrFill.style.height = Math.round(v.throttle * 100) + '%';
    this.thrVal.textContent = Math.round(v.throttle * 100) + ' %';
    // texte : 8 fois par seconde
    this.textT = (this.textT || 0) + dt;
    if (this.textT < 0.12) return;
    this.textT = 0;
    this.updateText(v, ut, mode);
  }

  updateText(v, ut, mode) {
    const f = this.f;
    const b = v.body;
    // horloge
    this.metEl.textContent = v.launched ? fmtMET(ut - v.met0) : f.countdown != null ? fmtMET(-Math.ceil(f.countdown)) : 'PRÊT';
    this.metSub.textContent = `${v.name} · ${f.situationText(v)}`;
    this.metSub.title = fmtClock(ut);
    // accélération du temps
    const wi = f.sim.warpIdx;
    this.warpVal.textContent = '×' + fmtInt(WARPS[wi]);
    [...this.warpArrows.children].forEach((a, i) => a.classList.toggle('on', i <= wi && i > 0));
    this.warpArrows.children[0].classList.toggle('on', wi === 0);
    // instruments
    const talt = b.hasSurface ? v.terrainAltitude(ut) - (v.cy - v.lowestY()) : v.altitude;
    const r = Math.hypot(v.x, v.y);
    const sv = v.surfaceVelocity();
    const vv = (sv[0] * v.x + sv[1] * v.y) / r;
    const hs = Math.sqrt(Math.max(0, sv[0] * sv[0] + sv[1] * sv[1] - vv * vv));
    const pred = f.sim.prediction && f.sim.prediction[0];
    const o = pred ? pred.orbit : null;
    const rows = (list) => list.map(([k, val, cls]) => h('div', { class: 't-row' + (cls ? ' ' + cls : '') }, h('span', {}, k), h('b', {}, val)));
    this.tapeL.innerHTML = '';
    rows([
      ['Altitude', fmtDist(v.altitude), 'big'],
      ['Sol', b.hasSurface ? fmtDist(Math.max(0, talt)) : '—'],
      ['Vit. verticale', fmtSpeed(vv)],
      ['Vit. horizontale', fmtSpeed(hs)],
      ['Accél.', fmt1(v.gforce || 0) + ' g'],
      ['Mach', b.atmosphere && v.rho > 0 ? fmt1(v.mach || 0) : '—'],
    ]).forEach((e) => this.tapeL.appendChild(e));
    this.tapeR.innerHTML = '';
    const speed = mode === 'surface' ? Math.hypot(sv[0], sv[1]) : Math.hypot(v.vx, v.vy);
    const apA = o ? o.apoapsis - b.radius : NaN;
    const peA = o ? o.periapsis - b.radius : NaN;
    const dvs = v.stageDeltaV(v.pressureNow || 0);
    rows([
      [mode === 'surface' ? 'Vitesse sol' : 'Vitesse orb.', fmtSpeed(speed), 'big'],
      ['Apoapside', o ? (isFinite(apA) ? fmtDist(apA) : 'Évasion') : '—'],
      ['Périapside', o ? fmtDist(peA) : '—'],
      [o && isFinite(o.period) ? 'Vers Ap' : 'Période', o ? (isFinite(o.period) ? fmtTime(o.timeToApoapsis(ut)) : '∞') : '—'],
      ['Δv étage', fmtInt(dvs) + ' m/s'],
      ['Échauffement', (v.maxTempFrac || 0) < 0.35 ? 'normal' : Math.round((v.maxTempFrac || 0) * 100) + ' %', v.maxTempFrac > 0.8 ? 'red' : ''],
    ]).forEach((e) => this.tapeR.appendChild(e));
    // SAS
    for (const btn of this.sasEl.children) {
      const m = btn.dataset.mode;
      btn.classList.toggle('on', v.sas === m);
      const off = (m === 'node' && !f.node) || (m === 'target' && !f.target) || !f.sasAvailable(m);
      btn.classList.toggle('off', off);
    }
    // bascules
    for (const b2 of this.togEl.children) {
      const k = b2.dataset.t;
      const on = k === 'rcs' ? v.rcsOn : k === 'gear' ? v.gear : k === 'lights' ? v.lights : k === 'brakes' ? v.brakes : k === 'panels' ? f.panelsOut : k === 'ap' ? !this.apEl.hidden : false;
      b2.classList.toggle('on', !!on);
    }
    if (this.apStatus) this.apStatus.textContent = f.ap.mode ? f.ap.status : f.ap.status || 'En attente';
    this.updateStages(v);
    this.updateResources(v);
    this.updateAlerts(v);
    this.updateTopRight(v);
  }

  updateStages(v) {
    const el = this.stagesEl;
    const key = v.stageIdx + ':' + v.stages.map((s) => s.length).join(',') + ':' + v.parts.length;
    const col = (d) => (d.engine ? (d.engine.solid ? '#e8e2d0' : '#ff8a3d') : d.decoupler ? '#ffd24a' : d.chute ? '#5cd6ff' : d.fairing ? '#b690ff' : '#aaa');
    if (key !== this.stageKey) {
      this.stageKey = key;
      el.innerHTML = '';
      el.appendChild(h('div', { class: 'label' }, 'Étages · Espace'));
      const n = v.stages.length;
      if (v.stageIdx >= n) el.appendChild(h('div', { class: 'warn' }, 'Tous les étages ont été déclenchés.'));
      for (let i = v.stageIdx; i < n; i++) {
        const st = v.stages[i];
        const groups = new Map();
        for (const u of st) {
          const p = v.byUid.get(u);
          if (!p) continue;
          const k = p.id;
          if (!groups.has(k)) groups.set(k, { p, n: 0 });
          groups.get(k).n++;
        }
        const ul = h('ul');
        for (const { p, n: cnt } of groups.values()) ul.appendChild(h('li', {}, h('i', { style: { background: col(p.def) } }), (cnt > 1 ? cnt + '× ' : '') + p.def.name));
        el.appendChild(h('div', { class: 'hstage' + (i === v.stageIdx ? ' next' : '') }, h('div', { class: 'hstage-h' }, h('span', { style: { color: 'inherit', fontFamily: 'inherit', fontSize: '12px' } }, i === v.stageIdx ? 'Prochain étage' : `Étage ${i + 1}`)), ul));
      }
    }
  }

  updateResources(v) {
    const el = this.resEl;
    const kinds = ['kero', 'metha', 'hydro', 'solid', 'mono', 'xenon', 'fusion', 'ec', 'ablator'];
    // carburant de l'étage actif
    const out = [];
    const active = v.parts.filter((p) => p.def.engine && p.engOn && !p.def.engine.escape);
    const stageFuel = new Map();
    for (const e of active) {
      const d = e.def.engine;
      const k = d.prop;
      const tanks = d.solid ? [e] : (v.groups.get(e.uid) || []).map((u) => v.byUid.get(u)).filter(Boolean);
      for (const t of tanks) {
        const key = k + ':' + t.uid;
        if (stageFuel.has(key)) continue;
        stageFuel.set(key, [k, t.res[k] || 0, t.cap[k] || 0]);
      }
    }
    const agg = {};
    for (const [k, a, c] of stageFuel.values()) { agg[k] = agg[k] || [0, 0]; agg[k][0] += a; agg[k][1] += c; }
    for (const k in agg) out.push([`▸ ${PROPELLANTS[k].name}`, agg[k][0], agg[k][1], PROPELLANTS[k].color, k]);
    for (const k of kinds) {
      const cap = v.totalCap(k);
      if (cap <= 0) continue;
      out.push([PROPELLANTS[k].name, v.totalRes(k), cap, PROPELLANTS[k].color, k]);
    }
    el.innerHTML = '';
    if (Object.keys(agg).length) el.appendChild(h('div', { style: { fontSize: '10.5px', color: 'var(--amber)' } }, '▸ étage actif'));
    for (const [name, a, c, color, k] of out) {
      const pct = c > 0 ? a / c : 0;
      el.appendChild(h('div', { class: 'res-row' },
        h('span', { title: name, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, name),
        h('div', { class: 'bar' }, h('div', { style: { width: Math.round(pct * 100) + '%', background: color } })),
        h('small', {}, k === 'ec' ? `${fmt1(a)} / ${fmtInt(c)} kWh` : `${fmtMass(a)}`)));
    }
    if (!out.length) el.appendChild(h('div', { class: 'warn' }, 'Aucune ressource'));
  }

  updateAlerts(v) {
    const f = this.f;
    const list = [...(v.alerts || [])];
    if (v.maxTempFrac > 0.85) list.push({ kind: 'bad', text: 'SURCHAUFFE !' });
    else if (v.maxTempFrac > 0.65) list.push({ kind: 'warn', text: 'Échauffement important' });
    for (const p of v.parts) if (p.chute === 'armed' && (v.airspeed || 0) > p.def.chute.maxSpeed && v.rho > 0) { list.push({ kind: 'warn', text: 'Trop rapide pour ouvrir le parachute' }); break; }
    if (!v.hasControl && v.controlPart) list.push({ kind: 'bad', text: 'Plus d\'électricité : sonde incontrôlable' });
    if (f.sim.maxWarpMsg && f.warpMsgT > 0) list.push({ kind: 'info', text: f.sim.maxWarpMsg });
    if (f.node && !f.map?.active) {
      const bt = f.node.burnTime(v);
      const tl = f.node.t - f.sim.ut - (isFinite(bt) ? bt / 2 : 0);
      if (tl < 120 && tl > -bt) list.push({ kind: 'info', text: `Manœuvre ${tl > 0 ? 'dans ' + fmtTime(tl) : 'en cours'} · Δv ${fmtInt(Math.hypot(...(f.node.remaining || f.node.dv || [0, 0])))} m/s · ${isFinite(bt) ? fmtTime(bt) : '—'}` });
    }
    if (f.markerSite && f.markerSite.body === v.body.id) {
      const b = v.body;
      let d = Math.atan2(v.y, v.x) - b.rotationAt(f.sim.ut) - f.markerSite.lon;
      d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      list.push({ kind: 'info', text: `${f.markerSite.name} : ${fmtDist(Math.abs(d) * b.radius)} ${d > 0 ? '(vers l\'ouest)' : '(vers l\'est)'}` });
    }
    const key = list.map((a) => a.kind + a.text).join('|');
    if (key === this.alertKey) return;
    this.alertKey = key;
    this.alertsEl.innerHTML = '';
    for (const a of list.slice(0, 4)) this.alertsEl.appendChild(h('div', { class: 'alert ' + (a.kind === 'bad' ? '' : a.kind) }, a.text));
  }

  updateTopRight(v) {
    const f = this.f;
    const acts = f.contextActions(v);
    const key = acts.map((a) => a.label).join('|');
    if (key === this.trKey) return;
    this.trKey = key;
    this.trEl.innerHTML = '';
    for (const a of acts) this.trEl.appendChild(h('button', { class: 'btn ' + (a.kind || ''), onclick: a.fn }, a.label));
  }

  setView2d(v) {
    if (this.viewBtn) this.viewBtn.textContent = v ? '2D' : '3D';
  }

  destroy() {
    if (this.el) this.el.remove();
    this.el = null;
  }
}

export { fmtClock };
