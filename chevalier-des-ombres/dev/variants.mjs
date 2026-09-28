// Galerie des variantes du chevalier HD (ennemis et boss) alignées dans le Havre
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 600 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
await page.evaluate(async () => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  g._loop = () => {};
  document.getElementById('hud').style.display = 'none';
  const { enemyById } = await import('/src/data/enemies.js');
  const { bossById } = await import('/src/data/bosses.js');
  const { Enemy } = await import('/src/game/enemy.js');
  const ids = ['skeleton_knight', 'living_armor', 'fallen_knight', 'horned_knight_minion', 'frozen_revenant', 'void_knight'];
  const p = g.player.pos;
  ids.forEach((id, i) => { const e = new Enemy(g, enemyById(id), p.x - 6 + i * 2.4, p.z - 5, { tier: 3 }); e.yaw = Math.PI * 0; e.state = 'idle'; e.update = () => { e.anim.update(1 / 60, { speed: 0 }); e.updateVisual(1 / 60); }; g.enemies.push(e); });
  const bdef = bossById('horned_knight');
  const b = new Enemy(g, bdef, p.x + 9, p.z - 7, { tier: 4 }); b.update = () => { b.anim.update(1 / 60, { speed: 0 }); b.updateVisual(1 / 60); }; g.enemies.push(b);
  for (let i = 0; i < 40; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); }
  g.camRig.update = () => {};
  g.camera.position.set(p.x + 1, p.y + 2.2, p.z + 3.5);
  g.camera.lookAt(p.x + 1, p.y + 1.3, p.z - 6);
  g.render(1 / 60);
});
await page.screenshot({ path: `${outDir}/variants.png` });
console.log(logs.join('\n'));
await browser.close();
