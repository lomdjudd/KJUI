import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('choose')
    .setDescription('Choisit au hasard parmi plusieurs options')
    .addStringOption((option) =>
      option
        .setName('options')
        .setDescription('Options séparées par des virgules (ex : pizza, sushi, tacos)')
        .setRequired(true)
    ),
  async execute(interaction) {
    const choices = interaction.options
      .getString('options', true)
      .split(',')
      .map((choice) => choice.trim())
      .filter((choice) => choice !== '');

    if (choices.length < 2) {
      await interaction.reply({
        content: 'Indique au moins deux options, séparées par des virgules.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pick = choices[Math.floor(Math.random() * choices.length)];
    await interaction.reply({
      content: `🤔 Je choisis : **${pick}**`,
      allowedMentions: { parse: [] },
    });
  },
};
