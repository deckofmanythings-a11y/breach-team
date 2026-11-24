// Alien factions, their ships, and the secret ships. Merged into FACTIONS (factions.js) and
// SHIPS (ships.js). Every alien unit is tagged 'xeno' (Xeno-Bane affixes, the Mk.41's bonus).
//
// Unit `flags` (engine, battle.js):
//   acidBlood     on death, Soldiers within 1 tile take acid damage (ignores armor)
//   spawns        { unit, every, max }: births a new unit every `every` ticks once alerted
//   sporePulse    radius: every 40 ticks, Soldiers within radius may become Confused
//   prismAura     allies in the same room take 25% less damage
//   screamPanic   targets it hits make a panic check
//   ambush        starts hidden (needs spotting, or attacks first)
// ai 'static' = never moves (pulses / spawns / shoots if armed); 'hunter' = always stalks the squad.
//
// Ship fields used only by alien ships:
//   eggPct        % of rooms (not airlock/bridge) that get 2 egg pods; eggs hatch when a Soldier comes within 3 tiles
//   sporePct      % of rooms filled with spores (Confusion hazard)
//   dark          the squad only sees 6 tiles (+4 with a Motion Tracker, +2 with Tech 60+)
//   refraction    missed shots can ricochet into anyone within 3 tiles of the target
//   gravity       ship gravity cycles normal -> heavy -> normal -> zero-G every 15 s
//   possession    a Soldier left Down for 12.5 s rises as a possessed enemy; Down them again to free them
//   xenoDropPct   chance of a Xeno item on a successful boarding

export const ALIEN_FACTIONS = [
  {
    id: 'hive', name: 'The Hive', alien: true,
    desc: 'A chittering insectile swarm. Fast, armored, and they bleed acid. The nest keeps hatching more.',
    tags: ['xeno'], morale: 30,
    look: { silhouette: 'glistening black chitin, long skulls, bioluminescent purple veins', palette: ['#2b1f3a', '#9b5cff', '#0e0a14'], movement: 'skittering bursts' },
    units: [
      { id: 'hive_drone',   name: 'Hive Drone',   cost: 3, ai: 'rusher', weapon: 'xeno_claws', flags: ['acidBlood'],
        stats: { hp: 55, aim: 50, arm: 15, spd: 70, grit: 100, tech: 0, stl: 30 }, tags: ['xeno', 'bug', 'melee'] },
      { id: 'hive_spitter', name: 'Acid Spitter', cost: 3, ai: 'grunt',  weapon: 'acid_spit',  flags: ['acidBlood'],
        stats: { hp: 50, aim: 45, arm: 10, spd: 55, grit: 100, tech: 0, stl: 20 }, tags: ['xeno', 'bug'] },
      { id: 'hive_brute',   name: 'Hive Brute',   cost: 6, ai: 'anchor', weapon: 'xeno_claws', rarity: 'prototype', flags: ['acidBlood'],
        stats: { hp: 150, aim: 45, arm: 35, spd: 45, grit: 100, tech: 0, stl: 0 },  tags: ['xeno', 'bug', 'melee'] },
      { id: 'hive_queen',   name: 'Hive Queen',   cost: 0, ai: 'leader', weapon: 'acid_spit',  rarity: 'relic', aura: 25, flags: ['acidBlood'],
        spawns: { unit: 'hive_drone', every: 150, max: 4 },
        stats: { hp: 280, aim: 55, arm: 40, spd: 35, grit: 100, tech: 0, stl: 0 },  tags: ['xeno', 'bug', 'leader'] },
    ],
  },
  {
    id: 'mycelid', name: 'Mycelid Bloom', alien: true,
    desc: 'A fungal colony wearing the dead crew. Spores muddle the mind: confused Soldiers may fire on friends.',
    tags: ['xeno'], morale: 50,
    look: { silhouette: 'pale grey-white fungal growths over human shapes, glowing spore sacs', palette: ['#cfcab8', '#9ee86a', '#3a3a2c'], movement: 'slow shambling' },
    units: [
      { id: 'myc_shambler', name: 'Shambler',     cost: 2, ai: 'rusher', weapon: 'xeno_claws',
        stats: { hp: 70, aim: 35, arm: 10, spd: 35, grit: 100, tech: 0, stl: 0 },  tags: ['xeno', 'melee'] },
      { id: 'myc_puffer',   name: 'Spore Puffer', cost: 2, ai: 'static', weapon: null, flags: ['sporePulse'], sporeRadius: 2,
        stats: { hp: 45, aim: 0, arm: 5, spd: 0, grit: 100, tech: 0, stl: 0 },    tags: ['xeno', 'static'] },
      { id: 'myc_stalker',  name: 'Stalker',      cost: 4, ai: 'rusher', weapon: 'xeno_claws', flags: ['ambush'],
        stats: { hp: 70, aim: 50, arm: 10, spd: 65, grit: 100, tech: 0, stl: 70 }, tags: ['xeno', 'melee'] },
      { id: 'myc_mother',   name: 'Bloom Mother', cost: 0, ai: 'static', weapon: 'acid_spit', rarity: 'prototype', aura: 20, flags: ['sporePulse'], sporeRadius: 3,
        spawns: { unit: 'myc_shambler', every: 200, max: 3 },
        stats: { hp: 300, aim: 40, arm: 20, spd: 0, grit: 100, tech: 0, stl: 0 },   tags: ['xeno', 'leader', 'static'] },
    ],
  },
  {
    id: 'lattice', name: 'The Lattice', alien: true,
    desc: 'A crystalline intelligence. Its constructs shrug off fire, prisms shield their kin, and stray shots ricochet off every surface.',
    tags: ['xeno', 'synthetic'], morale: 100,
    look: { silhouette: 'translucent violet-blue crystal constructs with glowing cores', palette: ['#7f8cff', '#c9b6ff', '#1a1640'], movement: 'smooth gliding' },
    units: [
      { id: 'crys_shard',    name: 'Shard',        cost: 3, ai: 'grunt',   weapon: 'crystal_beam',
        stats: { hp: 55, aim: 55, arm: 30, spd: 45, grit: 100, tech: 0, stl: 0 },  tags: ['xeno', 'synthetic'] },
      { id: 'crys_prism',    name: 'Prism',        cost: 4, ai: 'support', weapon: 'crystal_beam', flags: ['prismAura'],
        stats: { hp: 60, aim: 45, arm: 25, spd: 45, grit: 100, tech: 0, stl: 0 },  tags: ['xeno', 'synthetic'] },
      { id: 'crys_colossus', name: 'Colossus',     cost: 6, ai: 'anchor',  weapon: 'xeno_claws', rarity: 'prototype',
        stats: { hp: 160, aim: 45, arm: 38, spd: 35, grit: 100, tech: 0, stl: 0 }, tags: ['xeno', 'synthetic', 'melee'] },
      { id: 'crys_core',     name: 'Lattice Core', cost: 0, ai: 'leader',  weapon: 'crystal_beam', rarity: 'relic', aura: 0, flags: ['prismAura'],
        stats: { hp: 300, aim: 60, arm: 40, spd: 20, grit: 100, tech: 0, stl: 0 }, tags: ['xeno', 'synthetic', 'leader'] },
    ],
  },
  {
    id: 'wraith', name: 'Void Wraiths', alien: true,
    desc: 'Shapes in the dark. Shades strike from nowhere, howls rattle the nerves, and something big hunts the squad.',
    tags: ['xeno'], morale: 100,
    look: { silhouette: 'tattered shadowy forms trailing smoke, pale white eyes', palette: ['#1a1a24', '#e8e8ff', '#000000'], movement: 'flickering lunges' },
    units: [
      { id: 'void_shade',  name: 'Shade',  cost: 3, ai: 'rusher', weapon: 'xeno_claws', flags: ['ambush'],
        stats: { hp: 50, aim: 55, arm: 5, spd: 70, grit: 100, tech: 0, stl: 85 },  tags: ['xeno', 'melee'] },
      { id: 'void_howler', name: 'Howler', cost: 3, ai: 'grunt',  weapon: 'void_scream', flags: ['screamPanic'],
        stats: { hp: 55, aim: 45, arm: 10, spd: 50, grit: 100, tech: 0, stl: 30 }, tags: ['xeno'] },
      { id: 'void_reaper', name: 'The Reaper', cost: 0, ai: 'hunter', weapon: 'xeno_claws', rarity: 'relic', aura: 0, flags: ['ambush'],
        stats: { hp: 300, aim: 60, arm: 25, spd: 60, grit: 100, tech: 0, stl: 70 }, tags: ['xeno', 'leader', 'melee'] },
    ],
  },
  {
    id: 'drifters', name: 'Drifters', alien: true, immuneGravity: true,
    desc: 'Tall, graceful zero-G natives. Their ship\'s gravity shifts constantly, and only they are used to it.',
    tags: ['xeno'], morale: 10,
    look: { silhouette: 'tall thin grey-skinned humanoids in flowing pressure suits, glowing blue markings', palette: ['#8fa3b8', '#3dd6ff', '#26303a'], movement: 'floating glides' },
    units: [
      { id: 'drift_skimmer',   name: 'Skimmer',   cost: 2, ai: 'grunt',  weapon: 'smg_std',
        stats: { hp: 45, aim: 45, arm: 5, spd: 70, grit: 40, tech: 20, stl: 10 },  tags: ['xeno'] },
      { id: 'drift_lancer',    name: 'Lancer',    cost: 3, ai: 'sniper', weapon: 'rifle_std',
        stats: { hp: 50, aim: 60, arm: 10, spd: 55, grit: 45, tech: 20, stl: 20 }, tags: ['xeno'] },
      { id: 'drift_anchor',    name: 'Anchor',    cost: 5, ai: 'anchor', weapon: 'lmg_std',
        stats: { hp: 100, aim: 40, arm: 30, spd: 40, grit: 60, tech: 10, stl: 0 }, tags: ['xeno'] },
      { id: 'drift_matriarch', name: 'Matriarch', cost: 0, ai: 'leader', weapon: 'carbine_std', rarity: 'relic', aura: 20,
        stats: { hp: 140, aim: 60, arm: 20, spd: 55, grit: 70, tech: 40, stl: 10 }, tags: ['xeno', 'leader'] },
    ],
  },
  {
    id: 'thrall', name: 'The Thrall', alien: true,
    desc: 'Parasites riding stolen bodies. Leave a Downed Soldier too long and they get a new host.',
    tags: ['xeno'], morale: 60,
    look: { silhouette: 'pale veiny humans with glowing green parasites clamped to the neck', palette: ['#a8b59a', '#5dff6a', '#26301f'], movement: 'jerky puppet steps' },
    units: [
      { id: 'thrall_host',     name: 'Host',      cost: 2, ai: 'grunt',  weapon: 'pistol_std',
        stats: { hp: 60, aim: 40, arm: 10, spd: 45, grit: 100, tech: 0, stl: 0 },  tags: ['xeno', 'human'] },
      { id: 'thrall_crawler',  name: 'Crawler',   cost: 3, ai: 'rusher', weapon: 'xeno_claws',
        stats: { hp: 35, aim: 55, arm: 5, spd: 75, grit: 100, tech: 0, stl: 40 },  tags: ['xeno', 'melee'] },
      { id: 'thrall_brute',    name: 'Brute Host', cost: 5, ai: 'anchor', weapon: 'shotgun_std',
        stats: { hp: 110, aim: 35, arm: 25, spd: 40, grit: 100, tech: 0, stl: 0 }, tags: ['xeno', 'human'] },
      { id: 'thrall_overmind', name: 'Overmind',  cost: 0, ai: 'static', weapon: 'void_scream', rarity: 'relic', aura: 30, flags: ['screamPanic'],
        stats: { hp: 320, aim: 55, arm: 25, spd: 0, grit: 100, tech: 0, stl: 0 },  tags: ['xeno', 'leader', 'static'] },
    ],
  },
];

const alienRooms = (extra) => ({ count: [9, 11], required: ['airlock', 'bridge', 'pod_bay'], pool: { corridor: 30, cargo: 15, quarters: 15, engineering: 15, reactor: 10, mess: 10, ...extra } });

export const ALIEN_SHIPS = [
  { id: 'hive_ship', name: 'Hive Ship', faction: 'hive', tier: 3, alien: true,
    desc: 'A freighter the Hive turned into a nest. Egg pods everywhere, acid in their veins, and a Queen on the bridge.',
    look: { hull: 'resin-coated hull, organic growths', palette: ['#2b1f3a', '#9b5cff'] },
    rooms: alienRooms(), crewBudget: 11, unitWeights: { hive_drone: 55, hive_spitter: 30, hive_brute: 15 },
    leader: 'hive_queen', civilians: [0, 0], reinforce: { waves: 2, firstAt: 250, every: 200, budget: 6 },
    turrets: 0, lockedPct: 0, scrambleAdd: 0, eggPct: 35, optional: ['grab_cargo', 'data_core'], reward: 650, xenoDropPct: 40 },
  { id: 'fungal_derelict', name: 'Fungal Derelict', faction: 'mycelid', tier: 2, alien: true,
    desc: 'A dead hauler overgrown by a fungal bloom. Spore-choked rooms make Soldiers lose track of who is who.',
    look: { hull: 'derelict hauler furred with grey fungus', palette: ['#cfcab8', '#9ee86a'] },
    rooms: alienRooms(), crewBudget: 10, unitWeights: { myc_shambler: 50, myc_puffer: 25, myc_stalker: 25 },
    leader: 'myc_mother', civilians: [0, 0], reinforce: { waves: 1, firstAt: 300, every: 0, budget: 5 },
    turrets: 0, lockedPct: 10, scrambleAdd: 0, sporePct: 25, optional: ['grab_cargo', 'data_core'], reward: 420, xenoDropPct: 30 },
  { id: 'crystal_spire', name: 'Crystal Spire', faction: 'lattice', tier: 3, alien: true,
    desc: 'A living crystal vessel. Its constructs are hard to crack, misses ricochet, and its field scatters teleports.',
    look: { hull: 'faceted crystal spire', palette: ['#7f8cff', '#c9b6ff'] },
    rooms: alienRooms({ armory: 5 }), crewBudget: 13, unitWeights: { crys_shard: 55, crys_prism: 25, crys_colossus: 20 },
    leader: 'crys_core', civilians: [0, 0], reinforce: { waves: 2, firstAt: 250, every: 200, budget: 5 },
    turrets: 0, lockedPct: 20, scrambleAdd: 25, refraction: true, optional: ['data_core', 'raid_armory'], reward: 640, xenoDropPct: 40 },
  { id: 'void_hulk', name: 'Void Hulk', faction: 'wraith', tier: 3, alien: true,
    desc: 'A drifting hulk with no lights. Your squad sees only a few tiles. Something in there is hunting them.',
    look: { hull: 'black hulk, no running lights', palette: ['#1a1a24', '#e8e8ff'] },
    rooms: alienRooms(), crewBudget: 21, unitWeights: { void_shade: 55, void_howler: 45 },
    leader: 'void_reaper', civilians: [0, 0], reinforce: { waves: 1, firstAt: 300, every: 0, budget: 6 },
    turrets: 0, lockedPct: 10, scrambleAdd: 5, dark: true, optional: ['grab_cargo', 'data_core'], reward: 640, xenoDropPct: 40 },
  { id: 'gravity_vessel', name: 'Gravity Anomaly', faction: 'drifters', tier: 2, alien: true,
    desc: 'A Drifter ship whose gravity shifts every few seconds: crushing, then normal, then none at all. Only the Drifters are used to it.',
    look: { hull: 'spiralling hull rings', palette: ['#8fa3b8', '#3dd6ff'] },
    rooms: alienRooms({ armory: 5 }), crewBudget: 14, unitWeights: { drift_skimmer: 50, drift_lancer: 30, drift_anchor: 20 },
    leader: 'drift_matriarch', civilians: [0, 0], reinforce: { waves: 2, firstAt: 300, every: 200, budget: 5 },
    turrets: 1, lockedPct: 15, scrambleAdd: 0, gravity: true, optional: ['capture_leader', 'raid_armory', 'data_core'], reward: 400, xenoDropPct: 25 },
  { id: 'parasite_ship', name: 'Parasite Ship', faction: 'thrall', tier: 3, alien: true,
    desc: 'A liner taken by parasites. Its crew are hosts now, and a Soldier left Down too long becomes one too.',
    look: { hull: 'passenger liner streaked with green ichor', palette: ['#a8b59a', '#5dff6a'] },
    rooms: alienRooms({ medbay: 10 }), crewBudget: 28, unitWeights: { thrall_host: 40, thrall_crawler: 35, thrall_brute: 25 },
    leader: 'thrall_overmind', civilians: [0, 0], reinforce: { waves: 2, firstAt: 250, every: 200, budget: 5 },
    turrets: 0, lockedPct: 10, scrambleAdd: 0, possession: true, optional: ['grab_cargo', 'data_core'], reward: 660, xenoDropPct: 40 },
];

// Secret ships: never listed on Deploy. A boarding has a small chance to turn out to be one of
// these instead (see SECRET_CHANCE in js/game/rules.js). Hidden easter eggs: never name them in
// player-facing text (codex, changelog, hints) until the player has met them.
export const SECRET_SHIPS = [
  { id: 'secret_horseshoe', name: 'Silent Horseshoe', faction: 'hive', tier: 3, alien: true, secret: true, egg: 'ship_derelict_horseshoe',
    desc: 'A vast horseshoe-shaped derelict broadcasting a looping signal nobody can read. The lower decks are full of eggs.',
    look: { hull: 'horseshoe-shaped derelict', palette: ['#2b1f3a', '#9b5cff'] },
    rooms: alienRooms(), crewBudget: 8, unitWeights: { hive_drone: 70, hive_spitter: 30 },
    leader: 'hive_queen', civilians: [0, 0], reinforce: { waves: 1, firstAt: 350, every: 0, budget: 6 },
    turrets: 0, lockedPct: 0, scrambleAdd: 0, eggPct: 85, optional: ['grab_cargo'], reward: 900, xenoDropPct: 100 },
  { id: 'secret_gravity_drive', name: 'Abyssal Gate', faction: 'wraith', tier: 3, alien: true, secret: true, egg: 'ship_gravity_drive',
    desc: 'A lost research ship that came back from somewhere. Its experimental drive is still running.',
    look: { hull: 'research vessel with a spiked core', palette: ['#1a1a24', '#ff3b3b'] },
    rooms: alienRooms({ reactor: 20 }), crewBudget: 36, unitWeights: { void_shade: 60, void_howler: 40 },
    leader: 'void_reaper', civilians: [0, 0], reinforce: { waves: 3, firstAt: 200, every: 150, budget: 8 },
    turrets: 0, lockedPct: 20, scrambleAdd: 10, dark: true, gravity: true, log: 'log_dont_open', optional: ['data_core'], reward: 950, xenoDropPct: 100 },
  { id: 'secret_bug_carrier', name: 'Overrun Troop Carrier', faction: 'hive', tier: 3, alien: true, secret: true, egg: 'ship_bug_hauler',
    desc: 'A troop carrier that never reported in. Its decks are crawling with giant bugs.',
    look: { hull: 'military troop carrier, breached', palette: ['#5b6b3a', '#9b5cff'] },
    rooms: alienRooms({ armory: 10 }), crewBudget: 18, unitWeights: { hive_drone: 75, hive_spitter: 25 },
    leader: 'hive_queen', civilians: [0, 0], reinforce: { waves: 3, firstAt: 200, every: 180, budget: 6 },
    turrets: 0, lockedPct: 0, scrambleAdd: 0, optional: ['raid_armory'], reward: 900, xenoDropPct: 100 },
];
