// Sauvegardes : 3 emplacements manuels + 1 emplacement automatique, export/import par code.
import { storage } from '../core/storage.js';
import { migrateProfile, SAVE_VERSION } from './state.js';
import { ZONES } from '../data/zones.js';

const PREFIX = 'cdo_save_';
export const SLOTS = ['auto', '1', '2', '3'];

export function slotLabel(slot) {
  return slot === 'auto' ? 'Sauvegarde auto' : 'Emplacement ' + slot;
}

export function saveProfile(slot, profile) {
  profile.saved = Date.now();
  profile.version = SAVE_VERSION;
  const data = JSON.stringify(profile);
  storage.set(PREFIX + slot, data);
  storage.set(PREFIX + 'last', slot);
  return true;
}

export function loadProfile(slot) {
  const raw = storage.get(PREFIX + slot);
  if (!raw) return null;
  try {
    return migrateProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteSlot(slot) {
  storage.remove(PREFIX + slot);
}

export function lastSlot() {
  return storage.get(PREFIX + 'last');
}

// Résumé affiché dans l'écran des sauvegardes
export function slotInfo(slot) {
  const p = loadProfile(slot);
  if (!p) return null;
  const zone = ZONES[p.zone];
  return {
    slot,
    level: p.level,
    zone: zone ? zone.name : p.zone,
    playTime: p.stats.playTime,
    saved: p.saved,
    bosses: Object.keys(p.bosses).length,
    difficulty: p.difficulty,
    ending: p.ending,
  };
}

export function mostRecentSlot() {
  let best = null;
  for (const s of SLOTS) {
    const i = slotInfo(s);
    if (i && (!best || i.saved > best.saved)) best = i;
  }
  return best;
}

// Code de sauvegarde exportable (base64 d'un JSON)
export function exportCode(profile) {
  const json = JSON.stringify(profile);
  return 'CDO1:' + btoa(unescape(encodeURIComponent(json)));
}

export function importCode(code) {
  code = code.trim();
  if (!code.startsWith('CDO1:')) throw new Error('Code invalide');
  const json = decodeURIComponent(escape(atob(code.slice(5))));
  const p = JSON.parse(json);
  if (!p || typeof p.level !== 'number') throw new Error('Code invalide');
  return migrateProfile(p);
}
