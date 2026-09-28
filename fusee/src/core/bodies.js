// Système solaire du jeu : le Soleil, 9 planètes (dont une hypothétique),
// et 14 lunes/astres. Les tailles sont réduites (~1/10 du réel) et les
// distances suivent les vraies proportions (1 UA = 13,6 millions de km) pour
// garder un jeu jouable, comme dans les simulateurs du genre.

import { Orbit } from './orbit.js';
import { DEG } from './math.js';
import { Terrain } from './terrain.js';

const AU = 13.6e9;

// hazards :
//   radiation  : rayon (m) sous lequel l'électronique grille sans blindage
//   pressure   : pression (atm) au-delà de laquelle la coque est écrasée sans coque pressurisée
//   cryo       : surface glaciale (atterrissage impossible sans isolation cryogénique)
//   gas        : géante gazeuse (pas de surface, écrasement sous l'altitude 0)
//   star       : étoile
const DEFS = [
  {
    id: 'soleil', name: 'Soleil', type: 'star', parent: null,
    radius: 65.6e6, mu: 1.1723e18, rotPeriod: 2.2e6,
    color: '#ffd27a', desc: "L'étoile du système. Sa chaleur fait fondre tout vaisseau qui s'approche trop près sans bouclier solaire.",
    hazards: { star: true },
  },
  {
    id: 'mercure', name: 'Mercure', type: 'planet', parent: 'soleil',
    a: 0.387 * AU, e: 0.2056, argPe: 77 * DEG, M0: 1.2,
    radius: 230e3, g: 3.7, rotPeriod: 58.6 * 21600,
    color: '#9c8f86', desc: "Petite planète brûlante et criblée de cratères. Le rayonnement solaire y est si intense qu'un bouclier solaire est indispensable.",
    terrain: { kind: 'cratered', amp: 3200, seed: 11, craterDensity: 0.55, craterFreq: 2.4 },
    hazards: { solarHeat: true },
    tech: 'bouclier_solaire',
  },
  {
    id: 'venus', name: 'Vénus', type: 'planet', parent: 'soleil',
    a: 0.723 * AU, e: 0.0068, argPe: 131 * DEG, M0: 3.1,
    radius: 570e3, g: 8.87, rotPeriod: -2.4e6,
    atmosphere: { height: 145e3, H: 9500, rho0: 65, p0: 92, sound: 410, temp: 737, rayleigh: [0.9, 0.62, 0.22], mie: 0.035, mieG: 0.8, density: 3.2, sky: '#d9a35c', fog: '#b98a4f' },
    color: '#e8c98a', desc: "Enfer volcanique sous 92 atmosphères de gaz carbonique et de nuages d'acide. Seule une coque pressurisée résiste à la descente.",
    terrain: { kind: 'volcanic', amp: 2600, seed: 23 },
    hazards: { pressure: 12 },
    tech: 'coque_pressurisee',
  },
  {
    id: 'terre', name: 'Terre', type: 'planet', parent: 'soleil',
    a: 1.0 * AU, e: 0.0167, argPe: 102 * DEG, M0: 0,
    radius: 600e3, g: 9.81, rotPeriod: 21600, rot0: 0,
    atmosphere: { height: 70e3, H: 5600, rho0: 1.225, p0: 1, sound: 340, temp: 288, rayleigh: [0.18, 0.42, 1.0], mie: 0.012, mieG: 0.76, density: 1.0, sky: '#6fa8ff', fog: '#a9c7ee', clouds: true },
    color: '#4c8df6', desc: "Notre planète natale et la base de lancement. Océans, continents, nuages et lumières des villes.",
    terrain: { kind: 'earth', amp: 5200, seed: 3 },
    ocean: true,
  },
  {
    id: 'lune', name: 'Lune', type: 'moon', parent: 'terre',
    a: 36e6, e: 0.0549, argPe: 0, M0: 2.0,
    radius: 164e3, g: 1.62, tidalLock: true,
    color: '#b8b5ae', desc: "Premier objectif de toute agence spatiale : mers basaltiques, hauts plateaux et cratères.",
    terrain: { kind: 'moon', amp: 4200, seed: 41, craterDensity: 0.5, craterFreq: 3.0 },
  },
  {
    id: 'mars', name: 'Mars', type: 'planet', parent: 'soleil',
    a: 1.524 * AU, e: 0.0934, argPe: 336 * DEG, M0: 4.4,
    radius: 320e3, g: 3.71, rotPeriod: 22200,
    atmosphere: { height: 50e3, H: 7000, rho0: 0.03, p0: 0.02, sound: 240, temp: 210, rayleigh: [0.75, 0.42, 0.22], mie: 0.05, mieG: 0.8, density: 0.55, sky: '#d4a07a', fog: '#c89a78' },
    color: '#d0643a', desc: "La planète rouge : canyons, calottes polaires et Olympus Mons, le plus grand volcan du système. Atmosphère ténue : prévoyez de grands parachutes.",
    terrain: { kind: 'mars', amp: 6000, seed: 67 },
  },
  {
    id: 'phobos', name: 'Phobos', type: 'moon', parent: 'mars',
    a: 1.6e6, e: 0.015, argPe: 0, M0: 0.4,
    radius: 7000, g: 0.12, tidalLock: true,
    color: '#7d726a', desc: "Minuscule lune en forme de patate, marquée par le cratère Stickney.",
    terrain: { kind: 'potato', amp: 2200, seed: 71 },
  },
  {
    id: 'deimos', name: 'Déimos', type: 'moon', parent: 'mars',
    a: 3.2e6, e: 0.0003, argPe: 0, M0: 3.3,
    radius: 5000, g: 0.08, tidalLock: true,
    color: '#9a8f82', desc: "La plus petite et la plus lointaine des lunes martiennes, couverte de régolithe lisse.",
    terrain: { kind: 'potato', amp: 1400, seed: 73 },
  },
  {
    id: 'ceres', name: 'Cérès', type: 'dwarf', parent: 'soleil',
    a: 2.77 * AU, e: 0.076, argPe: 73 * DEG, M0: 5.6,
    radius: 45e3, g: 0.28, rotPeriod: 32400,
    color: '#8d8a86', desc: "Planète naine de la ceinture d'astéroïdes, avec ses mystérieuses taches brillantes de sel.",
    terrain: { kind: 'ceres', amp: 2200, seed: 97, craterDensity: 0.45, craterFreq: 2.2 },
  },
  {
    id: 'jupiter', name: 'Jupiter', type: 'gas', parent: 'soleil',
    a: 5.2 * AU, e: 0.0489, argPe: 14 * DEG, M0: 0.7,
    radius: 6.585e6, g: 24.79, rotPeriod: 8910,
    atmosphere: { height: 420e3, H: 30000, rho0: 0.16, p0: 1, sound: 1100, temp: 165, rayleigh: [0.6, 0.55, 0.45], mie: 0.02, mieG: 0.7, density: 0.9, sky: '#c9a77e', fog: '#b8946a' },
    color: '#d8b48a', desc: "La géante gazeuse. Aucune surface : toute sonde qui plonge trop profond est écrasée. Ses ceintures de radiations détruisent l'électronique non blindée.",
    hazards: { gas: true, radiation: 118e6 },
    rings: { inner: 1.3, outer: 1.5, opacity: 0.08, color: '#8a7a6a' },
  },
  {
    id: 'io', name: 'Io', type: 'moon', parent: 'jupiter',
    a: 39.7e6, e: 0.0041, argPe: 0, M0: 1.1,
    radius: 171e3, g: 1.796, tidalLock: true,
    color: '#e4cf58', desc: "Le monde le plus volcanique du système : soufre jaune, lacs de lave et panaches géants.",
    terrain: { kind: 'io', amp: 3500, seed: 131 },
    hazards: { radiationLocal: true },
    tech: 'blindage_radiations',
  },
  {
    id: 'europe', name: 'Europe', type: 'moon', parent: 'jupiter',
    a: 63.2e6, e: 0.009, argPe: 0, M0: 2.5,
    radius: 147e3, g: 1.315, tidalLock: true,
    color: '#d8cdb6', desc: "Une croûte de glace striée cachant un océan d'eau liquide. Candidate idéale pour la recherche de vie.",
    terrain: { kind: 'europa', amp: 700, seed: 137 },
    tech: 'blindage_radiations',
  },
  {
    id: 'ganymede', name: 'Ganymède', type: 'moon', parent: 'jupiter',
    a: 100.8e6, e: 0.0013, argPe: 0, M0: 4.2,
    radius: 248e3, g: 1.428, tidalLock: true,
    color: '#9d9384', desc: "La plus grande lune du système, mélange de terrains sombres anciens et de sillons clairs.",
    terrain: { kind: 'ganymede', amp: 2200, seed: 139, craterDensity: 0.35, craterFreq: 2.0 },
    tech: 'blindage_radiations',
  },
  {
    id: 'callisto', name: 'Callisto', type: 'moon', parent: 'jupiter',
    a: 177e6, e: 0.0074, argPe: 0, M0: 5.5,
    radius: 227e3, g: 1.235, tidalLock: true,
    color: '#6f675e', desc: "Lune sombre et saturée de cratères, hors des ceintures de radiations les plus violentes.",
    terrain: { kind: 'cratered', amp: 2600, seed: 149, craterDensity: 0.7, craterFreq: 2.6 },
  },
  {
    id: 'saturne', name: 'Saturne', type: 'gas', parent: 'soleil',
    a: 9.58 * AU, e: 0.0565, argPe: 92 * DEG, M0: 2.9,
    radius: 5.485e6, g: 10.44, rotPeriod: 9630,
    atmosphere: { height: 380e3, H: 35000, rho0: 0.19, p0: 1, sound: 800, temp: 134, rayleigh: [0.7, 0.62, 0.45], mie: 0.02, mieG: 0.7, density: 0.9, sky: '#d8c08e', fog: '#c8ae7a' },
    color: '#e3cf95', desc: "Le joyau du système et ses anneaux de glace. Géante gazeuse sans surface.",
    hazards: { gas: true },
    rings: { inner: 1.24, outer: 2.27, opacity: 0.85, color: '#d9c7a0' },
  },
  {
    id: 'encelade', name: 'Encelade', type: 'moon', parent: 'saturne',
    a: 30e6, e: 0.0047, argPe: 0, M0: 0.9,
    radius: 40e3, g: 0.2, tidalLock: true,
    color: '#f2f6fa', desc: "Petite lune d'une blancheur éclatante, dont les geysers de glace jaillissent du pôle sud.",
    terrain: { kind: 'enceladus', amp: 1500, seed: 157 },
    hazards: { cryo: true },
    tech: 'isolation_cryo',
  },
  {
    id: 'titan', name: 'Titan', type: 'moon', parent: 'saturne',
    a: 111.3e6, e: 0.0288, argPe: 0, M0: 3.7,
    radius: 242.6e3, g: 1.352, tidalLock: true,
    atmosphere: { height: 220e3, H: 21000, rho0: 5.3, p0: 1.45, sound: 195, temp: 94, rayleigh: [0.9, 0.5, 0.15], mie: 0.06, mieG: 0.75, density: 2.2, sky: '#d39245', fog: '#b77a36' },
    color: '#d9a04a', desc: "Lune à l'atmosphère épaisse et orangée, avec des lacs de méthane liquide. Il y fait -180 °C : isolation cryogénique requise.",
    terrain: { kind: 'titan', amp: 900, seed: 163 },
    hazards: { cryo: true },
    liquid: true,
    tech: 'isolation_cryo',
  },
  {
    id: 'uranus', name: 'Uranus', type: 'gas', parent: 'soleil',
    a: 19.2 * AU, e: 0.0457, argPe: 170 * DEG, M0: 4.9,
    radius: 2.389e6, g: 8.69, rotPeriod: -15480,
    atmosphere: { height: 300e3, H: 28000, rho0: 0.42, p0: 1, sound: 900, temp: 76, rayleigh: [0.35, 0.85, 0.95], mie: 0.01, mieG: 0.7, density: 0.9, sky: '#9ee0e8', fog: '#7fc6d0' },
    color: '#9fdfe6', desc: "Géante de glace couchée sur le côté, d'un bleu-vert laiteux.",
    hazards: { gas: true },
    rings: { inner: 1.6, outer: 2.05, opacity: 0.25, color: '#9aa4aa' },
  },
  {
    id: 'titania', name: 'Titania', type: 'moon', parent: 'uranus',
    a: 40.8e6, e: 0.0011, argPe: 0, M0: 1.8,
    radius: 74e3, g: 0.379, tidalLock: true,
    color: '#a39d98', desc: "Plus grande lune d'Uranus, glacée et parcourue de canyons.",
    terrain: { kind: 'cratered', amp: 2000, seed: 173, craterDensity: 0.5, craterFreq: 2.4 },
    hazards: { cryo: true },
    tech: 'isolation_cryo',
  },
  {
    id: 'neptune', name: 'Neptune', type: 'gas', parent: 'soleil',
    a: 30.07 * AU, e: 0.0086, argPe: 44 * DEG, M0: 1.5,
    radius: 2.319e6, g: 11.15, rotPeriod: 14490,
    atmosphere: { height: 300e3, H: 26000, rho0: 0.45, p0: 1, sound: 950, temp: 72, rayleigh: [0.15, 0.35, 1.0], mie: 0.01, mieG: 0.7, density: 0.9, sky: '#4a78e0', fog: '#3a60c0' },
    color: '#3f6fe0', desc: "Géante de glace d'un bleu profond, balayée par les vents les plus rapides du système.",
    hazards: { gas: true },
    rings: { inner: 1.7, outer: 2.55, opacity: 0.12, color: '#8088a0' },
  },
  {
    id: 'triton', name: 'Triton', type: 'moon', parent: 'neptune',
    a: 33.2e6, e: 0.00002, argPe: 0, M0: 2.2, dir: -1,
    radius: 127e3, g: 0.779, tidalLock: true,
    color: '#d8c3bd', desc: "Lune capturée à l'orbite rétrograde, couverte de glace d'azote rosée et de geysers.",
    terrain: { kind: 'triton', amp: 1200, seed: 181 },
    hazards: { cryo: true },
    tech: 'isolation_cryo',
  },
  {
    id: 'pluton', name: 'Pluton', type: 'dwarf', parent: 'soleil',
    a: 39.48 * AU, e: 0.2488, argPe: 224 * DEG, M0: 0.3,
    radius: 112e3, g: 0.62, rotPeriod: -131000,
    color: '#cfb59a', desc: "Planète naine aux confins du système, célèbre pour son grand cœur de glace d'azote.",
    terrain: { kind: 'pluto', amp: 2500, seed: 191 },
    hazards: { cryo: true },
    tech: 'isolation_cryo',
  },
  {
    id: 'charon', name: 'Charon', type: 'moon', parent: 'pluton',
    a: 1.85e6, e: 0.0002, argPe: 0, M0: 0.8,
    radius: 57e3, g: 0.288, tidalLock: true,
    color: '#a09a96', desc: "Compagnon de Pluton, avec sa calotte polaire rougeâtre.",
    terrain: { kind: 'cratered', amp: 2400, seed: 193, craterDensity: 0.4, craterFreq: 2.2 },
    hazards: { cryo: true },
    tech: 'isolation_cryo',
  },
  {
    id: 'nyx', name: 'Nyx', type: 'planet', parent: 'soleil',
    a: 60 * AU, e: 0.12, argPe: 300 * DEG, M0: 2.4,
    radius: 280e3, g: 4.5, rotPeriod: 40000,
    atmosphere: { height: 40e3, H: 6000, rho0: 0.08, p0: 0.06, sound: 220, temp: 40, rayleigh: [0.45, 0.25, 1.0], mie: 0.02, mieG: 0.7, density: 0.6, sky: '#6a55c8', fog: '#4a3a90' },
    color: '#7b6cff', desc: "Neuvième planète hypothétique, un monde de glace violette parcouru d'aurores. Elle n'apparaît sur les cartes qu'après la découverte du télescope spatial profond.",
    terrain: { kind: 'nyx', amp: 3000, seed: 211 },
    hazards: { cryo: true },
    hidden: 'telescope_profond',
    tech: 'isolation_cryo',
  },
];

export class Body {
  constructor(def) {
    Object.assign(this, def);
    this.def = def;
    this.children = [];
    this.parentBody = null;
    this.orbit = null;
    if (!this.mu) this.mu = this.g * this.radius * this.radius;
    if (!this.g) this.g = this.mu / (this.radius * this.radius);
    this.atmosphere = def.atmosphere || null;
    this.hazards = def.hazards || {};
    this.soi = Infinity;
    this._t = NaN;
    this._s = { x: 0, y: 0, vx: 0, vy: 0 };
    this._lt = NaN;
    this._ls = { x: 0, y: 0, vx: 0, vy: 0, r: 0, nu: 0 };
  }

  get hasSurface() {
    return this.type !== 'gas' && this.type !== 'star';
  }

  // État relatif au parent
  localState(t) {
    if (!this.orbit) return this._ls;
    if (t !== this._lt) {
      this.orbit.stateAt(t, this._ls);
      this._lt = t;
    }
    return this._ls;
  }

  // État absolu (repère héliocentrique)
  state(t) {
    if (t === this._t) return this._s;
    const s = this._s;
    if (!this.parentBody) {
      s.x = s.y = s.vx = s.vy = 0;
    } else {
      const p = this.parentBody.state(t);
      const l = this.localState(t);
      s.x = p.x + l.x;
      s.y = p.y + l.y;
      s.vx = p.vx + l.vx;
      s.vy = p.vy + l.vy;
    }
    this._t = t;
    return s;
  }

  // Angle de rotation propre (longitude 0 du corps dans le repère inertiel)
  rotationAt(t) {
    if (this.tidalLock && this.orbit) {
      const l = this.localState(t);
      return Math.atan2(l.y, l.x) + Math.PI;
    }
    if (!this.rotPeriod) return 0;
    return (this.rot0 || 0) + ((t / this.rotPeriod) * Math.PI * 2) % (Math.PI * 2);
  }

  angularVelocity() {
    if (this.tidalLock && this.orbit) return (this.orbit.dir * Math.PI * 2) / this.orbit.period;
    if (!this.rotPeriod) return 0;
    return (Math.PI * 2) / this.rotPeriod;
  }

  // Densité de l'air (kg/m³) à une altitude donnée
  density(alt) {
    const a = this.atmosphere;
    if (!a || alt >= a.height) return 0;
    const f = alt > a.height * 0.85 ? (a.height - alt) / (a.height * 0.15) : 1;
    return a.rho0 * Math.exp(-Math.max(alt, -a.H * 2) / a.H) * f;
  }

  // Pression en atmosphères
  pressure(alt) {
    const a = this.atmosphere;
    if (!a || alt >= a.height) return 0;
    const f = alt > a.height * 0.85 ? (a.height - alt) / (a.height * 0.15) : 1;
    return a.p0 * Math.exp(-Math.max(alt, -a.H * 2) / a.H) * f;
  }

  speedOfSound() {
    return this.atmosphere ? this.atmosphere.sound : 300;
  }
}

export class SolarSystem {
  constructor() {
    this.bodies = DEFS.map((d) => new Body(d));
    this.byId = {};
    for (const b of this.bodies) this.byId[b.id] = b;
    for (const b of this.bodies) {
      if (b.parent) {
        const p = this.byId[b.parent];
        b.parentBody = p;
        p.children.push(b);
        b.orbit = Orbit.fromElements(p.mu, b.a, b.e, b.argPe, b.M0, 0, b.dir || 1);
        b.soi = b.a * Math.pow(b.mu / p.mu, 0.4);
      }
    }
    for (const b of this.bodies) b.ground = new Terrain(b.def);
    this.sun = this.byId.soleil;
    this.home = this.byId.terre;
  }

  get(id) {
    return this.byId[id];
  }

  // Corps dans lequel se trouve un point absolu (sphère d'influence la plus
  // profonde), en partant du Soleil.
  findSOI(x, y, t) {
    let b = this.sun;
    for (;;) {
      let next = null;
      for (const c of b.children) {
        const s = c.state(t);
        const dx = x - s.x, dy = y - s.y;
        if (dx * dx + dy * dy < c.soi * c.soi) { next = c; break; }
      }
      if (!next) return b;
      b = next;
    }
  }

  // Flux solaire relatif à celui reçu par la Terre (1 = orbite terrestre)
  solarFlux(x, y) {
    const r2 = x * x + y * y;
    return (AU * AU) / Math.max(r2, 1e14);
  }
}

export { AU };
