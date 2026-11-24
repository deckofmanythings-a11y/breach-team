// Breach Team client. Phase 3: local save, roster, deploy, mission playback, report.
import * as G from './state.js';
import { el, esc, toast, modal, closeModal, avatar, statGrid, itemLabel, timeLeft } from './ui.js';
import { renderDeploy } from './deploy.js';
import { SPECIALTIES, SPECIALTY_BY_ID, ABILITIES } from '../data/specialties.js';
import { ITEM_BY_ID, SLOTS, RARITY_BY_ID, RARITY_ORDER } from '../data/gear.js';
import { INJURY_BY_ID } from '../data/injuries.js';
import { ROSTER_CAP, COLOR_PRESETS } from '../data/economy.js';
import { xpToReach, MAX_LEVEL, PERK_LEVELS } from '../data/stats.js';
import { ENGINE_VERSION } from '../data/version.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { replayMission, setExit } from './mission.js';

export const APP_VERSION = '0.1.0';
document.getElementById('ver').textContent = `Ver. ${APP_VERSION} · engine v${ENGINE_VERSION}`;

G.load();
const panel = document.getElementById('panel');
let route = location.hash.slice(1) || 'barracks';

function refreshTop() { document.getElementById('bucs').textContent = G.shownBucs().toLocaleString(); }
G.onChange(refreshTop);
refreshTop();

export function go(r) { route = r; location.hash = r; render(); }
setExit(go);
window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r && r !== route) { route = r; render(); } });
document.getElementById('nav').addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (b) go(b.dataset.go); });

export function render() {
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.go === route);
  G.tick();
  panel.innerHTML = '';
  if (route === 'deploy') return renderDeploy(panel);
  if (route === 'armory') return renderArmory();
  if (route === 'log') return renderLog();
  if (route === 'memorial') return renderMemorial();
  route = 'barracks'; renderBarracks();
}

// Healing timers tick visibly.
setInterval(() => { if (G.tick() && (route === 'barracks')) render(); else for (const n of document.querySelectorAll('[data-until]')) n.textContent = timeLeft(+n.dataset.until); }, 1000);

// ---------- Barracks ----------
function soldierCard(s) {
  const c = G.condition(s);
  const st = G.effectiveStats(s);
  const nextUntil = Math.max(0, ...s.injuries.map(i => i.until), s.status === 'mia' ? s.miaUntil : 0);
  const sp = SPECIALTY_BY_ID[s.specialty];
  return el(`<div class="card click">
    <div class="soldier-head">${avatar(s)}
      <div style="flex:1;min-width:0">
        <div class="name">${esc(s.name)} ${s.callsign ? `<span class="callsign">"${esc(s.callsign)}"</span>` : ''}</div>
        <div class="dim small">${sp.name} · Lv ${s.level}</div>
      </div>
      <div style="text-align:right">
        <span class="tag ${c}">${{ healthy: 'Ready', wounded: 'Wounded', benched: 'Recovering', mia: 'Missing' }[c]}</span>
        ${nextUntil ? `<div class="small dim" data-until="${nextUntil}">${timeLeft(nextUntil)}</div>` : ''}
        ${s.pendingPerks.length ? '<div><span class="tag perk">Perk!</span></div>' : ''}
      </div>
    </div>
    ${statGrid(st)}
  </div>`);
}

function renderBarracks() {
  const S = G.state();
  const wrap = el(`<div><div class="spread section"><div><h2>Barracks</h2><div class="dim">${S.soldiers.length}/${ROSTER_CAP} Soldiers · ${S.missions} missions flown</div></div>
    <div class="row"><select id="hireSpec">${SPECIALTIES.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
    <button id="hire">Hire Rookie (${G.HIRE_PRICE} BUCs)</button></div></div><div class="grid" id="roster"></div>
    <p class="dim small" style="margin-top:20px">Booster packs and the Store arrive in Phase 5. For now you can hire level-1 Rookies of any specialty.</p></div>`);
  const roster = wrap.querySelector('#roster');
  const order = { healthy: 0, wounded: 1, benched: 2, mia: 3 };
  for (const s of S.soldiers.slice().sort((a, b) => order[G.condition(a)] - order[G.condition(b)] || b.level - a.level)) {
    const card = soldierCard(s); card.onclick = () => openSoldier(s); roster.append(card);
  }
  wrap.querySelector('#hire').disabled = S.bucs < G.HIRE_PRICE || S.soldiers.length >= ROSTER_CAP;
  wrap.querySelector('#hire').onclick = () => { const s = G.hireRookie(wrap.querySelector('#hireSpec').value); if (s) { toast(`${s.name} joined the team.`); render(); } };
  panel.append(wrap);
}

// ---------- Soldier detail ----------
export function openSoldier(s) {
  const S = G.state();
  const sp = SPECIALTY_BY_ID[s.specialty];
  const st = G.effectiveStats(s);
  const ab = ABILITIES[sp.ability];
  const c = G.condition(s);
  const next = s.level >= MAX_LEVEL ? null : xpToReach(s.level + 1);
  const cost = G.healCost(s);
  const box = el(`<div class="box">
    <div class="spread"><div class="soldier-head">${avatar(s, 56)}<div>
      <div class="name" style="font-size:18px">${esc(s.name)} ${s.callsign ? `<span class="callsign">"${esc(s.callsign)}"</span>` : ''}</div>
      <div class="dim">${sp.name} · Level ${s.level} · ${s.missions} missions · ${s.kills} kills</div></div></div>
      <button id="x">Close</button></div>
    <div class="small dim" style="margin:8px 0">${esc(sp.desc)}</div>
    <div class="small">XP ${s.xp}${next ? ` / ${next}` : ' (max level)'}</div>
    ${next ? `<div class="bar"><i style="width:${Math.min(100, Math.floor(((s.xp - xpToReach(s.level)) * 100) / (next - xpToReach(s.level))))}%"></i></div>` : ''}
    ${statGrid(st)}
    <div class="small dim" style="margin-top:4px">Stats include gear and injuries.</div>

    <h3 style="margin-top:14px">Ability: ${ab.name}</h3><div class="small">${esc(ab.desc)}</div>

    <h3 style="margin-top:14px">Condition</h3>
    <div>${s.injuries.length ? s.injuries.map(i => `<div class="item"><span>${INJURY_BY_ID[i.id].name} <span class="dim small">(${INJURY_BY_ID[i.id].severity === 2 ? 'major: can\'t deploy' : 'minor'})</span></span><span data-until="${i.until}">${timeLeft(i.until)}</span></div>`).join('')
      : s.status === 'mia' ? `<div class="item"><span>Missing in action</span><span data-until="${s.miaUntil}">${timeLeft(s.miaUntil)}</span></div>` : '<span class="good">Healthy</span>'}</div>
    ${cost ? `<button id="heal" style="margin-top:6px" ${S.bucs < cost ? 'disabled' : ''}>Heal now (${cost} BUCs)</button>` : ''}

    <h3 style="margin-top:14px">Perks</h3><div id="perks"></div>
    <h3 style="margin-top:14px">Gear</h3><div id="gear" style="display:grid;gap:6px"></div>

    <h3 style="margin-top:14px">Customize</h3>
    <div class="row">
      <label>Name <input id="nm" value="${esc(s.name)}" maxlength="28"></label>
      <label>Callsign <input id="cs" value="${esc(s.callsign)}" maxlength="16" style="width:110px"></label>
      <label>Sex <select id="sx"><option value="m" ${s.sex === 'm' ? 'selected' : ''}>Male</option><option value="f" ${s.sex === 'f' ? 'selected' : ''}>Female</option></select></label>
      <label>Armor <input type="color" id="c1" value="${s.colors[0]}"></label>
      <label>Accent <input type="color" id="c2" value="${s.colors[1]}"></label>
    </div>
    <div class="row" style="margin-top:6px">${COLOR_PRESETS.map((p, i) => `<button class="preset" data-i="${i}" title="Preset" style="padding:0;width:26px;height:26px;background:linear-gradient(135deg,${p[0]} 50%,${p[1]} 50%)"></button>`).join('')}</div>
    <div class="spread" style="margin-top:16px"><button class="danger" id="dismiss">Dismiss Soldier</button><span class="dim small">Dismissing is permanent. Gear goes back to the Armory.</span></div>
  </div>`);

  // Perks
  const perks = box.querySelector('#perks');
  PERK_LEVELS.forEach((L, tier) => {
    const pair = sp.perks[tier];
    const chosen = s.perks[tier];
    const pending = s.pendingPerks[0] === L;
    if (!chosen && !pending) { perks.append(el(`<div class="small dim">Level ${L}: ${pair.map(p => p.name).join(' or ')}</div>`)); return; }
    const row = el(`<div class="row" style="margin-bottom:6px"><span class="small dim" style="width:52px">Lv ${L}</span></div>`);
    for (const p of pair) {
      const b = el(`<button class="${chosen === p.id ? 'primary' : ''}" ${!pending ? 'disabled' : ''} title="${esc(p.desc)}"><b>${p.name}</b> <span class="small">${esc(p.desc)}</span></button>`);
      if (pending) b.onclick = () => { G.choosePerk(s, p.id); openSoldier(s); render(); };
      row.append(b);
    }
    if (pending) row.append(el('<span class="tag perk">Choose one</span>'));
    perks.append(row);
  });

  // Gear
  const gear = box.querySelector('#gear');
  for (const slot of SLOTS) {
    const cur = s.gear[slot] && G.itemById(s.gear[slot]);
    const opts = S.items.filter(it => ITEM_BY_ID[it.base].slot === slot && G.canWield(s, it))
      .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
    const sel = el(`<select style="flex:1"><option value="">— empty —</option>${opts.map(it => {
      const who = G.equippedBy(it.uid);
      return `<option value="${it.uid}" ${cur && cur.uid === it.uid ? 'selected' : ''}>${esc(itemLabel(it, true))}${who && who !== s ? ` (on ${esc(who.name)})` : ''}</option>`;
    }).join('')}</select>`);
    sel.onchange = () => { G.equip(s, slot, sel.value || null); openSoldier(s); render(); };
    const row = el(`<div class="row"><span style="width:62px" class="dim">${slot[0].toUpperCase() + slot.slice(1)}</span></div>`);
    row.append(sel);
    gear.append(row);
    if (slot === 'weapon') gear.append(el(`<div class="small dim">Can use: ${sp.weapons.join(', ')}</div>`));
  }

  // Customize
  const saveCustom = () => {
    s.name = box.querySelector('#nm').value.trim() || s.name; s.callsign = box.querySelector('#cs').value.trim();
    s.sex = box.querySelector('#sx').value; s.colors = [box.querySelector('#c1').value, box.querySelector('#c2').value];
    G.save(); box.querySelector('.avatar').outerHTML = avatar(s, 56); render();
  };
  for (const id of ['nm', 'cs', 'sx', 'c1', 'c2']) box.querySelector('#' + id).onchange = saveCustom;
  for (const b of box.querySelectorAll('.preset')) b.onclick = () => { const p = COLOR_PRESETS[+b.dataset.i]; box.querySelector('#c1').value = p[0]; box.querySelector('#c2').value = p[1]; saveCustom(); };

  box.querySelector('#x').onclick = closeModal;
  const heal = box.querySelector('#heal'); if (heal) heal.onclick = () => { if (G.healNow(s)) { toast(`${s.name} is patched up.`); openSoldier(s); render(); } };
  box.querySelector('#dismiss').onclick = () => {
    if (!confirm(`Dismiss ${s.name}? This can't be undone.`)) return;
    G.dismiss(s); closeModal(); render();
  };
  modal(box);
}

// ---------- Armory ----------
function renderArmory() {
  const S = G.state();
  const wrap = el(`<div><h2>Armory</h2><div class="dim section">${S.items.length} items. Equip gear from a Soldier's page in the Barracks.</div><div id="list" style="display:grid;gap:6px;max-width:900px"></div></div>`);
  const list = wrap.querySelector('#list');
  const items = S.items.slice().sort((a, b) => SLOTS.indexOf(ITEM_BY_ID[a.base].slot) - SLOTS.indexOf(ITEM_BY_ID[b.base].slot) || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
  for (const it of items) {
    const who = G.equippedBy(it.uid);
    list.append(el(`<div class="item"><span>${itemLabel(it)} <span class="dim small">${ITEM_BY_ID[it.base].slot}</span>${ITEM_BY_ID[it.base].flavor ? `<div class="small dim"><i>${esc(ITEM_BY_ID[it.base].flavor)}</i></div>` : ''}</span><span class="dim small">${who ? 'on ' + esc(who.name) : 'unequipped'}</span></div>`));
  }
  panel.append(wrap);
}

// ---------- Mission log ----------
function renderLog() {
  const S = G.state();
  const wrap = el(`<div><h2>Mission Log</h2><div class="dim section">Last ${S.history.length} missions. Replays re-run the exact same mission from its seed.</div><div id="list" style="display:grid;gap:8px;max-width:900px"></div></div>`);
  const list = wrap.querySelector('#list');
  if (!S.history.length) list.append(el('<div class="dim">No missions yet. Head to Deploy.</div>'));
  for (const h of S.history) {
    const kia = h.soldiers.filter(x => x.fate === 'kia').length;
    const row = el(`<div class="card"><div class="spread"><div><b class="result-${h.result}">${{ success: 'SHIP TAKEN', retreat: 'RETREAT', wipe: 'SQUAD LOST' }[h.result]}</b> · ${esc(h.shipName)}
      <div class="small dim">${new Date(h.at).toLocaleString()} · ${h.entry} · ${h.tactic} · +${h.bucs} BUCs${kia ? ` · <span class="bad">${kia} KIA</span>` : ''}</div></div>
      ${h.input ? '<button>Watch replay</button>' : ''}</div></div>`);
    const b = row.querySelector('button'); if (b) b.onclick = () => replayMission(panel, h);
    list.append(row);
  }
  panel.append(wrap);
}

// ---------- Memorial ----------
function renderMemorial() {
  const S = G.state();
  const wrap = el(`<div><h2>Memorial Wall</h2><div class="dim section">They went in first so the rest could come home.</div><div class="grid" id="list"></div></div>`);
  const list = wrap.querySelector('#list');
  if (!S.memorial.length) list.append(el('<div class="dim">No one has fallen. Yet.</div>'));
  for (const m of S.memorial) list.append(el(`<div class="card"><div class="soldier-head">${avatar(m)}<div><div class="name">${esc(m.name)} ${m.callsign ? `<span class="callsign">"${esc(m.callsign)}"</span>` : ''}</div>
    <div class="small dim">${SPECIALTY_BY_ID[m.specialty].name} · Lv ${m.level} · ${m.missions} missions · ${m.kills} kills</div>
    <div class="small">Fell on the ${esc(m.diedOn)}, ${new Date(m.diedAt).toLocaleDateString()}${m.gearLost ? ' · <span class="bad">left aboard, gear lost</span>' : ''}</div></div></div></div>`));
  panel.append(wrap);
}

render();
