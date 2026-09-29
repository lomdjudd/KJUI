# ⚔️ Chevalier des Ombres

Action-RPG **dark fantasy en 3D**, dans l'esprit des jeux Xbox 360 : un chevalier maudit, des cimetières noyés de brume verte, des châteaux gothiques sous un ciel violet étoilé, des spectres, des liches et des chevaliers cornus. Jouable **à la troisième ou à la première personne**, sur **Android (APK)**, sur PC dans le navigateur ou à la manette.

Le chevalier est un **modèle 3D HD** (fichier GLB fourni, animé par le jeu) ; les monstres et les boss sont **sculptés par le jeu lui-même** lors de l'installation des données (anatomie HD, maillages lisses). Tout le reste — décors, textures, ciel, effets, bruitages et musique — est **généré par le code**. Le jeu tient dans un seul fichier HTML et fonctionne hors ligne.

## 🌐 Jouer en ligne (sans rien installer)

Le jeu est publié sous forme de page web : **https://claude.ai/artifact/3aMX1wqZJe2jpMavTZiZzW**. Il s'ouvre sur téléphone (tactile, en tenant l'écran à l'horizontale), sur tablette ou sur PC. La page est privée par défaut ; pour la donner à d'autres personnes, utilise le menu **Partager** de la page. Les sauvegardes restent dans le navigateur utilisé : pour changer d'appareil, passe par **Sauvegarder → code d'export**.

## 📱 Installer l'APK (Android 7.0 ou plus)

1. Sur le téléphone, ouvre ce lien dans Chrome pour télécharger l'APK directement :
   **https://github.com/lomdjudd/KJUI/raw/ccr-110bd93c-1zf4sl/chevalier-des-ombres/release/ChevalierDesOmbres.apk**
   (ou copie [`release/ChevalierDesOmbres.apk`](release/ChevalierDesOmbres.apk) sur le téléphone).
2. Ouvre-le, puis autorise **« Installer des applis inconnues »** si Android le demande.
3. Lance **Chevalier des Ombres** : le jeu s'ouvre en plein écran, en mode paysage.

L'APK fait environ 1,3 Mo, ne demande aucune permission réseau (seulement la vibration) et enregistre les sauvegardes dans le stockage privé de l'application. Il faut un téléphone compatible WebGL 2 (quasiment tous les appareils depuis 2016).

## 🖥️ Jouer sur PC

Ouvre [`dist/index.html`](dist/index.html) dans Chrome, Edge ou Firefox (double-clic : ça marche hors ligne). Clavier/souris ou manette Xbox.

## 🎮 Commandes

| Action | Clavier / souris | Manette | Tactile |
|---|---|---|---|
| Se déplacer / caméra | ZQSD ou WASD / souris | stick gauche / stick droit | joystick à gauche / glisser à droite |
| Sprint | Maj | L3 | glisser le doigt au-delà du cercle du joystick |
| Attaque légère (combo) | clic gauche ou J | X | bouton ⚔ ou toucher rapide à droite |
| Attaque lourde (maintenir = charger, 3 niveaux) | K | Y ou RT | ⚒ |
| Esquive (roulades, bond arrière, pas de garde, glissade, ruée aérienne) | Alt ou C | B | ↻ Esquive |
| Garde / parade (au bon moment) | clic droit ou Q | LB | ⛨ (maintenu) |
| Saut (deux fois = double saut) | Espace | A | ⇧ |
| Art d'arme | G | LT | ✧ |
| Mode furtif | Ctrl | L3 à l'arrêt | ◐ |
| Pouvoirs | 1 à 4 | RB (croix ←/→ pour changer) | ✦ et ⟳ |
| Verrouiller une cible | T ou clic molette | R3 | ◎ |
| Fiole de vie / de mana | R / X | croix ↑ / ↓ | ⚱ |
| Interagir | E ou F | A (à proximité) | ✋ |
| Vue 1ʳᵉ / 3ᵉ personne | V | — | 👁 |
| Carte / pause | Tab, M / Échap | Back / Start | 🗺 / ☰ |

Sur Android, le bouton **retour** ouvre la pause et revient en arrière dans les menus.

### ⚔️ Techniques

| Technique | Comment |
|---|---|
| Roulade | esquive + direction : vraie roulade avant ; avec une cible verrouillée, roulade avant, arrière, à gauche ou à droite en gardant l'ennemi en face |
| Bond arrière | esquive sans toucher au joystick |
| Pas de garde | esquive en tenant la garde : pas rapide de côté, en avant ou en arrière |
| Esquive parfaite — « Temps des Ombres » | esquiver au tout dernier moment : le monde ralentit, le chevalier non |
| Contre-attaque | attaquer juste après une esquive |
| Glissade / ruée aérienne | esquiver en sprintant / en l'air |
| Attaque en course, attaque glissée | attaquer en sprintant ou pendant une glissade |
| Attaque plongeante | attaquer en l'air, en hauteur : onde de choc à l'impact |
| Coup de pied | attaque lourde en tenant la garde : brise les boucliers |
| Exécution | attaquer un ennemi étourdi (après une parade ou un coup de pied) |
| Assassinat | en mode furtif, attaquer un ennemi de dos |
| Arts d'arme (mana) | Lame tourbillonnante (épée), Fracas tellurique (deux mains), Percée spectrale (hast), Danse des lames (dagues), Onde arcane (bâton) |

## 💾 Installation des données (premier lancement)

Au premier démarrage, un écran **« Installation des données »** prépare tout le contenu une fois pour toutes, puis le stocke sur l'appareil (IndexedDB, stockage persistant) :

1. **Analyse de l'appareil** : mémoire vive, processeur graphique, nombre de cœurs, plus un court test de performance CPU/GPU → palier Faible, Moyen, Élevé ou Ultra.
2. **Modèles** : le chevalier HD et ses 11 variantes de couleurs (ombre, néant, pourpre, cendre, givre, or, braise, os, émeraude, royal, obsidienne), en textures adaptées au palier (512 à 2048 px).
3. **Textures du monde** en haute définition (256 à 1024 px selon le palier).
4. **Banque de sons** : instruments (chœurs, cordes, violoncelle, cuivres, orgue, harpe, luth, piano, boîte à musique, cloches, timbales, taikos…) et plus de 50 bruitages avec variantes, calculés une fois (22, 32 ou 44 kHz selon le palier).
5. **Sculpture des créatures** : chaque monstre, boss et habitant reçoit une anatomie HD (muscles, crânes creusés, côtes, crocs, griffes, touffes de fourrure, plis de robes, plaques d'armure, fissures de lave lumineuses…). Les formes sont fusionnées en un maillage lisse aux articulations souples, calculé en parallèle sur plusieurs cœurs, avec un nombre de polygones adapté à l'appareil (4 500 à 13 000 sommets par créature, plus pour les boss).

Compter environ 15 à 40 secondes selon l'appareil. Les lancements suivants démarrent directement. **Pause → Paramètres → Appareil & données** permet de relancer l'analyse, de réinstaller ou de supprimer les données.

## 🧠 Profil de l'appareil et stabilité

- **Qualité automatique** : les réglages sont choisis d'après le palier détecté, puis ajustés en jeu si les images par seconde chutent ou si la mémoire estimée approche du budget.
- **Budget mémoire** calculé à partir de la mémoire vive (12 % sur téléphone, 20 % sur PC) : textures, ombres, cibles de rendu, géométries et sons sont comptabilisés et affichés dans l'onglet **Appareil & données**.
- **Nombre d'ennemis actifs limité** selon le palier (10 à 32) ; les ennemis lointains sont mis en veille.
- **Récupération graphique** : si Android reprend la mémoire du GPU, la partie est sauvegardée, puis l'affichage est rétabli avec une qualité réduite.
- Paramètres graphiques dédiés : modèle du chevalier (HD / classique), taille des textures, qualité des effets, distorsion, images rémanentes, ralentis, nombre d'ennemis, mode économie d'énergie, qualité audio et réverbération.

## 📜 Contenu

- **Un monde en 9 régions** : Havre-des-Cendres (village-refuge), Cimetière des Brumes, Forêt Maudite, Marais Putride, Catacombes Pourpres, Château de Nocthar, Pics de Givre, Abîme Infernal et Citadelle du Néant. Chacune a son ambiance, sa lumière, sa musique, sa météo et ses feux de camp (points de voyage rapide).
- **47 types d'ennemis** : squelettes, archers, goules, spectres verts, feux follets, loups des ombres, araignées, loups-garous, slimes acides, sorcières des marais, banshees, mimics, armures vivantes, assassins, gargouilles, chevaliers cornus, liches, élémentaires de givre et de feu, yétis, démons, golems de lave, horreurs et yeux du Néant… Chacun a son comportement (mêlée, distance, magie, invocation, vol, embuscade).
- **25 boss** avec barre de vie, arène fermée par un mur de brume, plusieurs phases et plus de 20 familles d'attaques (coups au sol, ondes de choc, charges, sauts, pluies de projectiles, piliers, rayons, souffles, clones, téléportations, invocations…). Du Fossoyeur à la Dame Verte, jusqu'au Roi Liche, à la Reine de l'Hiver, à Asmoroth et au Roi Sans-Visage.
- **45 quêtes** : une quête principale en 14 étapes, des quêtes secondaires et des contrats de chasse, 5 personnages avec dialogues et boutiques (forge, armurerie, marchand mystique, intendant).
- **27 armes** en 5 styles de combat (épée à une main + bouclier, arme à deux mains, arme d'hast, dagues, bâton), avec éléments (feu, givre, foudre, poison, ombre, sacré) et améliorations à la forge ; **7 boucliers** ; **15 tenues** qui changent l'apparence et les statistiques.
- **32 compétences** dans 4 branches et **18 pouvoirs** (boule de feu, nova de givre, chaîne d'éclairs, loups spectraux, bouclier sacré, etc.).
- **Combat exigeant et lisible** : endurance, esquives contextuelles avec invulnérabilité, esquive parfaite et Temps des Ombres, parade puis riposte, combos, attaques chargées, coups de pied, exécutions, assassinats furtifs, arts d'arme, verrouillage de cible, altérations d'état (brûlure, poison, gel, ralentissement, étourdissement, choc).
- **Endurance** : sprint presque gratuit en exploration (environ 45 s), environ 12 s en combat ; roulade 14 % de la barre, attaques et parades moins coûteuses ; récupération plus rapide hors combat, ralentie en garde. Barre vidée = épuisement (barre orange clignotante, plus de sprint jusqu'à 30 %).
- **Effets** : traînées d'armes lissées, images rémanentes du chevalier, ondes de choc qui déforment l'écran, étalonnage violet du Temps des Ombres, flou radial, fissures au sol, éclats d'impact par élément.
- **Personnages** : chevalier HD (joueur, chevaliers déchus, armures vivantes, chevaliers du Néant, et 3 boss) ; monstres procéduraux avec détails de surface calculés par le shader (métal martelé et rayé, tissu, cuir, os fissuré, fourrure, écailles, pierre) et spectres parcourus de volutes animées.
- **Audio** : musique dark fantasy composée par le jeu à partir d'instruments enregistrés à l'installation, avec un thème principal (valse en ré mineur), des ambiances par région et des couches exploration / combat / boss qui s'enchaînent ; bruitages spatialisés avec réverbération.
- **Sauvegardes** : 3 emplacements + sauvegarde automatique, et un code d'export pour transférer sa partie d'un appareil à l'autre.
- **Paramètres (plus de 40 options)** : préréglages graphiques (bas → ultra), échelle de rendu et résolution dynamique, ombres, bloom, anticrénelage, grain, champ de vision, sensibilité, inversion des axes, difficulté (Écuyer → Cauchemar), aide à la visée, sous-titres, modes daltoniens, volumes séparés, taille/opacité/disposition gaucher des commandes tactiles, vibrations…

## ⚡ Optimisation

- Un seul appel de dessin par personnage (squelette rigide fusionné), décors instanciés par blocs avec élimination à distance, bâtiments fusionnés par matériau, 4 lumières recyclées affectées aux sources les plus proches.
- Environ 60 à 115 appels de dessin par image selon la région (ombres et post-traitement compris), 60 à 190 k triangles avec les créatures sculptées ; les créatures identiques partagent le même maillage.
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
  core/     moteur : entrées, audio (banque de sons, musique), paramètres, stockage,
            profil de l'appareil, installation des données
  gfx/      rendu : post-traitement HDR, textures et matériaux procéduraux, particules, effets
  actors/   modèles 3D générés, chevalier GLB et reciblage des animations, squelettes, animations
  world/    terrain, ciel, décors, bâtiments, collisions
  data/     armes, tenues, compétences, pouvoirs, ennemis, boss, régions, quêtes
  game/     joueur, combat, IA des ennemis et des boss, quêtes, sauvegardes
  ui/       interface, menus, carte, commandes tactiles
assets/     modèle 3D du chevalier (GLB)
android/    enveloppe Android et script de construction de l'APK
```
