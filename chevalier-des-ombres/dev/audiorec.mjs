// Test des musiques et bruitages enregistrés : installation, décodage, pistes jouées selon la zone,
// passage combat / boss, niveau sonore comparé à la musique composée.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 600000 });
await page.mouse.click(320, 180);
const r = await page.evaluate(async () => {
  const { audio } = await import('/src/core/audio.js');
  const { recorded } = await import('/src/core/recorded.js');
  const { AUDIO_MANIFEST } = await import('/src/data/audioCredits.js');
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  audio.init();
  await wait(2500);
  const out = { installed: recorded.installed, index: recorded.index, canPlay: recorded.canPlayMusic(), recSfx: audio.recSfx ? Object.keys(audio.recSfx).length : 0, ctx: audio.ctx && audio.ctx.state };
  const R = audio.recMusic;
  out.titleTrack = R && R.track;
  out.titlePlaying = R && R.cur >= 0 ? !R.decks[R.cur].el.paused && R.decks[R.cur].el.currentTime > 0 : false;
  // Zone, combat, boss
  const g = window.__game; g.menus.close(); await g.newGame('1', 'knight'); g.menus.close();
  await g.travel('graveyard');
  const until = async (id, max = 10000) => { const t0 = performance.now(); while (R.track !== id && performance.now() - t0 < max) await wait(100); return R.track === id ? Math.round(performance.now() - t0) + ' ms' : 'jamais (' + R.track + ', voulu ' + R.want + ')'; };
  out.toGraveyard = await until('unrest');
  audio.setIntensity = (v) => {}; // le jeu recalcule l'intensité à chaque image : on la force pour le test
  audio.targetIntensity = 1; out.toCombat = await until('battle');
  audio.targetIntensity = 2; out.toBoss = await until('boss');
  audio.targetIntensity = 0; out.toZone = await until('unrest');
  // Bruitages : jouer quelques sons sans erreur
  for (const n of ['swing', 'hit', 'block', 'step', 'cast', 'growl', 'roar', 'enemyDie', 'playerHurt', 'levelUp', 'chest', 'pickup', 'portal']) audio.play(n, { kind: 'bone', element: 'fire' });
  out.variants = { swing: audio.sfxVariants.swing.length, stepDirt: audio.sfxVariants.stepDirt.length, hitFlesh: audio.sfxVariants.hitFlesh.length };
  // Niveau sonore : piste enregistrée (décodée) vs musique composée (rendu hors ligne)
  const rms = (buf) => { let s = 0, n = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 7) { s += d[i] * d[i]; n++; } } return 20 * Math.log10(Math.sqrt(s / n)); };
  const levels = {};
  for (const id of ['unrest', 'battle', 'boss', 'town']) {
    const b = await recorded.blob(AUDIO_MANIFEST.music[id]);
    const buf = await audio.ctx.decodeAudioData(await b.arrayBuffer());
    levels[id] = +rms(buf).toFixed(1);
  }
  const { AudioSys } = await import('/src/core/audio.js');
  const prev = await AudioSys.renderPreview('graveyard', 12, 0, 22050);
  levels.composedGraveyard = +rms(prev).toFixed(1);
  const prevB = await AudioSys.renderPreview('castle', 12, 2, 22050);
  levels.composedBoss = +rms(prevB).toFixed(1);
  out.levels = levels;
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log(logs.slice(0, 15).join('\n'));
await browser.close();
