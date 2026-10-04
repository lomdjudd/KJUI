// Arbre des technologies : chaque découverte fait avancer l'Histoire.

export const ERAS = [
  { id: 'prehistoire', name: 'Préhistoire', from: -Infinity },
  { id: 'neolithique', name: 'Néolithique', from: -10000 },
  { id: 'bronze', name: 'Âge du bronze', from: -3300 },
  { id: 'antiquite', name: 'Antiquité', from: -1200 },
  { id: 'moyen_age', name: 'Moyen Âge', from: 500 },
  { id: 'renaissance', name: 'Renaissance', from: 1300 },
  { id: 'industrie', name: 'Révolution industrielle', from: 1760 },
  { id: 'moderne', name: 'Époque moderne', from: 1940 },
  { id: 'numerique', name: 'Ère numérique', from: 2000 },
  { id: 'futur', name: 'Futur', from: 2030 },
];

const T = (id, name, icon, year, cost, req, desc) => ({ id, name, icon, year, cost, req, desc });

export const TECHS = [
  T('outils_pierre', 'Outils de pierre', '🪓', -2.4e6, 5, [], 'Haches, pioches et couteaux en pierre.'),
  T('feu', 'Maîtrise du feu', '🔥', -1e6, 10, [], 'Feu de camp, cuisson, torches.'),
  T('chasse', 'Chasse organisée', '🔱', -500000, 15, ['outils_pierre'], 'Lances pour chasser le gros gibier.'),
  T('vetements', 'Vêtements', '🥼', -170000, 20, ['chasse'], 'Cuir et vêtements en peau.'),
  T('tribu', 'Vie en tribu', '🛖', -100000, 25, ['feu'], 'Fonder un village, huttes, recruter des membres.'),
  T('arc', 'Arc et flèches', '🏹', -60000, 30, ['chasse'], 'Chasser de loin.'),
  T('peche', 'Pêche', '🎣', -40000, 20, ['outils_pierre'], 'Canne à pêche, métier de pêcheur.'),
  T('agriculture', 'Agriculture', '🌾', -10000, 40, ['tribu'], 'Champs de blé, pain, fermiers.'),
  T('elevage', 'Élevage', '🐄', -9000, 40, ['agriculture'], 'Enclos à animaux.'),
  T('poterie', 'Poterie', '🏺', -8000, 35, ['feu'], 'Four, poteries, briques, verre.'),
  T('medecine_herbes', 'Plantes médicinales', '🌿', -6000, 35, ['tribu'], 'Tisanes qui soignent.'),
  T('habitat', 'Maisons', '🏠', -7000, 45, ['poterie', 'tribu'], 'Maisons en bois, puits, murs.'),
  T('roue', 'La roue', '☸️', -3500, 50, ['habitat'], 'Transports : la production augmente.'),
  T('bronze', 'Métallurgie du bronze', '🥉', -3300, 60, ['poterie'], 'Forge, outils et armes en bronze.'),
  T('ecriture', 'Écriture', '📜', -3200, 60, ['habitat'], 'Papier, livres : les scientifiques progressent plus vite.'),
  T('commerce', 'Monnaie et commerce', '🪙', -2500, 70, ['ecriture'], 'L’argent, les marchands, les boutiques.'),
  T('lois', 'Lois et royauté', '👑', -1750, 80, ['ecriture'], 'Deviens roi, lève des impôts, palais.'),
  T('fer', 'Âge du fer', '⚔️', -1200, 90, ['bronze'], 'Outils, armes et armures en fer, caserne.'),
  T('architecture', 'Architecture', '🏛️', -600, 90, ['roue', 'fer'], 'Maisons en pierre, tours de garde, statues.'),
  T('medecine', 'Médecine', '⚕️', -400, 100, ['medecine_herbes', 'ecriture'], 'Hôpital, médecins.'),
  T('sciences', 'Sciences', '🔭', -300, 100, ['ecriture'], 'Savoir +50 %.'),
  T('acier', 'Acier', '🔗', 1000, 140, ['fer'], 'Acier, arbalètes, armures d’acier.'),
  T('alchimie', 'Alchimie', '⚗️', 1100, 130, ['medecine'], 'Laboratoire et potions magiques.'),
  T('poudre', 'Poudre à canon', '💥', 1300, 170, ['alchimie'], 'Bombes et mousquets.'),
  T('imprimerie', 'Imprimerie', '📘', 1450, 160, ['ecriture'], 'Le savoir se répand : savoir +30 %.'),
  T('vapeur', 'Machine à vapeur', '🚂', 1769, 230, ['acier', 'imprimerie'], 'Usines, moteurs, mines.'),
  T('democratie', 'Démocratie', '🗳️', 1789, 200, ['lois', 'imprimerie'], 'Élections : deviens président !'),
  T('chimie', 'Chimie', '🧪', 1800, 220, ['poudre', 'alchimie'], 'Dynamite et chimie moderne.'),
  T('petrole', 'Pétrole', '🛢️', 1859, 220, ['vapeur'], 'Puits de pétrole, plastique, tronçonneuses.'),
  T('electricite', 'Électricité', '⚡', 1880, 260, ['vapeur'], 'Centrales, éoliennes, batteries, maisons modernes.'),
  T('armes_modernes', 'Armes modernes', '🔫', 1914, 280, ['chimie', 'acier'], 'Fusils, grenades, gilets pare-balles.'),
  T('antibiotiques', 'Antibiotiques', '💊', 1928, 250, ['chimie', 'medecine'], 'Antibiotiques et vaccins.'),
  T('nucleaire', 'Nucléaire', '☢️', 1945, 400, ['electricite', 'chimie'], 'Centrale nucléaire... et la bombe.'),
  T('electronique', 'Électronique', '📟', 1950, 320, ['electricite', 'petrole'], 'Circuits, écrans, immeubles.'),
  T('ordinateurs', 'Ordinateurs', '💻', 2000, 380, ['electronique'], 'Construis des ordinateurs et PROGRAMME !'),
  T('internet', 'Internet', '🌐', 2001, 400, ['ordinateurs'], 'Boutique en ligne : vends au monde entier.'),
  T('robotique', 'Robotique', '🤖', 2005, 450, ['ordinateurs'], 'Robots ouvriers et drones.'),
  T('genetique', 'Génie génétique', '🧬', 2010, 450, ['antibiotiques', 'ordinateurs'], 'Fusion d’ADN, monstres, virus, sérums.'),
  T('solaire', 'Énergie solaire', '☀️', 2010, 350, ['electronique'], 'Panneaux solaires.'),
  T('ia', 'Intelligence artificielle', '🧠', 2030, 600, ['robotique', 'internet'], 'Robots de combat, exosquelettes, savoir x2.'),
  T('laser', 'Lasers', '🔴', 2040, 650, ['nucleaire', 'electronique'], 'Pistolets laser.'),
  T('espace', 'Conquête spatiale', '🚀', 2060, 800, ['ia', 'laser'], 'Base de lancement : pars à la conquête des étoiles !'),
];

export const TECH = {};
for (const t of TECHS) TECH[t.id] = t;

export function eraOf(year) {
  let e = ERAS[0];
  for (const er of ERAS) if (year >= er.from) e = er;
  return e;
}

export function eraIndex(year) {
  let idx = 0;
  ERAS.forEach((er, i) => {
    if (year >= er.from) idx = i;
  });
  return idx;
}
