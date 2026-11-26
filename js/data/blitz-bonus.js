// Blitz time bonus (engine v4+): a successful Blitz earns extra BUCs for time left on the
// mission clock, as a % of the ship's base reward.
import { TICKS_PER_SEC } from './stats.js';
export const BLITZ_BONUS = { tactic: 'blitz', secsPerPct: 2, maxPct: 30 };
export function blitzTimeBonus(ship, battle) {
  if ((battle.engineVersion ?? 1) < 4 || battle.result !== 'success' || battle.tactic !== BLITZ_BONUS.tactic) return { bucs: 0, secs: 0 };
  const secs = Math.floor((battle.clockLeft || 0) / TICKS_PER_SEC);
  const pct = Math.min(BLITZ_BONUS.maxPct, Math.floor(secs / BLITZ_BONUS.secsPerPct));
  return { bucs: Math.floor((ship.reward * pct) / 100), secs };
}
