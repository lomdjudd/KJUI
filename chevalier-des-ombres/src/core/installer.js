// Installation des données du jeu (obligatoire au premier lancement) :
// analyse de l'appareil, modèles 3D et textures recolorées, textures du monde en haute
// résolution, banque de sons. Tout est conservé dans IndexedDB ; les lancements suivants
// se contentent de recharger ces données prêtes à l'emploi.
import * as THREE from 'three';
import { datastore, sizeOf } from './datastore.js';
import { device, TIER_REC } from './device.js';
import { settings } from './settings.js';
import { soundbank } from './soundbank.js';
import { recorded } from './recorded.js';
import { PACK, decodeDataUrl } from '../data/pack.js';
import { worldTextureKeys, generateWorldTexture, setInstalledWorldTextures } from '../gfx/textures.js';
import { KNIGHT_VARIANTS, extractGlbImage, stripGlbImages, blobToPixels, recolorPixels, pixelsToBlob, registerModel, registerVariantTexture } from '../actors/glb.js';
import { RigBuilder } from '../actors/rig.js';
import { SCULPT, sculptStore, describeRig } from '../actors/sculpt.js';
import { createSculptPool } from '../actors/sculptPool.js';
import { buildHumanoid } from '../actors/models.js';
import { createCharMaterial } from '../gfx/materials.js';
import { ENEMIES } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';
import { NPCS } from '../data/quests.js';
import { buildModelFor } from '../game/enemy.js';

// À incrémenter quand le contenu des données change (force une réinstallation)
export const DATA_VERSION = 3;

// Toutes les créatures à sculpter (le chevalier texturé et ses variantes sont exclus)
function sculptSources() {
  const mat = createCharMaterial();
  const src = [];
  for (const d of ENEMIES) if (!d.glb) src.push({ label: d.name, boss: false, build: () => buildModelFor(d) });
  for (const d of BOSSES) if (!d.glb) src.push({ label: d.name, boss: true, build: () => buildModelFor(d) });
  for (const n of Object.values(NPCS)) if (n.look) src.push({ label: n.name, boss: false, build: () => buildHumanoid(n.look, mat) });
  return { src, dispose: () => mat.dispose() };
}

export const TEX_LABELS = {
  stone: 'pierre taillée', tiles: 'dalles des catacombes', cobble: 'pavés', rock: 'roche', bark: 'écorce', wood: 'bois',
  metal: 'métal', detail: 'détails des armures', lava: 'lave', water: 'eau', ice: 'glace',
  ground_dirt: 'terre', ground_grass: 'herbe morte', ground_mud: 'boue', ground_snow: 'neige', ground_ash: 'cendres', ground_void: 'sol du Néant', ground_sand: 'sable',
};

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const bitmap = (blob, size) =>
  createImageBitmap(blob, size ? { resizeWidth: size, resizeHeight: size, resizeQuality: 'high', colorSpaceConversion: 'none', premultiplyAlpha: 'none' } : { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });

// Rendu hors écran pour le test de performance (contexte séparé, libéré ensuite)
function benchRenderer() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    return new THREE.WebGLRenderer({ canvas: c, antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
}

export const installer = {
  meta: null,

  async init() {
    await datastore.open();
    this.meta = (await datastore.get('meta')) || null;
    return this.meta;
  },

  get upToDate() {
    return !!(this.meta && this.meta.version === DATA_VERSION);
  },

  get persistent() {
    return datastore.persistent;
  },

  // Tailles prévues selon le palier (avant installation)
  plan(tier = device.tier) {
    const rec = TIER_REC[tier];
    const charSize = Math.min(settings.get('charTexture') || rec.charTexture, device.profile ? device.profile.maxTex : 4096);
    const worldSize = rec.worldTexture;
    const variants = Object.keys(KNIGHT_VARIANTS).length;
    const texMb = (variants * charSize * charSize * 0.28 + 18 * worldSize * worldSize * 2 * 0.3) / 1048576;
    const audioMb = { low: 3, medium: 6, high: 10 }[settings.get('audioQuality')] || 6;
    const sculptMb = (70 * rec.sculptTarget * 34) / 1048576;
    return { charSize, worldSize, sculptTarget: rec.sculptTarget, sculptN: rec.sculptN, estMb: Math.round(texMb + audioMb + sculptMb + 1) };
  },

  // Installation complète ; onProgress(fraction 0..1, étape, détail)
  async install(onProgress) {
    const t0 = performance.now();
    const steps = [
      ['analyse', 0.05],
      ['modèles', 0.13],
      ['textures', 0.32],
      ['sons', 0.14],
      ['créatures', 0.33],
      ['fin', 0.03],
    ];
    let base = 0;
    const stepProgress = (i, f, label, detail) => {
      onProgress(Math.min(0.999, base + steps[i][1] * f), label, detail || '');
    };
    const next = (i) => {
      base += steps[i][1];
    };
    // 1. Analyse de l'appareil
    stepProgress(0, 0, 'Analyse de l’appareil', 'Mémoire, processeur graphique, test de performance…');
    await frame();
    const br = benchRenderer();
    device.analyze(br);
    if (br) {
      br.dispose();
      br.forceContextLoss();
    }
    if (settings.get('autoQuality')) settings.applyRecommended(device.tier);
    const plan = this.plan();
    next(0);
    await datastore.clear();

    // 2. Modèles 3D et textures des personnages
    const variants = Object.keys(KNIGHT_VARIANTS);
    for (const [name, m] of Object.entries(PACK.models)) {
      stepProgress(1, 0, 'Préparation des modèles 3D', m.label);
      await frame();
      const glb = decodeDataUrl(m.data);
      await datastore.put('model:' + name, stripGlbImages(glb));
      const img = extractGlbImage(glb);
      const src = await blobToPixels(img, plan.charSize);
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        stepProgress(1, (i + 0.5) / variants.length, 'Textures des personnages', `${m.label} · variante ${i + 1}/${variants.length}`);
        await frame();
        const { col, emi } = recolorPixels(src, KNIGHT_VARIANTS[v]);
        const colBlob = await pixelsToBlob(col, plan.charSize, plan.charSize, 0.92);
        const emiBlob = await pixelsToBlob(emi, plan.charSize, plan.charSize, 0.85);
        await datastore.put(`tex:${name}:${v}`, { col: colBlob, emi: emiBlob, size: plan.charSize });
      }
    }
    next(1);

    // 3. Textures du monde en haute résolution
    const keys = worldTextureKeys();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const label = `Texture ${i + 1}/${keys.length} : ${TEX_LABELS[k] || k}`;
      const { col, nrm } = await generateWorldTexture(k, plan.worldSize, async (f) => {
        stepProgress(2, (i + f * 0.85) / keys.length, 'Génération des textures HD', label);
        await frame();
      });
      stepProgress(2, (i + 0.9) / keys.length, 'Génération des textures HD', label);
      const colBlob = await pixelsToBlob(col, plan.worldSize, plan.worldSize, 0.9);
      const nrmBlob = await pixelsToBlob(nrm, plan.worldSize, plan.worldSize, 0.92);
      await datastore.put('tex:world:' + k, { col: colBlob, nrm: nrmBlob, size: plan.worldSize });
      await frame();
    }
    next(2);

    // 4. Banque de sons (instruments et bruitages)
    const bank = await soundbank.render(settings.get('audioQuality'), async (f, detail) => {
      stepProgress(3, f * 0.55, 'Création de la banque de sons', detail);
      await frame();
    });
    await datastore.put('audio:bank', bank);
    // Musiques orchestrales et bruitages enregistrés
    await recorded.install(async (f, detail) => {
      stepProgress(3, 0.55 + f * 0.45, 'Installation des musiques et bruitages', detail);
      if (Math.random() < 0.3) await frame();
    });
    next(3);

    // 5. Sculpture des créatures et des boss (anatomie HD, en parallèle sur plusieurs cœurs)
    stepProgress(4, 0, 'Sculpture des créatures', 'Préparation des anatomies…');
    await frame();
    const prevSculpt = SCULPT.enabled;
    SCULPT.enabled = true;
    const jobs = [];
    const seen = new Set();
    let cur = null;
    RigBuilder.capture = (rb, sig) => {
      if (seen.has(sig)) return;
      seen.add(sig);
      jobs.push({ sig, desc: describeRig(rb), label: cur.label, boss: cur.boss });
    };
    const { src, dispose } = sculptSources();
    for (const s of src) {
      cur = s;
      try {
        const b = s.build();
        b.mesh.geometry.dispose();
        if (b.mesh.material && b.mesh.material.dispose) b.mesh.material.dispose();
      } catch (e) {
        console.warn('Créature ignorée', s.label, e);
      }
    }
    RigBuilder.capture = null;
    dispose();
    const pool = createSculptPool(Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)));
    const index = [];
    let done = 0;
    await Promise.all(
      jobs.map((j) =>
        pool
          .run(j.desc, { N: Math.round(plan.sculptN * (j.boss ? 1.15 : 1)), target: Math.round(plan.sculptTarget * (j.boss ? 1.6 : 1)) })
          .then(async (rec) => {
            if (rec) {
              await datastore.put('sculpt:' + j.sig, rec);
              index.push(j.sig);
            }
          })
          .catch((e) => console.warn('Sculpture ignorée', j.label, e))
          .finally(() => {
            done++;
            stepProgress(4, done / jobs.length, 'Sculpture des créatures', `${j.label} (${done}/${jobs.length})`);
          }),
      ),
    );
    pool.close();
    await datastore.put('sculpt:index', index);
    SCULPT.enabled = prevSculpt;
    next(4);

    // 6. Finalisation
    stepProgress(5, 0.5, 'Vérification', '');
    let bytes = 0;
    for (const k of await datastore.keys()) bytes += sizeOf(await datastore.get(k));
    this.meta = {
      version: DATA_VERSION,
      date: Date.now(),
      tier: device.tier,
      charSize: plan.charSize,
      worldSize: plan.worldSize,
      audioQuality: settings.get('audioQuality'),
      bytes,
      seconds: Math.round((performance.now() - t0) / 100) / 10,
      persistent: datastore.persistent && !datastore.quotaError,
    };
    await datastore.put('meta', this.meta);
    onProgress(1, 'Installation terminée', '');
    return this.meta;
  },

  // Chargement des données installées (à chaque lancement)
  async load(onProgress = () => {}) {
    const meta = this.meta;
    // Modèles
    for (const name of Object.keys(PACK.models)) {
      const buf = await datastore.get('model:' + name);
      if (!buf) continue;
      try {
        await registerModel(name, buf);
      } catch (e) {
        console.warn('Modèle ignoré', name, e);
      }
    }
    onProgress(0.2);
    // Textures des personnages (redimensionnées si l'option est plus basse que l'installation)
    const want = settings.get('charTexture') || 1024;
    for (const name of Object.keys(PACK.models)) {
      for (const v of Object.keys(KNIGHT_VARIANTS)) {
        const t = await datastore.get(`tex:${name}:${v}`);
        if (!t) continue;
        const size = want < t.size ? want : 0;
        const [c, e] = await Promise.all([bitmap(t.col, size), bitmap(t.emi, size ? size / 2 : t.size / 2)]);
        registerVariantTexture(name, v, c, e);
      }
    }
    onProgress(0.45);
    // Textures du monde
    const keys = worldTextureKeys();
    const low = settings.get('textureQuality') === 'low';
    const entries = [];
    let size = meta ? meta.worldSize : 256;
    for (const k of keys) {
      const t = await datastore.get('tex:world:' + k);
      if (!t) continue;
      const s = low ? Math.max(128, t.size / 2) : 0;
      const [c, n] = await Promise.all([bitmap(t.col, s), bitmap(t.nrm, s)]);
      size = s || t.size;
      entries.push([k, c, n]);
    }
    if (entries.length) setInstalledWorldTextures(size, entries);
    onProgress(0.85);
    // Sons
    const bank = await datastore.get('audio:bank');
    if (bank) soundbank.load(bank);
    await recorded.load();
    onProgress(0.92);
    // Créatures sculptées
    const index = (await datastore.get('sculpt:index')) || [];
    for (const sig of index) {
      const rec = await datastore.get('sculpt:' + sig);
      if (rec) sculptStore.set(sig, rec);
    }
    SCULPT.enabled = settings.get('charModel') !== 'classic';
    onProgress(1);
  },

  async uninstall() {
    await datastore.clear();
    this.meta = null;
  },
};
