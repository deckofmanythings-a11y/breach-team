// Mothership rooms (docs/MOTHERSHIP.md, phase M2). Bought and upgraded with CREDs.
// Save shape: g.mothership = { rooms: { [id]: level } }. A missing room is level 0 (not built),
// except rooms with `start`, which every Mothership has from the beginning.
//
// Effect keys per level (each level lists its TOTAL effect, not the step):
//   healTimePct, survivalPct, xpPct   aftermath (injury heal time, death-roll survival, mission XP)
//   grit                              squad-wide stat on missions (engine mods)
//   storePct                          price change on everything in the Store (packs + daily stock)
//   teleportFailPct                   change to teleport misfires: Teleport entry and Teleport Recall
//   shuttleArrivePct                  change to how long the shuttle takes to come for a retreat
//   squadAdd                          extra squad size on every entry (still capped at MAX_DEPLOY)
import { MAX_DEPLOY } from './economy.js';

export const ROOM_PRICES = [600, 1800, 4000];   // CREDs to reach level 1 / 2 / 3

export const MS_ROOMS = [
  { id: 'hangar', name: 'Hangar', icon: '🚀', start: 1,
    desc: 'Where the shuttle and boarding pods live. Upgrades get your squad out faster and bigger.',
    levels: [{}, { shuttleArrivePct: -50 }, { shuttleArrivePct: -50, squadAdd: 1 }] },
  { id: 'med_bay', name: 'Med Bay', icon: '✚',
    desc: 'A proper surgery deck. Injuries heal faster, and at full spec it saves lives.',
    levels: [{ healTimePct: -10 }, { healTimePct: -20 }, { healTimePct: -30, survivalPct: 5 }] },
  { id: 'training_deck', name: 'Training Deck', icon: '🎯',
    desc: 'Firing ranges and sims. Soldiers learn more from every mission (and earn more CREDs).',
    levels: [{ xpPct: 5 }, { xpPct: 10 }, { xpPct: 15 }] },
  { id: 'armory', name: 'Armory', icon: '🛠',
    desc: 'Your own quartermaster haggles with suppliers. Everything in the Store costs less.',
    levels: [{ storePct: -5 }, { storePct: -10 }, { storePct: -15 }] },
  { id: 'teleporter', name: 'Teleporter Array', icon: '✦',
    desc: 'A stronger lock-on for beaming in and out. Fewer teleport misfires, and none at full spec.',
    levels: [{ teleportFailPct: -33 }, { teleportFailPct: -66 }, { teleportFailPct: -100 }] },
  { id: 'chapel', name: 'Memorial Chapel', icon: '🕯',
    desc: 'The names of the fallen, where everyone walks past them. The squad fights with more Grit.',
    levels: [{ grit: 4 }, { grit: 8 }, { grit: 12 }] },
  // Later phases (shown as "coming later", can't be built yet).
  { id: 'intel', name: 'Intel Room', icon: '📡', soon: 'with the Mothership map',
    desc: 'Scouts the target before you board: crew size, objectives, and eventually the map.', levels: [] },
  { id: 'security', name: 'Security Post', icon: '🛡', soon: 'with Mothership defense',
    desc: 'Turrets and blast doors for when someone boards YOU.', levels: [] },
  { id: 'quarantine', name: 'Quarantine Bay', icon: '☣', soon: 'with Mothership defense',
    desc: 'Keeps whatever you brought back from alien ships locked away.', levels: [] },
];
export const MS_ROOM_BY_ID = Object.fromEntries(MS_ROOMS.map(r => [r.id, r]));
export const MAX_ROOM_LEVEL = ROOM_PRICES.length;

export function roomLevel(g, id) {
  const r = MS_ROOM_BY_ID[id];
  return g?.mothership?.rooms?.[id] ?? (r?.start || 0);
}
// Price to reach the next level, or null when maxed / not buildable.
export function nextRoomPrice(g, id) {
  const r = MS_ROOM_BY_ID[id];
  if (!r || r.soon) return null;
  const lv = roomLevel(g, id);
  return lv >= MAX_ROOM_LEVEL ? null : ROOM_PRICES[lv];
}
export const roomEffect = (id, level) => (level > 0 ? MS_ROOM_BY_ID[id]?.levels[level - 1] || {} : {});

// Summed effects of every room this Mothership has. Rooms damaged in a lost defense (M5) count for
// nothing until repaired.
export function mothershipEffects(g) {
  const out = {};
  for (const r of MS_ROOMS) if (!g?.mothership?.damaged?.[r.id]) for (const [k, v] of Object.entries(roomEffect(r.id, roomLevel(g, r.id)))) out[k] = (out[k] || 0) + v;
  return out;
}

// What a mission takes from the Mothership: the engine input's `mothership` field (null = nothing
// to add, so the input stays exactly as it was before rooms existed).
export function mothershipInput(g) {
  const e = mothershipEffects(g);
  const pick = (keys) => { const o = {}; for (const k of keys) if (e[k]) o[k] = e[k]; return o; };
  const ms = { mods: pick(['grit']), entry: pick(['teleportFailPct', 'squadAdd']), retreat: pick(['teleportFailPct', 'shuttleArrivePct']),
    after: pick(['xpPct', 'healTimePct', 'survivalPct']) };
  return Object.values(ms).some(o => Object.keys(o).length) ? ms : null;
}

export const entryMaxSquad = (entry, msEntry) => Math.min(MAX_DEPLOY, entry.maxSquad + (msEntry?.squadAdd || 0));
// Integer % scaling used by the engine: scalePct(8, -33) = 5.
export const scalePct = (n, pct) => Math.max(0, Math.floor((n * (100 + (pct || 0))) / 100));
export const storePrice = (g, price) => scalePct(price, mothershipEffects(g).storePct);

// Player-facing text for one level's effect.
export function describeEffect(eff) {
  const parts = [];
  if (eff.healTimePct) parts.push(`Injuries heal ${-eff.healTimePct}% faster`);
  if (eff.survivalPct) parts.push(`+${eff.survivalPct}% death-roll survival`);
  if (eff.xpPct) parts.push(`+${eff.xpPct}% mission XP`);
  if (eff.grit) parts.push(`+${eff.grit} Grit for the squad on missions`);
  if (eff.storePct) parts.push(`Store prices ${eff.storePct}%`);
  if (eff.teleportFailPct) parts.push(eff.teleportFailPct <= -100 ? 'No teleport misfires' : `${-eff.teleportFailPct}% fewer teleport misfires`);
  if (eff.shuttleArrivePct) parts.push(`Retreat shuttle arrives ${-eff.shuttleArrivePct}% faster`);
  if (eff.squadAdd) parts.push(`+${eff.squadAdd} squad size on every entry (max ${MAX_DEPLOY})`);
  return parts.join(' · ') || 'Basic facilities';
}
