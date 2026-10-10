import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { bar, LEVELS, setLevel } from '../ai/reflexion.js';

const STEP_MS = 350;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  data: new SlashCommandBuilder()
    .setName('reflexion')
    .setDescription('Règle le niveau de réflexion de Claude pour tes questions')
    .addStringOption((option) =>
      option
        .setName('niveau')
        .setDescription('Plus la réflexion est élevée, plus la réponse est lente et coûteuse')
        .setRequired(true)
        .addChoices(
          { name: 'Désactivée (le plus rapide)', value: 'off' },
          { name: 'Légère', value: 'leger' },
          { name: 'Moyenne', value: 'moyen' },
          { name: 'Élevée (le plus lent)', value: 'eleve' },
        ),
    ),
  async execute(interaction) {
    const level = interaction.options.getString('niveau', true);
    const { label, budget, bars } = LEVELS[level];

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Animation : la barre se remplit jusqu'au niveau choisi.
    for (let step = 0; step <= bars; step++) {
      await interaction.editReply({ content: `⚙️ Réglage en cours… ${bar(step)}` });
      if (step < bars) await wait(STEP_MS);
    }

    await setLevel(interaction.user.id, level);
    await interaction.editReply({
      content: `✅ Réflexion réglée sur **${label}** ${bar(bars)}\n-# Budget : ${budget ? `${budget} jetons` : 'aucun'} · s'applique à tes prochains /ask`,
    });
  },
};
