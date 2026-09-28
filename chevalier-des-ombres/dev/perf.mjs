import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 });
const r = await page.evaluate(async () => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  const { settings } = await import('/src/core/settings.js');
  settings.set('preset', 'medium');
  const out = [];
  for (const z of ['graveyard', 'forest', 'castle', 'catacombs', 'void']) {
    await g.travel(z);
    g._loop = () => {};
    for (let i = 0; i < 30; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); }
    const info = g.renderer.renderer.info;
    info.autoReset = false; info.reset();
    g.render(1 / 60);
    const calls = info.render.calls, tris = info.render.triangles;
    info.autoReset = true;
    const vis = g.enemies.filter((e) => e.mesh && e.mesh.visible).length;
    out.push(`${z}: ${calls} draw calls, ${Math.round(tris / 1000)}k triangles (ombres + post incl.), ennemis visibles ${vis}/${g.enemies.length}, géométries ${info.memory.geometries}, textures ${info.memory.textures}, programmes ${info.programs.length}`);
  }
  return out;
});
console.log(r.join('\n'));
await browser.close();
