import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Collection } from 'discord.js';

// Charge les modules .js d'un dossier, triés par nom. Un dossier absent donne une liste vide.
async function readModules(dirPath) {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = entries
    .filter((entry) => entry.isFile() && extname(entry.name) === '.js')
    .map((entry) => entry.name)
    .sort();

  const modules = [];
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(join(dirPath, file)).href);
      modules.push({ file, exported: mod.default });
    } catch (error) {
      console.warn(`[loader] ${file} ignoré : erreur au chargement (${error.message})`);
    }
  }
  return modules;
}

function isCommand(value) {
  return (
    typeof value?.data?.name === 'string' &&
    value.data.name.length > 0 &&
    typeof value.execute === 'function'
  );
}

function isEvent(value) {
  return typeof value?.name === 'string' && value.name.length > 0 && typeof value.execute === 'function';
}

export async function loadCommands(dirPath) {
  const commands = new Collection();

  for (const { file, exported } of await readModules(dirPath)) {
    if (!isCommand(exported)) {
      console.warn(`[loader] ${file} ignoré : commande invalide (data.name et execute requis)`);
      continue;
    }

    const name = exported.data.name;
    if (commands.has(name)) {
      console.warn(`[loader] ${file} ignoré : nom de commande en double "${name}"`);
      continue;
    }

    commands.set(name, exported);
  }

  return commands;
}

export async function loadEvents(dirPath) {
  const events = [];

  for (const { file, exported } of await readModules(dirPath)) {
    if (!isEvent(exported)) {
      console.warn(`[loader] ${file} ignoré : événement invalide (name et execute requis)`);
      continue;
    }
    events.push(exported);
  }

  return events;
}
