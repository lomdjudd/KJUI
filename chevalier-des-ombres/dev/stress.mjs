import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, what = 'all'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 });
await page.evaluate(async () => { const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close(); });
const zones = (process.env.ZONES || 'graveyard,forest,swamp,catacombs,castle,frost,inferno,void').split(',');
for (const z of zones) {
  const r = await page.evaluate(async ({ z, what }) => {
    const g = window.__game; const p = g.player;
    await g.travel(z);
    g._loop = () => {};
    const origErr = console.error; const caught = [];
    console.error = (...a) => { caught.push(String(a[0] && a[0].stack ? a[0].stack : a[0]).slice(0, 400)); origErr(...a); };
    const step = (n) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); } };
    const godMode = () => { p.hp = p.maxHp; p.stamina = p.maxStamina; p.mana = p.maxMana; p.alive = true; if (p.state === 'dead') p.state = 'move'; };
    const out = { zone: z, enemies: [], bosses: [] };
    const { ENEMIES } = await import('/src/data/enemies.js');
    const { BOSSES } = await import('/src/data/bosses.js');
    if (what !== 'bosses') {
      const ids = [...new Set(g.zone.pools.flat())];
      for (const id of ids) {
        for (const e of g.enemies) if (!e.isBoss) { e.alive = false; e.remove = true; }
        step(2);
        for (let k = 0; k < 2; k++) { const e = g.spawnEnemy(id, p.pos.x + 5 + k * 2, p.pos.z - 5); if (e) e.state = 'chase'; }
        for (let f = 0; f < 60 * 8; f++) { godMode(); if (f % 40 === 0) g.input._press('attack'); if (f % 40 === 1) g.input._release('attack'); step(1); }
        out.enemies.push(id);
      }
    }
    if (what !== 'enemies') {
      for (const ar of (g.zone.arenas || [])) {
        for (const e of g.enemies) { e.alive = false; e.remove = true; }
        g._endBossFight(false); godMode(); p.spawn(ar.x, ar.z + ar.r - 5, Math.PI); step(2); for (const e of g.enemies) if (e.isBoss && e.bossDef.id !== ar.boss) { e.alive = false; e.remove = true; } g._endBossFight(false); step(1);
        const def = BOSSES.find((b) => b.id === ar.boss);
        const used = new Set();
        godMode(); p.fullRestore(); p.stats.def = 5000;
        p.spawn(ar.x, ar.z + ar.r - 5, Math.PI);
        step(5);
        const b = g.activeBoss;
        if (!b) { out.bosses.push(ar.boss + ':NOFIGHT'); continue; }
        const oBegin = b._begin.bind(b); b._begin = (a) => { used.add(a.type); return oBegin(a); };
        for (let f = 0; f < 60 * 45; f++) {
          godMode();
          if (f === 60 * 20) b.hp = b.maxHp * 0.25; // force les phases
          if (f % 30 === 0) { g.input._press('attack'); } if (f % 30 === 1) g.input._release('attack');
          // Le joueur colle au boss
          if (f % 60 === 0 && b.alive) p.spawn(b.pos.x + 3, b.pos.z + 3, Math.atan2(-3, -3));
          step(1);
          if (!b.alive) break;
        }
        out.bosses.push(`${ar.boss} [${[...used].join(',')}] phase=${b.phaseIdx}/${(def.phases || []).length} hp=${Math.round(b.hp)}`);
      }
    }
    console.error = origErr;
    out.errors = caught.slice(0, 5);
    return out;
  }, { z, what });
  console.log(JSON.stringify(r));
}
console.log('ERREURS PAGE:', errs.slice(0, 10).join('\n'));
await browser.close();
