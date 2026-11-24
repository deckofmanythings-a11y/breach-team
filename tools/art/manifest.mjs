// Art manifest: every token portrait the game needs, as ComfyUI prompts.
// Soldiers are painted with BRIGHT GREEN armor: the game recolors that green to each Soldier's
// chosen armor colour at runtime (see js/render/tokens.js), so one portrait serves every colour.
// Easter-egg rule applies: no real movie characters, logos or exact costumes.

export const STYLE = 'gritty painted sci-fi concept art, head and shoulders portrait bust, centered, facing the viewer, dramatic rim lighting, worn battle-scarred gear, detailed painterly brushwork, rich colour, plain dark steel bulkhead background';
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
  TOKENS.push({ id: `soldier-${spec}-${sx}`, group: 'soldier', prompt: `a ${word}, starship boarding trooper, ${look}, ${SOLDIER_ARMOR}`, negative: 'helmet, visor, face mask, gas mask, respirator, covered face' });
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
