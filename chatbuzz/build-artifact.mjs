// Génère chatbuzz-claude.html : version "une seule page" qui utilise l'abonnement Claude
// de la personne qui l'ouvre (capacité `sample` des Artifacts claude.ai).
// Les portraits (portraits/*.jpg) sont publiés à côté de la page.
// Usage : node build-artifact.mjs
import fs from 'node:fs';
import { CHARACTERS, CATEGORIES, FRAME } from './characters.js';

const here = (p) => new URL(p, import.meta.url);
const tpl = fs.readFileSync(here('./claude-artifact.template.html'), 'utf8');
const icons = fs.readFileSync(here('./assets/icons.svg'), 'utf8');
const characters = CHARACTERS.map((c) => (fs.existsSync(here(`./portraits/${c.id}.jpg`)) ? { ...c, image: `portraits/${c.id}.jpg` } : c));
const data = JSON.stringify({ categories: CATEGORIES, characters, frame: FRAME }).replace(/</g, '\\u003c');
const out = tpl.replace('<!--__ICONS__-->', () => icons).replace('/*__DATA__*/', () => data);
fs.writeFileSync(here('./chatbuzz-claude.html'), out);
console.log(`chatbuzz-claude.html généré (${characters.filter((c) => c.image).length} portraits)`);
