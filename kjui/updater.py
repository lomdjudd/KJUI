"""Détection des mises à jour (l'installation elle-même est faite par le lanceur KJUI.py, qui redémarre l'appli)."""
from __future__ import annotations

import os
import time
import urllib.request
from pathlib import Path

REPO = "lomdjudd/kjui"
_cache: dict = {"t": 0.0, "remote": ""}


def app_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def managed() -> bool:
    """Vrai quand l'appli tourne sous le lanceur auto-mis à jour."""
    return os.environ.get("KJUI_BOOTSTRAP") == "1"


def local_sha() -> str:
    f = app_dir() / ".kjui_version"
    return f.read_text().strip() if f.exists() else ""


def remote_sha() -> str:
    if time.time() - _cache["t"] < 300 and _cache["remote"]:
        return _cache["remote"]
    req = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/commits/main",
        headers={"Accept": "application/vnd.github.sha", "User-Agent": "kjui"},
    )
    with urllib.request.urlopen(req, timeout=6) as r:
        _cache.update(t=time.time(), remote=r.read().decode().strip())
    return _cache["remote"]


def check() -> dict:
    out = {"managed": managed(), "local": local_sha()[:7], "available": False}
    if not managed():
        return out
    try:
        r = remote_sha()
        out.update(remote=r[:7], available=bool(r and r != local_sha()))
    except Exception as e:  # noqa: BLE001
        out["error"] = str(e)
    return out
