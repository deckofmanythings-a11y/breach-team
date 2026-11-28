// boarding-api — the whole Breach Team backend, dispatched on `action`.
// Server-authoritative: the player's save lives in bp_players and only changes here, through the
// same js/game/rules.js the browser ships (synced into _shared/breach by scripts/sync-engine.mjs).
// Missions run here with a server-chosen seed; the browser re-simulates from the returned input
// and checks the hash before playing it back.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import * as R from '../_shared/breach/game/rules.js';
import { ENGINE_VERSION } from '../_shared/breach/data/version.js';
import { weeklyContract, backfillStats } from '../_shared/breach/game/ladder.js';
import { restartAccount, newCommander } from '../_shared/breach/game/commander.js';
import { stripAll } from '../_shared/breach/game/armory.js';
import { applyClassAccents, setClassAccents } from '../_shared/breach/game/class-colors.js';
import { classAccent } from '../_shared/breach/data/class-colors.js';
import { buildRoom, repairRoom } from '../_shared/breach/game/mothership.js';
import { buyQuartermaster, autoEquip, saveSquads } from '../_shared/breach/game/quartermaster.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
class Fail extends Error { constructor(msg: string, public status = 400) { super(msg); } }

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    const p = JSON.parse(raw);
    if (typeof p === 'string') return p;
    if (p.default) return p.default;
    const first = Object.values(p)[0];
    if (typeof first === 'string') return first;
  }
  throw new Error('No service role key available.');
}
const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false } });

async function userId(req: Request): Promise<string> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) throw new Fail('Not signed in.', 401);
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) throw new Fail('Session expired, please sign in again.', 401);
  return data.user.id;
}

type Row = { user_id: string; display_name: string; save: any; version: number };
async function loadRow(uid: string): Promise<Row | null> {
  const r = await db.from('bp_players').select('user_id, display_name, save, version').eq('user_id', uid).maybeSingle();
  if (r.error) throw new Fail('Load failed: ' + r.error.message, 500);
  return r.data as Row | null;
}

// Load the save, run `fn` on it (plus upkeep), write it back with an optimistic lock.
// Retries if another request changed the save in between.
// After a Game Over only `me`, `restart` and `newCommander` may touch the save.
async function withSave(uid: string, fn: (g: any, now: number) => any, allowGameOver = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await loadRow(uid);
    if (!row) throw new Fail('No commander profile yet.', 409);
    const g = applyClassAccents(R.migrate(row.save));
    if (g.gameOver && !allowGameOver) throw new Fail('Game over: your commander has no Soldiers left. Start a new commander first.', 409);
    const now = Date.now();
    const notes = R.upkeep(g, now);
    let out: any;
    try { out = fn(g, now) || {}; applyClassAccents(g); }
    catch (e) { if (e instanceof R.GameError) throw new Fail(e.message); throw e; }
    const w = await db.from('bp_players').update({ save: g, version: row.version + 1, updated_at: new Date(now).toISOString() })
      .eq('user_id', uid).eq('version', row.version).select('version');
    if (w.error) throw new Fail('Save failed: ' + w.error.message, 500);
    if (w.data?.length) return { ...out, save: g, notes, name: row.display_name };
  }
  throw new Fail('Your save was busy, try again.', 409);
}

const storeView = (g: any, now: number) => {
  const day = R.storeDay(now);
  const stock = R.storeStock(day);
  stock.soldiers = stock.soldiers.map((s: any) => ({ ...s, colors: [s.colors[0], classAccent(g, s.specialty)] }));
  return { ...stock, bought: g.store?.day === day ? g.store.bought : [] };
};

async function names(ids: string[]) {
  if (!ids.length) return {} as Record<string, string>;
  const r = await db.from('bp_players').select('user_id, display_name').in('user_id', ids);
  if (r.error) throw new Fail('Names: ' + r.error.message, 500);
  return Object.fromEntries((r.data || []).map((p: any) => [p.user_id, p.display_name]));
}

const actions: Record<string, (uid: string, b: any) => Promise<unknown>> = {
  // This week's contract + its leaderboard (each player's best run).
  async contract(uid) {
    const c = weeklyContract(Date.now());
    const r = await db.from('bp_missions').select('id, user_id, score, result, kia, squad_size, at, entry, tactic')
      .eq('contract_week', c.week).order('score', { ascending: false }).order('at', { ascending: true }).limit(500);
    if (r.error) throw new Fail('Leaderboard: ' + r.error.message, 500);
    const best = new Map<string, any>(), runs: Record<string, number> = {};
    for (const m of r.data || []) { runs[m.user_id] = (runs[m.user_id] || 0) + 1; if (!best.has(m.user_id)) best.set(m.user_id, m); }
    const rows = [...best.values()];
    const nm = await names(rows.map(m => m.user_id));
    const board = rows.map((m, i) => ({ rank: i + 1, name: nm[m.user_id] || '?', me: m.user_id === uid, mission: m.id, score: m.score, result: m.result, kia: m.kia,
      squad: m.squad_size, entry: m.entry, tactic: m.tactic, at: m.at, runs: runs[m.user_id] }));
    return { contract: c, board: board.slice(0, 50), mine: board.find(b => b.me) || null };
  },
  // Career board: lifetime stats of every commander (secrets are only counted).
  async ladder(uid) {
    const r = await db.from('bp_players').select('user_id, display_name, stats:save->stats, discovered:save->discovered, missions:save->missions').limit(1000);
    if (r.error) throw new Fail('Ladder: ' + r.error.message, 500);
    const rows = (r.data || []).map((p: any) => {
      const st = p.stats || backfillStats({ missions: p.missions || 0 });
      return { name: p.display_name, me: p.user_id === uid, ...st, secrets: Array.isArray(p.discovered) ? p.discovered.length : 0 };
    });
    return { rows };
  },
  // Replay any contract run on the board (contract runs only: other missions stay private).
  async replay(uid, b) {
    const id = Number(b.mission);
    if (!Number.isInteger(id)) throw new Fail('Bad replay id.');
    const r = await db.from('bp_missions').select('id, user_id, input, engine_version, hash, score, result, contract_week, ship').eq('id', id).not('contract_week', 'is', null).maybeSingle();
    if (r.error) throw new Fail('Replay: ' + r.error.message, 500);
    if (!r.data) throw new Fail("That replay isn't available.", 404);
    const nm = await names([r.data.user_id]);
    return { replay: { ...r.data, user_id: undefined, name: nm[r.data.user_id] || '?' } };
  },
  async me(uid) {
    const row = await loadRow(uid);
    if (!row) return { needsName: true };
    return withSave(uid, (g, now) => ({ store: storeView(g, now) }), true);
  },
  async register(uid, b) {
    const name = String(b.display_name || '').trim();
    if (name.length < 2 || name.length > 20 || !/^[\p{L}\p{N} _.'-]+$/u.test(name)) throw new Fail('Display name: 2–20 letters, numbers, spaces or _ . \' -');
    if (await loadRow(uid)) throw new Fail('You already have a commander profile.');
    const g = applyClassAccents(R.newGame(Date.now()));
    const r = await db.from('bp_players').insert({ user_id: uid, display_name: name, save: g });
    if (r.error) throw new Fail(r.error.code === '23505' ? 'That name is taken.' : 'Could not create profile: ' + r.error.message, r.error.code === '23505' ? 400 : 500);
    return { save: g, name, notes: [], store: storeView(g, Date.now()) };
  },
  restart: (uid) => withSave(uid, (g, now) => ({ ...restartAccount(g, now), store: storeView(g, now) }), true),
  newCommander: (uid) => withSave(uid, (g, now) => ({ ...newCommander(g, now), store: storeView(g, now) }), true),
  heal: (uid, b) => withSave(uid, (g, now) => R.heal(g, b.soldier, now)),
  equip: (uid, b) => withSave(uid, (g) => R.equip(g, b.soldier, b.slot, b.item || null)),
  stripAll: (uid) => withSave(uid, (g) => stripAll(g)),
  classColors: (uid, b) => withSave(uid, (g) => setClassAccents(g, b.colors)),
  perk: (uid, b) => withSave(uid, (g) => R.choosePerk(g, b.soldier, b.perk)),
  customize: (uid, b) => withSave(uid, (g) => R.customize(g, b.soldier, b.fields || {})),
  hire: (uid, b) => withSave(uid, (g, now) => R.hire(g, b.specialty, now)),
  dismiss: (uid, b) => withSave(uid, (g) => R.dismiss(g, b.soldier)),
  sell: (uid, b) => withSave(uid, (g) => R.sellItem(g, b.item)),
  pack: (uid, b) => withSave(uid, (g, now) => R.openPack(g, b.pack, now)),
  buildRoom: (uid, b) => withSave(uid, (g) => buildRoom(g, String(b.room || ''))),
  repairRoom: (uid, b) => withSave(uid, (g) => repairRoom(g, String(b.room || ''))),
  buyQuartermaster: (uid) => withSave(uid, (g) => buyQuartermaster(g)),
  autoEquip: (uid, b) => withSave(uid, (g) => autoEquip(g, Array.isArray(b.soldiers) ? b.soldiers.slice(0, 48) : [])),
  saveSquads: (uid, b) => withSave(uid, (g) => saveSquads(g, b.squads)),
  buy: (uid, b) => withSave(uid, (g, now) => ({ ...R.buyStore(g, b.slot, now), store: storeView(g, now) })),
  async deploy(uid, b) {
    let mission: any = null;
    const out = await withSave(uid, (g, now) => { mission = R.runMission(g, b.plan || {}, now); return { report: mission.report }; });
    const { input, battle, after } = mission;
    const ins = await db.from('bp_missions').insert({
      user_id: uid, ship: input.ship, entry: input.entry, tactic: input.tactic, retreat: input.retreat, result: battle.result,
      squad_size: input.squad.length, kia: after.soldiers.filter((s: any) => s.fate === 'kia').length, bucs: after.bucs,
      seed: input.seed, engine_version: ENGINE_VERSION, hash: battle.hash, input,
      contract_week: mission.report.contract?.week ?? null, score: mission.report.contract?.score ?? null,
    });
    if (ins.error) console.error('bp_missions insert failed', ins.error.message);   // the save already counts; log only
    return out;
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const fn = actions[body.action];
    if (!fn) throw new Fail('Unknown action.');
    const uid = await userId(req);
    return json({ ok: true, ...(await fn(uid, body) as object) });
  } catch (e) {
    const status = e instanceof Fail ? e.status : 500;
    if (status >= 500) console.error(e);
    return json({ ok: false, error: (e as Error).message || String(e) }, status);
  }
});
