// Captures rapprochées du bouclier tenu par le chevalier HD (plusieurs angles et poses)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir, poses = 'idle,block,run,attack', shield = 'wooden'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 540 } });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
await page.evaluate(async (shield) => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  g.profile.shield = shield; if (shield.endsWith('!')) { g.profile.shield = shield.slice(0, -1); g.settings.set('charModel', 'classic'); } g.player.rebuild();
  g._loop = () => {};
  for (const e of g.enemies) { e.update = () => {}; e.pos.x += 400; }
  document.getElementById('hud').style.display = 'none';
  window.step = (n) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); } };
  window.shot = (ang, d = 1.7, h = 1.25) => {
    const p = g.player; g.camRig.update = () => {}; const c = g.camera;
    c.position.set(p.pos.x + Math.sin(p.yaw + ang) * d, p.pos.y + h, p.pos.z + Math.cos(p.yaw + ang) * d);
    c.lookAt(p.pos.x, p.pos.y + 1.0, p.pos.z); g.render(1 / 60);
  };
}, shield);
const angles = { front: 0, left: 1.2, side: 1.9, back: 3.14 };
const setups = {
  idle: 'window.step(40);',
  block: "g.input._press('block'); window.step(25);",
  run: "g.input._release('block'); g.input.touchMove.y = -1; window.step(30);",
  attack: "g.input.touchMove.y = 0; window.step(30); g.player.startAttack(false); window.step(12);",
};
for (const pz of poses.split(',')) {
  for (const [an, a] of Object.entries(angles)) {
    await page.evaluate(new Function(`const g = window.__game; ${an === 'front' ? setups[pz] : ''} const y = g.player.yaw; window.shot(${a}); g.player.yaw = y;`));
    await page.screenshot({ path: `${outDir}/sh_${shield}_${pz}_${an}.png` });
  }
}
const info = await page.evaluate(() => { const p = window.__game.player; return { shield: p.stats.shield && p.stats.shield.id, shape: p.stats.shield && p.stats.shield.shape, has: !!p.shieldMesh }; });
console.log(JSON.stringify(info), logs.join('\n'));
await browser.close();
