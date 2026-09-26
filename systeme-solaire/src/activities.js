// Les activités pour les enfants : explorer, poids, tailles, fusée,
// jour & nuit (phases de la Lune), vaisseaux de la NASA, quiz.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { PLANETS, SUN, MOON, CRAFTS, QUIZ } from './data.js';
import { $, sfx, say, speak, toast, confetti, showInfo, hideInfo, showPanel, hidePanel } from './ui.js';
import { normalizeModel } from './crafts.js';
import { latLonToVec3 } from './world.js';
import { pinTexture, glowTexture } from './textures.js';

const fmt = (n, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
const nameOf = (b) => b.data.name;
const shortOf = (b) => b.data.short || b.data.name;
const up = new THREE.Vector3(0, 1, 0);

export function createActivities(app) {
  const { world } = app;
  const B = (id) => world.bodies.get(id);
  let current = null;
  let currentName = '';
  let welcomed3D = false;
  const api = { selected: null };

  // ---------- Commun ----------
  function setTool(name) {
    document.querySelectorAll('#toolbar .tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
  }

  function infoActions(b) {
    const acts = [{ label: '🔊 Écouter', onClick: () => speak(`${nameOf(b)}. ${b.data.story} Le sais-tu ? ${b.data.wow}`, true) }];
    if (!b.isCraft && b.id !== 'earth' && b.id !== 'sun') acts.push({ label: '🚀 Y aller en fusée', primary: true, onClick: () => start('rocket', { dest: b.id }) });
    if (!b.isCraft) {
      const c = CRAFTS.find((c) => c.host === b.id && app.crafts.get(c.id));
      if (c) acts.push({ label: `${c.emoji} Voir : ${c.name}`, onClick: () => { start('crafts', { craft: c.id }); } });
      acts.push({ label: '⚖️ Mon poids ici', onClick: () => start('weight', { focus: b.id }) });
    } else {
      const host = B(b.data.host);
      if (host) acts.push({ label: `🪐 Voir ${shortOf(host)}`, onClick: () => select(host) });
    }
    return acts;
  }

  function select(b, { speakIt = true } = {}) {
    api.selected = b;
    sfx.open();
    const dist = app.dim < 0.5 ? Math.max((b.r2d || 1.5) * 13, 24) : b.isCraft ? b.data.size * 3.4 : b.isSun ? 26 : Math.max(b.radius * 4.5, 2.4);
    let dir = null;
    if (b.isCraft && b.fixed) {
      // Engin posé sur un astre : on le regarde d'en haut, un peu de biais
      const n = b.group.localToWorld(new THREE.Vector3(0, 1, 0)).sub(b.group.getWorldPosition(new THREE.Vector3())).normalize();
      const t = new THREE.Vector3().crossVectors(n, up).normalize();
      dir = n.multiplyScalar(0.75).addScaledVector(t, 0.55).add(new THREE.Vector3(0, 0.2, 0));
    }
    app.focusOn(b, dist, { dir });
    showInfo(b, infoActions(b));
    if (speakIt) say(`${b.data.emoji} ${b.data.wow}`, { stay: 9000 });
  }
  api.selectBody = select;

  async function switchDim(k) {
    if (current && current.needs3D && k === 0) await start('explore', { silent: true });
    hideInfo();
    api.selected = null;
    app.setDim(k);
    if (k === 1) {
      say('Attache ta ceinture… On décolle vers l\'espace ! 🚀', { stay: 3000 });
    } else {
      say('Retour au plan vu d\'en haut. C\'est comme une carte : on voit bien le chemin (l\'orbite) de chaque planète.', { stay: 7000 });
    }
  }
  app.onDimChanged = (d) => {
    if (d === 1 && !welcomed3D) {
      welcomed3D = true;
      setTimeout(() => say('Waouh, nous voilà dans l\'espace ! 🌌 Les planètes sont maintenant de vraies boules, éclairées par le Soleil. Fais glisser pour tourner autour, zoome pour t\'approcher, et essaie les activités en bas de l\'écran !', { stay: 14000 }), 200);
      if (app.modelsReady) setTimeout(() => toast('🛰️ Les vaisseaux de la NASA sont là : cherche-les !'), 2500);
    }
  };

  async function start(name, opts = {}) {
    const next = ACT[name];
    if (!next) return;
    if (current && current.exit) current.exit(next);
    hideInfo();
    hidePanel();
    api.selected = null;
    current = next;
    currentName = name;
    setTool(name);
    if (!opts.silent) sfx.click();
    if (next.needs3D && (app.dimTo !== 1 || app.dimT < 1)) {
      say('Pour cette activité, on passe en 3D ! ✨', { stay: 3500 });
      const token = (start.token = (start.token || 0) + 1);
      await app.whenDim(1);
      if (token !== start.token || current !== next) return;
    }
    next.enter && next.enter(opts);
  }
  api.start = start;
  api.switchDim = switchDim;

  api.pick = (b) => {
    if (current && current.onPick && current.onPick(b) !== false) return;
    select(b);
  };
  api.infoClosed = () => { api.selected = null; current && current.infoClosed && current.infoClosed(); };
  api.update = (dt, simDt) => { current && current.update && current.update(dt, simDt); };

  // =========================================================
  // 🔍 EXPLORER
  // =========================================================
  const explore = {
    enter(opts) {
      if (!opts.silent) say(app.dim < 0.5
        ? 'Touche un astre sur le plan pour découvrir ses secrets !'
        : 'Touche une planète, une lune ou un vaisseau pour t\'en approcher. Fais glisser pour tourner autour !', { stay: 7000 });
    },
    infoClosed() { app.clearFocus(); },
  };

  // =========================================================
  // ⚖️ MON POIDS
  // =========================================================
  const weight = {
    kg: 30,
    tags: [],
    enter(opts) {
      const list = [SUN, ...PLANETS.slice(0, 3), MOON, ...PLANETS.slice(3)];
      const p = showPanel(`
        <h3>⚖️ Combien je pèse ailleurs ?</h3>
        <p>Ton poids sur Terre :</p>
        <div class="row"><input type="range" id="w-kg" min="10" max="100" value="${this.kg}"><div class="kg" id="w-val">${this.kg} kg</div></div>
        <div class="wlist" id="w-list"></div>
        <p class="note">Ton corps reste le même partout, mais chaque astre t'attire plus ou moins fort : c'est la <b>gravité</b>. Plus un astre est lourd, plus il t'attire !</p>`);
      const wl = p.querySelector('#w-list');
      this.rows = list.map((d) => {
        const r = document.createElement('div');
        r.className = 'wrow';
        r.innerHTML = `<span>${d.emoji}</span><span>${d.short || d.name}</span><div class="wbar"><i style="background:${d.color}"></i></div><span class="wv"></span>`;
        r.addEventListener('click', () => this.onPick(B(d.id)));
        wl.appendChild(r);
        return { d, r };
      });
      p.querySelector('#w-kg').addEventListener('input', (e) => { this.kg = +e.target.value; this.refresh(); });
      // Étiquettes flottantes au-dessus des astres
      this.tags = list.map((d) => {
        const el = document.createElement('div');
        el.className = 'label weight';
        const o = new CSS2DObject(el);
        const b = B(d.id);
        (b.isMoon ? b.mesh : b.group).add(o);
        return { d, o, el, b };
      });
      this.refresh();
      say('Choisis ton poids avec le curseur, et regarde combien tu pèserais sur chaque astre ! Sur la Lune, tu serais léger comme une plume…', { stay: 9000 });
      if (opts.focus) setTimeout(() => this.onPick(B(opts.focus)), 50);
    },
    refresh() {
      $('w-val').textContent = `${this.kg} kg`;
      const max = this.kg * 3;
      this.rows.forEach(({ d, r }) => {
        const w = this.kg * d.gravity;
        r.querySelector('.wv').textContent = `${fmt(w, w < 10 ? 1 : 0)} kg`;
        r.querySelector('i').style.width = `${Math.min(100, (w / max) * 100)}%`;
      });
      this.tags.forEach(({ d, el }) => { const w = this.kg * d.gravity; el.textContent = `${fmt(w, w < 10 ? 1 : 0)} kg`; });
    },
    update() {
      this.tags.forEach(({ o, b }) => {
        o.visible = !b.isMoon || app.dim > 0.6;
        const r = app.dim < 0.5 ? (b.r2d || 1) : b.radius;
        if (b.isSun) o.position.set(0, app.dim < 0.5 ? 0 : r + 3.2, app.dim < 0.5 ? -r - 1.5 : 0);
        else if (b.isMoon) o.position.set(0, 1.0, 0);
        else o.position.set(0, app.dim < 0.5 ? 0 : r + 1.4, app.dim < 0.5 ? -r - 0.9 : 0);
      });
    },
    onPick(b) {
      if (b.isCraft) return false;
      const d = b.data;
      api.selected = b;
      sfx.pop();
      const dist = app.dim < 0.5 ? Math.max((b.r2d || 1.5) * 13, 24) : b.isSun ? 30 : Math.max(b.radius * 5, 3);
      app.focusOn(b, dist);
      const w = this.kg * d.gravity;
      let msg = `Sur ${d.id === 'sun' ? 'le Soleil' : shortOf(b)}, tu pèserais ${fmt(w, w < 10 ? 1 : 0)} kg. `;
      if (d.id === 'earth') msg += 'Normal, c\'est chez toi !';
      else if (d.gravity > 5) msg += 'Tu serais écrasé comme une crêpe ! (Et en plus, il fait bien trop chaud…)';
      else if (d.gravity > 1.5) msg += 'Tu te sentirais super lourd, comme si tu portais un copain sur ton dos !';
      else if (d.gravity > 1.02) msg += 'Un peu plus lourd que sur Terre : monter les escaliers serait fatigant !';
      else if (d.gravity >= 0.85) msg += 'Presque comme sur Terre !';
      else msg += `Tu pourrais sauter ${fmt(1 / d.gravity, 0)} fois plus haut qu'à la maison ! 🦘`;
      say(msg, { stay: 9000 });
      this.rows.forEach(({ d: dd, r }) => r.style.background = dd.id === d.id ? 'rgba(255,201,60,0.18)' : '');
    },
    exit() { this.tags.forEach(({ o }) => { o.removeFromParent(); o.element.remove(); }); this.tags = []; app.clearFocus(); },
  };

  // =========================================================
  // 📏 LES VRAIES TAILLES
  // =========================================================
  const sizes = {
    needs3D: true,
    enter() {
      const E = 0.6; // rayon de la Terre dans cette activité
      let x = 2;
      this.layout = [];
      PLANETS.forEach((d) => {
        const b = B(d.id);
        const tr = (d.realDiameter / 12742) * E;
        const ext = d.id === 'saturn' ? tr * 2.3 : tr;
        x += ext;
        b.override = new THREE.Vector3(x, 0, 0);
        b.overrideScale = tr / d.radius;
        this.layout.push({ b, tr });
        x += ext + 1.1;
      });
      this.width = x;
      this.sunR = 109 * E;
      world.opt.orbitsSaved = world.opt.orbits;
      world.opt.orbits = false;
      world.beltGroup.visible = false;
      app.hideCrafts = true;
      app.bloomOverride = 0.45;
      app.timeScaleSaved = app.timeIndex;
      const cx = x * 0.45;
      const dist = Math.max(60, (x * 0.62) / Math.tan(THREE.MathUtils.degToRad(22.5)) / Math.min(1, app.camera.aspect) * 0.9);
      app.clearFocus();
      app.fly = { pos: new THREE.Vector3(cx, dist * 0.18, dist), target: new THREE.Vector3(cx, 0, 0) };
      sfx.whoosh();
      showPanel(`
        <h3>📏 Les vraies tailles</h3>
        <p>Voici les planètes rangées côte à côte, <b>à la bonne échelle</b>. Le bord géant à gauche, c'est le Soleil !</p>
        <p>Si la Terre était une <b>bille</b> de 1 cm, Jupiter serait un <b>pamplemousse</b>, et le Soleil un <b>ballon de plus d'1 mètre</b> !</p>
        <div class="btn-row"><button class="btn" id="sz-dist">📐 Et les distances ?</button><button class="btn" id="sz-zoom">🔎 Zoomer sur la Terre</button></div>
        <p id="sz-extra" class="note"></p>`);
      $('sz-dist').addEventListener('click', () => {
        sfx.click();
        const t = 'Avec la Terre grosse comme une bille, elle serait à 117 mètres du ballon-Soleil, et Neptune à plus de 3 kilomètres ! L\'espace est surtout… vide.';
        $('sz-extra').textContent = t;
        say(t, { stay: 10000 });
      });
      $('sz-zoom').addEventListener('click', () => { sfx.click(); app.focusOn(B('earth'), 3.2, { dir: new THREE.Vector3(0.1, 0.25, 1) }); });
      say('Voici les vraies tailles ! Regarde comme la Terre est petite à côté de Jupiter… et encore plus à côté du Soleil ! On pourrait aligner 109 Terres sur le diamètre du Soleil.', { stay: 12000 });
    },
    update(dt) {
      const sun = world.sun;
      const a = 1 - Math.exp(-dt * 2.5);
      const s = this.sunR / SUN.radius;
      sun.group.scale.setScalar(THREE.MathUtils.lerp(sun.group.scale.x, s, a));
      sun.group.position.lerp(new THREE.Vector3(-this.sunR - 1.5, 0, 0), a);
      world.bodies.forEach((b) => b.moons && b.moons.forEach((m) => { m.pivot.visible = false; }));
    },
    onPick(b) {
      if (b.isCraft) return false;
      api.selected = b;
      sfx.pop();
      const l = this.layout.find((x) => x.b === b);
      if (b.isSun) {
        say('Le Soleil est tellement grand qu\'on n\'en voit qu\'un petit bout ! Son diamètre fait 109 fois celui de la Terre.', { stay: 8000 });
        return true;
      }
      if (l) app.focusOn(b, Math.max(l.tr * 5, 2.5), { dir: new THREE.Vector3(0.1, 0.25, 1) });
      const ratio = b.data.realDiameter / 12742;
      say(ratio > 1
        ? `${shortOf(b)} est ${fmt(ratio, ratio < 10 ? 1 : 0)} fois plus large que la Terre !`
        : `${shortOf(b)} est plus petite que la Terre : ${fmt(ratio * 100)} % de sa taille.`, { stay: 7000 });
      return true;
    },
    exit() {
      PLANETS.forEach((d) => { const b = B(d.id); b.override = null; b.overrideScale = 1; });
      world.sun.group.scale.setScalar(1);
      world.sun.group.position.set(0, 0, 0);
      world.opt.orbits = world.opt.orbitsSaved ?? true;
      world.beltGroup.visible = true;
      world.bodies.forEach((b) => b.moons && b.moons.forEach((m) => { m.pivot.visible = true; }));
      app.hideCrafts = false;
      app.bloomOverride = undefined;
      app.resetView();
    },
  };

  // =========================================================
  // 🚀 VOYAGE EN FUSÉE
  // =========================================================
  const TRIP_DAYS = { moon: 3, mercury: 2370, venus: 150, mars: 210, jupiter: 1825, saturn: 2550, uranus: 3285, neptune: 4380, pluto: 3470 };
  const flameMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,170,60,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const trailMat = new THREE.PointsMaterial({ size: 0.16, map: glowTexture('rgba(255,200,120,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, vertexColors: true, sizeAttenuation: true });

  function buildRocket() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    if (app.rocketScene) {
      const clone = app.rocketScene.clone(true);
      const m = normalizeModel(clone, 1.2);
      const d = m.userData.dims;
      // Mettre l'axe le plus long vers le haut (+Y)
      if (d.x >= d.y && d.x >= d.z) m.rotation.z = Math.PI / 2;
      else if (d.z >= d.y && d.z >= d.x) m.rotation.x = Math.PI / 2;
      inner.add(m);
    } else {
      const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, emissive: 0x222222 });
      const red = new THREE.MeshStandardMaterial({ color: 0xe0443c, roughness: 0.5, emissive: 0x220000 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.8, 24), white);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 24), red);
      nose.position.y = 0.55;
      inner.add(body, nose);
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.16), red);
        fin.position.set(Math.cos(i * 2.09) * 0.14, -0.32, Math.sin(i * 2.09) * 0.14);
        fin.rotation.y = -i * 2.09;
        inner.add(fin);
      }
    }
    const flame = new THREE.Sprite(flameMat);
    flame.position.y = -0.75;
    flame.scale.set(0.3, 0.55, 1);
    g.add(flame);
    g.userData.flame = flame;
    return g;
  }

  const rocket = {
    needs3D: true,
    enter(opts) {
      this.state = 'menu';
      const dests = [MOON, ...PLANETS.filter((p) => p.id !== 'earth')];
      const p = showPanel(`
        <h3>🚀 Voyage en fusée</h3>
        <p>Choisis ta destination, et décolle depuis la Terre à bord d'une fusée <b>Saturn V</b>, celle qui a emmené les astronautes sur la Lune !</p>
        <div class="dest-grid" id="dest-grid"></div>
        <div class="trip hidden" id="trip">
          <div class="row" style="justify-content:space-between"><b id="trip-to"></b><span class="trip-count" id="trip-count"></span></div>
          <div class="bar"><i id="trip-bar"></i></div>
          <div class="btn-row"><button class="btn" id="trip-fast">⏩ Plus vite</button><button class="btn" id="trip-stop">✋ Annuler</button></div>
        </div>`);
      const grid = p.querySelector('#dest-grid');
      dests.forEach((d) => {
        const b = document.createElement('button');
        b.innerHTML = `<span>${d.emoji}</span>${d.short || d.name}`;
        b.addEventListener('click', () => this.launch(d.id));
        grid.appendChild(b);
      });
      p.querySelector('#trip-fast').addEventListener('click', () => { this.speed = this.speed === 1 ? 3 : 1; $('trip-fast').textContent = this.speed === 1 ? '⏩ Plus vite' : '▶️ Normal'; });
      p.querySelector('#trip-stop').addEventListener('click', () => this.abort());
      if (opts.dest) setTimeout(() => this.launch(opts.dest), 250);
      else {
        say('Où veux-tu aller ? Choisis une destination ! 🚀', { stay: 6000 });
        app.focusOn(B('earth'), 7);
      }
    },
    launch(destId) {
      if (this.state === 'flying' || this.state === 'launch') return;
      this.dest = B(destId);
      this.destId = destId;
      this.rocket = buildRocket();
      app.scene.add(this.rocket);
      const earth = B('earth');
      const ep = earth.group.getWorldPosition(new THREE.Vector3());
      // On décolle du côté de la Terre qui fait face à la destination
      const dp = this.dest.group.getWorldPosition(new THREE.Vector3());
      const toDest = dp.clone().sub(ep).setY(0).normalize();
      const outward = ep.clone().setY(0).normalize();
      const inner = destId === 'mercury' || destId === 'venus';
      const base = destId === 'moon' ? toDest : outward.multiplyScalar(inner ? -1 : 1).addScaledVector(toDest, 0.5);
      this.dir0 = base.setY(0).normalize().add(new THREE.Vector3(0, 0.6, 0)).normalize();
      this.rocket.position.copy(ep).addScaledVector(this.dir0, 1.05);
      this.rocket.quaternion.setFromUnitVectors(up, this.dir0);
      this.rocket.scale.setScalar(0.8);
      this.sideSign = Math.random() < 0.5 ? -1 : 1;
      this.t = 0;
      this.speed = 1;
      this.state = 'launch';
      this.trail = [];
      this.trailGeo = new THREE.BufferGeometry();
      this.trailPos = new Float32Array(240 * 3);
      this.trailCol = new Float32Array(240 * 3);
      this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
      this.trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 3));
      this.trailPts = new THREE.Points(this.trailGeo, trailMat);
      this.trailPts.frustumCulled = false;
      app.scene.add(this.trailPts);
      const far = this.dest.group.getWorldPosition(new THREE.Vector3()).distanceTo(ep);
      this.cruise = 5 + Math.log2(1 + far / 4) * 1.6;
      this.days = TRIP_DAYS[destId] || 365;
      app.timeFactorSaved = app.timeFactor;
      app.timeFactor = 0.12; // les planètes ralentissent pendant le voyage
      app.clearFocus();
      app.controls.enabled = false;
      $('dest-grid').classList.add('hidden');
      $('trip').classList.remove('hidden');
      $('trip-to').textContent = `Direction : ${nameOf(this.dest)}`;
      sfx.launch();
      say('3… 2… 1… Décollage ! 🔥', { stay: 3000 });
      this.p0 = new THREE.Vector3();
    },
    abort() {
      this.cleanup();
      this.state = 'menu';
      $('dest-grid').classList.remove('hidden');
      $('trip').classList.add('hidden');
      app.focusOn(B('earth'), 7);
    },
    cleanup() {
      if (this.rocket) { app.scene.remove(this.rocket); this.rocket = null; }
      if (this.trailPts) { app.scene.remove(this.trailPts); this.trailGeo.dispose(); this.trailPts = null; }
      app.timeFactor = app.timeFactorSaved ?? 1;
      app.controls.enabled = true;
    },
    update(dt) {
      if (!this.rocket || (this.state !== 'launch' && this.state !== 'flying')) return;
      const r = this.rocket;
      const earth = B('earth');
      const ep = earth.group.getWorldPosition(new THREE.Vector3());
      const dp = this.dest.group.getWorldPosition(new THREE.Vector3());
      const destR = this.dest.radius;
      const prev = r.position.clone();
      const step = dt * this.speed;

      if (this.state === 'launch') {
        this.t += step;
        const k = Math.min(1, this.t / 2.2);
        // Monte en accélérant, reste accrochée à la Terre qui avance
        r.position.copy(ep).addScaledVector(this.dir0, 1.05 + k * k * 2.6);
        r.scale.setScalar(0.8 + k * 0.2);
        if (k >= 1) { this.state = 'flying'; this.t = 0; this.p0.copy(r.position).sub(ep); }
      } else {
        this.t += step;
        const u = Math.min(1, this.t / this.cruise);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const P0 = ep.clone().add(this.p0);
        const toR = P0.clone().sub(dp).normalize();
        const P2 = dp.clone().addScaledVector(toR, destR * 2.4 + 0.6).add(new THREE.Vector3(0, destR * 0.8, 0));
        const mid = P0.clone().add(P2).multiplyScalar(0.5);
        const span = P0.distanceTo(P2);
        const side = new THREE.Vector3().crossVectors(P2.clone().sub(P0), up).normalize();
        // Le chemin contourne le Soleil au lieu de passer à travers
        const flat = mid.clone().setY(0);
        const minR = Math.max(P0.length(), P2.length()) * 0.75;
        if (this.destId !== 'moon' && flat.length() < minR) {
          const out = flat.length() > 0.5 ? flat.normalize() : side.clone().multiplyScalar(this.sideSign || 1);
          mid.copy(out.multiplyScalar(minR / 0.75));
        } else mid.addScaledVector(side, span * 0.12);
        const P1 = mid.addScaledVector(up, span * 0.15);
        const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
        r.position.set(0, 0, 0).addScaledVector(P0, a).addScaledVector(P1, b).addScaledVector(P2, c);
        const day = Math.max(1, Math.round(u * this.days));
        $('trip-count').textContent = this.days > 700 ? `An ${fmt(day / 365, 1)} / ${fmt(this.days / 365, 1)}` : `Jour ${day} / ${this.days}`;
        $('trip-bar').style.width = `${u * 100}%`;
        if (u >= 1) return this.arrive();
      }

      // Orientation selon la direction du mouvement
      const vel = r.position.clone().sub(prev);
      if (vel.lengthSq() > 1e-8) {
        const q = new THREE.Quaternion().setFromUnitVectors(up, vel.normalize());
        r.quaternion.slerp(q, 1 - Math.exp(-dt * 8));
      }
      const fl = r.userData.flame;
      fl.scale.set(0.26 + Math.random() * 0.08, 0.45 + Math.random() * 0.3, 1);
      fl.material.opacity = 0.6 + Math.random() * 0.2;

      // Traînée
      const tail = new THREE.Vector3(0, -0.8 * r.scale.x, 0).applyQuaternion(r.quaternion).add(r.position);
      this.trail.unshift(tail);
      if (this.trail.length > 240) this.trail.pop();
      this.trail.forEach((p, i) => {
        this.trailPos.set([p.x + (Math.random() - 0.5) * 0.05, p.y + (Math.random() - 0.5) * 0.05, p.z], i * 3);
        const f = 1 - i / 240;
        const k = i < 4 ? 0 : f * 0.4;
        this.trailCol.set([k, k * 0.62, k * 0.3], i * 3);
      });
      this.trailGeo.setDrawRange(0, this.trail.length);
      this.trailGeo.attributes.position.needsUpdate = true;
      this.trailGeo.attributes.color.needsUpdate = true;

      // Caméra de poursuite
      const fwd = new THREE.Vector3(0, 1, 0).applyQuaternion(r.quaternion);
      const camWant = r.position.clone().addScaledVector(fwd, this.state === 'launch' ? -3.2 : -4.2).add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(new THREE.Vector3().crossVectors(fwd, up).normalize(), 1.2);
      const ca = 1 - Math.exp(-dt * 3);
      app.camera.position.lerp(camWant, ca);
      app.controls.target.lerp(r.position.clone().addScaledVector(fwd, 2.5), ca * 1.5);
    },
    arrive() {
      this.state = 'arrived';
      sfx.arrive();
      confetti(90);
      const dest = this.dest;
      const d = dest.data;
      this.cleanup();
      $('trip-count').textContent = 'Arrivé ! 🎉';
      $('trip-bar').style.width = '100%';
      const real = TRIP_DAYS[this.destId];
      const human = real > 700 ? `${fmt(real / 365, real % 365 ? 1 : 0)} ans` : real > 60 ? `${Math.round(real / 30)} mois` : `${real} jours`;
      say(`Bravo, tu es arrivé ${this.destId === 'moon' ? 'sur la Lune' : `près de ${shortOf(dest)}`} ! 🎉 En vrai, ce voyage dure environ ${human}. ${d.wow}`, { stay: 12000 });
      select(dest, { speakIt: false });
      setTimeout(() => {
        if (current !== rocket) return;
        $('dest-grid').classList.remove('hidden');
        $('trip').classList.add('hidden');
        this.state = 'menu';
      }, 2500);
    },
    onPick(b) {
      if (this.state === 'launch' || this.state === 'flying') return true;
      if (b.id === 'earth' || b.isSun || b.isCraft) return false;
      this.launch(b.id);
      return true;
    },
    exit() { this.cleanup(); this.state = 'menu'; app.clearFocus(); },
  };

  // =========================================================
  // 🌗 JOUR & NUIT, PHASES DE LA LUNE
  // =========================================================
  const PHASES = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
  const daynight = {
    needs3D: true,
    enter() {
      const earth = B('earth');
      // Épingle "Tu es ici" sur la France
      this.pin = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTexture(), depthWrite: false, transparent: true }));
      this.pin.scale.setScalar(0.22);
      this.pinBase = latLonToVec3(46.6, 2.4, 1.02);
      this.pin.position.copy(this.pinBase);
      earth.mesh.add(this.pin);
      const el = document.createElement('div');
      el.className = 'label small';
      el.textContent = '📍 France';
      this.pinLabel = new CSS2DObject(el);
      this.pinLabel.position.copy(latLonToVec3(46.6, 2.4, 1.25));
      earth.mesh.add(this.pinLabel);
      // Axe de rotation de la Terre
      const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.2, 8), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.8 }));
      earth.tilt.add(axis);
      this.axis = axis;
      this.spinBoost = 0;
      // Vue de côté : on voit la frontière entre le jour et la nuit
      const ep = earth.group.getWorldPosition(new THREE.Vector3());
      const toSun = ep.clone().negate().normalize();
      const side = new THREE.Vector3().crossVectors(toSun, up).normalize();
      app.focusOn(earth, 6.5, { dir: side.multiplyScalar(0.9).addScaledVector(toSun, 0.35).add(new THREE.Vector3(0, 0.35, 0)) });
      showPanel(`
        <h3>🌗 Le jour et la nuit</h3>
        <p>La Terre tourne sur elle-même comme une toupie, en <b>24 heures</b>. Le côté tourné vers le Soleil a le <b>jour</b> ☀️, l'autre côté a la <b>nuit</b> 🌙.</p>
        <div class="here"><span class="big" id="dn-ico">☀️</span><span id="dn-txt"></span></div>
        <div class="phase"><canvas id="dn-moon" width="144" height="144"></canvas><div><small class="note">La Lune vue depuis la Terre :</small><br><b id="dn-phase"></b></div></div>
        <div class="btn-row">
          <button class="btn primary" id="dn-spin">🔄 Faire tourner la Terre</button>
          <button class="btn" id="dn-season">🍂 Et les saisons ?</button>
          <button class="btn" id="dn-moonbtn">🌙 Suivre la Lune</button>
        </div>
        <p class="note" id="dn-extra"></p>`);
      $('dn-spin').addEventListener('click', () => { sfx.click(); this.spinBoost = this.spinBoost ? 0 : 2.4; $('dn-spin').textContent = this.spinBoost ? '⏸️ Arrêter' : '🔄 Faire tourner la Terre'; });
      $('dn-season').addEventListener('click', () => {
        sfx.click();
        const t = 'La Terre est penchée (regarde son axe bleu). Pendant l\'année, c\'est parfois notre moitié qui penche vers le Soleil : il fait chaud, c\'est l\'été ! Six mois plus tard, elle penche de l\'autre côté : c\'est l\'hiver.';
        $('dn-extra').textContent = t;
        say(t, { stay: 14000 });
        app.setTimeIndex(4);
        app.focusOn(earth, 11, { dir: new THREE.Vector3(0.2, 0.6, 1) });
      });
      $('dn-moonbtn').addEventListener('click', () => {
        sfx.click();
        const t = 'La Lune ne brille pas toute seule : elle est éclairée par le Soleil. Comme elle tourne autour de la Terre, on voit une partie plus ou moins grande de son côté éclairé. Ce sont les phases !';
        $('dn-extra').textContent = t;
        say(t, { stay: 12000 });
        app.focusOn(earth, 8.5, { dir: new THREE.Vector3(0, 1, 0.35) });
      });
      say('Regarde la Terre : une moitié est éclairée par le Soleil, l\'autre est dans le noir. Le petit point rose, c\'est la France ! Appuie sur « Faire tourner » pour voir le jour se lever.', { stay: 12000 });
    },
    update(dt) {
      const earth = B('earth');
      if (this.spinBoost) earth.mesh.rotation.y += dt * this.spinBoost;
      this.pin.material.opacity = 0.75 + Math.sin(performance.now() / 200) * 0.25;
      // Jour ou nuit en France ?
      const pw = this.pin.getWorldPosition(new THREE.Vector3());
      const ew = earth.group.getWorldPosition(new THREE.Vector3());
      const n = pw.clone().sub(ew).normalize();
      const s = ew.clone().negate().normalize();
      const dot = n.dot(s);
      const state = dot > 0.1 ? 'day' : dot > -0.1 ? 'dusk' : 'night';
      if (state !== this.lastState) {
        this.lastState = state;
        $('dn-ico').textContent = state === 'day' ? '☀️' : state === 'dusk' ? '🌅' : '🌙';
        $('dn-txt').textContent = state === 'day' ? 'En France, c\'est le jour !' : state === 'dusk' ? 'En France, le Soleil se lève ou se couche…' : 'En France, c\'est la nuit : dodo ! 😴';
      }
      // Phase de la Lune
      const moon = B('moon');
      const mw = moon.mesh.getWorldPosition(new THREE.Vector3());
      const toMoon = mw.sub(ew).setY(0).normalize();
      const toSun = s.setY(0).normalize();
      let ang = Math.acos(THREE.MathUtils.clamp(toMoon.dot(toSun), -1, 1)); // 0 = nouvelle lune
      const cross = new THREE.Vector3().crossVectors(toSun, toMoon).y;
      const waxing = cross > 0;
      const phaseAngle = waxing ? ang : Math.PI * 2 - ang;
      const idx = Math.round((phaseAngle / (Math.PI * 2)) * 8) % 8;
      if (idx !== this.lastPhase || !this.drawn) {
        this.lastPhase = idx;
        $('dn-phase').textContent = PHASES[idx];
      }
      this.drawMoon(phaseAngle);
    },
    drawMoon(p) {
      const c = $('dn-moon');
      if (!c) return;
      const g = c.getContext('2d');
      const R = 60, cx = 72, cy = 72;
      g.clearRect(0, 0, 144, 144);
      g.fillStyle = '#2a3150';
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      const lit = '#f4f1e4';
      const waxing = p < Math.PI;
      const k = Math.cos(p); // 1 = nouvelle, -1 = pleine
      g.fillStyle = lit;
      g.beginPath();
      g.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, !waxing);
      g.fill();
      g.fillStyle = k > 0 ? '#2a3150' : lit;
      g.beginPath();
      g.ellipse(cx, cy, Math.abs(k) * R, R, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
      this.drawn = true;
    },
    exit() {
      [this.pin, this.pinLabel, this.axis].forEach((o) => o && o.removeFromParent());
      if (this.pinLabel) this.pinLabel.element.remove();
      this.lastState = null;
      this.drawn = false;
      app.clearFocus();
      if (app.timeIndex > 2) app.setTimeIndex(2);
    },
  };

  // =========================================================
  // 🛰️ VAISSEAUX DE LA NASA
  // =========================================================
  const crafts = {
    needs3D: true,
    enter(opts) {
      const p = showPanel(`
        <h3>🛰️ Les vaisseaux de la NASA</h3>
        <p>Ces modèles 3D sont les vrais plans des engins envoyés dans l'espace. Choisis-en un pour aller le voir de près !</p>
        <div class="craft-grid" id="craft-grid"></div>`);
      const grid = p.querySelector('#craft-grid');
      const fill = () => {
        grid.innerHTML = '';
        CRAFTS.forEach((c) => {
          const b = document.createElement('button');
          const ok = app.crafts.get(c.id);
          b.innerHTML = `<span>${c.emoji}</span>${c.name}${ok ? '' : '<small class="note">chargement…</small>'}`;
          b.disabled = !ok;
          b.addEventListener('click', () => this.show(c.id));
          grid.appendChild(b);
        });
      };
      fill();
      if (!app.modelsReady) this.iv = setInterval(() => { fill(); if (app.modelsReady) clearInterval(this.iv); }, 700);
      say('Ces engins sont des modèles 3D créés par la NASA ! Certains tournent autour des planètes, d\'autres roulent dessus. Choisis-en un !', { stay: 9000 });
      if (opts.craft) setTimeout(() => this.show(opts.craft), 100);
    },
    show(id) {
      const c = app.crafts.get(id);
      if (!c) return;
      select(c);
    },
    exit() { clearInterval(this.iv); app.clearFocus(); },
  };

  // =========================================================
  // ❓ QUIZ
  // =========================================================
  const quiz = {
    enter() {
      document.body.classList.add('quiz-mode');
      app.clearFocus();
      app.resetView();
      const pool = QUIZ.filter((q) => app.dim > 0.5 || q.a !== 'moon');
      this.qs = pool.sort(() => Math.random() - 0.5).slice(0, 8);
      this.i = 0;
      this.score = 0;
      this.tries = 0;
      this.render();
      say('C\'est l\'heure du quiz ! Les noms sont cachés… Réponds en touchant le bon astre. À toi de jouer ! 🧠', { stay: 7000 });
    },
    render() {
      const q = this.qs[this.i];
      const stars = '⭐'.repeat(this.score) + '☆'.repeat(Math.max(0, this.i - this.score));
      showPanel(`
        <div class="quiz-top"><span>Question ${this.i + 1} / ${this.qs.length}</span><span class="stars">${stars}</span></div>
        <div class="quiz-q">${q.q}</div>
        <div class="quiz-fb" id="qz-fb">👆 Touche l'astre dans l'espace</div>
        <div class="btn-row"><button class="btn" id="qz-skip">⏭️ Passer</button><button class="btn" id="qz-hint">💡 Indice</button></div>`);
      $('qz-skip').addEventListener('click', () => this.reveal(false));
      $('qz-hint').addEventListener('click', () => {
        const b = B(q.a);
        sfx.click();
        $('qz-fb').className = 'quiz-fb';
        $('qz-fb').textContent = `💡 Son symbole : ${b.data.emoji}  —  ${b.data.kind}`;
        api.selected = null;
      });
      speak(q.q);
    },
    onPick(b) {
      if (this.lock) return true;
      const q = this.qs[this.i];
      if (b.isCraft) return true;
      const fb = $('qz-fb');
      if (b.id === q.a) {
        this.score += this.tries === 0 ? 1 : 0;
        sfx.good();
        confetti(60);
        fb.className = 'quiz-fb good';
        fb.textContent = `🎉 Bravo ! C'est bien ${nameOf(b)} !`;
        say(`Bravo ! C'est bien ${nameOf(b)} ! ${b.data.wow}`, { stay: 5000 });
        api.selected = b;
        b.label.element.style.opacity = 1;
        this.next(b);
      } else {
        this.tries++;
        sfx.bad();
        $('panel').classList.remove('shake');
        void $('panel').offsetWidth;
        $('panel').classList.add('shake');
        fb.className = 'quiz-fb bad';
        fb.textContent = `Oups, ça c'est ${nameOf(b)}. ${this.tries >= 2 ? '' : 'Essaie encore !'}`;
        if (this.tries >= 2) this.reveal(false);
      }
      return true;
    },
    reveal() {
      const q = this.qs[this.i];
      const b = B(q.a);
      api.selected = b;
      b.label.element.style.opacity = 1;
      $('qz-fb').className = 'quiz-fb';
      $('qz-fb').textContent = `👉 La réponse était : ${nameOf(b)}`;
      say(`La réponse était ${nameOf(b)}. Regarde, elle est entourée !`, { stay: 4000 });
      this.next(b);
    },
    next(b) {
      this.lock = true;
      setTimeout(() => {
        b.label.element.style.opacity = '';
        this.lock = false;
        this.tries = 0;
        api.selected = null;
        if (current !== quiz) return;
        this.i++;
        if (this.i >= this.qs.length) this.finish();
        else this.render();
      }, 2600);
    },
    finish() {
      const n = this.qs.length;
      const s = this.score;
      const stars = s >= n - 1 ? 3 : s >= n / 2 ? 2 : s > 0 ? 1 : 0;
      const msg = stars === 3 ? 'Incroyable, tu es un vrai astronaute ! 🧑‍🚀' : stars === 2 ? 'Super ! Tu connais bien le système solaire !' : 'Pas mal ! Explore encore un peu et réessaie !';
      sfx.win();
      confetti(220);
      showPanel(`
        <h3>🏆 Résultat</h3>
        <div class="final-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <p style="text-align:center;font-size:20px"><b>${s} / ${n}</b> bonnes réponses du premier coup</p>
        <p style="text-align:center">${msg}</p>
        <div class="btn-row" style="justify-content:center"><button class="btn primary" id="qz-again">🔁 Rejouer</button><button class="btn" id="qz-out">🔍 Explorer</button></div>`);
      say(msg, { stay: 8000 });
      $('qz-again').addEventListener('click', () => start('quiz'));
      $('qz-out').addEventListener('click', () => start('explore'));
    },
    exit() { document.body.classList.remove('quiz-mode'); this.lock = false; },
  };

  const ACT = { explore, weight, sizes, rocket, daynight, crafts, quiz };
  return api;
}
