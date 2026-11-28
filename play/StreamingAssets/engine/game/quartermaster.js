// Quartermaster + Auto-equip + squad presets (Ver. 0.22.0). Shared by the browser, Unity (read-only scoring) and
// boarding-api. New file: new names must come from new files.
import { GameError, canWield, itemById } from './rules.js';
import { ITEM_BY_ID, SLOTS, RARITY_BY_ID, WEAPON_TYPES } from '../data/gear.js';
import { SPECIALTY_BY_ID } from '../data/specialties.js';
import { ENTRY_BY_ID } from '../data/entries.js';
import { roomLevel, mothershipInput, entryMaxSquad } from '../data/mothership-rooms.js';
import { isDamaged } from '../data/defense-events.js';
import { itemMods, weaponProfile } from '../engine/progression.js';
import { QUARTERMASTER, MAX_SQUAD_PRESETS, SQUAD_NAME_MAX } from '../data/quartermaster.js';

const fail = (m) => { throw new GameError(m); };

// ---------- Quartermaster ----------
export const hasQuartermaster = (g) => !!g?.mothership?.quartermaster;
// Working = bought and the Armory isn't damaged (a damaged room gives nothing until repaired).
export const quartermasterWorking = (g) => hasQuartermaster(g) && !isDamaged(g, 'armory');

export function buyQuartermaster(g) {
  if (hasQuartermaster(g)) fail('You already have a Quartermaster.');
  for (const [room, lv] of Object.entries(QUARTERMASTER.requires))
    if (roomLevel(g, room) < lv) fail('Build the Armory first.');
  if (isDamaged(g, 'armory')) fail('Repair the Armory first.');
  if ((g.creds || 0) < QUARTERMASTER.price) fail(`Not enough CREDs (need ${QUARTERMASTER.price.toLocaleString()}).`);
  g.creds -= QUARTERMASTER.price;
  g.mothership ||= {};
  g.mothership.quartermaster = true;
  return { spent: QUARTERMASTER.price };
}

// ---------- Item scoring ----------
// How much one point of each stat is worth to a class: every stat counts, the ones the class grows into count more,
// and its primary stat most (Techs value Tech, Medics value healing, Infiltrators value Stealth...).
const STAT_SCALE = { hp: 0.35, aim: 1, arm: 1, spd: 0.6, grit: 0.6, tech: 1, stl: 1 };
const BASE_FOR_PCT = { hp: 100, aim: 50, arm: 25, spd: 50, grit: 50, tech: 30, stl: 20 };   // rough stat size for % mods
function statWeight(spec, k) {
  return STAT_SCALE[k] * (1 + (spec.growth[k] || 0) / 10 + (spec.primary === k ? 1.5 : 0));
}
// Value per point of the non-stat mods. Ability-flavoured ones only matter to the classes that use them.
function modWeight(spec, k) {
  switch (k) {
    case 'dmgPct': return 2; case 'critPct': return 1.5; case 'critDmgPct': return 0.5; case 'pierce': return 1.5;
    case 'rangeAdd': return 5; case 'rofPct': return 1.5; case 'suppressPct': return spec.id === 'heavy' ? 0.6 : 0.3;
    case 'dmgTakenPct': return -1.6; case 'evasion': return 1; case 'coverPct': return 0.6;
    case 'healPct': return spec.id === 'medic' ? 2.5 : 0.05;
    case 'reviveChance': return spec.id === 'medic' ? 2.5 : 0.2;
    case 'hackSpeedPct': return spec.id === 'tech' || spec.id === 'infiltrator' ? 0.6 : 0.05;
    case 'breachSpeedPct': return spec.id === 'breacher' ? 0.6 : 0.05;
    case 'detectPct': return 0.3; case 'abilityCdPct': return -0.6;
    default: return 0.3;
  }
}

/** Score of an item for a Soldier's class (higher = better). Used to rank candidates per slot. */
export function itemScore(specId, inst) {
  const spec = SPECIALTY_BY_ID[specId];
  const base = ITEM_BY_ID[inst.base];
  if (!spec || !base) return 0;
  const mods = itemMods(inst);
  let s = 0;
  for (const [k, v] of Object.entries(mods)) {
    if (k === 'dmgVs') { for (const x of Object.values(v || {})) s += x * 0.5; continue; }
    if (STAT_SCALE[k] !== undefined) { s += v * statWeight(spec, k); continue; }
    const pct = k.endsWith('Pct') && STAT_SCALE[k.slice(0, -3)] !== undefined ? k.slice(0, -3) : null;
    if (pct) { s += (v * BASE_FOR_PCT[pct] / 100) * statWeight(spec, pct); continue; }
    if (typeof v === 'number') s += v * modWeight(spec, k);
  }
  if (base.slot === 'weapon') {
    // Damage per second at optimal range, scaled up so weapons compare by firepower, plus range/accuracy/crit.
    const p = weaponProfile(inst), t = WEAPON_TYPES[base.type];
    const dps = ((p.dmg[0] + p.dmg[1]) / 2) * (8 / Math.max(1, p.rof));
    const aimFit = 1 + (spec.growth.aim || 0) / 100;
    s += dps * 6 * aimFit + Math.min(p.range, 8) * 1.5 + (t.acc || 0) * 0.4 + (t.crit || 0) * 0.4 + (t.pierce || 0) * 1.5;
  }
  s += (RARITY_BY_ID[inst.rarity]?.mult || 100) / 100;   // tie-break toward the rarer piece
  return Math.round(s * 10) / 10;
}

// ---------- Auto-equip ----------
const builtinIn = (g, s, slot) => { const it = s.gear[slot] && itemById(g, s.gear[slot]); return !!(it && ITEM_BY_ID[it.base]?.builtin); };

/**
 * Re-outfit the roster: Soldiers in priority order (the given uids first, then everyone else by level, XP and
 * missions) each take the best-scoring gear for their class from everything not fused in and not out with an MIA
 * Soldier. Returns { changed, soldiers } where changed counts slot changes.
 */
export function autoEquip(g, priority = []) {
  if (!hasQuartermaster(g)) fail('Hire a Quartermaster on the Mothership first.');
  if (isDamaged(g, 'armory')) fail('Repair the Armory first: the Quartermaster works out of it.');
  const usable = g.soldiers.filter(s => s.status !== 'mia');
  const want = Array.isArray(priority) ? priority.filter(u => typeof u === 'string') : [];
  const rank = (s) => { const i = want.indexOf(s.uid); return i < 0 ? 1e6 : i; };
  const order = usable.slice().sort((a, b) => rank(a) - rank(b) || (b.level - a.level) || ((b.xp || 0) - (a.xp || 0)) || ((b.missions || 0) - (a.missions || 0)));

  // Pool: unequipped items + everything worn by usable Soldiers (minus fused-in pieces). MIA Soldiers keep theirs.
  const away = new Set();
  for (const s of g.soldiers) if (s.status === 'mia') for (const v of Object.values(s.gear || {})) away.add(v);
  const before = new Map(usable.map(s => [s.uid, { ...s.gear }]));
  const pool = g.items.filter(it => !away.has(it.uid) && !ITEM_BY_ID[it.base]?.builtin);
  for (const s of usable) for (const slot of SLOTS) if (s.gear[slot] && !builtinIn(g, s, slot)) delete s.gear[slot];

  const taken = new Set();
  for (const s of order) for (const slot of SLOTS) {
    if (builtinIn(g, s, slot)) continue;
    let best = null, bestScore = -Infinity;
    for (const it of pool) {
      if (taken.has(it.uid) || ITEM_BY_ID[it.base].slot !== slot || !canWield(s, it)) continue;
      const sc = itemScore(s.specialty, it);
      if (sc > bestScore) { best = it; bestScore = sc; }
    }
    if (best) { s.gear[slot] = best.uid; taken.add(best.uid); }
  }
  let changed = 0;
  for (const s of usable) for (const slot of SLOTS) if ((before.get(s.uid)[slot] || null) !== (s.gear[slot] || null)) changed++;
  return { changed, soldiers: order.length };
}

// ---------- Squad presets ----------
/** Replace the saved squad presets. Each: { id, name, entry, squad: [uids] } with squad size within the entry's seats. */
export function saveSquads(g, list) {
  if (!Array.isArray(list)) fail('Bad squad list.');
  if (list.length > MAX_SQUAD_PRESETS) fail(`You can save up to ${MAX_SQUAD_PRESETS} squads.`);
  const msEntry = mothershipInput(g)?.entry || null;
  const alive = new Set(g.soldiers.map(s => s.uid));
  const out = [], ids = new Set();
  for (const p of list) {
    const name = String(p?.name ?? '').trim().slice(0, SQUAD_NAME_MAX);
    if (!name) fail('Every squad needs a name.');
    const entry = ENTRY_BY_ID[p?.entry] || fail(`${name}: pick an entry method.`);
    const squad = [...new Set((Array.isArray(p.squad) ? p.squad : []).filter(u => typeof u === 'string' && alive.has(u)))];
    if (!squad.length) fail(`${name}: add at least one Soldier.`);
    const max = entryMaxSquad(entry, msEntry);
    if (squad.length > max) fail(`${name}: ${entry.name} only takes ${max} Soldiers.`);
    let id = typeof p.id === 'string' && /^[a-z0-9]{1,16}$/.test(p.id) ? p.id : '';
    while (!id || ids.has(id)) id = 'q' + (ids.size + out.length + 1) + Math.random().toString(36).slice(2, 6);
    ids.add(id);
    out.push({ id, name, entry: entry.id, squad });
  }
  g.squads = out;
  return { squads: out.length };
}

/** A preset as it can deploy right now: dead/dismissed Soldiers dropped, trimmed to the entry's current seats. */
export function presetView(g, p) {
  const msEntry = mothershipInput(g)?.entry || null;
  const entry = ENTRY_BY_ID[p.entry];
  const alive = new Set(g.soldiers.map(s => s.uid));
  const max = entry ? entryMaxSquad(entry, msEntry) : 0;
  const squad = (p.squad || []).filter(u => alive.has(u));
  return { ...p, squad: squad.slice(0, max), dropped: (p.squad || []).length - squad.length, trimmed: Math.max(0, squad.length - max), max };
}
