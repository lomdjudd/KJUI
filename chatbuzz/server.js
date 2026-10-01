// Serveur ChatBuzz : sert le site et relaie le chat vers l'API Claude (streaming).
// Zéro dépendance : Node 18+ suffit.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, CATEGORIES, publicCharacter, buildSystemPrompt } from './characters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

// --- Chargement minimal du fichier .env ---
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const MAX_TOKENS = 700;
const MAX_HISTORY = 40;
const MAX_MESSAGE_CHARS = 4000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

// --- Limiteur de débit simple par IP (protège ta clé API) ---
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) if (!arr.some((t) => now - t < 60_000)) hits.delete(ip);
}, 60_000).unref();

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Requête trop volumineuse'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// L'API exige des messages alternés, commençant par « user ».
function normalizeMessages(raw) {
  const out = [];
  for (const m of raw.slice(-MAX_HISTORY)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = String(m.content ?? '').slice(0, MAX_MESSAGE_CHARS).trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + content;
    else out.push({ role: m.role, content });
  }
  if (out.length && out[0].role !== 'user') out.unshift({ role: 'user', content: '(Début de la conversation)' });
  return out;
}

async function handleChat(req, res) {
  const ip = req.socket.remoteAddress || 'unknown';
  if (rateLimited(ip)) return sendJson(res, 429, { error: 'Trop de messages, patiente quelques secondes 🙏' });
  if (ACCESS_CODE && req.headers['x-access-code'] !== ACCESS_CODE)
    return sendJson(res, 401, { error: 'Code d’accès invalide.', code: 'access' });
  if (!API_KEY)
    return sendJson(res, 500, { error: 'Aucune clé API configurée. Ajoute ANTHROPIC_API_KEY dans chatbuzz/.env puis relance le serveur.' });

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: 'Requête invalide.' });
  }

  const character = body.characterId ? CHARACTERS.find((c) => c.id === body.characterId) : null;
  const custom = body.custom && typeof body.custom === 'object' ? body.custom : null;
  if (!character && !(custom && String(custom.persona || '').trim()))
    return sendJson(res, 400, { error: 'Personnage inconnu.' });

  const messages = normalizeMessages(Array.isArray(body.messages) ? body.messages : []);
  if (!messages.length || messages[messages.length - 1].role !== 'user')
    return sendJson(res, 400, { error: 'Aucun message à envoyer.' });

  const system = buildSystemPrompt({ character, custom, userName: body.userName });

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  let upstream;
  try {
    upstream = await fetch(`${BASE_URL}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages, stream: true }),
    });
  } catch (e) {
    if (controller.signal.aborted) return;
    return sendJson(res, 502, { error: 'Impossible de joindre l’API Claude.' });
  }

  if (!upstream.ok) {
    let detail = '';
    try {
      detail = (await upstream.json())?.error?.message || '';
    } catch {}
    console.error(`[api ${upstream.status}] ${detail}`);
    const friendly =
      upstream.status === 401 ? 'Clé API invalide.' :
      upstream.status === 429 ? 'Limite de l’API atteinte, réessaie dans un instant.' :
      upstream.status === 402 || /credit/i.test(detail) ? 'Crédits API insuffisants (console.anthropic.com > Billing).' :
      'Erreur de l’API Claude.';
    return sendJson(res, 502, { error: friendly });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  const emit = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(5));
        } catch {
          continue;
        }
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') emit({ t: evt.delta.text });
        else if (evt.type === 'message_delta' && evt.delta?.stop_reason === 'refusal') emit({ refusal: true });
        else if (evt.type === 'error') emit({ error: 'Erreur pendant la génération.' });
      }
    }
  } catch (e) {
    if (!controller.signal.aborted) emit({ error: 'Connexion interrompue.' });
  }
  emit({ done: true });
  res.end();
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Introuvable');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (req.method === 'GET' && pathname === '/api/characters')
      return sendJson(res, 200, {
        categories: CATEGORIES,
        characters: CHARACTERS.map(publicCharacter),
        requiresCode: Boolean(ACCESS_CODE),
        configured: Boolean(API_KEY),
        model: MODEL,
      });
    if (req.method === 'POST' && pathname === '/api/chat') return await handleChat(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    res.writeHead(405);
    res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: 'Erreur serveur.' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`\n  ✨ ChatBuzz prêt sur http://localhost:${PORT}`);
  console.log(`  Modèle : ${MODEL}`);
  if (!API_KEY) console.log('  ⚠️  ANTHROPIC_API_KEY manquante : copie .env.example en .env et ajoute ta clé.\n');
});
