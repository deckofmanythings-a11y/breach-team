// Pre-mission: target ship, entry, squad, tactic, retreat plan. Then launch.
import * as G from './state.js?v=3';
import { el, esc, avatar, toast } from './ui.js';
import { levelBadge } from './badges.js';
import { SHIPS, SHIP_BY_ID } from '../data/ships.js';
import { ENTRIES, RETREATS, ENTRY_BY_ID } from '../data/entries.js';
import { TACTICS } from '../data/tactics.js';
import { FACTION_BY_ID } from '../data/factions.js';
import { SPECIALTY_BY_ID } from '../data/specialties.js';
import { simulate } from '../engine/battle.js';
import * as api from './api.js';
import { playMission } from './mission.js?v=8';
import { holdCreds } from './creds-view.js';
import { mothershipInput, entryMaxSquad } from '../data/mothership-rooms.js';
import { SUICIDE_SQUAD, isSuicideSquad } from '../data/suicide-squad.js';
import { intelPanel } from './intel-view.js?v=4';

const LAST = 'bt_last_deploy';
let pick = null;
// 72-hour Contract mode: the ship (and map) are fixed by the contract period; set from the Ladder tab.
let contractMode = null;
export const setContract = (c) => { contractMode = c; };

function loadPick() {
  if (pick) return pick;
  try { pick = JSON.parse(localStorage.getItem(LAST)); } catch { pick = null; }
  pick = { ship: 'hauler', entry: 'shuttle', tactic: 'balanced', retreat: 'teleport_recall', squad: [], ...(pick || {}) };
  return pick;
}

export function renderDeploy(panel) {
  const p = loadPick();
  const S = G.state();
  // Suicide Squad stays hidden until the roster has a Soldier who could join one.
  const ssUnlocked = G.state().soldiers.some(s => s.level >= SUICIDE_SQUAD.unlockLevel);
  if (!ssUnlocked && isSuicideSquad(p.retreat)) p.retreat = 'teleport_recall';
  const retreats = RETREATS.filter(r => ssUnlocked || !r.noRetreat);
  const msEntry = mothershipInput(S)?.entry;
  const maxOf = (e) => entryMaxSquad(e, msEntry);   // Hangar L3 adds a seat
  const suicide = isSuicideSquad(p.retreat);
  // What the Mothership rooms do for each entry (Teleporter Array, Pod Bay, Infiltration Suite).
  const entryPerks = (e) => {
    const m = msEntry || {}, t = [];
    if (e.id === 'teleport' && m.teleportFailPct) t.push(m.teleportFailPct <= -100 ? 'no misfires' : `${-m.teleportFailPct}% fewer misfires`);
    if (e.id === 'breach_pod') { if (m.podClose) t.push('can land next to the Bridge'); if (m.podShock) t.push('impact stuns the next rooms'); }
    if (e.id === 'vent_crawl') { if (m.ventClose) t.push('comes out closer to the Bridge'); if (m.ventAmbush) t.push('shots from hiding always crit'); }
    return t.length ? `<div class="small good" style="margin-top:4px">Mothership: ${t.join(' · ')}</div>` : '';
  };
  const shipTier = SHIP_BY_ID[contractMode ? contractMode.ship : p.ship]?.tier ?? 1;
  const tooEasy = shipTier < SUICIDE_SQUAD.minTier;
  const eligible = (s) => !suicide || s.level >= SUICIDE_SQUAD.minLevel;
  const ready = S.soldiers.filter(G.canDeploy);
  p.squad = p.squad.filter(id => ready.some(s => s.uid === id && eligible(s)));
  const entry = ENTRY_BY_ID[p.entry];
  if (p.squad.length > maxOf(entry)) p.squad = p.squad.slice(0, maxOf(entry));
  if (!p.squad.length) p.squad = ready.filter(eligible).sort((a, b) => b.level - a.level).slice(0, maxOf(entry)).map(s => s.uid);

  const optCards = (list, key, body) => `<div class="opt">${list.map(o => `<div class="card click ${p[key] === o.id ? 'sel' : ''}${o.noRetreat ? ' suicide' : ''}" data-k="${key}" data-v="${o.id}"><h4>${o.noRetreat ? '☠ ' : ''}${o.name}</h4>${body(o)}</div>`).join('')}</div>`;
  const retreatBody = (r) => `<div class="small dim">${esc(r.desc)}</div>` + (r.noRetreat ? `
    <div class="small" style="margin-top:4px">Level <b>${SUICIDE_SQUAD.minLevel}+</b> Soldiers only · ${'★'.repeat(SUICIDE_SQUAD.minTier)} ships and up</div>
    <div class="small" style="margin-top:2px">Pays <b style="color:var(--accent)">${SUICIDE_SQUAD.rewardPct}%</b> of the normal reward, and survivors earn <b>+${SUICIDE_SQUAD.xpBonusPct}%</b> XP. The crew knows you can't leave: full alarm from the start, a bigger crew and more reinforcements.</div>` : '');
  const wrap = el(`<div>
    <h2>Deploy</h2>
    ${contractMode ? `<div class="section banner info"><h3 style="margin:0">1 · 72-Hour Contract: ${esc(contractMode.shipName)}</h3><div class="small">Same ship and map for every commander for 72 hours. Your best score goes on the Ladder. <a href="#" id="nocontract">Cancel contract</a></div></div>` : `<div class="section"><h3>1 · Target ship</h3>${optCards(SHIPS, 'ship', s => `
      <div class="small">${'★'.repeat(s.tier)}${'☆'.repeat(3 - s.tier)} · ${FACTION_BY_ID[s.faction].name}</div>
      <div class="small dim">${esc(s.desc)}</div><div class="small" style="margin-top:4px">Reward <b style="color:var(--accent)">${s.reward}</b> BUCs</div>`)}</div>`}
    <div class="section"><h3>2 · Entry</h3>${optCards(ENTRIES, 'entry', e => `<div class="small">Squad of up to <b>${maxOf(e)}${maxOf(e) > e.maxSquad ? ' <span class="small good" title="Mothership upgrade">(+Mothership)</span>' : ''}</b></div><div class="small dim">${esc(e.desc)}</div>${entryPerks(e)}`)}</div>
    <div class="section"><h3>3 · Squad <span class="dim small" id="count"></span></h3><div class="grid" id="squad"></div>
      <div class="card march" id="march" style="margin-top:8px"></div></div>
    <div class="section"><h3>4 · Tactic</h3>${optCards(TACTICS, 'tactic', t => `<div class="small dim">${esc(t.desc)}</div><div class="small" style="margin-top:4px">${suicide ? 'Suicide Squad: never retreats' : `Retreats at ${t.retreatAt}% casualties`}</div>`)}</div>
    <div class="section"><h3>5 · Retreat plan</h3>${optCards(retreats, 'retreat', retreatBody)}
      <div class="small dim" style="margin-top:6px">${suicide ? `<span class="bad"><b>No retreat.</b> The squad fights until it takes the bridge or nobody is left standing, with a 3-minute hard limit. If it fails, every Soldier deployed dies and their gear is lost.</span>` : `The retreat happens automatically if casualties pass your tactic's limit, or when the 90-second mission clock runs out. The clock pauses while anyone is on the bridge, and a squad that's winning when time runs out can dig in for more time: the higher its Grit, the better its chances.`}</div></div>
    <div class="launchbar"><span class="small" id="warn"></span><span class="dim small">Permadeath is on: any Soldier who goes Down can die, on any ship.</span><button class="primary" id="go">Launch boarding action</button></div>
  </div>`);

  const ip = contractMode ? null : intelPanel(S, p.ship, suicide);   // Intel Room scouting
  if (ip) wrap.querySelector('.section').append(ip);
  for (const c of wrap.querySelectorAll('.card[data-k]')) c.onclick = () => { p[c.dataset.k] = c.dataset.v; persist(); renderDeploy(panel.replaceChildren() || panel); };

  const sq = wrap.querySelector('#squad');
  if (!ready.length) sq.append(el('<div class="dim">Nobody is fit to deploy. Wait for injuries to heal, pay to heal them in the Barracks, or hire a Rookie.</div>'));
  for (const s of ready) {
    const on = p.squad.includes(s.uid);
    if (!eligible(s)) { sq.append(el(`<div class="card off" title="Suicide Squads take Level ${SUICIDE_SQUAD.minLevel}+ only"><div class="soldier-head">${avatar(s, 36)}${levelBadge(s.level, (s.colors || [])[1], 'sm')}<div><div class="name">${esc(s.name)}</div>
      <div class="small dim">Level ${SUICIDE_SQUAD.minLevel}+ only</div></div></div></div>`)); continue; }
    const c = el(`<div class="card click ${on ? 'sel' : ''}">${on ? `<span class="tag march-no" title="Marching order">#${p.squad.indexOf(s.uid) + 1}</span>` : ''}<div class="soldier-head">${avatar(s, 36)}${levelBadge(s.level, (s.colors || [])[1], 'sm')}<div><div class="name">${esc(s.name)}</div>
      <div class="small dim">${SPECIALTY_BY_ID[s.specialty].name}${G.condition(s) === 'wounded' ? ' · <span class="warn">wounded</span>' : ''}</div></div></div></div>`);
    c.onclick = () => {
      if (on) p.squad = p.squad.filter(id => id !== s.uid);
      else if (p.squad.length < maxOf(entry)) p.squad.push(s.uid);
      else { toast(`${entry.name} carries at most ${maxOf(entry)}.`); return; }
      persist(); renderDeploy(panel.replaceChildren() || panel);
    };
    sq.append(c);
  }
  // Marching order: the order of p.squad is the order the squad moves in (engine v8). #1 is the point
  // man: spawns closest to the Bridge and leads; nobody overtakes the Soldier ahead of them.
  const march = wrap.querySelector('#march');
  const redraw = () => { persist(); renderDeploy(panel.replaceChildren() || panel); };
  if (p.squad.length > 1) {
    march.innerHTML = `<div class="spread"><b>Marching order</b><button class="small" id="toughFirst" title="Highest HP + Armour up front, Medics at the back">Toughest first</button></div>
      <div class="small dim" style="margin:2px 0 6px">#1 is the point man: lands closest to the Bridge and leads the way, so they usually draw first fire. Nobody overtakes the Soldier ahead of them.</div>`;
    p.squad.forEach((id, i) => {
      const s = G.soldierById(id); if (!s) return;
      const row = el(`<div class="row march-row"><b style="width:24px">#${i + 1}</b>${avatar(s, 24)}<span style="flex:1">${esc(s.name)} <span class="small dim">${SPECIALTY_BY_ID[s.specialty].name}${i === 0 ? ' · point' : i === p.squad.length - 1 ? ' · rear' : ''}</span></span>
        <button class="small" data-mv="-1" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button><button class="small" data-mv="1" ${i === p.squad.length - 1 ? 'disabled' : ''} title="Move down">▼</button></div>`);
      for (const b of row.querySelectorAll('[data-mv]')) b.onclick = () => { const j = i + +b.dataset.mv; [p.squad[i], p.squad[j]] = [p.squad[j], p.squad[i]]; redraw(); };
      march.append(row);
    });
    march.querySelector('#toughFirst').onclick = () => {
      const score = (id) => { const s = G.soldierById(id), st = G.effectiveStats(s); return (s.specialty === 'medic' ? -1000 : 0) + st.hp + st.arm * 2; };
      p.squad = p.squad.slice().sort((a, b) => score(b) - score(a)); redraw();
    };
  } else march.remove();
  const unavailable = S.soldiers.length - ready.length;
  wrap.querySelector('#count').textContent = `${p.squad.length}/${maxOf(entry)} selected${unavailable ? ` · ${unavailable} recovering or missing` : ''}`;

  const small = Math.min(3, maxOf(entry));
  if (p.squad.length && p.squad.length < small) wrap.querySelector('#warn').innerHTML = `<span class="warn">⚠ Only ${p.squad.length} Soldier${p.squad.length > 1 ? 's' : ''}: a squad this small is in serious danger.</span>`;
  if (suicide && tooEasy) wrap.querySelector('#warn').innerHTML = `<span class="warn">⚠ A Suicide Squad needs a ${'★'.repeat(SUICIDE_SQUAD.minTier)} ship or better. Pick a tougher target or another retreat plan.</span>`;
  else if (suicide && p.squad.length) wrap.querySelector('#warn').innerHTML = `<span class="bad">☠ No retreat: if this fails, all ${p.squad.length} die and their gear is lost.</span>`;
  const go = wrap.querySelector('#go');
  go.disabled = !p.squad.length || (suicide && tooEasy);
  go.onclick = () => launch(panel);
  const nc = wrap.querySelector('#nocontract'); if (nc) nc.onclick = (e) => { e.preventDefault(); contractMode = null; renderDeploy(panel.replaceChildren() || panel); };
  if (contractMode) go.textContent = 'Launch contract run';
  if (suicide) { go.textContent = contractMode ? 'Launch contract run (no retreat)' : 'Launch Suicide Squad'; go.classList.add('danger'); }
  panel.append(wrap);
}

function persist() { localStorage.setItem(LAST, JSON.stringify(pick)); }

async function launch(panel) {
  const p = pick;
  if (isSuicideSquad(p.retreat) && !confirm(`Send ${p.squad.length} Soldier${p.squad.length > 1 ? 's' : ''} as a Suicide Squad?

There is no retreat. If the mission fails, every one of them dies and their gear is lost.`)) return;
  const go = document.getElementById('go'); if (go) { go.disabled = true; go.textContent = 'Launching…'; }
  let r;
  try { r = await api.call('deploy', { plan: { ship: p.ship, contract: !!contractMode, entry: p.entry, tactic: p.tactic, retreat: p.retreat, squad: p.squad } }); contractMode = null; }
  catch (e) { toast(e.message); if (go) { go.disabled = false; go.textContent = 'Launch boarding action'; } return; }
  // The server fought the mission and saved the result. Hide the BUCs until playback ends,
  // then re-simulate from the server's input and check we got the same mission.
  const dz = r.report.defense;   // a Mothership defense fought straight after: hide its result too
  holdCreds(r.report.creds + (dz?.creds || 0));
  G.holdBucs(r.report.bucs + (dz ? dz.bucs - dz.stolen : 0));
  G.setFrom(r);
  const battle = simulate(r.report.input);
  if (battle.hash !== r.report.hash) toast('Warning: this replay doesn\'t match the server result. Please report it.');
  playMission(panel, battle, r.report, r.report.colors || {});
}
