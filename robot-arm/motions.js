import * as THREE from 'three';
import { solveIK } from './arm.js';
import { PADS, PAD_H, CUBE } from './scene.js';

const D = Math.PI / 180;
const sm = (x) => x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const polar = (v) => ({ az: Math.atan2(-v.z, v.x), r: Math.hypot(v.x, v.z) });
const fromPolar = (az, r, y, out = new THREE.Vector3()) => out.set(r * Math.cos(az), y, -r * Math.sin(az));

export const HOME_POS = new THREE.Vector3(0.78, 0.5, 0);
export const HOME_Q = solveIK(HOME_POS);

// Garde le TCP dans la zone de travail atteignable (hors du socle et du sol)
function reachable(p) {
  const { az, r } = polar(p);
  return fromPolar(az, clamp(r, 0.52, 1.3), clamp(p.y, 0.1, 1.15));
}

const BLEND = 0.9; // durée de raccord (s) depuis la pose précédente

export function createMotions(arm, props) {
  const GRIP = 0.22; // ouverture de la pince sur le cube (écart ≈ 80 mm)
  const pos = new THREE.Vector3();

  // ------------------------------------------------------------------ Pick & place
  const pick = {
    id: 'pick',
    name: 'Pick & place',
    icon: '📦',
    desc: "Saisit le cube sur une palette et le dépose sur l'autre (cinématique inverse).",
    t: 0,
    cycle: 0,
    keys: [],
    ev: 0,
    from: PADS.A,
    to: PADS.B,
    makeKeys(from, to) {
      const a = polar(from);
      const b = polar(to);
      const hov = 0.45;
      const low = PAD_H + CUBE / 2;
      const k = (t, p, y, g, extra = {}) => ({ t, az: p.az, r: p.r, y, g, ...extra });
      return [
        k(0, a, hov, 1),
        k(1.1, a, low, 1),
        k(1.6, a, low, GRIP, { ev: 'grab' }),
        k(2.1, a, low, GRIP),
        k(3.1, a, hov, GRIP),
        k(5.2, b, hov, GRIP, { bump: 0.1 }),
        k(6.2, b, low + 0.004, GRIP),
        k(6.7, b, low + 0.004, 1, { ev: 'release', evT: 6.3 }),
        k(7.2, b, hov, 1),
      ];
    },
    start() {
      // Détermine le sens du transfert d'après la position du cube
      const c = props.cube.position;
      if (props.cubeState.mode !== 'rest') props.resetCube();
      const nearB = Math.hypot(c.x - PADS.B.x, c.z - PADS.B.z) < 0.15;
      const onPad = nearB || Math.hypot(c.x - PADS.A.x, c.z - PADS.A.z) < 0.15;
      if (!onPad) props.resetCube();
      this.from = nearB ? PADS.B : PADS.A;
      this.to = nearB ? PADS.A : PADS.B;
      this.keys = this.makeKeys(this.from, this.to);
      this.t = -BLEND;
      this.held = false;
    },
    stop() {
      if (props.cubeState.mode === 'held') props.dropCube();
    },
    update(dt) {
      this.t += dt;
      const last = this.keys[this.keys.length - 1].t;
      if (this.t >= last) {
        // cycle suivant : on inverse les palettes
        this.t -= last;
        [this.from, this.to] = [this.to, this.from];
        this.keys = this.makeKeys(this.from, this.to);
      }
      const t = Math.max(0, this.t);
      const ks = this.keys;
      let i = 0;
      while (i < ks.length - 2 && t >= ks[i + 1].t) i++;
      const a = ks[i];
      const b = ks[i + 1];
      const s = sm(clamp((t - a.t) / (b.t - a.t), 0, 1));
      const az = a.az + (b.az - a.az) * s;
      const r = a.r + (b.r - a.r) * s;
      const y = a.y + (b.y - a.y) * s + (b.bump ? Math.sin(Math.PI * s) * b.bump : 0);
      const g = a.g + (b.g - a.g) * s;

      // événements (prise / dépose) déclenchés au passage de leur instant
      if (this.t > 0) {
        for (const k of ks) {
          const et = k.evT ?? k.t;
          if (k.ev && this.t - dt < et && this.t >= et) {
            if (k.ev === 'grab' && props.cubeState.mode === 'rest') {
              arm.tcp.attach(props.cube);
              props.cubeState.mode = 'held';
            } else if (k.ev === 'release' && props.cubeState.mode === 'held') {
              props.dropCube();
            }
          }
        }
      }
      fromPolar(az, r, y, pos);
      return { q: solveIK(pos), g };
    },
  };

  // ------------------------------------------------------------------ Salutation
  const wave = {
    id: 'wave',
    name: 'Salutation',
    icon: '👋',
    desc: "Le robot lève l'avant-bras et salue en agitant le poignet.",
    t: 0,
    start() {
      this.t = 0;
    },
    update(dt) {
      this.t += dt;
      const t = this.t;
      return {
        q: [
          Math.sin(t * 0.7) * 16 * D,
          32 * D,
          -30 * D + Math.sin(t * 1.4) * 4 * D,
          Math.sin(t * 2.6) * 18 * D,
          Math.sin(t * 5.2) * 38 * D,
          Math.sin(t * 5.2 + 1) * 28 * D,
        ],
        g: 0.5 + 0.5 * Math.sin(t * 5.2),
      };
    },
  };

  // ------------------------------------------------------------------ Balayage
  const scan = {
    id: 'scan',
    name: 'Balayage',
    icon: '📡',
    desc: "Balaie la zone de travail comme un scanner d'inspection.",
    t: 0,
    start() {
      this.t = 0;
    },
    update(dt) {
      this.t += dt;
      const t = this.t;
      return {
        q: [
          Math.sin(t * 0.7) * 72 * D,
          52 * D + Math.sin(t * 1.4) * 6 * D,
          68 * D + Math.sin(t * 1.4 + 1) * 8 * D,
          Math.sin(t * 1.4) * 28 * D,
          14 * D + Math.sin(t * 2.1) * 14 * D,
          Math.sin(t * 0.7) * 40 * D,
        ],
        g: 0.55 + 0.45 * Math.sin(t * 1.4),
      };
    },
  };

  // ------------------------------------------------------------------ Tracé en 8
  const eight = {
    id: 'eight',
    name: 'Tracé en 8',
    icon: '∞',
    desc: 'Le TCP dessine un 8 dans l\'espace en laissant une trace lumineuse.',
    t: 0,
    start() {
      this.t = -BLEND;
      props.trail.clear();
      props.trail.setVisible(true);
    },
    update(dt) {
      this.t += dt;
      const t = Math.max(0, this.t);
      const w = t * 0.95;
      pos.set(0.88 + 0.2 * Math.sin(w), 0.34 + 0.09 * Math.sin(w * 2 + 0.5), 0.3 * Math.sin(2 * w) * 0.9);
      if (this.t > 0) {
        arm.tcp.getWorldPosition(this.tmp ?? (this.tmp = new THREE.Vector3()));
        props.trail.push(this.tmp);
      }
      return { q: solveIK(pos), g: 0.15 };
    },
  };

  // ------------------------------------------------------------------ Danse
  const dance = {
    id: 'dance',
    name: 'Danse',
    icon: '🕺',
    desc: 'Les six axes bougent ensemble en rythme.',
    t: 0,
    start() {
      this.t = 0;
    },
    update(dt) {
      this.t += dt;
      const w = this.t * 1.6;
      return {
        q: [
          55 * D * Math.sin(w * 0.5),
          35 * D + 25 * D * Math.sin(w),
          55 * D + 25 * D * Math.sin(w + 2),
          100 * D * Math.sin(w * 0.5 + 0.6),
          45 * D * Math.sin(2 * w),
          200 * D * Math.sin(w),
        ],
        g: 0.5 + 0.5 * Math.sin(2 * w),
      };
    },
  };

  // ------------------------------------------------------------------ Cible (clic au sol)
  const target = {
    id: 'target',
    name: 'Pointer une cible',
    icon: '🎯',
    desc: 'Cliquez sur le sol : le bras y amène sa pince grâce à la cinématique inverse.',
    goal: new THREE.Vector3(0.8, 0.3, 0.3),
    cur: new THREE.Vector3(),
    start() {
      arm.tcp.getWorldPosition(this.cur);
      this.cur.copy(reachable(this.cur));
      props.setTarget(this.goal);
    },
    stop() {
      props.hideTarget();
    },
    setGoal(x, z) {
      this.goal.copy(reachable(new THREE.Vector3(x, 0.26, z)));
      props.setTarget(this.goal);
    },
    update(dt) {
      this.cur.lerp(this.goal, 1 - Math.exp(-3.2 * dt));
      return { q: solveIK(this.cur), g: 1 };
    },
  };

  // ------------------------------------------------------------------ Repos
  const home = {
    id: 'home',
    name: 'Position repos',
    icon: '🏠',
    desc: 'Retour à la pose de repos, pince ouverte.',
    start() {},
    update() {
      return { q: HOME_Q, g: 1 };
    },
  };

  return [home, pick, wave, scan, eight, dance, target];
}

export { BLEND };
