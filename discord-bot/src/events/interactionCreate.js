import { Events, MessageFlags } from 'discord.js';
import { logger } from '../logger.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Commande introuvable : /${interaction.commandName}`);
      await interaction.reply({
        content: 'Cette commande n\'existe plus.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Erreur dans /${interaction.commandName}`, error);

      const payload = {
        content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
        flags: MessageFlags.Ephemeral,
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch (replyError) {
        logger.warn('Impossible d\'envoyer le message d\'erreur à l\'utilisateur :', replyError);
      }
    }
  },
};
