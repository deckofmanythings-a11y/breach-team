# Copy the chosen raw render for each token into assets/tokens/<id>.jpg, cropped to the token
# framing (head and shoulders, slightly above centre) and downsized to 256x256.
# Usage: python tools/art/pick.py            (uses PICKS below)
# Re-run after changing a pick. Requires Pillow.
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', '..', 'assets', 'tokens')
SIZE = 256
CROP = dict(cx=0.5, cy=0.40, size=0.78)   # keep in sync with RAW_CROP in js/render/tokens.js

PICKS = {
    'soldier-assault-f': 21630, 'soldier-assault-m': 13718,
    'soldier-breacher-f': 21693, 'soldier-breacher-m': 49700,
    'soldier-heavy-f': 13487, 'soldier-heavy-m': 21413,
    'soldier-infiltrator-f': 22063, 'soldier-infiltrator-m': 42151,
    'soldier-marksman-f': 21723, 'soldier-marksman-m': 41811,
    'soldier-medic-f': 13460, 'soldier-medic-m': 29305,
    'soldier-tech-f': 13366, 'soldier-tech-m': 13373,
    'pirate_deckhand': 21477, 'pirate_cutthroat': 21649, 'pirate_gunner': 13395, 'pirate_captain': 2476,
    'corp_crew': 12964, 'corp_guard': 13062, 'corp_riot': 1977, 'corp_drone': 13067, 'corp_chief': 20961,
    'mil_marine': 28891, 'mil_heavy': 12958, 'mil_engineer': 21181, 'mil_sniper': 20993, 'mil_officer': 21070,
    'sys_turret': 84881, 'sys_drone': 9901,
}

FLOOR_PICKS = {'floor-pirates': 79270, 'floor-corpsec': 81342, 'floor-military': 71466}
FLOOR_OUT = os.path.join(HERE, '..', '..', 'assets', 'floors')

os.makedirs(OUT, exist_ok=True)
total = 0
for tid, seed in PICKS.items():
    src = Image.open(os.path.join(RAW, f'{tid}__{seed}.png')).convert('RGB')
    s = int(src.width * CROP['size'])
    x0 = int(src.width * CROP['cx'] - s / 2)
    y0 = max(0, int(src.height * CROP['cy'] - s / 2))
    out = src.crop((x0, y0, x0 + s, y0 + s)).resize((SIZE, SIZE), Image.LANCZOS)
    path = os.path.join(OUT, f'{tid}.jpg')
    out.save(path, quality=86, optimize=True)
    total += os.path.getsize(path)
print(f'{len(PICKS)} tokens written to assets/tokens ({total // 1024} KB total)')

os.makedirs(FLOOR_OUT, exist_ok=True)
ftotal = 0
for fid, seed in FLOOR_PICKS.items():   # floors: whole image, never cropped to a patch
    src = Image.open(os.path.join(RAW, f'{fid}__{seed}.png')).convert('RGB').resize((768, 768), Image.LANCZOS)
    path = os.path.join(FLOOR_OUT, f'{fid}.jpg'); src.save(path, quality=80, optimize=True); ftotal += os.path.getsize(path)
print(f'{len(FLOOR_PICKS)} floors written to assets/floors ({ftotal // 1024} KB total)')
