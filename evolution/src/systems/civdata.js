// Données de la civilisation : métiers, carrières, peuples rivaux, maladies.

export const JOBS = {
  sans: { name: 'Sans emploi', icon: '🙂', desc: 'Ne produit rien.' },
  bucheron: { name: 'Bûcheron', icon: '🪓', desc: '+1 bois / heure' },
  mineur: { name: 'Mineur', icon: '⛏️', desc: 'Pierre et minerais selon tes technologies' },
  fermier: { name: 'Fermier', icon: '🌾', tech: 'agriculture', desc: 'Blé (plus avec des champs), viande (enclos)' },
  chasseur: { name: 'Chasseur', icon: '🏹', desc: 'Viande, peaux, os, plumes' },
  pecheur: { name: 'Pêcheur', icon: '🎣', tech: 'peche', desc: 'Poisson' },
  soldat: { name: 'Soldat', icon: '⚔️', desc: 'Défend le village, part en guerre' },
  scientifique: { name: 'Scientifique', icon: '🔬', desc: 'Produit du savoir (technologies)' },
  marchand: { name: 'Marchand', icon: '🪙', tech: 'commerce', desc: 'Rapporte de l’argent' },
  medecin: { name: 'Médecin', icon: '⚕️', tech: 'medecine_herbes', desc: 'Soigne les malades, herbes médicinales' },
  ouvrier: { name: 'Ouvrier', icon: '🏭', tech: 'vapeur', building: 'usine', desc: 'Fabrique des composants à l’usine' },
  programmeur: { name: 'Programmeur', icon: '💻', tech: 'ordinateurs', building: 'ordinateur', desc: 'Beaucoup d’argent et de savoir' },
};

// Carrières que le joueur peut choisir (salaire par jour)
export const CAREERS = {
  chasseur: { name: 'Chasseur', icon: '🏹', desc: '+5 attaque, viande chaque jour', give: { viande: 3, peau: 1 } },
  fermier: { name: 'Fermier', icon: '🌾', desc: 'Blé et baies chaque jour', give: { ble: 6, baies: 3 }, tech: 'agriculture' },
  marchand: { name: 'Marchand', icon: '🪙', desc: 'Meilleurs prix (+20 %) et revenus', money: 30, tech: 'commerce' },
  medecin: { name: 'Médecin', icon: '⚕️', desc: 'Remèdes gratuits, popularité', give: { remede_herbes: 1 }, money: 20, tech: 'medecine_herbes' },
  scientifique: { name: 'Scientifique', icon: '🔬', desc: '+10 savoir par jour', savoir: 10 },
  soldat: { name: 'Soldat', icon: '⚔️', desc: '+10 attaque, solde', money: 15 },
  policier: { name: 'Policier', icon: '👮', desc: '+popularité, salaire', money: 25, pop: 1, tech: 'lois' },
  artiste: { name: 'Artiste', icon: '🎨', desc: 'Popularité et ventes d’œuvres', money: 20, pop: 2, tech: 'ecriture' },
  ingenieur: { name: 'Ingénieur', icon: '🛠️', desc: 'Composants gratuits', give: { moteur: 1 }, money: 40, tech: 'vapeur' },
  programmeur: { name: 'Programmeur', icon: '💻', desc: 'Gros salaire + savoir', money: 120, savoir: 8, tech: 'ordinateurs' },
  youtubeur: { name: 'Créateur de vidéos', icon: '📹', desc: 'Popularité énorme', money: 80, pop: 3, tech: 'internet' },
  astronaute: { name: 'Astronaute', icon: '👨‍🚀', desc: 'Prestige et savoir', money: 200, savoir: 20, tech: 'espace' },
};

export const FACTION_DEFS = [
  { id: 'fleuve', name: 'Clan du Fleuve', color: 0x2a6ad0, leader: 'Chef Oruna', names: ['Nali', 'Oru', 'Tesa', 'Ilo', 'Mara', 'Kiwo'], trait: 'commerçants' },
  { id: 'montagne', name: 'Peuple des Montagnes', color: 0x8a2a2a, leader: 'Roi Gurdak', names: ['Gur', 'Hakka', 'Brom', 'Dura', 'Kragg', 'Svea'], trait: 'guerriers' },
  { id: 'soleil', name: 'Empire du Soleil', color: 0xd0a020, leader: 'Impératrice Solana', names: ['Sol', 'Aria', 'Teo', 'Luz', 'Inti', 'Coya'], trait: 'savants' },
];

export const DISEASES = [
  { name: 'Grippe', level: 1 },
  { name: 'Fièvre jaune', level: 2 },
  { name: 'Peste', level: 2 },
  { name: 'Choléra', level: 2 },
  { name: 'Virus mutant', level: 3 },
];

export const TITLES = {
  '': 'Citoyen',
  chef: 'Chef de tribu',
  roi: 'Roi / Reine',
  president: 'Président(e)',
};

// Répliques des villageois selon l'humeur
export const LINES = {
  happy: [
    'Quelle belle journée ! Merci pour tout ce que tu fais.',
    'Notre village grandit, je suis fier d’en faire partie.',
    'Tu es le meilleur dirigeant que nous ayons eu !',
    'J’ai bien mangé aujourd’hui, je travaille avec plaisir.',
  ],
  neutral: [
    'Le travail ne manque pas...',
    'Il paraît que nos voisins préparent quelque chose.',
    'Tu as vu ce que les scientifiques ont inventé ?',
    'Il nous faudrait plus de maisons.',
  ],
  sad: [
    'J’ai faim... il faut plus de nourriture.',
    'Les impôts sont trop lourds !',
    'Il n’y a pas assez de place pour dormir.',
    'Je pense quitter ce village.',
  ],
  monster: ['AAAAH ! UN MONSTRE !', 'Ne me mange pas, pitié !', 'Restez loin de moi !'],
  modern: [
    'J’ai codé une appli hier soir, elle marche du tonnerre !',
    'Tu as vu les nouvelles sur Internet ?',
    'Le dernier robot de l’usine est incroyable.',
    'On devrait aller dans l’espace un jour...',
  ],
};
