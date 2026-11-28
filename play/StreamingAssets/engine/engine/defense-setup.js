// Mothership defense setup helpers (phase M4), shared by the engine and the Mothership view.
// New file on purpose (stale-cache rule).

// Where a Soldier is when the alarm goes: their usual room. `built(key)` says if a room exists.
// The Mothership tab shows idle Soldiers in these same rooms, so where they stand is where they fight.
export function stationKey(built, s) {
  if (s.injuries?.length) return built('med_bay') ? 'med_bay' : 'quarters';
  if (s.specialty === 'medic' && built('med_bay')) return 'med_bay';
  if (s.specialty === 'tech') return 'engineering';
  if (['assault', 'marksman', 'heavy'].includes(s.specialty) && built('training_deck')) return 'training_deck';
  if (s.specialty === 'breacher' && built('armory')) return 'armory';
  return 'quarters';
}

// Room index on a buildMothershipMap() map.
export function stationRoom(map, s) {
  const by = {};
  for (const r of map.rooms) by[r.key] = r.id;
  return by[stationKey(k => by[k] !== undefined, s)] ?? by.quarters;
}

// The engine's "ship" for a defense: the threat's unit pool on the player's own hull.
export function defenseShip(threat) {
  return {
    id: 'mothership', name: 'Mothership', faction: threat.faction, tier: threat.tier,
    unitWeights: threat.units, leader: threat.leader, civilians: [0, 0],
    reinforce: { waves: 0, firstAt: 0, every: 0, budget: 0 }, turrets: 0, lockedPct: 0, scrambleAdd: 0, optional: [],
    leaderBreaksMorale: !!threat.leaderBreaksMorale, eggUnit: threat.eggUnit, possession: !!threat.possession,
  };
}
export const HOME_ENTRY = { id: 'home', name: 'Aboard', mods: {}, setupTicks: 0, scramblePct: 0, alarmStart: 2, spawn: 'home' };
export const HOME_RETREAT = { id: 'none', name: 'No retreat', exit: 'none', cover: 0 };
