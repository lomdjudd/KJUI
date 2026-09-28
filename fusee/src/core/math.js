// Petites fonctions mathématiques et de formatage (unités en français).

export const G0 = 9.80665;
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smooth = (t) => t * t * (3 - 2 * t);

// Ramène un angle dans ]-PI, PI]
export function wrapPi(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export function wrap2Pi(a) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

export const len2 = (x, y) => Math.sqrt(x * x + y * y);

// Rapproche v de la cible t à la vitesse k (indépendant du framerate)
export function damp(v, t, k, dt) {
  return t + (v - t) * Math.exp(-k * dt);
}

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export const fmtInt = (v) => nf0.format(Math.round(v));
export const fmt1 = (v) => nf1.format(v);
export const fmt2 = (v) => nf2.format(v);

export function fmtDist(m) {
  const a = Math.abs(m);
  if (!isFinite(a)) return '∞';
  if (a < 10000) return nf0.format(m) + ' m';
  if (a < 1e7) return nf1.format(m / 1000) + ' km';
  if (a < 1e10) return nf0.format(m / 1000) + ' km';
  return nf2.format(m / 1e9) + ' Gm';
}

export function fmtSpeed(v) {
  const a = Math.abs(v);
  if (a < 1000) return nf1.format(v) + ' m/s';
  return nf2.format(v / 1000) + ' km/s';
}

export function fmtMass(kg) {
  if (kg < 1000) return nf0.format(kg) + ' kg';
  return nf2.format(kg / 1000) + ' t';
}

export function fmtForce(n) {
  if (n < 1e6) return nf1.format(n / 1000) + ' kN';
  return nf2.format(n / 1e6) + ' MN';
}

export function fmtMoney(v) {
  return nf0.format(Math.round(v)) + ' ¢';
}

// Durée compacte : 3 j 04 h 12 min / 12 min 05 s / 45 s
export function fmtTime(s, withSign = false) {
  if (!isFinite(s)) return '—';
  const neg = s < 0;
  s = Math.abs(s);
  const y = Math.floor(s / (365 * 86400));
  s -= y * 365 * 86400;
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s - m * 60);
  const p2 = (n) => String(n).padStart(2, '0');
  let out;
  if (y > 0) out = `${y} a ${d} j`;
  else if (d > 0) out = `${d} j ${p2(h)} h ${p2(m)} min`;
  else if (h > 0) out = `${h} h ${p2(m)} min ${p2(sec)} s`;
  else if (m > 0) out = `${m} min ${p2(sec)} s`;
  else out = `${sec} s`;
  return (neg ? '-' : withSign ? '+' : '') + out;
}

// Horloge de mission : A1 J012 06:12:45
export function fmtClock(t) {
  const year = Math.floor(t / (365 * 86400));
  let r = t - year * 365 * 86400;
  const day = Math.floor(r / 86400);
  r -= day * 86400;
  const h = Math.floor(r / 3600);
  r -= h * 3600;
  const m = Math.floor(r / 60);
  const s = Math.floor(r - m * 60);
  const p2 = (n) => String(n).padStart(2, '0');
  return `An ${year + 1} · J${String(day + 1).padStart(3, '0')} · ${p2(h)}:${p2(m)}:${p2(s)}`;
}

export function fmtMET(t) {
  const neg = t < 0;
  t = Math.abs(t);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t - h * 3600) / 60);
  const s = Math.floor(t - h * 3600 - m * 60);
  const p2 = (n) => String(n).padStart(2, '0');
  return `T${neg ? '-' : '+'}${p2(h)}:${p2(m)}:${p2(s)}`;
}

// Résolution d'équation du second degré : intersection rayon/cercle
export function raySphere(ox, oy, oz, dx, dy, dz, r) {
  const b = ox * dx + oy * dy + oz * dz;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - c;
  if (h < 0) return null;
  const s = Math.sqrt(h);
  return [-b - s, -b + s];
}
