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
import { playMission } from './mission.js?v=4';
import { SUICIDE_SQUAD, isSuicideSquad } from '../data/suicide-squad.js';

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
  const suicide = isSuicideSquad(p.retreat);
  const shipTier = SHIP_BY_ID[contractMode ? contractMode.ship : p.ship]?.tier ?? 1;
  const tooEasy = shipTier < SUICIDE_SQUAD.minTier;
  const eligible = (s) => !suicide || s.level >= SUICIDE_SQUAD.minLevel;
  const ready = S.soldiers.filter(G.canDeploy);
  p.squad = p.squad.filter(id => ready.some(s => s.uid === id && eligible(s)));
  const entry = ENTRY_BY_ID[p.entry];
  if (p.squad.length > entry.maxSquad) p.squad = p.squad.slice(0, entry.maxSquad);
  if (!p.squad.length) p.squad = ready.filter(eligible).sort((a, b) => b.level - a.level).slice(0, entry.maxSquad).map(s => s.uid);

  const optCards = (list, key, body) => `<div class="opt">${list.map(o => `<div class="card click ${p[key] === o.id ? 'sel' : ''}${o.noRetreat ? ' suicide' : ''}" data-k="${key}" data-v="${o.id}"><h4>${o.noRetreat ? '☠ ' : ''}${o.name}</h4>${body(o)}</div>`).join('')}</div>`;
  const retreatBody = (r) => `<div class="small dim">${esc(r.desc)}</div>` + (r.noRetreat ? `
    <div class="small" style="margin-top:4px">Level <b>${SUICIDE_SQUAD.minLevel}+</b> Soldiers only · ${'★'.repeat(SUICIDE_SQUAD.minTier)} ships and up</div>
    <div class="small" style="margin-top:2px">Pays <b style="color:var(--accent)">${SUICIDE_SQUAD.rewardPct}%</b> of the normal reward, and survivors earn <b>+${SUICIDE_SQUAD.xpBonusPct}%</b> XP. The crew knows you can't leave: full alarm from the start, a bigger crew and more reinforcements.</div>` : '');
  const wrap = el(`<div>
    <h2>Deploy</h2>
    ${contractMode ? `<div class="section banner info"><h3 style="margin:0">1 · 72-Hour Contract: ${esc(contractMode.shipName)}</h3><div class="small">Same ship and map for every commander for 72 hours. Your best score goes on the Ladder. <a href="#" id="nocontract">Cancel contract</a></div></div>` : `<div class="section"><h3>1 · Target ship</h3>${optCards(SHIPS, 'ship', s => `
      <div class="small">${'★'.repeat(s.tier)}${'☆'.repeat(3 - s.tier)} · ${FACTION_BY_ID[s.faction].name}</div>
      <div class="small dim">${esc(s.desc)}</div><div class="small" style="margin-top:4px">Reward <b style="color:var(--accent)">${s.reward}</b> BUCs</div>`)}</div>`}
    <div class="section"><h3>2 · Entry</h3>${optCards(ENTRIES, 'entry', e => `<div class="small">Squad of up to <b>${e.maxSquad}</b></div><div class="small dim">${esc(e.desc)}</div>`)}</div>
    <div class="section"><h3>3 · Squad <span class="dim small" id="count"></span></h3><div class="grid" id="squad"></div></div>
    <div class="section"><h3>4 · Tactic</h3>${optCards(TACTICS, 'tactic', t => `<div class="small dim">${esc(t.desc)}</div><div class="small" style="margin-top:4px">${suicide ? 'Suicide Squad: never retreats' : `Retreats at ${t.retreatAt}% casualties`}</div>`)}</div>
    <div class="section"><h3>5 · Retreat plan</h3>${optCards(retreats, 'retreat', retreatBody)}
      <div class="small dim" style="margin-top:6px">${suicide ? `<span class="bad"><b>No retreat.</b> The squad fights until it takes the bridge or nobody is left standing, with a 3-minute hard limit. If it fails, every Soldier deployed dies and their gear is lost.</span>` : `The retreat happens automatically if casualties pass your tactic's limit, or when the 90-second mission clock runs out. The clock pauses while anyone is on the bridge, and a squad that's winning when time runs out can dig in for more time: the higher its Grit, the better its chances.`}</div></div>
    <div class="launchbar"><span class="small" id="warn"></span><span class="dim small">Permadeath is on: any Soldier who goes Down can die, on any ship.</span><button class="primary" id="go">Launch boarding action</button></div>
  </div>`);

  for (const c of wrap.querySelectorAll('.card[data-k]')) c.onclick = () => { p[c.dataset.k] = c.dataset.v; persist(); renderDeploy(panel.replaceChildren() || panel); };

  const sq = wrap.querySelector('#squad');
  if (!ready.length) sq.append(el('<div class="dim">Nobody is fit to deploy. Wait for injuries to heal, pay to heal them in the Barracks, or hire a Rookie.</div>'));
  for (const s of ready) {
    const on = p.squad.includes(s.uid);
    if (!eligible(s)) { sq.append(el(`<div class="card off" title="Suicide Squads take Level ${SUICIDE_SQUAD.minLevel}+ only"><div class="soldier-head">${avatar(s, 36)}${levelBadge(s.level, (s.colors || [])[1], 'sm')}<div><div class="name">${esc(s.name)}</div>
      <div class="small dim">Level ${SUICIDE_SQUAD.minLevel}+ only</div></div></div></div>`)); continue; }
    const c = el(`<div class="card click ${on ? 'sel' : ''}"><div class="soldier-head">${avatar(s, 36)}${levelBadge(s.level, (s.colors || [])[1], 'sm')}<div><div class="name">${esc(s.name)}</div>
      <div class="small dim">${SPECIALTY_BY_ID[s.specialty].name}${G.condition(s) === 'wounded' ? ' · <span class="warn">wounded</span>' : ''}</div></div></div></div>`);
    c.onclick = () => {
      if (on) p.squad = p.squad.filter(id => id !== s.uid);
      else if (p.squad.length < entry.maxSquad) p.squad.push(s.uid);
      else { toast(`${entry.name} carries at most ${entry.maxSquad}.`); return; }
      persist(); renderDeploy(panel.replaceChildren() || panel);
    };
    sq.append(c);
  }
  const unavailable = S.soldiers.length - ready.length;
  wrap.querySelector('#count').textContent = `${p.squad.length}/${entry.maxSquad} selected${unavailable ? ` · ${unavailable} recovering or missing` : ''}`;

  const small = Math.min(3, entry.maxSquad);
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
  G.holdBucs(r.report.bucs);
  G.setFrom(r);
  const battle = simulate(r.report.input);
  if (battle.hash !== r.report.hash) toast('Warning: this replay doesn\'t match the server result. Please report it.');
  playMission(panel, battle, r.report, r.report.colors || {});
}
