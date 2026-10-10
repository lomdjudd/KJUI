// Client minimal pour l'API Messages d'Anthropic.
// Il faut une clé API (console.anthropic.com), facturée à l'usage.
// L'abonnement Claude Pro ne donne pas accès à l'API.
// Pas d'import de config ni de logger ici : ce module doit rester chargeable dans les tests.

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-haiku-5-5';
const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 120_000;

export class ClaudeError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ClaudeError';
    this.status = status;
  }
}

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getAiConfig(env = process.env) {
  return {
    apiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    model: env.AI_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: (env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ''),
    maxTokens: positiveInt(env.AI_MAX_TOKENS, 2048),
  };
}

function buildBody({ model, maxTokens }, { prompt, system, thinkingBudget }) {
  const body = {
    model,
    // La réflexion étendue exige max_tokens supérieur au budget de réflexion.
    max_tokens: thinkingBudget > 0 ? Math.max(maxTokens, thinkingBudget + 1024) : maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) body.system = system;
  if (thinkingBudget > 0) body.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
  return body;
}

async function send(config, body, fetchImpl) {
  const response = await fetchImpl(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

const errorText = (data) => data?.error?.message ?? '';

export async function askClaude({ prompt, system, thinkingBudget = 0, config = getAiConfig(), fetchImpl = fetch }) {
  if (!config.apiKey) {
    throw new ClaudeError('ANTHROPIC_API_KEY n’est pas configurée dans .env.');
  }

  let result = await send(config, buildBody(config, { prompt, system, thinkingBudget }), fetchImpl);
  let thinkingApplied = thinkingBudget > 0;

  // Si le modèle refuse la réflexion étendue, on répond sans elle plutôt que d'échouer.
  if (!result.ok && thinkingBudget > 0 && result.status === 400 && /thinking/i.test(errorText(result.data))) {
    result = await send(config, buildBody(config, { prompt, system, thinkingBudget: 0 }), fetchImpl);
    thinkingApplied = false;
  }

  if (!result.ok) {
    throw new ClaudeError(errorText(result.data) || `Erreur de l'API (HTTP ${result.status}).`, result.status);
  }

  const text = (result.data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  return {
    text,
    thinkingApplied,
    stopReason: result.data.stop_reason ?? null,
    usage: result.data.usage ?? null,
  };
}
