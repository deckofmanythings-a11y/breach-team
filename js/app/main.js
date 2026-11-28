// Breach Team client. The server (boarding-api) owns each player's save; this file renders it
// and sends actions. Missions are re-simulated locally from the server's input for playback.
import * as G from './state.js?v=3';
import * as api from './api.js';
import { el, esc, toast, modal, closeModal, avatar, statGrid, itemLabel, timeLeft, ribbon, ribbons, xpPct } from './ui.js';
import { COMMENDATIONS } from '../data/commendations.js';
import { renderCodex } from './codex.js';
import { initWhatsNew } from './changelog.js';
import { renderDeploy } from './deploy.js?v=21';
import { renderStore } from './store.js?v=6';
import { renderLadder } from './ladder.js?v=11';
import './../render/portrait.js';
import { renderHome, renderGameOver, faceStrip } from './home.js?v=2';
import { memorialBadges } from './memorial-badge.js';
import { shownCreds, backfillNotice } from './creds-view.js';
import { renderMothership } from './mothership-view.js?v=7';
import { autoEquipButton } from './auto-equip.js?v=1';
import { LOOKS } from '../data/looks.js';
import * as sfx from '../audio/sfx.js';
import { itemTipText, affixSummary } from './itemtip.js';
import { itemIcon, slotIcon } from './item-icons.js';
import { enableGearDrag } from './gear-drag.js';
import { artStyle, setArtStyle, ART_STYLES } from '../render/art-style.js';
import { levelBadge } from './badges.js';
import { setContract } from './deploy.js?v=21';
import { SPECIALTIES, SPECIALTY_BY_ID, ABILITIES } from '../data/specialties.js';
import { ITEM_BY_ID, SLOTS, RARITY_ORDER, RARITY_BY_ID, WEAPON_TYPES } from '../data/gear.js';
import { INJURY_BY_ID } from '../data/injuries.js';
import { COLOR_PRESETS } from '../data/economy.js';
import { rosterCap } from '../data/crew-quarters.js';
import { xpToReach, MAX_LEVEL, PERK_LEVELS } from '../data/stats.js';
import { ENGINE_VERSION } from '../data/version.js';
import { replayMission, setExit, setOpenSoldier } from './mission.js?v=8';
import { EASTER_EGGS } from '../data/easter-eggs.js';
import { SECRET_SHIPS } from '../data/aliens.js';
import './../render/tokens.js';
import { DEFAULT_CLASS_ACCENTS, classAccent } from '../data/class-colors.js';

export const APP_VERSION = '0.23.1';
document.getElementById('ver').textContent = `Ver. ${APP_VERSION} · engine v${ENGINE_VERSION}`;

// Painted / anime portraits: a per-device choice; re-render so every portrait and token repaints.
const artBtn = document.getElementById('artstyle');
const showArt = () => { artBtn.textContent = `🎨 ${ART_STYLES.find(a => a.id === artStyle()).name}`; artBtn.title = 'Portrait art style (tap to switch)'; };
showArt();
artBtn.onclick = () => { setArtStyle(artStyle() === 'anime' ? 'painted' : 'anime'); showArt(); if (G.signedIn()) render(); toast(`Portraits: ${ART_STYLES.find(a => a.id === artStyle()).name}`); };

const panel = document.getElementById('panel');
const nav = document.getElementById('nav');
const acct = document.getElementById('acct');
let route = location.hash.slice(1).split('&')[0] || 'home';
let authMode = api.isRecoveryLink ? 'recover' : 'signin';

function refreshTop() {
  document.getElementById('bucs').textContent = G.shownBucs().toLocaleString();
  document.getElementById('creds').textContent = shownCreds().toLocaleString();
  const on = G.signedIn();
  nav.hidden = !on; document.querySelector('.bucs').hidden = !on; document.querySelector('.creds').hidden = !on;
  const note = on && backfillNotice();
  if (note) showCredsNotice(note);
  acct.hidden = !on; acct.textContent = on ? `${G.playerName()} · Sign out` : '';
}
G.onChange(refreshTop);
// Waits for any open modal (e.g. "What's new" after an update) to close first.
function showCredsNotice(note) {
  if (!document.getElementById('modal').hidden) { setTimeout(() => showCredsNotice(note), 800); return; }
  const box = el(`<div class="box"><h2>CREDs</h2><p>${esc(note)}</p><p class="small dim">Capital Resource Exchange Denominations. They're separate from BUCs, and they'll be spent on the Mothership.</p><div class="row"><button class="primary">Got it</button></div></div>`);
  box.querySelector('button').onclick = closeModal;
  modal(box);
}

// Sound: a speaker button in the top bar (click = mute/unmute, the arrow opens a volume slider),
// and a soft click on every button press.
{
  const box = el(`<div class="sound-ctl"><button id="snd" title="Sound on/off"></button><button id="sndv" title="Volume">▾</button>
    <div class="sound-pop" hidden><label class="small">Volume <input type="range" min="0" max="100" id="sndr"></label></div></div>`);
  document.getElementById('whatsnew').after(box);
  const btn = box.querySelector('#snd'), pop = box.querySelector('.sound-pop'), range = box.querySelector('#sndr');
  const sync = () => { btn.textContent = sfx.isMuted() || !sfx.getVolume() ? '🔇' : '🔊'; range.value = Math.round(sfx.getVolume() * 100); };
  sync(); sfx.onSettings(sync);
  btn.onclick = () => { sfx.setMuted(!sfx.isMuted()); if (!sfx.isMuted()) sfx.click(); };
  box.querySelector('#sndv').onclick = () => { pop.hidden = !pop.hidden; };
  range.oninput = () => { sfx.setMuted(false); sfx.setVolume(range.value / 100); };
  range.onchange = () => sfx.click();
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) pop.hidden = true; });
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('button') && !box.contains(e.target)) setTimeout(() => sfx.click(), 0); }, true);
}

export function go(r) { route = r; if (location.hash.slice(1) !== r) location.hash = r; render(); }
setExit(go);
setOpenSoldier((uid) => { go('barracks'); const s = G.soldierById(uid); if (s) openSoldier(s); });
window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r && r !== route && /^[a-z]+$/.test(r)) { route = r; render(); } });
nav.addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (b) go(b.dataset.go); });
acct.onclick = async () => { await api.signOut(); G.clear(); closeModal(); authMode = 'signin'; render(); };

// Run a server action; show its error as a toast. Returns the response or null.
async function run(fn) {
  panel.classList.add('busy');
  try { return await fn(); }
  catch (e) { toast(e.message || 'Something went wrong.'); if (e.status === 401) { G.clear(); render(); } return null; }
  finally { panel.classList.remove('busy'); }
}

export function render() {
  sfx.stopHum();
  refreshTop();
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.go === route);
  panel.innerHTML = '';
  if (!G.signedIn()) { if (route === 'codex') return renderCodex(panel); return needsName ? nameScreen() : authScreen(); }
  if (G.state().gameOver && !['memorial', 'codex', 'log'].includes(route)) return renderGameOver(panel, { go, run });
  if (route === 'home') return renderHome(panel, { go, run, boardContract: (c) => { setContract(c); go('deploy'); } });
  if (route === 'deploy') return renderDeploy(panel);
  if (route === 'store') return renderStore(panel, run);
  if (route === 'mothership') return renderMothership(panel, run);
  if (route === 'armory') return renderArmory();
  if (route === 'log') return renderLog();
  if (route === 'memorial') return renderMemorial();
  if (route === 'codex') return renderCodex(panel);
  if (route === 'ladder') return renderLadder(panel, { boardContract: (c) => { setContract(c); go('deploy'); } });
  if (route === 'barracks') return renderBarracks();
  route = 'home'; render();
}

// Healing timers tick visibly; when one runs out, the server heals it on the next refresh.
setInterval(async () => {
  for (const n of document.querySelectorAll('[data-until]')) n.textContent = timeLeft(+n.dataset.until);
  if (document.getElementById('modal').hidden && (route === 'barracks' || route === 'deploy') && await G.refreshIfDue()) render();
}, 1000);

// ---------- Auth ----------
let needsName = false;
function authScreen() {
  const recovering = authMode === 'recover';
  if (!recovering) panel.append(el(`<div class="landing"><div class="landing-title">BREACH <span>TEAM</span></div><div class="landing-sub">Pick your squad. Choose your way in. Take the ship, or don't come back.</div>${faceStrip(8)}</div>`));
  const wrap = el(`<div class="auth card">
    <h2>${recovering ? 'Set a new password' : authMode === 'signup' ? 'Create account' : authMode === 'forgot' ? 'Reset password' : 'Sign in'}</h2>
    <p class="dim">${recovering ? 'Choose a new password for your account.' : 'Command a squad of boarders, take enemy ships, and climb the ladder with your friends. Your roster is saved online.'}</p>
    ${api.authLinkError ? `<div class="bad small">${esc(api.authLinkError)}</div>` : ''}
    <form id="authf">
      ${recovering ? '' : '<label>Email<input type="email" id="em" autocomplete="email" required></label>'}
      ${authMode === 'forgot' ? '' : `<label>${recovering ? 'New password' : 'Password'}<input type="password" id="pw" minlength="6" autocomplete="${authMode === 'signin' ? 'current-password' : 'new-password'}" required></label>`}
      <button class="primary" style="margin-top:12px;width:100%">${({ signin: 'Sign in', signup: 'Create account', forgot: 'Send reset email', recover: 'Save password' })[authMode]}</button>
      <div class="small" id="aerr" style="margin-top:8px"></div>
    </form>
    ${recovering ? '' : `<div class="spread small" style="margin-top:10px">
      <a href="#" data-mode="${authMode === 'signin' ? 'signup' : 'signin'}">${authMode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}</a>
      ${authMode === 'signin' ? '<a href="#" data-mode="forgot">Forgot password</a>' : ''}</div>`}
    <p class="small dim" style="margin-top:16px">Want to read the rules first? <a href="#codex">Open the Codex</a>.</p>
  </div>`);
  wrap.onclick = (e) => { const m = e.target.closest('[data-mode]'); if (m) { e.preventDefault(); authMode = m.dataset.mode; render(); } };
  wrap.querySelector('#authf').onsubmit = async (e) => {
    e.preventDefault();
    const em = wrap.querySelector('#em')?.value.trim(), pw = wrap.querySelector('#pw')?.value, err = wrap.querySelector('#aerr');
    err.className = 'small bad'; err.textContent = '';
    let r;
    if (authMode === 'signin') r = await api.signIn(em, pw);
    else if (authMode === 'signup') r = await api.signUp(em, pw);
    else if (authMode === 'forgot') { r = await api.resetPassword(em); if (!r.error) { err.className = 'small good'; err.textContent = 'Check your email for a reset link.'; return; } }
    else r = await api.sb.auth.updateUser({ password: pw });
    if (r.error) { err.textContent = r.error.message; return; }
    if (authMode === 'signup' && !r.data.session) { err.className = 'small good'; err.textContent = 'Check your email to confirm your account, then sign in.'; return; }
    authMode = 'signin';
    await start();
  };
  panel.append(wrap);
}
function nameScreen() {
  const wrap = el(`<div class="auth card"><h2>Name your command</h2>
    <p class="dim">Your commander name shows on the ladder. 2–20 characters.</p>
    <form id="nf"><input id="dn" maxlength="20" minlength="2" required placeholder="Commander name" style="width:100%">
    <button class="primary" style="margin-top:12px;width:100%">Take command</button><div class="small bad" id="nerr" style="margin-top:8px"></div></form>
    <a href="#" id="so" class="small">Sign out</a></div>`);
  wrap.querySelector('#nf').onsubmit = async (e) => {
    e.preventDefault();
    try { await G.register(wrap.querySelector('#dn').value); needsName = false; toast('Welcome aboard, Commander. Your starter squad is ready.'); go('home'); }
    catch (er) { wrap.querySelector('#nerr').textContent = er.message; }
  };
  wrap.querySelector('#so').onclick = async (e) => { e.preventDefault(); await api.signOut(); needsName = false; render(); };
  panel.append(wrap);
}
async function start() {
  if (!(await api.session())) { render(); return; }
  panel.innerHTML = '<div class="dim">Contacting Fleet Command…</div>';
  try { needsName = (await G.boot()) === 'name'; }
  catch (e) { panel.innerHTML = ''; panel.append(el(`<div class="card bad">Couldn't reach the server: ${esc(e.message)} <button id="retry">Retry</button></div>`)); panel.querySelector('#retry').onclick = start; return; }
  render();
}
api.sb.auth.onAuthStateChange((evt) => { if (evt === 'PASSWORD_RECOVERY') { authMode = 'recover'; G.clear(); render(); } });

// XP shown as progress through the current level, matching the bar (which fills from this
// level's threshold to the next, not from 0).
function xpLevelText(s) { const lo = xpToReach(s.level), hi = xpToReach(s.level + 1); return `${Math.max(0, s.xp - lo)}/${hi - lo}`; }
function xpTip(s) { return s.level >= MAX_LEVEL ? `${s.xp} XP (max level)` : `${s.xp} total XP. Level ${s.level + 1} at ${xpToReach(s.level + 1)} (${Math.max(0, xpToReach(s.level + 1) - s.xp)} to go).`; }

// ---------- Barracks ----------
function soldierCard(s) {
  const c = G.condition(s);
  const st = G.effectiveStats(s);
  const nextUntil = Math.max(0, ...s.injuries.map(i => i.until), s.status === 'mia' ? s.miaUntil : 0);
  const sp = SPECIALTY_BY_ID[s.specialty];
  const [a, b] = s.colors || ['#3a5a8c', '#f2c14e'];
  const next = s.level >= MAX_LEVEL ? null : xpToReach(s.level + 1);
  return el(`<div class="card click scard ${c}" style="--sa:${a};--sb:${b}" data-drop="soldier" data-sid="${s.uid}">
    <div class="portrait scard-art" data-tok="1" data-spec="${s.specialty}" data-sex="${s.sex === 'f' ? 'f' : 'm'}" data-look="${s.look || 0}"${s.portrait ? ` data-portrait="${s.portrait}"` : ''} data-a="${a}">
      <div class="scard-level">${levelBadge(s.level, b, 'lg')}</div>
      <div class="scard-tags"><span class="tag ${c}">${{ healthy: 'Ready', wounded: 'Wounded', benched: 'Recovering', mia: 'Missing' }[c]}</span>
        ${nextUntil ? `<span class="tag timer" data-until="${nextUntil}">${timeLeft(nextUntil)}</span>` : ''}
        ${s.pendingPerks.length ? '<span class="tag perk">Perk!</span>' : ''}</div>
      <div class="scard-title">
        <div class="scard-name">${esc(s.name)}</div>
        ${s.callsign ? `<div class="callsign">"${esc(s.callsign)}"</div>` : ''}
        <div class="scard-sub">${sp.name}</div>
      </div>
    </div>
    <div class="scard-body">
      ${gearRow(s)}
      ${statGrid(st, s.specialty)}
      <div class="scard-xp"><span>XP</span><div class="bar xpbar" title="${xpTip(s)}"><i style="width:${xpPct(s)}%"></i></div><span title="${xpTip(s)}">${next ? xpLevelText(s) : 'MAX'}</span></div>
      <div class="scard-foot"><span>${s.missions} missions</span><span>${s.kills} kills</span></div>
      ${ribbons(s.medals)}
    </div>
  </div>`);
}


// ---------- Gear icons on the Soldier cards (drag between Soldiers or to the inventory pool) ----------
const slotName = (slot) => slot[0].toUpperCase() + slot.slice(1);
function gearIcon(it, sid) {
  const fixed = ITEM_BY_ID[it.base].builtin;
  return `<div class="gicon s-${ITEM_BY_ID[it.base].slot} r-${it.rarity}${fixed ? ' fixed' : ''}" data-item="${it.uid}"${sid ? ` data-from="${sid}"` : ''}${fixed ? '' : ' data-drag="1"'}
    data-tip="${esc(itemTipText(it) + (fixed ? '\n(built in: never comes off)' : '\nDrag to another Soldier or to the Inventory.'))}">${itemIcon(it, 26)}${fixed ? '<span class="lock">🔒</span>' : ''}</div>`;
}
function gearRow(s) {
  return `<div class="gear-row">${SLOTS.map(slot => {
    const it = s.gear[slot] && G.itemById(s.gear[slot]);
    return it ? gearIcon(it, s.uid) : `<div class="gicon empty s-${slot}" title="${slotName(slot)}: empty">${slotIcon(slot, 22)}</div>`;
  }).join('')}</div>`;
}
function inventoryPool(S) {
  const free = S.items.filter(it => !G.equippedBy(it.uid) && !ITEM_BY_ID[it.base].builtin)
    .sort((a, b) => SLOTS.indexOf(ITEM_BY_ID[a.base].slot) - SLOTS.indexOf(ITEM_BY_ID[b.base].slot)
      || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || cmpStr(ITEM_BY_ID[a.base].name, ITEM_BY_ID[b.base].name));
  const box = el(`<div class="card pool" data-drop="pool">
    <div class="spread"><b>Inventory <span class="dim small">${free.length} unequipped</span></b><span class="small dim">Drag gear between Soldiers to swap it, or here to take it off.</span></div>
    <div class="pool-items">${free.map(it => gearIcon(it, '')).join('') || '<span class="small dim">Empty. Every item is equipped.</span>'}</div></div>`);
  return box;
}
// Moves `itemUid` onto Soldier `toSid` (or off, to the pool). If it came from another Soldier, that
// Soldier takes the target's old item in exchange when they can use it; otherwise it goes to the pool.
async function moveGear(itemUid, fromSid, toSid) {
  const it = G.itemById(itemUid); if (!it) return;
  const base = ITEM_BY_ID[it.base], slot = base.slot;
  const keep = window.scrollY, done = () => { render(); window.scrollTo(0, keep); };
  if (toSid === 'pool') {
    if (!fromSid) return;
    if (await run(() => G.act('equip', { soldier: fromSid, slot, item: null }))) done();
    return;
  }
  if (toSid === fromSid) return;
  const B = G.soldierById(toSid), A = fromSid && G.soldierById(fromSid);
  if (!B) return;
  if (!G.canWield(B, it)) {
    const w = WEAPON_TYPES[base.type]?.name || base.type;
    toast(`${B.name} (${SPECIALTY_BY_ID[B.specialty].name}) can't use ${/^([AEIOU]|SMG|LMG)/i.test(w) ? 'an' : 'a'} ${w}.`); return;
  }
  const old = B.gear[slot] && G.itemById(B.gear[slot]);
  if (old && ITEM_BY_ID[old.base].builtin) { toast(`${B.name}'s ${slot} is built in. It doesn't come off.`); return; }
  if (!(await run(() => G.act('equip', { soldier: B.uid, slot, item: it.uid })))) { done(); return; }
  if (old && A) {
    if (G.canWield(A, old)) { await run(() => G.act('equip', { soldier: A.uid, slot, item: old.uid })); toast(`${A.name} and ${B.name} swapped ${slot}s.`); }
    else toast(`${A.name} can't use ${ITEM_BY_ID[old.base].name}, so it went to the Inventory.`);
  }
  done();
}
// Marks every drop target as valid or not for the item being dragged.
function markDropTargets(root, src) {
  const it = G.itemById(src.dataset.item), slot = ITEM_BY_ID[it.base].slot, from = src.dataset.from || '';
  for (const t of root.querySelectorAll('[data-drop]')) {
    let ok;
    if (t.dataset.drop === 'pool') ok = !!from;
    else {
      const s = G.soldierById(t.dataset.sid), cur = s?.gear[slot] && G.itemById(s.gear[slot]);
      ok = !!s && t.dataset.sid !== from && G.canWield(s, it) && !(cur && ITEM_BY_ID[cur.base].builtin);
    }
    t.classList.add(ok ? 'drop-ok' : 'drop-no');
  }
}

// ---------- List filter toolbars (Barracks / Armory) ----------
function loadPrefs(key, defaults) {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return { ...defaults }; }
}
function savePrefs(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }
const optHtml = (opts, cur) => opts.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
const dirText = (p) => p.dir === 'asc' ? '▲ Asc' : '▼ Desc';
// fields: [{ k, label, opts:[[value,label]] } | { k, label, search:true }]; sorts: [[value,label]]. Calls onChange() after any edit.
function listToolbar(key, prefs, defaults, fields, sorts, onChange) {
  const bar = el(`<div class="filterbar row">${fields.map(f => f.search
    ? `<input type="search" data-k="${f.k}" placeholder="${esc(f.label)}" value="${esc(prefs[f.k])}" aria-label="${esc(f.label)}">`
    : `<select data-k="${f.k}" aria-label="${esc(f.label)}">${optHtml(f.opts, prefs[f.k])}</select>`).join('')}
    <select data-k="sort" aria-label="Sort by">${optHtml(sorts, prefs.sort)}</select>
    <button type="button" class="small" data-dir title="Toggle sort direction">${dirText(prefs)}</button>
    <button type="button" class="small" data-reset title="Clear filters">Reset</button>
    <span class="small dim fcount"></span></div>`);
  const commit = () => { savePrefs(key, prefs); onChange(); };
  for (const c of bar.querySelectorAll('[data-k]')) c.oninput = () => { prefs[c.dataset.k] = c.value; commit(); };
  bar.querySelector('[data-dir]').onclick = (e) => { prefs.dir = prefs.dir === 'asc' ? 'desc' : 'asc'; e.target.textContent = dirText(prefs); commit(); };
  bar.querySelector('[data-reset]').onclick = () => {
    Object.assign(prefs, defaults);
    for (const c of bar.querySelectorAll('[data-k]')) c.value = prefs[c.dataset.k];
    bar.querySelector('[data-dir]').textContent = dirText(prefs);
    commit();
  };
  return bar;
}

const BARRACKS_DEFAULTS = { spec: 'all', cond: 'all', q: '', sort: 'default', dir: 'desc' };
const ARMORY_DEFAULTS = { slot: 'all', rarity: 'all', status: 'all', wtype: 'all', q: '', sort: 'default', dir: 'desc' };
const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function renderBarracks() {
  const S = G.state();
  const wrap = el(`<div><div class="spread section"><div><h2>Barracks</h2><div class="dim">${S.soldiers.length}/${rosterCap(S)} Soldiers · ${S.missions} missions flown${S.soldiers.length >= rosterCap(S) ? ` · <span class="warn">Barracks full: expand the Crew Quarters on the Mothership</span>` : ''}</div></div>
    <div class="row"><select id="hireSpec">${SPECIALTIES.map(s => `<option value="${s.id}" ${s.id === localStorage.getItem('bt.hireSpec') ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
    <button id="hire">Hire Rookie (${G.HIRE_PRICE} BUCs)</button><button data-go="store" id="tostore">Store &amp; Packs</button><button id="classcol" title="Pick the accent colour each class wears">Class colours</button></div></div><div class="grid" id="roster"></div></div>`);
  const roster = wrap.querySelector('#roster');
  const perkers = S.soldiers.filter(s => s.pendingPerks.length);
  if (perkers.length) roster.before(el(`<div class="banner">★ ${perkers.map(s => esc(s.name)).join(', ')} ${perkers.length > 1 ? 'have' : 'has'} a perk to choose. Open their page.</div>`));
  const order = { healthy: 0, wounded: 1, benched: 2, mia: 3 };
  const prefs = loadPrefs('bt.barracksFilter', BARRACKS_DEFAULTS);
  const SORTS = { level: s => s.level, name: s => s.name, class: s => SPECIALTY_BY_ID[s.specialty]?.name, missions: s => s.missions, kills: s => s.kills, xp: s => s.xp };
  const apply = () => {
    const q = prefs.q.trim().toLowerCase();
    const rows = S.soldiers.filter(s =>
      (prefs.spec === 'all' || s.specialty === prefs.spec) &&
      (prefs.cond === 'all' || (prefs.cond === 'ready' ? G.canDeploy(s) : G.condition(s) === prefs.cond)) &&
      (!q || (s.name || '').toLowerCase().includes(q) || (s.callsign || '').toLowerCase().includes(q)));
    const dir = prefs.dir === 'asc' ? 1 : -1, key = SORTS[prefs.sort];
    if (key) rows.sort((a, b) => { const x = key(a), y = key(b); return dir * (typeof x === 'string' ? cmpStr(x, y) : (x || 0) - (y || 0)) || cmpStr(a.name, b.name); });
    else { rows.sort((a, b) => order[G.condition(a)] - order[G.condition(b)] || b.level - a.level); if (prefs.dir === 'asc') rows.reverse(); }
    roster.replaceChildren();
    for (const s of rows) { const card = soldierCard(s); card.onclick = () => openSoldier(s); roster.append(card); }
    if (!rows.length) roster.append(el('<div class="dim empty">No Soldiers match these filters.</div>'));
    bar.querySelector('.fcount').textContent = `Showing ${rows.length} of ${S.soldiers.length}`;
  };
  const bar = listToolbar('bt.barracksFilter', prefs, BARRACKS_DEFAULTS, [
    { k: 'spec', label: 'Class', opts: [['all', 'All classes'], ...SPECIALTIES.map(s => [s.id, s.name])] },
    { k: 'cond', label: 'Condition', opts: [['all', 'Any condition'], ['ready', 'Ready to deploy'], ['wounded', 'Wounded'], ['benched', 'Benched'], ['mia', 'MIA']] },
    { k: 'q', label: 'Search name / callsign', search: true },
  ], [['default', 'Sort: Default'], ['level', 'Sort: Level'], ['name', 'Sort: Name'], ['class', 'Sort: Class'], ['missions', 'Sort: Missions'], ['kills', 'Sort: Kills'], ['xp', 'Sort: XP']], apply);
  roster.before(bar);
  roster.before(inventoryPool(S));
  apply();
  enableGearDrag(wrap, {
    start: (src) => markDropTargets(wrap, src),
    end: () => { for (const t of wrap.querySelectorAll('.drop-ok, .drop-no')) t.classList.remove('drop-ok', 'drop-no'); },
    // A Soldier who can't take it still goes through moveGear, which says why.
    drop: (src, t) => { if (t.classList.contains('drop-ok') || t.dataset.drop === 'soldier') moveGear(src.dataset.item, src.dataset.from || '', t.dataset.drop === 'pool' ? 'pool' : t.dataset.sid); },
  });
  const hire = wrap.querySelector('#hire');
  hire.disabled = S.bucs < G.HIRE_PRICE || S.soldiers.length >= rosterCap(S);
  wrap.querySelector('#hireSpec').onchange = (e) => localStorage.setItem('bt.hireSpec', e.target.value);
  hire.onclick = async () => { const r = await run(() => G.act('hire', { specialty: wrap.querySelector('#hireSpec').value })); if (r) { toast(`${G.soldierById(r.soldier)?.name} joined the team.`); render(); } };
  wrap.querySelector('#tostore').onclick = () => go('store');
  wrap.querySelector('#classcol').onclick = openClassColors;
  const ae = autoEquipButton(run, render); if (ae) wrap.querySelector('#classcol').after(ae);
  panel.append(wrap);
}

// ---------- Class colours ----------
function openClassColors() {
  const S = G.state();
  const box = el(`<div class="box" style="max-width:420px"><div class="spread"><h2>Class colours</h2><button id="x">✕</button></div>
    <div class="small dim" style="margin-bottom:10px">Every Soldier wears their class's accent colour: level badge, card trim and map token. Armour colour is still set per Soldier.</div>
    <div style="display:grid;gap:8px">${SPECIALTIES.map(sp => {
      const n = S.soldiers.filter(x => x.specialty === sp.id).length;
      return `<label class="spread"><span>${avatar({ specialty: sp.id, colors: ['#2a3442', classAccent(S, sp.id)] }, 32)} <b>${sp.name}</b> <span class="small dim">${n} in the Barracks</span></span>
        <span class="row"><input type="color" data-spec="${sp.id}" value="${classAccent(S, sp.id)}">${S.classAccents?.[sp.id] ? `<button class="small" data-reset="${sp.id}" title="Back to the default">Reset</button>` : ''}</span></label>`;
    }).join('')}</div>
    <div class="spread" style="margin-top:14px"><button id="resetall">Reset all to defaults</button><button class="primary" id="done">Done</button></div></div>`);
  const save = async (colors) => { if (await run(() => G.act('classColors', { colors }))) { render(); openClassColors(); } };
  for (const i of box.querySelectorAll('input[data-spec]')) i.onchange = () => save({ [i.dataset.spec]: i.value });
  for (const b of box.querySelectorAll('[data-reset]')) b.onclick = (e) => { e.preventDefault(); save({ [b.dataset.reset]: null }); };
  box.querySelector('#resetall').onclick = () => save(Object.fromEntries(Object.keys(DEFAULT_CLASS_ACCENTS).map(k => [k, null])));
  box.querySelector('#x').onclick = box.querySelector('#done').onclick = closeModal;
  modal(box);
}

// ---------- Soldier detail ----------
export function openSoldier(s) {
  if (!s) { closeModal(); return; }
  const S = G.state();
  const sp = SPECIALTY_BY_ID[s.specialty];
  const st = G.effectiveStats(s);
  const ab = ABILITIES[sp.ability];
  const next = s.level >= MAX_LEVEL ? null : xpToReach(s.level + 1);
  const cost = G.healCost(s);
  const reopen = () => {
    const y = document.querySelector('#modal > .box')?.scrollTop || 0;
    openSoldier(G.soldierById(s.uid)); render();
    const b = document.querySelector('#modal > .box'); if (b) b.scrollTop = y;
  };
  const box = el(`<div class="box">
    <div class="spread"><div class="soldier-head">${avatar(s, 56)}${levelBadge(s.level, (s.colors || [])[1], 'lg')}<div>
      <div class="name" style="font-size:18px">${esc(s.name)} ${s.callsign ? `<span class="callsign">"${esc(s.callsign)}"</span>` : ''}</div>
      <div class="dim">${sp.name} · Level ${s.level} · ${s.missions} missions · ${s.kills} kills</div></div></div>
      <button id="x">Close</button></div>
    ${s.bio ? `<div class="banner info" style="margin:8px 0">${s.cyborg ? 'Classified.' : 'Rare recruit.'} <i>${esc(s.bio)}</i></div>` : ''}
    <div class="small dim" style="margin:8px 0">${esc(sp.desc)}</div>
    <div class="small" title="${xpTip(s)}">XP ${next ? `${xpLevelText(s)} toward Level ${s.level + 1} <span class="dim">(${s.xp} total)</span>` : `${s.xp} (max level)`}</div>
    ${next ? `<div class="bar"><i style="width:${xpPct(s)}%"></i></div>` : ''}
    ${statGrid(st, s.specialty)}
    <div class="small dim" style="margin-top:4px">Stats include gear and injuries. Colours compare each stat with a new ${esc(sp.name)}'s starting value: <span class="s-down2">below</span> · about the same · <span class="s-up">higher</span> · <span class="s-up2">much higher</span> · <span class="s-up3">exceptional</span>. Hover or long-press a stat for the numbers.</div>

    <h3 style="margin-top:14px">Ability: ${ab.name}</h3><div class="small">${esc(ab.desc)}</div>

    <h3 style="margin-top:14px">Condition</h3>
    <div>${s.injuries.length ? s.injuries.map(i => `<div class="item"><span>${INJURY_BY_ID[i.id].name} <span class="dim small">(${INJURY_BY_ID[i.id].severity === 2 ? 'major: can\'t deploy' : 'minor'})</span></span><span data-until="${i.until}">${timeLeft(i.until)}</span></div>`).join('')
      : s.status === 'mia' ? `<div class="item"><span>Missing in action</span><span data-until="${s.miaUntil}">${timeLeft(s.miaUntil)}</span></div>` : '<span class="good">Healthy</span>'}</div>
    ${cost ? `<button id="heal" style="margin-top:6px" ${S.bucs < cost ? 'disabled' : ''}>Heal now (${cost} BUCs)</button>` : ''}

    <h3 style="margin-top:14px">Service record</h3>
    <div class="record">
      <div><b>${s.missions}</b><span class="small dim">missions</span></div>
      <div><b>${s.record.successes}</b><span class="small dim">ships taken</span></div>
      <div><b>${s.kills}</b><span class="small dim">kills</span></div>
      <div><b>${s.record.downed}</b><span class="small dim">times Downed</span></div>
      <div><b>${s.record.deathRolls}</b><span class="small dim">death rolls survived</span></div>
      <div><b>${s.record.revives}</b><span class="small dim">revives given</span></div>
      <div><b>${s.record.injuries}</b><span class="small dim">injuries</span></div>
    </div>
    <details class="commend"><summary><h3>Commendations <span class="dim small">${s.medals.length}/${COMMENDATIONS.length}</span></h3>${ribbons(s.medals)}</summary>
    <div>${COMMENDATIONS.map(c => `<div class="medal-row ${s.medals.includes(c.id) ? '' : 'dim'}">${ribbon(c.id, s.medals.includes(c.id))}<span><b>${c.name}</b> <span class="small">${c.desc}</span></span></div>`).join('')}</div></details>

    <h3 style="margin-top:14px">Perks</h3><div id="perks"></div>
    <h3 style="margin-top:14px">Gear</h3><div id="gear" style="display:grid;gap:6px"></div>

    <h3 style="margin-top:14px">Customize</h3>
    ${s.portrait ? '' : `<div class="small dim" style="margin-bottom:4px">Face</div><div class="row face-pick" style="margin-bottom:8px">${LOOKS.map(L => `<button class="face-btn${(s.look || 0) === L.id ? ' on' : ''}" data-look="${L.id}" title="${L.name}">${avatar({ ...s, look: L.id }, 48)}</button>`).join('')}</div>`}
    <div class="row">
      <label>Name <input id="nm" value="${esc(s.name)}" maxlength="28"></label>
      <label>Callsign <input id="cs" value="${esc(s.callsign)}" maxlength="16" style="width:110px"></label>
      <label>Sex <select id="sx"><option value="m" ${s.sex === 'm' ? 'selected' : ''}>Male</option><option value="f" ${s.sex === 'f' ? 'selected' : ''}>Female</option></select></label>
      <label>Armor <input type="color" id="c1" value="${s.colors[0]}"></label>
      <label title="Every ${sp.name} wears this accent">Accent (all ${sp.name}s) <input type="color" id="c2" value="${classAccent(S, s.specialty)}"></label>
    </div>
    <div class="row" style="margin-top:6px">${COLOR_PRESETS.map((p, i) => `<button class="preset" data-i="${i}" title="Armor colour" style="padding:0;width:26px;height:26px;background:${p[0]}"></button>`).join('')}</div>
    <div class="spread" style="margin-top:16px"><button class="danger" id="dismiss">Dismiss Soldier</button><span class="dim small">Dismissing is permanent. Gear goes back to the Armory.</span></div>
  </div>`);

  const perks = box.querySelector('#perks');
  PERK_LEVELS.forEach((L, tier) => {
    const pair = sp.perks[tier];
    const chosen = s.perks[tier];
    const pending = s.pendingPerks[0] === L;
    if (!chosen && !pending) { perks.append(el(`<div class="small dim">Level ${L}: ${pair.map(p => p.name).join(' or ')}</div>`)); return; }
    const row = el(`<div class="row" style="margin-bottom:6px"><span class="small dim" style="width:52px">Lv ${L}</span></div>`);
    for (const p of pair) {
      const b = el(`<button class="${chosen === p.id ? 'primary' : ''}" ${!pending ? 'disabled' : ''} title="${esc(p.desc)}"><b>${p.name}</b> <span class="small">${esc(p.desc)}</span></button>`);
      if (pending) b.onclick = async () => { if (await run(() => G.act('perk', { soldier: s.uid, perk: p.id }))) reopen(); };
      row.append(b);
    }
    if (pending) row.append(el('<span class="tag perk">Choose one</span>'));
    perks.append(row);
  });

  const gear = box.querySelector('#gear');
  for (const slot of SLOTS) {
    const cur = s.gear[slot] && G.itemById(s.gear[slot]);
    if (cur && ITEM_BY_ID[cur.base].builtin) {   // fused in: shown, never changeable
      gear.append(el(`<div class="row"><span style="width:62px" class="dim">${slot[0].toUpperCase() + slot.slice(1)}</span><span style="flex:1">${itemLabel(cur)} <span class="small dim">(built in)</span><div class="small dim"><i>${esc(ITEM_BY_ID[cur.base].flavor || '')}</i></div></span></div>`));
      continue;
    }
    const opts = S.items.filter(it => ITEM_BY_ID[it.base].slot === slot && !ITEM_BY_ID[it.base].builtin && G.canWield(s, it))
      .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
    const sel = el(`<select style="flex:1"><option value="">— empty —</option>${opts.map(it => {
      const who = G.equippedBy(it.uid);
      return `<option value="${it.uid}" title="${esc(itemTipText(it))}" ${cur && cur.uid === it.uid ? 'selected' : ''}>${esc(itemLabel(it, true))}${who && who !== s ? ` (on ${esc(who.name)})` : ''}</option>`;
    }).join('')}</select>`);
    sel.onchange = async () => { await run(() => G.act('equip', { soldier: s.uid, slot, item: sel.value || null })); reopen(); };
    const row = el(`<div class="row"><span style="width:62px" class="dim">${slot[0].toUpperCase() + slot.slice(1)}</span></div>`);
    row.append(sel);
    gear.append(row);
    if (cur) gear.append(el(`<div class="small gear-cur">${itemLabel(cur)}${cur.affixes?.length ? ` <span class="affix">${esc(affixSummary(cur))}</span>` : ''}</div>`));
    if (slot === 'weapon') gear.append(el(`<div class="small dim">Can use: ${sp.weapons.join(', ')}</div>`));
  }

  const saveCustom = async () => {
    const fields = { name: box.querySelector('#nm').value, callsign: box.querySelector('#cs').value, sex: box.querySelector('#sx').value,
      colors: [box.querySelector('#c1').value, classAccent(G.state(), s.specialty)] };
    if (await run(() => G.act('customize', { soldier: s.uid, fields }))) { const n = G.soldierById(s.uid); box.querySelector('.avatar').outerHTML = avatar(n, 56); render(); }
  };
  for (const id of ['nm', 'cs', 'sx', 'c1']) box.querySelector('#' + id).onchange = saveCustom;
  box.querySelector('#c2').onchange = async (e) => { if (await run(() => G.act('classColors', { colors: { [s.specialty]: e.target.value } }))) reopen(); };
  for (const b of box.querySelectorAll('.face-btn')) b.onclick = async () => { if (await run(() => G.act('customize', { soldier: s.uid, fields: { look: +b.dataset.look } }))) reopen(); };
  for (const b of box.querySelectorAll('.preset')) b.onclick = () => { const p = COLOR_PRESETS[+b.dataset.i]; box.querySelector('#c1').value = p[0]; saveCustom(); };

  box.querySelector('#x').onclick = closeModal;
  const heal = box.querySelector('#heal');
  if (heal) heal.onclick = async () => { if (await run(() => G.act('heal', { soldier: s.uid }))) { toast(`${s.name} is patched up.`); reopen(); } };
  box.querySelector('#dismiss').onclick = async () => {
    if (!confirm(`Dismiss ${s.name}? This can't be undone.`)) return;
    if (await run(() => G.act('dismiss', { soldier: s.uid }))) { closeModal(); render(); }
  };
  modal(box);
}

// ---------- Armory ----------
function renderArmory() {
  const S = G.state();
  const worn = S.items.filter(it => G.equippedBy(it.uid) && !ITEM_BY_ID[it.base].builtin).length;
  const wrap = el(`<div><div class="spread section" style="max-width:900px"><div><h2>Armory</h2><div class="dim">${S.items.length} items. Equip gear from a Soldier's page in the Barracks. Unequipped gear can be sold for a quarter of its Store price.</div></div>
    <div class="row" id="armorybtns"><button class="danger" id="strip" ${worn ? '' : 'disabled'}>Strip all Equipment</button></div></div><div id="list" style="display:grid;gap:6px;max-width:900px"></div></div>`);
  const list = wrap.querySelector('#list');
  const ae = autoEquipButton(run, render); if (ae) wrap.querySelector('#armorybtns').prepend(ae);
  wrap.querySelector('#strip').onclick = () => {
    const box = el(`<div class="box" style="width:min(460px,94vw)"><h2>Strip all Equipment?</h2>
      <p>Every Soldier hands in their gear: <b>${worn}</b> item${worn === 1 ? '' : 's'} go${worn === 1 ? 'es' : ''} back to the Armory. Nothing is sold or lost, but your Soldiers will be unarmed until you re-equip them.</p>
      <p class="small dim">Built-in enhancements stay where they are.</p>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button id="no">Cancel</button><button class="danger" id="yes">Strip everything</button></div></div>`);
    box.querySelector('#no').onclick = closeModal;
    box.querySelector('#yes').onclick = async (e) => {
      e.target.disabled = true;
      const r = await run(() => G.act('stripAll'));
      if (r) { closeModal(); toast(`${r.stripped} item${r.stripped === 1 ? '' : 's'} returned to the Armory.`); render(); } else e.target.disabled = false;
    };
    modal(box);
  };
  const prefs = loadPrefs('bt.armoryFilter', ARMORY_DEFAULTS);
  const iname = (it) => itemLabel(it, true).replace(/ \[[^\]]*\]$/, '');
  const slotOrd = (it) => SLOTS.indexOf(ITEM_BY_ID[it.base].slot), rarOrd = (it) => RARITY_ORDER.indexOf(it.rarity);
  const SORTS = { rarity: rarOrd, name: iname, price: it => G.sellPrice(it) };
  const wtypes = [...new Set(S.items.map(it => ITEM_BY_ID[it.base]).filter(b => b.slot === 'weapon' && b.type).map(b => b.type))].sort();
  if (!wtypes.includes(prefs.wtype)) prefs.wtype = 'all';   // a saved type you no longer own would hide everything
  const buildRow = (it) => {
    const who = G.equippedBy(it.uid);
    const row = el(`<div class="item"><span>${itemLabel(it)} <span class="dim small">${ITEM_BY_ID[it.base].slot}</span>${ITEM_BY_ID[it.base].flavor ? `<div class="small dim"><i>${esc(ITEM_BY_ID[it.base].flavor)}</i></div>` : ''}</span>
      <span class="row">${who ? `<span class="dim small">on ${esc(who.name)}</span>` : `<button class="sell">Sell (${G.sellPrice(it)})</button>`}</span></div>`);
    const b = row.querySelector('.sell');
    if (b) b.onclick = async () => {
      if (RARITY_ORDER.indexOf(it.rarity) >= RARITY_ORDER.indexOf('prototype') && !confirm(`Sell ${itemLabel(it, true)} for ${G.sellPrice(it)} BUCs?`)) return;
      if (await run(() => G.act('sell', { item: it.uid }))) render();
    };
    return row;
  };
  const apply = () => {
    const q = prefs.q.trim().toLowerCase();
    const rows = S.items.filter(it => {
      const base = ITEM_BY_ID[it.base], who = G.equippedBy(it.uid);
      return (prefs.slot === 'all' || base.slot === prefs.slot) && (prefs.rarity === 'all' || it.rarity === prefs.rarity) &&
        (prefs.status === 'all' || (prefs.status === 'equipped' ? !!who : !who)) &&
        (prefs.wtype === 'all' || (base.slot === 'weapon' && base.type === prefs.wtype)) &&
        (!q || iname(it).toLowerCase().includes(q));
    });
    const dir = prefs.dir === 'asc' ? 1 : -1, key = SORTS[prefs.sort];
    if (key) rows.sort((a, b) => { const x = key(a), y = key(b); return dir * (typeof x === 'string' ? cmpStr(x, y) : x - y) || cmpStr(iname(a), iname(b)); });
    else { rows.sort((a, b) => slotOrd(a) - slotOrd(b) || rarOrd(b) - rarOrd(a)); if (prefs.dir === 'asc') rows.reverse(); }
    list.replaceChildren(...rows.map(buildRow));
    if (!rows.length) list.append(el('<div class="dim empty">No items match these filters.</div>'));
    bar.querySelector('.fcount').textContent = `Showing ${rows.length} of ${S.items.length}`;
  };
  const bar = listToolbar('bt.armoryFilter', prefs, ARMORY_DEFAULTS, [
    { k: 'slot', label: 'Slot', opts: [['all', 'All slots'], ...SLOTS.map(s => [s, cap(s)])] },
    { k: 'rarity', label: 'Rarity', opts: [['all', 'All rarities'], ...RARITY_ORDER.map(r => [r, RARITY_BY_ID[r].name])] },
    { k: 'status', label: 'Status', opts: [['all', 'Equipped or not'], ['equipped', 'Equipped'], ['free', 'Not equipped']] },
    ...(wtypes.length ? [{ k: 'wtype', label: 'Weapon type', opts: [['all', 'All weapon types'], ...wtypes.map(w => [w, cap(w)])] }] : []),
    { k: 'q', label: 'Search name', search: true },
  ], [['default', 'Sort: Default'], ['rarity', 'Sort: Rarity'], ['name', 'Sort: Name'], ['price', 'Sort: Sell price']], apply);
  list.before(bar);
  apply();
  panel.append(wrap);
}

// ---------- Mission log ----------
function renderLog() {
  const S = G.state();
  const ach = EASTER_EGGS.filter(e => e.kind === 'achievement');
  const got = new Set(S.achievements || []);
  const found = SECRET_SHIPS.filter(s => (S.discovered || []).includes(s.id));
  const wrap = el(`<div><h2>Mission Log</h2>
    <div class="section"><h3>Achievements <span class="dim small">${got.size}/${ach.length}</span></h3>
      ${ach.map(a => `<div class="medal-row ${got.has(a.id) ? '' : 'dim'}"><span>${got.has(a.id) ? '★' : '☆'}</span><span><b>${esc(a.data.name)}</b> <span class="small">${esc(a.data.how)}</span></span></div>`).join('')}
      <div class="small dim" style="margin-top:6px">Unknown contacts identified: ${found.length}/${SECRET_SHIPS.length}${found.length ? ' · ' + found.map(s => esc(s.name)).join(', ') : ''}</div></div>
    <div class="dim section">Last ${S.history.length} missions. Replays re-run the exact same mission from its seed.</div><div id="list" style="display:grid;gap:8px;max-width:900px"></div></div>`);
  const list = wrap.querySelector('#list');
  if (!S.history.length) list.append(el('<div class="dim">No missions yet. Head to Deploy.</div>'));
  for (const h of S.history) {
    const kia = h.soldiers.filter(x => x.fate === 'kia').length;
    const row = el(`<div class="card"><div class="spread"><div><b class="result-${h.result}">${{ success: 'SHIP TAKEN', retreat: 'RETREAT', wipe: 'SQUAD LOST' }[h.result]}</b> · ${esc(h.shipName)}
      <div class="small dim">${new Date(h.at).toLocaleString()} · ${h.entry} · ${h.tactic} · +${h.bucs} BUCs${h.creds ? ` · +${h.creds} CREDs` : ''}${kia ? ` · <span class="bad">${kia} KIA</span>` : ''}</div></div>
      ${h.input ? '<button>Watch replay</button>' : ''}</div>
      ${h.defense ? `<div class="small" style="margin-top:6px">🚨 Then the Mothership was boarded (${esc(h.defense.threatName)}): <b class="result-${h.defense.result === 'lost' ? 'wipe' : h.defense.result}">${{ success: 'HELD', lost: 'BRIDGE LOST', wipe: 'DEFENDERS DOWN' }[h.defense.result]}</b>${h.defense.soldiers.some(x => x.fate === 'kia') ? ` · <span class="bad">${h.defense.soldiers.filter(x => x.fate === 'kia').length} KIA</span>` : ''}${h.defense.stolen ? ` · −${h.defense.stolen} BUCs` : ''} <button class="small" data-defense style="padding:2px 8px">Watch defense</button></div>` : ''}</div>`);
    const b = row.querySelector('button:not([data-defense])'); if (b) b.onclick = () => replayMission(panel, h);
    const bd = row.querySelector('[data-defense]'); if (bd) bd.onclick = () => replayMission(panel, h.defense);
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
  for (const m of S.memorial) list.append(el(`<div class="card${m.suicideSquad ? ' mem-ss' : ''}">${memorialBadges(m)}<div class="soldier-head">${avatar(m)}${levelBadge(m.level, (m.colors || [])[1], 'sm')}<div><div class="name">${esc(m.name)} ${m.callsign ? `<span class="callsign">"${esc(m.callsign)}"</span>` : ''}</div>
    <div class="small dim">${SPECIALTY_BY_ID[m.specialty].name} · Lv ${m.level} · ${m.missions} missions · ${m.kills} kills</div>
    <div class="small">${esc(m.diedHow || 'Fell on the ' + m.diedOn)}, ${new Date(m.diedAt).toLocaleDateString()}${m.gearLost ? ' · <span class="bad">gear lost</span>' : ''}</div>
    ${m.recovered ? '<div class="small warn">Remains signed out of the morgue. The name on the form is blacked out.</div>' : ''}
    <div class="small dim">${m.record?.successes || 0} ships taken · ${m.record?.revives || 0} revives · Downed ${m.record?.downed || 0}×</div>
    ${ribbons(m.medals || [])}</div></div></div>`));
  panel.append(wrap);
}

initWhatsNew(APP_VERSION);
refreshTop();
start();
