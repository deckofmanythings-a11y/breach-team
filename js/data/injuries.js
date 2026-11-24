// Injuries and the aftermath roll. Permadeath is ON for EVERY mission (locked design decision):
// any Soldier who goes Down can die, on any ship, at any difficulty. Difficulty raises the odds;
// nothing ever lowers them below KIA_MIN_PCT. All rolls are deterministic from the battle record.
//
// Injury severity: 1 = minor (can still deploy, with penalties), 2 = major (benched until healed).
// Healing is in real MINUTES (locked: never hours). Hard max per injury = MAX_HEAL_MIN.

export const INJURIES = [
  { id: 'grazed',        name: 'Grazed',            severity: 1, healMin: 10, mods: { hpPct: -10 } },
  { id: 'concussed',     name: 'Concussed',         severity: 1, healMin: 15, mods: { aimPct: -15, techPct: -10 } },
  { id: 'sprained',      name: 'Sprained Ankle',    severity: 1, healMin: 12, mods: { spdPct: -20 } },
  { id: 'burned',        name: 'Burned',            severity: 1, healMin: 15, mods: { hpPct: -10, gritPct: -10 } },
  { id: 'shaken',        name: 'Shaken',            severity: 1, healMin: 10, mods: { gritPct: -25 } },
  { id: 'cracked_ribs',  name: 'Cracked Ribs',      severity: 1, healMin: 20, mods: { armPct: -15, spdPct: -10 } },
  { id: 'gunshot',       name: 'Gunshot Wound',     severity: 2, healMin: 40, mods: { hpPct: -25, spdPct: -15 } },
  { id: 'broken_arm',    name: 'Broken Arm',        severity: 2, healMin: 45, mods: { aimPct: -30 } },
  { id: 'vacuum_burn',   name: 'Vacuum Exposure',   severity: 2, healMin: 50, mods: { hpPct: -20, techPct: -20 } },
  { id: 'internal',      name: 'Internal Bleeding', severity: 2, healMin: 60, mods: { hpPct: -35 } },
  { id: 'shellshock',    name: 'Shell Shock',       severity: 2, healMin: 35, mods: { gritPct: -40, aimPct: -10 } },
];
export const INJURY_BY_ID = Object.fromEntries(INJURIES.map(i => [i.id, i]));
export const MINOR = INJURIES.filter(i => i.severity === 1).map(i => i.id);
export const MAJOR = INJURIES.filter(i => i.severity === 2).map(i => i.id);

export const MAX_HEAL_MIN = 60;
export const MAX_INJURIES = 4;
// Instant heal price in BUCs at full remaining time (pro-rated by time left, minimum 5).
export const HEAL_COST = { 1: 20, 2: 60 };
// A Soldier with ANY major injury can't deploy. Minor injuries only apply their penalties.
export const BENCH_SEVERITY = 2;

// ---------- Aftermath ----------
// Every deployed Soldier ends the mission in exactly one state (the engine decides):
//   'fine'      never went Down
//   'revived'   went Down, got back up during the mission (Medic)
//   'downed'    was Down at the end, carried out by the retreat/extraction
//   'left'      was left on board (retreat couldn't carry them, or rear guard who fell)
//   'mia'       escape pod drifted (comes back after MIA_RETURN_MIN, entries.js)
//
// Odds below are percent, integer.

// Base KIA chance for a 'downed' Soldier by ship tier. Even tier 1 can kill.
export const KIA_BASE = { 1: 12, 2: 18, 3: 25 };
export const KIA_MIN_PCT = 5;            // floor after all reductions: death is always possible once Down
export const KIA_MAX_PCT = 85;
export const KIA_BLEED_PER = 30;         // +1% KIA per this many ticks spent Down before extraction
export const KIA_BLEED_MAX = 20;
export const KIA_OVERKILL_DIV = 4;       // +1% per (overkill as % of max HP) / this, capped below
export const KIA_OVERKILL_MAX = 15;
export const LEFT_BEHIND_KIA = 60;       // 'left': KIA chance; survivors come back MIA with a major injury
export const REAR_GUARD_KIA_MULT = 80;   // rear guard who fell: LEFT_BEHIND_KIA * this / 100 (volunteers get a little luck)

// Injury chance for those who stayed up: hpLostPct / INJURY_DIV (HP lost as % of max, at the worst point).
export const INJURY_DIV = 2;
export const REVIVED_MAJOR_PCT = 50;     // 'revived': guaranteed injury; this % chance it's major instead of minor
// 'downed' survivors always get 1 major injury, plus a minor with this chance:
export const DOWNED_EXTRA_MINOR_PCT = 40;

// KIA % for a Downed Soldier. survivalPct is a RELATIVE reduction (Lucky affix, Guardian Angel).
export function kiaChance({ tier, ticksDown = 0, overkillPct = 0, survivalPct = 0 }) {
  let k = KIA_BASE[tier] ?? KIA_BASE[3];
  k += Math.min(KIA_BLEED_MAX, Math.floor(ticksDown / KIA_BLEED_PER));
  k += Math.min(KIA_OVERKILL_MAX, Math.floor(overkillPct / KIA_OVERKILL_DIV));
  k = Math.floor((k * (100 - Math.min(80, survivalPct))) / 100);
  return Math.max(KIA_MIN_PCT, Math.min(KIA_MAX_PCT, k));
}

export function healMs(id, healTimePct = 0) {
  const base = Math.min(MAX_HEAL_MIN, INJURY_BY_ID[id]?.healMin || 15);
  return Math.max(1, Math.floor((base * (100 + healTimePct)) / 100)) * 60e3;
}

export const CONDITIONS = [
  { id: 'healthy', name: 'Ready',     color: '#4ade80' },
  { id: 'wounded', name: 'Wounded',   color: '#facc15' },  // minor injuries only: can deploy
  { id: 'benched', name: 'Recovering', color: '#fb923c' }, // has a major injury: can't deploy
  { id: 'mia',     name: 'Missing',   color: '#94a3b8' },
  { id: 'kia',     name: 'KIA',       color: '#ef4444' },
];
