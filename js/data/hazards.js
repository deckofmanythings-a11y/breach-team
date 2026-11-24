// Ship hazards. A hazard lives in a room and hits every unit inside it on its interval.
// hazardResistPct (MOD_KEYS) reduces damage and effect chance. Tech with the Hazard Control perk
// can shut down any hazard marked `hackable`. Alien hazards (spores, acid, hatching eggs,
// darkness, shifting gravity, possession) are added in Phase 7.
//
//   every    ticks between pulses
//   dmg      damage per pulse (ignores armor)
//   effect   optional status: 'pull' (dragged toward the breach, can be blown out if Downed),
//            'slow' (-30% speed), 'panic' (forces a panic check with `pressure`)
//   ticks    how long it lasts (0 = whole mission)
//   affects  'all' | 'organic' (synthetic units ignore it)

export const HAZARDS = {
  decompression: { name: 'Decompression', every: 10, dmg: 3, effect: 'pull', ticks: 120, affects: 'organic', hackable: true,
    desc: 'The hull is open to space. Everyone in the room takes damage and gets dragged toward the breach until the emergency seal closes.' },
  radiation:     { name: 'Radiation Leak', every: 20, dmg: 2, effect: null, ticks: 0, affects: 'organic', hackable: true,
    desc: 'A leaky reactor. Slow, steady damage to anything with a pulse.' },
  fire:          { name: 'Fire', every: 10, dmg: 4, effect: 'panic', pressure: 10, ticks: 80, affects: 'all', hackable: false,
    desc: 'Started by flamers and explosions. Burns out on its own.' },
};
