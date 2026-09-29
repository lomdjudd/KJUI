"""Serveur MCP minimal (stdio, JSON-RPC) : Claude Code / Claude Desktop peuvent interroger le cerveau en direct."""
from __future__ import annotations

import json
import sys

from . import __version__
from .recall import recall
from .store import Brain

TOOLS = [
    {
        "name": "brain_recall",
        "description": "Cherche dans le cerveau local KJUI AVANT de lire des fichiers ou le web. Renvoie des souvenirs compacts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "2-6 mots-clés"},
                "budget": {"type": "integer", "description": "budget max en tokens (défaut 1200)"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "brain_remember",
        "description": "Mémorise un fait durable (décision, convention, commande, préférence) en 1-3 phrases.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "title": {"type": "string"},
                "tags": {"type": "string"},
            },
            "required": ["text"],
        },
    },
]


_first = [True]  # les instructions épinglées ne sont envoyées qu'une fois par session


def _call(brain: Brain, name: str, args: dict) -> str:
    if name == "brain_recall":
        r = recall(brain, args.get("query", ""), int(args.get("budget") or 1200), include_pinned=_first[0])
        _first[0] = False
        return r["pack"] or "(rien de connu — cherche normalement puis utilise brain_remember)"
    if name == "brain_remember":
        i, new = brain.add(args["text"], title=args.get("title", ""), tags=args.get("tags", ""), source="mcp")
        return f"souvenir #{i} {'créé' if new else 'déjà connu'}"
    raise ValueError(f"outil inconnu: {name}")


def serve(brain: Brain) -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except ValueError:
            continue
        rid, method = req.get("id"), req.get("method", "")
        if rid is None:  # notification
            continue
        try:
            if method == "initialize":
                res = {
                    "protocolVersion": req.get("params", {}).get("protocolVersion", "2024-11-05"),
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "kjui-brain", "version": __version__},
                }
            elif method == "tools/list":
                res = {"tools": TOOLS}
            elif method == "tools/call":
                p = req.get("params", {})
                res = {"content": [{"type": "text", "text": _call(brain, p.get("name", ""), p.get("arguments") or {})}]}
            elif method == "ping":
                res = {}
            else:
                raise ValueError(f"méthode non supportée: {method}")
            msg = {"jsonrpc": "2.0", "id": rid, "result": res}
        except Exception as e:  # noqa: BLE001
            msg = {"jsonrpc": "2.0", "id": rid, "error": {"code": -32000, "message": str(e)}}
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        sys.stdout.flush()
