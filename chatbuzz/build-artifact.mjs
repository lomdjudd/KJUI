// Génère chatbuzz-claude.html : version "une seule page" qui utilise l'abonnement Claude
// de la personne qui l'ouvre (capacité `sample` des Artifacts claude.ai).
// Usage : node build-artifact.mjs
import fs from 'node:fs';
import { CHARACTERS, CATEGORIES, FRAME } from './characters.js';

const tpl = fs.readFileSync(new URL('./claude-artifact.template.html', import.meta.url), 'utf8');
const data = JSON.stringify({ categories: CATEGORIES, characters: CHARACTERS, frame: FRAME }).replace(/</g, '\\u003c');
fs.writeFileSync(new URL('./chatbuzz-claude.html', import.meta.url), tpl.replace('/*__DATA__*/', () => data));
console.log('chatbuzz-claude.html généré');
