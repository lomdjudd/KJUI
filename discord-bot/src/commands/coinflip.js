import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Lance une pièce : pile ou face'),
  async execute(interaction) {
    const side = Math.random() < 0.5 ? 'Pile' : 'Face';
    await interaction.reply(`🪙 **${side}** !`);
  },
};
