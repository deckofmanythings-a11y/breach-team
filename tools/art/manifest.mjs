// Art manifest: every token portrait the game needs, as ComfyUI prompts.
// Soldiers are painted with BRIGHT GREEN armor: the game recolors that green to each Soldier's
// chosen armor colour at runtime (see js/render/tokens.js), so one portrait serves every colour.
// Easter-egg rule applies: no real movie characters, logos or exact costumes.

export const STYLE = 'gritty painted sci-fi concept art, head and shoulders portrait bust, centered, facing the viewer, dramatic rim lighting, worn battle-scarred gear, detailed painterly brushwork, rich colour, plain dark steel bulkhead background';
// Anime art style (alternate set, assets/tokens-anime/): Illustrious-family checkpoints, tag-style.
export const ANIME_STYLE = 'masterpiece, best quality, amazing quality, anime style, anime coloring, cel shading, clean lineart, sci-fi, head and shoulders portrait, upper body, centered, facing viewer, dramatic rim lighting, detailed, simple dark steel bulkhead background';
export const ANIME_OBJECT_STYLE = 'masterpiece, best quality, anime style, cel shading, clean lineart, sci-fi, a single machine centered in frame, seen from the front, no humans, dramatic rim lighting, simple dark steel bulkhead background';
export const ANIME_SOLDIER_NEGATIVE = 'helmet, mecha, robot, mask, visor, faceless, skull, bald, text on clothes, english text, name tag, writing, green hair, green eyes, green skin, green background, emblem, insignia';
export const ANIME_NEGATIVE = 'worst quality, low quality, lowres, bad anatomy, bad hands, text, watermark, signature, logo, frame, border, letters, realistic, photorealistic, photo, 3d, nsfw, nude, cleavage, revealing clothes, chibi, multiple people, full body, cropped head, bright background, blurry';
// Turns a painted-set prompt into an anime one: "a man" / "a woman" get the solo 1boy / 1girl tags.
// Soldiers get their own tag-style prompt: the painted set's armour wording made anime models draw
// helmets and mecha, and the strong "green" leaked into hair and eyes (the game recolours green).
const ANIME_LOOK = {
  assault:     'assault trooper, carbine strap over the shoulder, determined expression',
  breacher:    'breacher, heavy chest armor, demolition charges on the chest, soot on the cheek',
  marksman:    'sniper, monocle scope over one eye, rifle barrel over the shoulder, calm expression',
  medic:       'combat medic, white cross armband, headset, gentle expression',
  tech:        'tech specialist, earpiece, holographic data pad on the forearm, focused expression',
  heavy:       'heavy gunner, broad shoulders, big shoulder pauldrons, ammunition belt across the chest, confident grin',
  infiltrator: 'stealth operative, goggles pushed up on the forehead, dark scarf around the neck, sly expression',
};
// Anime models lighten skin unless told with their own tags (looks.js ids).
const SKIN = { 1: 'dark skin, very dark skin', 3: 'dark skin', 4: 'tan skin', 5: 'tan skin', 6: 'dark skin', 7: 'dark skin' };
const HAIR = ['black', 'dark brown', 'brown', 'auburn', 'blonde', 'silver', 'navy blue', 'red', 'chestnut', 'white'];
const RARE_HAIR = { 'egg-rec_dutch': 'slicked-back dark hair', 'egg-rec_trooper': 'short messy brown hair, empty hands', 'egg-rec_wisecrack': 'messy brown hair', 'egg-rec_mobile': 'neat short hair' };
const HUMAN_ENEMY = /^(pirate_|corp_(crew|chief)|mil_officer|thrall_(host|brute))/;
const hashId = (id) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export function animePrompt(t) {
  if (t.anime) {
    const { sx, spec, who } = t.anime, look = +(t.id.match(/-(\d)$/)?.[1] || 0);
    const hair = HAIR[hashId(t.id) % HAIR.length], len = sx === 'f' ? (hashId(t.id) % 2 ? 'long' : 'short') : 'short';
    return `${sx === 'm' ? '1boy, solo, young man' : '1girl, solo, young woman'}${who ? ' ' + who : ''}, ${SKIN[look] ? SKIN[look] + ', ' : ''}${len} ${hair} hair, ${ANIME_LOOK[spec]}, ` +
      'starship soldier, olive green armor plates on the chest and shoulders, dark grey undersuit, bare head, detailed face, looking at viewer';
  }
  const p = t.prompt.replace(/^an? (man|woman)\b/, (m, w) => `${w === 'man' ? '1boy' : '1girl'}, solo, ${m}`);
  if (/no human/.test(p) || t.object) return `no humans, ${p}`;
  if (t.group === 'rare') {   // the word "helmet" in any form pulls a helmet in: drop it, name the hair instead
    const q = p.replace(SOLDIER_ARMOR, 'olive green armor plates on the chest and shoulders, dark grey undersuit')
      .replace(/, [^,]*helmet[^,]*/g, '');
    const tag = /woman/.test(t.prompt) ? '1girl, solo, ' : '1boy, solo, male focus, ';
    return `${tag}${q}${RARE_HAIR[t.id] ? ', ' + RARE_HAIR[t.id] : ''}, bare head, detailed face, visible hair`;
  }
  if (t.id === 'sys_turret') return 'no humans, still life, close-up of a sentry gun turret bolted to a metal ceiling mount, round armored gun pod, twin gun barrels pointing at the viewer, single red sensor lens, cables, mechanical object, weapon focus';
  // Human enemies: anime models turned some of them into skulls, helmets or faceless figures.
  return HUMAN_ENEMY.test(t.id) ? `${p}, human, detailed human face, anime face` : p;
}
export const NEGATIVE = 'text, watermark, signature, logo, frame, border, letters, cartoon, anime, chibi, 3d render, blurry, lowres, deformed face, extra limbs, cropped head, full body, multiple people, bright background';
// Objects (no character) use this instead of STYLE, which asks for a portrait bust.
export const OBJECT_STYLE = 'gritty painted sci-fi concept art, a single machine centered in frame, seen from the front, dramatic rim lighting, detailed painterly brushwork, rich colour, plain dark steel bulkhead background';
export const SOLDIER_ARMOR = 'bare head with the face clearly visible, no helmet, wearing chunky saturated olive green painted armor plates on the chest and shoulders, strongly green armor, plain armor with no emblems or skulls'

const SPECIALTY_LOOK = {
  assault:     'assault trooper, short cropped hair, carbine sling over the shoulder, determined look',
  breacher:    'breacher, heavy reinforced armor, demolition charges strapped to the chest, soot-smudged face',
  marksman:    'sniper, light armor and a cloak with the hood pushed back, targeting monocle over one eye, rifle scope visible over the shoulder',
  medic:       'combat medic, medical cross patch on the shoulder, headset with a small scanner, calm eyes',
  tech:        'tech specialist, glowing cyan hacking visor, cables and a data pad, cybernetic ear implant',
  heavy:       'heavy weapons trooper, massive armored shoulder pauldrons, ammunition belts across the chest, scarred face',
  infiltrator: 'stealth infiltrator, sleek matte light armor, tactical night-vision goggles on the forehead, scarf',
};
const SEX = { m: 'man', f: 'woman' };

export const TOKENS = [];
for (const [spec, look] of Object.entries(SPECIALTY_LOOK)) for (const [sx, word] of Object.entries(SEX)) {
  TOKENS.push({ id: `soldier-${spec}-${sx}`, group: 'soldier', anime: { sx, spec, who: '' }, prompt: `a ${word}, starship boarding trooper, ${look}, ${SOLDIER_ARMOR}`, negative: 'helmet, visor, face mask, gas mask, respirator, covered face' });
}
// Extra faces (js/data/looks.js): the same Soldier art in many ethnicities.
import { LOOKS } from '../../js/data/looks.js';
// The Tech's cyan visor turned the whole armor teal on new faces (breaks the recolor): tamer look for them.
const LOOK_SPEC = { ...SPECIALTY_LOOK,
  marksman: 'sniper, bare head with short hair, no hood, a targeting monocle over one eye, a long rifle over the shoulder, calm eyes',
  breacher: 'breacher, bare head with short hair, demolition charges strapped to the chest, soot-smudged face',
  tech: 'tech specialist, bare head, a small earpiece and a cable-linked data pad on the forearm, focused eyes' };
for (const L of LOOKS.slice(1)) for (const [spec, look] of Object.entries(LOOK_SPEC)) for (const [sx, word] of Object.entries(SEX)) {
  TOKENS.push({ id: `soldier-${spec}-${sx}-${L.id}`, group: 'soldier', anime: { sx, spec, who: L.prompt }, prompt: `a ${word} ${L.prompt}, starship boarding trooper, ${look}, ${SOLDIER_ARMOR}`, negative: 'helmet, visor, face mask, gas mask, respirator, covered face, green skin, hood over the head, skull' + (spec === 'tech' ? ', cyan, teal, blue armor, glowing visor' : '') + (L.id === 7 ? ', face paint, war paint, tribal markings, feathers, headdress, copper armor, bronze armor' : '') });
}

const ENEMY = {
  // Void Pirates: rust/orange, ragged, mismatched
  pirate_deckhand:  'scrappy space pirate deckhand, ragged rust-orange coat, mismatched dented helmet, grimy face, submachine gun',
  pirate_cutthroat: 'space pirate cutthroat, rust-orange scarf mask over the lower face, vibro-machete, wild eyes, ragged leather',
  pirate_gunner:    'burly space pirate with a shotgun, heavy patched rust-brown coat, bandoliers of shells, bearded',
  pirate_captain:   'swaggering space pirate captain, long rust-red coat with gold trim, ornate officer hat, cybernetic eye, sidearm',
  // Corporate Security: white + teal, clean, visors
  corp_crew:        'nervous civilian starship crew member, grey corporate jumpsuit with teal trim, headset, frightened',
  corp_guard:       'corporate security guard, clean white armor with teal stripes, smooth helmet with a dark visor, pistol',
  corp_riot:        'corporate riot officer, bulky white armor with teal markings, tall riot shield, full face visor',
  corp_drone:       'floating corporate security drone robot, white and teal shell, single glowing teal camera eye, small gun barrel, no human',
  corp_chief:       'stern corporate security chief, white and teal officer armor, short grey hair, earpiece, carbine',
  // Fleet Marines: olive + grey, squared helmets, disciplined
  mil_marine:       'disciplined fleet marine soldier, bulky olive-drab armor plates, squared helmet, battle rifle, stern',
  mil_heavy:        'heavy fleet marine, massive olive-drab power armor, squared helmet, belt-fed machine gun',
  mil_engineer:     'fleet marine combat engineer, olive armor with tool pouches, welding goggles, deployable turret kit',
  mil_sniper:       'fleet marine sniper, olive camouflage ghillie hood, long rifle, steady eyes',
  mil_officer:      'fleet marine lieutenant, olive officer armor with rank insignia, peaked cap, scar across the cheek',
  // Ship systems
  sys_turret:       'automated ceiling-mounted starship defense gun turret machine, twin cannon barrels pointing at the viewer, armored grey housing, single red sensor light, a mechanical weapon device only',
  sys_drone:        'small friendly hovering combat drone robot, four rotors, cyan running lights, compact gun, no human',
};
for (const [id, p] of Object.entries(ENEMY)) TOKENS.push({ id, group: id.startsWith('sys_') ? 'system' : 'enemy', prompt: p, negative: id === 'sys_turret' ? 'robot, humanoid, android, face, head, person, mech, shoulders, torso' : '', object: id === 'sys_turret' });

export const TOKEN_BY_ID = Object.fromEntries(TOKENS.map(t => [t.id, t]));

// Ship floors: ONE whole image per faction's ship, laid across the entire floor once (never tiled).
export const FLOOR_STYLE = 'top-down orthographic view looking straight down at a starship deck floor, flat even lighting, no perspective, painted sci-fi concept art texture, detailed, filling the whole frame';
export const FLOORS = [
  { id: 'floor-pirates',  prompt: 'rusty patched metal deck plates, welded seams, grime, oil stains, scattered bolts, worn orange hazard paint' },
  { id: 'floor-corpsec',  prompt: 'flat material texture swatch seen from directly overhead, square clean pale grey composite floor panels with thin teal seam lines, a few scuffs, corporate' },
  { id: 'floor-military', prompt: 'olive grey steel deck plating, anti-slip diamond tread panels, stencilled markings, scuffed military' },
];
for (const f of FLOORS) TOKENS.push({ ...f, group: 'floor', floor: true, negative: 'people, person, character, furniture, walls, perspective, horizon, corridor, hallway, vanishing point, ceiling, doorway, text, letters, numbers' });

// ---- Phase 7: alien units (creatures: no humans unless they are hosts), alien floors, rare recruits ----
const ALIEN = {
  hive_drone:      'insectoid alien hive drone creature, glistening black chitin, elongated eyeless skull, dripping jaws, purple bioluminescent veins, no human',
  hive_spitter:    'insectoid alien acid spitter creature, black chitin, swollen glowing purple throat sac, dripping acid, no human',
  hive_brute:      'massive armored insectoid alien brute, thick black carapace plates, huge crushing mandibles, purple glow, no human',
  hive_queen:      'enormous insectoid alien queen, towering crested skull crown, black chitin, many teeth, regal and terrifying, purple glow, no human',
  myc_shambler:    'fungus-infested dead starship crewman, pale grey fungal growths bursting from the face, milky eyes, tattered jumpsuit, horror',
  myc_puffer:      'bulbous pale fungal spore sac growth on a ship bulkhead, glowing green spores drifting out, no human, no face',
  myc_stalker:     'lean fungal horror creature with long limbs, grey-white mycelium skin, glowing green gills, no eyes',
  myc_mother:      'gigantic pulsing fungal mother mass with a vaguely human face sunk in it, glowing green spore clouds, horror',
  crys_shard:      'crystalline alien construct, translucent violet-blue crystal body, glowing core in the chest, angular faceted head, no human',
  crys_prism:      'crystalline alien prism construct, floating faceted crystal shell refracting rainbow light, shimmering shield aura, no human',
  crys_colossus:   'huge crystalline alien colossus, massive violet crystal shoulders, glowing cracks, faceted fists, no human',
  crys_core:       'enormous crystalline alien intelligence core, a giant faceted violet crystal heart radiating light beams, no human, no face',
  void_shade:      'shadowy wraith creature made of black smoke and tattered cloth, pale glowing white eyes, long claws, no human face',
  void_howler:     'screaming void wraith, distorted gaping mouth, black smoke body, pale eyes, sound distortion rings, no human',
  void_reaper:     'towering void reaper horror, skeletal black silhouette wreathed in smoke, scythe-like arm blades, cold white eyes',
  drift_skimmer:   'tall thin grey-skinned alien humanoid, large dark eyes, flowing pressure suit, glowing blue facial markings, compact gun',
  drift_lancer:    'tall slender grey-skinned alien sniper, long braided headdress, glowing blue markings, long rifle',
  drift_anchor:    'stocky armored grey-skinned alien with magnetic boots and heavy machine gun, glowing blue markings, sturdy',
  drift_matriarch: 'regal tall grey-skinned alien matriarch, ornate flowing robes, crown of glowing blue markings, wise and imperious',
  thrall_host:     'possessed human starship crewman, pale veiny skin, blank eyes, glowing green parasite clamped on the neck, pistol',
  thrall_crawler:  'small fast parasitic alien crawler, many spindly legs, glistening pale body, glowing green sacs, no human',
  thrall_brute:    'hulking possessed human with sickly pale grey skin and dark bulging veins, tattered security uniform, glowing green parasite clamped on the back of the neck, shotgun, blank white eyes',
  thrall_overmind: 'enormous pulsing parasite overmind brain creature, translucent skull, glowing green veins and tendrils, no human body',
};
for (const [id, p] of Object.entries(ALIEN)) TOKENS.push({ id, group: 'alien', prompt: p, negative: /no human/.test(p) ? 'human, person, man, woman, soldier, helmet' : id === 'thrall_brute' ? 'green skin, green-skinned, hulk, superhero' : '', object: id === 'myc_puffer' || id === 'crys_core' });
const ALIEN_FLOORS = {
  'floor-hive':     'organic resin-coated deck floor, black glossy chitin plates, purple glowing veins, sticky secretions',
  'floor-mycelid':  'derelict deck plates overgrown with pale grey fungus and spores, cracked metal, faint green glow',
  'floor-lattice':  'floor of polished violet-blue crystal tiles, faceted, glowing seams of light',
  'floor-wraith':   'pitch black scorched deck plating, burn marks, faint scratches, almost no light',
  'floor-drifters': 'smooth pale grey alien deck with flowing curved panels and soft blue light lines',
  'floor-thrall':   'passenger liner carpet and metal deck smeared with glowing green ichor, debris',
};
for (const [id, p] of Object.entries(ALIEN_FLOORS)) TOKENS.push({ id, prompt: `flat material texture swatch seen from directly overhead, ${p}`, group: 'floor', floor: true, negative: 'people, person, character, furniture, walls, perspective, horizon, corridor, hallway, vanishing point, ceiling, doorway, text, letters, numbers' });
// Ship walls: ONE whole image per faction, laid across every wall tile once (never tiled), like the floors.
export const WALL_STYLE = 'flat material texture swatch seen from directly overhead, the top surface of thick starship bulkhead walls, heavy armour plating, chunky raised panels, deep seams, rivets and conduits, flat even lighting, no perspective, painted sci-fi concept art texture, detailed, filling the whole frame';
const WALLS = {
  'wall-pirates':  'mismatched rusty scrap-metal plates bolted and welded together, dented, chipped red and orange paint, grime',
  'wall-corpsec':  'flat grid of square clean white and light grey armour plates with thin teal seams, flat surface, corporate',
  'wall-military': 'dark gunmetal armour plates, heavy rivets, yellow and black hazard stripes, stencilled numbers',
  'wall-hive':     'black glossy organic chitin ridges and resin, purple glowing veins, alien hive growth',
  'wall-mycelid':  'corroded bulkhead plates smothered in thick pale fungus, shelf mushrooms, faint green glow',
  'wall-lattice':  'dense cluster of faceted violet and blue crystal blocks, glowing light inside',
  'wall-wraith':   'flat grid of jet black hexagonal armour plates with faint thin red glowing seams, flat surface, sinister',
  'wall-drifters': 'flat grid of smooth pearl white rounded alien armour tiles with thin soft blue glowing seams, flat surface',
  'wall-thrall':   'flat brass-trimmed metal plates and cracked wood veneer panels splattered with glowing green ichor',
};
for (const [id, prompt] of Object.entries(WALLS)) TOKENS.push({ id, prompt, group: 'floor', floor: true, wall: true, negative: 'people, person, character, furniture, perspective, horizon, corridor, hallway, vanishing point, ceiling, doorway, floor, text, letters, numbers, window, tunnel, room, interior, lights, robot, mech, armor suit, torso, face' });
// Rare recruits (hidden eggs): ORIGINAL faces with costume nods only, never a real actor's likeness.
const RARE = {
  'egg-rec_wisecrack': 'a wisecracking young man, nervous lopsided grin, sweaty face, tech headset, starship boarding trooper',
  'egg-rec_tough':     'a tough muscular woman with very short dark hair and a red bandana headband, defiant smirk, starship boarding trooper',
  'egg-rec_warrant':   'a determined woman with short curly brown hair, grime on her cheek, steely gaze, starship boarding trooper',
  'egg-rec_mobile':    'an eager square-jawed young man with neat short hair, earnest determined look, starship boarding trooper',
  'egg-rec_dutch':     'a huge muscular veteran commando man, slicked-back hair, camouflage face paint, an unlit cigar in his mouth, starship boarding trooper',
  'egg-rec_trooper':   'a bored young man holding a white helmet under his arm, slightly lost expression, starship boarding trooper',
  'egg-rec_multipass': 'a rugged middle-aged man with short bleached blond hair, orange tank top under the armor, wry smirk, starship boarding trooper',
};
for (const [id, p] of Object.entries(RARE)) TOKENS.push({ id, group: 'rare', prompt: `${p}, ${SOLDIER_ARMOR}`, negative: 'helmet on head, visor, face mask, gas mask, respirator, covered face, celebrity' });
// Hidden egg (js/game/cyborg.js): a fallen Soldier rebuilt as a walking life-support sarcophagus machine.
// The armor is painted green like every Soldier so it takes the fallen Soldier's own colours.
// User's pick: a full-body walker, no visible face (the sarcophagus keeps whoever is inside out of sight).
const CYBORG = 'front view of a towering boxy armored war-machine walker, no head, its chest is an armored coffin-like sarcophagus with a small rectangular glass window at the top, behind the glass the pale grey-white human face of a {who} with closed sunken eyes floating in murky fluid, breathing tubes and cables, massive mechanical shoulders and piston arms, hull plates painted saturated olive green, strongly green metal armor, oil-stained, battle-scarred, no emblems or skulls';
for (const [sx, who] of Object.entries({ m: 'man', f: 'woman' })) TOKENS.push({ id: `egg-cyborg-${sx}`, group: 'rare', object: true, prompt: CYBORG.replace('{who}', who), negative: 'green skin, orc, goblin, ogre, monster face, zombie, fangs, teeth, alien, helmet, head on top, celebrity, skull emblem, logo, cute, window light, daylight' });
// M6: the player's own Mothership ("clean command ship": dark slate, crisp white markings, cyan light strips).
TOKENS.push({ id: 'floor-mothership', prompt: 'flat material texture swatch seen from directly overhead, dark slate grey composite deck panels in a neat grid, crisp thin white guide markings and chevrons, narrow cyan glowing light strips along some seams, clean, sleek, professional naval command ship', group: 'floor', floor: true, negative: 'people, person, character, furniture, walls, perspective, horizon, corridor, hallway, vanishing point, ceiling, doorway, text, letters, numbers, rust, grime' });
TOKENS.push({ id: 'wall-mothership', prompt: 'flat grid of square matte white ceramic armour tiles with thin dark grey gaps and small cyan glowing indicator dots, flat surface, clean, sleek, military vehicle hull plating', group: 'floor', floor: true, wall: true, negative: 'people, person, character, furniture, perspective, horizon, corridor, hallway, vanishing point, ceiling, doorway, floor, text, letters, numbers, window, tunnel, room, interior, lights, robot, mech, armor suit, torso, face, rust, grime' });
