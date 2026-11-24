// Room templates and ship classes. The engine builds each ship procedurally from these:
// it picks a room count, places required rooms, fills from the weighted pool, links rooms
// with corridors/doors on a tile grid, then spends the crew budget on units.
// Phase 1 ships three classes (one per human faction). More classes + alien hulls come in Phase 7.

// Room templates. w/h are tile ranges. cover = % of floor tiles that get cover (half or full).
// features: terminal (hackable), turret (turret mount), pods (escape pods), loot (cargo bonus),
//           console (the bridge console - primary objective), vent (vent-crawl entry point)
// outer: on the hull (breaching pods can enter here)
export const ROOMS = {
  airlock:     { name: 'Airlock',        w: [4, 5],  h: [4, 5],  cover: 10, outer: true,  features: [] },
  corridor:    { name: 'Corridor',       w: [2, 3],  h: [6, 10], cover: 5,  outer: false, features: ['vent'] },
  cargo:       { name: 'Cargo Bay',      w: [7, 10], h: [6, 9],  cover: 30, outer: true,  features: ['loot', 'loot'] },
  quarters:    { name: 'Crew Quarters',  w: [5, 7],  h: [4, 6],  cover: 20, outer: true,  features: ['vent'] },
  mess:        { name: 'Mess Hall',      w: [6, 8],  h: [5, 7],  cover: 25, outer: false, features: [] },
  engineering: { name: 'Engineering',    w: [6, 8],  h: [6, 8],  cover: 25, outer: true,  features: ['terminal', 'vent'] },
  reactor:     { name: 'Reactor',        w: [5, 7],  h: [5, 7],  cover: 15, outer: false, features: ['terminal'], hazard: 'radiation' },
  armory:      { name: 'Armory',         w: [4, 6],  h: [4, 5],  cover: 20, outer: false, features: ['loot', 'turret'], locked: true },
  medbay:      { name: 'Med Bay',        w: [5, 6],  h: [4, 6],  cover: 15, outer: false, features: ['terminal'] },
  brig:        { name: 'Brig',           w: [4, 6],  h: [4, 5],  cover: 10, outer: false, features: ['terminal'], locked: true },
  pod_bay:     { name: 'Escape Pod Bay', w: [4, 6],  h: [4, 5],  cover: 10, outer: true,  features: ['pods'] },
  security:    { name: 'Security Post',  w: [4, 5],  h: [4, 5],  cover: 30, outer: false, features: ['terminal', 'turret'] },
  bridge:      { name: 'Bridge',         w: [7, 9],  h: [6, 8],  cover: 25, outer: false, features: ['console', 'turret'] },
};

// Optional objectives. Each is worth bonus BUCs and XP if completed during a successful run.
// `room` = where it spawns. `ticks` = how long a Soldier must work it (Tech speeds up 'hack' ones).
export const OBJECTIVES = {
  take_bridge:   { name: 'Take the Bridge',       primary: true, room: 'bridge',  ticks: 120, kind: 'hold',
    desc: 'Clear the bridge and hold the console until the ship is yours.' },
  grab_cargo:    { name: 'Seize the Cargo',       room: 'cargo',   ticks: 40, kind: 'interact', bonusPct: 30,
    desc: 'Tag the valuable crates for pickup.' },
  data_core:     { name: 'Pull the Data Core',    room: 'engineering', ticks: 50, kind: 'hack', bonusPct: 25,
    desc: 'Hack the core and download the ship logs.' },
  capture_leader:{ name: 'Capture the Captain',   room: 'bridge',  ticks: 0,  kind: 'leaderDown', bonusPct: 35,
    desc: 'Drop the enemy leader without killing them (Down them, the medic does the rest).' },
  free_prisoner: { name: 'Free the Prisoner',     room: 'brig',    ticks: 30, kind: 'hack', bonusPct: 20,
    desc: 'Spring someone from the brig. Sometimes they ask to join up.' },
  raid_armory:   { name: 'Raid the Armory',       room: 'armory',  ticks: 40, kind: 'interact', bonusPct: 20, gearDrop: true,
    desc: 'Crack the armory for a guaranteed equipment drop.' },
};

// Ship classes.
//   tier          1 easy / 2 medium / 3 hard. Feeds reward and aftermath KIA odds. Never makes death impossible.
//   rooms         count range, required rooms, weighted pool for the rest
//   crewBudget    points spent on faction units at start; unitWeights picks which
//   leader        unit that always spawns on the bridge (not counted in the budget)
//   reinforce     waves of extra crew that arrive from barracks once the alarm is at 2
//   turrets       how many turret mounts actually get a turret
//   lockedPct     % chance each non-required door is locked (needs Breacher, Tech or time)
//   scrambleAdd   added to teleport entry/retreat failure (shields, interference)
//   optional      optional objectives this class can roll (1-2 per mission)
//   reward        BUCs for a successful capture before multipliers (economy.js)
export const SHIPS = [
  {
    id: 'hauler', name: 'Cargo Hauler', faction: 'corpsec', tier: 1,
    desc: 'A slow freighter with a skeleton security team. Fat cargo holds, thin defences.',
    look: { hull: 'boxy, container racks along the spine', palette: ['#c9cfd4', '#1fb5a8'] },
    rooms: { count: [8, 10], required: ['airlock', 'bridge', 'pod_bay', 'cargo'], pool: { cargo: 30, corridor: 25, quarters: 15, engineering: 10, mess: 10, security: 10 } },
    crewBudget: 8, unitWeights: { corp_guard: 50, corp_riot: 20, corp_drone: 20, corp_crew: 10 },
    leader: 'corp_chief', civilians: [2, 4],
    reinforce: { waves: 1, firstAt: 400, every: 0, budget: 4 },
    turrets: 1, lockedPct: 10, scrambleAdd: 0,
    optional: ['grab_cargo', 'data_core'],
    reward: 220,
  },
  {
    id: 'raider', name: 'Pirate Raider', faction: 'pirates', tier: 2,
    desc: 'A cramped, over-gunned raider full of angry pirates. Drop the captain and they fall apart.',
    look: { hull: 'jagged, welded-on armor plates, ram prow', palette: ['#7a3b16', '#d9a441'] },
    rooms: { count: [9, 11], required: ['airlock', 'bridge', 'pod_bay'], pool: { corridor: 30, quarters: 20, cargo: 15, armory: 10, mess: 10, engineering: 10, brig: 5 } },
    crewBudget: 18, unitWeights: { pirate_deckhand: 45, pirate_cutthroat: 30, pirate_gunner: 25 },
    leader: 'pirate_captain', civilians: [0, 0],
    reinforce: { waves: 2, firstAt: 250, every: 200, budget: 6 },
    turrets: 1, lockedPct: 15, scrambleAdd: 0,
    optional: ['capture_leader', 'raid_armory', 'free_prisoner'],
    reward: 380,
    leaderBreaksMorale: true,   // when the captain goes Down, every pirate makes a panic check
  },
  {
    id: 'corvette', name: 'Patrol Corvette', faction: 'military', tier: 3,
    desc: 'A navy warship crewed by Fleet Marines. Shielded, well-defended, and very much expecting trouble.',
    look: { hull: 'sleek wedge, gun blisters, olive hull stripes', palette: ['#5b6b3a', '#8a8f86'] },
    rooms: { count: [10, 12], required: ['airlock', 'bridge', 'pod_bay', 'armory', 'security'], pool: { corridor: 30, quarters: 15, engineering: 15, reactor: 10, medbay: 10, mess: 10, brig: 10 } },
    crewBudget: 19, unitWeights: { mil_marine: 50, mil_heavy: 15, mil_engineer: 15, mil_sniper: 20 },
    leader: 'mil_officer', civilians: [0, 0],
    reinforce: { waves: 3, firstAt: 220, every: 180, budget: 5 },
    turrets: 2, lockedPct: 30, scrambleAdd: 10,
    optional: ['data_core', 'raid_armory', 'capture_leader'],
    reward: 600,
  },
];
export const SHIP_BY_ID = Object.fromEntries(SHIPS.map(s => [s.id, s]));
