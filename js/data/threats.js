// Mothership defense battles (docs/MOTHERSHIP.md, phase M4): who boards you, and the rules of the
// fight. Used by the engine's defend mode (battle.js, input.mode = 'defend', engine v5+).
// New file on purpose (stale-cache rule).

// kind: 'boarding' = waves breach the Hangar and the hull; 'outbreak' = waves hatch from a nest room.
// units: weighted pool (crew-budget costs from factions.js). leader joins the last wave (the outbreak's
// "broodmother" is a Hive Brute: a Queen that hatches more drones on her own was unwinnable aboard).
// powerPct: scales every wave's crew budget for this threat (on top of input.power).
export const THREATS = [
  { id: 'corp_repo', kind: 'boarding', name: 'Corporate repo team', faction: 'corpsec', tier: 1,
    desc: 'A security contractor has come to “recover company assets”. That means your ship.',
    units: { corp_guard: 50, corp_riot: 25, corp_drone: 25 }, leader: 'corp_chief', powerPct: 80 },
  { id: 'pirate_raid', kind: 'boarding', name: 'Pirate boarding party', faction: 'pirates', tier: 2,
    desc: 'Pirates followed you home. They want the ship, the BUCs and anything not bolted down.',
    units: { pirate_deckhand: 45, pirate_cutthroat: 30, pirate_gunner: 25 }, leader: 'pirate_captain', leaderBreaksMorale: true, powerPct: 130 },
  { id: 'marine_strike', kind: 'boarding', name: 'Fleet Marine strike team', faction: 'military', tier: 3,
    desc: 'The Navy has decided your boarding habit is piracy. Marines are cutting through the hull.',
    units: { mil_marine: 50, mil_heavy: 15, mil_engineer: 15, mil_sniper: 20 }, leader: 'mil_officer', powerPct: 85 },
  { id: 'hive_outbreak', kind: 'outbreak', name: 'Parasite outbreak', faction: 'hive', tier: 3,
    desc: 'Something came back from that alien hulk. It has laid eggs, and the Downed don’t stay Down.',
    units: { hive_drone: 60, hive_spitter: 30, hive_brute: 10 }, leader: 'hive_brute', eggUnit: 'hive_drone', eggs: 3, possession: true, firstWaveAt: 0, powerPct: 75 },
];
export const THREAT_BY_ID = Object.fromEntries(THREATS.map(t => [t.id, t]));

// Ticks are 8 per second.
export const DEFENSE = {
  timeLimit: 1440,            // 3:00: hold out this long and the attackers give up
  holdTicks: 160,             // 20 s of attackers on the Bridge with no Soldier there = the ship is lost
  reactTicks: 16,             // 2 s to grab weapons when the alarm sounds
  maxDefenders: 24,
  waves: 3, firstWaveAt: 24, waveEvery: 240,
  waveBudgetPerSoldier: [2, 2, 3],   // crew points per defending Soldier for waves 1/2/3, times input.power %
  minWaveBudget: 4,
  guardEvery: 4,              // every 4th Soldier (by roster order) holds the Bridge instead of hunting
  armoryDmgPct: 5,            // per Armory level: damage bonus for Soldiers fighting inside it
  medBayRevivePct: 5,         // per Med Bay level: Medic revive chance aboard the Mothership
  quarantineLockMult: 1,      // per Quarantine Bay level: extra multiples of the door-forcing time on the nest
};
export const DEFEND_OBJECTIVE = { name: 'Hold the Bridge', primary: true, room: 'bridge', ticks: DEFENSE.holdTicks, kind: 'defend',
  desc: 'Keep the attackers off the Bridge until every wave is down or they give up.' };

export const waveBudget = (wave, defenders, power = 100) =>
  Math.max(DEFENSE.minWaveBudget, Math.floor((DEFENSE.waveBudgetPerSoldier[wave] * defenders * power) / 100));
