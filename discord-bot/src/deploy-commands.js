import { fileURLToPath } from 'node:url';
import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { loadCommands } from './loader.js';

try {
  const commands = await loadCommands(fileURLToPath(new URL('./commands', import.meta.url)));
  const body = [...commands.values()].map((command) => command.data.toJSON());
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(route, { body });

  const scope = config.guildId
    ? `serveur ${config.guildId} (effet immédiat)`
    : 'global (peut prendre jusqu\'à 1 h)';
  console.log(`${body.length} commande(s) déployée(s), portée : ${scope}.`);
} catch (error) {
  console.error('Échec du déploiement des commandes :', error);
  process.exitCode = 1;
}
