// Store: Booster Packs + today's stock. Everything is bought on the server (boarding-api).
import { openPackShow } from './pack-open.js';
import { levelBadge } from './badges.js';
import * as G from './state.js?v=3';
import { el, esc, avatar, itemLabel, statGrid, toast } from './ui.js';
import { PACKS, PITY_RELIC_AFTER, GRADE_BY_ID } from '../data/economy.js';
import { rosterFull } from '../data/crew-quarters.js';
import { SPECIALTY_BY_ID } from '../data/specialties.js';
import { ITEM_BY_ID } from '../data/gear.js';
import { storePrice, mothershipEffects } from '../data/mothership-rooms.js';

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
  const full = rosterFull(S);
  const P = (n) => storePrice(S, n);   // Armory discount
  const disc = mothershipEffects(S).storePct;
  const wrap = el(`<div>
    <h2>Store</h2>
    ${disc ? `<div class="banner info small" style="margin-bottom:10px">🛠 Your Armory takes ${-disc}% off everything here.</div>` : ''}
    <div class="section"><h3>Booster Packs</h3>
      <div class="dim small" style="margin-bottom:8px">Every pack's best item is guaranteed at least its listed rarity. Go ${PITY_RELIC_AFTER} item packs in a row without a Relic and the next one has one. <span id="pity"></span></div>
      <div class="opt">${PACKS.map(p => `<div class="card"><h4>${p.name}</h4><div class="small dim">${esc(p.desc)}</div>
        <div class="spread" style="margin-top:8px"><b style="color:var(--accent)">${P(p.price)} BUCs</b>${disc ? ` <s class="dim small">${p.price}</s>` : ''}
        <button class="primary" data-pack="${p.id}" ${S.bucs < P(p.price) || (p.soldiers && rosterFull(S, p.soldiers)) ? 'disabled' : ''}>Open</button></div></div>`).join('')}</div>
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
      <span>${bought.has(it.slot) ? '<span class="dim">Bought</span>' : `<button data-buy="${it.slot}" ${S.bucs < P(it.price) ? 'disabled' : ''}>Buy (${P(it.price)})</button>`}</span></div>`);
    list.append(row);
  }
  const rec = wrap.querySelector('#recruits');
  for (const s of stock?.soldiers || []) {
    const g = GRADE_BY_ID[s.grade];
    rec.append(el(`<div class="card ${bought.has(s.slot) ? 'off' : ''}"><div class="soldier-head">${avatar(s)}<div style="flex:1">
      <div class="name">${esc(s.name)} ${s.callsign ? `<span class="callsign">"${esc(s.callsign)}"</span>` : ''}</div>
      <div class="small dim">${levelBadge(s.level, (s.colors || [])[1], 'sm')} ${g.name} ${SPECIALTY_BY_ID[s.specialty].name}</div></div></div>
      ${statGrid(s.stats, s.specialty)}
      <div class="spread" style="margin-top:8px"><b style="color:var(--accent)">${P(s.price)} BUCs</b>${disc ? ` <s class="dim small">${s.price}</s>` : ''}
      ${bought.has(s.slot) ? '<span class="dim">Hired</span>' : `<button data-buy="${s.slot}" ${S.bucs < P(s.price) || full ? 'disabled' : ''}>Hire</button>`}</div></div>`));
  }

  wrap.onclick = async (e) => {
    const pb = e.target.closest('[data-pack]'), bb = e.target.closest('[data-buy]');
    if (pb) {
      pb.disabled = true;
      const r = await run(() => G.act('pack', { pack: pb.dataset.pack }));
      renderAgain();
      if (r) await openPackShow(PACKS.find(p => p.id === pb.dataset.pack), {
        ...r, items: r.items.map(it => G.itemById(it.uid) || it), soldiers: r.soldiers.map(id => G.soldierById(id)).filter(Boolean) });
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
