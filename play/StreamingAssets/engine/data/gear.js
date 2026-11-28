// Equipment: rarity tiers, weapon types, base items and affixes.
// An item INSTANCE (stored in bp_ tables, rolled server-side) looks like:
//   { uid, base: 'rifle_std', rarity: 'prototype', affixes: [{ id: 'hollow_point', tier: 2 }] }
// Its stats = base stats scaled by rarity.mult (floor), plus its affixes' values for that tier.

export const SLOTS = ['weapon', 'armor', 'utility', 'implant'];

// weight = drop weight per 1000 rolls in an unboosted pack. affixes = how many it rolls.
// tier = index into each affix's value table (0-based). alienOnly: never from packs or store.
export const RARITIES = [
  { id: 'standard',  name: 'Standard',  color: '#9aa4ad', weight: 600, mult: 100, affixes: 0, tier: 0 },
  { id: 'milspec',   name: 'Mil-Spec',  color: '#4fa3ff', weight: 270, mult: 110, affixes: 1, tier: 0 },
  { id: 'prototype', name: 'Prototype', color: '#b26bff', weight: 100, mult: 122, affixes: 1, tier: 1 },
  { id: 'relic',     name: 'Relic',     color: '#ffb02e', weight: 30,  mult: 135, affixes: 2, tier: 2 },
  { id: 'xeno',      name: 'Xeno',      color: '#3dffb5', weight: 0,   mult: 150, affixes: 2, tier: 3, alienOnly: true },
];
export const RARITY_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r]));
export const RARITY_ORDER = RARITIES.map(r => r.id);

// Weapon types. dmg = [min, max] per shot. range = optimal tiles. falloff = hit% lost per tile past range.
// acc = flat hit bonus. rof = ticks between shots (lower = faster). noise 0-3 (alerts the ship).
export const WEAPON_TYPES = {
  pistol:  { name: 'Pistol',         dmg: [8, 12],  range: 5,  falloff: 6,   acc: 5,  rof: 10, pierce: 0, crit: 5,  noise: 1 },
  smg:     { name: 'SMG',            dmg: [5, 8],   range: 4,  falloff: 8,   acc: 0,  rof: 5,  pierce: 0, crit: 3,  noise: 2 },
  carbine: { name: 'Carbine',        dmg: [9, 13],  range: 6,  falloff: 5,   acc: 5,  rof: 8,  pierce: 0, crit: 5,  noise: 2 },
  rifle:   { name: 'Rifle',          dmg: [12, 17], range: 8,  falloff: 4,   acc: 8,  rof: 11, pierce: 1, crit: 8,  noise: 2 },
  shotgun: { name: 'Shotgun',        dmg: [18, 28], range: 3,  falloff: 15,  acc: 10, rof: 16, pierce: 0, crit: 5,  noise: 3 },
  sniper:  { name: 'Sniper Rifle',   dmg: [28, 40], range: 14, falloff: 2,   acc: 15, rof: 28, pierce: 3, crit: 15, noise: 3 },
  lmg:     { name: 'Machine Gun',    dmg: [7, 10],  range: 7,  falloff: 5,   acc: -5, rof: 5,  pierce: 1, crit: 3,  noise: 3, suppress: true },
  flamer:  { name: 'Flamer',         dmg: [6, 9],   range: 3,  falloff: 25,  acc: 25, rof: 5,  pierce: 5, crit: 0,  noise: 2, splash: 1 },
  blade:   { name: 'Blade',          dmg: [20, 28], range: 1,  falloff: 100, acc: 15, rof: 10, pierce: 2, crit: 15, noise: 0, melee: true },
  arc:     { name: 'Arc Projector',  dmg: [10, 14], range: 5,  falloff: 6,   acc: 10, rof: 12, pierce: 4, crit: 3,  noise: 1, chain: 1, vs: { synthetic: 30 } },
  // Alien natural weapons (enemy-only items below).
  claws:   { name: 'Claws',          dmg: [11, 16], range: 1,  falloff: 100, acc: 15, rof: 9,  pierce: 2, crit: 10, noise: 0, melee: true },
  spit:    { name: 'Acid Spit',      dmg: [8, 12],  range: 6,  falloff: 6,   acc: 5,  rof: 12, pierce: 4, crit: 3,  noise: 0 },
  beam:    { name: 'Crystal Beam',   dmg: [10, 15], range: 8,  falloff: 3,   acc: 10, rof: 12, pierce: 2, crit: 5,  noise: 1 },
  scream:  { name: 'Psychic Scream', dmg: [4, 7],   range: 6,  falloff: 8,   acc: 15, rof: 10, pierce: 10, crit: 0, noise: 2, suppress: true },
};

// Base items. Weapons inherit their type's profile; `mods` add on top. Armor/utility/implant use mods only.
// egg: id in easter-eggs.js (these are homages - fixed rarity, never named after the real thing).
// rarity: fixed rarity (egg/special items). Otherwise the rarity is rolled.
export const ITEMS = [
  // ---- Weapons: standard issue (rolled rarity) ----
  { id: 'pistol_std',  slot: 'weapon', type: 'pistol',  name: 'Service Pistol',        mods: {} },
  { id: 'smg_std',     slot: 'weapon', type: 'smg',     name: 'Boarding SMG',          mods: {} },
  { id: 'carbine_std', slot: 'weapon', type: 'carbine', name: 'Compact Carbine',       mods: {} },
  { id: 'rifle_std',   slot: 'weapon', type: 'rifle',   name: 'Battle Rifle',          mods: {} },
  { id: 'shotgun_std', slot: 'weapon', type: 'shotgun', name: 'Breaching Shotgun',     mods: {} },
  { id: 'sniper_std',  slot: 'weapon', type: 'sniper',  name: 'Longshot Rifle',        mods: {} },
  { id: 'lmg_std',     slot: 'weapon', type: 'lmg',     name: 'Squad Machine Gun',     mods: {} },
  { id: 'flamer_std',  slot: 'weapon', type: 'flamer',  name: 'Incinerator Unit',      mods: {} },
  { id: 'blade_std',   slot: 'weapon', type: 'blade',   name: 'Vibro-Machete',         mods: {} },
  { id: 'arc_std',     slot: 'weapon', type: 'arc',     name: 'Arc Projector',         mods: {} },

  // ---- Weapons: homage specials (fixed rarity) ----
  { id: 'pulse_rifle',     slot: 'weapon', type: 'rifle',   name: 'Mk.41 Pulse Rifle',             rarity: 'relic',     egg: 'pulse_rifle',
    mods: { rofPct: 20, dmgVs: { xeno: 15 } }, flavor: 'Ten millimeter, explosive tip, caseless. Comes with a little ammo counter.' },
  { id: 'smartgun',        slot: 'weapon', type: 'lmg',     name: 'Harness Smartgun',              rarity: 'relic',     egg: 'smartgun',
    mods: { aim: 15, suppressPct: 25 }, flavor: 'Gyro-stabilised. Tracks targets for you. Do not let the pretty boy carry it.' },
  { id: 'plasma_40w',      slot: 'weapon', type: 'rifle',   name: '40-Watt Phased Plasma Rifle',   rarity: 'prototype', egg: 'plasma_40w',
    mods: { pierce: 3, dmgPct: 10 }, flavor: 'The shop only had it in the 40-watt range.' },
  { id: 'citizen_rifle',   slot: 'weapon', type: 'carbine', name: 'MR-1 "Citizen" Rifle',          rarity: 'milspec',   egg: 'citizen_rifle',
    mods: { dmgVs: { bug: 20 } }, flavor: 'Service guarantees citizenship. Would you like to know more?' },
  { id: 'hand_blaster',    slot: 'weapon', type: 'pistol',  name: "Smuggler's Hand Blaster",       rarity: 'relic',     egg: 'hand_blaster',
    mods: { dmgPct: 30, critPct: 10 }, flavor: 'Always shoots first.' },
  { id: 'detective_cannon',slot: 'weapon', type: 'pistol',  name: "Detective's Hand Cannon",       rarity: 'prototype', egg: 'detective_cannon',
    mods: { dmgPct: 25, dmgVs: { synthetic: 20 } }, flavor: 'Standard issue for retiring things that look human.' },
  { id: 'red_button',      slot: 'weapon', type: 'rifle',   name: 'ZF-Multi Rifle',                rarity: 'relic',     egg: 'red_button',
    mods: { dmgPct: 20, aim: -10 }, flavor: 'Six weapon modes. Whatever you do, do not press the little red button.' },
  { id: 'hum_blade',       slot: 'weapon', type: 'blade',   name: 'Hum-Blade',                     rarity: 'xeno',      egg: 'hum_blade',
    mods: { pierce: 10, critPct: 10 }, flavor: 'An elegant weapon for a more civilized boarding action.' },
  { id: 'phase_pistol',    slot: 'weapon', type: 'pistol',  name: 'Phase Pistol (Set to Stun)',    rarity: 'milspec',   egg: 'phase_pistol',
    mods: { suppressPct: 20 }, flavor: 'Somebody keeps forgetting to switch it off stun.' },
  { id: 'plasma_caster',   slot: 'weapon', type: 'arc',     name: 'Shoulder Plasma Caster',        rarity: 'xeno',      egg: 'plasma_caster',
    mods: { aim: 20, dmgPct: 20 }, flavor: 'Comes with three little red dots. Found on a very big, very ugly hunter.' },

  // ---- Enemy-only natural weapons (never in packs, the Store or the Armory) ----
  { id: 'xeno_claws',   slot: 'weapon', type: 'claws',  name: 'Claws',          rarity: 'standard', enemyOnly: true, mods: {} },
  { id: 'acid_spit',    slot: 'weapon', type: 'spit',   name: 'Acid Spit',      rarity: 'standard', enemyOnly: true, mods: {} },
  { id: 'crystal_beam', slot: 'weapon', type: 'beam',   name: 'Crystal Beam',   rarity: 'standard', enemyOnly: true, mods: {} },
  { id: 'void_scream',  slot: 'weapon', type: 'scream', name: 'Psychic Scream', rarity: 'standard', enemyOnly: true, mods: {} },

  // ---- Armor ----
  { id: 'armor_light',  slot: 'armor', name: 'Flak Vest',            mods: { arm: 8 } },
  { id: 'armor_medium', slot: 'armor', name: 'Boarding Armor',       mods: { arm: 15, spd: -3 } },
  { id: 'armor_heavy',  slot: 'armor', name: 'Assault Plate',        mods: { arm: 25, spd: -8, stl: -10 } },
  { id: 'armor_stealth',slot: 'armor', name: 'Shadow Weave',         mods: { arm: 5, stl: 15 } },
  { id: 'white_armor',  slot: 'armor', name: 'Imperial-Surplus White Armor', rarity: 'milspec', egg: 'white_armor',
    mods: { arm: 22, aim: -15 }, flavor: 'Great protection. The helmet visor makes it very hard to hit anything.' },
  { id: 'loader_frame', slot: 'armor', name: 'Cargo Loader Exoframe', rarity: 'relic', egg: 'loader_frame',
    mods: { arm: 35, hp: 40, spd: -15, dmgVs: { leader: 20 } }, flavor: 'Get away from her, you...' },
  { id: 'shield_belt',  slot: 'armor', name: 'Personal Shield Belt', rarity: 'prototype', egg: 'shield_belt',
    mods: { arm: 30, spd: -2 }, flag: 'slowBladeWeak', flavor: 'Stops fast projectiles. The slow blade penetrates the shield.' },

  // ---- Utility ----
  { id: 'medkit',        slot: 'utility', name: 'Trauma Kit',          mods: { healPct: 15, reviveChance: 10 } },
  { id: 'frag_grenades', slot: 'utility', name: 'Frag Grenades',       mods: { dmgPct: 5 }, flag: 'grenade' },
  { id: 'smoke_grenades',slot: 'utility', name: 'Smoke Grenades',      mods: { coverPct: 20 }, flag: 'smoke' },
  { id: 'hack_rig',      slot: 'utility', name: 'Hacking Rig',         mods: { tech: 10, hackSpeedPct: 25 } },
  { id: 'breach_kit',    slot: 'utility', name: 'Breaching Kit',       mods: { breachSpeedPct: 30 } },
  { id: 'motion_tracker',slot: 'utility', name: 'Motion Tracker',      rarity: 'prototype', egg: 'motion_tracker',
    mods: { detectPct: 40 }, flag: 'tracker', flavor: 'Beep. Beep. Beep-beep-beep. It reads solid. They are in the room.' },
  { id: 'ships_cat',     slot: 'utility', name: "Ship's Cat",         rarity: 'relic', egg: 'loot_cat', hidden: true,
    mods: { grit: 15, hazardResistPct: 10 }, flavor: 'A ginger cat in a carry crate. It hisses at ventilation shafts, which is honestly useful.' },
  { id: 'hyper_towel',   slot: 'utility', name: 'Hyperspace Towel',    rarity: 'relic', egg: 'towel',
    mods: { grit: 25, hazardResistPct: 25 }, flavor: 'Massively useful. A Soldier who knows where theirs is, is a Soldier to be reckoned with.' },

  // ---- Implants ----
  // Hidden + built-in: fused to the cyborg that comes with it (js/game/cyborg.js). Never rolled, sold or moved.
  { id: 'sarcophagus_chassis', slot: 'implant', name: 'Life-Support Sarcophagus', rarity: 'relic', hidden: true, builtin: true,
    mods: { hp: 40, arm: 20, grit: 20, dmgPct: 10, dmgTakenPct: -10, hazardResistPct: 25, spd: -6, stl: -20 }, flag: 'noPanic',
    flavor: 'Fused to what is left of the spine. It does not come off. Whoever is inside does not talk about before.' },
  { id: 'reflex_booster', slot: 'implant', name: 'Reflex Booster',   mods: { spd: 8, evasion: 4 } },
  { id: 'targeting_eye',  slot: 'implant', name: 'Targeting Eye',    mods: { aim: 8, critPct: 3 } },
  { id: 'dermal_plating', slot: 'implant', name: 'Dermal Plating',   mods: { arm: 8, hp: 10 } },
  { id: 'pain_editor',    slot: 'implant', name: 'Pain Editor',      mods: { grit: 12, dmgTakenPct: -3 } },
  { id: 'neural_link',    slot: 'implant', name: 'Neural Link',      mods: { tech: 10, abilityCdPct: -5 } },
  { id: 'combat_download',slot: 'implant', name: 'Martial Arts Download', rarity: 'relic', egg: 'combat_download',
    mods: { evasion: 12, critPct: 8 }, flag: 'meleeMaster', flavor: 'Plug in, wait nine seconds, open your eyes. "Show me."' },
  { id: 'precog_lens',    slot: 'implant', name: 'Precog Lens',      rarity: 'prototype', egg: 'precog_lens',
    mods: { evasion: 8, detectPct: 25 }, flavor: 'Sees the shot before it is fired. Sometimes reports a minority opinion.' },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
// Items that can show up in packs and the store with a rolled rarity.
export const ROLLABLE_ITEMS = ITEMS.filter(i => !i.rarity);

// Affixes. values[tier] where tier comes from the item's rarity (milspec 0 ... xeno 3).
// key: a MOD_KEYS key. For dmgVs affixes, `vs` names the target tag.
export const AFFIXES = [
  { id: 'hollow_point', name: 'Hollow-Point',  slots: ['weapon'],             key: 'dmgPct',        values: [6, 10, 14, 20] },
  { id: 'piercing',     name: 'Piercing',      slots: ['weapon'],             key: 'pierce',        values: [1, 2, 3, 5] },
  { id: 'scoped',       name: 'Scoped',        slots: ['weapon'],             key: 'aim',           values: [4, 7, 10, 14] },
  { id: 'rapid',        name: 'Rapid',         slots: ['weapon'],             key: 'rofPct',        values: [6, 10, 14, 20] },
  { id: 'vicious',      name: 'Vicious',       slots: ['weapon'],             key: 'critPct',       values: [3, 5, 8, 12] },
  { id: 'extended',     name: 'Extended',      slots: ['weapon'],             key: 'rangeAdd',      values: [1, 1, 2, 3] },
  { id: 'synth_bane',   name: 'Synth-Bane',    slots: ['weapon'],             key: 'dmgVs', vs: 'synthetic', values: [10, 15, 20, 30] },
  { id: 'xeno_bane',    name: 'Xeno-Bane',     slots: ['weapon'],             key: 'dmgVs', vs: 'xeno',      values: [10, 15, 20, 30] },
  { id: 'reinforced',   name: 'Reinforced',    slots: ['armor'],              key: 'arm',           values: [3, 5, 8, 12] },
  { id: 'padded',       name: 'Padded',        slots: ['armor', 'implant'],   key: 'hp',            values: [8, 14, 20, 30] },
  { id: 'sealed',       name: 'Vacuum-Sealed', slots: ['armor', 'utility'],   key: 'hazardResistPct', values: [10, 15, 25, 40] },
  { id: 'lightweight',  name: 'Lightweight',   slots: ['armor', 'implant'],   key: 'spd',           values: [3, 5, 7, 10] },
  { id: 'muffled',      name: 'Muffled',       slots: ['armor', 'utility'],   key: 'stl',           values: [4, 7, 10, 15] },
  { id: 'steady',       name: 'Steady',        slots: ['utility', 'implant'], key: 'grit',          values: [4, 7, 10, 15] },
  { id: 'smart',        name: 'Smart',         slots: ['utility', 'implant'], key: 'tech',          values: [4, 7, 10, 15] },
  { id: 'lucky',        name: 'Lucky',         slots: ['armor', 'utility', 'implant'], key: 'survivalPct', values: [5, 8, 12, 18] },
  { id: 'veteran',      name: "Veteran's",     slots: ['utility', 'implant'], key: 'xpPct',         values: [5, 8, 12, 20] },
];
export const AFFIX_BY_ID = Object.fromEntries(AFFIXES.map(a => [a.id, a]));
