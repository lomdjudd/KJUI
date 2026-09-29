// Lit TES conversations claude.ai avec TA session (lecture seule) et les envoie au cerveau local.
// Tant qu'un onglet claude.ai est ouvert : la liste est vérifiée toutes les 15 s, seules les conversations modifiées sont relues.
(() => {
  const POLL_MS = 15000, GAP_MS = 500;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, (r) => res(r || { ok: false })));
  const getJSON = async (url) => {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(url + " → " + r.status);
    return r.json();
  };
  const toB64 = (blob) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1] || "");
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });

  async function sendFiles(conv) {
    const st = (await chrome.storage.local.get("files")).files || {};
    for (const m of conv.chat_messages || []) {
      for (const f of m.files_v2 || m.files || []) {
        const id = f.file_uuid || f.file_name;
        const key = `cf:${conv.uuid}:${id}`;
        if (st[key]) continue;
        const cands = [f.document_asset?.url, f.preview_asset?.url, f.preview_url, f.thumbnail_asset?.url, f.thumbnail_url];
        for (const u of cands.filter(Boolean)) {
          try {
            const r = await fetch(new URL(u, location.origin), { credentials: "include" });
            if (!r.ok) continue;
            const blob = await r.blob();
            const ok = await send({
              type: "file",
              file: { name: f.file_name || id, mime: blob.type, b64: await toB64(blob), source: conv.name || conv.uuid, context: "", key },
            });
            if (ok.ok) st[key] = 1;
            break;
          } catch (_) {}
        }
        await sleep(GAP_MS);
      }
    }
    await chrome.storage.local.set({ files: st });
  }

  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const seen = (await chrome.storage.local.get("updated")).updated || {};
      const orgs = await getJSON("/api/organizations");
      for (const o of orgs) {
        const list = await getJSON(`/api/organizations/${o.uuid}/chat_conversations`);
        for (const c of list) {
          if (seen[c.uuid] === c.updated_at) continue;
          const conv = await getJSON(
            `/api/organizations/${o.uuid}/chat_conversations/${c.uuid}?tree=True&rendering_mode=messages&render_all_tools=true`
          );
          const r = await send({ type: "conv", conv });
          if (!r.ok) throw new Error(r.error || "cerveau injoignable");
          await sendFiles(conv);
          seen[c.uuid] = c.updated_at;
          await chrome.storage.local.set({ updated: seen });
          await sleep(GAP_MS); // on ménage l'API
        }
      }
    } catch (e) {
      console.debug("[KJUI]", e);
    } finally {
      busy = false;
    }
  }
  tick();
  setInterval(tick, POLL_MS);
})();
