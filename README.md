# 🕷️ Spider-Man : Monde Ouvert

Un jeu Spider-Man en 3D, **en monde ouvert**, jouable directement dans le navigateur. Il s'inspire des jeux Spider-Man classiques : tu te balances entre les gratte-ciel d'un Manhattan procédural, tu arrêtes des criminels avec plusieurs styles de combat, tu enchaînes les missions jusqu'au duel final contre le Bouffon Vert.

> Fan-game non officiel, gratuit et sans but commercial. Spider-Man, le Bouffon Vert, Oscorp et le Daily Bugle sont des marques de Marvel. Tous les graphismes et sons du jeu sont générés par le code (aucun élément extrait des jeux officiels).

> 🪐 **Nouveau : [Mon Système Solaire](systeme-solaire/README.md)**, une animation 3D interactive pour expliquer le système solaire aux enfants (plan 2D qui se transforme en 3D, modèles de la NASA, quiz, fusée…). Lancement : `npm run dev:solaire`.

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
- **Super-saut chargé** (maintenir Espace à l'arrêt) et **plongeon** en piqué (esquive en l'air, hors combat).
- Caméra qui suit la trajectoire, champ de vision qui s'élargit avec la vitesse, lignes de vitesse.

### Combat : 4 styles (chacun avec son costume)
| Touche | Style | Particularité |
|---|---|---|
| 1 | **Classique** (rouge et bleu) | Équilibré, enchaînement poings-pieds, coup de pied tournant final |
| 2 | **Acrobate** (costume noir) | Très rapide, saltos, coups de pied tournoyants, esquives plus longues |
| 3 | **Brute** (rouge et or) | Lent mais dévastateur, brise la garde des costauds, onde de choc au sol |
| 4 | **Tisseur** (bleu et noir) | Fouets de toile à longue portée, chaque coup entoile l'ennemi |

Plus : **lancer d'ennemi** (maintenir R : on attrape un ennemi à la toile et on le projette sur un autre), combos avec compteur, **projection en l'air et jonglage aérien**, **sens d'araignée** et **esquive parfaite au ralenti** avec contre-attaque renforcée, tir de toile pour **entoiler** les ennemis, **frappe-toile** (on fonce sur l'ennemi), jauge de **concentration** (soin ou **coup de grâce**) et 4 **gadgets** : bombe de toile, choc électrique, drone araignée, toile d'impact.

Ennemis : voyous, tireurs (à esquiver ou désarmer à distance), costauds qui bloquent les coups de face… et **3 boss** :
- **le Bouffon Vert** sur son planeur (bombes citrouilles, piqués, deuxième phase) ;
- **le Rhino**, qui charge dans les rues : esquive-le pour qu'il percute un mur, puis frappe-le pendant qu'il est sonné ;
- **le Vautour**, qui tourne au-dessus des toits et lance des plumes d'acier : englue ses ailes pour le faire tomber.

### Costumes, compétences, trophées
- **10 costumes** (Classique, Symbiote, Iron Spider, Spider 2099, Film 2002, Scarlet Spider, Miles, Noir, Négatif, Doré), chacun avec un **bonus** ; les 6 derniers se débloquent en jouant. En mode *Auto*, le costume suit le style de combat.
- **Arbre de compétences** en 3 branches (Défense, Combat, Toile) : 13 compétences, 1 point par niveau, par boss vaincu et par base démantelée.
- **21 trophées** à débloquer.
- **Mode photo** (touche O ou menu Pause) : caméra libre, filtres, poses de Spider-Man, enregistrement de l'image.

### Missions et monde ouvert
- **9 missions d'histoire** : tutoriel de balancement, braquage de banque, course-poursuite en voiture, sauvetage de civils dans un immeuble en feu, bombes citrouilles à désamorcer sur les toits, assaut de la tour Oscorp, puis les combats contre le Bouffon Vert, le Rhino et le Vautour.
- **Événements aléatoires** dans la ville : crimes, voleurs en fuite en voiture, laveurs de vitres qui tombent.
- **3 bases ennemies** sur les toits (3 vagues chacune), **3 défis de vitesse** chronométrés (médailles or/argent/bronze), **20 sacs à dos** cachés sur les toits.
- **6 stations de métro** à découvrir : voyage rapide en cliquant dessus sur la grande carte.
- Progression : expérience, niveaux (plus de santé et de dégâts), sauvegarde automatique dans le navigateur.
- Ville vivante : circulation, piétons, parc, pont suspendu, quartier de **néons** façon Times Square, hélicoptères avec projecteurs, cycle jour/nuit avec fenêtres éclairées, **pluie et orages** (chaussée mouillée, éclairs), nuages et reflets dans l'eau. Météo et heure réglables dans les options.
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
| Tir de toile (maintenir = lancer d'ennemi) | R | LB |
| Frappe-toile | F | Y |
| Gadget / changer de gadget | G / T ou molette | RB / croix haut |
| Soin / coup de grâce | H / V | croix bas / R3 |
| Styles de combat | 1 2 3 4 | croix gauche/droite |
| Lancer une mission (dans le faisceau jaune) | F ou Entrée | Y |
| Super-saut chargé | Maintenir Espace à l'arrêt | Maintenir A |
| Plongeon (en l'air, hors combat) | Clic droit ou C | B |
| Carte / pause / musique / mode photo | Tab / Échap ou P / N / O | Select / Start |

Sur téléphone et tablette, des commandes tactiles apparaissent automatiquement : joystick à gauche, glisser à droite pour la caméra, boutons d'action à droite.

## 🧱 Organisation du code

```
src/
  main.js, game.js     boucle de jeu, menus, sauvegarde, rendu (Three.js)
  camera.js            caméra à la 3e personne
  engine/              entrées (clavier, souris, manette, tactile), audio synthétisé, utilitaires
  world/               ville (néons, métro), ciel et cycle jour/nuit, météo et hélicoptères, circulation et piétons, textures procédurales
  player/              squelette, costumes, compétences, animations procédurales, déplacements (toile, murs), combat et styles
  npc/                 ennemis (IA, jetons d'attaque), boss volants (Bouffon, Vautour), Rhino
  progress/            trophées
  missions/            missions d'histoire et activités secondaires
  fx/                  particules, fils de toile, projectiles, marqueurs
  ui/                  interface (barres, mini-carte, marqueurs), menus (costumes, compétences, trophées, options), mode photo
```
