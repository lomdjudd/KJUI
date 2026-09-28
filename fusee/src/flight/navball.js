// Indicateur d'attitude (« boule de navigation » plane, adaptée au vol 2D) :
// ciel/sol selon l'horizon local, nez du vaisseau en haut, marqueurs
// prograde, rétrograde, radial, manœuvre et cible sur la couronne.

const TAU = Math.PI * 2;

function markerPath(ctx, kind, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  if (kind === 'pro') {
    ctx.arc(0, 0, s * 0.45, 0, TAU);
    ctx.moveTo(-s * 0.45, 0); ctx.lineTo(-s, 0);
    ctx.moveTo(s * 0.45, 0); ctx.lineTo(s, 0);
    ctx.moveTo(0, -s * 0.45); ctx.lineTo(0, -s * 0.9);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill();
  } else if (kind === 'retro') {
    ctx.arc(0, 0, s * 0.45, 0, TAU);
    const k = s * 0.32;
    ctx.moveTo(-k, -k); ctx.lineTo(k, k); ctx.moveTo(k, -k); ctx.lineTo(-k, k);
    ctx.moveTo(0, s * 0.45); ctx.lineTo(0, s * 0.9);
    ctx.moveTo(-s * 0.45 * 0.7, -s * 0.45 * 0.7); ctx.lineTo(-s * 0.8, -s * 0.8);
    ctx.moveTo(s * 0.45 * 0.7, -s * 0.45 * 0.7); ctx.lineTo(s * 0.8, -s * 0.8);
    ctx.stroke();
  } else if (kind === 'radout' || kind === 'radin') {
    ctx.arc(0, 0, s * 0.42, 0, TAU);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - Math.PI / 2;
      const r0 = kind === 'radout' ? s * 0.42 : s * 0.9, r1 = kind === 'radout' ? s * 0.9 : s * 0.42;
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    }
    ctx.stroke();
  } else if (kind === 'node') {
    ctx.lineWidth = 2.6;
    ctx.arc(0, 0, s * 0.55, 0.3, Math.PI - 0.3);
    ctx.moveTo(s * 0.55 * Math.cos(Math.PI + 0.3), s * 0.55 * Math.sin(Math.PI + 0.3));
    ctx.arc(0, 0, s * 0.55, Math.PI + 0.3, TAU - 0.3);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
  } else if (kind === 'target') {
    ctx.arc(0, 0, s * 0.5, 0, TAU);
    ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, -s);
    ctx.moveTo(0, s * 0.5); ctx.lineTo(0, s);
    ctx.moveTo(-s * 0.5, 0); ctx.lineTo(-s, 0);
    ctx.moveTo(s * 0.5, 0); ctx.lineTo(s, 0);
    ctx.stroke();
  }
  ctx.restore();
}

export class Navball {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = 0;
  }

  // a : { nose, up, markers: [{kind, ang}], mode, pitchDeg, throttle, heat }
  draw(a) {
    const c = this.c;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(c.clientWidth * dpr);
    if (W !== this.size) { c.width = c.height = W; this.size = W; }
    const ctx = this.ctx;
    const R = W / 2;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.translate(R, R);
    // angle écran (sens horaire depuis le haut) d'une direction monde
    const scr = (ang) => ang - a.nose; // vue depuis -Z : le sens trigo apparaît horaire
    // disque ciel / sol
    const rIn = R * 0.8;
    const upS = scr(a.up);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, rIn, 0, TAU);
    ctx.clip();
    ctx.rotate(upS);
    const sky = ctx.createLinearGradient(0, -rIn, 0, 0);
    sky.addColorStop(0, '#1d5fb8');
    sky.addColorStop(1, '#5aa8f0');
    ctx.fillStyle = sky;
    ctx.fillRect(-rIn, -rIn, rIn * 2, rIn);
    const gnd = ctx.createLinearGradient(0, 0, 0, rIn);
    gnd.addColorStop(0, '#8a5a2e');
    gnd.addColorStop(1, '#4a2c14');
    ctx.fillStyle = gnd;
    ctx.fillRect(-rIn, 0, rIn * 2, rIn);
    // graduations d'inclinaison
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.2;
    ctx.font = `${Math.round(R * 0.09)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.moveTo(-rIn, 0); ctx.lineTo(rIn, 0);
    ctx.stroke();
    ctx.restore();
    // couronne de degrés (par rapport à la verticale locale)
    ctx.save();
    ctx.rotate(upS);
    for (let d = 0; d < 360; d += 10) {
      const ang = (d * Math.PI) / 180;
      const long = d % 30 === 0;
      ctx.strokeStyle = long ? 'rgba(220,230,245,0.9)' : 'rgba(220,230,245,0.4)';
      ctx.lineWidth = long ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.sin(ang) * rIn, -Math.cos(ang) * rIn);
      ctx.lineTo(Math.sin(ang) * (rIn + (long ? R * 0.07 : R * 0.04)), -Math.cos(ang) * (rIn + (long ? R * 0.07 : R * 0.04)));
      ctx.stroke();
    }
    ctx.restore();
    // bord
    ctx.strokeStyle = 'rgba(160,190,230,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, rIn, 0, TAU);
    ctx.stroke();
    // marqueurs sur la couronne
    const rm = R * 0.9;
    const colors = { pro: '#b6ff4d', retro: '#b6ff4d', radout: '#5cd6ff', radin: '#5cd6ff', node: '#4d8dff', target: '#ff5ce1' };
    for (const m of a.markers) {
      const s = scr(m.ang);
      const x = Math.sin(s) * rm, y = -Math.cos(s) * rm;
      markerPath(ctx, m.kind, x, y, R * 0.11, colors[m.kind]);
      // marqueur intérieur si proche du nez
      const d = Math.atan2(Math.sin(s), Math.cos(s));
      if (Math.abs(d) < 0.6) {
        const k = Math.abs(d) / 0.6;
        markerPath(ctx, m.kind, Math.sin(s) * rIn * k * 0.85, -Math.cos(s) * rIn * k * 0.85, R * 0.1, colors[m.kind]);
      }
    }
    // symbole du vaisseau (fixe)
    ctx.strokeStyle = '#ffc245';
    ctx.fillStyle = '#ffc245';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(-R * 0.3, R * 0.02);
    ctx.lineTo(-R * 0.1, R * 0.02);
    ctx.lineTo(0, -R * 0.08);
    ctx.lineTo(R * 0.1, R * 0.02);
    ctx.lineTo(R * 0.3, R * 0.02);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -rIn + 2);
    ctx.lineTo(-R * 0.05, -rIn + R * 0.1);
    ctx.lineTo(R * 0.05, -rIn + R * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // textes
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `600 ${Math.round(R * 0.1)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${a.pitchDeg.toFixed(0)}°`, 0, R * 0.42);
    ctx.font = `600 ${Math.round(R * 0.075)}px "Saira Condensed", sans-serif`;
    ctx.fillStyle = 'rgba(210,225,245,0.85)';
    ctx.fillText(a.mode === 'surface' ? 'SURFACE' : 'ORBITE', 0, R * 0.58);
    ctx.restore();
  }
}
