"""Stockage SQLite + recherche plein texte (FTS5/BM25) — 100 % local, zéro dépendance."""
from __future__ import annotations

import hashlib
import math
import os
import re
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

KINDS = ("memory", "instruction", "conversation", "file")

_STOP = set(
    "le la les un une des du de d l et ou à a au aux en dans sur pour par avec sans ce cet cette ces "
    "que qui quoi est sont être avoir fait faire je tu il elle on nous vous ils elles mon ma mes ton ta "
    "tes son sa ses ne pas plus se y the a an and or of to in on for with is are be was were it this "
    "that these those i you he she we they my your his her our their not as at by from do does did how "
    "what which who".split()
)


def home_dir() -> Path:
    p = Path(os.environ.get("KJUI_HOME") or Path.home() / ".kjui")
    p.mkdir(parents=True, exist_ok=True)
    return p


def est_tokens(text: str) -> int:
    """Estimation rapide (~3.8 caractères par token)."""
    return max(1, round(len(text) / 3.8)) if text else 0


class Brain:
    def __init__(self, path: str | Path | None = None):
        self.path = str(path or home_dir() / "brain.db")
        self._lock = threading.RLock()
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self._init()

    def _init(self) -> None:
        with self._lock, self.db:
            self.db.executescript(
                """
                CREATE TABLE IF NOT EXISTS memories(
                  id INTEGER PRIMARY KEY,
                  kind TEXT NOT NULL DEFAULT 'memory',
                  title TEXT NOT NULL DEFAULT '',
                  content TEXT NOT NULL,
                  tags TEXT NOT NULL DEFAULT '',
                  source TEXT NOT NULL DEFAULT '',
                  key TEXT UNIQUE,
                  hash TEXT NOT NULL,
                  tokens INTEGER NOT NULL,
                  doc_tokens INTEGER NOT NULL DEFAULT 0,
                  pinned INTEGER NOT NULL DEFAULT 0,
                  hits INTEGER NOT NULL DEFAULT 0,
                  created REAL NOT NULL,
                  updated REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS mem_hash ON memories(hash);
                CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
                CREATE VIRTUAL TABLE IF NOT EXISTS mem_fts USING fts5(
                  title, content, tags, content='memories', content_rowid='id',
                  tokenize='unicode61 remove_diacritics 2');
                CREATE TRIGGER IF NOT EXISTS mem_ai AFTER INSERT ON memories BEGIN
                  INSERT INTO mem_fts(rowid,title,content,tags) VALUES (new.id,new.title,new.content,new.tags);
                END;
                CREATE TRIGGER IF NOT EXISTS mem_ad AFTER DELETE ON memories BEGIN
                  INSERT INTO mem_fts(mem_fts,rowid,title,content,tags) VALUES('delete',old.id,old.title,old.content,old.tags);
                END;
                CREATE TRIGGER IF NOT EXISTS mem_au AFTER UPDATE OF title,content,tags ON memories BEGIN
                  INSERT INTO mem_fts(mem_fts,rowid,title,content,tags) VALUES('delete',old.id,old.title,old.content,old.tags);
                  INSERT INTO mem_fts(rowid,title,content,tags) VALUES (new.id,new.title,new.content,new.tags);
                END;
                """
            )

    # ------------------------------------------------------------------ écriture
    def add(
        self,
        content: str,
        title: str = "",
        kind: str = "memory",
        tags: str | list[str] = "",
        source: str = "",
        key: str | None = None,
        pinned: bool = False,
        doc_tokens: int = 0,
    ) -> tuple[int, bool]:
        """Ajoute (ou met à jour via `key`) un souvenir. Retourne (id, créé?)."""
        content = content.strip()
        if not content:
            raise ValueError("contenu vide")
        if kind not in KINDS:
            kind = "memory"
        if isinstance(tags, (list, tuple)):
            tags = " ".join(tags)
        title = (title or content.split("\n", 1)[0])[:120].strip()
        h = hashlib.sha1(f"{kind}\0{title}\0{content}".encode()).hexdigest()
        now = time.time()
        tk = est_tokens(content)
        with self._lock, self.db:
            if key:
                row = self.db.execute("SELECT id,hash FROM memories WHERE key=?", (key,)).fetchone()
                if row:
                    if row["hash"] != h:
                        self.db.execute(
                            "UPDATE memories SET kind=?,title=?,content=?,tags=?,source=?,hash=?,tokens=?,"
                            "doc_tokens=?,pinned=?,updated=? WHERE id=?",
                            (kind, title, content, tags, source, h, tk, doc_tokens or tk, int(pinned), now, row["id"]),
                        )
                    return row["id"], False
            else:
                row = self.db.execute("SELECT id FROM memories WHERE hash=?", (h,)).fetchone()
                if row:
                    return row["id"], False
            cur = self.db.execute(
                "INSERT INTO memories(kind,title,content,tags,source,key,hash,tokens,doc_tokens,pinned,created,updated)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (kind, title, content, tags, source, key, h, tk, doc_tokens or tk, int(pinned), now, now),
            )
            return int(cur.lastrowid), True

    def forget(self, mem_id: int) -> bool:
        with self._lock, self.db:
            return self.db.execute("DELETE FROM memories WHERE id=?", (mem_id,)).rowcount > 0

    def set_pinned(self, mem_id: int, pinned: bool) -> None:
        with self._lock, self.db:
            self.db.execute("UPDATE memories SET pinned=?,updated=? WHERE id=?", (int(pinned), time.time(), mem_id))

    # ------------------------------------------------------------------ lecture
    def get(self, mem_id: int) -> dict[str, Any] | None:
        with self._lock:
            r = self.db.execute("SELECT * FROM memories WHERE id=?", (mem_id,)).fetchone()
        return dict(r) if r else None

    def all_nodes(self, limit: int = 20000) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.db.execute(
                "SELECT id,kind,title,tags,tokens,hits,pinned,created FROM memories ORDER BY id LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def list(self, limit: int = 50, kind: str | None = None) -> list[dict[str, Any]]:
        q = "SELECT id,kind,title,tokens,hits,pinned,source FROM memories"
        args: list[Any] = []
        if kind:
            q += " WHERE kind=?"
            args.append(kind)
        q += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            return [dict(r) for r in self.db.execute(q, args).fetchall()]

    def pinned(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self.db.execute("SELECT * FROM memories WHERE pinned=1 ORDER BY id")]

    @staticmethod
    def _fts_query(q: str) -> str:
        words = re.findall(r"\w+", q.lower())
        keep = [w for w in words if w not in _STOP and len(w) > 1] or words
        terms = [f'"{w}"*' if len(w) >= 3 else f'"{w}"' for w in dict.fromkeys(keep)]
        return " OR ".join(terms)

    def search(self, query: str, limit: int = 8, kind: str | None = None) -> list[dict[str, Any]]:
        fq = self._fts_query(query)
        if not fq:
            return []
        sql = (
            "SELECT m.*, bm25(mem_fts,6.0,1.0,3.0) AS rank FROM mem_fts JOIN memories m ON m.id=mem_fts.rowid "
            "WHERE mem_fts MATCH ?"
        )
        args: list[Any] = [fq]
        if kind:
            sql += " AND m.kind=?"
            args.append(kind)
        sql += " ORDER BY rank LIMIT ?"
        args.append(limit * 3)
        with self._lock:
            try:
                rows = [dict(r) for r in self.db.execute(sql, args).fetchall()]
            except sqlite3.OperationalError:
                return []
        for r in rows:
            boost = 1 + 0.15 * math.log1p(r["hits"]) + (0.25 if r["kind"] == "instruction" else 0)
            r["score"] = round(-r["rank"] * boost, 4)
        rows.sort(key=lambda r: -r["score"])
        return rows[:limit]

    # ------------------------------------------------------------------ méta / stats
    def bump(self, ids: list[int], served: int, baseline: int) -> None:
        with self._lock, self.db:
            if ids:
                self.db.executemany("UPDATE memories SET hits=hits+1 WHERE id=?", [(i,) for i in ids])
            for k, v in (("recalls", 1), ("served_tokens", served), ("baseline_tokens", baseline)):
                self.db.execute(
                    "INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=CAST(v AS INTEGER)+?",
                    (k, v, v),
                )

    def meta_get(self, k: str, default: str = "") -> str:
        with self._lock:
            r = self.db.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
        return r["v"] if r else default

    def meta_set(self, k: str, v: str) -> None:
        with self._lock, self.db:
            self.db.execute("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=?", (k, v, v))

    def stats(self) -> dict[str, Any]:
        with self._lock:
            r = self.db.execute(
                "SELECT COUNT(*) n, COALESCE(SUM(tokens),0) t, COALESCE(MAX(updated),0) u, COALESCE(MAX(id),0) mx "
                "FROM memories"
            ).fetchone()
            kinds = {
                x["kind"]: x["c"]
                for x in self.db.execute("SELECT kind, COUNT(*) c FROM memories GROUP BY kind").fetchall()
            }
        served = int(self.meta_get("served_tokens", "0"))
        base = int(self.meta_get("baseline_tokens", "0"))
        return {
            "memories": r["n"],
            "stored_tokens": r["t"],
            "kinds": kinds,
            "recalls": int(self.meta_get("recalls", "0")),
            "served_tokens": served,
            "saved_tokens": max(0, base - served),
            "version": f'{r["n"]}-{r["mx"]}-{r["u"]:.3f}',
        }
