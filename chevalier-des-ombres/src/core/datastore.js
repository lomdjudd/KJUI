// Stockage des données installées (modèles, textures HD, banque de sons) dans IndexedDB.
// Si IndexedDB est indisponible (navigation privée, cadre restreint), les données restent
// en mémoire le temps de la session : le jeu fonctionne, mais l'installation sera refaite.
const DB_NAME = 'chevalier-des-ombres-data';
const STORE = 'kv';

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

class DataStore {
  constructor() {
    this.db = null;
    this.mem = new Map();
    this.persistent = false;
  }

  async open() {
    if (this.db || this._tried) return this.persistent;
    this._tried = true;
    try {
      if (!window.indexedDB) throw new Error('IndexedDB indisponible');
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      this.db = await Promise.race([req(open), new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), 4000))]);
      this.persistent = true;
      // Demande au navigateur de ne pas effacer ces données sous pression de stockage
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch {
      this.db = null;
      this.persistent = false;
    }
    return this.persistent;
  }

  _tx(mode) {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }

  async get(key) {
    if (!this.db) return this.mem.get(key);
    try {
      return await req(this._tx('readonly').get(key));
    } catch {
      return this.mem.get(key);
    }
  }

  async put(key, value) {
    if (!this.db) {
      this.mem.set(key, value);
      return;
    }
    try {
      await req(this._tx('readwrite').put(value, key));
    } catch (e) {
      // Quota dépassé : on garde la donnée en mémoire pour cette session
      this.mem.set(key, value);
      this.quotaError = e;
    }
  }

  async delete(key) {
    this.mem.delete(key);
    if (this.db) await req(this._tx('readwrite').delete(key)).catch(() => {});
  }

  async keys() {
    const k = new Set(this.mem.keys());
    if (this.db) for (const x of await req(this._tx('readonly').getAllKeys()).catch(() => [])) k.add(x);
    return [...k];
  }

  async clear() {
    this.mem.clear();
    if (this.db) await req(this._tx('readwrite').clear()).catch(() => {});
  }
}

export const datastore = new DataStore();

// Taille approximative d'une valeur stockée (octets)
export function sizeOf(v) {
  if (!v) return 0;
  if (v instanceof Blob) return v.size;
  if (v instanceof ArrayBuffer) return v.byteLength;
  if (ArrayBuffer.isView(v)) return v.byteLength;
  if (typeof v === 'string') return v.length * 2;
  if (typeof v === 'object') {
    let n = 0;
    for (const k in v) n += sizeOf(v[k]);
    return n;
  }
  return 8;
}
