// Mothership tab (phase M2): build and upgrade rooms with CREDs. The map view comes in M3.
import * as G from './state.js?v=3';
import { el, esc, toast } from './ui.js';
import { MS_ROOMS, MAX_ROOM_LEVEL, roomLevel, nextRoomPrice, roomEffect, describeEffect, mothershipEffects } from '../data/mothership-rooms.js';

const pips = (lv) => `<span class="ms-pips">${Array.from({ length: MAX_ROOM_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`;

export function renderMothership(panel, run) {
  const S = G.state();
  const creds = S.creds || 0;
  const total = describeEffect(mothershipEffects(S));
  const wrap = el(`<div>
    <h2>Mothership</h2>
    <div class="section banner info"><div class="spread"><div><b class="ms-creds">${creds.toLocaleString()} CREDs</b>
      <div class="small dim">Your Soldiers earn 1 CRED for every XP point (about 200 a mission). Rooms carry over a Game Over.</div></div></div>
      <div class="small" style="margin-top:6px"><b>Active bonuses:</b> ${esc(total)}</div></div>
    <div class="grid ms-grid" id="rooms"></div>
  </div>`);
  const list = wrap.querySelector('#rooms');
  for (const r of MS_ROOMS) {
    const lv = roomLevel(S, r.id);
    const price = nextRoomPrice(S, r.id);
    const now = lv > 0 ? describeEffect(roomEffect(r.id, lv)) : null;
    const next = price !== null ? describeEffect(roomEffect(r.id, lv + 1)) : null;
    const label = r.soon ? '' : price === null ? '<span class="good small">Fully upgraded</span>'
      : `<button class="primary" data-room="${r.id}" ${creds < price ? 'disabled' : ''}>${lv ? `Upgrade to L${lv + 1}` : 'Build'} · ${price.toLocaleString()} CREDs</button>`;
    list.append(el(`<div class="card ms-room ${r.soon ? 'off' : lv ? 'built' : ''}">
      <div class="spread"><h4><span class="ms-icon">${r.icon}</span> ${esc(r.name)}</h4>${r.soon ? '' : pips(lv)}</div>
      <div class="small dim">${esc(r.desc)}</div>
      ${r.soon ? `<div class="small warn" style="margin-top:6px">Coming ${esc(r.soon)}.</div>` : `
      ${now ? `<div class="small" style="margin-top:6px"><b>Now (L${lv}):</b> ${esc(now)}</div>` : '<div class="small dim" style="margin-top:6px">Not built yet.</div>'}
      ${next ? `<div class="small" style="margin-top:2px"><b>${lv ? `L${lv + 1}` : 'Build'}:</b> ${esc(next)}</div>` : ''}
      <div style="margin-top:8px">${label}</div>`}
    </div>`));
  }
  wrap.onclick = async (e) => {
    const b = e.target.closest('[data-room]'); if (!b) return;
    const r = MS_ROOMS.find(x => x.id === b.dataset.room);
    const lv = roomLevel(S, r.id), price = nextRoomPrice(S, r.id);
    if (!confirm(`${lv ? `Upgrade the ${r.name} to level ${lv + 1}` : `Build the ${r.name}`} for ${price.toLocaleString()} CREDs?`)) return;
    const out = await run(() => G.act('buildRoom', { room: r.id }));
    if (out) { toast(lv ? `${r.name} upgraded to level ${out.level}.` : `${r.name} built.`); panel.replaceChildren(); renderMothership(panel, run); }
  };
  panel.append(wrap);
}
