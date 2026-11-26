// Mothership defense EVENTS (docs/MOTHERSHIP.md, phase M5): when a defense happens, which threat a
// roster faces, and the stakes. The fight itself is the engine's defend mode (data/threats.js).
// New file on purpose (stale-cache rule).
import { THREAT_BY_ID } from './threats.js';
import { MS_ROOMS, ROOM_PRICES, roomLevel, roomEffect } from './mothership-rooms.js';

export const DEFENSE_EVENTS = {
  minMissions: 12,        // never before a commander's 12th mission
  cooldown: 8,            // at least 8 missions between two defenses
  basePct: 4,             // chance per mission after that
  alienPct: 12,           // ...after boarding an alien ship (and then it's always an outbreak)
  topDefenders: 6,        // threat strength follows the average level of the 6 best Soldiers aboard
  salvage: [0, 150, 250, 400],   // BUCs for a won defense, by threat tier (times power %)
  theftPct: { lost: 25, wipe: 40 },          // % of BUCs the attackers carry off
  damagedRooms: { lost: 1, wipe: 2 },        // rooms knocked out until repaired
  repairPct: 50,          // repair = this % of what the room's current level cost
};

// Chance (%) that this mission is followed by a defense. g = the save AFTER the mission was applied.
export function defenseChance(g, shipDef) {
  const E = DEFENSE_EVENTS;
  if ((g.missions || 0) < E.minMissions || g.gameOver) return 0;
  if (g.lastDefense !== undefined && g.missions - g.lastDefense < E.cooldown) return 0;
  return shipDef?.alien ? E.alienPct : E.basePct;
}

// Who is aboard: everyone not Missing (wounded Soldiers fight too, with their injuries).
export const defenders = (g) => g.soldiers.filter(s => s.status !== 'mia');

// The threat and its power for this roster. Tuned so a 6-Soldier roster on a bare ship wins
// roughly 80% (see docs/CODEX.md for the measured table).
export function pickThreat(roster, shipDef) {
  const top = roster.map(s => s.level).sort((a, b) => b - a).slice(0, DEFENSE_EVENTS.topDefenders);
  const L = top.length ? Math.floor(top.reduce((a, b) => a + b, 0) / top.length) : 1;
  if (shipDef?.alien) return { threat: 'hive_outbreak', power: L < 5 ? 60 : Math.min(120, 90 + 5 * (L - 5)), level: L };
  if (L <= 2) return { threat: 'corp_repo', power: 100, level: L };
  if (L <= 4) return { threat: 'pirate_raid', power: L === 3 ? 90 : 100, level: L };
  return { threat: 'marine_strike', power: Math.min(120, 90 + 5 * (L - 5)), level: L };
}

export const salvageFor = (threatId, power) => Math.floor((DEFENSE_EVENTS.salvage[THREAT_BY_ID[threatId]?.tier || 1] * power) / 100);

// Room damage. g.mothership.damaged = { roomId: true }; a damaged room's bonus is off until repaired.
export const isDamaged = (g, id) => !!g?.mothership?.damaged?.[id];
export function damageableRooms(g) {
  return MS_ROOMS.filter(r => !r.soon && !isDamaged(g, r.id) && Object.keys(roomEffect(r.id, roomLevel(g, r.id))).length).map(r => r.id);
}
export function repairPrice(g, id) {
  const lv = roomLevel(g, id);
  return isDamaged(g, id) && lv > 0 ? Math.floor((ROOM_PRICES[lv - 1] * DEFENSE_EVENTS.repairPct) / 100) : null;
}
