// Core stats, the shared modifier vocabulary, combat formulas and the level curve.
// EVERYTHING here is integer-only: the engine is deterministic and re-simulated on the server.
// Percentages are whole numbers (25 = 25%). Divide with Math.floor, never produce floats.
// If you change a number in this file, bump ENGINE_VERSION (version.js) and update docs/CODEX.md.

export const STATS = ['hp', 'aim', 'arm', 'spd', 'grit', 'tech', 'stl'];

export const STAT_INFO = {
  hp:   { name: 'Health',  short: 'HP',   desc: 'Damage a Soldier can take before going Down.' },
  aim:  { name: 'Aim',     short: 'AIM',  desc: 'Hit chance and critical chance.' },
  arm:  { name: 'Armor',   short: 'ARM',  desc: 'Flat damage reduction (1 per 10 Armor).' },
  spd:  { name: 'Speed',   short: 'SPD',  desc: 'Movement speed and a little evasion.' },
  grit: { name: 'Grit',    short: 'GRT',  desc: 'Morale. Resists panic and suppression, and helps a winning squad dig in for more time when the mission clock runs out.' },
  tech: { name: 'Tech',    short: 'TEC',  desc: 'Hacking, breaching, healing and gadget power.' },
  stl:  { name: 'Stealth', short: 'STL',  desc: 'How hard a Soldier is to detect.' },
};

// Hard caps so stacking can never break the formulas.
export const STAT_CAP = { hp: 400, aim: 150, arm: 150, spd: 120, grit: 150, tech: 150, stl: 150 };
export const STAT_FLOOR = { hp: 10, aim: 5, arm: 0, spd: 10, grit: 5, tech: 0, stl: 0 };

// The closed vocabulary of modifier keys. Gear, affixes, perks, injuries, tactics, entry methods
// and (later) Mothership facilities may ONLY use these keys. test/data-check.mjs enforces it.
// Stat keys are flat additions; *Pct keys are percent adjustments; the rest are flat numbers.
export const MOD_KEYS = {
  // flat stat changes
  hp: 'flat', aim: 'flat', arm: 'flat', spd: 'flat', grit: 'flat', tech: 'flat', stl: 'flat',
  // percent stat changes (applied after flat; used by injuries)
  hpPct: 'pct', aimPct: 'pct', armPct: 'pct', spdPct: 'pct', gritPct: 'pct', techPct: 'pct', stlPct: 'pct',
  // offence
  dmgPct: 'pct',          // all damage dealt
  critPct: 'pct',         // added to crit chance
  critDmgPct: 'pct',      // added to crit damage multiplier (base 150)
  pierce: 'flat',         // ignores this much target damage reduction
  rangeAdd: 'flat',       // weapon range in tiles
  rofPct: 'pct',          // fire-rate (positive = faster)
  suppressPct: 'pct',     // strength of suppression applied
  // vs-tag damage, e.g. { dmgVs: { synthetic: 15 } }
  dmgVs: 'tagmap',
  // defence
  dmgTakenPct: 'pct',     // negative = take less
  evasion: 'flat',        // added to evasion
  coverPct: 'pct',        // bonus to cover effectiveness
  // support / utility
  healPct: 'pct',         // healing done
  reviveChance: 'pct',    // added to revive success
  hackSpeedPct: 'pct',
  breachSpeedPct: 'pct',
  detectPct: 'pct',       // ability to spot stealthed enemies / hazards
  abilityCdPct: 'pct',    // negative = shorter cooldowns
  moralePct: 'pct',       // squad-wide morale aura (leaders, some perks)
  hazardResistPct: 'pct', // resistance to ship hazards (decompression, spores, acid...)
  // aftermath
  survivalPct: 'pct',     // reduces KIA chance when Downed (relative)
  healTimePct: 'pct',     // negative = heals faster
  xpPct: 'pct',
};

// ---------- Simulation clock ----------
export const TICKS_PER_SEC = 8;        // playback at 1x = 8 ticks per second
export const TARGET_TICKS = [480, 720]; // design target: 60-90 s at 1x
export const RETREAT_AT_TICK = 720;    // if the bridge isn't taken by now, the squad retreats automatically
export const HARD_END_TICK = 840;      // absolute end. Anyone still on board is left behind.

// ---------- Combat formulas (integer) ----------
export const COVER = { none: 0, half: 20, full: 40 };     // hit-chance penalty for shooting INTO cover
export const HIT_MIN = 5, HIT_MAX = 95;
export const BASE_HIT = 50;
export const CRIT_BASE_DMG = 150;                         // crit = 150% damage

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function evasionOf(spd, bonus = 0) { return Math.floor(spd / 5) + bonus; }

// distTiles: Chebyshev distance. range: weapon optimal range. falloff: % lost per tile beyond range.
export function hitChance({ aim, weaponAcc, targetEvasion, cover = 0, coverPct = 0, distTiles, range, falloff, suppressed = false }) {
  const coverPen = Math.floor((cover * (100 + coverPct)) / 100);
  const over = distTiles > range ? distTiles - range : 0;
  let h = BASE_HIT + Math.floor(aim / 2) + weaponAcc - targetEvasion - coverPen - over * falloff;
  if (suppressed) h -= 20;
  return clamp(h, HIT_MIN, HIT_MAX);
}

export function critChance(aim, weaponCrit, critPct = 0) { return clamp(weaponCrit + Math.floor(aim / 10) + critPct, 0, 60); }

export function damageReduction(arm) { return Math.floor(arm / 10); }

// raw: rolled weapon damage. Returns final damage, minimum 1.
export function applyDamage({ raw, dmgPct = 0, vsPct = 0, crit = false, critDmgPct = 0, targetArm, pierce = 0, dmgTakenPct = 0 }) {
  let d = Math.floor((raw * (100 + dmgPct + vsPct)) / 100);
  if (crit) d = Math.floor((d * (CRIT_BASE_DMG + critDmgPct)) / 100);
  const dr = Math.max(0, damageReduction(targetArm) - pierce);
  d = d - dr;
  d = Math.floor((d * (100 + dmgTakenPct)) / 100);
  return d < 1 ? 1 : d;
}

// Ticks needed to cross one tile. spd 50 -> 5 ticks, spd 100 -> 3, spd 20 -> 7.
export function ticksPerTile(spd, spdPct = 0) {
  const eff = Math.floor((spd * (100 + spdPct)) / 100);
  return clamp(8 - Math.floor(eff / 20), 2, 8);
}

// Panic: checked when a Soldier is hit hard, an ally goes Down nearby, or a hazard triggers.
// pressure: 0-60 from the engine (allies down, HP lost, alien horror). Returns % chance to panic.
export function panicChance(grit, pressure, moralePct = 0) {
  const p = 25 + pressure - Math.floor(grit / 2);
  return clamp(Math.floor((p * (100 - moralePct)) / 100), 0, 75);
}

// Stealth detection: % chance per check that an observer spots a stealthed unit in line of sight.
export function detectChance(observerTech, observerDetectPct, targetStl, distTiles) {
  const d = 40 + Math.floor(observerTech / 4) + observerDetectPct - targetStl - distTiles * 3;
  return clamp(d, 3, 90);
}

// ---------- Level curve ----------
export const MAX_LEVEL = 20;
// Total XP needed to REACH level L (level 1 = 0 XP).
export function xpToReach(level) { return level <= 1 ? 0 : 40 * (level - 1) * level; }
export function levelForXp(xp) {
  let L = 1;
  while (L < MAX_LEVEL && xp >= xpToReach(L + 1)) L++;
  return L;
}

// On each level-up a Soldier gets POINTS_PER_LEVEL stat points, each placed by a weighted
// roll over its specialty's growth weights. One point is worth STAT_POINT_VALUE of that stat.
export const POINTS_PER_LEVEL = 4;
export const STAT_POINT_VALUE = { hp: 4, aim: 2, arm: 2, spd: 2, grit: 2, tech: 2, stl: 2 };
// Breakthrough: rare lucky level-up that adds bonus points to the specialty's primary stat.
export const BREAKTHROUGH_PCT = 8;
export const BREAKTHROUGH_POINTS = 3;
export const PERK_LEVELS = [5, 10, 15];

// XP awarded per mission event (engine tallies these per Soldier).
export const XP = {
  missionBase: 20,      // just for deploying and making it home
  success: 25,          // squad took the primary objective
  kill: 4,
  objectiveAssist: 10,  // in the room when an objective is taken
  revive: 8,
  hack: 5,
  breach: 5,
  rearGuard: 40,        // volunteered for rear guard (paid even if KIA, for the Memorial)
};
