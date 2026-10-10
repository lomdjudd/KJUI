import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCommands } from '../src/loader.js';

const commandsDir = fileURLToPath(new URL('../src/commands', import.meta.url));
const NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

test('au moins une commande est chargée', async () => {
  const commands = await loadCommands(commandsDir);
  assert.ok(commands.size >= 1, 'aucune commande trouvée dans src/commands');
});

test('chaque commande a un nom, une description et une fonction execute valides', async (t) => {
  const commands = await loadCommands(commandsDir);
  for (const command of commands.values()) {
    await t.test(`« ${command.data.name} »`, () => {
      const { name, description } = command.data;
      assert.match(name, NAME_PATTERN, `nom invalide : ${name}`);
      assert.ok(
        description.length >= 1 && description.length <= 100,
        `description de « ${name} » : ${description.length} caractères (1 à 100 attendus)`,
      );
      assert.equal(typeof command.execute, 'function', `execute manquant pour « ${name} »`);
    });
  }
});

test('data.toJSON() ne lève pas d\'erreur pour chaque commande', async (t) => {
  const commands = await loadCommands(commandsDir);
  for (const command of commands.values()) {
    await t.test(`« ${command.data.name} »`, () => {
      assert.doesNotThrow(() => command.data.toJSON());
    });
  }
});

test('les noms de commandes sont uniques', async () => {
  const files = (await readdir(commandsDir)).filter((file) => file.endsWith('.js'));
  const names = [];
  for (const file of files) {
    const { default: command } = await import(pathToFileURL(join(commandsDir, file)).href);
    names.push(command.data.name);
  }
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert.deepEqual([...new Set(duplicates)], [], 'noms de commandes dupliqués');
});
