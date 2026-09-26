# 🪐 Mon Système Solaire

Une animation 3D interactive pour expliquer aux enfants (8-12 ans) comment fonctionne le système solaire. Tout commence sur un **plan 2D** vu d'en haut, comme une carte, puis on s'envole en **3D** d'un seul bouton.

Les textures des planètes et les modèles 3D des engins spatiaux sont les **fichiers officiels de la NASA** (domaine public).

## ▶️ Lancer

```bash
npm install              # à la racine du dépôt
npm run dev:solaire      # serveur de développement
npm run build:solaire    # génère systeme-solaire/dist/
npm run preview:solaire  # sert le build
```

Le dossier `systeme-solaire/dist/` peut être mis en ligne tel quel sur n'importe quel hébergement statique (GitHub Pages, Netlify…). Il faut passer par un serveur web : ouvrir `index.html` en double-clic ne permet pas au navigateur de charger les textures et modèles 3D.

## 🎮 Ce qu'on peut faire

| Outil | Ce qu'on apprend |
|---|---|
| ✨ **Plan 2D → 3D** | Le plan « carte » se transforme : la caméra plonge dans l'espace, les dessins plats deviennent de vraies planètes qui s'inclinent sur leur axe. On peut revenir au plan à tout moment. |
| 🔍 **Explorer** | Toucher un astre : la caméra vole jusqu'à lui, une fiche s'ouvre (histoire, chiffres clés, comparaison de taille avec la Terre, « Le sais-tu ? »), lecture à voix haute. |
| ⏱️ **Vitesse du temps** | Pause, ralenti, x1 → x100 : on voit que Mercure file et que Neptune avance à peine. Compteur d'années terrestres. |
| ⚖️ **Mon poids** | Curseur de poids : étiquettes au-dessus de chaque astre avec le poids qu'on y aurait, et explication de la gravité. |
| 📏 **Tailles** | Les planètes se rangent côte à côte à la bonne échelle, devant le bord géant du Soleil. |
| 🚀 **Fusée** | Décollage d'une fusée Saturn V depuis la Terre vers la destination choisie, caméra de poursuite, traînée de flammes, durée réelle du voyage. |
| 🌗 **Jour & nuit** | La Terre de près avec son côté nuit (lumières des villes), l'épingle « France » qui indique s'il y fait jour ou nuit, l'axe incliné et les saisons, les phases de la Lune dessinées en direct. |
| 🛰️ **Vaisseaux** | Hubble, un astronaute, le module lunaire Apollo posé sur la Lune, Perseverance posé sur Mars, les sondes Parker, Cassini et Voyager. |
| ❓ **Quiz** | Les noms disparaissent, on répond en touchant le bon astre. Indices, étoiles, confettis. |

Plus : **Cosmo**, le petit robot guide qui explique chaque étape, narrateur vocal (synthèse vocale du navigateur), bruitages et musique d'ambiance synthétisés, noms et orbites activables, commandes tactiles sur téléphone et tablette.

Raccourcis clavier : `2` / `3` pour passer du plan à la 3D, `Espace` pour mettre en pause, `Échap` pour revenir à l'exploration.

## 🧱 Organisation

```
systeme-solaire/
├── index.html          interface (barres, panneaux, fiche, mascotte)
├── public/
│   ├── textures/       cartes des planètes et lunes (NASA), ciel étoilé (Hipparcos)
│   └── models/         modèles glTF des engins (NASA), optimisés
└── src/
    ├── main.js         rendu, caméra, passage 2D ↔ 3D, clics
    ├── world.js        Soleil, planètes, lunes, astéroïdes, étoiles, version 2D
    ├── shaders.js      Soleil animé, Terre jour/nuit, atmosphères
    ├── textures.js     textures dessinées par le code (Uranus, anneaux, dessins 2D)
    ├── crafts.js       chargement et placement des engins NASA
    ├── activities.js   les activités (poids, tailles, fusée, jour & nuit, quiz…)
    ├── ui.js           mascotte, voix, sons, confettis, fiches
    └── data.js         textes pour les enfants et données des astres
```

## 📜 Crédits

- Cartes de Vénus, Mars, Jupiter, Saturne, Neptune, Pluton, des lunes et du ciel (Hipparcos) : [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources), domaine public.
- Modèles 3D Hubble, astronaute, module lunaire Apollo, Perseverance, Parker, Cassini, Voyager, Saturn V : [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources), domaine public. Ils ont été convertis (décompression Draco, quantification, textures WebP) pour se charger vite.
- Textures de la Terre (jour, nuit, nuages, reflets) et de la Lune : exemples de [three.js](https://github.com/mrdoob/three.js) (licence MIT), d'après des images de la NASA.
- Soleil, Uranus, anneaux, dessins du plan 2D : générés par le code.

⚠️ Pour que tout tienne à l'écran, les distances et les tailles ne sont pas à l'échelle, sauf dans l'activité « Tailles ».
