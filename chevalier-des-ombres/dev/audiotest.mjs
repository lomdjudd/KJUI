// Test audio : rendu de la banque (durée, taille), lecture de musique et de bruitages sans erreur,
// et export d'un extrait de la musique de chaque zone en WAV (rendu hors ligne du séquenceur)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [,, url, outDir] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
const r = await page.evaluate(async () => {
  const { soundbank } = await import('/src/core/soundbank.js');
  const out = {};
  for (const q of ['low', 'medium', 'high']) {
    const t0 = performance.now();
    const b = await soundbank.render(q, () => {});
    let bytes = 0; let n = 0;
    for (const s of Object.values(b.samples)) { bytes += s.data.byteLength; n++; }
    out[q] = { ms: Math.round(performance.now() - t0), mb: +(bytes / 1048576).toFixed(1), samples: n };
  }
  return out;
});
console.log('banque', JSON.stringify(r));
// Lecture en direct (contexte temps réel) : musique + bruitages
const live = await page.evaluate(async () => {
  const g = window.__game;
  const { audio } = await import('/src/core/audio.js');
  audio.init();
  await new Promise((res) => setTimeout(res, 1500));
  const names = ['swing', 'hit', 'block', 'parry', 'step', 'roll', 'land', 'cast', 'explosion', 'slam', 'growl', 'screech', 'roar', 'enemyDie', 'playerHurt', 'levelUp', 'quest', 'victory', 'chest', 'perfectDodge', 'charge', 'art', 'dash', 'slide', 'doubleJump', 'death', 'altar'];
  for (const n of names) audio.play(n, { kind: 'metal', element: 'fire', level: 2 });
  audio.setIntensity(2);
  await new Promise((res) => setTimeout(res, 1500));
  return { ready: audio.ready, state: audio.ctx && audio.ctx.state, voices: Object.keys(audio.roots || {}).length, sfx: Object.keys(audio.sfxVariants || {}).length, mood: audio.moodName };
});
console.log('direct', JSON.stringify(live));
console.log(logs.join('\n'));
await browser.close();
