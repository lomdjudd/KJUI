from __future__ import annotations

import argparse
import sys
import time
from importlib import resources
from pathlib import Path

from . import __version__
from .ingest import ingest_claude_export, ingest_markdown, ingest_path, sync_claude_code
from .recall import recall
from .store import Brain

CLAUDE_MD_SNIPPET = """\
## Cerveau KJUI (économie de tokens)
Avant de lire des fichiers ou de chercher sur le web, appelle `brain_recall` (2-6 mots-clés).
Si la réponse y est, ne relis pas les sources. Mémorise tout fait durable avec `brain_remember`.
"""


def seed_builtin(brain: Brain) -> int:
    n = 0
    for f in resources.files("kjui").joinpath("instructions").iterdir():
        if f.name.endswith(".md"):
            n += ingest_markdown(brain, f.read_text("utf-8"), f.name, source=f"builtin:{f.name}")["created"]
    return n


DEMO = [
    ("Le projet utilise Python 3.11, SQLite et aucune dépendance externe.", "Stack du projet", "memory", "python sqlite"),
    ("Convention de commit : messages courts à l'impératif, en français, préfixe feat:/fix:.", "Convention de commits", "memory", "git"),
    ("Les tests se lancent avec `python -m unittest discover tests`.", "Lancer les tests", "memory", "tests"),
    ("L'utilisateur préfère des réponses concises, réponse d'abord, sans récapitulatif.", "Préférence de style", "memory", "style"),
    ("Déploiement : `git push` sur main déclenche la CI ; ne jamais pousser de secrets.", "Déploiement", "memory", "ci deploy"),
    ("Q: Comment activer le mode debug ?\nR: Définir KJUI_DEBUG=1 avant de lancer la commande.", "Activer le debug", "conversation", "debug"),
    ("Le port par défaut de l'interface est 8765 (option --port pour le changer).", "Port de l'interface", "memory", "gui"),
    ("Utiliser Sonnet par défaut, Opus seulement pour l'architecture et les bugs difficiles.", "Choix du modèle", "instruction", "eco"),
]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="kjui", description="KJUI Brain — mémoire locale pour Claude")
    p.add_argument("--db", help="chemin de la base (défaut ~/.kjui/brain.db)")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd")

    sub.add_parser("init", help="crée la base et installe les instructions éco/malin")
    g = sub.add_parser("gui", help="ouvre le cerveau animé")
    g.add_argument("--port", type=int, default=8765)
    g.add_argument("--no-browser", action="store_true")
    g.add_argument("--watch", action="store_true", help="capte en direct les sessions Claude Code")
    a = sub.add_parser("add", help="mémoriser un fait")
    a.add_argument("text")
    a.add_argument("-t", "--title", default="")
    a.add_argument("--tags", default="")
    a.add_argument("--kind", default="memory")
    a.add_argument("--pin", action="store_true")
    i = sub.add_parser("ingest", help="importer un .md/.txt, un dossier, ou conversations.json")
    i.add_argument("path")
    i.add_argument("--instruction", action="store_true", help="traiter comme instructions épinglées")
    r = sub.add_parser("recall", help="afficher le pack de contexte pour une requête")
    r.add_argument("query")
    r.add_argument("-b", "--budget", type=int, default=1200)
    l = sub.add_parser("ls", help="lister les souvenirs")
    l.add_argument("-n", type=int, default=30)
    f = sub.add_parser("forget", help="supprimer un souvenir")
    f.add_argument("id", type=int)
    sub.add_parser("stats", help="statistiques et tokens économisés")
    sub.add_parser("sync", help="importer une fois les sessions Claude Code (~/.claude/projects)")
    sub.add_parser("watch", help="surveiller en continu les sessions Claude Code")
    sub.add_parser("mcp", help="serveur MCP (stdio) pour Claude Code / Desktop")
    sub.add_parser("claude-md", help="affiche le bloc à coller dans CLAUDE.md + commande MCP")
    sub.add_parser("demo", help="charge des souvenirs d'exemple")

    args = p.parse_args(argv)
    if not args.cmd:
        args.cmd = "gui"
        args.port, args.no_browser, args.watch = 8765, False, False
    brain = Brain(args.db)
    if args.cmd != "mcp" and not brain.meta_get("seeded"):
        seed_builtin(brain)
        brain.meta_set("seeded", "1")

    if args.cmd == "init":
        print(f"✔ cerveau prêt : {brain.path}")
    elif args.cmd == "gui":
        from .web import run

        run(brain, args.port, not args.no_browser, args.watch)
    elif args.cmd == "add":
        n, new = brain.add(args.text, args.title, args.kind, args.tags, "cli", pinned=args.pin)
        print(f"#{n} {'créé' if new else 'déjà connu'}")
    elif args.cmd == "ingest":
        path = Path(args.path).expanduser()
        if path.name == "conversations.json":
            print(f"✔ {ingest_claude_export(brain, path)} conversations mémorisées")
        else:
            res = ingest_path(brain, path, "instruction" if args.instruction else None, True if args.instruction else None)
            print(f"✔ {res['files']} fichier(s) → {res['chunks']} blocs ({res['created']} nouveaux)")
    elif args.cmd == "recall":
        out = recall(brain, args.query, args.budget)
        print(out["pack"] or "(rien)")
        print(f"\n≈{out['tokens']} tokens servis · ≈{out['saved']} économisés", file=sys.stderr)
    elif args.cmd == "ls":
        for m in brain.list(args.n):
            print(f"#{m['id']:<5} {m['kind']:<12} {m['tokens']:>5}t {'📌' if m['pinned'] else '  '} {m['title']}")
    elif args.cmd == "forget":
        print("supprimé" if brain.forget(args.id) else "introuvable")
    elif args.cmd == "stats":
        s = brain.stats()
        print(f"souvenirs      : {s['memories']}  {s['kinds']}")
        print(f"tokens stockés : {s['stored_tokens']}")
        print(f"rappels        : {s['recalls']}  (≈{s['served_tokens']} tokens servis)")
        print(f"tokens économisés (estimation) : {s['saved_tokens']}")
    elif args.cmd == "sync":
        print(f"✔ {sync_claude_code(brain)} échanges mémorisés")
    elif args.cmd == "watch":
        print("👀 surveillance de ~/.claude/projects (Ctrl+C pour arrêter)")
        try:
            while True:
                n = sync_claude_code(brain)
                if n:
                    print(f"  +{n} souvenirs")
                time.sleep(5)
        except KeyboardInterrupt:
            pass
    elif args.cmd == "mcp":
        from .mcp_server import serve

        serve(brain)
    elif args.cmd == "claude-md":
        print(CLAUDE_MD_SNIPPET)
        print("# Brancher le cerveau à Claude Code :")
        print(f"claude mcp add kjui -- {sys.executable} -m kjui mcp")
    elif args.cmd == "demo":
        for text, title, kind, tags in DEMO:
            brain.add(text, title, kind, tags, "demo")
        print(f"✔ {len(DEMO)} souvenirs de démo")
    return 0
