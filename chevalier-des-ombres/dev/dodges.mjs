// Séquences d'images des esquives du chevalier : roulades (avant, arrière, côtés), bond arrière,
// pas de garde, glissade. Usage : node dev/dodges.mjs URL dossier [scénarios] [classic]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir, kinds = 'roll,rollBack,rollLeft,rollRight,backstep,guardStep,slide', classic = ''] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
await page.evaluate(async (classic) => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  if (classic) { g.settings.set('charModel', 'classic'); g.player.rebuild(); }
  g._loop = () => {};
  for (const e of g.enemies) { e.update = () => {}; e.pos.x += 400; }
  document.getElementById('hud').style.display = 'none';
  window.step = (n) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); } };
  window.shot = () => {
    const p = g.player; g.camRig.update = () => {}; const c = g.camera; const a = window.camYaw;
    c.position.set(p.pos.x + Math.sin(a) * 3.4, p.pos.y + 1.3, p.pos.z + Math.cos(a) * 3.4);
    c.lookAt(p.pos.x, p.pos.y + 0.7, p.pos.z); g.render(1 / 60);
  };
}, classic);
for (const k of kinds.split(',')) {
  await page.evaluate((k) => {
    const g = window.__game, P = g.player, I = g.input;
    I.touchMove.x = 0; I.touchMove.y = 0; P.lockTarget = null; window.step(40);
    P.stamina = P.maxStamina;
    const cy = g.camRig.yaw ?? 0;
    // Cible verrouillée factice devant le chevalier pour les roulades directionnelles
    if (k.startsWith('roll') && k !== 'roll') {
      let e = g.enemies.find((x) => x.alive && !x.isBoss);
      if (!e) { e = g.spawnEnemy('skeleton', P.pos.x, P.pos.z + 5); e.update = () => {}; }
      if (e) { e.pos.x = P.pos.x + P.forwardX * 5; e.pos.z = P.pos.z + P.forwardZ * 5; P.lockTarget = e; }
    }
    window.camYaw = P.yaw + Math.PI / 2 + 0.35;
    if (k === 'slide') { I._press('sprint'); I.touchMove.y = -1; window.step(40); }
    if (k === 'roll') I.touchMove.y = -1;
    if (k === 'rollBack') I.touchMove.y = 1;
    if (k === 'rollLeft') I.touchMove.x = -1;
    if (k === 'rollRight') I.touchMove.x = 1;
    if (k === 'guardStep') { I._press('block'); I.touchMove.x = 1; window.step(10); }
    window.step(2);
    I._press('dodge'); window.step(1); I._release('dodge');
    window.info = { state: P.state, kind: P.dodgeKind, clip: P.anim.action && P.anim.action.clip && Object.keys(window.__clips || {}).length, rollAngle: 0 };
  }, k);
  const angles = [];
  for (let f = 0; f < 6; f++) {
    const a = await page.evaluate(() => { window.step(3); window.shot(); const an = window.__game.player.anim; return +(an.rollAngle || 0).toFixed(2); });
    angles.push(a);
    await page.screenshot({ path: `${outDir}/dg_${k}_${f}.png` });
  }
  console.log(k, JSON.stringify(await page.evaluate(() => { const P = window.__game.player; return { kind: P.dodgeKind, state: P.state }; })), 'angles', angles.join(' '));
  await page.evaluate(() => { const I = window.__game.input; I._release('sprint'); I._release('block'); I.touchMove.x = 0; I.touchMove.y = 0; window.step(40); });
}
console.log(logs.join('\n'));
await browser.close();
