"""Interface locale : cerveau 3D animé + flux en direct. Écoute uniquement sur 127.0.0.1."""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import connect as cn
from . import updater
from .ingest import ingest_bytes, ingest_conversations, store_binary, sync_claude_code
from .recall import recall
from .store import KINDS, Brain

MAX_BODY = 90_000_000
SAFE_INLINE = {"image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"}
STATIC = {"app.css": "text/css", "app.js": "text/javascript", "index.html": "text/html"}


def _static(name: str) -> bytes:
    return resources.files("kjui").joinpath("static/" + name).read_bytes()


def make_handler(brain: Brain):
    class H(BaseHTTPRequestHandler):
        server_version = "KJUI"

        def log_message(self, *a):
            pass

        # -- sécurité : refuse tout Host/Origin non local (anti DNS-rebinding / CSRF)
        def _allowed(self) -> bool:
            host = (self.headers.get("Host") or "").split(":")[0]
            if host not in ("127.0.0.1", "localhost"):
                return False
            origin = self.headers.get("Origin")
            if not origin or urlparse(origin).hostname in ("127.0.0.1", "localhost"):
                return True
            # l'extension navigateur (claude.ai → cerveau) : uniquement pour /api/ext/*
            return self.path.startswith("/api/ext/") and origin.startswith(("chrome-extension://", "moz-extension://"))

        def _send(self, code: int, body: bytes, ctype: str = "application/json") -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith(("text", "application/json")) else ""))
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj, code: int = 200) -> None:
            self._send(code, json.dumps(obj, ensure_ascii=False).encode())

        def _body(self) -> dict:
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                raise ValueError("trop gros")
            return json.loads(self.rfile.read(n) or b"{}")

        # ------------------------------------------------------------------ GET
        def do_GET(self):
            if not self._allowed():
                return self._send(403, b"forbidden", "text/plain")
            u = urlparse(self.path)
            q = parse_qs(u.query)
            arg = lambda k, d="": q.get(k, [d])[0]  # noqa: E731
            try:
                if u.path in ("/", "/index.html"):
                    return self._send(200, _static("index.html"), "text/html")
                if u.path.startswith("/static/") and u.path[8:] in STATIC:
                    return self._send(200, _static(u.path[8:]), STATIC[u.path[8:]])
                if u.path.startswith("/files/"):
                    return self._file(u.path[7:])
                if u.path == "/favicon.ico":
                    return self._send(204, b"", "text/plain")
                if u.path == "/api/graph":
                    return self._json({"stats": brain.stats(), "nodes": brain.all_nodes()})
                if u.path == "/api/stats":
                    return self._json(brain.stats())
                if u.path == "/api/events":
                    since = int(arg("since", "0"))
                    return self._json({
                        "events": brain.events(since, int(arg("limit", "60"))),
                        "last_id": brain.last_event_id(),
                        "stats": brain.stats(),
                        "activity": brain.activity(30),
                    })
                if u.path == "/api/conversations":
                    return self._json(brain.conversations())
                if u.path == "/api/conversation":
                    return self._json(brain.conversation(arg("id"), int(arg("after", "0"))))
                if u.path == "/api/files":
                    return self._json(brain.files())
                if u.path == "/api/status":
                    return self._json({
                        "connect": cn.status(),
                        "last_claude_call": brain.last_claude_call(),
                        "now": time.time(),
                        "update": updater.check(),
                    })
                if u.path == "/api/ext/ping":
                    return self._json({"ok": True, "memories": brain.stats()["memories"]})
                if u.path.startswith("/api/memory/"):
                    m = brain.get(int(u.path.rsplit("/", 1)[1]))
                    return self._json(m) if m else self._json({"error": "introuvable"}, 404)
                if u.path == "/api/search":  # aperçu sans compter comme un rappel
                    hits = brain.search(arg("q"), limit=12)
                    return self._json([{"id": h["id"], "title": h["title"], "kind": h["kind"], "score": h["score"]} for h in hits])
                if u.path == "/api/recall":
                    r = recall(brain, arg("q"), int(arg("budget", "1200")), via="gui")
                    r["stats"] = brain.stats()
                    return self._json(r)
            except (ValueError, KeyError) as e:
                return self._json({"error": str(e)}, 400)
            self._send(404, b"not found", "text/plain")

        def _file(self, name: str) -> None:
            f = brain.files_dir / name
            if not re.fullmatch(r"[0-9a-f]{40}\.[a-z0-9]{1,5}", name) or not f.is_file():
                return self._send(404, b"not found", "text/plain")
            mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
            data = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime if mime in SAFE_INLINE else "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-Content-Type-Options", "nosniff")
            q = parse_qs(urlparse(self.path).query)
            if mime not in SAFE_INLINE or "dl" in q:
                fn = re.sub(r'[^\w.\- ]', "_", q.get("name", [name])[0])
                self.send_header("Content-Disposition", f'attachment; filename="{fn}"')
            self.end_headers()
            self.wfile.write(data)

        # ------------------------------------------------------------------ POST
        def do_POST(self):
            if not self._allowed():
                return self._send(403, b"forbidden", "text/plain")
            try:
                b = self._body()
                if self.path == "/api/remember":
                    with brain.ctx(app="Saisie"):
                        i, new = brain.add(
                            b.get("content", ""), title=b.get("title", ""),
                            kind=b.get("kind") if b.get("kind") in KINDS else "memory",
                            tags=b.get("tags", ""), source="web", pinned=bool(b.get("pinned")),
                        )
                    return self._json({"id": i, "created": new})
                if self.path == "/api/ext/conversation":
                    return self._json({"stored": ingest_conversations(brain, [b])})
                if self.path == "/api/ext/file":
                    with brain.ctx(app="claude.ai"):
                        _, new = store_binary(brain, b["name"], base64.b64decode(b["b64"]), b.get("mime", ""),
                                              b.get("context", ""), b.get("source", "claude.ai"), b.get("key"))
                    return self._json({"created": new})
                if self.path == "/api/upload":
                    data = base64.b64decode(b["b64"]) if "b64" in b else b.get("text", "").encode()
                    with brain.ctx(app="Envoi"):
                        r = ingest_bytes(brain, b.get("name", "document.md"), data,
                                         kind=b.get("kind") if b.get("kind") in KINDS else None,
                                         pinned=True if b.get("pinned") else None)
                    return self._json(r)
                if self.path.startswith("/api/pin/"):
                    brain.set_pinned(int(self.path.rsplit("/", 1)[1]), bool(b.get("pinned")))
                    return self._json({"ok": True})
                if self.path in ("/api/connect", "/api/disconnect"):
                    return self._json(cn.apply(self.path == "/api/connect"))
                if self.path == "/api/update/apply":
                    if not updater.managed():
                        return self._json({"error": "lance l'appli via KJUI.py pour les mises à jour automatiques"}, 400)
                    self._json({"ok": True})
                    threading.Timer(0.6, lambda: os._exit(75)).start()  # le lanceur met à jour puis relance
                    return
            except RuntimeError as e:
                return self._json({"error": str(e)}, 500)
            except (ValueError, KeyError, TypeError) as e:
                return self._json({"error": str(e)}, 400)
            self._send(404, b"not found", "text/plain")

        def do_DELETE(self):
            if not self._allowed():
                return self._send(403, b"forbidden", "text/plain")
            if self.path.startswith("/api/memory/"):
                return self._json({"ok": brain.forget(int(self.path.rsplit("/", 1)[1]))})
            self._send(404, b"not found", "text/plain")

    return H


def _chromium() -> str | None:
    """Chrome / Edge / Brave / Chromium, pour ouvrir une vraie fenêtre d'application (sans onglets)."""
    env = os.environ
    cands: list[str] = []
    if sys.platform == "win32":
        for root in (env.get("ProgramFiles"), env.get("ProgramFiles(x86)"), env.get("LOCALAPPDATA")):
            if root:
                cands += [rf"{root}\Google\Chrome\Application\chrome.exe", rf"{root}\Microsoft\Edge\Application\msedge.exe",
                          rf"{root}\BraveSoftware\Brave-Browser\Application\brave.exe"]
    elif sys.platform == "darwin":
        cands += [f"/Applications/{n}.app/Contents/MacOS/{n}" for n in ("Google Chrome", "Microsoft Edge", "Brave Browser", "Chromium")]
    else:
        cands += [shutil.which(n) or "" for n in ("google-chrome", "google-chrome-stable", "microsoft-edge", "brave-browser", "chromium", "chromium-browser")]
    return next((c for c in cands if c and Path(c).exists()), None)


def open_window(url: str) -> None:
    exe = None if os.environ.get("KJUI_NO_APP") else _chromium()
    if exe:
        try:
            subprocess.Popen([exe, f"--app={url}", "--window-size=1480,920"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except OSError:
            pass
    webbrowser.open(url)


def run(brain: Brain, port: int = 8765, open_browser: bool = True, watch: bool = True) -> None:
    srv = ThreadingHTTPServer(("127.0.0.1", port), make_handler(brain))
    url = f"http://127.0.0.1:{srv.server_address[1]}/"
    if not brain.meta_get("auto_connected"):  # 1er lancement : branche Claude (sauvegardes *.kjui.bak, réversible)
        try:
            st = cn.apply(True)
            print("🔌 Claude connecté au cerveau :", "OK" if st.get("connected") else st)
        except Exception as e:  # noqa: BLE001
            print("⚠ connexion automatique impossible :", e)
        brain.meta_set("auto_connected", "1")
    if watch:
        def loop():
            w = Brain(brain.path)  # connexion dédiée au thread
            tick = 0
            while True:
                try:
                    sync_claude_code(w, scan_files=tick % 6 == 0)  # dossiers de travail : toutes les 30 s
                except Exception:  # noqa: BLE001
                    pass
                tick += 1
                time.sleep(3)

        threading.Thread(target=loop, daemon=True).start()
    print(f"🧠 KJUI Brain → {url}  (Ctrl+C pour quitter)")
    if open_browser and not os.environ.get("KJUI_RESTARTED"):
        threading.Timer(0.6, lambda: open_window(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
