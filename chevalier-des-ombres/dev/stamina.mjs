// Test de l'endurance : sprint (calme / combat), épuisement, roulades, attaques, récupération
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 600000 });
const r = await page.evaluate(async () => {
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  g._loop = () => {};
  for (const e of g.enemies) { e.update = () => {}; e.pos.x += 400; }
  const P = g.player, I = g.input;
  const step = (n) => { for (let i = 0; i < n; i++) { g.update(1 / 60, 1 / 60); I.endFrame(); } };
  const out = { max: P.maxStamina };
  const full = () => { P.stamina = P.maxStamina; P.exhausted = false; step(5); };
  // Sprint hors combat : 10 s
  full(); I.touchMove.y = -1; I._press('sprint'); step(600); out.sprintCalm10s = Math.round(P.stamina); I._release('sprint'); I.touchMove.y = 0; step(10);
  // Sprint en combat jusqu'à épuisement
  const force = (v) => Object.defineProperty(g, 'inCombat', { get: () => v, set: () => {}, configurable: true });
  force(true);
  full(); I.touchMove.y = -1; I._press('sprint'); step(2);
  out.dbg = { state: P.state, sprinting: P.sprinting, inCombat: g.inCombat, st: Math.round(P.stamina), down: I.isDown('sprint') };
  const trace = []; let t = 0; while (!P.exhausted && t < 3000) { step(1); t++; if (t % 120 === 0) trace.push([Math.round(P.stamina), P.sprinting, P.state, +P.staminaDelay.toFixed(2)]); }
  out.sprintCombatSeconds = +(t / 60).toFixed(1);
  step(60); out.exhaustedAfter1s = P.exhausted; out.sprintingWhileExhausted = P.sprinting;
  let t2 = 0; while (P.exhausted && t2 < 2000) { step(1); t2++; }
  out.recoverSeconds = +(t2 / 60).toFixed(1);
  I._release('sprint'); I.touchMove.y = 0; step(10);
  // Roulades depuis le plein
  full(); let rolls = 0;
  for (let i = 0; i < 20 && P.stamina > 1; i++) { I._press('dodge'); step(1); I._release('dodge'); rolls++; P.staminaDelay = 99; step(40); }
  P.staminaDelay = 0;
  out.rollsFromFull = rolls;
  // Attaques légères depuis le plein
  full(); let hits = 0;
  for (let i = 0; i < 30 && P.stamina > 1; i++) { P.state = 'move'; P.startAttack(false); hits++; P.staminaDelay = 1; }
  out.lightAttacksFromFull = hits;
  // Récupération 0 → plein en combat et hors combat
  P.state = 'move';
  P.stamina = 0; P.exhausted = true; P.staminaDelay = 0; let k = 0; while (P.stamina < P.maxStamina - 0.5 && k < 1200) { step(1); k++; } out.refillCombat = +(k / 60).toFixed(1);
  force(false);
  P.stamina = 0; P.exhausted = true; P.staminaDelay = 0; k = 0; while (P.stamina < P.maxStamina - 0.5 && k < 1200) { step(1); k++; } out.refillCalm = +(k / 60).toFixed(1);
  return out;
});
console.log(JSON.stringify(r, null, 1), logs.join('\n'));
await browser.close();
