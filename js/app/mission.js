// Mission playback (placeholder graphics). The engine already decided everything; this only
// replays its event log. Results stay hidden until playback ends (or the player skips).
import { el, esc, avatar, itemLabel, ribbon } from './ui.js';
import { COMMENDATION_BY_ID } from '../data/commendations.js';
import * as G from './state.js?v=3';
import { T_VOID, T_WALL, T_DOOR } from '../engine/mapgen.js';
import { simulate } from '../engine/battle.js';
import { TICKS_PER_SEC } from '../data/stats.js';
import { UNIT_BY_ID, FACTION_BY_ID } from '../data/factions.js';
import { SPECIALTY_BY_ID } from '../data/specialties.js';
import { INJURY_BY_ID } from '../data/injuries.js';
import { OBJECTIVES, SHIP_BY_ID } from '../data/ships.js';
import { ENTRY_BY_ID, RETREAT_BY_ID } from '../data/entries.js';
import { TACTIC_BY_ID } from '../data/tactics.js';
import { STAT_INFO } from '../data/stats.js';
import { soldierToken, unitToken, FACTION_RING, loadImage, floorSrc } from '../render/tokens.js';
import { computeBarks } from './barks.js';
import { EGG_BY_ID } from '../data/easter-eggs.js';
import { SHIP_BY_ID as SHIPS_ALL } from '../data/ships.js';
import { ITEM_BY_ID } from '../data/gear.js';
import * as sfx from '../audio/sfx.js';

let PIXI = null;
let current = null;   // active playback (destroyed when leaving)
let exitTo = (r) => { location.hash = r; };
export const setExit = (fn) => { exitTo = fn; };
let openSoldierFn = null;
export const setOpenSoldier = (fn) => { openSoldierFn = fn; };

const HEX = (c) => parseInt(String(c).replace('#', ''), 16);
const HAZARD_TINT = { radiation: 0x5dff6a, decompression: 0x9fd8ff, fire: 0xff7a1a, spores: 0x9ee86a };

export async function replayMission(panel, h) {
  const battle = simulate(h.input);
  return playMission(panel, battle, h, h.colors || {}, true);
}

export async function playMission(panel, battle, report, colors, isReplay = false) {
  if (current) current.destroy();
  panel.innerHTML = '';
  const map = battle.map;
  const ship = SHIP_BY_ID[battle.ship];
  const faction = FACTION_BY_ID[ship.faction];
  const wrap = el(`<div class="mission">
    <div class="stage" id="stage"><div class="hudtop">
      <div>${report.secret ? '<b class="bad">UNKNOWN CONTACT</b> · ' : ''}<b>${esc(ship.name)}</b> · ${ENTRY_BY_ID[battle.entry].name} · ${TACTIC_BY_ID[battle.tactic].name} · <span id="clock">0:00</span> · Alarm <b id="alarm" class="alarm0">CALM</b><span id="hold"></span><span id="grav"></span></div>
      <div class="row"><button data-sp="1">1×</button><button data-sp="2">2×</button><button data-sp="4">4×</button><button id="skip">Skip ▶▶</button></div>
    </div></div>
    <div class="side"><div class="card squadhud" id="squad"></div><div class="feed" id="feed"></div></div>
  </div>`);
  panel.append(wrap);
  const feed = wrap.querySelector('#feed');

  try { PIXI = PIXI || await import('pixi.js'); }
  catch (e) { wrap.querySelector('#stage').append(el(`<div style="padding:40px" class="bad">Couldn't load the graphics library (PixiJS). Check your connection. The mission was still fought: see the report.</div>`)); return showReport(panel, battle, report, isReplay); }

  const stageEl = wrap.querySelector('#stage');
  const app = new PIXI.Application();
  await app.init({ background: 0x05080b, resizeTo: stageEl, antialias: true });
  stageEl.prepend(app.canvas);

  // ---- Fit map ----
  let minX = map.w, minY = map.h, maxX = 0, maxY = 0;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.tiles[y * map.w + x] !== T_VOID) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const world = new PIXI.Container(); app.stage.addChild(world);
  const TS = 24;   // world tile size; the container is scaled to fit
  // ---- Camera: fit by default; drag to pan, wheel / pinch / buttons to zoom ----
  let fitScale = 1, userMoved = false;
  function fit() {
    const w = app.screen.width, h = app.screen.height - 40;
    const sc = Math.min(w / ((maxX - minX + 1) * TS), h / ((maxY - minY + 1) * TS)) * 0.96;
    fitScale = sc; userMoved = false;
    world.scale.set(sc);
    world.x = (w - (maxX - minX + 1) * TS * sc) / 2 - minX * TS * sc;
    world.y = 40 + (h - (maxY - minY + 1) * TS * sc) / 2 - minY * TS * sc;
    zoomLabel();
  }
  // Keep at least a strip of the ship on screen so it can't be lost off the edge.
  function clampView() {
    const s = world.scale.x, w = app.screen.width, h = app.screen.height, m = 80;
    const l = world.x + minX * TS * s, r = world.x + (maxX + 1) * TS * s;
    const t = world.y + minY * TS * s, b = world.y + (maxY + 1) * TS * s;
    if (r < m) world.x += m - r; if (l > w - m) world.x -= l - (w - m);
    if (b < m) world.y += m - b; if (t > h - m) world.y -= t - (h - m);
  }
  function zoomAt(px, py, factor) {
    const s0 = world.scale.x, s1 = Math.min(fitScale * 6, Math.max(fitScale * 0.75, s0 * factor)), k = s1 / s0;
    world.x = px - (px - world.x) * k; world.y = py - (py - world.y) * k;
    world.scale.set(s1); userMoved = true; clampView(); zoomLabel();
  }
  function zoomLabel() { const z = wrap.querySelector('#zfit'); if (z) z.textContent = `${Math.round(world.scale.x / fitScale * 100)}%`; }
  fit(); app.renderer.on('resize', () => { if (userMoved) clampView(); else fit(); });

  const cv = app.canvas, ptrs = new Map();
  let pinch = null;
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(x, y, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015))); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e)); cv.classList.add('dragging');
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; }
  });
  cv.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId); if (!prev) return;
    const p = local(e); ptrs.set(e.pointerId, p);
    if (ptrs.size === 1) { world.x += p[0] - prev[0]; world.y += p[1] - prev[1]; userMoved = true; clampView(); }
    else if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      // pan by half this finger's move (the midpoint's move), then zoom around the midpoint
      world.x += (p[0] - prev[0]) / 2; world.y += (p[1] - prev[1]) / 2;
      if (pinch.d > 0) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch.d);
      pinch.d = d;
    }
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) cv.classList.remove('dragging'); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('dblclick', (e) => { const [x, y] = local(e); zoomAt(x, y, 2); });
  const zc = el(`<div class="zoomctl"><button id="zin" title="Zoom in">+</button><button id="zfit" title="Fit the whole ship">100%</button><button id="zout" title="Zoom out">−</button></div>`);
  stageEl.append(zc);
  const mid = () => [app.screen.width / 2, app.screen.height / 2];
  zc.querySelector('#zin').onclick = () => zoomAt(...mid(), 1.4);
  zc.querySelector('#zout').onclick = () => zoomAt(...mid(), 1 / 1.4);
  zc.querySelector('#zfit').onclick = fit;
  zoomLabel();

  // ---- Static layer ----
  const g0 = new PIXI.Graphics(); world.addChild(g0);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const v = map.tiles[y * map.w + x]; if (v === T_VOID) continue;
    if (v === T_WALL) g0.rect(x * TS, y * TS, TS, TS).fill(0x34485c);
    else g0.rect(x * TS, y * TS, TS, TS).fill(map.rooms[map.roomAt[y * map.w + x]]?.type === 'bridge' ? 0x1d2a1f : 0x17212b);
  }
  // Ship floor art: ONE whole image per faction, laid across the entire floor once (never tiled),
  // cropped to the ship's aspect, dimmed so units stay readable, masked to floor tiles.
  const floorMask = new PIXI.Graphics(); world.addChild(floorMask);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (map.tiles[y * map.w + x] !== T_VOID && map.tiles[y * map.w + x] !== T_WALL) floorMask.rect(x * TS, y * TS, TS, TS).fill(0xffffff);
  loadImage(floorSrc(ship.faction)).then(img => {
    if (!app.renderer || world.destroyed) return;
    const bw = (maxX - minX + 1) * TS, bh = (maxY - minY + 1) * TS;
    const src = PIXI.Texture.from(img);
    const k = Math.min(img.width / bw, img.height / bh);
    const fw = bw * k, fh = bh * k;
    const tex = new PIXI.Texture({ source: src.source, frame: new PIXI.Rectangle((img.width - fw) / 2, (img.height - fh) / 2, fw, fh) });
    const sp = new PIXI.Sprite(tex);
    sp.x = minX * TS; sp.y = minY * TS; sp.width = bw; sp.height = bh;
    sp.mask = floorMask; sp.tint = 0x8c8c8c; sp.alpha = 0.6;
    world.addChildAt(sp, world.getChildIndex(floorMask));
  }).catch(() => { floorMask.destroy(); });   // no floor art: drop the (otherwise visible) mask shape
  // Wall art: same rule as the floor, one whole image per faction laid once across all wall tiles.
  const isWall = (x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h && map.tiles[y * map.w + x] === T_WALL;
  const isFloor = (x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h && map.tiles[y * map.w + x] !== T_WALL && map.tiles[y * map.w + x] !== T_VOID;
  const wallMask = new PIXI.Graphics(); world.addChild(wallMask);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (isWall(x, y)) wallMask.rect(x * TS, y * TS, TS, TS).fill(0xffffff);
  loadImage(new URL(`../../assets/walls/wall-${ship.faction}.jpg?v=1`, import.meta.url).href).then(img => {
    if (!app.renderer || world.destroyed) return;
    const bw = (maxX - minX + 1) * TS, bh = (maxY - minY + 1) * TS;
    const src = PIXI.Texture.from(img), k = Math.min(img.width / bw, img.height / bh), fw = bw * k, fh = bh * k;
    const sp = new PIXI.Sprite(new PIXI.Texture({ source: src.source, frame: new PIXI.Rectangle((img.width - fw) / 2, (img.height - fh) / 2, fw, fh) }));
    sp.x = minX * TS; sp.y = minY * TS; sp.width = bw; sp.height = bh;
    sp.mask = wallMask; sp.tint = 0xc8c8c8;
    world.addChildAt(sp, world.getChildIndex(wallMask));
  }).catch(() => { wallMask.destroy(); });
  // Raised-block edges: a lit rim on the wall, a soft shadow cast onto the floor beside it.
  const gEdge = new PIXI.Graphics(); world.addChild(gEdge);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (!isWall(x, y)) continue;
    const X = x * TS, Y = y * TS;
    if (isFloor(x, y + 1)) { gEdge.rect(X, Y + TS, TS, 5).fill({ color: 0x000000, alpha: 0.45 }); gEdge.rect(X, Y + TS - 3, TS, 3).fill({ color: 0x000000, alpha: 0.5 }); }
    if (isFloor(x + 1, y)) gEdge.rect(X + TS, Y, 4, TS).fill({ color: 0x000000, alpha: 0.35 });
    if (isFloor(x, y - 1)) gEdge.rect(X, Y, TS, 2).fill({ color: 0xffffff, alpha: 0.28 });
    if (isFloor(x - 1, y)) gEdge.rect(X, Y, 2, TS).fill({ color: 0xffffff, alpha: 0.18 });
    // crisp outline where wall meets floor, so dark walls never melt into dark floors
    if (isFloor(x, y + 1)) gEdge.rect(X, Y + TS - 1, TS, 1.5).fill({ color: 0x000000, alpha: 0.85 });
    if (isFloor(x, y - 1)) gEdge.rect(X, Y - 0.5, TS, 1.5).fill({ color: 0x000000, alpha: 0.85 });
    if (isFloor(x + 1, y)) gEdge.rect(X + TS - 1, Y, 1.5, TS).fill({ color: 0x000000, alpha: 0.85 });
    if (isFloor(x - 1, y)) gEdge.rect(X - 0.5, Y, 1.5, TS).fill({ color: 0x000000, alpha: 0.85 });
  }
  const g1 = new PIXI.Graphics(); world.addChild(g1);
  // bridge tint + floor grid
  for (const r of map.rooms) if (r.type === 'bridge') g1.rect(r.x * TS, r.y * TS, r.w * TS, r.h * TS).fill({ color: 0x4ade80, alpha: 0.08 });
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (map.tiles[y * map.w + x] === 1) g1.rect(x * TS, y * TS, TS, TS).stroke({ width: 1, color: 0x0b1118, alpha: .35 });
  // cover
  for (let i = 0; i < map.cover.length; i++) if (map.cover[i]) {
    const x = i % map.w, y = (i - x) / map.w, s = map.cover[i] === 2 ? 14 : 9;
    g1.rect(x * TS + (TS - s) / 2, y * TS + (TS - s) / 2, s, s).fill(map.cover[i] === 2 ? 0x5a6b78 : 0x3e4c57);
  }
  // features
  for (const f of map.features) {
    const cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2;
    if (f.kind === 'console') g1.circle(cx, cy, 8).fill(0xffd34d);
    else if (f.kind === 'terminal') g1.rect(cx - 5, cy - 5, 10, 10).fill(0x3dd6ff);
    else if (f.kind === 'pods') g1.roundRect(cx - 8, cy - 6, 16, 12, 5).fill(0x4f7dff);
    else if (f.kind === 'loot') g1.rect(cx - 6, cy - 6, 12, 12).fill(0xc9a227);
    else if (f.kind === 'vent') g1.rect(cx - 7, cy - 3, 14, 6).stroke({ width: 2, color: 0x6c7f8f });
  }
  for (const r of map.rooms) {
    const t = new PIXI.Text({ text: r.name.toUpperCase(), style: { fontFamily: 'Rajdhani', fontSize: 13, fill: 0x5b738a, fontWeight: '700', letterSpacing: 1 } });
    t.x = r.x * TS + 3; t.y = r.y * TS + 2; world.addChild(t);
  }
  const gDyn = new PIXI.Graphics(); world.addChild(gDyn);
  const unitLayer = new PIXI.Container(); world.addChild(unitLayer);
  const gTop = new PIXI.Graphics(); world.addChild(gTop);
  const gFog = new PIXI.Graphics(); world.addChild(gFog);
  const gFx = new PIXI.Graphics(); world.addChild(gFx);
  const bubbles = new PIXI.Container(); world.addChild(bubbles);

  // ---- Playback state ----
  const U = new Map();   // id -> unit view
  const info = Object.fromEntries(battle.units.map(u => [u.id, u]));
  const doors = map.doors.map(d => ({ ...d, open: false, wasLocked: d.locked }));
  const hazards = [];    // {room, kind, until}
  for (const r of map.rooms) if (r.hazard) hazards.push({ room: r.id, kind: r.hazard, until: 1e9 });
  const fx = [];
  let alarm = 0, hold = 0, holdNeed = OBJECTIVES.take_bridge.ticks, tick = 0, ei = 0, speed = 1, done = false;
  const colorsByUnit = {}, sexByUnit = {};
  const squadIn = report.input?.squad || [];
  const portraitByUnit = {}, lookByUnit = {};
  battle.soldiers.forEach((s, i) => { colorsByUnit[s.unit] = colors[s.uid] || ['#3a5a8c', '#f2c14e']; sexByUnit[s.unit] = squadIn[i]?.sex || 'm'; portraitByUnit[s.unit] = squadIn[i]?.portrait; lookByUnit[s.unit] = squadIn[i]?.look || 0; });
  const eggs = map.features.filter(f => f.kind === 'eggs').map(f => ({ x: f.x, y: f.y, hatched: false }));
  const confusedUntil = {};
  let gravity = 'normal';
  const barks = computeBarks(battle, report.input, colors);
  let bi = 0;

  // Token textures: [normal, grey] per unit, built asynchronously; shapes are drawn until ready.
  const TOK = TS * 1.4;
  const texFor = new Map();
  function tokenOf(u) {
    const old = texFor.get(u.id);
    if (old && old.side === u.side) return old;
    if (old?.sprite) old.sprite.destroy();               // e.g. a turret hacked over to our side
    const entry = { ready: false, side: u.side }; texFor.set(u.id, entry);
    const def = UNIT_BY_ID[u.kind];
    let mk;
    if (info[u.id].shellOf !== undefined) {
      // A possessed Soldier: their own portrait in a sickly green ring.
      const host = info[u.id].shellOf;
      const s = { specialty: u.kind, sex: sexByUnit[host], look: lookByUnit[host], portrait: portraitByUnit[host], colors: [colorsByUnit[host]?.[0] || '#3a5a8c', '#5dff6a'] };
      mk = (grey) => soldierToken(s, { grey });
    } else if (info[u.id].side === 'S' && u.kind !== 'sys_drone') {
      const s = { specialty: u.kind, sex: sexByUnit[u.id], look: lookByUnit[u.id], portrait: portraitByUnit[u.id], colors: colorsByUnit[u.id] };
      mk = (grey) => soldierToken(s, { grey });
    } else {
      const ring = u.side === 'S' ? '#3dd6ff' : (FACTION_RING[def?.faction] || '#9aa4ad');
      mk = (grey) => unitToken(u.kind, def?.tags.includes('civilian') ? '#9aa4ad' : ring, { grey, leader: def?.tags.includes('leader') });
    }
    Promise.all([mk(false), mk(true)]).then(([a, b]) => {
      entry.tex = PIXI.Texture.from(a); entry.grey = PIXI.Texture.from(b);
      entry.sprite = new PIXI.Sprite(entry.tex); entry.sprite.anchor.set(0.5); entry.sprite.width = entry.sprite.height = TOK;
      if (texFor.get(u.id) !== entry) return;   // replaced while loading
      unitLayer.addChild(entry.sprite); entry.ready = true;
    }).catch(() => { entry.failed = true; });
    return entry;
  }

  const name = (id) => { const u = info[id]; if (!u) return '?'; return u.side === 'S' && u.kind !== 'sys_drone' ? u.name.split(' ')[0] : u.name; };
  const say = (t, html, cls = '') => { const d = el(`<div class="${cls}"><span class="t">${fmt(t)}</span>${html}</div>`); feed.prepend(d); };
  const fmt = (t) => { const s = Math.floor(t / TICKS_PER_SEC); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const center = (u) => [u.px * TS + TS / 2, u.py * TS + TS / 2];
  const ent = (id) => info[id]?.kind;

  if (battle.entry === 'breach_pod') { /* decompression shows via hazard events */ }

  function apply(e) {
    const [t, k] = e;
    switch (k) {
      case 'spawn': { if (info[e[2]]?.shellOf !== undefined) { const host = U.get(info[e[2]].shellOf); if (host) host.state = 'possessed'; } const [, , id, side, kind, x, y] = e; U.set(id, { id, side, kind, x, y, px: x, py: y, hp: info[id].maxHp, max: info[id].maxHp, state: 'active', hidden: false }); if (t > 0 && side === 'E') {} if (info[e[2]]?.shellOf !== undefined) { const v = U.get(e[2]); v.hp = Math.max(1, Math.floor(v.max / 2)); } break; }
      case 'move': { const u = U.get(e[2]); if (u) { u.x = e[3]; u.y = e[4]; } break; }
      case 'door': { const d = doors[e[2]]; d.open = true; if (e[3] === 'breach') { fx.push({ k: 'boom', x: d.x, y: d.y, t, life: 10 }); say(t, `💥 <b>${name(e[4])}</b> blows the door`); }
        else if (e[3] === 'chain') say(t, `💥 Chain breach!`); else if (e[3] === 'hack') say(t, `<b>${name(e[4])}</b> hacks a locked door`); else if (e[3] === 'force') say(t, `<b>${name(e[4])}</b> forces a locked door`); break; }
      case 'shot': { const s = U.get(e[2]), tg = U.get(e[3]); if (s && tg) { fx.push({ k: 'shot', a: s, b: tg, hit: e[4] > 0, crit: e[5], t, life: 3 }); tg.hp -= e[4]; } break; }
      case 'splash': case 'blast': { const tg = U.get(e[3]); if (tg) tg.hp -= e[4]; break; }
      case 'hazard': { const u = U.get(e[2]); if (u) u.hp -= e[4]; break; }
      case 'heal': { const v = U.get(e[3]); if (v) v.hp = Math.min(v.max, v.hp + e[4]); say(t, `➕ <b>${name(e[2])}</b> patches up ${name(e[3])}`); break; }
      case 'revive': { const v = U.get(e[3]); if (e[4]) { v.state = 'active'; v.hp = Math.max(1, Math.floor(v.max * 30 / 100)); say(t, `💉 <b>${name(e[2])}</b> gets ${name(e[3])} back on their feet`, 'good'); } else say(t, `<b>${name(e[2])}</b> can't revive ${name(e[3])}`, 'dim'); break; }
      case 'down': { const u = U.get(e[2]); u.state = 'down'; u.hp = 0; say(t, `<b>${name(e[2])}</b> is DOWN`, 'bad'); break; }
      case 'dead': { const u = U.get(e[2]); if (u) { u.state = 'dead'; if (u.side === 'S') say(t, `${name(e[2])} destroyed`, 'dim'); } break; }
      case 'captured': { U.get(e[2]).state = 'captured'; say(t, `<b>${name(e[2])}</b> is down and captured`, 'good'); break; }
      case 'surrender': U.get(e[2]).state = 'gone'; break;
      case 'fled': U.get(e[2]).state = 'gone'; break;
      case 'extract': { const u = U.get(e[2]); u.state = 'out'; say(t, `🚀 <b>${name(e[2])}</b> ${e[3] ? 'drifts off in a pod: MISSING' : 'is out'}`, e[3] ? 'warn' : ''); break; }
      case 'reveal': { const u = U.get(e[2]); if (u) u.hidden = false; break; }
      case 'ability': {
        const u = U.get(e[2]);
        if (e[3] === 'cloak') { u.hidden = true; say(t, `<b>${name(e[2])}</b> cloaks`); }
        else if (e[3] === 'charge') say(t, `<b>${name(e[2])}</b> charges!`);
        else if (e[3] === 'suppressing_fire') say(t, `<b>${name(e[2])}</b> lays down suppressing fire`);
        else if (e[3] === 'overwatch') say(t, `<b>${name(e[2])}</b> sets up Overwatch`, 'dim');
        else if (e[3] === 'system_crash') say(t, `<b>${name(e[2])}</b> crashes ship systems: no more reinforcements`, 'good');
        else if (e[3] === 'tracker_fire') say(t, `📡 Tracker ping: <b>${name(e[2])}</b> was ready for it`, 'dim');
        break;
      }
      case 'grenade': { fx.push({ k: 'boom', x: e[3], y: e[4], t, life: 10, big: true }); say(t, `<b>${name(e[2])}</b> throws a grenade`); break; }
      case 'smoke': fx.push({ k: 'smoke', x: e[2], y: e[3], t, life: e[4] }); break;
      case 'fire': { hazards.push({ room: e[2], kind: 'fire', until: t + e[3] }); say(t, `🔥 Fire in the ${map.rooms[e[2]].name}`, 'warn'); break; }
      case 'hazard_off': { for (const h of hazards) if (h.room === e[2]) h.until = t; say(t, `<b>${name(e[3])}</b> shuts down the hazard`, 'good'); break; }
      case 'alarm': { alarm = e[2]; say(t, alarm === 2 ? '🚨 FULL ALARM: the whole crew is hunting you' : '⚠ The ship is on alert', alarm === 2 ? 'bad' : 'warn'); break; }
      case 'reinforce': say(t, `Reinforcements arrive in the ${map.rooms[e[3]].name}`, 'warn'); break;
      case 'objective': if (e[2] !== 'take_bridge') say(t, `Optional: <b>${OBJECTIVES[e[2]].name}</b>`, 'dim'); break;
      case 'objdone': say(t, e[2] === 'take_bridge' ? '<b>BRIDGE TAKEN</b>' : `✔ ${OBJECTIVES[e[2]].name}`, 'good'); break;
      case 'hold': hold = e[2]; holdNeed = e[3]; break;
      case 'retreat': say(t, `<b>RETREAT</b> (${e[2] === 'time' ? 'out of time' : 'too many casualties'}): ${RETREAT_BY_ID[e[3]].name}`, 'warn'); break;
      case 'misfire': say(t, e[3] === 'lost' ? `Teleport lock lost on <b>${name(e[2])}</b>!` : `Teleport misfire: ${name(e[2])} is delayed`, 'bad'); break;
      case 'rearguard': say(t, `<b>${name(e[2])}</b> stays behind as rear guard`, 'warn'); break;
      case 'dock': say(t, `Shuttle inbound to the ${map.rooms[e[2]].name}`); break;
      case 'scramble': say(t, `Teleport scatter: <b>${name(e[2])}</b> lands in the ${map.rooms[e[3]].name}`, 'warn'); break;
      case 'turret': { const u = U.get(e[2]); if (e[3] === 'turned') { u.side = 'S'; say(t, 'Turret hacked: it fights for us now', 'good'); } else { u.state = 'off'; say(t, 'Turret disabled', 'good'); } break; }
      case 'sabotage': say(t, e[3] === 'reactor' ? `☢ <b>${name(e[2])}</b> sabotages the reactor: turrets down, doors unlocked` : `<b>${name(e[2])}</b> sabotages a turret`, 'good'); break;
      case 'spotted': if (U.get(e[3])?.side === 'S') say(t, `Spotted!`, 'warn'); break;
      case 'panic': if (U.get(e[2])?.side === 'S') say(t, `<b>${name(e[2])}</b> panics`, 'warn'); break;
      case 'loot': say(t, `Found ${e[3]} loot crate${e[3] > 1 ? 's' : ''}`, 'dim'); break;
      case 'hatch': { for (const g of eggs) if (g.x === e[2] && g.y === e[3]) g.hatched = true; fx.push({ k: 'boom', x: e[2], y: e[3], t, life: 8, color: 0x9b5cff }); say(t, 'An egg pod bursts open!', 'warn'); break; }
      case 'acid': { const v = U.get(e[3]); if (v) { v.hp -= e[4]; fx.push({ k: 'boom', x: v.x, y: v.y, t, life: 6, color: 0x7dff3a }); } say(t, `Acid blood splashes <b>${name(e[3])}</b>`, 'warn'); break; }
      case 'confused': confusedUntil[e[2]] = t + 30; say(t, `<b>${name(e[2])}</b> breathes the spores and is Confused`, 'warn'); break;
      case 'friendlyfire': say(t, `<b>${name(e[2])}</b> fires on ${name(e[3])}!`, 'bad'); break;
      case 'ricochet': { const s = U.get(e[2]), v = U.get(e[3]); if (s && v) { fx.push({ k: 'shot', a: s, b: v, hit: true, crit: 0, t, life: 3 }); v.hp -= e[4]; } say(t, `A shot ricochets into <b>${name(e[3])}</b>`, 'dim'); break; }
      case 'spores': { const s = U.get(e[2]); if (s) fx.push({ k: 'ring', x: s.x, y: s.y, r: e[3], t, life: 12, color: 0x9ee86a }); break; }
      case 'gravity': gravity = e[2]; say(t, { heavy: '⬇ Gravity spikes: everything is HEAVY', zero: '⤴ Gravity cuts out: ZERO-G, no cover', normal: 'Gravity returns to normal' }[e[2]], e[2] === 'normal' ? 'dim' : 'warn'); break;
      case 'possessed': { say(t, `<b>${name(e[2])}</b> rises... the parasite has them!`, 'bad'); break; }
      case 'freed': { const sh = U.get(e[2]); if (sh) sh.state = 'dead'; const s = U.get(e[3]); if (s) { s.state = 'down'; s.x = sh?.x ?? s.x; s.y = sh?.y ?? s.y; s.px = s.x; s.py = s.y; } say(t, `<b>${name(e[3])}</b> is freed from the parasite`, 'good'); break; }
      case 'log': { const egg = EGG_BY_ID[e[2]]; if (egg) say(t, `<i>${esc(egg.data.text)}</i>`, 'warn'); break; }
    }
  }

  // ---- Side HUD ----
  const squadEl = wrap.querySelector('#squad');
  function drawSquad() {
    squadEl.innerHTML = '<h3 style="margin-bottom:6px">Squad</h3>' + battle.soldiers.map(s => {
      const u = U.get(s.unit); if (!u) return '';
      const st = { active: '', down: '<span class="bad">DOWN</span>', out: '<span class="dim">out</span>' }[u.state] ?? '';
      const pct = Math.max(0, Math.round((u.hp * 100) / u.max));
      return `<div class="s"><span>${esc(info[s.unit].name)} <span class="dim small">${SPECIALTY_BY_ID[info[s.unit].kind]?.name || ''}</span> ${st}</span><div class="bar"><i style="width:${pct}%;background:${pct > 50 ? 'var(--good)' : pct > 25 ? 'var(--warn)' : 'var(--bad)'}"></i></div></div>`;
    }).join('');
  }

  // ---- Draw ----
  const palette = faction.look.palette.map(HEX);
  function draw() {
    gDyn.clear(); gFx.clear();
    for (const d of doors) gDyn.rect(d.x * TS + 2, d.y * TS + 2, TS - 4, TS - 4).fill(d.open ? 0x22313f : d.wasLocked ? 0xb33a3a : 0x5f88a8);
    for (const h of hazards) if (h.until > tick) { const r = map.rooms[h.room]; gDyn.rect(r.x * TS, r.y * TS, r.w * TS, r.h * TS).fill({ color: HAZARD_TINT[h.kind] || 0xffffff, alpha: .12 + .05 * Math.sin(tick / 3) }); }
    for (const g of eggs) if (!g.hatched) { const cx = g.x * TS + TS / 2, cy = g.y * TS + TS / 2; gDyn.ellipse(cx, cy, 6, 8).fill({ color: 0x3a1f4f }).stroke({ width: 2, color: 0x9b5cff, alpha: .6 + .3 * Math.sin(tick / 4) }); }
    // bridge hold bar
    if (hold) { const r = map.rooms[map.bridge]; gDyn.rect(r.x * TS, (r.y + r.h) * TS - 6, (r.w * TS * Math.min(hold, holdNeed)) / holdNeed, 6).fill(0x4ade80); }
    gTop.clear();
    for (const u of U.values()) {
      u.px += (u.x - u.px) * 0.35; u.py += (u.y - u.py) * 0.35;
      const tk = tokenOf(u);
      const gone = u.state === 'gone' || u.state === 'out' || u.state === 'possessed';
      if (tk.ready) tk.sprite.visible = !gone && u.state !== 'dead';
      if (gone) continue;
      const [cx, cy] = center(u);
      const kind = u.kind, def = UNIT_BY_ID[kind];
      if (u.state === 'dead') { gDyn.circle(cx, cy, 6).fill({ color: 0x3a1a1a, alpha: .8 }); continue; }
      const downed = u.state === 'down' || u.state === 'captured', off = u.state === 'off';
      if (tk.ready) {
        tk.sprite.position.set(cx, cy);
        tk.sprite.texture = downed || off ? tk.grey : tk.tex;
        tk.sprite.alpha = u.hidden ? 0.4 : downed ? 0.75 : 1;
        tk.sprite.width = tk.sprite.height = downed ? TOK * 0.85 : TOK;
      } else {
        // Placeholder shapes until the token art has loaded (or if it failed).
        const alpha = u.hidden ? 0.35 : 1;
        if (u.side === 'S' && kind !== 'sys_drone' && def?.ai !== 'turret') { const [a, b] = colorsByUnit[u.id] || ['#3a5a8c', '#f2c14e']; gDyn.circle(cx, cy, 9).fill({ color: HEX(a), alpha }).stroke({ width: 3, color: HEX(b), alpha }); }
        else gDyn.rect(cx - 8, cy - 8, 16, 16).fill({ color: palette[0], alpha }).stroke({ width: 2, color: palette[2], alpha });
      }
      if (confusedUntil[u.id] > tick && u.state === 'active') gTop.circle(cx + TOK / 2 - 3, cy - TOK / 2 + 3, 5).fill(0x9ee86a);
      if (downed) gTop.moveTo(cx - 7, cy - 7).lineTo(cx + 7, cy + 7).moveTo(cx + 7, cy - 7).lineTo(cx - 7, cy + 7).stroke({ width: 3.5, color: 0xff3b3b });
      else if (u.hp < u.max) { const w = 22, p = Math.max(0, u.hp) / u.max, y = cy - TOK / 2 - 5; gTop.rect(cx - w / 2, y, w, 4).fill(0x220000); gTop.rect(cx - w / 2, y, w * p, 4).fill(p > .5 ? 0x4ade80 : p > .25 ? 0xfacc15 : 0xef4444); }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], age = tick - f.t;
      if (age > f.life) { fx.splice(i, 1); continue; }
      if (f.k === 'shot') {
        const [ax, ay] = center(f.a), [bx, by] = center(f.b);
        gFx.moveTo(ax, ay).lineTo(bx + (f.hit ? 0 : 6), by + (f.hit ? 0 : -6)).stroke({ width: f.crit ? 3 : 1.5, color: f.crit ? 0xff5050 : f.hit ? 0xffe27a : 0x8a96a3, alpha: 1 - age / f.life });
        if (age < 1.5) gFx.circle(ax, ay, 5).fill({ color: 0xfff1a8, alpha: 0.9 });                                   // muzzle flash
        if (f.hit && age < 2) gFx.circle(bx, by, f.crit ? 7 : 4).fill({ color: f.crit ? 0xff5050 : 0xffc04d, alpha: 0.85 });   // impact
      } else if (f.k === 'boom') {
        gFx.circle(f.x * TS + TS / 2, f.y * TS + TS / 2, (f.big ? 36 : 20) * (0.4 + age / f.life)).fill({ color: f.color || 0xff9a2e, alpha: .6 * (1 - age / f.life) });
      } else if (f.k === 'ring') {
        gFx.circle(f.x * TS + TS / 2, f.y * TS + TS / 2, (f.r + 0.5) * TS * (0.3 + 0.7 * age / f.life)).stroke({ width: 3, color: f.color, alpha: 0.7 * (1 - age / f.life) });
      } else if (f.k === 'smoke') {
        gFx.rect((f.x - 1) * TS, (f.y - 1) * TS, TS * 3, TS * 3).fill({ color: 0xc8d0d8, alpha: .35 * Math.min(1, (f.life - age) / 10) });
      }
    }
  }

  // Darkness (Void ships): everything outside the squad's few tiles of light is black.
  const shipDef = SHIPS_ALL[battle.ship];
  function drawFog() {
    gFog.clear();
    if (!shipDef.dark) return;
    // Tile fog, matching the engine's sight rule in the dark (6 tiles, Chebyshev).
    const lights = [];
    for (const u of U.values()) if (info[u.id].side === 'S' && (u.state === 'active' || u.state === 'down')) lights.push([Math.round(u.px), Math.round(u.py)]);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (map.tiles[y * map.w + x] === T_VOID) continue;
      let d = 99; for (const [lx, ly] of lights) d = Math.min(d, Math.max(Math.abs(lx - x), Math.abs(ly - y)));
      if (d > 6) gFog.rect(x * TS, y * TS, TS, TS).fill({ color: 0x000000, alpha: 0.88 });
      else if (d > 4) gFog.rect(x * TS, y * TS, TS, TS).fill({ color: 0x000000, alpha: 0.45 });
    }
  }
  // Speech bubbles for voice lines.
  function showBark(b) {
    const u = U.get(b.unit); if (!u) return;
    say(b.t, `<b>${name(b.unit)}:</b> <i>"${esc(b.text)}"</i>`);
    const txt = new PIXI.Text({ text: b.text, style: { fontFamily: 'Inter', fontSize: 13, fill: 0x111111, wordWrap: true, wordWrapWidth: 220, fontWeight: '600' } });
    const box = new PIXI.Graphics().roundRect(-8, -6, txt.width + 16, txt.height + 12, 8).fill({ color: 0xffffff, alpha: 0.95 });
    const c = new PIXI.Container(); c.addChild(box, txt);
    const [cx, cy] = center(u); c.x = cx - txt.width / 2; c.y = cy - TOK - txt.height - 8;
    bubbles.addChild(c); c.until = b.t + 30;
  }

  // ---- Loop ----
  const events = battle.events;
  const endTick = battle.ticks;
  const clock = wrap.querySelector('#clock'), alarmEl = wrap.querySelector('#alarm'), holdEl = wrap.querySelector('#hold'), gravEl = wrap.querySelector('#grav');
  if (report.secret) say(0, `⚠ Contact mismatch: this isn't the ${esc(SHIPS_ALL[report.plannedShip]?.name || 'ship you picked')}. It's the <b>${esc(ship.name)}</b>.`, 'bad');
  // Sound: weapon type per unit (squad from their gear, enemies from their unit definition).
  const wtype = {};
  battle.soldiers.forEach((s, i) => { wtype[s.unit] = ITEM_BY_ID[squadIn[i]?.gear?.weapon?.base]?.type || 'pistol'; });
  for (const u of battle.units) if (wtype[u.id] === undefined) wtype[u.id] = ITEM_BY_ID[UNIT_BY_ID[u.kind]?.weapon]?.type || null;
  function sound(e) {
    const [, k] = e;
    switch (k) {
      case 'shot': if (wtype[e[2]]) sfx.shot(wtype[e[2]], { hit: e[4] > 0, crit: e[5], enemy: info[e[2]]?.side === 'E' }); break;
      case 'ricochet': sfx.shot('pistol', { enemy: true }); break;
      case 'door': if (e[3] === 'breach') sfx.boom(); break;
      case 'grenade': sfx.boom(true); break;
      case 'alarm': sfx.alarm(e[2]); break;
      case 'down': if (info[e[2]]?.side === 'S') sfx.down(); else sfx.enemyDown(); break;
      case 'dead': if (info[e[2]]?.side === 'E') sfx.enemyDown(); break;
      case 'heal': sfx.heal(); break;
      case 'revive': if (e[4]) sfx.revive(); break;
      case 'extract': sfx.teleport(); break;
      case 'objdone': sfx.objective(e[2] === 'take_bridge'); break;
      case 'retreat': sfx.retreat(); break;
      case 'hatch': sfx.hatch(); break;
      case 'acid': sfx.sizzle(); break;
      case 'fire': sfx.fire(); break;
      case 'smoke': sfx.sizzle(); break;
      case 'gravity': sfx.gravity(e[2]); break;
      case 'spores': sfx.spores(); break;
      case 'turret': case 'sabotage': case 'hazard_off': sfx.blip(true); break;
      case 'misfire': case 'scramble': sfx.blip(false); break;
      case 'ability': if (e[3] === 'cloak') sfx.teleport(); break;
    }
  }
  const stopHum = sfx.hum();
  let lastSquad = 0;
  function step(dt) {
    if (!done) {
      tick = Math.min(endTick, tick + (dt / 1000) * TICKS_PER_SEC * speed);
      while (ei < events.length && events[ei][0] <= tick) { const e = events[ei++]; apply(e); if (tick - e[0] < 4) sound(e); }   // no sound for events skipped past
      while (bi < barks.length && barks[bi].t <= tick) showBark(barks[bi++]);
      for (const c of [...bubbles.children]) if (c.until <= tick) c.destroy();
      if (tick >= endTick && ei >= events.length) { done = true; setTimeout(() => finish(), 900); }
    }
    draw(); drawFog();
    clock.textContent = fmt(tick);
    gravEl.textContent = shipDef.gravity ? ` · Gravity ${gravity.toUpperCase()}` : '';
    alarmEl.textContent = ['CALM', 'ALERT', 'FULL'][alarm]; alarmEl.className = 'alarm' + alarm;
    holdEl.textContent = hold && !done ? ` · Holding bridge ${Math.min(100, Math.floor(hold * 100 / holdNeed))}%` : '';
    if (performance.now() - lastSquad > 200) { drawSquad(); lastSquad = performance.now(); }
  }
  // Drive playback from the wall clock (Pixi caps per-frame time, which slows playback on low frame rates).
  let lastNow = performance.now();
  app.ticker.add(() => { const now = performance.now(); step(Math.min(1000, now - lastNow)); lastNow = now; });
  for (const b of wrap.querySelectorAll('[data-sp]')) b.onclick = () => { speed = +b.dataset.sp; for (const x of wrap.querySelectorAll('[data-sp]')) x.classList.toggle('primary', x === b); };
  wrap.querySelector('[data-sp="1"]').classList.add('primary');
  wrap.querySelector('#skip').onclick = () => { tick = endTick; };

  let finished = false;
  function finish() { if (finished) return; finished = true; stopHum(); drawSquad(); showReport(panel, battle, report, isReplay); }
  current = { destroy() { app.destroy(true, { children: true }); current = null; } };
  const stop = () => { G.holdBucs(0); if (current) current.destroy(); window.removeEventListener('hashchange', stop); };
  window.addEventListener('hashchange', stop);
}

// ---------- Report ----------
function showReport(panel, battle, report, isReplay) {
  G.holdBucs(0);
  sfx.stopHum();
  if (report.gameOver) sfx.gameOver(); else if (battle.result === 'success') sfx.victory(); else sfx.defeat();
  if (report.soldiers?.some(s => s.levelUps?.length)) setTimeout(() => sfx.levelUp(), 1300);
  const title = { success: 'SHIP TAKEN', retreat: 'RETREAT', wipe: 'SQUAD LOST' }[battle.result];
  const fateTxt = (s) => {
    if (s.fate === 'kia') return `<span class="bad"><b>KILLED IN ACTION</b></span>${s.state === 'left' ? ' (left aboard, gear lost)' : ''}${s.kiaChance ? ` <span class="dim small">${s.kiaChance}% chance</span>` : ''}`;
    if (s.fate === 'mia') return '<span class="warn"><b>MISSING</b></span> <span class="small dim">back in 30 min</span>';
    const state = { fine: 'Made it out', revived: 'Went down, revived in the field', downed: 'Carried out Downed', left: 'Left aboard, escaped', mia: 'Missing' }[s.state];
    return `${state}${s.state === 'downed' && s.kiaChance ? ` <span class="dim small">(survived a ${s.kiaChance}% death roll)</span>` : ''}`;
  };
  const box = el(`<div class="box">
    <h2 class="result-${battle.result}" style="font-size:34px">${title}</h2>
    <div class="dim">${esc(report.shipName)} · ${(battle.ticks / TICKS_PER_SEC).toFixed(0)} s · ${battle.enemies.killed} enemies killed${battle.objectives.filter(o => o.done && o.id !== 'take_bridge').map(o => ' · ✔ ' + OBJECTIVES[o.id].name).join('')}</div>
    <div style="font:700 26px Rajdhani;margin:10px 0">+${report.bucs} BUCs</div>
    ${report.gameOver ? '<div class="banner bad"><b>No Soldiers left.</b> This was your commander&rsquo;s last mission.</div>' : ''}
    ${report.contract ? `<div class="banner info">Contract score: <b>${report.contract.score}</b>. Check the Ladder to see where it ranks.</div>` : ''}
    <table class="rep"><tr><th>Soldier</th><th>Outcome</th><th>Injuries</th><th>XP</th></tr>
      ${report.soldiers.map(s => `<tr><td><b>${esc(s.name)}</b><div class="small dim">${SPECIALTY_BY_ID[s.specialty].name} · ${s.kills} kills</div></td>
        <td>${fateTxt(s)}</td>
        <td>${s.injuries.length && s.fate !== 'kia' ? s.injuries.map(i => `${INJURY_BY_ID[i].name}${INJURY_BY_ID[i].severity === 2 ? ' <span class="small warn">(benched)</span>' : ''}`).join('<br>') : '<span class="dim">—</span>'}</td>
        <td>+${s.xp}${s.levelUps.map(l => `<div class="small good">Level ${l.level}! ${Object.entries(l.gains).map(([k, v]) => `+${v} ${STAT_INFO[k].short}`).join(', ')}${l.breakthrough ? ' <b>BREAKTHROUGH</b>' : ''}</div>`).join('')}
          ${(s.perkPending || []).length && !isReplay ? `<div><button class="primary small" data-perk="${s.uid}" style="padding:3px 8px;margin-top:4px">Choose perk</button></div>` : ''}
          ${(s.medals || []).map(id => `<div class="small" style="margin-top:3px">${ribbon(id)} <b>${COMMENDATION_BY_ID[id].name}</b>${s.fate === 'kia' ? ' (posthumous)' : ''}</div>`).join('')}</td></tr>`).join('')}
    </table>
    ${report.firstContact ? `<div class="banner" style="margin-top:10px">Secret ship discovered: <b>${esc(report.shipName)}</b></div>` : ''}
    ${report.extras.map(x => x.kind === 'item' ? `<div class="good" style="margin-top:8px">${x.xeno ? '☣ Xeno find' : 'Armory raid'}: ${itemLabel(x.item)}</div>`
      : x.kind === 'egg' ? `<div class="good" style="margin-top:8px"><i>${esc(x.text)}</i> Added to the Armory: ${itemLabel(x.item)}</div>`
      : `<div class="good" style="margin-top:8px">The freed prisoner, ${esc(x.name)}, joined the team.</div>`).join('')}
    ${(report.achievements || []).map(id => `<div class="banner info" style="margin-top:8px">★ Achievement: <b>${esc(EGG_BY_ID[id].data.name)}</b> <span class="small">${esc(EGG_BY_ID[id].data.how)}</span></div>`).join('')}
    ${isReplay ? '<div class="dim small" style="margin-top:8px">Replay: nothing was changed.</div>' : ''}
    <div class="row" style="margin-top:14px;justify-content:flex-end"><button id="again">Deploy again</button><button class="primary" id="home">Back to Barracks</button></div>
  </div>`);
  const m = document.getElementById('modal'); m.innerHTML = ''; m.append(box); m.hidden = false; m.onclick = null;
  const close = (to) => { m.hidden = true; m.innerHTML = ''; if (current) current.destroy(); exitTo(to); };
  box.querySelector('#home').onclick = () => close('barracks');
  box.querySelector('#again').onclick = () => close('deploy');
  for (const b of box.querySelectorAll('[data-perk]')) b.onclick = () => { m.hidden = true; m.innerHTML = ''; if (current) current.destroy(); openSoldierFn?.(b.dataset.perk); };
}
