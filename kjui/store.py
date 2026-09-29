"""Stockage SQLite + recherche plein texte (FTS5/BM25) — 100 % local, zéro dépendance."""
from __future__ import annotations

import contextlib
import hashlib
import json
import math
import os
import re
import sqlite3
import threading
import time
import unicodedata
from pathlib import Path
from typing import Any

KINDS = ("memory", "instruction", "conversation", "file", "image")

_STOP = set(
    "le la les un une des du de d l et ou à a au aux en dans sur pour par avec sans ce cet cette ces "
    "que qui quoi est sont être avoir fait faire je tu il elle on nous vous ils elles mon ma mes ton ta "
    "tes son sa ses ne pas plus se y the a an and or of to in on for with is are be was were it this "
    "that these those i you he she we they my your his her our their not as at by from do does did how "
    "what which who quel quelle quels quelles comment pourquoi quand où ou ecris écris peux peut veux voudrais "
    "fais faire stp svp merci bonjour salut déjà deja encore aussi très tres".split()
)


def _plain(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", t.lower()) if not unicodedata.combining(c))


def coverage(query: str, text: str) -> tuple[int, int]:
    """(mots de la requête retrouvés dans `text`, nombre de mots utiles de la requête) — accents/pluriels tolérés."""
    words = set(re.findall(r"\w+", _plain(text)))
    terms = [t for t in dict.fromkeys(re.findall(r"\w+", _plain(query))) if t not in {_plain(x) for x in _STOP} and len(t) > 2]
    hit = sum(1 for t in terms if any(w.startswith(t[:5] if len(t) >= 6 else t) for w in words))
    return hit, len(terms)


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
        self._tl = threading.local()
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=NORMAL")
        self.files_dir = Path(self.path).parent / "files"
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

        cols = {r["name"] for r in self.db.execute("PRAGMA table_info(memories)")}
        with self.db:
            if "blob" not in cols:
                self.db.execute("ALTER TABLE memories ADD COLUMN blob TEXT NOT NULL DEFAULT ''")
            if "mime" not in cols:
                self.db.execute("ALTER TABLE memories ADD COLUMN mime TEXT NOT NULL DEFAULT ''")
            for c in ("conv", "conv_title", "app"):
                if c not in cols:
                    self.db.execute(f"ALTER TABLE memories ADD COLUMN {c} TEXT NOT NULL DEFAULT ''")
            self.db.executescript(
                """
                CREATE INDEX IF NOT EXISTS mem_conv ON memories(conv);
                CREATE INDEX IF NOT EXISTS mem_blob ON memories(blob);
                CREATE TABLE IF NOT EXISTS events(
                  id INTEGER PRIMARY KEY, ts REAL NOT NULL, type TEXT NOT NULL,
                  mem_id INTEGER, text TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '{}');
                """
            )

    # ------------------------------------------------------------------ fichiers binaires
    def save_blob(self, data: bytes, ext: str = "bin") -> str:
        """Enregistre un fichier (image, pdf…) dans ~/.kjui/files/, nommé par son SHA-1. Retourne le nom."""
        ext = re.sub(r"[^a-z0-9]", "", ext.lower())[:5] or "bin"
        name = f"{hashlib.sha1(data).hexdigest()}.{ext}"
        self.files_dir.mkdir(parents=True, exist_ok=True)
        f = self.files_dir / name
        if not f.exists():
            f.write_bytes(data)
        return name

    @contextlib.contextmanager
    def ctx(self, conv: str = "", app: str = "", conv_title: str = ""):
        """Contexte d'ingestion (propre au thread) : rattache les souvenirs créés à une conversation / une appli."""
        old = getattr(self._tl, "c", None)
        self._tl.c = (conv, app, conv_title)
        try:
            yield
        finally:
            self._tl.c = old

    # ------------------------------------------------------------------ flux d'événements (« en direct »)
    def log_event(self, type_: str, mem_id: int | None = None, text: str = "", data: dict | None = None) -> int:
        with self._lock, self.db:
            cur = self.db.execute(
                "INSERT INTO events(ts,type,mem_id,text,data) VALUES (?,?,?,?,?)",
                (time.time(), type_, mem_id, text[:300], json.dumps(data or {}, ensure_ascii=False)),
            )
            if cur.lastrowid % 500 == 0:  # garde les 20 000 derniers
                self.db.execute("DELETE FROM events WHERE id < ?", (cur.lastrowid - 20000,))
            return int(cur.lastrowid)

    def events(self, since: int = 0, limit: int = 60) -> list[dict[str, Any]]:
        """Événements > since (ordre croissant) ; si since=0 : les `limit` derniers."""
        q = (
            "SELECT e.id,e.ts,e.type,e.mem_id,e.text,e.data,m.kind,m.title,m.source,m.app,m.conv,m.mime,m.blob,m.tokens,"
            "substr(m.content,1,260) AS preview FROM events e LEFT JOIN memories m ON m.id=e.mem_id "
        )
        with self._lock:
            if since:
                rows = self.db.execute(q + "WHERE e.id>? ORDER BY e.id LIMIT ?", (since, limit)).fetchall()
            else:
                rows = self.db.execute(q + "ORDER BY e.id DESC LIMIT ?", (limit,)).fetchall()[::-1]
        out = []
        for r in rows:
            d = dict(r)
            d["data"] = json.loads(d["data"] or "{}")
            out.append(d)
        return out

    def last_event_id(self) -> int:
        with self._lock:
            return int(self.db.execute("SELECT COALESCE(MAX(id),0) FROM events").fetchone()[0])

    def activity(self, minutes: int = 30) -> list[int]:
        """Nombre d'événements par minute sur les dernières `minutes` minutes (pour la courbe d'activité)."""
        now = time.time()
        with self._lock:
            rows = self.db.execute("SELECT ts FROM events WHERE ts>?", (now - minutes * 60,)).fetchall()
        buckets = [0] * minutes
        for (ts,) in rows:
            buckets[min(minutes - 1, int((now - ts) // 60))] += 1
        return buckets[::-1]

    def last_claude_call(self) -> float:
        with self._lock:
            r = self.db.execute("SELECT MAX(ts) FROM events WHERE type='recall' AND (data LIKE '%\"via\": \"hook\"%' OR data LIKE '%\"via\": \"mcp\"%' "
                "OR data LIKE '%\"via\": \"session\"%')").fetchone()
        return float(r[0] or 0)

    # ------------------------------------------------------------------ conversations & fichiers
    def conversations(self, limit: int = 300) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.db.execute(
                "SELECT conv, MAX(app) app, COUNT(*) n, MAX(id) last_id, MAX(updated) updated, MIN(created) created, "
                "MAX(conv_title) conv_title, "
                "(SELECT title FROM memories m2 WHERE m2.conv=m.conv AND m2.tags LIKE 'toi%' ORDER BY id LIMIT 1) first_q, "
                "SUM(kind IN ('file','image') AND blob!='') files "
                "FROM memories m WHERE conv!='' GROUP BY conv ORDER BY last_id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def conversation(self, conv: str, after_id: int = 0) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.db.execute(
                "SELECT id,kind,title,content,tags,source,app,mime,blob,tokens,created FROM memories "
                "WHERE conv=? AND id>? ORDER BY id LIMIT 2000", (conv, after_id)
            ).fetchall()
        return [dict(r) for r in rows]

    def files(self, limit: int = 300) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.db.execute(
                "SELECT MIN(id) id, kind, title, mime, blob, source, app, MAX(created) created, SUM(tokens) tokens "
                "FROM memories WHERE blob!='' GROUP BY blob ORDER BY MAX(id) DESC LIMIT ?", (limit,)
            ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            f = self.files_dir / d["blob"]
            d["size"] = f.stat().st_size if f.exists() else 0
            out.append(d)
        return out

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
        blob: str = "",
        mime: str = "",
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
        conv, app, conv_title = getattr(self._tl, "c", None) or ("", "", "")
        with self._lock, self.db:
            if key:
                row = self.db.execute("SELECT id,hash FROM memories WHERE key=?", (key,)).fetchone()
                if row:
                    if row["hash"] != h:
                        self.db.execute(
                            "UPDATE memories SET kind=?,title=?,content=?,tags=?,source=?,hash=?,tokens=?,"
                            "doc_tokens=?,pinned=?,updated=?,blob=?,mime=? WHERE id=?",
                            (kind, title, content, tags, source, h, tk, doc_tokens or tk, int(pinned), now, blob, mime, row["id"]),
                        )
                    return row["id"], False
            else:
                row = self.db.execute("SELECT id FROM memories WHERE hash=?", (h,)).fetchone()
                if row:
                    return row["id"], False
            cur = self.db.execute(
                "INSERT INTO memories(kind,title,content,tags,source,key,hash,tokens,doc_tokens,pinned,created,updated,blob,mime,"
                "conv,conv_title,app) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (kind, title, content, tags, source, key, h, tk, doc_tokens or tk, int(pinned), now, now, blob, mime,
                 conv, conv_title, app),
            )
            new_id = int(cur.lastrowid)
            self.db.execute(
                "INSERT INTO events(ts,type,mem_id,text,data) VALUES (?,?,?,?,?)",
                (now, "add", new_id, title[:300], json.dumps({"app": app, "conv": conv})),
            )
            return new_id, True

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

    def search(self, query: str, limit: int = 8, kind: str | None = None, exclude_conv: str = "") -> list[dict[str, Any]]:
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
        if exclude_conv:
            sql += " AND m.conv!=?"
            args.append(exclude_conv)
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
            convs = self.db.execute("SELECT COUNT(DISTINCT conv) FROM memories WHERE conv!=''").fetchone()[0]
            kinds = {
                x["kind"]: x["c"]
                for x in self.db.execute("SELECT kind, COUNT(*) c FROM memories GROUP BY kind").fetchall()
            }
        served = int(self.meta_get("served_tokens", "0"))
        base = int(self.meta_get("baseline_tokens", "0"))
        return {
            "memories": r["n"],
            "conversations": convs,
            "stored_tokens": r["t"],
            "kinds": kinds,
            "recalls": int(self.meta_get("recalls", "0")),
            "served_tokens": served,
            "saved_tokens": max(0, base - served),
            "version": f'{r["n"]}-{r["mx"]}-{r["u"]:.3f}',
        }
