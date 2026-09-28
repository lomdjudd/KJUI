// Écran d'installation des données (obligatoire) : affiché avant l'écran titre tant que les
// données du jeu ne sont pas installées ou qu'une mise à jour est nécessaire.
import { installer } from '../core/installer.js';
import { device, TIER_LABEL } from '../core/device.js';
import { escapeHtml } from '../core/utils.js';
import { listGamepads } from '../core/input.js';

function fmtMb(bytes) {
  return (bytes / 1048576).toFixed(1).replace('.', ',') + ' Mo';
}

function deviceRows(p) {
  if (!p) return '';
  const rows = [
    ['Mémoire vive', `${String(p.ramGb).replace('.', ',')} Go <span class="muted">(${escapeHtml(p.ramSource)})</span>`],
    ['Processeur graphique', escapeHtml(p.gpu.length > 46 ? p.gpu.slice(0, 44) + '…' : p.gpu)],
    ['Cœurs', p.cores],
    ['Score graphique', p.gpuScore != null ? p.gpuScore.toLocaleString('fr-FR') : 'non mesuré'],
    ['Palier de qualité', `<b style="color:var(--gold-bright)">${TIER_LABEL[p.tier]}</b>`],
    ['Budget mémoire', `${p.budgetMb} Mo`],
  ];
  return `<div class="inst-dev">${rows.map(([a, b]) => `<div class="statline"><span>${a}</span><b>${b}</b></div>`).join('')}</div>`;
}

// Affiche l'écran et résout quand l'installation est terminée
export function runInstallScreen() {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'install';
    document.body.appendChild(root);
    const update = !!installer.meta;
    const plan = installer.plan();
    const profile = device.ensure(null);
    const persistNote = installer.persistent
      ? ''
      : '<p class="warn">Le stockage permanent n’est pas disponible dans ce navigateur : les données seront préparées à chaque lancement.</p>';
    root.innerHTML = `
      <div class="inst-box frame">
        <div class="logo">Chevalier<small>DES OMBRES</small></div>
        <h2 class="m-title">${update ? 'Mise à jour des données' : 'Installation des données'}</h2>
        <p>Pour profiter de tout le contenu, le jeu installe ses données sur cet appareil : modèles 3D haute définition et leurs variantes, textures du monde en haute résolution, banque d’instruments et de bruitages. Cette étape n’a lieu qu’une fois.</p>
        <div id="inst-dev">${deviceRows(profile)}</div>
        <p class="muted">Taille estimée : environ ${plan.estMb} Mo · textures des personnages ${plan.charSize} px · textures du monde ${plan.worldSize} px</p>
        ${persistNote}
        <div id="inst-run" style="display:none">
          <div class="inst-step" id="inst-step">Préparation…</div>
          <div class="inst-bar"><div id="inst-fill"></div></div>
          <div class="inst-detail"><span id="inst-detail"></span><span id="inst-pct">0 %</span></div>
        </div>
        <div id="inst-done" style="display:none"></div>
        <button class="btn primary" id="inst-go">${update ? 'Mettre à jour les données' : 'Installer les données'}</button>
      </div>`;
    const go = root.querySelector('#inst-go');
    const run = root.querySelector('#inst-run');
    const fill = root.querySelector('#inst-fill');
    const step = root.querySelector('#inst-step');
    const detail = root.querySelector('#inst-detail');
    const pct = root.querySelector('#inst-pct');
    let started = false;
    const start = async () => {
      if (started) return;
      started = true;
      go.style.display = 'none';
      run.style.display = '';
      try {
        const meta = await installer.install((f, label, det) => {
          fill.style.width = (f * 100).toFixed(1) + '%';
          pct.textContent = Math.floor(f * 100) + ' %';
          if (label) step.textContent = label;
          detail.textContent = det || '';
          root.querySelector('#inst-dev').innerHTML = deviceRows(device.profile);
        });
        run.style.display = 'none';
        const done = root.querySelector('#inst-done');
        done.style.display = '';
        done.innerHTML = `<p class="ok">✦ Données installées : ${fmtMb(meta.bytes)} en ${String(meta.seconds).replace('.', ',')} s. Réglages adaptés à votre appareil (palier ${TIER_LABEL[meta.tier]}).</p>
          <button class="btn primary" id="inst-play">Continuer</button>`;
        const play = done.querySelector('#inst-play');
        const finish = () => {
          window.removeEventListener('keydown', onKey);
          root.remove();
          resolve(meta);
        };
        play.addEventListener('click', finish);
        play.focus();
        if (auto) finish();
      } catch (e) {
        console.error(e);
        run.style.display = 'none';
        go.style.display = '';
        go.textContent = 'Réessayer l’installation';
        started = false;
        const done = root.querySelector('#inst-done');
        done.style.display = '';
        done.innerHTML = `<p class="warn">L’installation a échoué : ${escapeHtml(e && e.message ? e.message : String(e))}. Libérez de l’espace de stockage puis réessayez.</p>`;
      }
    };
    go.addEventListener('click', start);
    // Tests automatisés : ?autoinstall lance et valide l'installation sans intervention
    const auto = /[?&]autoinstall\b/.test(location.search);
    if (auto) setTimeout(start, 50);
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const play = root.querySelector('#inst-play');
      if (play) play.click();
      else start();
    };
    window.addEventListener('keydown', onKey);
    go.focus();
    // Manette : bouton A
    let prevA = true;
    const poll = () => {
      if (!root.isConnected) return;
      const pad = listGamepads().find((p) => p && p.connected);
      const a = !!(pad && pad.buttons[0] && pad.buttons[0].pressed);
      if (a && !prevA) onKey({ key: 'Enter' });
      prevA = a;
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}
