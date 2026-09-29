// Planches de portraits de toutes les créatures et de tous les boss (données installées)
// Usage : node dev/bestiary.mjs URL dossier [ids séparés par des virgules]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir, only = ''] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 240)); });
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 600000 });
const ids = await page.evaluate(async (only) => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  g._loop = () => {};
  document.getElementById('hud').style.display = 'none';
  const { ENEMIES } = await import('/src/data/enemies.js');
  const { BOSSES } = await import('/src/data/bosses.js');
  g.player.mesh.visible = false;
  for (const e of g.enemies) e.mesh.visible = false;
  window.__lamp = new g.hemi.constructor(0xffffff, 0x303040, 1.3);
  g.scene.add(window.__lamp);
  const list = only ? only.split(',') : [...ENEMIES, ...BOSSES].map((d) => d.id);
  return list;
}, only);
const shots = [];
for (const id of ids) {
  const info = await page.evaluate(async (id) => {
    const g = window.__game;
    const { enemyById } = await import('/src/data/enemies.js');
    const { bossById } = await import('/src/data/bosses.js');
    const { Enemy } = await import('/src/game/enemy.js');
    if (window.__cur) { window.__cur.removeModel(); window.__cur = null; }
    const def = enemyById(id) || bossById(id);
    const P = g.player;
    const e = new Enemy(g, def, P.pos.x, P.pos.z - 3, { tier: 1 });
    e.setModel(e.built, {});
    e.yaw = 0.5;
    for (let i = 0; i < 20; i++) { e.anim.update(1 / 60, { speed: 0 }); e.updateVisual(1 / 60); }
    e.mesh.position.set(e.pos.x, e.pos.y, e.pos.z);
    e.mesh.rotation.y = e.yaw;
    e.mesh.updateMatrixWorld(true);
    const box = new (g.hemi.position.constructor)();
    const h = e.height || 1.9;
    const d = Math.max(1.6, h * 1.25);
    g.camRig.update = () => {};
    g.camera.position.set(e.pos.x + Math.sin(0.5) * d * 0.25, e.pos.y + h * 0.65, e.pos.z + d);
    g.camera.lookAt(e.pos.x, e.pos.y + h * 0.48, e.pos.z);
    g.render(1 / 60);
    window.__cur = e;
    const geo = e.mesh.geometry;
    return { id, name: def.name, sculpted: !!e.built.sculpted, verts: geo.attributes.position.count };
  }, id);
  const file = `${outDir}/b_${id}.png`;
  await page.screenshot({ path: file });
  shots.push({ ...info, file });
}
console.log(JSON.stringify(shots.map((s) => [s.id, s.sculpted ? 'HD' : '--', s.verts])));
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
