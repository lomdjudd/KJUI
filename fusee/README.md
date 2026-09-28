# 🚀 Forge Stellaire

Un jeu de **construction et de pilotage de fusées** dans un système solaire complet, jouable directement dans le navigateur, **en 2D et en 3D**. Même esprit que *Spaceflight Simulator*, en beaucoup plus poussé : 127 pièces modélisées, aérodynamique et échauffement par pièce, orbites képlériennes, atterrissages sur 19 mondes différents, technologies spéciales qui ouvrent l'accès aux planètes hostiles, carrière, défis et pilote automatique.

## ▶️ Jouer

**Le plus simple :** ouvre [`dist/index.html`](dist/index.html) dans un navigateur récent (Chrome, Edge, Firefox, Safari). C'est un fichier unique qui contient tout le jeu, textures comprises : il fonctionne hors ligne.

**En développement :**

```bash
cd fusee
npm install
npm run dev      # serveur de dev avec rechargement à chaud
npm run build    # régénère dist/index.html (fichier unique)
```

`?screen=builder` ouvre directement l'atelier en bac à sable.

## 🎮 Modes de jeu

- **Carrière** : budget, points de science, 32 missions de l'agence, arbre technologique de 28 nœuds, récupération des capsules (remboursement de 90 %).
- **Bac à sable** : toutes les pièces, budget illimité.
- **Défis** (médailles or, argent, bronze) : retour du lanceur sur LZ-1, alunissage de précision, retour de la Lune à 3,1 km/s, sommet d'Olympus Mons, descente vers Vénus, plongée sur Titan.

## 🔧 L'atelier

- **127 pièces** en 11 catégories : capsules (Alpha, Orion-X, Dragonne), sondes, module lunaire, réservoirs kérolox / hydrolox / méthalox, 16 moteurs à ergols liquides (du petit Colibri à la grappe Super-Phénix, plus un aérospike, un moteur nucléaire thermique, un ionique et un moteur à fusion), propulseurs à poudre, découpleurs, coiffes, ailerons et grilles, RCS, batteries, panneaux solaires, RTG, jambes, parachutes, boucliers, instruments scientifiques, antennes…
- **Modèles 3D détaillés** et matériaux PBR : inox brossé, mousse isolante orange, tuiles hexagonales, carbone, feuille d'or, cuivre des tuyères régénératives, logos et drapeaux.
- Glisser-déposer avec aimantation aux nœuds et sur les surfaces, **symétrie ×1 à ×8**, retournement, **11 peintures**, **taux de remplissage** des réservoirs, annuler / rétablir.
- **Étagement automatique** modifiable, Δv et poussée/poids par étage selon l'astre choisi, alertes (poussée insuffisante, jambes trop courtes, pas de parachute…).
- Vue **hangar 3D** ou **plan 2D**, bibliothèque de fusées, 7 modèles prêts à voler.

## 🛰️ Le vol

- **Physique réelle en 2D** (plan de l'écliptique) : poussée et Isp selon la pression, traînée et portance par pièce, nombre de Mach, **échauffement de rentrée** (Sutton-Graves) et boucliers ablatifs, parachutes à ouverture progressive, contacts au sol amortis, crashs et débris.
- **Vue 3D ou 2D** au choix (touche V), caméras orbitale, poursuite, libre, verrouillée et **caméra au sol** au décollage.
- **Carte** avec coniques raccordées : apoapside, périapside, impacts, rencontres, **nœuds de manœuvre** et **planificateur de transfert** automatique.
- **SAS** (stabilisation, prograde, rétrograde, radial, cible, nœud) et **pilote automatique** (mise en orbite, exécution de manœuvre, atterrissage propulsif avec guidage de précision vers une balise).
- **Accélération du temps** jusqu'à ×10 000 000 sur rails, ×50 sous parachute.
- Science : 7 expériences, multiplicateurs selon l'astre et la situation, transmission par antenne.

## 🌍 Le système solaire

24 astres à l'échelle réduite (distances réelles entre planètes) : le Soleil, Mercure, Vénus, la Terre et la Lune, Mars et ses lunes, Cérès, Jupiter et les satellites galiléens, Saturne (anneaux), Encelade, Titan, Uranus, Titania, Neptune, Triton, Pluton, Charon… et **Nyx**, une planète cachée.

Certains mondes exigent une **technologie spéciale** : coque pressurisée pour Vénus, bouclier solaire pour Mercure, blindage anti-radiations autour de Jupiter, isolation cryogénique pour Titan et le système extérieur, télescope spatial profond pour découvrir Nyx.

Rendu : diffusion atmosphérique Rayleigh/Mie calculée par rayon, nuages et lumières des villes sur la Terre, planètes générées procéduralement (cratères, volcans, glace, bandes des géantes), terrain local détaillé avec rochers, complexe de lancement (tour ombilicale à bras rétractables, forêt, routes, zone LZ-1), flammes et fumées, plasma de rentrée, Voie lactée, bloom HDR.

## ⌨️ Commandes

| Action | Clavier | Manette |
|---|---|---|
| Tourner | Q / D ou ← / → | stick gauche |
| Gaz + / − | Maj / Ctrl | gâchettes |
| Plein gaz / couper | Z / X | |
| Étage suivant | Espace | A |
| Stabilisation (SAS) | T | B |
| RCS (translation I/J/K/L) | R | |
| Train, phares, aérofreins, panneaux | G, Y, B, U | |
| Science | K | |
| Pilote automatique | O | |
| Carte | M | X |
| Vue 2D / 3D | V | Y |
| Caméra | C | |
| Accélération du temps | , et . | bumpers |
| Pause | Échap | Start |

Sur téléphone et tablette : boutons de rotation, manette des gaz tactile et gros bouton « Étage » ; l'interface se compacte automatiquement (portrait ou paysage).

## 📁 Structure

```
fusee/
├── src/core/       orbites, astres, terrain procédural, audio synthétisé, entrées
├── src/parts/      catalogue des pièces, textures et modèles 3D générés
├── src/craft/      assemblage, étagement, statistiques
├── src/builder/    atelier (hangar, plan, palette, modèles)
├── src/flight/     vaisseau, simulation, guidage, interface, carte
├── src/render/     rendu (planètes, atmosphère, ciel, terrain, pas de tir, effets)
├── src/progress/   carrière, technologies, missions, défis, sauvegardes
└── src/ui/         écrans et fenêtres
```

## Crédits

Moteur 3D : [three.js](https://threejs.org). Textures de la Terre et de la Lune : cartes de la NASA (Blue Marble, LRO) distribuées avec les exemples de three.js. Tout le reste (planètes, pièces, sons et musique) est généré par le code.
