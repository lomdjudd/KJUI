import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, out] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'autoinstall');
try { await page.waitForFunction(() => window.__done, null, { timeout: 60000 }); } catch (e) { logs.push('TIMEOUT'); }
await page.screenshot({ path: out });
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
