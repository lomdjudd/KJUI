import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, zone] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 });
const r = await page.evaluate(async (zone) => {
  const g = window.__game; const p = g.player; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  await g.travel(zone); g._loop = () => {};
  const step = (n) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); } };
  const out = [];
  for (const ar of g.zone.arenas) {
    p.spawn(ar.x, ar.z + ar.r - 5, Math.PI);
    step(3);
    const d = Math.hypot(p.pos.x - ar.x, p.pos.z - ar.z);
    out.push(`${ar.boss}: d=${d.toFixed(1)} r=${ar.r} alive=${p.alive} state=${g.state} active=${g.activeBoss && g.activeBoss.bossDef.id} bosses=${g.bosses.map((b) => b.bossDef.id + (b.alive ? '' : '†')).join(',')} y=${p.pos.y.toFixed(1)} menu=${g.menus.current}`);
    if (g.activeBoss) { g.activeBoss.hp = 0.5; g.combat.hit(g.activeBoss, { amount: 10, source: p, kind: 'melee' }); step(200); }
  }
  return out;
}, zone);
console.log(r.join('\n'));
await browser.close();
