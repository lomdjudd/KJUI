"""Hooks Claude Code : injectent AUTOMATIQUEMENT la mémoire pertinente, sans que Claude ait à la demander."""
from __future__ import annotations

import json
import sys

from .recall import recall
from .store import Brain

HEAD = "Mémoire KJUI (locale, déjà connue — inutile de la rechercher à nouveau ni de relire ces sources) :\n"


def _emit(event: str, text: str) -> None:
    sys.stdout.write(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}}, ensure_ascii=False))


def run(kind: str, brain: Brain) -> None:
    """Ne doit JAMAIS casser Claude : toute erreur est silencieuse."""
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        data = {}
    try:
        if kind == "prompt":
            prompt = (data.get("prompt") or "").strip()
            if len(prompt) < 8 or prompt.startswith("/"):
                return
            out = recall(brain, prompt[:400], budget=700, limit=4, include_pinned=False, via="hook",
                         exclude_conv=data.get("session_id", ""), min_cover=0.5)
            if out["pack"]:
                _emit("UserPromptSubmit", HEAD + out["pack"])
        elif kind == "session":
            out = recall(brain, "", budget=600, include_pinned=True, via="session")
            if out["pack"]:
                _emit("SessionStart", "Instructions KJUI :\n" + out["pack"])
    except Exception:  # noqa: BLE001
        pass
