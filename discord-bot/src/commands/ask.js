import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { askClaude, getAiConfig } from '../ai/claude.js';
import { getLevel, LEVELS } from '../ai/reflexion.js';
import { splitMessage, thinkingFrame } from '../ai/ui.js';

const SYSTEM_PROMPT = [
  'Tu es l’assistant d’un serveur Discord.',
  'Réponds en français, de façon claire et concise.',
  'Quand on demande du code, donne-le dans un bloc markdown avec le langage indiqué.',
  'Pour les bots, utilise discord.js v14 en ESM.',
].join(' ');

const FRAME_MS = 1500;
const MAX_CHUNK = 1800;
const cooldowns = new Map();
const busy = new Set();

function canUseAi(interaction) {
  const allowed = (process.env.AI_ALLOWED_USER_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  if (allowed.includes(interaction.user.id)) return true;
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}

// Renvoie le nombre de secondes à attendre, ou 0 si la question peut partir.
function cooldownLeft(userId) {
  const seconds = Number.parseInt(process.env.AI_COOLDOWN_SECONDS, 10) || 20;
  const last = cooldowns.get(userId) ?? 0;
  const left = Math.ceil((last + seconds * 1000 - Date.now()) / 1000);
  if (left > 0) return left;
  cooldowns.set(userId, Date.now());
  return 0;
}

export default {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Pose une question ou demande du code à Claude')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Ta question, ou la commande Discord que tu veux créer')
        .setRequired(true)
        .setMaxLength(1000),
    ),
  async execute(interaction) {
    const ephemeral = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (!canUseAi(interaction)) {
      await ephemeral('Cette commande est réservée aux administrateurs et aux utilisateurs autorisés.');
      return;
    }

    const config = getAiConfig();
    if (!config.apiKey) {
      await ephemeral('Aucune clé API n’est configurée. Ajoute ANTHROPIC_API_KEY dans le fichier .env, puis relance le bot.');
      return;
    }

    if (busy.has(interaction.user.id)) {
      await ephemeral('Ta question précédente est encore en cours de traitement.');
      return;
    }

    const left = cooldownLeft(interaction.user.id);
    if (left) {
      await ephemeral(`Patiente encore ${left} s avant de poser une nouvelle question.`);
      return;
    }

    const question = interaction.options.getString('question', true);
    const level = await getLevel(interaction.user.id);
    const { budget, label } = LEVELS[level];

    busy.add(interaction.user.id);
    await interaction.deferReply();

    const started = Date.now();
    const elapsed = () => Math.floor((Date.now() - started) / 1000);
    let queue = Promise.resolve();
    let finished = false;
    let tick = 0;

    // Toutes les modifications du message passent par une file : elles arrivent dans l'ordre.
    const edit = (payload) => {
      queue = queue.then(() => interaction.editReply(payload)).catch(() => {});
      return queue;
    };

    try {
      await edit({ content: thinkingFrame(tick++, 0, label) });
      const timer = setInterval(() => {
        if (!finished) edit({ content: thinkingFrame(tick++, elapsed(), label) });
      }, FRAME_MS);

      try {
        const answer = await askClaude({ prompt: question, system: SYSTEM_PROMPT, thinkingBudget: budget, config });
        finished = true;
        clearInterval(timer);

        const details = [config.model];
        if (!budget) details.push('réflexion désactivée');
        else if (answer.thinkingApplied) details.push(`réflexion ${label.toLowerCase()}`);
        else details.push('réflexion non prise en charge');
        details.push(`${elapsed()} s`);
        if (answer.stopReason === 'max_tokens') details.push('réponse tronquée');

        const chunks = splitMessage(answer.text || 'Claude n’a pas renvoyé de texte.', MAX_CHUNK);
        chunks[chunks.length - 1] += `\n-# ${details.join(' · ')}`;

        await edit({ content: chunks[0] });
        for (const chunk of chunks.slice(1)) {
          await interaction.followUp({ content: chunk }).catch(() => {});
        }
      } catch (error) {
        finished = true;
        clearInterval(timer);
        console.error('[ask] échec de la requête à Claude :', error.message);
        await edit({ content: `⚠️ ${error.message}` });
      }
    } finally {
      busy.delete(interaction.user.id);
    }
  },
};
