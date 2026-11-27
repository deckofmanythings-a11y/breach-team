# Anime art set: copy one raw render per token from tools/art/raw-anime/ into
# assets/tokens-anime/<id>.jpg, cropped like the painted set (tools/art/pick.py) and 256x256.
# Usage: python tools/art/pick-anime.py
# Uses PICKS (id -> seed) where set, otherwise the render with the highest seed for that id
# (re-rolls are made with a higher --seed, so the newest roll wins by default).
import os, re
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw-anime')
OUT = os.path.join(HERE, '..', '..', 'assets', 'tokens-anime')
SIZE = 256
CROP = dict(cx=0.5, cy=0.40, size=0.78)   # keep in sync with pick.py / RAW_CROP in js/render/tokens.js

PICKS = {
    'pirate_captain': 14395, 'pirate_gunner': 14314, 'mil_officer': 14070,
    'thrall_host': 14107, 'thrall_brute': 6288,
    'egg-rec_tough': 6312, 'egg-rec_dutch': 17216, 'egg-rec_trooper': 18959, 'egg-rec_wisecrack': 11217,
}
# No usable anime version (the models only ever drew a walking mech): the game falls back to the painted one.
EXCLUDE = {'sys_turret'}

best = {}
for f in os.listdir(RAW):
    m = re.match(r'(.+?)__(\d+)(?:__\w+)?\.png$', f)
    if not m: continue
    i, seed = m.group(1), int(m.group(2))
    if i in EXCLUDE or (i in PICKS and PICKS[i] != seed): continue
    if i not in best or seed > best[i][0]: best[i] = (seed, f)

os.makedirs(OUT, exist_ok=True)
for i in EXCLUDE:
    if os.path.exists(os.path.join(OUT, i + '.jpg')): os.remove(os.path.join(OUT, i + '.jpg'))
for i, (seed, f) in sorted(best.items()):
    im = Image.open(os.path.join(RAW, f)).convert('RGB')
    w, h = im.size; s = CROP['size'] * w
    x0 = CROP['cx'] * w - s / 2; y0 = max(0, CROP['cy'] * h - s / 2)
    im.crop((round(x0), round(y0), round(x0 + s), round(y0 + s))).resize((SIZE, SIZE), Image.LANCZOS) \
      .save(os.path.join(OUT, i + '.jpg'), quality=88)
print(len(best), 'anime tokens written to assets/tokens-anime/')
