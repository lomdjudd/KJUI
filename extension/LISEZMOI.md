# Extension navigateur — enregistre claude.ai en direct

Pour Chrome, Edge ou Brave.

1. Lance le cerveau (`LANCER.bat` / `LANCER.command`) et laisse la fenêtre noire ouverte.
2. Ouvre `chrome://extensions` (ou `edge://extensions`), active **Mode développeur**.
3. Clique **Charger l'extension non empaquetée** et choisis ce dossier `extension/`.
4. Ouvre https://claude.ai (connecté). C'est tout : l'icône affiche ✓ quand ça envoie.

Elle lit tes conversations avec ta propre session (lecture seule, via les mêmes requêtes que le site) et les envoie
**uniquement à `127.0.0.1`** (ton ordinateur). Rien ne part sur internet.
Elle travaille tant qu'un onglet claude.ai est ouvert (vérification toutes les 15 s ; la 1re fois, tout l'historique est
récupéré doucement, une conversation toutes les 0,5 s).

Attention : elle s'appuie sur l'API interne du site, non documentée. Si claude.ai change, elle peut cesser de fonctionner —
l'export officiel (`kjui ingest export.zip`) reste la solution de secours.
