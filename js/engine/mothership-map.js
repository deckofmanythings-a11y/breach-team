// The Mothership as a map (docs/MOTHERSHIP.md, phase M3). A FIXED, hand-authored layout: one slot
// per room. Built rooms are floor with a door onto the spine; unbuilt slots are sealed hull (solid
// wall, no door). The result has the same shape as mapgen's generateShip(), so the battle engine
// (Mothership defense, M4) and the renderer can use it unchanged.
// New file on purpose (stale-cache rule): it doesn't add exports to mapgen.js.
import { T_VOID, T_FLOOR, T_WALL, T_DOOR, GRID_W, GRID_H } from './mapgen.js';
import { createRng, hashString } from './rng.js';
import { roomLevel } from '../data/mothership-rooms.js';

// Bow points right. Spine corridor y 24-27; upper rooms y 15-22 (door row y 23); lower rooms
// y 29-36 (door row y 28). `room` = a Mothership room id (built per its level); `fixed` slots
// always exist. `type` is the engine room type.
export const MS_LAYOUT = [
  { key: 'hangar',        room: 'hangar',        type: 'airlock',     name: 'Hangar',           x: 2,  y: 20, w: 10, h: 12, door: [12, 25], fixed: true },
  { key: 'spine',                                type: 'corridor',    name: 'Spine',            x: 13, y: 24, w: 40, h: 4,  fixed: true },
  { key: 'bridge',                               type: 'bridge',      name: 'Bridge',           x: 54, y: 21, w: 9,  h: 10, door: [53, 25], fixed: true },
  { key: 'quarters',                             type: 'quarters',    name: 'Crew Quarters',    x: 13, y: 15, w: 8,  h: 8,  door: [16, 23], fixed: true },
  { key: 'med_bay',       room: 'med_bay',       type: 'medbay',      name: 'Med Bay',          x: 22, y: 15, w: 7,  h: 8,  door: [25, 23] },
  { key: 'training_deck', room: 'training_deck', type: 'training',    name: 'Training Deck',    x: 30, y: 15, w: 9,  h: 8,  door: [34, 23] },
  { key: 'chapel',        room: 'chapel',        type: 'chapel',      name: 'Memorial Chapel',  x: 40, y: 15, w: 6,  h: 8,  door: [43, 23] },
  { key: 'intel',         room: 'intel',         type: 'intel',       name: 'Intel Room',       x: 47, y: 15, w: 6,  h: 8,  door: [50, 23] },
  { key: 'armory',        room: 'armory',        type: 'armory',      name: 'Armory',           x: 13, y: 29, w: 7,  h: 8,  door: [16, 28] },
  { key: 'teleporter',    room: 'teleporter',    type: 'teleporter',  name: 'Teleporter Array', x: 21, y: 29, w: 7,  h: 8,  door: [24, 28] },
  { key: 'security',      room: 'security',      type: 'security',    name: 'Security Post',    x: 29, y: 29, w: 6,  h: 8,  door: [32, 28] },
  { key: 'quarantine',    room: 'quarantine',    type: 'quarantine',  name: 'Quarantine Bay',   x: 36, y: 29, w: 7,  h: 8,  door: [39, 28] },
  { key: 'engineering',                          type: 'engineering', name: 'Engineering',      x: 44, y: 29, w: 9,  h: 8,  door: [48, 28], fixed: true },
];
export const MS_SLOT_BY_ROOM = Object.fromEntries(MS_LAYOUT.filter(s => s.room).map(s => [s.room, s]));

// Furniture per room type: [kind, ...] for every level (index 0 = level 1). Cover % grows with level.
const FIT = {
  airlock:     { cover: [10, 15, 20], feat: [['pods'], ['pods'], ['pods', 'pods']] },
  corridor:    { cover: [4, 4, 4],    feat: [['vent']] },
  bridge:      { cover: [20, 20, 20], feat: [['console', 'turret']] },
  quarters:    { cover: [20, 20, 20], feat: [['vent']] },
  engineering: { cover: [20, 20, 20], feat: [['terminal', 'vent']] },
  medbay:      { cover: [10, 15, 20], feat: [['terminal'], ['terminal'], ['terminal', 'terminal']] },
  training:    { cover: [25, 32, 40], feat: [[], ['terminal'], ['terminal']] },
  chapel:      { cover: [8, 12, 16],  feat: [['terminal'], ['terminal'], ['terminal']] },
  intel:       { cover: [10, 10, 10], feat: [['terminal'], ['terminal', 'terminal'], ['terminal', 'terminal', 'terminal']] },
  armory:      { cover: [20, 25, 30], feat: [['loot'], ['loot', 'turret'], ['loot', 'loot', 'turret']] },
  teleporter:  { cover: [6, 6, 6],    feat: [['terminal'], ['terminal'], ['terminal', 'terminal']] },
  security:    { cover: [25, 30, 35], feat: [['terminal', 'turret'], ['terminal', 'turret', 'turret'], ['terminal', 'turret', 'turret', 'turret']] },
  quarantine:  { cover: [10, 10, 10], feat: [['terminal'], ['terminal'], ['terminal']] },
};

// Plain BFS over room doors (mapgen's graphDist isn't exported, and the stale-cache rule says
// don't add exports to it).
function roomDist(rooms, doors, from) {
  const d = new Array(rooms.length).fill(Infinity); d[from] = 0;
  const q = [from];
  while (q.length) { const r = q.shift(); for (const dr of doors) { const o = dr.a === r ? dr.b : dr.b === r ? dr.a : -1; if (o >= 0 && d[o] === Infinity) { d[o] = d[r] + 1; q.push(o); } } }
  return d;
}

// g: a save (only g.mothership is read). Returns { ...engine map, slots } where `slots` lists every
// layout slot with its level and, for built ones, its room index.
export function buildMothershipMap(g) {
  const levelOf = (s) => (s.fixed && !s.room ? 1 : roomLevel(g, s.room));
  const slots = MS_LAYOUT.map(s => ({ ...s, level: levelOf(s) }));
  const built = slots.filter(s => s.level > 0);
  const rooms = built.map((s, i) => ({ id: i, type: s.type, name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, key: s.key, level: s.level }));
  built.forEach((s, i) => { s.roomIndex = i; });
  const spine = rooms.find(r => r.key === 'spine').id;
  const tiles = new Uint8Array(GRID_W * GRID_H), roomAt = new Int16Array(GRID_W * GRID_H).fill(-1), cover = new Uint8Array(GRID_W * GRID_H);
  const idx = (x, y) => y * GRID_W + x;
  // Hull: every slot (built or not) gets an outer wall ring, so the ship's silhouette never changes;
  // an unbuilt slot is solid wall inside too (sealed).
  for (const s of slots) for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    const inside = x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h;
    if (inside && s.level > 0) { tiles[idx(x, y)] = T_FLOOR; roomAt[idx(x, y)] = s.roomIndex; }
    else if (tiles[idx(x, y)] === T_VOID) tiles[idx(x, y)] = T_WALL;
  }
  const doors = [];
  for (const s of built) if (s.door) {
    const [x, y] = s.door; tiles[idx(x, y)] = T_DOOR;
    doors.push({ id: doors.length, x, y, a: s.key === 'hangar' ? s.roomIndex : spine, b: s.key === 'hangar' ? spine : s.roomIndex, locked: false, open: false });
  }
  const features = [];
  for (const r of rooms) {
    const fit = FIT[r.type] || { cover: [10], feat: [[]] };
    const lv = Math.max(1, Math.min(r.level, 3));
    const rng = createRng(hashString(`ms:${r.key}:${lv}`));   // same room + level = same furniture, always
    const used = new Set();
    const nearDoor = (x, y) => doors.some(d => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1);
    const free = (pref) => {
      for (let k = 0; k < 60; k++) {
        let x, y;
        if (pref === 'center') { x = r.x + (r.w >> 1) + (k ? rng.range(-1, 1) : 0); y = r.y + (r.h >> 1) + (k ? rng.range(-1, 1) : 0); }
        else if (pref === 'edge') { const e = rng.int(4); x = e < 2 ? r.x + rng.int(r.w) : (e === 2 ? r.x : r.x + r.w - 1); y = e >= 2 ? r.y + rng.int(r.h) : (e === 0 ? r.y : r.y + r.h - 1); }
        else { x = r.x + rng.int(r.w); y = r.y + rng.int(r.h); }
        if (!used.has(idx(x, y)) && !nearDoor(x, y)) { used.add(idx(x, y)); return [x, y]; }
      }
      return null;
    };
    r.features = [];
    for (const kind of fit.feat[Math.min(lv, fit.feat.length) - 1]) {
      const p = free(kind === 'console' ? 'center' : (kind === 'turret' || kind === 'pods' || kind === 'vent') ? 'edge' : 'any');
      if (p) { const f = { kind, x: p[0], y: p[1], room: r.id, ...(kind === 'turret' ? { active: true } : {}) }; r.features.push(f); features.push(f); }
    }
    const n = Math.floor((r.w * r.h * fit.cover[Math.min(lv, fit.cover.length) - 1]) / 100);
    for (let k = 0; k < n; k++) { const p = free('any'); if (p) cover[idx(p[0], p[1])] = rng.roll(30) ? 2 : 1; }
    r.hazard = null; r.outer = r.type === 'airlock' || r.y <= 15 || r.y + r.h >= 37;
    r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1);
  }
  const bridge = rooms.find(r => r.type === 'bridge');
  const consoleF = bridge.features.find(f => f.kind === 'console') || { x: bridge.cx, y: bridge.cy };
  return {
    w: GRID_W, h: GRID_H, tiles, roomAt, cover, rooms, doors, features,
    airlock: 0, bridge: bridge.id, console: [consoleF.x, consoleF.y],
    distFromBridge: roomDist(rooms, doors, bridge.id), distFromAirlock: roomDist(rooms, doors, 0),
    slots,
  };
}
