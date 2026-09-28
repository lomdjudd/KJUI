// Captures du chevalier HD (modèle GLB) dans différentes poses
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
await page.evaluate(async () => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  g._loop = () => {};
  window.step = (n) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); } g.render(1 / 60); };
  g.hud.root && (g.hud.root.style.display = 'none');
  document.getElementById('hud').style.display = 'none';
});
const pose = async (name, fn) => {
  await page.evaluate(fn);
  await page.screenshot({ path: `${outDir}/glb_${name}.png` });
};
const cam = `{ const gg = window.__game; const p = gg.player; gg.camRig.update = () => {}; const c = gg.camera; c.position.set(p.pos.x + Math.sin(p.yaw + 0.6) * 2.1, p.pos.y + 1.45, p.pos.z + Math.cos(p.yaw + 0.6) * 2.1); c.lookAt(p.pos.x, p.pos.y + 1.05, p.pos.z); }`;
await pose('idle', new Function(`const g = window.__game; window.step(30); ${cam} g.render(1/60);`));
await pose('attack', new Function(`const g = window.__game; g.player.startAttack(false); window.step(14); ${cam} g.render(1/60);`));
await pose('attack2', new Function(`const g = window.__game; window.step(40); g.player.startAttack(true); window.step(22); ${cam} g.render(1/60);`));
await pose('block', new Function(`const g = window.__game; window.step(60); g.input._press('block'); window.step(20); ${cam} g.render(1/60);`));
await pose('roll', new Function(`const g = window.__game; g.input._release('block'); window.step(10); g.input._press('dodge'); g.input.touchMove.y = -1; window.step(12); ${cam} g.render(1/60);`));
await pose('run', new Function(`const g = window.__game; g.input._release('dodge'); window.step(40); g.input.touchMove.y = -1; window.step(25); ${cam} g.render(1/60);`));
const info = await page.evaluate(() => { const p = window.__game.player; const m = p.weaponMesh; const mat = m && m.material; return { weaponMatType: mat && mat.type, same: mat === p.mat, vc: mat && mat.vertexColors, flash: mat && mat.userData.u && mat.userData.u.uFlash.value, flashC: mat && mat.userData.u && mat.userData.u.uFlashColor.value.getHexString(), weapon: p.stats.weapon.id }; });
console.log(JSON.stringify(info));
console.log(logs.join('\n'));
await browser.close();
