// Musiques et bruitages enregistrés (données installées). À l'installation, les fichiers livrés
// avec le jeu (dossier audio/) sont copiés dans le stockage de l'appareil ; ensuite, le jeu les
// relit depuis ce stockage, même hors ligne. Sans ces fichiers, les sons de synthèse prennent le relais.
import { AUDIO_MANIFEST } from '../data/audioCredits.js';
import { datastore } from './datastore.js';

const MIME = { webm: 'audio/webm', ogg: 'audio/ogg' };
const mimeOf = (p) => MIME[p.split('.').pop()] || 'application/octet-stream';

export const recorded = {
  installed: false,
  hasMusic: false,
  index: null,

  entries() {
    return [
      ...Object.entries(AUDIO_MANIFEST.music).map(([id, path]) => ({ kind: 'music', id, path })),
      ...Object.entries(AUDIO_MANIFEST.sfx).map(([id, path]) => ({ kind: 'sfx', id, path })),
    ];
  },

  // Copie des fichiers dans le stockage ; onProgress(fraction, détail)
  async install(onProgress = () => {}) {
    const list = this.entries();
    let ok = 0;
    let music = 0;
    let bytes = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      try {
        const r = await fetch(e.path);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = await r.arrayBuffer();
        await datastore.put('rec:' + e.path, new Blob([buf], { type: mimeOf(e.path) }));
        bytes += buf.byteLength;
        ok++;
        if (e.kind === 'music') music++;
      } catch {
        // fichier absent (page ouverte depuis le disque, réseau coupé…) : son de synthèse
      }
      await onProgress((i + 1) / list.length, e.kind === 'music' ? `Musique : ${e.id}` : `Bruitage : ${e.id}`);
    }
    this.index = { ok, music, total: list.length, bytes };
    await datastore.put('rec:index', this.index);
    this.installed = ok > 0;
    this.hasMusic = music > 0;
    return this.index;
  },

  async load() {
    this.index = (await datastore.get('rec:index')) || null;
    this.installed = !!(this.index && this.index.ok > 0);
    this.hasMusic = !!(this.index && this.index.music > 0);
  },

  // Fichier installé (ou, à défaut, téléchargé à la volée)
  async blob(path) {
    let b = null;
    try {
      b = await datastore.get('rec:' + path);
    } catch {
      b = null;
    }
    if (!b) {
      try {
        const r = await fetch(path);
        if (r.ok) b = await r.blob();
      } catch {
        b = null;
      }
    }
    return b;
  },

  // Le navigateur sait-il lire les musiques (Opus dans WebM) ?
  canPlayMusic() {
    try {
      const a = document.createElement('audio');
      return !!a.canPlayType && a.canPlayType('audio/webm; codecs="opus"') !== '';
    } catch {
      return false;
    }
  },
};
