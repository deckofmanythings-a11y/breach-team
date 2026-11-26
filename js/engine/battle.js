// The boarding-action simulation. Pure, deterministic, integer-only.
// simulate(input) -> { result, ticks, events, soldiers, objectives, ... , hash }
// The same input always gives the same output (server re-simulates ladder runs and compares hash).
//
// input = {
//   seed, ship, entry, tactic, retreat,         // ids from js/data
//   squad: [{ uid, name, specialty, level, stats, perks, gear: {weapon, armor, utility, implant}, injuries }],
//   mothership,                                 // ZERO_BONUSES until Phase 9
//   mapSeed?                                    // optional: separate map seed (Weekly Contract = same map)
// }
import { createRng, hashString, fnv1a } from './rng.js';
import { generateShip, T_FLOOR, T_DOOR } from './mapgen.js';
import { CLOCK, pushChance } from '../data/clock.js';
import { shipAt } from './ship-at.js';
import { sumMods, applyStatMods, itemMods, weaponProfile } from './progression.js';
import { hitChance, critChance, applyDamage, evasionOf, ticksPerTile, panicChance, detectChance, RETREAT_AT_TICK, HARD_END_TICK } from '../data/stats.js';
import { SPECIALTIES, SPECIALTY_BY_ID, ABILITIES } from '../data/specialties.js';
import { ITEM_BY_ID, SLOTS } from '../data/gear.js';
import { TACTIC_BY_ID } from '../data/tactics.js';
import { ENTRY_BY_ID, RETREAT_BY_ID } from '../data/entries.js';
import { SUICIDE_SQUAD } from '../data/suicide-squad.js';
import { entryMaxSquad, scalePct } from '../data/mothership-rooms.js';
import { FACTION_BY_ID, UNIT_BY_ID } from '../data/factions.js';
import { SHIP_BY_ID, OBJECTIVES } from '../data/ships.js';
import { HAZARDS } from '../data/hazards.js';
import { INJURY_BY_ID } from '../data/injuries.js';
import { ZERO_BONUSES } from '../data/mothership.js';
import { ENGINE_VERSION } from '../data/version.js';
import { buildMothershipMap } from './mothership-map.js';
import { scoutPlan } from './scout.js';
import { THREAT_BY_ID, DEFENSE, DEFEND_OBJECTIVE, waveBudget } from '../data/threats.js';
import { stationRoom, defenseShip, HOME_ENTRY, HOME_RETREAT } from './defense-setup.js';

// Special-effect flags (perks, gear, tactics) the engine actually implements. test/data-check.mjs
// warns about any flag in the data that isn't listed here, so nothing silently does nothing.
export const IMPLEMENTED_FLAGS = ['chargeKnockdown', 'adrenaline', 'longStun', 'closeQuarters', 'silentShot', 'killZone',
  'squadSurvival', 'squadHealTime', 'turnTurrets', 'stopReinforcements', 'noPanic', 'fortressAura', 'bulletStorm',
  'stealthCrit', 'autoCloak', 'longCloak', 'closeRangePenalty',
  'runAndGun', 'spearhead', 'killingSpree', 'doorwayBonus', 'chainBreach', 'stims', 'smokeRevive', 'disableHazards',
  'drone', 'sabotage', 'grenade', 'smoke', 'tracker', 'meleeMaster', 'slowBladeWeak'];

const PERK_BY_ID = {};
for (const sp of SPECIALTIES) for (const pair of sp.perks) for (const p of pair) PERK_BY_ID[p.id] = p;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const SIGHT = 16;
const COHESION = 6;            // squad members don't get more than this many steps ahead of the rearmost
const ALARM_1 = 30, ALARM_2 = 100;
const SPOT_NOISE = 40;         // alarm added when an enemy first spots the squad
const FORCE_DOOR_TICKS = 80;   // anyone can force a locked door, slowly
const OPEN_DOOR_TICKS = 3;
const REVIVE_HP_PCT = 30;
const GRENADE = { charges: 2, dmg: [16, 24], range: 6, cd: 60, noise: 12 };   // Frag Grenades: blast hits the target tile + all 8 around it
const SMOKE = { charges: 1, ticks: 60, triggerHpPct: 60 };                   // Smoke Grenades: popped automatically when hurt below 60% HP
const STIM = { ticks: 40, dmgPct: 20 };                                        // Combat Stims
const SPEARHEAD = { ticks: 40, dmgTakenPct: -25 };
const FIRE_START_PCT = 15;                                                     // flamer hit sets the room on fire
const SABOTAGE_TICKS = { turret: 20, reactor: 40 };
const ENEMY_AI = {
  grunt:   { aggression: 50, coverUse: 50, rangePct: 80, hunts: true },
  rusher:  { aggression: 100, coverUse: 0, rangePct: 10, hunts: true },
  anchor:  { aggression: 10, coverUse: 80, rangePct: 100, hunts: false, stayInRoom: true },
  sniper:  { aggression: 0, coverUse: 70, rangePct: 120, hunts: false, stayInRoom: true },
  static:  { aggression: 0, coverUse: 0, rangePct: 100, hunts: false, stayInRoom: true },
  hunter:  { aggression: 100, coverUse: 0, rangePct: 10, hunts: true },
  support: { aggression: 40, coverUse: 60, rangePct: 90, hunts: true },
  leader:  { aggression: 20, coverUse: 80, rangePct: 100, hunts: false, stayInRoom: true },
};

export function simulate(input) {
  // Mothership defense (v5+): the squad defends its own ship (docs/MOTHERSHIP.md, M4).
  // input = { engineVersion, mode: 'defend', seed, threat, power?, rooms: {roomId: level}, tactic?, squad, mothership? }
  const defend = input.mode === 'defend';
  const threat = defend ? THREAT_BY_ID[input.threat] : null;
  if (defend && ((input.engineVersion ?? 1) < 5 || !threat)) throw new Error('bad mission input');
  const ship = defend ? defenseShip(threat) : shipAt(SHIP_BY_ID[input.ship], input.engineVersion ?? 1);
  const tactic = TACTIC_BY_ID[input.tactic || (defend ? 'balanced' : '')];
  const entry = defend ? HOME_ENTRY : ENTRY_BY_ID[input.entry];
  const retreatDef = defend ? HOME_RETREAT : RETREAT_BY_ID[input.retreat];
  const faction = FACTION_BY_ID[ship.faction];
  const mothership = input.mothership || ZERO_BONUSES;
  if (!ship || !tactic || !entry || !retreatDef) throw new Error('bad mission input');
  const msEntry = mothership.entry || {}, msRetreat = mothership.retreat || {};   // Mothership rooms (absent = no change)
  if (!input.squad?.length || input.squad.length > (defend ? DEFENSE.maxDefenders : entryMaxSquad(entry, msEntry))) throw new Error('bad squad size');

  const ENTRY_V7 = ['podShock', 'podClose', 'podSquadAdd', 'ventClose', 'ventAmbush', 'ventSquadAdd'];
  if ((input.engineVersion ?? 1) < 7 && ENTRY_V7.some(k => msEntry[k])) throw new Error('bad mission input');
  // Pod Bay / Infiltration Suite (v7+; the keys can't appear before): only their own entry uses them.
  const isPod = entry.id === 'breach_pod', isVent = entry.id === 'vent_crawl';
  const setupTicks = entry.setupTicks;
  const ventAmbush = isVent && !!msEntry.ventAmbush;   // Infiltration Suite L2: shots from hiding always crit

  const seed = input.seed >>> 0;
  const map = defend ? buildMothershipMap({ mothership: { rooms: input.rooms || {} } })
    : generateShip(createRng(hashString('map:' + (input.mapSeed ?? seed) + ':' + ship.id)), ship.id, input.engineVersion ?? 1);
  const power = defend ? Math.max(25, Math.min(400, Math.floor(input.power ?? 100))) : 100;
  // input.damaged (M6): rooms damaged in an earlier lost defense. They're still on the map but give
  // nothing: no bonus, no turrets, no containment. Old v5 inputs have no field, so nothing changes.
  const damaged = new Set(defend ? input.damaged || [] : []);
  const msRoomOf = (type) => (defend ? map.rooms.find(r => r.type === type && !damaged.has(r.key)) || null : null);
  const armoryRoom = msRoomOf('armory'), medBay = msRoomOf('medbay');
  const rng = createRng(hashString('sim:' + seed));
  const V = input.engineVersion ?? 1;      // engine version this mission was fought on (gates v2-only behaviour)
  const intelAim = V >= 6 && msRoomOf('intel') ? DEFENSE.intelAim * msRoomOf('intel').level : 0;   // Intel Room sensors track every boarder
  const noRetreat = !!retreatDef.noRetreat;  // Suicide Squad: never falls back (v4+ only)
  if (noRetreat && V < 4) throw new Error('bad mission input');
  // Intel Room (v6+): crew and objectives come from the public scout seed (input.mapSeed), not the battle seed.
  const scouted = !!input.scouted;
  if (scouted && (V < 6 || defend || input.mapSeed === undefined)) throw new Error('bad mission input');
  const plan = scouted ? scoutPlan(ship, map, input.mapSeed, noRetreat) : null;
  const DARK_SIGHT = 6, ACID_DMG = 6, EGG_RANGE = 3, POSSESS_TICKS = 100, GRAVITY_EVERY = 120;
  const GRAVITY_CYCLE = ['normal', 'heavy', 'normal', 'zero'];
  const gravityNow = () => (ship.gravity ? GRAVITY_CYCLE[Math.floor(t / GRAVITY_EVERY) % 4] : 'normal');
  const W = map.w, idx = (x, y) => y * W + x;
  const events = [];
  const ev = (...a) => events.push(a);
  let t = 0;

  // ---------- Map helpers ----------
  const doorAt = new Int16Array(W * map.h).fill(-1);
  for (const d of map.doors) doorAt[idx(d.x, d.y)] = d.id;
  const roomAdj = map.rooms.map(() => []);
  for (const d of map.doors) { roomAdj[d.a].push(d.b); roomAdj[d.b].push(d.a); }
  const nearDoorGrid = new Uint8Array(W * map.h);
  for (const d of map.doors) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nearDoorGrid[idx(d.x + dx, d.y + dy)] = 1;
  const clouds = [];   // smoke: { x, y, until } covers a 3x3 area
  const inSmoke = (u) => clouds.some(c => c.until > t && Math.abs(c.x - u.x) <= 1 && Math.abs(c.y - u.y) <= 1);
  const passable = (x, y) => { const v = map.tiles[idx(x, y)]; return v === T_FLOOR || v === T_DOOR; };
  const occ = new Int16Array(W * map.h).fill(-1);
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  function los(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    let x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (x === x1 && y === y1) break;
      const v = map.tiles[idx(x, y)];
      if (v === T_FLOOR) continue;
      if (v === T_DOOR && map.doors[doorAt[idx(x, y)]].open) continue;
      return false;
    }
    return true;
  }

  // Distance fields (BFS, 8-dir, no corner cutting). Cached by target tile.
  const fieldCache = new Map();
  function field(tx, ty) {
    const key = idx(tx, ty);
    let f = fieldCache.get(key);
    if (f) return f;
    f = new Int32Array(W * map.h).fill(-1);
    f[key] = 0; const q = [key]; let qi = 0;
    while (qi < q.length) {
      const c = q[qi++], cx = c % W, cy = (c - cx) / W;
      for (const [ddx, ddy] of DIRS) {
        const nx = cx + ddx, ny = cy + ddy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
        const n = idx(nx, ny);
        if (f[n] >= 0 || !passable(nx, ny)) continue;
        if (ddx && ddy && (!passable(cx + ddx, cy) || !passable(cx, cy + ddy))) continue;
        f[n] = f[c] + 1; q.push(n);
      }
    }
    if (fieldCache.size > 96) fieldCache.delete(fieldCache.keys().next().value);
    fieldCache.set(key, f);
    return f;
  }
  const consoleField = () => field(map.console[0], map.console[1]);

  // ---------- Units ----------
  const units = [];
  function addUnit(u) {
    u.id = units.length; u.state = 'active'; u.busy = u.busy || 0; u.cd = 0;
    u.stunUntil = 0; u.panicUntil = 0; u.suppUntil = 0; u.cloakUntil = 0; u.owUntil = 0; u.owShots = 0;
    u.task = null; u.hidden = !!u.hidden;
    u.grenades = u.flags?.grenade ? GRENADE.charges : 0; u.grenadeCd = 0; u.smokes = u.flags?.smoke ? SMOKE.charges : 0;
    u.stimUntil = 0; u.spearUntil = 0;
    u.tally = { kills: 0, dmgDealt: 0, dmgTaken: 0, minHp: u.hp, downed: 0, ticksDown: 0, overkillPct: 0, revives: 0, hacks: 0, breaches: 0, assists: 0, shots: 0, hits: 0 };
    units.push(u);
    if (u.state === 'active') occ[idx(u.x, u.y)] = u.id;
    return u;
  }
  const flagsOf = (list) => { const f = {}; for (const x of list) if (x) f[x] = true; return f; };

  function soldierUnit(s) {
    const sp = SPECIALTY_BY_ID[s.specialty];
    const gear = SLOTS.map(sl => s.gear?.[sl]).filter(Boolean);
    const perks = (s.perks || []).map(id => PERK_BY_ID[id]).filter(Boolean);
    const mods = sumMods([...gear.map(itemMods), ...perks.map(p => p.mods), tactic.mods, entry.mods, mothership.mods,
      ...(s.injuries || []).map(id => INJURY_BY_ID[id]?.mods)]);
    const st = applyStatMods(s.stats, mods);
    const wInst = s.gear?.weapon || { base: 'pistol_std', rarity: 'standard', affixes: [] };
    const w = weaponProfile(wInst); w.range += mods.rangeAdd || 0; w.type = ITEM_BY_ID[wInst.base].type;
    return {
      side: 'S', uid: s.uid, name: s.name, kind: s.specialty, spec: sp, ai: 'squad', tags: ['human'],
      st, m: mods, w, hp: st.hp, maxHp: st.hp, x: 0, y: 0,
      flags: flagsOf([...perks.map(p => p.flag), ...gear.map(g => ITEM_BY_ID[g.base].flag), tactic.flag]),
      ability: sp.ability, hidden: !!(tactic.hidden || entry.startsHidden),
    };
  }
  function enemyUnit(unitId, x, y, extra = {}) {
    const def = UNIT_BY_ID[unitId];
    const wInst = def.weapon ? { base: def.weapon, rarity: def.rarity || 'standard', affixes: [] } : null;
    const mods = wInst ? itemMods(wInst) : {};
    const base = { ...def.stats, grit: def.stats.grit + (def.faction === 'system' ? 0 : (FACTION_BY_ID[def.faction].morale || 0)) };
    const st = applyStatMods(base, mods);
    let w = null;
    if (wInst) { w = weaponProfile(wInst); w.range += mods.rangeAdd || 0; w.type = ITEM_BY_ID[wInst.base].type; }
    return addUnit({
      side: 'E', name: def.name, kind: unitId, ai: def.ai, tags: def.tags, st, m: mods, w,
      hp: st.hp, maxHp: st.hp, x, y, flags: flagsOf(def.flags || []), aura: def.aura || 0, alerted: false,
      leader: def.tags.includes('leader'), civilian: def.tags.includes('civilian'), turret: def.ai === 'turret',
      deploysTurret: !!def.deploysTurret, hidden: (def.flags || []).includes('ambush'),
      immuneGravity: !!FACTION_BY_ID[def.faction]?.immuneGravity, spawnDef: def.spawns || null, nextSpawn: 0, spawned: 0,
      sporeRadius: def.sporeRadius || 0, nextPulse: 0, ...extra,
    });
  }

  function freeTileIn(roomId, preferCover = false) {
    const r = map.rooms[roomId];
    const cands = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const k = idx(x, y);
      if (occ[k] < 0 && doorAt[k] < 0) cands.push(k);
    }
    if (!cands.length) return null;
    let pool = cands;
    if (preferCover) { const c = cands.filter(k => map.cover[k]); if (c.length) pool = c; }
    const k = pool[rng.int(pool.length)];
    return [k % W, (k - (k % W)) / W];
  }
  function freeTileNear(x0, y0) {
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= W || y >= map.h) continue;
      if (map.tiles[idx(x, y)] === T_FLOOR && occ[idx(x, y)] < 0) return [x, y];
    }
    return null;
  }

  // ---------- Squad spawn ----------
  const nonBridge = map.rooms.filter(r => r.id !== map.bridge);
  let spawnRoom;
  if (defend) spawnRoom = -1;   // everyone starts at their own station
  else if (entry.spawn === 'airlock') spawnRoom = map.airlock;
  else if (entry.spawn === 'any_room') {
    let c = []; for (const d of [3, 2, 1]) { if (!c.length) c = nonBridge.filter(r => map.distFromBridge[r.id] === d); } spawnRoom = c[rng.int(c.length)].id;
  } else if (entry.spawn === 'hull') {
    const c = nonBridge.filter(r => r.outer && map.distFromBridge[r.id] >= (isPod && msEntry.podClose ? 1 : 2))   // Pod Bay L2: may land next to the Bridge
      .sort((a, b) => map.distFromBridge[a.id] - map.distFromBridge[b.id] || a.id - b.id);
    const best = c.filter(r => map.distFromBridge[r.id] === map.distFromBridge[c[0].id]);
    spawnRoom = best[rng.int(best.length)].id;
  } else {
    const near = isVent && msEntry.ventClose ? 1 : 0;   // Infiltration Suite: one room closer
    let c = nonBridge.filter(r => map.distFromBridge[r.id] >= 2 - near && map.distFromBridge[r.id] <= 4 - near && r.features.some(f => f.kind === 'vent'));
    if (!c.length) c = nonBridge.filter(r => map.distFromBridge[r.id] >= 1 && map.distFromBridge[r.id] <= 4);
    spawnRoom = c[rng.int(c.length)].id;
  }

  const squad = [];
  for (const s of input.squad) {
    const u = soldierUnit(s);
    if (defend) {
      // Every 4th Soldier is on Bridge watch; the rest are at their usual stations.
      u.guard = squad.length % DEFENSE.guardEvery === DEFENSE.guardEvery - 1;
      const room = u.guard ? map.bridge : stationRoom(map, s), r = map.rooms[room];
      const pos = freeTileIn(room, true) || freeTileNear(r.cx, r.cy);
      u.x = pos[0]; u.y = pos[1]; u.busy = DEFENSE.reactTicks; u.hidden = false;
      squad.push(addUnit(u));
      ev(0, 'spawn', u.id, 'S', u.kind, u.x, u.y);
      continue;
    }
    let room = spawnRoom, late = 0;
    const scramble = entry.id === 'teleport' ? scalePct(entry.scramblePct + ship.scrambleAdd, msEntry.teleportFailPct) : entry.scramblePct + ship.scrambleAdd;
    if ((entry.id === 'teleport' ? scramble : entry.scramblePct) > 0 && rng.roll(scramble)) {
      room = nonBridge[rng.int(nonBridge.length)].id; late = 40;
    }
    const pos = freeTileIn(room) || freeTileIn(spawnRoom);
    u.x = pos[0]; u.y = pos[1]; u.busy = setupTicks + late; u.scrambled = late > 0;
    squad.push(addUnit(u));
    ev(0, 'spawn', u.id, 'S', u.kind, u.x, u.y);
    if (late) ev(0, 'scramble', u.id, room);
  }
  function droneUnit(owner) {
    const p = freeTileNear(owner.x, owner.y); if (!p) return;
    const dr = enemyUnit('sys_drone', p[0], p[1], { side: 'S', owner: owner.id, busy: owner.busy });
    ev(0, 'spawn', dr.id, 'S', dr.kind, dr.x, dr.y);
  }

  // ---------- Enemy spawn ----------
  const enemies = [];
  let nest = -1;   // defend, outbreak: the room the parasites hatch from
  if (defend) {
    // The Mothership's own turrets fight for the squad.
    for (const f of map.features) if (f.kind === 'turret' && f.active && !damaged.has(map.rooms[f.room].key) && occ[idx(f.x, f.y)] < 0) {
      const tr = enemyUnit('sys_turret', f.x, f.y, { side: 'S' }); ev(0, 'spawn', tr.id, 'S', tr.kind, tr.x, tr.y);
    }
    // Security Post L3: the Bridge door is a sealed blast door. The squad has the codes; boarders
    // have to force it, which takes far longer than a normal locked door.
    const sec = msRoomOf('security');
    if (sec && sec.level >= 3) for (const d of map.doors) if (d.a === map.bridge || d.b === map.bridge) {
      d.locked = true; d.blast = true; d.forceTicks = FORCE_DOOR_TICKS * DEFENSE.blastDoorMult; ev(0, 'blastdoors', d.id);
    }
    if (threat.kind === 'outbreak') {
      // It hatches where the cargo came aboard (the Hangar), or in the Quarantine Bay if there is one
      // (sealed: its door takes far longer to force).
      const q = msRoomOf('quarantine');
      nest = q ? q.id : map.airlock;
      if (q) for (const d of map.doors) if (d.a === nest || d.b === nest) {
        d.locked = true; d.forceTicks = FORCE_DOOR_TICKS * (1 + q.level * DEFENSE.quarantineLockMult);
      }
      for (let i = 0; i < (threat.eggs || 0); i++) {
        const p = freeTileIn(nest); if (!p) break;
        map.features.push({ kind: 'eggs', x: p[0], y: p[1], room: nest });
      }
      ev(0, 'nest', nest);
    }
  } else {
    const lp = freeTileNear(map.console[0], map.console[1]);
    enemies.push(enemyUnit(ship.leader, lp[0], lp[1]));
    let budget = noRetreat ? Math.floor((ship.crewBudget * SUICIDE_SQUAD.crewPct) / 100) : ship.crewBudget;
    const weights = Object.entries(ship.unitWeights).filter(([id]) => UNIT_BY_ID[id].cost > 0);
    const cheapest = Math.min(...weights.map(([id]) => UNIT_BY_ID[id].cost));
    const crewRooms = map.rooms.filter(r => r.id !== map.airlock && r.id !== spawnRoom);
    let guard = 0;
    const civId = Object.keys(ship.unitWeights).find(id => UNIT_BY_ID[id].ai === 'flee');
    if (plan) {
      // Scouted: who and which room were decided by the scout seed; nobody waits in the squad's entry room.
      const away = (room) => (room === spawnRoom ? crewRooms[rng.int(crewRooms.length)].id : room);
      for (const c of plan.crew) { const p = freeTileIn(away(c.room), true); if (p) enemies.push(enemyUnit(c.kind, p[0], p[1])); }
      for (const room of plan.civilians) { const p = freeTileIn(away(room)); if (p) enemies.push(enemyUnit(civId, p[0], p[1])); }
    } else {
    while (budget >= cheapest && guard++ < 100) {
      let total = 0; for (const [, w] of weights) total += w;
      let r = rng.int(total), pick = weights[0][0];
      for (const [id, w] of weights) { if (r < w) { pick = id; break; } r -= w; }
      const cost = UNIT_BY_ID[pick].cost;
      if (cost > budget) continue;
      budget -= cost;
      const room = rng.roll(20) ? map.bridge : crewRooms[rng.int(crewRooms.length)].id;
      const p = freeTileIn(room, true); if (p) enemies.push(enemyUnit(pick, p[0], p[1]));
    }
    const civ = ship.civilians[0] + rng.int(ship.civilians[1] - ship.civilians[0] + 1);
    for (let i = 0; i < civ && civId; i++) {
      const p = freeTileIn(crewRooms[rng.int(crewRooms.length)].id); if (p) enemies.push(enemyUnit(civId, p[0], p[1]));
    }
    }
    for (const f of map.features) if (f.kind === 'turret' && f.active && occ[idx(f.x, f.y)] < 0) enemies.push(enemyUnit('sys_turret', f.x, f.y));
    for (const e of enemies) ev(0, 'spawn', e.id, 'E', e.kind, e.x, e.y);
  }
  for (const s of squad) if (s.flags.drone) droneUnit(s);
  if (entry.stunTicks) for (const e of enemies) if (map.roomAt[idx(e.x, e.y)] === spawnRoom) e.stunUntil = setupTicks + entry.stunTicks;
  if (isPod && msEntry.podShock) {   // Pod Bay: the impact shakes the rooms that share a door with the breach
    const next = new Set(map.doors.filter(d => d.a === spawnRoom || d.b === spawnRoom).map(d => (d.a === spawnRoom ? d.b : d.a)));
    for (const e of enemies) if (next.has(map.roomAt[idx(e.x, e.y)]) && e.kind !== 'sys_turret') { e.stunUntil = setupTicks + msEntry.podShock; ev(0, 'stun', e.id, setupTicks + msEntry.podShock); }
  }

  // ---------- Objectives ----------
  const objectives = [defend ? { id: 'defend_bridge', def: DEFEND_OBJECTIVE, room: map.bridge, x: map.console[0], y: map.console[1], progress: 0, done: false }
    : { id: 'take_bridge', def: OBJECTIVES.take_bridge, room: map.bridge, x: map.console[0], y: map.console[1], progress: 0, done: false }];
  if (plan) for (const o of plan.objectives) {
    const def = OBJECTIVES[o.id], room = map.rooms[o.room];
    const p = def.kind === 'leaderDown' ? [room.cx, room.cy] : (freeTileIn(room.id) || [room.cx, room.cy]);
    objectives.push({ id: o.id, def, room: room.id, x: p[0], y: p[1], progress: 0, done: false, worker: -1 });
  }
  else if (!defend) {
    const avail = ship.optional.filter(o => map.rooms.some(r => r.type === OBJECTIVES[o].room));
    const n = Math.min(avail.length, rng.roll(50) ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const id = avail.splice(rng.int(avail.length), 1)[0];
      const def = OBJECTIVES[id];
      const rooms = map.rooms.filter(r => r.type === def.room);
      const room = rooms[rng.int(rooms.length)];
      const p = def.kind === 'leaderDown' ? [room.cx, room.cy] : (freeTileIn(room.id) || [room.cx, room.cy]);
      objectives.push({ id, def, room: room.id, x: p[0], y: p[1], progress: 0, done: false, worker: -1 });
    }
  }
  for (const o of objectives) ev(0, 'objective', o.id, o.room, o.x, o.y);
  const captureActive = objectives.some(o => o.id === 'capture_leader');

  // ---------- Hazards ----------
  const hazards = [];
  for (const r of map.rooms) if (r.hazard) hazards.push({ room: r.id, def: HAZARDS[r.hazard], until: 1e9 });
  if (entry.hazard) hazards.push({ room: spawnRoom, def: HAZARDS[entry.hazard], until: setupTicks + HAZARDS[entry.hazard].ticks });

  // ---------- Alarm ----------
  // Suicide Squad: the crew knows the boarders can't leave and throws everything at them.
  // Defense: the ship's own alarm is already screaming and every attacker knows where it's going.
  let alarm = defend ? ALARM_2 : [0, ALARM_1, ALARM_2][noRetreat ? Math.max(entry.alarmStart, SUICIDE_SQUAD.alarmStart) : entry.alarmStart];
  let alarmLevel = alarm >= ALARM_2 ? 2 : alarm >= ALARM_1 ? 1 : 0;
  let alarm2At = alarmLevel === 2 ? 0 : -1;
  if (noRetreat && alarmLevel === 2) for (const e of units) if (e.side === 'E') e.alerted = true;
  let huntTile = null, huntRefresh = 0;
  function addAlarm(n, x, y) {
    alarm += n;
    const lvl = alarm >= ALARM_2 ? 2 : alarm >= ALARM_1 ? 1 : 0;
    if (lvl > alarmLevel) {
      alarmLevel = lvl; ev(t, 'alarm', lvl);
      if (lvl === 2) { alarm2At = t; for (const e of units) if (e.side === 'E') e.alerted = true; }
    }
    if (x !== undefined) {
      const r = map.roomAt[idx(x, y)];
      if (r >= 0) { const near = [r, ...roomAdj[r]]; for (const e of units) if (e.side === 'E' && e.state === 'active' && near.includes(map.roomAt[idx(e.x, e.y)])) e.alerted = true; }
      if (!huntTile || alarmLevel < 2) huntTile = [x, y];
    }
  }

  // ---------- Combat ----------
  const activeOf = (side) => units.filter(u => u.side === side && u.state === 'active');
  const isTargetable = (u) => u.state === 'active' && !u.civilian && !u.off;

  function canSee(o, tg) {
    const sight = o.side === 'S' && ship.dark ? DARK_SIGHT + (o.flags.tracker ? 4 : 0) + (o.st.tech >= 60 ? 2 : 0) : SIGHT;
    if (cheb(o, tg) > sight || !los(o.x, o.y, tg.x, tg.y)) return false;
    if (tg.hidden && t >= 0) {
      if (cheb(o, tg) <= 1) return true;
      return rng.roll(detectChance(o.st.tech, o.m.detectPct || 0, tg.st.stl, cheb(o, tg)));
    }
    return true;
  }
  function visibleFoes(u) {
    const out = [];
    for (const v of units) if (v.side !== u.side && isTargetable(v) && canSee(u, v)) out.push(v);
    return out;
  }
  function moraleAura(u) {
    let a = u.m.moralePct || 0;
    const r = map.roomAt[idx(u.x, u.y)];
    for (const v of units) if (v.side === u.side && v.state === 'active' && v.aura && map.roomAt[idx(v.x, v.y)] === r) a = Math.max(a, v.aura);
    return a;
  }
  function panicCheck(u, pressure) {
    if (u.state !== 'active' || u.turret || u.flags.noPanic || u.panicUntil > t) return;
    if (ship.dark && u.side === 'S') pressure += 10;   // dread
    if (rng.roll(panicChance(u.st.grit, pressure, moraleAura(u)))) { u.panicUntil = t + 30; u.task = null; ev(t, 'panic', u.id); }
  }

  function setPos(u, x, y) {
    occ[idx(u.x, u.y)] = -1; u.x = x; u.y = y; occ[idx(x, y)] = u.id;
  }

  // Spores: a Soldier may become Confused and fire at whoever is nearest, friend or foe.
  function confuseCheck(u) {
    if (u.state !== 'active' || u.side !== 'S' || u.tags.includes('synthetic') || u.confusedUntil > t) return;
    const chance = Math.max(5, Math.min(30, 35 - Math.floor(u.st.grit / 4) - Math.floor((u.m.hazardResistPct || 0) / 2)));
    if (rng.roll(chance)) { u.confusedUntil = t + 30; ev(t, 'confused', u.id); }
  }
  function spawnNear(unitId, x, y, extra = {}) {
    const p = freeTileNear(x, y); if (!p) return null;
    let e;
    if (unitId) e = enemyUnit(unitId, p[0], p[1], { alerted: true, ...extra });
    else {
      // Possessed Soldier: a hostile copy at half health; downing it frees the Soldier.
      const s = units[extra.shellOf];
      e = addUnit({ side: 'E', name: extra.name, kind: s.kind, ai: 'grunt', tags: ['human', 'xeno'], st: { ...s.st }, m: s.m, w: s.w,
        hp: Math.max(1, Math.floor(s.maxHp / 2)), maxHp: s.maxHp, x: p[0], y: p[1], flags: {}, aura: 0, alerted: true, shellOf: s.id });
    }
    ev(t, 'spawn', e.id, 'E', e.kind, e.x, e.y);
    return e;
  }

  function goDown(u, overkill) {
    occ[idx(u.x, u.y)] = -1;
    u.task = null;
    if (u.ai === 'drone') { u.state = 'dead'; ev(t, 'dead', u.id); return; }
    if (u.side === 'S') {
      u.state = 'down'; u.downAt = t; u.tally.downed++;
      u.tally.overkillPct = Math.max(u.tally.overkillPct, Math.floor((overkill * 100) / u.maxHp));
      ev(t, 'down', u.id);
      for (const v of activeOf('S')) if (cheb(u, v) <= 5) panicCheck(v, 20);
    } else if (u.shellOf !== undefined) {
      // Downing a possessed Soldier frees them: they're back on our side, Down.
      u.state = 'dead'; const s = units[u.shellOf];
      s.possessed = false; s.x = u.x; s.y = u.y; s.downAt = t;
      ev(t, 'freed', u.id, s.id); return;
    } else if (u.leader && captureActive) {
      u.state = 'down'; ev(t, 'captured', u.id);
    } else {
      u.state = 'dead'; ev(t, 'dead', u.id);
    }
    if (u.side === 'E' && u.leader && ship.leaderBreaksMorale) for (const v of activeOf('E')) panicCheck(v, 30);
    if (u.side === 'E' && u.flags.acidBlood) {
      for (const s of squad) if (s.state === 'active' && cheb(s, u) <= 1) {
        const d = Math.floor((ACID_DMG * (100 - Math.min(100, s.m.hazardResistPct || 0))) / 100);
        if (d > 0) { ev(t, 'acid', u.id, s.id, d); hurt(s, d, null); }
      }
    }
  }

  function hurt(tg, dmg, src) {
    tg.hp -= dmg; tg.tally.dmgTaken += dmg;
    if (src) src.tally.dmgDealt += dmg;
    if (tg.hp < tg.tally.minHp) tg.tally.minHp = tg.hp;
    if (tg.hp <= 0) {
      if (src && tg.shellOf === undefined) {
        src.tally.kills++;
        if (src.flags.killingSpree && src.cd > t) { src.cd = t + ((src.cd - t) >> 1); ev(t, 'ability', src.id, 'killing_spree'); }
      }
      goDown(tg, -tg.hp); return;
    }
    if (tg.smokes > 0 && tg.hp * 100 < tg.maxHp * SMOKE.triggerHpPct) { tg.smokes--; popSmoke(tg); }
    if (dmg * 4 >= tg.maxHp) panicCheck(tg, 10);
    if (tg.flags.autoCloak && tg.hp * 10 < tg.maxHp * 3 && t >= tg.cd) cloak(tg);
  }

  function prismAura(tg) {
    if (tg.side !== 'E') return 0;
    const r = map.roomAt[idx(tg.x, tg.y)];
    for (const v of units) if (v.side === 'E' && v.state === 'active' && v.flags.prismAura && map.roomAt[idx(v.x, v.y)] === r) return -25;
    return 0;
  }
  // Crystal ships: a missed shot can glance off into anyone within 3 tiles of the target.
  function ricochet(u, tg) {
    const near = units.filter(v => v !== u && v !== tg && isTargetable(v) && cheb(v, tg) <= 3);
    if (!near.length) return;
    const v = near[rng.int(near.length)];
    const d = applyDamage({ raw: Math.floor((rng.range(u.w.dmg[0], u.w.dmg[1]) * 60) / 100), targetArm: v.st.arm, dmgTakenPct: v.m.dmgTakenPct || 0 });
    ev(t, 'ricochet', u.id, v.id, d); hurt(v, d, u);
  }

  function popSmoke(u) { clouds.push({ x: u.x, y: u.y, until: t + SMOKE.ticks }); ev(t, 'smoke', u.x, u.y, SMOKE.ticks); }

  function fortressAura(tg) {
    for (const v of units) if (v.side === tg.side && v.state === 'active' && v.flags.fortressAura && v !== tg && cheb(v, tg) <= 2) return -15;
    return 0;
  }

  function shoot(u, tg, bonusDmg = 0, dmgScale = 100) {
    const w = u.w; if (!w) return;
    const dist = cheb(u, tg);
    const grav = gravityNow();
    let coverVal = dist > 1 && grav !== 'zero' ? [0, 20, 40][map.cover[idx(tg.x, tg.y)]] : 0;   // nothing to hide behind in zero-G
    if (dist > 1 && inSmoke(tg)) coverVal = 40;
    const meleeDodge = w.melee && tg.flags.meleeMaster ? 20 : 0;
    const hit = hitChance({ aim: u.st.aim - (grav === 'heavy' && !u.immuneGravity ? 20 : 0) + (u.side === 'S' ? intelAim : 0), weaponAcc: w.acc, targetEvasion: evasionOf(tg.st.spd, (tg.m.evasion || 0) + meleeDodge),
      cover: coverVal, coverPct: tg.m.coverPct || 0, distTiles: dist, range: w.range, falloff: w.falloff, suppressed: u.suppUntil > t });
    u.tally.shots++;
    const wasHidden = u.hidden;
    if (u.hidden && !(u.flags.silentShot && u.cloakUntil <= t) ) { u.hidden = false; ev(t, 'reveal', u.id); }
    if (w.noise) addAlarm(Math.floor((w.noise * 4 * (u.side === 'S' ? tactic.noisePct : 100)) / 100), u.x, u.y);
    const rof = Math.max(2, Math.floor((w.rof * 100) / (100 + (u.m.rofPct || 0))));
    u.busy = t + rof;
    if (w.suppress || u.suppressNext) applySuppress(u, tg);
    if (!rng.roll(hit)) {
      ev(t, 'shot', u.id, tg.id, 0, 0);
      if (ship.refraction && rng.roll(50)) ricochet(u, tg);
      return;
    }
    u.tally.hits++;
    let raw = rng.range(w.dmg[0], w.dmg[1]);
    let vs = 0;
    for (const tag of tg.tags) { vs += (u.m.dmgVs?.[tag] || 0) + (w.vs?.[tag] || 0); }
    let dmgPct = (u.m.dmgPct || 0) + bonusDmg;
    if (u.flags.adrenaline && u.hp * 2 < u.maxHp) dmgPct += 15;
    if (u.flags.closeQuarters && dist <= 2) dmgPct += 15;
    if (u.flags.closeRangePenalty && dist <= 2) dmgPct -= 15;
    if (u.cloakBonus) { dmgPct += ABILITIES.cloak.power.dmgPct; u.cloakBonus = false; }
    if (u.stimUntil > t) dmgPct += STIM.dmgPct;
    if (u.flags.meleeMaster && w.melee) dmgPct += 25;
    if (u.flags.doorwayBonus && nearDoorGrid[idx(tg.x, tg.y)]) dmgPct += 10;
    if (armoryRoom && u.side === 'S' && map.roomAt[idx(u.x, u.y)] === armoryRoom.id) dmgPct += DEFENSE.armoryDmgPct * armoryRoom.level;
    const bladeThroughShield = w.melee && tg.flags.slowBladeWeak;   // the slow blade penetrates the shield
    const crit = rng.roll(critChance(u.st.aim, w.crit, u.m.critPct || 0)) || ((u.flags.stealthCrit || (ventAmbush && u.side === 'S')) && wasHidden);
    let d = applyDamage({ raw, dmgPct, vsPct: vs, crit, critDmgPct: u.m.critDmgPct || 0, targetArm: bladeThroughShield ? 0 : tg.st.arm, pierce: (w.pierce || 0) + (u.m.pierce || 0),
      dmgTakenPct: (tg.m.dmgTakenPct || 0) + fortressAura(tg) + prismAura(tg) + (tg.side === 'S' && retreat.on ? (retreatDef.cover || 0) : 0) + (tg.spearUntil > t ? SPEARHEAD.dmgTakenPct : 0) });
    d = Math.max(1, Math.floor((d * dmgScale) / 100));
    ev(t, 'shot', u.id, tg.id, d, crit ? 1 : 0);
    hurt(tg, d, u);
    if (w.type === 'flamer' && rng.roll(FIRE_START_PCT)) startFire(map.roomAt[idx(tg.x, tg.y)]);
    if (u.flags.screamPanic && tg.state === 'active') panicCheck(tg, 15);
    if (w.splash || w.chain) {
      const extra = units.filter(v => v !== tg && v.side === tg.side && isTargetable(v) && cheb(v, tg) <= (w.chain ? 2 : 1));
      const n = w.chain ? Math.min(w.chain, extra.length) : extra.length;
      for (let i = 0; i < n; i++) { const half = Math.max(1, d >> 1); ev(t, 'splash', u.id, extra[i].id, half); hurt(extra[i], half, u); }
    }
  }

  function startFire(room) {
    if (room < 0 || hazards.some(h => h.room === room && h.def === HAZARDS.fire && h.until >= t)) return;
    hazards.push({ room, def: HAZARDS.fire, until: t + HAZARDS.fire.ticks }); ev(t, 'fire', room, HAZARDS.fire.ticks);
  }

  function throwGrenade(u, at) {
    u.grenades--; u.grenadeCd = t + GRENADE.cd; u.busy = t + 10;
    if (u.hidden) { u.hidden = false; ev(t, 'reveal', u.id); }
    ev(t, 'grenade', u.id, at.x, at.y);
    addAlarm(GRENADE.noise, u.x, u.y);
    for (const v of units) {
      if (v.side === u.side || !isTargetable(v) || Math.abs(v.x - at.x) > 1 || Math.abs(v.y - at.y) > 1) continue;
      const d = applyDamage({ raw: rng.range(GRENADE.dmg[0], GRENADE.dmg[1]), dmgPct: u.m.dmgPct || 0, targetArm: v.st.arm, dmgTakenPct: v.m.dmgTakenPct || 0 });
      ev(t, 'blast', u.id, v.id, d); hurt(v, d, u);
    }
  }
  // Best grenade target: a visible foe in range with at least one other foe next to it.
  function grenadeTarget(u, foes) {
    let best = null, bestN = 1;
    for (const f of foes) {
      if (cheb(u, f) > GRENADE.range || cheb(u, f) < 2) continue;
      let n = 0; for (const g of foes) if (Math.abs(g.x - f.x) <= 1 && Math.abs(g.y - f.y) <= 1) n++;
      if (n > bestN) { bestN = n; best = f; }
    }
    return best;
  }

  function applySuppress(u, tg) {
    if (tg.state !== 'active' || tg.turret) return;
    if (rng.roll(Math.floor(tg.st.grit / 3))) return;
    const dur = Math.floor((20 * (100 + (u.m.suppressPct || 0))) / 100);
    tg.suppUntil = Math.max(tg.suppUntil, t + dur);
  }

  function cloak(u) {
    const ab = ABILITIES.cloak;
    u.hidden = true; u.cloakBonus = true;
    u.cloakUntil = t + (u.flags.longCloak ? Math.floor(ab.dur * 3 / 2) : ab.dur);
    u.cd = t + Math.floor((ab.cd * (100 + (u.m.abilityCdPct || 0))) / 100);
    ev(t, 'ability', u.id, 'cloak');
  }
  const cdFor = (u, ab) => t + Math.floor((ABILITIES[ab].cd * (100 + (u.m.abilityCdPct || 0))) / 100);

  // ---------- Movement ----------
  function moveTicks(u) {
    let tp = ticksPerTile(u.st.spd, 0);
    if (u.side === 'S' && !retreat.on) tp = Math.max(2, Math.floor((tp * 100) / tactic.advancePct));
    if (u.side === 'S' && retreat.on) tp = Math.max(2, tp - 1);
    if (u.suppUntil > t) tp += 2;
    if (ship.gravity && !u.immuneGravity) { const gv = gravityNow(); if (gv === 'heavy') tp += 3; else if (gv === 'zero') tp = Math.max(2, tp - 2); }
    return tp;
  }

  // Try to step along field f. Returns true if the unit did something (moved, opened, waited on a door).
  function stepAlong(u, f) {
    const here = f[idx(u.x, u.y)];
    if (here <= 0) return false;
    let best = null, bestV = here;
    for (const [dx, dy] of DIRS) {
      const nx = u.x + dx, ny = u.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
      const k = idx(nx, ny), v = f[k];
      if (v < 0 || v >= bestV) continue;
      if (dx && dy && (!passable(u.x + dx, u.y) || !passable(u.x, u.y + dy))) continue;
      if (occ[k] >= 0) continue;
      best = [nx, ny]; bestV = v;
    }
    if (!best) { u.busy = t + 3; return true; }   // blocked: wait a moment
    const di = doorAt[idx(best[0], best[1])];
    if (di >= 0) {
      const d = map.doors[di];
      if (!d.open) {
        if (d.locked && !(d.blast && u.side === 'S') && (u.side === 'S' || defend)) return workDoor(u, d);
        d.open = true; d.locked = false; u.busy = t + OPEN_DOOR_TICKS; ev(t, 'door', d.id, 'open', u.id);
        return true;
      }
    }
    setPos(u, best[0], best[1]);
    u.busy = t + moveTicks(u);
    ev(t, 'move', u.id, u.x, u.y);
    onEnter(u);
    return true;
  }

  function workDoor(u, d) {
    if (d.workBy >= 0 && d.workBy !== u.id && units[d.workBy].state === 'active' && units[d.workBy].task) { u.busy = t + 5; return true; }
    let ticks, kind;
    if (u.ability === 'breach_charge' && t >= u.cd) {
      ticks = Math.max(5, Math.floor((ABILITIES.breach_charge.power.setTicks * 100) / (100 + (u.m.breachSpeedPct || 0)))); kind = 'breach';
      u.cd = cdFor(u, 'breach_charge');
    } else if (u.ability === 'hack' && t >= u.cd) {
      ticks = Math.max(8, Math.floor((ABILITIES.hack.power.hackTicks * 100) / (100 + (u.m.hackSpeedPct || 0) + (u.st.tech >> 1)))); kind = 'hack';
      u.cd = cdFor(u, 'hack');
    } else { ticks = d.forceTicks || FORCE_DOOR_TICKS; kind = 'force'; }
    d.workBy = u.id;
    u.task = { kind: 'door', door: d.id, how: kind, until: t + ticks };
    u.busy = t + ticks;
    ev(t, 'work', u.id, 'door', d.id, kind, ticks);
    return true;
  }

  function finishTask(u) {
    const k = u.task; u.task = null;
    if (k.kind === 'door') {
      const d = map.doors[k.door]; d.open = true; d.locked = false; d.workBy = -1;
      ev(t, 'door', d.id, k.how, u.id);
      if (k.how === 'breach') {
        u.tally.breaches++;
        addAlarm(20, d.x, d.y);
        const stun = ABILITIES.breach_charge.power.stunTicks * (u.flags.longStun ? 2 : 1);
        for (const e of units) if (e.side === 'E' && e.state === 'active' && (map.roomAt[idx(e.x, e.y)] === d.a || map.roomAt[idx(e.x, e.y)] === d.b)) { e.stunUntil = t + stun; ev(t, 'stun', e.id, stun); }
        if (u.flags.chainBreach) {
          // Also blow the next closed door toward the bridge.
          const cf = consoleField();
          const far = cf[idx(map.rooms[d.a].cx, map.rooms[d.a].cy)] < cf[idx(map.rooms[d.b].cx, map.rooms[d.b].cy)] ? d.a : d.b;
          const next = map.doors.filter(o => o !== d && !o.open && (o.a === far || o.b === far)).sort((p, q) => cf[idx(p.x, p.y)] - cf[idx(q.x, q.y)] || p.id - q.id)[0];
          if (next) {
            next.open = true; next.locked = false; ev(t, 'door', next.id, 'chain', u.id);
            for (const e of units) if (e.side === 'E' && e.state === 'active' && (map.roomAt[idx(e.x, e.y)] === next.a || map.roomAt[idx(e.x, e.y)] === next.b)) { e.stunUntil = Math.max(e.stunUntil, t + stun); ev(t, 'stun', e.id, stun); }
          }
        }
      } else if (k.how === 'hack') u.tally.hacks++;
      else addAlarm(10, d.x, d.y);
    } else if (k.kind === 'hackTurret') {
      const tr = units[k.target];
      if (tr.state === 'active') {
        u.tally.hacks++;
        if (u.flags.turnTurrets) { tr.side = 'S'; ev(t, 'turret', tr.id, 'turned'); }
        else { tr.off = true; ev(t, 'turret', tr.id, 'off'); }
      }
    } else if (k.kind === 'obj') {
      const o = objectives[k.obj];
      o.done = true; ev(t, 'objdone', o.id);
      if (o.def.kind === 'hack') u.tally.hacks++;
      for (const v of squad) if (v.state === 'active' && map.roomAt[idx(v.x, v.y)] === o.room) v.tally.assists++;
    } else if (k.kind === 'hackHazard') {
      const h = hazards[k.hazard]; if (h.until > t) { h.until = t; u.tally.hacks++; ev(t, 'hazard_off', h.room, u.id); }
    } else if (k.kind === 'sabotageTurret') {
      const tr = units[k.target];
      if (tr.state === 'active') { tr.state = 'dead'; occ[idx(tr.x, tr.y)] = -1; u.tally.kills++; ev(t, 'sabotage', u.id, 'turret', tr.id); ev(t, 'dead', tr.id); }
    } else if (k.kind === 'sabotageReactor') {
      reactorSabotaged = true; ev(t, 'sabotage', u.id, 'reactor', k.room);
      for (const tr of units) if (tr.turret && tr.side === 'E' && tr.state === 'active') { tr.off = true; ev(t, 'turret', tr.id, 'off'); }
      for (const d of map.doors) if (d.locked) { d.locked = false; ev(t, 'door', d.id, 'unlocked', u.id); }
      addAlarm(30, u.x, u.y);
    } else if (k.kind === 'deployTurret') {
      const p = freeTileNear(u.x, u.y);
      if (p) { const tr = enemyUnit('sys_turret', p[0], p[1]); tr.alerted = true; ev(t, 'spawn', tr.id, 'E', tr.kind, tr.x, tr.y); }
    }
  }

  const visited = new Set([spawnRoom]);
  let lootCrates = 0;
  function onEnter(u) {
    if (u.side !== 'S' || defend) return;
    const r = map.roomAt[idx(u.x, u.y)];
    if (r >= 0 && !visited.has(r)) {
      visited.add(r);
      if (u.flags.spearhead) { u.spearUntil = t + SPEARHEAD.ticks; ev(t, 'ability', u.id, 'spearhead'); }
      const loot = map.rooms[r].features.filter(f => f.kind === 'loot').length;
      if (loot) { lootCrates += loot; ev(t, 'loot', r, loot); }
    }
  }

  // Overwatch: called after an enemy moves.
  function checkOverwatch(mover) {
    // Motion Tracker: the first time each enemy walks into view near a tracker carrier, the squad is ready for it.
    if (!mover.greeted && mover.side === 'E' && isTargetable(mover) && squad.some(s => s.state === 'active' && s.flags.tracker && cheb(s, mover) <= 10)) {
      const shooter = squad.filter(s => s.state === 'active' && !s.task && s.w && cheb(s, mover) <= s.w.range + 3 && los(s.x, s.y, mover.x, mover.y))
        .sort((a, b) => cheb(a, mover) - cheb(b, mover) || a.id - b.id)[0];
      if (shooter) { mover.greeted = true; ev(t, 'ability', shooter.id, 'tracker_fire'); const keep = shooter.busy; shoot(shooter, mover); shooter.busy = keep; }
    }
    for (const s of squad) {
      if (s.state !== 'active' || s.owUntil <= t || s.owShots <= 0 || !isTargetable(mover)) continue;
      if (cheb(s, mover) <= s.w.range + 4 && los(s.x, s.y, mover.x, mover.y)) {
        s.owShots--; ev(t, 'ability', s.id, 'overwatch_fire');
        const keepBusy = s.busy; shoot(s, mover); s.busy = keepBusy;
      }
    }
  }

  function fleeStep(u, foes) {
    if (!foes.length) { u.busy = t + 5; return; }
    let best = null, bestD = -1;
    for (const [dx, dy] of DIRS) {
      const nx = u.x + dx, ny = u.y + dy;
      if (!passable(nx, ny) || occ[idx(nx, ny)] >= 0 || doorAt[idx(nx, ny)] >= 0) continue;
      let d = 99; for (const f of foes) d = Math.min(d, Math.max(Math.abs(f.x - nx), Math.abs(f.y - ny)));
      if (d > bestD) { bestD = d; best = [nx, ny]; }
    }
    if (best) { setPos(u, best[0], best[1]); ev(t, 'move', u.id, u.x, u.y); }
    u.busy = t + moveTicks(u);
  }

  // Step toward the nearest cover tile within 2 tiles that still has a line of sight to `tg`.
  function seekCover(u, tg, stayRoom) {
    if (map.cover[idx(u.x, u.y)]) return false;
    let best = null, bestD = 99;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = u.x + dx, y = u.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= map.h) continue;
      const k = idx(x, y);
      if (!map.cover[k] || occ[k] >= 0 || map.tiles[k] !== T_FLOOR) continue;
      if (stayRoom && map.roomAt[k] !== map.roomAt[idx(u.x, u.y)]) continue;
      if (!los(x, y, tg.x, tg.y)) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < bestD) { bestD = d; best = [x, y]; }
    }
    if (!best) return false;
    return stepAlong(u, field(best[0], best[1]));
  }

  function pickTarget(u, foes) {
    let best = null, bestS = 1e9;
    for (const f of foes) {
      let s = cheb(u, f) * 4 + Math.floor((f.hp * 10) / f.maxHp);
      if (f.turret) s += 6;
      if (u.side === 'S' && f.leader && u.m.dmgVs?.leader) s -= 8;
      if (s < bestS) { bestS = s; best = f; }
    }
    return best;
  }

  // ---------- Squad AI ----------
  function squadDecide(u) {
    if (retreat.on) return retreatDecide(u);
    const foes = visibleFoes(u);
    if (u.panicUntil > t) return fleeStep(u, foes);
    if (u.confusedUntil > t && u.w) {
      const near = units.filter(v => v !== u && isTargetable(v) && cheb(u, v) <= SIGHT && los(u.x, u.y, v.x, v.y));
      if (near.length) { const tg = near[rng.int(near.length)]; if (tg.side === u.side) ev(t, 'friendlyfire', u.id, tg.id); return shoot(u, tg); }
    }

    // Medic: revive / heal.
    if (u.ability === 'patch_up' && t >= u.cd) {
      const downed = squad.filter(v => v.state === 'down' && !v.possessed && cheb(u, v) <= 8).sort((a, b) => cheb(u, a) - cheb(u, b) || a.id - b.id)[0];
      if (downed) {
        if (cheb(u, downed) <= 1) return revive(u, downed);
        if (stepAlong(u, field(downed.x, downed.y))) return;
      }
      const hurtAlly = squad.filter(v => v.state === 'active' && v !== u && v.hp * 2 < v.maxHp && cheb(u, v) <= 4 && los(u.x, u.y, v.x, v.y))
        .sort((a, b) => a.hp * 100 / a.maxHp - b.hp * 100 / b.maxHp || a.id - b.id)[0];
      if (hurtAlly) return heal(u, hurtAlly);
    }

    if (foes.length) {
      const tg = pickTarget(u, foes);
      const dist = cheb(u, tg);
      // Stealth: slip past enemies that haven't noticed us.
      if (u.hidden && !tg.alerted && dist > 1 && tactic.aggression < 30) return advance(u);
      // Abilities.
      if (u.ability === 'cloak' && t >= u.cd && !u.hidden) return cloak(u);
      if (u.grenades > 0 && t >= u.grenadeCd) { const g = grenadeTarget(u, foes); if (g) return throwGrenade(u, g); }
      if (u.flags.sabotage) {
        const tr = foes.find(f => f.turret && !f.off && cheb(u, f) <= 6);
        if (tr) {
          if (cheb(u, tr) <= 1) { u.task = { kind: 'sabotageTurret', target: tr.id, until: t + SABOTAGE_TICKS.turret }; u.busy = t + SABOTAGE_TICKS.turret; ev(t, 'work', u.id, 'sabotage', tr.id, 'turret', SABOTAGE_TICKS.turret); return; }
          if (stepAlong(u, field(tr.x, tr.y))) return;
        }
      }
      if (u.ability === 'hack' && t >= u.cd) {
        const tr = foes.find(f => f.turret && cheb(u, f) <= 6);
        if (tr) {
          const ticks = Math.max(8, Math.floor((ABILITIES.hack.power.hackTicks * 100) / (100 + (u.m.hackSpeedPct || 0) + (u.st.tech >> 1))));
          u.cd = cdFor(u, 'hack'); u.task = { kind: 'hackTurret', target: tr.id, until: t + ticks }; u.busy = t + ticks;
          ev(t, 'work', u.id, 'turret', tr.id, 'hack', ticks); return;
        }
      }
      if (u.ability === 'suppressing_fire' && t >= u.cd && foes.length >= 2 && dist <= u.w.range + 2) {
        u.cd = cdFor(u, 'suppressing_fire'); ev(t, 'ability', u.id, 'suppressing_fire');
        for (const f of foes) if (cheb(u, f) <= ABILITIES.suppressing_fire.power.coneTiles + 2) applySuppress(u, f);
        return shoot(u, tg, 0, u.flags.bulletStorm ? 100 : 50);
      }
      if (u.ability === 'charge' && t >= u.cd && dist >= 2 && dist <= 5) {
        u.cd = cdFor(u, 'charge'); ev(t, 'ability', u.id, 'charge');
        const f = field(tg.x, tg.y);
        for (let i = 0; i < ABILITIES.charge.power.tiles && cheb(u, tg) > 1; i++) {
          const before = [u.x, u.y]; stepAlong(u, f); if (before[0] === u.x && before[1] === u.y) break;
        }
        if (u.flags.chargeKnockdown) tg.stunUntil = Math.max(tg.stunUntil, t + 15);
        return shoot(u, tg, ABILITIES.charge.power.dmgPct);
      }
      // Engage.
      const melee = u.w.melee;
      const pref = Math.max(1, Math.floor((u.w.range * tactic.rangePct) / 100));
      if (melee ? dist > 1 : dist > u.w.range + 3) { if (stepAlong(u, field(tg.x, tg.y))) return; }
      if (!melee && rng.roll(tactic.coverUse) && seekCover(u, tg, false)) return;
      if (!melee && dist > pref && rng.roll(tactic.aggression)) {
        const before = u.x * 1000 + u.y;
        if (stepAlong(u, field(tg.x, tg.y))) {
          // Run and Gun: fire on the move (the shot doesn't add any time).
          if (u.flags.runAndGun && before !== u.x * 1000 + u.y && tg.state === 'active' && los(u.x, u.y, tg.x, tg.y)) { const keep = u.busy; shoot(u, tg); u.busy = keep; }
          return;
        }
      }
      if (melee && dist > 1) { u.busy = t + 3; return; }
      return shoot(u, tg);
    }

    // No enemies in sight.
    if (u.ability === 'overwatch' && t >= u.cd && alarmLevel >= 1) {
      u.cd = cdFor(u, 'overwatch'); u.owUntil = t + ABILITIES.overwatch.dur; u.owShots = u.flags.killZone ? 3 : 1;
      ev(t, 'ability', u.id, 'overwatch');
    }
    if (u.ability === 'hack' && u.flags.stopReinforcements && map.roomAt[idx(u.x, u.y)] === map.bridge && !reinforcementsCut) { reinforcementsCut = true; ev(t, 'ability', u.id, 'system_crash'); }
    if (u.flags.disableHazards && t >= u.cd) {
      const here = map.roomAt[idx(u.x, u.y)];
      const hi = hazards.findIndex(h => h.room === here && h.until > t && h.def.hackable);
      if (hi >= 0) {
        const ticks = Math.max(8, Math.floor((ABILITIES.hack.power.hackTicks * 100) / (100 + (u.m.hackSpeedPct || 0) + (u.st.tech >> 1))));
        u.cd = cdFor(u, 'hack'); u.task = { kind: 'hackHazard', hazard: hi, until: t + ticks }; u.busy = t + ticks;
        ev(t, 'work', u.id, 'hazard', here, 'hack', ticks); return;
      }
    }
    if (u.flags.sabotage && !reactorSabotaged && reactorSpot) {
      const f = field(reactorSpot.x, reactorSpot.y), d = f[idx(u.x, u.y)];
      if (d === 0) { u.task = { kind: 'sabotageReactor', room: reactorSpot.room, until: t + SABOTAGE_TICKS.reactor }; u.busy = t + SABOTAGE_TICKS.reactor; ev(t, 'work', u.id, 'sabotage', reactorSpot.room, 'reactor', SABOTAGE_TICKS.reactor); return; }
      if (d > 0 && d <= 12 && stepAlong(u, f)) return;
    }
    // Optional objectives on the way.
    if (tactic.objectiveFocus < 80 && u.ability !== 'patch_up') {
      for (let i = 1; i < objectives.length; i++) {
        const o = objectives[i];
        if (o.done || o.def.kind === 'leaderDown' || (o.worker >= 0 && o.worker !== u.id && units[o.worker].state === 'active')) continue;
        const f = field(o.x, o.y), d = f[idx(u.x, u.y)];
        if (d < 0 || d > 14) continue;
        o.worker = u.id;
        if (d === 0) {
          const speed = o.def.kind === 'hack' ? 100 + (u.m.hackSpeedPct || 0) + (u.st.tech >> 1) : 100;
          const ticks = Math.max(5, Math.floor((o.def.ticks * 100) / speed));
          u.task = { kind: 'obj', obj: i, until: t + ticks }; u.busy = t + ticks; ev(t, 'work', u.id, 'obj', o.id, o.def.kind, ticks); return;
        }
        if (stepAlong(u, f)) return;
      }
    }
    if (defend) return defendMove(u);
    advance(u);
  }

  // Defense: guards hold the Bridge; everyone else heads for the nearest known attacker.
  let threatF = null, threatAt = -1;
  function threatField() {
    if (threatF && t < threatAt) return threatF;
    threatAt = t + 8;
    const f = threatF = new Int32Array(W * map.h).fill(-1), q = [];
    for (const e of units) if (e.side === 'E' && isTargetable(e) && !e.hidden) { const k = idx(e.x, e.y); if (f[k] < 0) { f[k] = 0; q.push(k); } }
    let qi = 0;
    while (qi < q.length) {
      const c = q[qi++], cx = c % W, cy = (c - cx) / W;
      for (const [ddx, ddy] of DIRS) {
        const nx = cx + ddx, ny = cy + ddy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
        const n = idx(nx, ny);
        if (f[n] >= 0 || !passable(nx, ny)) continue;
        if (ddx && ddy && (!passable(cx + ddx, cy) || !passable(cx, cy + ddy))) continue;
        f[n] = f[c] + 1; q.push(n);
      }
    }
    return f;
  }
  function defendMove(u) {
    if (u.guard) {
      const f = consoleField();
      if (map.roomAt[idx(u.x, u.y)] === map.bridge && f[idx(u.x, u.y)] <= 3) { u.busy = t + 4; return; }
      if (!stepAlong(u, f)) u.busy = t + 4;
      return;
    }
    const f = threatField(), d = f[idx(u.x, u.y)];
    // Move up as a group: don't get more than COHESION steps ahead of the rearmost hunter.
    let rear = 0;
    for (const v of squad) if (v.state === 'active' && v !== u && !v.guard) rear = Math.max(rear, f[idx(v.x, v.y)]);
    if (rear > 0 && d < rear - COHESION) { u.busy = t + 4; return; }
    if (d > 0 && stepAlong(u, f)) return;
    u.busy = t + 4;
  }

  function advance(u) {
    const f = consoleField();
    const d = f[idx(u.x, u.y)];
    if (map.roomAt[idx(u.x, u.y)] === map.bridge && d <= 2) { u.busy = t + 4; return; }
    // Cohesion: wait for the rearmost squadmate.
    let rear = 0;
    for (const v of squad) if (v.state === 'active' && v !== u) rear = Math.max(rear, f[idx(v.x, v.y)]);
    const coh = COHESION + (tactic.id === 'blitz' ? 3 : 0);
    if (rear > 0 && d < rear - coh) { u.busy = t + 4; return; }
    if (!stepAlong(u, f)) u.busy = t + 4;
  }

  function revive(u, v) {
    u.cd = cdFor(u, 'patch_up');
    const chance = Math.min(95, ABILITIES.patch_up.power.revive + (u.m.reviveChance || 0) + Math.floor(u.st.tech / 5) + (medBay ? DEFENSE.medBayRevivePct * medBay.level : 0));
    u.busy = t + 15;
    if (rng.roll(chance)) {
      v.tally.ticksDown += t - v.downAt; v.state = 'active'; v.revived = true;
      v.hp = Math.max(1, Math.floor((v.maxHp * REVIVE_HP_PCT) / 100));
      const p = occ[idx(v.x, v.y)] < 0 ? [v.x, v.y] : freeTileNear(v.x, v.y);
      v.x = p[0]; v.y = p[1]; occ[idx(v.x, v.y)] = v.id; v.busy = t + 10;
      u.tally.revives++; ev(t, 'revive', u.id, v.id, 1);
      if (u.flags.stims) v.stimUntil = t + STIM.ticks;
      if (u.flags.smokeRevive) popSmoke(v);
    } else ev(t, 'revive', u.id, v.id, 0);
  }
  function heal(u, v) {
    u.cd = cdFor(u, 'patch_up');
    const p = ABILITIES.patch_up.power;
    const amt = Math.floor(((p.heal + Math.floor((u.st.tech * p.techScale) / 10)) * (100 + (u.m.healPct || 0))) / 100);
    v.hp = Math.min(v.maxHp, v.hp + amt);
    u.busy = t + 10; ev(t, 'heal', u.id, v.id, amt);
    if (u.flags.stims) v.stimUntil = t + STIM.ticks;
  }

  // ---------- Enemy AI ----------
  let reinforcementsCut = false, reactorSabotaged = false;
  const reactorRoom = map.rooms.find(r => r.type === 'reactor');
  const reactorSpot = reactorRoom ? (reactorRoom.features.find(f => f.kind === 'terminal') || { x: reactorRoom.cx, y: reactorRoom.cy, room: reactorRoom.id }) : null;
  function enemyDecide(e) {
    if (e.off) { e.busy = t + 50; return; }
    const foes = visibleFoes(e);
    if (e.turret) {
      if (!foes.length || (alarmLevel === 0 && !foes.length)) { e.busy = t + 5; return; }
      const tg = pickTarget(e, foes); if (cheb(e, tg) > 10) { e.busy = t + 5; return; }
      return shoot(e, tg);
    }
    if (e.civilian) {
      if (squad.some(s => s.state === 'active' && cheb(s, e) <= 1)) { e.state = 'surr'; occ[idx(e.x, e.y)] = -1; ev(t, 'surrender', e.id); return; }
      if (foes.length || alarmLevel >= 1) {
        const pods = map.rooms.find(r => r.type === 'pod_bay');
        if (map.roomAt[idx(e.x, e.y)] === pods.id) { e.state = 'fled'; occ[idx(e.x, e.y)] = -1; ev(t, 'fled', e.id); return; }
        if (stepAlong(e, field(pods.cx, pods.cy))) return;
      }
      e.busy = t + 10; return;
    }
    if (e.panicUntil > t) return fleeStep(e, foes);
    const prof = ENEMY_AI[e.ai] || ENEMY_AI.grunt;
    if (foes.length && !e.alerted && (e.ai === 'static' || e.ai === 'hunter')) { e.alerted = true; addAlarm(SPOT_NOISE, foes[0].x, foes[0].y); ev(t, 'spotted', e.id, foes[0].id); }
    if (e.flags.sporePulse && t >= e.nextPulse && (e.alerted || alarmLevel >= 1)) {
      e.nextPulse = t + 40; ev(t, 'spores', e.id, e.sporeRadius);
      for (const s of squad) if (cheb(s, e) <= e.sporeRadius && los(e.x, e.y, s.x, s.y)) confuseCheck(s);
    }
    if (e.spawnDef && (e.alerted || alarmLevel >= 1) && t >= e.nextSpawn && e.spawned < e.spawnDef.max) {
      e.nextSpawn = t + e.spawnDef.every; e.spawned++;
      if (spawnNear(e.spawnDef.unit, e.x, e.y)) { e.busy = t + 10; return; }
    }
    if (e.ai === 'static') {
      if (foes.length && e.w) { const tg = pickTarget(e, foes); if (cheb(e, tg) <= e.w.range + 3) return shoot(e, tg); }
      e.busy = t + 5; return;
    }
    if (foes.length) {
      if (!e.alerted) { e.alerted = true; addAlarm(SPOT_NOISE, foes[0].x, foes[0].y); ev(t, 'spotted', e.id, foes[0].id); }
      for (const f of foes) if (f.hidden && f.cloakUntil <= t) { f.hidden = false; ev(t, 'reveal', f.id); }
      if (e.deploysTurret && !e.deployed) {
        e.deployed = true; e.task = { kind: 'deployTurret', until: t + 25 }; e.busy = t + 25; ev(t, 'work', e.id, 'deploy', 0, 'turret', 25); return;
      }
      const tg = pickTarget(e, foes);
      const dist = cheb(e, tg);
      const melee = e.w?.melee;
      if (melee) {
        if (dist <= 1) return shoot(e, tg);
        if (stepAlong(e, field(tg.x, tg.y))) return;
        e.busy = t + 3; return;
      }
      if (dist > e.w.range + 3 && !prof.stayInRoom) { if (stepAlong(e, field(tg.x, tg.y))) return; }
      if (rng.roll(prof.coverUse) && seekCover(e, tg, prof.stayInRoom)) return;
      const pref = Math.max(1, Math.floor((e.w.range * prof.rangePct) / 100));
      if (!prof.stayInRoom && dist > pref && rng.roll(prof.aggression) && stepAlong(e, field(tg.x, tg.y))) return;
      if (dist > e.w.range + 6) { if (defend && stepAlong(e, consoleField())) return; e.busy = t + 5; return; }
      return shoot(e, tg);
    }
    // Nothing visible.
    if (defend) { if (!stepAlong(e, consoleField())) e.busy = t + 5; return; }   // boarders push for the Bridge
    if (e.ai === 'hunter') {
      // Always stalks the nearest Soldier (re-aims every 20 ticks).
      if (!e.huntTile || t >= e.huntT) {
        e.huntT = t + 20;
        const s = squad.filter(x => x.state === 'active').sort((a, c) => cheb(e, a) - cheb(e, c) || a.id - c.id)[0];
        e.huntTile = s ? [s.x, s.y] : null;
      }
      if (e.huntTile && stepAlong(e, field(e.huntTile[0], e.huntTile[1]))) { checkOverwatch(e); return; }
      e.busy = t + 5; return;
    }
    if (e.alerted && prof.hunts && alarmLevel >= 1 && huntTile) {
      if (stepAlong(e, field(huntTile[0], huntTile[1]))) { checkOverwatch(e); return; }
    }
    e.busy = t + 8;
  }

  // Combat Drone: shoots whatever it sees, otherwise sticks close to its Tech.
  function droneDecide(u) {
    const foes = visibleFoes(u);
    if (foes.length) {
      const tg = pickTarget(u, foes);
      if (cheb(u, tg) > u.w.range + 3 && stepAlong(u, field(tg.x, tg.y))) return;
      return shoot(u, tg);
    }
    const o = units[u.owner];
    if (o.state === 'active' && cheb(u, o) > 2 && stepAlong(u, field(o.x, o.y))) return;
    u.busy = t + 5;
  }

  // ---------- Retreat ----------
  const retreat = { on: false, at: -1, reason: null, shuttleAt: 0, exitRoom: -1, exitTile: null };
  function startRetreat(reason) {
    retreat.on = true; retreat.at = t; retreat.reason = reason;
    ev(t, 'retreat', reason, retreatDef.id);
    const fail = retreatDef.id === 'teleport_recall' ? scalePct(retreatDef.failPct + ship.scrambleAdd, msRetreat.teleportFailPct) : retreatDef.failPct;
    if (retreatDef.exit === 'anywhere') {
      for (const s of squad) if (s.state === 'active' || s.state === 'down') {
        // Downed Soldiers are harder to lock onto: double the misfire chance, and a miss leaves them behind.
        if (s.state === 'down' && s.possessed) continue;   // can't lock onto a possessed body
        if (s.state === 'down') { if (rng.roll(fail * 2)) { ev(t, 'misfire', s.id, 'lost'); continue; } s.extractAt = t + retreatDef.extractTicks; continue; }
        s.extractAt = t + retreatDef.extractTicks + (rng.roll(fail) ? 60 : 0);
        if (s.extractAt > t + retreatDef.extractTicks) ev(t, 'misfire', s.id, 'delayed');
      }
    } else if (retreatDef.rearGuard) {
      const vol = squad.filter(s => s.state === 'active').sort((a, b) => b.st.grit - a.st.grit || a.id - b.id)[0];
      for (const s of squad) if (s.state === 'active' || s.state === 'down') {
        if (s === vol) { s.rearGuard = true; s.holdUntil = t + retreatDef.rearGuardHoldTicks; ev(t, 'rearguard', s.id); }
        else s.extractAt = t + retreatDef.extractTicks;
      }
    } else {
      let exitRoom;
      if (retreatDef.exit === 'dock') {
        if (entry.shuttleDocked) exitRoom = map.rooms[map.airlock];
        else {
          // Nearest hull room to the squad (by walking distance from the first active Soldier).
          const lead = squad.find(s => s.state === 'active') || squad[0];
          let best = null, bestD = 1e9;
          for (const r of map.rooms) {
            if (!r.outer || r.id === map.bridge) continue;
            const d = field(r.cx, r.cy)[idx(lead.x, lead.y)];
            if (d >= 0 && (d < bestD || (d === bestD && r.id < best.id))) { bestD = d; best = r; }
          }
          exitRoom = best || map.rooms[map.airlock];
        }
        ev(t, 'dock', exitRoom.id);
      } else exitRoom = map.rooms.find(r => r.type === 'pod_bay');
      retreat.exitRoom = exitRoom.id;
      const pf = exitRoom.features.find(f => f.kind === 'pods');
      retreat.exitTile = pf ? [pf.x, pf.y] : [exitRoom.cx, exitRoom.cy];
      retreat.shuttleAt = retreatDef.needsDock && !entry.shuttleDocked ? t + scalePct(retreatDef.arriveTicks, msRetreat.shuttleArrivePct) : t;
      // v2 easter egg: once in a while the ship's AI won't open the pod bay doors (4 s delay).
      if (V >= 2 && retreatDef.exit === 'pod_bay' && rng.roll(2)) { retreat.shuttleAt = t + 30; ev(t, 'log', 'log_open_pod'); }
    }
  }

  function extract(s, mia = false) {
    if (s.state === 'down') s.tally.ticksDown += t - s.downAt;
    s.wasDown = s.state === 'down';
    occ[idx(s.x, s.y)] = -1;
    s.state = 'out'; s.mia = mia; ev(t, 'extract', s.id, mia ? 1 : 0);
  }

  function retreatDecide(u) {
    const foes = visibleFoes(u);
    // Teleport recall / rear guard: hold and shoot until extracted.
    if (retreatDef.exit === 'anywhere' || retreatDef.rearGuard) {
      if (foes.length && u.w) return shoot(u, pickTarget(u, foes));
      u.busy = t + 4; return;
    }
    // Shuttle / pods: fight back to the exit. The squad drags its Downed along as a group, so
    // whoever reaches the exit brings every Downed squadmate out with them.
    if (map.roomAt[idx(u.x, u.y)] === retreat.exitRoom) {
      if (t < retreat.shuttleAt) { if (foes.length) return shoot(u, pickTarget(u, foes)); u.busy = t + 4; return; }
      if (u.extractAt === undefined) { u.extractAt = t + retreatDef.extractTicks; u.busy = t + 1; return; }
      return;  // extraction handled in the main loop
    }
    if (foes.length && rng.roll(30)) return shoot(u, pickTarget(u, foes));
    if (!stepAlong(u, field(retreat.exitTile[0], retreat.exitTile[1]))) u.busy = t + 4;
  }

  // ---------- Alien extras ----------
  const eggs = map.features.filter(f => f.kind === 'eggs').map(f => ({ x: f.x, y: f.y, room: f.room, hatched: false }));
  function hatch(egg) {
    egg.hatched = true;
    const e = spawnNear(ship.eggUnit || 'hive_drone', egg.x, egg.y);
    ev(t, 'hatch', egg.x, egg.y, e ? e.id : -1);
  }
  if (ship.log) ev(0, 'log', ship.log);

  // ---------- Main loop ----------
  const ssReinforce = noRetreat && { ...ship.reinforce, waves: ship.reinforce.waves + SUICIDE_SQUAD.extraWaves,
    every: ship.reinforce.every || SUICIDE_SQUAD.waveEvery, budget: Math.ceil((ship.reinforce.budget * SUICIDE_SQUAD.reinforcePct) / 100) };
  let result = null;
  const deployed = squad.length;
  const retreatAtCount = Math.max(1, Math.ceil((deployed * tactic.retreatAt) / 100));
  const bridgeObj = objectives[0];
  let wave = 0;

  // Mission clock (v4): runs only while nobody is on the bridge; Grit can push it past 90 s.
  // Suicide Squad: no pause, no digging in, just the 3-minute hard limit.
  let clock = 0, clockLimit = defend ? DEFENSE.timeLimit : noRetreat ? SUICIDE_SQUAD.timeLimit : RETREAT_AT_TICK, clockPaused = false, pushes = 0;
  if (noRetreat || defend) ev(0, 'clock', 0, 0, clockLimit);

  // Defense waves: boarders breach the Hangar first, then the hull (any built side room);
  // an outbreak hatches every wave from its nest. The leader comes with the last wave.
  let waveIdx = 0;
  const breachRooms = defend ? map.rooms.filter(r => r.outer && r.id !== map.airlock && r.id !== map.bridge) : [];
  const waveAt = (w) => (threat.firstWaveAt ?? DEFENSE.firstWaveAt) + w * DEFENSE.waveEvery;
  function spawnWave() {
    const w = waveIdx++;
    const room = threat.kind === 'outbreak' ? nest : w % 2 === 0 || !breachRooms.length ? map.airlock : breachRooms[rng.int(breachRooms.length)].id;
    ev(t, 'breach', room, w + 1);
    const weights = Object.entries(ship.unitWeights);
    let total = 0; for (const [, x] of weights) total += x;
    const cheapest = Math.min(...weights.map(([id]) => UNIT_BY_ID[id].cost));
    const list = w === DEFENSE.waves - 1 && ship.leader ? [ship.leader] : [];
    let budget = waveBudget(w, squad.length, Math.floor((power * (threat.powerPct ?? 100)) / 100));
    for (let g = 0; g < 60 && budget >= cheapest; g++) {
      let r = rng.int(total), pick = weights[0][0];
      for (const [id, x] of weights) { if (r < x) { pick = id; break; } r -= x; }
      if (UNIT_BY_ID[pick].cost > budget) continue;
      budget -= UNIT_BY_ID[pick].cost; list.push(pick);
    }
    const rm = map.rooms[room];
    for (const id of list) {
      const p = freeTileIn(room) || freeTileNear(rm.cx, rm.cy); if (!p) break;
      const e = enemyUnit(id, p[0], p[1], { alerted: true, hidden: false }); ev(t, 'spawn', e.id, 'E', e.kind, e.x, e.y);
    }
  }
  const hardEnd = () => (V < 4 ? HARD_END_TICK : retreat.on ? Math.max(HARD_END_TICK, retreat.at + CLOCK.extractTicks) : CLOCK.absEnd);
  const seenEnemies = () => units.filter(e => e.side === 'E' && isTargetable(e) && !e.hidden && squad.some(s => {
    if (s.state !== 'active') return false;
    const sight = ship.dark ? DARK_SIGHT + (s.flags.tracker ? 4 : 0) + (s.st.tech >= 60 ? 2 : 0) : SIGHT;
    return cheb(s, e) <= sight && los(s.x, s.y, e.x, e.y);
  })).length;

  for (t = 0; t <= hardEnd(); t++) {
    // Hazards.
    for (const h of hazards) {
      if (t > h.until || t % h.def.every) continue;
      for (const u of units) {
        if (u.state !== 'active' || map.roomAt[idx(u.x, u.y)] !== h.room) continue;
        if (h.def.affects === 'organic' && u.tags.includes('synthetic')) continue;
        const d = Math.floor((h.def.dmg * (100 - Math.min(100, u.m.hazardResistPct || 0))) / 100);
        if (d > 0) { ev(t, 'hazard', u.id, h.room, d); hurt(u, d, null); }
        if (h.def.effect === 'panic') panicCheck(u, h.def.pressure || 10);
        if (h.def.effect === 'confuse') confuseCheck(u);
      }
    }
    // Egg pods hatch when a Soldier comes close (and, at full alarm, now and then on their own).
    if (eggs.length && t % 5 === 0) {
      for (const egg of eggs) if (!egg.hatched && squad.some(s => s.state === 'active' && cheb(s, egg) <= EGG_RANGE)) hatch(egg);
      if (alarmLevel === 2 && t % 150 === 0) { const left = eggs.filter(e => !e.hatched); if (left.length) hatch(left[rng.int(left.length)]); }
    }
    if (ship.gravity && t > 0 && t % GRAVITY_EVERY === 0) ev(t, 'gravity', gravityNow());
    if (ship.possession && t % 10 === 0) {
      for (const s of squad) if (s.state === 'down' && !s.possessed && t - s.downAt >= POSSESS_TICKS) {
        s.possessed = true; s.tally.ticksDown += t - s.downAt; s.downAt = t;
        const shell = spawnNear(null, s.x, s.y, { shellOf: s.id, name: `${s.name} (possessed)` });
        if (shell) ev(t, 'possessed', s.id, shell.id);
      }
    }
    if (defend && waveIdx < DEFENSE.waves && t === waveAt(waveIdx)) spawnWave();
    // Reinforcements.
    const rf = noRetreat ? ssReinforce : ship.reinforce;
    if (alarm2At >= 0 && wave < rf.waves && !reinforcementsCut) {
      const due = Math.max(alarm2At, rf.firstAt) + wave * rf.every;
      if (t === due || (t > due && rf.every === 0 && wave === 0)) {
        wave++;
        const lead = squad.find(s => s.state === 'active') || squad[0];
        const rooms = map.rooms.filter(r => r.id !== map.bridge && r.id !== map.roomAt[idx(lead.x, lead.y)])
          .sort((a, b) => cheb({ x: b.cx, y: b.cy }, lead) - cheb({ x: a.cx, y: a.cy }, lead) || a.id - b.id);
        const room = (rooms.find(r => r.type === 'quarters') || rooms[0]).id;
        let budget = rf.budget;
        const weights = Object.entries(ship.unitWeights).filter(([id]) => UNIT_BY_ID[id].cost > 0);
        ev(t, 'reinforce', wave, room);
        for (let g = 0; g < 30 && budget > 0; g++) {
          const [id] = weights[rng.int(weights.length)];
          if (UNIT_BY_ID[id].cost > budget) continue;
          budget -= UNIT_BY_ID[id].cost;
          const p = freeTileIn(room); if (!p) break;
          const e = enemyUnit(id, p[0], p[1], { alerted: true }); ev(t, 'spawn', e.id, 'E', e.kind, e.x, e.y);
        }
      }
    }
    // Hunting target at full alarm: the squad member closest to the bridge.
    if (alarmLevel === 2 && t >= huntRefresh) {
      huntRefresh = t + 40;
      const f = consoleField();
      const lead = squad.filter(s => s.state === 'active' && !s.hidden).sort((a, b) => f[idx(a.x, a.y)] - f[idx(b.x, b.y)] || a.id - b.id)[0];
      if (lead) huntTile = [lead.x, lead.y];
    }

    // Units act.
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.state !== 'active') continue;
      if (u.cloakUntil && u.cloakUntil === t && u.hidden) { u.hidden = false; ev(t, 'reveal', u.id); }
      if (u.busy > t || u.stunUntil > t) continue;
      if (u.task) { if (t >= u.task.until) finishTask(u); else continue; }
      if (u.ai === 'drone') droneDecide(u);
      else if (u.side === 'S' && !u.turret) squadDecide(u);
      else if (u.turret && u.side === 'S') { const foes = visibleFoes(u); if (foes.length) shoot(u, pickTarget(u, foes)); else u.busy = t + 5; }
      else { enemyDecide(u); if (u.state === 'active' && !u.turret) checkOverwatch(u); }
    }

    // Objective: hold the bridge.
    if (!defend && !retreat.on && !result) {
      const inBridge = squad.some(s => s.state === 'active' && map.roomAt[idx(s.x, s.y)] === map.bridge);
      const defenders = units.some(e => e.side === 'E' && isTargetable(e) && map.roomAt[idx(e.x, e.y)] === map.bridge);
      if (inBridge && !defenders) {
        bridgeObj.progress++;
        if (bridgeObj.progress % 10 === 0) ev(t, 'hold', bridgeObj.progress, bridgeObj.def.ticks);
        if (bridgeObj.progress >= bridgeObj.def.ticks) { bridgeObj.done = true; result = 'success'; ev(t, 'objdone', 'take_bridge'); }
      }
    }
    if (result) break;

    // Retreat trigger.
    const casualties = squad.filter(s => s.state === 'down').length;
    const activeCount = squad.filter(s => s.state === 'active').length;
    if (defend) {
      // Inverted: attackers holding the Bridge with no Soldier on it count down to losing the ship.
      const inBridgeS = squad.some(s => s.state === 'active' && map.roomAt[idx(s.x, s.y)] === map.bridge);
      const inBridgeE = units.some(e => e.side === 'E' && isTargetable(e) && map.roomAt[idx(e.x, e.y)] === map.bridge);
      if (inBridgeE && !inBridgeS) {
        bridgeObj.progress++;
        if (bridgeObj.progress % 10 === 0) ev(t, 'hold', bridgeObj.progress, bridgeObj.def.ticks);
        if (bridgeObj.progress >= bridgeObj.def.ticks) { result = 'lost'; ev(t, 'bridgelost'); break; }
      }
      if (activeCount === 0) { result = 'wipe'; ev(t, 'overrun', 'down'); break; }
      if (waveIdx >= DEFENSE.waves && !units.some(e => e.side === 'E' && isTargetable(e))) { result = 'success'; bridgeObj.done = true; ev(t, 'repelled'); break; }
      if (++clock >= clockLimit) { result = 'success'; bridgeObj.done = true; ev(t, 'survived'); break; }
    } else if (noRetreat) {
      // Fight to the last: the mission ends when nobody is left standing or the hard limit hits.
      if (activeCount === 0) { ev(t, 'overrun', 'down'); break; }
      if (++clock >= clockLimit) { ev(t, 'overrun', 'time'); break; }
    } else if (!retreat.on) {
      if (casualties >= retreatAtCount && deployed > 1) startRetreat('casualties');
      else if (activeCount === 0) startRetreat('casualties');
      else if (V < 4) { if (t >= RETREAT_AT_TICK) startRetreat('time'); }
      else {
        const onBridge = squad.some(s => s.state === 'active' && map.roomAt[idx(s.x, s.y)] === map.bridge);
        if (onBridge !== clockPaused) { clockPaused = onBridge; ev(t, 'clock', onBridge ? 1 : 0, clock, clockLimit); }
        if (!clockPaused) clock++;
        if (clock >= clockLimit) {
          const up = squad.filter(s => s.state === 'active');
          const winning = up.length > seenEnemies();
          const chance = winning && pushes < CLOCK.maxPushes ? pushChance(up.reduce((n, s) => n + s.st.grit, 0) / up.length, pushes) : 0;
          if (chance && rng.roll(chance)) { pushes++; clockLimit += CLOCK.pushTicks; ev(t, 'pushon', pushes, chance, clockLimit, clock); }
          else { ev(t, 'pushfail', chance, winning ? 1 : 0, pushes); startRetreat('time'); }
        } else if (t >= CLOCK.absEnd - CLOCK.extractTicks) startRetreat('time');
      }
    }
    // Extraction.
    if (retreat.on) {
      for (const s of squad) {
        if (s.rearGuard && s.state === 'active' && t >= s.holdUntil && s.extractAt === undefined) s.extractAt = t + retreatDef.extractTicks;
        if (s.extractAt === undefined || t < s.extractAt || (s.state !== 'active' && s.state !== 'down')) continue;
        if (retreat.exitRoom >= 0) {
          if (s.state !== 'active' || map.roomAt[idx(s.x, s.y)] !== retreat.exitRoom) { if (s.state !== 'active') continue; s.extractAt = undefined; continue; }
          extract(s, retreatDef.failResult === 'mia' && rng.roll(retreatDef.failPct));
          for (const d of squad) if (d.state === 'down' && !d.possessed) { ev(t, 'dragged', s.id, d.id); extract(d, retreatDef.failResult === 'mia' && rng.roll(retreatDef.failPct)); }
        } else extract(s);
      }
      // Anyone still able to get out?
      const pending = squad.some(s => (s.state === 'active') || (s.state === 'down' && s.extractAt !== undefined));
      if (!pending) break;
    }
  }
  const endT = Math.min(t, hardEnd());
  if (!result) result = squad.some(s => s.state === 'out') ? 'retreat' : 'wipe';

  // ---------- Outcome ----------
  const soldiers = squad.map(s => {
    let state;
    if ((result === 'success' || defend) && (s.state === 'active' || s.state === 'down')) {   // a defense is fought at home: nobody is left behind
      if (s.state === 'down') s.tally.ticksDown += endT - s.downAt;
      state = s.state === 'down' ? 'downed' : (s.revived ? 'revived' : 'fine');
    } else if (s.state === 'out') {
      state = s.mia ? 'mia' : s.wasDown ? 'downed' : (s.revived ? 'revived' : 'fine');
    } else {
      if (s.state === 'down') s.tally.ticksDown += endT - s.downAt;
      state = 'left';
    }
    const hpLostPct = Math.max(0, Math.min(100, Math.floor(((s.maxHp - Math.max(0, s.tally.minHp)) * 100) / s.maxHp)));
    return { uid: s.uid, unit: s.id, state, rearGuard: !!s.rearGuard, hpLostPct, ...s.tally };
  });
  const leader = units.find(e => e.side === 'E' && e.leader);
  for (const o of objectives) if (o.def.kind === 'leaderDown' && result === 'success' && leader.state === 'down') { o.done = true; ev(endT, 'objdone', o.id); }
  const progressPct = Math.floor((visited.size * 100) / map.rooms.length);

  const out = {
    engineVersion: ENGINE_VERSION, seed, ship: ship.id, entry: entry.id, tactic: tactic.id, retreat: retreatDef.id,
    result, ticks: endT, clockLeft: V >= 4 ? Math.max(0, clockLimit - clock) : Math.max(0, RETREAT_AT_TICK - endT), retreatReason: retreat.reason, retreatAt: retreat.at,
    ...(defend ? { mode: 'defend', threat: threat.id, power, rooms: { ...(input.rooms || {}) }, breaches: waveIdx } : {}),
    soldiers, objectives: objectives.map(o => ({ id: o.id, done: o.done })),
    progressPct, lootCrates, alarmLevel, reinforcementWaves: wave,
    enemies: { total: units.filter(u => u.side === 'E' || u.turret).length, killed: units.filter(u => u.state === 'dead').length },
    units: units.map(u => ({ id: u.id, side: u.side, kind: u.kind, name: u.name, maxHp: u.maxHp, ...(u.shellOf !== undefined ? { shellOf: u.shellOf } : {}) })),
    events,
  };
  out.hash = fnv1a(JSON.stringify([out.result, out.ticks, out.soldiers, out.objectives, events]));
  out.map = map;
  return out;
}
