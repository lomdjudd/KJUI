import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askClaude, getAiConfig, ClaudeError } from '../src/ai/claude.js';
import { bar, LEVELS } from '../src/ai/reflexion.js';
import { movingBar, splitMessage, thinkingFrame } from '../src/ai/ui.js';

const config = { apiKey: 'cle-de-test', model: 'claude-haiku-5-5', baseUrl: 'https://example.test', maxTokens: 2048 };

// Faux fetch : renvoie les réponses données dans l'ordre et garde trace des appels.
function fakeFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = responses.shift();
    return { ok: next.status < 400, status: next.status, json: async () => next.data };
  };
  return { fetchImpl, calls };
}

test('getAiConfig applique les valeurs par défaut', () => {
  const defaults = getAiConfig({});
  assert.equal(defaults.apiKey, undefined);
  assert.equal(defaults.model, 'claude-haiku-5-5');
  assert.equal(defaults.maxTokens, 2048);
});

test('getAiConfig lit la clé et les limites depuis l’environnement', () => {
  const custom = getAiConfig({ ANTHROPIC_API_KEY: ' cle ', AI_MAX_TOKENS: '500', ANTHROPIC_BASE_URL: 'http://localhost:9/' });
  assert.equal(custom.apiKey, 'cle');
  assert.equal(custom.maxTokens, 500);
  assert.equal(custom.baseUrl, 'http://localhost:9');
});

test('askClaude refuse de partir sans clé API', async () => {
  await assert.rejects(
    askClaude({ prompt: 'bonjour', config: { ...config, apiKey: undefined }, fetchImpl: fakeFetch([]).fetchImpl }),
    ClaudeError,
  );
});

test('askClaude envoie la réflexion étendue et ne renvoie que le texte', async () => {
  const { fetchImpl, calls } = fakeFetch([
    {
      status: 200,
      data: {
        content: [
          { type: 'thinking', thinking: 'raisonnement interne' },
          { type: 'text', text: 'Bonjour' },
        ],
        stop_reason: 'end_turn',
      },
    },
  ]);
  const answer = await askClaude({ prompt: 'salut', thinkingBudget: 4096, config, fetchImpl });

  assert.equal(answer.text, 'Bonjour');
  assert.equal(answer.thinkingApplied, true);
  assert.equal(calls[0].url, 'https://example.test/v1/messages');
  assert.equal(calls[0].init.headers['x-api-key'], 'cle-de-test');
  assert.equal(calls[0].init.headers['anthropic-version'], '2023-06-01');
  assert.deepEqual(calls[0].body.thinking, { type: 'enabled', budget_tokens: 4096 });
  assert.ok(calls[0].body.max_tokens > 4096, 'max_tokens doit dépasser le budget de réflexion');
});

test('askClaude sans réflexion n’envoie pas de bloc thinking', async () => {
  const { fetchImpl, calls } = fakeFetch([{ status: 200, data: { content: [{ type: 'text', text: 'ok' }] } }]);
  await askClaude({ prompt: 'salut', thinkingBudget: 0, config, fetchImpl });
  assert.equal('thinking' in calls[0].body, false);
  assert.equal(calls[0].body.max_tokens, 2048);
});

test('askClaude répond sans réflexion si le modèle la refuse', async () => {
  const { fetchImpl, calls } = fakeFetch([
    { status: 400, data: { error: { message: 'thinking is not supported for this model' } } },
    { status: 200, data: { content: [{ type: 'text', text: 'réponse simple' }] } },
  ]);
  const answer = await askClaude({ prompt: 'salut', thinkingBudget: 1024, config, fetchImpl });
  assert.equal(answer.text, 'réponse simple');
  assert.equal(answer.thinkingApplied, false);
  assert.equal(calls.length, 2);
  assert.equal('thinking' in calls[1].body, false);
});

test('askClaude remonte le message d’erreur de l’API sans la clé', async () => {
  const { fetchImpl } = fakeFetch([{ status: 401, data: { error: { message: 'invalid x-api-key' } } }]);
  await assert.rejects(askClaude({ prompt: 'salut', config, fetchImpl }), (error) => {
    assert.ok(error instanceof ClaudeError);
    assert.equal(error.status, 401);
    assert.equal(error.message, 'invalid x-api-key');
    assert.equal(error.message.includes(config.apiKey), false);
    return true;
  });
});

test('les niveaux de réflexion augmentent le budget', () => {
  const budgets = ['off', 'leger', 'moyen', 'eleve'].map((level) => LEVELS[level].budget);
  assert.equal(budgets[0], 0);
  for (let i = 1; i < budgets.length; i++) assert.ok(budgets[i] > budgets[i - 1]);
});

test('bar dessine le niveau sur trois cases', () => {
  assert.equal(bar(0), '▱▱▱');
  assert.equal(bar(2), '▰▰▱');
  assert.equal(bar(3), '▰▰▰');
});

test('movingBar garde une seule case pleine sur dix', () => {
  for (let tick = 0; tick < 30; tick++) {
    const frame = movingBar(tick);
    assert.equal([...frame].length, 10);
    assert.equal([...frame].filter((c) => c === '▰').length, 1);
  }
});

test('thinkingFrame affiche le niveau et le temps écoulé', () => {
  const frame = thinkingFrame(0, 4, 'Moyenne');
  assert.ok(frame.includes('Claude réfléchit'));
  assert.ok(frame.includes('Moyenne'));
  assert.ok(frame.includes('4 s'));
});

test('splitMessage garde un texte court tel quel', () => {
  assert.deepEqual(splitMessage('court'), ['court']);
});

test('splitMessage découpe sans dépasser la limite ni perdre de texte', () => {
  const text = Array.from({ length: 40 }, (_, i) => `ligne ${i} ${'x'.repeat(20)}`).join('\n');
  const chunks = splitMessage(text, 200);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 200);
  assert.equal(chunks.join('').replace(/\s+/g, ''), text.replace(/\s+/g, ''));
});

test('splitMessage coupe un texte sans espace', () => {
  const chunks = splitMessage('x'.repeat(450), 200);
  for (const chunk of chunks) assert.ok(chunk.length <= 200);
  assert.equal(chunks.join('').length, 450);
});
