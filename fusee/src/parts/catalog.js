// Catalogue des composants. Toutes les valeurs sont en unités SI
// (kg, N, m, s). Les noms sont fictifs mais inspirés des vrais lanceurs.

export const PROPELLANTS = {
  kero: { name: 'Kérolox', short: 'RP-1/LOX', color: '#f0a94a', density: 800, dry: 1 / 11 },
  metha: { name: 'Méthalox', short: 'CH₄/LOX', color: '#8fd0ff', density: 700, dry: 1 / 10 },
  hydro: { name: 'Hydrolox', short: 'LH₂/LOX', color: '#b3c7ff', density: 330, dry: 1 / 8 },
  solid: { name: 'Poudre', short: 'Solide', color: '#e8e2d0' },
  xenon: { name: 'Xénon', short: 'Xe', color: '#c79bff', density: 1800, dry: 1 / 3 },
  mono: { name: 'Hydrazine', short: 'N₂H₄', color: '#e9f59a', density: 1000, dry: 1 / 5 },
  fusion: { name: 'Deutérium-Hélium 3', short: 'D-³He', color: '#ff7be5', density: 400, dry: 1 / 4 },
  ec: { name: 'Électricité', short: 'kWh', color: '#ffe066' },
  ablator: { name: 'Ablatif', short: 'Ablatif', color: '#a0785a' },
};

// Ressources partagées dans tout le vaisseau (les autres dépendent des
// réservoirs reliés sans découpleur)
export const GLOBAL_RES = new Set(['ec', 'mono', 'xenon', 'fusion']);

export const CATEGORIES = [
  { id: 'command', name: 'Commande', icon: 'M12 2 L18 14 H6 Z M8 16 H16 V20 H8 Z' },
  { id: 'tank', name: 'Réservoirs', icon: 'M7 3 H17 V21 H7 Z M7 8 H17 M7 16 H17' },
  { id: 'engine', name: 'Moteurs', icon: 'M8 3 H16 V8 L19 20 H5 L8 8 Z' },
  { id: 'booster', name: 'Propulseurs', icon: 'M9 2 L15 2 L15 18 L17 22 H7 L9 18 Z' },
  { id: 'structure', name: 'Structure', icon: 'M4 10 H20 V14 H4 Z M7 6 H17 M7 18 H17' },
  { id: 'aero', name: 'Aérodynamique', icon: 'M12 2 L16 12 L20 20 H4 L8 12 Z' },
  { id: 'control', name: 'Contrôle', icon: 'M12 3 A9 9 0 1 1 11.9 3 Z M12 7 V17 M7 12 H17' },
  { id: 'power', name: 'Énergie', icon: 'M13 2 L5 13 H11 L10 22 L19 10 H13 Z' },
  { id: 'landing', name: 'Atterrissage', icon: 'M12 3 V13 M12 13 L5 20 M12 13 L19 20 M3 21 H8 M16 21 H21' },
  { id: 'science', name: 'Science', icon: 'M9 3 H15 M10 3 V10 L5 20 H19 L14 10 V3' },
  { id: 'special', name: 'Technologies', icon: 'M12 2 L14.5 9 L22 9 L16 13.5 L18.5 21 L12 16.5 L5.5 21 L8 13.5 L2 9 L9.5 9 Z' },
];

const P = [];
const add = (p) => {
  P.push(p);
  return p;
};

const SIZE_NAMES = { 0.625: 'XS', 1.25: 'S', 2.5: 'M', 3.75: 'L', 5: 'XL' };

// ---------------------------------------------------------------------------
// COMMANDE
add({
  id: 'cap_alpha', name: 'Capsule Alpha', cat: 'command', tech: 'base', cost: 600, mass: 820,
  d: 1.25, dTop: 0.5, h: 1.35, shape: 'capsule', style: 'alpha',
  command: { crew: 1, torque: 6000, ec: 0.02 }, res: { ec: 50, mono: 10 },
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1600, crash: 14, cdTop: 0.35, cdBottom: 0.9,
  desc: "Capsule monoplace inspirée des pionniers. Robuste, avec petites tuyères de contrôle d'attitude.",
});
add({
  id: 'cap_orion', name: 'Capsule Orion-X', cat: 'command', tech: 'structures', cost: 3800, mass: 3600,
  d: 2.5, dTop: 1.0, h: 2.2, shape: 'capsule', style: 'orion',
  command: { crew: 3, torque: 18000, ec: 0.05 }, res: { ec: 200, mono: 60 },
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1700, crash: 14, cdTop: 0.35, cdBottom: 0.9,
  desc: "Capsule triplace moderne pour l'exploration lointaine, hublots panoramiques et gros stock d'énergie.",
});
add({
  id: 'cap_dragon', name: 'Capsule Dragonne', cat: 'command', tech: 'methalox', cost: 5200, mass: 4200,
  d: 2.5, dTop: 1.3, h: 2.9, shape: 'capsule', style: 'dragon',
  command: { crew: 4, torque: 22000, ec: 0.05 }, res: { ec: 300, mono: 120 },
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1800, crash: 16, cdTop: 0.3, cdBottom: 0.9,
  desc: "Capsule quadriplace réutilisable avec coiffe de nez et propulseurs latéraux intégrés.",
});
add({
  id: 'probe_octo', name: 'Sonde Octo', cat: 'command', tech: 'sondes', cost: 450, mass: 110,
  d: 0.625, h: 0.4, shape: 'probe', style: 'octo',
  command: { crew: 0, torque: 600, probe: true, ec: 0.03 }, res: { ec: 30 },
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1300, crash: 10,
  desc: "Ordinateur de bord octogonal sous feuille d'or. Contrôle un vaisseau sans équipage (consomme de l'électricité).",
});
add({
  id: 'probe_nexus', name: 'Sonde Nexus', cat: 'command', tech: 'sondes', cost: 1200, mass: 350,
  d: 1.25, h: 0.35, shape: 'probe', style: 'ring',
  command: { crew: 0, torque: 2500, probe: true, ec: 0.05 }, res: { ec: 120 },
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1400, crash: 10,
  desc: "Anneau d'avionique pour étages récupérables et satellites lourds.",
});
add({
  id: 'probe_nexus_m', name: 'Sonde Nexus M', cat: 'command', tech: 'lourd', cost: 2400, mass: 700,
  d: 2.5, h: 0.4, shape: 'probe', style: 'ring',
  command: { crew: 0, torque: 9000, probe: true, ec: 0.06 }, res: { ec: 250 },
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1400, crash: 10,
  desc: "Version 2,5 m de l'anneau d'avionique, idéale pour faire atterrir un premier étage.",
});
add({
  id: 'lander_cab', name: 'Module Lunaire Aigle', cat: 'command', tech: 'atterrissage', cost: 3200, mass: 2100,
  d: 2.5, h: 2.1, shape: 'lander', style: 'lm',
  command: { crew: 2, torque: 9000, ec: 0.04 }, res: { ec: 150, mono: 40 },
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1100, crash: 12,
  desc: "Cabine d'atterrissage anguleuse sous isolant doré. Légère, mais ne supporte aucune rentrée atmosphérique.",
});
add({
  id: 'hab_module', name: 'Module Habitat', cat: 'command', tech: 'solaire_avance', cost: 4000, mass: 3800,
  d: 2.5, h: 3.6, shape: 'hab', style: 'white',
  command: { crew: 4, torque: 4000, ec: 0.08 }, res: { ec: 400 },
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1200, crash: 8,
  desc: "Module pressurisé pour stations spatiales et longues croisières interplanétaires.",
});

// ---------------------------------------------------------------------------
// RÉSERVOIRS
function tank(id, name, prop, d, h, tech, style, extra = {}) {
  const pr = PROPELLANTS[prop];
  const vol = Math.PI * (d / 2) * (d / 2) * h;
  const fuel = Math.round(vol * pr.density);
  const dry = Math.round(fuel * pr.dry + 20 * d);
  const costPerKg = { kero: 0.08, metha: 0.1, hydro: 0.16, xenon: 2.2, mono: 0.6, fusion: 8 }[prop];
  return add({
    id, name, cat: 'tank', tech, cost: Math.round(80 + fuel * costPerKg + dry * 0.5), mass: dry,
    d, h, shape: 'tank', style, res: { [prop]: fuel },
    attach: { top: true, bottom: true, surface: true }, maxTemp: 1500, crash: 7,
    desc: `Réservoir ${pr.name} de ${d} m de diamètre. Contient ${Math.round(fuel / 100) / 10} t d'ergols.`,
    ...extra,
  });
}
tank('tank_k_s1', 'Réservoir K-S1', 'kero', 1.25, 1.0, 'base', 'white');
tank('tank_k_s2', 'Réservoir K-S2', 'kero', 1.25, 2.0, 'base', 'white');
tank('tank_k_s4', 'Réservoir K-S4', 'kero', 1.25, 4.0, 'propulsion', 'white');
tank('tank_k_xs', 'Réservoir K-XS', 'kero', 0.625, 0.8, 'propulsion', 'white');
tank('tank_k_m2', 'Réservoir K-M2', 'kero', 2.5, 2.0, 'structures', 'white');
tank('tank_k_m4', 'Réservoir K-M4', 'kero', 2.5, 4.0, 'structures', 'white');
tank('tank_k_m8', 'Réservoir K-M8', 'kero', 2.5, 8.0, 'structures', 'white');
tank('tank_k_m16', 'Réservoir K-M16', 'kero', 2.5, 16.0, 'moteurs_lourds', 'white');
tank('tank_k_l6', 'Réservoir K-L6', 'kero', 3.75, 6.0, 'lourd', 'white');
tank('tank_k_l12', 'Réservoir K-L12', 'kero', 3.75, 12.0, 'lourd', 'white');
tank('tank_k_l24', 'Réservoir K-L24', 'kero', 3.75, 24.0, 'lourd', 'white');
tank('tank_k_xl12', 'Réservoir K-XL12', 'kero', 5, 12.0, 'lourd', 'black');
tank('tank_k_xl24', 'Réservoir K-XL24', 'kero', 5, 24.0, 'lourd', 'black');
tank('tank_c_m3', 'Réservoir Carbone C-M3', 'kero', 2.5, 3.0, 'aerospike', 'carbon');
tank('tank_c_m6', 'Réservoir Carbone C-M6', 'kero', 2.5, 6.0, 'aerospike', 'carbon');

tank('tank_h_s3', 'Réservoir H-S3', 'hydro', 1.25, 3.0, 'cryogenie', 'foam');
tank('tank_h_m6', 'Réservoir H-M6', 'hydro', 2.5, 6.0, 'cryogenie', 'foam');
tank('tank_h_m12', 'Réservoir H-M12', 'hydro', 2.5, 12.0, 'cryogenie', 'foam');
tank('tank_h_l16', 'Réservoir H-L16', 'hydro', 3.75, 16.0, 'lourd', 'foam');
tank('tank_h_xl30', 'Réservoir H-XL30', 'hydro', 5, 30.0, 'superlourd', 'foam');

tank('tank_m_m4', 'Réservoir Inox M4', 'metha', 2.5, 4.0, 'methalox', 'steel');
tank('tank_m_m8', 'Réservoir Inox M8', 'metha', 2.5, 8.0, 'methalox', 'steel');
tank('tank_m_l10', 'Réservoir Inox L10', 'metha', 3.75, 10.0, 'methalox', 'steel');
tank('tank_m_xl16', 'Réservoir Inox XL16', 'metha', 5, 16.0, 'superlourd', 'steel');
tank('tank_m_xl32', 'Réservoir Inox XL32', 'metha', 5, 32.0, 'superlourd', 'steel');

tank('tank_mono_s', 'Réservoir d\'hydrazine S', 'mono', 1.25, 0.5, 'stabilite', 'grey');
add({
  id: 'tank_mono_rad', name: 'Sphère d\'hydrazine', cat: 'tank', tech: 'stabilite', cost: 180, mass: 30,
  d: 0.45, h: 0.45, shape: 'sphere_tank', style: 'grey', res: { mono: 90 }, radial: true, rad: 0.225,
  attach: { radialOnly: true }, maxTemp: 1400, crash: 8,
  desc: "Petite sphère d'hydrazine à fixer sur le flanc, pour les propulseurs RCS.",
});
add({
  id: 'tank_xenon_rad', name: 'Réservoir de xénon', cat: 'tank', tech: 'ionique', cost: 1400, mass: 80,
  d: 0.5, h: 0.9, shape: 'capsule_tank', style: 'grey', res: { xenon: 280 }, radial: true, rad: 0.25,
  attach: { radialOnly: true }, maxTemp: 1400, crash: 8,
  desc: "Bouteille haute pression de xénon pour les moteurs ioniques.",
});
tank('tank_xenon_s', 'Réservoir de xénon S', 'xenon', 1.25, 0.9, 'ionique', 'grey');
tank('tank_fusion', 'Cuve de fusion D-³He', 'fusion', 2.5, 3.0, 'fusion', 'fusion');

// ---------------------------------------------------------------------------
// MOTEURS
function engine(o) {
  return add({
    cat: 'engine', attach: { top: true, bottom: true, surface: false }, maxTemp: 2200, crash: 7,
    shape: 'engine', ...o,
  });
}
engine({
  id: 'eng_frelon', name: 'Frelon', tech: 'base', cost: 850, mass: 1050, d: 1.25, h: 1.35,
  engine: { prop: 'kero', thrust: 215e3, ispSL: 285, ispVac: 315, gimbal: 3, minThrottle: 0, plume: 'kero', exitD: 0.95, bell: 'sl' },
  style: 'frelon', desc: "Moteur kérolox fiable et simple. L'indispensable des premières fusées.",
});
engine({
  id: 'eng_colibri', name: 'Colibri', tech: 'propulsion', cost: 400, mass: 180, d: 0.625, h: 0.55,
  engine: { prop: 'kero', thrust: 28e3, ispSL: 270, ispVac: 318, gimbal: 5, minThrottle: 0, plume: 'kero', exitD: 0.4, bell: 'sl' },
  style: 'small', desc: "Petit moteur d'alunisseur, très réglable. Parfait pour les atterrissages en douceur.",
});
engine({
  id: 'eng_aigle_v', name: 'Aigle-V', tech: 'propulsion', cost: 1100, mass: 620, d: 1.25, h: 1.9,
  engine: { prop: 'kero', thrust: 110e3, ispSL: 110, ispVac: 348, gimbal: 4, minThrottle: 0, plume: 'kero', exitD: 1.15, bell: 'vac' },
  style: 'vac', desc: "Moteur d'étage supérieur à grande tuyère, redoutable dans le vide mais inefficace au sol.",
});
engine({
  id: 'eng_aquila', name: 'Aquila', tech: 'moteurs_lourds', cost: 4200, mass: 2150, d: 2.5, h: 2.4,
  engine: { prop: 'kero', thrust: 920e3, ispSL: 290, ispVac: 320, gimbal: 4, minThrottle: 0.4, plume: 'kero', exitD: 1.7, bell: 'sl' },
  style: 'aquila', desc: "Moteur de premier étage de 2,5 m. Réallumable, il permet l'atterrissage propulsif.",
});
engine({
  id: 'eng_titan', name: 'Titan-K', tech: 'lourd', cost: 9800, mass: 5200, d: 3.75, h: 3.3,
  engine: { prop: 'kero', thrust: 2700e3, ispSL: 295, ispVac: 324, gimbal: 3, minThrottle: 0.5, plume: 'kero', exitD: 3.1, bell: 'sl' },
  style: 'titan', desc: "Monstre à double chambre inspiré des moteurs lunaires historiques.",
});
engine({
  id: 'eng_titan_grappe', name: 'Grappe Octo-K', tech: 'lourd', cost: 16000, mass: 9800, d: 3.75, h: 2.2,
  engine: { prop: 'kero', thrust: 7600e3, ispSL: 288, ispVac: 316, gimbal: 3, minThrottle: 0.4, plume: 'kero', exitD: 3.5, bell: 'cluster9', count: 9 },
  style: 'cluster9', desc: "Neuf moteurs Aquila en grappe octogonale, pour les premiers étages lourds réutilisables.",
});
engine({
  id: 'eng_phenix', name: 'Phénix', tech: 'methalox', cost: 6500, mass: 1650, d: 1.25, h: 1.6,
  engine: { prop: 'metha', thrust: 2300e3, ispSL: 327, ispVac: 350, gimbal: 6, minThrottle: 0.4, plume: 'metha', exitD: 1.25, bell: 'sl' },
  style: 'phenix', desc: "Moteur à combustion étagée méthane/oxygène. Poussée énorme pour sa taille.",
});
engine({
  id: 'eng_phenix_v', name: 'Phénix-Vide', tech: 'methalox', cost: 7200, mass: 2300, d: 2.5, h: 3.1,
  engine: { prop: 'metha', thrust: 2450e3, ispSL: 200, ispVac: 378, gimbal: 2, minThrottle: 0.4, plume: 'metha', exitD: 2.35, bell: 'vac' },
  style: 'phenix_v', desc: "Version à tuyère étendue du Phénix, optimisée pour le vide.",
});
engine({
  id: 'eng_phenix_grappe', name: 'Grappe Super-Phénix', tech: 'superlourd', cost: 52000, mass: 26000, d: 5, h: 2.6,
  engine: { prop: 'metha', thrust: 30000e3, ispSL: 327, ispVac: 350, gimbal: 3, minThrottle: 0.4, plume: 'metha', exitD: 4.8, bell: 'cluster13', count: 13 },
  style: 'cluster13', desc: "Treize moteurs Phénix pour le lanceur le plus puissant jamais construit.",
});
engine({
  id: 'eng_vega', name: 'Véga-H', tech: 'cryogenie', cost: 3400, mass: 320, d: 1.25, h: 2.1,
  engine: { prop: 'hydro', thrust: 110e3, ispSL: 150, ispVac: 462, gimbal: 4, minThrottle: 0.2, plume: 'hydro', exitD: 1.15, bell: 'vac' },
  style: 'vega', desc: "Moteur hydrolox d'étage supérieur à haut rendement. Idéal pour les injections lointaines.",
});
engine({
  id: 'eng_hydra', name: 'Hydra', tech: 'cryogenie', cost: 12000, mass: 3300, d: 2.5, h: 3.0,
  engine: { prop: 'hydro', thrust: 2250e3, ispSL: 366, ispVac: 452, gimbal: 5, minThrottle: 0.6, plume: 'hydro', exitD: 2.2, bell: 'sl' },
  style: 'hydra', desc: "Moteur principal cryogénique de navette : poussée et rendement exceptionnels.",
});
engine({
  id: 'eng_zephyr', name: 'Zéphyr', tech: 'aerospike', cost: 8800, mass: 2200, d: 2.5, h: 1.5,
  engine: { prop: 'kero', thrust: 1150e3, ispSL: 318, ispVac: 345, gimbal: 0, minThrottle: 0.2, plume: 'spike', exitD: 2.2, bell: 'spike' },
  style: 'spike', desc: "Aérospike linéaire : son rendement s'adapte à l'altitude. Pas d'orientation de poussée.",
});
engine({
  id: 'eng_promethee', name: 'Prométhée', tech: 'nucleaire', cost: 22000, mass: 3500, d: 1.25, h: 3.2,
  engine: { prop: 'hydro', thrust: 120e3, ispSL: 185, ispVac: 900, gimbal: 1, minThrottle: 0, plume: 'nuke', exitD: 1.1, bell: 'vac', hydroOnly: true },
  style: 'nuke', desc: "Moteur thermique nucléaire : le réacteur chauffe l'hydrogène. Double rendement pour les longs voyages.",
});
engine({
  id: 'eng_aurore', name: 'Aurore', tech: 'ionique', cost: 9000, mass: 250, d: 0.625, h: 0.5,
  engine: { prop: 'xenon', thrust: 4000, ispSL: 120, ispVac: 4200, gimbal: 0, minThrottle: 0, plume: 'ion', exitD: 0.55, bell: 'ion', ec: 14 },
  style: 'ion', desc: "Propulseur ionique à grille. Poussée infime mais rendement colossal. Très gourmand en électricité.",
});
engine({
  id: 'eng_helios', name: 'Hélios', tech: 'fusion', cost: 180000, mass: 11000, d: 2.5, h: 5.0,
  engine: { prop: 'fusion', thrust: 900e3, ispSL: 2500, ispVac: 16000, gimbal: 2, minThrottle: 0, plume: 'fusion', exitD: 2.3, bell: 'fusion', ecGen: 40 },
  style: 'fusion', desc: "Moteur à fusion à confinement magnétique. Ouvre les portes du système solaire tout entier.",
});
add({
  id: 'eng_radial', name: 'Vernier radial', cat: 'engine', tech: 'moteurs_lourds', cost: 700, mass: 150,
  d: 0.4, h: 0.8, shape: 'radial_engine', style: 'small', radial: true, rad: 0.2,
  engine: { prop: 'kero', thrust: 60e3, ispSL: 260, ispVac: 300, gimbal: 6, minThrottle: 0, plume: 'kero', exitD: 0.32, bell: 'sl' },
  attach: { radialOnly: true }, maxTemp: 2000, crash: 7,
  desc: "Petit moteur à fixer sur le flanc, utile pour les alunisseurs et le contrôle.",
});

// ---------------------------------------------------------------------------
// PROPULSEURS À POUDRE
function srb(o) {
  return add({
    cat: 'booster', attach: { top: true, bottom: true, surface: true }, maxTemp: 2200, crash: 8, shape: 'srb', ...o,
  });
}
srb({
  id: 'srb_xs', name: 'Pulsar XS', tech: 'base', cost: 180, mass: 90, d: 0.625, h: 2.0, res: { solid: 560 },
  engine: { prop: 'solid', thrust: 36e3, ispSL: 195, ispVac: 220, gimbal: 0, solid: true, plume: 'srb', exitD: 0.45, bell: 'srb' },
  style: 'srb_white', desc: "Petit propulseur à poudre pour fusées-sondes. Impossible à éteindre une fois allumé.",
});
srb({
  id: 'srb_s', name: 'Pulsar S', tech: 'base', cost: 520, mass: 850, d: 1.25, h: 5.5, res: { solid: 7800 },
  engine: { prop: 'solid', thrust: 330e3, ispSL: 205, ispVac: 230, gimbal: 0, solid: true, plume: 'srb', exitD: 0.9, bell: 'srb' },
  style: 'srb_white', desc: "Propulseur d'appoint à poudre. Poussée brutale pendant une cinquantaine de secondes.",
});
srb({
  id: 'srb_m', name: 'Pulsar M', tech: 'moteurs_lourds', cost: 3600, mass: 7200, d: 2.5, h: 14, res: { solid: 68000 },
  engine: { prop: 'solid', thrust: 2500e3, ispSL: 215, ispVac: 242, gimbal: 2, solid: true, plume: 'srb', exitD: 1.9, bell: 'srb' },
  style: 'srb_white', desc: "Gros propulseur segmenté, orientable, pour lanceurs moyens.",
});
srb({
  id: 'srb_l', name: 'Pulsar L', tech: 'lourd', cost: 9800, mass: 24000, d: 3.75, h: 26, res: { solid: 240000 },
  engine: { prop: 'solid', thrust: 7400e3, ispSL: 228, ispVac: 255, gimbal: 3, solid: true, plume: 'srb', exitD: 3.0, bell: 'srb' },
  style: 'srb_segmented', desc: "Propulseur géant à cinq segments, héritier des navettes spatiales.",
});
add({
  id: 'les_tower', name: 'Tour de sauvetage', cat: 'booster', tech: 'structures', cost: 900, mass: 450,
  d: 0.5, h: 3.2, shape: 'les', style: 'les', res: { solid: 350 },
  engine: { prop: 'solid', thrust: 140e3, ispSL: 190, ispVac: 200, gimbal: 0, solid: true, plume: 'srb', exitD: 0.25, bell: 'les', escape: true },
  decoupler: { force: 25e3 },
  attach: { top: true, bottom: true, surface: false }, maxTemp: 2000, crash: 8,
  desc: "Tour d'éjection d'urgence à placer au sommet d'une capsule. Arrache la capsule en cas d'avarie (touche Retour arrière).",
});

// ---------------------------------------------------------------------------
// STRUCTURE
for (const [d, tech, cost] of [[0.625, 'propulsion', 120], [1.25, 'base', 250], [2.5, 'structures', 600], [3.75, 'lourd', 1200], [5, 'lourd', 2000]]) {
  const s = SIZE_NAMES[d];
  add({
    id: `dec_${s.toLowerCase()}`, name: `Découpleur ${s}`, cat: 'structure', tech, cost, mass: Math.round(40 + 90 * d * d),
    d, h: 0.18 + d * 0.05, shape: 'decoupler', style: 'decoupler',
    decoupler: { force: 60e3 * d * d },
    attach: { top: true, bottom: true, surface: false }, maxTemp: 2000, crash: 9,
    desc: `Anneau pyrotechnique de ${d} m. Sépare les étages : il reste attaché à la partie inférieure.`,
  });
}
for (const [d, tech, cost] of [[1.25, 'structures', 900], [2.5, 'structures', 1800], [3.75, 'lourd', 3200], [5, 'lourd', 5200]]) {
  const s = SIZE_NAMES[d];
  add({
    id: `inter_${s.toLowerCase()}`, name: `Inter-étage ${s}`, cat: 'structure', tech, cost, mass: Math.round(120 + 260 * d * d),
    d, h: d * 1.1, shape: 'interstage', style: 'black',
    decoupler: { force: 80e3 * d * d },
    attach: { top: true, bottom: true, surface: true }, maxTemp: 2000, crash: 9,
    desc: `Jupe inter-étage de ${d} m qui enveloppe la tuyère de l'étage supérieur et se sépare avec l'étage inférieur.`,
  });
}
add({
  id: 'dec_radial_s', name: 'Découpleur radial', cat: 'structure', tech: 'structures', cost: 400, mass: 60,
  d: 0.3, h: 0.8, shape: 'radial_dec', style: 'decoupler', radial: true, rad: 0.15, outDist: 0.15,
  decoupler: { force: 45e3, radial: true },
  attach: { radialOnly: true, out: true }, maxTemp: 2000, crash: 9,
  desc: "Fixe un propulseur d'appoint sur le flanc et l'éjecte latéralement.",
});
add({
  id: 'dec_radial_l', name: 'Découpleur radial lourd', cat: 'structure', tech: 'moteurs_lourds', cost: 1100, mass: 240,
  d: 0.6, h: 1.8, shape: 'radial_dec', style: 'decoupler', radial: true, rad: 0.3, outDist: 0.3,
  decoupler: { force: 180e3, radial: true },
  attach: { radialOnly: true, out: true }, maxTemp: 2000, crash: 9,
  desc: "Version renforcée pour les gros propulseurs à poudre et les étages latéraux.",
});
for (const [a, b, tech] of [[0.625, 1.25, 'propulsion'], [1.25, 2.5, 'structures'], [2.5, 3.75, 'lourd'], [3.75, 5, 'lourd']]) {
  add({
    id: `adapt_${SIZE_NAMES[a].toLowerCase()}_${SIZE_NAMES[b].toLowerCase()}`, name: `Adaptateur ${SIZE_NAMES[a]}→${SIZE_NAMES[b]}`, cat: 'structure', tech,
    cost: Math.round(150 * b), mass: Math.round(60 * b * b), d: b, dTop: a, h: (b - a) * 0.9 + 0.3, shape: 'adapter', style: 'white',
    attach: { top: true, bottom: true, surface: true }, maxTemp: 1800, crash: 9, flippable: true,
    desc: `Relie un étage de ${a} m à un étage de ${b} m. Retournable (touche F).`,
  });
}
add({
  id: 'truss_s', name: 'Poutre treillis', cat: 'structure', tech: 'structures', cost: 200, mass: 90,
  d: 1.25, h: 1.5, shape: 'truss', style: 'grey',
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1800, crash: 12,
  desc: "Structure légère en treillis pour espacer les éléments.",
});
add({
  id: 'truss_m', name: 'Poutre treillis M', cat: 'structure', tech: 'lourd', cost: 500, mass: 300,
  d: 2.5, h: 3.0, shape: 'truss', style: 'grey',
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1800, crash: 12,
  desc: "Grande structure en treillis pour stations et vaisseaux interplanétaires.",
});
add({
  id: 'fairing_s', name: 'Coiffe S', cat: 'structure', tech: 'aero', cost: 500, mass: 140,
  d: 1.25, h: 0.25, shape: 'fairing', style: 'fairing', fairing: { maxD: 1.9 },
  attach: { top: true, bottom: true, surface: false }, maxTemp: 1900, crash: 8,
  desc: "Base de coiffe : enveloppe automatiquement tout ce qui est posé au-dessus et se sépare en deux coquilles.",
});
add({
  id: 'fairing_m', name: 'Coiffe M', cat: 'structure', tech: 'aero', cost: 1200, mass: 400,
  d: 2.5, h: 0.3, shape: 'fairing', style: 'fairing', fairing: { maxD: 3.6 },
  attach: { top: true, bottom: true, surface: false }, maxTemp: 1900, crash: 8,
  desc: "Base de coiffe de 2,5 m pour satellites et sondes interplanétaires.",
});
add({
  id: 'fairing_l', name: 'Coiffe L', cat: 'structure', tech: 'lourd', cost: 2600, mass: 900,
  d: 3.75, h: 0.35, shape: 'fairing', style: 'fairing', fairing: { maxD: 5.4 },
  attach: { top: true, bottom: true, surface: false }, maxTemp: 1900, crash: 8,
  desc: "Grande coiffe pour charges utiles lourdes.",
});
add({
  id: 'fairing_xl', name: 'Coiffe XL', cat: 'structure', tech: 'superlourd', cost: 4200, mass: 1500,
  d: 5, h: 0.4, shape: 'fairing', style: 'fairing', fairing: { maxD: 7.2 },
  attach: { top: true, bottom: true, surface: false }, maxTemp: 1900, crash: 8,
  desc: "Coiffe géante pour les stations et les atterrisseurs lourds.",
});

// ---------------------------------------------------------------------------
// AÉRODYNAMIQUE
for (const [d, tech] of [[0.625, 'base'], [1.25, 'base'], [2.5, 'structures'], [3.75, 'lourd'], [5, 'lourd']]) {
  const s = SIZE_NAMES[d];
  add({
    id: `nose_${s.toLowerCase()}`, name: `Cône de nez ${s}`, cat: 'aero', tech, cost: Math.round(80 * d + 40), mass: Math.round(35 * d * d + 10),
    d, dTop: 0.02, h: d * 1.5, shape: 'nose', style: 'white',
    attach: { top: false, bottom: true, surface: true }, maxTemp: 2200, crash: 8, cdTop: 0.12,
    desc: "Cône ogival qui réduit fortement la traînée au sommet d'un étage.",
  });
}
add({
  id: 'fin_basic', name: 'Aileron standard', cat: 'aero', tech: 'base', cost: 150, mass: 50,
  d: 0.1, h: 1.0, shape: 'fin', style: 'fin', radial: true, rad: 0,
  fin: { area: 0.9, span: 0.8 }, attach: { radialOnly: true }, maxTemp: 1800, crash: 10,
  desc: "Aileron fixe qui stabilise la fusée en ramenant la pointe dans le sens du vent.",
});
add({
  id: 'fin_delta', name: 'Aile delta', cat: 'aero', tech: 'aero', cost: 420, mass: 140,
  d: 0.1, h: 2.2, shape: 'fin', style: 'delta', radial: true, rad: 0,
  fin: { area: 2.6, span: 1.3, control: 0.6 }, attach: { radialOnly: true }, maxTemp: 1900, crash: 10,
  desc: "Grande aile à gouverne mobile : stabilité et contrôle en atmosphère.",
});
add({
  id: 'fin_grid', name: 'Grille de pilotage', cat: 'aero', tech: 'aero', cost: 900, mass: 120,
  d: 0.1, h: 0.9, shape: 'gridfin', style: 'titanium', radial: true, rad: 0,
  fin: { area: 1.6, span: 0.9, control: 1.4, grid: true }, attach: { radialOnly: true }, maxTemp: 2200, crash: 12,
  desc: "Ailette en treillis de titane, redoutable pour guider un étage qui redescend.",
});
add({
  id: 'airbrake', name: 'Aérofrein', cat: 'aero', tech: 'aero', cost: 500, mass: 90,
  d: 0.1, h: 0.9, shape: 'airbrake', style: 'grey', radial: true, rad: 0,
  airbrake: { area: 2.4 }, attach: { radialOnly: true }, maxTemp: 1800, crash: 10,
  desc: "Volet déployable (touche B) qui augmente fortement la traînée.",
});

// ---------------------------------------------------------------------------
// CONTRÔLE
for (const [d, torque, tech, cost] of [[0.625, 3000, 'stabilite', 600], [1.25, 12000, 'stabilite', 1200], [2.5, 40000, 'lourd', 2800]]) {
  const s = SIZE_NAMES[d];
  add({
    id: `wheel_${s.toLowerCase()}`, name: `Roue de réaction ${s}`, cat: 'control', tech, cost, mass: Math.round(60 + 100 * d * d),
    d, h: 0.25 + d * 0.08, shape: 'wheel', style: 'wheel', wheel: { torque, ec: torque / 30000 },
    attach: { top: true, bottom: true, surface: true }, maxTemp: 1500, crash: 9,
    desc: "Gyroscopes électriques : couple de rotation puissant, sans carburant.",
  });
}
add({
  id: 'rcs_quad', name: 'Bloc RCS', cat: 'control', tech: 'stabilite', cost: 450, mass: 40,
  d: 0.3, h: 0.3, shape: 'rcs', style: 'grey', radial: true, rad: 0.05,
  rcs: { thrust: 1500, isp: 240 }, attach: { radialOnly: true }, maxTemp: 1800, crash: 10,
  desc: "Quatre petites tuyères à hydrazine : rotation et translation fine (touche R pour activer).",
});
add({
  id: 'computer', name: 'Ordinateur de guidage', cat: 'control', tech: 'guidage', cost: 2500, mass: 80,
  d: 0.5, h: 0.25, shape: 'box', style: 'computer', radial: true, rad: 0.12,
  special: 'autopilot', attach: { radialOnly: true }, maxTemp: 1400, crash: 9,
  desc: "Débloque le pilote automatique : mise en orbite, exécution des manœuvres et atterrissage propulsif.",
});

// ---------------------------------------------------------------------------
// ÉNERGIE
add({
  id: 'battery_rad', name: 'Batterie radiale', cat: 'power', tech: 'electricite', cost: 250, mass: 25,
  d: 0.4, h: 0.5, shape: 'box', style: 'battery', radial: true, rad: 0.08, res: { ec: 100 },
  attach: { radialOnly: true }, maxTemp: 1400, crash: 9, desc: "Petite batterie à fixer sur le flanc.",
});
add({
  id: 'battery_s', name: 'Batterie S', cat: 'power', tech: 'electricite', cost: 500, mass: 80, d: 1.25, h: 0.3,
  shape: 'batterystack', style: 'battery', res: { ec: 400 }, attach: { top: true, bottom: true, surface: true }, maxTemp: 1400, crash: 9,
  desc: "Banc de batteries de 1,25 m.",
});
add({
  id: 'battery_m', name: 'Batterie M', cat: 'power', tech: 'solaire_avance', cost: 1500, mass: 300, d: 2.5, h: 0.45,
  shape: 'batterystack', style: 'battery', res: { ec: 2000 }, attach: { top: true, bottom: true, surface: true }, maxTemp: 1400, crash: 9,
  desc: "Gros banc de batteries pour moteurs ioniques et habitats.",
});
add({
  id: 'solar_fixed', name: 'Panneau solaire fixe', cat: 'power', tech: 'electricite', cost: 300, mass: 20,
  d: 0.1, h: 0.8, shape: 'solar_fixed', style: 'solar', radial: true, rad: 0.02, solar: { power: 0.75 },
  attach: { radialOnly: true }, maxTemp: 1200, crash: 8, desc: "Petit panneau plaqué sur la coque.",
});
add({
  id: 'solar_wing', name: 'Ailes solaires', cat: 'power', tech: 'solaire_avance', cost: 1200, mass: 90,
  d: 0.3, h: 0.9, shape: 'solar_wing', style: 'solar', radial: true, rad: 0.1, solar: { power: 5, deploy: true },
  attach: { radialOnly: true }, maxTemp: 1200, crash: 6, desc: "Grande aile solaire dépliable (touche U). Se brise si elle est déployée dans l'atmosphère dense.",
});
add({
  id: 'solar_fan', name: 'Panneau circulaire UltraFlex', cat: 'power', tech: 'solaire_avance', cost: 2200, mass: 140,
  d: 0.5, h: 0.5, shape: 'solar_fan', style: 'solar', radial: true, rad: 0.12, solar: { power: 9, deploy: true },
  attach: { radialOnly: true }, maxTemp: 1200, crash: 6, desc: "Panneau en éventail qui se déploie comme un parapluie. Très puissant.",
});
add({
  id: 'rtg', name: 'Générateur RTG', cat: 'power', tech: 'rtg', cost: 9000, mass: 200,
  d: 0.45, h: 1.1, shape: 'rtg', style: 'rtg', radial: true, rad: 0.25, rtg: { power: 1.2 },
  attach: { radialOnly: true }, maxTemp: 1600, crash: 12,
  desc: "Générateur au plutonium : électricité constante, même loin du Soleil. Indispensable au-delà de Jupiter.",
});

// ---------------------------------------------------------------------------
// ATTERRISSAGE
add({
  id: 'legs_s', name: 'Pieds d\'alunisseur', cat: 'landing', tech: 'atterrissage', cost: 450, mass: 60,
  d: 0.2, h: 0.9, shape: 'legs_lander', style: 'gold', radial: true, rad: 0.05,
  legs: { span: 1.1, drop: 1.0 }, attach: { radialOnly: true }, maxTemp: 1500, crash: 14,
  desc: "Jambes à amortisseurs et semelles larges (touche G).",
});
add({
  id: 'legs_m', name: 'Jambes repliables', cat: 'landing', tech: 'atterrissage', cost: 1200, mass: 280,
  d: 0.35, h: 3.2, shape: 'legs_fold', style: 'carbon', radial: true, rad: 0.05,
  legs: { span: 3.4, drop: 1.1, fold: true }, attach: { radialOnly: true }, maxTemp: 1900, crash: 16,
  desc: "Jambes en carbone repliées contre l'étage pendant l'ascension, déployées pour l'atterrissage propulsif (touche G).",
});
add({
  id: 'legs_l', name: 'Jambes lourdes', cat: 'landing', tech: 'lourd', cost: 2800, mass: 900,
  d: 0.5, h: 5.2, shape: 'legs_fold', style: 'steelleg', radial: true, rad: 0.05,
  legs: { span: 5.5, drop: 1.4, fold: true }, attach: { radialOnly: true }, maxTemp: 2000, crash: 18,
  desc: "Train d'atterrissage pour vaisseaux géants.",
});
add({
  id: 'chute_s', name: 'Parachute S', cat: 'landing', tech: 'base', cost: 350, mass: 100,
  d: 0.6, dTop: 0.3, h: 0.35, shape: 'chute', style: 'chute', chute: { cda: 450, maxSpeed: 320 },
  attach: { top: false, bottom: true, surface: false }, maxTemp: 1500, crash: 10, cdTop: 0.5,
  desc: "Parachute principal à placer au sommet d'une capsule. S'ouvre en deux temps.",
});
add({
  id: 'chute_m', name: 'Parachute M', cat: 'landing', tech: 'atterrissage', cost: 900, mass: 300,
  d: 1.25, dTop: 0.6, h: 0.5, shape: 'chute', style: 'chute', chute: { cda: 1500, maxSpeed: 330 },
  attach: { top: false, bottom: true, surface: false }, maxTemp: 1500, crash: 10, cdTop: 0.5,
  desc: "Trois grandes voilures pour les capsules lourdes.",
});
add({
  id: 'chute_rad', name: 'Parachute radial', cat: 'landing', tech: 'atterrissage', cost: 400, mass: 80,
  d: 0.3, h: 0.6, shape: 'chute_rad', style: 'chute', radial: true, rad: 0.1, chute: { cda: 400, maxSpeed: 320 },
  attach: { radialOnly: true }, maxTemp: 1500, crash: 10,
  desc: "Parachute à fixer sur le flanc (par exemple pour récupérer des propulseurs).",
});
add({
  id: 'chute_drogue', name: 'Parachute stabilisateur', cat: 'landing', tech: 'bouclier', cost: 600, mass: 90,
  d: 0.6, dTop: 0.3, h: 0.3, shape: 'chute', style: 'drogue', chute: { cda: 90, maxSpeed: 700, drogue: true },
  attach: { top: false, bottom: true, surface: false }, maxTemp: 1700, crash: 10, cdTop: 0.5,
  desc: "Petit parachute supersonique qui stabilise et freine avant le principal.",
});
for (const [d, tech, cost] of [[1.25, 'bouclier', 600], [2.5, 'bouclier', 1500], [3.75, 'lourd', 3000], [5, 'superlourd', 5200]]) {
  const s = SIZE_NAMES[d];
  add({
    id: `shield_${s.toLowerCase()}`, name: `Bouclier thermique ${s}`, cat: 'landing', tech, cost, mass: Math.round(120 * d * d),
    d, h: 0.18 + d * 0.06, shape: 'heatshield', style: 'shield', res: { ablator: Math.round(160 * d * d) },
    attach: { top: true, bottom: true, surface: false }, maxTemp: 3300, crash: 10, cdBottom: 1.3, heatShield: true,
    desc: "Bouclier ablatif : protège le vaisseau pendant les rentrées atmosphériques rapides.",
  });
}
add({
  id: 'light', name: 'Projecteur', cat: 'landing', tech: 'electricite', cost: 150, mass: 15,
  d: 0.2, h: 0.2, shape: 'light', style: 'grey', radial: true, rad: 0.05, lamp: { ec: 0.05 },
  attach: { radialOnly: true }, maxTemp: 1300, crash: 8, desc: "Éclaire le sol pendant les atterrissages de nuit (touche L).",
});

// ---------------------------------------------------------------------------
// SCIENCE ET COMMUNICATION
const sci = (o) => add({ cat: 'science', radial: true, attach: { radialOnly: true }, maxTemp: 1400, crash: 9, ...o });
sci({ id: 'sci_thermo', name: 'Thermomètre', tech: 'base', cost: 250, mass: 5, d: 0.15, h: 0.3, shape: 'sci_small', style: 'thermo', rad: 0.03, science: 'thermo', desc: "Mesure la température. Fonctionne partout." });
sci({ id: 'sci_baro', name: 'Baromètre', tech: 'propulsion', cost: 350, mass: 5, d: 0.15, h: 0.3, shape: 'sci_small', style: 'baro', rad: 0.03, science: 'baro', desc: "Mesure la pression atmosphérique (en vol dans l'atmosphère ou posé)." });
sci({ id: 'sci_goo', name: 'Capsule d\'échantillons', tech: 'electricite', cost: 800, mass: 50, d: 0.45, h: 0.45, shape: 'sci_goo', style: 'goo', rad: 0.2, science: 'goo', desc: "Observe le comportement d'un fluide inconnu. Partout." });
sci({ id: 'sci_spectro', name: 'Spectromètre orbital', tech: 'science_avancee', cost: 2500, mass: 90, d: 0.5, h: 0.6, shape: 'sci_spectro', style: 'spectro', rad: 0.15, science: 'spectro', desc: "Cartographie la composition d'un astre depuis l'espace." });
sci({ id: 'sci_seismo', name: 'Sismomètre', tech: 'science_avancee', cost: 1800, mass: 60, d: 0.4, h: 0.35, shape: 'sci_seismo', style: 'gold', rad: 0.12, science: 'seismo', desc: "Écoute les séismes. Uniquement posé au sol." });
sci({ id: 'sci_drill', name: 'Carottier', tech: 'science_avancee', cost: 4000, mass: 250, d: 0.5, h: 1.2, shape: 'sci_drill', style: 'drill', rad: 0.2, science: 'drill', desc: "Fore le sol et analyse le sous-sol. Uniquement posé." });
add({
  id: 'sci_lab', name: 'Laboratoire orbital', cat: 'science', tech: 'science_avancee', cost: 9000, mass: 3500, d: 2.5, h: 2.8,
  shape: 'hab', style: 'lab', science: 'lab', res: { ec: 100 }, attach: { top: true, bottom: true, surface: true }, maxTemp: 1300, crash: 8,
  desc: "Laboratoire complet : double la science de toutes les expériences du vaisseau.",
});
add({
  id: 'ant_whip', name: 'Antenne fouet', cat: 'science', tech: 'base', cost: 200, mass: 10, d: 0.1, h: 1.0,
  shape: 'antenna', style: 'grey', radial: true, rad: 0.02, antenna: { range: 1 }, attach: { radialOnly: true }, maxTemp: 1400, crash: 7,
  desc: "Transmet la science depuis l'orbite terrestre et la Lune.",
});
add({
  id: 'ant_dish', name: 'Parabole moyenne', cat: 'science', tech: 'communication', cost: 1500, mass: 60, d: 0.9, h: 0.6,
  shape: 'dish', style: 'dish', radial: true, rad: 0.1, antenna: { range: 2, deploy: true }, attach: { radialOnly: true }, maxTemp: 1300, crash: 7,
  desc: "Parabole dépliable : transmission depuis tout le système solaire intérieur.",
});
add({
  id: 'ant_deep', name: 'Grande antenne profonde', cat: 'science', tech: 'communication', cost: 5000, mass: 200, d: 2.4, h: 1.2,
  shape: 'dish', style: 'dish', radial: true, rad: 0.2, antenna: { range: 3, deploy: true }, attach: { radialOnly: true }, maxTemp: 1300, crash: 7,
  desc: "Antenne de l'espace lointain : transmission depuis n'importe où, jusqu'à Nyx.",
});

// ---------------------------------------------------------------------------
// TECHNOLOGIES SPÉCIALES (protections pour atteindre certains astres)
add({
  id: 'spec_pressure', name: 'Coque pressurisée', cat: 'special', tech: 'coque_pressurisee', cost: 18000, mass: 1800,
  d: 2.5, h: 1.0, shape: 'special_ring', style: 'pressure', special: 'pressure',
  attach: { top: true, bottom: true, surface: true }, maxTemp: 2400, crash: 20,
  desc: "Renforts en titane et refroidissement actif : protège tout le vaisseau de l'écrasante pression de Vénus.",
});
add({
  id: 'spec_radiation', name: 'Blindage anti-radiations', cat: 'special', tech: 'blindage_radiations', cost: 16000, mass: 1200,
  d: 2.5, h: 0.8, shape: 'special_ring', style: 'radiation', special: 'radiation',
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1800, crash: 12,
  desc: "Coffre en tantale et champ magnétique : l'électronique survit aux ceintures de Jupiter (Io, Europe, Ganymède).",
});
add({
  id: 'spec_cryo', name: 'Isolation cryogénique', cat: 'special', tech: 'isolation_cryo', cost: 14000, mass: 900,
  d: 2.5, h: 0.8, shape: 'special_ring', style: 'cryo', special: 'cryo',
  attach: { top: true, bottom: true, surface: true }, maxTemp: 1600, crash: 12,
  desc: "Chauffage radio-isotopique et aérogel : se poser à -200 °C sur Titan, Triton, Pluton, Nyx…",
});
add({
  id: 'spec_solar', name: 'Bouclier solaire', cat: 'special', tech: 'bouclier_solaire', cost: 15000, mass: 1100,
  d: 3.2, h: 0.5, shape: 'sunshield', style: 'sunshield', special: 'solar',
  attach: { top: true, bottom: true, surface: false }, maxTemp: 3000, crash: 10,
  desc: "Écran de céramique réfléchissante : survit au rayonnement intense près de Mercure et du Soleil.",
});

export const PARTS = P;
export const PART_BY_ID = Object.fromEntries(P.map((p) => [p.id, p]));

// Rayon de la surface d'une pièce à une hauteur locale y (de -h/2 à +h/2)
export function partRadiusAt(def, yLocal, flip = false) {
  const t = Math.min(1, Math.max(0, (flip ? -yLocal : yLocal) / def.h + 0.5));
  const d0 = def.d;
  const d1 = def.dTop ?? def.d;
  if (def.shape === 'capsule') {
    // profil conique légèrement bombé
    return (d0 + (d1 - d0) * Math.pow(t, 0.85)) / 2;
  }
  if (def.shape === 'engine' || def.shape === 'srb') return d0 / 2;
  return (d0 + (d1 - d0) * t) / 2;
}

// Diamètres aux nœuds haut / bas en tenant compte du retournement
export function nodeDiameters(def, flip) {
  const top = def.dTop ?? def.d;
  const bottom = def.d;
  return flip ? { top: bottom, bottom: top } : { top, bottom };
}

export function isStackable(def) {
  return !def.radial || (def.attach && (def.attach.top || def.attach.bottom));
}
