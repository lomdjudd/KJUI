import { ActivityType, Events } from 'discord.js';
import { logger } from '../logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    const guildCount = client.guilds.cache.size;
    logger.info(`Connecté en tant que ${client.user.tag} (${client.user.id}) sur ${guildCount} serveur(s).`);

    try {
      client.user.setPresence({
        status: 'online',
        activities: [{ name: '/help', type: ActivityType.Watching }],
      });
    } catch (error) {
      logger.warn('Impossible de définir la présence du bot :', error);
    }
  },
};
