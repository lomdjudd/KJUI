import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Niveaux de réflexion : budget de jetons alloués au raisonnement avant la réponse.
export const LEVELS = {
  off: { label: 'Désactivée', budget: 0, bars: 0 },
  leger: { label: 'Légère', budget: 1024, bars: 1 },
  moyen: { label: 'Moyenne', budget: 4096, bars: 2 },
  eleve: { label: 'Élevée', budget: 8192, bars: 3 },
};

const STORE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'reflexion.json');

// Barre de niveau : `filled` cases pleines sur 3.
export function bar(filled) {
  return '▰'.repeat(filled) + '▱'.repeat(3 - filled);
}

async function readStore() {
  try {
    return JSON.parse(await readFile(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export async function getLevel(userId) {
  const store = await readStore();
  const level = store[userId];
  return Object.hasOwn(LEVELS, level) ? level : 'off';
}

export async function setLevel(userId, level) {
  const store = await readStore();
  store[userId] = level;
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}
