// Mothership tab: the ship as a map (M3) plus a card per room (M2). Build/upgrade with CREDs.
import * as G from './state.js?v=3';
import { el, esc, toast, modal, closeModal } from './ui.js';
import { MS_ROOMS, MS_ROOM_BY_ID, MAX_ROOM_LEVEL, roomLevel, nextRoomPrice, roomEffect, describeEffect, mothershipEffects } from '../data/mothership-rooms.js';
import { buildMothershipMap } from '../engine/mothership-map.js';
import { createShipView } from '../render/ship-view.js';
import { stationKey } from '../engine/defense-setup.js';
import { DEFENSE } from '../data/threats.js';
import { isDamaged, repairPrice } from '../data/defense-events.js';

let view = null;
const dropView = () => { if (view) { view.destroy(); view = null; } };
window.addEventListener('hashchange', dropView);

const pips = (lv) => `<span class="ms-pips">${Array.from({ length: MAX_ROOM_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`;

// Where an idle Soldier is on the map: the same station they defend from if the ship is boarded
// (every 4th Soldier is on Bridge watch). Fixed rooms count as built.
function hangout(g, s, i) {
  if (i % DEFENSE.guardEvery === DEFENSE.guardEvery - 1) return 'bridge';
  return stationKey((id) => id === 'quarters' || id === 'engineering' || roomLevel(g, id) > 0, s);
}

export function renderMothership(panel, run) {
  const S = G.state();
  const creds = S.creds || 0;
  const wrap = el(`<div>
    <h2>Mothership</h2>
    <div class="section banner info"><b class="ms-creds">${creds.toLocaleString()} CREDs</b>
      <div class="small dim">Your Soldiers earn 1 CRED for every XP point (about 200 a mission). Rooms carry over a Game Over.</div>
      <div class="small" style="margin-top:6px"><b>Active bonuses:</b> ${esc(describeEffect(mothershipEffects(S)))}</div>
      ${S.defenses?.fought ? `<div class="small dim" style="margin-top:4px">Boarded ${S.defenses.fought} time${S.defenses.fought > 1 ? 's' : ''}, held ${S.defenses.won}.</div>` : ''}</div>
    <div class="stage ms-stage" id="msstage"><div class="ms-hint small">Tap a room to build or upgrade it · drag to pan · pinch or scroll to zoom</div></div>
    <h3 style="margin-top:14px">All rooms</h3>
    <div class="grid ms-grid" id="rooms"></div>
  </div>`);
  const list = wrap.querySelector('#rooms');
  for (const r of MS_ROOMS) list.append(roomCard(S, r, creds));
  wrap.onclick = (e) => onBuild(e, S, panel, run);
  panel.append(wrap);

  // The map.
  dropView();
  const stage = wrap.querySelector('#msstage');
  const soldiers = S.soldiers.filter(s => s.status !== 'mia').map((s, i) => ({ s, room: hangout(S, s, i) }));
  const msMap = buildMothershipMap(S);
  for (const sl of msMap.slots) if (sl.room && isDamaged(S, sl.room)) sl.name += ' ⚠ DAMAGED';
  createShipView(stage, msMap, {
    faction: 'mothership', soldiers,
    onTap: (slot) => {
      if (!slot) return;
      view?.select(slot.key);
      const box = el('<div class="box ms-modal"></div>');
      box.append(roomCard(S, MS_ROOM_BY_ID[slot.room], creds));
      box.append(el('<div class="row" style="margin-top:8px"><button class="ms-close">Close</button></div>'));
      box.onclick = (e) => { if (e.target.closest('.ms-close')) { closeModal(); view?.select(null); return; } onBuild(e, S, panel, run); };
      modal(box);
    },
  }).then(v => { if (stage.isConnected) view = v; else v.destroy(); })
    .catch(() => stage.append(el('<div class="dim" style="padding:30px">Couldn’t load the graphics library, so the map is unavailable. The room list below still works.</div>')));
}

function roomCard(S, r, creds) {
  const lv = roomLevel(S, r.id);
  const fix = repairPrice(S, r.id);   // damaged in a lost defense
  const price = fix === null ? nextRoomPrice(S, r.id) : null;
  const now = lv > 0 ? describeEffect(roomEffect(r.id, lv)) : null;
  const next = price !== null ? describeEffect(roomEffect(r.id, lv + 1)) : null;
  const action = r.soon ? '' : fix !== null ? `<button class="primary danger" data-repair="${r.id}" ${creds < fix ? 'disabled' : ''}>Repair · ${fix.toLocaleString()} CREDs</button>`
    : price === null ? '<span class="good small">Fully upgraded</span>'
    : `<button class="primary" data-room="${r.id}" ${creds < price ? 'disabled' : ''}>${lv ? `Upgrade to L${lv + 1}` : 'Build'} · ${price.toLocaleString()} CREDs</button>`;
  return el(`<div class="card ms-room ${r.soon ? 'off' : fix !== null ? 'damaged' : lv ? 'built' : ''}">
    <div class="spread"><h4><span class="ms-icon">${r.icon}</span> ${esc(r.name)}</h4>${r.soon ? '' : pips(lv)}</div>
    <div class="small dim">${esc(r.desc)}</div>
    ${r.soon ? `<div class="small warn" style="margin-top:6px">Coming ${esc(r.soon)}.</div>` : `
    ${fix !== null ? '<div class="small bad" style="margin-top:6px"><b>⚠ DAMAGED</b> in a boarding: its bonus is off until repaired.</div>' : ''}
    ${now ? `<div class="small" style="margin-top:6px${fix !== null ? ';text-decoration:line-through;opacity:.6' : ''}"><b>Now (L${lv}):</b> ${esc(now)}</div>` : '<div class="small dim" style="margin-top:6px">Not built yet.</div>'}
    ${next ? `<div class="small" style="margin-top:2px"><b>${lv ? `L${lv + 1}` : 'Build'}:</b> ${esc(next)}</div>` : ''}
    <div style="margin-top:8px">${action}</div>`}
  </div>`);
}

async function onBuild(e, S, panel, run) {
  const rp = e.target.closest('[data-repair]');
  if (rp) {
    const r = MS_ROOM_BY_ID[rp.dataset.repair], price = repairPrice(S, r.id);
    if (!confirm(`Repair the ${r.name} for ${price.toLocaleString()} CREDs?`)) return;
    const out = await run(() => G.act('repairRoom', { room: r.id }));
    if (out) { closeModal(); toast(`${r.name} repaired.`); panel.replaceChildren(); renderMothership(panel, run); }
    return;
  }
  const b = e.target.closest('[data-room]'); if (!b) return;
  const r = MS_ROOM_BY_ID[b.dataset.room];
  const lv = roomLevel(S, r.id), price = nextRoomPrice(S, r.id);
  if (!confirm(`${lv ? `Upgrade the ${r.name} to level ${lv + 1}` : `Build the ${r.name}`} for ${price.toLocaleString()} CREDs?`)) return;
  const out = await run(() => G.act('buildRoom', { room: r.id }));
  if (out) { closeModal(); toast(lv ? `${r.name} upgraded to level ${out.level}.` : `${r.name} built.`); panel.replaceChildren(); renderMothership(panel, run); }
}
