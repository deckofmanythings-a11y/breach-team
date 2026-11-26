// Deploy screen: what the Intel Room has scouted on the selected target (docs/MOTHERSHIP.md, M6).
// L1 crew, L2 + optional objectives (bonus BUCs), L3 + the ship's map. New file (stale-cache rule).
import { el, esc } from './ui.js';
import { scoutReport, intelLevel } from '../engine/scout.js';
import { UNIT_BY_ID } from '../data/factions.js';
import { OBJECTIVES } from '../data/ships.js';
import { T_FLOOR, T_DOOR, T_WALL } from '../engine/mapgen.js';

// S = save, shipId = selected target, noRetreat = Suicide Squad (bigger crew). Returns an element or null.
export function intelPanel(S, shipId, noRetreat) {
  if (!intelLevel(S)) return null;
  const rep = scoutReport(S, shipId, noRetreat);
  if (!rep) return null;
  const { level, ship, map, plan } = rep;
  const count = {};
  for (const c of plan.crew) count[c.kind] = (count[c.kind] || 0) + 1;
  const crew = Object.entries(count).sort((a, b) => UNIT_BY_ID[b[0]].cost - UNIT_BY_ID[a[0]].cost)
    .map(([k, n]) => `${n}× ${esc(UNIT_BY_ID[k].name)}`);
  const leader = UNIT_BY_ID[ship.leader];
  const civ = plan.civilians.length;
  const turrets = map.features.filter(f => f.kind === 'turret').length;
  const objs = plan.objectives.map(o => `${esc(OBJECTIVES[o.id].name)} <span class="dim">(${esc(map.rooms[o.room].name || map.rooms[o.room].type)}, +${OBJECTIVES[o.id].bonusPct || 0}%)</span>`);
  const wrap = el(`<div class="card intel" style="margin-top:8px">
    <div class="spread"><b>📡 Intel: ${esc(ship.name)}</b><span class="small dim">Intel Room L${level} · refreshes after every mission</span></div>
    <div class="small" style="margin-top:4px"><b>Crew:</b> ${esc(leader?.name || 'Leader')} + ${plan.crew.length} (${crew.join(', ')})${civ ? ` · ${civ} unarmed crew` : ''}${level >= 3 ? ` · ${turrets} turret${turrets === 1 ? '' : 's'}` : ''}</div>
    <div class="small" style="margin-top:2px">${level >= 2 ? `<b>Optional objectives:</b> ${objs.join(' · ') || 'none'}` : '<span class="dim">Intel Room L2 also scouts the optional objectives.</span>'}</div>
    ${level >= 3 ? '<canvas class="intel-map" style="margin-top:6px;max-width:100%;image-rendering:pixelated"></canvas>' : '<div class="small dim" style="margin-top:2px">Intel Room L3 also maps the ship.</div>'}
    <div class="small dim" style="margin-top:4px">Their reinforcements, and where everyone stands, aren't known until you board. Contracts can't be scouted, and some contacts aren't what they seem.</div>
  </div>`);
  if (level >= 3) {   // a canvas parsed from a template belongs to an inert document that can't draw text
    const old = wrap.querySelector('canvas'), cv = document.createElement('canvas');
    cv.className = old.className; cv.style.cssText = old.style.cssText;
    drawMap(cv, map, plan);   // before inserting it: inside the template's tree it would be adopted into that document
    old.replaceWith(cv);
  }
  return wrap;
}

function drawMap(cv, map, plan) {
  let minX = map.w, minY = map.h, maxX = 0, maxY = 0;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.tiles[y * map.w + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const T = 8, w = maxX - minX + 1, h = maxY - minY + 1;
  cv.width = w * T; cv.height = h * T; cv.style.width = Math.min(w * T, 560) + 'px';
  const c = cv.getContext('2d');
  const objRooms = new Set(plan.objectives.map(o => o.room));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const t = map.tiles[y * map.w + x]; if (!t) continue;
    const r = map.roomAt[y * map.w + x];
    c.fillStyle = t === T_WALL ? '#8a96a3' : t === T_DOOR ? '#5f88a8'
      : r === map.bridge ? '#2f5d3a' : r === map.airlock ? '#2b3f5c' : objRooms.has(r) ? '#5c4a1f' : t === T_FLOOR ? '#1c252f' : '#1c252f';
    c.fillRect((x - minX) * T, (y - minY) * T, T, T);
  }
  for (const f of map.features) if (f.kind === 'turret') { c.fillStyle = '#e8483b'; c.beginPath(); c.arc((f.x - minX + 0.5) * T, (f.y - minY + 0.5) * T, T * 0.4, 0, 7); c.fill(); }
  c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
  const label = (r, txt, col, dy = 0) => { c.fillStyle = col; c.fillText(txt, (r.x + r.w / 2 - minX) * T, (r.y + r.h / 2 - minY) * T + 4 + dy, r.w * T - 4); };
  label(map.rooms[map.bridge], 'BRIDGE', '#9be7a8');
  label(map.rooms[map.airlock], 'AIRLOCK', '#9fc3ff');
  for (const id of objRooms) label(map.rooms[id], '★', '#f2c14e', id === map.bridge || id === map.airlock ? 12 : 0);   // objective rooms
}
