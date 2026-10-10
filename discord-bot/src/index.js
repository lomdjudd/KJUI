import { fileURLToPath } from 'node:url';
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { loadCommands, loadEvents } from './loader.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Signal ${signal} reçu, arrêt du bot...`);
  try {
    await client.destroy();
  } catch (error) {
    logger.error("Erreur lors de l'arrêt du client :", error);
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Promesse rejetée non gérée :', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Exception non interceptée :', error);
});

async function main() {
  client.commands = await loadCommands(fileURLToPath(new URL('./commands', import.meta.url)));
  logger.info(`${client.commands.size} commande(s) chargée(s).`);

  const events = await loadEvents(fileURLToPath(new URL('./events', import.meta.url)));
  for (const event of events) {
    const listener = async (...args) => {
      try {
        await event.execute(...args);
      } catch (error) {
        logger.error(`Erreur dans l'événement ${event.name} :`, error);
      }
    };
    client[event.once ? 'once' : 'on'](event.name, listener);
  }
  logger.info(`${events.length} événement(s) chargé(s).`);

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Échec du démarrage :', error);
  process.exit(1);
});
