// Quartermaster (Ver. 0.22.0): a one-off Mothership purchase bolted onto the Armory, outside the normal room levels.
// Unlocks Auto-equip (js/game/quartermaster.js). Save: g.mothership.quartermaster = true (survives a Game Over like
// the rest of the Mothership). A damaged Armory switches it off until repaired, like every room bonus.
export const QUARTERMASTER = {
  id: 'quartermaster', name: 'Quartermaster', icon: '📦',
  price: 2000,                 // CREDs
  requires: { armory: 1 },     // the Armory must be built first
  desc: 'A full-time quartermaster for the Armory. Unlocks Auto-equip: one click outfits your highest-level Soldiers first with the best gear you own, picked to suit each class (Techs get Tech gear, Medics get healing gear, and so on).',
};

// Squad presets (Ver. 0.22.0): named squads saved with the account, each with a preferred entry method.
// Save: g.squads = [{ id, name, entry, squad: [soldier uid, ...] }] in marching order.
export const MAX_SQUAD_PRESETS = 8;
export const SQUAD_NAME_MAX = 24;
