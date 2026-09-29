# Lancer le cerveau — une seule fois à télécharger

1. Installe Python 3.9+ si besoin : https://www.python.org/downloads/ (Windows : coche « Add Python to PATH »).
2. Télécharge **un seul fichier**, une fois pour toutes :
   https://raw.githubusercontent.com/lomdjudd/kjui/main/KJUI.py  → clic droit → « Enregistrer sous… » → `KJUI.py`
3. Double-clique sur `KJUI.py` (ou dans un terminal : `python KJUI.py`).

C'est tout. À chaque lancement :
- il **se met à jour tout seul** depuis GitHub (plus jamais de re-téléchargement) ;
- il ouvre le cerveau dans une **fenêtre d'application** ;
- au premier lancement il **connecte Claude** (Claude Code + Claude Desktop) : le contexte pertinent est injecté automatiquement
  à chaque message, sans que Claude ait à chercher. Redémarre Claude Code une fois.

Tes données restent dans `~/.kjui/` (souvenirs `brain.db`, fichiers `files/`) : elles ne sont jamais effacées par une mise à jour.

Pour le site claude.ai en direct : installe l'extension du dossier `extension/` (dans `~/.kjui/app/extension/`), voir `extension/LISEZMOI.md`.
