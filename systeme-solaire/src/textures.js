// Textures générées par le code (pour ce que la NASA ne fournit pas en carte).
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Petit générateur pseudo-aléatoire reproductible
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Uranus : bleu-vert pâle avec des bandes très douces
export function uranusTexture() {
  const [c, g] = canvas(1024, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#b9eef0');
  grad.addColorStop(0.2, '#a4e2e8');
  grad.addColorStop(0.5, '#8fd6df');
  grad.addColorStop(0.8, '#9edde4');
  grad.addColorStop(1, '#c3f1f2');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  const r = rng(7);
  for (let i = 0; i < 40; i++) {
    const y = r() * 512;
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,140,160'},${0.03 + r() * 0.05})`;
    g.fillRect(0, y, 1024, 2 + r() * 14);
  }
  return tex(c);
}

// Anneaux de Saturne : profil radial (u = de l'intérieur vers l'extérieur)
export function saturnRingTexture() {
  const W = 1024;
  const [c, g] = canvas(W, 8);
  const img = g.createImageData(W, 8);
  const r = rng(42);
  const noise = [];
  for (let i = 0; i < W; i++) noise.push(r());
  for (let x = 0; x < W; x++) {
    const u = x / W;
    // Anneau C (sombre, fin), B (brillant, épais), division de Cassini, A, division d'Encke
    let a = 0;
    let col = [210, 190, 150];
    if (u < 0.2) { a = 0.18 + 0.12 * u / 0.2; col = [150, 135, 115]; }
    else if (u < 0.56) { a = 0.75 + 0.2 * Math.sin(u * 60); col = [232, 214, 176]; }
    else if (u < 0.62) { a = 0.05; }
    else if (u < 0.94) { a = 0.55 + 0.1 * Math.sin(u * 90); col = [205, 185, 150]; if (u > 0.88 && u < 0.895) a = 0.1; }
    else { a = 0.25 * (1 - (u - 0.94) / 0.06); col = [190, 175, 145]; }
    a *= 0.75 + noise[x] * 0.4;
    const shade = 0.85 + noise[(x * 7) % W] * 0.25;
    for (let y = 0; y < 8; y++) {
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, col[0] * shade);
      img.data[i + 1] = Math.min(255, col[1] * shade);
      img.data[i + 2] = Math.min(255, col[2] * shade);
      img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}

// Halo radial doux (sprites lumineux)
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, g] = canvas(256, 256);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return tex(c);
}

// Soleil "dessin" pour le plan 2D : disque + rayons
export function sun2DTexture() {
  const [c, g] = canvas(512, 512);
  g.translate(256, 256);
  g.fillStyle = '#ffb627';
  for (let i = 0; i < 16; i++) {
    g.save();
    g.rotate((i / 16) * Math.PI * 2);
    g.beginPath();
    const long = i % 2 === 0;
    g.moveTo(-22, -150);
    g.lineTo(0, long ? -248 : -215);
    g.lineTo(22, -150);
    g.closePath();
    g.fill();
    g.restore();
  }
  const grad = g.createRadialGradient(-40, -40, 20, 0, 0, 160);
  grad.addColorStop(0, '#fff2a8');
  grad.addColorStop(0.6, '#ffd23f');
  grad.addColorStop(1, '#ff9f1c');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 158, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#fff7d6';
  g.stroke();
  // Visage souriant
  g.fillStyle = '#7a3d00';
  g.beginPath(); g.arc(-50, -25, 14, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(50, -25, 14, 0, Math.PI * 2); g.fill();
  g.lineWidth = 12; g.lineCap = 'round'; g.strokeStyle = '#7a3d00';
  g.beginPath(); g.arc(0, 15, 60, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,120,80,0.45)';
  g.beginPath(); g.arc(-90, 25, 22, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(90, 25, 22, 0, Math.PI * 2); g.fill();
  return tex(c);
}

// Planète "dessin" pour le plan 2D : disque coloré avec reflet et contour
export function flatPlanetTexture(color, extra) {
  const [c, g] = canvas(256, 256);
  const base = new THREE.Color(color);
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.45).getStyle();
  const dark = base.clone().lerp(new THREE.Color('#000000'), 0.25).getStyle();
  const grad = g.createRadialGradient(95, 90, 10, 128, 128, 120);
  grad.addColorStop(0, light);
  grad.addColorStop(0.55, base.getStyle());
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
  g.save();
  g.clip();
  if (extra === 'bands') {
    g.globalAlpha = 0.25;
    g.fillStyle = dark;
    for (let y = 40; y < 230; y += 34) g.fillRect(0, y, 256, 12);
    g.globalAlpha = 0.8;
    g.fillStyle = '#c1502e';
    g.beginPath(); g.ellipse(160, 160, 22, 12, 0, 0, Math.PI * 2); g.fill();
  } else if (extra === 'earth') {
    g.fillStyle = '#4cc66a';
    [[90, 100, 38, 26], [165, 150, 30, 40], [120, 180, 22, 16], [175, 80, 20, 14]].forEach(([x, y, w, h]) => {
      g.beginPath(); g.ellipse(x, y, w, h, 0.4, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(0, 12, 256, 22); g.fillRect(0, 226, 256, 22);
  } else if (extra === 'craters') {
    g.fillStyle = dark;
    g.globalAlpha = 0.35;
    [[90, 90, 18], [160, 120, 12], [120, 170, 22], [175, 180, 9], [70, 150, 10]].forEach(([x, y, r]) => {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    });
  }
  g.restore();
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  return tex(c);
}

// Anneau de sélection (cercle en pointillés)
export function selectRingTexture() {
  const [c, g] = canvas(256, 256);
  g.translate(128, 128);
  g.lineWidth = 9;
  g.strokeStyle = '#ffffff';
  g.lineCap = 'round';
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    g.beginPath();
    g.arc(0, 0, 112, a0, a0 + (Math.PI * 2) / n * 0.55);
    g.stroke();
  }
  return tex(c);
}

// Épingle "Tu es ici"
export function pinTexture() {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,80,120,1)');
  grad.addColorStop(0.35, 'rgba(255,80,120,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.62, 'rgba(255,80,120,0.35)');
  grad.addColorStop(1, 'rgba(255,80,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}
