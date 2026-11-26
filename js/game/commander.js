// Starting over. Shared by the browser and boarding-api (new file: new names must come from new files).
//
// restartAccount: the player chose to wipe everything (from the landing page). A brand-new save.
// newCommander:   after a Game Over (a mission ended with no living Soldiers). A new commander takes
//                 over with a fresh crew and fresh BUCs, inheriting only the Memorial Wall and the
//                 Mothership. Everything else (gear, stats, eggs, achievements, history) starts over.
import { newGame, GameError } from './rules.js';

// Swap the contents of `g` for `fresh` in place (the server writes back the object it loaded).
function replaceSave(g, fresh) {
  for (const k of Object.keys(g)) delete g[k];
  Object.assign(g, fresh);
  return g;
}

export function restartAccount(g, now = Date.now()) {
  replaceSave(g, newGame(now));
  return { restarted: true };
}

export function newCommander(g, now = Date.now()) {
  if (!g.gameOver) throw new GameError('Your commander is still in charge: there is no Game Over to recover from.');
  const memorial = g.memorial || [], accents = g.classAccents, mothership = g.mothership, generation = (g.generation || 1) + 1;
  replaceSave(g, newGame(now));
  g.memorial = memorial;
  if (mothership !== undefined) g.mothership = mothership;
  g.generation = generation;
  if (accents) g.classAccents = accents;
  return { newCommander: generation };
}
