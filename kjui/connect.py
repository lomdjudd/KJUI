"""Branche le cerveau à Claude : MCP (Claude Code + Claude Desktop), hooks d'injection automatique, CLAUDE.md global.
Tous les fichiers modifiés sont sauvegardés une fois (*.kjui.bak) ; `disconnect` retire tout proprement."""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

START, END = "<!-- KJUI:START -->", "<!-- KJUI:END -->"
SNIPPET = f"""{START}
## Cerveau KJUI (mémoire locale, économise des tokens)
Le contexte pertinent de tes conversations passées est injecté automatiquement : s'il suffit, ne relis pas les sources.
Sinon appelle `brain_recall` (2-6 mots-clés) avant de chercher dans des fichiers ou sur le web ; mémorise les faits durables avec `brain_remember`.
{END}
"""


def entry() -> Path:
    return Path(__file__).resolve().parent.parent / "kjui_run.py"


def _cmd(*args: str) -> str:
    py = Path(sys.executable).as_posix()
    return " ".join([f'"{py}"', f'"{entry().as_posix()}"', *args])


def _paths() -> dict[str, Path]:
    cfg = os.environ.get("CLAUDE_CONFIG_DIR")
    base = Path(cfg) if cfg else Path.home() / ".claude"
    home = Path.home()
    if sys.platform == "win32":
        desk = Path(os.environ.get("APPDATA", home / "AppData" / "Roaming")) / "Claude"
    elif sys.platform == "darwin":
        desk = home / "Library" / "Application Support" / "Claude"
    else:
        desk = home / ".config" / "Claude"
    return {
        "claude_json": (base / ".claude.json") if cfg else home / ".claude.json",
        "settings": base / "settings.json",
        "claude_md": base / "CLAUDE.md",
        "desktop_dir": desk,
        "desktop": desk / "claude_desktop_config.json",
    }


def _read(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text("utf-8")) if path.exists() else {}
    except ValueError:
        raise RuntimeError(f"{path} n'est pas un JSON valide — je n'y touche pas")


def _write(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bak = path.with_name(path.name + ".kjui.bak")
    if path.exists() and not bak.exists():
        bak.write_bytes(path.read_bytes())
    tmp = path.with_name(path.name + ".kjui.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), "utf-8")
    os.replace(tmp, path)


def _mine(group: dict) -> bool:
    return any("kjui_run.py" in h.get("command", "") for h in group.get("hooks", []))


def _hooks(settings: dict, add: bool) -> None:
    hooks = settings.setdefault("hooks", {})
    for event, group in (
        ("UserPromptSubmit", {"hooks": [{"type": "command", "command": _cmd("hook", "prompt"), "timeout": 10}]}),
        ("SessionStart", {"matcher": "startup|resume|clear", "hooks": [{"type": "command", "command": _cmd("hook", "session"), "timeout": 10}]}),
    ):
        groups = [g for g in hooks.get(event, []) if not _mine(g)]
        if add:
            groups.append(group)
        if groups:
            hooks[event] = groups
        else:
            hooks.pop(event, None)
    if not hooks:
        settings.pop("hooks", None)


def _mcp(cfg: dict, add: bool) -> None:
    servers = cfg.setdefault("mcpServers", {})
    if add:
        servers["kjui"] = {"type": "stdio", "command": sys.executable, "args": [str(entry()), "mcp"], "env": {}}
    else:
        servers.pop("kjui", None)
    if not servers:
        cfg.pop("mcpServers", None)


def _md(path: Path, add: bool) -> None:
    text = path.read_text("utf-8") if path.exists() else ""
    text = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", text, flags=re.S)
    if add:
        text = (text.rstrip() + "\n\n" if text.strip() else "") + SNIPPET
    if path.exists() or add:
        path.parent.mkdir(parents=True, exist_ok=True)
        bak = path.with_name(path.name + ".kjui.bak")
        if path.exists() and not bak.exists():
            bak.write_bytes(path.read_bytes())
        path.write_text(text, "utf-8")


def status() -> dict[str, Any]:
    p = _paths()
    out: dict[str, Any] = {}
    try:
        out["claude_code_mcp"] = "kjui" in _read(p["claude_json"]).get("mcpServers", {})
        out["hooks"] = any(_mine(g) for g in _read(p["settings"]).get("hooks", {}).get("UserPromptSubmit", []))
        out["claude_md"] = p["claude_md"].exists() and START in p["claude_md"].read_text("utf-8")
        out["desktop"] = ("kjui" in _read(p["desktop"]).get("mcpServers", {})) if p["desktop_dir"].exists() else None
    except RuntimeError as e:
        out["error"] = str(e)
    out["connected"] = bool(out.get("claude_code_mcp") and out.get("hooks"))
    return out


def apply(add: bool) -> dict[str, Any]:
    p = _paths()
    for key, fn in (("claude_json", _mcp), ("settings", None)):
        cfg = _read(p[key])
        if fn:
            fn(cfg, add)
        else:
            _hooks(cfg, add)
        if cfg or p[key].exists():
            _write(p[key], cfg)
    _md(p["claude_md"], add)
    if p["desktop_dir"].exists():
        cfg = _read(p["desktop"])
        _mcp(cfg, add)
        if cfg or p["desktop"].exists():
            _write(p["desktop"], cfg)
    return status()
