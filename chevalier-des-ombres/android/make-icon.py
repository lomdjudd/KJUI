# Génère l'icône du jeu : heaume cornu aux yeux rouges sur fond violet (mipmaps Android).
import math, os
from PIL import Image, ImageDraw, ImageFilter

S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
# Fond : carré arrondi, dégradé radial violet
bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
px = bg.load()
for y in range(S):
    for x in range(S):
        d = math.hypot(x - S * 0.5, y - S * 0.42) / (S * 0.7)
        k = max(0.0, 1 - d)
        r = int(10 + 70 * k ** 1.6)
        g = int(4 + 20 * k ** 2)
        b = int(18 + 120 * k ** 1.5)
        px[x, y] = (r, g, b, 255)
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
img.paste(bg, (0, 0), mask)
d = ImageDraw.Draw(img)
cx = S / 2
# Lueur verte (brume) en bas
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([S * 0.12, S * 0.72, S * 0.88, S * 1.05], fill=(40, 255, 150, 90))
glow = glow.filter(ImageFilter.GaussianBlur(S * 0.06))
img = Image.alpha_composite(img, Image.composite(glow, Image.new('RGBA', (S, S)), mask))
d = ImageDraw.Draw(img)
armor = (74, 58, 110, 255)
dark = (30, 22, 48, 255)
light = (140, 118, 190, 255)
# Cornes : partent des tempes, s'écartent puis remontent en s'affinant
def horn(sign):
    n = 30
    outer, inner = [], []
    for i in range(n):
        t = i / (n - 1)
        x = cx + sign * (S * 0.16 + math.sin(t * math.pi * 0.5) * S * 0.2 + t * t * S * 0.02)
        y = S * 0.47 - (t ** 1.4) * S * 0.36 + math.sin(t * math.pi) * S * 0.02
        w = S * 0.075 * (1 - t) ** 1.2 + S * 0.004
        # normale approximative (perpendiculaire à la direction)
        nx, ny = (0.85 - t * 0.6), (0.5 + t * 0.4)
        l = math.hypot(nx, ny)
        nx, ny = nx / l, ny / l
        outer.append((x + sign * nx * w, y + ny * w * 0.3 - w * 0.6))
        inner.append((x - sign * nx * w, y - ny * w * 0.3 + w * 0.6))
    d.polygon(outer + list(reversed(inner)), fill=armor, outline=dark)
    # reflet
    d.line([(x0 + sign * 2, y0 - 6) for x0, y0 in outer[2:n - 4]], fill=light, width=6)
horn(1)
horn(-1)
# Heaume
d.ellipse([cx - S * 0.2, S * 0.3, cx + S * 0.2, S * 0.74], fill=armor, outline=dark, width=6)
d.polygon([(cx - S * 0.2, S * 0.52), (cx + S * 0.2, S * 0.52), (cx + S * 0.13, S * 0.8), (cx, S * 0.86), (cx - S * 0.13, S * 0.8)], fill=armor, outline=dark)
# Arête centrale et reflet
d.polygon([(cx, S * 0.3), (cx + S * 0.025, S * 0.55), (cx, S * 0.84), (cx - S * 0.025, S * 0.55)], fill=light)
d.arc([cx - S * 0.18, S * 0.32, cx + S * 0.18, S * 0.72], 200, 250, fill=(200, 185, 240, 255), width=8)
# Visière
d.polygon([(cx - S * 0.17, S * 0.53), (cx - S * 0.04, S * 0.58), (cx + S * 0.04, S * 0.58), (cx + S * 0.17, S * 0.53), (cx + S * 0.15, S * 0.6), (cx - S * 0.15, S * 0.6)], fill=(8, 4, 12, 255))
# Yeux rouges lumineux
eyes = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ed = ImageDraw.Draw(eyes)
for sx in (-1, 1):
    ex = cx + sx * S * 0.085
    ed.ellipse([ex - S * 0.04, S * 0.545, ex + S * 0.04, S * 0.59], fill=(255, 40, 30, 255))
eg = eyes.filter(ImageFilter.GaussianBlur(S * 0.025))
img = Image.alpha_composite(img, eg)
img = Image.alpha_composite(img, eg)
img = Image.alpha_composite(img, eyes)
d = ImageDraw.Draw(img)
# Cadre doré
d.rounded_rectangle([S * 0.03, S * 0.03, S * 0.97, S * 0.97], radius=int(S * 0.2), outline=(200, 164, 90, 255), width=int(S * 0.018))
out = os.path.dirname(os.path.abspath(__file__))
sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for k, v in sizes.items():
    p = os.path.join(out, 'res', 'mipmap-' + k)
    os.makedirs(p, exist_ok=True)
    img.resize((v, v), Image.LANCZOS).save(os.path.join(p, 'ic_launcher.png'))
img.resize((512, 512), Image.LANCZOS).save(os.path.join(out, 'icon-512.png'))
print('icône générée')
