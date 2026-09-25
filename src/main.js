import { Game } from './game.js';

const game = new Game();
window.__game = game; // pratique pour déboguer depuis la console

// Toute erreur inattendue est affichée à l'écran plutôt que de laisser un écran vide
window.addEventListener('error', (e) => game.showError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => game.showError(e.reason));

game.init().catch((err) => {
  console.error(err);
  const t = document.getElementById('load-text');
  if (t) t.textContent = `Erreur au chargement : ${err.message}`;
  game.showError(err);
});
