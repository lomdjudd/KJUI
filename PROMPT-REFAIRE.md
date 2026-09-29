Tu es un ingénieur logiciel senior + designer produit. Construis « KJUI Brain » de zéro, en mieux : un logiciel Python qui sert de CERVEAU LOCAL à Claude. Il enregistre EN DIRECT toutes mes données Claude et les redonne à Claude de façon ciblée, pour qu'il ne perde plus de tokens à chercher dans le vide.

## Objectif
1. Stocker en direct, localement, TOUT ce qui passe par Claude : chaque message (moi + Claude), chaque conversation, chaque fichier et image envoyés ou créés (png, html, css, js, apk, pdf, zip… n'importe quel type, gardés en original + texte cherchable).
2. Réduire la consommation de tokens : Claude reçoit uniquement les quelques souvenirs pertinents (budget strict), jamais des fichiers entiers.
3. Claude doit être VRAIMENT connecté en direct : le contexte pertinent est injecté automatiquement à chaque message, sans que Claude ait à le demander.
4. Interface magnifique : un cerveau en 3D fait de milliers de points ; chaque point = une donnée enregistrée. Style « Liquid Glass » (verre translucide clair, reflets, boutons en pilule, ombres douces, perles de verre), fluide à 60 fps.
5. Supporter des fichiers .md d'instructions (frontmatter kind/pinned/tags) pour donner à Claude des consignes précises et économes ; en fournir d'office (mode éco-tokens, « cerveau malin »).

## Public et contraintes
- L'utilisateur est NON technique, francophone : tout en français, zéro ligne de commande à taper, installation en 2 minutes maximum.
- Python 3.9+, dépendances minimales (idéalement stdlib seule : SQLite FTS5, http.server). Windows, macOS, Linux.
- 100 % local : rien n'est envoyé sur internet (sauf la vérification de mise à jour). Serveur uniquement sur 127.0.0.1, protection Host/Origin (anti DNS-rebinding/CSRF), noms de fichiers assainis, fichiers binaires servis en téléchargement (jamais exécutés).
- Sécurité : ne jamais enregistrer .env, clés (.pem, id_rsa…), node_modules, .git ; sauvegarder (*.bak) tout fichier de config modifié ; connexion réversible (`disconnect`).

## Architecture attendue
- Stockage : SQLite + FTS5 (BM25), table des souvenirs (kind : memory/instruction/conversation/file/image, titre, contenu, tags, source, conversation, appli, blob, mime, tokens, hits, épinglé), fichiers dans ~/.kjui/files/ nommés par SHA-1, journal d'événements pour le direct. Idempotent (clé unique par message, upsert, hash anti-doublon). Amélioration bienvenue : recherche hybride BM25 + embeddings locaux optionnels.
- Ingestion : (a) transcripts Claude Code ~/.claude/projects/*.jsonl en incrémental (offset, ligne à moitié écrite ignorée) : chaque message, images/documents base64, fichiers écrits (Write/Edit) ; (b) surveillance des dossiers de travail des sessions pour les fichiers créés par commande (apk, png…), limitée aux 30 derniers jours ; (c) export officiel claude.ai (.zip / conversations.json) : messages, pièces jointes, artifacts ; (d) glisser-déposer de n'importe quel fichier ; (e) extension navigateur MV3 pour claude.ai en direct (API interne non documentée : dire clairement que c'est fragile, garder l'export en plan B).
- Rappel (recall) : budget de tokens, blocs ≤ ~350 tokens, découpage par titres Markdown / lignes de code, tronquage propre, estimation honnête des tokens économisés (taille du document source − contexte servi).
- Connexion à Claude (`connect`, automatique au 1er lancement) : hook UserPromptSubmit (injection auto ≤ 700 tokens, seulement si les mots de la question recouvrent vraiment le souvenir — PAS de seuil BM25 seul : il est ≈ 0 sur une petite base ; exclure la session en cours ; ne jamais casser Claude en cas d'erreur, sortie JSON hookSpecificOutput.additionalContext), hook SessionStart (instructions épinglées), serveur MCP stdio écrit à la main (outils brain_recall / brain_remember + champ `instructions`), bloc balisé dans ~/.claude/CLAUDE.md, config Claude Desktop. Fusion non destructive des JSON existants, idempotente. Point d'entrée à chemin stable (kjui_run.py).
- Interface (web locale ouverte dans une fenêtre d'application Chrome/Edge/Brave `--app=`) : cerveau 3D canvas ; onglet « Flux en direct » (chaque événement à l'instant où il arrive, y compris « Claude a consulté le cerveau : #12 #45, −340 tokens » qui allume les points concernés) ; onglet « Conversations » (bulles, images en ligne, fichiers téléchargeables, mise à jour en direct) ; onglet « Fichiers » (galerie avec vignettes) ; recherche qui allume les points ; pastille d'état de la connexion à Claude ; courbe d'activité ; tuiles de stats ; mode allégé au-delà de ~2500 points.
- Mise à jour et installation : UN lanceur KJUI.py (stdlib) qui se met à jour depuis GitHub à chaque lancement (SHA du dernier commit, ZIP de la branche), lance l'appli en sous-processus, redémarre sur code de sortie 75 (bouton « Mise à jour » dans l'UI), crée un raccourci Bureau au 1er lancement. Données jamais touchées par une mise à jour.

## Pièges déjà rencontrés (à éviter)
- tkinter est souvent absent : ne pas en dépendre. Navigateur/webview = zéro install.
- Un lien brut vers un .py s'affiche comme du texte : distribuer un ZIP + LANCER.bat/.command (qui guide si Python manque). La branche par défaut du dépôt peut ne pas être `main` : donner le lien direct du ZIP.
- Ne jamais passer `null` à `replaceChildren` (affiche « null ») ; escaper/assainir tout texte dans le DOM (textContent, pas innerHTML).
- `pkill -f` peut tuer son propre shell ; ctx.filter/roundRect ne sont pas partout : prévoir des replis.
- Sur fond clair, le blending additif ('lighter') ne rend rien : dessiner des perles de verre en source-over avec ombre portée.
- Écritures SQLite depuis plusieurs threads : une connexion par thread, WAL, synchronous=NORMAL.

## Livrables et critères d'acceptation
- Dépôt complet + README + COMMENT-LANCER.md (3 étapes) + tests automatisés (unitaires : store/recherche/chunking/hook/connect/ingestion ; e2e : session Claude Code simulée qui grandit en direct, upload d'image, flux d'événements).
- Prouve chaque fonction en l'exécutant : lance l'appli, ouvre-la dans un navigateur headless, capture des screenshots (accueil, flux, conversation, fichiers, recherche), corrige ce qui est laid ou cassé, puis re-vérifie. Ne dis jamais « ça marche » sans l'avoir testé, et liste honnêtement ce qui n'a pas pu l'être.
- Critères : un ZIP + un double-clic suffisent ; un message tapé dans Claude Code apparaît dans le flux en < 5 s ; un fichier créé par Claude est téléchargeable depuis l'UI ; le hook injecte du contexte pertinent même avec 3 souvenirs seulement et n'injecte rien sur une question hors sujet ; `disconnect` remet les configs exactement comme avant.

## Améliorations demandées par rapport à une v1 basique
Design plus soigné et cohérent (thème clair + sombre), animations plus riches du cerveau (régions, signaux qui voyagent quand Claude lit un souvenir), recherche sémantique locale optionnelle, résumés compacts des longues conversations (faits atomiques) pour économiser encore plus de tokens, export/sauvegarde en un clic, chiffrement optionnel de la base, gestion multi-projets, pastille d'alerte si la connexion à Claude est cassée après une mise à jour de Claude Code, et un vrai mode « tokens économisés » mesuré (avant/après) affiché clairement.
