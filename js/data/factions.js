// Enemy factions and their units: three human factions here, six alien factions in aliens.js,
// plus shared ship systems.
import { ALIEN_FACTIONS } from './aliens.js';
//
// Visual identity rule: ONE silhouette, ONE palette, ONE movement style per faction, so players
// can tell them apart at a glance. The renderer reads `look`; the engine never does.
//
// Unit fields
//   stats    same 7 stats as Soldiers (stats.js)
//   weapon   an item id from gear.js (rarity 'standard' unless `rarity` set) - or null (unarmed)
//   cost     crew-budget points; ships spend their budget on units
//   tags     used by dmgVs modifiers and AI: human, synthetic, xeno, leader, melee, civilian, static
//   ai       'grunt' | 'rusher' (closes to melee) | 'anchor' (holds a doorway) | 'sniper' |
//            'support' (heals/buffs) | 'leader' (morale aura, stays back) | 'flee' (civilian) | 'turret'
//   aura     leaders only: moralePct for allies in the same room

const HUMAN_FACTIONS = [
  {
    id: 'pirates', name: 'Void Pirates',
    desc: 'Scrappy raiders in patched-together gear. Disorganised, aggressive, and they panic fast when the captain falls.',
    tags: ['human'],
    look: { silhouette: 'ragged coats, mismatched helmets, bandoliers', palette: ['#c4581c', '#7a3b16', '#d9a441'], movement: 'erratic, zig-zag rushes' },
    morale: -10,  // faction-wide grit modifier
    units: [
      { id: 'pirate_deckhand',  name: 'Deckhand',  cost: 2, ai: 'grunt',  weapon: 'smg_std',
        stats: { hp: 45, aim: 30, arm: 5,  spd: 50, grit: 30, tech: 5,  stl: 5 },  tags: ['human'] },
      { id: 'pirate_cutthroat', name: 'Cutthroat', cost: 3, ai: 'rusher', weapon: 'blade_std',
        stats: { hp: 50, aim: 35, arm: 5,  spd: 65, grit: 40, tech: 0,  stl: 20 }, tags: ['human', 'melee'] },
      { id: 'pirate_gunner',    name: 'Scattergunner', cost: 3, ai: 'anchor', weapon: 'shotgun_std',
        stats: { hp: 65, aim: 30, arm: 12, spd: 40, grit: 40, tech: 5,  stl: 0 },  tags: ['human'] },
      { id: 'pirate_captain',   name: 'Pirate Captain', cost: 6, ai: 'leader', weapon: 'pistol_std', rarity: 'prototype', aura: 20,
        stats: { hp: 110, aim: 50, arm: 18, spd: 50, grit: 70, tech: 15, stl: 5 }, tags: ['human', 'leader'] },
    ],
  },
  {
    id: 'corpsec', name: 'Corporate Security',
    desc: 'Clean, well-paid and drilled. They move in formation behind riot shields and call drones for backup.',
    tags: ['human'],
    look: { silhouette: 'smooth white armor, tall riot shields, visors', palette: ['#e8eef2', '#1fb5a8', '#2b3a44'], movement: 'tight formation, steady advance' },
    morale: 0,
    units: [
      { id: 'corp_crew',    name: 'Crew Member',    cost: 0, ai: 'flee',   weapon: null,
        stats: { hp: 30, aim: 10, arm: 0,  spd: 45, grit: 10, tech: 20, stl: 0 },  tags: ['human', 'civilian'] },
      { id: 'corp_guard',   name: 'Security Guard', cost: 2, ai: 'grunt',  weapon: 'pistol_std',
        stats: { hp: 50, aim: 35, arm: 10, spd: 45, grit: 35, tech: 10, stl: 0 },  tags: ['human'] },
      { id: 'corp_riot',    name: 'Riot Officer',   cost: 4, ai: 'anchor', weapon: 'shotgun_std',
        stats: { hp: 70, aim: 30, arm: 30, spd: 35, grit: 50, tech: 5,  stl: 0 },  tags: ['human'], shield: true },
      { id: 'corp_drone',   name: 'Security Drone', cost: 3, ai: 'grunt',  weapon: 'smg_std',
        stats: { hp: 35, aim: 45, arm: 15, spd: 60, grit: 100, tech: 0, stl: 0 },  tags: ['synthetic'] },
      { id: 'corp_chief',   name: 'Security Chief', cost: 6, ai: 'leader', weapon: 'carbine_std', rarity: 'milspec', aura: 15,
        stats: { hp: 100, aim: 50, arm: 25, spd: 45, grit: 65, tech: 30, stl: 0 }, tags: ['human', 'leader'] },
    ],
  },
  {
    id: 'military', name: 'Fleet Marines',
    desc: 'Professional soldiers. They use cover, flank, and dig in at chokepoints. Expect a real fight.',
    tags: ['human'],
    look: { silhouette: 'bulky olive plate, squared helmets, rifles held high', palette: ['#5b6b3a', '#8a8f86', '#2d331f'], movement: 'cover-to-cover bounds' },
    morale: 10,
    units: [
      { id: 'mil_marine',   name: 'Marine',          cost: 3, ai: 'grunt',   weapon: 'rifle_std',
        stats: { hp: 65, aim: 45, arm: 20, spd: 45, grit: 50, tech: 10, stl: 5 },  tags: ['human'] },
      { id: 'mil_heavy',    name: 'Heavy Marine',    cost: 5, ai: 'anchor',  weapon: 'lmg_std',
        stats: { hp: 95, aim: 35, arm: 35, spd: 35, grit: 60, tech: 5,  stl: 0 },  tags: ['human'] },
      { id: 'mil_engineer', name: 'Combat Engineer', cost: 4, ai: 'support', weapon: 'carbine_std',
        stats: { hp: 60, aim: 40, arm: 15, spd: 50, grit: 45, tech: 55, stl: 5 },  tags: ['human'], deploysTurret: true },
      { id: 'mil_sniper',   name: 'Marine Sniper',   cost: 4, ai: 'sniper',  weapon: 'sniper_std',
        stats: { hp: 50, aim: 65, arm: 10, spd: 45, grit: 45, tech: 10, stl: 25 }, tags: ['human'] },
      { id: 'mil_officer',  name: 'Lieutenant',      cost: 7, ai: 'leader',  weapon: 'rifle_std', rarity: 'prototype', aura: 25,
        stats: { hp: 110, aim: 55, arm: 30, spd: 45, grit: 80, tech: 25, stl: 5 }, tags: ['human', 'leader'] },
    ],
  },
];

// Ship systems: not crew, part of the ship. Turrets are placed by room features, not the crew budget.
export const SYSTEM_UNITS = [
  { id: 'sys_turret', name: 'Defense Turret', cost: 0, ai: 'turret', weapon: 'carbine_std',
    stats: { hp: 60, aim: 40, arm: 25, spd: 0, grit: 100, tech: 0, stl: 0 }, tags: ['synthetic', 'static'], hackable: true },
  // Fights for the SQUAD (Tech perk: Combat Drone). Lives in the unit table so the engine can build it like any unit.
  { id: 'sys_drone', name: 'Combat Drone', cost: 0, ai: 'drone', weapon: 'smg_std',
    stats: { hp: 40, aim: 45, arm: 10, spd: 60, grit: 100, tech: 0, stl: 10 }, tags: ['synthetic'] },
];

export const FACTIONS = [...HUMAN_FACTIONS, ...ALIEN_FACTIONS];
export const FACTION_BY_ID = Object.fromEntries(FACTIONS.map(f => [f.id, f]));
export const UNIT_BY_ID = Object.fromEntries(
  [...FACTIONS.flatMap(f => f.units.map(u => ({ ...u, faction: f.id }))), ...SYSTEM_UNITS.map(u => ({ ...u, faction: 'system' }))]
    .map(u => [u.id, u]));
