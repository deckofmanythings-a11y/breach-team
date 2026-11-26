// Game rules that change a player's save. PURE: no storage, no DOM, no network.
// The boarding-api Edge Function runs these (server-authoritative); the browser uses the
// read-only helpers to display things. Every mutation throws GameError on a bad request.
import { createRng, randomSeed, hashString } from '../engine/rng.js';
import { HIRE_KIT } from '../data/hire-kit.js';
import { growSoldier, applyXp, sumMods, applyStatMods, itemMods, rollItem, rollRarity, rollAffixes } from '../engine/progression.js';
import { simulate } from '../engine/battle.js';
import { rollAftermath } from '../engine/aftermath.js';
import { STARTING_BUCS, STARTER_SQUAD, ROSTER_CAP, FIRST_NAMES, LAST_NAMES, CALLSIGNS, COLOR_PRESETS, SEXES, GRADES, GRADE_BY_ID,
  PACK_BY_ID, PITY_RELIC_AFTER, SPECIAL_ITEM_PCT, STORE, ITEM_PRICE, SELL_PCT } from '../data/economy.js';
import { SPECIALTIES, SPECIALTY_BY_ID } from '../data/specialties.js';
import { ITEMS, ITEM_BY_ID, ROLLABLE_ITEMS, SLOTS, RARITY_ORDER, RARITY_BY_ID } from '../data/gear.js';
import { INJURY_BY_ID, healMs, HEAL_COST, BENCH_SEVERITY, MAX_INJURIES } from '../data/injuries.js';
import { MIA_RETURN_MIN, ENTRY_BY_ID, RETREAT_BY_ID } from '../data/entries.js';
import { SUICIDE_SQUAD, isSuicideSquad } from '../data/suicide-squad.js';
import { credsForMission, backfillCreds } from '../data/creds.js';
import { mothershipInput, entryMaxSquad, storePrice, MS_ROOMS, roomLevel } from '../data/mothership-rooms.js';
import { DEFENSE_EVENTS, defenseChance, defenders, pickThreat, damageableRooms } from '../data/defense-events.js';   // new file for new names
import { THREAT_BY_ID, DEFENSE } from '../data/threats.js';
import { intelLevel, scoutSeed } from '../engine/scout.js';   // new file for new names
import { TACTIC_BY_ID } from '../data/tactics.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { SECRET_SHIPS } from '../data/aliens.js';
import { weeklyContract, contractScore, recordStats, backfillStats, emptyStats } from './ladder.js';   // new file: avoids the stale-cache trap for new names
import { EASTER_EGGS, EGG_BY_ID } from '../data/easter-eggs.js';
import { ENGINE_VERSION } from '../data/version.js';
import { PERK_LEVELS, xpToReach } from '../data/stats.js';
import { COMMENDATIONS } from '../data/commendations.js';
import { LOOK_COUNT } from '../data/looks.js';   // new file for new names
import { CYBORG_PCT, CYBORG_EGG, CYBORG_CHASSIS, recoverable, rebuild } from './cyborg.js';   // hidden egg; new file for new names

export class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

export const SAVE_VERSION = 2;
export const HIRE_PRICE = GRADE_BY_ID.rookie.price;
export const EMERGENCY_COOLDOWN_MS = 10 * 60e3;
export const XENO_SELL = 750;
const HISTORY_KEEP = 20;
// Easter eggs (see js/data/easter-eggs.js). Hidden ones are never named to the player in advance.
export const SECRET_CHANCE = 4;          // % per boarding (after MIN_MISSIONS_FOR_SECRET) that the target is secretly a secret ship
export const MIN_MISSIONS_FOR_SECRET = 3;
export const RARE_RECRUIT_PCT = 2;       // % per pack recruit to be one of the named rare recruits (each once per player)
export const HAULER_CAT_PCT = 1;         // % per successful Cargo Hauler boarding to find the ship's cat
const RARE_RECRUITS = EASTER_EGGS.filter(e => e.kind === 'recruit');
const ACHIEVEMENTS = EASTER_EGGS.filter(e => e.kind === 'achievement');
const FULL_AUTO = ['smg', 'lmg'];
const XENO_SPECIALS = ITEMS.filter(i => i.rarity === 'xeno' && !i.enemyOnly && !i.hidden);

const uid = (p) => p + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
const SERVICE_RECORD = () => ({ successes: 0, downed: 0, deathRolls: 0, revives: 0, rearGuards: 0, injuries: 0, breakthroughs: 0, mia: 0, loneSurvivor: 0 });

// ---------- Creation ----------
export function newGame(now = Date.now()) {
  const g = { v: SAVE_VERSION, bucs: STARTING_BUCS, creds: 0, soldiers: [], items: [], memorial: [], history: [], missions: 0, created: now,
    pity: 0, lastEmergency: 0, store: { day: '', bought: [] }, eggs: [], achievements: [], discovered: [], stats: emptyStats() };
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
    specialty, level, xp: xpToReach(level), stats: g.stats, perks: g.perks, pendingPerks: [],
    gear: {}, injuries: [], status: 'ready', miaUntil: 0, missions: 0, kills: 0, hired: now,
    record: SERVICE_RECORD(), medals: [], look: rng.int(LOOK_COUNT),
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
  return { uid: s.uid, name: s.name, sex: s.sex, look: s.look || 0, portrait: s.portrait, colors: s.colors, specialty: s.specialty, level: s.level, stats: s.stats, perks: s.perks.filter(Boolean), gear: gearOf(g, s), injuries: s.injuries.map(i => i.id) };
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
  if (!g.gameOver && ready < 2 && g.bucs < HIRE_PRICE && g.soldiers.length < ROSTER_CAP && now - (g.lastEmergency || 0) >= EMERGENCY_COOLDOWN_MS) {
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
  const fixed = s.gear[slot] && itemById(g, s.gear[slot]);
  if (fixed && ITEM_BY_ID[fixed.base].builtin) fail(`That's part of ${s.name} now. It doesn't come off.`);
  if (!itemUid) { delete s.gear[slot]; return {}; }
  const it = itemById(g, itemUid) || fail('No such item.');
  if (ITEM_BY_ID[it.base].slot !== slot) fail('That item goes in another slot.');
  if (ITEM_BY_ID[it.base].builtin) fail("That can't be fitted to anyone else.");
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
  if (Number.isInteger(f.look) && f.look >= 0 && f.look < LOOK_COUNT) s.look = f.look;
  if (Array.isArray(f.colors) && f.colors.length === 2 && f.colors.every(c => /^#[0-9a-f]{6}$/i.test(c))) s.colors = f.colors.slice();
  return {};
}
export function hire(g, specialty, now = Date.now()) {
  if (!SPECIALTY_BY_ID[specialty]) fail('Unknown specialty.');
  if (g.soldiers.length >= ROSTER_CAP) fail('The Barracks are full.');
  spend(g, HIRE_PRICE);
  const s = makeRecruit(createRng(randomSeed()), specialty, 1, now);
  for (const [slot, base] of Object.entries(HIRE_KIT[specialty] || {})) s.gear[slot] = addItem(g, { base, rarity: 'standard', affixes: [] }).uid;
  g.soldiers.push(s);
  return { soldier: s.uid };
}
export function dismiss(g, sid) { const s = getSoldier(g, sid); dropBuiltins(g, s); g.soldiers = g.soldiers.filter(x => x.uid !== sid); return {}; }
// Built-in parts (a cyborg's chassis) leave with their Soldier: they never reach the Armory.
function dropBuiltins(g, s) {
  const ids = Object.values(s.gear).filter(id => { const it = itemById(g, id); return it && ITEM_BY_ID[it.base].builtin; });
  if (ids.length) g.items = g.items.filter(it => !ids.includes(it.uid));
}
export function sellItem(g, itemUid) {
  const it = itemById(g, itemUid) || fail('No such item.');
  if (ITEM_BY_ID[it.base].builtin) fail("That can't be sold.");
  if (equippedBy(g, itemUid)) fail('Unequip it first.');
  const p = sellPrice(it);
  g.items = g.items.filter(x => x !== it); g.bucs += p;
  return { bucs: p };
}

// ---------- Packs ----------
// Fixed-rarity specials packs may contain (not enemy weapons, not hidden eggs, not Xeno).
const SPECIALS = ITEMS.filter(i => i.rarity && !i.enemyOnly && !i.hidden && i.rarity !== 'xeno');
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
  spend(g, storePrice(g, pack.price));
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
    const rare = RARE_RECRUITS.filter(e => !(g.eggs || []).includes(e.id));
    const fallen = recoverable(g);
    let s;
    if (fallen.length && rng.roll(CYBORG_PCT)) {
      const f = fallen[rng.int(fallen.length)];
      s = rebuild(rng, f, uid, SERVICE_RECORD, now);
      s.gear.implant = addItem(g, { base: CYBORG_CHASSIS, rarity: 'relic', affixes: [] }).uid;
      f.recovered = true;
      if (!(g.eggs ||= []).includes(CYBORG_EGG)) g.eggs.push(CYBORG_EGG);
      got.cyborg = (got.cyborg || []).concat(s.uid);
    } else if (rare.length && rng.roll(RARE_RECRUIT_PCT)) {
      const egg = rare[rng.int(rare.length)];
      s = makeRecruit(rng, egg.data.specialty, grade.level, now);
      Object.assign(s, { name: egg.data.name, callsign: '', sex: egg.data.sex, portrait: 'egg-' + egg.id, egg: egg.id, bio: egg.data.note });
      (g.eggs ||= []).push(egg.id);
      got.rare = (got.rare || []).concat(s.uid);
    } else s = makeRecruit(rng, SPECIALTIES[rng.int(SPECIALTIES.length)].id, grade.level, now);
    if (!s.cyborg) s.grade = grade.id;
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
  spend(g, storePrice(g, (it || so).price));
  g.store.bought.push(slot);
  if (it) return { item: addItem(g, it).uid };
  const s = { ...makeRecruit(createRng(randomSeed()), so.specialty, 1, now), name: so.name, callsign: so.callsign, sex: so.sex, colors: so.colors.slice(),
    level: so.level, xp: xpToReach(so.level), stats: { ...so.stats }, perks: so.perks.slice(), grade: so.grade };
  g.soldiers.push(s);
  return { soldier: s.uid };
}

// ---------- Missions ----------
// Validates the plan, runs the mission and applies the aftermath. Returns { input, battle, after, report }.
export function runMission(g, plan, now = Date.now()) {
  // Weekly Contract: the week decides the ship and the map; the player still picks everything else.
  const contract = plan.contract ? weeklyContract(now) : null;
  const ship = SHIP_BY_ID[contract ? contract.ship : plan.ship], entry = ENTRY_BY_ID[plan.entry];
  if (!ship || ship.secret || !entry || !TACTIC_BY_ID[plan.tactic] || !RETREAT_BY_ID[plan.retreat]) fail('Bad mission plan.');   // secret ships can't be picked
  const ids = Array.isArray(plan.squad) ? [...new Set(plan.squad)] : [];
  if (!ids.length) fail('Pick a squad.');
  const ms = mothershipInput(g);
  const maxSquad = entryMaxSquad(entry, ms?.entry);
  if (ids.length > maxSquad) fail(`${entry.name} carries at most ${maxSquad}.`);
  const squad = ids.map(id => getSoldier(g, id));
  for (const s of squad) if (!canDeploy(s)) fail(`${s.name} isn't fit to deploy.`);
  if (isSuicideSquad(plan.retreat) && ship.tier < SUICIDE_SQUAD.minTier) fail(`The ${ship.name} isn't worth a Suicide Squad. Pick a ${'★'.repeat(SUICIDE_SQUAD.minTier)} ship or better.`);
  if (isSuicideSquad(plan.retreat)) for (const s of squad) if (s.level < SUICIDE_SQUAD.minLevel) fail(`Only Level ${SUICIDE_SQUAD.minLevel}+ Soldiers can join a Suicide Squad (${s.name} is Level ${s.level}).`);
  // Once in a while the contact turns out to be something else entirely.
  let target = ship, planned = null;
  if (!contract && (g.missions || 0) >= MIN_MISSIONS_FOR_SECRET && createRng(randomSeed()).roll(SECRET_CHANCE)) {
    planned = ship.id; target = SECRET_SHIPS[randomSeed() % SECRET_SHIPS.length];
  }
  // Intel Room: a scouted target's map, crew and objectives come from its public scout seed (not for
  // contracts, which share one map, or a contact that turned out to be something else).
  const scouted = !contract && !planned && intelLevel(g) > 0;
  const input = { engineVersion: ENGINE_VERSION, seed: randomSeed(), ...(contract ? { mapSeed: contract.mapSeed, contractWeek: contract.week } : {}),
    ...(scouted ? { mapSeed: scoutSeed(g, ship.id), scouted: true } : {}), ship: target.id, entry: entry.id, tactic: plan.tactic, retreat: plan.retreat, squad: squad.map(s => engineSoldier(g, s)), ...(ms ? { mothership: ms } : {}) };
  const battle = simulate(input);
  const after = rollAftermath(battle, input.squad, input.mothership);
  const report = applyMission(g, input, battle, after, target.name, now);
  if (contract) { report.contract = { week: contract.week, score: contractScore(battle, after) }; }
  if (planned) { report.secret = true; report.plannedShip = planned; if (!(g.discovered ||= []).includes(target.id)) { g.discovered.push(target.id); report.firstContact = true; } }
  // Rarely, the Mothership is boarded (or something got loose) the moment the squad is home. It's
  // fought right away, in this same call, so it can't be dodged (docs/MOTHERSHIP.md, M5).
  const drng = createRng(hashString('defense:' + input.seed));
  const chance = defenseChance(g, target);
  let defense = null;
  if (chance && drng.roll(chance)) {
    defense = runDefense(g, pickThreat(defenders(g), target), drng.int(0x7fffffff), now);
    if (defense) report.defense = defense.report;
  }
  return { input, battle, after, report, defense };
}

// ---------- Mothership defense ----------
// Fight a defense with everyone aboard and apply it. pick = { threat, power }. Returns
// { input, battle, after, report } or null if nobody is aboard.
export function runDefense(g, pick, seed, now = Date.now()) {
  const roster = defenders(g).slice(0, DEFENSE.maxDefenders);
  if (!roster.length || !THREAT_BY_ID[pick.threat]) return null;
  const ms = mothershipInput(g);
  const rooms = {};
  for (const r of MS_ROOMS) { const lv = roomLevel(g, r.id); if (lv > 0) rooms[r.id] = lv; }
  const damaged = Object.keys(g.mothership?.damaged || {}).filter(id => rooms[id]).sort();   // on the map, but give nothing
  const input = { engineVersion: ENGINE_VERSION, mode: 'defend', seed: seed >>> 0, threat: pick.threat, power: pick.power, rooms, ...(damaged.length ? { damaged } : {}), tactic: 'balanced',
    squad: roster.map(s => engineSoldier(g, s)), ...(ms ? { mothership: ms } : {}) };
  const battle = simulate(input);
  const after = rollAftermath(battle, input.squad, input.mothership);
  return { input, battle, after, report: applyDefense(g, input, battle, after, now) };
}

export function applyDefense(g, input, battle, after, now = Date.now()) {
  const rng = createRng((input.seed ^ 0x2545f491) >>> 0);
  const T = THREAT_BY_ID[input.threat];
  const report = { at: now, defense: true, seed: input.seed, ship: 'mothership', shipName: 'the Mothership', threat: T.id, threatName: T.name, power: input.power,
    result: battle.result, bucs: after.bucs, hash: battle.hash, soldiers: [], extras: [], input, stolen: 0, damaged: [],
    colors: Object.fromEntries(input.squad.map(sq => [sq.uid, soldierById(g, sq.uid)?.colors])) };
  g.bucs += after.bucs;
  report.creds = credsForMission(after); g.creds = (g.creds || 0) + report.creds;
  g.lastDefense = g.missions;
  g.defenses ||= { fought: 0, won: 0 };
  g.defenses.fought++; if (battle.result === 'success') g.defenses.won++;
  const how = T.kind === 'outbreak' ? `Fell defending the Mothership during a ${T.name.toLowerCase()}` : `Fell defending the Mothership against a ${T.name.toLowerCase()}`;
  after.soldiers.forEach((a, i) => {
    const s = soldierById(g, a.uid); if (!s) return;
    const rec = battle.soldiers[i];
    const line = { uid: s.uid, name: s.name, specialty: s.specialty, state: a.state, fate: a.fate, kiaChance: a.kiaChance, xp: a.xp, injuries: a.injuries, kills: rec.kills, levelUps: [], perkPending: [], medals: [] };
    s.kills += rec.kills;
    const R = s.record;
    R.defenses = (R.defenses || 0) + 1;
    R.downed += rec.downed; R.revives += rec.revives;
    if (a.state === 'downed' && a.fate !== 'kia') R.deathRolls++;
    if (a.fate === 'kia') {
      dropBuiltins(g, s);
      line.medals = awardMedals(s);
      g.memorial.unshift({ ...s, gear: {}, diedAt: now, diedOn: 'the Mothership', diedHow: `${how} (${a.kiaChance}% death roll)`, diedResult: battle.result, defense: true });
      g.soldiers = g.soldiers.filter(x => x !== s);
    } else {
      const up = applyXp(rng, s, a.xp);
      s.level = up.level; s.xp = up.xp; s.stats = up.stats; s.pendingPerks.push(...up.perkPending);
      line.levelUps = up.levelUps; line.perkPending = up.perkPending;
      R.breakthroughs += up.levelUps.filter(l => l.breakthrough).length;
      for (const id of a.injuries) if (s.injuries.length < MAX_INJURIES) { s.injuries.push({ id, until: now + healMs(id, a.healTimePct) }); R.injuries++; }
      line.medals = awardMedals(s);
    }
    report.soldiers.push(line);
  });
  // A lost defense: the attackers carry off BUCs and wreck rooms on the way out.
  if (battle.result !== 'success') {
    report.stolen = Math.floor((g.bucs * DEFENSE_EVENTS.theftPct[battle.result]) / 100);
    g.bucs -= report.stolen;
    const pool = damageableRooms(g);
    for (let n = DEFENSE_EVENTS.damagedRooms[battle.result]; n > 0 && pool.length; n--) report.damaged.push(pool.splice(rng.int(pool.length), 1)[0]);
    if (report.damaged.length) { g.mothership ||= {}; g.mothership.damaged ||= {}; for (const id of report.damaged) g.mothership.damaged[id] = true; }
  }
  // Achievements (M6).
  const have = new Set(g.achievements || []), earned = [];
  const grant = (id) => { if (!have.has(id)) { have.add(id); earned.push(id); } };
  if (battle.result === 'success') {
    grant('ach_off_my_ship');
    const held = Math.max(0, ...battle.events.filter(e => e[1] === 'hold').map(e => e[2]));
    if (held * 2 > DEFENSE.holdTicks) grant('ach_hold_door');
    if (T.kind === 'outbreak' && after.soldiers.every(a => a.fate !== 'kia')) grant('ach_mostly_night');
  }
  g.achievements = [...have];
  report.achievements = earned;
  if (!g.soldiers.length) { g.gameOver = { at: now, ship: 'the Mothership', missions: g.missions }; report.gameOver = true; }
  return report;
}

export function applyMission(g, input, battle, after, shipName, now = Date.now()) {
  const rng = createRng((input.seed ^ 0x5bd1e995) >>> 0);
  const report = { at: now, seed: input.seed, ship: input.ship, shipName, entry: input.entry, tactic: input.tactic, retreat: input.retreat,
    result: battle.result, bucs: after.bucs, ...(after.timeBonus?.bucs ? { timeBonus: after.timeBonus } : {}), hash: battle.hash, soldiers: [], extras: [], input,
    colors: Object.fromEntries(input.squad.map(sq => [sq.uid, soldierById(g, sq.uid)?.colors])) };
  g.bucs += after.bucs; g.missions++;
  report.creds = credsForMission(after); g.creds = (g.creds || 0) + report.creds;
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
      else dropBuiltins(g, s);
      line.medals = awardMedals(s);      // posthumous
      const how = lost && isSuicideSquad(input.retreat) ? `Fell with the Suicide Squad aboard the ${shipName}` : lost ? `Left aboard the ${shipName} during the retreat` : `Went Down on the ${shipName} and didn't make it (${a.kiaChance}% death roll)`;
      g.memorial.unshift({ ...s, gear: {}, diedAt: now, diedOn: shipName, diedHow: how, diedResult: battle.result, gearLost: lost, ...(isSuicideSquad(input.retreat) ? { suicideSquad: true } : {}) });
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
  const shipDef = SHIP_BY_ID[input.ship];
  const success = battle.result === 'success';
  if (success && shipDef.xenoDropPct && rng.roll(shipDef.xenoDropPct)) {
    let it;
    if (XENO_SPECIALS.length && rng.roll(20)) { const sp = XENO_SPECIALS[rng.int(XENO_SPECIALS.length)]; it = { base: sp.id, rarity: 'xeno', affixes: [] }; }
    else { const base = ROLLABLE_ITEMS[rng.int(ROLLABLE_ITEMS.length)]; it = { base: base.id, rarity: 'xeno', affixes: rollAffixes(rng, base.slot, 'xeno') }; }
    report.extras.push({ kind: 'item', item: addItem(g, it), xeno: true });
  }
  const catChance = input.ship === 'secret_horseshoe' ? 100 : input.ship === 'hauler' ? HAULER_CAT_PCT : 0;
  if (success && catChance && !(g.eggs || []).includes('loot_cat') && rng.roll(catChance)) {
    (g.eggs ||= []).push('loot_cat');
    report.extras.push({ kind: 'egg', egg: 'loot_cat', text: EGG_BY_ID.loot_cat.data.text, item: addItem(g, { base: 'ships_cat', rarity: 'relic' }) });
  }
  // Achievements.
  const have = new Set(g.achievements || []), earned = [];
  const grant = (id) => { if (!have.has(id)) { have.add(id); earned.push(id); } };
  if (success && input.squad.every(s => !FULL_AUTO.includes(ITEM_BY_ID[s.gear?.weapon?.base]?.type))) grant('ach_short_controlled');
  if (shipDef.alien && battle.result === 'retreat' && battle.soldiers.every(s => s.state !== 'left')) grant('ach_nuke_orbit');
  const needed = Math.max(1, Math.ceil((input.squad.length * (TACTIC_BY_ID[input.tactic].retreatAt)) / 100));
  if (success && needed > 1 && battle.soldiers.filter(s => s.downed > 0).length >= needed - 1) grant('ach_kobayashi');
  if (after.soldiers.some((a, i) => a.fate === 'kia' && input.squad[i].level >= 10)) grant('ach_tears_rain');
  g.achievements = [...have];
  report.achievements = earned;
  if (after.prisoner && g.soldiers.length < ROSTER_CAP) {
    const r = makeRecruit(rng, SPECIALTIES[rng.int(SPECIALTIES.length)].id, 1 + rng.int(3), now);
    g.soldiers.push(r); report.extras.push({ kind: 'recruit', name: r.name, specialty: r.specialty });
  }
  recordStats(g, input, battle, after, !!input.contractWeek);
  // Game Over: nobody left alive (Missing Soldiers are alive). Only a new commander can carry on.
  if (!g.soldiers.length) { g.gameOver = { at: now, ship: shipName, missions: g.missions }; report.gameOver = true; }
  g.history.unshift(report); g.history = g.history.slice(0, HISTORY_KEEP);
  return report;
}

// Upgrade older saves in place.
export function migrate(g) {
  if (!g.pity) g.pity = 0;
  if (!g.store) g.store = { day: '', bought: [] };
  if (!g.eggs) g.eggs = [];
  if (!g.achievements) g.achievements = [];
  if (!g.discovered) g.discovered = [];
  if (!g.stats) g.stats = backfillStats(g);
  // CREDs arrived in 0.10.0: older saves get a one-time grant for the XP already earned.
  if (g.creds === undefined) { g.creds = backfillCreds(g); g.credsBackfill = g.creds; }
  // 0.9.0 Suicide Squad deaths predate the memorial badge flag.
  for (const m of g.memorial) if (!m.suicideSquad && /^Fell with the Suicide Squad/.test(m.diedHow || '')) m.suicideSquad = true;
  for (const s of [...g.soldiers, ...g.memorial]) { if (!s.record) s.record = SERVICE_RECORD(); if (!s.medals) s.medals = [];
    // Recruits hired above Level 1 used to start at 0 XP, leaving their XP bar stuck at empty.
    if ((s.xp || 0) < xpToReach(s.level)) s.xp = xpToReach(s.level); }
  g.v = SAVE_VERSION;
  return g;
}
