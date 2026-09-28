import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 });
await page.evaluate(async () => { const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close(); await g.travel('graveyard'); });
await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(2000);
const res = await page.evaluate(async () => {
  const g = window.__game; const p = g.player;
  for (const e of g.enemies) { e.alive = false; e.remove = true; }
  const out = [];
  for (const [weapon, dist] of [['rusty_sword', 2], ['greatsword', 2.5], ['hunting_spear', 3], ['assassin_dagger', 1.6]]) {
    g.profile.weapons[weapon] = 0; g.profile.weapon = weapon; g.equip();
    const e = g.spawnEnemy('zombie', p.pos.x + Math.sin(p.yaw) * dist, p.pos.z + Math.cos(p.yaw) * dist);
    e.speed = 0; e.def = { ...e.def, attacks: [] }; e.cooldowns = []; e.maxHp = e.hp = 99999; e.state = 'recover'; e.recoverT = 999;
    let hits = 0; const orig = e.receiveHit.bind(e); e.receiveHit = (i) => { hits++; return orig(i); };
    for (let k = 0; k < 6; k++) { p.stamina = 999; g.input.tap('attack'); await new Promise((r) => setTimeout(r, 900)); }
    out.push(weapon + ': ' + hits + '/6 coups');
    e.alive = false; e.remove = true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
});
console.log(res.join('\n'), logs.join('\n'));
await browser.close();
