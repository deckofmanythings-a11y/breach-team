// Unity <-> engine bridge. Owned by the Unity repo; everything else in this folder is synced from the
// web game by Tools/sync-engine.mjs. Every function takes and returns JSON strings so the C# side never
// has to walk JS objects.
import { simulate } from './engine/battle.js';
import { rollAftermath } from './engine/aftermath.js';
import { ENGINE_VERSION, engineCompatible } from './data/version.js';
import { SPECIALTIES } from './data/specialties.js';
import { SLOTS, RARITIES, WEAPON_TYPES, ITEMS, AFFIXES } from './data/gear.js';
import { FACTIONS, SYSTEM_UNITS, UNIT_BY_ID } from './data/factions.js';
import { SHIPS, ALL_SHIPS, ROOMS, OBJECTIVES } from './data/ships.js';
import { ENTRIES, RETREATS } from './data/entries.js';
import { TACTICS } from './data/tactics.js';
import { HAZARDS } from './data/hazards.js';
import { PACKS, GRADES } from './data/economy.js';
import { STATS, STAT_INFO, TICKS_PER_SEC, RETREAT_AT_TICK } from './data/stats.js';
import { INJURIES } from './data/injuries.js';
import { COMMENDATIONS } from './data/commendations.js';
import { SUICIDE_SQUAD } from './data/suicide-squad.js';
import { DEFAULT_CLASS_ACCENTS } from './data/class-colors.js';
import { MS_ROOMS, mothershipInput, entryMaxSquad } from './data/mothership-rooms.js';
import { EASTER_EGGS } from './data/easter-eggs.js';
import { condition, canDeploy, effectiveStats } from './game/rules.js';

const list = (a) => Array.from(a);

// Battle + map in one payload. Typed arrays become plain arrays; graph-distance helpers are dropped.
export function simulateJson(inputJson) {
  const b = simulate(JSON.parse(inputJson));
  const m = b.map;
  const map = { ...m, tiles: list(m.tiles), cover: list(m.cover), roomAt: list(m.roomAt) };
  delete map.distFromBridge; delete map.distFromAirlock;
  return JSON.stringify({ ...b, map });
}

export function aftermathJson(battleJson, squadJson, mothershipJson) {
  return JSON.stringify(rollAftermath(JSON.parse(battleJson), JSON.parse(squadJson), mothershipJson ? JSON.parse(mothershipJson) : null));
}

export function engineVersion() { return ENGINE_VERSION; }
export function compatible(v) { return engineCompatible(v); }

// Display data for the UI. JSON.stringify drops functions, so only plain data crosses over.
export function catalogJson() {
  return JSON.stringify({ engineVersion: ENGINE_VERSION, SPECIALTIES, SLOTS, RARITIES, WEAPON_TYPES, ITEMS, AFFIXES,
    FACTIONS, SYSTEM_UNITS, UNITS: Object.values(UNIT_BY_ID), SHIPS, ROOMS, OBJECTIVES, ENTRIES, RETREATS, TACTICS,
    HAZARDS, PACKS, GRADES, STATS, STAT_INFO, DEFAULT_CLASS_ACCENTS, ALL_SHIPS, INJURIES, SUICIDE_SQUAD,
    COMMENDATIONS: COMMENDATIONS.map(({ id, name, desc }) => ({ id, name, desc })), TICKS_PER_SEC, RETREAT_AT_TICK,
    MS_ROOMS: MS_ROOMS.map(({ id, name }) => ({ id, name })),
    ACHIEVEMENTS: EASTER_EGGS.filter(e => e.data && e.data.how).map(e => ({ id: e.id, name: e.data.name, how: e.data.how })) });
}

// Deploy screen data that needs the game rules: entry seat counts with the Mothership bonus, the
// Mothership's entry perks, and per-Soldier deployability / condition / Suicide Squad eligibility.
export function deployInfoJson(saveJson) {
  const g = JSON.parse(saveJson);
  const msEntry = mothershipInput(g)?.entry || null;
  const m = msEntry || {};
  const perks = (e) => {
    const t = [];
    if (e.id === 'teleport' && m.teleportFailPct) t.push(m.teleportFailPct <= -100 ? 'no misfires' : `${-m.teleportFailPct}% fewer misfires`);
    if (e.id === 'breach_pod') { if (m.podClose) t.push('can land next to the Bridge'); if (m.podShock) t.push('impact stuns the next rooms'); }
    if (e.id === 'vent_crawl') { if (m.ventClose) t.push('comes out closer to the Bridge'); if (m.ventAmbush) t.push('shots from hiding always crit'); }
    return t;
  };
  const soldiers = (g.soldiers || []).map(s => {
    let tough = 0;
    try { const st = effectiveStats(g, s); tough = (s.specialty === 'medic' ? -1000 : 0) + st.hp + st.arm * 2; } catch { tough = 0; }
    return { uid: s.uid, name: s.name, specialty: s.specialty, level: s.level, condition: condition(s), canDeploy: canDeploy(s),
      suicideEligible: s.level >= SUICIDE_SQUAD.minLevel, toughScore: tough };
  });
  return JSON.stringify({
    msEntry,
    entries: ENTRIES.map(e => ({ id: e.id, baseMax: e.maxSquad, maxSquad: entryMaxSquad(e, msEntry), perks: perks(e) })),
    ssUnlocked: soldiers.some(s => s.level >= SUICIDE_SQUAD.unlockLevel),
    soldiers,
  });
}

// ---------- Generic read-only access for the menus ----------
// callJson('module.name', argsJson) calls an exported function (or returns an exported value) from the
// whitelisted modules below, so new screens never need bridge edits. Typed arrays, Sets and Maps are
// converted for JSON. Mutating rules exist here too, but the client only ever uses them on throwaway
// copies: the server owns the save.
import * as rules from './game/rules.js';
import * as ladder from './game/ladder.js';
import * as economy from './data/economy.js';
import * as msRooms from './data/mothership-rooms.js';
import * as defenseEvents from './data/defense-events.js';
import * as threats from './data/threats.js';
import * as looks from './data/looks.js';
import * as gear from './data/gear.js';
import * as specialties from './data/specialties.js';
import * as factions from './data/factions.js';
import * as ships from './data/ships.js';
import * as progression from './engine/progression.js';
import * as scout from './engine/scout.js';
import * as msMap from './engine/mothership-map.js';
import * as defenseSetup from './engine/defense-setup.js';
import * as quartermaster from './game/quartermaster.js';
import * as qmData from './data/quartermaster.js';

const MODULES = { rules, ladder, economy, msRooms, defenseEvents, threats, looks, gear, specialties, factions, ships,
  progression, scout, msMap, defenseSetup, quartermaster, qmData };

function plain(_k, v) {
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (v instanceof Set) return Array.from(v);
  if (v instanceof Map) return Object.fromEntries(v);
  if (typeof v === 'function') return undefined;
  return v;
}

export function callJson(name, argsJson) {
  const [mod, fn] = name.split('.');
  const m = MODULES[mod];
  if (!m || !(fn in m)) throw new Error(`bridge: unknown ${name}`);
  const target = m[fn];
  const out = typeof target === 'function' ? target(...(argsJson ? JSON.parse(argsJson) : [])) : target;
  return JSON.stringify(out === undefined ? null : out, plain);
}
