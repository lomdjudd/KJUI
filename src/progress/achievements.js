import { SUIT_ORDER, suitUnlocked } from '../player/suits.js';

// Trophées : chaque entrée a une condition évaluée sur la sauvegarde (et l'état du jeu)
const c = (s, k) => (s.counters && s.counters[k]) || 0;

export const ACHIEVEMENTS = [
  { key: 'balance', icon: '🕸️', name: 'Premier balancement', desc: 'Te balancer au bout d’une toile', test: (s) => c(s, 'swings') >= 1 },
  { key: 'vitesse', icon: '💨', name: 'Mur du son', desc: 'Dépasser 50 m/s', test: (s) => c(s, 'maxSpeed') >= 50 },
  { key: 'nuages', icon: '☁️', name: 'La tête dans les nuages', desc: 'Monter à plus de 200 m', test: (s) => c(s, 'maxAltitude') >= 200 },
  { key: 'combo20', icon: '👊', name: 'Enchaînement', desc: 'Réussir un combo x20', test: (s) => c(s, 'maxCombo') >= 20 },
  { key: 'combo50', icon: '🔥', name: 'Inarrêtable', desc: 'Réussir un combo x50', test: (s) => c(s, 'maxCombo') >= 50 },
  { key: 'ennemis50', icon: '🦹', name: 'Voisin sympathique', desc: 'Vaincre 50 ennemis', test: (s) => c(s, 'enemies') >= 50 },
  { key: 'ennemis200', icon: '🏙️', name: 'Protecteur de New York', desc: 'Vaincre 200 ennemis', test: (s) => c(s, 'enemies') >= 200 },
  { key: 'entoile', icon: '🧶', name: 'Emballé, c’est pesé', desc: 'Entoiler 20 ennemis', test: (s) => c(s, 'webbed') >= 20 },
  { key: 'parfait', icon: '⚡', name: 'Sens d’araignée', desc: 'Réussir 10 esquives parfaites', test: (s) => c(s, 'perfectDodges') >= 10 },
  { key: 'lancer', icon: '🎯', name: 'Bowling urbain', desc: 'Lancer un ennemi sur un autre', test: (s) => c(s, 'throwHits') >= 1 },
  { key: 'crimes10', icon: '🚨', name: 'Justicier', desc: 'Arrêter 10 crimes', test: (s) => (s.crimes || 0) >= 10 },
  { key: 'sacs', icon: '🎒', name: 'Souvenirs retrouvés', desc: 'Trouver tous les sacs à dos', test: (s, g) => g && s.bags.length >= g.missions.totalBags },
  { key: 'bases', icon: '🏴', name: 'Grand nettoyage', desc: 'Démanteler toutes les bases ennemies', test: (s) => (s.bases || []).length >= 3 },
  { key: 'or', icon: '🥇', name: 'Plus rapide que la toile', desc: 'Médaille d’or dans tous les défis', test: (s) => (s.gold || []).length >= 3 },
  { key: 'bouffon', icon: '🎃', name: 'Fin de la farce', desc: 'Vaincre le Bouffon Vert', test: (s) => s.completed.includes('bouffon') },
  { key: 'rhino', icon: '🦏', name: 'Corrida', desc: 'Vaincre le Rhino', test: (s) => s.completed.includes('rhino') },
  { key: 'vautour', icon: '🦅', name: 'Ailes coupées', desc: 'Vaincre le Vautour', test: (s) => s.completed.includes('vautour') },
  { key: 'photo', icon: '📸', name: 'Photographe du Bugle', desc: 'Prendre une photo en mode photo', test: (s) => c(s, 'photos') >= 1 },
  { key: 'metro', icon: 'Ⓜ️', name: 'Usager du métro', desc: 'Découvrir toutes les stations de métro', test: (s) => (s.stations || []).length >= 6 },
  { key: 'garde', icon: '👕', name: 'Garde-robe complète', desc: 'Débloquer tous les costumes', test: (s) => SUIT_ORDER.every((k) => suitUnlocked(k, s)) },
  { key: 'niveau10', icon: '⭐', name: 'Vétéran', desc: 'Atteindre le niveau 10', test: (s) => s.level >= 10 },
];

export class Achievements {
  constructor(game) {
    this.game = game;
    this.t = 0;
  }

  check() {
    const s = this.game.save;
    s.achievements = s.achievements || [];
    for (const a of ACHIEVEMENTS) {
      if (s.achievements.includes(a.key)) continue;
      let ok = false;
      try {
        ok = a.test(s, this.game);
      } catch {
        ok = false;
      }
      if (ok) {
        s.achievements.push(a.key);
        this.game.hud.trophy(a);
        this.game.audio.play('level', 0.7);
        this.game.saveGame();
      }
    }
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1;
    this.check();
  }
}
