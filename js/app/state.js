// Client view of the player's save. The server (boarding-api) owns the save; every change is an
// API call that returns the updated save. Read-only helpers come from the shared rules module.
import * as R from '../game/rules.js';
import * as api from './api.js';
import { toast } from './ui.js';

let S = null, NAME = '', STORE = null;
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const notify = () => { for (const fn of listeners) fn(S); };

export const state = () => S;
export const playerName = () => NAME;
export const store = () => STORE;
export const signedIn = () => !!S;

export function setFrom(r) {
  if (r.save) S = r.save;
  if (r.name) NAME = r.name;
  if (r.store) STORE = r.store;
  for (const n of r.notes || []) toast(n);
  notify();
}
export function clear() { S = null; NAME = ''; STORE = null; notify(); }

// Returns 'name' if this account still needs a commander profile.
export async function boot() {
  const r = await api.call('me');
  if (r.needsName) return 'name';
  setFrom(r); return 'ok';
}
export async function register(displayName) { const r = await api.call('register', { display_name: displayName }); setFrom(r); return r; }
export async function act(action, payload = {}) { const r = await api.call(action, payload); setFrom(r); return r; }

// Refresh from the server when a healing timer or MIA return is due (the server applies upkeep).
let refreshing = false, lastRefresh = 0;
export async function refreshIfDue() {
  if (!S || refreshing || Date.now() - lastRefresh < 5000) return false;
  const now = Date.now();
  const due = S.soldiers.some(s => s.injuries.some(i => i.until <= now) || (s.status === 'mia' && s.miaUntil <= now));
  if (!due) return false;
  refreshing = true; lastRefresh = now;
  try { await act('me'); return true; } catch { return false; } finally { refreshing = false; }
}

// BUCs earned by a mission are hidden from the top bar until its playback ends (no spoilers).
let heldBucs = 0;
export const shownBucs = () => (S ? S.bucs - heldBucs : 0);
export function holdBucs(n) { heldBucs = n; notify(); }

// ---------- Read-only helpers ----------
export const HIRE_PRICE = R.HIRE_PRICE;
export const condition = R.condition;
export const canDeploy = R.canDeploy;
export const canWield = R.canWield;
export const healCost = (s) => R.healCost(s);
export const effectiveStats = (s) => R.effectiveStats(S, s);
export const itemById = (id) => R.itemById(S, id);
export const soldierById = (id) => R.soldierById(S, id);
export const equippedBy = (id) => R.equippedBy(S, id);
export const sellPrice = R.sellPrice;
