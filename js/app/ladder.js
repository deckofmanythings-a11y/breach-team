// Ladder tab: the current 72-hour Contract, its leaderboard (with replays), and the career board.
import * as api from './api.js';
import { el, esc, toast } from './ui.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { FACTION_BY_ID } from '../data/factions.js';
import { ENTRY_BY_ID } from '../data/entries.js';
import { TACTIC_BY_ID } from '../data/tactics.js';
import { SCORE, CAREER_COLUMNS } from '../game/ladder.js';
import { simulate } from '../engine/battle.js';
import { rollAftermath } from '../engine/aftermath.js';
import { engineCompatible } from '../data/version.js';
import { playMission } from './mission.js?v=7';

let sortBy = 'successes';

function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : `${h}h ${m}m`;
}
const RESULT = { success: '<span class="good">Taken</span>', retreat: '<span class="warn">Retreat</span>', wipe: '<span class="bad">Lost</span>' };

export async function renderLadder(panel, { boardContract }) {
  const wrap = el('<div><h2>Ladder</h2><div class="dim">Loading…</div></div>');
  panel.append(wrap);
  let c, l;
  try { [c, l] = await Promise.all([api.call('contract'), api.call('ladder')]); }
  catch (e) { wrap.innerHTML = `<h2>Ladder</h2><div class="bad">Couldn't load the ladder: ${esc(e.message)}</div>`; return; }
  const k = c.contract, ship = SHIP_BY_ID[k.ship], fac = FACTION_BY_ID[ship.faction];
  wrap.innerHTML = `
    <h2>Ladder</h2>
    <div class="card section" style="max-width:900px">
      <div class="spread"><div><h3 style="margin:0">72-Hour Contract · ${esc(ship.name)}</h3>
        <div class="small">${'★'.repeat(ship.tier)}${'☆'.repeat(3 - ship.tier)} · ${esc(fac.name)} · ends in <b>${countdown(k.endsAt - Date.now())}</b> (resets midnight Pacific, every 3 days)</div></div>
        <button class="primary" id="board">Board the Contract</button></div>
      <div class="small dim" style="margin-top:6px">${esc(ship.desc)}</div>
      <div class="small" style="margin-top:8px">Every commander boards the <b>same ship on the same map</b> for 72 hours; you pick the squad, entry, tactic and retreat. Your best run counts. It's a real mission: normal rewards, and Soldiers can die.</div>
      <div class="small dim" style="margin-top:6px">Score: take the ship +${SCORE.success} (+${SCORE.speedPerSec} per second under 90 s) · optional objective +${SCORE.objective} · kill +${SCORE.kill} · Soldier Downed ${SCORE.downed} · left aboard ${SCORE.left} · killed ${SCORE.kia}</div>
      ${c.mine ? `<div style="margin-top:8px">Your best: <b>${c.mine.score}</b> (rank ${c.mine.rank} of ${c.board.length}, ${c.mine.runs} run${c.mine.runs > 1 ? 's' : ''})</div>` : '<div style="margin-top:8px" class="dim">You haven\'t run this contract yet.</div>'}
    </div>
    <div class="section" style="max-width:900px"><h3>This contract's leaderboard</h3>
      ${c.board.length ? `<table class="rep"><tr><th>#</th><th>Commander</th><th>Score</th><th>Result</th><th>Lost</th><th>Plan</th><th></th></tr>
        ${c.board.map(b => `<tr${b.me ? ' style="background:#1a2a12"' : ''}><td>${b.rank}</td><td><b>${esc(b.name)}</b>${b.me ? ' <span class="small dim">(you)</span>' : ''}<div class="small dim">${b.runs} run${b.runs > 1 ? 's' : ''}</div></td>
          <td><b>${b.score}</b></td><td>${RESULT[b.result] || esc(b.result)}</td><td>${b.kia ? `<span class="bad">${b.kia}</span>` : '0'}</td>
          <td class="small">${b.squad} · ${esc(ENTRY_BY_ID[b.entry]?.name || b.entry)} · ${esc(TACTIC_BY_ID[b.tactic]?.name || b.tactic)}</td>
          <td><button data-watch="${b.mission}">Watch</button></td></tr>`).join('')}</table>`
      : '<div class="dim">Nobody has run this contract yet. Be the first.</div>'}
    </div>
    <div class="section" style="max-width:900px"><div class="spread"><h3>Career board</h3>
      <label class="small">Sort by <select id="sort">${CAREER_COLUMNS.map(cl => `<option value="${cl.id}" ${cl.id === sortBy ? 'selected' : ''}>${cl.name}</option>`).join('')}</select></label></div>
      <div id="career"></div></div>`;

  const drawCareer = () => {
    const rows = l.rows.slice().sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0) || (b.successes || 0) - (a.successes || 0));
    wrap.querySelector('#career').innerHTML = `<table class="rep"><tr><th>#</th><th>Commander</th>${CAREER_COLUMNS.map(cl => `<th${cl.id === sortBy ? ' style="color:var(--accent)"' : ''}>${cl.name}</th>`).join('')}</tr>
      ${rows.map((r, i) => `<tr${r.me ? ' style="background:#1a2a12"' : ''}><td>${i + 1}</td><td><b>${esc(r.name)}</b></td>${CAREER_COLUMNS.map(cl => `<td>${(r[cl.id] || 0).toLocaleString()}</td>`).join('')}</tr>`).join('')}</table>`;
  };
  drawCareer();
  wrap.querySelector('#sort').onchange = (e) => { sortBy = e.target.value; drawCareer(); };
  wrap.querySelector('#board').onclick = () => boardContract(k);
  wrap.onclick = async (e) => {
    const w = e.target.closest('[data-watch]'); if (!w) return;
    w.disabled = true;
    try { await watch(panel, +w.dataset.watch); } catch (er) { toast(er.message); w.disabled = false; }
  };
}

// Re-simulate someone's contract run from its stored input and play it back.
async function watch(panel, missionId) {
  const { replay } = await api.call('replay', { mission: missionId });
  if (!engineCompatible(replay.engine_version)) throw new Error('That run was made on an older engine and can\'t be replayed.');
  const input = replay.input;
  const battle = simulate(input);
  if (battle.hash !== replay.hash) toast('Note: this replay doesn\'t exactly match the recorded run.');
  const after = rollAftermath(battle, input.squad, input.mothership);
  const ship = SHIP_BY_ID[input.ship];
  const report = {
    shipName: `${ship.name} (${replay.name}'s contract run, ${replay.score} pts)`, bucs: after.bucs, ...(after.timeBonus?.bucs ? { timeBonus: after.timeBonus } : {}), input, extras: [],
    colors: Object.fromEntries(input.squad.map(s => [s.uid, s.colors || ['#3a5a8c', '#f2c14e']])),
    soldiers: after.soldiers.map((a, i) => ({ uid: a.uid, name: input.squad[i].name, specialty: input.squad[i].specialty, state: a.state, fate: a.fate,
      kiaChance: a.kiaChance, xp: a.xp, injuries: a.injuries, kills: battle.soldiers[i].kills, levelUps: [] })),
  };
  panel.innerHTML = '';
  playMission(panel, battle, report, report.colors, true);
}
