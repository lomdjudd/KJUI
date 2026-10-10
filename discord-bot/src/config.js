import 'dotenv/config';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

// Le premier segment du token Discord est l'ID de l'application, encodé en base64.
function clientIdFromToken(token) {
  const decoded = Buffer.from(token.split('.')[0], 'base64').toString('utf8');
  return /^\d+$/.test(decoded) ? decoded : undefined;
}

const token = readEnv('DISCORD_TOKEN');
if (!token || !token.includes('.')) {
  throw new Error('DISCORD_TOKEN manquant ou invalide dans .env');
}

const requestedLogLevel = readEnv('LOG_LEVEL')?.toLowerCase();

export const config = Object.freeze({
  token,
  clientId: readEnv('DISCORD_CLIENT_ID') ?? clientIdFromToken(token),
  guildId: readEnv('DISCORD_GUILD_ID'),
  welcomeChannelId: readEnv('WELCOME_CHANNEL_ID'),
  logLevel: LOG_LEVELS.includes(requestedLogLevel) ? requestedLogLevel : 'info',
});
