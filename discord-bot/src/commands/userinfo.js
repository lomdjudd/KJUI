import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const toUnix = (timestamp) => Math.floor(timestamp / 1000);

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Affiche les informations sur un utilisateur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Utilisateur à examiner (par défaut : vous)')
        .setRequired(false),
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('utilisateur') ?? interaction.user;

    const embed = new EmbedBuilder()
      .setTitle(`Informations sur ${user.displayName}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Identifiant', value: user.id },
        { name: 'Compte créé le', value: `<t:${toUnix(user.createdTimestamp)}:D>` },
      );

    if (interaction.guild) {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        embed.addFields(
          {
            name: 'A rejoint le serveur le',
            value: member.joinedTimestamp ? `<t:${toUnix(member.joinedTimestamp)}:D>` : 'Inconnu',
          },
          // Le rôle @everyone est présent dans le cache : on le retire du compte.
          { name: 'Rôles', value: String(Math.max(0, member.roles.cache.size - 1)) },
        );
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
};
