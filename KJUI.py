#!/usr/bin/env python3
"""KJUI Brain — lanceur auto-mis à jour.

Télécharge CE FICHIER UNE SEULE FOIS, puis double-clique dessus (ou `python KJUI.py`).
À chaque lancement il récupère automatiquement la dernière version depuis GitHub et démarre le cerveau.
Tes données (souvenirs, fichiers) ne sont jamais touchées : elles sont dans ~/.kjui/brain.db et ~/.kjui/files/.
Python 3.9+ suffit, aucune installation.
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

REPO, BRANCH = "lomdjudd/kjui", "main"
HOME = Path(os.environ.get("KJUI_HOME") or Path.home() / ".kjui")
APP = HOME / "app"
VER = APP / ".kjui_version"
RESTART = 75  # code de sortie de l'appli = « mise à jour demandée »


def http(url: str, accept: str = "") -> bytes:
    h = {"User-Agent": "kjui-launcher"}
    if accept:
        h["Accept"] = accept
    if os.environ.get("GITHUB_TOKEN"):
        h["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60) as r:
        return r.read()


def update() -> str:
    remote = http(f"https://api.github.com/repos/{REPO}/commits/{BRANCH}", "application/vnd.github.sha").decode().strip()
    local = VER.read_text().strip() if VER.exists() else ""
    if remote == local and (APP / "kjui").exists():
        return "déjà à jour"
    print("⬇  Mise à jour de KJUI Brain…")
    z = zipfile.ZipFile(io.BytesIO(http(f"https://github.com/{REPO}/archive/refs/heads/{BRANCH}.zip")))
    with tempfile.TemporaryDirectory() as tmp:
        z.extractall(tmp)
        src = next(Path(tmp).iterdir())
        APP.mkdir(parents=True, exist_ok=True)
        for d in ("kjui", "extension"):
            shutil.rmtree(APP / d, ignore_errors=True)
            if (src / d).exists():
                shutil.copytree(src / d, APP / d)
        for f in src.iterdir():
            if f.is_file():
                shutil.copy2(f, APP / f.name)
    VER.write_text(remote)
    # le lanceur se met aussi à jour lui-même (effet au prochain démarrage)
    try:
        me = globals().get("__file__")
        new = (APP / "KJUI.py").read_bytes()
        if me and Path(me).resolve() != (APP / "KJUI.py").resolve() and Path(me).read_bytes() != new:
            Path(me).write_bytes(new)
    except OSError:
        pass
    return "mis à jour"


def shortcut() -> None:
    """Crée UNE fois un raccourci « KJUI Brain » sur le Bureau : plus besoin de rien retélécharger ni retrouver."""
    mark = HOME / ".shortcut_done"
    if mark.exists():
        return
    try:
        run = APP / "KJUI.py"
        desk = Path.home() / "Desktop"
        if not desk.is_dir():
            return
        if sys.platform == "win32":
            f = desk / "KJUI Brain.bat"
            f.write_bytes(f'@echo off\r\n"{sys.executable}" "{run}"\r\npause\r\n'.encode())
        elif sys.platform == "darwin":
            f = desk / "KJUI Brain.command"
            f.write_text(f'#!/bin/sh\n"{sys.executable}" "{run}"\n')
            f.chmod(0o755)
        else:
            f = desk / "KJUI Brain.desktop"
            f.write_text(f"[Desktop Entry]\nType=Application\nName=KJUI Brain\nExec=\"{sys.executable}\" \"{run}\"\nTerminal=true\n")
            f.chmod(0o755)
        mark.write_text(str(f))
        print(f"✔ Raccourci créé sur ton Bureau : « {f.name} » (tu peux supprimer le dossier téléchargé)")
    except OSError:
        pass


def main() -> int:
    try:
        print("🧠 KJUI Brain —", update())
    except Exception as e:  # noqa: BLE001
        if not (APP / "kjui").exists():
            print(f"✘ Impossible de télécharger KJUI Brain ({e}).\n  Vérifie ta connexion internet puis relance.")
            input("Appuie sur Entrée pour fermer…")
            return 1
        print(f"(pas de mise à jour : {e}) — démarrage de la version installée")
    shortcut()
    args = ["gui"] + sys.argv[1:]
    while True:
        env = dict(os.environ, KJUI_BOOTSTRAP="1", PYTHONPATH=str(APP))
        code = subprocess.call([sys.executable, "-m", "kjui", *args], cwd=str(APP), env=env)
        if code != RESTART:
            return code
        print("🔄 Redémarrage après mise à jour…")
        try:
            update()
        except Exception as e:  # noqa: BLE001
            print("(mise à jour impossible :", e, ")")
        env["KJUI_RESTARTED"] = "1"
        os.environ["KJUI_RESTARTED"] = "1"


if __name__ == "__main__":
    try:
        code = main()
    except KeyboardInterrupt:
        code = 0
    except Exception as e:  # noqa: BLE001
        print(f"\n✘ Erreur inattendue : {e}")
        input("Appuie sur Entrée pour fermer…")
        code = 1
    raise SystemExit(code)
