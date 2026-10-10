# Bot Discord — KJUI

Bot Discord écrit de A à Z avec [discord.js](https://discord.js.org) 14 : commandes slash, événements, déploiement des commandes et tests. Il accueille les nouveaux membres d'un serveur et propose des commandes utilitaires et ludiques (lancer de dés, pile ou face, boule magique, informations sur le serveur ou un utilisateur).

## Commandes

| Commande | Description |
|---|---|
| `/8ball question` | Pose une question à la boule magique |
| `/ask question` | Pose une question à Claude (IA, nécessite une clé API) |
| `/avatar [utilisateur]` | Affiche la photo de profil d'un utilisateur en grand |
| `/choose options` | Choisit au hasard parmi plusieurs options |
| `/coinflip` | Lance une pièce : pile ou face |
| `/help` | Affiche la liste des commandes disponibles |
| `/ping` | Affiche la latence du bot |
| `/reflexion niveau` | Règle le niveau de réflexion de Claude pour `/ask` |
| `/roll [expression]` | Lance des dés, par exemple `2d6+3` |
| `/serverinfo` | Affiche les informations du serveur |
| `/userinfo [utilisateur]` | Affiche les informations sur un utilisateur |

## Prérequis

- Node.js **20.12** ou plus récent (recommandé : 22 ou 24)
- Un compte Discord disposant des droits d'administration sur le serveur cible
- Docker (facultatif, voir la section [Docker](#docker))

## Installation

**a)** Créez l'application sur https://discord.com/developers/applications en cliquant sur **New Application**.

**b)** Ouvrez l'onglet **Bot**, cliquez sur **Reset Token**, puis copiez le token. Discord ne l'affiche qu'une seule fois.

**c)** Toujours dans l'onglet **Bot**, section **Privileged Gateway Intents**, activez **Server Members Intent**. Ce réglage est obligatoire pour le message de bienvenue.

**d)** Invitez le bot sur votre serveur avec cette URL, en remplaçant `VOTRE_CLIENT_ID` par l'**Application ID** (onglet **General Information**) :

```
https://discord.com/oauth2/authorize?client_id=VOTRE_CLIENT_ID&scope=bot+applications.commands&permissions=18432
```

La permission `18432` correspond à « Envoyer des messages » et « Intégrer des liens ».

**e)** Copiez le fichier de configuration et renseignez `DISCORD_TOKEN` avec le token copié à l'étape b :

```bash
cp .env.example .env
```

**f)** Installez les dépendances :

```bash
npm install
```

**g)** Déployez les commandes slash auprès de Discord :

```bash
npm run deploy
```

Si `DISCORD_GUILD_ID` est renseigné, les commandes apparaissent immédiatement sur ce serveur. Sinon elles sont déployées globalement, ce qui peut prendre jusqu'à 1 h.

**h)** Démarrez le bot :

```bash
npm start
```

## Variables d'environnement

Ces variables se trouvent dans `.env.example`, à copier en `.env`.

| Variable | Obligatoire | Description | Défaut |
|---|---|---|---|
| `DISCORD_TOKEN` | Oui | Token du bot (onglet **Bot** > **Reset Token**) | — |
| `DISCORD_CLIENT_ID` | Non | Identifiant de l'application, déduit automatiquement du token si absent | Déduit du token |
| `DISCORD_GUILD_ID` | Non | Si renseigné, les commandes sont déployées sur ce serveur uniquement (effet immédiat) | Déploiement global |
| `WELCOME_CHANNEL_ID` | Non | Salon où envoyer le message de bienvenue | Salon système du serveur |
| `LOG_LEVEL` | Non | `debug`, `info`, `warn` ou `error` | `info` |

## Simulateur (sans Discord)

`simulateur.html` reproduit les commandes et l'événement de bienvenue dans une page web, sans rien envoyer à Discord. Ouvre le fichier dans un navigateur (ou sur ton téléphone), puis tape `/` ou touche une commande. La logique des dés, les réponses de la boule magique et les embeds reprennent le code du bot.

## Commandes IA (Claude)

| Commande | Rôle |
| --- | --- |
| `/ask question:…` | Pose une question ou demande du code à Claude (Haiku 5.5 par défaut). La réponse s'affiche avec une animation pendant la réflexion, et est découpée si elle est longue. |
| `/reflexion niveau:…` | Règle le niveau de réflexion de Claude pour tes prochaines questions : désactivée, légère, moyenne ou élevée. Plus la réflexion est élevée, plus la réponse est lente et coûteuse. |

**Important : ces commandes utilisent une clé API, pas ton abonnement Claude Pro.** L'abonnement ne donne pas accès à l'API. Crée une clé sur [console.anthropic.com](https://console.anthropic.com), ajoute des crédits, puis mets-la dans `.env` :

```
ANTHROPIC_API_KEY=ta_cle
AI_ALLOWED_USER_IDS=123456789012345678
```

- Seuls les administrateurs du serveur et les identifiants listés dans `AI_ALLOWED_USER_IDS` peuvent utiliser `/ask`.
- Chaque utilisateur attend `AI_COOLDOWN_SECONDS` secondes entre deux questions, et ne peut pas en lancer deux en même temps.
- `AI_MAX_TOKENS` limite la longueur de chaque réponse, donc le coût.
- Le réglage de `/reflexion` est enregistré dans `data/reflexion.json` (ignoré par git).
- Si le modèle ne prend pas en charge la réflexion étendue, `/ask` répond sans elle et l'indique sous la réponse.

Après avoir ajouté ces commandes, relance `npm run deploy` pour les enregistrer sur Discord.

## Tests

```bash
npm test
```

Lance les tests `node:test` du dossier `tests/` (lancers de dés, structure des commandes). Ils ne demandent ni token ni connexion à Discord.

## Docker

```bash
docker build -t kjui-discord-bot .
docker run -d --name kjui-discord-bot --restart unless-stopped --env-file .env kjui-discord-bot
```

Le fichier `.env` n'est pas copié dans l'image (il est exclu par `.dockerignore`) : il est transmis à l'exécution avec `--env-file`.

Pour déployer les commandes slash depuis Docker, équivalent de `npm run deploy` :

```bash
docker run --rm --env-file .env kjui-discord-bot node src/deploy-commands.js
```

## Structure du projet

```
discord-bot/
├── .dockerignore
├── .env.example           # modèle de configuration
├── Dockerfile
├── package.json
├── src/
│   ├── index.js           # point d'entrée : connexion et chargement
│   ├── config.js          # lecture et validation de la configuration (.env)
│   ├── logger.js          # journalisation avec niveaux
│   ├── loader.js          # chargement dynamique des commandes et événements
│   ├── deploy-commands.js # déploiement des commandes slash
│   ├── commands/          # une commande par fichier
│   ├── events/            # un événement Discord par fichier
│   └── utils/             # fonctions pures (ex. lancers de dés)
└── tests/                 # tests node:test
```

## Ajouter une commande

1. Créez un fichier dans `src/commands/`, par exemple `src/commands/bonjour.js`. Il doit exporter par défaut un objet avec `data` (la définition de la commande) et `execute` (la fonction appelée à chaque utilisation) :

   ```js
   import { SlashCommandBuilder } from 'discord.js';

   export default {
     data: new SlashCommandBuilder()
       .setName('bonjour')
       .setDescription('Dit bonjour'),
     async execute(interaction) {
       await interaction.reply('Bonjour !');
     },
   };
   ```

   Règles : le nom fait 1 à 32 caractères (minuscules, chiffres, `-` ou `_`) et la description fait 1 à 100 caractères, en français.

2. Déployez la commande : `npm run deploy`.
3. Redémarrez le bot (`npm start`) pour qu'il charge la nouvelle commande.

## Sécurité

- Ne committez jamais le fichier `.env`. Il est déjà ignoré par Git (`.gitignore`) et exclu de l'image Docker.
- Si le token a été exposé (dépôt public, capture d'écran, log partagé...), régénérez-le immédiatement : onglet **Bot** > **Reset Token**. L'ancien token cesse de fonctionner. Mettez ensuite à jour `.env` et redémarrez le bot.
