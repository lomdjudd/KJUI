// Arbre technologique de la carrière. Chaque nœud coûte des points de
// science et débloque des composants (ou des capacités spéciales).

export const TECHS = [
  { id: 'base', name: 'Fondamentaux', cost: 0, tier: 0, row: 2, req: [], desc: "Les bases de l'astronautique : capsule, petits réservoirs, moteur Frelon, propulseurs à poudre, parachutes." },
  { id: 'propulsion', name: 'Propulsion générale', cost: 5, tier: 1, row: 1, req: ['base'], desc: "Moteur de vide Aigle-V, alunisseur Colibri, adaptateurs et plus grands réservoirs." },
  { id: 'stabilite', name: 'Stabilité', cost: 5, tier: 1, row: 2, req: ['base'], desc: "Roues de réaction, propulseurs RCS et réservoirs d'hydrazine." },
  { id: 'electricite', name: 'Électricité', cost: 8, tier: 1, row: 3, req: ['base'], desc: "Batteries, panneaux solaires fixes et projecteurs." },
  { id: 'structures', name: 'Structures', cost: 15, tier: 2, row: 0, req: ['propulsion'], desc: "Diamètre 2,5 m : réservoirs, découpleurs radiaux, capsule Orion-X, tour de sauvetage." },
  { id: 'aero', name: 'Aérodynamique', cost: 12, tier: 2, row: 1.5, req: ['propulsion', 'stabilite'], desc: "Coiffes largables, ailes delta, grilles de pilotage et aérofreins." },
  { id: 'sondes', name: 'Sondes automatiques', cost: 12, tier: 2, row: 3, req: ['electricite', 'stabilite'], desc: "Ordinateurs de bord pour vaisseaux sans équipage." },
  { id: 'moteurs_lourds', name: 'Moteurs lourds', cost: 30, tier: 3, row: 0, req: ['structures'], desc: "Moteur Aquila, propulseur Pulsar M, grands réservoirs, découpleurs radiaux lourds." },
  { id: 'atterrissage', name: 'Atterrissage', cost: 25, tier: 3, row: 1, req: ['structures'], desc: "Jambes d'atterrissage, module lunaire, parachutes renforcés." },
  { id: 'bouclier', name: 'Bouclier thermique', cost: 25, tier: 3, row: 2, req: ['aero'], desc: "Boucliers ablatifs et parachutes stabilisateurs : survivre aux rentrées rapides." },
  { id: 'communication', name: 'Communications', cost: 30, tier: 3, row: 3.5, req: ['sondes'], desc: "Paraboles pour transmettre la science depuis les autres planètes." },
  { id: 'cryogenie', name: 'Cryogénie', cost: 50, tier: 4, row: 0, req: ['moteurs_lourds'], desc: "Hydrogène liquide : moteurs Véga-H et Hydra, réservoirs isolés." },
  { id: 'guidage', name: 'Guidage automatique', cost: 45, tier: 4, row: 2, req: ['sondes', 'aero'], desc: "Ordinateur de guidage : pilote automatique d'ascension, de manœuvre et d'atterrissage." },
  { id: 'solaire_avance', name: 'Énergie avancée', cost: 45, tier: 4, row: 3, req: ['electricite', 'communication'], desc: "Ailes solaires dépliables, panneaux UltraFlex, grosses batteries, module habitat." },
  { id: 'science_avancee', name: 'Science avancée', cost: 50, tier: 4, row: 4, req: ['communication'], desc: "Spectromètre, sismomètre, carottier et laboratoire orbital." },
  { id: 'lourd', name: 'Lanceurs lourds', cost: 70, tier: 5, row: 0, req: ['moteurs_lourds'], desc: "Diamètres 3,75 m et 5 m, moteur Titan-K, grappe Octo-K, Pulsar L." },
  { id: 'methalox', name: 'Méthalox', cost: 80, tier: 5, row: 1, req: ['cryogenie'], desc: "Moteurs Phénix, réservoirs en inox, capsule Dragonne." },
  { id: 'aerospike', name: 'Aérospike', cost: 70, tier: 5, row: 2, req: ['moteurs_lourds', 'aero'], desc: "Moteur Zéphyr à rendement adaptatif et réservoirs en carbone." },
  { id: 'rtg', name: 'Générateurs RTG', cost: 90, tier: 5, row: 3, req: ['solaire_avance'], desc: "Électricité nucléaire constante pour l'espace lointain, là où le Soleil ne suffit plus." },
  { id: 'coque_pressurisee', name: 'Coque pressurisée', cost: 120, tier: 6, row: 0, req: ['bouclier', 'lourd'], special: 'venus', desc: "ACCÈS À VÉNUS : résister à 92 atmosphères et 460 °C." },
  { id: 'nucleaire', name: 'Propulsion nucléaire', cost: 140, tier: 6, row: 1, req: ['cryogenie', 'rtg'], desc: "Moteur thermique nucléaire Prométhée (Isp 900 s)." },
  { id: 'ionique', name: 'Propulsion ionique', cost: 110, tier: 6, row: 2, req: ['solaire_avance'], desc: "Moteur ionique Aurore et réservoirs de xénon." },
  { id: 'bouclier_solaire', name: 'Bouclier solaire', cost: 120, tier: 6, row: 3, req: ['bouclier', 'solaire_avance'], special: 'mercure', desc: "ACCÈS À MERCURE : survivre à un rayonnement solaire sept fois plus fort." },
  { id: 'superlourd', name: 'Super-lourd', cost: 180, tier: 7, row: 0, req: ['lourd', 'methalox'], desc: "Grappe Super-Phénix, réservoirs XL en inox et hydrogène, coiffe XL." },
  { id: 'blindage_radiations', name: 'Blindage anti-radiations', cost: 150, tier: 7, row: 1.5, req: ['rtg', 'science_avancee'], special: 'jupiter', desc: "ACCÈS AUX LUNES DE JUPITER : Io, Europe et Ganymède baignent dans des radiations mortelles." },
  { id: 'isolation_cryo', name: 'Isolation cryogénique', cost: 160, tier: 7, row: 3, req: ['rtg', 'bouclier'], special: 'outer', desc: "ACCÈS AUX MONDES GLACÉS : Titan, Encelade, Titania, Triton, Pluton, Charon et Nyx." },
  { id: 'telescope_profond', name: 'Télescope spatial profond', cost: 220, tier: 8, row: 2, req: ['science_avancee', 'communication'], special: 'nyx', desc: "Révèle la mystérieuse neuvième planète, Nyx, sur les cartes." },
  { id: 'fusion', name: 'Propulsion à fusion', cost: 350, tier: 8, row: 0.5, req: ['nucleaire', 'superlourd'], desc: "Moteur Hélios (Isp 16 000 s) : le système solaire entier devient accessible." },
];

export const TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t]));
