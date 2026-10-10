import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Affiche les informations du serveur'),
  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) {
      await interaction.reply({
        content: 'Cette commande ne fonctionne que sur un serveur.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Informations sur le serveur')
      .addFields(
        { name: 'Nom', value: guild.name },
        { name: 'Identifiant', value: guild.id },
        { name: 'Propriétaire', value: `<@${guild.ownerId}>` },
        { name: 'Membres', value: String(guild.memberCount) },
        { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>` },
        { name: 'Salons', value: String(guild.channels.cache.size) },
        { name: 'Rôles', value: String(guild.roles.cache.size) },
      );

    const icon = guild.iconURL();
    if (icon) {
      embed.setThumbnail(icon);
    }

    await interaction.reply({ embeds: [embed] });
  },
};
