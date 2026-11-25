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
    # Phase 7: aliens
    'hive_drone': 101059, 'hive_spitter': 109221, 'hive_brute': 101069, 'hive_queen': 108984,
    'myc_shambler': 101270, 'myc_puffer': 108991, 'myc_stalker': 109101, 'myc_mother': 108998,
    'crys_shard': 108993, 'crys_prism': 109018, 'crys_colossus': 101435, 'crys_core': 108888,
    'void_shade': 108965, 'void_howler': 109105, 'void_reaper': 109087,
    'drift_skimmer': 101392, 'drift_lancer': 109180, 'drift_anchor': 109186, 'drift_matriarch': 109506,
    'thrall_host': 101188, 'thrall_crawler': 109413, 'thrall_brute': 139207, 'thrall_overmind': 109529,
    # Rare recruits (hidden eggs)
    'egg-rec_wisecrack': 101717, 'egg-rec_tough': 101312, 'egg-rec_warrant': 117366, 'egg-rec_mobile': 101393,
    'egg-rec_dutch': 101297, 'egg-rec_trooper': 109459, 'egg-rec_multipass': 101755,
    'egg-cyborg-f': 324902, 'egg-cyborg-m': 301152,   # hidden egg: rebuilt fallen (full-body walker, no face)
    # 0.7.0: seven more faces per specialty + sex (js/data/looks.js)
    'soldier-assault-m-1': 601812,
    'soldier-assault-f-1': 601805,
    'soldier-breacher-m-1': 609794,
    'soldier-breacher-f-1': 601868,
    'soldier-marksman-m-1': 601905,
    'soldier-marksman-f-1': 609817,
    'soldier-medic-m-1': 601561,
    'soldier-medic-f-1': 601554,
    'soldier-tech-m-1': 701467,
    'soldier-tech-f-1': 709379,
    'soldier-heavy-m-1': 601588,
    'soldier-heavy-f-1': 601581,
    'soldier-infiltrator-m-1': 602245,
    'soldier-infiltrator-f-1': 602238,
    'soldier-assault-m-2': 601813,
    'soldier-assault-f-2': 601806,
    'soldier-breacher-m-2': 801876,
    'soldier-breacher-f-2': 609788,
    'soldier-marksman-m-2': 809825,
    'soldier-marksman-f-2': 601899,
    'soldier-medic-m-2': 601562,
    'soldier-medic-f-2': 601555,
    'soldier-tech-m-2': 701468,
    'soldier-tech-f-2': 701461,
    'soldier-heavy-m-2': 709508,
    'soldier-heavy-f-2': 601582,
    'soldier-infiltrator-m-2': 610165,
    'soldier-infiltrator-f-2': 602239,
    'soldier-assault-m-3': 609733,
    'soldier-assault-f-3': 601807,
    'soldier-breacher-m-3': 601877,
    'soldier-breacher-f-3': 601870,
    'soldier-marksman-m-3': 609826,
    'soldier-marksman-f-3': 609819,
    'soldier-medic-m-3': 601563,
    'soldier-medic-f-3': 601556,
    'soldier-tech-m-3': 709388,
    'soldier-tech-f-3': 701462,
    'soldier-heavy-m-3': 601590,
    'soldier-heavy-f-3': 609502,
    'soldier-infiltrator-m-3': 602247,
    'soldier-infiltrator-f-3': 610159,
    'soldier-assault-m-4': 609734,
    'soldier-assault-f-4': 601808,
    'soldier-breacher-m-4': 601878,
    'soldier-breacher-f-4': 601871,
    'soldier-marksman-m-4': 809827,
    'soldier-marksman-f-4': 601901,
    'soldier-medic-m-4': 609483,
    'soldier-medic-f-4': 601557,
    'soldier-tech-m-4': 709389,
    'soldier-tech-f-4': 609382,
    'soldier-heavy-m-4': 601591,
    'soldier-heavy-f-4': 601584,
    'soldier-infiltrator-m-4': 602248,
    'soldier-infiltrator-f-4': 610160,
    'soldier-assault-m-5': 601816,
    'soldier-assault-f-5': 601809,
    'soldier-breacher-m-5': 609798,
    'soldier-breacher-f-5': 601872,
    'soldier-marksman-m-5': 701909,
    'soldier-marksman-f-5': 609821,
    'soldier-medic-m-5': 609484,
    'soldier-medic-f-5': 601558,
    'soldier-tech-m-5': 701471,
    'soldier-tech-f-5': 701464,
    'soldier-heavy-m-5': 601592,
    'soldier-heavy-f-5': 609504,
    'soldier-infiltrator-m-5': 602249,
    'soldier-infiltrator-f-5': 610161,
    'soldier-assault-m-6': 601817,
    'soldier-assault-f-6': 601810,
    'soldier-breacher-m-6': 701880,
    'soldier-breacher-f-6': 609792,
    'soldier-marksman-m-6': 601910,
    'soldier-marksman-f-6': 601903,
    'soldier-medic-m-6': 601566,
    'soldier-medic-f-6': 601559,
    'soldier-tech-m-6': 709391,
    'soldier-tech-f-6': 701465,
    'soldier-heavy-m-6': 609512,
    'soldier-heavy-f-6': 601586,
    'soldier-infiltrator-m-6': 602250,
    'soldier-infiltrator-f-6': 610162,
    'soldier-assault-m-7': 701818,
    'soldier-assault-f-7': 701811,
    'soldier-breacher-m-7': 709800,
    'soldier-breacher-f-7': 701874,
    'soldier-marksman-m-7': 709830,
    'soldier-marksman-f-7': 701904,
    'soldier-medic-m-7': 709486,
    'soldier-medic-f-7': 701560,
    'soldier-tech-m-7': 701473,
    'soldier-tech-f-7': 709385,
    'soldier-heavy-m-7': 709513,
    'soldier-heavy-f-7': 701587,
    'soldier-infiltrator-m-7': 702251,
    'soldier-infiltrator-f-7': 710163,
}

FLOOR_PICKS = {'floor-pirates': 79270, 'floor-corpsec': 81342, 'floor-military': 71466,
               'floor-hive': 108938, 'floor-mycelid': 109253, 'floor-lattice': 117171, 'floor-wraith': 109165, 'floor-drifters': 101458, 'floor-thrall': 109157}
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

WALL_PICKS = {'wall-pirates': 139156, 'wall-corpsec': 151228, 'wall-military': 139271, 'wall-hive': 138824, 'wall-mycelid': 139139,
              'wall-lattice': 139138, 'wall-wraith': 151132, 'wall-drifters': 177182, 'wall-thrall': 151124}
WALL_OUT = os.path.join(HERE, '..', '..', 'assets', 'walls')
os.makedirs(WALL_OUT, exist_ok=True)
wtotal = 0
for wid, seed in WALL_PICKS.items():   # walls: whole image, never cropped to a patch (same rule as floors)
    src = Image.open(os.path.join(RAW, f'{wid}__{seed}.png')).convert('RGB').resize((768, 768), Image.LANCZOS)
    path = os.path.join(WALL_OUT, f'{wid}.jpg'); src.save(path, quality=80, optimize=True); wtotal += os.path.getsize(path)
print(f'{len(WALL_PICKS)} walls written to assets/walls ({wtotal // 1024} KB total)')
