// Procedural ship layout. Pure + deterministic: same rng state + ship id => same map.
// Rooms are rectangles of floor ("interior") with a 1-tile wall ring. Neighbouring rooms share
// that wall, and a door tile in it links them. The ship grows from the airlock outward
// (mostly "east", so ships read left-to-right), the bridge is attached to the room farthest
// from the airlock, then a few extra doors are punched to create loops (flanking routes).
import { ROOMS, SHIP_BY_ID } from '../data/ships.js';

export const T_VOID = 0, T_FLOOR = 1, T_WALL = 2, T_DOOR = 3;
export const GRID_W = 84, GRID_H = 60;
const EXTRA_DOOR_PCT = 35;

const SIDES = [['e', 4], ['n', 2], ['s', 2], ['w', 1]];

function weighted(rng, entries) {
  let total = 0; for (const [, w] of entries) total += w;
  let r = rng.int(total);
  for (const [k, w] of entries) { if (r < w) return k; r -= w; }
  return entries[entries.length - 1][0];
}

function overlapsAny(rooms, x, y, w, h) {
  // New interior expanded by its wall ring must not touch any other interior.
  for (const r of rooms) {
    if (x - 1 <= r.x + r.w - 1 && x + w >= r.x && y - 1 <= r.y + r.h - 1 && y + h >= r.y) return true;
  }
  return false;
}

// Try to attach a w*h room to `a` on `side`. Returns {x, y, door:[dx,dy]} or null.
function tryAttach(rng, rooms, a, w, h, side) {
  let x, y, dx, dy;
  if (side === 'e' || side === 'w') {
    x = side === 'e' ? a.x + a.w + 1 : a.x - 1 - w;
    y = rng.range(a.y - h + 1, a.y + a.h - 1);
    const lo = Math.max(a.y, y), hi = Math.min(a.y + a.h - 1, y + h - 1);
    if (hi < lo) return null;
    dx = side === 'e' ? a.x + a.w : a.x - 1; dy = rng.range(lo, hi);
  } else {
    y = side === 's' ? a.y + a.h + 1 : a.y - 1 - h;
    x = rng.range(a.x - w + 1, a.x + a.w - 1);
    const lo = Math.max(a.x, x), hi = Math.min(a.x + a.w - 1, x + w - 1);
    if (hi < lo) return null;
    dy = side === 's' ? a.y + a.h : a.y - 1; dx = rng.range(lo, hi);
  }
  if (x < 1 || y < 1 || x + w > GRID_W - 1 || y + h > GRID_H - 1) return null;
  if (overlapsAny(rooms, x, y, w, h)) return null;
  return { x, y, door: [dx, dy] };
}

function roomDims(rng, type) {
  const t = ROOMS[type];
  let w = rng.range(t.w[0], t.w[1]), h = rng.range(t.h[0], t.h[1]);
  if (type === 'corridor' && rng.roll(50)) { const s = w; w = h; h = s; }   // corridors run either way
  return [w, h];
}

function graphDist(rooms, doors, from) {
  const d = rooms.map(() => -1); d[from] = 0; const q = [from];
  while (q.length) { const r = q.shift(); for (const dr of doors) {
    const o = dr.a === r ? dr.b : dr.b === r ? dr.a : -1;
    if (o >= 0 && d[o] < 0) { d[o] = d[r] + 1; q.push(o); } } }
  return d;
}

function buildLayout(rng, ship) {
  const count = rng.range(ship.rooms.count[0], ship.rooms.count[1]);
  const middle = ship.rooms.required.filter(r => r !== 'airlock' && r !== 'bridge');
  const pool = Object.entries(ship.rooms.pool);
  while (middle.length < count - 2) middle.push(weighted(rng, pool));
  // shuffle middle (Fisher-Yates)
  for (let i = middle.length - 1; i > 0; i--) { const j = rng.int(i + 1); const s = middle[i]; middle[i] = middle[j]; middle[j] = s; }

  const rooms = [], doors = [];
  const [aw, ah] = roomDims(rng, 'airlock');
  rooms.push({ type: 'airlock', x: 2, y: (GRID_H >> 1) - (ah >> 1), w: aw, h: ah });

  const place = (type, parents) => {
    const [w, h] = roomDims(rng, type);
    for (let attempt = 0; attempt < 80; attempt++) {
      const pi = parents[attempt < 40 ? rng.int(Math.min(3, parents.length)) : rng.int(parents.length)];
      const side = weighted(rng, SIDES);
      const p = tryAttach(rng, rooms, rooms[pi], w, h, side);
      if (p) {
        rooms.push({ type, x: p.x, y: p.y, w, h });
        doors.push({ x: p.door[0], y: p.door[1], a: pi, b: rooms.length - 1 });
        return true;
      }
    }
    return false;
  };

  for (const type of middle) {
    // Prefer growing from the most recently placed rooms -> long, ship-like hulls.
    const parents = rooms.map((_, i) => i).reverse();
    if (!place(type, parents) && ship.rooms.required.includes(type)) return null;
  }
  // Bridge: as far from the airlock as possible.
  const dist = graphDist(rooms, doors, 0);
  const byFar = rooms.map((_, i) => i).sort((a, b) => dist[b] - dist[a] || a - b);
  if (!place('bridge', byFar.slice(0, 1).concat(byFar.slice(1)))) return null;
  return { rooms, doors };
}

export function generateShip(rng, shipId) {
  const ship = SHIP_BY_ID[shipId];
  let layout = null;
  for (let tries = 0; tries < 20 && !layout; tries++) layout = buildLayout(rng, ship);
  if (!layout) throw new Error('mapgen failed for ' + shipId);
  const { rooms, doors } = layout;

  // Extra doors between rooms that share a wall -> loops.
  const linked = new Set(doors.map(d => Math.min(d.a, d.b) + ':' + Math.max(d.a, d.b)));
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    if (linked.has(i + ':' + j)) continue;
    const A = rooms[i], B = rooms[j];
    let cand = null;
    if (A.x + A.w + 1 === B.x || B.x + B.w + 1 === A.x) {
      const lo = Math.max(A.y, B.y), hi = Math.min(A.y + A.h - 1, B.y + B.h - 1);
      if (hi >= lo) cand = [A.x + A.w + 1 === B.x ? A.x + A.w : B.x + B.w, lo + ((hi - lo) >> 1)];
    } else if (A.y + A.h + 1 === B.y || B.y + B.h + 1 === A.y) {
      const lo = Math.max(A.x, B.x), hi = Math.min(A.x + A.w - 1, B.x + B.w - 1);
      if (hi >= lo) cand = [lo + ((hi - lo) >> 1), A.y + A.h + 1 === B.y ? A.y + A.h : B.y + B.h];
    }
    if (cand && rng.roll(EXTRA_DOOR_PCT)) { doors.push({ x: cand[0], y: cand[1], a: i, b: j }); linked.add(i + ':' + j); }
  }

  // Tiles.
  const tiles = new Uint8Array(GRID_W * GRID_H);
  const roomAt = new Int16Array(GRID_W * GRID_H).fill(-1);
  const cover = new Uint8Array(GRID_W * GRID_H);
  const idx = (x, y) => y * GRID_W + x;
  rooms.forEach((r, ri) => {
    r.id = ri; r.name = ROOMS[r.type].name;
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
      const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
      if (inside) { tiles[idx(x, y)] = T_FLOOR; roomAt[idx(x, y)] = ri; }
      else if (tiles[idx(x, y)] === T_VOID) tiles[idx(x, y)] = T_WALL;
    }
  });
  doors.forEach((d, di) => {
    d.id = di; tiles[idx(d.x, d.y)] = T_DOOR;
    const lockedRoom = ROOMS[rooms[d.a].type].locked || ROOMS[rooms[d.b].type].locked;
    d.locked = !!lockedRoom || (d.a !== 0 && d.b !== 0 && rng.roll(ship.lockedPct));
    d.open = false;
  });
  const nearDoor = (x, y) => doors.some(d => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1);

  // Features + cover.
  const features = [];
  for (const r of rooms) {
    const t = ROOMS[r.type];
    r.features = [];
    const used = new Set();
    const freeTile = (pref) => {
      for (let k = 0; k < 40; k++) {
        let x, y;
        if (pref === 'center') { x = r.x + (r.w >> 1); y = r.y + (r.h >> 1); if (k) { x += rng.range(-1, 1); y += rng.range(-1, 1); } }
        else if (pref === 'edge') { const e = rng.int(4); x = e < 2 ? r.x + rng.int(r.w) : (e === 2 ? r.x : r.x + r.w - 1); y = e >= 2 ? r.y + rng.int(r.h) : (e === 0 ? r.y : r.y + r.h - 1); }
        else { x = r.x + rng.int(r.w); y = r.y + rng.int(r.h); }
        const key = idx(x, y);
        if (!used.has(key) && !nearDoor(x, y)) { used.add(key); return [x, y]; }
      }
      return null;
    };
    for (const f of t.features) {
      const pos = freeTile(f === 'console' ? 'center' : (f === 'turret' || f === 'pods' || f === 'vent') ? 'edge' : 'any');
      if (pos) { const feat = { kind: f, x: pos[0], y: pos[1], room: r.id }; r.features.push(feat); features.push(feat); }
    }
    const n = Math.floor((r.w * r.h * t.cover) / 100);
    for (let k = 0; k < n; k++) { const pos = freeTile('any'); if (pos) cover[idx(pos[0], pos[1])] = rng.roll(30) ? 2 : 1; }
    r.hazard = t.hazard || null;
    if (ship.eggPct && r.type !== 'airlock' && r.type !== 'bridge' && rng.roll(ship.eggPct)) {
      for (let k = 0; k < 2; k++) { const pos = freeTile('any'); if (pos) { const feat = { kind: 'eggs', x: pos[0], y: pos[1], room: r.id }; r.features.push(feat); features.push(feat); } }
    }
    if (ship.sporePct && r.type !== 'airlock' && rng.roll(ship.sporePct)) r.hazard = 'spores';
    r.outer = !!t.outer;
    r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1);
  }
  // Only `ship.turrets` turret mounts get a turret (bridge first).
  const mounts = features.filter(f => f.kind === 'turret').sort((a, b) => (rooms[b.room].type === 'bridge') - (rooms[a.room].type === 'bridge') || a.room - b.room);
  mounts.forEach((m, i) => { m.active = i < ship.turrets; });

  const bridge = rooms.find(r => r.type === 'bridge');
  const consoleF = bridge.features.find(f => f.kind === 'console') || { x: bridge.cx, y: bridge.cy };
  return {
    w: GRID_W, h: GRID_H, tiles, roomAt, cover, rooms, doors, features,
    airlock: 0, bridge: bridge.id, console: [consoleF.x, consoleF.y],
    distFromBridge: graphDist(rooms, doors, bridge.id),
    distFromAirlock: graphDist(rooms, doors, 0),
  };
}

// Compact JSON-safe version for the renderer / replay viewer.
export function serializeMap(m) {
  return {
    w: m.w, h: m.h, tiles: Array.from(m.tiles), cover: Array.from(m.cover),
    rooms: m.rooms.map(({ id, type, name, x, y, w, h, hazard }) => ({ id, type, name, x, y, w, h, hazard })),
    doors: m.doors.map(({ id, x, y, a, b, locked }) => ({ id, x, y, a, b, locked })),
    features: m.features.map(({ kind, x, y, room, active }) => ({ kind, x, y, room, active })),
    console: m.console,
  };
}
