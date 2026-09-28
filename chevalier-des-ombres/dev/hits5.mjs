import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 120000 });
await page.evaluate(async () => { const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close(); await g.travel('graveyard'); });
await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 120000 });
const res = await page.evaluate(() => {
  const g = window.__game; const p = g.player;
  g._loop = () => {}; let F = 0; // coupe la boucle réelle
  const step = (n) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); g.input.endFrame(); F++; } }; let F0 = 0;
  for (const e of g.enemies) { e.alive = false; e.remove = true; }
  step(5);
  const out = []; const oS = p.startAttack.bind(p); p.startAttack = (h) => { out.push('   F' + F + ' startAttack state=' + p.state + ' st=' + Math.round(p.stamina)); return oS(h); }; const oE = p._endAttack.bind(p); p._endAttack = () => { out.push('   F' + F + ' endAttack'); return oE(); };
  for (const [weapon, dist] of [['rusty_sword', 2], ['knight_sword', 2.2]]) {
    g.profile.weapons[weapon] = 0; g.profile.weapon = weapon; g.equip();
    const e = g.spawnEnemy('zombie', p.pos.x + Math.sin(p.yaw) * dist, p.pos.z + Math.cos(p.yaw) * dist);
    e.speed = 0; e.def = { ...e.def, attacks: [], deathCloud: null }; e.cooldowns = []; e.maxHp = e.hp = 99999;
    let hits = 0; const orig = e.receiveHit.bind(e); e.receiveHit = (i) => { if (!i.dot) { hits++; out.push('  hit ' + p.curAttack + ' d=' + e.distTo(p).toFixed(2)); } return orig(i); };
    for (let k = 0; k < 8; k++) { p.stamina = 999; g.input._press('attack'); out.push('   F' + F + ' press state=' + p.state + ' down=' + [...g.input.pressed].join(',')); step(1); g.input._release('attack'); out.push(' atk ' + p.curAttack + ' state=' + p.state + ' d=' + e.distTo(p).toFixed(2) + ' ang=' + p.angleTo(e).toFixed(2)); step(40); }
    out.push(`${weapon}: ${hits}/8 coups, distance finale ${e.distTo(p).toFixed(1)} m`);
    e.alive = false; e.remove = true; step(10);
  }
  // Un vrai combat : squelette qui attaque, le joueur frappe en continu
  const sk = g.spawnEnemy('skeleton', p.pos.x + Math.sin(p.yaw) * 6, p.pos.z + Math.cos(p.yaw) * 6);
  sk.state = 'chase';
  const hp0 = p.hp; let frames = 0;
  while (sk.alive && frames < 60 * 30) { if (frames % 30 === 0) { p.stamina = Math.max(p.stamina, 30); g.input._press('attack'); } if (frames % 30 === 1) g.input._release('attack'); step(1); frames++; }
  out.push(`combat squelette : ${sk.alive ? 'vivant' : 'vaincu'} en ${(frames / 60).toFixed(1)} s, PV joueur ${Math.round(hp0)} → ${Math.round(p.hp)}`);
  return out;
});
console.log(res.join('\n'));
await browser.close();
