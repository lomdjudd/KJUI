// Décors de l'atelier : hall d'assemblage (3D) et plan technique (2D).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Simplex3 } from '../core/noise.js';

function canvasTex(w, h, draw, repeat = 1, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

export function buildHangar(renderer) {
  const grp = new THREE.Group();
  const S = new Simplex3(9);

  // Sol en béton poli avec marquages
  const floorTex = canvasTex(1024, 1024, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = S.fbm(x / 90, y / 90, 0.5, 5) * 0.5 + 0.5;
      const n2 = S.noise(x / 9, y / 9, 3) * 0.5 + 0.5;
      const v = 58 + n * 26 + n2 * 6;
      const i = (y * w + x) * 4;
      img.data[i] = v; img.data[i + 1] = v + 2; img.data[i + 2] = v + 6; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / 8, 0); ctx.lineTo((i * w) / 8, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 8); ctx.lineTo(w, (i * h) / 8); ctx.stroke();
    }
  }, 6);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(90, 64),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.0, color: '#8a8f98', envMapIntensity: 0.35 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  grp.add(floor);

  // Plateforme tournante d'assemblage
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.3, 0.35, 64), new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.4, metalness: 0.6 }));
  plat.position.y = -0.175;
  plat.receiveShadow = true;
  grp.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.05, 0.05, 8, 96), new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffb23e'), emissiveIntensity: 3 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  grp.add(ring);
  const markTex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,190,80,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r1 = w * 0.42, r2 = i % 3 ? w * 0.4 : w * 0.37;
      ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); ctx.lineTo(w / 2 + Math.cos(a) * r2, h / 2 + Math.sin(a) * r2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.12); ctx.lineTo(w / 2, h * 0.88); ctx.moveTo(w * 0.12, h / 2); ctx.lineTo(w * 0.88, h / 2); ctx.stroke();
  }, 1);
  markTex.wrapS = markTex.wrapT = THREE.ClampToEdgeWrapping;
  const marks = new THREE.Mesh(new THREE.CircleGeometry(6.8, 64), new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false }));
  marks.rotation.x = -Math.PI / 2;
  marks.position.y = 0.012;
  grp.add(marks);

  // Murs du hall : panneaux verticaux et bandeaux lumineux
  const wallTex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1b2029';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const x = (i * w) / 8;
      const g = ctx.createLinearGradient(x, 0, x + w / 8, 0);
      g.addColorStop(0, '#232933');
      g.addColorStop(0.5, '#1d222b');
      g.addColorStop(1, '#161a21');
      ctx.fillStyle = g;
      ctx.fillRect(x + 2, 0, w / 8 - 4, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 1);
  }, 1);
  wallTex.repeat.set(12, 6);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, metalness: 0.3, side: THREE.BackSide });
  const hall = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 140, 48, 1, true), wallMat);
  hall.position.y = 70;
  grp.add(hall);
  const lightMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#dfe9ff'), emissiveIntensity: 2.2 });
  for (let k = 0; k < 4; k++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(59.6, 59.6, 0.35, 48, 1, true), lightMat);
    band.material.side = THREE.BackSide;
    band.position.y = 18 + k * 30;
    grp.add(band);
  }
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: '#12161d', roughness: 0.9 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 140;
  grp.add(ceiling);

  // Grande porte ouverte sur le ciel du soir
  const skyTex = canvasTex(256, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0d1b3d');
    g.addColorStop(0.55, '#3a4f86');
    g.addColorStop(0.8, '#e7925a');
    g.addColorStop(0.9, '#ffcf8f');
    g.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * w, Math.random() * h * 0.45, 1, 1);
  }, 1);
  skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(34, 110), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: true, color: new THREE.Color(1.6, 1.6, 1.6) }));
  door.position.set(0, 55, 59);
  door.rotation.y = Math.PI;
  grp.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(36, 112, 1), new THREE.MeshStandardMaterial({ color: '#2a2f38', metalness: 0.7, roughness: 0.4 }));
  doorFrame.position.set(0, 55, 59.6);
  grp.add(doorFrame);

  // Tours d'échafaudage de part et d'autre
  const trussMat = new THREE.MeshStandardMaterial({ color: '#d98a1c', roughness: 0.55, metalness: 0.4 });
  const greyMat = new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.6, metalness: 0.5 });
  for (const sx of [-1, 1]) {
    const tower = new THREE.Group();
    const H = 110, W = 3;
    for (const cx of [-W / 2, W / 2]) for (const cz of [-W / 2, W / 2]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.25, H, 0.25), trussMat);
      c.position.set(cx, H / 2, cz);
      tower.add(c);
    }
    for (let y = 0; y < H; y += 3) {
      for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
        const p1 = new THREE.Vector3((a[0] * W) / 2, y, (a[1] * W) / 2), p2 = new THREE.Vector3((b[0] * W) / 2, y + 3, (b[1] * W) / 2);
        const len = p1.distanceTo(p2);
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, len, 0.1), trussMat);
        m.position.copy(p1).add(p2).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
        tower.add(m);
      }
      if (y % 12 === 0) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.12, W + 0.6), greyMat);
        pl.position.y = y;
        tower.add(pl);
      }
    }
    tower.position.set(sx * 16, 0, 6);
    grp.add(tower);
  }

  // Éclairage
  const hemi = new THREE.HemisphereLight('#cfe0ff', '#3b3229', 0.25);
  grp.add(hemi);
  const key = new THREE.DirectionalLight('#fff4e4', 1.6);
  key.position.set(-30, 60, -40);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 60;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 200;
  key.shadow.bias = -0.0004;
  grp.add(key);
  grp.add(key.target);
  const rim = new THREE.DirectionalLight('#9cc4ff', 0.8);
  rim.position.set(40, 30, 50);
  grp.add(rim);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return { group: grp, env, key };
}

// Plan technique (mode 2D) : grille bleue, règle de hauteur
export function buildBlueprint() {
  const grp = new THREE.Group();
  const tex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#123a73';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(180,215,255,0.13)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / 10, 0); ctx.lineTo((i * w) / 10, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 10); ctx.lineTo(w, (i * h) / 10); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(200,228,255,0.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  }, 1);
  // 1 tuile = 5 m
  tex.repeat.set(80, 80);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ map: tex }));
  plane.position.set(0, 0, 60);
  plane.rotation.y = Math.PI;
  grp.add(plane);
  // Sol (ligne de base)
  const base = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.08), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
  base.position.set(0, 0, 50);
  base.rotation.y = Math.PI;
  grp.add(base);
  const hemi = new THREE.HemisphereLight('#e8f0ff', '#20304a', 0.55);
  grp.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(20, 30, -50);
  grp.add(key);
  return { group: grp };
}
