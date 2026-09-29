// Sculpte des créatures dans la page (sans installation) et compare avant / après
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, out, ids = 'skeleton,ghoul,werewolf,lich_minor,gargoyle,yeti', N = '96', view = 'row', frame = 'body'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 620 } });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
const stats = await page.evaluate(async ({ ids, N, view, target }) => {
  window.__target = target;
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  g.settings.set('preset', 'high');
  g._loop = () => {};
  document.getElementById('hud').style.display = 'none';
  const { enemyById } = await import('/src/data/enemies.js');
  const { bossById } = await import('/src/data/bosses.js');
  const { Enemy, buildModelFor } = await import('/src/game/enemy.js');
  const { RigBuilder, clearSculptCache } = await import('/src/actors/rig.js');
  const { sculptRig, sculptStore, SCULPT } = await import('/src/actors/sculpt.js');
  const P = g.player; P.mesh.visible = false;
  const list = ids.split(',');
  const res = [];
  let cur = null;
  RigBuilder.capture = (rb, sig) => {
    const t0 = performance.now();
    const rec = sculptRig(rb, { N, target: window.__target || 0 });
    cur = { sig, ms: Math.round(performance.now() - t0), v: rec ? rec.n : 0, t: rec ? rec.idx.length / 3 : 0, acc: rec ? rec.acc.length : 0, parts: rb.parts.length, kb: rec ? Math.round(rec.bytes / 1024) : 0, tm: rec ? rec.timing : null };
    if (rec) sculptStore.set(sig, rec);
  };
  for (const id of list) {
    const def = enemyById(id) || bossById(id);
    const b = buildModelFor(def);
    b.mesh.geometry.dispose();
    res.push({ id, ...cur });
  }
  RigBuilder.capture = null;
  clearSculptCache();
  const cx = P.pos.x, cz = P.pos.z - 4;
  const spawn = (sculpt) => {
    SCULPT.enabled = sculpt;
    for (const e of g.enemies) { g.scene.remove(e.mesh); }
    g.enemies.length = 0;
    list.forEach((id, i) => {
      const def = enemyById(id) || bossById(id);
      const e = new Enemy(g, def, cx - 5 + i * 2, cz, { tier: 2 });
      if (def.scale && def.scale > 1.4) e.scale = 1.2;
      e.setModel(e.built, {});
      e.yaw = 0.35; e.update = () => { e.anim.update(1 / 60, { speed: 0 }); e.updateVisual(1 / 60); };
      g.enemies.push(e);
    });
    for (let i = 0; i < 30; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); }
    g.camRig.update = () => {};
    if (window.__view === 'close') {
      const fx = cx - 5 + (list.length - 1);
      g.camera.position.set(fx, P.pos.y + 1.35, cz + 2.9);
      g.camera.lookAt(fx, P.pos.y + 0.95, cz);
    } else {
      g.camera.position.set(cx, P.pos.y + 1.7, cz + 4.6);
      g.camera.lookAt(cx, P.pos.y + 0.9, cz - 0.5);
    }
    g.render(1 / 60);
  };
  window.__spawn = spawn;
  window.__view = view;
  return res;
}, { ids, N: +N, view, target: +(process.env.TARGET || 0) });
console.log(JSON.stringify(stats, null, 0));
if (view === 'portrait') {
  await page.evaluate((f) => { window.__frame = f; }, frame);
  // Portraits individuels : face et profil, avant / après
  for (const mode of [false, true]) {
    await page.evaluate((m) => window.__spawn(m), mode);
    const ids2 = ids.split(',');
    for (let i = 0; i < ids2.length; i++) {
      for (const [nm, ang] of [['front', 0.35], ['side', 0.35 + 1.4]]) {
        await page.evaluate(({ i, ang }) => {
          const g = window.__game; const e = g.enemies[i];
          const h = e.height || 1.9; const d = Math.max(1.0, h * 0.62);
          if (!window.__lamp) { const T = g.moon.constructor; window.__lamp = new g.hemi.constructor(0xffffff, 0x404050, 1.6); g.scene.add(window.__lamp); }
          const up = window.__frame === 'head' ? [0.86, 0.84, 0.55] : [0.62, 0.55, 1];
          g.camera.position.set(e.pos.x + Math.sin(ang) * d * up[2], e.pos.y + h * up[0], e.pos.z + Math.cos(ang) * d * up[2]);
          g.camera.lookAt(e.pos.x, e.pos.y + h * up[1], e.pos.z);
          for (const o of g.enemies) o.mesh.visible = o === e;
          g.render(1 / 60);
        }, { i, ang });
        await page.screenshot({ path: out.replace('.png', `_${ids2[i]}_${nm}_${mode ? 'hd' : 'old'}.png`), clip: { x: 350, y: 0, width: 700, height: 620 } });
      }
    }
  }
} else {
  await page.evaluate(() => window.__spawn(false));
  await page.screenshot({ path: out.replace('.png', '_before.png') });
  await page.evaluate(() => window.__spawn(true));
  await page.screenshot({ path: out.replace('.png', '_after.png') });
}
console.log(logs.join('\n'));
await browser.close();
