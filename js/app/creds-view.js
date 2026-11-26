// CREDs in the top bar. Like BUCs, a mission's CREDs stay hidden until its playback ends.
// (New file: state.js is cached as ?v=3 everywhere, so new exports can't go there.)
import * as G from './state.js?v=3';

let held = 0;
export const shownCreds = () => { const S = G.state(); return S ? (S.creds || 0) - held : 0; };
export function holdCreds(n) { held = n || 0; }

// One-time notice for commanders whose CREDs were backfilled from XP they'd already earned.
const SEEN = 'bt_creds_backfill_seen';
export function backfillNotice() {
  const S = G.state();
  if (!S?.credsBackfill || localStorage.getItem(SEEN)) return null;
  localStorage.setItem(SEEN, '1');
  return `New currency: CREDs, for building the Mothership. You've earned 1 CRED for every XP point, starting with ${S.credsBackfill.toLocaleString()} for your squad's past missions.`;
}
