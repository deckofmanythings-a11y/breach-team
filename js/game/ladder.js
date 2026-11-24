// 72-hour Contract + scoring + lifetime stats. Shared by the browser and boarding-api.
// Each contract is derived from its 72-hour period itself (Pacific time), so nobody can pick it:
// every player boards the same ship on the same map (mapSeed); the fight itself still rolls fresh.
import { hashString } from '../engine/rng.js';
import { SHIPS, SHIP_BY_ID, OBJECTIVES } from '../data/ships.js';
import { RETREAT_AT_TICK } from '../data/stats.js';

export const SCORE = {
  success: 1000,        // took the ship
  objective: 150,       // each optional objective done
  kill: 10,             // each enemy killed
  speedPerSec: 4,       // success only: per second faster than the 90 s retreat deadline
  downed: -40,          // each Soldier who went Down (even if they lived)
  kia: -300,            // each Soldier who died
  left: -150,           // each Soldier left aboard (on top of any death)
};
export const TICKS_PER_SEC_FOR_SCORE = 8;

// 72-hour contracts: a new one starts at 00:00 America/Los_Angeles every 3rd Pacific calendar day,
// counted from CONTRACT_ANCHOR. Returns { id: 'YYYY-MM-DD' (the Pacific date it started), endsAt (ms) }.
// (Still called contractWeek / `week` in the API and bp_missions.contract_week for compatibility.)
export const CONTRACT_DAYS = 3;
const CONTRACT_ANCHOR = Date.UTC(2026, 10, 24);   // 2026-11-24, the first 72-hour contract
const PT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function ptParts(t) { return Object.fromEntries(PT.formatToParts(new Date(t)).map(p => [p.type, +p.value || 0])); }
function ptOffset(t) { const p = ptParts(t); return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000; }
// The real instant of 00:00 Pacific on the given UTC-midnight date stamp.
function ptMidnight(dayUtc) { return dayUtc - ptOffset(dayUtc + 12 * 3600e3); }
export function contractWeek(now = Date.now()) {
  const p = ptParts(now);
  const today = Date.UTC(p.year, p.month - 1, p.day);
  const idx = Math.floor((today - CONTRACT_ANCHOR) / (CONTRACT_DAYS * 86400e3));
  const start = CONTRACT_ANCHOR + idx * CONTRACT_DAYS * 86400e3;
  return { id: new Date(start).toISOString().slice(0, 10), endsAt: ptMidnight(start + CONTRACT_DAYS * 86400e3) };
}

// The contract itself: which ship, which map, which 72-hour period.
export function weeklyContract(now = Date.now()) {
  const w = contractWeek(now);
  const h = hashString('contract:' + w.id);
  const ship = SHIPS[h % SHIPS.length];
  return { week: w.id, days: CONTRACT_DAYS, endsAt: w.endsAt, ship: ship.id, shipName: ship.name, mapSeed: (h ^ 0x9e3779b9) >>> 0, tier: ship.tier };
}

// Score a finished contract run (from the server's battle record + aftermath).
export function contractScore(battle, after) {
  let s = 0;
  const success = battle.result === 'success';
  if (success) s += SCORE.success + Math.max(0, Math.floor((RETREAT_AT_TICK - battle.ticks) / TICKS_PER_SEC_FOR_SCORE)) * SCORE.speedPerSec;
  s += battle.objectives.filter(o => o.done && o.id !== 'take_bridge' && OBJECTIVES[o.id]).length * SCORE.objective;
  s += battle.enemies.killed * SCORE.kill;
  for (const x of battle.soldiers) { if (x.downed) s += SCORE.downed; if (x.state === 'left') s += SCORE.left; }
  for (const a of after.soldiers) if (a.fate === 'kia') s += SCORE.kia;
  return s;   // can be negative: a wipe that killed six beats a wipe that killed none
}

// ---------- Lifetime stats (career board) ----------
export function emptyStats() { return { missions: 0, successes: 0, kills: 0, kia: 0, bucs: 0, alienWins: 0, contracts: 0, bestLevel: 1 }; }
// Best-effort backfill for saves made before stats existed.
export function backfillStats(g) {
  const st = emptyStats();
  st.missions = g.missions || 0;
  st.successes = (g.history || []).filter(h => h.result === 'success').length;
  st.kills = [...(g.soldiers || []), ...(g.memorial || [])].reduce((n, s) => n + (s.kills || 0), 0);
  st.kia = (g.memorial || []).length;
  st.bucs = (g.history || []).reduce((n, h) => n + (h.bucs || 0), 0);
  st.alienWins = (g.history || []).filter(h => h.result === 'success' && SHIP_BY_ID[h.ship]?.alien).length;
  st.bestLevel = Math.max(1, ...[...(g.soldiers || []), ...(g.memorial || [])].map(s => s.level || 1));
  return st;
}
export function recordStats(g, input, battle, after, contract) {
  const st = (g.stats ||= emptyStats());   // saves get stats at creation / migration (backfilled before any new mission)
  st.missions++;
  if (battle.result === 'success') { st.successes++; if (SHIP_BY_ID[input.ship]?.alien) st.alienWins++; }
  st.kills += battle.soldiers.reduce((n, s) => n + s.kills, 0);
  st.kia += after.soldiers.filter(a => a.fate === 'kia').length;
  st.bucs += after.bucs;
  if (contract) st.contracts++;
  st.bestLevel = Math.max(st.bestLevel, ...g.soldiers.map(s => s.level || 1));
  return st;
}

// Career board columns (all derived from the save; secrets are only ever counted, never named).
export const CAREER_COLUMNS = [
  { id: 'successes', name: 'Ships taken' },
  { id: 'missions',  name: 'Missions' },
  { id: 'kills',     name: 'Kills' },
  { id: 'alienWins', name: 'Alien ships taken' },
  { id: 'bucs',      name: 'BUCs earned' },
  { id: 'bestLevel', name: 'Best Soldier level' },
  { id: 'kia',       name: 'Soldiers lost' },
  { id: 'secrets',   name: 'Unknown contacts' },
];
