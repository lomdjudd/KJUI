// Point d'entrée : chargement, boucle principale, navigation entre écrans.

import { Renderer } from './render/renderer.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { SolarSystem } from './core/bodies.js';
import { GameState, Settings } from './progress/game.js';
import { Career } from './progress/career.js';
import { saveMedal, MEDALS } from './progress/challenges.js';
import { Builder } from './builder/builder.js';
import { Flight } from './flight/flight.js';
import { Showcase } from './flight/showcase.js';
import { PlanetTextures } from './render/planettex.js';
import { MenuScreen, HubScreen, TechScreen, openSettings } from './ui/screens.js';
import { setLoading, toast, modal, h } from './ui/dom.js';
import { materials } from './parts/materials.js';
import { Craft } from './craft/craft.js';
import { fmtMoney } from './core/math.js';

class App {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.settings = Settings.get();
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (this.isTouch) document.body.classList.add('is-touch');
    const qp = new URLSearchParams(location.search).get('q');
    this.R = new Renderer(this.canvas, qp || this.settings.quality);
    this.input = new Input();
    this.audio = new Audio();
    this.audio.setVolumes(this.settings.music, this.settings.sfx);
    this.system = new SolarSystem();
    this.game = GameState.load('sandbox') || new GameState('sandbox');
    this.career = new Career(this);
    this.screen = null;
    this.lastT = performance.now();
    window.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('keydown', () => this.audio.unlock());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.game) this.game.save(); });
  }

  async boot() {
    setLoading(0.05, 'Chargement des cartes de la Terre et de la Lune…');
    await frame();
    this.tex = new PlanetTextures(this.system, this.R.qualityName);
    await this.tex.loadReal();
    setLoading(0.35, 'Préparation des matériaux…');
    await frame();
    materials();
    setLoading(0.5, 'Construction du hall d\'assemblage…');
    await frame();
    this.builder = new Builder(this);
    setLoading(0.7, 'Génération du système solaire…');
    await frame();
    this.flight = new Flight(this);
    this.showcase = new Showcase(this.flight);
    this.tex.request('lune', true);
    this.tex.requestAll();
    this.menu = new MenuScreen(this);
    this.hub = new HubScreen(this);
    this.tech = new TechScreen(this);
    setLoading(1, 'Prêt');
    await frame();
    document.getElementById('loading').classList.remove('active');
    const qs = new URLSearchParams(location.search);
    if (qs.get('screen') === 'builder') { this.startMode('sandbox', false, true); }
    else this.goMenu();
    this.loop();
  }

  setScreen(s, ...args) {
    if (this.screen && this.screen.exit) this.screen.exit();
    this.screen = s;
    if (s.enter) s.enter(...args);
  }

  // ------------------------------------------------------------------------
  startMode(mode, fresh = false, toBuilder = false) {
    if (this.game) this.game.save();
    this.game = (!fresh && GameState.load(mode)) || new GameState(mode);
    this.challenge = null;
    this.game.save();
    if (toBuilder) this.goBuilder();
    else this.goHub();
    if (fresh && mode === 'career') {
      modal({
        title: 'Bienvenue dans votre agence spatiale',
        body: `<p>Vous disposez de <b>${fmtMoney(this.game.funds)}</b> et des technologies de base. Chaque mission accomplie rapporte des crédits et des points de science.</p>
<p>La science se dépense dans la <b>Recherche</b> pour débloquer de nouvelles pièces… et les technologies spéciales qui ouvrent l'accès aux mondes hostiles : coque pressurisée pour Vénus, blindage anti-radiations pour les lunes de Jupiter, isolation cryogénique pour Titan et Pluton.</p>
<p>Commencez par le <b>Hall d'assemblage</b> : ouvrez la bibliothèque et essayez la « Fusée-sonde Alpha ».</p>`,
        actions: [{ label: 'C\'est parti', kind: 'primary' }],
      });
    }
  }

  goMenu() {
    if (this.game) this.game.save();
    this.setScreen(this.menu);
  }

  goHub() {
    if (this.game.mode === 'challenge') { this.goMenu(); return; }
    this.game.save();
    this.setScreen(this.hub);
  }

  goTech() {
    this.setScreen(this.tech);
  }

  goBuilder(craftJSON) {
    this.setScreen(this.builder, craftJSON || null);
  }

  openSettings(onClose) {
    openSettings(this, onClose);
  }

  // Lancement d'une fusée depuis l'atelier ou le pas de tir
  launchCraft(craftJSON, isRevert = false) {
    const g = this.game;
    const c = Craft.fromJSON(craftJSON);
    const cost = c.cost();
    if (g.mode === 'career' && !isRevert) {
      const locked = c.parts.filter((p) => !g.unlocked(p.id));
      if (locked.length) { toast('Pièces verrouillées', 'Cette fusée utilise des technologies non recherchées.', 'bad'); return; }
      if (g.funds < cost) { toast('Fonds insuffisants', `Il faut ${fmtMoney(cost)} (disponible : ${fmtMoney(g.funds)}).`, 'bad'); return; }
    }
    if (g.mode === 'career') g.spend(cost);
    g.lastCraft = craftJSON;
    g.save();
    this.setScreen(this.flight, { craft: craftJSON, site: 'pad', cost });
  }

  resumeVessel(vd) {
    this.setScreen(this.flight, { vesselData: vd });
  }

  // Défis
  startChallenge(def) {
    if (this.game) this.game.save();
    this.game = new GameState('challenge');
    this.game.mode = 'challenge';
    this.challenge = {
      def,
      done: false,
      tick: (v, sim) => {
        const ch = this.challenge;
        if (!ch || ch.done) return;
        const res = def.check(v, sim);
        if (!res) return;
        ch.done = true;
        const newBest = res.medal ? saveMedal(def.id, res.medal) : false;
        const m = res.medal ? MEDALS[res.medal] : null;
        if (m) this.audio.success();
        modal({
          title: m ? `Médaille ${m.name} !` : 'Défi terminé',
          body: h('div', {}, h('p', {}, res.text), m ? h('p', { style: { color: m.color, fontWeight: 600 } }, newBest ? 'Nouveau record personnel.' : 'Bien joué.') : h('p', {}, 'Pas de médaille cette fois : réessayez !')),
          actions: [{ label: 'Réessayer', onClick: () => this.startChallenge(def) }, { label: 'Menu', kind: 'primary', onClick: () => this.goMenu() }],
        });
      },
    };
    this.setScreen(this.flight, { scenario: { create: (sys, sim) => def.create(sys, sim), site: def.site } });
    toast(def.name, def.goal, '', 7000);
  }

  loop() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    this.input.pollPad();
    try {
      if (this.screen) {
        this.screen.update(dt);
        this.screen.render(dt);
      }
    } catch (e) {
      console.error(e);
      if (!this.errShown) { this.errShown = true; toast('Erreur', e.message, 'bad', 8000); }
    }
    this.input.endFrame();
    requestAnimationFrame(() => this.loop());
  }
}

function frame() {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

const app = new App();
window.__app = app;
app.boot().catch((e) => {
  console.error(e);
  const m = document.getElementById('load-msg');
  if (m) m.textContent = 'Erreur : ' + e.message;
});
