const s = document.getElementById("s"), p = document.getElementById("p");
chrome.storage.local.get("port").then(({ port }) => { p.value = port || 8765; check(); });
p.onchange = () => chrome.storage.local.set({ port: +p.value }).then(check);
function check() {
  chrome.runtime.sendMessage({ type: "ping" }, (r) => {
    if (r && r.ok) { s.className = "ok"; s.textContent = `Connecté — ${r.memories} souvenirs. Tes conversations claude.ai sont enregistrées tant qu'un onglet claude.ai est ouvert.`; }
    else { s.className = "ko"; s.textContent = "Cerveau injoignable : lance LANCER.bat / LANCER.command."; }
  });
}
