# ⚔️ Chevalier des Ombres

Action-RPG **dark fantasy en 3D**, dans l'esprit des jeux Xbox 360 : un chevalier maudit, des cimetières noyés de brume verte, des châteaux gothiques sous un ciel violet étoilé, des spectres, des liches et des chevaliers cornus. Jouable **à la troisième ou à la première personne**, sur **Android (APK)**, sur PC dans le navigateur ou à la manette.

Tous les graphismes (modèles, textures, ciel, effets) et tous les sons (effets et musique) sont **générés par le code** : aucun fichier externe, le jeu tient dans un seul fichier HTML d'environ 1,2 Mo et fonctionne hors ligne.

## 🌐 Jouer en ligne (sans rien installer)

Le jeu est publié sous forme de page web : **https://claude.ai/artifact/3aMX1wqZJe2jpMavTZiZzW**. Il s'ouvre sur téléphone (tactile, en tenant l'écran à l'horizontale), sur tablette ou sur PC. La page est privée par défaut ; pour la donner à d'autres personnes, utilise le menu **Partager** de la page. Les sauvegardes restent dans le navigateur utilisé : pour changer d'appareil, passe par **Sauvegarder → code d'export**.

## 📱 Installer l'APK (Android 7.0 ou plus)

1. Copie [`release/ChevalierDesOmbres.apk`](release/ChevalierDesOmbres.apk) sur le téléphone (ou télécharge-le depuis GitHub).
2. Ouvre-le, puis autorise **« Installer des applis inconnues »** si Android le demande.
3. Lance **Chevalier des Ombres** : le jeu s'ouvre en plein écran, en mode paysage.

L'APK fait environ 480 Ko, ne demande aucune permission réseau (seulement la vibration) et enregistre les sauvegardes dans le stockage privé de l'application. Il faut un téléphone compatible WebGL 2 (quasiment tous les appareils depuis 2016).

## 🖥️ Jouer sur PC

Ouvre [`dist/index.html`](dist/index.html) dans Chrome, Edge ou Firefox (double-clic : ça marche hors ligne). Clavier/souris ou manette Xbox.

## 🎮 Commandes

| Action | Clavier / souris | Manette | Tactile |
|---|---|---|---|
| Se déplacer / caméra | ZQSD ou WASD / souris | stick gauche / stick droit | joystick à gauche / glisser à droite |
| Sprint | Maj | L3 | joystick poussé à fond |
| Attaque légère (combo) | clic gauche ou J | X | bouton ⚔ ou toucher rapide à droite |
| Attaque lourde | K | Y ou RT | ⚒ |
| Roulade (invulnérable) | Alt ou C | B | ↻ |
| Garde / parade (au bon moment) | clic droit ou Q | LB ou LT | ⛨ (maintenu) |
| Saut | Espace | A | ⇧ |
| Pouvoirs | 1 à 4 | RB (croix ←/→ pour changer) | ✦ et ⟳ |
| Verrouiller une cible | T ou clic molette | R3 | ◎ |
| Fiole de vie / de mana | R / X | croix ↑ / ↓ | ⚱ |
| Interagir | E ou F | A (à proximité) | ✋ |
| Vue 1ʳᵉ / 3ᵉ personne | V | — | 👁 |
| Carte / pause | Tab, M / Échap | Back / Start | 🗺 / ☰ |

Sur Android, le bouton **retour** ouvre la pause et revient en arrière dans les menus.

## 📜 Contenu

- **Un monde en 9 régions** : Havre-des-Cendres (village-refuge), Cimetière des Brumes, Forêt Maudite, Marais Putride, Catacombes Pourpres, Château de Nocthar, Pics de Givre, Abîme Infernal et Citadelle du Néant. Chacune a son ambiance, sa lumière, sa musique, sa météo et ses feux de camp (points de voyage rapide).
- **47 types d'ennemis** : squelettes, archers, goules, spectres verts, feux follets, loups des ombres, araignées, loups-garous, slimes acides, sorcières des marais, banshees, mimics, armures vivantes, assassins, gargouilles, chevaliers cornus, liches, élémentaires de givre et de feu, yétis, démons, golems de lave, horreurs et yeux du Néant… Chacun a son comportement (mêlée, distance, magie, invocation, vol, embuscade).
- **25 boss** avec barre de vie, arène fermée par un mur de brume, plusieurs phases et plus de 20 familles d'attaques (coups au sol, ondes de choc, charges, sauts, pluies de projectiles, piliers, rayons, souffles, clones, téléportations, invocations…). Du Fossoyeur à la Dame Verte, jusqu'au Roi Liche, à la Reine de l'Hiver, à Asmoroth et au Roi Sans-Visage.
- **45 quêtes** : une quête principale en 14 étapes, des quêtes secondaires et des contrats de chasse, 5 personnages avec dialogues et boutiques (forge, armurerie, marchand mystique, intendant).
- **27 armes** en 5 styles de combat (épée à une main + bouclier, arme à deux mains, arme d'hast, dagues, bâton), avec éléments (feu, givre, foudre, poison, ombre, sacré) et améliorations à la forge ; **7 boucliers** ; **15 tenues** qui changent l'apparence et les statistiques.
- **32 compétences** dans 4 branches et **18 pouvoirs** (boule de feu, nova de givre, chaîne d'éclairs, loups spectraux, bouclier sacré, etc.).
- **Combat exigeant et lisible** : endurance, roulade avec invulnérabilité, parade puis riposte, combos, attaques lourdes, verrouillage de cible, altérations d'état (brûlure, poison, gel, ralentissement, étourdissement, choc), gel d'image à l'impact, tremblements de caméra.
- **Sauvegardes** : 3 emplacements + sauvegarde automatique, et un code d'export pour transférer sa partie d'un appareil à l'autre.
- **Paramètres (plus de 40 options)** : préréglages graphiques (bas → ultra), échelle de rendu et résolution dynamique, ombres, bloom, anticrénelage, grain, champ de vision, sensibilité, inversion des axes, difficulté (Écuyer → Cauchemar), aide à la visée, sous-titres, modes daltoniens, volumes séparés, taille/opacité/disposition gaucher des commandes tactiles, vibrations…

## ⚡ Optimisation

- Un seul appel de dessin par personnage (squelette rigide fusionné), décors instanciés par blocs avec élimination à distance, bâtiments fusionnés par matériau, 4 lumières recyclées affectées aux sources les plus proches.
- Environ 60 à 115 appels de dessin par image selon la région (ombres et post-traitement compris), 40 à 75 k triangles.
- Préréglage graphique choisi automatiquement selon l'appareil, résolution dynamique si le jeu ralentit, limite d'images par seconde réglable, pause automatique quand l'application passe en arrière-plan.

## 🛠️ Développement

```bash
npm install
npm run dev      # serveur de développement
npm run build    # génère dist/index.html (fichier unique, hors ligne)
npm run apk      # génère release/ChevalierDesOmbres.apk
```

La construction de l'APK n'a besoin ni d'Android Studio ni de Gradle : le script [`android/build-apk.sh`](android/build-apk.sh) récupère aapt2, `android.jar`, d8 et apksigner la première fois, puis empaquette le jeu dans une WebView plein écran ([`MainActivity.java`](android/java/com/kjui/chevalier/MainActivity.java)) avec un pont natif pour les sauvegardes, les vibrations et la touche retour. Il faut Node.js, un JDK 17 ou plus récent, `python3` et `zip`.

L'APK est signé avec la clé de test [`android/release.keystore`](android/release.keystore) (mot de passe `chevalier`). Pour une publication sur le Play Store, remplace-la par ta propre clé (`KS_PASS=… bash android/build-apk.sh`).

Le dossier [`dev/`](dev) contient les scripts de test automatisés (Playwright) : visite de toutes les régions, combats contre chaque ennemi et chaque boss, test tactile en mode téléphone, mesures de performance.

```
src/
  core/     moteur : entrées, audio procédural, paramètres, stockage
  gfx/      rendu : post-traitement HDR, textures et matériaux procéduraux, particules, effets
  actors/   modèles 3D générés, squelettes, animations
  world/    terrain, ciel, décors, bâtiments, collisions
  data/     armes, tenues, compétences, pouvoirs, ennemis, boss, régions, quêtes
  game/     joueur, combat, IA des ennemis et des boss, quêtes, sauvegardes
  ui/       interface, menus, carte, commandes tactiles
android/    enveloppe Android et script de construction de l'APK
```
