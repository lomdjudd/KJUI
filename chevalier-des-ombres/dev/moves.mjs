// Test des techniques : esquives, double saut, plongeante, charge, coup de pied, arts, exécution, assassinat, esquive parfaite
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, outDir] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
const out = await page.evaluate(async () => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  await g.travel('graveyard');
  g._loop = () => {};
  const I = g.input, P = g.player;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); I.endFrame(); } };
  const press = (a) => { P.stamina = Math.max(P.stamina, 200); I._press(a); step(1); I._release(a); };
  const res = {};
  // éloigner les ennemis
  for (const e of g.enemies) { e.update = () => {}; e.pos.x += 400; }
  P.stamina = P.maxStamina = 999; P.mana = P.maxMana = 999;
  const free = () => { for (let i = 0; i < 400 && (P.state !== 'move' || !P.grounded); i++) step(1); step(3); };
  const st = () => ({ state: P.state, kind: P.dodgeKind, clip: P.anim.action && P.anim.action.name, y: +(P.pos.y - g.world.heightAt(P.pos.x, P.pos.z)).toFixed(2) });
  step(30);
  // Roulade
  I.touchMove.y = -1; press('dodge'); step(5); res.roll = st(); step(60); I.touchMove.y = 0;
  // Glissade : sprint puis esquive
  I._press('sprint'); I.touchMove.y = -1; step(40); press('dodge'); step(5); res.slide = st(); I._release('sprint'); I.touchMove.y = 0; step(60);
  // Double saut + ruée aérienne
  press('jump'); step(12); press('jump'); step(3); res.doubleJump = st(); step(8); I.touchMove.x = 1; press('dodge'); step(3); res.airDash = st(); I.touchMove.x = 0; step(90);
  free();
  // Plongeante : saut, double saut, attaque en hauteur
  press('jump'); step(14); press('jump'); step(14); res.plungeH = st().y; press('attack'); step(2); res.plunge = st(); step(60); res.afterPlunge = st(); step(60);
  // Charge lourde
  I._press('heavy'); step(2); res.charge0 = st(); step(100); res.chargeLevel = P.chargeLevel; I._release('heavy'); step(2); res.chargeRelease = { ...st(), mul: P.atkMul, flags: Object.keys(P.atkFlags) }; step(90);
  // Coup de pied : garde + lourde
  I._press('block'); step(10); press('heavy'); step(2); res.kick = { ...st(), flags: Object.keys(P.atkFlags) }; I._release('block'); step(60);
  // Arts pour chaque classe d'arme
  const { WEAPONS } = await import('/src/data/equipment.js');
  res.arts = {};
  for (const cls of ['1h', '2h', 'polearm', 'dagger', 'staff']) {
    const w = WEAPONS.find((x) => x.cls === cls);
    g.profile.weapon = w.id; if (g.profile.weapons[w.id] === undefined) g.profile.weapons[w.id] = 0;
    g.equip(); step(10); P.artCd = 0; P.mana = 999;
    press('art'); step(3); res.arts[cls] = st().clip; step(90);
  }
  g.profile.weapon = 'rusty_sword'; g.equip(); step(10);
  // Exécution : ennemi étourdi devant
  const { Enemy } = await import('/src/game/enemy.js');
  const { enemyById } = await import('/src/data/enemies.js');
  const e = new Enemy(g, enemyById('skeleton'), P.pos.x + Math.sin(P.yaw) * 1.8, P.pos.z + Math.cos(P.yaw) * 1.8, { tier: 1 });
  g.enemies.push(e); e.maxHp = e.hp = 500;
  step(5); e._stagger(2); step(8);
  res.execPrompt = document.getElementById('exec-prompt').textContent;
  const hp0 = e.hp; press('attack'); step(2); res.exec = st(); step(90); res.execDmg = Math.round(hp0 - e.hp);
  // Assassinat : mode furtif, ennemi de dos, inconscient
  const e2 = new Enemy(g, enemyById('zombie'), P.pos.x + 30, P.pos.z, { tier: 1 }); g.enemies.push(e2); e2.maxHp = e2.hp = 800;
  free(); step(2); e2._setState('idle'); e2.update = () => { e2.anim.update(1/60, {speed:0}); e2.updateVisual(1/60); };
  e2.yaw = 0; P.pos.set(e2.pos.x, e2.pos.y, e2.pos.z - 1.6); P.yaw = 0; press('sneak'); step(10);
  res.sneaking = P.sneaking; res.assPrompt = document.getElementById('exec-prompt').classList.contains('show') ? document.getElementById('exec-prompt').textContent : '(caché)'; res.e2state = e2.state;
  const hp1 = e2.hp; press('attack'); step(2); res.assassin = { ...st(), assassinFlag: P.atkFlags.execute && P.atkFlags.execute.assassin }; step(100); res.assDmg = Math.round(hp1 - e2.hp);
  // Esquive parfaite
  free(); P.pos.x += 5; step(5); res.beforePerfect = st(); I.touchMove.x = 1; press('dodge'); res.afterDodgePress = st(); I.touchMove.x = 0; step(2);
  const r = P.receiveHit({ amount: 30, source: e, kind: 'melee' });
  res.perfect = { dodged: !!(r && r.dodged), witch: +(g.witchT || 0).toFixed(2), state: P.state, fx: +g.renderer.fx.shadowTime.toFixed(2) };
  step(90);
  free();
  // Contre-attaque juste après la roulade
  I.touchMove.y = -1; press('dodge'); I.touchMove.y = 0; step(38); press('attack'); step(2); res.counter = st().clip; step(60);
  // Attaque en course
  I._press('sprint'); I.touchMove.y = -1; step(40); press('attack'); step(2); res.sprintAtk = st().clip; I._release('sprint'); I.touchMove.y = 0; step(60);
  // Pas de côté (verrouillé)
  const e3 = new Enemy(g, enemyById('skeleton'), P.pos.x + Math.sin(P.yaw) * 5, P.pos.z + Math.cos(P.yaw) * 5, { tier: 1 }); g.enemies.push(e3); e3.update = () => {};
  P.lockTarget = e3; step(5); I.touchMove.x = 1; press('dodge'); step(3); res.sidestep = st(); I.touchMove.x = 0; step(40);
  return res;
});
console.log(JSON.stringify(out, null, 1));
console.log(logs.join('\n'));
await browser.close();
