# 🧠 KJUI Brain

Un **cerveau local** pour Claude : il mémorise tes données (faits, conversations, fichiers `.md`) et ne renvoie à Claude
que les quelques souvenirs pertinents, au lieu de le laisser relire des fichiers ou chercher dans le vide.
Python 3.9+, **zéro dépendance**, 100 % hors-ligne (SQLite + recherche plein texte BM25).

## Démarrage

Voir `COMMENT-LANCER.md` : télécharge le ZIP de la branche `main`
(https://github.com/lomdjudd/kjui/archive/refs/heads/main.zip), décompresse, double-clique `LANCER.bat` / `LANCER.command`.
Il crée un raccourci sur le Bureau et se met à jour tout seul ensuite. Développeur : `pip install -e . && kjui gui`.

L'interface : **Flux en direct** (chaque message, fichier, image et chaque consultation du cerveau par Claude, à l'instant où
ça arrive), **Conversations** (chaque conversation complète en bulles, images et fichiers inclus, mise à jour en direct),
**Fichiers** (galerie de tout ce qui est gardé) et le **cerveau 3D** où chaque point est un souvenir.

## Claude est connecté en direct

Au premier lancement, `kjui gui` exécute `kjui connect` (réversible : `kjui disconnect`, fichiers sauvegardés en `*.kjui.bak`) :

| Ce qui est branché | Effet |
|---|---|
| **Hook `UserPromptSubmit`** (Claude Code) | à chaque message, le contexte pertinent du cerveau est **injecté automatiquement** (≤ 700 tokens, seulement si ça recouvre vraiment la question, jamais la session en cours) |
| **Hook `SessionStart`** | injecte tes instructions épinglées (éco-tokens, etc.) au début de chaque session |
| **Serveur MCP** (Claude Code + Claude Desktop) | outils `brain_recall` / `brain_remember` + consigne d'usage envoyée à Claude |
| **CLAUDE.md global** | 3 lignes qui disent à Claude de faire confiance au contexte injecté |

Chaque consultation apparaît dans le flux (« Claude a consulté le cerveau : #12 #45 · −340 tokens ») et allume les points
correspondants dans le cerveau. La pastille du haut indique l'état de la connexion. Redémarre Claude Code après la première connexion.

## Tout est enregistré (fichiers en original, en direct)

**Tous les fichiers** (html, css, js, png, apk, zip, pdf… n'importe quel type) sont conservés **tels quels** dans
`~/.kjui/files/` et téléchargeables depuis l'interface. Le texte/code est en plus découpé en blocs cherchables.

| Source | Capture | Comment |
|---|---|---|
| **Claude Code** (terminal, app desktop, IDE) | en direct (5 s) | `kjui gui` lit `~/.claude/projects` : messages, images, fichiers écrits par Claude |
| Fichiers créés **par commande** (apk, png générés…) | en direct (30 s) | surveillance des dossiers de travail des sessions (fichiers des 30 derniers jours) |
| **claude.ai** (site + app web) | en direct tant qu'un onglet est ouvert | extension navigateur, voir `extension/LISEZMOI.md` |
| Historique claude.ai | ponctuel | `kjui ingest export.zip` (Paramètres → Confidentialité → Exporter) |
| Tout ce que tu glisses dans la fenêtre / `kjui ingest chemin` | immédiat | fichier ou dossier, tout type |

Ignorés par sécurité : `.env`, clés (`.pem`, `.key`, `id_rsa`…), `node_modules`, `.git`, et les fichiers > 250 Mo.

Limites honnêtes :
- **claude.ai en direct** = extension, qui utilise l'API interne non documentée du site : elle peut casser si le site change
  (l'export officiel reste le plan B). Je n'ai pas pu la tester sur un vrai compte : la partie serveur est testée, pas la lecture du site.
- **Claude sur téléphone** et Claude sans onglet ouvert ne peuvent pas être captés en direct.
- Les *sorties* de commandes/lectures d'outils ne sont pas stockées (bruit) ; les fichiers eux, oui.

Autres commandes : `kjui sync` (import de l'historique Claude Code + dossiers), `kjui add "fait" --pin`, `kjui gui --no-watch`.

## Fichiers `.md` d'instructions

Un `.md` avec un en-tête est traité comme instruction :

```markdown
---
kind: instruction
pinned: true      # toujours inclus dans le contexte (1re fois par session via MCP)
tags: style git
---
# Mes règles
- Réponses courtes…
```

Deux instructions sont fournies et installées au premier lancement (`kjui/instructions/`) :
**Mode éco-tokens** (chercher dans le cerveau d'abord, réponses courtes, diffs seulement, mémoriser l'utile)
et **Cerveau malin** (planifier court, bon modèle pour la bonne tâche, souvenirs atomiques).

## Comment ça économise

- Les documents sont découpés en petits blocs : Claude reçoit le paragraphe utile, pas le fichier entier.
- `recall` respecte un budget de tokens strict et tronque proprement.
- Les instructions épinglées ne sont envoyées qu'une fois par session MCP.
- « Tokens économisés » = estimation (≈ 3,8 caractères/token) : taille du document source − taille du contexte servi.

Données dans `~/.kjui/brain.db` (changer avec `KJUI_HOME` ou `--db`). L'interface n'écoute que sur `127.0.0.1`.

Tests : `python -m unittest discover tests`
