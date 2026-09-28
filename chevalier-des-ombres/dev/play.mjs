// Scénario de test : écran titre → nouvelle partie → régions, avec captures et erreurs console.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir, scenario = 'basic'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
const shot = async (name) => { await page.screenshot({ path: `${outDir}/${name}.png` }); };
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(url);
try {
  await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 });
} catch (e) { logs.push('TIMEOUT title'); }
await wait(2500);
await shot('01_title');
const run = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { logs.push('EVAL: ' + e.message); } };
if (scenario === 'basic' || scenario === 'zones') {
  await page.click('[data-act=new]');
  await wait(300);
  await shot('02_newgame');
  await page.click('[data-act=startNew]');
  await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 120000 });
  await wait(1500);
  await shot('03_intro');
  await page.click('[data-act=close]');
  await wait(2500);
  await shot('04_hub');
}
if (scenario === 'zones') {
  const zones = (process.env.ZONES || 'graveyard,forest,swamp,catacombs,castle,frost,inferno,void').split(',');
  for (const z of zones) {
    await run(async (z) => { const g = window.__game; g.profile.zonesUnlocked.push(z); await g.travel(z); }, z);
    await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 120000 });
    await wait(3000);
    await shot('z_' + z);
    const info = await run(() => { const g = window.__game; return { enemies: g.enemies.length, calls: g.renderer.renderer.info.render.calls, tris: g.renderer.renderer.info.render.triangles, fps: Math.round(g.fps) }; });
    logs.push('ZONE ' + z + ' ' + JSON.stringify(info));
  }
}
console.log(logs.slice(0, 60).join('\n'));
await browser.close();
