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

**Sur Android :** télécharge [`dist/spiderman-monde-ouvert.apk`](dist/spiderman-monde-ouvert.apk) sur ton téléphone, ouvre-le et autorise l'installation depuis cette source quand Android le demande. Le jeu se lance en plein écran, en paysage, et fonctionne hors ligne (Android 7 ou plus récent). La version 2.0 s'installe par-dessus la 1.0 sans perdre la sauvegarde. Le bouton Retour ferme le menu ouvert ou met le jeu en pause, le mode photo enregistre les images dans *Images/Spider-Man* et le téléphone vibre sur les coups et les chocs (réglable dans les options).

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
- Ville vivante : parc, pont suspendu, quartier de **néons** façon Times Square, hélicoptères avec projecteurs, cycle jour/nuit avec fenêtres éclairées, **pluie et orages** (chaussée mouillée, éclairs), nuages et reflets dans l'eau. Météo et heure réglables dans les options.
- Mini-carte, grande carte, marqueurs d'objectifs, musique et bruitages synthétisés.

### Nouveautés de la version 2.0
- **Véhicules modélisés** : berlines, citadines, SUV, taxis jaunes, fourgons de livraison, bus urbains et voitures de police, avec roues qui tournent, feux stop au freinage, clignotants dans les virages, phares et halos lumineux la nuit, gyrophares près des combats.
- **Vraie circulation** : deux voies par sens, feux tricolores synchronisés aux carrefours, files de voitures qui freinent et redémarrent, virages à droite et à gauche, coups de klaxon quand Spider-Man bloque la route.
- **Foule animée** : des centaines de passants (tenues, coupes et morphologies variées) qui marchent, s'écartent, fuient les combats, acclament Spider-Man ou le filment avec leur téléphone.
- **Rues de New York détaillées** : mâts de feux avec plaques de rue, feux piétons, arbres d'alignement, bouches à incendie, poubelles, bancs, abribus, boîtes à journaux, auvents de magasins, escaliers de secours, climatiseurs aux fenêtres, édicules et ventilations sur les toits.
- **Ennemis habillés** : sweats à capuche, blousons de cuir, gilets tactiques, jeans et pantalons cargo, visages, cagoules, bandanas, bonnets, casquettes, lunettes, pistolets et protections.
- **Rendu plus réaliste** : brume de hauteur et perspective atmosphérique, nuages éclairés par le soleil, pollution lumineuse la nuit, occlusion ambiante au pied des immeubles.
- **Interface refaite** : écran titre cinématique, écran de chargement avec astuces, menu pause plein écran (progression, costumes, compétences, trophées, options, commandes), HUD épuré, polices professionnelles embarquées, boutons tactiles avec icônes qui changent selon la situation (combat ou déplacement).
- **Options complètes** : qualité, résolution, affichage des images/s, volume de la musique et des effets, sensibilité, inversion de l'axe vertical, taille et opacité des boutons tactiles, vibrations.
- Spider-Man s'incline dans les virages et suit la caméra du regard.

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

Sur téléphone et tablette, des commandes tactiles apparaissent automatiquement : joystick à gauche, glisser à droite pour la caméra, boutons d'action à droite. Les boutons de combat (assaut, soin, coup de grâce, style) n'apparaissent qu'en combat, et le bouton jaune **!** près d'une mission.

## 📱 Reconstruire l'APK Android

L'application est une simple WebView qui affiche `dist/index.html` (polices embarquées, aucun accès réseau). Sur Ubuntu/Debian :

```bash
sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk
npm run apk      # régénère dist/index.html puis dist/spiderman-monde-ouvert.apk
```

Pour une nouvelle version installable par-dessus l'ancienne (sans perdre la sauvegarde), augmente le numéro : `VERSION_CODE=3 VERSION_NAME=2.1 npm run apk`. L'APK est signé avec `android/debug.keystore`, une clé de débogage volontairement publique (mot de passe `android`) : elle sert uniquement à pouvoir mettre à jour l'appli installée, pas à publier sur le Play Store.

Les polices Bebas Neue, Barlow et Barlow Condensed (paquets npm `@fontsource`) sont intégrées au fichier du jeu ; elles sont sous licence SIL Open Font License (`licenses/`).

## 🧱 Organisation du code

```
src/
  main.js, game.js     boucle de jeu, menus, sauvegarde, rendu (Three.js)
  camera.js            caméra à la 3e personne
  engine/              entrées (clavier, souris, manette, tactile), audio synthétisé, utilitaires
  world/               ville (néons, métro, façades), mobilier urbain et feux, véhicules et circulation, foule, ciel et brume, météo et hélicoptères, textures procédurales
  player/              squelette, costumes, compétences, animations procédurales, déplacements (toile, murs), combat et styles
  npc/                 ennemis (IA, jetons d'attaque) et leurs tenues, boss volants (Bouffon, Vautour), Rhino
  progress/            trophées
  missions/            missions d'histoire et activités secondaires
  fx/                  particules, fils de toile, projectiles, marqueurs
  ui/                  interface (barres, mini-carte, marqueurs), menus (costumes, compétences, trophées, options), mode photo
android/               application Android (WebView plein écran), icônes, script de construction de l'APK
licenses/              licences des polices embarquées
```
