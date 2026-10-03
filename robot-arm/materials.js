import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Textures procédurales (aucun fichier externe : tout est généré sur canvas)
// ---------------------------------------------------------------------------

function canvasTexture(size, draw, { repeat = 1, srgb = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Acier brossé : fines stries horizontales servant de roughnessMap
function brushedTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = 'rgb(120,120,120)';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = 70 + Math.random() * 130;
      ctx.strokeStyle = `rgba(${v},${v},${v},${0.08 + Math.random() * 0.25})`;
      ctx.lineWidth = Math.random() * 1.4 + 0.2;
      const y = Math.random() * s;
      const x = Math.random() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40 + Math.random() * 220, y + (Math.random() - 0.5) * 1.5);
      ctx.stroke();
    }
  }, { repeat: 2 });
}

// « Peau d'orange » de la peinture poudre : micro relief pour le bumpMap
function peelTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const v = 90 + Math.random() * 90;
      ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, Math.random() * 1.6 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: 6 });
}

// Béton ciré du sol
export function concreteTexture() {
  return canvasTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#4a4f57';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 26000; i++) {
      const v = 60 + Math.random() * 60;
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 6},${Math.random() * 0.18})`;
      const r = Math.random() * 3 + 0.5;
      ctx.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
    // quelques taches plus claires / plus sombres
    for (let i = 0; i < 40; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 90 + Math.random() * 140);
      const dark = Math.random() > 0.5;
      g.addColorStop(0, dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.translate(Math.random() * s, Math.random() * s);
      ctx.fillStyle = g;
      ctx.fillRect(-250, -250, 500, 500);
      ctx.restore();
    }
    // joints de dilatation
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, s, s);
  }, { repeat: 7, srgb: true });
}

// Dégradé de fond de scène
export function backgroundTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#222b3b');
  g.addColorStop(0.55, '#121721');
  g.addColorStop(1, '#0a0d13');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Voile radial pour estomper le sol vers l'horizon
export function radialAlphaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.55, '#fff');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Marquage au sol : cercle de sécurité + zone de travail
export function floorMarkingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.translate(512, 512);
  const S = 512 / 1.7; // 1 m = S pixels
  // anneau de sécurité jaune/noir
  const rIn = 0.64 * S;
  const rOut = 0.74 * S;
  const n = 48;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, rOut, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
    ctx.arc(0, 0, rIn, ((i + 1) / n) * Math.PI * 2, (i / n) * Math.PI * 2, true);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#15181d' : '#f2b705';
    ctx.fill();
  }
  // enveloppe de travail (pointillés)
  ctx.strokeStyle = 'rgba(255,196,0,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.arc(0, 0, 1.38 * S, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1.55 * S, 0);
  ctx.lineTo(1.55 * S, 0);
  ctx.moveTo(0, -1.55 * S);
  ctx.lineTo(0, 1.55 * S);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------
// Matériaux PBR
// ---------------------------------------------------------------------------

export function makeMaterials() {
  const brushed = brushedTexture();
  const peel = peelTexture();

  return {
    paint: new THREE.MeshPhysicalMaterial({
      name: 'Peinture orange industrielle',
      color: 0xf2630f,
      roughness: 0.4,
      metalness: 0.1,
      clearcoat: 0.9,
      clearcoatRoughness: 0.18,
      bumpMap: peel,
      bumpScale: 0.35,
    }),
    graphite: new THREE.MeshStandardMaterial({
      name: 'Aluminium anodisé graphite',
      color: 0x2b2f37,
      roughness: 0.46,
      metalness: 0.75,
    }),
    steel: new THREE.MeshPhysicalMaterial({
      name: 'Acier inoxydable brossé',
      color: 0xd6dae0,
      roughness: 0.34,
      metalness: 1,
      roughnessMap: brushed,
      anisotropy: 0.5,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      name: 'Acier bruni',
      color: 0x6e737b,
      roughness: 0.42,
      metalness: 1,
      roughnessMap: brushed,
    }),
    rubber: new THREE.MeshStandardMaterial({
      name: 'Caoutchouc nitrile',
      color: 0x16171a,
      roughness: 0.92,
      metalness: 0,
    }),
    cable: new THREE.MeshStandardMaterial({
      name: 'Gaine PVC',
      color: 0x1d2026,
      roughness: 0.5,
      metalness: 0,
    }),
    copper: new THREE.MeshStandardMaterial({
      name: 'Bobinage cuivre',
      color: 0xc77b3a,
      roughness: 0.3,
      metalness: 1,
    }),
    pcb: new THREE.MeshStandardMaterial({
      name: 'Circuit imprimé FR4',
      color: 0x0d6a37,
      roughness: 0.5,
      metalness: 0.1,
    }),
    chip: new THREE.MeshStandardMaterial({
      name: 'Composant électronique',
      color: 0x0c0d10,
      roughness: 0.35,
      metalness: 0.2,
    }),
    gold: new THREE.MeshStandardMaterial({
      name: 'Contacts dorés',
      color: 0xe0b04a,
      roughness: 0.25,
      metalness: 1,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      name: 'Verre optique',
      color: 0x05080d,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 0.9,
    }),
    ledGreen: new THREE.MeshStandardMaterial({
      name: 'LED',
      color: 0x0a2a14,
      emissive: 0x2dff7a,
      emissiveIntensity: 2.2,
    }),
    cube: new THREE.MeshPhysicalMaterial({
      color: 0x18a9c9,
      roughness: 0.35,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
    }),
    yellow: new THREE.MeshStandardMaterial({
      color: 0xf2b705,
      roughness: 0.55,
      metalness: 0.1,
    }),
  };
}
