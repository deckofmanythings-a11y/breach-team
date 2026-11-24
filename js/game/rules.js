// Game rules that change a player's save. PURE: no storage, no DOM, no network.
// The boarding-api Edge Function runs these (server-authoritative); the browser uses the
// read-only helpers to display things. Every mutation throws GameError on a bad request.
import { createRng, randomSeed, hashString } from '../engine/rng.js';
import { growSoldier, applyXp, sumMods, applyStatMods, itemMods, rollItem, rollRarity } from '../engine/progression.js';
import { simulate } from '../engine/battle.js';
import { rollAftermath } from '../engine/aftermath.js';
import { STARTING_BUCS, STARTER_SQUAD, ROSTER_CAP, FIRST_NAMES, LAST_NAMES, CALLSIGNS, COLOR_PRESETS, SEXES, GRADES, GRADE_BY_ID,
  PACK_BY_ID, PITY_RELIC_AFTER, SPECIAL_ITEM_PCT, STORE, ITEM_PRICE, SELL_PCT } from '../data/economy.js';
import { SPECIALTIES, SPECIALTY_BY_ID } from '../data/specialties.js';
import { ITEMS, ITEM_BY_ID, ROLLABLE_ITEMS, SLOTS, RARITY_ORDER, RARITY_BY_ID } from '../data/gear.js';
import { INJURY_BY_ID, healMs, HEAL_COST, BENCH_SEVERITY, MAX_INJURIES } from '../data/injuries.js';
import { MIA_RETURN_MIN, ENTRY_BY_ID, RETREAT_BY_ID } from '../data/entries.js';
import { TACTIC_BY_ID } from '../data/tactics.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { PERK_LEVELS } from '../data/stats.js';
import { COMMENDATIONS } from '../data/commendations.js';

export class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

export const SAVE_VERSION = 2;
export const HIRE_PRICE = GRADE_BY_ID.rookie.price;
export const EMERGENCY_COOLDOWN_MS = 10 * 60e3;
export const XENO_SELL = 750;
const HISTORY_KEEP = 20;

const uid = (p) => p + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
const SERVICE_RECORD = () => ({ successes: 0, downed: 0, deathRolls: 0, revives: 0, rearGuards: 0, injuries: 0, breakthroughs: 0, mia: 0, loneSurvivor: 0 });

// ---------- Creation ----------
export function newGame(now = Date.now()) {
  const g = { v: SAVE_VERSION, bucs: STARTING_BUCS, soldiers: [], items: [], memorial: [], history: [], missions: 0, created: now,
    pity: 0, lastEmergency: 0, store: { day: '', bought: [] } };
  const rng = createRng(randomSeed());
  for (const st of STARTER_SQUAD) {
    const s = makeRecruit(rng, st.specialty, 1, now);
    for (const slot of ['weapon', 'armor', 'utility']) if (st[slot]) s.gear[slot] = addItem(g, { base: st[slot], rarity: 'standard', affixes: [] }).uid;
    g.soldiers.push(s);
  }
  return g;
}

export function makeRecruit(rng, specialty, level = 1, now = Date.now()) {
  const sex = SEXES[rng.int(SEXES.length)];
  const g = growSoldier(rng, specialty, level);
  return {
    uid: uid('s'), name: FIRST_NAMES[sex][rng.int(FIRST_NAMES[sex].length)] + ' ' + LAST_NAMES[rng.int(LAST_NAMES.length)],
    callsign: rng.roll(50) ? CALLSIGNS[rng.int(CALLSIGNS.length)] : '', sex,
    colors: COLOR_PRESETS[rng.int(COLOR_PRESETS.length)].slice(),
    specialty, level, xp: 0, stats: g.stats, perks: g.perks, pendingPerks: [],
    gear: {}, injuries: [], status: 'ready', miaUntil: 0, missions: 0, kills: 0, hired: now,
    record: SERVICE_RECORD(), medals: [],
  };
}
export function addItem(g, inst) { const it = { uid: uid('i'), base: inst.base, rarity: inst.rarity, affixes: inst.affixes || [] }; g.items.push(it); return it; }

// ---------- Read-only helpers ----------
export const itemById = (g, id) => g.items.find(i => i.uid === id);
export const soldierById = (g, id) => g.soldiers.find(s => s.uid === id);
export const equippedBy = (g, itemUid) => g.soldiers.find(s => Object.values(s.gear).includes(itemUid));
export function condition(s) {
  if (s.status === 'mia') return 'mia';
  if (s.injuries.some(i => INJURY_BY_ID[i.id].severity >= BENCH_SEVERITY)) return 'benched';
  if (s.injuries.length) return 'wounded';
  return 'healthy';
}
export const canDeploy = (s) => s.status === 'ready' && condition(s) !== 'benched';
export function canWield(s, item) {
  const base = ITEM_BY_ID[item.base];
  return base.slot !== 'weapon' || SPECIALTY_BY_ID[s.specialty].weapons.includes(base.type);
}
export function healCost(s, now = Date.now()) {
  let c = 0;
  for (const i of s.injuries) {
    const left = Math.max(0, i.until - now); if (!left) continue;
    c += Math.max(5, Math.ceil((HEAL_COST[INJURY_BY_ID[i.id].severity] * left) / healMs(i.id)));
  }
  return c;
}
export function gearOf(g, s) {
  const out = {};
  for (const slot of SLOTS) { const it = s.gear[slot] && itemById(g, s.gear[slot]); if (it) out[slot] = { base: it.base, rarity: it.rarity, affixes: it.affixes }; }
  return out;
}
export function effectiveStats(g, s) {
  const gear = gearOf(g, s);
  return applyStatMods(s.stats, sumMods([...Object.values(gear).map(itemMods), ...s.injuries.map(i => INJURY_BY_ID[i.id].mods)]));
}
export function engineSoldier(g, s) {
  return { uid: s.uid, name: s.name, sex: s.sex, specialty: s.specialty, level: s.level, stats: s.stats, perks: s.perks.filter(Boolean), gear: gearOf(g, s), injuries: s.injuries.map(i => i.id) };
}
export const itemPrice = (it) => ITEM_PRICE[it.rarity] || 0;
export const sellPrice = (it) => it.rarity === 'xeno' ? XENO_SELL : Math.floor((itemPrice(it) * SELL_PCT) / 100);

// ---------- Upkeep ----------
export function awardMedals(s) {
  const r = { ...s.record, kills: s.kills, missions: s.missions };
  const fresh = COMMENDATIONS.filter(c => !s.medals.includes(c.id) && c.test(r)).map(c => c.id);
  s.medals.push(...fresh);
  return fresh;
}
// Heal finished injuries, bring MIA Soldiers home, and (if broke and short-handed) send a free Rookie.
// Returns a list of notices for the player.
export function upkeep(g, now = Date.now()) {
  const notes = [];
  for (const s of g.soldiers) {
    s.injuries = s.injuries.filter(i => i.until > now);
    if (s.status === 'mia' && s.miaUntil <= now) {
      s.status = 'ready'; s.record.mia++; awardMedals(s);
      notes.push(`${s.name} found the way home.`);
    }
  }
  const ready = g.soldiers.filter(canDeploy).length;
  if (ready < 2 && g.bucs < HIRE_PRICE && g.soldiers.length < ROSTER_CAP && now - (g.lastEmergency || 0) >= EMERGENCY_COOLDOWN_MS) {
    const rng = createRng(randomSeed());
    const sp = SPECIALTIES[rng.int(SPECIALTIES.length)];
    const s = makeRecruit(rng, sp.id, 1, now);
    s.gear.weapon = addItem(g, { base: sp.weapons[0] + '_std', rarity: 'standard' }).uid;
    s.gear.armor = addItem(g, { base: 'armor_light', rarity: 'standard' }).uid;
    g.soldiers.push(s); g.lastEmergency = now;
    notes.push(`Fleet Command sends a replacement: ${s.name} (${sp.name}).`);
  }
  return notes;
}

// ---------- Roster actions ----------
function getSoldier(g, id) { return soldierById(g, id) || fail('No such Soldier.'); }
function spend(g, n) { if (g.bucs < n) fail(`Not enough BUCs (need ${n}).`); g.bucs -= n; }

export function heal(g, sid, now = Date.now()) {
  const s = getSoldier(g, sid); const c = healCost(s, now);
  if (!c) fail('Nothing to heal.');
  spend(g, c); s.injuries = [];
  return { cost: c };
}
export function equip(g, sid, slot, itemUid) {
  const s = getSoldier(g, sid);
  if (!SLOTS.includes(slot)) fail('Bad slot.');
  if (!itemUid) { delete s.gear[slot]; return {}; }
  const it = itemById(g, itemUid) || fail('No such item.');
  if (ITEM_BY_ID[it.base].slot !== slot) fail('That item goes in another slot.');
  if (!canWield(s, it)) fail(`${s.name} (${SPECIALTY_BY_ID[s.specialty].name}) can't use that weapon.`);
  const other = equippedBy(g, itemUid);
  if (other) for (const k in other.gear) if (other.gear[k] === itemUid) delete other.gear[k];
  s.gear[slot] = itemUid;
  return {};
}
export function choosePerk(g, sid, perkId) {
  const s = getSoldier(g, sid);
  const L = s.pendingPerks[0]; if (L === undefined) fail('No perk to choose.');
  const tier = PERK_LEVELS.indexOf(L);
  if (!SPECIALTY_BY_ID[s.specialty].perks[tier].some(p => p.id === perkId)) fail('That perk isn\'t on offer.');
  s.pendingPerks.shift();
  const perks = s.perks.slice(); perks[tier] = perkId; s.perks = perks;
  return {};
}
export function customize(g, sid, f) {
  const s = getSoldier(g, sid);
  if (typeof f.name === 'string') { const n = f.name.trim().slice(0, 28); if (n) s.name = n; }
  if (typeof f.callsign === 'string') s.callsign = f.callsign.trim().slice(0, 16);
  if (SEXES.includes(f.sex)) s.sex = f.sex;
  if (Array.isArray(f.colors) && f.colors.length === 2 && f.colors.every(c => /^#[0-9a-f]{6}$/i.test(c))) s.colors = f.colors.slice();
  return {};
}
export function hire(g, specialty, now = Date.now()) {
  if (!SPECIALTY_BY_ID[specialty]) fail('Unknown specialty.');
  if (g.soldiers.length >= ROSTER_CAP) fail('The Barracks are full.');
  spend(g, HIRE_PRICE);
  const s = makeRecruit(createRng(randomSeed()), specialty, 1, now);
  g.soldiers.push(s);
  return { soldier: s.uid };
}
export function dismiss(g, sid) { getSoldier(g, sid); g.soldiers = g.soldiers.filter(x => x.uid !== sid); return {}; }
export function sellItem(g, itemUid) {
  const it = itemById(g, itemUid) || fail('No such item.');
  if (equippedBy(g, itemUid)) fail('Unequip it first.');
  const p = sellPrice(it);
  g.items = g.items.filter(x => x !== it); g.bucs += p;
  return { bucs: p };
}

// ---------- Packs ----------
const SPECIALS = ITEMS.filter(i => i.rarity && !RARITY_BY_ID[i.rarity].alienOnly);
const rIdx = (r) => RARITY_ORDER.indexOf(r);
function rollPackItem(rng, boost) {
  if (rng.roll(SPECIAL_ITEM_PCT)) { const sp = SPECIALS[rng.int(SPECIALS.length)]; return { base: sp.id, rarity: sp.rarity, affixes: [] }; }
  const base = ROLLABLE_ITEMS[rng.int(ROLLABLE_ITEMS.length)];
  return rollItem(rng, base.id, { rarityBoost: boost });
}
function rollGrade(rng, floorId) {
  const fi = GRADES.findIndex(x => x.id === floorId);
  const pool = GRADES.slice(Math.max(0, fi));
  let total = 0; for (const x of pool) total += x.weight;
  let r = rng.int(total); for (const x of pool) { if (r < x.weight) return x; r -= x.weight; }
  return pool[0];
}
export function openPack(g, packId, now = Date.now()) {
  const pack = PACK_BY_ID[packId] || fail('Unknown pack.');
  if (pack.soldiers && g.soldiers.length + pack.soldiers > ROSTER_CAP) fail('The Barracks are full: make room first.');
  spend(g, pack.price);
  const rng = createRng(randomSeed());
  const boost = pack.rarityBoost || 100;
  const items = [];
  for (let i = 0; i < pack.items; i++) items.push(rollPackItem(rng, boost));
  // Guarantee the pack's rarity floor on its best item; pity forces a Relic.
  const pity = g.pity >= PITY_RELIC_AFTER;   // PITY_RELIC_AFTER packs in a row without a Relic -> this one has one
  const floor = pity && rIdx('relic') > rIdx(pack.floor) ? 'relic' : pack.floor;
  if (items.length) {
    let best = 0; items.forEach((it, i) => { if (rIdx(it.rarity) > rIdx(items[best].rarity)) best = i; });
    if (rIdx(items[best].rarity) < rIdx(floor)) {
      const base = ROLLABLE_ITEMS[rng.int(ROLLABLE_ITEMS.length)];
      items[best] = rollItem(rng, base.id, { rarityBoost: boost, floor });
      if (rIdx(items[best].rarity) < rIdx(floor)) items[best] = { ...items[best], rarity: floor };
    }
    g.pity = items.some(it => it.rarity === 'relic') ? 0 : g.pity + 1;
  }
  const got = { items: items.map(it => addItem(g, it)), soldiers: [], pity: pity && items.length > 0 };
  for (let i = 0; i < pack.soldiers; i++) {
    const grade = rollGrade(rng, i === 0 ? pack.gradeFloor : 'rookie');
    const s = makeRecruit(rng, SPECIALTIES[rng.int(SPECIALTIES.length)].id, grade.level, now);
    s.grade = grade.id;
    // Recruits from packs: perks at 5+ come pre-picked by their training (growSoldier picks them).
    g.soldiers.push(s); got.soldiers.push(s.uid);
  }
  return got;
}

// ---------- Store ----------
// Same stock for every player on a given (Pacific) day. Each slot can be bought once per player per day.
export function storeDay(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
export function storeStock(day) {
  const rng = createRng(hashString('store:' + day));
  const items = [];
  for (let i = 0; i < STORE.items; i++) {
    const base = ROLLABLE_ITEMS[rng.int(ROLLABLE_ITEMS.length)];
    const it = rollItem(rng, base.id, { rarityBoost: 130 });
    items.push({ slot: 'i' + i, ...it, price: ITEM_PRICE[it.rarity] });
  }
  const soldiers = [];
  for (let i = 0; i < STORE.soldiers; i++) {
    const grade = rollGrade(rng, 'rookie');
    const s = makeRecruit(rng, SPECIALTIES[rng.int(SPECIALTIES.length)].id, grade.level, 0);
    soldiers.push({ slot: 's' + i, grade: grade.id, price: grade.price, specialty: s.specialty, level: s.level, name: s.name, callsign: s.callsign, sex: s.sex, colors: s.colors, stats: s.stats, perks: s.perks });
  }
  return { day, items, soldiers };
}
export function buyStore(g, slot, now = Date.now()) {
  const day = storeDay(now);
  if (g.store?.day !== day) g.store = { day, bought: [] };
  if (g.store.bought.includes(slot)) fail('Already bought today.');
  const stock = storeStock(day);
  const it = stock.items.find(x => x.slot === slot);
  const so = stock.soldiers.find(x => x.slot === slot);
  if (!it && !so) fail('Not in stock.');
  if (so && g.soldiers.length >= ROSTER_CAP) fail('The Barracks are full.');
  spend(g, (it || so).price);
  g.store.bought.push(slot);
  if (it) return { item: addItem(g, it).uid };
  const s = { ...makeRecruit(createRng(randomSeed()), so.specialty, 1, now), name: so.name, callsign: so.callsign, sex: so.sex, colors: so.colors.slice(),
    level: so.level, stats: { ...so.stats }, perks: so.perks.slice(), grade: so.grade };
  g.soldiers.push(s);
  return { soldier: s.uid };
}

// ---------- Missions ----------
// Validates the plan, runs the mission and applies the aftermath. Returns { input, battle, after, report }.
export function runMission(g, plan, now = Date.now()) {
  const ship = SHIP_BY_ID[plan.ship], entry = ENTRY_BY_ID[plan.entry];
  if (!ship || !entry || !TACTIC_BY_ID[plan.tactic] || !RETREAT_BY_ID[plan.retreat]) fail('Bad mission plan.');
  const ids = Array.isArray(plan.squad) ? [...new Set(plan.squad)] : [];
  if (!ids.length) fail('Pick a squad.');
  if (ids.length > entry.maxSquad) fail(`${entry.name} carries at most ${entry.maxSquad}.`);
  const squad = ids.map(id => getSoldier(g, id));
  for (const s of squad) if (!canDeploy(s)) fail(`${s.name} isn't fit to deploy.`);
  const input = { seed: randomSeed(), ship: ship.id, entry: entry.id, tactic: plan.tactic, retreat: plan.retreat, squad: squad.map(s => engineSoldier(g, s)) };
  const battle = simulate(input);
  const after = rollAftermath(battle, input.squad);
  const report = applyMission(g, input, battle, after, ship.name, now);
  return { input, battle, after, report };
}

export function applyMission(g, input, battle, after, shipName, now = Date.now()) {
  const rng = createRng((input.seed ^ 0x5bd1e995) >>> 0);
  const report = { at: now, seed: input.seed, ship: input.ship, shipName, entry: input.entry, tactic: input.tactic, retreat: input.retreat,
    result: battle.result, bucs: after.bucs, hash: battle.hash, soldiers: [], extras: [], input,
    colors: Object.fromEntries(input.squad.map(sq => [sq.uid, soldierById(g, sq.uid)?.colors])) };
  g.bucs += after.bucs; g.missions++;
  const survivors = after.soldiers.filter(a => a.fate !== 'kia');
  const lone = after.soldiers.length >= 3 && survivors.length === 1 ? survivors[0].uid : null;
  after.soldiers.forEach((a, i) => {
    const s = soldierById(g, a.uid); if (!s) return;
    const rec = battle.soldiers[i];
    const line = { uid: s.uid, name: s.name, specialty: s.specialty, state: a.state, fate: a.fate, kiaChance: a.kiaChance, xp: a.xp, injuries: a.injuries, kills: rec.kills, levelUps: [], perkPending: [], medals: [] };
    s.missions++; s.kills += rec.kills;
    const R = s.record;
    if (battle.result === 'success') R.successes++;
    R.downed += rec.downed; R.revives += rec.revives;
    if (rec.rearGuard) R.rearGuards++;
    if ((a.state === 'downed' || a.state === 'left') && a.fate !== 'kia') R.deathRolls++;
    if (lone === s.uid) R.loneSurvivor++;
    if (a.fate === 'kia') {
      const lost = a.state === 'left';   // left on board: their gear is lost with them
      if (lost) { const ids = Object.values(s.gear); g.items = g.items.filter(it => !ids.includes(it.uid)); }
      line.medals = awardMedals(s);      // posthumous
      const how = lost ? `Left aboard the ${shipName} during the retreat` : `Went Down on the ${shipName} and didn't make it (${a.kiaChance}% death roll)`;
      g.memorial.unshift({ ...s, gear: {}, diedAt: now, diedOn: shipName, diedHow: how, diedResult: battle.result, gearLost: lost });
      g.soldiers = g.soldiers.filter(x => x !== s);
      line.gearLost = lost;
    } else {
      const up = applyXp(rng, s, a.xp);
      s.level = up.level; s.xp = up.xp; s.stats = up.stats; s.pendingPerks.push(...up.perkPending);
      line.levelUps = up.levelUps; line.perkPending = up.perkPending;
      R.breakthroughs += up.levelUps.filter(l => l.breakthrough).length;
      for (const id of a.injuries) if (s.injuries.length < MAX_INJURIES) { s.injuries.push({ id, until: now + healMs(id, a.healTimePct) }); R.injuries++; }
      if (a.fate === 'mia') { s.status = 'mia'; s.miaUntil = now + MIA_RETURN_MIN * 60e3; }
      line.medals = awardMedals(s);
    }
    report.soldiers.push(line);
  });
  if (after.gearDrop) {
    const base = ROLLABLE_ITEMS[rng.int(ROLLABLE_ITEMS.length)];
    report.extras.push({ kind: 'item', item: addItem(g, rollItem(rng, base.id, { floor: 'milspec' })) });
  }
  if (after.prisoner && g.soldiers.length < ROSTER_CAP) {
    const r = makeRecruit(rng, SPECIALTIES[rng.int(SPECIALTIES.length)].id, 1 + rng.int(3), now);
    g.soldiers.push(r); report.extras.push({ kind: 'recruit', name: r.name, specialty: r.specialty });
  }
  g.history.unshift(report); g.history = g.history.slice(0, HISTORY_KEEP);
  return report;
}

// Upgrade older saves in place.
export function migrate(g) {
  if (!g.pity) g.pity = 0;
  if (!g.store) g.store = { day: '', bought: [] };
  for (const s of [...g.soldiers, ...g.memorial]) { if (!s.record) s.record = SERVICE_RECORD(); if (!s.medals) s.medals = []; }
  g.v = SAVE_VERSION;
  return g;
}
