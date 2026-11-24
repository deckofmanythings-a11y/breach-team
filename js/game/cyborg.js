// Hidden easter egg: the Cyborg Operator. (Its own file: new names must come from new files, see the
// stale-cache note in docs/PLAN.md.) Never name it in player-facing text before the player meets one.
//
// Once a Soldier has died, every pack recruit has a small chance to be that Soldier, rebuilt by
// somebody as a walking life-support sarcophagus: same specialty, level, perks and colours, every
// stat higher, and a built-in chassis fused into the implant slot. The name only hints at who it was.
import { STATS } from '../data/stats.js';

export const CYBORG_PCT = 3;               // % per pack recruit, while an unrecovered Soldier is on the Memorial Wall
export const CYBORG_EGG = 'cyborg_operator';
export const CYBORG_CHASSIS = 'sarcophagus_chassis';
const STAT_BOOST_PCT = 15;                 // every stat +15% (at least +5)

// Fallen Soldiers who can still come back: not already taken, and never a machine twice.
export const recoverable = (g) => (g.memorial || []).filter(m => !m.recovered && !m.cyborg);

// Names that only hint: the number is the fallen Soldier's kill count, the letter their first initial.
const NAME_PATTERNS = [
  (L, n) => 'Experiment X',
  (L, n) => `Operative ${n}`,
  (L, n) => `Subject ${L}-${n}`,
  (L, n) => `Unit ${L}${n}`,
  (L, n) => `Asset ${n}-${L}`,
  (L, n) => `Specimen ${L}`,
];

// Build the cyborg from a memorial entry. `rng` is the pack's rng; `mkUid` makes a fresh soldier uid.
export function rebuild(rng, fallen, mkUid, serviceRecord, now) {
  const L = (fallen.name || 'X').trim()[0].toUpperCase();
  const n = Math.max(0, fallen.kills || 0);
  const stats = {};
  for (const k of STATS) { const v = fallen.stats[k] || 0; stats[k] = v + Math.max(5, Math.ceil((v * STAT_BOOST_PCT) / 100)); }
  return {
    uid: mkUid('s'), name: NAME_PATTERNS[rng.int(NAME_PATTERNS.length)](L, n), callsign: '', sex: fallen.sex,
    colors: (fallen.colors || ['#3a5a8c', '#f2c14e']).slice(),
    specialty: fallen.specialty, level: fallen.level, xp: fallen.xp || 0, stats,
    perks: (fallen.perks || []).slice(), pendingPerks: (fallen.pendingPerks || []).slice(),
    gear: {}, injuries: [], status: 'ready', miaUntil: 0, missions: 0, kills: 0, hired: now,
    record: serviceRecord(), medals: [],
    portrait: 'egg-cyborg-' + (fallen.sex === 'f' ? 'f' : 'm'), egg: CYBORG_EGG, cyborg: true, origin: fallen.uid,
    bio: 'All records sealed. Sometimes stops at the Memorial Wall, and nobody can say why.',
  };
}
