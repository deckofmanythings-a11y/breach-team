// Crew Quarters (Ver. 0.23.0): the Mothership room that sets how many Soldiers the roster can hold.
// Its level lives in g.mothership.quarters (0 = unexpanded) and survives a Game Over like the rest of the Mothership.
// It stays a fixed slot on the Mothership map (js/engine/mothership-map.js), so defense battles don't change.
// No level cap: each expansion costs more than the last until it simply isn't worth it.
// Rosters already bigger than the cap are kept ("grandfathered"), but nobody new joins until it's expanded past them.
export const CREW_QUARTERS = {
  id: 'quarters', name: 'Crew Quarters', icon: '🛏️',
  desc: 'Bunks for your roster. Every expansion makes room for more Soldiers.',
};
export const CREW_BASE = 14;          // roster cap with unexpanded quarters
export const CREW_PER_LEVEL = 7;      // more Soldiers per expansion
export const CREW_BASE_PRICE = 800;   // CREDs for the first expansion
export const CREW_PRICE_GROWTH = 1.6; // each expansion costs this much more than the last

export const quartersLevel = (g) => Math.max(0, Math.floor(Number(g?.mothership?.quarters) || 0));
export const capAtLevel = (level) => CREW_BASE + CREW_PER_LEVEL * Math.max(0, level);
/** How many Soldiers this save's roster can hold. */
export const rosterCap = (g) => capAtLevel(quartersLevel(g));
/** CREDs to expand from `level` to level + 1 (rounded to 50). */
export const quartersPriceAt = (level) => Math.round((CREW_BASE_PRICE * CREW_PRICE_GROWTH ** Math.max(0, level)) / 50) * 50;
export const nextQuartersPrice = (g) => quartersPriceAt(quartersLevel(g));
/** Barracks are full (or over a grandfathered cap): no one new can join. */
export const rosterFull = (g, adding = 1) => g.soldiers.length + adding > rosterCap(g);
export const FULL_MESSAGE = 'The Barracks are full: expand the Crew Quarters on the Mothership to make room.';
