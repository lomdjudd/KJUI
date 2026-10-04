// Toutes les espèces du monde. stages : [min, max] = étapes du joueur
// pendant lesquelles l'espèce apparaît (0 = cellule ... 8 = humain).
// behavior : prey (fuit), neutral (se défend), predator (chasse), hazard (blesse au contact)
// trait : partie récupérable par fusion génétique (monstre).

export const SPECIES = {
  // ---------- Monde microscopique ----------
  bacterie: { name: 'Bactérie', env: 'micro', stages: [0, 1], size: 0.5, hp: 5, atk: 0, speed: 5, behavior: 'prey', dna: 3, model: 'bact', color: 0x7cd67c, count: 55 },
  algue: { name: 'Algue unicellulaire', env: 'micro', stages: [0, 1], size: 0.75, hp: 8, atk: 0, speed: 1, behavior: 'prey', dna: 2, model: 'algae', color: 0x3fbf5f, count: 35 },
  paramecie: { name: 'Paramécie', env: 'micro', stages: [0, 1], size: 1.4, hp: 22, atk: 3, speed: 6, behavior: 'neutral', dna: 7, model: 'cell', color: 0xc9a0ff, count: 18 },
  amibe: { name: 'Amibe géante', env: 'micro', stages: [0, 1], size: 3, hp: 70, atk: 8, speed: 5, behavior: 'predator', dna: 18, model: 'cell', color: 0xff7a7a, count: 8, trait: 'regen' },
  virus: { name: 'Virus', env: 'micro', stages: [0, 1], size: 0.45, hp: 3, atk: 4, speed: 7, behavior: 'hazard', dna: 2, model: 'virus', color: 0xff3b6b, count: 22 },
  ver: { name: 'Ver primitif', env: 'micro', stages: [1, 1], size: 3, hp: 90, atk: 6, speed: 4, behavior: 'neutral', dna: 16, model: 'worm', color: 0xe8a07a, count: 10 },
  colonie: { name: 'Colonie prédatrice', env: 'micro', stages: [1, 1], size: 5.5, hp: 180, atk: 14, speed: 5.5, behavior: 'predator', dna: 35, model: 'multi', color: 0xff5050, count: 5 },

  // ---------- Océan ----------
  crevette: { name: 'Crevette', env: 'ocean', stages: [2, 8], size: 0.35, hp: 6, atk: 0, speed: 6, behavior: 'prey', dna: 3, model: 'shrimp', color: 0xff9a7a, count: 25, drops: { poisson: 1 } },
  petit_poisson: { name: 'Petit poisson', env: 'ocean', stages: [2, 8], size: 0.6, hp: 12, atk: 0, speed: 9, behavior: 'prey', dna: 6, model: 'fish', color: 0x7ab8ff, count: 40, group: 6, drops: { poisson: 1 } },
  trilobite: { name: 'Trilobite', env: 'ocean', stages: [2, 3], size: 0.8, hp: 20, atk: 0, speed: 3, behavior: 'prey', dna: 8, model: 'trilobite', color: 0x9a7a5a, count: 20, bottom: true },
  meduse: { name: 'Méduse', env: 'ocean', stages: [2, 8], size: 1.3, hp: 18, atk: 6, speed: 2, behavior: 'hazard', dna: 9, model: 'jelly', color: 0xff9ae0, count: 18, trait: 'poison' },
  calmar: { name: 'Calmar', env: 'ocean', stages: [2, 8], size: 1.8, hp: 50, atk: 8, speed: 8, behavior: 'neutral', dna: 14, model: 'squid', color: 0xd05a7a, count: 10, trait: 'tentacules', drops: { poisson: 2 } },
  requin: { name: 'Requin', env: 'ocean', stages: [2, 8], size: 3.5, hp: 160, atk: 20, speed: 11, behavior: 'predator', dna: 32, model: 'shark', color: 0x7a8a9a, count: 6, trait: 'machoires', drops: { poisson: 4, os: 2 } },
  dunkleosteus: { name: 'Dunkleosteus', env: 'ocean', stages: [2, 2], size: 5, hp: 320, atk: 30, speed: 8, behavior: 'predator', dna: 70, model: 'shark', color: 0x5a4a3a, count: 2, armored: true },

  // ---------- Terre ferme ----------
  insecte: { name: 'Insecte', env: 'land', stages: [3, 5], size: 0.3, hp: 4, atk: 0, speed: 6, behavior: 'prey', dna: 4, model: 'bug', color: 0x4a6a2a, count: 45 },
  lezard: { name: 'Lézard', env: 'land', stages: [3, 6], size: 0.55, hp: 15, atk: 2, speed: 8, behavior: 'prey', dna: 7, model: 'lizard', color: 0x6a9a3a, count: 25, drops: { viande: 1 } },
  serpent: { name: 'Serpent', env: 'land', stages: [4, 8], size: 0.7, hp: 30, atk: 10, speed: 5, behavior: 'predator', dna: 12, model: 'snake', color: 0x8a7a2a, count: 12, trait: 'venin', drops: { viande: 1, peau: 1 } },
  raptor: { name: 'Vélociraptor', env: 'land', stages: [4, 4], size: 1.7, hp: 130, atk: 18, speed: 14, behavior: 'predator', dna: 28, model: 'raptor', color: 0x9a6a3a, count: 10, group: 3, trait: 'griffes', drops: { viande: 3, os: 2 } },
  diplodocus: { name: 'Diplodocus', env: 'land', stages: [4, 4], size: 6, hp: 600, atk: 25, speed: 4, behavior: 'neutral', dna: 70, model: 'sauropod', color: 0x7a8a6a, count: 6, drops: { viande: 15, os: 6 } },
  trex: { name: 'Tyrannosaure', env: 'land', stages: [4, 4], size: 5.5, hp: 800, atk: 55, speed: 10, behavior: 'predator', dna: 150, model: 'trex', color: 0x6a5a3a, count: 2, trait: 'geant', drops: { viande: 12, os: 8 } },
  lapin: { name: 'Lapin', env: 'land', stages: [5, 8], size: 0.45, hp: 12, atk: 0, speed: 11, behavior: 'prey', dna: 6, model: 'rabbit', color: 0xb09a80, count: 30, drops: { viande: 1, peau: 1 } },
  cerf: { name: 'Cerf', env: 'land', stages: [5, 8], size: 1.5, hp: 70, atk: 6, speed: 13, behavior: 'prey', dna: 14, model: 'deer', color: 0x9a6a40, count: 22, group: 3, trait: 'cornes', drops: { viande: 4, peau: 2, os: 2 } },
  sanglier: { name: 'Sanglier', env: 'land', stages: [5, 8], size: 1.1, hp: 90, atk: 14, speed: 10, behavior: 'neutral', dna: 16, model: 'boar', color: 0x5a4030, count: 16, trait: 'defenses', drops: { viande: 4, peau: 2, os: 1 } },
  loup: { name: 'Loup', env: 'land', stages: [5, 8], size: 1.1, hp: 80, atk: 15, speed: 14, behavior: 'predator', dna: 20, model: 'wolf', color: 0x8a8a8a, count: 14, group: 3, trait: 'vitesse', drops: { viande: 2, peau: 2, os: 1 } },
  ours: { name: 'Ours', env: 'land', stages: [5, 8], size: 2.1, hp: 320, atk: 32, speed: 10, behavior: 'predator', dna: 45, model: 'bear', color: 0x5a3a20, count: 6, trait: 'force', drops: { viande: 6, peau: 4, os: 3 } },
  mammouth: { name: 'Mammouth', env: 'land', stages: [6, 8], size: 3.8, hp: 650, atk: 30, speed: 7, behavior: 'neutral', dna: 70, model: 'mammoth', color: 0x6a4a30, count: 6, group: 2, yearMax: -4000, trait: 'defenses', drops: { viande: 14, peau: 8, os: 6 } },
  singe: { name: 'Singe', env: 'land', stages: [6, 7], size: 1, hp: 60, atk: 8, speed: 11, behavior: 'friendly', dna: 10, model: 'ape', color: 0x5a3a2a, count: 14, group: 4, drops: { viande: 2 } },
  aigle: { name: 'Aigle', env: 'land', stages: [3, 8], size: 0.9, hp: 25, atk: 6, speed: 14, behavior: 'neutral', dna: 15, model: 'bird', color: 0x6a4a2a, count: 10, flying: true, trait: 'ailes', drops: { viande: 1, plume: 3 } },
  poule: { name: 'Poule', env: 'land', stages: [8, 8], size: 0.45, hp: 10, atk: 0, speed: 6, behavior: 'prey', dna: 3, model: 'chicken', color: 0xf0e8d8, count: 10, needTech: 'elevage', drops: { viande: 1, plume: 2 } },
};

// Effets des traits en mode monstre
export const TRAITS = {
  regen: { name: 'Régénération', desc: 'Se soigne très vite', stats: { regen: 6 } },
  poison: { name: 'Dard empoisonné', desc: 'Les coups empoisonnent', stats: { atk: 10 } },
  tentacules: { name: 'Tentacules', desc: 'Portée d’attaque doublée', stats: { atk: 8 } },
  machoires: { name: 'Mâchoires de requin', desc: 'Morsure dévastatrice', stats: { atk: 25 } },
  griffes: { name: 'Griffes de raptor', desc: 'Attaques rapides', stats: { atk: 15, speed: 2 } },
  geant: { name: 'Gigantisme', desc: 'Taille et santé énormes', stats: { hp: 400, size: 1.2 } },
  cornes: { name: 'Bois de cerf', desc: 'Charge puissante', stats: { atk: 10 } },
  defenses: { name: 'Défenses', desc: 'Encorne les ennemis', stats: { atk: 12, armor: 4 } },
  vitesse: { name: 'Pattes de loup', desc: 'Très rapide', stats: { speed: 8 } },
  force: { name: 'Force de l’ours', desc: 'Force colossale', stats: { atk: 20, hp: 150 } },
  ailes: { name: 'Ailes', desc: 'Permet de voler (Espace)', stats: { speed: 4 } },
  venin: { name: 'Crochets venimeux', desc: 'Poison mortel', stats: { atk: 14 } },
};
