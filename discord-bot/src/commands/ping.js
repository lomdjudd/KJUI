import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Affiche la latence du bot'),
  async execute(interaction) {
    await interaction.reply(`🏓 Pong ! Latence WebSocket : **${interaction.client.ws.ping} ms**`);
  },
};
