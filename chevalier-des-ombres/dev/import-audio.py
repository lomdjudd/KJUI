#!/usr/bin/env python3
"""Importe les musiques et bruitages enregistrés (jeu libre Flare, licences CC0 / CC-BY / CC-BY-SA).

Usage : python3 dev/import-audio.py <chemin vers flare-game> <chemin vers le wiki flare-game> [ffmpeg]

- Musiques : réencodées en Opus (WebM, ~64 kb/s) dans public/audio/music/
- Bruitages : copiés tels quels (Ogg Vorbis) dans public/audio/sfx/
- Crédits : src/data/audioCredits.js (écran « Crédits » du jeu) et CREDITS-AUDIO.md
Seuls les fichiers dont l'auteur et la licence sont identifiés dans les crédits de Flare sont importés.
"""
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLARE, WIKI = sys.argv[1], sys.argv[2]
FFMPEG = sys.argv[3] if len(sys.argv) > 3 else 'ffmpeg'
CORE = os.path.join(FLARE, 'mods', 'fantasycore')

LICENSE_URL = {
    'CC-BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
    'CC-BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
    'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
}

# Musiques : identifiant du jeu → fichier Flare
MUSIC = {
    'title': 'title_theme',
    'town': 'town_theme',
    'safe': 'safe_room_theme',
    'unrest': 'unrest_theme',
    'forest': 'forest_theme',
    'magical': 'magical_theme',
    'dungeon': 'dungeon_theme',
    'overworld': 'overworld_theme',
    'battle': 'battle_theme',
    'boss': 'boss_theme',
}

# Bruitages : identifiant du jeu → fichier Flare (chemin relatif à soundfx/)
SFX = {
    'swish': 'flying_loot.ogg',
    'hitFlesh': 'enemies/zombie_hit.ogg',
    'hitBone': 'enemies/skeleton_hit.ogg',
    'block': 'powers/block.ogg',
    'stepLeather1': 'steps/step_leather1.ogg', 'stepLeather2': 'steps/step_leather2.ogg', 'stepLeather3': 'steps/step_leather3.ogg', 'stepLeather4': 'steps/step_leather4.ogg',
    'stepMetal1': 'steps/step_metal1.ogg', 'stepMetal2': 'steps/step_metal2.ogg', 'stepMetal3': 'steps/step_metal3.ogg', 'stepMetal4': 'steps/step_metal4.ogg',
    'stepCloth1': 'steps/step_cloth1.ogg', 'stepCloth2': 'steps/step_cloth2.ogg', 'stepCloth3': 'steps/step_cloth3.ogg', 'stepCloth4': 'steps/step_cloth4.ogg',
    'stepEcho1': 'steps/step_echo1.ogg', 'stepEcho2': 'steps/step_echo2.ogg', 'stepEcho3': 'steps/step_echo3.ogg', 'stepEcho4': 'steps/step_echo4.ogg',
    'potion': 'inventory/inventory_potion.ogg',
    'fireball': 'powers/fireball.ogg',
    'burn': 'powers/burn.ogg',
    'freeze': 'powers/freeze.ogg',
    'shock': 'powers/shock.ogg',
    'thunder': 'powers/thunder.ogg',
    'teleport': 'powers/teleport.ogg',
    'heal': 'powers/heal.ogg',
    'shield': 'powers/shield.ogg',
    'quake': 'powers/quake.ogg',
    'warcry': 'powers/warcry.ogg',
    'timestop': 'powers/timestop.ogg',
    'arrow': 'powers/shoot.ogg',
    'zombieGrowl': 'enemies/zombie_ment.ogg',
    'zombiePhys': 'enemies/zombie_phys.ogg',
    'ghost': 'enemies/skeleton_phys.ogg',
    'insect': 'enemies/antlion_phys.ogg',
    'beastHit': 'enemies/minotaur_hit.ogg',
    'beastPhys': 'enemies/minotaur_phys.ogg',
    'beastDie': 'enemies/minotaur_die.ogg',
    'wyvernRoar': 'enemies/wyvern_phys.ogg',
    'wyvernMent': 'enemies/wyvern_ment.ogg',
    'wyvernDie': 'enemies/wyvern_die.ogg',
    'zombieDie': 'enemies/zombie_die.ogg',
    'skeletonDie': 'enemies/skeleton_die.ogg',
    'squishDie': 'enemies/antlion_die.ogg',
    'playerHurt': 'male_hit.ogg',
    'playerDie': 'male_die.ogg',
    'levelUp': 'level_up.ogg',
    'coins': 'inventory/inventory_coins.ogg',
    'gem': 'inventory/inventory_gem.ogg',
    'book': 'inventory/inventory_book.ogg',
    'page': 'inventory/inventory_page.ogg',
    'metalItem': 'inventory/inventory_metal.ogg',
    'heavyItem': 'inventory/inventory_heavy.ogg',
    'chest': 'wood_open.ogg',
    'door': 'door_open.ogg',
    'portal': 'environment/teleporter.ogg',
}


def parse_credits():
    txt = open(os.path.join(WIKI, 'Credits.md'), encoding='utf-8').read()
    start = txt.index('## Background Music')
    nxt = txt.find('\n## ', txt.index('## Sound Effects') + 5)
    sec = txt[start: nxt if nxt > 0 else len(txt)]
    author = lic = None
    out = {}
    for line in sec.splitlines():
        s = line.strip()
        m = re.match(r'(?:Music Composer|Sound Effects Artist) - (.*)', s)
        if m:
            a = m.group(1)
            mm = re.match(r'\[(.*?)\]\((.*?)\)', a)
            author = (mm.group(1), mm.group(2)) if mm else (a, None)
            lic = None
            continue
        m = re.match(r'\*\s*License:\s*(.*)', s)
        if m:
            lic = m.group(1).strip()
            continue
        m = re.match(r'\*\s*/?mods/fantasycore/+([^\s]+)(.*)', s)
        if m and author:
            path = m.group(1).rstrip(',')
            orig = re.findall(r'\((https?://[^)]+|www\.[^)]+)\)', m.group(2))
            out.setdefault(path, []).append({'author': author[0], 'authorUrl': author[1], 'license': lic, 'orig': orig})
    return out


def credit_for(credits, rel):
    """Crédits d'un fichier (gère les motifs du wiki : wyvern*.ogg, goblin(all), steps/…)."""
    if rel in credits:
        return credits[rel]
    base = os.path.basename(rel)
    # Fichier déplacé depuis la rédaction des crédits (ex. soundfx/heal.ogg → soundfx/powers/heal.ogg)
    same = [v for k, v in credits.items() if os.path.basename(k) == base and k.split('/')[0] == rel.split('/')[0]]
    if len(same) == 1:
        return same[0]
    for k, v in credits.items():
        kb = os.path.basename(k)
        if '*' in kb and re.fullmatch(kb.replace('.', r'\.').replace('*', '.*'), base) and os.path.dirname(k) == os.path.dirname(rel):
            return v
    if rel.startswith('soundfx/steps/step_') and any(x in rel for x in ('cloth', 'leather', 'metal')):
        return credits.get('soundfx/steps/cloth')
    if rel.startswith('soundfx/steps/step_echo'):
        return credits.get('soundfx/' + base)
    return None


def norm_license(l):
    l = (l or '').replace('Public Domain,', '').strip()
    if l.startswith('CC0'):
        return 'CC0'
    return l


def main():
    credits = parse_credits()
    out_music = os.path.join(ROOT, 'public', 'audio', 'music')
    out_sfx = os.path.join(ROOT, 'public', 'audio', 'sfx')
    for d in (out_music, out_sfx):
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
    entries = []
    manifest = {'music': {}, 'sfx': {}}
    for key, name in MUSIC.items():
        rel = f'music/{name}.ogg'
        cr = credit_for(credits, rel)
        if not cr:
            print('ignoré (crédits introuvables) :', rel)
            continue
        dst = os.path.join(out_music, key + '.webm')
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', os.path.join(CORE, rel), '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-ar', '48000', '-ac', '2', dst], check=True)
        manifest['music'][key] = f'audio/music/{key}.webm'
        entries.append(('music', key, name, rel, cr, os.path.getsize(dst)))
    for key, rel0 in SFX.items():
        rel = 'soundfx/' + rel0
        cr = credit_for(credits, rel)
        if not cr:
            print('ignoré (crédits introuvables) :', rel)
            continue
        dst = os.path.join(out_sfx, key + '.ogg')
        shutil.copyfile(os.path.join(CORE, rel), dst)
        manifest['sfx'][key] = f'audio/sfx/{key}.ogg'
        entries.append(('sfx', key, os.path.basename(rel0), rel, cr, os.path.getsize(dst)))

    # Données de crédits pour le jeu
    js_items = []
    for kind, key, name, rel, cr, size in entries:
        authors = [{'name': c['author'], 'url': c['authorUrl'], 'license': norm_license(c['license']), 'licenseUrl': LICENSE_URL.get(norm_license(c['license'])), 'orig': c['orig'][:1]} for c in cr]
        js_items.append({'kind': kind, 'id': key, 'file': rel, 'authors': authors})
    with open(os.path.join(ROOT, 'src', 'data', 'audioCredits.js'), 'w', encoding='utf-8') as f:
        f.write('// Généré par dev/import-audio.py : musiques et bruitages enregistrés, avec leurs auteurs et licences.\n')
        f.write('// Source : jeu libre Flare (https://github.com/flareteam/flare-game), crédits par fichier du wiki du projet.\n')
        f.write('export const AUDIO_MANIFEST = ' + json.dumps(manifest, ensure_ascii=False, indent=1) + ';\n\n')
        f.write('export const AUDIO_CREDITS = ' + json.dumps(js_items, ensure_ascii=False, indent=1) + ';\n')

    # Fichier de crédits lisible
    lines = ['# Crédits audio', '',
             'Musiques et bruitages enregistrés du jeu, issus du jeu libre **Flare** (https://github.com/flareteam/flare-game).',
             'Chaque fichier garde sa licence d’origine. Les musiques ont été réencodées en Opus (WebM) ; les bruitages sont copiés sans modification.', '',
             '## Musiques', '', '| Piste du jeu | Fichier d’origine | Auteur | Licence |', '|---|---|---|---|']
    for kind, key, name, rel, cr, size in entries:
        if kind != 'music':
            continue
        for c in cr:
            src = f"[{name}]({c['orig'][0]})" if c['orig'] else name
            who = f"[{c['author']}]({c['authorUrl']})" if c['authorUrl'] else c['author']
            lines.append(f"| {key} | {src} | {who} | [{norm_license(c['license'])}]({LICENSE_URL.get(norm_license(c['license']), '')}) |")
    lines += ['', '## Bruitages', '', '| Son du jeu | Fichier d’origine | Auteur | Licence |', '|---|---|---|---|']
    for kind, key, name, rel, cr, size in entries:
        if kind != 'sfx':
            continue
        for c in cr:
            src = f"[{name}]({c['orig'][0]})" if c['orig'] else name
            who = f"[{c['author']}]({c['authorUrl']})" if c['authorUrl'] else c['author']
            lines.append(f"| {key} | {src} | {who} | [{norm_license(c['license'])}]({LICENSE_URL.get(norm_license(c['license']), '')}) |")
    lines += ['', 'Licences : CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/), CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/), CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/). Les fichiers sous CC BY-SA restent sous cette licence ; le reste du jeu n’en est pas une adaptation.', '']
    open(os.path.join(ROOT, 'CREDITS-AUDIO.md'), 'w', encoding='utf-8').write('\n'.join(lines))
    tot_m = sum(e[5] for e in entries if e[0] == 'music')
    tot_s = sum(e[5] for e in entries if e[0] == 'sfx')
    print(f"musiques : {len(manifest['music'])} ({tot_m / 1048576:.1f} Mo), bruitages : {len(manifest['sfx'])} ({tot_s / 1048576:.1f} Mo)")


main()
