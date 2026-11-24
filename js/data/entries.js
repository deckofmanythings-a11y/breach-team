// How the squad gets ON the ship (entry) and how it gets OFF if things go wrong (retreat).
// Both are chosen before the mission and cannot change once it starts.
//
// Entry fields
//   maxSquad      squad size cap
//   spawn         where the squad appears: 'airlock' | 'any_room' (player-blind, engine picks
//                 the room nearest the objective that isn't the objective) | 'hull' (outer room
//                 nearest the objective) | 'vents' (random room within 3 rooms of the objective)
//   alarmStart    ship alarm level at tick 0 (0 calm, 1 alert, 2 full alarm)
//   setupTicks    ticks before the squad can act
//   scramblePct   chance PER SOLDIER that arrival goes wrong (lands in a random room, 40 ticks late).
//                 Ships with shields / weird fields add their own `scrambleAdd`.
//   stunTicks     enemies in the arrival room are stunned this long
//   hazard        hazard the entry creates in the arrival room
//   mods          squad-wide modifiers for the mission (MOD_KEYS vocabulary)

export const ENTRIES = [
  { id: 'teleport', name: 'Teleport',
    desc: 'Beam straight in next to the objective. Shields and strange fields can scatter the squad.',
    maxSquad: 4, spawn: 'any_room', alarmStart: 0, setupTicks: 10, scramblePct: 6, stunTicks: 0, mods: {} },
  { id: 'shuttle', name: 'Boarding Shuttle',
    desc: 'Dock at the airlock with the whole squad. Loud: the ship knows you are coming.',
    maxSquad: 6, spawn: 'airlock', alarmStart: 1, setupTicks: 30, scramblePct: 0, stunTicks: 0,
    mods: { grit: 5 }, shuttleDocked: true },
  { id: 'breach_pod', name: 'Breaching Pod',
    desc: 'Punch through the hull close to the objective. Stuns the room, but tears it open to vacuum.',
    maxSquad: 4, spawn: 'hull', alarmStart: 1, setupTicks: 15, scramblePct: 0, stunTicks: 40, hazard: 'decompression',
    mods: { dmgPct: 5 } },
  { id: 'vent_crawl', name: 'Vent Crawl',
    desc: 'Squeeze in through maintenance ducts. Silent, close to the objective, tiny squad.',
    maxSquad: 2, spawn: 'vents', alarmStart: 0, setupTicks: 40, scramblePct: 0, stunTicks: 0,
    mods: { stl: 15 }, startsHidden: true },
];

// Retreat fields
//   extractTicks  ticks a Soldier must survive at the exit point (or anywhere, for 'anywhere')
//   exit          'anywhere' | 'airlock' | 'pod_bay' | 'entry' (the room the squad arrived in)
//   needsDock     shuttle has to come back first unless the entry was 'shuttle' (arriveTicks)
//   failPct       chance PER SOLDIER the exit goes wrong; ships add `scrambleAdd` to teleport
//   failResult    what a failure means: 'delayed' (stuck 60 more ticks), 'mia' (lost in space,
//                 comes home after MIA_RETURN_MIN), 'left' (left on board -> aftermath decides)
//   carriesDowned whether Downed Soldiers can be carried out (else they're left behind)
//   rearGuard     one Soldier (highest Grit) stays behind to cover; everyone else extracts fast

export const RETREATS = [
  { id: 'teleport_recall', name: 'Teleport Recall',
    desc: 'Instant beam-out from wherever the squad stands. Can misfire, especially near shields.',
    exit: 'anywhere', extractTicks: 20, failPct: 8, failResult: 'delayed', carriesDowned: true },
  { id: 'shuttle', name: 'Back to the Shuttle',
    desc: 'Fight back to the airlock and fly out. Reliable, if the squad can reach it.',
    exit: 'airlock', extractTicks: 10, needsDock: true, arriveTicks: 80, failPct: 0, carriesDowned: true },
  { id: 'escape_pods', name: 'Escape Pods',
    desc: "Use the ship's own pods. Quick, but the pods scatter: someone may drift for a while.",
    exit: 'pod_bay', extractTicks: 5, failPct: 10, failResult: 'mia', carriesDowned: true },
  { id: 'rear_guard', name: 'Rear Guard',
    desc: 'One volunteer holds the line so the rest get out clean. Brave, and very dangerous for them.',
    exit: 'entry', extractTicks: 5, failPct: 0, carriesDowned: true, rearGuard: true, rearGuardHoldTicks: 120 },
];

export const MIA_RETURN_MIN = 30;  // MIA Soldiers turn up again after this many real minutes

export const ENTRY_BY_ID = Object.fromEntries(ENTRIES.map(e => [e.id, e]));
export const RETREAT_BY_ID = Object.fromEntries(RETREATS.map(r => [r.id, r]));
