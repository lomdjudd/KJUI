// Vignettes des astres et des engins, rendues en 3D à partir des vraies
// textures NASA (elles remplacent les emojis dans l'interface).
import * as THREE from 'three';
import { saturnRingTexture, uranusTexture } from './textures.js';

export const THUMBS = {};

function withRenderer(size, fn) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  let r;
  try {
    r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch (e) {
    return;
  }
  r.setPixelRatio(1);
  r.setSize(size, size, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  try { fn(r, canvas); } finally { r.dispose(); r.forceContextLoss(); }
}

function lightRig(scene) {
  const key = new THREE.DirectionalLight(0xfff3e2, 3.2);
  key.position.set(-2.4, 1.4, 3);
  scene.add(key, new THREE.AmbientLight(0x8090c0, 0.3));
}

// Astres : sphère texturée éclairée de côté, comme sur une photo de sonde
export function renderBodyThumbs(T, size = 192) {
  const maps = {
    sun: null, mercury: T.moon, venus: T.venus, earth: T.earthDay, moon: T.moon, mars: T.mars, jupiter: T.jupiter,
    saturn: T.saturn, uranus: uranusTexture(), neptune: T.neptune, pluto: T.pluto,
  };
  withRenderer(size, (r, canvas) => {
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    Object.entries(maps).forEach(([id, map]) => {
      const scene = new THREE.Scene();
      lightRig(scene);
      let mat;
      if (id === 'sun') {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(128, 128, 20, 128, 128, 128);
        grad.addColorStop(0, '#fff6c8'); grad.addColorStop(0.5, '#ffc04a'); grad.addColorStop(1, '#ff7a12');
        g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,180' : '200,80,10'},0.18)`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 0, 7); g.fill(); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        mat = new THREE.MeshBasicMaterial({ map: t });
      } else {
        map.colorSpace = THREE.SRGBColorSpace;
        mat = new THREE.MeshStandardMaterial({ map, roughness: 1 });
        if (id === 'mercury') mat.color.set('#d8c3ae');
        if (id === 'venus') mat.color.set('#ffe2b0');
      }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
      ball.rotation.y = id === 'earth' ? -1.85 : id === 'jupiter' ? 0.6 : 0.4;
      scene.add(ball);
      let dist = 4.4;
      if (id === 'saturn') {
        const tilt = new THREE.Group();
        tilt.rotation.set(0.42, 0, 0.35);
        tilt.add(ball);
        const ringGeo = new THREE.RingGeometry(1.24, 2.3, 128, 1);
        const pos = ringGeo.attributes.position, uv = ringGeo.attributes.uv, v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - 1.24) / 1.06, 0.5); }
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: saturnRingTexture(), transparent: true, side: THREE.DoubleSide, color: 0xd9d2c4 }));
        ring.rotation.x = -Math.PI / 2;
        tilt.add(ring);
        scene.add(tilt);
        dist = 8.6;
      }
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      r.clear();
      r.render(scene, camera);
      THUMBS[id] = canvas.toDataURL('image/png');
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    });
  });
}

// Engins : rendu du modèle 3D de la NASA, vu de trois quarts
export function renderCraftThumbs(crafts, size = 192) {
  withRenderer(size, (r, canvas) => {
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    crafts.forEach((c, id) => {
      const scene = new THREE.Scene();
      lightRig(scene);
      scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x302418, 0.9));
      const m = c.model.clone(true);
      const box = new THREE.Box3().setFromObject(m);
      const center = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3()).length();
      m.position.sub(center);
      const holder = new THREE.Group();
      holder.add(m);
      holder.rotation.set(0.35, -0.7, 0);
      scene.add(holder);
      camera.position.set(0, 0, s * 1.75);
      camera.lookAt(0, 0, 0);
      r.clear();
      r.render(scene, camera);
      THUMBS[id] = canvas.toDataURL('image/png');
    });
  });
}

// <img> d'un astre ou d'un engin (ou un disque coloré en attendant)
export function thumb(id, color = '#8894b0', cls = 'thumb') {
  if (THUMBS[id]) return `<img class="${cls}" src="${THUMBS[id]}" alt="" draggable="false">`;
  return `<span class="${cls} thumb-ph" style="--c:${color}"></span>`;
}
