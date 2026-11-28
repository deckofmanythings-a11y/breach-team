// Intel Room scouting (docs/MOTHERSHIP.md, M6). New file on purpose (stale-cache rule).
//
// With an Intel Room, a mission's crew and optional objectives are rolled from a PUBLIC per-ship
// scout seed (input.mapSeed, input.scouted = true, engine v6+) instead of the secret battle seed,
// so the client can show them before boarding. The map comes from the same seed. Where each unit
// stands, and the whole fight, still roll from the battle seed the server picks at deploy.
import { createRng, hashString } from './rng.js';
import { generateShip } from './mapgen.js';
import { shipAt } from './ship-at.js';
import { UNIT_BY_ID } from '../data/factions.js';
import { SHIP_BY_ID, OBJECTIVES } from '../data/ships.js';
import { SUICIDE_SQUAD } from '../data/suicide-squad.js';
import { roomLevel } from '../data/mothership-rooms.js';
import { ENGINE_VERSION } from '../data/version.js';

// Intel Room level that counts (a damaged room scouts nothing).
export const intelLevel = (g) => (g?.mothership?.damaged?.intel ? 0 : roomLevel(g, 'intel'));

// The scout seed for a ship. Changes after every mission (g.missions), differs per commander.
export const scoutSeed = (g, shipId) => hashString(`scout:${shipId}:${g.missions || 0}:${g.generation || 0}:${g.created || 0}`) >>> 0;

// Crew, civilians and optional objectives for a scouted mission. ship = shipAt(...) as the engine
// sees it, map = the mission's map. Rooms are map room ids; the engine moves anything planned for
// the squad's own entry room elsewhere. Same order and odds as the unscouted roll in battle.js.
export function scoutPlan(ship, map, mapSeed, noRetreat = false) {
  const rng = createRng(hashString('scout:' + mapSeed + ':' + ship.id));
  const crewRooms = map.rooms.filter(r => r.id !== map.airlock);
  let budget = noRetreat ? Math.floor((ship.crewBudget * SUICIDE_SQUAD.crewPct) / 100) : ship.crewBudget;
  const weights = Object.entries(ship.unitWeights).filter(([id]) => UNIT_BY_ID[id].cost > 0);
  const cheapest = Math.min(...weights.map(([id]) => UNIT_BY_ID[id].cost));
  const crew = [];
  let guard = 0;
  while (budget >= cheapest && guard++ < 100) {
    let total = 0; for (const [, w] of weights) total += w;
    let r = rng.int(total), pick = weights[0][0];
    for (const [id, w] of weights) { if (r < w) { pick = id; break; } r -= w; }
    const cost = UNIT_BY_ID[pick].cost;
    if (cost > budget) continue;
    budget -= cost;
    crew.push({ kind: pick, room: rng.roll(20) ? map.bridge : crewRooms[rng.int(crewRooms.length)].id });
  }
  const civilians = [];
  const civ = ship.civilians[0] + rng.int(ship.civilians[1] - ship.civilians[0] + 1);
  if (Object.keys(ship.unitWeights).some(id => UNIT_BY_ID[id].ai === 'flee')) for (let i = 0; i < civ; i++) civilians.push(crewRooms[rng.int(crewRooms.length)].id);
  const avail = ship.optional.filter(o => map.rooms.some(r => r.type === OBJECTIVES[o].room));
  const n = Math.min(avail.length, rng.roll(50) ? 2 : 1);
  const objectives = [];
  for (let i = 0; i < n; i++) {
    const id = avail.splice(rng.int(avail.length), 1)[0];
    const rooms = map.rooms.filter(r => r.type === OBJECTIVES[id].room);
    objectives.push({ id, room: rooms[rng.int(rooms.length)].id });
  }
  return { crew, civilians, objectives };
}

// Everything the Deploy screen shows for a scouted ship: { level, mapSeed, ship, map, plan }.
export function scoutReport(g, shipId, noRetreat = false) {
  const level = intelLevel(g), def = SHIP_BY_ID[shipId];
  if (!level || !def || def.secret) return null;
  const ship = shipAt(def, ENGINE_VERSION), mapSeed = scoutSeed(g, shipId);
  const map = generateShip(createRng(hashString('map:' + mapSeed + ':' + ship.id)), ship.id, ENGINE_VERSION);
  return { level, mapSeed, ship, map, plan: scoutPlan(ship, map, mapSeed, noRetreat) };
}
