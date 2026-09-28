// Test de l'installation des données : écran, progression, puis écran titre.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir, mode = 'desktop'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const opts = mode === 'phone' ? { viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } };
const ctx = await browser.newContext(opts);
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.goto(url);
await page.waitForSelector('#install #inst-go', { timeout: 60000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/inst1.png` });
const t0 = Date.now();
await page.click('#inst-go');
let shot = 0;
const steps = new Set();
while (true) {
  const st = await page.evaluate(() => ({ step: document.querySelector('#inst-step')?.textContent, pct: document.querySelector('#inst-pct')?.textContent, detail: document.querySelector('#inst-detail')?.textContent, done: !!document.querySelector('#inst-play'), err: document.querySelector('#inst-done .warn')?.textContent }));
  if (st.step && !steps.has(st.step)) { steps.add(st.step); console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', st.step, st.pct, st.detail); }
  if (st.err) { console.log('ERREUR', st.err); break; }
  if (st.done) break;
  if (shot === 0 && parseInt(st.pct) > 40) { shot = 1; await page.screenshot({ path: `${outDir}/inst2.png` }); }
  if (Date.now() - t0 > 600000) { console.log('TIMEOUT'); break; }
  await page.waitForTimeout(300);
}
console.log('durée installation', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.screenshot({ path: `${outDir}/inst3.png` });
await page.click('#inst-play').catch(() => {});
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 }).catch(() => logs.push('TIMEOUT titre'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/inst4_title.png` });
const info = await page.evaluate(async () => {
  const g = window.__game;
  const { device } = await import('/src/core/device.js');
  const { installer } = await import('/src/core/installer.js');
  return { meta: installer.meta, tier: device.tier, profile: device.profile, preset: (await import('/src/core/settings.js')).settings.get('preset') };
}).catch((e) => ({ err: e.message }));
console.log(JSON.stringify(info, null, 1).slice(0, 1500));
// Relance : l'installation ne doit plus être demandée
await page.reload();
const again = await Promise.race([
  page.waitForSelector('#install #inst-go', { timeout: 20000 }).then(() => 'install'),
  page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 60000 }).then(() => 'title'),
]).catch(() => 'timeout');
console.log('après relance :', again);
console.log(logs.join('\n'));
await browser.close();
