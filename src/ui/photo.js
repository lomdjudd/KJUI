import * as THREE from 'three';
import * as A from '../player/anims.js';
import { clamp } from '../engine/utils.js';

const $ = (id) => document.getElementById(id);

const FILTERS = [
  { name: 'Normal', css: 'none' },
  { name: 'Noir et blanc', css: 'grayscale(1) contrast(1.25)' },
  { name: 'Sépia', css: 'sepia(0.85) contrast(1.05)' },
  { name: 'Comics', css: 'saturate(2) contrast(1.4)' },
  { name: 'Rétro', css: 'sepia(0.4) hue-rotate(-20deg) saturate(1.4)' },
  { name: 'Néon', css: 'hue-rotate(150deg) saturate(1.7) contrast(1.1)' },
  { name: 'Rêve', css: 'brightness(1.15) saturate(1.35) blur(0.6px)' },
];

const POSES = [
  { name: 'Libre', pose: null },
  { name: 'Héroïque', pose: (t) => ({ ...A.idle(t), lShoulder: [0.1, 0, 0.5], rShoulder: [0.1, 0, -0.5], lElbow: [-1.6, 0, 0], rElbow: [-1.6, 0, 0], chest: [-0.1, 0, 0] }) },
  { name: 'Accroupi', pose: (t) => A.perch(t) },
  { name: 'Victoire', pose: (t) => A.cheer(t) },
  { name: 'Coup de pied', pose: () => A.ATTACKS.roundhouse.strike },
  { name: 'Tir de toile', pose: () => A.ATTACKS.webWhip.strike },
  { name: 'Salto', pose: () => ({ ...A.dodgePose('back', 0.5) }) },
];

// Mode photo : caméra libre, filtres, poses, capture PNG
export class PhotoMode {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.ui = $('photo-ui');
    this.filter = 0;
    this.pose = 0;
    this.yaw = 0;
    this.pitch = 0.1;
    this.dist = 4;
    this.height = 1.1;
    const on = (id, fn) =>
      $(id).addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.game.audio.play('ui');
        fn();
      });
    on('ph-filter-prev', () => this.setFilter(this.filter - 1));
    on('ph-filter-next', () => this.setFilter(this.filter + 1));
    on('ph-pose-prev', () => this.setPose(this.pose - 1));
    on('ph-pose-next', () => this.setPose(this.pose + 1));
    on('ph-zoom-in', () => (this.dist = clamp(this.dist - 0.8, 1.6, 20)));
    on('ph-zoom-out', () => (this.dist = clamp(this.dist + 0.8, 1.6, 20)));
    on('ph-shot', () => this.capture());
    on('ph-close', () => this.close());
    // glisser pour tourner la caméra (souris et tactile)
    const drag = $('photo-drag');
    let last = null;
    drag.addEventListener('pointerdown', (e) => {
      last = { x: e.clientX, y: e.clientY };
      drag.setPointerCapture(e.pointerId);
    });
    drag.addEventListener('pointermove', (e) => {
      if (!last) return;
      this.yaw -= (e.clientX - last.x) * 0.008;
      this.pitch = clamp(this.pitch + (e.clientY - last.y) * 0.006, -1.2, 1.3);
      last = { x: e.clientX, y: e.clientY };
    });
    const up = () => (last = null);
    drag.addEventListener('pointerup', up);
    drag.addEventListener('pointercancel', up);
    drag.addEventListener(
      'wheel',
      (e) => {
        this.dist = clamp(this.dist + Math.sign(e.deltaY) * 0.6, 1.6, 20);
      },
      { passive: true },
    );
  }

  setFilter(i) {
    this.filter = (i + FILTERS.length) % FILTERS.length;
    this.game.renderer.domElement.style.filter = FILTERS[this.filter].css === 'none' ? '' : FILTERS[this.filter].css;
    $('ph-filter').textContent = FILTERS[this.filter].name;
  }

  setPose(i) {
    this.pose = (i + POSES.length) % POSES.length;
    $('ph-pose').textContent = POSES[this.pose].name;
  }

  open() {
    const g = this.game;
    if (this.active || g.mode !== 'play') return;
    this.active = true;
    this.yaw = g.cam.yaw;
    this.pitch = g.cam.pitch;
    this.dist = 4.5;
    g.input.enabled = false;
    g.input.exitPointerLock();
    g.hud.show(false);
    document.getElementById('touch-ui').classList.add('off');
    this.ui.classList.remove('hidden');
    this.setFilter(this.filter);
    this.setPose(0);
  }

  close() {
    const g = this.game;
    this.active = false;
    g.input.enabled = true;
    g.input.reset();
    g.renderer.domElement.style.filter = '';
    this.ui.classList.add('hidden');
    g.hud.show(true);
    document.getElementById('touch-ui').classList.remove('off');
    g.cam.yaw = this.yaw;
  }

  update(dt, input) {
    const g = this.game;
    const look = input.consumeLook();
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch + look.y, -1.2, 1.3);
    if (input.keys.has('KeyW')) this.dist = clamp(this.dist - dt * 4, 1.6, 20);
    if (input.keys.has('KeyS')) this.dist = clamp(this.dist + dt * 4, 1.6, 20);
    const p = g.player;
    const target = new THREE.Vector3(p.pos.x, p.pos.y + this.height, p.pos.z);
    const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    g.camera.position.copy(target).addScaledVector(f, -this.dist);
    g.camera.lookAt(target);
    const po = POSES[this.pose];
    if (po.pose) p.rig.apply(po.pose(g.time), dt, 10);
  }

  capture() {
    const g = this.game;
    g.render();
    const src = g.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d');
    const css = FILTERS[this.filter].css;
    if (css !== 'none' && 'filter' in ctx) ctx.filter = css;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    // signature façon Daily Bugle
    ctx.font = `bold ${Math.round(c.height * 0.04)}px Impact, Arial Black, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText('SPIDER-MAN · MONDE OUVERT', c.width - 20, c.height - 20);
    g.audio.play('ui');
    const msg = (t) => {
      const el = $('ph-msg');
      el.textContent = t;
      clearTimeout(this._msgT);
      this._msgT = setTimeout(() => (el.textContent = ''), 2500);
    };
    try {
      const url = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `spiderman-photo-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      msg('📸 Photo enregistrée !');
    } catch {
      msg('Impossible d’enregistrer la photo ici');
    }
    g.stat('photos');
  }
}
