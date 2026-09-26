// Données des astres, écrites pour des enfants (8-12 ans).
// Les valeurs réelles servent aux activités (poids, tailles, voyages) ;
// les valeurs "scène" (radius, dist, period) sont arrangées pour que tout
// tienne à l'écran : les distances ne sont PAS à l'échelle.

export const SUN = {
  id: 'sun',
  name: 'Le Soleil',
  short: 'Soleil',
  kind: 'Étoile',
  emoji: '☀️',
  color: '#ffc93c',
  radius: 5,
  realDiameter: 1392700,
  gravity: 27.9,
  facts: {
    'Taille': '109 fois la Terre',
    'Température': '5 500 °C en surface',
    'Âge': '4,6 milliards d\'années',
    'Lumière jusqu\'à la Terre': '8 minutes',
  },
  story: 'Le Soleil est une étoile : une énorme boule de gaz brûlant qui nous donne lumière et chaleur. Toutes les planètes tournent autour de lui, comme des manèges autour d\'un centre.',
  wow: 'On pourrait mettre 1 million de Terres à l\'intérieur du Soleil !',
};

export const PLANETS = [
  {
    id: 'mercury', name: 'Mercure', kind: 'Planète rocheuse', emoji: '🪨', color: '#b5a397',
    radius: 0.55, dist: 10, period: 0.241, spin: 0.35, tilt: 0.03,
    realDiameter: 4879, realDist: 58, gravity: 0.38, travel: '6 ans et demi (sonde MESSENGER)',
    facts: { 'Distance au Soleil': '58 millions de km', 'Une année': '88 jours', 'Un jour': '176 jours terrestres', 'Température': 'de −180 °C à 430 °C', 'Lunes': 'aucune' },
    story: 'Mercure est la plus petite planète et la plus proche du Soleil. Elle fait le tour du Soleil très vite, mais tourne sur elle-même très lentement.',
    wow: 'Le jour, il fait assez chaud pour faire fondre du plomb, et la nuit il fait plus froid qu\'au pôle Nord !',
  },
  {
    id: 'venus', name: 'Vénus', kind: 'Planète rocheuse', emoji: '🌋', color: '#e8b56a',
    radius: 0.95, dist: 14, period: 0.615, spin: -0.12, tilt: 3.09,
    realDiameter: 12104, realDist: 108, gravity: 0.91, travel: '5 mois environ',
    facts: { 'Distance au Soleil': '108 millions de km', 'Une année': '225 jours', 'Un jour': '243 jours terrestres', 'Température': '465 °C', 'Lunes': 'aucune' },
    story: 'Vénus est presque aussi grande que la Terre, mais elle est cachée sous d\'épais nuages toxiques qui gardent la chaleur comme une couverture.',
    wow: 'C\'est la planète la plus chaude, et elle tourne à l\'envers : là-bas, le Soleil se lève à l\'ouest !',
  },
  {
    id: 'earth', name: 'La Terre', short: 'Terre', kind: 'Planète rocheuse', emoji: '🌍', color: '#4aa3ff',
    radius: 1, dist: 19, period: 1, spin: 1, tilt: 0.41,
    realDiameter: 12742, realDist: 150, gravity: 1, travel: 'tu es déjà dessus !',
    facts: { 'Distance au Soleil': '150 millions de km', 'Une année': '365 jours', 'Un jour': '24 heures', 'Température': '15 °C en moyenne', 'Lunes': '1 : la Lune' },
    story: 'La Terre est notre maison ! C\'est la seule planète connue avec de l\'eau liquide, de l\'air à respirer… et de la vie.',
    wow: 'La Terre fonce autour du Soleil à 107 000 km/h, et pourtant on ne sent rien !',
  },
  {
    id: 'mars', name: 'Mars', kind: 'Planète rocheuse', emoji: '🔴', color: '#e0643c',
    radius: 0.72, dist: 24, period: 1.881, spin: 0.97, tilt: 0.44,
    realDiameter: 6779, realDist: 228, gravity: 0.38, travel: '7 mois',
    facts: { 'Distance au Soleil': '228 millions de km', 'Une année': '687 jours', 'Un jour': '24 h 37 min', 'Température': '−63 °C en moyenne', 'Lunes': '2 : Phobos et Déimos' },
    story: 'Mars est la planète rouge : son sol est couvert de poussière de rouille. Des robots comme Perseverance s\'y promènent pour chercher des traces de vie ancienne.',
    wow: 'Sur Mars se trouve le plus grand volcan du système solaire : le mont Olympe, 3 fois plus haut que l\'Everest !',
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'Géante gazeuse', emoji: '🌪️', color: '#d8a878',
    radius: 3, dist: 38, period: 11.86, spin: 2.4, tilt: 0.05,
    realDiameter: 139820, realDist: 778, gravity: 2.4, travel: '5 ans (sonde Juno)',
    facts: { 'Distance au Soleil': '778 millions de km', 'Une année': '12 ans', 'Un jour': '10 heures', 'Température': '−110 °C', 'Lunes': '95 !' },
    story: 'Jupiter est la plus grosse planète : elle est faite de gaz, on ne pourrait pas marcher dessus. Elle a une énorme tempête rouge, la Grande Tache Rouge.',
    wow: 'La Grande Tache Rouge est une tempête plus grande que la Terre, qui souffle depuis plus de 300 ans !',
  },
  {
    id: 'saturn', name: 'Saturne', kind: 'Géante gazeuse', emoji: '💍', color: '#ecd29a',
    radius: 2.5, dist: 50, period: 29.46, spin: 2.2, tilt: 0.47,
    realDiameter: 116460, realDist: 1430, gravity: 1.06, travel: '7 ans (sonde Cassini)',
    facts: { 'Distance au Soleil': '1,4 milliard de km', 'Une année': '29 ans et demi', 'Un jour': '10 h 30', 'Température': '−140 °C', 'Lunes': '146 !' },
    story: 'Saturne est célèbre pour ses magnifiques anneaux. Ils sont faits de milliards de morceaux de glace et de roche, certains petits comme du sable, d\'autres gros comme des maisons.',
    wow: 'Saturne est si légère que, dans une baignoire géante, elle flotterait !',
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'Géante de glace', emoji: '🧊', color: '#9fe3ea',
    radius: 1.7, dist: 61, period: 84.0, spin: -1.4, tilt: 1.71,
    realDiameter: 50724, realDist: 2870, gravity: 0.9, travel: '9 ans (sonde Voyager 2)',
    facts: { 'Distance au Soleil': '2,9 milliards de km', 'Une année': '84 ans', 'Un jour': '17 heures', 'Température': '−195 °C', 'Lunes': '28' },
    story: 'Uranus est une géante de glace bleu-vert. Elle a sans doute été percutée il y a très longtemps, et depuis elle tourne couchée sur le côté !',
    wow: 'Comme elle roule sur le côté, chaque pôle d\'Uranus vit 42 ans de jour, puis 42 ans de nuit !',
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'Géante de glace', emoji: '🌊', color: '#4f6ff0',
    radius: 1.65, dist: 71, period: 164.8, spin: 1.5, tilt: 0.49,
    realDiameter: 49244, realDist: 4500, gravity: 1.14, travel: '12 ans (sonde Voyager 2)',
    facts: { 'Distance au Soleil': '4,5 milliards de km', 'Une année': '165 ans', 'Un jour': '16 heures', 'Température': '−200 °C', 'Lunes': '16' },
    story: 'Neptune est la planète la plus lointaine, toute bleue, froide et sombre. Des vents terribles y soufflent en permanence.',
    wow: 'Les vents de Neptune vont à 2 000 km/h : c\'est plus rapide qu\'un avion de chasse !',
  },
  {
    id: 'pluto', name: 'Pluton', kind: 'Planète naine', emoji: '🤍', color: '#d9c2a6',
    radius: 0.32, dist: 80, period: 248, spin: -0.2, tilt: 2.1,
    realDiameter: 2377, realDist: 5900, gravity: 0.06, travel: '9 ans et demi (sonde New Horizons)',
    facts: { 'Distance au Soleil': '5,9 milliards de km', 'Une année': '248 ans', 'Un jour': '6 jours et demi', 'Température': '−230 °C', 'Lunes': '5 (dont Charon)' },
    story: 'Pluton était considérée comme la 9e planète, mais depuis 2006 on l\'appelle "planète naine" car elle est trop petite. Elle a un grand cœur blanc dessiné sur son sol !',
    wow: 'Depuis qu\'on l\'a découverte en 1930, Pluton n\'a pas encore fini un seul tour du Soleil !',
  },
];

export const MOON = {
  id: 'moon', name: 'La Lune', short: 'Lune', kind: 'Satellite naturel', emoji: '🌙', color: '#cfcfcf',
  radius: 0.27, realDiameter: 3474, gravity: 0.17,
  facts: { 'Distance à la Terre': '384 400 km', 'Tour de la Terre': '27 jours', 'Température': 'de −170 °C à 120 °C', 'Visiteurs': '12 astronautes' },
  story: 'La Lune tourne autour de la Terre. Elle ne fait pas de lumière : elle renvoie celle du Soleil, c\'est pour ça qu\'on la voit changer de forme (les phases).',
  wow: 'Les traces de pas des astronautes sont toujours là : sur la Lune, il n\'y a pas de vent pour les effacer !',
};

// Vaisseaux et engins spatiaux (modèles 3D de la NASA, domaine public).
export const CRAFTS = [
  {
    id: 'hubble', name: 'Télescope Hubble', model: 'hubble.glb', size: 0.55, host: 'earth', orbit: 1.9, speed: 1.6, emoji: '🔭',
    story: 'Hubble est un télescope qui tourne autour de la Terre depuis 1990. Au-dessus de l\'air, il voit l\'univers sans flou et a pris des milliers de photos magnifiques.',
    wow: 'Il fait le tour de la Terre en seulement 95 minutes !',
  },
  {
    id: 'astronaut', name: 'Astronaute', model: 'astronaut.glb', size: 0.35, host: 'earth', orbit: 1.55, speed: -0.9, emoji: '👩‍🚀',
    story: 'Les astronautes portent une combinaison spatiale : c\'est un mini vaisseau qui leur donne de l\'air, les protège du froid, de la chaleur et des rayons du Soleil.',
    wow: 'Dans l\'espace, on grandit de quelques centimètres car la colonne vertébrale n\'est plus tassée !',
  },
  {
    id: 'lem', name: 'Module lunaire Apollo', model: 'lem.glb', size: 0.3, host: 'moon', orbit: 0.55, speed: 1.2, emoji: '🌙',
    story: 'Le module lunaire a posé les premiers humains sur la Lune en 1969 : Neil Armstrong et Buzz Aldrin, pendant la mission Apollo 11.',
    wow: '« C\'est un petit pas pour l\'homme, mais un bond de géant pour l\'humanité. » — Neil Armstrong',
  },
  {
    id: 'perseverance', name: 'Robot Perseverance', model: 'perseverance.glb', size: 0.4, host: 'mars', orbit: 1.25, speed: 0.5, emoji: '🤖',
    story: 'Perseverance est un robot grand comme une voiture qui roule sur Mars depuis 2021. Il analyse les roches pour savoir si la vie a existé sur Mars.',
    wow: 'Il a emmené avec lui un petit hélicoptère, Ingenuity : le premier engin à voler sur une autre planète !',
  },
  {
    id: 'parker', name: 'Sonde Parker', model: 'parker.glb', size: 0.7, host: 'sun', orbit: 7.2, speed: 1.4, emoji: '🛡️',
    story: 'La sonde Parker s\'approche plus près du Soleil que n\'importe quel engin. Son grand bouclier la protège d\'une chaleur de plus de 1 000 °C.',
    wow: 'C\'est l\'objet le plus rapide jamais construit par l\'humain : 690 000 km/h !',
  },
  {
    id: 'cassini', name: 'Sonde Cassini', model: 'cassini.glb', size: 0.7, host: 'saturn', orbit: 5.4, speed: 0.7, emoji: '🛰️',
    story: 'Cassini a tourné autour de Saturne pendant 13 ans et a découvert des geysers de glace sur la lune Encelade.',
    wow: 'À la fin de sa mission, en 2017, elle a plongé dans Saturne pour ne pas contaminer ses lunes.',
  },
  {
    id: 'voyager', name: 'Sonde Voyager', model: 'voyager.glb', size: 0.9, host: 'deep', emoji: '📀',
    story: 'Les sondes Voyager, lancées en 1977, ont visité Jupiter, Saturne, Uranus et Neptune. Aujourd\'hui, elles ont quitté le système solaire !',
    wow: 'Elles transportent un disque doré avec des sons et des images de la Terre, pour d\'éventuels extraterrestres.',
  },
];

// Questions du quiz : on répond en cliquant sur le bon astre.
export const QUIZ = [
  { q: 'Clique sur la planète la plus proche du Soleil.', a: 'mercury' },
  { q: 'Clique sur la planète où nous vivons.', a: 'earth' },
  { q: 'Clique sur la planète rouge.', a: 'mars' },
  { q: 'Clique sur la plus grosse planète.', a: 'jupiter' },
  { q: 'Quelle planète a les plus beaux anneaux ?', a: 'saturn' },
  { q: 'Quelle planète est la plus chaude, sous ses nuages toxiques ?', a: 'venus' },
  { q: 'Clique sur la planète la plus éloignée du Soleil.', a: 'neptune' },
  { q: 'Quelle planète roule couchée sur le côté ?', a: 'uranus' },
  { q: 'Clique sur l\'étoile de notre système solaire.', a: 'sun' },
  { q: 'Clique sur la planète naine, tout au bout.', a: 'pluto' },
  { q: 'Qui tourne autour de la Terre ?', a: 'moon' },
  { q: 'Sur quelle planète roule le robot Perseverance ?', a: 'mars' },
  { q: 'Quelle planète a une tempête géante, la Grande Tache Rouge ?', a: 'jupiter' },
  { q: 'Quelle planète fait le tour du Soleil en 365 jours ?', a: 'earth' },
];
