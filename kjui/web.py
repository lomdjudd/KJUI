"""Interface web locale : cerveau 3D animé. Écoute uniquement sur 127.0.0.1."""
from __future__ import annotations

import json
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from urllib.parse import parse_qs, urlparse

import base64
import mimetypes
import re

from .ingest import ingest_bytes, ingest_conversations, store_binary, sync_claude_code
from .recall import recall
from .store import KINDS, Brain

MAX_BODY = 90_000_000
SAFE_INLINE = {"image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"}


def make_handler(brain: Brain, port_ref: list[int]):
    class H(BaseHTTPRequestHandler):
        server_version = "KJUI"

        def log_message(self, *a):  # silence
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
            self.send_header("Content-Type", ctype + "; charset=utf-8")
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

        def do_GET(self):
            if not self._allowed():
                return self._send(403, b"forbidden", "text/plain")
            u = urlparse(self.path)
            q = parse_qs(u.query)
            if u.path in ("/", "/index.html"):
                html = resources.files("kjui").joinpath("static/index.html").read_bytes()
                return self._send(200, html, "text/html")
            if u.path.startswith("/files/"):
                name = u.path[7:]
                f = brain.files_dir / name
                if not re.fullmatch(r"[0-9a-f]{40}\.[a-z0-9]{1,5}", name) or not f.is_file():
                    return self._send(404, b"not found", "text/plain")
                mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
                data = f.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", mime if mime in SAFE_INLINE else "application/octet-stream")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("X-Content-Type-Options", "nosniff")
                if mime not in SAFE_INLINE:
                    self.send_header("Content-Disposition", "attachment")
                self.end_headers()
                self.wfile.write(data)
                return
            if u.path == "/api/ext/ping":
                return self._json({"ok": True, "memories": brain.stats()["memories"]})
            if u.path == "/favicon.ico":
                return self._send(204, b"", "text/plain")
            if u.path == "/api/graph":
                return self._json({"stats": brain.stats(), "nodes": brain.all_nodes()})
            if u.path == "/api/stats":
                return self._json(brain.stats())
            if u.path.startswith("/api/memory/"):
                m = brain.get(int(u.path.rsplit("/", 1)[1]))
                return self._json(m, 200) if m else self._json({"error": "introuvable"}, 404)
            if u.path == "/api/search":  # aperçu sans compter comme un rappel
                hits = brain.search(q.get("q", [""])[0], limit=12)
                return self._json([{"id": h["id"], "title": h["title"], "kind": h["kind"], "score": h["score"]} for h in hits])
            if u.path == "/api/recall":
                r = recall(brain, q.get("q", [""])[0], int(q.get("budget", ["1200"])[0]))
                r["stats"] = brain.stats()
                return self._json(r)
            self._send(404, b"not found", "text/plain")

        def do_POST(self):
            if not self._allowed():
                return self._send(403, b"forbidden", "text/plain")
            try:
                b = self._body()
                if self.path == "/api/remember":
                    i, new = brain.add(
                        b.get("content", ""),
                        title=b.get("title", ""),
                        kind=b.get("kind") if b.get("kind") in KINDS else "memory",
                        tags=b.get("tags", ""),
                        source="web",
                        pinned=bool(b.get("pinned")),
                    )
                    return self._json({"id": i, "created": new})
                if self.path == "/api/ext/conversation":
                    return self._json({"stored": ingest_conversations(brain, [b])})
                if self.path == "/api/ext/file":
                    _, new = store_binary(brain, b["name"], base64.b64decode(b["b64"]), b.get("mime", ""),
                                          b.get("context", ""), b.get("source", "claude.ai"), b.get("key"))
                    return self._json({"created": new})
                if self.path == "/api/upload":
                    data = base64.b64decode(b["b64"]) if "b64" in b else b.get("text", "").encode()
                    r = ingest_bytes(
                        brain,
                        b.get("name", "document.md"),
                        data,
                        kind=b.get("kind") if b.get("kind") in KINDS else None,
                        pinned=True if b.get("pinned") else None,
                    )
                    return self._json(r)
                if self.path.startswith("/api/pin/"):
                    brain.set_pinned(int(self.path.rsplit("/", 1)[1]), bool(b.get("pinned")))
                    return self._json({"ok": True})
            except (ValueError, KeyError, TypeError) as e:
                return self._json({"error": str(e)}, 400)
            self._send(404, b"not found", "text/plain")

        def do_DELETE(self):
            if not self._allowed():
                return self._send(403, b"forbidden", "text/plain")
            if self.path.startswith("/api/memory/"):
                ok = brain.forget(int(self.path.rsplit("/", 1)[1]))
                return self._json({"ok": ok})
            self._send(404, b"not found", "text/plain")

    return H


def run(brain: Brain, port: int = 8765, open_browser: bool = True, watch: bool = False) -> None:
    ref = [port]
    srv = ThreadingHTTPServer(("127.0.0.1", port), make_handler(brain, ref))
    url = f"http://127.0.0.1:{srv.server_address[1]}/"
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
                time.sleep(5)

        threading.Thread(target=loop, daemon=True).start()
    print(f"🧠 KJUI Brain → {url}  (Ctrl+C pour quitter)")
    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
