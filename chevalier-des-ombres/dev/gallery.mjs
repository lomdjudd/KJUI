// Galerie d'ennemis procéduraux (et boss) alignés, pour comparer l'apparence
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, out, ids = 'skeleton,ghoul,green_specter,werewolf,tomb_spider,lich_minor,gargoyle,fire_elemental,yeti,void_eye,banshee,shadow_wolf'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 620 } });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
await page.evaluate(async (ids) => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  g.settings.set('preset', 'high');
  g._loop = () => {};
  document.getElementById('hud').style.display = 'none';
  const { enemyById } = await import('/src/data/enemies.js');
  const { bossById } = await import('/src/data/bosses.js');
  const { Enemy } = await import('/src/game/enemy.js');
  const P = g.player; P.mesh.visible = false;
  const list = ids.split(',');
  const cx = P.pos.x, cz = P.pos.z - 4;
  list.forEach((id, i) => {
    const def = enemyById(id) || bossById(id);
    const row = Math.floor(i / 6), col = i % 6;
    const e = new Enemy(g, def, cx - 5 + col * 2, cz - row * 2.6, { tier: 2 });
    if (def.scale && def.scale > 1.4) e.scale = 1.2;
    e.setModel(e.built, {});
    e.yaw = 0.3; e.update = () => { e.anim.update(1 / 60, { speed: 0 }); e.updateVisual(1 / 60); };
    g.enemies.push(e);
  });
  for (let i = 0; i < 30; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); }
  g.camRig.update = () => {};
  g.camera.position.set(cx, P.pos.y + 1.9, cz + 4.4);
  g.camera.lookAt(cx, P.pos.y + 0.9, cz - 1.6);
  g.render(1 / 60);
}, ids);
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
