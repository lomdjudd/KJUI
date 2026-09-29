# Installer KJUI Brain (2 minutes, une seule fois)

1. **Python** : si tu ne l'as pas, installe-le depuis https://www.python.org/downloads/
   (Windows : coche **« Add Python to PATH »** pendant l'installation).
2. **Télécharge le programme** — clique ce lien, le téléchargement démarre tout seul :
   **https://github.com/lomdjudd/kjui/archive/refs/heads/main.zip**
   (⚠ n'utilise pas le bouton vert « Code » du dépôt : il donne le jeu Spider-Man, la branche par défaut n'est pas la bonne.)
3. **Décompresse** le fichier ZIP (clic droit → Extraire tout).
4. **Double-clique** sur `LANCER.bat` (Windows) ou `LANCER.command` (Mac).

Au premier lancement il se met à jour, connecte Claude, ouvre le cerveau, et **crée un raccourci « KJUI Brain » sur ton Bureau**.
Ensuite tu n'as plus rien à télécharger : le raccourci se met à jour tout seul à chaque ouverture, et tu peux supprimer le dossier ZIP.

Tes données restent dans `~/.kjui/` (jamais effacées par une mise à jour).

## Installation en une ligne (terminal, sans rien télécharger)
    python3 -c "import urllib.request as u;exec(u.urlopen('https://raw.githubusercontent.com/lomdjudd/kjui/main/KJUI.py').read())"
(sur Windows : `python` ou `py` à la place de `python3`)

Pour le site claude.ai en direct : extension du dossier `extension/` (voir `extension/LISEZMOI.md`).
