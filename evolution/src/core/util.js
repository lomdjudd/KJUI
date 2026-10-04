export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dampAngle(a, b, k, dt) {
  return a + angleWrap(b - a) * (1 - Math.exp(-k * dt));
}

// Générateur pseudo-aléatoire reproductible
export function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fmtNum(n) {
  return Math.floor(n).toLocaleString('fr-FR');
}

export function fmtYear(y) {
  if (y >= 0) return `An ${Math.floor(y)}`;
  const a = -y;
  if (a >= 1e9) return `Il y a ${(a / 1e9).toFixed(1).replace('.', ',')} milliards d'années`;
  if (a >= 1e6) return `Il y a ${Math.round(a / 1e6)} millions d'années`;
  if (a >= 10000) return `Il y a ${fmtNum(a)} ans`;
  return `${fmtNum(a)} av. J.-C.`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
