// Constructions plaçables dans le monde (touche B).
// station : permet certaines recettes à proximité. housing : places pour les villageois.
// produce : production automatique par heure de jeu. power : énergie (+ produite / - consommée).

const B = (id, name, icon, cost, tech, extra = {}) => ({ id, name, icon, cost, tech, radius: 2.5, ...extra });

export const BUILDINGS = [
  B('feu_camp', 'Feu de camp', '🔥', { bois: 3, pierre: 3 }, 'feu', { station: 'feu', radius: 1, desc: 'Cuisine, lumière et chaleur.' }),
  B('etabli', 'Établi', '🛠️', { bois: 6, pierre: 2 }, 'outils_pierre', { station: 'etabli', radius: 1.2, desc: 'Fabrique arcs, cuir, planches...' }),
  B('hutte', 'Hutte', '🛖', { bois: 8, fibre: 6, peau: 2 }, 'tribu', { housing: 2, sleep: true, radius: 2.2, desc: 'Abrite 2 villageois. Dors pour passer la nuit.' }),
  B('champ', 'Champ de blé', '🌾', { bois: 2, fibre: 4 }, 'agriculture', { produce: { ble: 0.5 }, radius: 3, walkable: true, desc: 'Produit du blé.' }),
  B('enclos', 'Enclos', '🐄', { bois: 10, corde: 2 }, 'elevage', { produce: { viande: 0.3, peau: 0.1 }, radius: 3.5, desc: 'Élevage : viande et peaux.' }),
  B('four', 'Four', '🧱', { pierre: 10, argile: 6 }, 'poterie', { station: 'four', radius: 1.4, desc: 'Briques, verre, pain, poterie.' }),
  B('puits', 'Puits', '⛲', { pierre: 10, bois: 4 }, 'habitat', { well: true, radius: 1.3, desc: 'Boire de l’eau (E).' }),
  B('mur_bois', 'Palissade', '🪵', { bois: 4 }, 'habitat', { defense: 1, radius: 1.5, wall: true, desc: 'Protège ton village.' }),
  B('maison_bois', 'Maison en bois', '🏠', { bois: 20, pierre: 6, corde: 2 }, 'habitat', { housing: 4, sleep: true, radius: 3, desc: 'Abrite 4 villageois.' }),
  B('forge', 'Forge', '⚒️', { pierre: 15, brique: 6, bois: 5 }, 'bronze', { station: 'forge', radius: 2, desc: 'Travaille les métaux.' }),
  B('marche', 'Boutique', '🏪', { bois: 15, brique: 8 }, 'commerce', { shop: true, radius: 2.8, desc: 'Achète et vends. Les villageois achètent tes produits.' }),
  B('palais', 'Palais', '🏛️', { pierre: 60, brique: 30, or: 5 }, 'lois', { gov: true, radius: 5, desc: 'Siège du pouvoir : +popularité.' }),
  B('caserne', 'Caserne', '⛺', { bois: 20, pierre: 20, fer: 10 }, 'fer', { barracks: true, radius: 3.5, desc: 'Soldats 50 % plus forts.' }),
  B('maison_pierre', 'Maison en pierre', '🏡', { pierre: 30, brique: 15, bois: 10 }, 'architecture', { housing: 6, sleep: true, radius: 3.2, desc: 'Abrite 6 villageois.' }),
  B('mur_pierre', 'Muraille', '🧱', { pierre: 6 }, 'architecture', { defense: 3, radius: 1.5, wall: true, desc: 'Une solide muraille.' }),
  B('tour_garde', 'Tour de garde', '🗼', { pierre: 20, bois: 10 }, 'architecture', { defense: 10, tower: true, radius: 2, desc: 'Tire sur les ennemis proches.' }),
  B('statue', 'Statue', '🗽', { pierre: 20, or: 2 }, 'architecture', { popularity: 5, radius: 1.5, desc: '+5 popularité.' }),
  B('hopital', 'Hôpital', '🏥', { brique: 30, verre: 10, herbe_med: 10 }, 'medecine', { hospital: true, radius: 4, desc: 'Soigne les malades, protège des épidémies.' }),
  B('labo', 'Laboratoire', '🔬', { brique: 20, verre: 15, fer: 5 }, 'alchimie', { station: 'labo', lab: true, radius: 3, desc: 'Potions, remèdes, génétique.' }),
  B('mine', 'Mine', '⛏️', { bois: 20, fer: 10 }, 'vapeur', { produce: { pierre: 1, charbon: 0.5, fer_brut: 0.3 }, radius: 3, desc: 'Extrait des minerais.' }),
  B('usine', 'Usine', '🏭', { brique: 40, acier: 20, verre: 10 }, 'vapeur', { station: 'usine', radius: 5, desc: 'Fabrique les objets industriels.' }),
  B('puits_petrole', 'Puits de pétrole', '🛢️', { acier: 15, moteur: 2 }, 'petrole', { produce: { petrole: 0.6 }, radius: 2.5, desc: 'Extrait du pétrole.' }),
  B('centrale', 'Centrale électrique', '🏗️', { brique: 30, acier: 20, moteur: 2 }, 'electricite', { power: 10, radius: 5, desc: '+10 énergie.' }),
  B('eolienne', 'Éolienne', '🌬️', { acier: 8, moteur: 1 }, 'electricite', { power: 3, radius: 1.5, desc: '+3 énergie.' }),
  B('maison_moderne', 'Maison moderne', '🏘️', { brique: 40, verre: 20, acier: 10, plastique: 5 }, 'electricite', { housing: 10, sleep: true, power: -1, radius: 4, desc: 'Abrite 10 habitants.' }),
  B('immeuble', 'Immeuble', '🏢', { acier: 60, verre: 40, brique: 60 }, 'electronique', { housing: 25, power: -3, radius: 5, desc: 'Abrite 25 habitants.' }),
  B('panneau_solaire', 'Panneau solaire', '☀️', { verre: 6, circuit: 2, acier: 2 }, 'solaire', { power: 4, radius: 1.8, desc: '+4 énergie, propre.' }),
  B('centrale_nucleaire', 'Centrale nucléaire', '☢️', { acier: 60, uranium: 5, brique: 40, circuit: 10 }, 'nucleaire', { power: 40, radius: 7, desc: '+40 énergie.' }),
  B('ordinateur', 'Ordinateur', '💻', { plastique: 4, circuit: 3, ecran: 1, puce: 1 }, 'ordinateurs', { computer: true, power: -1, radius: 1.2, desc: 'Programme, gère ta boutique en ligne et tes robots.' }),
  B('base_lancement', 'Base de lancement', '🚀', { acier: 100, circuit: 30, puce: 10, petrole: 30, uranium: 5 }, 'espace', { rocket: true, power: -10, radius: 6, desc: 'Lance une fusée vers les étoiles !' }),
];

export const BUILD = {};
for (const b of BUILDINGS) BUILD[b.id] = b;
