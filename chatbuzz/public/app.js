// ChatBuzz — logique du front (vanilla JS, sans dépendance).
const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem('cb.' + key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('cb.' + key, JSON.stringify(value)); } catch {}
  },
};

const state = {
  builtin: [],
  categories: [],
  custom: store.get('custom', []),
  chats: store.get('chats', {}), // { [charId]: { messages: [{role, content}], updated } }
  userName: store.get('userName', ''),
  code: store.get('code', ''),
  category: 'Tous',
  query: '',
  current: null,
  busy: false,
  requiresCode: false,
  configured: true,
};

const allCharacters = () => [...state.custom, ...state.builtin];
const findChar = (id) => allCharacters().find((c) => c.id === id);

// ---------- Utilitaires ----------
function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// *action* -> italique, **gras**, retours à la ligne
function fmt(text) {
  return esc(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.id);
  toast.id = setTimeout(() => (t.hidden = true), 3200);
}
function colors(c) {
  return `--c1:${c.colors[0]};--c2:${c.colors[1]}`;
}
function avatar(c, small) {
  return `<div class="avatar${small ? ' sm' : ''}" style="${colors(c)}">${esc(c.emoji)}</div>`;
}
function saveChats() { store.set('chats', state.chats); }

// ---------- Accueil ----------
function renderChips() {
  const cats = ['Tous', ...state.categories];
  if (state.custom.length) cats.push('Mes persos');
  $('#chips').innerHTML = cats
    .map((c) => `<button class="chip${c === state.category ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join('');
}

function renderRecent() {
  const ids = Object.entries(state.chats)
    .filter(([id, ch]) => ch.messages.some((m) => m.role === 'user') && findChar(id))
    .sort((a, b) => b[1].updated - a[1].updated)
    .slice(0, 8);
  $('#recent').hidden = !ids.length;
  $('#recentRow').innerHTML = ids
    .map(([id, ch]) => {
      const c = findChar(id);
      const last = ch.messages[ch.messages.length - 1]?.content.replace(/\*/g, '') || '';
      return `<button class="recent-item" data-open="${esc(id)}">${avatar(c, true)}<div><strong>${esc(c.name)}</strong><small>${esc(last)}</small></div></button>`;
    })
    .join('');
}

function renderGrid() {
  const q = state.query.trim().toLowerCase();
  const list = allCharacters().filter((c) => {
    if (state.category === 'Mes persos' && !c.custom) return false;
    if (state.category !== 'Tous' && state.category !== 'Mes persos' && c.category !== state.category) return false;
    if (!q) return true;
    return [c.name, c.tagline, c.category, ...(c.tags || [])].join(' ').toLowerCase().includes(q);
  });
  $('#empty').hidden = list.length > 0;
  $('#gridTitle').textContent = state.category === 'Tous' ? 'Personnages' : state.category;
  $('#grid').innerHTML = list
    .map(
      (c, i) => `<button class="card" data-open="${esc(c.id)}" style="${colors(c)};animation-delay:${Math.min(i, 12) * 40}ms">
        <div class="card-cover"><span>${esc(c.emoji)}</span><div class="badge">${esc(c.custom ? 'Perso' : c.category)}</div></div>
        <div class="card-body"><strong>${esc(c.name)}</strong><p>${esc(c.tagline)}</p>
        <div class="tags">${(c.tags || []).map((t) => `<em>#${esc(t)}</em>`).join('')}</div></div>
      </button>`
    )
    .join('');
}

function renderHome() {
  renderChips();
  renderRecent();
  renderGrid();
}

// ---------- Chat ----------
function chatFor(id) {
  if (!state.chats[id]) {
    const c = findChar(id);
    state.chats[id] = { messages: [{ role: 'assistant', content: c.greeting }], updated: Date.now() };
  }
  return state.chats[id];
}

function renderSide() {
  const items = allCharacters()
    .filter((c) => c.id === state.current || state.chats[c.id])
    .sort((a, b) => (state.chats[b.id]?.updated || 0) - (state.chats[a.id]?.updated || 0));
  $('#sideList').innerHTML = items
    .map((c) => {
      const msgs = state.chats[c.id]?.messages || [];
      const last = msgs[msgs.length - 1]?.content.replace(/\*/g, '') || c.tagline;
      return `<button class="side-item${c.id === state.current ? ' on' : ''}" data-open="${esc(c.id)}">${avatar(c, true)}<div><strong>${esc(c.name)}</strong><small>${esc(last)}</small></div></button>`;
    })
    .join('');
}

function msgHtml(m, idx, c, isLastBot) {
  const bot = m.role === 'assistant';
  const tools = bot
    ? `<div class="tools"><button data-copy="${idx}">Copier</button>${isLastBot && idx > 0 ? '<button data-regen>↻ Régénérer</button>' : ''}</div>`
    : '';
  return `<div class="msg ${bot ? 'bot' : 'user'}" data-idx="${idx}">
    ${bot ? avatar(c, true) : ''}
    <div><div class="bubble">${fmt(m.content)}</div>${tools}</div>
  </div>`;
}

function renderMessages() {
  const c = findChar(state.current);
  const msgs = chatFor(state.current).messages;
  const lastBot = msgs.map((m) => m.role).lastIndexOf('assistant');
  $('#messages').innerHTML = msgs.map((m, i) => msgHtml(m, i, c, i === lastBot && i === msgs.length - 1)).join('');
  scrollDown(true);
}

function scrollDown(force) {
  const el = $('#messages');
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  if (force || near) el.scrollTop = el.scrollHeight;
}

function openChat(id) {
  const c = findChar(id);
  if (!c) return (location.hash = '#/');
  state.current = id;
  $('#home').hidden = true;
  $('#chat').hidden = false;
  $('#chat').style.setProperty('--c1', c.colors[0]);
  $('.chat-main').style.setProperty('--c1', c.colors[0]);
  $('#chatAvatar').outerHTML = `<div class="avatar sm" id="chatAvatar" style="${colors(c)}">${esc(c.emoji)}</div>`;
  $('#chatName').textContent = c.name;
  $('#chatTag').textContent = c.tagline;
  $('#btnDelete').hidden = !c.custom;
  document.title = `${c.name} — ChatBuzz`;
  renderSide();
  renderMessages();
  if (matchMedia('(min-width: 861px)').matches) $('#input').focus();
}

function route() {
  const m = location.hash.match(/^#\/chat\/(.+)$/);
  if (m) return openChat(decodeURIComponent(m[1]));
  state.current = null;
  $('#chat').hidden = true;
  $('#home').hidden = false;
  document.title = 'ChatBuzz — Discute avec des personnages IA';
  renderHome();
}

// Appel serveur en streaming. onToken(texte) à chaque morceau.
async function streamReply(c, messages, onToken) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-access-code': state.code },
    body: JSON.stringify({
      characterId: c.custom ? undefined : c.id,
      custom: c.custom ? { name: c.name, persona: c.persona, scenario: c.scenario } : undefined,
      userName: state.userName,
      messages,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || 'Erreur serveur');
    err.code = data.code;
    throw err;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let refused = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 2);
      if (!line.startsWith('data:')) continue;
      const evt = JSON.parse(line.slice(5));
      if (evt.t) onToken(evt.t);
      else if (evt.refusal) refused = true;
      else if (evt.error) throw new Error(evt.error);
    }
  }
  return { refused };
}

async function reply() {
  const c = findChar(state.current);
  const chat = chatFor(state.current);
  state.busy = true;
  $('#btnSend').disabled = true;

  const wrap = document.createElement('div');
  wrap.className = 'msg bot';
  wrap.innerHTML = `${avatar(c, true)}<div><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>`;
  $('#messages').appendChild(wrap);
  scrollDown(true);
  const bubble = $('.bubble', wrap);

  let text = '';
  try {
    const { refused } = await streamReply(c, chat.messages, (t) => {
      text += t;
      bubble.innerHTML = fmt(text);
      scrollDown();
    });
    if (!text.trim()) text = refused ? "*détourne le regard* Je préfère qu'on change de sujet, si ça ne te dérange pas." : '…';
    chat.messages.push({ role: 'assistant', content: text });
  } catch (e) {
    if (text.trim()) chat.messages.push({ role: 'assistant', content: text });
    if (e.code === 'access') {
      $('#dlgProfile').showModal();
      toast('Code d’accès requis.');
    }
    toast(e.message);
    wrap.remove();
    if (!text.trim()) {
      // On retire le message utilisateur resté sans réponse pour qu'il puisse être renvoyé.
      const last = chat.messages[chat.messages.length - 1];
      if (last?.role === 'user') $('#input').value = chat.messages.pop().content;
    }
  } finally {
    chat.updated = Date.now();
    saveChats();
    state.busy = false;
    $('#btnSend').disabled = false;
    if (state.current === c.id) {
      renderMessages();
      renderSide();
    }
  }
}

async function send(text) {
  text = text.trim();
  if (!text || state.busy) return;
  const chat = chatFor(state.current);
  chat.messages.push({ role: 'user', content: text });
  chat.updated = Date.now();
  saveChats();
  renderMessages();
  renderSide();
  await reply();
}

// ---------- Événements ----------
$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#input');
  const text = input.value;
  input.value = '';
  input.style.height = 'auto';
  send(text);
});
$('#input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $('#composer').requestSubmit();
  }
});
$('#input').addEventListener('input', (e) => {
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
});

document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) return void (location.hash = '#/chat/' + encodeURIComponent(open.dataset.open));
  const cat = e.target.closest('[data-cat]');
  if (cat) {
    state.category = cat.dataset.cat;
    return renderHome();
  }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const m = chatFor(state.current).messages[Number(copy.dataset.copy)];
    navigator.clipboard?.writeText(m.content).then(() => toast('Copié !'));
    return;
  }
  if (e.target.closest('[data-regen]') && !state.busy) {
    const chat = chatFor(state.current);
    if (chat.messages[chat.messages.length - 1]?.role === 'assistant' && chat.messages.length > 1) {
      chat.messages.pop();
      renderMessages();
      reply();
    }
    return;
  }
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
});

$('#search').addEventListener('input', (e) => {
  state.query = e.target.value;
  renderGrid();
});
$('#btnBack').addEventListener('click', () => (location.hash = '#/'));

$('#btnReset').addEventListener('click', () => {
  if (state.busy || !confirm('Recommencer une nouvelle conversation avec ce personnage ?')) return;
  delete state.chats[state.current];
  saveChats();
  openChat(state.current);
});
$('#btnDelete').addEventListener('click', () => {
  if (!confirm('Supprimer définitivement ce personnage et sa conversation ?')) return;
  state.custom = state.custom.filter((c) => c.id !== state.current);
  delete state.chats[state.current];
  store.set('custom', state.custom);
  saveChats();
  location.hash = '#/';
});

// Création de personnage
$('#btnCreate').addEventListener('click', () => $('#dlgCreate').showModal());
$('#formCreate').addEventListener('submit', (e) => {
  const f = new FormData(e.target);
  const palettes = [['#ff7ab8', '#7a5cff'], ['#43c6ac', '#191654'], ['#f7971e', '#ff512f'], ['#00f5a0', '#00d9f5'], ['#a18cd1', '#fbc2eb'], ['#ff9a9e', '#6a82fb']];
  const id = 'custom-' + Date.now().toString(36);
  const persona = String(f.get('persona')).trim();
  state.custom.unshift({
    id,
    custom: true,
    name: String(f.get('name')).trim(),
    emoji: String(f.get('emoji')).trim() || '😎',
    category: 'Mes persos',
    tags: ['perso'],
    colors: palettes[Math.floor(Math.random() * palettes.length)],
    tagline: persona.slice(0, 120),
    persona,
    scenario: String(f.get('scenario')).trim(),
    greeting: String(f.get('greeting')).trim(),
  });
  store.set('custom', state.custom);
  e.target.reset();
  location.hash = '#/chat/' + id;
});

// Profil
$('#btnProfile').addEventListener('click', () => {
  const f = $('#formProfile');
  f.userName.value = state.userName;
  f.code.value = state.code;
  $('#dlgProfile').showModal();
});
$('#formProfile').addEventListener('submit', (e) => {
  state.userName = e.target.userName.value.trim();
  state.code = e.target.code.value;
  store.set('userName', state.userName);
  store.set('code', state.code);
  $('#profileLabel').textContent = state.userName || 'Profil';
  toast('Profil enregistré ✨');
});

// ---------- Démarrage ----------
async function init() {
  $('#profileLabel').textContent = state.userName || 'Profil';
  try {
    const data = await (await fetch('/api/characters')).json();
    state.builtin = data.characters;
    state.categories = data.categories;
    state.requiresCode = data.requiresCode;
    state.configured = data.configured;
    $('#codeRow').hidden = !data.requiresCode;
    $('#modelInfo').textContent = `Propulsé par l’API Claude (${data.model}).`;
    if (!data.configured) toast('⚠️ Serveur sans clé API : ajoute ANTHROPIC_API_KEY dans .env');
  } catch {
    toast('Serveur injoignable. Lance « npm start » dans chatbuzz/.');
  }
  addEventListener('hashchange', route);
  route();
}
init();
