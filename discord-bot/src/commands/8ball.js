import { SlashCommandBuilder, MessageFlags } from 'discord.js';

const ANSWERS = [
  'Oui, sans aucun doute.',
  'C’est certain.',
  'Il en est décidément ainsi.',
  'Oui, absolument.',
  'Tu peux compter dessus.',
  'Selon moi, oui.',
  'Très probablement.',
  'Les perspectives sont bonnes.',
  'Oui.',
  'Les signes indiquent que oui.',
  'Ce n’est pas certain.',
  'Reviens plus tard…',
  'Mieux vaut ne pas te le dire maintenant.',
  'Impossible à prédire pour le moment.',
  'Concentre-toi et demande à nouveau.',
  'Ne compte pas dessus.',
  'Ma réponse est non.',
  'Mes sources disent non.',
  'Les perspectives ne sont pas très bonnes.',
  'Très peu probable.',
];

export default {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Pose une question à la boule magique')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('La question à poser à la boule magique')
        .setRequired(true)
        .setMaxLength(200)
    ),
  async execute(interaction) {
    const question = interaction.options.getString('question', true).trim();
    if (question === '') {
      await interaction.reply({ content: 'Pose une vraie question.', flags: MessageFlags.Ephemeral });
      return;
    }

    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    await interaction.reply({
      content: `🎱 **Question :** ${question}\n**Réponse :** ${answer}`,
      allowedMentions: { parse: [] },
    });
  },
};
