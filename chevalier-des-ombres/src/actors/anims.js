// Animations procédurales : cycles de marche/course par type de squelette et clips
// d'action à images clés (attaques, sorts, esquives, réactions, morts).
import { damp, smoothstep, clamp, lerp } from '../core/utils.js';

const PI = Math.PI;

// ---------- Postures de garde (bras) selon l'arme ----------
const STANCES = {
  '1h': { armR: [-0.3, 0.1, -0.18], foreR: [-0.95, 0, 0], handR: [0.2, 0, 0], armL: [-0.35, -0.2, 0.22], foreL: [-1.2, 0.3, 0], handL: [0, 0, 0] },
  '2h': { armR: [-0.55, 0.5, -0.05], foreR: [-1.0, 0, 0], handR: [0.1, 0, 0.5], armL: [-0.75, 0.2, 0.45], foreL: [-1.25, 0, 0], handL: [0, 0, 0] },
  polearm: { armR: [-0.2, 0.2, -0.2], foreR: [-1.35, 0, 0], handR: [0.9, 0, 0.1], armL: [-0.7, -0.1, 0.35], foreL: [-1.2, 0, 0], handL: [0, 0, 0] },
  dual: { armR: [-0.35, 0.1, -0.2], foreR: [-1.1, 0, 0], handR: [0.4, 0, 0], armL: [-0.35, -0.1, 0.2], foreL: [-1.1, 0, 0], handL: [0.4, 0, 0] },
  caster: { armR: [-0.15, 0, -0.25], foreR: [-0.5, 0, 0], handR: [0, 0, 0], armL: [-0.15, 0, 0.25], foreL: [-0.5, 0, 0], handL: [0, 0, 0] },
  staff: { armR: [-0.25, 0.2, -0.15], foreR: [-1.2, 0, 0], handR: [0.7, 0, 0], armL: [-0.15, 0, 0.25], foreL: [-0.6, 0, 0], handL: [0, 0, 0] },
  zombie: { armR: [-1.35, 0, -0.1], foreR: [-0.2, 0, 0], handR: [0, 0, 0], armL: [-1.3, 0, 0.1], foreL: [-0.25, 0, 0], handL: [0, 0, 0] },
  claws: { armR: [-0.5, 0, -0.35], foreR: [-0.9, 0, 0], handR: [0, 0, 0], armL: [-0.5, 0, 0.35], foreL: [-0.9, 0, 0], handL: [0, 0, 0] },
  brute: { armR: [-0.2, 0, -0.35], foreR: [-0.5, 0, 0], handR: [0, 0, 0], armL: [-0.2, 0, 0.35], foreL: [-0.5, 0, 0], handL: [0, 0, 0] },
  bow: { armR: [-0.2, 0, -0.2], foreR: [-0.6, 0, 0], handR: [0, 0, 0], armL: [-0.3, 0, 0.2], foreL: [-0.4, 0, 0], handL: [0, 0, 0] },
  none: { armR: [0.05, 0, -0.12], foreR: [-0.25, 0, 0], handR: [0, 0, 0], armL: [0.05, 0, 0.12], foreL: [-0.25, 0, 0], handL: [0, 0, 0] },
};

// ---------- Clips humanoïdes ----------
// keys : [t (0..1), pose]. rootY : décalage vertical du bassin. hit : fenêtre active.
export const H_CLIPS = {
  slashR: {
    dur: 0.62, hit: [0.3, 0.5], lunge: 0.6,
    keys: [
      [0, {}],
      [0.28, { chest: [0.05, -0.8, 0], spine: [0, -0.3, 0], armR: [-0.5, -0.5, -1.35], foreR: [-0.3, 0, 0], handR: [1.0, 0.6, 0], armL: [-0.3, 0, 0.4], rootY: -0.05 }],
      [0.48, { chest: [0.1, 0.6, 0], spine: [0, 0.3, 0], armR: [-0.15, 1.5, -1.45], foreR: [-0.1, 0, 0], handR: [1.1, 0.6, 0], armL: [-0.2, 0, 0.5], rootY: -0.08 }],
      [0.75, { chest: [0.08, 0.5, 0], spine: [0, 0.2, 0], armR: [0.1, 2.1, -1.2], foreR: [-0.3, 0, 0], handR: [1.0, 0.6, 0], rootY: -0.05 }],
      [1, {}],
    ],
  },
  slashL: {
    dur: 0.6, hit: [0.3, 0.5], lunge: 0.6,
    keys: [
      [0, {}],
      [0.28, { chest: [0.05, 0.75, 0], spine: [0, 0.3, 0], armR: [-0.5, 2.3, -1.3], foreR: [-0.5, 0, 0], handR: [1.0, -0.6, 0], rootY: -0.04 }],
      [0.48, { chest: [0.1, -0.65, 0], spine: [0, -0.3, 0], armR: [-0.1, 0.6, -1.45], foreR: [-0.1, 0, 0], handR: [1.1, -0.6, 0], rootY: -0.08 }],
      [0.75, { chest: [0.05, -0.5, 0], armR: [0.1, -0.2, -1.3], foreR: [-0.3, 0, 0], handR: [1.0, -0.6, 0], rootY: -0.04 }],
      [1, {}],
    ],
  },
  overhead: {
    dur: 0.75, hit: [0.38, 0.55], lunge: 0.8,
    keys: [
      [0, {}],
      [0.32, { chest: [-0.25, -0.2, 0], spine: [-0.1, 0, 0], armR: [-2.9, 0, -0.2], foreR: [-0.9, 0, 0], handR: [0.4, 0, 0], armL: [-2.6, 0, 0.3], foreL: [-0.9, 0, 0], head: [-0.2, 0, 0], rootY: 0.02 }],
      [0.5, { chest: [0.45, 0, 0], spine: [0.25, 0, 0], armR: [-1.3, 0, -0.1], foreR: [-0.15, 0, 0], handR: [0.6, 0, 0], armL: [-1.1, 0, 0.2], foreL: [-0.3, 0, 0], head: [0.2, 0, 0], rootY: -0.18, thighL: [-0.6, 0, 0], shinL: [0.7, 0, 0], thighR: [0.3, 0, 0], shinR: [0.5, 0, 0] }],
      [0.78, { chest: [0.3, 0, 0], spine: [0.15, 0, 0], armR: [-1.0, 0, -0.1], foreR: [-0.3, 0, 0], handR: [0.6, 0, 0], rootY: -0.12, thighL: [-0.4, 0, 0], shinL: [0.5, 0, 0], thighR: [0.2, 0, 0], shinR: [0.4, 0, 0] }],
      [1, {}],
    ],
  },
  thrust: {
    dur: 0.55, hit: [0.3, 0.48], lunge: 1.1,
    keys: [
      [0, {}],
      [0.28, { chest: [0, -0.5, 0], armR: [-0.6, 0.1, -0.4], foreR: [-1.8, 0, 0], handR: [1.4, 0, 0], armL: [-0.6, 0, 0.5], rootY: -0.06, thighR: [0.3, 0, 0], thighL: [-0.3, 0, 0], shinL: [0.3, 0, 0] }],
      [0.45, { chest: [0.2, 0.35, 0], spine: [0.1, 0.1, 0], armR: [-1.55, 0, -0.05], foreR: [-0.05, 0, 0], handR: [1.5, 0, 0], armL: [0.2, 0, 0.5], rootY: -0.14, thighL: [-0.8, 0, 0], shinL: [0.8, 0, 0], thighR: [0.45, 0, 0], shinR: [0.2, 0, 0] }],
      [0.75, { chest: [0.15, 0.25, 0], armR: [-1.3, 0, -0.05], foreR: [-0.3, 0, 0], handR: [1.4, 0, 0], rootY: -0.1, thighL: [-0.5, 0, 0], shinL: [0.5, 0, 0], thighR: [0.3, 0, 0] }],
      [1, {}],
    ],
  },
  spin: {
    dur: 0.8, hit: [0.25, 0.65], lunge: 0.4, spin: true,
    keys: [
      [0, {}],
      [0.2, { chest: [0.1, -0.5, 0], armR: [-0.2, 0.6, -1.45], foreR: [-0.1, 0, 0], handR: [1.3, 0.5, 0], armL: [-0.2, -0.6, 1.4], rootY: -0.12 }],
      [0.65, { chest: [0.1, -0.3, 0], armR: [-0.2, 0.8, -1.5], foreR: [-0.05, 0, 0], handR: [1.35, 0.5, 0], armL: [-0.2, -0.6, 1.4], rootY: -0.15 }],
      [0.85, { chest: [0.1, 0.2, 0], armR: [-0.3, 1.2, -1.2], foreR: [-0.3, 0, 0], handR: [1.0, 0.4, 0], rootY: -0.08 }],
      [1, {}],
    ],
  },
  rising: {
    dur: 0.62, hit: [0.3, 0.5], lunge: 0.5,
    keys: [
      [0, {}],
      [0.28, { chest: [0.3, -0.4, 0], armR: [0.3, 0.2, -0.5], foreR: [-0.6, 0, 0], handR: [-0.6, 0, 0.3], rootY: -0.15, thighL: [-0.5, 0, 0], shinL: [0.8, 0, 0], shinR: [0.6, 0, 0] }],
      [0.5, { chest: [-0.25, 0.3, 0], armR: [-2.7, 0.2, -0.3], foreR: [-0.2, 0, 0], handR: [0.3, 0, 0], head: [-0.2, 0, 0], rootY: 0.04 }],
      [0.78, { chest: [-0.1, 0.2, 0], armR: [-2.2, 0, -0.3], foreR: [-0.4, 0, 0], rootY: 0 }],
      [1, {}],
    ],
  },
  sweep2h: {
    dur: 0.85, hit: [0.35, 0.58], lunge: 0.6,
    keys: [
      [0, {}],
      [0.3, { chest: [0.1, -1.0, 0], spine: [0, -0.4, 0], armR: [-0.4, -0.4, -1.3], foreR: [-0.4, 0, 0], handR: [1.1, 0.5, 0], armL: [-0.5, -0.1, -1.1], foreL: [-0.8, 0, 0], rootY: -0.1 }],
      [0.55, { chest: [0.15, 0.9, 0], spine: [0, 0.4, 0], armR: [-0.1, 1.7, -1.4], foreR: [-0.1, 0, 0], handR: [1.2, 0.5, 0], armL: [-0.1, 2.0, -1.2], foreL: [-0.5, 0, 0], rootY: -0.15 }],
      [0.8, { chest: [0.1, 0.7, 0], spine: [0, 0.3, 0], armR: [0.1, 2.2, -1.2], foreR: [-0.3, 0, 0], handR: [1.0, 0.5, 0], armL: [0.1, 2.4, -1.0], rootY: -0.1 }],
      [1, {}],
    ],
  },
  slam: {
    dur: 1.0, hit: [0.5, 0.62], lunge: 0.7,
    keys: [
      [0, {}],
      [0.42, { chest: [-0.35, 0, 0], spine: [-0.15, 0, 0], armR: [-3.0, 0.2, -0.1], foreR: [-0.6, 0, 0], handR: [0.2, 0, 0], armL: [-3.0, -0.2, 0.1], foreL: [-0.6, 0, 0], head: [-0.25, 0, 0], rootY: 0.05 }],
      [0.58, { chest: [0.6, 0, 0], spine: [0.3, 0, 0], armR: [-1.1, 0, -0.1], foreR: [-0.1, 0, 0], handR: [0.8, 0, 0], armL: [-1.1, 0, 0.1], foreL: [-0.1, 0, 0], head: [0.3, 0, 0], rootY: -0.3, thighL: [-0.8, 0, 0], shinL: [1.1, 0, 0], thighR: [0.2, 0, 0], shinR: [0.9, 0, 0] }],
      [0.85, { chest: [0.45, 0, 0], spine: [0.2, 0, 0], armR: [-1.0, 0, -0.1], foreR: [-0.2, 0, 0], handR: [0.8, 0, 0], armL: [-1.0, 0, 0.1], rootY: -0.22, thighL: [-0.6, 0, 0], shinL: [0.9, 0, 0], shinR: [0.7, 0, 0] }],
      [1, {}],
    ],
  },
  stab: {
    dur: 0.36, hit: [0.25, 0.5], lunge: 0.5,
    keys: [
      [0, {}],
      [0.25, { chest: [0, -0.4, 0], armR: [-0.5, 0, -0.3], foreR: [-1.6, 0, 0], handR: [1.3, 0, 0] }],
      [0.45, { chest: [0.15, 0.3, 0], armR: [-1.5, 0, 0], foreR: [-0.1, 0, 0], handR: [1.5, 0, 0], rootY: -0.06 }],
      [1, {}],
    ],
  },
  stabL: {
    dur: 0.36, hit: [0.25, 0.5], lunge: 0.5,
    keys: [
      [0, {}],
      [0.25, { chest: [0, 0.4, 0], armL: [-0.5, 0, 0.3], foreL: [-1.6, 0, 0], handL: [1.3, 0, 0] }],
      [0.45, { chest: [0.15, -0.3, 0], armL: [-1.5, 0, 0], foreL: [-0.1, 0, 0], handL: [1.5, 0, 0], rootY: -0.06 }],
      [1, {}],
    ],
  },
  claw: {
    dur: 0.55, hit: [0.3, 0.52], lunge: 0.7,
    keys: [
      [0, {}],
      [0.3, { chest: [-0.1, -0.5, 0], armR: [-2.4, 0, -0.6], foreR: [-0.8, 0, 0], armL: [-0.5, 0, 0.4], rootY: -0.05 }],
      [0.5, { chest: [0.35, 0.4, 0], spine: [0.15, 0, 0], armR: [-0.9, 0, 0.3], foreR: [-0.2, 0, 0], rootY: -0.15 }],
      [1, {}],
    ],
  },
  clawL: {
    dur: 0.55, hit: [0.3, 0.52], lunge: 0.7,
    keys: [
      [0, {}],
      [0.3, { chest: [-0.1, 0.5, 0], armL: [-2.4, 0, 0.6], foreL: [-0.8, 0, 0], armR: [-0.5, 0, -0.4], rootY: -0.05 }],
      [0.5, { chest: [0.35, -0.4, 0], spine: [0.15, 0, 0], armL: [-0.9, 0, -0.3], foreL: [-0.2, 0, 0], rootY: -0.15 }],
      [1, {}],
    ],
  },
  bite: {
    dur: 0.5, hit: [0.35, 0.5], lunge: 0.8,
    keys: [
      [0, {}],
      [0.3, { chest: [-0.2, 0, 0], head: [-0.4, 0, 0], armR: [-0.8, 0, -0.5], armL: [-0.8, 0, 0.5] }],
      [0.5, { chest: [0.5, 0, 0], spine: [0.2, 0, 0], head: [0.3, 0, 0], armR: [-1.4, 0, -0.3], armL: [-1.4, 0, 0.3], rootY: -0.12 }],
      [1, {}],
    ],
  },
  cast: {
    dur: 0.7, hit: [0.45, 0.5],
    keys: [
      [0, {}],
      [0.35, { chest: [-0.1, 0.4, 0], armL: [-1.1, 0.2, 0.6], foreL: [-1.3, 0, 0], handL: [0.5, 0, 0], armR: [-0.2, 0, -0.4], rootY: -0.03 }],
      [0.5, { chest: [0.1, -0.2, 0], armL: [-1.55, 0, 0.1], foreL: [-0.05, 0, 0], handL: [-0.8, 0, 0], rootY: -0.06 }],
      [0.8, { chest: [0.05, -0.1, 0], armL: [-1.4, 0, 0.1], foreL: [-0.2, 0, 0], handL: [-0.6, 0, 0] }],
      [1, {}],
    ],
  },
  castUp: {
    dur: 1.0, hit: [0.55, 0.6],
    keys: [
      [0, {}],
      [0.45, { chest: [-0.3, 0, 0], head: [-0.4, 0, 0], armL: [-2.6, 0, 0.5], foreL: [-0.2, 0, 0], armR: [-2.6, 0, -0.5], foreR: [-0.2, 0, 0], rootY: 0.04 }],
      [0.6, { chest: [0.4, 0, 0], head: [0.2, 0, 0], armL: [-0.9, 0, 0.9], foreL: [0, 0, 0], armR: [-0.9, 0, -0.9], foreR: [0, 0, 0], rootY: -0.2, thighL: [-0.4, 0, 0], shinL: [0.6, 0, 0], shinR: [0.5, 0, 0] }],
      [0.85, { chest: [0.3, 0, 0], armL: [-0.8, 0, 0.8], armR: [-0.8, 0, -0.8], rootY: -0.12 }],
      [1, {}],
    ],
  },
  castAoe: {
    dur: 0.8, hit: [0.5, 0.55],
    keys: [
      [0, {}],
      [0.4, { chest: [-0.2, 0, 0], armL: [-0.4, 0, 1.4], foreL: [-0.4, 0, 0], armR: [-0.4, 0, -1.4], foreR: [-0.4, 0, 0], rootY: 0.02 }],
      [0.55, { chest: [0.5, 0, 0], armL: [0.2, 0, 1.2], foreL: [0, 0, 0], handL: [0, 0, 0.5], armR: [0.2, 0, -1.2], foreR: [0, 0, 0], handR: [0, 0, -0.5], rootY: -0.25, thighL: [-0.5, 0, 0], shinL: [0.8, 0, 0], shinR: [0.7, 0, 0] }],
      [0.85, { chest: [0.3, 0, 0], armL: [0.1, 0, 1.0], armR: [0.1, 0, -1.0], rootY: -0.15 }],
      [1, {}],
    ],
  },
  drink: {
    dur: 1.1,
    keys: [
      [0, {}],
      [0.3, { armL: [-1.2, 0, 0.3], foreL: [-2.0, 0, 0], handL: [0, 0, 0], head: [-0.4, 0, 0], chest: [-0.1, 0, 0] }],
      [0.7, { armL: [-1.4, 0, 0.2], foreL: [-2.1, 0, 0], head: [-0.5, 0, 0], chest: [-0.15, 0, 0] }],
      [1, {}],
    ],
  },
  // Roulades : corps en boule + rotation complète du bassin (rollAxis) — avant, arrière, côtés
  roll: {
    dur: 0.62, rollAxis: 'fwd', rollSpan: [0.1, 0.8],
    keys: [
      [0, {}],
      [0.12, { chest: [0.95, 0, 0], spine: [0.55, 0, 0], head: [0.7, 0, 0], armR: [-1.3, 0, -0.25], foreR: [-1.5, 0, 0], armL: [-1.3, 0, 0.25], foreL: [-1.6, 0, 0], thighL: [-2.0, 0, 0.1], shinL: [2.3, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], rootY: -0.5 }],
      [0.72, { chest: [0.95, 0, 0], spine: [0.55, 0, 0], head: [0.7, 0, 0], armR: [-1.3, 0, -0.25], foreR: [-1.5, 0, 0], armL: [-1.3, 0, 0.25], foreL: [-1.6, 0, 0], thighL: [-2.0, 0, 0.1], shinL: [2.3, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], rootY: -0.5 }],
      [0.9, { chest: [0.4, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.2, 0, 0], thighR: [-0.4, 0, 0], shinR: [1.0, 0, 0], rootY: -0.22 }],
      [1, {}],
    ],
    roll: true,
  },
  rollBack: {
    dur: 0.62, rollAxis: 'back', rollSpan: [0.1, 0.8],
    keys: [
      [0, {}],
      [0.12, { chest: [0.95, 0, 0], spine: [0.55, 0, 0], head: [0.7, 0, 0], armR: [-1.3, 0, -0.25], foreR: [-1.5, 0, 0], armL: [-1.3, 0, 0.25], foreL: [-1.6, 0, 0], thighL: [-2.0, 0, 0.1], shinL: [2.3, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], rootY: -0.5 }],
      [0.72, { chest: [0.95, 0, 0], spine: [0.55, 0, 0], head: [0.7, 0, 0], armR: [-1.3, 0, -0.25], foreR: [-1.5, 0, 0], armL: [-1.3, 0, 0.25], foreL: [-1.6, 0, 0], thighL: [-2.0, 0, 0.1], shinL: [2.3, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], rootY: -0.5 }],
      [0.9, { chest: [0.45, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.4, 0, 0], thighR: [-0.6, 0, 0], shinR: [1.3, 0, 0], rootY: -0.25 }],
      [1, {}],
    ],
    roll: true,
  },
  rollLeft: {
    dur: 0.56, rollAxis: 'left', rollSpan: [0.1, 0.8],
    keys: [
      [0, {}],
      [0.12, { chest: [0.95, 0, 0], spine: [0.55, 0, 0], head: [0.7, 0, 0], armR: [-1.3, 0, -0.25], foreR: [-1.5, 0, 0], armL: [-1.3, 0, 0.25], foreL: [-1.6, 0, 0], thighL: [-2.0, 0, 0.1], shinL: [2.3, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], rootY: -0.48 }],
      [0.72, { chest: [0.95, 0, 0], spine: [0.55, 0, 0], head: [0.7, 0, 0], armR: [-1.3, 0, -0.25], foreR: [-1.5, 0, 0], armL: [-1.3, 0, 0.25], foreL: [-1.6, 0, 0], thighL: [-2.0, 0, 0.1], shinL: [2.3, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], rootY: -0.48 }],
      [0.9, { chest: [0.35, 0, 0.2], thighL: [-0.8, 0, 0.3], shinL: [1.1, 0, 0], thighR: [-0.5, 0, 0], shinR: [1.2, 0, 0], rootY: -0.2 }],
      [1, {}],
    ],
    roll: true,
  },
  rollRight: {
    dur: 0.56, rollAxis: 'right', rollSpan: [0.1, 0.8],
    keys: [
      [0, {}],
      [0.12, { chest: [0.95, 0, 0], spine: [0.55, 0, 0], head: [0.7, 0, 0], armR: [-1.3, 0, -0.25], foreR: [-1.5, 0, 0], armL: [-1.3, 0, 0.25], foreL: [-1.6, 0, 0], thighL: [-2.0, 0, 0.1], shinL: [2.3, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], rootY: -0.48 }],
      [0.72, { chest: [0.95, 0, 0], spine: [0.55, 0, 0], head: [0.7, 0, 0], armR: [-1.3, 0, -0.25], foreR: [-1.5, 0, 0], armL: [-1.3, 0, 0.25], foreL: [-1.6, 0, 0], thighL: [-2.0, 0, 0.1], shinL: [2.3, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], rootY: -0.48 }],
      [0.9, { chest: [0.35, 0, -0.2], thighR: [-0.8, 0, -0.3], shinR: [1.1, 0, 0], thighL: [-0.5, 0, 0], shinL: [1.2, 0, 0], rootY: -0.2 }],
      [1, {}],
    ],
    roll: true,
  },
  // Bond arrière : petit saut, buste en retrait, bras écartés
  backstep: {
    dur: 0.45,
    keys: [
      [0, {}],
      [0.18, { chest: [-0.3, 0, 0], spine: [-0.1, 0, 0], head: [0.2, 0, 0], thighL: [-0.5, 0, 0.1], shinL: [0.9, 0, 0], thighR: [-0.3, 0, -0.1], shinR: [0.8, 0, 0], armL: [-0.2, 0, 0.6], armR: [-0.3, 0, -0.5], rootY: 0.12 }],
      [0.6, { chest: [0.25, 0, 0], thighL: [-0.8, 0, 0.1], shinL: [1.1, 0, 0], thighR: [0.2, 0, -0.1], shinR: [0.6, 0, 0], armL: [-0.3, 0, 0.4], armR: [-0.4, 0, -0.3], rootY: -0.18 }],
      [1, {}],
    ],
  },
  hit: {
    dur: 0.35,
    keys: [
      [0, {}],
      [0.25, { chest: [-0.35, 0.2, 0], head: [-0.3, 0.2, 0], armR: [0.3, 0, -0.5], armL: [0.3, 0, 0.5], rootY: -0.05 }],
      [1, {}],
    ],
  },
  stagger: {
    dur: 1.1,
    keys: [
      [0, {}],
      [0.15, { chest: [-0.5, 0.3, 0.1], spine: [-0.2, 0, 0], head: [-0.5, 0.3, 0], armR: [0.4, 0, -0.9], foreR: [-0.3, 0, 0], armL: [0.4, 0, 0.9], rootY: -0.1, thighL: [0.3, 0, 0], shinL: [0.4, 0, 0] }],
      [0.6, { chest: [0.4, 0, 0], spine: [0.3, 0, 0], head: [0.5, 0, 0], armR: [0.1, 0, -0.2], foreR: [-0.2, 0, 0], armL: [0.1, 0, 0.2], rootY: -0.25, thighL: [-0.6, 0, 0], shinL: [1.0, 0, 0], thighR: [-0.3, 0, 0], shinR: [0.8, 0, 0] }],
      [1, {}],
    ],
  },
  parry: {
    dur: 0.45,
    keys: [
      [0, {}],
      [0.2, { chest: [0, 0.3, 0], armR: [-1.9, 0.2, -0.2], foreR: [-0.9, 0, 0], handR: [0.4, 1.4, 0], armL: [-1.3, -0.3, 0.3], foreL: [-1.3, 0.3, 0] }],
      [0.5, { chest: [0, -0.2, 0], armR: [-1.4, 0, -0.4], foreR: [-0.8, 0, 0], handR: [0.4, 0.8, 0] }],
      [1, {}],
    ],
  },
  bashL: {
    dur: 0.5, hit: [0.3, 0.45], lunge: 0.9,
    keys: [
      [0, {}],
      [0.25, { chest: [0, 0.5, 0], armL: [-0.6, -0.3, 0.3], foreL: [-1.8, 0.3, 0] }],
      [0.4, { chest: [0.2, -0.4, 0], armL: [-1.5, -0.4, -0.1], foreL: [-1.3, 0.3, 0], rootY: -0.08 }],
      [1, {}],
    ],
  },
  roar: {
    dur: 1.4,
    keys: [
      [0, {}],
      [0.25, { chest: [-0.45, 0, 0], spine: [-0.15, 0, 0], head: [-0.6, 0, 0], armR: [-0.4, 0, -1.4], foreR: [-0.6, 0, 0], armL: [-0.4, 0, 1.4], foreL: [-0.6, 0, 0], rootY: 0.02 }],
      [0.8, { chest: [-0.5, 0, 0], spine: [-0.15, 0, 0], head: [-0.7, 0, 0], armR: [-0.5, 0, -1.5], foreR: [-0.7, 0, 0], armL: [-0.5, 0, 1.5], foreL: [-0.7, 0, 0], rootY: 0.02 }],
      [1, {}],
    ],
  },
  jumpAtk: {
    dur: 1.1, hit: [0.62, 0.74], lunge: 0,
    keys: [
      [0, {}],
      [0.2, { chest: [0.4, 0, 0], armR: [0.4, 0, -0.4], armL: [0.4, 0, 0.4], rootY: -0.25, thighL: [-0.8, 0, 0], shinL: [1.2, 0, 0], thighR: [-0.8, 0, 0], shinR: [1.2, 0, 0] }],
      [0.45, { chest: [-0.3, 0, 0], armR: [-3.0, 0, -0.2], foreR: [-0.5, 0, 0], armL: [-3.0, 0, 0.2], foreL: [-0.5, 0, 0], thighL: [-1.2, 0, 0], shinL: [1.6, 0, 0], thighR: [-0.6, 0, 0], shinR: [1.4, 0, 0] }],
      [0.66, { chest: [0.6, 0, 0], spine: [0.3, 0, 0], armR: [-1.1, 0, -0.1], foreR: [0, 0, 0], handR: [0.8, 0, 0], armL: [-1.1, 0, 0.1], rootY: -0.35, thighL: [-0.9, 0, 0], shinL: [1.3, 0, 0], thighR: [0.2, 0, 0], shinR: [1.1, 0, 0] }],
      [0.9, { chest: [0.4, 0, 0], armR: [-1.0, 0, -0.1], rootY: -0.25, thighL: [-0.6, 0, 0], shinL: [1.0, 0, 0], shinR: [0.8, 0, 0] }],
      [1, {}],
    ],
  },
  kick: {
    dur: 0.55, hit: [0.3, 0.45], lunge: 0.6,
    keys: [
      [0, {}],
      [0.25, { chest: [-0.2, 0, 0], thighR: [-1.2, 0, 0], shinR: [1.4, 0, 0], armR: [-0.3, 0, -0.6], armL: [-0.3, 0, 0.6] }],
      [0.4, { chest: [-0.35, 0, 0], thighR: [-1.5, 0, 0], shinR: [0.1, 0, 0], armR: [0, 0, -0.9], armL: [0, 0, 0.9] }],
      [1, {}],
    ],
  },
  bowShot: {
    dur: 0.9, hit: [0.7, 0.72],
    keys: [
      [0, {}],
      [0.3, { chest: [0, 0.9, 0], head: [0, -0.8, 0], armL: [-1.5, 0.9, 0], foreL: [0, 0, 0], armR: [-1.5, 0.8, -0.2], foreR: [-2.2, 0, 0] }],
      [0.68, { chest: [0, 0.9, 0], head: [0, -0.8, 0], armL: [-1.5, 0.9, 0], foreL: [0, 0, 0], armR: [-1.4, 1.2, -0.6], foreR: [-2.4, 0, 0] }],
      [0.8, { chest: [0, 0.9, 0], head: [0, -0.8, 0], armL: [-1.5, 0.9, 0], armR: [-1.2, 1.3, -1.0], foreR: [-1.0, 0, 0] }],
      [1, {}],
    ],
  },
  throw: {
    dur: 0.7, hit: [0.48, 0.5],
    keys: [
      [0, {}],
      [0.38, { chest: [-0.2, -0.6, 0], armR: [-2.8, 0, -0.6], foreR: [-1.4, 0, 0], armL: [-1.0, 0, 0.5] }],
      [0.52, { chest: [0.3, 0.5, 0], armR: [-1.2, 0, 0], foreR: [-0.1, 0, 0], armL: [0, 0, 0.4], rootY: -0.08 }],
      [1, {}],
    ],
  },
  die: {
    dur: 1.4, hold: true,
    keys: [
      [0, {}],
      [0.3, { chest: [-0.4, 0.2, 0], head: [-0.5, 0, 0], armR: [0.4, 0, -0.8], armL: [0.4, 0, 0.8], rootY: -0.2, thighL: [-0.4, 0, 0], shinL: [1.2, 0, 0], thighR: [-0.6, 0, 0], shinR: [1.4, 0, 0] }],
      [1, { chest: [0.3, 0, 0], head: [0.3, 0, 0], armR: [-0.5, 0, -1.2], armL: [-0.5, 0, 1.2], foreR: [-0.3, 0, 0], rootY: -0.75, thighL: [-1.4, 0, 0], shinL: [2.2, 0, 0], thighR: [-1.5, 0, 0], shinR: [2.3, 0, 0] }],
    ],
  },
  kneel: {
    dur: 1.5, hold: true,
    keys: [
      [0, {}],
      [1, { chest: [0.3, 0, 0], head: [0.4, 0, 0], armR: [-0.4, 0, -0.2], foreR: [-0.8, 0, 0], armL: [-0.3, 0, 0.3], foreL: [-1.2, 0, 0], rootY: -0.42, thighL: [-1.4, 0, 0], shinL: [1.5, 0, 0], thighR: [0.1, 0, 0], shinR: [1.6, 0, 0] }],
    ],
  },
  pray: {
    dur: 2, hold: true,
    keys: [
      [0, {}],
      [1, { chest: [0.2, 0, 0], head: [0.4, 0, 0], armR: [-0.9, -0.5, -0.1], foreR: [-1.4, 0, 0], armL: [-0.9, 0.5, 0.1], foreL: [-1.4, 0, 0], rootY: -0.42, thighL: [-1.5, 0, 0], shinL: [1.6, 0, 0], thighR: [0.1, 0, 0], shinR: [1.6, 0, 0] }],
    ],
  },
  // ---------- Déplacements et esquives ----------
  sidestepL: {
    dur: 0.34,
    keys: [
      [0, {}],
      [0.3, { chest: [0.1, 0, 0.25], spine: [0, 0, 0.1], rootY: -0.14, thighL: [-0.3, 0, 0.4], shinL: [0.5, 0, 0], thighR: [-0.1, 0, 0.25], shinR: [0.7, 0, 0], armL: [-0.3, 0, 0.7], armR: [-0.4, 0, -0.3] }],
      [1, {}],
    ],
  },
  sidestepR: {
    dur: 0.34,
    keys: [
      [0, {}],
      [0.3, { chest: [0.1, 0, -0.25], spine: [0, 0, -0.1], rootY: -0.14, thighR: [-0.3, 0, -0.4], shinR: [0.5, 0, 0], thighL: [-0.1, 0, -0.25], shinL: [0.7, 0, 0], armR: [-0.3, 0, -0.7], armL: [-0.4, 0, 0.3] }],
      [1, {}],
    ],
  },
  slide: {
    dur: 0.7,
    keys: [
      [0, {}],
      [0.15, { chest: [-0.4, 0, 0], spine: [-0.2, 0, 0], head: [0.35, 0, 0], rootY: -0.62, thighL: [-1.45, 0, 0.1], shinL: [0.25, 0, 0], thighR: [-0.35, 0, -0.1], shinR: [1.9, 0, 0], armL: [-0.2, 0, 1.1], foreL: [-0.3, 0, 0], armR: [0.3, 0, -0.6] }],
      [0.82, { chest: [-0.4, 0, 0], spine: [-0.2, 0, 0], head: [0.35, 0, 0], rootY: -0.6, thighL: [-1.45, 0, 0.1], shinL: [0.25, 0, 0], thighR: [-0.35, 0, -0.1], shinR: [1.9, 0, 0], armL: [-0.2, 0, 1.1], foreL: [-0.3, 0, 0], armR: [0.3, 0, -0.6] }],
      [1, {}],
    ],
  },
  dash: {
    dur: 0.3,
    keys: [
      [0, {}],
      [0.25, { chest: [0.55, 0, 0], spine: [0.25, 0, 0], head: [-0.3, 0, 0], armL: [0.6, 0, 0.3], armR: [0.5, 0, -0.3], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.1, 0, 0], thighR: [0.4, 0, 0], shinR: [0.5, 0, 0], rootY: -0.1 }],
      [0.85, { chest: [0.55, 0, 0], spine: [0.25, 0, 0], head: [-0.3, 0, 0], armL: [0.6, 0, 0.3], armR: [0.5, 0, -0.3], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.1, 0, 0], thighR: [0.4, 0, 0], shinR: [0.5, 0, 0], rootY: -0.1 }],
      [1, {}],
    ],
  },
  doubleJump: {
    dur: 0.55, flip: true,
    keys: [
      [0, {}],
      [0.3, { chest: [0.6, 0, 0], spine: [0.4, 0, 0], head: [0.4, 0, 0], thighL: [-1.9, 0, 0.1], shinL: [2.1, 0, 0], thighR: [-1.8, 0, -0.1], shinR: [2.1, 0, 0], armL: [-1.0, 0, 0.4], foreL: [-1.5, 0, 0], armR: [-1.0, 0, -0.4], foreR: [-1.5, 0, 0], rootY: 0.2 }],
      [0.75, { chest: [0.5, 0, 0], spine: [0.3, 0, 0], thighL: [-1.6, 0, 0.1], shinL: [1.9, 0, 0], thighR: [-1.5, 0, -0.1], shinR: [1.9, 0, 0], armL: [-0.8, 0, 0.4], foreL: [-1.2, 0, 0], armR: [-0.8, 0, -0.4], foreR: [-1.2, 0, 0], rootY: 0.15 }],
      [1, {}],
    ],
  },
  // ---------- Attaques spéciales ----------
  lungeSlash: {
    dur: 0.62, hit: [0.28, 0.5], lunge: 1.2,
    keys: [
      [0, {}],
      [0.22, { chest: [0.35, -0.7, 0], spine: [0.15, -0.3, 0], armR: [-0.3, -0.6, -1.3], foreR: [-0.4, 0, 0], handR: [1.0, 0.6, 0], armL: [0.3, 0, 0.6], rootY: -0.15, thighL: [-0.9, 0, 0], shinL: [0.9, 0, 0], thighR: [0.5, 0, 0], shinR: [0.4, 0, 0] }],
      [0.45, { chest: [0.3, 0.8, 0], spine: [0.1, 0.35, 0], armR: [-0.1, 1.9, -1.45], foreR: [-0.1, 0, 0], handR: [1.1, 0.6, 0], armL: [0.2, 0, 0.7], rootY: -0.2, thighL: [-1.0, 0, 0], shinL: [1.0, 0, 0], thighR: [0.6, 0, 0], shinR: [0.3, 0, 0] }],
      [0.8, { chest: [0.15, 0.6, 0], armR: [0.1, 2.2, -1.2], foreR: [-0.3, 0, 0], handR: [1.0, 0.6, 0], rootY: -0.1 }],
      [1, {}],
    ],
  },
  counter: {
    dur: 0.62, hit: [0.18, 0.55], lunge: 1.0, spin: true,
    keys: [
      [0, {}],
      [0.15, { chest: [0.2, -0.6, 0], armR: [-0.2, 0.5, -1.45], foreR: [-0.1, 0, 0], handR: [1.3, 0.5, 0], armL: [-0.2, -0.6, 1.4], rootY: -0.2, thighL: [-0.6, 0, 0], shinL: [0.8, 0, 0] }],
      [0.55, { chest: [-0.1, -0.2, 0], armR: [-0.9, 0.9, -1.2], foreR: [-0.1, 0, 0], handR: [1.2, 0.5, 0], armL: [-0.2, -0.6, 1.3], rootY: -0.05 }],
      [1, {}],
    ],
  },
  plunge: {
    dur: 0.4, hold: true,
    keys: [
      [0, {}],
      [0.45, { chest: [-0.3, 0, 0], armR: [-2.9, 0, -0.1], foreR: [-0.5, 0, 0], armL: [-2.8, 0, 0.1], foreL: [-0.5, 0, 0], thighL: [-1.4, 0, 0], shinL: [1.8, 0, 0], thighR: [-1.0, 0, 0], shinR: [1.6, 0, 0] }],
      [1, { chest: [0.5, 0, 0], spine: [0.3, 0, 0], armR: [-0.9, 0, -0.1], foreR: [-0.2, 0, 0], handR: [1.25, 0, 0], armL: [-0.9, 0, 0.1], foreL: [-0.3, 0, 0], thighL: [-1.2, 0, 0], shinL: [1.6, 0, 0], thighR: [-0.6, 0, 0], shinR: [1.4, 0, 0] }],
    ],
  },
  plungeLand: {
    dur: 0.55, hit: [0, 0.12],
    keys: [
      [0, { chest: [0.65, 0, 0], spine: [0.3, 0, 0], armR: [-1.0, 0, -0.1], foreR: [-0.1, 0, 0], handR: [1.3, 0, 0], armL: [-1.0, 0, 0.1], rootY: -0.42, thighL: [-1.0, 0, 0], shinL: [1.5, 0, 0], thighR: [0.3, 0, 0], shinR: [1.3, 0, 0] }],
      [0.55, { chest: [0.55, 0, 0], spine: [0.25, 0, 0], armR: [-1.0, 0, -0.1], foreR: [-0.1, 0, 0], handR: [1.2, 0, 0], armL: [-1.0, 0, 0.1], rootY: -0.35, thighL: [-0.9, 0, 0], shinL: [1.3, 0, 0], thighR: [0.3, 0, 0], shinR: [1.1, 0, 0] }],
      [1, {}],
    ],
  },
  chargeHold: {
    dur: 0.35, hold: true,
    keys: [
      [0, {}],
      [1, { chest: [-0.1, -0.9, 0], spine: [0, -0.4, 0], armR: [-0.6, -0.9, -1.0], foreR: [-0.9, 0, 0], handR: [0.9, 0.6, 0], armL: [-0.6, -0.5, 0.5], foreL: [-1.0, 0, 0], rootY: -0.18, thighL: [-0.5, 0, 0], shinL: [0.7, 0, 0], thighR: [0.35, 0, 0], shinR: [0.5, 0, 0] }],
    ],
  },
  artWhirl: {
    dur: 1.1, hit: [0.12, 0.88], hits: [[0.12, 0.36], [0.4, 0.62], [0.66, 0.88]], lunge: 0.7, spin: true, spinTurns: 2,
    keys: [
      [0, {}],
      [0.1, { chest: [0.15, -0.5, 0], armR: [-0.2, 0.6, -1.5], foreR: [-0.05, 0, 0], handR: [1.35, 0.5, 0], armL: [-0.2, -0.6, 1.4], rootY: -0.15 }],
      [0.88, { chest: [0.15, -0.4, 0], armR: [-0.2, 0.8, -1.5], foreR: [-0.05, 0, 0], handR: [1.35, 0.5, 0], armL: [-0.2, -0.6, 1.4], rootY: -0.18 }],
      [1, {}],
    ],
  },
  artPierce: {
    dur: 0.75, hit: [0.2, 0.62], lunge: 0,
    keys: [
      [0, {}],
      [0.18, { chest: [0.1, -0.6, 0], armR: [-0.6, 0.1, -0.4], foreR: [-1.8, 0, 0], handR: [1.4, 0, 0], armL: [-0.6, 0, 0.5], rootY: -0.12, thighR: [0.4, 0, 0], thighL: [-0.4, 0, 0], shinL: [0.4, 0, 0] }],
      [0.35, { chest: [0.35, 0.3, 0], spine: [0.15, 0.1, 0], armR: [-1.55, 0, -0.05], foreR: [-0.05, 0, 0], handR: [1.5, 0, 0], armL: [0.3, 0, 0.6], rootY: -0.22, thighL: [-1.0, 0, 0], shinL: [1.0, 0, 0], thighR: [0.6, 0, 0], shinR: [0.2, 0, 0] }],
      [0.7, { chest: [0.35, 0.3, 0], spine: [0.15, 0.1, 0], armR: [-1.55, 0, -0.05], foreR: [-0.05, 0, 0], handR: [1.5, 0, 0], armL: [0.3, 0, 0.6], rootY: -0.22, thighL: [-1.0, 0, 0], shinL: [1.0, 0, 0], thighR: [0.6, 0, 0], shinR: [0.2, 0, 0] }],
      [1, {}],
    ],
  },
  artFlurry: {
    dur: 1.0, hit: [0.08, 0.9], hits: [[0.08, 0.16], [0.22, 0.3], [0.36, 0.44], [0.5, 0.58], [0.64, 0.72], [0.8, 0.9]], lunge: 0.9,
    keys: [
      [0, {}],
      [0.12, { chest: [0.15, 0.3, 0], armR: [-1.5, 0, 0], foreR: [-0.1, 0, 0], handR: [1.5, 0, 0], armL: [-0.5, 0, 0.3], foreL: [-1.6, 0, 0], rootY: -0.1 }],
      [0.26, { chest: [0.15, -0.3, 0], armL: [-1.5, 0, 0], foreL: [-0.1, 0, 0], handL: [1.5, 0, 0], armR: [-0.5, 0, -0.3], foreR: [-1.6, 0, 0], rootY: -0.1 }],
      [0.4, { chest: [0.15, 0.3, 0], armR: [-1.5, 0, 0], foreR: [-0.1, 0, 0], handR: [1.5, 0, 0], armL: [-0.5, 0, 0.3], foreL: [-1.6, 0, 0], rootY: -0.12 }],
      [0.54, { chest: [0.15, -0.3, 0], armL: [-1.5, 0, 0], foreL: [-0.1, 0, 0], handL: [1.5, 0, 0], armR: [-0.5, 0, -0.3], foreR: [-1.6, 0, 0], rootY: -0.12 }],
      [0.68, { chest: [0.15, 0.3, 0], armR: [-1.5, 0, 0], foreR: [-0.1, 0, 0], handR: [1.5, 0, 0], armL: [-0.5, 0, 0.3], foreL: [-1.6, 0, 0], rootY: -0.14 }],
      [0.84, { chest: [0.3, 0.5, 0], spine: [0.1, 0.2, 0], armR: [-0.2, 1.8, -1.4], foreR: [-0.1, 0, 0], handR: [1.1, 0.6, 0], armL: [-1.5, 0, 0], foreL: [-0.1, 0, 0], handL: [1.5, 0, 0], rootY: -0.16 }],
      [1, {}],
    ],
  },
  execute: {
    dur: 1.3, hit: [0.3, 0.92], hits: [[0.3, 0.42], [0.8, 0.92]], lunge: 0,
    keys: [
      [0, {}],
      [0.3, { chest: [0.3, -0.4, 0], armR: [-1.5, 0, -0.05], foreR: [-0.05, 0, 0], handR: [1.5, 0, 0], armL: [-1.2, 0, 0.4], foreL: [-0.8, 0, 0], rootY: -0.2, thighL: [-0.9, 0, 0], shinL: [1.0, 0, 0], thighR: [0.5, 0, 0] }],
      [0.55, { chest: [0.4, -0.2, 0], armR: [-1.4, 0.1, -0.05], foreR: [-0.1, 0, 0], handR: [1.5, 0.3, 0], armL: [-1.2, 0, 0.4], foreL: [-0.8, 0, 0], rootY: -0.22, thighL: [-0.9, 0, 0], shinL: [1.0, 0, 0], thighR: [0.5, 0, 0] }],
      [0.7, { chest: [-0.25, 0.3, 0], armR: [-2.7, 0.4, -0.3], foreR: [-0.6, 0, 0], handR: [0.5, 0, 0], armL: [-2.4, 0, 0.3], foreL: [-0.8, 0, 0], rootY: -0.02 }],
      [0.86, { chest: [0.55, 0, 0], spine: [0.25, 0, 0], armR: [-1.1, 0, -0.1], foreR: [-0.1, 0, 0], handR: [0.8, 0, 0], armL: [-1.0, 0, 0.1], rootY: -0.28, thighL: [-0.8, 0, 0], shinL: [1.1, 0, 0], thighR: [0.2, 0, 0], shinR: [0.8, 0, 0] }],
      [1, {}],
    ],
  },
  hammer: {
    dur: 0.9, hit: [0.5, 0.52],
    keys: [
      [0, {}],
      [0.45, { chest: [-0.2, -0.2, 0], armR: [-2.6, 0, -0.3], foreR: [-0.8, 0, 0] }],
      [0.52, { chest: [0.3, 0.1, 0], armR: [-1.0, 0, -0.1], foreR: [-0.5, 0, 0], rootY: -0.06 }],
      [1, {}],
    ],
  },
};

// Pour les armes à deux mains, la main gauche accompagne la droite
function twoHandedFix(pose) {
  if (!pose.armR) return pose;
  const p = { ...pose };
  if (!p.armL) p.armL = [pose.armR[0] - 0.05, pose.armR[1] + 0.35, pose.armR[2] + 0.15];
  if (!p.foreL) p.foreL = [(pose.foreR ? pose.foreR[0] : -0.9) - 0.4, 0, 0];
  return p;
}

const H_BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];

function sampleClip(clip, t, twoH) {
  const keys = clip.keys;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i];
  const [t1, p1] = keys[i + 1];
  const k = smoothstep(0, 1, clamp((t - t0) / Math.max(1e-4, t1 - t0), 0, 1));
  const a = twoH ? twoHandedFix(p0) : p0;
  const b = twoH ? twoHandedFix(p1) : p1;
  return { a, b, k };
}

export class Animator {
  constructor(built, opts = {}) {
    this.rig = built.rig;
    this.b = built.bones;
    this.segments = built.segments || 0;
    this.count = built.count || 0;
    this.stance = opts.stance || 'none';
    this.twoHanded = opts.twoHanded || false;
    this.hunch = opts.hunch || 0;
    this.limp = opts.limp || 0;
    this.hover = opts.hover || 0;
    this.phase = Math.random() * 10;
    this.time = Math.random() * 10;
    this.action = null;
    this.hitT = 0;
    this.cur = {};
    this.speedScale = opts.speedScale || 1;
    this.capePhase = 0;
    this.rootOffset = 0;
    this.extraYaw = 0;
    this.flipAngle = 0;
    this.rollAngle = 0;
    this.rollAxis = 'x';
    this.lidOpen = 0;
    this.retarget = built.retarget || null;
    for (const name in this.b) this.cur[name] = [0, 0, 0];
  }

  play(name, speed = 1, clipOverride = null) {
    const clip = clipOverride || H_CLIPS[name];
    if (!clip && this.rig === 'humanoid') return null;
    this.action = { name, clip, t: 0, speed, dur: clip ? clip.dur : 0.6 };
    return this.action;
  }

  // Temps normalisé de l'action (0..1), -1 si aucune
  get actionT() {
    return this.action ? clamp(this.action.t / this.action.dur, 0, 1) : -1;
  }

  stop() {
    this.action = null;
  }

  hitReact() {
    this.hitT = 0.25;
  }

  _set(name, x, y, z, dt, lambda = 22) {
    const bone = this.b[name];
    if (!bone) return;
    const c = this.cur[name];
    if (lambda <= 0) {
      c[0] = x;
      c[1] = y;
      c[2] = z;
    } else {
      c[0] = damp(c[0], x, lambda, dt);
      c[1] = damp(c[1], y, lambda, dt);
      c[2] = damp(c[2], z, lambda, dt);
    }
    bone.rotation.set(c[0], c[1], c[2]);
  }

  update(dt, s) {
    this.time += dt;
    if (this.action) {
      this.action.t += dt * this.action.speed;
      if (this.action.t >= this.action.dur && !(this.action.clip && this.action.clip.hold)) this.action = null;
    }
    if (this.hitT > 0) this.hitT -= dt;
    switch (this.rig) {
      case 'humanoid':
        this._humanoid(dt, s);
        if (this.retarget) this.retarget.apply();
        return;
      case 'quad':
        return this._quad(dt, s);
      case 'spider':
        return this._spider(dt, s);
      case 'bat':
        return this._bat(dt, s);
      case 'blob':
        return this._blob(dt, s);
      case 'serpent':
        return this._serpent(dt, s);
      case 'wisp':
        return this._wisp(dt, s);
      case 'eye':
        return this._eye(dt, s);
      case 'tentacle':
        return this._tentacle(dt, s);
      case 'mimic':
        return this._mimic(dt, s);
      case 'dragon':
        return this._dragon(dt, s);
      default:
    }
  }

  // ---------- Humanoïde ----------
  _humanoid(dt, s) {
    const speed = s.speed || 0;
    const run = clamp(speed / 5.5, 0, 1.4);
    this.phase += dt * (speed > 0.1 ? 2.2 + speed * 1.15 : 0) * this.speedScale;
    const ph = this.phase;
    const sw = Math.sin(ph);
    const cw = Math.cos(ph);
    const st = STANCES[this.stance] || STANCES.none;
    const pose = {};
    for (const n of H_BONES) pose[n] = [0, 0, 0];
    let rootY = 0;
    // Respiration
    const breath = Math.sin(this.time * 2) * 0.02;
    pose.chest[0] = breath + this.hunch * 0.6;
    pose.spine[0] = this.hunch * 0.4;
    pose.head[0] = -this.hunch * 0.5;
    // Garde
    for (const k of ['armR', 'foreR', 'handR', 'armL', 'foreL', 'handL']) pose[k] = st[k].slice();
    if (s.blocking) {
      // Avant-bras gauche en travers de la poitrine : le bouclier couvre le torse, face à l'ennemi
      pose.armL = [-1.05, 0, 0.3];
      pose.foreL = [-0.7, 0, -1.45];
      pose.armR = [-0.9, 0.3, -0.2];
      pose.foreR = [-1.3, 0, 0];
      pose.handR = [0.1, 0, -0.9];
      pose.chest[0] += 0.12;
      rootY -= 0.06;
    }
    const hov = this.hover;
    if (hov) {
      // Flottement (spectres) : pas de cycle de marche
      rootY += Math.sin(this.time * 1.8) * 0.12;
      pose.thighL = [-0.3, 0, 0.05];
      pose.thighR = [-0.2, 0, -0.05];
      pose.shinL = [0.5, 0, 0];
      pose.shinR = [0.4, 0, 0];
      pose.chest[0] += 0.1 + run * 0.3;
      pose.armL[2] += Math.sin(this.time * 1.3) * 0.15;
      pose.armR[2] -= Math.sin(this.time * 1.3 + 1) * 0.15;
    } else if (speed > 0.1 && s.grounded !== false) {
      const amp = 0.35 + run * 0.35;
      pose.thighL[0] = -sw * amp - run * 0.1;
      pose.thighR[0] = sw * amp - run * 0.1;
      pose.shinL[0] = Math.max(0, cw) * (0.5 + run * 0.7) + 0.1;
      pose.shinR[0] = Math.max(0, -cw) * (0.5 + run * 0.7) + 0.1;
      pose.footL[0] = -Math.max(0, -sw) * 0.3;
      pose.footR[0] = -Math.max(0, sw) * 0.3;
      rootY += -Math.abs(Math.cos(ph)) * 0.05 * (0.5 + run) + 0.02;
      pose.hips[1] = sw * 0.12;
      pose.chest[1] = -sw * 0.18;
      pose.chest[0] += run * 0.18 + (s.sprint ? 0.15 : 0);
      if (this.limp) {
        pose.thighR[0] *= 0.5;
        rootY -= Math.max(0, sw) * 0.05 * this.limp;
      }
      // Balancement des bras (réduit en garde)
      const armSw = this.stance === 'none' || this.stance === 'caster' ? 0.5 + run * 0.5 : 0.15 + run * 0.25;
      if (!s.blocking) {
        pose.armL[0] += sw * armSw;
        pose.armR[0] -= sw * armSw * (this.stance === '2h' ? 0.3 : 1);
        if (s.sprint && this.stance !== '2h' && this.stance !== 'polearm') {
          pose.armR = [-0.3 - sw * 0.7, 0, -0.1];
          pose.foreR = [-1.3, 0, 0];
          pose.armL = [0.3 + -(-sw) * 0.7 - 0.6, 0, 0.1];
          pose.foreL = [-1.3, 0, 0];
        }
      }
    }
    // Déplacement furtif : accroupi, buste penché
    if (s.sneak && s.grounded !== false && !hov) {
      rootY -= 0.28;
      pose.chest[0] += 0.35;
      pose.spine[0] += 0.15;
      pose.head[0] -= 0.3;
      pose.thighL[0] = pose.thighL[0] * 0.7 - 0.75;
      pose.thighR[0] = pose.thighR[0] * 0.7 - 0.75;
      pose.shinL[0] = pose.shinL[0] * 0.6 + 1.05;
      pose.shinR[0] = pose.shinR[0] * 0.6 + 1.05;
      pose.footL[0] -= 0.25;
      pose.footR[0] -= 0.25;
    }
    if (s.grounded === false && !hov) {
      pose.thighL = [-0.9, 0, 0.1];
      pose.shinL = [1.2, 0, 0];
      pose.thighR = [-0.3, 0, -0.1];
      pose.shinR = [0.6, 0, 0];
      pose.armL[2] += 0.5;
      pose.armR[2] -= 0.5;
    }
    // Action (clip) par-dessus
    let lambda = 20;
    if (this.action && this.action.clip) {
      const clip = this.action.clip;
      const t = clamp(this.action.t / this.action.dur, 0, 1);
      const { a, b, k } = sampleClip(clip, t, this.twoHanded);
      for (const n of H_BONES) {
        const va = a[n];
        const vb = b[n];
        if (!va && !vb) continue;
        const base = pose[n];
        const A = va || base;
        const Bv = vb || base;
        pose[n] = [lerp(A[0], Bv[0], k), lerp(A[1], Bv[1], k), lerp(A[2], Bv[2], k)];
      }
      const ra = a.rootY ?? 0;
      const rbv = b.rootY ?? 0;
      rootY += lerp(ra, rbv, k);
      lambda = 32;
      this.extraYaw = clip.spin ? smoothstep(clip.hit[0] - 0.1, clip.hit[1], t) * Math.PI * 2 * (clip.spinTurns || 1) : 0;
      // Salto (double saut) : rotation complète du bassin
      if (clip.flip) this.flipAngle = smoothstep(0.08, 0.82, t) * Math.PI * 2;
      // Roulades : tour complet autour de l'axe latéral (avant/arrière) ou avant-arrière (côtés)
      if (clip.rollAxis) {
        const [r0, r1] = clip.rollSpan || [0.1, 0.8];
        const a = smoothstep(r0, r1, t) * Math.PI * 2;
        this.rollAngle = clip.rollAxis === 'back' || clip.rollAxis === 'left' ? -a : a;
        this.rollAxis = clip.rollAxis === 'fwd' || clip.rollAxis === 'back' ? 'x' : 'z';
      }
    }
    if (!this.action || !this.action.clip || !this.action.clip.flip) this.flipAngle = 0;
    if (!this.action || !this.action.clip || !this.action.clip.rollAxis) this.rollAngle = 0;
    if (!this.action) this.extraYaw = 0;
    // Réaction aux coups (additive)
    if (this.hitT > 0) {
      const h = Math.sin((this.hitT / 0.25) * PI);
      pose.chest[0] -= h * 0.3;
      pose.head[0] -= h * 0.25;
    }
    // Regard vers la cible
    if (s.lookYaw) pose.head[1] += clamp(s.lookYaw, -0.8, 0.8);
    for (const n of H_BONES) this._set(n, pose[n][0], pose[n][1], pose[n][2], dt, lambda);
    if (this.flipAngle) this.b.hips.rotation.x = this.cur.hips[0] + this.flipAngle;
    if (this.rollAngle) {
      if (this.rollAxis === 'x') this.b.hips.rotation.x = this.cur.hips[0] + this.rollAngle;
      else this.b.hips.rotation.z = this.cur.hips[2] + this.rollAngle;
    }
    const hips = this.b.hips;
    this.rootOffset = damp(this.rootOffset, rootY, 18, dt);
    hips.position.y = hips.userData.rest.y + this.rootOffset;
    // Cape : traîne derrière selon la vitesse
    if (this.b.cape1) {
      this.capePhase += dt * (2 + speed);
      const flow = clamp(speed / 7, 0, 1);
      const wave = Math.sin(this.capePhase) * (0.04 + flow * 0.12);
      const air = s.grounded === false ? 0.6 : 0;
      this._set('cape1', 0.12 + flow * 0.55 + air + wave, 0, 0, dt, 10);
      this._set('cape2', 0.1 + flow * 0.35 + wave * 1.5, 0, Math.sin(this.capePhase * 0.7) * 0.05, dt, 10);
      this._set('cape3', 0.08 + flow * 0.3 + wave * 2, 0, Math.sin(this.capePhase * 0.9) * 0.08, dt, 10);
    }
    if (this.b.wingL) {
      const flap = s.flying ? Math.sin(this.time * 9) * 0.7 : Math.sin(this.time * 1.5) * 0.08;
      const open = s.flying ? 0 : 0.9;
      this._set('wingL', 0.2, -0.4 - open * 0.5, flap - open * 0.3, dt, 30);
      this._set('wingR', 0.2, 0.4 + open * 0.5, -flap + open * 0.3, dt, 30);
      this._set('wingL2', 0, -0.2 - open * 0.8, flap * 0.6, dt, 30);
      this._set('wingR2', 0, 0.2 + open * 0.8, -flap * 0.6, dt, 30);
    }
    if (this.b.tail1) {
      const w = Math.sin(this.time * 2.2) * 0.3;
      this._set('tail1', -0.3, w, 0, dt, 10);
      this._set('tail2', 0.2, w * 1.3, 0, dt, 10);
      this._set('tail3', 0.2, w * 1.6, 0, dt, 10);
    }
  }

  // ---------- Quadrupède ----------
  _quad(dt, s) {
    const speed = s.speed || 0;
    const run = clamp(speed / 6, 0, 1.5);
    this.phase += dt * (speed > 0.1 ? 4 + speed * 1.3 : 0);
    const ph = this.phase;
    const amp = 0.25 + run * 0.35;
    const moving = speed > 0.1;
    const sw = moving ? Math.sin(ph) : 0;
    let body = [0, 0, 0];
    let chest = [0, 0, 0];
    let neck = [0.2, 0, 0];
    let head = [-0.2, 0, 0];
    let jaw = [0.05 + Math.max(0, Math.sin(this.time * 1.3)) * 0.05, 0, 0];
    const legs = {
      legFL: [-sw * amp, 0, 0], legFL2: [Math.max(0, Math.sin(ph + 0.8)) * amp, 0, 0],
      legBR: [-sw * amp, 0, 0], legBR2: [Math.max(0, Math.sin(ph + 0.8)) * amp, 0, 0],
      legFR: [sw * amp, 0, 0], legFR2: [Math.max(0, Math.sin(ph + PI + 0.8)) * amp, 0, 0],
      legBL: [sw * amp, 0, 0], legBL2: [Math.max(0, Math.sin(ph + PI + 0.8)) * amp, 0, 0],
    };
    let bodyY = moving ? Math.abs(Math.sin(ph)) * 0.04 * (1 + run) : Math.sin(this.time * 2) * 0.01;
    let lambda = 20;
    if (this.action) {
      const t = clamp(this.action.t / this.action.dur, 0, 1);
      const n = this.action.name;
      lambda = 30;
      if (n === 'bite' || n === 'attack') {
        const w = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
        const strike = t > 0.35 && t < 0.6 ? 1 : 0;
        neck = [0.2 - w * 0.2 + strike * 0.5, 0, 0];
        head = [-0.2 - w * 0.4 + strike * 0.3, 0, 0];
        jaw = [0.1 + w * 0.7 - strike * 0.6, 0, 0];
        body = [t < 0.4 ? w * 0.15 : -strike * 0.1, 0, 0];
      } else if (n === 'pounce' || n === 'leap') {
        const air = t > 0.25 && t < 0.8;
        body = [t < 0.25 ? 0.2 : air ? -0.3 : 0.1, 0, 0];
        for (const k in legs) legs[k] = air ? [k.includes('F') ? (k.endsWith('2') ? 0.2 : -1.0) : k.endsWith('2') ? 0.3 : 0.9, 0, 0] : t < 0.25 ? [k.endsWith('2') ? 0.8 : -0.5, 0, 0] : legs[k];
        jaw = [air ? 0.7 : 0.1, 0, 0];
        bodyY += t < 0.25 ? -0.12 : 0;
      } else if (n === 'howl' || n === 'roar') {
        const w = Math.sin(t * PI);
        neck = [-0.8 * w, 0, 0];
        head = [-0.6 * w, 0, 0];
        jaw = [0.6 * w, 0, 0];
        body = [-0.2 * w, 0, 0];
      } else if (n === 'breath' || n === 'spit') {
        const w = Math.sin(t * PI);
        neck = [0.1, 0, 0];
        head = [0.1, 0, 0];
        jaw = [0.8 * w, 0, 0];
        body = [0.1 * w, 0, 0];
      } else if (n === 'die') {
        body = [0, 0, Math.min(1, t * 2) * 1.4];
        for (const k in legs) legs[k] = [k.endsWith('2') ? 0.6 : -0.4, 0, 0];
        bodyY -= Math.min(1, t * 2) * 0.25;
        jaw = [0.4, 0, 0];
      }
    }
    if (this.hitT > 0) body[0] -= Math.sin((this.hitT / 0.25) * PI) * 0.2;
    this._set('body', body[0], body[1], body[2], dt, lambda);
    this._set('chest', chest[0], chest[1] + (moving ? sw * 0.05 : 0), chest[2], dt, lambda);
    this._set('neck', neck[0], (s.lookYaw || 0) * 0.5, 0, dt, lambda);
    this._set('head', head[0] + (moving ? Math.sin(ph * 2) * 0.05 : 0), (s.lookYaw || 0) * 0.5, 0, dt, lambda);
    this._set('jaw', jaw[0], 0, 0, dt, lambda);
    for (const k in legs) this._set(k, legs[k][0], legs[k][1], legs[k][2], dt, lambda);
    const wag = Math.sin(this.time * (moving ? 10 : 3)) * 0.4;
    this._set('tail1', 0.4 - run * 0.3, wag, 0, dt, 12);
    this._set('tail2', -0.2, wag * 1.3, 0, dt, 12);
    const bb = this.b.body;
    bb.position.y = bb.userData.rest.y + bodyY;
  }

  // ---------- Araignée ----------
  _spider(dt, s) {
    const speed = s.speed || 0;
    this.phase += dt * (speed > 0.1 ? 6 + speed * 2 : 0);
    const ph = this.phase;
    let bodyX = 0;
    let bodyY = Math.sin(this.time * 3) * 0.01;
    let abd = [Math.sin(this.time * 2) * 0.05, 0, 0];
    let head = [0, 0, 0];
    let curl = 0;
    if (this.action) {
      const t = clamp(this.action.t / this.action.dur, 0, 1);
      const n = this.action.name;
      if (n === 'bite') {
        const w = Math.sin(t * PI);
        bodyX = -w * 0.2 + (t > 0.4 && t < 0.6 ? 0.35 : 0);
        head = [w * 0.3, 0, 0];
      } else if (n === 'spit') {
        const w = Math.sin(t * PI);
        abd = [-w * 0.8, 0, 0];
        bodyX = w * 0.2;
      } else if (n === 'die') {
        curl = Math.min(1, t * 2);
        bodyY -= curl * 0.3;
      } else if (n === 'leap') {
        bodyX = t < 0.3 ? 0.2 : -0.2;
      }
    }
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 1 : -1;
      const k = i % 4;
      const gait = (k % 2 === 0) === (side > 0) ? 0 : PI;
      const lift = speed > 0.1 ? Math.max(0, Math.sin(ph + gait)) * 0.35 : 0;
      const swing = speed > 0.1 ? Math.cos(ph + gait) * 0.3 : Math.sin(this.time * 1.5 + i) * 0.03;
      this._set('leg' + i, 0, swing * side + (k - 1.5) * -0.25 * side, side * (lift + curl * 0.9), dt, 25);
      this._set('leg' + i + 'b', 0, 0, side * (-lift * 0.5 - curl * 1.2), dt, 25);
    }
    this._set('body', bodyX, 0, 0, dt, 25);
    this._set('abdomen', abd[0], abd[1], abd[2], dt, 20);
    this._set('head', head[0], (s.lookYaw || 0) * 0.4, 0, dt, 25);
    const b = this.b.body;
    b.position.y = b.userData.rest.y + bodyY + (speed > 0.1 ? Math.abs(Math.sin(ph * 2)) * 0.03 : 0);
  }

  // ---------- Chauve-souris ----------
  _bat(dt, s) {
    const dive = this.action && this.action.name === 'dive';
    const dead = this.action && this.action.name === 'die';
    const f = dead ? 0 : Math.sin(this.time * (dive ? 4 : 16)) * (dive ? 0.2 : 0.9);
    const fold = dive ? 1 : 0;
    this._set('wingL', 0, 0, f - fold * 0.9, dt, 40);
    this._set('wingR', 0, 0, -f + fold * 0.9, dt, 40);
    this._set('wingL2', 0, fold * 1.2, f * 0.6, dt, 40);
    this._set('wingR2', 0, -fold * 1.2, -f * 0.6, dt, 40);
    this._set('body', dive ? 0.8 : dead ? 1.2 : 0.2, 0, 0, dt, 12);
    const b = this.b.body;
    b.position.y = b.userData.rest.y + (dead ? -1.5 : Math.sin(this.time * 16) * 0.05);
  }

  // ---------- Slime ----------
  _blob(dt, s) {
    const speed = s.speed || 0;
    this.phase += dt * (speed > 0.1 ? 5 : 2);
    let sq = Math.sin(this.phase) * (speed > 0.1 ? 0.18 : 0.05);
    let y = speed > 0.1 ? Math.max(0, Math.sin(this.phase)) * 0.25 : 0;
    if (this.action) {
      const t = clamp(this.action.t / this.action.dur, 0, 1);
      if (this.action.name === 'slam' || this.action.name === 'attack') {
        sq = t < 0.4 ? -0.3 * (t / 0.4) : t < 0.6 ? 0.5 : 0.5 * (1 - (t - 0.6) / 0.4);
        y = t > 0.35 && t < 0.6 ? 0.8 : 0;
      } else if (this.action.name === 'die') {
        sq = -Math.min(1, t * 1.5) * 0.8;
      }
    }
    if (this.hitT > 0) sq -= Math.sin((this.hitT / 0.25) * PI) * 0.25;
    const b = this.b.body;
    b.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    b.position.y = y;
  }

  // ---------- Serpent ----------
  _serpent(dt, s) {
    const speed = s.speed || 0;
    this.phase += dt * (1.5 + speed * 1.2);
    const n = this.segments;
    let neckX = -0.3;
    let headX = 0.1;
    let jaw = 0.05;
    let sweep = 0;
    let dead = 0;
    if (this.action) {
      const t = clamp(this.action.t / this.action.dur, 0, 1);
      const a = this.action.name;
      if (a === 'strike' || a === 'bite') {
        const w = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
        neckX = -0.3 - w * 0.5 + (t > 0.4 && t < 0.6 ? 1.2 : 0);
        jaw = w * 0.7;
      } else if (a === 'spit' || a === 'breath') {
        jaw = Math.sin(t * PI) * 0.8;
        neckX = -0.1;
      } else if (a === 'sweep') {
        sweep = Math.sin(t * PI * 2) * 1.2;
      } else if (a === 'die') {
        dead = Math.min(1, t * 2);
      }
    }
    for (let i = 0; i < n; i++) {
      const w = Math.sin(this.phase * 2 - i * 0.7) * (0.25 + (speed > 0.1 ? 0.15 : 0)) * (1 - dead * 0.8);
      this._set('seg' + i, 0, w + (i === 1 ? sweep : 0), 0, dt, 15);
    }
    this._set('neck', neckX * (1 - dead) + dead * 1.2, (s.lookYaw || 0) * 0.5, 0, dt, 25);
    this._set('head', headX, 0, 0, dt, 25);
    this._set('jaw', jaw, 0, 0, dt, 30);
  }

  // ---------- Feu follet ----------
  _wisp(dt, s) {
    const core = this.b.core;
    const pulse = 1 + Math.sin(this.time * 6) * 0.08;
    let scale = pulse;
    if (this.action && this.action.name === 'charge') scale = pulse * (1 + this.actionT * 0.6);
    if (this.action && this.action.name === 'die') scale = Math.max(0.01, 1 - this.actionT);
    core.scale.setScalar(scale);
    core.position.y = core.userData.rest.y + Math.sin(this.time * 2) * 0.2;
    core.rotation.y += dt * 2;
    core.rotation.x += dt * 1.3;
  }

  // ---------- Œil ----------
  _eye(dt, s) {
    const body = this.b.body;
    body.position.y = body.userData.rest.y + Math.sin(this.time * 1.5) * 0.15;
    let lid = -0.3 + (Math.sin(this.time * 0.7) > 0.97 ? 0.8 : 0);
    if (this.action) {
      const t = this.actionT;
      if (this.action.name === 'beam' || this.action.name === 'cast') lid = -0.9;
      if (this.action.name === 'die') lid = 0.4 * t;
    }
    this._set('lidT', lid, 0, 0, dt, 20);
    this._set('body', s.pitch || 0, 0, 0, dt, 10);
    for (let i = 0; i < 5; i++) {
      const w = Math.sin(this.time * 2.5 + i * 1.3);
      this._set('t' + i + 'a', w * 0.3, 0, Math.cos(this.time * 2 + i) * 0.3, dt, 10);
      this._set('t' + i + 'b', w * 0.5, 0, 0, dt, 10);
    }
  }

  // ---------- Tentacules ----------
  _tentacle(dt, s) {
    let slam = -1;
    let slamT = 0;
    let all = false;
    let retract = 0;
    if (this.action) {
      const t = this.actionT;
      const a = this.action.name;
      if (a === 'slam') {
        slam = (this.action.index ?? 0) % this.count;
        slamT = t;
      } else if (a === 'sweep' || a === 'slamAll') {
        all = true;
        slamT = t;
      } else if (a === 'die') retract = Math.min(1, t * 1.5);
    }
    for (let i = 0; i < this.count; i++) {
      const a = (i / this.count) * PI * 2;
      const hit = i === slam || all;
      for (let k = 0; k < 5; k++) {
        let rx = Math.sin(this.time * 1.7 + i * 1.1 + k * 0.6) * 0.25;
        let rz = Math.cos(this.time * 1.3 + i * 0.9 + k * 0.5) * 0.25;
        if (k === 0) {
          rx += Math.cos(a) * 0.35;
          rz += -Math.sin(a) * 0.35;
        }
        if (hit) {
          const w = slamT < 0.45 ? -(slamT / 0.45) * 0.5 : slamT < 0.6 ? 1.2 : 1.2 * (1 - (slamT - 0.6) / 0.4);
          rx += Math.cos(a) * w * 0.55;
          rz += -Math.sin(a) * w * 0.55;
        }
        rx *= 1 - retract;
        rz *= 1 - retract;
        this._set('t' + i + '_' + k, rx, 0, rz, dt, hit ? 30 : 8);
      }
    }
    const body = this.b.body;
    body.position.y = body.userData.rest.y - retract * 2.2 + Math.sin(this.time * 1.2) * 0.05;
    this._set('eye', Math.sin(this.time * 0.8) * 0.2, (s.lookYaw || 0) * 0.6, 0, dt, 8);
  }

  // ---------- Mimic ----------
  _mimic(dt, s) {
    const speed = s.speed || 0;
    this.phase += dt * (speed > 0.1 ? 9 : 0);
    let lid = s.dormant ? 0 : -0.35 - Math.max(0, Math.sin(this.time * 3)) * 0.25;
    let tongue = 0;
    if (this.action) {
      const t = this.actionT;
      if (this.action.name === 'bite') {
        lid = t < 0.4 ? -1.2 * (t / 0.4) : t < 0.55 ? 0 : -0.4;
        tongue = t < 0.4 ? -0.3 : 0;
      } else if (this.action.name === 'awaken') lid = -1.3 * Math.sin(t * PI) - 0.3 * t;
      else if (this.action.name === 'die') lid = -1.6;
    }
    this._set('lid', lid, 0, 0, dt, 25);
    this._set('tongue', tongue + Math.sin(this.time * 5) * 0.1, Math.sin(this.time * 3) * 0.2, 0, dt, 15);
    const b = this.b.body;
    b.position.y = speed > 0.1 ? Math.abs(Math.sin(this.phase)) * 0.25 : 0;
  }

  // ---------- Dragon ----------
  _dragon(dt, s) {
    const speed = s.speed || 0;
    const flying = s.flying;
    this.phase += dt * (speed > 0.1 ? 2.5 + speed * 0.5 : 0);
    const ph = this.phase;
    const sw = speed > 0.1 && !flying ? Math.sin(ph) : 0;
    const amp = 0.35;
    const legs = flying
      ? { legFL: [-0.8, 0, 0], legFL2: [1.2, 0, 0], legFR: [-0.8, 0, 0], legFR2: [1.2, 0, 0], legBL: [0.8, 0, 0], legBL2: [0.6, 0, 0], legBR: [0.8, 0, 0], legBR2: [0.6, 0, 0] }
      : {
          legFL: [-sw * amp, 0, 0], legFL2: [Math.max(0, Math.sin(ph + 0.8)) * amp, 0, 0],
          legBR: [-sw * amp, 0, 0], legBR2: [Math.max(0, Math.sin(ph + 0.8)) * amp, 0, 0],
          legFR: [sw * amp, 0, 0], legFR2: [Math.max(0, Math.sin(ph + PI + 0.8)) * amp, 0, 0],
          legBL: [sw * amp, 0, 0], legBL2: [Math.max(0, Math.sin(ph + PI + 0.8)) * amp, 0, 0],
        };
    let neckBend = [-0.15, 0, 0];
    let headX = 0.3;
    let jaw = 0.05;
    let tailSwing = 0;
    let wingOpen = flying ? 1 : 0.15;
    let flap = flying ? Math.sin(this.time * 5) : Math.sin(this.time * 0.8) * 0.05;
    let bodyX = 0;
    let bodyZ = 0;
    if (this.action) {
      const t = this.actionT;
      const a = this.action.name;
      if (a === 'breath') {
        const w = Math.sin(Math.min(1, t * 1.3) * PI * 0.5);
        neckBend = [0.1 * w, 0, 0];
        headX = 0.5;
        jaw = 0.8 * w;
      } else if (a === 'bite') {
        const strike = t > 0.35 && t < 0.6 ? 1 : 0;
        neckBend = [-0.3 + strike * 0.35, 0, 0];
        jaw = t < 0.4 ? 0.8 : 0.1;
      } else if (a === 'tailSweep' || a === 'sweep') {
        tailSwing = Math.sin(t * PI * 2) * 1.4;
        bodyZ = Math.sin(t * PI * 2) * 0.1;
      } else if (a === 'roar') {
        const w = Math.sin(t * PI);
        neckBend = [-0.45 * w, 0, 0];
        headX = -0.3 * w;
        jaw = 0.9 * w;
        wingOpen = w;
        bodyX = -0.2 * w;
      } else if (a === 'die') {
        bodyZ = Math.min(1, t * 1.5) * 1.3;
        wingOpen = 0.6;
        flap = 0;
      }
    }
    for (const k in legs) this._set(k, legs[k][0], legs[k][1], legs[k][2], dt, 15);
    for (let i = 0; i < 4; i++) this._set('neck' + i, neckBend[0] + Math.sin(this.time * 1.2 + i * 0.5) * 0.04, (s.lookYaw || 0) * 0.2, 0, dt, 12);
    this._set('head', headX, 0, 0, dt, 15);
    this._set('jaw', jaw, 0, 0, dt, 25);
    for (let i = 0; i < 6; i++) this._set('tail' + i, 0.05, Math.sin(this.time * 1.5 - i * 0.6) * 0.12 + (tailSwing * (i + 1)) / 6, 0, dt, i < 2 ? 20 : 12);
    for (const sgn of [1, -1]) {
      const w = sgn > 0 ? 'wingL' : 'wingR';
      this._set(w, 0, -sgn * (1 - wingOpen) * 1.2, sgn * (flap * 0.7 + (1 - wingOpen) * 0.3), dt, 20);
      this._set(w + '2', 0, -sgn * (1 - wingOpen) * 1.5, sgn * flap * 0.5, dt, 20);
    }
    this._set('body', bodyX, 0, bodyZ, dt, 12);
    const b = this.b.body;
    b.position.y = b.userData.rest.y + (speed > 0.1 && !flying ? Math.abs(sw) * 0.08 : Math.sin(this.time * 1.5) * 0.02);
  }
}
