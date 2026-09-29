"""Ingestion : fichiers .md/.txt (chunkés par titre), exports Claude, transcripts Claude Code."""
from __future__ import annotations

import json
import re
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


def ingest_markdown(
    brain: Brain, text: str, name: str, kind: str | None = None, pinned: bool | None = None, source: str = ""
) -> dict[str, int]:
    """Ingère un document. Frontmatter supporté : kind, pinned, tags, title."""
    meta, body = parse_frontmatter(text)
    k = kind or meta.get("kind") or "file"
    p = pinned if pinned is not None else meta.get("pinned", "").lower() in ("1", "true", "yes", "oui")
    doc_title = meta.get("title") or Path(name).stem
    doc_tokens = est_tokens(body)
    created = updated = 0
    # Un doc d'instructions court reste d'un seul bloc : plus fiable pour Claude.
    chunks = [(doc_title, body.strip())] if k == "instruction" and len(body) <= 2400 else chunk_markdown(body, doc_title)
    for i, (title, chunk) in enumerate(chunks):
        if not chunk.strip():
            continue
        _, new = brain.add(
            chunk,
            title=title,
            kind=k,
            tags=meta.get("tags", ""),
            source=source or name,
            key=f"md:{source or name}:{i}",
            pinned=p,
            doc_tokens=doc_tokens,
        )
        created += new
        updated += not new
    return {"chunks": created + updated, "created": created}


def ingest_path(brain: Brain, path: Path, kind: str | None = None, pinned: bool | None = None) -> dict[str, int]:
    files: Iterable[Path] = (
        sorted(p for p in path.rglob("*") if p.suffix.lower() in (".md", ".markdown", ".txt")) if path.is_dir() else [path]
    )
    total = {"files": 0, "chunks": 0, "created": 0}
    for f in files:
        r = ingest_markdown(brain, f.read_text("utf-8", errors="replace"), f.name, kind, pinned, source=str(f))
        total["files"] += 1
        total["chunks"] += r["chunks"]
        total["created"] += r["created"]
    return total


# ---------------------------------------------------------------- conversations Claude
def _text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def _turn_to_memory(brain: Brain, q: str, a: str, source: str, key: str) -> bool:
    q, a = q.strip(), a.strip()
    if not q or not a:
        return False
    a = a if len(a) <= 1200 else a[:1200].rstrip() + " […]"
    q = q if len(q) <= 600 else q[:600].rstrip() + " […]"
    _, new = brain.add(f"Q: {q}\nR: {a}", title=q.split("\n", 1)[0][:100], kind="conversation", source=source, key=key)
    return new


def ingest_claude_export(brain: Brain, path: Path) -> int:
    """Export officiel claude.ai (conversations.json)."""
    data = json.loads(path.read_text("utf-8"))
    n = 0
    for conv in data if isinstance(data, list) else [data]:
        uid = conv.get("uuid") or conv.get("name", "")
        pending = ""
        for i, msg in enumerate(conv.get("chat_messages", [])):
            text = msg.get("text") or _text_of(msg.get("content"))
            if msg.get("sender") == "human":
                pending = text
            elif pending:
                n += _turn_to_memory(brain, pending, text, conv.get("name") or uid, f"conv:{uid}:{i}")
                pending = ""
    return n


def ingest_transcript(brain: Brain, path: Path, offset: int = 0) -> tuple[int, int]:
    """Transcript Claude Code (.jsonl), incrémental. Retourne (souvenirs créés, nouvel offset)."""
    n = 0
    with path.open("rb") as f:
        f.seek(offset)
        pos = offset
        turn_start = offset
        q = ""
        answers: list[str] = []

        def flush() -> None:
            nonlocal n
            if q and answers:
                n += _turn_to_memory(brain, q, "\n".join(answers), path.stem, f"cc:{path}:{turn_start}")

        for raw in f:
            line_pos, pos = pos, pos + len(raw)
            try:
                ev = json.loads(raw)
            except ValueError:
                continue
            role = ev.get("type")
            text = _text_of((ev.get("message") or {}).get("content")).strip()
            if role == "user" and text and not text.startswith("<"):
                flush()
                q, answers, turn_start = text, [], line_pos
            elif role == "assistant" and text and q:
                answers.append(text)
        flush()
    # Le dernier tour peut encore grandir : on le retraitera (upsert par clé).
    return n, (turn_start if q else pos)


def sync_claude_code(brain: Brain, root: Path | None = None) -> int:
    root = root or Path.home() / ".claude" / "projects"
    if not root.exists():
        return 0
    total = 0
    for f in root.rglob("*.jsonl"):
        k = f"off:{f}"
        off = int(brain.meta_get(k, "0"))
        if off > f.stat().st_size:
            off = 0
        n, new_off = ingest_transcript(brain, f, off)
        brain.meta_set(k, str(new_off))
        total += n
    return total
