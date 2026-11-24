// Pure, deterministic progression + loot rolls. Used by the server (boarding-api) for real rolls
// and by tests/codex for distributions. Integer-only.
import { STATS, STAT_POINT_VALUE, POINTS_PER_LEVEL, BREAKTHROUGH_PCT, BREAKTHROUGH_POINTS, PERK_LEVELS, STAT_CAP, STAT_FLOOR, MOD_KEYS } from '../data/stats.js';
import { SPECIALTY_BY_ID } from '../data/specialties.js';
import { RARITIES, RARITY_BY_ID, RARITY_ORDER, ITEM_BY_ID, WEAPON_TYPES, AFFIXES, AFFIX_BY_ID } from '../data/gear.js';

function weightedPick(rng, entries) {        // entries: [[key, weight], ...]
  let total = 0; for (const [, w] of entries) total += w;
  let r = rng.int(total);
  for (const [k, w] of entries) { if (r < w) return k; r -= w; }
  return entries[entries.length - 1][0];
}

// One level-up. Returns { gains: {stat: amount}, breakthrough: bool }.
export function rollLevelUp(rng, specialtyId) {
  const sp = SPECIALTY_BY_ID[specialtyId];
  const entries = STATS.map(s => [s, sp.growth[s] || 0]).filter(([, w]) => w > 0);
  const gains = {};
  for (let i = 0; i < POINTS_PER_LEVEL; i++) {
    const s = weightedPick(rng, entries);
    gains[s] = (gains[s] || 0) + STAT_POINT_VALUE[s];
  }
  const breakthrough = rng.roll(BREAKTHROUGH_PCT);
  if (breakthrough) gains[sp.primary] = (gains[sp.primary] || 0) + BREAKTHROUGH_POINTS * STAT_POINT_VALUE[sp.primary];
  return { gains, breakthrough };
}

// Build a fresh soldier's growth from level 1 to `level`. Perks picked at random (used for recruits).
export function growSoldier(rng, specialtyId, level) {
  const sp = SPECIALTY_BY_ID[specialtyId];
  const stats = { ...sp.base };
  const perks = [];
  let breakthroughs = 0;
  for (let L = 2; L <= level; L++) {
    const { gains, breakthrough } = rollLevelUp(rng, specialtyId);
    for (const s in gains) stats[s] += gains[s];
    if (breakthrough) breakthroughs++;
    const pi = PERK_LEVELS.indexOf(L);
    if (pi >= 0) { const pair = sp.perks[pi]; perks.push(pair[rng.int(pair.length)].id); }
  }
  return { stats, perks, breakthroughs };
}

// ---------- Effective stats ----------
// Sum mods from a list of mod objects (gear, affixes, perks, tactic, entry, injuries).
export function sumMods(list) {
  const out = {};
  for (const m of list) {
    if (!m) continue;
    for (const k in m) {
      if (MOD_KEYS[k] === 'tagmap') {
        out[k] = out[k] || {};
        for (const t in m[k]) out[k][t] = (out[k][t] || 0) + m[k][t];
      } else out[k] = (out[k] || 0) + m[k];
    }
  }
  return out;
}

export function applyStatMods(base, mods) {
  const s = {};
  for (const k of STATS) {
    let v = base[k] + (mods[k] || 0);
    v = Math.floor((v * (100 + (mods[k + 'Pct'] || 0))) / 100);
    s[k] = Math.max(STAT_FLOOR[k], Math.min(STAT_CAP[k], v));
  }
  return s;
}

// ---------- Items ----------
export function itemMods(inst) {
  const base = ITEM_BY_ID[inst.base];
  const r = RARITY_BY_ID[inst.rarity];
  const scaled = {};
  for (const k in base.mods || {}) {
    if (MOD_KEYS[k] === 'tagmap') { scaled[k] = { ...base.mods[k] }; continue; }
    const v = base.mods[k];
    // Positive values scale with rarity; drawbacks (negative) stay as-is.
    scaled[k] = v > 0 ? Math.floor((v * r.mult) / 100) : v;
  }
  const list = [scaled];
  for (const a of inst.affixes || []) {
    const af = AFFIX_BY_ID[a.id]; const val = af.values[a.tier];
    list.push(af.key === 'dmgVs' ? { dmgVs: { [af.vs]: val } } : { [af.key]: val });
  }
  return sumMods(list);
}

// Weapon profile after rarity scaling (damage scales; everything else from the type).
export function weaponProfile(inst) {
  const base = ITEM_BY_ID[inst.base]; const t = WEAPON_TYPES[base.type]; const r = RARITY_BY_ID[inst.rarity];
  return { ...t, dmg: [Math.floor((t.dmg[0] * r.mult) / 100), Math.floor((t.dmg[1] * r.mult) / 100)] };
}

// rarityBoost: % applied to every non-standard weight. floorId: minimum rarity.
export function rollRarity(rng, { rarityBoost = 100, floor = 'standard' } = {}) {
  const fi = RARITY_ORDER.indexOf(floor);
  const entries = RARITIES.filter((r, i) => i >= fi && !r.alienOnly)
    .map(r => [r.id, r.id === 'standard' ? r.weight : Math.floor((r.weight * rarityBoost) / 100)]);
  return weightedPick(rng, entries);
}

export function rollAffixes(rng, slot, rarityId) {
  const r = RARITY_BY_ID[rarityId];
  const pool = AFFIXES.filter(a => a.slots.includes(slot));
  const out = [];
  for (let i = 0; i < r.affixes && pool.length; i++) {
    const idx = rng.int(pool.length);
    out.push({ id: pool[idx].id, tier: r.tier });
    pool.splice(idx, 1);   // no duplicate affix on one item
  }
  return out;
}

export function rollItem(rng, baseId, opts = {}) {
  const base = ITEM_BY_ID[baseId];
  const rarity = base.rarity || rollRarity(rng, opts);
  return { base: baseId, rarity, affixes: rollAffixes(rng, base.slot, rarity) };
}
