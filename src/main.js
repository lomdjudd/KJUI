import { Game } from './game.js';

const game = new Game();
window.__game = game; // pratique pour déboguer depuis la console
game.init().catch((err) => {
  console.error(err);
  const t = document.getElementById('load-text');
  if (t) t.textContent = `Erreur au chargement : ${err.message}`;
});
