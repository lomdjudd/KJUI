// Bibliothèque de poses procédurales (angles en radians).
// Conventions : épaule x<0 = bras vers l'avant ; hanche x<0 = jambe vers l'avant ;
// genou x>0 = flexion ; buste x>0 = penché en avant ; root = rotation du corps entier.

const S = Math.sin;
const C = Math.cos;

export function lerpPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === 'rootSnap') {
      out.rootSnap = a.rootSnap || b.rootSnap;
      continue;
    }
    const va = a[k];
    const vb = b[k];
    if (typeof va === 'number' || typeof vb === 'number') {
      out[k] = (va || 0) + ((vb || 0) - (va || 0)) * t;
    } else {
      const x = va || [0, 0, 0];
      const y = vb || [0, 0, 0];
      out[k] = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
    }
  }
  return out;
}

export function idle(t) {
  const b = S(t * 2) * 0.02;
  return {
    hipsY: b * 0.3,
    spine: [0.04 + b, 0, 0],
    chest: [0.03, 0, 0],
    head: [-0.04, S(t * 0.5) * 0.15, 0],
    lShoulder: [0.08, 0, 0.14],
    rShoulder: [0.08, 0, -0.14],
    lElbow: [-0.3, 0, 0],
    rElbow: [-0.3, 0, 0],
    lHip: [-0.04, 0, 0.05],
    rHip: [-0.04, 0, -0.05],
    lKnee: [0.08, 0, 0],
    rKnee: [0.08, 0, 0],
  };
}

export function guard(t) {
  const b = S(t * 5) * 0.02;
  return {
    hipsY: -0.1 + b,
    spine: [0.18, 0, 0],
    chest: [0.05, 0.25, 0],
    head: [-0.15, -0.25, 0],
    lShoulder: [-0.9, 0, 0.35],
    rShoulder: [-0.55, 0, -0.35],
    lElbow: [-1.7, 0, 0],
    rElbow: [-1.9, 0, 0],
    lHip: [-0.45, 0, 0.22],
    rHip: [0.25, 0, -0.22],
    lKnee: [0.6, 0, 0],
    rKnee: [0.55, 0, 0],
  };
}

export function run(phase, amt, sprint = 0) {
  const s = S(phase);
  const c = C(phase);
  const a = amt;
  const armBack = sprint * 0.9;
  return {
    hipsY: -0.04 * a - Math.abs(c) * 0.05 * a - sprint * 0.08,
    spine: [0.2 * a + sprint * 0.35, 0, 0],
    chest: [0.05, s * 0.18 * a, 0],
    head: [-0.2 * a - sprint * 0.3, -s * 0.1 * a, 0],
    lShoulder: [s * 0.85 * a * (1 - sprint * 0.6) + armBack, 0, 0.15 + sprint * 0.2],
    rShoulder: [-s * 0.85 * a * (1 - sprint * 0.6) + armBack, 0, -0.15 - sprint * 0.2],
    lElbow: [-0.6 - 0.6 * a + sprint * 0.4, 0, 0],
    rElbow: [-0.6 - 0.6 * a + sprint * 0.4, 0, 0],
    lHip: [-s * (0.8 + sprint * 0.35) * a, 0, 0.04],
    rHip: [s * (0.8 + sprint * 0.35) * a, 0, -0.04],
    lKnee: [(0.25 + Math.max(0, c) * 1.5) * a, 0, 0],
    rKnee: [(0.25 + Math.max(0, -c) * 1.5) * a, 0, 0],
  };
}

export function jump(vy) {
  const up = Math.max(0, Math.min(1, vy / 10));
  const down = 1 - up;
  return lerpPose(
    {
      spine: [0.1, 0, 0],
      lShoulder: [-2.6, 0, 0.3],
      rShoulder: [-0.4, 0, -0.5],
      lElbow: [-0.3, 0, 0],
      rElbow: [-1.2, 0, 0],
      lHip: [-1.1, 0, 0.1],
      lKnee: [1.6, 0, 0],
      rHip: [-0.3, 0, -0.1],
      rKnee: [0.9, 0, 0],
    },
    {
      spine: [0.05, 0, 0],
      head: [0.1, 0, 0],
      lShoulder: [-0.4, 0, 1.3],
      rShoulder: [-0.4, 0, -1.3],
      lElbow: [-0.5, 0, 0],
      rElbow: [-0.5, 0, 0],
      lHip: [-0.5, 0, 0.3],
      lKnee: [0.9, 0, 0],
      rHip: [0.1, 0, -0.3],
      rKnee: [0.5, 0, 0],
    },
    down,
  );
}

export function dive(t) {
  return {
    root: [1.25, 0, S(t * 3) * 0.05],
    spine: [-0.1, 0, 0],
    head: [-0.5, 0, 0],
    lShoulder: [0.5, 0, 0.35],
    rShoulder: [0.5, 0, -0.35],
    lElbow: [-0.1, 0, 0],
    rElbow: [-0.1, 0, 0],
    lHip: [0.1, 0, 0.08],
    rHip: [0.15, 0, -0.08],
    lKnee: [0.3 + S(t * 8) * 0.05, 0, 0],
    rKnee: [0.4, 0, 0],
  };
}

// phase : -1 (arrière) → 0 (bas) → 1 (avant/haut)
export function swing(phase, pitch, roll, t) {
  const f = Math.max(0, phase);
  const b = Math.max(0, -phase);
  return {
    root: [pitch, 0, roll],
    spine: [0.1 - f * 0.3, 0, 0],
    head: [-0.3 + f * 0.2, 0, 0],
    lShoulder: [-0.6 - f * 0.4, 0, 1.0 + S(t * 2) * 0.05],
    lElbow: [-0.5, 0, 0],
    rElbow: [0, 0, 0],
    lHip: [-0.5 - f * 1.0 + b * 0.3, 0, 0.12],
    lKnee: [1.4 - f * 1.1 + b * 0.3, 0, 0],
    rHip: [-0.2 - f * 1.1 + b * 0.5, 0, -0.12],
    rKnee: [1.0 - f * 0.8 + b * 0.6, 0, 0],
  };
}

export function zip(t) {
  return {
    root: [0.6, 0, 0],
    spine: [0.1, 0, 0],
    lShoulder: [-2.9, 0, 0.1],
    rShoulder: [-2.9, 0, -0.1],
    lElbow: [-0.1, 0, 0],
    rElbow: [-0.1, 0, 0],
    lHip: [0.1, 0, 0.1],
    rHip: [0.3, 0, -0.1],
    lKnee: [0.5 + S(t * 10) * 0.1, 0, 0],
    rKnee: [0.8, 0, 0],
  };
}

export function climb(phase, amt) {
  const s = S(phase) * amt;
  return {
    hipsY: -0.12,
    spine: [0.2, 0, 0],
    chest: [0, s * 0.15, 0],
    head: [-0.6, 0, 0],
    lShoulder: [-2.3 + s * 0.5, 0, 0.55],
    rShoulder: [-2.3 - s * 0.5, 0, -0.55],
    lElbow: [-1.0 - s * 0.3, 0, 0],
    rElbow: [-1.0 + s * 0.3, 0, 0],
    lHip: [-1.0 - s * 0.4, 0, 0.65],
    rHip: [-1.0 + s * 0.4, 0, -0.65],
    lKnee: [1.7 + s * 0.3, 0, 0],
    rKnee: [1.7 - s * 0.3, 0, 0],
  };
}

export function perch(t) {
  // accroupi sur un rebord, pose emblématique
  return {
    hipsY: -0.52,
    spine: [0.55, 0, 0],
    chest: [0.15, 0, 0],
    head: [-0.7, S(t * 0.6) * 0.3, 0],
    lShoulder: [-0.5, 0, 0.35],
    rShoulder: [-0.9, 0, -0.2],
    lElbow: [-0.4, 0, 0],
    rElbow: [-0.5, 0, 0],
    lHip: [-1.9, 0, 0.35],
    rHip: [-1.3, 0, -0.35],
    lKnee: [2.4, 0, 0],
    rKnee: [2.4, 0, 0],
  };
}

export function land(t) {
  return {
    hipsY: -0.35 * (1 - t),
    spine: [0.6 * (1 - t), 0, 0],
    lShoulder: [-0.3, 0, 0.8],
    rShoulder: [0.2, 0, -0.5],
    lElbow: [-0.4, 0, 0],
    rElbow: [-0.4, 0, 0],
    lHip: [-1.4 * (1 - t), 0, 0.3],
    rHip: [-0.8 * (1 - t), 0, -0.3],
    lKnee: [2.0 * (1 - t), 0, 0],
    rKnee: [1.6 * (1 - t), 0, 0],
  };
}

export function hit(t) {
  const k = 1 - t;
  return {
    spine: [-0.45 * k, 0, 0],
    head: [-0.4 * k, 0, 0],
    lShoulder: [0.4 * k, 0, 0.5],
    rShoulder: [0.4 * k, 0, -0.5],
    lElbow: [-0.6, 0, 0],
    rElbow: [-0.6, 0, 0],
    lHip: [-0.2, 0, 0.1],
    rHip: [0.2, 0, -0.1],
    lKnee: [0.3, 0, 0],
    rKnee: [0.3, 0, 0],
  };
}

export function knockdown() {
  return {
    root: [-1.5, 0, 0],
    hipsY: -0.84,
    spine: [-0.1, 0, 0],
    head: [0.3, 0.4, 0],
    lShoulder: [-0.2, 0, 1.2],
    rShoulder: [-0.4, 0, -0.9],
    lElbow: [-0.4, 0, 0],
    rElbow: [-0.9, 0, 0],
    lHip: [-0.1, 0, 0.25],
    rHip: [-0.4, 0, -0.15],
    lKnee: [0.2, 0, 0],
    rKnee: [0.7, 0, 0],
  };
}

export function airborne(t) {
  return {
    root: [-0.6 + S(t * 6) * 0.2, 0, S(t * 4) * 0.3],
    spine: [-0.3, 0, 0],
    lShoulder: [-0.5, 0, 1.4],
    rShoulder: [-0.8, 0, -1.2],
    lHip: [-0.6, 0, 0.3],
    rHip: [0.2, 0, -0.2],
    lKnee: [0.9, 0, 0],
    rKnee: [0.4, 0, 0],
  };
}

export function webbed(t) {
  return {
    spine: [0, 0, S(t * 9) * 0.05],
    lShoulder: [0, 0, 0.08],
    rShoulder: [0, 0, -0.08],
    lElbow: [0, 0, 0],
    rElbow: [0, 0, 0],
    lHip: [0, 0, 0.02],
    rHip: [0, 0, -0.02],
  };
}

export function aim(t) {
  return {
    spine: [0.05, 0, 0],
    chest: [0, 0.5, 0],
    head: [0, -0.5, 0],
    rShoulder: [-1.55, 0.5, 0],
    rElbow: [-0.05, 0, 0],
    lShoulder: [-1.3, 0, 0.6],
    lElbow: [-1.1, 0, 0],
    lHip: [-0.3, 0, 0.15],
    rHip: [0.2, 0, -0.15],
    lKnee: [0.3, 0, 0],
    rKnee: [0.2, 0, 0],
    hipsY: -0.04 + S(t * 3) * 0.01,
  };
}

export function cheer(t) {
  return {
    lShoulder: [-2.8 + S(t * 8) * 0.2, 0, 0.3],
    rShoulder: [-2.8 - S(t * 8) * 0.2, 0, -0.3],
    lElbow: [-0.3, 0, 0],
    rElbow: [-0.3, 0, 0],
    hipsY: Math.abs(S(t * 8)) * 0.05,
  };
}

// --- Attaques : { windup, strike } ; spin / flip = rotation du corps pendant l'attaque ---
export const ATTACKS = {
  jabL: {
    windup: { ...guardBase(), chest: [0.1, 0.35, 0], lShoulder: [-0.6, 0, 0.35], lElbow: [-2.1, 0, 0] },
    strike: { ...guardBase(), chest: [0.1, -0.4, 0], lShoulder: [-1.62, 0, 0.05], lElbow: [-0.05, 0, 0], rShoulder: [-0.7, 0, -0.3] },
  },
  crossR: {
    windup: { ...guardBase(), chest: [0.1, -0.35, 0], rShoulder: [-0.3, 0, -0.35], rElbow: [-2.2, 0, 0] },
    strike: { ...guardBase(), spine: [0.25, 0, 0], chest: [0.15, 0.5, 0], rShoulder: [-1.65, 0, -0.05], rElbow: [-0.05, 0, 0], lHip: [-0.6, 0, 0.2], rHip: [0.45, 0, -0.2] },
  },
  hookL: {
    windup: { ...guardBase(), chest: [0.1, 0.5, 0], lShoulder: [-0.9, 0, 1.1], lElbow: [-1.4, 0, 0] },
    strike: { ...guardBase(), chest: [0.1, -0.7, 0], lShoulder: [-1.5, 0, 0.3], lElbow: [-1.1, 0, 0] },
  },
  uppercutR: {
    windup: { ...guardBase(), hipsY: -0.3, spine: [0.4, 0, 0], rShoulder: [0.4, 0, -0.3], rElbow: [-1.7, 0, 0], lKnee: [1.0, 0, 0], rKnee: [1.0, 0, 0] },
    strike: { ...guardBase(), hipsY: 0.05, spine: [-0.25, 0, 0], chest: [0, 0.3, 0], rShoulder: [-2.9, 0, -0.15], rElbow: [-0.5, 0, 0], lHip: [-0.2, 0, 0.1], rHip: [0.2, 0, -0.1], lKnee: [0.1, 0, 0], rKnee: [0.1, 0, 0] },
  },
  frontKick: {
    windup: { ...guardBase(), rHip: [-1.4, 0, -0.1], rKnee: [2.0, 0, 0], spine: [-0.1, 0, 0] },
    strike: { ...guardBase(), rHip: [-1.7, 0, -0.1], rKnee: [0.05, 0, 0], spine: [-0.35, 0, 0], lKnee: [0.3, 0, 0], lHip: [0.2, 0, 0.2] },
  },
  roundhouse: {
    windup: { ...guardBase(), root: [0, -0.6, 0], rHip: [-0.8, 0, -0.9], rKnee: [1.8, 0, 0], spine: [-0.1, 0, 0.3] },
    strike: { ...guardBase(), root: [0, 0.9, 0.1], rHip: [-1.4, 0, -1.2], rKnee: [0.05, 0, 0], spine: [-0.4, 0, 0.5], lShoulder: [-0.3, 0, 1.2], rShoulder: [-0.3, 0, -1.2] },
  },
  spinKick: {
    spin: Math.PI * 2,
    windup: { ...guardBase(), hipsY: 0.3, lHip: [-1.0, 0, 0.3], lKnee: [1.6, 0, 0], rHip: [-0.4, 0, -1.2], rKnee: [0.1, 0, 0], lShoulder: [-0.3, 0, 1.4], rShoulder: [-0.3, 0, -1.4] },
    strike: { ...guardBase(), hipsY: 0.35, lHip: [-1.0, 0, 0.3], lKnee: [1.6, 0, 0], rHip: [-0.5, 0, -1.5], rKnee: [0.05, 0, 0], lShoulder: [-0.3, 0, 1.4], rShoulder: [-0.3, 0, -1.4], spine: [-0.3, 0, 0.3] },
  },
  flipKick: {
    flip: -Math.PI * 2,
    windup: { ...guardBase(), hipsY: 0.3, lHip: [-1.2, 0, 0.1], lKnee: [2.0, 0, 0], rHip: [-1.4, 0, -0.1], rKnee: [1.8, 0, 0], lShoulder: [-2.6, 0, 0.3], rShoulder: [-2.6, 0, -0.3] },
    strike: { ...guardBase(), hipsY: 0.45, lHip: [-1.8, 0, 0.1], lKnee: [0.05, 0, 0], rHip: [-1.8, 0, -0.1], rKnee: [0.05, 0, 0], lShoulder: [0.4, 0, 0.6], rShoulder: [0.4, 0, -0.6] },
  },
  heavyR: {
    windup: { ...guardBase(), hipsY: -0.2, chest: [0, -0.8, 0], spine: [0.1, -0.2, 0], rShoulder: [0.7, 0, -0.5], rElbow: [-1.4, 0, 0] },
    strike: { ...guardBase(), hipsY: -0.15, chest: [0.25, 0.7, 0], spine: [0.3, 0.2, 0], rShoulder: [-1.7, 0, 0], rElbow: [0, 0, 0], lHip: [-0.8, 0, 0.25], lKnee: [0.9, 0, 0], rHip: [0.6, 0, -0.2] },
  },
  heavyL: {
    windup: { ...guardBase(), hipsY: -0.2, chest: [0, 0.8, 0], spine: [0.1, 0.2, 0], lShoulder: [0.7, 0, 0.5], lElbow: [-1.4, 0, 0] },
    strike: { ...guardBase(), hipsY: -0.15, chest: [0.25, -0.7, 0], spine: [0.3, -0.2, 0], lShoulder: [-1.7, 0, 0], lElbow: [0, 0, 0], rHip: [-0.8, 0, -0.25], rKnee: [0.9, 0, 0], lHip: [0.6, 0, 0.2] },
  },
  slam: {
    windup: { ...guardBase(), hipsY: 0.25, spine: [-0.3, 0, 0], lShoulder: [-3.0, 0, 0.3], rShoulder: [-3.0, 0, -0.3], lElbow: [-0.4, 0, 0], rElbow: [-0.4, 0, 0] },
    strike: { ...guardBase(), hipsY: -0.45, spine: [0.8, 0, 0], lShoulder: [-1.1, 0, 0.15], rShoulder: [-1.1, 0, -0.15], lElbow: [0, 0, 0], rElbow: [0, 0, 0], lHip: [-1.4, 0, 0.3], rHip: [-0.4, 0, -0.3], lKnee: [1.9, 0, 0], rKnee: [1.6, 0, 0] },
  },
  webWhip: {
    windup: { ...guardBase(), chest: [-0.1, 0.4, 0], lShoulder: [-2.6, 0, 0.7], rShoulder: [-2.6, 0, -0.7], lElbow: [-0.5, 0, 0], rElbow: [-0.5, 0, 0] },
    strike: { ...guardBase(), spine: [0.35, 0, 0], chest: [0.1, -0.2, 0], lShoulder: [-1.45, 0, 0.12], rShoulder: [-1.45, 0, -0.12], lElbow: [0, 0, 0], rElbow: [0, 0, 0] },
  },
  webPull: {
    windup: { ...guardBase(), lShoulder: [-1.5, 0, 0.1], rShoulder: [-1.5, 0, -0.1], lElbow: [0, 0, 0], rElbow: [0, 0, 0] },
    strike: { ...guardBase(), spine: [-0.2, 0, 0], lShoulder: [0.3, 0, 0.4], rShoulder: [0.3, 0, -0.4], lElbow: [-1.6, 0, 0], rElbow: [-1.6, 0, 0], lHip: [0.3, 0, 0.2], rHip: [-0.4, 0, -0.2] },
  },
  webSpin: {
    spin: Math.PI * 2,
    windup: { ...guardBase(), lShoulder: [-1.5, 0, 1.4], rShoulder: [-1.5, 0, -1.4], lElbow: [0, 0, 0], rElbow: [0, 0, 0] },
    strike: { ...guardBase(), hipsY: -0.1, lShoulder: [-1.5, 0, 1.5], rShoulder: [-1.5, 0, -1.5], lElbow: [0, 0, 0], rElbow: [0, 0, 0], spine: [0.2, 0, 0] },
  },
  dropKick: {
    windup: { ...guardBase(), root: [-0.9, 0, 0], lHip: [-1.6, 0, 0.1], rHip: [-1.6, 0, -0.1], lKnee: [1.8, 0, 0], rKnee: [1.8, 0, 0] },
    strike: { ...guardBase(), root: [-1.1, 0, 0], lHip: [-1.7, 0, 0.1], rHip: [-1.7, 0, -0.1], lKnee: [0, 0, 0], rKnee: [0, 0, 0], lShoulder: [0.2, 0, 1.2], rShoulder: [0.2, 0, -1.2] },
  },
  airKick: {
    windup: { ...guardBase(), rHip: [-0.6, 0, -0.2], rKnee: [1.9, 0, 0], lHip: [-1.0, 0, 0.2], lKnee: [1.6, 0, 0] },
    strike: { ...guardBase(), rHip: [-1.6, 0, -0.3], rKnee: [0.05, 0, 0], lHip: [-0.8, 0, 0.2], lKnee: [1.8, 0, 0], spine: [-0.3, 0, 0] },
  },
  // Attaques ennemies
  thugPunch: {
    windup: { ...guardBase(), chest: [0, -0.5, 0], rShoulder: [0.5, 0, -0.4], rElbow: [-1.7, 0, 0] },
    strike: { ...guardBase(), spine: [0.3, 0, 0], chest: [0.1, 0.5, 0], rShoulder: [-1.6, 0, 0], rElbow: [-0.1, 0, 0] },
  },
  bruteSmash: {
    windup: { ...guardBase(), hipsY: 0.05, spine: [-0.3, 0, 0], lShoulder: [-3.0, 0, 0.2], rShoulder: [-3.0, 0, -0.2], lElbow: [-0.6, 0, 0], rElbow: [-0.6, 0, 0] },
    strike: { ...guardBase(), hipsY: -0.3, spine: [0.9, 0, 0], lShoulder: [-1.2, 0, 0.1], rShoulder: [-1.2, 0, -0.1], lElbow: [0, 0, 0], rElbow: [0, 0, 0] },
  },
};

function guardBase() {
  return {
    hipsY: -0.08,
    spine: [0.15, 0, 0],
    chest: [0.05, 0, 0],
    head: [-0.12, 0, 0],
    lShoulder: [-0.9, 0, 0.35],
    rShoulder: [-0.6, 0, -0.35],
    lElbow: [-1.7, 0, 0],
    rElbow: [-1.9, 0, 0],
    lHip: [-0.4, 0, 0.2],
    rHip: [0.25, 0, -0.2],
    lKnee: [0.55, 0, 0],
    rKnee: [0.5, 0, 0],
  };
}

// Évaluation d'une attaque à l'instant t (0..dur)
export function attackPose(name, t, dur, hitT) {
  const a = ATTACKS[name];
  let pose;
  if (t < hitT) {
    const k = t / hitT;
    pose = lerpPose(a.windup, a.strike, k * k);
  } else {
    const k = Math.min(1, (t - hitT) / Math.max(0.01, dur - hitT));
    pose = k < 0.5 ? { ...a.strike } : lerpPose(a.strike, guardBase(), (k - 0.5) * 2);
  }
  if (a.spin) {
    const k = Math.min(1, t / dur);
    const r = pose.root || [0, 0, 0];
    pose.root = [r[0], r[1] + a.spin * easeOut(k), r[2]];
    pose.rootSnap = true;
  }
  if (a.flip) {
    const k = Math.min(1, t / dur);
    const r = pose.root || [0, 0, 0];
    pose.root = [r[0] + a.flip * easeOut(k), r[1], r[2]];
    pose.rootSnap = true;
  }
  return pose;
}

function easeOut(k) {
  return 1 - (1 - k) * (1 - k);
}

export function dodgePose(kind, k) {
  // k : progression 0..1
  const tuck = {
    hipsY: 0.1,
    spine: [0.6, 0, 0],
    head: [0.4, 0, 0],
    lShoulder: [-1.2, 0, 0.3],
    rShoulder: [-1.2, 0, -0.3],
    lElbow: [-1.8, 0, 0],
    rElbow: [-1.8, 0, 0],
    lHip: [-2.0, 0, 0.1],
    rHip: [-2.0, 0, -0.1],
    lKnee: [2.3, 0, 0],
    rKnee: [2.3, 0, 0],
  };
  const e = easeOut(k);
  if (kind === 'back') return { ...tuck, root: [-Math.PI * 2 * e, 0, 0], rootSnap: true };
  if (kind === 'front') return { ...tuck, root: [Math.PI * 2 * e, 0, 0], rootSnap: true };
  if (kind === 'left') return { ...tuck, root: [0, 0, -Math.PI * 2 * e], rootSnap: true };
  return { ...tuck, root: [0, 0, Math.PI * 2 * e], rootSnap: true };
}
