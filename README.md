# 🧠 KJUI Brain

Un **cerveau local** pour Claude : il mémorise tes données (faits, conversations, fichiers `.md`) et ne renvoie à Claude
que les quelques souvenirs pertinents, au lieu de le laisser relire des fichiers ou chercher dans le vide.
Python 3.9+, **zéro dépendance**, 100 % hors-ligne (SQLite + recherche plein texte BM25).

## Démarrage

```bash
pip install -e .            # ou : python -m kjui ...
kjui demo                   # (optionnel) quelques souvenirs d'exemple
kjui gui                    # ouvre le cerveau animé : http://127.0.0.1:8765
```

Chaque point lumineux du cerveau = un souvenir (couleur = type, taille = nombre de rappels, ✦ épinglé).
Survole pour lire, clique pour ouvrir/épingler/oublier, tape une recherche pour voir les points concernés s'allumer et se relier.
Glisse-dépose des `.md` dans la fenêtre pour les mémoriser.

## Brancher le cerveau à Claude (économie réelle de tokens)

```bash
kjui claude-md                                  # affiche le bloc pour CLAUDE.md + la commande MCP
claude mcp add kjui -- python -m kjui mcp       # Claude Code : outils brain_recall / brain_remember
```
Claude interroge alors le cerveau **avant** de lire des fichiers (`brain_recall`, budget 1200 tokens max par défaut)
et mémorise ce qu'il apprend (`brain_remember`). Sans MCP : `kjui recall "mots clés"` ou le bouton « Copier le contexte » de l'interface.

## Stockage « en direct » de tes sessions Claude

| Commande | Effet |
|---|---|
| `kjui gui --watch` / `kjui watch` | capte en continu les sessions Claude Code (`~/.claude/projects/*.jsonl`) |
| `kjui sync` | import ponctuel des sessions Claude Code |
| `kjui ingest conversations.json` | import de l'export officiel claude.ai |
| `kjui ingest fichier.md` / `dossier/` | importe des `.md`/`.txt`, découpés par titres en blocs ≤ ~350 tokens |
| `kjui add "fait" --pin` | mémorise un fait (épinglé = toujours inclus) |
| `kjui ls`, `kjui forget ID`, `kjui stats` | gestion et compteur de tokens économisés |

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
