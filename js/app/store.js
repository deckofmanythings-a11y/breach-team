// Store: Booster Packs + today's stock. Everything is bought on the server (boarding-api).
import * as G from './state.js?v=3';
import { el, esc, avatar, itemLabel, modal, closeModal, statGrid, toast } from './ui.js';
import { PACKS, PITY_RELIC_AFTER, GRADE_BY_ID, ROSTER_CAP } from '../data/economy.js';
import { SPECIALTY_BY_ID } from '../data/specialties.js';
import { ITEM_BY_ID } from '../data/gear.js';

// Time until midnight Pacific (store restock).
function untilRestock() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const next = new Date(pt); next.setHours(24, 0, 0, 0);
  const ms = next - pt, h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return `${h}h ${m}m`;
}

export function renderStore(panel, run) {
  const S = G.state();
  const stock = G.store();
  const full = S.soldiers.length >= ROSTER_CAP;
  const wrap = el(`<div>
    <h2>Store</h2>
    <div class="section"><h3>Booster Packs</h3>
      <div class="dim small" style="margin-bottom:8px">Every pack's best item is guaranteed at least its listed rarity. Go ${PITY_RELIC_AFTER} item packs in a row without a Relic and the next one has one. <span id="pity"></span></div>
      <div class="opt">${PACKS.map(p => `<div class="card"><h4>${p.name}</h4><div class="small dim">${esc(p.desc)}</div>
        <div class="spread" style="margin-top:8px"><b style="color:var(--accent)">${p.price} BUCs</b>
        <button class="primary" data-pack="${p.id}" ${S.bucs < p.price || (p.soldiers && full) ? 'disabled' : ''}>Open</button></div></div>`).join('')}</div>
    </div>
    <div class="section"><div class="spread"><h3>Today's stock</h3><span class="dim small">Restocks in ${untilRestock()} (midnight Pacific). Same stock for everyone.</span></div>
      <div id="stock" style="display:grid;gap:6px;max-width:900px"></div>
      <h3 style="margin-top:14px">Recruits for hire</h3><div class="grid" id="recruits"></div>
    </div>
  </div>`);
  if (S.pity) wrap.querySelector('#pity').textContent = `(${S.pity} without a Relic so far)`;

  const bought = new Set(stock?.bought || []);
  const list = wrap.querySelector('#stock');
  for (const it of stock?.items || []) {
    const base = ITEM_BY_ID[it.base];
    const row = el(`<div class="item"><span>${itemLabel(it)} <span class="dim small">${base.slot}${base.type ? ' · ' + base.type : ''}</span></span>
      <span>${bought.has(it.slot) ? '<span class="dim">Bought</span>' : `<button data-buy="${it.slot}" ${S.bucs < it.price ? 'disabled' : ''}>Buy (${it.price})</button>`}</span></div>`);
    list.append(row);
  }
  const rec = wrap.querySelector('#recruits');
  for (const s of stock?.soldiers || []) {
    const g = GRADE_BY_ID[s.grade];
    rec.append(el(`<div class="card ${bought.has(s.slot) ? 'off' : ''}"><div class="soldier-head">${avatar(s)}<div style="flex:1">
      <div class="name">${esc(s.name)} ${s.callsign ? `<span class="callsign">"${esc(s.callsign)}"</span>` : ''}</div>
      <div class="small dim">${g.name} ${SPECIALTY_BY_ID[s.specialty].name} · Lv ${s.level}</div></div></div>
      ${statGrid(s.stats)}
      <div class="spread" style="margin-top:8px"><b style="color:var(--accent)">${s.price} BUCs</b>
      ${bought.has(s.slot) ? '<span class="dim">Hired</span>' : `<button data-buy="${s.slot}" ${S.bucs < s.price || full ? 'disabled' : ''}>Hire</button>`}</div></div>`));
  }

  wrap.onclick = async (e) => {
    const pb = e.target.closest('[data-pack]'), bb = e.target.closest('[data-buy]');
    if (pb) {
      pb.disabled = true;
      const r = await run(() => G.act('pack', { pack: pb.dataset.pack }));
      if (r) reveal(PACKS.find(p => p.id === pb.dataset.pack), r);
      renderAgain();
    } else if (bb) {
      bb.disabled = true;
      const r = await run(() => G.act('buy', { slot: bb.dataset.buy }));
      if (r) toast(r.soldier ? `${G.soldierById(r.soldier)?.name} joined the team.` : `${itemLabel(G.itemById(r.item), true)} added to the Armory.`);
      renderAgain();
    }
  };
  const renderAgain = () => { panel.innerHTML = ''; renderStore(panel, run); };
  panel.append(wrap);
}

function reveal(pack, r) {
  const items = r.items.map(it => G.itemById(it.uid) || it);
  const soldiers = r.soldiers.map(id => G.soldierById(id)).filter(Boolean);
  const box = el(`<div class="box"><h2>${esc(pack.name)}</h2>
    ${r.pity ? '<div class="banner">Pity guarantee: a Relic!</div>' : ''}
    ${(r.rare || []).length ? '<div class="banner info">★ A rare recruit has joined you!</div>' : ''}
    ${soldiers.map(s => `<div class="card" style="margin-bottom:8px"><div class="soldier-head">${avatar(s)}<div>
      <div class="name">${esc(s.name)} ${s.callsign ? `<span class="callsign">"${esc(s.callsign)}"</span>` : ''}</div>
      <div class="small dim">${GRADE_BY_ID[s.grade]?.name || ''} ${SPECIALTY_BY_ID[s.specialty].name} · Lv ${s.level}</div>${s.bio ? `<div class="small"><i>${esc(s.bio)}</i></div>` : ''}</div></div>${statGrid(s.stats)}</div>`).join('')}
    <div style="display:grid;gap:6px">${items.map(it => `<div class="item"><span>${itemLabel(it)} <span class="dim small">${ITEM_BY_ID[it.base].slot}</span>
      ${ITEM_BY_ID[it.base].flavor ? `<div class="small dim"><i>${esc(ITEM_BY_ID[it.base].flavor)}</i></div>` : ''}</span></div>`).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="primary" id="ok">Nice</button></div></div>`);
  box.querySelector('#ok').onclick = closeModal;
  modal(box);
}
