import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Affiche la photo de profil d’un utilisateur en grand')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Utilisateur dont afficher l’avatar (par défaut : vous)')
        .setRequired(false),
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('utilisateur') ?? interaction.user;

    const embed = new EmbedBuilder()
      .setTitle(`Avatar de ${user.displayName}`)
      .setImage(user.displayAvatarURL({ size: 1024 }));

    await interaction.reply({ embeds: [embed] });
  },
};
