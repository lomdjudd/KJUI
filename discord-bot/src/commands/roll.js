import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { parseDice, rollDice } from '../utils/dice.js';

function formatExpression({ count, sides, modifier }) {
  const sign = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
  return `${count}d${sides}${sign}`;
}

function formatModifier(modifier) {
  if (modifier === 0) return '';
  return ` ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Lance des dés, par exemple 2d6+3')
    .addStringOption((option) =>
      option
        .setName('expression')
        .setDescription('Dés à lancer, ex : 2d20+5 (défaut : d6)')
        .setRequired(false)
    ),
  async execute(interaction) {
    const expression = interaction.options.getString('expression') ?? 'd6';

    let spec;
    try {
      spec = parseDice(expression);
    } catch (error) {
      await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
      return;
    }

    const { rolls, total } = rollDice(spec);
    await interaction.reply(
      `🎲 Résultat de \`${formatExpression(spec)}\` : [${rolls.join(', ')}]${formatModifier(spec.modifier)} = **${total}**`
    );
  },
};
