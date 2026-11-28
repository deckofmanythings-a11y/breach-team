// Landing page (Home), the Game Over screen, and the face strip on the sign-in page.
import * as api from './api.js';
import * as G from './state.js?v=3';
import { el, esc, toast, modal, closeModal } from './ui.js';
import { CHANGELOG } from './changelog.js';
import { SPECIALTIES, SPECIALTY_BY_ID } from '../data/specialties.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { COLOR_PRESETS } from '../data/economy.js';
import { LOOK_COUNT } from '../data/looks.js';
import { memorialBadges } from './memorial-badge.js';

// A big square portrait tile (filled in by js/render/portrait.js).
export function portraitTile(s, cls = '') {
  const [a] = s.colors || ['#3a5a8c'];
  return `<div class="portrait ${cls}" data-tok="1" data-spec="${s.specialty}" data-sex="${s.sex === 'f' ? 'f' : 'm'}" data-look="${s.look || 0}"${s.portrait ? ` data-portrait="${s.portrait}"` : ''} data-a="${a}" style="--sa:${a}"></div>`;
}

// Sign-in page: a strip of random Soldiers, every face different.
export function faceStrip(n = 8) {
  const looks = [...Array(LOOK_COUNT).keys()].sort(() => Math.random() - 0.5);
  const out = [];
  for (let i = 0; i < n; i++) {
    const sp = SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
    out.push(portraitTile({ specialty: sp.id, sex: Math.random() < 0.5 ? 'm' : 'f', look: looks[i % looks.length], colors: COLOR_PRESETS[i % COLOR_PRESETS.length] }, 'face'));
  }
  return `<div class="face-strip">${out.join('')}</div>`;
}

const RESULT = { success: '<b class="result-success">SHIP TAKEN</b>', retreat: '<b class="result-retreat">RETREAT</b>', wipe: '<b class="result-wipe">SQUAD LOST</b>' };

export function renderHome(panel, { go, run, boardContract }) {
  const S = G.state(), name = G.playerName();
  const ready = S.soldiers.filter(G.canDeploy).length;
  const st = S.stats || {};
  const squad = S.soldiers.slice().sort((a, b) => b.level - a.level || b.kills - a.kills).slice(0, 6);
  const last = S.history?.[0];
  const latest = CHANGELOG[0];
  const wrap = el(`<div class="home">
    <section class="hero card">
      <div class="hero-faces">${squad.map(s => portraitTile(s, 'face')).join('')}</div>
      <div class="hero-text">
        <div class="kicker">${S.generation > 1 ? `Commander #${S.generation}` : 'Commander'}</div>
        <h1>${esc(name)}</h1>
        <div class="hero-sub"><b>${S.soldiers.length}</b> Soldiers · <b class="good">${ready}</b> ready to deploy · <b style="color:var(--accent)">${S.bucs.toLocaleString()}</b> BUCs</div>
        <div class="row hero-actions">
          <button class="primary big" data-go="deploy">Deploy a boarding party</button>
          <button class="big" data-go="barracks">Barracks</button>
          <button class="big" data-go="store">Store &amp; Packs</button>
          <button class="big" data-go="ladder">Ladder</button>
        </div>
      </div>
    </section>
    <div class="home-grid">
      <div class="card"><h3>Service record</h3>
        <div class="record home-record">
          <div><b>${S.missions}</b><span class="small dim">missions</span></div>
          <div><b>${st.successes || 0}</b><span class="small dim">ships taken</span></div>
          <div><b>${(st.kills || 0).toLocaleString()}</b><span class="small dim">kills</span></div>
          <div><b>${S.memorial.length}</b><span class="small dim">on the Memorial</span></div>
        </div></div>
      <div class="card" id="contract"><h3>72-Hour Contract</h3><div class="dim small">Loading…</div></div>
      <div class="card"><h3>Last mission</h3>
        ${last ? `<div>${RESULT[last.result] || esc(last.result)} · ${esc(last.shipName)}</div>
          <div class="small dim">${new Date(last.at).toLocaleString()} · ${last.bucs} BUCs${last.soldiers?.some(x => x.fate === 'kia') ? ` · <span class="bad">${last.soldiers.filter(x => x.fate === 'kia').length} killed</span>` : ''}</div>
          <button style="margin-top:8px" data-go="log">Mission Log</button>`
        : '<div class="dim">No missions yet. Your squad is waiting.</div><button class="primary" style="margin-top:8px" data-go="deploy">Plan your first boarding</button>'}</div>
      <div class="card play3d"><h3>Breach Team 3D</h3>
        <div class="small dim">The same game, account and save, rebuilt in 3D: modelled ships, lighting, effects and a battle camera.</div>
        <div class="row" style="margin-top:8px;flex-wrap:wrap"><a class="btn primary" href="play/" target="_blank" rel="noopener">▶ Play in your browser</a>
          <a class="btn" href="https://github.com/deckofmanythings-a11y/breach-team-releases/releases/latest" target="_blank" rel="noopener">Windows download</a></div>
        <div class="small dim" style="margin-top:6px">Browser version: desktop only, a big first download (cached after). The Windows app runs faster and updates itself.</div></div>
      <div class="card"><h3>What's new · Ver. ${esc(latest.v)}</h3><ul class="small">${latest.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>
    </div>
    <div class="card danger-zone">
      <div class="spread"><div><h3 style="color:var(--bad)">Restart Account</h3>
        <div class="small dim">Wipe all progress and start fresh: new Soldiers, starting BUCs, an empty Memorial Wall. This can't be undone.</div></div>
        <button class="danger" id="restart">Restart Account</button></div>
    </div>
  </div>`);
  wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  wrap.querySelector('#restart').onclick = () => confirmRestart({ go, run });
  panel.append(wrap);

  api.call('contract').then(c => {
    const k = c.contract, ship = SHIP_BY_ID[k.ship], box = wrap.querySelector('#contract');
    if (!box) return;
    const left = Math.max(0, k.endsAt - Date.now()), h = Math.floor(left / 3600e3), m = Math.floor((left % 3600e3) / 60e3);
    box.innerHTML = `<h3>72-Hour Contract</h3><div><b>${esc(ship.name)}</b> <span class="small dim">${'★'.repeat(ship.tier)}${'☆'.repeat(3 - ship.tier)}</span></div>
      <div class="small dim">Ends in ${h}h ${m}m · ${c.board.length} commander${c.board.length === 1 ? '' : 's'} on the board</div>
      <div class="small" style="margin-top:4px">${c.mine ? `Your best: <b>${c.mine.score}</b> (rank ${c.mine.rank})` : 'You haven’t run it yet.'}</div>
      <button class="primary" style="margin-top:8px" id="board">Board the Contract</button>`;
    box.querySelector('#board').onclick = () => boardContract(k);
  }).catch(() => { const box = wrap.querySelector('#contract'); if (box) box.innerHTML = '<h3>72-Hour Contract</h3><div class="dim small">Couldn’t load the contract. Try the Ladder tab.</div>'; });
}

function confirmRestart({ go, run }) {
  const box = el(`<div class="box" style="width:min(480px,94vw)"><h2 style="color:var(--bad)">Restart Account?</h2>
    <p>Everything goes: every Soldier, all gear, BUCs, the Memorial Wall, your Mission Log and career stats. You keep your commander name and start again with a fresh starter squad.</p>
    <p class="small dim">Contract runs already on this cycle's leaderboard stay there.</p>
    <label>Type <b>RESTART</b> to confirm<input id="cf" autocomplete="off" style="width:100%"></label>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button id="no">Cancel</button><button class="danger" id="yes" disabled>Wipe and restart</button></div></div>`);
  const cf = box.querySelector('#cf'), yes = box.querySelector('#yes');
  cf.oninput = () => { yes.disabled = cf.value.trim().toUpperCase() !== 'RESTART'; };
  box.querySelector('#no').onclick = closeModal;
  yes.onclick = async () => {
    yes.disabled = true;
    if (await run(() => G.act('restart'))) { closeModal(); toast('Fresh start. Your new squad is waiting in the Barracks.'); go('home'); }
    else yes.disabled = false;
  };
  modal(box); cf.focus();
}

export function renderGameOver(panel, { go, run }) {
  const S = G.state(), over = S.gameOver, st = S.stats || {};
  const fallen = S.memorial.filter(m => m.diedAt === over.at);
  const wrap = el(`<div class="gameover">
    <div class="go-title">GAME OVER</div>
    <p class="go-sub">The last of your Soldiers fell aboard the <b>${esc(over.ship || 'enemy ship')}</b>. Commander ${esc(G.playerName())} has been relieved of command.</p>
    ${fallen.length ? `<div class="go-fallen">${fallen.map(m => `<div class="go-soldier">${portraitTile(m, 'face')}<div class="name">${esc(m.name)}</div>${memorialBadges(m)}<div class="small dim">${esc(SPECIALTY_BY_ID[m.specialty]?.name || '')} · Lv ${m.level}</div></div>`).join('')}</div>` : ''}
    <div class="record go-record">
      <div><b>${S.missions}</b><span class="small dim">missions</span></div>
      <div><b>${st.successes || 0}</b><span class="small dim">ships taken</span></div>
      <div><b>${(st.kills || 0).toLocaleString()}</b><span class="small dim">kills</span></div>
      <div><b>${S.memorial.length}</b><span class="small dim">on the Memorial</span></div>
    </div>
    <div class="card go-card">
      <h3>A new commander takes over</h3>
      <p>Fleet Command sends a fresh crew and a new commander with starting BUCs. Soldiers, gear, BUCs and records start over.
      The <b>Memorial Wall</b>${S.mothership ? ' and the <b>Mothership</b> carry' : ' carries'} over: the fallen are not forgotten.</p>
      <div class="row" style="justify-content:center;gap:10px"><button class="primary big" id="again">Restart with a fresh crew</button><button class="big" data-go="memorial">Visit the Memorial</button></div>
    </div>
  </div>`);
  wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  wrap.querySelector('#again').onclick = async (e) => {
    e.target.disabled = true;
    const r = await run(() => G.act('newCommander'));
    if (r) { toast(`Commander #${r.newCommander} takes command. Your new squad is in the Barracks.`); go('home'); }
    else e.target.disabled = false;
  };
  panel.append(wrap);
}
