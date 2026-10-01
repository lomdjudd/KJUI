# 💬 ChatBuzz

Site de chat avec des personnages IA façon PolyBuzz : 12 personnages originaux, création de tes propres persos,
réponses en streaming, historique sauvegardé dans le navigateur, design néon responsive (mobile + desktop).
Propulsé par l'**API Claude** via un petit serveur Node **sans aucune dépendance**.

## Lancer

```bash
cd chatbuzz
cp .env.example .env     # puis colle ta clé API dans ANTHROPIC_API_KEY
npm start                # → http://localhost:3000
```

Node 18+ requis.

## ⚠️ À propos de l'abonnement Claude Pro

L'abonnement **Claude Pro (claude.ai) ne donne pas accès à l'API** : ce sont deux produits distincts, facturés séparément.
Il n'est pas possible (et ses conditions d'utilisation l'interdisent) de réutiliser la connexion de ton compte Pro pour
alimenter un site/une API tierce. Il te faut une **clé API** : <https://console.anthropic.com> → *API Keys*
(paiement à l'usage, quelques dollars de crédit suffisent pour tester ; `CLAUDE_MODEL=claude-haiku-4-5-20251001` coûte le moins).

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Ta clé API (obligatoire) |
| `CLAUDE_MODEL` | Modèle utilisé (défaut `claude-sonnet-5-5`) |
| `PORT` | Port du site (défaut 3000) |
| `ACCESS_CODE` | Optionnel : code demandé aux visiteurs, pour protéger ta clé si tu publies le site |

La clé reste côté serveur, elle n'est jamais envoyée au navigateur. Un limiteur (20 messages/min/IP) protège aussi ton crédit.

## Personnalisation

- **Ajouter un personnage** : édite `characters.js` (nom, emoji, couleurs, tags, message d'accueil, `persona`).
- **Ajuster le ton / les règles** : le prompt commun est la constante `FRAME` dans `characters.js`.
- Les personnages créés par les visiteurs sont stockés dans leur navigateur (localStorage).

## Limites de contenu

Les personnages jouent leur rôle de façon immersive (romance douce, action, horreur gothique, etc.), mais le prompt et
le modèle gardent des garde-fous : pas de contenu sexuel explicite, rien impliquant des mineurs, pas d'instructions
dangereuses réelles. Ces limites sont celles de Claude et ne sont pas contournées par ce projet.

## Structure

```
chatbuzz/
├─ server.js        serveur HTTP + proxy streaming vers l'API Claude
├─ characters.js    personnages + prompt système
└─ public/          index.html, style.css, app.js (front vanilla)
```
