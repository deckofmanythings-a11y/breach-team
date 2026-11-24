// Pre-mission: target ship, entry, squad, tactic, retreat plan. Then launch.
import * as G from './state.js';
import { el, esc, avatar, toast } from './ui.js';
import { SHIPS, SHIP_BY_ID } from '../data/ships.js';
import { ENTRIES, RETREATS, ENTRY_BY_ID } from '../data/entries.js';
import { TACTICS } from '../data/tactics.js';
import { FACTION_BY_ID } from '../data/factions.js';
import { SPECIALTY_BY_ID } from '../data/specialties.js';
import { simulate } from '../engine/battle.js';
import { rollAftermath } from '../engine/aftermath.js';
import { randomSeed } from '../engine/rng.js';
import { playMission } from './mission.js';

const LAST = 'bt_last_deploy';
let pick = null;

function loadPick() {
  if (pick) return pick;
  try { pick = JSON.parse(localStorage.getItem(LAST)); } catch { pick = null; }
  pick = { ship: 'hauler', entry: 'shuttle', tactic: 'balanced', retreat: 'teleport_recall', squad: [], ...(pick || {}) };
  return pick;
}

export function renderDeploy(panel) {
  const p = loadPick();
  const S = G.state();
  const ready = S.soldiers.filter(G.canDeploy);
  p.squad = p.squad.filter(id => ready.some(s => s.uid === id));
  const entry = ENTRY_BY_ID[p.entry];
  if (p.squad.length > entry.maxSquad) p.squad = p.squad.slice(0, entry.maxSquad);
  if (!p.squad.length) p.squad = ready.slice().sort((a, b) => b.level - a.level).slice(0, entry.maxSquad).map(s => s.uid);

  const optCards = (list, key, body) => `<div class="opt">${list.map(o => `<div class="card click ${p[key] === o.id ? 'sel' : ''}" data-k="${key}" data-v="${o.id}"><h4>${o.name}</h4>${body(o)}</div>`).join('')}</div>`;
  const wrap = el(`<div>
    <h2>Deploy</h2>
    <div class="section"><h3>1 · Target ship</h3>${optCards(SHIPS, 'ship', s => `
      <div class="small">${'★'.repeat(s.tier)}${'☆'.repeat(3 - s.tier)} · ${FACTION_BY_ID[s.faction].name}</div>
      <div class="small dim">${esc(s.desc)}</div><div class="small" style="margin-top:4px">Reward <b style="color:var(--accent)">${s.reward}</b> BUCs</div>`)}</div>
    <div class="section"><h3>2 · Entry</h3>${optCards(ENTRIES, 'entry', e => `<div class="small">Squad of up to <b>${e.maxSquad}</b></div><div class="small dim">${esc(e.desc)}</div>`)}</div>
    <div class="section"><h3>3 · Squad <span class="dim small" id="count"></span></h3><div class="grid" id="squad"></div></div>
    <div class="section"><h3>4 · Tactic</h3>${optCards(TACTICS, 'tactic', t => `<div class="small dim">${esc(t.desc)}</div><div class="small" style="margin-top:4px">Retreats at ${t.retreatAt}% casualties</div>`)}</div>
    <div class="section"><h3>5 · Retreat plan</h3>${optCards(RETREATS, 'retreat', r => `<div class="small dim">${esc(r.desc)}</div>`)}
      <div class="small dim" style="margin-top:6px">The retreat happens automatically if casualties pass your tactic's limit, or if the bridge isn't taken in 90 seconds.</div></div>
    <div class="launchbar"><span class="small" id="warn"></span><span class="dim small">Permadeath is on: any Soldier who goes Down can die, on any ship.</span><button class="primary" id="go">Launch boarding action</button></div>
  </div>`);

  for (const c of wrap.querySelectorAll('.card[data-k]')) c.onclick = () => { p[c.dataset.k] = c.dataset.v; persist(); renderDeploy(panel.replaceChildren() || panel); };

  const sq = wrap.querySelector('#squad');
  if (!ready.length) sq.append(el('<div class="dim">Nobody is fit to deploy. Wait for injuries to heal, pay to heal them in the Barracks, or hire a Rookie.</div>'));
  for (const s of ready) {
    const on = p.squad.includes(s.uid);
    const c = el(`<div class="card click ${on ? 'sel' : ''}"><div class="soldier-head">${avatar(s, 36)}<div><div class="name">${esc(s.name)}</div>
      <div class="small dim">${SPECIALTY_BY_ID[s.specialty].name} · Lv ${s.level}${G.condition(s) === 'wounded' ? ' · <span class="warn">wounded</span>' : ''}</div></div></div></div>`);
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
  const go = wrap.querySelector('#go');
  go.disabled = !p.squad.length;
  go.onclick = () => launch(panel);
  panel.append(wrap);
}

function persist() { localStorage.setItem(LAST, JSON.stringify(pick)); }

function launch(panel) {
  const p = pick;
  const squadSoldiers = p.squad.map(G.soldierById).filter(Boolean);
  const input = { seed: randomSeed(), ship: p.ship, entry: p.entry, tactic: p.tactic, retreat: p.retreat, squad: squadSoldiers.map(G.engineSoldier) };
  const battle = simulate(input);
  const after = rollAftermath(battle, input.squad);
  // Apply results now (held back on screen until playback ends), so a refresh can't undo a death.
  const colors = Object.fromEntries(squadSoldiers.map(s => [s.uid, s.colors]));
  const report = G.applyMission(input, battle, after, SHIP_BY_ID[p.ship].name);
  playMission(panel, battle, report, colors);
}
