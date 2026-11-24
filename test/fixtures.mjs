// Test squads: deterministic soldiers at a given level with gear of a given rarity.
import { createRng } from '../js/engine/rng.js';
import { growSoldier } from '../js/engine/progression.js';

const KIT = {
  assault:     { weapon: 'carbine_std', armor: 'armor_medium', utility: 'frag_grenades', implant: 'reflex_booster' },
  breacher:    { weapon: 'shotgun_std', armor: 'armor_medium', utility: 'breach_kit',    implant: 'dermal_plating' },
  marksman:    { weapon: 'sniper_std',  armor: 'armor_light',  utility: 'smoke_grenades', implant: 'targeting_eye' },
  medic:       { weapon: 'smg_std',     armor: 'armor_light',  utility: 'medkit',        implant: 'pain_editor' },
  tech:        { weapon: 'arc_std',     armor: 'armor_light',  utility: 'hack_rig',      implant: 'neural_link' },
  heavy:       { weapon: 'lmg_std',     armor: 'armor_heavy',  utility: 'frag_grenades', implant: 'dermal_plating' },
  infiltrator: { weapon: 'blade_std',   armor: 'armor_stealth', utility: 'smoke_grenades', implant: 'reflex_booster' },
};
const STARTER_SLOTS = ['weapon', 'armor'];   // level-1 starter squads only have weapon + armor

// specs: array of specialty ids. rarity: gear rarity. full: all 4 slots (else weapon+armor only).
export function makeSquad(seed, specs, level = 1, rarity = 'standard', full = level > 1) {
  const rng = createRng(seed);
  return specs.map((sp, i) => {
    const g = growSoldier(rng, sp, level);
    const gear = {};
    for (const slot of full ? ['weapon', 'armor', 'utility', 'implant'] : STARTER_SLOTS) gear[slot] = { base: KIT[sp][slot], rarity, affixes: [] };
    return { uid: 'u' + i, name: sp + i, specialty: sp, level, stats: g.stats, perks: g.perks, gear, injuries: [] };
  });
}

export const STARTER = ['assault', 'breacher', 'marksman', 'medic'];
