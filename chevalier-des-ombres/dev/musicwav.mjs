// Rend un extrait de la musique de chaque zone (hors ligne), mesure les niveaux et écrit des WAV
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [,, url, outDir, list = 'title,hub,graveyard,castle,frost,void', secs = '24'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
await page.goto(url + '?autoinstall');
await page.waitForFunction(() => window.__game && document.querySelector('#menu.show'), null, { timeout: 300000 });
for (const spec of list.split(',')) {
  const [mood, it = '0'] = spec.split(':');
  const r = await page.evaluate(async ({ mood, it, secs }) => {
    const { AudioSys } = await import('/src/core/audio.js');
    const buf = await AudioSys.renderPreview(mood, secs, +it, 32000);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0, sum = 0;
    for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); sum += L[i] * L[i] + R[i] * R[i]; }
    const rms = Math.sqrt(sum / (2 * L.length));
    // WAV 16 bits stéréo
    const n = L.length, data = new DataView(new ArrayBuffer(44 + n * 4));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
    data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); ws(36, 'data'); data.setUint32(40, n * 4, true);
    const k = peak > 0.98 ? 0.98 / peak : 1;
    for (let i = 0; i < n; i++) { data.setInt16(44 + i * 4, Math.max(-32767, Math.min(32767, L[i] * k * 32767)), true); data.setInt16(46 + i * 4, Math.max(-32767, Math.min(32767, R[i] * k * 32767)), true); }
    let bin = ''; const u8 = new Uint8Array(data.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { peak: +peak.toFixed(3), rmsDb: +(20 * Math.log10(rms + 1e-9)).toFixed(1), b64: btoa(bin) };
  }, { mood, it, secs: +secs });
  fs.writeFileSync(`${outDir}/music_${mood}_${it}.wav`, Buffer.from(r.b64, 'base64'));
  console.log(mood, 'intensité', it, 'crête', r.peak, 'RMS', r.rmsDb, 'dB');
}
await browser.close();
