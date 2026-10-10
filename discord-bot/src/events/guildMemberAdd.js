import { EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    let channel;
    if (config.welcomeChannelId) {
      channel =
        member.guild.channels.cache.get(config.welcomeChannelId) ??
        (await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null));
    } else {
      channel = member.guild.systemChannel;
    }

    if (!channel || !channel.isTextBased()) {
      logger.debug(`Aucun salon de bienvenue utilisable sur « ${member.guild.name} ».`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Bienvenue !')
      .setDescription(
        `Bienvenue ${member} sur **${member.guild.name}** ! Nous sommes désormais ${member.guild.memberCount} membres.`,
      )
      .setThumbnail(member.user.displayAvatarURL());

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.warn(`Impossible d'envoyer le message de bienvenue dans #${channel.name} :`, error);
    }
  },
};
