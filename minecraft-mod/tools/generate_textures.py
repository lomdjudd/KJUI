#!/usr/bin/env python3
"""Génère toutes les textures du mod (pixel art fait par le code).

    pip install pillow
    python3 tools/generate_textures.py            # écrit dans src/main/resources
    python3 tools/generate_textures.py --preview DOSSIER   # + aperçus 3D

Rien n'est copié d'un jeu existant : chaque pixel est dessiné ici.
"""
import math
import os
import random
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'main', 'resources')
ASSETS = os.path.join(ROOT, 'assets', 'hulkironman', 'textures')


def hexc(s, a=255):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def mul(c, f):
    return tuple(max(0, min(255, int(round(v * f)))) for v in c[:3]) + (c[3],)


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


CLEAR = (0, 0, 0, 0)


class Tex:
    """Image + aide au dessin face par face selon l'UV « boîte » de Minecraft."""

    def __init__(self, w, h, seed=1):
        self.im = Image.new('RGBA', (w, h), CLEAR)
        self.px = self.im.load()
        self.rng = random.Random(seed)

    def set(self, x, y, c):
        if 0 <= x < self.im.width and 0 <= y < self.im.height:
            self.px[x, y] = c

    def get(self, x, y):
        return self.px[x, y]

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.set(x + i, y + j, c)

    def box(self, u, v, w, h, d):
        return Box(self, u, v, w, h, d)

    def save(self, *path):
        p = os.path.join(ASSETS, *path)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        self.im.save(p)
        return p


FACES = ('top', 'bottom', 'right', 'front', 'left', 'back')


class Box:
    """Les 6 faces d'un cube texturé. right = côté -X (droite du personnage)."""

    def __init__(self, tex, u, v, w, h, d):
        self.t, self.u, self.v, self.w, self.h, self.d = tex, u, v, w, h, d

    def rect(self, face):
        u, v, w, h, d = self.u, self.v, self.w, self.h, self.d
        return {
            'top': (u + d, v, w, d),
            'bottom': (u + d + w, v, w, d),
            'right': (u, v + d, d, h),
            'front': (u + d, v + d, w, h),
            'left': (u + d + w, v + d, d, h),
            'back': (u + d + w + d, v + d, w, h),
        }[face]

    def face(self, name):
        return Face(self.t, *self.rect(name))

    def all(self, fn):
        for f in FACES:
            fn(self.face(f), f)


class Face:
    def __init__(self, tex, x, y, w, h):
        self.t, self.x, self.y, self.w, self.h = tex, x, y, w, h

    def set(self, i, j, c):
        if 0 <= i < self.w and 0 <= j < self.h:
            self.t.set(self.x + i, self.y + j, c)

    def get(self, i, j):
        return self.t.get(self.x + i, self.y + j)

    def fill(self, c, noise=0.0, rng=None):
        rng = rng or self.t.rng
        for j in range(self.h):
            for i in range(self.w):
                f = 1 + (rng.random() * 2 - 1) * noise if noise else 1
                self.set(i, j, mul(c, f))

    def vgrad(self, top, bottom, noise=0.0):
        for j in range(self.h):
            t = j / max(1, self.h - 1)
            c = mix(top, bottom, t)
            for i in range(self.w):
                f = 1 + (self.t.rng.random() * 2 - 1) * noise if noise else 1
                self.set(i, j, mul(c, f))

    def rows(self, rows, pal):
        """Dessine à partir de chaînes : chaque caractère est une clé de palette."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == ' ' or ch not in pal:
                    continue
                self.set(i, j, pal[ch])

    def border(self, c, sides='tblr'):
        for i in range(self.w):
            if 't' in sides:
                self.set(i, 0, c)
            if 'b' in sides:
                self.set(i, self.h - 1, c)
        for j in range(self.h):
            if 'l' in sides:
                self.set(0, j, c)
            if 'r' in sides:
                self.set(self.w - 1, j, c)

    def shade_edges(self, f=0.82, sides='tblr'):
        for i in range(self.w):
            for j in range(self.h):
                edge = (('t' in sides and j == 0) or ('b' in sides and j == self.h - 1)
                        or ('l' in sides and i == 0) or ('r' in sides and i == self.w - 1))
                if edge:
                    c = self.get(i, j)
                    if c[3]:
                        self.set(i, j, mul(c, f))

    def clear(self):
        for j in range(self.h):
            for i in range(self.w):
                self.set(i, j, CLEAR)


# ---------------------------------------------------------------------------
# Disposition d'un skin de joueur 64x64 (modèle large)
# ---------------------------------------------------------------------------
PLAYER = {
    'head': (0, 0, 8, 8, 8), 'hat': (32, 0, 8, 8, 8),
    'body': (16, 16, 8, 12, 4), 'jacket': (16, 32, 8, 12, 4),
    'rarm': (40, 16, 4, 12, 4), 'rsleeve': (40, 32, 4, 12, 4),
    'larm': (32, 48, 4, 12, 4), 'lsleeve': (48, 48, 4, 12, 4),
    'rleg': (0, 16, 4, 12, 4), 'rpants': (0, 32, 4, 12, 4),
    'lleg': (16, 48, 4, 12, 4), 'lpants': (0, 48, 4, 12, 4),
}


def pbox(t, name):
    return t.box(*PLAYER[name])


# ---------------------------------------------------------------------------
# HULK
# ---------------------------------------------------------------------------
G0, G1, G2, G3, G4 = hexc('2c5e1c'), hexc('3b7d27'), hexc('4c9c33'), hexc('63b844'), hexc('84d15e')
HAIR, HAIR2 = hexc('0e130f'), hexc('1f2a1f')
P0, P1, P2, P3 = hexc('2e1747'), hexc('4a2a73'), hexc('62398f'), hexc('7d52ad')
TEETH, TEETH2, MOUTH = hexc('ece7cf'), hexc('c9c2a4'), hexc('1c0d0d')
SCLERA, IRIS = hexc('d8f5c2'), hexc('3dff52')


def hulk_skin():
    t = Tex(64, 64, seed=7)
    pal = {'0': G0, '1': G1, '2': G2, '3': G3, '4': G4, 'h': HAIR, 'H': HAIR2, 's': SCLERA,
           'i': IRIS, 't': TEETH, 'T': TEETH2, 'm': MOUTH, 'p': P1, 'P': P2, 'q': P0, 'Q': P3}

    # --- tête ---
    hd = pbox(t, 'head')
    hd.face('top').fill(HAIR, 0.25)
    hd.face('bottom').fill(G1, 0.05)
    hd.face('front').rows([
        'hhHhhHhh',
        'hH1h2hHh',
        '1220022 1'[:8],
        '1si00is1',
        '12100121',
        '12033021',
        '0mtTtTm0',
        '00100100',
    ], pal)
    hd.face('front').set(7, 2, G1)
    side_rows = [
        'hhhhhHhh',
        'hhhhH221',
        'hhH22221',
        'hH201221',
        'h2200221',
        '12222221',
        '11222221',
        '01111110',
    ]
    hd.face('right').rows(side_rows, pal)
    hd.face('left').rows([r[::-1] for r in side_rows], pal)
    hd.face('back').rows([
        'hhhhhhhh',
        'hhHhhhHh',
        'hhhhHhhh',
        'hHhhhhhH',
        'Hh1hhH1h',
        '11211211',
        '12222221',
        '01111110',
    ], pal)
    # mèches qui dépassent (calque chapeau)
    hat = pbox(t, 'hat')
    hat.face('front').rows(['h  H  h ', ' h    H '], pal)
    hat.face('top').rows(['  h  H  ', ' h     h', '    h   ', 'H      h', '   h  h ', ' h      ', '      H ', '  h     '], pal)
    hat.face('right').rows(['hH h  h ', 'h   h   '], pal)
    hat.face('left').rows([' h  h Hh', '   h   h'], pal)
    hat.face('back').rows(['h hH h H', ' h   h  ', 'h  h   h'], pal)

    # --- torse ---
    bd = pbox(t, 'body')
    bd.face('top').fill(G3, 0.05)
    bd.face('bottom').fill(P1, 0.05)
    bd.face('front').rows([
        '23333332',
        '34433443',
        '34322343',
        '23211232',
        '10011001',
        '12300321',
        '12011021',
        '12300321',
        '11011011',
        '12300321',
        'qqqqqqqq',
        'pPppPpPp',
    ], pal)
    bd.face('back').rows([
        '23322332',
        '33211233',
        '32211223',
        '22210222',
        '12210221',
        '12210221',
        '11210211',
        '11210211',
        '11110111',
        '01111110',
        'qqqqqqqq',
        'pPpppPpp',
    ], pal)
    side = ['3322', '3222', '2221', '2221', '2211', '1221', '1211', '1211', '1111', '0110', 'qqqq', 'pPpp']
    bd.face('right').rows([r[::-1] for r in side], pal)
    bd.face('left').rows(side, pal)

    # --- bras ---
    arm_front = [
        '3443',
        '3333',
        '2332',
        '2342',
        '2332',
        '1221',
        '1001',
        '2232',
        '2132',
        '1221',
        '3030',
        '1111',
    ]
    arm_back = ['2332', '2222', '1221', '1221', '1221', '1111', '0110', '1221', '1211', '1111', '0110', '0000']
    arm_out = ['3433', '3332', '2332', '2321', '2221', '1221', '1011', '2221', '2121', '1211', '1010', '1111']
    for name, mirror in (('rarm', False), ('larm', True)):
        b = pbox(t, name)
        b.face('top').fill(G3, 0.05)
        b.face('bottom').rows(['1010', '1111', '1010', '0110'], pal)
        b.face('front').rows([r[::-1] if mirror else r for r in arm_front], pal)
        b.face('back').rows(arm_back, pal)
        outer, inner = ('right', 'left') if not mirror else ('left', 'right')
        b.face(outer).rows(arm_out if not mirror else [r[::-1] for r in arm_out], pal)
        b.face(inner).rows([r.replace('3', '2').replace('4', '3') for r in (arm_back)], pal)

    # --- jambes : short violet déchiré, tibias verts, pieds nus ---
    leg = [
        'pPpp',
        'pPpP',
        'ppPp',
        'qpPp',
        'pPpq',
        'ppPp',
        'p2pP',
        '2122',
        '2332',
        '2222',
        '1221',
        '0101',
    ]
    for name in ('rleg', 'lleg'):
        b = pbox(t, name)
        b.face('top').fill(P1, 0.05)
        b.face('bottom').fill(G1, 0.05)
        for f in ('front', 'right', 'left', 'back'):
            rows = leg if f != 'back' else [r.replace('3', '2') for r in leg]
            b.face(f).rows(rows, pal)
    for name in ('rpants', 'lpants'):
        b = pbox(t, name)
        for f in ('front', 'right', 'left', 'back'):
            b.face(f).rows(['', '', '', '', '', 'p  P', 'P pp', ' p  '], pal)
    return t


def hulk_glow(rage=False):
    t = Tex(64, 64, seed=8)
    hd = pbox(t, 'head')
    eye = hexc('ff3a2a') if rage else hexc('7dff6a')
    core = hexc('ffd2b0') if rage else hexc('e6ffd8')
    hd.face('front').set(2, 3, eye)
    hd.face('front').set(5, 3, eye)
    hd.face('front').set(1, 3, core if rage else CLEAR)
    hd.face('front').set(6, 3, core if rage else CLEAR)
    if rage:
        vein = hexc('2fff5a', 150)
        bd = pbox(t, 'body')
        for (i, j) in ((3, 2), (4, 3), (3, 4), (5, 6), (2, 7), (4, 8), (3, 9)):
            bd.face('front').set(i, j, vein)
        for name in ('rarm', 'larm'):
            b = pbox(t, name)
            for (i, j) in ((1, 3), (2, 4), (1, 7), (2, 8), (1, 9)):
                b.face('front').set(i, j, vein)
    return t


# ---------------------------------------------------------------------------
# IRON MAN
# ---------------------------------------------------------------------------
R0, R1, R2, R3, R4 = hexc('4f0a0a'), hexc('821313'), hexc('b01e1e'), hexc('d23b31'), hexc('ef6b5a')
Y0, Y1, Y2, Y3, Y4 = hexc('7d5a12'), hexc('b3861f'), hexc('dcae38'), hexc('f1cf68'), hexc('fff0b3')
K0, K1, K2 = hexc('1d1d22'), hexc('34343c'), hexc('5a5a66')
C1, C2, WH = hexc('59d8ff'), hexc('b5f6ff'), hexc('ffffff')


def ironman_skin():
    t = Tex(64, 64, seed=11)
    pal = {'r': R1, 'R': R2, 'S': R3, 'x': R0, '!': R4, 'y': Y1, 'Y': Y2, 'Z': Y3, 'o': Y0, '*': Y4,
           'k': K0, 'K': K1, 'L': K2, 'c': C1, 'C': C2, 'w': WH}
    hd = pbox(t, 'head')
    hd.face('top').rows(['rRRSSRRr', 'RRRSSRRR', 'RRSSSSRR', 'RRRSSRRR', 'RRRSSRRR', 'rRRSSRRr', 'rRRRRRRr', 'rrRRRRrr'], pal)
    hd.face('bottom').fill(K1)
    hd.face('front').rows([
        'RSSSSSSR',
        'rYZZZZYr',
        'rYZ**ZYr',
        'rCCyyCCr',
        'ryYYYYyr',
        'RyYZZYyR',
        'RryooyrR',
        'xRyYYyRx',
    ], pal)
    side = [
        'RRRSSRRr',
        'RRSSRRRr',
        'RRRyYyRr',
        'rRyYoYyr',
        'rRyoKoyr',
        'rRRyYyRr',
        'xrRRRRrr',
        'xxrrrrrx',
    ]
    hd.face('right').rows(side, pal)
    hd.face('left').rows([r[::-1] for r in side], pal)
    hd.face('back').rows(['RRRSSRRR', 'RRSSSSRR', 'RRRSSRRR', 'rRRxxRRr', 'rRRRRRRr', 'rrRSSRrr', 'xrRRRRrx', 'xxrrrrxx'], pal)

    bd = pbox(t, 'body')
    bd.face('top').rows(['RSSSSSSR', 'RRSSSSRR', 'rRRRRRRr', 'rrRRRRrr'], pal)
    bd.face('bottom').fill(K1)
    bd.face('front').rows([
        'RSSSSSSR',
        'SRRSSRRS',
        'RRLCCLRR',
        'RLCwwCLR',
        'RRLCCLRR',
        'rRRRRRRr',
        'RyYyyYyR',
        'RYZoZZYR',
        'RyYooYyR',
        'rYZooZYr',
        'kKKYYKKk',
        'rRRRRRRr',
    ], pal)
    bd.face('back').rows([
        'RSSRRSSR',
        'RRSRRSRR',
        'RKLRRLKR',
        'RKcRRcKR',
        'RKLRRLKR',
        'rRRxxRRr',
        'rRRxxRRr',
        'RRRxxRRR',
        'rRSRRSRr',
        'rRRRRRRr',
        'kKKKKKKk',
        'rrRRRRrr',
    ], pal)
    side = ['RSSR', 'RRSR', 'RRRr', 'rRRr', 'rRRr', 'rYYr', 'rYZr', 'rYYr', 'rYZr', 'ryyr', 'kKKk', 'rRRr']
    bd.face('right').rows(side, pal)
    bd.face('left').rows(side, pal)

    arm = [
        'RSSR',
        'SSSR',
        'RRRr',
        'YZZY',
        'yYYy',
        'yYZy',
        'KLLK',
        'RSSR',
        'RRSR',
        'rRRr',
        'kKKk',
        'RyyR',
    ]
    for name in ('rarm', 'larm'):
        b = pbox(t, name)
        b.face('top').rows(['RSSR', 'SSSR', 'RSSR', 'RRRr'], pal)
        b.face('bottom').rows(['rLLr', 'LcCL', 'LCcL', 'rLLr'], pal)
        for f in ('front', 'right', 'left', 'back'):
            rows = arm if f in ('front',) else [r.replace('Z', 'Y').replace('S', 'R') if f == 'back' else r for r in arm]
            b.face(f).rows(rows, pal)

    leg = [
        'RYYR',
        'rYZr',
        'rYZr',
        'rYYr',
        'ryyr',
        'KLLK',
        'RSSR',
        'RRSR',
        'rRSr',
        'KLLK',
        'RRRR',
        'xrrx',
    ]
    for name in ('rleg', 'lleg'):
        b = pbox(t, name)
        b.face('top').fill(K1)
        b.face('bottom').rows(['kLLk', 'LcCL', 'LCcL', 'kLLk'], pal)
        for f in ('front', 'right', 'left', 'back'):
            rows = leg if f == 'front' else [r.replace('Y', 'R').replace('Z', 'S').replace('y', 'r') for r in leg]
            b.face(f).rows(rows, pal)

    # plaques en relief sur le calque externe : visière et épaulières
    hat = pbox(t, 'hat')
    hat.face('front').rows(['        ', '        ', '        ', '        ', '        ', '        ', '        ', ' yo  oy '], pal)
    for name in ('rsleeve', 'lsleeve'):
        b = pbox(t, name)
        for f in ('front', 'right', 'left', 'back'):
            b.face(f).rows(['RSSR', 'rRRr'], pal)
        b.face('top').rows(['RSSR', 'SSSR', 'RSSR', 'RRRr'], pal)
    return t


def ironman_glow():
    t = Tex(64, 64, seed=12)
    hd = pbox(t, 'head')
    for i in (1, 2, 5, 6):
        hd.face('front').set(i, 3, C2 if i in (2, 5) else C1)
    bd = pbox(t, 'body')
    bd.face('front').rows(['', '', '  cc  ', ' cwwc ', '  cc  '], {'c': C1, 'w': WH})
    bd.face('back').rows(['', '', '', ' c    c '], {'c': hexc('59d8ff', 160)})
    for name in ('rarm', 'larm', 'rleg', 'lleg'):
        b = pbox(t, name)
        b.face('bottom').rows(['', ' cC ', ' Cc ', ''], {'c': C1, 'C': WH})
    return t


# ---------------------------------------------------------------------------
# GALACTUS (texture 128x128, doit correspondre à GalactusModel.java)
# ---------------------------------------------------------------------------
GAL_BOXES = {
    # nom: (u, v, w, h, d)
    'head': (0, 0, 8, 8, 8),
    'helmet': (32, 0, 10, 7, 10),
    'fin_r': (72, 0, 3, 9, 4),
    'fin_l': (86, 0, 3, 9, 4),
    'crest': (100, 0, 4, 4, 2),
    'body': (0, 20, 14, 14, 7),
    'belt': (42, 20, 15, 3, 8),
    'chest': (42, 34, 12, 8, 1),
    'arm_r': (0, 44, 5, 15, 6),
    'arm_l': (22, 44, 5, 15, 6),
    'pad_r': (44, 44, 7, 4, 8),
    'pad_l': (74, 44, 7, 4, 8),
    'cuff_r': (0, 90, 6, 3, 7),
    'cuff_l': (26, 90, 6, 3, 7),
    'leg_r': (0, 68, 6, 14, 6),
    'leg_l': (24, 68, 6, 14, 6),
    'boot_r': (48, 68, 7, 3, 7),
    'boot_l': (76, 68, 7, 3, 7),
}

GV0, GV1, GV2, GV3, GV4 = hexc('3f1257'), hexc('5f1f80'), hexc('8130a6'), hexc('a24ec6'), hexc('c47ae0')
GB0, GB1, GB2, GB3 = hexc('17204f'), hexc('24337a'), hexc('33489e'), hexc('4a63c2')
SK0, SK1, SK2 = hexc('8f7a83'), hexc('b6a2a6'), hexc('d4c4c2')
EYE = hexc('dffaff')


def galactus_tex():
    t = Tex(128, 128, seed=21)
    B = {k: t.box(*v) for k, v in GAL_BOXES.items()}

    def armor(face, base, hi, lo, noise=0.05):
        face.vgrad(hi, base, noise)
        face.shade_edges(0.78)

    # visage pâle, sévère
    hd = B['head']
    for f in ('right', 'left', 'back', 'top', 'bottom'):
        hd.face(f).fill(SK1, 0.04)
        hd.face(f).shade_edges(0.85)
    hd.face('front').rows([
        '22222222',
        '21122112',
        '20000002',
        '1e01102e1'[:8],
        '21100112',
        '21011012',
        '21000012',
        '11211211',
    ], {'0': SK0, '1': SK1, '2': SK2, 'e': EYE})
    hd.face('front').set(1, 3, EYE)
    hd.face('front').set(6, 3, EYE)
    hd.face('front').set(2, 3, mul(EYE, 0.8))
    hd.face('front').set(5, 3, mul(EYE, 0.8))

    # casque : face avant ouverte (le visage apparaît au travers)
    hm = B['helmet']
    for f in ('top', 'right', 'left', 'back'):
        armor(hm.face(f), GV2, GV3, GV1)
    hm.face('top').rows(['', '', '    44    ', '   4224   ', '  42  24  ', '  4    4  '], {'4': GV4, '2': GV1})
    fr = hm.face('front')
    fr.clear()
    for j in range(7):
        for i in range(10):
            if j <= 2 or i <= 1 or i >= 8:
                fr.set(i, j, GV2 if j > 0 else GV3)
    fr.rows(['3333333333', '3VVVVVVVV3', '2V0VVVV0V2'], {'3': GV3, 'V': GV2, '0': GV0, '2': GV1})
    for j in range(3, 7):
        fr.set(1, j, GV1)
        fr.set(8, j, GV1)
    bt = hm.face('bottom')
    bt.clear()
    for i in range(10):
        for j in range(10):
            if i in (0, 9) or j in (0, 9):
                bt.set(i, j, GV1)
    for name in ('fin_r', 'fin_l'):
        b = B[name]
        for f in FACES:
            armor(b.face(f), GV2, GV4, GV1)
        for f in ('front', 'back', 'right', 'left'):
            fc = b.face(f)
            for j in range(fc.h):
                fc.set(fc.w // 2, j, GV3)
    for f in FACES:
        armor(B['crest'].face(f), GV2, GV4, GV1)

    # corps : combinaison indigo + plastron violet
    bd = B['body']
    for f in FACES:
        bd.face(f).vgrad(GB2, GB1, 0.04)
        bd.face(f).shade_edges(0.8)
    fr = bd.face('front')
    for j in range(14):
        fr.set(6, j, GB1)
        fr.set(7, j, GB1)
    bk = bd.face('back')
    for j in range(2, 12):
        bk.set(6, j, GB0)
        bk.set(7, j, GB0)
    ch = B['chest']
    for f in FACES:
        ch.face(f).fill(GV2, 0.04)
    ch.face('front').rows([
        '333344443333',
        '322224422223',
        '32V2222222V3',
        '2V2V2gg2V2V2',
        '2V22VggV22V2',
        '2V222VV222V2',
        '1V2222222V21',
        '111111111111',
    ], {'3': GV3, '4': GV4, '2': GV2, 'V': GV1, '1': GV0, 'g': hexc('6ee9ff')})
    bl = B['belt']
    for f in FACES:
        bl.face(f).fill(GV1, 0.05)
        bl.face(f).shade_edges(0.75, 'tb')
    bl.face('front').rows(['333333333333333', '2V2V2Vg gV2V2V2'.replace(' ', 'g'), '111111111111111'],
                          {'3': GV3, '2': GV2, 'V': GV1, '1': GV0, 'g': GV4})

    # bras : combinaison + gants violets
    for name in ('arm_r', 'arm_l'):
        b = B[name]
        for f in FACES:
            fc = b.face(f)
            if f in ('top',):
                fc.fill(GB2, 0.04)
                continue
            if f == 'bottom':
                fc.fill(GV1, 0.05)
                continue
            for j in range(fc.h):
                c = GB2 if j < 9 else GV2
                if j >= 9:
                    c = mix(GV3, GV1, (j - 9) / 6)
                for i in range(fc.w):
                    fc.set(i, j, mul(c, 1 + (t.rng.random() - 0.5) * 0.08))
            fc.shade_edges(0.8, 'lr')
    for name in ('pad_r', 'pad_l', 'cuff_r', 'cuff_l', 'boot_r', 'boot_l'):
        for f in FACES:
            armor(B[name].face(f), GV2, GV4, GV1)
    for name in ('pad_r', 'pad_l'):
        fc = B[name].face('top')
        for i in range(fc.w):
            fc.set(i, fc.h // 2, GV4)

    # jambes : combinaison + bottes violettes
    for name in ('leg_r', 'leg_l'):
        b = B[name]
        for f in FACES:
            fc = b.face(f)
            if f == 'top':
                fc.fill(GB1)
                continue
            if f == 'bottom':
                fc.fill(GV0)
                continue
            for j in range(fc.h):
                c = GB2 if j < 7 else mix(GV3, GV1, (j - 7) / 7)
                if j == 6:
                    c = GB1
                for i in range(fc.w):
                    fc.set(i, j, mul(c, 1 + (t.rng.random() - 0.5) * 0.08))
            fc.shade_edges(0.8, 'lr')
    return t


def galactus_glow():
    t = Tex(128, 128, seed=22)
    B = {k: t.box(*v) for k, v in GAL_BOXES.items()}
    fr = B['head'].face('front')
    for i in (1, 2, 5, 6):
        fr.set(i, 3, EYE if i in (1, 6) else hexc('8ff3ff'))
    ch = B['chest'].face('front')
    for (i, j) in ((5, 3), (6, 3), (5, 4), (6, 4)):
        ch.set(i, j, hexc('8ff3ff'))
    for name in ('fin_r', 'fin_l'):
        b = B[name]
        for f in ('front', 'back', 'right', 'left'):
            fc = b.face(f)
            for j in range(fc.h):
                fc.set(fc.w // 2, j, hexc('d58cff', 200))
    bl = B['belt'].face('front')
    for i in range(6, 9):
        bl.set(i, 1, hexc('ffd7ff'))
    return t


# ---------------------------------------------------------------------------
# Objets 16x16
# ---------------------------------------------------------------------------
def item_gamma_serum():
    t = Tex(16, 16, seed=31)
    pal = {'k': hexc('3a2a1c'), 'c': hexc('8a6440'), 'C': hexc('b08454'), 'g': hexc('d7f0e6', 230),
           'G': hexc('a9cbbd', 230), 'l': hexc('39d64b'), 'L': hexc('76ff6b'), 'd': hexc('1f8f2d'),
           'w': hexc('ffffff'), 'o': hexc('1b2b22')}
    Face(t, 0, 0, 16, 16).rows([
        '                ',
        '      kkkk      ',
        '      kCck      ',
        '      kcck      ',
        '      oggo      ',
        '      ogGo      ',
        '     ogwgGo     ',
        '    oggggGGo    ',
        '   oglLLlllGo   ',
        '   olLwLllldo   ',
        '   olLLlllldo   ',
        '   ollllLlldo   ',
        '   olllllldDo   '.replace('D', 'd'),
        '    olllldddo   '[:16],
        '     oddddo     ',
        '      oooo      ',
    ], pal)
    return t


def item_arc_reactor():
    t = Tex(16, 16, seed=32)
    cx = cy = 7.5
    for y in range(16):
        for x in range(16):
            r = math.hypot(x - cx, y - cy)
            a = math.atan2(y - cy, x - cx)
            c = None
            if r < 7.6:
                c = hexc('2b2d33')
            if r < 6.8:
                c = hexc('8d939e') if (x + y) % 5 else hexc('aab0bb')
            if r < 5.6:
                c = hexc('3a3f48')
            if r < 4.7:
                seg = int(((a + math.pi) / (2 * math.pi)) * 10) % 2
                c = hexc('5fd9ff') if seg == 0 else hexc('2f8fb8')
            if r < 3.2:
                c = hexc('c9f8ff')
            if r < 1.8:
                c = hexc('ffffff')
            if c:
                t.set(x, y, c)
    return t


def item_cosmic_orb():
    t = Tex(16, 16, seed=33)
    cx = cy = 7.5
    for y in range(16):
        for x in range(16):
            r = math.hypot(x - cx, y - cy)
            if r < 7.3:
                k = r / 7.3
                a = math.atan2(y - cy, x - cx)
                swirl = 0.5 + 0.5 * math.sin(a * 2 + r * 1.3)
                c = mix(hexc('d58cff'), hexc('2a0d4d'), k)
                c = mix(c, hexc('3b6dff'), swirl * 0.35)
                t.set(x, y, c)
            if 7.3 <= r < 8.0:
                t.set(x, y, hexc('1a0630'))
    for (x, y) in ((5, 4), (4, 5), (5, 5), (10, 9), (9, 11), (11, 6)):
        t.set(x, y, hexc('ffffff') if (x, y) in ((5, 4), (4, 5)) else hexc('fff2a8'))
    return t


def item_cosmic_heart():
    t = Tex(16, 16, seed=34)
    rows = [
        '                ',
        '                ',
        '   ooo    ooo   ',
        '  oaaao  oaaao  ',
        ' oawwaaoobbaabo ',
        ' oawaaabbbbaabo ',
        ' oaaabbbbbbbbao ',
        ' oaabbbcbbbbbbo ',
        '  oabbbccbbbbo  ',
        '   oabbbcbbbo   ',
        '    oabbbbbo    ',
        '     oabbbo     ',
        '      oabo      ',
        '       oo       ',
        '                ',
        '                ',
    ]
    Face(t, 0, 0, 16, 16).rows(rows, {'o': hexc('210838'), 'a': hexc('c06cff'), 'b': hexc('7a2fd0'),
                                       'c': hexc('7ef0ff'), 'w': hexc('ffffff')})
    return t


def item_missile():
    t = Tex(16, 16, seed=35)
    # missile en diagonale (bas-gauche -> haut-droite)
    body, hi, tip, fin, fire, fire2 = hexc('9aa1ab'), hexc('d4d9e0'), hexc('d62e2e'), hexc('3a3d44'), hexc('ffb43a'), hexc('fff3a0')
    for k in range(9):
        x, y = 4 + k, 11 - k
        t.set(x, y, body)
        t.set(x + 1, y, hi)
        t.set(x, y - 1, hi if k % 2 else body)
    t.set(13, 2, tip)
    t.set(14, 1, tip)
    t.set(13, 1, tip)
    t.set(14, 2, tip)
    for (x, y) in ((3, 10), (4, 13), (2, 11), (5, 13)):
        t.set(x, y, fin)
    for (x, y, c) in ((3, 12, fire), (2, 13, fire), (1, 14, fire2), (2, 12, fire2), (3, 13, fire2)):
        t.set(x, y, c)
    return t


# ---------------------------------------------------------------------------
# Logo (aussi utilisable comme icône CurseForge)
# ---------------------------------------------------------------------------
FONT = {
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    'G': ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
}


def draw_text(im, text, x, y, scale, color, shadow=(0, 0, 0, 255)):
    px = im.load()

    def put(cx, cy, c):
        for j in range(scale):
            for i in range(scale):
                if 0 <= cx + i < im.width and 0 <= cy + j < im.height:
                    px[cx + i, cy + j] = c

    cur = x
    for ch in text:
        g = FONT[ch]
        for j, row in enumerate(g):
            for i, b in enumerate(row):
                if b == '1':
                    put(cur + i * scale + scale, y + j * scale + scale, shadow)
        for j, row in enumerate(g):
            for i, b in enumerate(row):
                if b == '1':
                    put(cur + i * scale, y + j * scale, color)
        cur += (len(g[0]) + 1) * scale
    return cur


def text_width(text, scale):
    return sum((len(FONT[c][0]) + 1) * scale for c in text) - scale


def logo(hulk, iron, gal):
    S = 256
    im = Image.new('RGBA', (S, S), (0, 0, 0, 255))
    px = im.load()
    rng = random.Random(5)
    for y in range(S):
        for x in range(S):
            k = math.hypot(x - S / 2, y - S * 0.35) / S
            c = mix(hexc('5b2a8c'), hexc('07051a'), min(1, k * 1.6))
            px[x, y] = c
    for _ in range(140):
        x, y = rng.randrange(S), rng.randrange(S)
        px[x, y] = hexc('ffffff') if rng.random() < 0.5 else hexc('b9a6ff')

    def face_of(tex, u, v, scale, ox, oy, overlay=None):
        for j in range(8):
            for i in range(8):
                c = tex.get(u + i, v + j)
                if overlay:
                    o = overlay.get(overlay_uv[0] + i, overlay_uv[1] + j)
                    if o[3]:
                        c = o
                for a in range(scale):
                    for b in range(scale):
                        im.putpixel((ox + i * scale + a, oy + j * scale + b), c)

    overlay_uv = (32, 8)
    # Galactus (visage + casque reconstruit en 10x9)
    gs = 9
    gx, gy = S // 2 - 5 * gs, 10
    hm = gal.box(*GAL_BOXES['helmet']).face('front')
    for j in range(9):
        for i in range(10):
            c = CLEAR
            if 1 <= i <= 8 and 1 <= j <= 8:
                c = gal.get(8 + i - 1, 8 + j - 1)
            if j < 7:
                hc = hm.get(i, j)
                if hc[3]:
                    c = hc
            if c[3]:
                for a in range(gs):
                    for b in range(gs):
                        im.putpixel((gx + i * gs + a, gy + j * gs + b), c)
    # Hulk et Iron Man
    hs = 10
    face_of(hulk, 8, 8, hs, 20, 112)
    face_of(iron, 8, 8, hs, S - 20 - 8 * hs, 112)
    draw_text(im, 'VS', S // 2 - text_width('VS', 4) // 2, 136, 4, hexc('ffd84a'))
    t1 = 'HULK & IRON MAN'
    draw_text(im, t1, S // 2 - text_width(t1, 2) // 2 + 1, 206, 2, hexc('ffffff'))
    t2 = 'GALACTUS'
    draw_text(im, t2, S // 2 - text_width(t2, 3) // 2, 226, 3, hexc('c47ae0'))
    return im


# ---------------------------------------------------------------------------
# Aperçu 3D (rendu isométrique logiciel) pour vérifier les textures
# ---------------------------------------------------------------------------
def rot_zyx(p, rz, ry, rx):
    x, y, z = p
    # X puis Y puis Z (équivaut à Quaternionf.rotationZYX(z, y, x) de Minecraft)
    cy_, sy_ = math.cos(rx), math.sin(rx)
    y, z = y * cy_ - z * sy_, y * sy_ + z * cy_
    c, s = math.cos(ry), math.sin(ry)
    x, z = x * c + z * s, -x * s + z * c
    c, s = math.cos(rz), math.sin(rz)
    x, y = x * c - y * s, x * s + y * c
    return (x, y, z)


def cube_faces(tex, uv, box, inflate, transform):
    u, v, w, h, d = uv
    x0, y0, z0 = box[0] - inflate, box[1] - inflate, box[2] - inflate
    x1, y1, z1 = box[0] + box[3] + inflate, box[1] + box[4] + inflate, box[2] + box[5] + inflate
    B = Box(tex, u, v, w, h, d)
    # coins (haut-gauche, haut-droit, bas-gauche) en coordonnées modèle (y vers le bas)
    corners = {
        'front': ((x0, y0, z0), (x1, y0, z0), (x0, y1, z0)),
        'back': ((x1, y0, z1), (x0, y0, z1), (x1, y1, z1)),
        'right': ((x0, y0, z1), (x0, y0, z0), (x0, y1, z1)),
        'left': ((x1, y0, z0), (x1, y0, z1), (x1, y1, z0)),
        'top': ((x0, y0, z1), (x1, y0, z1), (x0, y0, z0)),
        'bottom': ((x0, y1, z0), (x1, y1, z0), (x0, y1, z1)),
    }
    out = []
    for f, (tl, tr, bl) in corners.items():
        fx, fy, fw, fh = B.rect(f)
        tl, tr, bl = transform(tl), transform(tr), transform(bl)
        ex = [(tr[k] - tl[k]) / fw for k in range(3)]
        ey = [(bl[k] - tl[k]) / fh for k in range(3)]
        for j in range(fh):
            for i in range(fw):
                c = tex.get(fx + i, fy + j)
                if c[3] == 0:
                    continue
                p0 = [tl[k] + ex[k] * i + ey[k] * j for k in range(3)]
                quad = [p0, [p0[k] + ex[k] for k in range(3)], [p0[k] + ex[k] + ey[k] for k in range(3)], [p0[k] + ey[k] for k in range(3)]]
                out.append((quad, c, f))
    return out


def render(parts, size=360, yaw=-35, pitch=20, scale=8.0, cy=0.0, glow=None):
    from PIL import ImageDraw
    im = Image.new('RGBA', (size, size), hexc('8fb4d9'))
    dr = ImageDraw.Draw(im)
    ya, pa = math.radians(yaw), math.radians(pitch)
    light = {'top': 1.0, 'front': 0.9, 'back': 0.6, 'right': 0.75, 'left': 0.75, 'bottom': 0.5}
    polys = []
    for quads, is_glow in parts:
        for quad, c, f in quads:
            pts = []
            depth = 0
            for (x, y, z) in quad:
                # modèle (y bas, avant = -z) -> vue : x droite, y haut, z vers la caméra
                X, Y, Z = x, -y, -z
                X, Z = X * math.cos(ya) + Z * math.sin(ya), -X * math.sin(ya) + Z * math.cos(ya)
                Y, Z = Y * math.cos(pa) - Z * math.sin(pa), Y * math.sin(pa) + Z * math.cos(pa)
                pts.append((size / 2 + X * scale, size / 2 - (Y - cy) * scale))
                depth += Z
            area = (pts[1][0] - pts[0][0]) * (pts[3][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[3][0] - pts[0][0])
            if area < 0:
                continue  # face arrière
            col = c if is_glow else mul(c, light[f])
            polys.append((depth / 4 + (0.01 if is_glow else 0), pts, col))
    polys.sort(key=lambda p: p[0])
    for _, pts, col in polys:
        dr.polygon(pts, fill=col[:3] + (255,))
    return im


PLAYER_PARTS = [
    # (uv, box, pivot, inflate)
    ('head', (-4, -8, -4, 8, 8, 8), (0, 0, 0), 0), ('hat', (-4, -8, -4, 8, 8, 8), (0, 0, 0), 0.5),
    ('body', (-4, 0, -2, 8, 12, 4), (0, 0, 0), 0), ('jacket', (-4, 0, -2, 8, 12, 4), (0, 0, 0), 0.25),
    ('rarm', (-3, -2, -2, 4, 12, 4), (-5, 2, 0), 0), ('rsleeve', (-3, -2, -2, 4, 12, 4), (-5, 2, 0), 0.25),
    ('larm', (-1, -2, -2, 4, 12, 4), (5, 2, 0), 0), ('lsleeve', (-1, -2, -2, 4, 12, 4), (5, 2, 0), 0.25),
    ('rleg', (-2, 0, -2, 4, 12, 4), (-1.9, 12, 0), 0), ('rpants', (-2, 0, -2, 4, 12, 4), (-1.9, 12, 0), 0.25),
    ('lleg', (-2, 0, -2, 4, 12, 4), (1.9, 12, 0), 0), ('lpants', (-2, 0, -2, 4, 12, 4), (1.9, 12, 0), 0.25),
]


def player_preview(tex, glow=None, yaw=-35):
    parts = []
    for name, box, pivot, infl in PLAYER_PARTS:
        tr = lambda p, pv=pivot: (p[0] + pv[0], p[1] + pv[1], p[2] + pv[2])
        parts.append((cube_faces(tex, PLAYER[name], box, infl, tr), False))
        if glow is not None:
            parts.append((cube_faces(glow, PLAYER[name], box, infl + 0.01, tr), True))
    return render(parts, size=300, yaw=yaw, scale=8.0, cy=-8)


# Mêmes valeurs que GalactusModel.java : (uv, boîte, pivot, rotation, parent)
GAL_PARTS = {
    'body': ('body', (-7, -4, -3.5, 14, 14, 7), (0, 0, 0), (0, 0, 0), None),
    'belt': ('belt', (-7.5, 7, -4, 15, 3, 8), (0, 0, 0), (0, 0, 0), 'body'),
    'chest': ('chest', (-6, -3, -4.5, 12, 8, 1), (0, 0, 0), (0, 0, 0), 'body'),
    'head': ('head', (-4, -8, -4, 8, 8, 8), (0, -4, 0), (0, 0, 0), None),
    'helmet': ('helmet', (-5, -10, -5, 10, 7, 10), (0, 0, 0), (0, 0, 0), 'head'),
    'fin_r': ('fin_r', (-3, -9, -2, 3, 9, 4), (-5, -7, 0), (0, 0, -0.18), 'head'),
    'fin_l': ('fin_l', (0, -9, -2, 3, 9, 4), (5, -7, 0), (0, 0, 0.18), 'head'),
    'crest': ('crest', (-2, -12, -5.5, 4, 4, 2), (0, 0, 0), (0, 0, 0), 'head'),
    'arm_r': ('arm_r', (-3, -2, -3, 5, 15, 6), (-9.5, -2, 0), (0, 0, 0), None),
    'pad_r': ('pad_r', (-4.5, -4, -4, 7, 4, 8), (0, 0, 0), (0, 0, 0), 'arm_r'),
    'cuff_r': ('cuff_r', (-3.5, 8, -3.5, 6, 3, 7), (0, 0, 0), (0, 0, 0), 'arm_r'),
    'arm_l': ('arm_l', (-2, -2, -3, 5, 15, 6), (9.5, -2, 0), (0, 0, 0), None),
    'pad_l': ('pad_l', (-2.5, -4, -4, 7, 4, 8), (0, 0, 0), (0, 0, 0), 'arm_l'),
    'cuff_l': ('cuff_l', (-2.5, 8, -3.5, 6, 3, 7), (0, 0, 0), (0, 0, 0), 'arm_l'),
    'leg_r': ('leg_r', (-3, 0, -3, 6, 14, 6), (-3.6, 10, 0), (0, 0, 0), None),
    'boot_r': ('boot_r', (-3.5, 7, -3.5, 7, 3, 7), (0, 0, 0), (0, 0, 0), 'leg_r'),
    'leg_l': ('leg_l', (-3, 0, -3, 6, 14, 6), (3.6, 10, 0), (0, 0, 0), None),
    'boot_l': ('boot_l', (-3.5, 7, -3.5, 7, 3, 7), (0, 0, 0), (0, 0, 0), 'leg_l'),
}


def galactus_preview(tex, glow=None, yaw=-35):
    def make_tr(name):
        chain = []
        n = name
        while n:
            chain.append(GAL_PARTS[n])
            n = GAL_PARTS[n][4]

        def tr(p):
            for (_, _, pivot, rot, _) in chain:
                p = rot_zyx(p, rot[2], rot[1], rot[0])
                p = (p[0] + pivot[0], p[1] + pivot[1], p[2] + pivot[2])
            return p
        return tr

    parts = []
    for name, (uvname, box, _, _, _) in GAL_PARTS.items():
        tr = make_tr(name)
        parts.append((cube_faces(tex, GAL_BOXES[uvname], box, 0, tr), False))
        if glow is not None:
            parts.append((cube_faces(glow, GAL_BOXES[uvname], box, 0.02, tr), True))
    return render(parts, size=420, yaw=yaw, scale=8.0, cy=-2)


def main():
    preview = None
    if '--preview' in sys.argv:
        preview = sys.argv[sys.argv.index('--preview') + 1]
        os.makedirs(preview, exist_ok=True)

    hulk, iron, gal = hulk_skin(), ironman_skin(), galactus_tex()
    out = [
        hulk.save('entity', 'hero', 'hulk.png'),
        hulk_glow().save('entity', 'hero', 'hulk_glow.png'),
        hulk_glow(rage=True).save('entity', 'hero', 'hulk_rage_glow.png'),
        iron.save('entity', 'hero', 'ironman.png'),
        ironman_glow().save('entity', 'hero', 'ironman_glow.png'),
        gal.save('entity', 'galactus.png'),
        galactus_glow().save('entity', 'galactus_glow.png'),
        item_gamma_serum().save('item', 'gamma_serum.png'),
        item_arc_reactor().save('item', 'arc_reactor.png'),
        item_cosmic_orb().save('item', 'cosmic_orb.png'),
        item_cosmic_heart().save('item', 'cosmic_heart.png'),
        item_missile().save('item', 'missile.png'),
    ]
    lg = logo(hulk, iron, gal)
    lg.save(os.path.join(ROOT, 'logo.png'))
    out.append(os.path.join(ROOT, 'logo.png'))
    for p in out:
        print('écrit', os.path.relpath(p, os.path.join(ROOT, '..', '..', '..')))

    if preview:
        sheet = Image.new('RGBA', (1500, 760), hexc('8fb4d9'))
        sheet.paste(player_preview(hulk, None, -35), (0, 0))
        sheet.paste(player_preview(hulk, hulk_glow(True), 145), (300, 0))
        sheet.paste(player_preview(iron, None, -35), (600, 0))
        sheet.paste(player_preview(iron, ironman_glow(), 145), (900, 0))
        sheet.paste(galactus_preview(gal, None, -30), (0, 300))
        sheet.paste(galactus_preview(gal, galactus_glow(), 150), (420, 300))
        sheet.paste(lg, (1200, 0))
        x = 860
        for it in (item_gamma_serum(), item_arc_reactor(), item_cosmic_orb(), item_cosmic_heart(), item_missile()):
            sheet.paste(it.im.resize((96, 96), Image.NEAREST), (x, 320), it.im.resize((96, 96), Image.NEAREST))
            x += 110
        sheet.paste(hulk.im.resize((256, 256), Image.NEAREST), (860, 450))
        sheet.paste(iron.im.resize((256, 256), Image.NEAREST), (1130, 450))
        sheet.save(os.path.join(preview, 'apercu.png'))
        print('aperçu :', os.path.join(preview, 'apercu.png'))


if __name__ == '__main__':
    main()
