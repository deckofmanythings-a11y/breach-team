// Proves every special effect actually triggers in real missions.
// For each effect: give it to a squad, run missions, and check for its engine event
// (or, for passive bonuses, compare against the same squad without it).
// Run: node test/effects.mjs [samples=40]
import { simulate } from '../js/engine/battle.js';
import { makeSquad } from './fixtures.mjs';

const N = +(process.argv[2] || 40);
const SHIPS = ['hauler', 'raider', 'corvette'];

// mutate(squad) changes the squad; check(battle) returns how many times the effect showed up.
function run(entry, tactic, specs, level, mutate) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const squad = makeSquad(i * 17 + 3, specs, level, 'milspec');
    mutate(squad);
    out.push(simulate({ seed: 777 + i * 6151, ship: SHIPS[i % 3], entry, tactic, retreat: 'teleport_recall', squad }));
  }
  return out;
}
const setPerk = (s, tier, id) => { const p = s.perks.slice(); p[tier] = id; s.perks = p; };
const evCount = (bs, pred) => bs.reduce((n, b) => n + b.events.filter(pred).length, 0);
const sum = (bs, f) => bs.reduce((n, b) => n + f(b), 0);
const unitIdsOfKind = (b, kind) => new Set(b.units.filter(u => u.kind === kind).map(u => u.id));

const FOUR = ['assault', 'breacher', 'tech', 'medic'];
const results = [];
function expect(name, count, detail = '') { results.push([name, count, detail]); }

// --- Event-based effects ---
{
  const bs = run('shuttle', 'balanced', FOUR, 10, sq => { sq[0].gear.utility = { base: 'frag_grenades', rarity: 'standard', affixes: [] }; });
  expect('grenade (Frag Grenades)', evCount(bs, e => e[1] === 'grenade'));
}
{
  const bs = run('shuttle', 'blitz', FOUR, 10, sq => { for (const s of sq) s.gear.utility = { base: 'smoke_grenades', rarity: 'standard', affixes: [] }; });
  expect('smoke (Smoke Grenades)', evCount(bs, e => e[1] === 'smoke'));
}
{
  const bs = run('shuttle', 'blitz', FOUR, 15, sq => { setPerk(sq[3], 1, 'smoke_cover'); });
  expect('smokeRevive (Smoke Cover)', evCount(bs, e => e[1] === 'smoke'), 'smoke after a revive');
}
{
  const bs = run('shuttle', 'blitz', FOUR, 15, sq => { setPerk(sq[0], 2, 'killing_spree'); });
  expect('killingSpree (Killing Spree)', evCount(bs, e => e[1] === 'ability' && e[3] === 'killing_spree'));
}
{
  const bs = run('shuttle', 'balanced', FOUR, 15, sq => { setPerk(sq[0], 2, 'spearhead'); });
  expect('spearhead (Spearhead)', evCount(bs, e => e[1] === 'ability' && e[3] === 'spearhead'));
}
{
  const bs = run('shuttle', 'balanced', FOUR, 15, sq => { setPerk(sq[1], 2, 'chain_breach'); });
  expect('chainBreach (Chain Breach)', evCount(bs, e => e[1] === 'door' && e[3] === 'chain'));
}
{
  const bs = run('shuttle', 'balanced', FOUR, 15, sq => { sq[2].gear.utility = { base: 'motion_tracker', rarity: 'prototype', affixes: [] }; });
  expect('tracker (Motion Tracker)', evCount(bs, e => e[1] === 'ability' && e[3] === 'tracker_fire'));
}
{
  const bs = run('shuttle', 'balanced', FOUR, 15, sq => { setPerk(sq[2], 2, 'combat_drone'); });
  expect('drone (Combat Drone)', sum(bs, b => { const d = unitIdsOfKind(b, 'sys_drone'); return b.events.filter(e => e[1] === 'shot' && d.has(e[2])).length; }), 'shots fired by drones');
}
{
  const bs = run('shuttle', 'balanced', FOUR, 15, sq => { setPerk(sq[2], 2, 'system_crash'); });
  expect('stopReinforcements (System Crash)', evCount(bs, e => e[1] === 'ability' && e[3] === 'system_crash'));
}
{
  // Breaching Pod arrival room has decompression; the Tech can shut it down.
  const bs = run('breach_pod', 'balanced', FOUR, 10, sq => { setPerk(sq[2], 1, 'hazard_control'); });
  expect('disableHazards (Hazard Control)', evCount(bs, e => e[1] === 'hazard_off'));
}
{
  const bs = run('shuttle', 'stealthy', ['infiltrator', 'assault', 'breacher', 'medic'], 15, sq => { setPerk(sq[0], 1, 'saboteur'); });
  expect('sabotage (Saboteur)', evCount(bs, e => e[1] === 'sabotage'), 'turrets + reactors');
}
{
  const bs = run('shuttle', 'balanced', ['heavy', 'assault', 'breacher', 'medic'], 10, sq => { sq[0].gear.weapon = { base: 'flamer_std', rarity: 'standard', affixes: [] }; });
  expect('fire (Flamer sets rooms alight)', evCount(bs, e => e[1] === 'fire'));
}
{
  // Run and Gun: shots fired while moving show up as a 'shot' on the same tick as a 'move' by that unit.
  const bs = run('shuttle', 'blitz', FOUR, 10, sq => { setPerk(sq[0], 0, 'run_and_gun'); });
  expect('runAndGun (Run and Gun)', sum(bs, b => { let n = 0; for (let i = 1; i < b.events.length; i++) { const a = b.events[i - 1], c = b.events[i]; if (a[1] === 'move' && c[1] === 'shot' && a[0] === c[0] && a[2] === c[2]) n++; } return n; }), 'shots on the move');
}

// --- Passive bonuses: compare with vs without (same seeds) ---
function ab(label, entry, tactic, specs, level, mutate, measure) {
  const off = run(entry, tactic, specs, level, () => {}), on = run(entry, tactic, specs, level, mutate);
  const a = sum(off, measure), b = sum(on, measure);
  expect(label, b !== a ? 1 : 0, `${a} -> ${b}`);
}
const dmgBy = (i) => (b) => b.soldiers[i].dmgDealt;
ab('stims (Combat Stims)', 'shuttle', 'blitz', FOUR, 10, sq => { setPerk(sq[3], 1, 'combat_stims'); }, b => b.soldiers.reduce((n, s) => n + s.dmgDealt, 0));
ab('doorwayBonus (Door Ram)', 'shuttle', 'balanced', FOUR, 10, sq => { setPerk(sq[1], 1, 'door_ram'); }, dmgBy(1));
ab('meleeMaster (Martial Arts Download)', 'shuttle', 'balanced', ['infiltrator', 'assault', 'breacher', 'medic'], 10,
  sq => { sq[0].gear.implant = { base: 'combat_download', rarity: 'relic', affixes: [] }; }, dmgBy(0));
// Shield Belt: melee hits ignore the wearer's armor. Pirates bring Cutthroats (blades), so damage taken should change.
ab('slowBladeWeak (Shield Belt weakness)', 'shuttle', 'balanced', FOUR, 10,
  sq => { for (const s of sq) s.gear.armor = { base: 'shield_belt', rarity: 'prototype', affixes: [] }; }, b => b.ship === 'raider' ? b.soldiers.reduce((n, s) => n + s.dmgTaken, 0) : 0);

let fail = 0;
for (const [name, count, detail] of results) {
  const ok = count > 0; if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(40)} ${String(count).padEnd(6)} ${detail}`);
}
console.log(fail ? `\n${fail} effect(s) never triggered` : '\nAll effects triggered.');
process.exit(fail ? 1 : 0);
