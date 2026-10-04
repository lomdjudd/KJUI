# 🧬 Évolution : de la cellule aux étoiles

Un jeu en 3D et en monde ouvert, jouable dans le navigateur. Tu commences en **simple cellule** et tu évolues jusqu'à l'**être humain**, puis tu fais avancer l'Histoire de la Préhistoire jusqu'à l'**an 2000** et au-delà : code sur ordinateur, robots, génétique, conquête spatiale.

Tous les graphismes (modèles 3D, terrain, ciel, eau) et tous les sons sont générés par le code.

## ▶️ Jouer

**Le plus simple :** ouvre [`dist/index.html`](dist/index.html) dans Chrome, Edge, Firefox ou Safari. C'est un fichier unique qui marche même hors ligne.

**En développement** (depuis la racine du dépôt) :

```bash
npm install
npm run dev:evolution     # serveur de développement
npm run build:evolution   # régénère evolution/dist/index.html
```

Options d'URL : `?q=low|medium|high` force la qualité graphique, `?god` rend invincible.

## 🦠 Les étapes de l'évolution

| Étape | Monde | Ce qu'on y fait |
|---|---|---|
| 🦠 Cellule | Soupe primitive microscopique en 3D | Manger les nutriments et les bactéries plus petites, fuir les amibes et les virus |
| 🧫 Organisme multicellulaire | Microscopique | Tentacules, carapace, mâchoire, œil |
| 🐟 Poisson | Océan autour de l'île | Chasser crevettes et poissons, fuir requins et Dunkleosteus |
| 🐸 Amphibien | Sortie de l'eau | Boire, manger des insectes, ne pas se dessécher |
| 🦎 Reptile | Âge des dinosaures | Raptors, diplodocus, tyrannosaure |
| 🐺 Mammifère | Après la météorite | Lapins, cerfs, sangliers, loups, ours |
| 🐒 Primate | Forêts | Ramasser bâtons et pierres, vivre avec les singes |
| 🧔 Hominidé | Âge de pierre | Premiers outils, feu, premières technologies |
| 🧑 Homo sapiens | Toute l'Histoire | Village, technologies, civilisation, an 2000, espace |

Chaque étape a ses **mutations** à acheter avec l'ADN (vitesse, attaque, armure, régénération…), dont certaines sont obligatoires pour évoluer. Une partie des bonus passe aux descendants, et une mutation aléatoire peut apparaître à chaque évolution.

## 🧑 La civilisation

- **Survie** : santé, faim, soif, endurance, poison, maladies.
- **Récolte** : arbres, rochers, minerais (cuivre, étain, charbon, fer, or, soufre, silicium, uranium), pétrole, argile, sable, plantes, champignons, gibier (viande, peaux, os, plumes, échantillons d'ADN), pêche.
- **Fabrication** : plus de 100 objets (outils, armes du bâton au pistolet laser, armures, potions, remèdes, vaccins, virus, bombes, robots) avec des ateliers : feu de camp, établi, four, forge, laboratoire, usine.
- **Atelier d'invention** : combine **n'importe quels objets**, donne un nom, une icône et une utilité (arme, outil, nourriture, potion, explosif, machine qui produit des ressources, composant, armure). La puissance dépend des ingrédients.
- **Construction** : 30 bâtiments, de la hutte à l'immeuble, en passant par le palais, l'hôpital, la centrale nucléaire, les éoliennes et la base de lancement. L'électricité est gérée.
- **42 technologies** réparties en 10 époques : Préhistoire, Néolithique, bronze, Antiquité, Moyen Âge, Renaissance, révolution industrielle, époque moderne, ère numérique (an 2000) et futur.
- **Village** : habitants avec métiers (bûcheron, mineur, fermier, chasseur, pêcheur, soldat, scientifique, marchand, médecin, ouvrier, programmeur), nourriture, logements, bonheur, naissances, épidémies.
- **Pouvoir** : chef de tribu, roi (avec un palais), puis **président** élu (discours, fêtes, distribution d'argent, popularité, impôts).
- **Carrières** : chasseur, fermier, marchand, médecin, scientifique, soldat, policier, artiste, ingénieur, programmeur, créateur de vidéos, astronaute… ou monstre.
- **Peuples rivaux** : 3 civilisations avec leurs villages qui évoluent avec les époques. Commerce, cadeaux, alliances, guerres (raids sur ton village, conquête), attaque biologique avec un virus.
- **Économie** : marché aux prix fluctuants, ta propre boutique avec tes prix, **boutique en ligne** avec Internet.

## 💻 L'ordinateur (dès l'an 2000)

Construis un ordinateur (il faut de l'électricité) et **programme en vrai JavaScript**. Le code s'exécute dans un espace isolé (Web Worker) et pilote le jeu :

```js
const prix = await jeu.prix("bois");
if (prix > 2) afficher("Gain :", await jeu.vendre("bois", 10));
await jeu.fabriquer("planche", 5);
await jeu.mettreEnVente("pain", 20, 9, true);   // boutique en ligne
await jeu.inventer("Super hache", "outil", { acier: 2, bois: 1 });
for (const r of await robots.liste()) await robots.ordre(r.numero, "recolter");
```

D'autres applications sont fournies : boutique en ligne, bourse, gestion des robots, actualités.

## 🧬 Génétique et monstres

Avec le **Génie génétique**, fusionne jusqu'à 3 échantillons d'ADN au laboratoire pour devenir un **monstre hybride** : ailes (vol), mâchoires de requin, force de l'ours, griffes, tentacules, venin, gigantisme, régénération… Le monstre a un souffle de feu (touche F). Un sérum d'humanité permet de redevenir humain.

## ⌨️ Commandes

| Action | Clavier / souris |
|---|---|
| Se déplacer | ZQSD (AZERTY) ou WASD |
| Caméra | Souris (clique dans le jeu pour la capturer) |
| Sauter / monter · descendre | Espace · C ou Ctrl |
| Sprint | Maj |
| Attaquer, récolter, tirer, lancer | Clic gauche |
| Interagir (manger, boire, ramasser, parler, utiliser un bâtiment) | E |
| Manger / utiliser l'objet, souffle du monstre | F ou clic droit |
| Barre rapide | 1 à 9, molette |
| Inventaire / fabrication / invention | I ou Tab |
| Construire · Technologies · Génétique · Civilisation · Carte | B · T · G · V · M |
| Pause, options, sauvegarde | Échap ou P |

Sur téléphone et tablette, les commandes tactiles apparaissent automatiquement : joystick, caméra au doigt, boutons d'action et menus.

Le menu permet aussi de **commencer à une autre époque** : poisson, reptile, singe, hominidé, humain préhistorique, Moyen Âge ou an 2000.
