// Local save (Phase 3). Phase 5 moves the authoritative copy to Supabase (bp_ tables);
// until then everything lives in localStorage under SAVE_KEY.
import { createRng, randomSeed } from '../engine/rng.js';
import { growSoldier, applyXp, sumMods, applyStatMods, itemMods, rollItem } from '../engine/progression.js';
import { STARTING_BUCS, STARTER_SQUAD, ROSTER_CAP, FIRST_NAMES, LAST_NAMES, CALLSIGNS, COLOR_PRESETS, SEXES, GRADE_BY_ID } from '../data/economy.js';
import { SPECIALTIES, SPECIALTY_BY_ID } from '../data/specialties.js';
import { ITEM_BY_ID, ROLLABLE_ITEMS, SLOTS } from '../data/gear.js';
import { INJURY_BY_ID, healMs, HEAL_COST, BENCH_SEVERITY, MAX_INJURIES } from '../data/injuries.js';
import { MIA_RETURN_MIN } from '../data/entries.js';
import { STATS, PERK_LEVELS } from '../data/stats.js';

const SAVE_KEY = 'bt_save_v1';
export const HIRE_PRICE = GRADE_BY_ID.rookie.price;

let S = null;
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const state = () => S;
// BUCs earned by a mission are hidden from the top bar until its playback ends (no spoilers).
let heldBucs = 0;
export const shownBucs = () => S.bucs - heldBucs;
export function holdBucs(n) { heldBucs = n; for (const fn of listeners) fn(S); }

export function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); for (const fn of listeners) fn(S); }
export function load() {
  try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { S = null; }
  if (!S || S.v !== 1) { S = newGame(); save(); }
  tick();
  return S;
}
export function resetGame() { S = newGame(); save(); }

const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);

function newGame() {
  const g = { v: 1, bucs: STARTING_BUCS, soldiers: [], items: [], memorial: [], history: [], missions: 0, created: Date.now() };
  S = g;
  const rng = createRng(randomSeed());
  for (const st of STARTER_SQUAD) {
    const s = makeRecruit(rng, st.specialty, 1);
    for (const slot of ['weapon', 'armor', 'utility']) if (st[slot]) { const it = addItem({ base: st[slot], rarity: 'standard', affixes: [] }); s.gear[slot] = it.uid; }
    g.soldiers.push(s);
  }
  return g;
}

export function makeRecruit(rng, specialty, level = 1) {
  const sex = SEXES[rng.int(SEXES.length)];
  const g = growSoldier(rng, specialty, level);
  return {
    uid: uid('s'), name: FIRST_NAMES[sex][rng.int(FIRST_NAMES[sex].length)] + ' ' + LAST_NAMES[rng.int(LAST_NAMES.length)],
    callsign: rng.roll(50) ? CALLSIGNS[rng.int(CALLSIGNS.length)] : '', sex,
    colors: COLOR_PRESETS[rng.int(COLOR_PRESETS.length)].slice(),
    specialty, level, xp: 0, stats: g.stats, perks: g.perks, pendingPerks: [],
    gear: {}, injuries: [], status: 'ready', miaUntil: 0, missions: 0, kills: 0, hired: Date.now(),
  };
}
export function addItem(inst) { const it = { uid: uid('i'), ...inst }; S.items.push(it); return it; }
export const itemById = (id) => S.items.find(i => i.uid === id);
export const soldierById = (id) => S.soldiers.find(s => s.uid === id);
export const equippedBy = (itemUid) => S.soldiers.find(s => Object.values(s.gear).includes(itemUid));

// ---------- Time-based upkeep: heal injuries, bring MIA Soldiers home ----------
export function tick() {
  const now = Date.now(); let changed = false;
  for (const s of S.soldiers) {
    const before = s.injuries.length;
    s.injuries = s.injuries.filter(i => i.until > now);
    if (s.injuries.length !== before) changed = true;
    if (s.status === 'mia' && s.miaUntil <= now) { s.status = 'ready'; changed = true; }
  }
  if (changed) save();
  return changed;
}

export function condition(s) {
  if (s.status === 'mia') return 'mia';
  if (s.injuries.some(i => INJURY_BY_ID[i.id].severity >= BENCH_SEVERITY)) return 'benched';
  if (s.injuries.length) return 'wounded';
  return 'healthy';
}
export const canDeploy = (s) => s.status === 'ready' && condition(s) !== 'benched';

export function healCost(s) {
  const now = Date.now(); let c = 0;
  for (const i of s.injuries) {
    const full = healMs(i.id), left = Math.max(0, i.until - now);
    c += Math.max(5, Math.ceil((HEAL_COST[INJURY_BY_ID[i.id].severity] * left) / full));
  }
  return c;
}
export function healNow(s) {
  const c = healCost(s); if (!c || S.bucs < c) return false;
  S.bucs -= c; s.injuries = []; save(); return true;
}

export function equip(s, slot, itemUid) {
  if (itemUid) { const other = equippedBy(itemUid); if (other) delete other.gear[slot]; s.gear[slot] = itemUid; }
  else delete s.gear[slot];
  save();
}
export function canWield(s, item) {
  const base = ITEM_BY_ID[item.base];
  if (base.slot !== 'weapon') return true;
  return SPECIALTY_BY_ID[s.specialty].weapons.includes(base.type);
}

export function choosePerk(s, perkId) {
  const L = s.pendingPerks.shift(); if (L === undefined) return;
  const tier = PERK_LEVELS.indexOf(L);
  const perks = s.perks.slice(); perks[tier] = perkId; s.perks = perks; save();
}

export function hireRookie(specialty) {
  if (S.bucs < HIRE_PRICE || S.soldiers.length >= ROSTER_CAP) return null;
  S.bucs -= HIRE_PRICE;
  const s = makeRecruit(createRng(randomSeed()), specialty, 1);
  S.soldiers.push(s); save(); return s;
}
export function dismiss(s) { S.soldiers = S.soldiers.filter(x => x !== s); save(); }

// Gear instances for the engine (gear slot -> {base, rarity, affixes}).
export function gearOf(s) {
  const g = {};
  for (const slot of SLOTS) { const it = s.gear[slot] && itemById(s.gear[slot]); if (it) g[slot] = { base: it.base, rarity: it.rarity, affixes: it.affixes }; }
  return g;
}
// Effective stats with gear and injuries (what the Soldier fights with, before tactic/entry).
export function effectiveStats(s) {
  const g = gearOf(s);
  const mods = sumMods([...Object.values(g).map(itemMods), ...s.injuries.map(i => INJURY_BY_ID[i.id].mods)]);
  return applyStatMods(s.stats, mods);
}
export function engineSoldier(s) {
  return { uid: s.uid, name: s.name, specialty: s.specialty, level: s.level, stats: s.stats, perks: s.perks.filter(Boolean), gear: gearOf(s), injuries: s.injuries.map(i => i.id) };
}

// ---------- Apply a finished mission (called BEFORE playback so a refresh can't undo it) ----------
export function applyMission(input, battle, after, shipName) {
  const now = Date.now();
  const rng = createRng(input.seed ^ 0x5bd1e995);
  const report = { at: now, seed: input.seed, ship: input.ship, shipName, entry: input.entry, tactic: input.tactic, retreat: input.retreat,
    result: battle.result, bucs: after.bucs, soldiers: [], extras: [],
    input, colors: Object.fromEntries(input.squad.map(sq => [sq.uid, soldierById(sq.uid)?.colors])) };   // enough to re-run the replay
  S.bucs += after.bucs; S.missions++;
  after.soldiers.forEach((a, i) => {
    const s = soldierById(a.uid); if (!s) return;
    const rec = battle.soldiers[i];
    const line = { uid: s.uid, name: s.name, specialty: s.specialty, state: a.state, fate: a.fate, kiaChance: a.kiaChance, xp: a.xp, injuries: a.injuries, kills: rec.kills, levelUps: [] };
    s.missions++; s.kills += rec.kills;
    if (a.fate === 'kia') {
      const lost = a.state === 'left';   // left on board: their gear is lost with them
      if (lost) for (const slot in s.gear) S.items = S.items.filter(it => it.uid !== s.gear[slot]);
      S.memorial.unshift({ ...s, gear: {}, diedAt: now, diedOn: shipName, gearLost: lost });
      S.soldiers = S.soldiers.filter(x => x !== s);
      line.gearLost = lost;
    } else {
      const up = applyXp(rng, s, a.xp);
      s.level = up.level; s.xp = up.xp; s.stats = up.stats; s.pendingPerks.push(...up.perkPending);
      line.levelUps = up.levelUps;
      for (const id of a.injuries) if (s.injuries.length < MAX_INJURIES) s.injuries.push({ id, until: now + healMs(id, a.healTimePct) });
      if (a.fate === 'mia') { s.status = 'mia'; s.miaUntil = now + MIA_RETURN_MIN * 60e3; }
    }
    report.soldiers.push(line);
  });
  if (after.gearDrop) {
    const base = ROLLABLE_ITEMS[rng.int(ROLLABLE_ITEMS.length)];
    const it = addItem(rollItem(rng, base.id, { floor: 'milspec' }));
    report.extras.push({ kind: 'item', item: it });
  }
  if (after.prisoner && S.soldiers.length < ROSTER_CAP) {
    const r = makeRecruit(rng, SPECIALTIES[rng.int(SPECIALTIES.length)].id, 1 + rng.int(3));
    S.soldiers.push(r); report.extras.push({ kind: 'recruit', name: r.name, specialty: r.specialty });
  }
  S.history.unshift(report); S.history = S.history.slice(0, 20);
  save();
  return report;
}

export { STATS };
