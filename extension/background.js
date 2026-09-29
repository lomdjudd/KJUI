// Relais vers le cerveau local (127.0.0.1). Le content script ne peut pas appeler localhost directement.
const base = async () => `http://127.0.0.1:${(await chrome.storage.local.get("port")).port || 8765}`;

async function post(path, body) {
  const r = await fetch((await base()) + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    try {
      if (msg.type === "conv") await post("/api/ext/conversation", msg.conv);
      else if (msg.type === "file") await post("/api/ext/file", msg.file);
      else if (msg.type === "ping") {
        const r = await fetch((await base()) + "/api/ext/ping");
        reply({ ok: true, ...(await r.json()) });
        return;
      }
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#0a9b64" });
      reply({ ok: true });
    } catch (e) {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#c23a4b" });
      reply({ ok: false, error: String(e) });
    }
  })();
  return true; // réponse asynchrone
});
