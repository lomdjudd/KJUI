// Point d'entrée : crée le jeu, l'interface, puis affiche l'écran titre.
import './ui/style.css';
import { Game } from './game/game.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Touch } from './ui/touch.js';
import { audio } from './core/audio.js';

function fail(err) {
  console.error(err);
  const e = document.getElementById('boot-error');
  e.style.display = 'block';
  e.innerHTML = '<h2>Impossible de démarrer le jeu</h2><p>Votre appareil ou navigateur ne prend peut-être pas en charge WebGL 2.</p><pre style="white-space:pre-wrap;font-size:12px;opacity:.7"></pre>';
  e.querySelector('pre').textContent = String(err && err.stack ? err.stack : err);
}

async function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  const hud = new Hud(game);
  const menus = new Menus(game);
  game.attachUI(hud, menus);
  game.touch = new Touch(game);
  window.__game = game;
  // L'audio ne peut démarrer qu'après une interaction
  const unlock = () => audio.init();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock, { passive: true });
  game.start();
  await game.showTitle();
  document.getElementById('loading').classList.remove('show');
  menus.showTitle();
  // Mise à jour des commandes tactiles et navigation manette dans les menus
  const tick = () => {
    requestAnimationFrame(tick);
    if (game.touch) game.touch.update();
    menus.pollGamepad();
  };
  tick();
  // Bouton retour Android → pause / retour
  window.__androidBack = () => {
    if (menus.isOpen()) menus.back();
    else if (game.state === 'playing') menus.openPause();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing' && !menus.isOpen()) menus.openPause();
  });
}

boot().catch(fail);
window.addEventListener('error', (e) => {
  if (!window.__game) fail(e.error || e.message);
});
