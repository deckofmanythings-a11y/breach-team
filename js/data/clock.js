// Mission clock (engine v4+). The 90 s clock (RETREAT_AT_TICK) only runs while no Soldier is on
// the bridge. When it runs out, a squad that is winning (more Soldiers up than enemies in sight)
// rolls its average Grit to dig in and push on for another 15 s; each push makes the next harder.
export const CLOCK = {
  pushTicks: 120,     // +15 s per successful push
  maxPushes: 3,
  gritStep: 10,       // each push already made takes this off the next chance
  minChance: 5, maxChance: 90,
  extractTicks: 120,  // after a time-out retreat, how long the squad has to get out
  absEnd: 1800,       // safety: nothing runs past 225 s
};
// % chance a squad pushes on: average Grit of its active Soldiers, less gritStep per earlier push.
export function pushChance(avgGrit, pushesSoFar) {
  return Math.max(CLOCK.minChance, Math.min(CLOCK.maxChance, Math.floor(avgGrit) - pushesSoFar * CLOCK.gritStep));
}
