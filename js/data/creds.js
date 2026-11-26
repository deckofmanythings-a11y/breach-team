// CREDs (Capital Resource Exchange Denominations): the Mothership currency (docs/MOTHERSHIP.md).
// Every XP point a Soldier earns on a mission is 1 CRED, bonuses included, and so is the XP of a
// Soldier who doesn't come home. CREDs are never bought with BUCs and carry over a Game Over.
import { xpToReach } from './stats.js';
import { GRADE_BY_ID } from './economy.js';

export const CREDS_NAME = 'CREDs';
export const CREDS_LONG = 'Capital Resource Exchange Denominations';

// CREDs from one mission's aftermath: the XP shown on the report, for everyone deployed.
export const credsForMission = (after) => after.soldiers.reduce((n, a) => n + (a.xp || 0), 0);

// One-time grant for saves made before CREDs existed: the XP each Soldier (living or on the
// Memorial) has earned since joining. A recruit's starting XP doesn't count. Cyborg rebuilds start
// with the fallen original's XP, so only what they earned since counts.
export function backfillCreds(g) {
  const fallen = new Map((g.memorial || []).map(m => [m.uid, m]));
  let n = 0;
  for (const s of [...(g.soldiers || []), ...(g.memorial || [])]) {
    let start;
    if (s.cyborg) start = fallen.get(s.origin)?.xp ?? s.xp;
    else start = xpToReach(GRADE_BY_ID[s.grade]?.level || 1);
    n += Math.max(0, (s.xp || 0) - start);
  }
  return n;
}
