// Data integrity + sanity report for Phase 1 data. Run: node test/data-check.mjs
// Exits 1 on any integrity error. Also prints growth / loot distributions for the codex.
import { STATS, MOD_KEYS, PERK_LEVELS, xpToReach, levelForXp, MAX_LEVEL, hitChance, applyDamage, ticksPerTile } from '../js/data/stats.js';
import { SPECIALTIES, ABILITIES } from '../js/data/specialties.js';
import { ITEMS, ITEM_BY_ID, WEAPON_TYPES, RARITIES, RARITY_BY_ID, AFFIXES, SLOTS, ROLLABLE_ITEMS } from '../js/data/gear.js';
import { TACTICS } from '../js/data/tactics.js';
import { ENTRIES, RETREATS } from '../js/data/entries.js';
import { FACTIONS, UNIT_BY_ID } from '../js/data/factions.js';
import { SHIPS, ROOMS, OBJECTIVES } from '../js/data/ships.js';
import { HAZARDS } from '../js/data/hazards.js';
import { INJURIES, MAX_HEAL_MIN, kiaChance, KIA_MIN_PCT } from '../js/data/injuries.js';
import { PACKS, GRADES, STARTER_SQUAD, ITEM_PRICE, successReward, failReward } from '../js/data/economy.js';
import { EASTER_EGGS, EGG_BY_ID } from '../js/data/easter-eggs.js';
import { FACILITIES } from '../js/data/mothership.js';
import { createRng } from '../js/engine/rng.js';
import { IMPLEMENTED_FLAGS } from '../js/engine/battle.js';
import { growSoldier, rollItem, itemMods, rollRarity } from '../js/engine/progression.js';

const errors = [];
const err = (m) => errors.push(m);

function checkMods(where, mods) {
  for (const k in mods || {}) {
    if (!(k in MOD_KEYS)) err(`${where}: unknown mod key "${k}"`);
    else if (MOD_KEYS[k] === 'tagmap' && typeof mods[k] !== 'object') err(`${where}: ${k} must be a tag map`);
    else if (MOD_KEYS[k] !== 'tagmap' && !Number.isInteger(mods[k])) err(`${where}: ${k} must be an integer`);
  }
}
function uniq(where, list) {
  const seen = new Set();
  for (const x of list) { if (seen.has(x)) err(`${where}: duplicate id ${x}`); seen.add(x); }
}
const isInt = Number.isInteger;

// ---- Specialties ----
uniq('specialties', SPECIALTIES.map(s => s.id));
const allPerkIds = [];
for (const s of SPECIALTIES) {
  for (const st of STATS) if (!isInt(s.base[st])) err(`${s.id}: base.${st} missing`);
  const gsum = STATS.reduce((a, st) => a + (s.growth[st] || 0), 0);
  if (gsum !== 100) err(`${s.id}: growth sums to ${gsum}, expected 100`);
  if (!STATS.includes(s.primary)) err(`${s.id}: bad primary`);
  for (const w of s.weapons) if (!WEAPON_TYPES[w]) err(`${s.id}: unknown weapon type ${w}`);
  if (!ABILITIES[s.ability]) err(`${s.id}: unknown ability ${s.ability}`);
  if (s.perks.length !== PERK_LEVELS.length) err(`${s.id}: needs ${PERK_LEVELS.length} perk tiers`);
  s.perks.forEach((pair, i) => {
    if (pair.length !== 2) err(`${s.id}: perk tier ${i} has ${pair.length} options, expected 2`);
    for (const p of pair) { allPerkIds.push(p.id); checkMods(`perk ${p.id}`, p.mods); }
  });
}
uniq('perks', allPerkIds);

// ---- Gear ----
uniq('items', ITEMS.map(i => i.id));
uniq('affixes', AFFIXES.map(a => a.id));
let rw = 0;
for (const r of RARITIES) { rw += r.weight; if (!isInt(r.mult)) err(`rarity ${r.id}: mult`); }
if (rw !== 1000) err(`rarity weights sum to ${rw}, expected 1000`);
for (const t in WEAPON_TYPES) {
  const w = WEAPON_TYPES[t];
  for (const k of ['range', 'falloff', 'acc', 'rof', 'pierce', 'crit', 'noise']) if (!isInt(w[k])) err(`weapon ${t}.${k} not int`);
  if (w.dmg[0] > w.dmg[1]) err(`weapon ${t}: dmg min > max`);
}
for (const i of ITEMS) {
  if (!SLOTS.includes(i.slot)) err(`item ${i.id}: bad slot`);
  if (i.slot === 'weapon' && !WEAPON_TYPES[i.type]) err(`item ${i.id}: bad weapon type`);
  if (i.rarity && !RARITY_BY_ID[i.rarity]) err(`item ${i.id}: bad rarity`);
  if (i.egg && !EGG_BY_ID[i.egg]) err(`item ${i.id}: egg ${i.egg} not in registry`);
  checkMods(`item ${i.id}`, i.mods);
}
for (const a of AFFIXES) {
  if (!(a.key in MOD_KEYS)) err(`affix ${a.id}: unknown key ${a.key}`);
  if (a.values.length !== 4) err(`affix ${a.id}: needs 4 tier values`);
  for (const s of a.slots) if (!SLOTS.includes(s)) err(`affix ${a.id}: bad slot ${s}`);
  for (let k = 1; k < 4; k++) if (a.values[k] < a.values[k - 1]) err(`affix ${a.id}: values not ascending`);
}

// ---- Tactics / entries / retreats ----
uniq('tactics', TACTICS.map(t => t.id));
for (const t of TACTICS) checkMods(`tactic ${t.id}`, t.mods);
uniq('entries', ENTRIES.map(e => e.id));
for (const e of ENTRIES) { checkMods(`entry ${e.id}`, e.mods); if (e.hazard && !HAZARDS[e.hazard]) err(`entry ${e.id}: unknown hazard`); }
uniq('retreats', RETREATS.map(r => r.id));

// ---- Factions / ships ----
for (const f of FACTIONS) for (const u of f.units) {
  for (const st of STATS) if (!isInt(u.stats[st])) err(`unit ${u.id}: stat ${st}`);
  if (u.weapon && !ITEM_BY_ID[u.weapon]) err(`unit ${u.id}: unknown weapon ${u.weapon}`);
}
uniq('units', Object.keys(UNIT_BY_ID));
for (const s of SHIPS) {
  for (const r of s.rooms.required) if (!ROOMS[r]) err(`ship ${s.id}: unknown required room ${r}`);
  for (const r in s.rooms.pool) if (!ROOMS[r]) err(`ship ${s.id}: unknown pool room ${r}`);
  if (s.rooms.required.length > s.rooms.count[0]) err(`ship ${s.id}: more required rooms than min count`);
  if (!s.rooms.required.includes('bridge')) err(`ship ${s.id}: must have a bridge`);
  if (!s.rooms.required.includes('pod_bay')) err(`ship ${s.id}: needs a pod bay (escape pod retreat)`);
  if (!s.rooms.required.includes('airlock')) err(`ship ${s.id}: needs an airlock (shuttle)`);
  for (const u in s.unitWeights) if (UNIT_BY_ID[u]?.faction !== s.faction) err(`ship ${s.id}: unit ${u} not in faction ${s.faction}`);
  if (UNIT_BY_ID[s.leader]?.faction !== s.faction) err(`ship ${s.id}: leader not in faction`);
  for (const o of s.optional) {
    if (!OBJECTIVES[o]) err(`ship ${s.id}: unknown objective ${o}`);
    else if (OBJECTIVES[o].room !== 'bridge' && !s.rooms.required.includes(OBJECTIVES[o].room) && !s.rooms.pool[OBJECTIVES[o].room])
      err(`ship ${s.id}: objective ${o} needs a ${OBJECTIVES[o].room} the ship can't have`);
  }
}
for (const r in ROOMS) if (ROOMS[r].hazard && !HAZARDS[ROOMS[r].hazard]) err(`room ${r}: unknown hazard`);

// ---- Injuries / permadeath rule ----
uniq('injuries', INJURIES.map(i => i.id));
for (const i of INJURIES) { if (i.healMin > MAX_HEAL_MIN) err(`injury ${i.id}: heals > ${MAX_HEAL_MIN} min`); checkMods(`injury ${i.id}`, i.mods); }
// Permadeath must be possible on every ship tier, even with maximum survival bonuses.
for (const s of SHIPS) {
  const k = kiaChance({ tier: s.tier, survivalPct: 1000 });
  if (k < KIA_MIN_PCT || k <= 0) err(`ship ${s.id}: KIA chance can reach ${k}% - permadeath must stay possible`);
}

// ---- Economy ----
for (const p of PACKS) if (!RARITY_BY_ID[p.floor]) err(`pack ${p.id}: bad floor`);
let gw = 0; for (const g of GRADES) gw += g.weight; if (gw !== 1000) err(`grade weights sum ${gw}`);
for (const s of STARTER_SQUAD) for (const k of ['weapon', 'armor', 'utility']) if (s[k] && !ITEM_BY_ID[s[k]]) err(`starter: unknown ${s[k]}`);
for (const r of RARITIES) if (!r.alienOnly && !ITEM_PRICE[r.id]) err(`no store price for ${r.id}`);

// ---- Eggs / mothership ----
uniq('eggs', EASTER_EGGS.map(e => e.id));
for (const f of FACILITIES) checkMods(`facility ${f.id}`, f.mods);

// ---- Level curve ----
for (let L = 2; L <= MAX_LEVEL; L++) if (xpToReach(L) <= xpToReach(L - 1)) err('xp curve not increasing');
if (levelForXp(xpToReach(10)) !== 10) err('levelForXp mismatch');

// =================== Report ===================
const N = 2000;
console.log('\n== Average stats at level 10 | level 20 (' + N + ' samples) ==');
console.log('specialty    ' + STATS.map(s => s.padStart(5)).join('') + '   | ' + STATS.map(s => s.padStart(5)).join('') + '   | brkthr@20');
for (const sp of SPECIALTIES) {
  const rng = createRng(1234);
  const avg = (L) => { const t = Object.fromEntries(STATS.map(s => [s, 0])); let b = 0;
    for (let i = 0; i < N; i++) { const g = growSoldier(rng, sp.id, L); for (const s of STATS) t[s] += g.stats[s]; b += g.breakthroughs; }
    return { st: STATS.map(s => String(Math.round(t[s] / N)).padStart(5)).join(''), b: (b / N).toFixed(2) }; };
  const a10 = avg(10), a20 = avg(20);
  console.log(sp.id.padEnd(12) + ' ' + a10.st + '   | ' + a20.st + '   | ' + a20.b);
}

console.log('\n== Rarity odds per item roll (%), 20000 rolls ==');
for (const p of [{ name: 'base', o: {} }, { name: 'boost 125', o: { rarityBoost: 125 } }, { name: 'boost 160', o: { rarityBoost: 160 } }]) {
  const rng = createRng(99); const c = {};
  for (let i = 0; i < 20000; i++) { const r = rollRarity(rng, p.o); c[r] = (c[r] || 0) + 1; }
  console.log(p.name.padEnd(10) + RARITIES.filter(r => !r.alienOnly).map(r => `${r.id} ${((c[r.id] || 0) / 200).toFixed(1)}`).join('  '));
}

console.log('\n== Weapon damage per tick (avg dmg / rof), standard rarity ==');
for (const t in WEAPON_TYPES) { const w = WEAPON_TYPES[t]; console.log(t.padEnd(8) + ((w.dmg[0] + w.dmg[1]) / 2 / w.rof).toFixed(2) + `  range ${w.range}`); }

console.log('\n== Sample hit chances (aim 50 shooter, rifle, target spd 45) ==');
for (const [cover, d] of [[0, 5], [20, 5], [40, 5], [0, 12]])
  console.log(`cover ${cover} dist ${d}: ${hitChance({ aim: 50, weaponAcc: 8, targetEvasion: 9, cover, distTiles: d, range: 8, falloff: 4 })}%`);
console.log('rifle 15 dmg vs arm 20: ' + applyDamage({ raw: 15, targetArm: 20 }) + ', crit: ' + applyDamage({ raw: 15, targetArm: 20, crit: true }));
console.log('ticks/tile spd 35/55/65: ' + [35, 55, 65].map(s => ticksPerTile(s)).join(' / '));

console.log('\n== KIA chance when Downed (no bonuses / 30 ticks down + 40% overkill / max survival) ==');
for (const s of SHIPS) console.log(`${s.id.padEnd(9)} tier ${s.tier}: ${kiaChance({ tier: s.tier })}% / ${kiaChance({ tier: s.tier, ticksDown: 300, overkillPct: 40 })}% / ${kiaChance({ tier: s.tier, survivalPct: 1000 })}%`);

console.log('\n== Rewards ==');
for (const s of SHIPS) console.log(`${s.id.padEnd(9)} success ${successReward(s)} (+all optional ${successReward(s, s.optional.map(o => OBJECTIVES[o].bonusPct || 0))})  fail@50% ${failReward(s, 50)}`);

const sample = rollItem(createRng(7), 'rifle_std', { rarityBoost: 160, floor: 'relic' });
console.log('\nSample relic rifle:', JSON.stringify(sample), '->', JSON.stringify(itemMods(sample)));

console.log(`\n${ITEMS.length} items (${ROLLABLE_ITEMS.length} rollable), ${AFFIXES.length} affixes, ${SPECIALTIES.length} specialties, ${allPerkIds.length} perks, ${Object.keys(UNIT_BY_ID).length} enemy units, ${SHIPS.length} ships, ${EASTER_EGGS.length} easter eggs`);
const usedFlags = new Set([...SPECIALTIES.flatMap(s => s.perks.flat().map(p => p.flag)), ...ITEMS.map(i => i.flag), ...TACTICS.map(t => t.flag)].filter(Boolean));
const todo = [...usedFlags].filter(f => !IMPLEMENTED_FLAGS.includes(f)).sort();
if (todo.length) console.log(`
WARNING: ${todo.length} special-effect flags not implemented in the engine yet: ${todo.join(', ')}`);
if (errors.length) { console.error('\nDATA ERRORS:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('\nOK: no data errors.');
