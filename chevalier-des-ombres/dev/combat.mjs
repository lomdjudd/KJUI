import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
const shot = (n) => page.screenshot({ path: `${outDir}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const ev = async (fn, a) => { try { return await page.evaluate(fn, a); } catch (e) { logs.push('EVAL: ' + e.message); } };
await page.goto(url);
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 });
await ev(async () => { const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close(); g.profile.zonesUnlocked.push('graveyard'); await g.travel('graveyard'); });
await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 120000 });
await wait(1500);
// Ennemi devant le joueur
const r1 = await ev(() => {
  const g = window.__game; const p = g.player;
  for (const e of g.enemies) if (e.distTo(p) < 40) { e.alive = false; e.remove = true; }
  const x = p.pos.x + Math.sin(p.yaw) * 3.2, z = p.pos.z + Math.cos(p.yaw) * 3.2;
  const e = g.spawnEnemy('skeleton', x, z); e.state = 'chase';
  window.__e = e; return { hp: e.hp, max: e.maxHp };
});
logs.push('spawn skeleton ' + JSON.stringify(r1));
for (let i = 0; i < 10; i++) { await ev(() => window.__game.input.tap('attack')); await wait(420); if (i === 3) await shot('c1_attack'); }
logs.push('after attacks ' + JSON.stringify(await ev(() => ({ hp: window.__e.hp, alive: window.__e.alive, php: window.__game.player.hp, xp: window.__game.profile.xp, shards: window.__game.profile.shards }))));
// Groupe d'ennemis + pouvoir
await ev(() => {
  const g = window.__game; const p = g.player;
  for (const id of ['ghoul', 'skeleton_archer', 'green_specter', 'zombie']) { const a = Math.random() * 6; const e = g.spawnEnemy(id, p.pos.x + Math.sin(p.yaw + a) * 7, p.pos.z + Math.cos(p.yaw + a) * 7); e.state = 'chase'; }
});
await wait(2500);
await ev(() => { const g = window.__game; g.player.lockTarget = g.findLockTarget(); g.input.tap('power0'); });
await wait(700);
await shot('c2_group');
for (let i = 0; i < 8; i++) { await ev(() => window.__game.input.tap(Math.random() < 0.5 ? 'attack' : 'heavy')); await wait(500); }
await shot('c3_melee');
logs.push('group ' + JSON.stringify(await ev(() => ({ alive: window.__game.enemies.filter((e) => e.alive && e.distTo(window.__game.player) < 20).length, php: Math.round(window.__game.player.hp) }))));
// Vue 1re personne
await ev(() => window.__game.input.tap('camera'));
await wait(400);
await ev(() => window.__game.input.tap('attack'));
await wait(250);
await shot('c4_firstperson');
await ev(() => window.__game.input.tap('camera'));
// Boss : le fossoyeur
await ev(() => {
  const g = window.__game; const p = g.player;
  for (const e of g.enemies) if (!e.isBoss) { e.alive = false; e.remove = true; }
  p.hp = p.maxHp; p.stats.def += 200;
  const ar = g.world.interactables.find((i) => i.type === 'arena' && i.boss === 'gravedigger');
  p.spawn(ar.x, ar.z + ar.r - 4, Math.PI);
});
await wait(1500);
await shot('c5_boss_intro');
await wait(2500);
for (let i = 0; i < 14; i++) { await ev((i) => { const g = window.__game; g.input.tap(i % 5 === 4 ? 'dodge' : 'attack'); }, i); await wait(450); if (i === 6) await shot('c6_boss_fight'); }
logs.push('boss ' + JSON.stringify(await ev(() => { const b = window.__game.activeBoss; return b ? { hp: Math.round(b.hp), max: b.maxHp, state: b.state } : 'none'; })));
await wait(1500);
await shot('c7_boss_fight2');
// Victoire forcée
await ev(() => { const b = window.__game.activeBoss; if (b) { b.hp = 1; window.__game.combat.hit(b, { amount: 50, source: window.__game.player, kind: 'melee', poise: 0 }); } });
await wait(3500);
await shot('c8_victory');
logs.push('bosses ' + JSON.stringify(await ev(() => window.__game.profile.bosses)));
// Menus
await ev(() => window.__game.menus.openPause('equipment')); await wait(300); await shot('m1_equipment');
await ev(() => window.__game.menus.openPause('skills')); await wait(300); await shot('m2_skills');
await ev(() => window.__game.menus.openPause('map')); await wait(300); await shot('m3_map');
await ev(() => { const m = window.__game.menus; m.selBeast = 'gravedigger'; m.openPause('bestiary'); }); await wait(300); await shot('m4_bestiary');
await ev(() => window.__game.menus.openPause('quests')); await wait(300); await shot('m5_quests');
await ev(() => window.__game.menus.openPause('settings')); await wait(300); await shot('m6_settings');
await ev(() => window.__game.menus.close());
// Mort et réapparition
await ev(() => { const p = window.__game.player; p.stats.def -= 200; p.hp = 1; window.__game.combat.hit(p, { amount: 999, kind: 'aoe', canBlock: false }); });
await wait(3500);
await shot('m7_death');
await ev(async () => { window.__game.menus.close(); await window.__game.respawn(); });
await wait(2000);
await shot('m8_respawn');
// Havre : dialogue et boutique
await ev(async () => { await window.__game.travel('hub', 'hub'); });
await wait(1500);
await ev(() => window.__game.menus.openDialog('gorvald')); await wait(300); await shot('m9_dialog');
await ev(() => { window.__game.profile.shards = 5000; window.__game.menus.openShop('forge'); }); await wait(300); await shot('m10_shop');
console.log(logs.slice(0, 60).join('\n'));
await browser.close();
