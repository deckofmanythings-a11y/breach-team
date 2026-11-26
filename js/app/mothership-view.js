// Mothership tab: the ship as a map (M3) plus a card per room (M2). Build/upgrade with CREDs.
import * as G from './state.js?v=3';
import { el, esc, toast, modal, closeModal } from './ui.js';
import { MS_ROOMS, MS_ROOM_BY_ID, MAX_ROOM_LEVEL, roomLevel, nextRoomPrice, roomEffect, describeEffect, mothershipEffects } from '../data/mothership-rooms.js';
import { buildMothershipMap } from '../engine/mothership-map.js';
import { createShipView } from '../render/ship-view.js';

let view = null;
const dropView = () => { if (view) { view.destroy(); view = null; } };
window.addEventListener('hashchange', dropView);

const pips = (lv) => `<span class="ms-pips">${Array.from({ length: MAX_ROOM_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`;

// Where an idle Soldier hangs out on the map (flavour only).
function hangout(g, s) {
  const built = (id) => roomLevel(g, id) > 0;
  if (s.injuries?.length) return built('med_bay') ? 'med_bay' : 'quarters';
  if (s.specialty === 'medic' && built('med_bay')) return 'med_bay';
  if (s.specialty === 'tech') return 'engineering';
  if (['assault', 'marksman', 'heavy'].includes(s.specialty) && built('training_deck')) return 'training_deck';
  if (s.specialty === 'breacher' && built('armory')) return 'armory';
  return 'quarters';
}

export function renderMothership(panel, run) {
  const S = G.state();
  const creds = S.creds || 0;
  const wrap = el(`<div>
    <h2>Mothership</h2>
    <div class="section banner info"><b class="ms-creds">${creds.toLocaleString()} CREDs</b>
      <div class="small dim">Your Soldiers earn 1 CRED for every XP point (about 200 a mission). Rooms carry over a Game Over.</div>
      <div class="small" style="margin-top:6px"><b>Active bonuses:</b> ${esc(describeEffect(mothershipEffects(S)))}</div></div>
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
  const soldiers = S.soldiers.filter(s => s.status !== 'mia').map(s => ({ s, room: hangout(S, s) }));
  createShipView(stage, buildMothershipMap(S), {
    faction: 'military', soldiers,
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
  const price = nextRoomPrice(S, r.id);
  const now = lv > 0 ? describeEffect(roomEffect(r.id, lv)) : null;
  const next = price !== null ? describeEffect(roomEffect(r.id, lv + 1)) : null;
  const action = r.soon ? '' : price === null ? '<span class="good small">Fully upgraded</span>'
    : `<button class="primary" data-room="${r.id}" ${creds < price ? 'disabled' : ''}>${lv ? `Upgrade to L${lv + 1}` : 'Build'} · ${price.toLocaleString()} CREDs</button>`;
  return el(`<div class="card ms-room ${r.soon ? 'off' : lv ? 'built' : ''}">
    <div class="spread"><h4><span class="ms-icon">${r.icon}</span> ${esc(r.name)}</h4>${r.soon ? '' : pips(lv)}</div>
    <div class="small dim">${esc(r.desc)}</div>
    ${r.soon ? `<div class="small warn" style="margin-top:6px">Coming ${esc(r.soon)}.</div>` : `
    ${now ? `<div class="small" style="margin-top:6px"><b>Now (L${lv}):</b> ${esc(now)}</div>` : '<div class="small dim" style="margin-top:6px">Not built yet.</div>'}
    ${next ? `<div class="small" style="margin-top:2px"><b>${lv ? `L${lv + 1}` : 'Build'}:</b> ${esc(next)}</div>` : ''}
    <div style="margin-top:8px">${action}</div>`}
  </div>`);
}

async function onBuild(e, S, panel, run) {
  const b = e.target.closest('[data-room]'); if (!b) return;
  const r = MS_ROOM_BY_ID[b.dataset.room];
  const lv = roomLevel(S, r.id), price = nextRoomPrice(S, r.id);
  if (!confirm(`${lv ? `Upgrade the ${r.name} to level ${lv + 1}` : `Build the ${r.name}`} for ${price.toLocaleString()} CREDs?`)) return;
  const out = await run(() => G.act('buildRoom', { room: r.id }));
  if (out) { closeModal(); toast(lv ? `${r.name} upgraded to level ${out.level}.` : `${r.name} built.`); panel.replaceChildren(); renderMothership(panel, run); }
}
