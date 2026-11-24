// Mission playback (placeholder graphics). The engine already decided everything; this only
// replays its event log. Results stay hidden until playback ends (or the player skips).
import { el, esc, avatar, itemLabel, ribbon } from './ui.js';
import { COMMENDATION_BY_ID } from '../data/commendations.js';
import * as G from './state.js';
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

let PIXI = null;
let current = null;   // active playback (destroyed when leaving)
let exitTo = (r) => { location.hash = r; };
export const setExit = (fn) => { exitTo = fn; };
let openSoldierFn = null;
export const setOpenSoldier = (fn) => { openSoldierFn = fn; };

const HEX = (c) => parseInt(String(c).replace('#', ''), 16);
const HAZARD_TINT = { radiation: 0x5dff6a, decompression: 0x9fd8ff, fire: 0xff7a1a };

export async function replayMission(panel, h) {
  const battle = simulate(h.input);
  return playMission(panel, battle, h, h.colors || {}, true);
}

export async function playMission(panel, battle, report, colors, isReplay = false) {
  if (current) current.destroy();
  panel.innerHTML = '';
  if (!isReplay) G.holdBucs(report.bucs);
  const map = battle.map;
  const ship = SHIP_BY_ID[battle.ship];
  const faction = FACTION_BY_ID[ship.faction];
  const wrap = el(`<div class="mission">
    <div class="stage" id="stage"><div class="hudtop">
      <div><b>${esc(ship.name)}</b> · ${ENTRY_BY_ID[battle.entry].name} · ${TACTIC_BY_ID[battle.tactic].name} · <span id="clock">0:00</span> · Alarm <b id="alarm" class="alarm0">CALM</b><span id="hold"></span></div>
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
  function fit() {
    const w = app.screen.width, h = app.screen.height - 40;
    const sc = Math.min(w / ((maxX - minX + 1) * TS), h / ((maxY - minY + 1) * TS)) * 0.96;
    world.scale.set(sc);
    world.x = (w - (maxX - minX + 1) * TS * sc) / 2 - minX * TS * sc;
    world.y = 40 + (h - (maxY - minY + 1) * TS * sc) / 2 - minY * TS * sc;
  }
  fit(); app.renderer.on('resize', fit);

  // ---- Static layer ----
  const g0 = new PIXI.Graphics(); world.addChild(g0);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const v = map.tiles[y * map.w + x]; if (v === T_VOID) continue;
    if (v === T_WALL) g0.rect(x * TS, y * TS, TS, TS).fill(0x34485c);
    else g0.rect(x * TS, y * TS, TS, TS).fill(map.rooms[map.roomAt[y * map.w + x]]?.type === 'bridge' ? 0x1d2a1f : 0x17212b);
  }
  // floor grid
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (map.tiles[y * map.w + x] === 1) g0.rect(x * TS, y * TS, TS, TS).stroke({ width: 1, color: 0x1f2d3a, alpha: .6 });
  // cover
  for (let i = 0; i < map.cover.length; i++) if (map.cover[i]) {
    const x = i % map.w, y = (i - x) / map.w, s = map.cover[i] === 2 ? 14 : 9;
    g0.rect(x * TS + (TS - s) / 2, y * TS + (TS - s) / 2, s, s).fill(map.cover[i] === 2 ? 0x5a6b78 : 0x3e4c57);
  }
  // features
  for (const f of map.features) {
    const cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2;
    if (f.kind === 'console') g0.circle(cx, cy, 8).fill(0xffd34d);
    else if (f.kind === 'terminal') g0.rect(cx - 5, cy - 5, 10, 10).fill(0x3dd6ff);
    else if (f.kind === 'pods') g0.roundRect(cx - 8, cy - 6, 16, 12, 5).fill(0x4f7dff);
    else if (f.kind === 'loot') g0.rect(cx - 6, cy - 6, 12, 12).fill(0xc9a227);
    else if (f.kind === 'vent') g0.rect(cx - 7, cy - 3, 14, 6).stroke({ width: 2, color: 0x6c7f8f });
  }
  for (const r of map.rooms) {
    const t = new PIXI.Text({ text: r.name.toUpperCase(), style: { fontFamily: 'Rajdhani', fontSize: 13, fill: 0x5b738a, fontWeight: '700', letterSpacing: 1 } });
    t.x = r.x * TS + 3; t.y = r.y * TS + 2; world.addChild(t);
  }
  const gDyn = new PIXI.Graphics(); world.addChild(gDyn);
  const gFx = new PIXI.Graphics(); world.addChild(gFx);

  // ---- Playback state ----
  const U = new Map();   // id -> unit view
  const info = Object.fromEntries(battle.units.map(u => [u.id, u]));
  const doors = map.doors.map(d => ({ ...d, open: false, wasLocked: d.locked }));
  const hazards = [];    // {room, kind, until}
  for (const r of map.rooms) if (r.hazard) hazards.push({ room: r.id, kind: r.hazard, until: 1e9 });
  const fx = [];
  let alarm = 0, hold = 0, holdNeed = OBJECTIVES.take_bridge.ticks, tick = 0, ei = 0, speed = 1, done = false;
  const colorsByUnit = {};
  battle.soldiers.forEach(s => { colorsByUnit[s.unit] = colors[s.uid] || ['#3a5a8c', '#f2c14e']; });

  const name = (id) => { const u = info[id]; if (!u) return '?'; return u.side === 'S' && u.kind !== 'sys_drone' ? u.name.split(' ')[0] : u.name; };
  const say = (t, html, cls = '') => { const d = el(`<div class="${cls}"><span class="t">${fmt(t)}</span>${html}</div>`); feed.prepend(d); };
  const fmt = (t) => { const s = Math.floor(t / TICKS_PER_SEC); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const center = (u) => [u.px * TS + TS / 2, u.py * TS + TS / 2];
  const ent = (id) => info[id]?.kind;

  if (battle.entry === 'breach_pod') { /* decompression shows via hazard events */ }

  function apply(e) {
    const [t, k] = e;
    switch (k) {
      case 'spawn': { const [, , id, side, kind, x, y] = e; U.set(id, { id, side, kind, x, y, px: x, py: y, hp: info[id].maxHp, max: info[id].maxHp, state: 'active', hidden: false }); if (t > 0 && side === 'E') {} break; }
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
    // bridge hold bar
    if (hold) { const r = map.rooms[map.bridge]; gDyn.rect(r.x * TS, (r.y + r.h) * TS - 6, (r.w * TS * Math.min(hold, holdNeed)) / holdNeed, 6).fill(0x4ade80); }
    for (const u of U.values()) {
      u.px += (u.x - u.px) * 0.35; u.py += (u.y - u.py) * 0.35;
      if (u.state === 'gone' || u.state === 'out') continue;
      const [cx, cy] = center(u);
      const kind = u.kind, def = UNIT_BY_ID[kind];
      const alpha = u.hidden ? 0.35 : 1;
      if (u.state === 'dead') { gDyn.circle(cx, cy, 5).fill({ color: 0x3a1a1a, alpha: .8 }); continue; }
      if (u.state === 'down' || u.state === 'captured') {
        const c = u.side === 'S' ? HEX(colorsByUnit[u.id]?.[0] || '#888') : palette[0];
        gDyn.circle(cx, cy, 8).fill({ color: c, alpha: .5 });
        gDyn.moveTo(cx - 6, cy - 6).lineTo(cx + 6, cy + 6).moveTo(cx + 6, cy - 6).lineTo(cx - 6, cy + 6).stroke({ width: 3, color: 0xff4444 });
        continue;
      }
      const off = u.state === 'off';
      if (def?.ai === 'turret') {
        gDyn.poly([cx, cy - 10, cx + 9, cy + 7, cx - 9, cy + 7]).fill({ color: off ? 0x444444 : u.side === 'S' ? 0x3dd6ff : 0xd04040, alpha }).stroke({ width: 2, color: 0x111111 });
      } else if (kind === 'sys_drone') {
        gDyn.poly([cx, cy - 7, cx + 7, cy, cx, cy + 7, cx - 7, cy]).fill({ color: 0x3dd6ff, alpha }).stroke({ width: 1.5, color: 0xffffff });
      } else if (u.side === 'S') {
        const [a, b] = colorsByUnit[u.id] || ['#3a5a8c', '#f2c14e'];
        gDyn.circle(cx, cy, 9).fill({ color: HEX(a), alpha }).stroke({ width: 3, color: HEX(b), alpha });
      } else if (def?.tags.includes('civilian')) {
        gDyn.circle(cx, cy, 6).fill({ color: 0x9aa4ad, alpha });
      } else {
        const lead = def?.tags.includes('leader'), s = lead ? 11 : 8;
        const col = def?.tags.includes('synthetic') ? palette[1] : palette[0];
        gDyn.rect(cx - s, cy - s, s * 2, s * 2).fill({ color: col, alpha }).stroke({ width: lead ? 3 : 2, color: lead ? 0xffd34d : palette[2], alpha });
      }
      // HP bar
      if (u.hp < u.max) { const w = 18, p = Math.max(0, u.hp) / u.max; gDyn.rect(cx - w / 2, cy - 15, w, 3).fill(0x220000); gDyn.rect(cx - w / 2, cy - 15, w * p, 3).fill(p > .5 ? 0x4ade80 : p > .25 ? 0xfacc15 : 0xef4444); }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], age = tick - f.t;
      if (age > f.life) { fx.splice(i, 1); continue; }
      if (f.k === 'shot') {
        const [ax, ay] = center(f.a), [bx, by] = center(f.b);
        gFx.moveTo(ax, ay).lineTo(bx + (f.hit ? 0 : 6), by + (f.hit ? 0 : -6)).stroke({ width: f.crit ? 3 : 1.5, color: f.crit ? 0xff5050 : f.hit ? 0xffe27a : 0x8a96a3, alpha: 1 - age / f.life });
      } else if (f.k === 'boom') {
        gFx.circle(f.x * TS + TS / 2, f.y * TS + TS / 2, (f.big ? 36 : 20) * (0.4 + age / f.life)).fill({ color: 0xff9a2e, alpha: .6 * (1 - age / f.life) });
      } else if (f.k === 'smoke') {
        gFx.rect((f.x - 1) * TS, (f.y - 1) * TS, TS * 3, TS * 3).fill({ color: 0xc8d0d8, alpha: .35 * Math.min(1, (f.life - age) / 10) });
      }
    }
  }

  // ---- Loop ----
  const events = battle.events;
  const endTick = battle.ticks;
  const clock = wrap.querySelector('#clock'), alarmEl = wrap.querySelector('#alarm'), holdEl = wrap.querySelector('#hold');
  let lastSquad = 0;
  function step(dt) {
    if (!done) {
      tick = Math.min(endTick, tick + (dt / 1000) * TICKS_PER_SEC * speed);
      while (ei < events.length && events[ei][0] <= tick) apply(events[ei++]);
      if (tick >= endTick && ei >= events.length) { done = true; setTimeout(() => finish(), 900); }
    }
    draw();
    clock.textContent = fmt(tick);
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
  function finish() { if (finished) return; finished = true; drawSquad(); showReport(panel, battle, report, isReplay); }
  current = { destroy() { app.destroy(true, { children: true }); current = null; } };
  const stop = () => { G.holdBucs(0); if (current) current.destroy(); window.removeEventListener('hashchange', stop); };
  window.addEventListener('hashchange', stop);
}

// ---------- Report ----------
function showReport(panel, battle, report, isReplay) {
  G.holdBucs(0);
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
    <table class="rep"><tr><th>Soldier</th><th>Outcome</th><th>Injuries</th><th>XP</th></tr>
      ${report.soldiers.map(s => `<tr><td><b>${esc(s.name)}</b><div class="small dim">${SPECIALTY_BY_ID[s.specialty].name} · ${s.kills} kills</div></td>
        <td>${fateTxt(s)}</td>
        <td>${s.injuries.length && s.fate !== 'kia' ? s.injuries.map(i => `${INJURY_BY_ID[i].name}${INJURY_BY_ID[i].severity === 2 ? ' <span class="small warn">(benched)</span>' : ''}`).join('<br>') : '<span class="dim">—</span>'}</td>
        <td>+${s.xp}${s.levelUps.map(l => `<div class="small good">Level ${l.level}! ${Object.entries(l.gains).map(([k, v]) => `+${v} ${STAT_INFO[k].short}`).join(', ')}${l.breakthrough ? ' <b>BREAKTHROUGH</b>' : ''}</div>`).join('')}
          ${(s.perkPending || []).length && !isReplay ? `<div><button class="primary small" data-perk="${s.uid}" style="padding:3px 8px;margin-top:4px">Choose perk</button></div>` : ''}
          ${(s.medals || []).map(id => `<div class="small" style="margin-top:3px">${ribbon(id)} <b>${COMMENDATION_BY_ID[id].name}</b>${s.fate === 'kia' ? ' (posthumous)' : ''}</div>`).join('')}</td></tr>`).join('')}
    </table>
    ${report.extras.map(x => x.kind === 'item' ? `<div class="good" style="margin-top:8px">Armory raid: found ${itemLabel(x.item)}</div>` : `<div class="good" style="margin-top:8px">The freed prisoner, ${esc(x.name)}, joined the team.</div>`).join('')}
    ${isReplay ? '<div class="dim small" style="margin-top:8px">Replay: nothing was changed.</div>' : ''}
    <div class="row" style="margin-top:14px;justify-content:flex-end"><button id="again">Deploy again</button><button class="primary" id="home">Back to Barracks</button></div>
  </div>`);
  const m = document.getElementById('modal'); m.innerHTML = ''; m.append(box); m.hidden = false; m.onclick = null;
  const close = (to) => { m.hidden = true; m.innerHTML = ''; if (current) current.destroy(); exitTo(to); };
  box.querySelector('#home').onclick = () => close('barracks');
  box.querySelector('#again').onclick = () => close('deploy');
  for (const b of box.querySelectorAll('[data-perk]')) b.onclick = () => { m.hidden = true; m.innerHTML = ''; if (current) current.destroy(); openSoldierFn?.(b.dataset.perk); };
}
