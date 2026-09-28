// Carte de la région : rendu 2D pré-calculé (relief, chemins, eau, bâtiments) + marqueurs.
import { ZONES } from '../data/zones.js';
import { clamp } from '../core/utils.js';

export function renderZoneMap(world, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const t = world.terrain;
  const zone = world.zone;
  const half = t.half;
  const liq = world.liquidLevel;
  const pal = zone.palette;
  const base = hexToRgb(pal.fog);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = -half + (x / size) * t.size;
      const wz = -half + (y / size) * t.size;
      const h = t.heightAt(wx, wz);
      const hx = t.heightAt(wx + 1.5, wz);
      const shade = clamp(0.55 + (h - hx) * 0.18 + h * 0.012, 0.15, 1.2);
      let r = 40 + base[0] * 0.35;
      let gg = 34 + base[1] * 0.35;
      let b = 44 + base[2] * 0.35;
      const path = t.pathAt(wx, wz);
      if (path > 0.3) {
        r += 45 * path;
        gg += 38 * path;
        b += 28 * path;
      }
      if (h < liq) {
        if (zone.terrain.lava) {
          r = 200;
          gg = 70;
          b = 20;
        } else {
          r = 20;
          gg = 40;
          b = 36;
        }
      }
      const i = (y * size + x) * 4;
      img.data[i] = r * shade;
      img.data[i + 1] = gg * shade;
      img.data[i + 2] = b * shade;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Obstacles (bâtiments, murs, rochers)
  const k = size / t.size;
  g.fillStyle = 'rgba(10,8,14,0.85)';
  for (const col of world.colliders.list) {
    if (col.y1 - col.y0 < 1.5) continue;
    if (col.type === 0) {
      if (col.r < 0.6) continue;
      g.beginPath();
      g.arc((col.x + half) * k, (col.z + half) * k, Math.max(1, col.r * k), 0, Math.PI * 2);
      g.fill();
    } else {
      g.save();
      g.translate((col.x + half) * k, (col.z + half) * k);
      g.rotate(Math.atan2(col.sin, col.cos));
      g.fillRect(-col.hw * k, -col.hd * k, col.hw * 2 * k, col.hd * 2 * k);
      g.restore();
    }
  }
  // Vignette
  const grd = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.65)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

function hexToRgb(h) {
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
}

// Symboles de la carte
export function mapSymbols(game) {
  const out = [];
  const w = game.world;
  const p = game.profile;
  for (const it of w.interactables) {
    if (it.type === 'altar') out.push({ x: it.x, z: it.z, kind: 'altar', lit: p.altars.includes(it.id), label: it.name });
    else if (it.type === 'portal') out.push({ x: it.x, z: it.z, kind: 'portal', label: it.name });
    else if (it.type === 'npc') out.push({ x: it.x, z: it.z, kind: 'npc' });
    else if (it.type === 'arena') out.push({ x: it.x, z: it.z, kind: p.bosses[it.boss] ? 'bossDone' : 'boss' });
    else if (it.type === 'poi') out.push({ x: it.x, z: it.z, kind: p.pois[it.id] ? 'poiDone' : 'poi', label: it.name });
  }
  for (const c of game.chests) if (!c.opened) out.push({ x: c.x, z: c.z, kind: 'chest' });
  for (const m of game.quests.markers()) out.push({ x: m.x, z: m.z, kind: m.main ? 'questMain' : 'questSide' });
  return out;
}

export const SYMBOL_STYLE = {
  altar: { color: '#ff9a3a', shape: 'flame', r: 5 },
  portal: { color: '#b56aff', shape: 'ring', r: 6 },
  npc: { color: '#7aff9a', shape: 'dot', r: 3 },
  boss: { color: '#ff3a3a', shape: 'skull', r: 6 },
  bossDone: { color: '#6a5a5a', shape: 'skull', r: 5 },
  poi: { color: '#e8dcc8', shape: 'diamond', r: 4 },
  poiDone: { color: '#6a6070', shape: 'diamond', r: 3 },
  chest: { color: '#f0c850', shape: 'square', r: 3 },
  questMain: { color: '#f0d48a', shape: 'marker', r: 6 },
  questSide: { color: '#8ad0ff', shape: 'marker', r: 5 },
  enemy: { color: '#ff4040', shape: 'dot', r: 2.2 },
};

export function drawSymbol(g, x, y, kind, scale = 1) {
  const s = SYMBOL_STYLE[kind];
  if (!s) return;
  const r = s.r * scale;
  g.fillStyle = s.color;
  g.strokeStyle = s.color;
  g.lineWidth = 1.5 * scale;
  g.beginPath();
  switch (s.shape) {
    case 'diamond':
    case 'marker':
      g.moveTo(x, y - r);
      g.lineTo(x + r, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r, y);
      g.closePath();
      if (s.shape === 'marker') {
        g.shadowColor = s.color;
        g.shadowBlur = 8;
      }
      g.fill();
      g.shadowBlur = 0;
      break;
    case 'ring':
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
      break;
    case 'square':
      g.fillRect(x - r, y - r, r * 2, r * 2);
      break;
    case 'flame':
      g.moveTo(x, y - r * 1.3);
      g.quadraticCurveTo(x + r, y, x, y + r);
      g.quadraticCurveTo(x - r, y, x, y - r * 1.3);
      g.fill();
      break;
    case 'skull':
      g.arc(x, y - r * 0.2, r * 0.8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#000';
      g.fillRect(x - r * 0.45, y - r * 0.3, r * 0.3, r * 0.3);
      g.fillRect(x + r * 0.15, y - r * 0.3, r * 0.3, r * 0.3);
      break;
    default:
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
  }
}

export function zoneById(id) {
  return ZONES[id];
}
