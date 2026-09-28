import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 });
await page.evaluate(async () => { const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close(); await g.travel('graveyard'); });
await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(2000);
const res = await page.evaluate(async () => {
  const g = window.__game; const p = g.player;
  for (const e of g.enemies) { e.alive = false; e.remove = true; }
  const e = g.spawnEnemy('zombie', p.pos.x + Math.sin(p.yaw) * 2, p.pos.z + Math.cos(p.yaw) * 2);
  e.speed = 0; e.def = { ...e.def, attacks: [] }; e.cooldowns = []; e.maxHp = e.hp = 99999; e.state = 'recover'; e.recoverT = 999;
  const log = [];
  const origCheck = p._meleeCheck.bind(p);
  p._meleeCheck = () => { const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; log.push(`chk ${p.curAttack} t=${p.anim.actionT.toFixed(2)} d=${Math.hypot(dx, dz).toFixed(2)} yaw=${p.yaw.toFixed(2)} dir=${Math.atan2(dx, dz).toFixed(2)} hitset=${p.hitSet.size}`); origCheck(); };
  const origHit = e.receiveHit.bind(e); e.receiveHit = (i) => { log.push('HIT ' + Math.round(i.amount)); return origHit(i); };
  for (let k = 0; k < 4; k++) { p.stamina = 999; log.push('tap ' + k + ' state=' + p.state + ' t=' + p.anim.actionT.toFixed(2)); g.input.tap('attack'); await new Promise((r) => setTimeout(r, 900)); }
  return log;
});
console.log(res.join('\n'));
await browser.close();
