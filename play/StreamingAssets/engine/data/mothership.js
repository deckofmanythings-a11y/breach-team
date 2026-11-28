// Mothership: FUTURE feature (Phase 9). Reserved now so adding it later doesn't change the engine's
// input shape. The engine always receives `mothershipBonuses`; until Phase 9 it's ZERO_BONUSES.
// Facilities will use the MOD_KEYS vocabulary (stats.js), applied squad-wide.

export const MOTHERSHIP_ENABLED = false;

export const FACILITIES = [
  { id: 'med_bay',        name: 'Med Bay',          idea: 'Injuries heal faster; better aftermath survival.',     mods: { healTimePct: 0, survivalPct: 0 } },
  { id: 'training_deck',  name: 'Training Deck',    idea: 'More XP per mission; idle Soldiers slowly train.',      mods: { xpPct: 0 } },
  { id: 'armory',         name: 'Armory',           idea: 'Store discounts, item upgrades.',                       mods: {} },
  { id: 'teleport_array', name: 'Teleporter Array', idea: 'Fewer teleport misfires on entry and recall.',          mods: {} },
  { id: 'hangar',         name: 'Hangar',           idea: 'Bigger shuttle (+1 squad size), faster shuttle return.', mods: {} },
  { id: 'intel_room',     name: 'Intel Room',       idea: 'Reveals part of the ship layout and crew before boarding.', mods: {} },
];

export const ZERO_BONUSES = Object.freeze({ mods: Object.freeze({}), entry: Object.freeze({}), retreat: Object.freeze({}), after: Object.freeze({}) });
// Phase M2: the real rooms live in js/data/mothership-rooms.js (FACILITIES above is the old placeholder list).
