// A static, pannable/zoomable view of a ship map (no playback). Used by the Mothership tab.
// Draws the same way mission playback does (one whole floor image + one whole wall image per
// faction, never tiled), plus slot outlines for unbuilt Mothership rooms and tap-to-select.
// NOTE: mission.js still has its own copy of the static drawing; folding it into this module is a
// later cleanup (kept apart for now so mission playback can't regress).
import { T_VOID, T_WALL } from '../engine/mapgen.js';
import { loadImage, floorSrc, soldierToken } from './tokens.js';

let PIXI = null;
const TS = 24;

// opts: { faction, onTap(slot|null), soldiers: [{ s, room }] }  -> { destroy(), select(key) }
export async function createShipView(stageEl, map, opts = {}) {
  PIXI = PIXI || await import('pixi.js');
  const app = new PIXI.Application();
  await app.init({ background: 0x05080b, resizeTo: stageEl, antialias: true });
  stageEl.prepend(app.canvas);
  const world = new PIXI.Container(); app.stage.addChild(world);

  let minX = map.w, minY = map.h, maxX = 0, maxY = 0;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.tiles[y * map.w + x] !== T_VOID) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }

  // ---- Camera ----
  let fitScale = 1, userMoved = false;
  function fit() {
    const w = app.screen.width, h = app.screen.height;
    const sc = Math.min(w / ((maxX - minX + 1) * TS), h / ((maxY - minY + 1) * TS)) * 0.96;
    fitScale = sc; userMoved = false; world.scale.set(sc);
    world.x = (w - (maxX - minX + 1) * TS * sc) / 2 - minX * TS * sc;
    world.y = (h - (maxY - minY + 1) * TS * sc) / 2 - minY * TS * sc;
  }
  function clampView() {
    const s = world.scale.x, w = app.screen.width, h = app.screen.height, m = 80;
    const l = world.x + minX * TS * s, r = world.x + (maxX + 1) * TS * s, t = world.y + minY * TS * s, b = world.y + (maxY + 1) * TS * s;
    if (r < m) world.x += m - r; if (l > w - m) world.x -= l - (w - m);
    if (b < m) world.y += m - b; if (t > h - m) world.y -= t - (h - m);
  }
  function zoomAt(px, py, factor) {
    const s0 = world.scale.x, s1 = Math.min(fitScale * 5, Math.max(fitScale * 0.75, s0 * factor)), k = s1 / s0;
    world.x = px - (px - world.x) * k; world.y = py - (py - world.y) * k; world.scale.set(s1); userMoved = true; clampView();
  }
  fit(); app.renderer.on('resize', () => { if (userMoved) clampView(); else fit(); });

  // ---- Input: drag pans, pinch/wheel zooms, a short tap selects a slot ----
  const cv = app.canvas, ptrs = new Map();
  let pinch = null, down = null;
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(x, y, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015))); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); const p = local(e); ptrs.set(e.pointerId, p); cv.classList.add('dragging');
    down = ptrs.size === 1 ? { p, moved: 0 } : null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; }
  });
  cv.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId); if (!prev) return;
    const p = local(e); ptrs.set(e.pointerId, p);
    if (down) down.moved += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    if (ptrs.size === 1) { world.x += p[0] - prev[0]; world.y += p[1] - prev[1]; userMoved = true; clampView(); }
    else if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      world.x += (p[0] - prev[0]) / 2; world.y += (p[1] - prev[1]) / 2;
      if (pinch.d > 0) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch.d);
      pinch.d = d;
    }
  });
  const up = (e) => {
    const wasTap = down && down.moved < 8 && ptrs.size === 1;
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) cv.classList.remove('dragging');
    if (wasTap && e.type === 'pointerup') {
      const [px, py] = local(e);
      const tx = Math.floor((px - world.x) / (TS * world.scale.x)), ty = Math.floor((py - world.y) / (TS * world.scale.y));
      const slot = (map.slots || []).find(s => tx >= s.x - 1 && tx <= s.x + s.w && ty >= s.y - 1 && ty <= s.y + s.h && (s.room || s.tap)) || null;
      opts.onTap?.(slot);
    }
    down = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const zc = document.createElement('div'); zc.className = 'zoomctl';
  zc.innerHTML = '<button data-z="in" title="Zoom in">+</button><button data-z="fit" title="Fit the whole ship">Fit</button><button data-z="out" title="Zoom out">−</button>';
  zc.onclick = (e) => { const z = e.target.closest('[data-z]')?.dataset.z; const m = [app.screen.width / 2, app.screen.height / 2];
    if (z === 'in') zoomAt(...m, 1.4); else if (z === 'out') zoomAt(...m, 1 / 1.4); else if (z === 'fit') fit(); };
  stageEl.append(zc);

  // ---- Static layer (same look as mission playback) ----
  const isWall = (x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h && map.tiles[y * map.w + x] === T_WALL;
  const isFloor = (x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h && map.tiles[y * map.w + x] !== T_WALL && map.tiles[y * map.w + x] !== T_VOID;
  const g0 = new PIXI.Graphics(); world.addChild(g0);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const v = map.tiles[y * map.w + x]; if (v === T_VOID) continue;
    g0.rect(x * TS, y * TS, TS, TS).fill(v === T_WALL ? 0x34485c : 0x17212b);
  }
  const bw = (maxX - minX + 1) * TS, bh = (maxY - minY + 1) * TS;
  const wholeImage = (src, mask, tint, alpha) => loadImage(src).then(img => {
    if (!app.renderer || world.destroyed) return;
    const t = PIXI.Texture.from(img), k = Math.min(img.width / bw, img.height / bh), fw = bw * k, fh = bh * k;
    const sp = new PIXI.Sprite(new PIXI.Texture({ source: t.source, frame: new PIXI.Rectangle((img.width - fw) / 2, (img.height - fh) / 2, fw, fh) }));
    sp.x = minX * TS; sp.y = minY * TS; sp.width = bw; sp.height = bh; sp.mask = mask; sp.tint = tint; sp.alpha = alpha;
    world.addChildAt(sp, world.getChildIndex(mask));
  }).catch(() => mask.destroy());
  const floorMask = new PIXI.Graphics(); world.addChild(floorMask);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (isFloor(x, y)) floorMask.rect(x * TS, y * TS, TS, TS).fill(0xffffff);
  wholeImage(floorSrc(opts.faction || 'military'), floorMask, 0x8c8c8c, 0.6);
  const wallMask = new PIXI.Graphics(); world.addChild(wallMask);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (isWall(x, y)) wallMask.rect(x * TS, y * TS, TS, TS).fill(0xffffff);
  wholeImage(new URL(`../../assets/walls/wall-${opts.faction || 'military'}.jpg?v=1`, import.meta.url).href, wallMask, 0xc8c8c8, 1);
  const gEdge = new PIXI.Graphics(); world.addChild(gEdge);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (!isWall(x, y)) continue;
    const X = x * TS, Y = y * TS;
    if (isFloor(x, y + 1)) { gEdge.rect(X, Y + TS, TS, 5).fill({ color: 0x000000, alpha: 0.45 }); gEdge.rect(X, Y + TS - 1, TS, 1.5).fill({ color: 0x000000, alpha: 0.85 }); }
    if (isFloor(x + 1, y)) { gEdge.rect(X + TS, Y, 4, TS).fill({ color: 0x000000, alpha: 0.35 }); gEdge.rect(X + TS - 1, Y, 1.5, TS).fill({ color: 0x000000, alpha: 0.85 }); }
    if (isFloor(x, y - 1)) { gEdge.rect(X, Y, TS, 2).fill({ color: 0xffffff, alpha: 0.28 }); gEdge.rect(X, Y - 0.5, TS, 1.5).fill({ color: 0x000000, alpha: 0.85 }); }
    if (isFloor(x - 1, y)) { gEdge.rect(X, Y, 2, TS).fill({ color: 0xffffff, alpha: 0.18 }); gEdge.rect(X - 0.5, Y, 1.5, TS).fill({ color: 0x000000, alpha: 0.85 }); }
  }
  const g1 = new PIXI.Graphics(); world.addChild(g1);
  for (const r of map.rooms) if (r.type === 'bridge') g1.rect(r.x * TS, r.y * TS, r.w * TS, r.h * TS).fill({ color: 0x4ade80, alpha: 0.08 });
  for (let i = 0; i < map.cover.length; i++) if (map.cover[i]) {
    const x = i % map.w, y = (i - x) / map.w, s = map.cover[i] === 2 ? 14 : 9;
    g1.rect(x * TS + (TS - s) / 2, y * TS + (TS - s) / 2, s, s).fill(map.cover[i] === 2 ? 0x5a6b78 : 0x3e4c57);
  }
  for (const f of map.features) {
    const cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2;
    if (f.kind === 'console') g1.circle(cx, cy, 8).fill(0xffd34d);
    else if (f.kind === 'terminal') g1.rect(cx - 5, cy - 5, 10, 10).fill(0x3dd6ff);
    else if (f.kind === 'pods') g1.roundRect(cx - 8, cy - 6, 16, 12, 5).fill(0x4f7dff);
    else if (f.kind === 'loot') g1.rect(cx - 6, cy - 6, 12, 12).fill(0xc9a227);
    else if (f.kind === 'vent') g1.rect(cx - 7, cy - 3, 14, 6).stroke({ width: 2, color: 0x6c7f8f });
    else if (f.kind === 'turret') { g1.circle(cx, cy, 7).fill(0x8a2a2a); g1.rect(cx - 1.5, cy - 11, 3, 8).fill(0xd04040); }
  }
  // Slot overlays: built rooms get name + level, sealed slots a dashed outline and a "+".
  const label = (text, x, y, color, size = 13) => { const t = new PIXI.Text({ text, style: { fontFamily: 'Rajdhani', fontSize: size, fill: color, fontWeight: '700', letterSpacing: 1 } }); t.x = x; t.y = y; world.addChild(t); return t; };
  const gSlot = new PIXI.Graphics(); world.addChild(gSlot);
  for (const s of map.slots || []) {
    if (s.level > 0) {
      label(s.name.toUpperCase() + (s.room && !s.fixed || s.room === 'hangar' ? `  L${s.level}` : ''), s.x * TS + 3, s.y * TS + 2, s.room ? 0x7fb8d8 : 0x5b738a);
    } else if (s.room) {
      const X = s.x * TS, Y = s.y * TS, W = s.w * TS, H = s.h * TS;
      gSlot.rect(X + 4, Y + 4, W - 8, H - 8).fill({ color: 0x05080b, alpha: 0.55 });
      for (let i = 0; i < W - 8; i += 14) { gSlot.rect(X + 4 + i, Y + 4, 7, 2).fill(0x5fd0ff); gSlot.rect(X + 4 + i, Y + H - 6, 7, 2).fill(0x5fd0ff); }
      for (let i = 0; i < H - 8; i += 14) { gSlot.rect(X + 4, Y + 4 + i, 2, 7).fill(0x5fd0ff); gSlot.rect(X + W - 6, Y + 4 + i, 2, 7).fill(0x5fd0ff); }
      const plus = label('+', X + W / 2 - 8, Y + H / 2 - 30, 0x5fd0ff, 34);
      const n = label(s.name.toUpperCase(), X + W / 2, Y + H / 2 + 8, 0x5fd0ff, 12); n.anchor.set(0.5, 0);
      plus.alpha = n.alpha = 0.85;
    }
  }
  // Idle Soldiers (flavour): tokens standing around in their room.
  const unitLayer = new PIXI.Container(); world.addChild(unitLayer);
  const placed = new Set();
  for (const { s, room } of opts.soldiers || []) {
    const r = map.rooms.find(x => x.key === room) || map.rooms.find(x => x.key === 'quarters');
    if (!r) continue;
    let h = 0; for (const ch of s.uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let spot = null;
    for (let k = 0; k < r.w * r.h && !spot; k++) {
      const i = (h + k * 7) % (r.w * r.h), x = r.x + (i % r.w), y = r.y + Math.floor(i / r.w), key = y * map.w + x;
      if (!map.cover[key] && !placed.has(key) && !map.features.some(f => f.x === x && f.y === y)) spot = [x, y, key];
    }
    if (!spot) continue;
    placed.add(spot[2]);
    soldierToken(s).then(c => {
      if (world.destroyed) return;
      const sp = new PIXI.Sprite(PIXI.Texture.from(c)); sp.anchor.set(0.5); sp.width = sp.height = TS * 1.3;
      sp.x = spot[0] * TS + TS / 2; sp.y = spot[1] * TS + TS / 2; unitLayer.addChild(sp);
    }).catch(() => {});
  }
  const gSel = new PIXI.Graphics(); world.addChild(gSel);
  function select(key) {
    gSel.clear();
    const s = (map.slots || []).find(x => x.key === key); if (!s) return;
    gSel.rect(s.x * TS - 2, s.y * TS - 2, s.w * TS + 4, s.h * TS + 4).stroke({ width: 3, color: 0xffd34d });
  }
  return { select, destroy: () => { try { app.destroy(true, { children: true }); } catch { /* already gone */ } } };
}
