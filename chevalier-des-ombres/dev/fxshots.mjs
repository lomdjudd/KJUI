// Captures des effets : pas de côté (silhouettes), charge niveau 3, plongeante (fissures), Temps des Ombres, exécution
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => logs.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
await page.evaluate(async () => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  await g.travel('graveyard');
  g.settings.set('preset', 'high'); g.settings.set('renderScale', 0.8);
  g._loop = () => {};
  const I = g.input, P = g.player;
  window.T = { g, I, P };
  window.step = (n = 1) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); I.endFrame(); } };
  window.press = (a) => { P.stamina = Math.max(P.stamina, 200); P.mana = 999; I._press(a); window.step(1); I._release(a); };
  window.cam = (d = 4.2, side = 0.9, h = 1.6) => { const c = g.camera; g.camRig.update = () => {}; c.position.set(P.pos.x + Math.sin(P.yaw + side) * d, P.pos.y + h, P.pos.z + Math.cos(P.yaw + side) * d); c.lookAt(P.pos.x, P.pos.y + 1, P.pos.z); g.render(1 / 60); };
  for (const e of g.enemies) { if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 40) { e.pos.x += 300; } }
  const { Enemy } = await import('/src/game/enemy.js');
  const { enemyById } = await import('/src/data/enemies.js');
  const e = new Enemy(g, enemyById('fallen_knight'), P.pos.x + Math.sin(P.yaw) * 4, P.pos.z + Math.cos(P.yaw) * 4, { tier: 1 });
  e.maxHp = e.hp = 5000; e.update = () => { e.anim.update(1 / 60, { speed: 0 }); e.updateVisual(1 / 60); };
  g.enemies.push(e); window.E = e;
  document.getElementById('hud').style.display = 'none';
  window.free = () => { for (let i = 0; i < 400 && (P.state !== 'move' || !P.grounded); i++) window.step(1); window.step(2); P.hp = P.maxHp; };
  window.step(20);
});
const shot = async (name, code) => { await page.evaluate(code); await page.screenshot({ path: `${outDir}/fx_${name}.png` }); };
await shot('sidestep', () => { const { P, I } = window.T; window.free(); P.lockTarget = window.E; window.step(5); I.touchMove.x = 1; window.press('dodge'); window.step(8); I.touchMove.x = 0; console.log('sidestep', P.state, P.dodgeKind, window.T.g.effects.ghosts.length); window.cam(3.6, 1.9, 1.4); });
await shot('charge', () => { const { P, I } = window.T; window.free(); P.lockTarget = null; I._press('heavy'); window.step(95); window.cam(3.2, 0.9); });
await shot('chargeRelease', () => { const { I } = window.T; I._release('heavy'); window.step(20); window.cam(4, 0.9); });
await shot('plunge', () => { const { P } = window.T; window.free(); window.press('jump'); window.step(16); window.press('jump'); window.step(16); window.press('attack'); for (let i = 0; i < 60 && P.state === 'plunge'; i++) window.step(1); window.step(3); console.log('plunge', P.state, P.curAttack, window.T.g.effects.crackPool.filter(c=>c.visible).length); window.cam(4.5, 0.6, 3.2); });
await shot('shadowtime', () => { const { g, P, I } = window.T; window.free(); I.touchMove.x = -1; window.press('dodge'); I.touchMove.x = 0; window.step(1); P.receiveHit({ amount: 20, source: window.E, kind: 'melee' }); window.step(12); console.log('shadow', g.witchT, g.renderer.fx.shadowTime); window.cam(4, 1.3); });
await shot('execute', () => { const { g, P } = window.T; window.free(); const E = window.E; E._stagger(3); P.pos.set(E.pos.x - Math.sin(E.yaw + 0.3) * -2, P.pos.y, E.pos.z); P.faceTowards(E.pos.x, E.pos.z, -1, 0); window.step(5); window.press('attack'); console.log('exec', P.curAttack, P.state); window.step(22); window.cam(3.4, 1.2); });
console.log(logs.join('\n'));
await browser.close();
