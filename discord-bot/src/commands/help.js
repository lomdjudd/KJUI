import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

// Discord limite un embed à 25 fields.
const MAX_FIELDS = 25;

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche la liste des commandes disponibles'),
  async execute(interaction) {
    const entries = [...(interaction.client.commands?.entries() ?? [])];
    const shown = entries.slice(0, MAX_FIELDS);
    const hidden = entries.length - shown.length;

    const embed = new EmbedBuilder()
      .setTitle('Commandes disponibles')
      .addFields(
        shown.map(([name, command]) => ({
          name: `/${name}`,
          value: command.data.description,
        })),
      );

    if (entries.length === 0) {
      embed.setDescription('Aucune commande disponible.');
    }
    if (hidden > 0) {
      embed.setFooter({ text: `${hidden} commande(s) non affichée(s) (limite de ${MAX_FIELDS} par message)` });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
