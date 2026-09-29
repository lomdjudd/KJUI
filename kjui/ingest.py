"""Ingestion : fichiers .md/.txt (chunkés par titre), exports Claude, transcripts Claude Code."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import time
from pathlib import Path
from typing import Iterable

from .store import Brain, est_tokens

CHUNK_CHARS = 1300


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, re.S)
    if not m:
        return {}, text
    meta: dict[str, str] = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip().strip("'\"")
    return meta, text[m.end():]


def chunk_markdown(text: str, doc_title: str = "") -> list[tuple[str, str]]:
    """Découpe par titres Markdown, puis par paragraphes (~350 tokens max). → [(titre, texte)]"""
    sections: list[tuple[list[str], list[str]]] = []
    path: list[str] = []
    buf: list[str] = []
    in_code = False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            in_code = not in_code
        m = None if in_code else re.match(r"^(#{1,4})\s+(.*)", line)
        if m:
            if "".join(buf).strip():
                sections.append((list(path), buf))
            level = len(m.group(1))
            path = path[: level - 1] + [m.group(2).strip()]
            buf = []
        else:
            buf.append(line)
    if "".join(buf).strip():
        sections.append((list(path), buf))

    out: list[tuple[str, str]] = []
    for hp, lines in sections:
        title = " › ".join(([doc_title] if doc_title else []) + hp) or doc_title or "note"
        body = "\n".join(lines).strip()
        if len(body) <= CHUNK_CHARS:
            out.append((title, body))
            continue
        cur = ""
        n = 1
        for para in re.split(r"\n\s*\n", body):
            if cur and len(cur) + len(para) > CHUNK_CHARS:
                out.append((f"{title} ({n})", cur.strip()))
                n += 1
                cur = ""
            cur += para + "\n\n"
        if cur.strip():
            out.append((f"{title} ({n})" if n > 1 else title, cur.strip()))
    return out


def chunk_plain(text: str, title: str, limit: int = CHUNK_CHARS, max_chunks: int = 300) -> list[tuple[str, str]]:
    """Découpage pour du code/texte brut : par lignes, ~350 tokens max par bloc (les longues lignes sont coupées)."""
    out: list[str] = []
    cur = ""
    for line in text.splitlines():
        while len(line) > limit:  # js/css minifié…
            if cur:
                out.append(cur)
                cur = ""
            out.append(line[:limit])
            line = line[limit:]
        if cur and len(cur) + len(line) > limit:
            out.append(cur)
            cur = ""
        cur += line + "\n"
        if len(out) >= max_chunks:
            break
    if cur.strip() and len(out) < max_chunks:
        out.append(cur)
    return [(f"{title} ({i + 1})" if len(out) > 1 else title, c.strip()) for i, c in enumerate(out) if c.strip()]


def ingest_markdown(
    brain: Brain, text: str, name: str, kind: str | None = None, pinned: bool | None = None, source: str = "",
    blob: str = "", mime: str = "", key_prefix: str = "", plain: bool = False,
) -> dict[str, int]:
    """Ingère un document. Frontmatter supporté : kind, pinned, tags, title."""
    meta, body = parse_frontmatter(text) if not plain else ({}, text)
    k = kind or meta.get("kind") or "file"
    p = pinned if pinned is not None else meta.get("pinned", "").lower() in ("1", "true", "yes", "oui")
    doc_title = meta.get("title") or Path(name).stem
    doc_tokens = est_tokens(body)
    created = updated = 0
    # Un doc d'instructions court reste d'un seul bloc : plus fiable pour Claude.
    if plain:
        chunks = chunk_plain(body, name)
    elif k == "instruction" and len(body) <= 2400:
        chunks = [(doc_title, body.strip())]
    else:
        chunks = chunk_markdown(body, doc_title)
    for i, (title, chunk) in enumerate(chunks):
        if not chunk.strip():
            continue
        _, new = brain.add(
            chunk,
            title=title,
            kind=k,
            tags=meta.get("tags", ""),
            source=source or name,
            key=f"md:{key_prefix or source or name}:{i}",
            pinned=p,
            doc_tokens=doc_tokens,
            blob=blob,
            mime=mime,
        )
        created += new
        updated += not new
    return {"chunks": created + updated, "created": created}


TEXT_EXT = {
    ".md", ".markdown", ".txt", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".csv", ".tsv", ".html", ".css",
    ".yml", ".yaml", ".toml", ".xml", ".sh", ".bat", ".log", ".ini", ".cfg", ".sql", ".java", ".c", ".h",
    ".cpp", ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".lua", ".ipynb", ".rst",
}
MIME_EXT = {
    "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "application/pdf": "pdf",
}
EXT_MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp",
            "pdf": "application/pdf"}


def store_binary(brain: Brain, name: str, data: bytes, mime: str = "", context: str = "", source: str = "",
                 key: str | None = None) -> tuple[int, bool]:
    """Sauvegarde un fichier binaire (image, pdf, autre) + un souvenir cherchable qui le référence."""
    ext = (Path(name).suffix.lstrip(".") or MIME_EXT.get(mime, "bin")).lower()
    mime = mime or EXT_MIME.get(ext, "application/octet-stream")
    blob = brain.save_blob(data, ext)
    is_img = mime.startswith("image/")
    text = f"[{'Image' if is_img else 'Fichier'}] {name}"
    if context:
        text += f"\nContexte : {context[:600]}"
    return brain.add(text, title=name, kind="image" if is_img else "file", source=source or name, key=key or f"bin:{blob}",
                     blob=blob, mime=mime)


MAX_BLOB = 250_000_000


def ingest_bytes(brain: Brain, name: str, data: bytes, kind: str | None = None, pinned: bool | None = None,
                 source: str = "", key_prefix: str = "") -> dict[str, int]:
    """Point d'entrée universel. TOUT fichier est conservé en original (téléchargeable) ;
    le texte/code est en plus découpé en blocs cherchables."""
    if len(data) > MAX_BLOB:
        return {"chunks": 0, "created": 0}
    ext = Path(name).suffix.lower()
    if ext in TEXT_EXT:
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = None
        if text is not None:
            blob = brain.save_blob(data, ext.lstrip("."))
            mime = mimetypes.guess_type(name)[0] or "text/plain"
            return ingest_markdown(brain, text, name, kind, pinned, source=source or name, blob=blob, mime=mime,
                                   key_prefix=key_prefix, plain=ext not in (".md", ".markdown", ".txt"))
    _, new = store_binary(brain, name, data, source=source, key=(f"{key_prefix}:bin" if key_prefix else None))
    return {"chunks": 1, "created": int(new)}


def ingest_path(brain: Brain, path: Path, kind: str | None = None, pinned: bool | None = None) -> dict[str, int]:
    files: Iterable[Path] = (
        sorted(p for p in path.rglob("*") if p.is_file() and not any(x.startswith(".") for x in p.relative_to(path).parts))
        if path.is_dir() else [path]
    )
    total = {"files": 0, "chunks": 0, "created": 0}
    for f in files:
        r = ingest_bytes(brain, f.name, f.read_bytes(), kind, pinned, source=str(f))
        total["files"] += 1
        total["chunks"] += r["chunks"]
        total["created"] += r["created"]
    return total


# ---------------------------------------------------------------- conversations Claude
def _blocks(content) -> list[dict]:
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    return [b for b in content if isinstance(b, dict)] if isinstance(content, list) else []


def _msg(brain: Brain, who: str, text: str, source: str, key: str) -> bool:
    text = text.strip()
    if not text:
        return False
    return brain.add(text, title=f"{who} : {text.splitlines()[0][:90]}", kind="conversation",
                     tags=who.lower(), source=source, key=key)[1]


def _media(brain: Brain, b: dict, context: str, source: str, key: str) -> bool:
    """Bloc image/document base64 (format Claude)."""
    import base64

    src = b.get("source") or {}
    try:
        if src.get("type") == "base64":
            mime = src.get("media_type", "")
            data = base64.b64decode(src.get("data", ""))
            ext = MIME_EXT.get(mime, "bin")
            return store_binary(brain, f"{b['type']}-{key.rsplit(':', 2)[-2]}.{ext}", data, mime, context, source, key)[1]
        if src.get("type") == "text" and src.get("data"):
            return brain.add(src["data"], title=b.get("title") or "document", kind="file", source=source, key=key)[1]
    except (ValueError, KeyError):
        pass
    return False


def _ingest_blocks(brain: Brain, who: str, blocks: list[dict], source: str, key: str) -> int:
    n = 0
    ctx = " ".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
    for j, b in enumerate(blocks):
        k, t = f"{key}:{j}", b.get("type")
        if t == "text":
            if who == "Toi" and b.get("text", "").lstrip().startswith("<"):
                continue  # messages système injectés (caveats, commandes…)
            n += _msg(brain, who, b.get("text", ""), source, k)
        elif t in ("image", "document"):
            n += _media(brain, b, ctx, source, k)
        elif t == "tool_use":
            inp = b.get("input") or {}
            name = b.get("name", "")
            if name == "Write" and inp.get("content"):
                fp = inp.get("file_path", "fichier.txt")
                n += ingest_bytes(brain, Path(fp).name or "fichier.txt", str(inp["content"]).encode(),
                                  source=f"Claude Code · {fp}", key_prefix=k)["created"]
            elif name in ("Edit", "MultiEdit"):
                edits = inp.get("edits") or [inp]
                body = "\n\n".join(f"- {e.get('old_string', '')}\n+ {e.get('new_string', '')}" for e in edits)
                if body.strip("-+ \n"):
                    n += brain.add(body, title=f"Édition : {inp.get('file_path', '?')}", kind="file",
                                   tags="claude édition", source=source, key=k)[1]
            elif name in ("create_file", "str_replace_based_edit_tool") and inp.get("file_text"):  # claude.ai (exécution de code)
                fp = inp.get("path", "fichier.txt")
                n += ingest_bytes(brain, Path(fp).name or "fichier.txt", str(inp["file_text"]).encode(),
                                  source=f"claude.ai · {fp}", key_prefix=k)["created"]
            elif name == "artifacts" and inp.get("content"):  # export claude.ai
                n += brain.add(inp["content"], title=f"Artifact : {inp.get('title') or inp.get('id', '')}", kind="file",
                               tags="claude artifact", source=source, key=k)[1]
    return n


def ingest_claude_export(brain: Brain, path: Path) -> int:
    """Export officiel claude.ai : conversations.json (ou le .zip complet). Chaque message, pièce jointe, artifact."""
    import zipfile

    media: list[tuple[str, bytes]] = []
    data: list | dict
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as z:
            data = json.loads(z.read(next(n for n in z.namelist() if n.endswith("conversations.json"))))
            for n in z.namelist():
                if n.rsplit(".", 1)[-1].lower() in EXT_MIME and not n.endswith("/"):
                    media.append((n, z.read(n)))
    else:
        data = json.loads(path.read_text("utf-8"))
    total = ingest_conversations(brain, data if isinstance(data, list) else [data])
    for name, blob in media:
        total += store_binary(brain, Path(name).name, blob, source="export claude.ai")[1]
    return total


def ingest_conversations(brain: Brain, convs: list[dict]) -> int:
    """Conversations au format claude.ai (export ou API interne) : messages, pièces jointes, artifacts."""
    total = 0
    for conv in convs:
        uid = conv.get("uuid") or conv.get("name", "")
        src = conv.get("name") or uid
        for i, msg in enumerate(conv.get("chat_messages", [])):
            who = "Toi" if msg.get("sender") == "human" else "Claude"
            key = f"conv:{uid}:{i}"
            blocks = _blocks(msg.get("content")) or _blocks(msg.get("text", ""))
            if not any(b.get("type") == "text" and b.get("text") for b in blocks) and msg.get("text"):
                blocks = [{"type": "text", "text": msg["text"]}] + [b for b in blocks if b.get("type") != "text"]
            total += _ingest_blocks(brain, who, blocks, src, key)
            for a, att in enumerate(msg.get("attachments") or []):
                if att.get("extracted_content"):
                    total += brain.add(att["extracted_content"], title=f"Pièce jointe : {att.get('file_name', '?')}",
                                       kind="file", tags="toi pièce-jointe", source=src, key=f"{key}:att{a}")[1]
            for f, fl in enumerate(msg.get("files") or msg.get("files_v2") or []):
                total += brain.add(f"[Fichier joint] {fl.get('file_name', '?')}", title=fl.get("file_name", "fichier"),
                                   kind="file", source=src, key=f"{key}:file{f}")[1]
    return total


def ingest_transcript(brain: Brain, path: Path, offset: int = 0) -> tuple[int, int]:
    """Transcript Claude Code (.jsonl), incrémental : chaque message, image, document et fichier écrit."""
    n = 0
    pos = offset
    with path.open("rb") as f:
        f.seek(offset)
        for raw in f:
            if not raw.endswith(b"\n"):  # ligne encore en cours d'écriture
                break
            line_pos, pos = pos, pos + len(raw)
            try:
                ev = json.loads(raw)
            except ValueError:
                continue
            role = ev.get("type")
            if role not in ("user", "assistant") or ev.get("isMeta"):
                continue
            n += _ingest_blocks(
                brain, "Toi" if role == "user" else "Claude", _blocks((ev.get("message") or {}).get("content")),
                path.stem, f"cc:{path}:{line_pos}",
            )
    return n, pos


SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".cache", ".gradle", ".idea", ".next", ".mypy_cache"}
SECRET = re.compile(r"(^\.env|\.pem$|\.key$|\.p12$|\.pfx$|\.jks$|\.keystore$|id_rsa|id_ed25519|credentials|secret)", re.I)
SCAN_DAYS = 30
MAX_WALK = 30000


def scan_folder(brain: Brain, root: Path, since: float) -> int:
    """Enregistre les fichiers de `root` créés/modifiés depuis `since` (png, html, css, js, apk, zip…)."""
    root = root.resolve()
    if not root.is_dir() or root == Path.home().resolve() or root == Path(root.anchor):
        return 0
    n = walked = 0
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in files:
            walked += 1
            if walked > MAX_WALK:
                return n
            p = Path(dirpath) / fn
            if SECRET.search(fn):
                continue
            try:
                st = p.stat()
            except OSError:
                continue
            if st.st_mtime < since or st.st_size > MAX_BLOB or st.st_size == 0:
                continue
            sig, k = f"{int(st.st_mtime)}:{st.st_size}", f"seen:{p}"
            if brain.meta_get(k) == sig:
                continue
            try:
                rel = str(p.relative_to(root))
                n += ingest_bytes(brain, fn, p.read_bytes(), source=f"{root.name}/{rel}")["created"]
            except OSError:
                continue
            brain.meta_set(k, sig)
    return n


def _session_info(path: Path) -> tuple[str, float]:
    """(dossier de travail, début de session) lus dans les premières lignes du transcript."""
    from datetime import datetime

    cwd, start = "", 0.0
    with path.open("rb") as f:
        for i, raw in enumerate(f):
            if i > 60:
                break
            try:
                ev = json.loads(raw)
            except ValueError:
                continue
            cwd = cwd or ev.get("cwd", "")
            if not start and ev.get("timestamp"):
                try:
                    start = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00")).timestamp()
                except ValueError:
                    pass
            if cwd and start:
                break
    return cwd, start


def sync_claude_code(brain: Brain, root: Path | None = None, scan_files: bool = False) -> int:
    root = root or Path.home() / ".claude" / "projects"
    if not root.exists():
        return 0
    total = 0
    folders: dict[str, float] = {}
    horizon = time.time() - SCAN_DAYS * 86400
    for f in root.rglob("*.jsonl"):
        k = f"off:{f}"
        off = int(brain.meta_get(k, "0"))
        if off > f.stat().st_size:
            off = 0
        n, new_off = ingest_transcript(brain, f, off)
        brain.meta_set(k, str(new_off))
        total += n
        if scan_files:
            cwd, start = _session_info(f)
            if cwd:
                folders[cwd] = min(folders.get(cwd, 9e18), max(start, horizon))
    for cwd, since in folders.items():
        total += scan_folder(brain, Path(cwd), since)
    return total
