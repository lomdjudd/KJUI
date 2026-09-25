# 🕷️ Spider-Man : Monde Ouvert

Un jeu Spider-Man en 3D, **en monde ouvert**, jouable directement dans le navigateur. Il s'inspire des jeux Spider-Man classiques : tu te balances entre les gratte-ciel d'un Manhattan procédural, tu arrêtes des criminels avec plusieurs styles de combat, tu enchaînes les missions jusqu'au duel final contre le Bouffon Vert.

> Fan-game non officiel, gratuit et sans but commercial. Spider-Man, le Bouffon Vert, Oscorp et le Daily Bugle sont des marques de Marvel. Tous les graphismes et sons du jeu sont générés par le code (aucun élément extrait des jeux officiels).

## ▶️ Jouer

**Le plus simple :** ouvre le fichier [`dist/index.html`](dist/index.html) dans un navigateur récent (Chrome, Edge, Firefox, Safari). C'est un fichier unique qui contient tout le jeu, il marche même hors ligne (double-clic).

**En développement :**

```bash
npm install
npm run dev      # serveur de dev avec rechargement à chaud
npm run build    # régénère dist/index.html (fichier unique)
```

Options d'URL utiles : `?q=low|medium|high` force la qualité graphique, `?god` rend Spider-Man invincible.

## 🎮 Contenu

### Déplacements
- **Balancement physique à la toile** : le fil s'accroche aux vrais immeubles, avec pendule, élan, relâche et enchaînement automatique en maintenant la touche.
- **Propulsion-toile** en l'air, **point de lancement** vers les toits (le cercle blanc), **escalade et course sur les murs**, passage par-dessus les rebords, roulade à l'atterrissage.
- Caméra qui suit la trajectoire, champ de vision qui s'élargit avec la vitesse, lignes de vitesse.

### Combat : 4 styles (chacun avec son costume)
| Touche | Style | Particularité |
|---|---|---|
| 1 | **Classique** (rouge et bleu) | Équilibré, enchaînement poings-pieds, coup de pied tournant final |
| 2 | **Acrobate** (costume noir) | Très rapide, saltos, coups de pied tournoyants, esquives plus longues |
| 3 | **Brute** (rouge et or) | Lent mais dévastateur, brise la garde des costauds, onde de choc au sol |
| 4 | **Tisseur** (bleu et noir) | Fouets de toile à longue portée, chaque coup entoile l'ennemi |

Plus : combos avec compteur, **projection en l'air et jonglage aérien**, **sens d'araignée** et **esquive parfaite au ralenti** avec contre-attaque renforcée, tir de toile pour **entoiler** les ennemis, **frappe-toile** (on fonce sur l'ennemi), jauge de **concentration** (soin ou **coup de grâce**) et 4 **gadgets** : bombe de toile, choc électrique, drone araignée, toile d'impact.

Ennemis : voyous, tireurs (à esquiver ou désarmer à distance), costauds qui bloquent les coups de face… et le **Bouffon Vert** sur son planeur (bombes citrouilles, piqués, deuxième phase).

### Missions et monde ouvert
- **7 missions d'histoire** : tutoriel de balancement, braquage de banque, course-poursuite en voiture, sauvetage de civils dans un immeuble en feu, bombes citrouilles à désamorcer sur les toits, assaut de la tour Oscorp, combat final contre le Bouffon Vert au sommet de la tour.
- **Crimes aléatoires** qui apparaissent dans la ville, **3 défis de vitesse** chronométrés (médailles or/argent/bronze), **20 sacs à dos** cachés sur les toits.
- Progression : expérience, niveaux (plus de santé et de dégâts), sauvegarde automatique dans le navigateur.
- Ville vivante : circulation, piétons, parc, pont suspendu, cycle jour/nuit avec fenêtres éclairées, nuages et reflets dans l'eau.
- Mini-carte, grande carte, marqueurs d'objectifs, musique et bruitages synthétisés.

## ⌨️ Commandes

| Action | Clavier / souris | Manette |
|---|---|---|
| Se déplacer | ZQSD (AZERTY) ou WASD | Stick gauche |
| Caméra | Souris ou flèches | Stick droit |
| Sauter / propulsion en l'air | Espace | A |
| Sprint / **balancement** / course sur les murs | Maj (maintenir) | RT |
| Point de lancement | E | LT |
| Attaquer (maintenir = projection) | Clic gauche ou J | X |
| Esquiver | Clic droit ou C | B |
| Tir de toile | R | LB |
| Frappe-toile | F | Y |
| Gadget / changer de gadget | G / T ou molette | RB / croix haut |
| Soin / coup de grâce | H / V | croix bas / R3 |
| Styles de combat | 1 2 3 4 | croix gauche/droite |
| Lancer une mission (dans le faisceau jaune) | F ou Entrée | Y |
| Carte / pause / musique | Tab / Échap ou P / N | Select / Start |

Sur téléphone et tablette, des commandes tactiles apparaissent automatiquement : joystick à gauche, glisser à droite pour la caméra, boutons d'action à droite.

## 🧱 Organisation du code

```
src/
  main.js, game.js     boucle de jeu, menus, sauvegarde, rendu (Three.js)
  camera.js            caméra à la 3e personne
  engine/              entrées (clavier, souris, manette, tactile), audio synthétisé, utilitaires
  world/               génération de la ville, ciel et cycle jour/nuit, circulation et piétons, textures procédurales
  player/              squelette et costumes, animations procédurales, déplacements (toile, murs), combat et styles
  npc/                 ennemis (IA, jetons d'attaque), boss
  missions/            missions d'histoire et activités secondaires
  fx/                  particules, fils de toile, projectiles, marqueurs
  ui/                  interface (barres, mini-carte, marqueurs, textes)
```
