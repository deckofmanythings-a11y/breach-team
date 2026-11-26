// Suicide Squad: the no-retreat "plan". Nobody falls back for casualties or the 90 s clock; the
// squad fights until it takes the bridge, is all Down, or hits the 3-minute hard limit. A loss
// kills every Soldier deployed, and their gear goes with them. A win pays the most of any plan.
export const SUICIDE_SQUAD = {
  id: 'suicide_squad',
  minLevel: 5,        // every Soldier committed must be at least this level
  timeLimit: 1440,    // ticks (3:00): the hard limit, no pausing, no digging in
  minTier: 2,         // not offered against tier-1 ships: a veteran squad never loses there, so it'd be free money
  rewardPct: 250,     // % of the normal success reward (objective bonuses + loot included)
  xpBonusPct: 100,    // extra mission XP % for every survivor of a win (stacks with gear/perk XP bonuses)
  unlockLevel: 5,     // the plan stays hidden until the roster has a Soldier of this level
  // The defenders know the boarders can't leave, so the ship fights harder:
  alarmStart: 2,      // full alarm from the first tick (every defender alerted, reinforcements roll)
  crewPct: 125,       // % of the ship's normal crew
  extraWaves: 1,      // reinforcement waves on top of the ship's own
  waveEvery: 200,     // ticks between waves for ships that normally send only one
  reinforcePct: 150,  // % size of each reinforcement wave
};
export const isSuicideSquad = (retreatId) => retreatId === SUICIDE_SQUAD.id;
